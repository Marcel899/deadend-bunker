/* DEAD END: Underground — global configuration constants.
 * Every file attaches to the single `DE` namespace (no other globals). */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.CONFIG = {
  SAVE_KEY: 'deadend_underground_save_v1',
  SAVE_VERSION: 1,
  AUTOSAVE_SEC: 15,
  TICK_MS: 250,
  /* Offline progression */
  OFFLINE_CAP_HOURS: 8,          // base cap, extended by research / legacy
  OFFLINE_MIN_SEC: 20,           // gaps shorter than this are just a normal tick
  OFFLINE_MAX_STEPS: 400,        // simulation granularity for long absences
  OFFLINE_MAX_WAVES: 3,          // zombie waves resolved while away (rest are deferred)
  /* Bunker */
  FLOOR_SLOTS: 6,
  BASE_MAX_FLOOR: 3,
  MAX_FLOORS: 12,
  BASE_STORAGE: 1000,
  /* Economy */
  SURVIVOR_FOOD: 0.04,           // per survivor per second
  SURVIVOR_WATER: 0.04,
  UNMANNED_BASE: 0.25,
  COST_GROWTH: 1.17,
  /* Survivors */
  RECRUIT_BASE_COST: 60,
  RECRUIT_GROWTH: 1.22,
  XP_PER_SEC: 1,
  XP_BASE: 120,
  XP_GROWTH: 1.5,
  SURVIVOR_MAX_LEVEL: 20,
  /* Defense */
  FIRST_WAVE_SEC: 240,
  WAVE_INTERVAL_SEC: 300,
  WAVE_BASE_HP: 90,
  WAVE_GROWTH: 1.16,
  WAVE_DURATION: 30,
  WALL_BASE_HP: 250,
  GUARD_BASE_DMG: 3,
  TURRET_DMG: 8,
  TURRET_POWER: 0.3,
  TRAP_DMG: 60,
  TRAPS_PER_WAVE: 5,
  /* Prestige */
  LEGACY_DIVISOR: 12000,
  PRESTIGE_MIN_DEPTH: 3,
  PRESTIGE_MIN_GAIN: 3,
};
