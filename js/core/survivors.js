/* Survivors: recruitment, assignment, experience, injuries, morale. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Survivors = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;

  function randomName() { return U().pick(DE.Data.NAMES_FIRST) + ' ' + U().pick(DE.Data.NAMES_LAST); }

  /** Create a survivor record (unassigned). */
  function spawn(state, profession) {
    profession = profession || U().pick(DE.Data.PROFESSION_ORDER);
    const id = 's' + (state.nextId++);
    const rarity = U().weightedPick(Object.values(DE.Data.RARITIES)).id;
    const [tmin, tmax] = DE.Data.RARITIES[rarity].traits;
    const traits = []; const pool = Object.keys(DE.Data.TRAITS);
    const n = U().randInt(tmin, tmax);
    while (traits.length < n && pool.length) { const t = U().pick(pool); pool.splice(pool.indexOf(t), 1); traits.push(t); }
    const s = { id, name: randomName(), profession, rarity, level: 1, xp: 0, hp: 100, traits, assignment: null, energy: 100, hunger: 10, act: { kind: 'idle', until: 0, room: null } };
    state.survivors[id] = s;
    return s;
  }

  function traitSum(s, key) { return (s.traits || []).reduce((sum, t) => sum + ((DE.Data.TRAITS[t] || {})[key] || 0), 0); }
  function hungerMult(s) { return Math.max(0.3, 1 + traitSum(s, 'hunger')); }
  function xpNeeded(level) { return Math.floor(C().XP_BASE * Math.pow(C().XP_GROWTH, level - 1)); }

  /** Work efficiency of a survivor in a room (1.0 = one standard worker). */
  function rarityBonus(s) { const r = DE.Data.RARITIES[s.rarity]; return r ? r.bonus : 0; }

  function efficiency(s, def, fx) {
    let e = (1 + 0.05 * (s.level - 1)) * (1 + rarityBonus(s));
    if (def && def.profession === s.profession) e *= 1.25;
    e *= 1 + traitSum(s, 'prod');
    if (s.hp < 50) e *= 0.5;
    return e * (fx ? fx.workerEff : 1);
  }

  /** Individual mood: bunker morale adjusted by injuries, idleness and traits (display + small effect via morale). */
  function mood(state, s) {
    let m = state.morale;
    if (s.hp < 50) m -= 20; else if (s.hp < 100) m -= 5;
    if (!s.assignment) m -= 5;
    m += traitSum(s, 'morale') * 5;
    return U().clamp(Math.round(m), 0, 100);
  }

  /** Combat strength as a guard. */
  function guardPower(s, fx) {
    let p = C().GUARD_BASE_DMG * (1 + 0.08 * (s.level - 1)) * (1 + rarityBonus(s));
    if (s.profession === 'soldier') p *= 1.5; else if (s.profession === 'guard') p *= 1.35; else if (s.profession === 'hunter') p *= 1.25;
    p *= 1 + traitSum(s, 'guard');
    if (s.hp < 50) p *= 0.6;
    return p * (fx ? fx.guardDmgMult : 1);
  }

  function recruitCost(state) {
    const n = Object.keys(state.survivors).length;
    const fx = DE.Effects.get(state);
    const base = C().RECRUIT_BASE_COST * Math.pow(C().RECRUIT_GROWTH, Math.max(0, n - 4)) * (1 - fx.recruitDiscount);
    return { food: Math.ceil(base), water: Math.ceil(base) };
  }

  function canRecruit(state) {
    if (DE.Bunker.population(state) >= DE.Bunker.housingCapacity(state)) return { ok: false, reason: 'No free housing' };
    if (!U().canAfford(state.resources, recruitCost(state))) return { ok: false, reason: 'Not enough food & water' };
    return { ok: true };
  }

  function recruit(state, profession) {
    const c = canRecruit(state);
    if (!c.ok) return c;
    U().pay(state.resources, recruitCost(state));
    const s = spawn(state, profession);
    state.stats.recruited++;
    return { ok: true, survivor: s };
  }

  /** Assign to {kind:'room', id} | {kind:'guard'} | {kind:'dig'} (mining crew) | {kind:'expedition', id} | null. */
  function assign(state, survivorId, target) {
    const s = state.survivors[survivorId];
    if (!s) return { ok: false, reason: 'No such survivor' };
    if (s.assignment && s.assignment.kind === 'expedition') return { ok: false, reason: 'Away on expedition' };
    if (target && target.kind === 'room') {
      const room = state.rooms[target.id];
      if (!room) return { ok: false, reason: 'No such room' };
      if (room.level < 1) return { ok: false, reason: 'Room not finished' };
      const def = DE.Data.ROOMS[room.type];
      if (def.workers === 0) return { ok: false, reason: 'This room has no work stations' };
      if (room.workers.includes(survivorId)) return { ok: true };
      if (room.workers.length >= def.workers) return { ok: false, reason: 'Room is full' };
    }
    if (target && target.kind === 'guard' && !(s.assignment && s.assignment.kind === 'guard') && guards(state).length >= DE.Effects.get(state).guardCap) return { ok: false, reason: 'All guard posts are taken (build Guard Barracks)' };
    if (target && target.kind === 'dig' && !(s.assignment && s.assignment.kind === 'dig') && DE.Excavation.miners(state).length >= DE.Excavation.minerCap(state)) return { ok: false, reason: 'All mining posts are taken (upgrade the Mining Station)' };
    // remove from current
    if (s.assignment && s.assignment.kind === 'room') {
      const old = state.rooms[s.assignment.id];
      if (old) old.workers = old.workers.filter(id => id !== survivorId);
    }
    s.assignment = target ? Object.assign({}, target) : null;
    if (target && target.kind === 'room') state.rooms[target.id].workers.push(survivorId);
    return { ok: true };
  }

  function guards(state) { return Object.values(state.survivors).filter(s => s.assignment && s.assignment.kind === 'guard'); }
  function idle(state) { return Object.values(state.survivors).filter(s => !s.assignment); }
  function available(state) { return Object.values(state.survivors).filter(s => !s.assignment || s.assignment.kind !== 'expedition'); }

  function injure(s, amount) {
    const m = 1 + traitSum(s, 'injury');
    s.hp = U().clamp(s.hp - amount * m, 5, 100);
  }

  /** Morale target from current conditions. */
  function moraleTarget(state, fx) {
    let m = 50 + fx.morale + fx.moraleBonus;
    if (state.resources.food <= 0) m -= 30;
    if (state.resources.water <= 0) m -= 30;
    if (DE.Bunker.population(state) > DE.Bunker.housingCapacity(state)) m -= 15;
    m -= state.defense.shock;
    if (state.resources.electricity <= 0.01 && state._rates && state._rates.powerFactor < 1) m -= 10;
    return U().clamp(m, 0, 100);
  }

  /** Per-tick: xp, healing, morale drift. */
  function tick(state, dt, fx) {
    const xpRate = C().XP_PER_SEC * fx.xpMult * dt;
    const heal = (0.2 + 0.5 * fx.heal) * fx.healMult * dt;
    for (const id in state.survivors) {
      const s = state.survivors[id];
      if (s.assignment && s.assignment.kind !== 'expedition' && s.level < C().SURVIVOR_MAX_LEVEL) {
        s.xp += xpRate * (1 + traitSum(s, 'xp'));
        let need = xpNeeded(s.level);
        while (s.xp >= need && s.level < C().SURVIVOR_MAX_LEVEL) { s.xp -= need; s.level++; need = xpNeeded(s.level); state._levelUps = (state._levelUps || 0) + 1; }
      }
      if (s.hp < 100) s.hp = Math.min(100, s.hp + heal);
    }
    const target = moraleTarget(state, fx);
    const speed = Math.min(1, dt * 0.05);
    state.morale += (target - state.morale) * speed;
    if (state.defense.shock > 0) state.defense.shock = Math.max(0, state.defense.shock - dt * 0.05);
    // AI Command Center: idle survivors are put to work where they fit best
    if (fx.autoAssign > 0) {
      const idleList = idle(state);
      if (idleList.length) {
        const open = Object.values(state.rooms).filter(r => r.level > 0 && !r.construction && DE.Data.ROOMS[r.type].workers > r.workers.length);
        idleList.forEach(sv => { const best = open.find(r => DE.Data.ROOMS[r.type].profession === sv.profession && DE.Data.ROOMS[r.type].workers > r.workers.length) || open.find(r => DE.Data.ROOMS[r.type].workers > r.workers.length); if (best) assign(state, sv.id, { kind: 'room', id: best.id }); });
      }
    }
    // radio room: occasional free recruits
    if (fx.radio > 0 && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) {
      const p = fx.radio * 0.0004 * dt; // ~1 per 40 min per radio level
      if (Math.random() < p) { const sv = spawn(state); state.stats.recruited++; state._events = state._events || []; state._events.push({ type: 'radio', survivor: sv }); }
    }
  }

  return { spawn, efficiency, guardPower, rarityBonus, mood, hungerMult, xpNeeded, recruitCost, canRecruit, recruit, assign, guards, idle, available, injure, moraleTarget, tick, traitSum };
})();
