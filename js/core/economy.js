/* Resource economy: per-room production, consumption, power grid, storage caps.
 * production = base * levelMult * workerMult * adjacencyMult * (1 + researchMult) * (1 + globalMult) * morale * power
 */
var DE = globalThis.DE = globalThis.DE || {};

DE.Economy = (function () {
  const C = () => DE.CONFIG;

  /** Level multiplier with milestone jumps at 10/25/50/100. */
  function levelMult(level) {
    let m = level * (1 + 0.08 * (level - 1));
    if (level >= 10) m *= 2;
    if (level >= 25) m *= 2;
    if (level >= 50) m *= 3;
    if (level >= 100) m *= 3;
    return m;
  }

  function moraleMult(morale) { return 0.6 + (morale / 100) * 0.6; }

  function storageCap(state, res) {
    const def = DE.Data.RESOURCES[res];
    if (!def || !def.capped) return Infinity;
    const fx = DE.Effects.get(state);
    return Math.floor((C().BASE_STORAGE + fx.storage + (fx.capBonus && fx.capBonus[res] || 0)) * fx.storageMult);
  }

  /** Worker multiplier: unmannedBase + (1 - unmannedBase) * staffing where staffing = Σ efficiency / max. */
  function workerMult(state, room, def, fx) {
    if (!def.workers) return 1;
    let eff = 0;
    room.workers.forEach(id => { const s = state.survivors[id]; if (s) eff += DE.Survivors.efficiency(s, def, fx) * DE.Needs.presence(s) * DE.Needs.needsMult(s); });
    const staffing = Math.min(1.5, eff / def.workers);
    const base = Math.max(fx.unmannedBase, def.unmannedBase || 0);
    return base + (1 - base) * staffing;
  }

  function isActive(room) { return room.level >= 1; }

  /** Compute all per-second rates. Pure (does not mutate state). */
  function computeRates(state, fx) {
    fx = fx || DE.Effects.get(state);
    const production = {}, consumption = {}, perRoom = {};
    DE.Data.RESOURCE_ORDER.forEach(r => { production[r] = 0; consumption[r] = 0; });
    const morale = moraleMult(state.morale);
    const rooms = Object.values(state.rooms).filter(isActive);

    // pass 1: raw outputs, power usage
    let powerGen = 0, powerUse = 0;
    rooms.forEach(room => {
      const def = DE.Data.ROOMS[room.type];
      const adj = DE.Bunker.adjacencyBonus(state, room);
      const wm = workerMult(state, room, def, fx);
      const research = 1 + (fx.roomMult[room.type] || 0);
      const mult = levelMult(room.level) * wm * (1 + adj) * research * (1 + fx.globalMult) * morale;
      // input starvation
      let starve = 1;
      if (def.consumes) for (const r in def.consumes) if (state.resources[r] <= 0) starve = Math.min(starve, def.starvedFloor || 0);
      const info = { mult, workerMult: wm, adjacency: adj, research, starve, power: 1, produces: {}, consumes: {}, powerUse: 0 };
      if (def.produces) for (const r in def.produces) info.produces[r] = def.produces[r] * mult * starve;
      if (def.consumes) for (const r in def.consumes) {
        let rate = def.consumes[r] * levelMult(room.level) * fx.consumptionMult * starve;
        if (r === 'fuel') rate *= fx.fuelUseMult;
        info.consumes[r] = rate;
      }
      if (def.powerUse) info.powerUse = def.powerUse * (1 + 0.25 * (room.level - 1)) * fx.powerUseMult;
      if (info.produces.electricity) powerGen += info.produces.electricity;
      powerUse += info.powerUse;
      perRoom[room.id] = info;
    });

    // turrets draw power
    const turretPower = state.defense.turrets * C().TURRET_POWER;
    powerUse += turretPower;

    // brownout: when the battery is empty and demand exceeds supply, powered rooms slow down
    let powerFactor = 1;
    if (state.resources.electricity <= 0.01 && powerUse > powerGen && powerUse > 0) powerFactor = Math.max(0.25, powerGen / powerUse);

    rooms.forEach(room => {
      const info = perRoom[room.id];
      if (info.powerUse > 0) {
        info.power = powerFactor;
        for (const r in info.produces) info.produces[r] *= powerFactor;
        for (const r in info.consumes) info.consumes[r] *= powerFactor;
        info.powerUse *= powerFactor;
      }
      for (const r in info.produces) production[r] += info.produces[r];
      for (const r in info.consumes) consumption[r] += info.consumes[r];
      consumption.electricity += info.powerUse;
    });
    consumption.electricity += turretPower * powerFactor;

    // survivors eat and drink
    let food = 0, water = 0; let cryo = fx.cryoSlots || 0;
    for (const id in state.survivors) {
      const s = state.survivors[id];
      if (cryo > 0 && !s.assignment) { cryo--; continue; } // idle survivors rest in cryo pods: no food or water
      const hunger = DE.Survivors.hungerMult(s);
      food += C().SURVIVOR_FOOD * hunger; water += C().SURVIVOR_WATER * hunger;
    }
    food *= fx.survivorConsumptionMult * (1 - fx.foodSave);
    water *= fx.survivorConsumptionMult;
    consumption.food += food; consumption.water += water;

    const net = {};
    DE.Data.RESOURCE_ORDER.forEach(r => net[r] = production[r] - consumption[r]);
    return { production, consumption, net, perRoom, powerGen, powerUse, powerFactor, survivorFood: food, survivorWater: water };
  }

  /** Apply rates for dt seconds, clamp to caps, track statistics. */
  function apply(state, rates, dt, fx) {
    for (const r of DE.Data.RESOURCE_ORDER) {
      const before = state.resources[r];
      let after = before + rates.net[r] * dt;
      const cap = storageCap(state, r);
      if (after > cap) after = Math.max(before > cap ? before : cap, cap); // don't gain beyond cap, but don't lose excess instantly
      if (after < 0) after = 0;
      state.resources[r] = after;
      const gained = rates.production[r] * dt;
      state.stats.produced[r] += gained;
      state.stats.runScore += gained * DE.Data.RESOURCES[r].value;
    }
  }

  return { levelMult, moraleMult, storageCap, workerMult, computeRates, apply };
})();
