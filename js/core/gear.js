/* Gear: what the Blacksmith Forge makes and the guards carry (state.gear), and survivors' training.
 *
 *   state.gear = { items: [{ id, kind: 'weapon'|'armor', type, q, dur, max, owner }], ammo, nextId }
 *   sv.training = 0..10 drill points (training range): +3% guard damage, -3% expedition danger each
 *   sv.drill = { until: playtime, bonus } a fresh drill: extra guard damage for a while
 *
 * Weapons multiply a guard's damage (by type and quality) while they have durability and, for guns,
 * ammo; every wave fought wears them and uses rounds. Armour stops a share of injuries and bites.
 * Crafting needs the recipe's research, a Forge of the right level, its cost and (top tiers) rare
 * materials from expeditions; the forging minigame decides the quality. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Gear = (function () {
  const U = () => DE.Util, D = () => DE.Data;
  function ensure(state) { if (!state.gear) state.gear = { items: [], ammo: 0, nextId: 1 }; return state.gear; }
  function defOf(item) { return item ? (item.kind === 'weapon' ? D().WEAPONS : D().ARMORS)[item.type] : null; }
  function forgeLevel(state) { let l = 0; for (const id in state.rooms) { const r = state.rooms[id]; if (r.type === 'forge' && r.level > l && !r.construction) l = r.level; } return l; }

  /* ---------- recipes ---------- */
  function recipe(id) { return D().WEAPONS[id] ? Object.assign({ kind: 'weapon' }, D().WEAPONS[id]) : D().ARMORS[id] ? Object.assign({ kind: 'armor' }, D().ARMORS[id]) : id === 'ammo' ? Object.assign({ kind: 'ammo' }, D().AMMO) : null; }
  function recipes() { return Object.keys(D().WEAPONS).concat(Object.keys(D().ARMORS), ['ammo']).map(recipe); }
  /** Can this be forged now? {ok, reason, locked (research/forge level missing: shown as a teaser)} */
  function canCraft(state, id) {
    const r = recipe(id); if (!r) return { ok: false, reason: 'Unknown recipe' };
    const lvl = forgeLevel(state); if (!lvl) return { ok: false, reason: 'Build a Blacksmith Forge', locked: true };
    if (r.research && !state.research.done[r.research]) return { ok: false, reason: 'Research ' + (D().RESEARCH[r.research] || { name: r.research }).name, locked: true };
    if (r.forge && lvl < r.forge) return { ok: false, reason: 'Forge level ' + r.forge, locked: true };
    if (!U().canAfford(state.resources, r.cost)) return { ok: false, reason: 'Not enough resources' };
    if (r.mat && !DE.Expeditions.hasRare(state, r.mat)) return { ok: false, reason: 'Needs rare materials from expeditions' };
    return { ok: true };
  }
  /** Forge it: pay, and make the item at the quality the minigame earned (score 0..1). */
  function craft(state, id, score) {
    const c = canCraft(state, id); if (!c.ok) return c;
    const r = recipe(id), g = ensure(state);
    U().pay(state.resources, r.cost);
    if (r.mat) for (const m in r.mat) state.materials[m] -= r.mat[m];
    // the forge's level and its smiths lift the result a little
    const s = U().clamp(score + .03 * Math.min(10, forgeLevel(state) - 1) * .5, 0, 1);
    if (r.kind === 'ammo') { const n = Math.round(r.amount * (.8 + .6 * s)); g.ammo += n; return { ok: true, kind: 'ammo', amount: n }; }
    const q = D().qualityFor(s), max = Math.round(r.dur * q.dur);
    const item = { id: 'g' + (g.nextId++), kind: r.kind, type: r.id, q: q.id, dur: max, max, owner: null };
    g.items.push(item);
    state.stats.crafted = (state.stats.crafted || 0) + 1;
    return { ok: true, item, quality: q };
  }

  /* ---------- the armory ---------- */
  function itemsOf(state, sid) { const out = { weapon: null, armor: null }; for (const it of ensure(state).items) if (it.owner === sid) out[it.kind] = it; return out; }
  function equip(state, itemId, sid) {
    const g = ensure(state), it = g.items.find(i => i.id === itemId), sv = state.survivors[sid];
    if (!it || !sv) return { ok: false, reason: 'Nothing to hand out' };
    for (const o of g.items) if (o.owner === sid && o.kind === it.kind && o !== it) o.owner = null;
    it.owner = sid; return { ok: true, item: it };
  }
  function unequip(state, itemId) { const it = ensure(state).items.find(i => i.id === itemId); if (it) it.owner = null; return { ok: !!it }; }
  /** Hand the best free weapon and armour to every guard who has none. */
  function autoEquip(state) {
    const g = ensure(state); let n = 0;
    const score = (it) => { const d = defOf(it), q = D().QUALITY.find(x => x.id === it.q) || D().QUALITY[1]; return (it.kind === 'weapon' ? d.dmg : 1 + d.guard) * q.mult * (it.dur > 0 ? 1 : .1); };
    for (const sv of DE.Survivors.guards(state)) for (const kind of ['weapon', 'armor']) {
      if (itemsOf(state, sv.id)[kind]) continue;
      const free = g.items.filter(i => i.kind === kind && !i.owner && i.dur > 0).sort((a, b) => score(b) - score(a))[0];
      if (free) { free.owner = sv.id; n++; }
    }
    return { ok: n > 0, count: n, reason: 'No free gear for the guards' };
  }
  function repairCost(item) { const r = recipe(item.type); return { scrap: Math.ceil((r.cost.scrap || 100) * .5 * (1 - item.dur / item.max)) }; }
  function repair(state, itemId) {
    const it = ensure(state).items.find(i => i.id === itemId); if (!it) return { ok: false, reason: 'Nothing to repair' };
    if (it.dur >= it.max) return { ok: false, reason: 'Already in good shape' };
    if (!forgeLevel(state)) return { ok: false, reason: 'Needs a Blacksmith Forge' };
    const c = repairCost(it); if (!U().canAfford(state.resources, c)) return { ok: false, reason: 'Not enough scrap' };
    U().pay(state.resources, c); it.dur = it.max; return { ok: true, cost: c };
  }
  function salvage(state, itemId) {
    const g = ensure(state), i = g.items.findIndex(x => x.id === itemId); if (i < 0) return { ok: false, reason: 'Nothing to salvage' };
    const it = g.items[i], back = Math.round((recipe(it.type).cost.scrap || 0) * .3 * (.4 + .6 * it.dur / it.max));
    g.items.splice(i, 1); state.resources.scrap += back; return { ok: true, scrap: back };
  }

  /* ---------- in the fight ---------- */
  /** A guard's damage multiplier from their weapon, drill and training. */
  function guardMult(state, sv) {
    let m = 1 + .03 * Math.min(10, sv.training || 0);
    if (sv.drill && sv.drill.until > state.playtime) m *= 1 + sv.drill.bonus;
    const w = itemsOf(state, sv.id).weapon;
    if (w && w.dur > 0) {
      const d = D().WEAPONS[w.type], q = D().QUALITY.find(x => x.id === w.q) || D().QUALITY[1];
      let wm = 1 + (d.dmg - 1) * q.mult;
      if (d.ammo && ensure(state).ammo <= 0) wm = 1 + (wm - 1) * .35;     // out of ammo: swinging the butt
      m *= wm;
    }
    return m;
  }
  /** Share of injuries and bites a guard's armour stops (0..0.6). */
  function protection(state, sv) { const a = itemsOf(state, sv.id).armor; if (!a || a.dur <= 0) return 0; const q = D().QUALITY.find(x => x.id === a.q) || D().QUALITY[1]; return Math.min(.6, D().ARMORS[a.type].guard * q.mult); }
  /** After a wave: weapons wear, rounds are spent, armour that took the hits wears too. */
  function afterWave(state, result) {
    const g = ensure(state); let rounds = 0, broke = [];
    for (const sv of DE.Survivors.guards(state)) {
      const { weapon, armor } = itemsOf(state, sv.id);
      if (weapon && weapon.dur > 0) { weapon.dur = Math.max(0, weapon.dur - (result.breach ? 2 : 1)); rounds += D().WEAPONS[weapon.type].ammo || 0; if (!weapon.dur) broke.push(D().WEAPONS[weapon.type].name); }
      if (armor && armor.dur > 0 && result.injured && result.injured.includes(sv.name)) { armor.dur = Math.max(0, armor.dur - 2); if (!armor.dur) broke.push(D().ARMORS[armor.type].name); }
    }
    const used = Math.min(g.ammo, rounds); g.ammo -= used;
    return { rounds: used, short: rounds - used, broke };
  }
  /** Expedition danger multiplier for a team (training makes trips safer). */
  function expeditionSafety(members) { if (!members.length) return 1; const t = members.reduce((n, s) => n + Math.min(10, s.training || 0), 0) / members.length; return 1 - .03 * t; }

  return { ensure, recipe, recipes, canCraft, craft, itemsOf, equip, unequip, autoEquip, repair, repairCost, salvage, guardMult, protection, afterWave, expeditionSafety, forgeLevel, defOf };
})();
