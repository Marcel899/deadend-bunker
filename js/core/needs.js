/* Survivor needs & daily routine. Each survivor has energy and hunger; the routine decides what
 * they are doing right now (work, sleep, eat, rest, heal, guard, away) and where. The economy
 * reads `presence` (0..1) and `needsMult` so sleeping and hungry workers really produce less,
 * which is what makes quarters, canteens and kitchens matter.
 *
 *   sv.energy  100 → 0 while awake (~7 min of work), restored while sleeping
 *   sv.hunger  0 → 100 (~9 min), reset by eating
 *   sv.act     { kind, until, room }   kind ∈ work | sleep | eat | rest | heal | guard | away | idle | build */
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
      let kind = a.kind, room = a.room;
      if (kind === 'sleep' && sv.energy < 98) { /* keep sleeping */ }
      else if (kind === 'eat' && t < a.until) { /* keep eating */ }
      else if (kind === 'heal' && sv.hp < 90) { /* keep resting in the ward */ }
      else {
        if (sv.hp < 50 && findRoom(state, HEAL_ROOMS)) { kind = 'heal'; room = findRoom(state, HEAL_ROOMS).id; }
        else if (sv.energy < 12) { kind = 'sleep'; const r = findRoom(state, BED_ROOMS); room = r ? r.id : null; }
        else if (sv.hunger > 85 && foodOk) { kind = 'eat'; const r = findRoom(state, EAT_ROOMS); room = r ? r.id : null; a.until = t + eatTime; sv.hunger = 0; }
        else if (assign && assign.kind === 'room' && state.rooms[assign.id]) { kind = state.rooms[assign.id].construction ? 'build' : 'work'; room = assign.id; }
        else if (assign && assign.kind === 'guard') { kind = 'guard'; room = null; }
        else { kind = 'rest'; const r = findRoom(state, REST_ROOMS); room = r ? r.id : (findRoom(state, BED_ROOMS) || {}).id || null; }
      }
      if (kind === 'eat' && a.kind !== 'eat') { a.until = t + eatTime; sv.hunger = 0; }
      a.kind = kind; a.room = room;
    }
  }

  /** Short human text for the UI. */
  function describe(sv) {
    const k = sv.act ? sv.act.kind : 'idle';
    return { work: 'Working', sleep: 'Sleeping', eat: 'Eating', rest: 'Resting', heal: 'In treatment', guard: 'On guard duty', away: 'On expedition', idle: 'Idle', build: 'Helping construction' }[k] || k;
  }

  return { init, tick, needsMult, presence, describe, findRoom, BED_ROOMS, EAT_ROOMS, HEAL_ROOMS, REST_ROOMS };
})();
