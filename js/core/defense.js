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
  /** Damage per second of one turret: base × research/structure bonuses × calibre upgrades. */
  function turretDmg(state) { return C().TURRET_DMG * DE.Effects.get(state).turretDmgMult * (1 + 0.25 * (state.defense.turretLevel || 0)); }
  function calibreCost(state) { const l = state.defense.turretLevel || 0; return { scrap: Math.ceil(350 * Math.pow(1.55, l)), concrete: Math.ceil(60 * Math.pow(1.55, l)) }; }
  function upgradeCalibre(state) {
    if (!DE.Effects.get(state).turretsUnlocked) return { ok: false, reason: 'Requires Heavy Machinery' };
    if (!state.defense.turrets) return { ok: false, reason: 'Install a turret first' };
    const c = calibreCost(state); if (!U().canAfford(state.resources, c)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, c); state.defense.turretLevel = (state.defense.turretLevel || 0) + 1; return { ok: true, level: state.defense.turretLevel, cost: c };
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
    const mut = n === state.defense.wave ? DE.Events.mutation(state) : null; const noise = 1 + Math.min(0.6, DE.Events.noise(state) * 0.012);
    // after breaches the horde regroups: each consecutive breach weakens the next wave (min 60%)
    const regroup = Math.max(0.6, Math.pow(0.85, state.defense.breachStreak || 0));
    // choices in events can make the next horde bigger (refusing raiders) or smaller
    const provoked = n === state.defense.wave ? (state.defense.waveMult || 1) : 1;
    return Math.floor(C().WAVE_BASE_HP * Math.pow(C().WAVE_GROWTH, n - 1) * (1 + 0.08 * (state.floors.length - 1)) * weaken * (mut ? mut.hp : 1) * noise * regroup * provoked);
  }
  function isBossWave(n) { return n % DE.Data.BOSS_EVERY === 0; }

  /** The horde for wave n with total strength hp. Seeded by the wave and its strength, so the
   *  Defense forecast, the fight on the surface and the resolution all see the same horde. */
  function waveComposition(hp, n) {
    n = n || 1;
    let seed = ((n * 2654435761) ^ Math.floor(hp)) >>> 0;
    const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pool = DE.Data.ZOMBIES.filter(z => !z.boss && z.minWave <= n);
    const total = pool.reduce((a, z) => a + (z.weight || 1), 0);
    const pickZ = () => { let r = rnd() * total; for (const z of pool) { r -= (z.weight || 1); if (r <= 0) return z; } return pool[pool.length - 1]; };
    const list = []; let left = hp; let guard = 0;
    if (isBossWave(n)) { const b = DE.Data.ZOMBIES.find(z => z.boss); const bhp = Math.floor(hp * b.hp); list.push(Object.assign({}, b, { hp: bhp })); left -= bhp; }
    while (left > 0 && guard++ < 400) { const z = pickZ(); list.push(z); left -= z.hp; }
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
    const m = (outcome === 'victory' ? 1 : 0.45) * (isBossWave(n) ? 4 : n % 5 === 0 ? 2 : 1);
    return { scrap: Math.floor(40 * Math.pow(n, 1.2) * m), research: Math.floor(6 * Math.pow(n, 1.1) * m) };
  }

  /** Our firepower per second and flat trap damage. */
  function defensePower(state) {
    const fx = DE.Effects.get(state);
    const guards = DE.Survivors.guards(state);
    const guardDps = guards.reduce((s, g) => s + DE.Survivors.guardPower(g, fx), 0);
    const turretDps = state.defense.turrets * turretDmg(state) * (state._rates ? state._rates.powerFactor : 1);
    const missileDps = (fx.missileDps || 0) * (state._rates ? state._rates.powerFactor : 1);
    const trapsUsed = Math.min(state.defense.traps, C().TRAPS_PER_WAVE);
    const trapDmg = trapsUsed * C().TRAP_DMG * fx.trapDmgMult;
    return { guardDps, turretDps, missileDps, trapDmg, trapsUsed, flat: fx.defenseFlat, total: (guardDps + turretDps + missileDps) * C().WAVE_DURATION + trapDmg + fx.defenseFlat, guards: guards.length };
  }

  function waveInterval(state) { return C().WAVE_INTERVAL_SEC * DE.Effects.get(state).waveIntervalMult * Math.max(0.7, 1 - DE.Events.noise(state) * 0.006); }
  /** Seconds of warning before a wave in which the horde is visible on the surface. */
  function warningSec(state) { return 45 + (DE.Effects.get(state).waveWarning || 0); }

  /** Resolve a wave now. */
  function resolveWave(state, now) {
    const n = state.defense.wave;
    const hp = waveHp(state, n);
    const power = defensePower(state);
    const fx = DE.Effects.get(state);
    const comp = compositionSummary(waveComposition(hp, n)); const mut = DE.Events.mutation(state); if (mut) { comp.dmgMult *= mut.dmg; comp.toxic += mut.toxic || 0; }
    const result = { wave: n, hp, dealt: Math.floor(power.total), guards: power.guards, turrets: state.defense.turrets, trapsUsed: power.trapsUsed, t: now, breach: false, wallDamage: 0, losses: {}, injured: [], killed: 0, boss: comp.boss, counts: comp.counts, reward: {} };
    state.defense.traps -= power.trapsUsed;
    const killedFraction = Math.min(1, power.total / hp);
    const total = Object.values(comp.counts).reduce((s, c) => s + c, 0);
    result.killed = Math.ceil(killedFraction * total);
    state.stats.zombiesKilled += result.killed;
    // toxic zombies poison guards even when they die at range
    if (comp.toxic > 0) DE.Survivors.guards(state).forEach(g => { if (U().chance(Math.min(0.6, 0.12 * comp.toxic) * (1 - (fx.toxicResist || 0)))) { DE.Survivors.injure(g, 15); result.injured.push(g.name); if (DE.Infection && DE.Infection.expose(state, g, .3)) result.infected = (result.infected || 0) + 1; } });
    if (power.total >= hp) {
      result.outcome = 'victory';
      state.stats.wavesSurvived++;
    } else {
      const overflow = hp - power.total;
      const dmg = Math.ceil(overflow * 1.2 * comp.dmgMult);
      result.wallDamage = Math.min(state.defense.wall.hp, dmg);
      state.defense.wall.hp -= result.wallDamage;
      // guards get hurt when the horde reaches the wall
      DE.Survivors.guards(state).forEach(g => { if (U().chance(0.5)) { DE.Survivors.injure(g, 25); if (!result.injured.includes(g.name)) result.injured.push(g.name); if (DE.Infection && DE.Infection.expose(state, g, .18)) result.infected = (result.infected || 0) + 1; } });
      if (state.defense.wall.hp <= 0) {
        state.defense.wall.hp = 0;
        result.breach = true; result.outcome = 'breach';
        state.stats.breaches++;
        ['food', 'water', 'scrap', 'fuel'].forEach(r => { const loss = Math.floor(state.resources[r] * 0.12); state.resources[r] -= loss; result.losses[r] = loss; });
        const pool = Object.values(state.survivors).filter(s => !s.assignment || s.assignment.kind !== 'expedition');
        for (let i = 0; i < Math.min(3, pool.length); i++) { const v = U().pick(pool); DE.Survivors.injure(v, 40); if (!result.injured.includes(v.name)) result.injured.push(v.name); if (DE.Infection && DE.Infection.expose(state, v, .3)) result.infected = (result.infected || 0) + 1; }
        state.defense.shock = 25;
      } else {
        result.outcome = 'held';
        state.stats.wavesSurvived++;
        state.defense.shock = Math.max(state.defense.shock, 8);
      }
    }
    // streaks: breaches make the next horde regroup weaker; victories in a row pay a growing bonus
    if (result.outcome === 'breach') { state.defense.breachStreak = (state.defense.breachStreak || 0) + 1; state.defense.winStreak = 0; }
    else { state.defense.breachStreak = 0; state.defense.winStreak = result.outcome === 'victory' ? (state.defense.winStreak || 0) + 1 : 0; }
    result.streak = state.defense.winStreak;
    // rewards: salvage from the corpses
    result.reward = waveReward(n, result.outcome);
    if (result.streak > 1) for (const r in result.reward) result.reward[r] = Math.floor(result.reward[r] * (1 + 0.1 * Math.min(5, result.streak - 1)));
    // every 5th wave held: refugees who watched the fight ask to come in
    if (n % 5 === 0 && !result.breach && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) { const sv = DE.Survivors.spawn(state); state.stats.recruited++; result.refugee = sv.name; } if (mut) { for (const r in result.reward) result.reward[r] = Math.floor(result.reward[r] * mut.loot); result.mutation = mut.name; }
    for (const r in result.reward) result.reward[r] = Math.floor(result.reward[r] * (1 + (fx.waveLoot || 0)));
    for (const r in result.reward) { state.resources[r] = Math.min(DE.Economy.storageCap(state, r), state.resources[r] + result.reward[r]); state.stats.produced[r] += result.reward[r]; state.stats.runScore += result.reward[r] * DE.Data.RESOURCES[r].value; }
    // guards gain experience
    DE.Survivors.guards(state).forEach(g => { g.xp += 40 * fx.xpMult; });
    state.defense.wave = n + 1; state.defense.waveMult = 1;
    state.defense.lastResult = result;
    state.defense.log.push(result);
    if (state.defense.log.length > 20) state.defense.log.shift();
    state.defense.nextWaveAt = now + waveInterval(state) * 1000;
    DE.Events.rollMutation(state);
    state._events = state._events || []; state._events.push({ type: 'wave', result });
    return result;
  }

  /** Unmet prerequisites of the next level of a structure, as readable text (or null). */
  function structureBlocked(state, key) {
    const def = DE.Data.OVERWORLD[key]; if (!def || !def.requires) return null;
    const miss = [];
    for (const k in def.requires) { const have = (state.overworld && state.overworld[k]) || 0; if (have < def.requires[k]) miss.push(DE.Data.OVERWORLD[k].name + ': ' + DE.Data.OVERWORLD[k].levels[def.requires[k]].name); }
    return miss.length ? 'Requires ' + miss.join(', ') : null;
  }
  /** Overworld structure upgrades (fence, barricades, towers, lights, road, missile). */
  function structureNext(state, key) {
    const def = DE.Data.OVERWORLD[key]; if (!def) return null;
    const lvl = (state.overworld && state.overworld[key]) || 0;
    return lvl + 1 < def.levels.length ? def.levels[lvl + 1] : null;
  }
  function upgradeStructure(state, key) {
    const next = structureNext(state, key);
    if (!next) return { ok: false, reason: 'Fully upgraded' };
    const blocked = structureBlocked(state, key); if (blocked) return { ok: false, reason: blocked };
    if (!U().canAfford(state.resources, next.cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, next.cost);
    state.overworld = state.overworld || {};
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

  return { turretDmg, calibreCost, upgradeCalibre, structureBlocked, wallMaxHp, wallUpgradeCost, repairCost, turretCost, trapCost, maxTurrets, upgradeWall, repairWall, buyTurret, buyTraps,
    waveHp, waveComposition, compositionSummary, waveReward, isBossWave, defensePower, waveInterval, warningSec, resolveWave, tick, structureNext, upgradeStructure };
})();
