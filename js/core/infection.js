/* Infection: a bite, a scratch or a bad night out can carry the infection.
 *
 *   sv.infection   { sev: 0..1, known, ward: roomId | null, prev: the job to go back to, since }
 *   sv.immuneUntil playtime until which a cured survivor cannot catch it again
 *
 * Stages by severity:
 *   incubating  < .25  no symptoms; found early only by a medical screening (a staffed medical room)
 *   feverish    < .50  shows: works at 75%, tires faster
 *   sick        < .80  works at half pace, loses health, can pass it on to the people around
 *   turning     ≥ .80  critical; at 1 the survivor turns and is lost
 * Untreated that takes about 25 minutes from a bite, so there is time to act. Isolated in the
 * Quarantine Ward the infection stops spreading and is treated (faster with a medic on duty, a
 * better ward and power); a Medbay, Infirmary or Hospital can take patients too but treats slowly
 * and the staff can catch it. Cured survivors are immune for half an hour and go back to their job.
 * Sources: zombie fights (more with toxic zombies and breaches), injuries out on expeditions and
 * some events. Rare and slow on purpose: meaningful, not a death sentence. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Infection = (function () {
  const U = () => DE.Util;
  const GROW = 1 / 1500;                 // severity per second, untreated (≈ 25 min from 0 to 1)
  const IMMUNE = 1800;                   // seconds of immunity after a cure
  const STAGES = [
    { id: 'incubating', name: 'Incubating', min: 0, eff: .95 },
    { id: 'feverish', name: 'Feverish', min: .25, eff: .75 },
    { id: 'sick', name: 'Sick', min: .5, eff: .5 },
    { id: 'turning', name: 'Turning', min: .8, eff: .25 },
  ];
  const WARDS = ['quarantine'];
  const CLINICS = ['hospital', 'infirmary', 'medbay', 'bioeng', 'medresearch'];

  function stage(sv) { const i = sv && sv.infection; if (!i) return null; for (let k = STAGES.length - 1; k >= 0; k--) if (i.sev >= STAGES[k].min) return STAGES[k]; return STAGES[0]; }
  function efficiencyMult(sv) { const st = stage(sv); return st ? st.eff : 1; }
  function infected(state) { return Object.values(state.survivors).filter(s => s.infection); }
  function known(state) { return infected(state).filter(s => s.infection.known); }
  function loose(state) { return known(state).filter(s => !s.infection.ward); }
  function push(state, e) { (state._events = state._events || []).push(e); }

  /** Expose a survivor: with this chance the infection takes hold (quietly: nobody knows yet). */
  function expose(state, sv, chance, sev) {
    if (!sv || !state.survivors[sv.id] || sv.infection || (sv.immuneUntil || 0) > state.playtime) return false;
    const fx = DE.Effects.get(state); chance *= 1 - Math.min(.8, fx.toxicResist || 0);
    if (!U().chance(chance)) return false;
    sv.infection = { sev: sev || .04, known: false, ward: null, prev: null, since: state.playtime };
    push(state, { type: 'infected', id: sv.id, name: sv.name });
    return true;
  }

  /* ---------- wards ---------- */
  function capacity(room) { const b = DE.Data.bedsFor ? DE.Data.bedsFor(room.type, room.level) : []; return Math.max(1, b.length || room.level); }
  function patients(state, roomId) { return Object.values(state.survivors).filter(s => s.infection && s.infection.ward === roomId); }
  function usable(room) { return room && room.level > 0 && !room.construction; }
  /** The best place with a free bed: a Quarantine Ward first, else a medical room. */
  function bestWard(state) {
    const rooms = Object.values(state.rooms).filter(r => usable(r) && (WARDS.includes(r.type) || CLINICS.includes(r.type)))
      .sort((a, b) => (WARDS.includes(b.type) - WARDS.includes(a.type)) || (b.level - a.level));
    return rooms.find(r => patients(state, r.id).length < capacity(r)) || null;
  }
  function hasWard(state) { return Object.values(state.rooms).some(r => usable(r) && (WARDS.includes(r.type) || CLINICS.includes(r.type))); }

  /** Take an infected survivor off duty and into a ward. */
  function isolate(state, id, roomId) {
    const sv = state.survivors[id]; if (!sv || !sv.infection) return { ok: false, reason: 'Not infected' };
    if (sv.assignment && sv.assignment.kind === 'expedition') return { ok: false, reason: sv.name + ' is out on an expedition' };
    if (sv.infection.ward && state.rooms[sv.infection.ward]) return { ok: true, room: state.rooms[sv.infection.ward] };
    const room = roomId ? state.rooms[roomId] : bestWard(state);
    if (!room || !usable(room)) return { ok: false, reason: hasWard(state) ? 'Every ward bed is taken' : 'Build a Quarantine Ward (or a Medbay) first' };
    if (patients(state, room.id).length >= capacity(room)) return { ok: false, reason: DE.Data.ROOMS[room.type].name + ' is full' };
    const a = sv.assignment; sv.infection.prev = a && a.kind !== 'expedition' ? Object.assign({}, a) : null;
    if (a) DE.Survivors.assign(state, id, null);
    sv.infection.ward = room.id; sv.infection.known = true;
    if (sv.act) { sv.act.kind = 'idle'; delete sv.act.bed; }
    return { ok: true, room };
  }
  /** Every known infected survivor who is still about, into a ward. */
  function isolateAll(state) {
    let n = 0, reason = '';
    for (const sv of loose(state)) { const r = isolate(state, sv.id); if (r.ok) n++; else reason = r.reason; }
    return { ok: n > 0, count: n, reason: reason || 'Nobody to isolate' };
  }
  function release(state, sv) {
    const prev = sv.infection && sv.infection.prev; sv.infection = null; sv.immuneUntil = state.playtime + IMMUNE;
    if (sv.act) { sv.act.kind = 'idle'; delete sv.act.bed; }
    if (prev && (prev.kind !== 'room' || state.rooms[prev.id])) DE.Survivors.assign(state, sv.id, prev);
  }
  function lose(state, sv) {
    DE.Survivors.assign(state, sv.id, null);
    delete state.survivors[sv.id];
    for (const id in state.survivors) { const o = state.survivors[id]; if (o.bonds) delete o.bonds[sv.id]; }
    state.defense.shock = Math.max(state.defense.shock || 0, 12);
  }

  /* ---------- the clock ---------- */
  function tick(state, dt, fx) {
    const list = infected(state); if (!list.length) return;
    const R = state._rates && state._rates.perRoom;
    for (const sv of list) {
      const i = sv.infection;
      if (sv.assignment && sv.assignment.kind === 'expedition') { i.sev = Math.min(.95, i.sev + GROW * .5 * dt); continue; }
      let ward = i.ward && state.rooms[i.ward];
      if (i.ward && !usable(ward)) { i.ward = null; ward = null; }
      if (ward) {
        // treatment: a ward with a medic on duty, its level and its power decide how fast
        const quarantine = WARDS.includes(ward.type), staffed = ward.workers.length > 0, power = R && R[ward.id] ? Math.max(.3, Math.min(1, R[ward.id].power)) : 1;
        const rate = (quarantine ? 1 / 240 : 1 / 600) * (1 + .2 * (ward.level - 1)) * (staffed ? 1 : .45) * power * (fx.healMult || 1);
        i.sev -= rate * dt;
        sv.hunger = Math.max(0, sv.hunger - .4 * dt);                     // fed in the ward
        if (i.sev <= 0) { release(state, sv); push(state, { type: 'cured', id: sv.id, name: sv.name }); continue; }
        if (!quarantine && staffed && i.sev >= .5 && U().chance(.0004 * dt)) {   // the clinic staff can catch it
          const m = state.survivors[U().pick(ward.workers)]; if (expose(state, m, 1)) push(state, { type: 'spread', id: m.id, name: m.name, from: sv.name });
        }
        continue;
      }
      const before = stage(sv).id;
      i.sev = Math.min(1, i.sev + GROW * dt);
      const st = stage(sv);
      if (!i.known && i.sev >= .25) { i.known = true; push(state, { type: 'symptoms', id: sv.id, name: sv.name }); }
      else if (i.known && st.id !== before && (st.id === 'sick' || st.id === 'turning')) push(state, { type: 'worse', id: sv.id, name: sv.name, stage: st.name });
      if (i.sev >= .25) sv.energy = Math.max(0, sv.energy - .06 * dt);
      if (i.sev >= .5) {
        sv.hp = Math.max(1, sv.hp - (i.sev >= .8 ? .1 : .04) * dt);
        // the sick pass it on to the people around them
        if (U().chance(.0012 * i.sev * dt)) {
          const room = sv.act && sv.act.room, near = Object.values(state.survivors).filter(o => o !== sv && !o.infection && !(o.assignment && o.assignment.kind === 'expedition') && (!room || (o.act && o.act.room === room)));
          const o = near.length ? U().pick(near) : null; if (o && expose(state, o, 1)) push(state, { type: 'spread', id: o.id, name: o.name, from: sv.name });
        }
      }
      if (i.sev >= 1) { push(state, { type: 'turned', id: sv.id, name: sv.name }); lose(state, sv); }
    }
    // medical screening: a medic on duty in a medical room finds hidden infections early
    if (state.playtime >= (state._screenAt || 0)) {
      state._screenAt = state.playtime + 45;
      const screening = Object.values(state.rooms).some(r => usable(r) && (WARDS.includes(r.type) || CLINICS.includes(r.type)) && r.workers.length > 0);
      if (screening) for (const sv of infected(state)) if (!sv.infection.known && sv.infection.sev >= .06 && U().chance(.5)) { sv.infection.known = true; push(state, { type: 'detected', id: sv.id, name: sv.name }); }
    }
  }

  return { STAGES, stage, efficiencyMult, infected, known, loose, expose, isolate, isolateAll, release, bestWard, hasWard, capacity, patients, tick, GROW };
})();
