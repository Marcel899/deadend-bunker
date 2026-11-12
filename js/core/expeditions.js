/* Expeditions: send survivors to surface locations for loot, rescues and risk.
 *
 * A trip has checkpoints on the road (one, or two on long trips). Passing one may raise an
 * encounter — a decision card whose consequences land on the trip itself while it is still out:
 * more or less haul (mult, bonus), a detour or a short cut (endsAt), injuries now. When the team
 * returns the haul is rolled, rare discoveries for the location are rolled (finds), and the report
 * lists what happened on the way (notes). Offline catch-up skips checkpoints: those trips are quiet. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Expeditions = (function () {
  const U = () => DE.Util;

  function location(id) { return DE.Data.LOCATIONS.find(l => l.id === id); }
  function slots(state) { return DE.Effects.get(state).expeditionSlots; }
  function unlocked(state) { return slots(state) > 0; }
  function isOpen(state, loc) { return DE.Effects.get(state).allLocations || loc.minDepth <= state.floors.length; }
  function availableLocations(state) { return DE.Data.LOCATIONS.filter(l => isOpen(state, l)); }

  /** The numbers for a team on a trip: duration (s), injury chance per member, loot multiplier,
   *  rescue chance and the checkpoints (fractions of the trip). */
  function plan(state, locId, ids) {
    const loc = location(locId); if (!loc) return null;
    const fx = DE.Effects.get(state), bus = DE.Events.bus(state);
    const members = (ids || []).map(id => state.survivors[id]).filter(Boolean);
    const count = (p) => members.filter(s => s.profession === p).length;
    const scouts = count('scout'), scav = count('scavenger'), hunters = count('hunter'), medics = count('medic');
    const duration = Math.max(20, Math.round(loc.duration * Math.pow(0.8, scouts) * bus.speed * (1 - Math.min(0.7, fx.expeditionSpeed || 0))));
    const lootMult = fx.lootBonus * bus.cargo * (1 + 0.15 * Math.max(0, members.length - 1)) * (1 + 0.3 * scav) * (1 + 0.3 * (state.floors.length - 1))
      * members.reduce((m, s) => m + DE.Survivors.traitSum(s, 'loot'), 1);
    const danger = loc.danger * (1 - 0.15 * scav) * (1 - 0.2 * hunters) * (1 - 0.25 * Math.min(1, medics)) * (1 - Math.min(0.8, fx.expeditionSafety || 0)) * (1 - bus.safety);
    return { loc, members, duration, lootMult, danger: Math.max(0, Math.min(0.95, danger)), rescue: loc.rescue || 0, stops: duration >= 900 ? [0.35, 0.7] : [0.5] };
  }

  function canSend(state, locId, survivorIds) {
    const loc = location(locId);
    if (!loc) return { ok: false, reason: 'Unknown location' };
    if (!unlocked(state)) return { ok: false, reason: 'Build a Garage first' };
    if (state.expeditions.active.length >= slots(state)) return { ok: false, reason: 'All teams are out' };
    if (!isOpen(state, loc)) return { ok: false, reason: 'Dig to B' + loc.minDepth + ' to find this location' };
    if (!survivorIds || !survivorIds.length) return { ok: false, reason: 'Pick at least one survivor' };
    if (survivorIds.length > DE.Events.bus(state).capacity) return { ok: false, reason: 'The ' + DE.Events.bus(state).name.toLowerCase() + ' seats ' + DE.Events.bus(state).capacity };
    for (const id of survivorIds) {
      const s = state.survivors[id];
      if (!s) return { ok: false, reason: 'Unknown survivor' };
      if (s.assignment && s.assignment.kind === 'expedition') return { ok: false, reason: s.name + ' is already away' };
      if (s.hp < 50) return { ok: false, reason: s.name + ' is too injured' };
    }
    return { ok: true };
  }

  function send(state, locId, survivorIds, now) {
    now = now || Date.now();
    const c = canSend(state, locId, survivorIds);
    if (!c.ok) return c;
    const p = plan(state, locId, survivorIds);
    const id = 'x' + (state.nextId++);
    survivorIds.forEach(sid => { DE.Survivors.assign(state, sid, null); state.survivors[sid].assignment = { kind: 'expedition', id }; });
    state.expeditions.active.push({ id, location: locId, survivors: survivorIds.slice(), endsAt: now + p.duration * 1000, duration: p.duration, startedAt: now, stops: p.stops, stop: 0, mult: 1, bonus: {}, notes: [], seen: [] });
    return { ok: true, duration: p.duration };
  }

  /** Progress of an active trip, 0..1. */
  function progress(exp, now) { return Math.max(0, Math.min(1, 1 - (exp.endsAt - now) / (exp.duration * 1000))); }

  function resolve(state, exp, now) {
    const loc = location(exp.location);
    const fx = DE.Effects.get(state);
    const p = plan(state, exp.location, exp.survivors);
    const members = p.members;
    const result = { id: exp.id, location: loc.id, t: now, loot: {}, injured: [], rescued: null, members: members.map(m => m.name), finds: [], notes: (exp.notes || []).slice(0, 6) };
    const lootMult = p.lootMult * (exp.mult || 1);
    for (const r in loc.loot) {
      const [a, b] = loc.loot[r];
      result.loot[r] = Math.floor(U().rand(a, b) * lootMult);
    }
    for (const r in exp.bonus || {}) if (DE.Data.RESOURCES[r]) result.loot[r] = (result.loot[r] || 0) + Math.max(0, Math.floor(exp.bonus[r]));
    for (const r in result.loot) {
      const amt = result.loot[r];
      state.resources[r] = Math.min(DE.Economy.storageCap(state, r), state.resources[r] + amt);
      state.stats.produced[r] += amt; state.stats.runScore += amt * DE.Data.RESOURCES[r].value;
    }
    members.forEach(s => {
      s.assignment = null;
      s.xp += 60 * fx.xpMult;
      if (U().chance(p.danger)) { DE.Survivors.injure(s, U().randInt(25, 50)); result.injured.push(s.name); }
    });
    if (U().chance(p.rescue) && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) {
      const sv = DE.Survivors.spawn(state); state.stats.recruited++; result.rescued = sv.name;
    }
    // rare discoveries at this location
    (loc.finds || []).forEach(f => {
      if (!U().chance(f.chance)) return;
      const sum = DE.Events.applyEffects(state, f.effects, { members: exp.survivors });
      result.finds.push(f.text + (sum ? ' — ' + sum : ''));
    });
    state.stats.expeditions++;
    state.expeditions.log.push(result);
    if (state.expeditions.log.length > 20) state.expeditions.log.shift();
    state._events = state._events || []; state._events.push({ type: 'expedition', result });
    return result;
  }

  function tick(state, now) {
    // checkpoints on the road: a chance of an encounter (decision card) while the team is out
    state.expeditions.active.forEach(e => {
      if (!Array.isArray(e.stops) || (e.stop || 0) >= e.stops.length) return;
      if (progress(e, now) < e.stops[e.stop || 0]) return;
      e.stop = (e.stop || 0) + 1;
      if (!state._offline && U().chance(e.stops.length > 1 ? 0.6 : 0.75)) DE.Events.encounter(state, e);
    });
    const done = state.expeditions.active.filter(e => now >= e.endsAt);
    if (!done.length) return [];
    state.expeditions.active = state.expeditions.active.filter(e => now < e.endsAt);
    return done.map(e => resolve(state, e, now));
  }

  return { location, slots, unlocked, isOpen, availableLocations, plan, canSend, send, progress, resolve, tick };
})();
