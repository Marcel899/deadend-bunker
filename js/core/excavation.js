/* Excavation: digging new floors, discovering abandoned facilities. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Excavation = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;

  function nextDepth(state) { return state.floors.length + 1; }
  function maxDepth(state) { return Math.min(C().MAX_FLOORS, DE.Effects.get(state).maxFloor); }

  function cost(state, depth) {
    const fx = DE.Effects.get(state);
    const out = { scrap: Math.ceil(180 * Math.pow(1.65, depth - 2) * fx.excavationCostMult) };
    if (depth >= 3) out.concrete = Math.ceil(40 * Math.pow(1.7, depth - 3) * fx.excavationCostMult);
    return out;
  }
  function time(state, depth) {
    // harder rock takes longer to break through
    const hard = DE.Data.stratumAt ? DE.Data.stratumAt(depth).hardness : 1;
    return Math.max(10, 60 * Math.pow(1.35, depth - 2) * hard * DE.Effects.get(state).excavationTimeMult);
  }

  function canStart(state) {
    const d = nextDepth(state);
    if (state.excavation) return { ok: false, reason: 'Already digging' };
    if (d > maxDepth(state)) {
      if (d > C().MAX_FLOORS) return { ok: false, reason: 'Bedrock reached' };
      const layer = DE.Data.stratumAt ? DE.Data.stratumAt(d) : null;
      return { ok: false, reason: layer ? layer.name + ' needs better equipment (research the next excavation tech)' : 'Requires excavation research' };
    }
    if (!U().canAfford(state.resources, cost(state, d))) return { ok: false, reason: 'Not enough resources' };
    return { ok: true };
  }

  function start(state, now) {
    now = now || Date.now();
    const c = canStart(state);
    if (!c.ok) return c;
    const d = nextDepth(state);
    U().pay(state.resources, cost(state, d));
    const dur = time(state, d);
    state.excavation = { depth: d, endsAt: now + dur * 1000, duration: dur };
    return { ok: true };
  }

  /** Decide if a facility is uncovered on a new floor. */
  function rollFacility(state, depth) {
    const candidates = DE.Data.FACILITIES.filter(f => f.minDepth <= depth && !state.floors.some(fl => fl.facility === f.id));
    if (!candidates.length || depth < 3) return null;
    const sinceLast = state.flags.floorsSinceFacility || 0;
    const p = 0.3 + 0.2 * sinceLast; // pity timer
    if (!U().chance(p)) return null;
    return U().weightedPick(candidates);
  }

  /** Something turned up while digging: a supply cache, a survivor trapped in an old shelter, or
   * research notes. Bigger finds deeper down. */
  function rollFind(state, depth) {
    const scale = Math.pow(1.55, depth - 2), r = Math.random();
    const give = (loot) => { for (const k in loot) { state.resources[k] = Math.min(DE.Economy.storageCap(state, k), state.resources[k] + loot[k]); } return loot; };
    if (r < .45) return { kind: 'cache', text: 'An old supply cache in the rubble.', loot: give(depth >= 3 ? { scrap: Math.round(140 * scale), concrete: Math.round(30 * scale) } : { scrap: Math.round(160 * scale) }) };
    if (r < .62 && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) { const sv = DE.Survivors.spawn(state); state.stats.recruited++; return { kind: 'survivor', text: sv.name + ' was trapped in a collapsed shelter — and is grateful.', name: sv.name, id: sv.id }; }
    if (r < .8) return { kind: 'notes', text: 'Water-stained research notes in a sealed tube.', loot: give({ research: Math.round(45 * scale) }) };
    return null;
  }
  function tick(state, now) {
    const ex = state.excavation;
    if (!ex || now < ex.endsAt) return null;
    state.excavation = null;
    const floor = DE.State.emptyFloor(ex.depth);
    state.floors.push(floor);
    state.stats.maxDepth = Math.max(state.stats.maxDepth, ex.depth);
    const fac = rollFacility(state, ex.depth);
    if (fac) {
      floor.facility = fac.id;
      DE.Bunker.placeRoom(state, fac.room, ex.depth, C().FLOOR_SLOTS - DE.Data.ROOMS[fac.room].size, 1, now);
      state.flags.floorsSinceFacility = 0;
    } else state.flags.floorsSinceFacility = (state.flags.floorsSinceFacility || 0) + 1;
    const find = rollFind(state, ex.depth);
    state._fx = null;
    state._dirtyBunker = true;
    return { depth: ex.depth, facility: fac, find };
  }

  return { nextDepth, maxDepth, cost, time, canStart, start, tick };
})();
