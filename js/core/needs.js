/* Survivor needs & daily routine. Each survivor has energy and hunger; the routine decides what
 * they are doing right now (work, sleep, eat, rest, heal, guard, away) and where. The economy
 * reads `presence` (0..1) and `needsMult` so sleeping and hungry workers really produce less,
 * which is what makes quarters, canteens and kitchens matter.
 *
 *   sv.energy  100 → 0 while awake (~7 min of work), restored while sleeping
 *   sv.hunger  0 → 100 (~9 min), reset by eating
 *   sv.act     { kind, until, room }   kind ∈ work | sleep | eat | rest | heal | guard | mine | away | idle | build */
var DE = globalThis.DE = globalThis.DE || {};

DE.Needs = (function () {
  const U = () => DE.Util;
  const ENERGY_DRAIN = 100 / 420;   // per second awake
  const HUNGER_GAIN = 100 / 540;    // per second
  const SLEEP_BASE = 100 / 70;      // energy per second asleep (level-1 quarters)
  const EAT_BASE = 22;              // seconds for a meal

  function init(sv) {
    if (typeof sv.energy !== 'number') sv.energy = 70 + Math.random() * 30;
    if (typeof sv.hunger !== 'number') sv.hunger = Math.random() * 40;
    if (!sv.act) sv.act = { kind: 'idle', until: 0, room: null };
  }

  /** Find a room of one of the given types, preferring the highest level. */
  function findRoom(state, types) {
    let best = null;
    for (const id in state.rooms) { const r = state.rooms[id]; if (r.level > 0 && types.includes(r.type) && (!best || r.level > best.level)) best = r; }
    return best;
  }
  /** A free berth for `sv` in one of the given room types: best room level first. Berths come
   * from the bed furniture each room shows (DE.Data.bedsFor) and hold one survivor each. */
  function freeBed(state, sv, types, kind) {
    if (!DE.Data.bedsFor) return null;
    const used = {};
    for (const id in state.survivors) { const o = state.survivors[id]; if (o !== sv && o.act && o.act.kind === kind && o.act.room && o.act.bed != null) used[o.act.room + ':' + o.act.bed] = true; }
    const rooms = Object.values(state.rooms).filter(r => r.level > 0 && !r.construction && types.includes(r.type)).sort((a, b) => b.level - a.level);
    for (const r of rooms) { const beds = DE.Data.bedsFor(r.type, r.level); for (let i = 0; i < beds.length; i++) if (!used[r.id + ':' + i]) return { room: r.id, bed: i }; }
    return null;
  }
  /** Is the berth this survivor holds still there (room not demolished / under construction)? */
  function bedValid(state, a) { const r = a.room && state.rooms[a.room]; return !!(r && !r.construction && a.bed != null && a.bed < DE.Data.bedsFor(r.type, r.level).length); }
  const BED_ROOMS = ['quarters', 'dormitory', 'barracks', 'ark', 'cryo'];
  const EAT_ROOMS = ['cafeteria', 'kitchen', 'ark'];
  const HEAL_ROOMS = ['hospital', 'infirmary', 'medbay', 'quarantine', 'bioeng'];
  const REST_ROOMS = ['training', 'cafeteria', 'ark', 'greenhouse'];

  /** Multiplier on a survivor's work efficiency from energy and hunger. */
  function needsMult(sv) {
    const e = typeof sv.energy === 'number' ? sv.energy : 100, h = typeof sv.hunger === 'number' ? sv.hunger : 0;
    let m = 0.7 + 0.3 * (e / 100);
    if (h > 70) m *= 0.85;
    return m;
  }
  /** 1 while on the job, lower while asleep / eating (the shift covers for them). */
  function presence(sv) {
    const k = sv.act ? sv.act.kind : 'work';
    return (k === 'sleep' || k === 'eat' || k === 'heal') ? 0.5 : k === 'rest' ? 0.75 : 1;
  }

  function tick(state, dt, fx) {
    const now = state.lastTick; // virtual clock in ms is set after; use playtime-based timers instead
    const t = state.playtime;
    const foodOk = state.resources.food > 0;
    const sleepRate = SLEEP_BASE * (1 + (fx.sleepSpeed || 0));
    const eatTime = EAT_BASE / (1 + (fx.eatSpeed || 0));
    const hungerRate = HUNGER_GAIN * Math.max(0.3, 1 - (fx.hungerSlow || 0));
    for (const id in state.survivors) {
      const sv = state.survivors[id]; init(sv);
      const a = sv.act; const assign = sv.assignment;
      if (assign && assign.kind === 'expedition') { a.kind = 'away'; a.room = null; continue; }
      // needs drift
      if (a.kind === 'sleep') sv.energy = Math.min(100, sv.energy + sleepRate * dt);
      else sv.energy = Math.max(0, sv.energy - ENERGY_DRAIN * dt * (a.kind === 'rest' || a.kind === 'idle' ? 0.4 : 1));
      if (a.kind !== 'eat') sv.hunger = Math.min(100, sv.hunger + hungerRate * dt);
      // decide
      let kind = a.kind, room = a.room, bed = a.bed == null ? null : a.bed;
      const ward = sv.infection && sv.infection.ward && state.rooms[sv.infection.ward];
      if (ward) {
        // isolated: in a ward bed, looked after there (fed, resting)
        kind = 'heal'; room = ward.id;
        if (!(a.kind === 'heal' && a.room === ward.id && bedValid(state, a))) { const b = freeBed(state, sv, [ward.type], 'heal'); bed = b && b.room === ward.id ? b.bed : null; }
        sv.energy = Math.min(100, sv.energy + sleepRate * .5 * dt);
      }
      else if (kind === 'sleep' && sv.energy < 98 && bedValid(state, a)) { /* keep sleeping in the same berth */ }
      else if (kind === 'eat' && t < a.until) { /* keep eating */ }
      else if (kind === 'heal' && sv.hp < 90 && state.rooms[a.room]) { /* keep resting in the ward */ }
      else {
        bed = null;
        const berth = sv.energy < 12 ? freeBed(state, sv, BED_ROOMS, 'sleep') : null;
        if (sv.hp < 50 && findRoom(state, HEAL_ROOMS)) { kind = 'heal'; const b = freeBed(state, sv, HEAL_ROOMS, 'heal'); if (b) { room = b.room; bed = b.bed; } else room = findRoom(state, HEAL_ROOMS).id; }
        // sleep only in an actual free bed; with no berth available they stay up (and stay tired)
        else if (berth) { kind = 'sleep'; room = berth.room; bed = berth.bed; }
        else if (sv.hunger > 85 && foodOk) { kind = 'eat'; const r = findRoom(state, EAT_ROOMS); room = r ? r.id : null; a.until = t + eatTime; sv.hunger = 0; }
        else if (assign && assign.kind === 'room' && state.rooms[assign.id]) { kind = state.rooms[assign.id].construction ? 'build' : 'work'; room = assign.id; }
        else if (assign && assign.kind === 'guard') { kind = 'guard'; room = null; }
        else if (assign && assign.kind === 'dig') { kind = 'mine'; room = null; }
        else { kind = 'rest'; const r = findRoom(state, REST_ROOMS); room = r ? r.id : (findRoom(state, BED_ROOMS) || {}).id || null; }
      }
      if (kind === 'eat' && a.kind !== 'eat') { a.until = t + eatTime; sv.hunger = 0; }
      a.kind = kind; a.room = room;
      if ((kind === 'sleep' || kind === 'heal') && bed != null) a.bed = bed; else delete a.bed;
    }
  }

  /** Short human text for the UI. */
  function describe(sv) {
    const k = sv.act ? sv.act.kind : 'idle';
    return { work: 'Working', sleep: 'Sleeping', eat: 'Eating', rest: 'Resting', heal: 'In treatment', guard: 'On guard duty', away: 'On expedition', idle: 'Idle', build: 'Helping construction', mine: 'Mining' }[k] || k;
  }

  return { init, tick, needsMult, presence, describe, findRoom, freeBed, BED_ROOMS, EAT_ROOMS, HEAL_ROOMS, REST_ROOMS };
})();
