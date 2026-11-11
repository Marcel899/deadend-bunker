/* Expeditions: send survivors to surface locations for loot, rescues and risk. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Expeditions = (function () {
  const U = () => DE.Util;

  function location(id) { return DE.Data.LOCATIONS.find(l => l.id === id); }
  function slots(state) { return DE.Effects.get(state).expeditionSlots; }
  function unlocked(state) { return slots(state) > 0; }
  function availableLocations(state) { const all = DE.Effects.get(state).allLocations; return DE.Data.LOCATIONS.filter(l => all || l.minDepth <= state.floors.length); }

  function canSend(state, locId, survivorIds) {
    const loc = location(locId);
    if (!loc) return { ok: false, reason: 'Unknown location' };
    if (!unlocked(state)) return { ok: false, reason: 'Build a Garage first' };
    if (state.expeditions.active.length >= slots(state)) return { ok: false, reason: 'All teams are out' };
    if (loc.minDepth > state.floors.length && !DE.Effects.get(state).allLocations) return { ok: false, reason: 'Dig deeper to find this location' };
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
    const loc = location(locId);
    const id = 'x' + (state.nextId++);
    survivorIds.forEach(sid => { DE.Survivors.assign(state, sid, null); state.survivors[sid].assignment = { kind: 'expedition', id }; });
    const scouts = survivorIds.filter(id => state.survivors[id] && state.survivors[id].profession === 'scout').length;
    const dur = Math.max(20, Math.round(loc.duration * Math.pow(0.8, scouts) * DE.Events.bus(state).speed * (1 - Math.min(0.7, DE.Effects.get(state).expeditionSpeed || 0))));
    state.expeditions.active.push({ id, location: locId, survivors: survivorIds.slice(), endsAt: now + dur * 1000, duration: dur });
    return { ok: true };
  }

  function resolve(state, exp, now) {
    const loc = location(exp.location);
    const fx = DE.Effects.get(state);
    const members = exp.survivors.map(id => state.survivors[id]).filter(Boolean);
    const scav = members.filter(s => s.profession === 'scavenger').length;
    const lootMult = fx.lootBonus * DE.Events.bus(state).cargo * (1 + 0.15 * (members.length - 1)) * (1 + 0.3 * scav) * (1 + 0.3 * (state.floors.length - 1))
      * members.reduce((m, s) => m + DE.Survivors.traitSum(s, 'loot'), 1);
    const result = { id: exp.id, location: loc.id, t: now, loot: {}, injured: [], rescued: null, members: members.map(m => m.name) };
    for (const r in loc.loot) {
      const [a, b] = loc.loot[r];
      const amt = Math.floor(U().rand(a, b) * lootMult);
      result.loot[r] = amt;
      state.resources[r] = Math.min(DE.Economy.storageCap(state, r), state.resources[r] + amt);
      state.stats.produced[r] += amt; state.stats.runScore += amt * DE.Data.RESOURCES[r].value;
    }
    const hunters = members.filter(s => s.profession === 'hunter').length;
    const danger = loc.danger * (1 - 0.15 * scav) * (1 - 0.2 * hunters) * (1 - Math.min(0.8, fx.expeditionSafety || 0)) * (1 - DE.Events.bus(state).safety);
    members.forEach(s => {
      s.assignment = null;
      s.xp += 60 * fx.xpMult;
      if (U().chance(danger)) { DE.Survivors.injure(s, U().randInt(25, 50)); result.injured.push(s.name); }
    });
    if (U().chance(loc.rescue) && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) {
      const sv = DE.Survivors.spawn(state); state.stats.recruited++; result.rescued = sv.name;
    }
    state.stats.expeditions++;
    if (U().chance(0.6)) DE.Events.encounter(state, exp, result);
    state.expeditions.log.push(result);
    if (state.expeditions.log.length > 20) state.expeditions.log.shift();
    state._events = state._events || []; state._events.push({ type: 'expedition', result });
    return result;
  }

  function tick(state, now) {
    const done = state.expeditions.active.filter(e => now >= e.endsAt);
    if (!done.length) return [];
    state.expeditions.active = state.expeditions.active.filter(e => now < e.endsAt);
    return done.map(e => resolve(state, e, now));
  }

  return { location, slots, unlocked, availableLocations, canSend, send, resolve, tick };
})();
