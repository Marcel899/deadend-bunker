/* Living world: event queue (bunker events, expedition encounters, trader offers), survivor
 * bonds, factions, artifacts, wave mutations, noise and the objective ladder. Decisions wait in
 * state.events until the player answers — also after offline time, so idle play never decides
 * for you; the queue is persisted. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Events = (function () {
  const U = () => DE.Util;
  const EVENT_MIN = 330, EVENT_MAX = 660;   // seconds between bunker events (5½–11 minutes)

  function ensure(state) {
    state.events = state.events || [];
    state.artifacts = state.artifacts || {};
    state.rep = state.rep || { traders: 0, militia: 0, growers: 0 };
    state.bus = state.bus || { level: 1 };
    state.goals = state.goals || { done: {} };
    state.buffs = state.buffs || [];
    state.eventChains = state.eventChains || [];
    if (!state.nextEventAt) state.nextEventAt = state.playtime + EVENT_MIN + Math.random() * (EVENT_MAX - EVENT_MIN);
  }

  /* ---------- bus ---------- */
  function bus(state) { return DE.Data.BUS[Math.min(DE.Data.BUS.length, (state.bus && state.bus.level) || 1) - 1]; }
  function busNext(state) { const l = (state.bus && state.bus.level) || 1; return l < DE.Data.BUS.length ? DE.Data.BUS[l] : null; }
  function upgradeBus(state) {
    const next = busNext(state); if (!next) return { ok: false, reason: 'Fully upgraded' };
    if (!DE.Expeditions.unlocked(state)) return { ok: false, reason: 'Build a Garage first' };
    if (!U().canAfford(state.resources, next.cost)) return { ok: false, reason: 'Not enough resources' };
    if (next.rare && !DE.Expeditions.hasRare(state, next.rare)) return { ok: false, reason: 'Needs rare materials from expeditions' };
    U().pay(state.resources, next.cost); if (next.rare) DE.Expeditions.payRare(state, next.rare); state.bus.level = next.level; return { ok: true, cost: next.cost };
  }

  /* ---------- noise: what the horde hears ---------- */
  const ROOM_NOISE = { generator: 2, reactor: 3, fusion: 1, workshop: 1, advworkshop: 2, recycling: 2, ammofactory: 3, heavyweapons: 3, autoplant: 4, concrete: 1.5, refinery: 1, vehicleshop: 1.5, dronehangar: 1, silo: 2, geothermal: 1, orevein: 1.5 };
  function noise(state) {
    let n = 0;
    for (const id in state.rooms) { const r = state.rooms[id]; if (r.level < 1) continue; const base = ROOM_NOISE[r.type]; if (base) n += base * Math.pow(r.level, 0.35); }
    n += state.defense.turrets * 0.4 + state.expeditions.active.length * 1.5;
    const fx = DE.Effects.get(state); n *= fx.noiseMult != null ? fx.noiseMult : 1;
    if (state.defense.calmUntil && state.playtime < state.defense.calmUntil) n *= 0.5;
    return Math.round(n * 10) / 10;
  }
  function noiseLevel(n) { return n < 6 ? 'quiet' : n < 14 ? 'noisy' : n < 26 ? 'loud' : 'deafening'; }

  /* ---------- mutations ---------- */
  function rollMutation(state) {
    if (state.defense.wave < 8 || DE.Defense.isBossWave(state.defense.wave)) { state.defense.nextMut = null; return; }
    state.defense.nextMut = U().chance(0.55) ? U().pick(DE.Data.MUTATIONS).id : null;
  }
  function mutation(state) { const id = state.defense && state.defense.nextMut; return id ? DE.Data.MUTATIONS.find(m => m.id === id) : null; }

  /* ---------- bonds ---------- */
  function tickBonds(state, dt) {
    const byRoom = {};
    for (const id in state.survivors) { const sv = state.survivors[id]; if (sv.act && sv.act.room && (sv.act.kind === 'work' || sv.act.kind === 'eat' || sv.act.kind === 'rest')) (byRoom[sv.act.room] = byRoom[sv.act.room] || []).push(sv); }
    const gain = dt / 60 * 1.2; // ~1.2 per minute together
    for (const rid in byRoom) { const list = byRoom[rid]; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) bond(state, list[i], list[j], gain); }
  }
  function bond(state, a, b, amount) {
    a.bonds = a.bonds || {}; b.bonds = b.bonds || {};
    const before = a.bonds[b.id] || 0; const v = U().clamp(before + amount, 0, 100);
    a.bonds[b.id] = v; b.bonds[a.id] = v;
    if (before < 60 && v >= 60) { state._events = state._events || []; state._events.push({ type: 'friends', a: a.name, b: b.name }); state.log.push({ t: Date.now(), msg: a.name + ' and ' + b.name + ' have become friends.' }); }
  }
  function friendsIn(state, sv, roomId) { if (!sv.bonds) return 0; let n = 0; for (const id in sv.bonds) { const o = state.survivors[id]; if (o && sv.bonds[id] >= 60 && o.act && o.act.room === roomId && o.act.kind === 'work') n++; } return Math.min(2, n); }

  /* ---------- goals ---------- */
  function activeGoals(state) { return DE.Data.GOALS.filter(g => !state.goals.done[g.id]).slice(0, 3); }
  function tickGoals(state) {
    activeGoals(state).forEach(g => {
      let ok = false; try { ok = g.check(state); } catch (e) { ok = false; }
      if (!ok) return;
      state.goals.done[g.id] = true; applyEffects(state, g.reward, null);
      state._events = state._events || []; state._events.push({ type: 'goal', goal: g });
      state.log.push({ t: Date.now(), msg: 'Objective complete: ' + g.name + '.' });
    });
  }

  /* ---------- scaled amounts ----------
   * Event data never asks for a fixed number. A cost is a share of what the bunker holds right now
   * (cost:{scrap:0.1} = 10% of your scrap), a reward is worth some minutes of the bunker's output
   * (gain:{food:3}), and haul is the same kind of reward loaded onto a truck on the road. resolve()
   * turns them into plain numbers right before a card is shown or a choice is applied, so the same
   * event is fair on the first day and deep into the game. */
  function nice(n) { if (n < 20) return Math.round(n); const p = Math.pow(10, Math.floor(Math.log10(n)) - 1); return Math.round(n / p) * p; }
  /** A reward worth `minutes` of the bunker's output of resource r. Uses what the bunker makes of
   *  r, or a quarter of its whole output converted by value when that is more (so an event can
   *  hand out concrete before you mix any), and a small floor that grows with depth. */
  function worth(state, r, minutes) {
    const R = DE.Data.RESOURCES; if (!R[r] || !minutes) return 0;
    const rates = state._rates || DE.Economy.computeRates(state);
    let total = 0; for (const k in rates.production) total += (rates.production[k] || 0) * (R[k] ? R[k].value : 1);
    const perSec = Math.max(rates.production[r] || 0, total * 0.25 / R[r].value, 0.6 * (1 + 0.5 * (state.floors.length - 1)) / R[r].value);
    let n = perSec * 60 * minutes;
    const cap = DE.Economy.storageCap(state, r); if (isFinite(cap)) n = Math.min(n, cap * 0.5);
    return nice(n);
  }
  /** A cost of `pct` of the current stock of r (at least 1 when there is any). */
  function share(state, r, pct) { const have = state.resources[r] || 0; return have < 1 ? 0 : Math.max(1, Math.round(have * pct)); }
  function resolve(state, fx) {
    const out = {}; if (!fx) return out;
    const add = (r, n) => { out[r] = (out[r] || 0) + n; };
    for (const k in fx) {
      const v = fx[k];
      if (k === 'cost') { for (const r in v) add(r, -share(state, r, v[r])); }
      else if (k === 'gain') { for (const r in v) add(r, worth(state, r, v[r])); }
      else if (k === 'haul' || k === 'loot') { out.loot = out.loot || {}; for (const r in v) out.loot[r] = (out.loot[r] || 0) + (k === 'haul' ? worth(state, r, v[r]) : v[r]); }
      else if (k === 'artifactOr') out.artifactOrScrap = worth(state, 'scrap', v);
      else if (k === 'gamble' && Array.isArray(v)) out.gamble = [v[0], resolve(state, v[1]), resolve(state, v[2]), v[3], v[4]];
      else if (DE.Data.RESOURCES[k]) add(k, v);
      else out[k] = v;
    }
    return out;
  }
  /** A trader offer: give a share of one resource for its value in another (better with a good
   *  name among the traders). Old saves hold fixed offers, which still work. */
  function tradeAmounts(state, tr) {
    if (!tr) return { give: {}, get: {} };
    if (typeof tr.give !== 'string') return { give: tr.give || {}, get: tr.get || {} };
    const R = DE.Data.RESOURCES; const n = share(state, tr.give, tr.pct || 0.1);
    const rep = 1 + 0.06 * Math.max(0, (state.rep && state.rep.traders) || 0);
    return { give: { [tr.give]: n }, get: { [tr.get]: nice(n * R[tr.give].value / R[tr.get].value * (tr.rate || 1) * rep) } };
  }

  /* ---------- event queue ---------- */
  function push(state, ev) { ensure(state); ev.id = 'e' + (state.nextId++); state.events.push(ev); return ev; }
  function fill(text, ctx) { return String(text || '').replace(/\{A\}/g, ctx.A || 'Someone').replace(/\{B\}/g, ctx.B || 'someone else').replace(/\{D\}/g, ctx.D || 'B2').replace(/\{R\}/g, ctx.R || 'workshop'); }
  /** Effects that name "the room this event is about" use '$R'. */
  function bind(fx, ctx) {
    if (!fx || !ctx.room) return fx; const out = {};
    for (const k in fx) {
      const v = fx[k];
      if (k === 'buff' && v[0] === '$R') out[k] = [ctx.room, v[1], v[2]];
      else if (k === 'gamble') out[k] = [v[0], bind(v[1], ctx), bind(v[2], ctx), v[3], v[4]];
      else out[k] = v;
    }
    return out;
  }
  /** The people, floor and room an event is about. */
  function context(state, def, base) {
    const ctx = Object.assign({}, base || {});
    if (!ctx.aId) {
      const people = Object.values(state.survivors).filter(s => !s.assignment || s.assignment.kind !== 'expedition');
      const A = people.length ? U().pick(people) : null, B = people.length > 1 ? U().pick(people.filter(p => p !== A)) : null;
      Object.assign(ctx, { A: A && A.name, B: B && B.name, aId: A && A.id, bId: B && B.id });
    }
    if (!ctx.D) ctx.D = 'B' + (state.floors.length > 1 ? U().randInt(2, state.floors.length) : 1);
    if (def.room && !ctx.room) {
      const rooms = Object.values(state.rooms).filter(r => r.level > 0 && DE.Data.ROOMS[r.type].produces && !DE.Data.ROOMS[r.type].unique);
      const r = rooms.length ? U().pick(rooms) : null; if (r) { ctx.room = r.type; ctx.R = DE.Data.ROOMS[r.type].name; }
    }
    return ctx;
  }
  function makeEvent(state, def, baseCtx) {
    const ctx = context(state, def, baseCtx);
    const ev = { kind: 'bunker', def: def.id, title: fill(def.title, ctx), text: fill(def.text, ctx), ctx };
    if (def.trade) {
      const offers = U().shuffle ? U().shuffle(DE.Data.TRADES.slice()) : DE.Data.TRADES.slice().sort(() => Math.random() - 0.5);
      const usable = offers.filter(t => (state.resources[t.give] || 0) >= 20);
      ev.choices = (usable.length >= 2 ? usable : offers).slice(0, 2).map(tr => ({ label: 'Trade', desc: '', trade: tr }));
      ev.choices.push({ label: 'No thanks', desc: '', effects: {} });
    } else ev.choices = def.choices.filter(c => !c.cond || c.cond(state)).map(c => ({ label: fill(c.label, ctx), desc: fill(c.desc || '', ctx), effects: bind(c.effects, ctx) }));
    return ev;
  }
  function tickEvents(state, now) {
    if (state.events.length >= 3) return;
    // consequences of earlier choices come first, when they are due
    const due = state.eventChains.findIndex(c => c.at <= state.playtime);
    if (due >= 0) {
      const c = state.eventChains.splice(due, 1)[0]; const def = DE.Data.BUNKER_EVENTS.find(e => e.id === c.def);
      if (def && (!def.cond || def.cond(state))) push(state, makeEvent(state, def, c.ctx));
      return;
    }
    if (state.playtime < state.nextEventAt) return;
    state.nextEventAt = state.playtime + EVENT_MIN + Math.random() * (EVENT_MAX - EVENT_MIN);
    const recent = (state.flags && state.flags.lastEvents ? String(state.flags.lastEvents).split(',') : []);
    let pool = DE.Data.BUNKER_EVENTS.filter(e => !e.chainOnly && (!e.cond || e.cond(state)));
    if (pool.length > 4) pool = pool.filter(e => !recent.includes(e.id));   // no repeats of the last few
    if (!pool.length) return;
    const def = U().weightedPick(pool);
    state.flags.lastEvents = recent.concat(def.id).slice(-4).join(',');
    push(state, makeEvent(state, def));
  }
  /** Expedition encounter on the road (called by DE.Expeditions.tick at a checkpoint). Picked from
   *  the location's tags, never the same one twice on a trip; its effects land on the trip while it
   *  is still out (ctx.expId). */
  function encounter(state, exp) {
    ensure(state);
    const loc = DE.Expeditions.location(exp.location); const tags = (loc && loc.tags) || [exp.location];
    const seen = exp.seen || [];
    const pool = DE.Data.ENCOUNTERS.filter(e => (e.tags.includes(exp.location) || e.tags.some(t => tags.includes(t))) && !seen.includes(e.id));
    if (!pool.length) return null;
    const def = U().pick(pool); exp.seen = seen.concat(def.id);
    const ev = { kind: 'expedition', def: def.id, title: def.title, text: def.text, ctx: { members: exp.survivors.slice(), location: exp.location, expId: exp.id }, choices: def.choices.filter(c => !c.cond || c.cond(state)).map(c => ({ label: c.label, desc: c.desc || '', effects: c.effects })) };
    return push(state, ev);
  }

  /** Resolve a queued event with the chosen option; returns a summary for the UI. */
  /** A choice that costs resources needs them (trades included). */
  function payable(state, ch) {
    if (ch.trade) { const t = tradeAmounts(state, ch.trade); return Object.values(t.give).every(n => n > 0) && U().canAfford(state.resources, t.give); }
    const fx = resolve(state, ch.effects || {});
    for (const k in fx) if (DE.Data.RESOURCES[k] && fx[k] < 0 && state.resources[k] + 1e-6 < -fx[k]) return false;
    return true;
  }
  /** Can choice i be taken now? Unaffordable costs block it, unless no choice is affordable at all
   *  (an event card must always have a way out). */
  function canChoose(state, ev, i) {
    const ch = ev && ev.choices[i]; if (!ch) return { ok: false, reason: 'No such choice' };
    if (payable(state, ch) || !ev.choices.some(c => payable(state, c))) return { ok: true };
    return { ok: false, reason: ch.trade ? 'Not enough to trade' : 'Not enough resources' };
  }
  function choose(state, eventId, index) {
    ensure(state);
    const i = state.events.findIndex(e => e.id === eventId); if (i < 0) return { ok: false, reason: 'Event is gone' };
    const ev = state.events[i]; const ch = ev.choices[index]; if (!ch) return { ok: false, reason: 'No such choice' };
    const can = canChoose(state, ev, index); if (!can.ok) return can;
    if (ch.trade) {
      const t = tradeAmounts(state, ch.trade);
      if (!U().canAfford(state.resources, t.give)) return { ok: false, reason: 'Not enough to trade' };
      U().pay(state.resources, t.give); for (const r in t.get) gainRes(state, r, t.get[r]); state.rep.traders = Math.min(5, (state.rep.traders || 0) + 1);
      state.events.splice(i, 1); return { ok: true, summary: 'Traded ' + U().costText(t.give) + ' for ' + U().costText(t.get) + '. The traders will remember you.' };
    }
    const summary = applyEffects(state, ch.effects || {}, ev.ctx);
    if (ev.kind === 'expedition' && ev.ctx && ev.ctx.expId) {
      const note = ev.title + ': ' + ch.label + (summary ? ' (' + summary + ')' : '');
      const trip = state.expeditions.active.find(e => e.id === ev.ctx.expId) || state.expeditions.log.find(e => e.id === ev.ctx.expId);
      if (trip) (trip.notes = trip.notes || []).push(note);
    }
    state.events.splice(i, 1);
    state.log.push({ t: Date.now(), msg: ev.title + ' — ' + ch.label + '.' });
    return { ok: true, summary };
  }
  function gainRes(state, r, n) { if (!DE.Data.RESOURCES[r]) return; state.resources[r] = U().clamp(state.resources[r] + n, 0, DE.Economy.storageCap(state, r)); if (n > 0) { state.stats.produced[r] += n; state.stats.runScore += n * DE.Data.RESOURCES[r].value; } }
  function applyEffects(state, fx, ctx) {
    const out = []; ctx = ctx || {}; fx = resolve(state, fx);
    const members = (ctx.members || []).map(id => state.survivors[id]).filter(Boolean);
    const A = ctx.aId ? state.survivors[ctx.aId] : null, B = ctx.bId ? state.survivors[ctx.bId] : null;
    const trip = ctx.expId ? state.expeditions.active.find(e => e.id === ctx.expId) : null;   // still on the road?
    for (const k in fx) {
      const v = fx[k];
      if (DE.Data.RESOURCES[k]) { gainRes(state, k, v); out.push((v > 0 ? '+' : '') + U().fmt(v) + ' ' + DE.Data.RESOURCES[k].name); continue; }
      switch (k) {
        case 'loot': for (const r in v) {
          const n = Math.round(v[r] * bus(state).cargo);
          if (trip) { trip.bonus = trip.bonus || {}; trip.bonus[r] = (trip.bonus[r] || 0) + n; out.push('+' + U().fmt(n) + ' ' + DE.Data.RESOURCES[r].name + ' loaded'); }
          else { gainRes(state, r, n); out.push('+' + U().fmt(n) + ' ' + DE.Data.RESOURCES[r].name); }
        } break;
        case 'lootMult': {
          const pct = (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%';
          if (trip) { trip.mult = (trip.mult || 1) * v; out.push('haul ' + pct); break; }
          const log = (ctx.expId && state.expeditions.log.find(e => e.id === ctx.expId)) || state.expeditions.log[state.expeditions.log.length - 1];
          if (log && log.loot) for (const r in log.loot) { const delta = Math.round(log.loot[r] * (v - 1)); gainRes(state, r, delta); log.loot[r] = Math.max(0, log.loot[r] + delta); }
          out.push('haul ' + pct); break;
        }
        case 'delay': if (trip) { trip.endsAt += v * 1000; trip.duration += v; out.push('trip +' + U().fmtTime(v)); } break;
        case 'hurry': if (trip) { const cut = Math.min(v * 1000, Math.max(0, trip.endsAt - Date.now() - 5000)); trip.endsAt -= cut; trip.duration = Math.max(1, trip.duration - cut / 1000); if (cut > 0) out.push('home ' + U().fmtTime(cut / 1000) + ' sooner'); } break;
        case 'gamble': { const win = U().chance(v[0]); out.push(fill(win ? (v[3] || 'it worked') : (v[4] || 'it went wrong'), ctx)); const sub = applyEffects(state, (win ? v[1] : v[2]) || {}, ctx); if (sub) out.push(sub); break; }
        case 'noiseCalm': state.defense.calmUntil = Math.max(state.defense.calmUntil || 0, state.playtime + v); out.push('the horde is quieter for ' + Math.round(v / 60) + ' min'); break;
        case 'injure': { const pool = members.length ? members : Object.values(state.survivors); pool.forEach(s => { if (U().chance(v[0])) { DE.Survivors.injure(s, v[1]); out.push(s.name + ' injured'); } }); break; }
        case 'heal': Object.values(state.survivors).forEach(s => { s.hp = Math.min(100, s.hp + v); }); out.push('everyone healed +' + v); break;
        case 'rescue': case 'recruit': if (v && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) { const sv = DE.Survivors.spawn(state); state.stats.recruited++; out.push(sv.name + ' joined'); } else if (v) out.push('no free housing — they moved on'); break;
        case 'artifact': { const id = v === 'random' ? randomArtifact(state) : v; if (id) { state.artifacts[id] = true; state._fx = null; out.push('Artifact found: ' + DE.Data.ARTIFACTS[id].name); } else out.push('nothing new inside'); break; }
        case 'artifactOrScrap': { const id = U().chance(0.4) ? randomArtifact(state) : null; if (id) { state.artifacts[id] = true; state._fx = null; out.push('Artifact found: ' + DE.Data.ARTIFACTS[id].name); } else { gainRes(state, 'scrap', v); out.push('+' + v + ' scrap'); } break; }
        case 'morale': state.morale = U().clamp(state.morale + v, 0, 100); state.defense.shock = Math.max(0, state.defense.shock - Math.max(0, v)); out.push((v > 0 ? '+' : '') + v + ' morale'); break;
        case 'shock': state.defense.shock = Math.max(state.defense.shock, v); out.push('morale shaken'); break;
        case 'rep': for (const f in v) { state.rep[f] = U().clamp((state.rep[f] || 0) + v[f], -5, 5); out.push(DE.Data.FACTIONS[f].name + ' ' + (v[f] > 0 ? '+' : '') + v[f]); } state._fx = null; break;
        case 'xp': members.forEach(s => s.xp += v); break;
        case 'xpA': if (A) { A.xp += v; out.push(A.name + ' +' + v + ' xp'); } break;
        case 'energyA': if (A) { A.energy = U().clamp((A.energy || 100) + v, 0, 100); } break;
        case 'restA': if (A) { A.energy = 100; A.hunger = 0; out.push(A.name + ' rested'); } break;
        case 'bond': { const all = members.length ? members : Object.values(state.survivors); for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) bond(state, all[i], all[j], v); break; }
        case 'bondAB': if (A && B) { bond(state, A, B, v); out.push(A.name + ' and ' + B.name + (v >= 0 ? ' made up' : ' are not speaking')); } break;
        case 'levelA': if (A) { const n = Math.round(DE.Survivors.xpNeeded(A.level) * v); A.xp += n; out.push(A.name + ' +' + n + ' xp'); } break;
        case 'injureA': if (A) { DE.Survivors.injure(A, v); out.push(A.name + ' injured'); } break;
        case 'recruitN': { let n = 0; for (let k = 0; k < v && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state); k++) { DE.Survivors.spawn(state); state.stats.recruited++; n++; } out.push(n ? '+' + n + ' survivor' + (n > 1 ? 's' : '') : 'no free beds'); break; }
        case 'waveHp': state.defense.waveMult = U().clamp((state.defense.waveMult || 1) * v, 0.3, 3); out.push('next wave ' + (v >= 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%'); break;
        case 'chain': if (U().chance(v[3] == null ? 1 : v[3])) { ensure(state); state.eventChains.push({ def: v[0], at: state.playtime + U().rand(v[1], v[2]), ctx: { A: ctx.A, B: ctx.B, aId: ctx.aId, bId: ctx.bId, D: ctx.D, R: ctx.R, room: ctx.room } }); } break;
        case 'waterPct': gainRes(state, 'water', state.resources.water * v); out.push('lost water'); break;
        case 'electricityPct': gainRes(state, 'electricity', state.resources.electricity * v); out.push('lost power'); break;
        case 'traps': state.defense.traps += v; out.push('+' + v + ' traps'); break;
        case 'mat': for (const m in v) { const n = Math.round(v[m] * (trip ? 1 : 1)); if (!DE.Data.MATERIALS[m] || n <= 0) continue; if (trip) { trip.mats = trip.mats || {}; trip.mats[m] = (trip.mats[m] || 0) + n; out.push('+' + n + ' ' + DE.Data.MATERIALS[m].short + ' loaded'); } else { DE.Expeditions.addMat(state, m, n); out.push('+' + n + ' ' + DE.Data.MATERIALS[m].short); } } break;
        case 'collect': { const locId = (trip && trip.location) || ctx.location; const c = locId ? DE.Expeditions.grantCollectible(state, locId, true) : null; if (c) { out.push('found: ' + c.name); state._events = state._events || []; state._events.push({ type: 'collected', ids: [c.id], sets: DE.Expeditions.setDone(state, c.set) ? [c.set] : [] }); } else { gainRes(state, 'scrap', worth(state, 'scrap', 3)); out.push('nothing rare — some scrap'); } break; }
        case 'explore': { const locId = (trip && trip.location) || ctx.location; if (!locId) break; if (trip) trip.explore = (trip.explore || 0) + v; else { DE.Expeditions.ensure(state); state.explore[locId] = Math.min(DE.Expeditions.MAX_EXPLORE, (state.explore[locId] || 0) + v); } out.push('map +' + v); break; }
        case 'risk': if (U().chance(v[0])) { if (v[1] === 'shock') state.defense.shock = Math.max(state.defense.shock, v[2]); out.push('he was infected — morale shaken'); } break;
        case 'buff': { if (v[0] !== '*' && !DE.Data.ROOMS[v[0]]) break; state.buffs.push({ room: v[0], mult: v[1], until: state.playtime + v[2] }); state._fx = null; out.push((v[0] === '*' ? 'all production' : DE.Data.ROOMS[v[0]].name) + ' ' + (v[1] >= 0 ? '+' : '−') + Math.round(Math.abs(v[1]) * 100) + '% for ' + Math.round(v[2] / 60) + ' min'); break; }
        default: break;
      }
    }
    return out.join(' · ');
  }
  function randomArtifact(state) { const pool = Object.keys(DE.Data.ARTIFACTS).filter(id => !state.artifacts[id]); return pool.length ? U().pick(pool) : null; }

  /* ---------- per tick ---------- */
  function tick(state, dt, now) {
    ensure(state);
    tickBonds(state, dt);
    tickGoals(state);
    if (!state._offline) tickEvents(state, now);
    if (state.buffs.length) { const n = state.buffs.length; state.buffs = state.buffs.filter(b => b.until > state.playtime); if (state.buffs.length !== n) state._fx = null; }
  }

  return { ensure, bus, busNext, upgradeBus, noise, noiseLevel, rollMutation, mutation, tick, choose, canChoose, applyEffects, activeGoals, friendsIn, encounter, bond, randomArtifact, resolve, tradeAmounts, worth, share, fill, makeEvent };
})();
