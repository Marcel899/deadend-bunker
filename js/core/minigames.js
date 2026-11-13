/* Room minigames: the rules side (cooldowns, mastery, difficulty, staff skill and rewards). The games
 * themselves are in js/ui/minigames.js; they report a score 0..1 (and details) here.
 *
 *   state.mg = { cd: { game: playtime ready }, best: { game: score }, plays: { game: n }, xp: { game: n } }
 *
 * Every game lives in a room and pays into the rest of the bunker:
 *   forge   Blacksmith Forge   quality of the weapon/armour/ammo being made (DE.Gear)
 *   grid    Generator room     electricity now and the generators running hotter for a while
 *   radio   Radio / Comms      a transmission: a survivor, a place mapped, research, a blueprint lead,
 *                              a trader, or something rare
 *   sort    Storage            supplies sorted into stores (more after an expedition came home)
 *   triage  Medical rooms      the bunker's own injured and infected treated, the medics learn
 *   range   Training room      guards drilled: training points and a fresh-drill damage bonus
 * Difficulty tier: mastery, the room's level and research raise it; higher tiers pay more. The room's
 * staff (the right profession) make the game a little more forgiving. Cooldowns keep it from being a
 * grind: it is something to do, not something to farm. Each run also offers a challenge (an optional
 * goal set by the game: ctx.challenge when met) worth +25% rewards and extra mastery. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Minigames = (function () {
  const U = () => DE.Util;
  const GAMES = {
    forge: { name: 'Forge', rooms: ['forge'], cd: 0, research: ['metalwork', 'gunsmith'], verb: 'Forge' },
    grid: { name: 'Power grid', rooms: ['generator', 'geothermal', 'reactor', 'fusion', 'solar'], cd: 240, research: ['electricity', 'construction2', 'fusion'], verb: 'Balance the grid' },
    radio: { name: 'Radio tuning', rooms: ['radio', 'comms', 'signal', 'uplink'], cd: 300, research: ['housing', 'logistics', 'automation'], verb: 'Tune the radio' },
    sort: { name: 'Supply sorting', rooms: ['storage', 'coldstorage', 'cache'], cd: 240, research: ['logistics', 'recycling', 'automation2'], verb: 'Sort supplies' },
    triage: { name: 'Medical triage', rooms: ['medbay', 'infirmary', 'hospital', 'quarantine', 'medresearch'], cd: 200, research: ['medicine', 'medicine2'], verb: 'Treat patients' },
    range: { name: 'Training range', rooms: ['training', 'barracks'], cd: 240, research: ['defense1', 'defense2', 'efficiency2'], verb: 'Run a drill' },
  };
  const PROF = { forge: 'mechanic', grid: 'engineer', radio: 'scientist', sort: 'scavenger', triage: 'medic', range: 'soldier' };

  function ensure(state) { if (!state.mg) state.mg = { cd: {}, best: {}, plays: {}, xp: {} }; return state.mg; }
  function gameFor(type) { for (const g in GAMES) if (GAMES[g].rooms.includes(type)) return g; return null; }
  function level(state, g) { const xp = ensure(state).xp[g] || 0; return Math.min(10, 1 + Math.floor(Math.sqrt(xp / 40))); }
  function xpToNext(state, g) { const L = level(state, g); if (L >= 10) return null; const xp = ensure(state).xp[g] || 0; const lo = 40 * (L - 1) ** 2, hi = 40 * L ** 2; return { have: xp - lo, need: hi - lo }; }
  function ready(state, g) { return state.playtime >= (ensure(state).cd[g] || 0); }
  function waitFor(state, g) { return Math.max(0, (ensure(state).cd[g] || 0) - state.playtime); }
  function bestRoom(state, g) { let best = null; for (const id in state.rooms) { const r = state.rooms[id]; if (GAMES[g].rooms.includes(r.type) && r.level > 0 && !r.construction && (!best || r.level > best.level)) best = r; } return best; }
  /** Difficulty tier 1..4: research done, room level and mastery each push it up. */
  function tier(state, g, room) {
    room = room || bestRoom(state, g); let t = 1;
    t += GAMES[g].research.filter(id => state.research.done[id]).length >= 2 ? 1 : 0;
    t += room && room.level >= 10 ? 1 : 0;
    t += level(state, g) >= 6 ? 1 : 0;
    return Math.min(4, t);
  }
  /** How forgiving the game is from the staff on duty: 0..0.3 (wider windows, more time). */
  function skill(state, g, room) {
    room = room || bestRoom(state, g); if (!room) return 0;
    let s = 0; for (const id of room.workers) { const v = state.survivors[id]; if (!v) continue; s += (v.profession === PROF[g] ? .1 : .04) * (1 + .03 * (v.level - 1)); }
    return Math.min(.3, s + .02 * (level(state, g) - 1));
  }
  function canPlay(state, g) {
    const room = bestRoom(state, g); if (!room) return { ok: false, reason: 'Needs a ' + DE.Data.ROOMS[GAMES[g].rooms[0]].name };
    if (!ready(state, g)) return { ok: false, reason: 'Ready in ' + U().fmtTime(waitFor(state, g)) };
    return { ok: true, room };
  }

  /** The game is over: pay out, set the cooldown, add mastery. Returns { lines: [text], rewards }. */
  function finish(state, g, score, ctx) {
    const mg = ensure(state), room = bestRoom(state, g), t = tier(state, g, room), lv = level(state, g); ctx = ctx || {};
    score = U().clamp(score || 0, 0, 1);
    const k = (1 + .2 * (t - 1)) * (1 + .05 * (lv - 1)) * (room ? 1 + .04 * Math.min(25, room.level - 1) : 1) * (ctx.challenge ? 1.25 : 1);
    const out = { lines: [], rewards: {}, tier: t, score, challenge: !!ctx.challenge };
    const give = (r, n) => { n = Math.round(n); if (n <= 0) return; const cap = DE.Economy.storageCap(state, r); const add = Math.max(0, Math.min(n, cap - state.resources[r])); state.resources[r] += add; state.stats.produced[r] += add; out.rewards[r] = (out.rewards[r] || 0) + add; };
    const buff = (type, mult, sec) => { state.buffs.push({ room: type, mult, until: state.playtime + sec }); state._fx = null; out.lines.push(DE.Data.ROOMS[type].name + 's +' + Math.round(mult * 100) + '% for ' + Math.round(sec / 60) + ' min'); };
    switch (g) {
      case 'grid':
        give('electricity', 60 * k * (.4 + score));
        if (score >= .5) buff('generator', +(.1 + .25 * score).toFixed(2), 420 + 240 * t);
        if (score >= .9) { give('scrap', 40 * k); out.lines.push('Perfect grid: spare cable salvaged'); }
        break;
      case 'radio': radio(state, score, ctx, k, out, give); break;
      case 'sort': {
        const items = ctx.sorted || {}; let any = false;
        for (const r in items) if (DE.Data.RESOURCES[r]) { give(r, items[r] * 6 * k); any = true; }
        if (items.medicine) { Object.values(state.survivors).forEach(v => { v.hp = Math.min(100, v.hp + 3 * items.medicine); }); out.lines.push('Medicine stored: everyone patched up a little'); }
        if (items.ammo) { DE.Gear.ensure(state).ammo += Math.round(items.ammo * 2 * k); out.lines.push('+' + Math.round(items.ammo * 2 * k) + ' rounds of ammo'); }
        if (items.rare && score >= .6) { const m = U().pick(DE.Data.MATERIAL_ORDER); state.materials[m] = (state.materials[m] || 0) + 1; out.lines.push('+1 ' + DE.Data.MATERIALS[m].short + ' found among the junk'); }
        if (state.flags.haulBonus) { const h = state.flags.haulBonus; for (const r in h) give(r, h[r] * (.15 + .25 * score)); out.lines.push('The last expedition\'s haul, properly stored'); state.flags.haulBonus = null; }
        if (!any && !Object.keys(out.rewards).length) out.lines.push('Nothing worth keeping this time');
        break;
      }
      case 'triage': {
        const treated = ctx.treated || []; let healed = 0;
        for (const tr of treated) {
          const sv = state.survivors[tr.id]; if (!sv || !tr.ok) continue; healed++;
          sv.hp = Math.min(100, sv.hp + 35 + 25 * score);
          if (sv.infection && tr.cure) { sv.infection.sev = Math.max(0, sv.infection.sev - (.3 + .2 * t / 4)); sv.infection.known = true; if (sv.infection.sev <= .02) { DE.Infection.release(state, sv); out.lines.push(sv.name + ' is cured'); } }
        }
        if (ctx.visitorSaved && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state) && U().chance(.35)) { const v = DE.Survivors.spawn(state); state.stats.recruited++; out.lines.push(v.name + ', a stranger you treated, asks to stay'); }
        state.morale = Math.min(100, state.morale + 2 * healed);
        if (room) room.workers.forEach(id => { const m = state.survivors[id]; if (m) m.xp += 30 * k * (.5 + score); });
        out.lines.unshift(healed ? healed + ' patient' + (healed > 1 ? 's' : '') + ' treated' : 'Nobody was helped this time');
        break;
      }
      case 'range': {
        const ids = ctx.guards && ctx.guards.length ? ctx.guards : DE.Survivors.guards(state).map(v => v.id);
        let n = 0;
        for (const id of ids) { const sv = state.survivors[id]; if (!sv) continue; n++;
          if (score >= .5) sv.training = Math.min(10, (sv.training || 0) + (score >= .85 ? 1 : .5));
          sv.drill = { until: state.playtime + 600 + 300 * t, bonus: +(.05 + .2 * score).toFixed(2) }; sv.xp += 25 * k * (.5 + score); }
        out.lines.push(n ? n + ' guard' + (n > 1 ? 's' : '') + ' drilled: +' + Math.round((.05 + .2 * score) * 100) + '% damage for ' + Math.round((600 + 300 * t) / 60) + ' min' + (score >= .5 ? ', training up' : '') : 'No guards to drill — post some on guard duty');
        break;
      }
      default: break;
    }
    mg.plays[g] = (mg.plays[g] || 0) + 1; mg.best[g] = Math.max(mg.best[g] || 0, score);
    const before = level(state, g); mg.xp[g] = (mg.xp[g] || 0) + Math.round(10 + 25 * score + (ctx.challenge ? 15 : 0)); const after = level(state, g);
    if (after > before) out.lines.push('Mastery ' + after + ': ' + GAMES[g].name + ' is a little easier and pays more');
    if (GAMES[g].cd) mg.cd[g] = state.playtime + GAMES[g].cd * (1 - .03 * (after - 1));
    out.mastery = after;
    return out;
  }

  /* the radio: what was on the air decides the reward */
  const SIGNALS = [
    { id: 'survivor', name: 'A survivor calling for help', w: 3 },
    { id: 'location', name: 'Coordinates of a place', w: 3 },
    { id: 'research', name: 'A pre-war research broadcast', w: 3 },
    { id: 'blueprint', name: 'Engineers talking shop', w: 2 },
    { id: 'trader', name: 'A trader\'s caravan', w: 2 },
    { id: 'rare', name: 'A strange, encrypted transmission', w: 1 },
  ];
  function pickSignal(state) { const pool = SIGNALS.map(s => Object.assign({}, s, { w: s.id === 'survivor' && DE.Bunker.population(state) >= DE.Bunker.housingCapacity(state) ? .5 : s.w })); return U().weightedPick(pool); }
  function radio(state, score, ctx, k, out, give) {
    const sig = SIGNALS.find(s => s.id === ctx.signal) || SIGNALS[2];
    if (score < .35) { out.lines.push('The signal broke up before you could make it out'); give('research', 10 * k); return; }
    switch (sig.id) {
      case 'survivor':
        if (DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) { const v = DE.Survivors.spawn(state); state.stats.recruited++; out.lines.push(v.name + ' followed your directions to the hatch'); }
        else { state.morale = Math.min(100, state.morale + 3); out.lines.push('You talked them through the night. No bed to offer, but morale is up'); }
        break;
      case 'location': {
        const locs = DE.Data.LOCATIONS ? Object.keys(DE.Data.LOCATIONS) : []; const loc = locs.length ? U().pick(locs) : null;
        if (loc && DE.Expeditions.addExplore) { DE.Expeditions.addExplore(state, loc, 1); out.lines.push('Mapped: ' + DE.Data.LOCATIONS[loc].name + ' (exploration +1)'); } else give('research', 40 * k);
        break;
      }
      case 'research': give('research', 70 * k * (.5 + score)); out.lines.push('Notes copied down from the broadcast'); break;
      case 'blueprint': {
        const locked = Object.values(DE.Data.ROOMS).filter(d => d.blueprint && !(state.blueprints || {})[d.id]);
        if (locked.length && DE.Expeditions.addExplore && score >= .6) { const d = U().pick(locked); DE.Expeditions.addExplore(state, d.blueprint, 1); out.lines.push('A lead on the ' + d.name + ' plans: ' + DE.Data.LOCATIONS[d.blueprint].name + ' explored further'); }
        else give('research', 50 * k);
        break;
      }
      case 'trader': give('scrap', 70 * k); give('food', 40 * k); out.lines.push('They traded you a few crates for directions');
        if (DE.Events && DE.Data.BUNKER_EVENTS.some(e => e.id === 'trader')) { DE.Events.ensure(state); state.eventChains.push({ def: 'trader', at: state.playtime + 45 + Math.random() * 60, ctx: {} }); out.lines.push('Their caravan will stop at the fence soon'); }
        break;
      case 'rare': { const m = U().pick(DE.Data.MATERIAL_ORDER); const n = score >= .8 ? 2 : 1; state.materials[m] = (state.materials[m] || 0) + n; out.lines.push('Decoded: a cache of ' + DE.Data.MATERIALS[m].name.toLowerCase() + ' (+' + n + ')');
        if (DE.Events && U().chance(.5)) { DE.Events.ensure(state); state.eventChains.push({ def: 'smuggler', at: state.playtime + 60 + Math.random() * 90, ctx: {} }); out.lines.push('Someone else was listening in…'); }
        break; }
    }
  }

  return { GAMES, ensure, gameFor, level, xpToNext, ready, waitFor, bestRoom, tier, skill, canPlay, finish, pickSignal, SIGNALS };
})();
