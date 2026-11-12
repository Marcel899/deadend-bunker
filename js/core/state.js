/* Central game state: creation of a fresh run (optionally carrying prestige data). */
var DE = globalThis.DE = globalThis.DE || {};

DE.State = (function () {
  const C = () => DE.CONFIG;

  function emptyFloor(depth, cols) {
    return { depth, slots: new Array(cols || C().FLOOR_SLOTS).fill(null), facility: null, expansion: null };
  }

  function blank(now) {
    const resources = {};
    DE.Data.RESOURCE_ORDER.forEach(r => resources[r] = 0);
    const produced = {};
    DE.Data.RESOURCE_ORDER.forEach(r => produced[r] = 0);
    return {
      version: C().SAVE_VERSION,
      createdAt: now, lastTick: now, lastSave: 0, playtime: 0,
      resources,
      floors: [],
      rooms: {},
      survivors: {},
      nextId: 1,
      research: { done: {}, current: null },
      excavation: null,                // { depth, endsAt, duration }
      defense: {
        wall: { level: 1, hp: 0 },      // hp filled in after effects are known
        turrets: 0, traps: 0, turretLevel: 0, breachStreak: 0, winStreak: 0,
        nextWaveAt: now + C().FIRST_WAVE_SEC * 1000,
        wave: 1, log: [], shock: 0, lastResult: null, nextMut: null,
      },
      expeditions: { active: [], log: [] },
      prestige: { points: 0, lifetime: 0, upgrades: {}, resets: 0 },
      stats: { runScore: 0, produced, zombiesKilled: 0, wavesSurvived: 0, breaches: 0, recruited: 0, maxDepth: 1, expeditions: 0, roomsBuilt: 0 },
      morale: 60,
      log: [],
      settings: { autosave: true, animations: true },
      flags: {},
      overworld: { fence: 0, barricades: 0, towers: 0, lights: 0, road: 0, missile: 0 },
      events: [], artifacts: {}, rep: { traders: 0, militia: 0, growers: 0 }, bus: { level: 1 }, goals: { done: {} }, buffs: [], eventChains: [], nextEventAt: 0,
    };
  }

  /** Create a new run. `prestige` (optional) is carried over from the previous run. */
  function create(prestige, now) {
    now = now || Date.now();
    const s = blank(now);
    if (prestige) s.prestige = DE.Util.deepClone(prestige);
    const lfx = DE.Effects.legacyEffects(s.prestige);

    // starting resources
    Object.assign(s.resources, DE.Data.START_RESOURCES);
    ['food', 'water', 'scrap', 'fuel'].forEach(r => s.resources[r] += lfx.startResources);

    // floors
    const startFloors = 1 + lfx.startFloors;
    for (let d = 1; d <= startFloors; d++) s.floors.push(emptyFloor(d));
    s.stats.maxDepth = startFloors;

    // starting rooms on floor 1
    const starters = [['quarters', 0], ['farm', 4], ['water', 6], ['generator', 8], ['workshop', 10]];
    starters.forEach(([type, slot]) => DE.Bunker.placeRoom(s, type, 1, slot, 1, now));

    // starting survivors
    // four starters, one per essential room; legacy "Old Friends" adds more
    const jobs = ['farmer', 'mechanic', 'engineer', 'scavenger', 'soldier', 'scientist', 'cook', 'medic', 'farmer', 'mechanic'];
    const n = 4 + lfx.startSurvivors;
    for (let i = 0; i < n; i++) DE.Survivors.spawn(s, jobs[i % jobs.length]);
    // auto-assign the starters to matching rooms
    const byType = {};
    for (const id in s.rooms) byType[s.rooms[id].type] = id;
    const assignments = { farmer: 'farm', mechanic: 'water', engineer: 'generator', scavenger: 'workshop' };
    for (const id in s.survivors) {
      const sv = s.survivors[id];
      const rt = assignments[sv.profession];
      if (rt && byType[rt] && DE.Survivors.assign(s, id, { kind: 'room', id: byType[rt] }).ok) continue;
    }
    if (lfx.startRep) { s.rep.traders = lfx.startRep; s.bus.level = Math.min(DE.Data.BUS.length, 1 + lfx.startRep); }
    if (prestige && prestige.relic && DE.Data.ARTIFACTS[prestige.relic]) s.artifacts[prestige.relic] = true;
    // legacy "Inherited Science": research nodes up to a given tree depth start completed
    if (lfx.startResearchTier > 0) {
      for (const id in DE.Data.RESEARCH) if (DE.Research.tier(id) <= lfx.startResearchTier) s.research.done[id] = true;
    }
    // wall starts full
    s._fx = DE.Effects.compute(s);
    s.defense.wall.hp = DE.Defense.wallMaxHp(s);
    s.log.push({ t: now, msg: 'The hatch seals behind you. Welcome to the Dead End.' });
    return s;
  }

  return { blank, create, emptyFloor };
})();
