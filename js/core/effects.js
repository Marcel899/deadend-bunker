/* Aggregates every passive bonus (research, legacy upgrades, room effects, traits)
 * into one plain object consulted by all systems. Recomputed each tick — cheap. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Effects = (function () {
  const C = () => DE.CONFIG;

  function defaults() {
    return {
      roomMult: {},            // per room type, additive bonus (0.25 = +25%)
      globalMult: 0,           // additive, applied to all production
      consumptionMult: 1,      // room inputs
      survivorConsumptionMult: 1,
      unmannedBase: C().UNMANNED_BASE,
      buildTimeMult: 1, buildCostMult: 1,
      storageMult: 1,
      excavationCostMult: 1, excavationTimeMult: 1,
      maxFloor: C().BASE_MAX_FLOOR,
      wallHpMult: 1, guardDmgMult: 1, turretDmgMult: 1, turretCap: 4,
      turretsUnlocked: false, trapsUnlocked: false,
      workerEff: 1, xpMult: 1, housingPerLevel: 0, moraleBonus: 0,
      offlineCapHours: C().OFFLINE_CAP_HOURS,
      powerUseMult: 1, fuelUseMult: 1, researchSpeed: 1, healMult: 1,
      waveIntervalMult: 1,
      unlockedRooms: {},
      recruitDiscount: 0, lootBonus: 1, expeditionSlots: 0,
      housing: 0, storage: 0, morale: 0, foodSave: 0, heal: 0, radio: 0,
      startResources: 0, startSurvivors: 0, startFloors: 0, startResearchTier: 0,
      // room / overworld effects added with the 50-room system
      capBonus: { food: 0, water: 0 }, guardCap: 4, trapDmgMult: 1, waveWarning: 0, waveLoot: 0,
      expeditionSpeed: 0, expeditionSafety: 0, waterSave: 0, defenseFlat: 0, bossWeaken: 0, cryoSlots: 0,
      allLocations: false, autoAssign: 0, toxicResist: 0, sleepSpeed: 0, eatSpeed: 0, hungerSlow: 0,
    };
  }

  /** Apply one effect descriptor (from research or legacy data) `times` times. */
  function applyEffect(fx, e, times) {
    const v = (e.value || 0) * (times == null ? 1 : times);
    switch (e.type) {
      case 'roomMult': fx.roomMult[e.room] = (fx.roomMult[e.room] || 0) + v; break;
      case 'globalMult': fx.globalMult += v; break;
      case 'consumptionMult': fx.consumptionMult += v; break;
      case 'survivorConsumptionMult': fx.survivorConsumptionMult += v; break;
      case 'unmannedBase': fx.unmannedBase = Math.max(fx.unmannedBase, e.value); break;
      case 'buildTimeMult': fx.buildTimeMult += v; break;
      case 'buildCostMult': fx.buildCostMult += v; break;
      case 'storageMult': fx.storageMult += v; break;
      case 'excavationCostMult': fx.excavationCostMult += v; break;
      case 'excavationTimeMult': fx.excavationTimeMult += v; break;
      case 'maxFloor': fx.maxFloor = Math.max(fx.maxFloor, e.value); break;
      case 'wallHpMult': fx.wallHpMult += v; break;
      case 'guardDmgMult': fx.guardDmgMult += v; break;
      case 'turretDmgMult': fx.turretDmgMult += v; break;
      case 'unlockTurrets': fx.turretsUnlocked = true; break;
      case 'unlockTraps': fx.trapsUnlocked = true; break;
      case 'unlockRoom': fx.unlockedRooms[e.room] = true; break;
      case 'workerEff': fx.workerEff += v; break;
      case 'xpMult': fx.xpMult += v; break;
      case 'housingPerLevel': fx.housingPerLevel += v; break;
      case 'moraleBonus': fx.moraleBonus += v; break;
      case 'offlineCapHours': fx.offlineCapHours += v; break;
      case 'powerUseMult': fx.powerUseMult += v; break;
      case 'fuelUseMult': fx.fuelUseMult += v; break;
      case 'researchSpeed': fx.researchSpeed += v; break;
      case 'healMult': fx.healMult += v; break;
      case 'waveIntervalMult': fx.waveIntervalMult += v; break;
      case 'startResources': fx.startResources += v; break;
      case 'startSurvivors': fx.startSurvivors += v; break;
      case 'startFloors': fx.startFloors += v; break;
      case 'startResearchTier': fx.startResearchTier += v; break;
      case 'trapDmgMult': fx.trapDmgMult += v; break;
      case 'waveWarning': fx.waveWarning += v; break;
      case 'expeditionSpeed': fx.expeditionSpeed += v; break;
      case 'expeditionSafety': fx.expeditionSafety += v; break;
      case 'turretCap': fx.turretCap += v; break;
      default: break;
    }
  }

  /** Legacy-only effects (needed before a state exists, e.g. when starting a new run). */
  function legacyEffects(prestige) {
    const fx = defaults();
    if (prestige && prestige.upgrades) {
      for (const id in prestige.upgrades) {
        const def = DE.Data.LEGACY[id]; const lvl = prestige.upgrades[id];
        if (!def || !lvl) continue;
        def.effects.forEach(e => applyEffect(fx, e, lvl));
      }
    }
    return fx;
  }

  function compute(state) {
    const fx = legacyEffects(state.prestige);
    // research
    for (const id in state.research.done) {
      const node = DE.Data.RESEARCH[id];
      if (node) node.effects.forEach(e => applyEffect(fx, e, 1));
    }
    // room effects (only active rooms)
    for (const id in state.rooms) {
      const room = state.rooms[id];
      if (room.level < 1) continue;
      const def = DE.Data.ROOMS[room.type];
      if (!def || !def.effects) continue;
      for (const k in def.effects) {
        const per = def.effects[k];
        switch (k) {
          case 'housing': fx.housing += (per + (room.type === 'quarters' ? fx.housingPerLevel : 0)) * room.level; break;
          case 'storage': fx.storage += per * room.level; break;
          case 'morale': fx.morale += per * room.level; break;
          case 'foodSave': fx.foodSave = Math.min(0.6, fx.foodSave + per * room.level); break;
          case 'heal': fx.heal += per * room.level; break;
          case 'guardDmg': fx.guardDmgMult += per * room.level; break;
          case 'turretCap': fx.turretCap += per * room.level; break;
          case 'xp': fx.xpMult += per * room.level; break;
          case 'recruitDiscount': fx.recruitDiscount = Math.min(0.7, fx.recruitDiscount + per * room.level); break;
          case 'radio': fx.radio += per * room.level; break;
          case 'expeditionSlots': fx.expeditionSlots += per * room.level; break;
          case 'lootBonus': fx.lootBonus += per * room.level; break;
          case 'sleepSpeed': fx.sleepSpeed += per * room.level; break;
          case 'eatSpeed': fx.eatSpeed += per * room.level; break;
          case 'hungerSlow': fx.hungerSlow = Math.min(0.6, fx.hungerSlow + per * room.level); break;
          case 'waterCap': fx.capBonus.water += per * room.level; break;
          case 'foodCap': fx.capBonus.food += per * room.level; break;
          case 'guardCap': fx.guardCap += per * room.level; break;
          case 'waveWarning': fx.waveWarning += per * room.level; break;
          case 'waveLoot': fx.waveLoot += per * room.level; break;
          case 'turretDmg': fx.turretDmgMult += per * room.level; break;
          case 'trapDmg': fx.trapDmgMult += per * room.level; break;
          case 'wallHp': fx.wallHpMult += per * room.level; break;
          case 'defenseFlat': fx.defenseFlat += per * room.level; break;
          case 'bossWeaken': fx.bossWeaken = Math.min(0.8, fx.bossWeaken + per * room.level); break;
          case 'expeditionSpeed': fx.expeditionSpeed = Math.min(0.7, fx.expeditionSpeed + per * room.level); break;
          case 'expeditionSafety': fx.expeditionSafety = Math.min(0.8, fx.expeditionSafety + per * room.level); break;
          case 'consumptionSave': fx.consumptionMult -= per * room.level; break;
          case 'toxicResist': fx.toxicResist = Math.min(0.9, fx.toxicResist + per * room.level); break;
          case 'cryoSlots': fx.cryoSlots += per * room.level; break;
          case 'allLocations': fx.allLocations = true; break;
          case 'autoAssign': fx.autoAssign += per * room.level; break;
          case 'globalMult': fx.globalMult += per * room.level; break;
          case 'offlineCap': fx.offlineCapHours += per * room.level; break;
          case 'workerEff': fx.workerEff += per * room.level; break;
          case 'digBonus': fx.excavationCostMult -= per * room.level; fx.excavationTimeMult -= per * room.level; break;
          default: break;
        }
      }
    }
    // overworld structures
    if (state.overworld && DE.Data.OVERWORLD) for (const k in DE.Data.OVERWORLD) {
      const def = DE.Data.OVERWORLD[k]; const lvl = state.overworld[k] || 0;
      for (let i = 1; i <= lvl && i < def.levels.length; i++) { const e = def.levels[i].effects || {}; for (const t in e) applyEffect(fx, { type: t, value: e[t] }, 1); }
    }
    // survivor traits with bunker-wide effects
    for (const id in state.survivors) {
      const s = state.survivors[id];
      (s.traits || []).forEach(t => { const d = DE.Data.TRAITS[t]; if (d && d.morale) fx.morale += d.morale; });
    }
    fx.buildTimeMult = Math.max(0.2, fx.buildTimeMult);
    fx.buildCostMult = Math.max(0.3, fx.buildCostMult);
    fx.excavationCostMult = Math.max(0.3, fx.excavationCostMult);
    fx.excavationTimeMult = Math.max(0.3, fx.excavationTimeMult);
    fx.consumptionMult = Math.max(0.2, fx.consumptionMult);
    fx.survivorConsumptionMult = Math.max(0.2, fx.survivorConsumptionMult);
    fx.powerUseMult = Math.max(0.2, fx.powerUseMult);
    fx.fuelUseMult = Math.max(0.1, fx.fuelUseMult);
    fx.waveIntervalMult = Math.max(0.5, fx.waveIntervalMult);
    return fx;
  }

  /** Cached effects for the current tick (sim sets state._fx). */
  function get(state) { return state._fx || (state._fx = compute(state)); }

  return { defaults, compute, get, legacyEffects, applyEffect };
})();
