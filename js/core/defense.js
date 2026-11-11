/* Zombie defense: periodic waves resolved against wall + guards + turrets + traps. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Defense = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;

  function wallMaxHp(state) {
    const w = state.defense.wall;
    return Math.floor(C().WALL_BASE_HP * w.level * (1 + 0.1 * (w.level - 1)) * DE.Effects.get(state).wallHpMult);
  }
  function wallUpgradeCost(state) {
    const l = state.defense.wall.level;
    return { scrap: Math.ceil(120 * Math.pow(1.4, l - 1)), concrete: l >= 3 ? Math.ceil(30 * Math.pow(1.4, l - 3)) : 0 };
  }
  function repairCost(state) {
    const missing = wallMaxHp(state) - state.defense.wall.hp;
    return { scrap: Math.ceil(missing * 0.25) };
  }
  function turretCost(state) { const n = state.defense.turrets; return { scrap: Math.ceil(200 * Math.pow(1.35, n)), concrete: Math.ceil(40 * Math.pow(1.35, n)) }; }
  function trapCost(state) { return { scrap: 45 }; }
  function maxTurrets(state) { return DE.Effects.get(state).turretCap; }

  function upgradeWall(state) {
    const cost = wallUpgradeCost(state);
    if (!U().canAfford(state.resources, cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, cost);
    const before = wallMaxHp(state);
    state.defense.wall.level++;
    state.defense.wall.hp += wallMaxHp(state) - before;
    return { ok: true };
  }
  function repairWall(state) {
    const cost = repairCost(state);
    if (cost.scrap <= 0) return { ok: false, reason: 'Wall is intact' };
    if (!U().canAfford(state.resources, cost)) {
      // partial repair with what we have
      const hp = Math.floor(state.resources.scrap / 0.25);
      if (hp < 1) return { ok: false, reason: 'No scrap' };
      state.resources.scrap -= hp * 0.25; state.defense.wall.hp = Math.min(wallMaxHp(state), state.defense.wall.hp + hp);
      return { ok: true, partial: true };
    }
    U().pay(state.resources, cost);
    state.defense.wall.hp = wallMaxHp(state);
    return { ok: true };
  }
  function buyTurret(state) {
    const fx = DE.Effects.get(state);
    if (!fx.turretsUnlocked) return { ok: false, reason: 'Requires Heavy Machinery' };
    if (state.defense.turrets >= maxTurrets(state)) return { ok: false, reason: 'No turret slots (build an Armory)' };
    const cost = turretCost(state);
    if (!U().canAfford(state.resources, cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, cost); state.defense.turrets++;
    return { ok: true };
  }
  function buyTraps(state, n) {
    const fx = DE.Effects.get(state);
    if (!fx.trapsUnlocked) return { ok: false, reason: 'Requires Fortification' };
    n = Math.max(1, n | 0);
    const cost = U().scaleCost(trapCost(state), n);
    if (!U().canAfford(state.resources, cost)) return { ok: false, reason: 'Not enough scrap' };
    U().pay(state.resources, cost); state.defense.traps += n;
    return { ok: true };
  }

  /** Threat of the upcoming wave. */
  function waveHp(state, n) {
    n = n || state.defense.wave;
    const weaken = isBossWave(n) ? 1 - (DE.Effects.get(state).bossWeaken || 0) : 1;
    return Math.floor(C().WAVE_BASE_HP * Math.pow(C().WAVE_GROWTH, n - 1) * (1 + 0.08 * (state.floors.length - 1)) * weaken);
  }
  function isBossWave(n) { return n % DE.Data.BOSS_EVERY === 0; }

  /** Deterministic-ish horde for wave n: counts per type, average damage multiplier, toxic count. */
  function waveComposition(hp, n) {
    n = n || 1;
    const pool = DE.Data.ZOMBIES.filter(z => !z.boss && z.minWave <= n);
    const list = []; let left = hp; let guard = 0;
    if (isBossWave(n)) { const b = DE.Data.ZOMBIES.find(z => z.boss); const bhp = Math.floor(hp * b.hp); list.push(Object.assign({}, b, { hp: bhp })); left -= bhp; }
    while (left > 0 && guard++ < 400) { const z = U().weightedPick(pool); list.push(z); left -= z.hp; }
    return list;
  }
  function compositionSummary(list) {
    const counts = {}; let dmgSum = 0, toxic = 0;
    list.forEach(z => { counts[z.id] = (counts[z.id] || 0) + 1; dmgSum += z.dmg * z.hp; if (z.toxic) toxic++; });
    const totalHp = list.reduce((s, z) => s + z.hp, 0) || 1;
    return { counts, dmgMult: dmgSum / totalHp, toxic, boss: list.some(z => z.boss) };
  }
  /** Loot for beating a wave: scales with wave number, bonus on boss waves. */
  function waveReward(n, outcome) {
    if (outcome === 'breach') return {};
    const m = (outcome === 'victory' ? 1 : 0.4) * (isBossWave(n) ? 4 : 1);
    return { scrap: Math.floor(25 * Math.pow(n, 1.15) * m), research: Math.floor(4 * Math.pow(n, 1.1) * m) };
  }

  /** Our firepower per second and flat trap damage. */
  function defensePower(state) {
    const fx = DE.Effects.get(state);
    const guards = DE.Survivors.guards(state);
    const guardDps = guards.reduce((s, g) => s + DE.Survivors.guardPower(g, fx), 0);
    const turretDps = state.defense.turrets * C().TURRET_DMG * fx.turretDmgMult * (state._rates ? state._rates.powerFactor : 1);
    const trapsUsed = Math.min(state.defense.traps, C().TRAPS_PER_WAVE);
    const trapDmg = trapsUsed * C().TRAP_DMG * fx.trapDmgMult;
    return { guardDps, turretDps, trapDmg, trapsUsed, flat: fx.defenseFlat, total: (guardDps + turretDps) * C().WAVE_DURATION + trapDmg + fx.defenseFlat, guards: guards.length };
  }

  function waveInterval(state) { return C().WAVE_INTERVAL_SEC * DE.Effects.get(state).waveIntervalMult; }
  /** Seconds of warning before a wave in which the horde is visible on the surface. */
  function warningSec(state) { return 45 + (DE.Effects.get(state).waveWarning || 0); }

  /** Resolve a wave now. */
  function resolveWave(state, now) {
    const n = state.defense.wave;
    const hp = waveHp(state, n);
    const power = defensePower(state);
    const fx = DE.Effects.get(state);
    const comp = compositionSummary(waveComposition(hp, n));
    const result = { wave: n, hp, dealt: Math.floor(power.total), guards: power.guards, turrets: state.defense.turrets, trapsUsed: power.trapsUsed, t: now, breach: false, wallDamage: 0, losses: {}, injured: [], killed: 0, boss: comp.boss, counts: comp.counts, reward: {} };
    state.defense.traps -= power.trapsUsed;
    const killedFraction = Math.min(1, power.total / hp);
    const total = Object.values(comp.counts).reduce((s, c) => s + c, 0);
    result.killed = Math.ceil(killedFraction * total);
    state.stats.zombiesKilled += result.killed;
    // toxic zombies poison guards even when they die at range
    if (comp.toxic > 0) DE.Survivors.guards(state).forEach(g => { if (U().chance(Math.min(0.6, 0.12 * comp.toxic) * (1 - (fx.toxicResist || 0)))) { DE.Survivors.injure(g, 15); result.injured.push(g.name); } });
    if (power.total >= hp) {
      result.outcome = 'victory';
      state.stats.wavesSurvived++;
    } else {
      const overflow = hp - power.total;
      const dmg = Math.ceil(overflow * 1.2 * comp.dmgMult);
      result.wallDamage = Math.min(state.defense.wall.hp, dmg);
      state.defense.wall.hp -= result.wallDamage;
      // guards get hurt when the horde reaches the wall
      DE.Survivors.guards(state).forEach(g => { if (U().chance(0.5)) { DE.Survivors.injure(g, 25); if (!result.injured.includes(g.name)) result.injured.push(g.name); } });
      if (state.defense.wall.hp <= 0) {
        state.defense.wall.hp = 0;
        result.breach = true; result.outcome = 'breach';
        state.stats.breaches++;
        ['food', 'water', 'scrap', 'fuel'].forEach(r => { const loss = Math.floor(state.resources[r] * 0.12); state.resources[r] -= loss; result.losses[r] = loss; });
        const pool = Object.values(state.survivors).filter(s => !s.assignment || s.assignment.kind !== 'expedition');
        for (let i = 0; i < Math.min(3, pool.length); i++) { const v = U().pick(pool); DE.Survivors.injure(v, 40); if (!result.injured.includes(v.name)) result.injured.push(v.name); }
        state.defense.shock = 25;
      } else {
        result.outcome = 'held';
        state.stats.wavesSurvived++;
        state.defense.shock = Math.max(state.defense.shock, 8);
      }
    }
    // rewards: salvage from the corpses
    result.reward = waveReward(n, result.outcome);
    for (const r in result.reward) result.reward[r] = Math.floor(result.reward[r] * (1 + (fx.waveLoot || 0)));
    for (const r in result.reward) { state.resources[r] = Math.min(DE.Economy.storageCap(state, r), state.resources[r] + result.reward[r]); state.stats.produced[r] += result.reward[r]; state.stats.runScore += result.reward[r] * DE.Data.RESOURCES[r].value; }
    // guards gain experience
    DE.Survivors.guards(state).forEach(g => { g.xp += 40 * fx.xpMult; });
    state.defense.wave = n + 1;
    state.defense.lastResult = result;
    state.defense.log.push(result);
    if (state.defense.log.length > 20) state.defense.log.shift();
    state.defense.nextWaveAt = now + waveInterval(state) * 1000;
    state._events = state._events || []; state._events.push({ type: 'wave', result });
    return result;
  }

  /** Overworld structure upgrades (fence, towers, lights, road). */
  function structureNext(state, key) {
    const def = DE.Data.OVERWORLD[key]; if (!def) return null;
    const lvl = (state.overworld && state.overworld[key]) || 0;
    return lvl + 1 < def.levels.length ? def.levels[lvl + 1] : null;
  }
  function upgradeStructure(state, key) {
    const next = structureNext(state, key);
    if (!next) return { ok: false, reason: 'Fully upgraded' };
    if (!U().canAfford(state.resources, next.cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, next.cost);
    state.overworld = state.overworld || { fence: 0, towers: 0, lights: 0, road: 0 };
    state.overworld[key] = (state.overworld[key] || 0) + 1;
    state._fx = null;
    return { ok: true, level: state.overworld[key], cost: next.cost };
  }

  function tick(state, now) {
    if (now < state.defense.nextWaveAt) return null;
    if (state._offline) {
      state._offlineWaves = (state._offlineWaves || 0) + 1;
      if (state._offlineWaves > C().OFFLINE_MAX_WAVES) { // defer: the horde wanders off while you are away
        state.defense.nextWaveAt = now + waveInterval(state) * 1000;
        return null;
      }
    }
    return resolveWave(state, now);
  }

  return { wallMaxHp, wallUpgradeCost, repairCost, turretCost, trapCost, maxTurrets, upgradeWall, repairWall, buyTurret, buyTraps,
    waveHp, waveComposition, compositionSummary, waveReward, isBossWave, defensePower, waveInterval, warningSec, resolveWave, tick, structureNext, upgradeStructure };
})();
