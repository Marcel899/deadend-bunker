/* Bunker grid: floors, slots, room placement, construction timers, upgrades, adjacency. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Bunker = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;

  function getFloor(state, depth) { return state.floors.find(f => f.depth === depth) || null; }
  function roomsOnFloor(state, depth) { return Object.values(state.rooms).filter(r => r.floor === depth).sort((a, b) => a.slot - b.slot); }

  /** Why a room cannot be built yet (null if it can). */
  function lockReason(state, type) {
    const def = DE.Data.ROOMS[type]; if (!def) return 'Unknown room';
    if (def.unique) return 'Found only by excavation';
    const ur = DE.Effects.get(state).unlockedRooms;
    if (def.unlock && !(ur[type] || (def.unlock.startsWith('blueprints') && ur[def.unlock]))) { const n = DE.Data.RESEARCH[def.unlock]; return 'Research: ' + (n ? n.name : def.unlock); }
    if (def.minDepth && state.floors.length < def.minDepth) return 'Dig to B' + def.minDepth;
    return null;
  }
  function isUnlocked(state, type) {
    const def = DE.Data.ROOMS[type];
    if (!def || def.unique) return false;
    if (def.minDepth && state.floors.length < def.minDepth) return false;
    if (!def.unlock) return true;
    const ur = DE.Effects.get(state).unlockedRooms;
    return !!(ur[type] || (def.unlock.startsWith('blueprints') && ur[def.unlock]));
  }

  /** Can `type` fit at floor/slot? Returns {ok, reason}. */
  function canPlace(state, type, depth, slot) {
    const def = DE.Data.ROOMS[type];
    const floor = getFloor(state, depth);
    if (!def || !floor) return { ok: false, reason: 'Invalid location' };
    if (slot < 0 || slot + def.size > C().FLOOR_SLOTS) return { ok: false, reason: 'Not enough space' };
    for (let k = 0; k < def.size; k++) if (floor.slots[slot + k]) return { ok: false, reason: 'Slot occupied' };
    return { ok: true };
  }

  /** Cost to construct a new room of `type`. */
  function buildCost(state, type) {
    const def = DE.Data.ROOMS[type];
    return U().scaleCost(def.cost, DE.Effects.get(state).buildCostMult);
  }
  function buildTime(state, type) {
    const def = DE.Data.ROOMS[type];
    return Math.max(1, def.buildTime * DE.Effects.get(state).buildTimeMult);
  }

  /** Cost for `count` levels starting from the room's current level (plus pending levels). */
  function upgradeCost(state, room, count) {
    const def = DE.Data.ROOMS[room.type];
    const from = room.level + (room.construction && room.construction.kind === 'upgrade' ? room.construction.levels : 0);
    const g = def.costGrowth || C().COST_GROWTH;
    const m = DE.Effects.get(state).buildCostMult * (def.unique ? 1.0 : 1);
    const out = {};
    for (const r in def.cost) out[r] = Math.ceil(U().geomSum(def.cost[r], g, from, count) * m);
    return out;
  }
  function upgradeTime(state, room, count) {
    const def = DE.Data.ROOMS[room.type];
    const base = (def.buildTime || 30) * 0.5 * (1 + 0.05 * room.level) * Math.sqrt(count);
    return Math.max(1, base * DE.Effects.get(state).buildTimeMult);
  }

  /** How many levels can be bought given a buy mode (1,10,25,'max'). */
  function affordableLevels(state, room, mode) {
    const def = DE.Data.ROOMS[room.type];
    const pending = room.construction && room.construction.kind === 'upgrade' ? room.construction.levels : 0;
    const remaining = Math.max(0, def.maxLevel - room.level - pending);
    const want = mode === 'max' ? Math.min(remaining, 500) : Math.min(remaining, mode);
    if (want <= 0) return 0;
    // binary search largest n ≤ want that is affordable
    let lo = 0, hi = want;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (U().canAfford(state.resources, upgradeCost(state, room, mid))) lo = mid; else hi = mid - 1;
    }
    return lo;
  }

  /** Place a room immediately at `level` (used for starters & facilities). */
  function placeRoom(state, type, depth, slot, level, now) {
    const def = DE.Data.ROOMS[type];
    const floor = getFloor(state, depth);
    const id = 'r' + (state.nextId++);
    const room = { id, type, floor: depth, slot, level, workers: [], construction: null };
    for (let k = 0; k < def.size; k++) floor.slots[slot + k] = id;
    state.rooms[id] = room;
    return room;
  }

  function build(state, type, depth, slot, now) {
    now = now || Date.now();
    if (!isUnlocked(state, type)) return { ok: false, reason: 'Not unlocked' };
    const place = canPlace(state, type, depth, slot);
    if (!place.ok) return place;
    const cost = buildCost(state, type);
    if (!U().canAfford(state.resources, cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, cost);
    const room = placeRoom(state, type, depth, slot, 0, now);
    const dur = buildTime(state, type);
    room.construction = { kind: 'build', endsAt: now + dur * 1000, duration: dur, levels: 1 };
    state._dirtyBunker = true;
    return { ok: true, room };
  }

  function upgrade(state, roomId, count, now) {
    now = now || Date.now();
    const room = state.rooms[roomId];
    if (!room) return { ok: false, reason: 'No such room' };
    if (room.construction) return { ok: false, reason: 'Already under construction' };
    if (room.level < 1) return { ok: false, reason: 'Still being built' };
    const def = DE.Data.ROOMS[room.type];
    count = Math.max(1, Math.min(count | 0, def.maxLevel - room.level));
    if (count <= 0) return { ok: false, reason: 'Max level' };
    const cost = upgradeCost(state, room, count);
    if (!U().canAfford(state.resources, cost)) return { ok: false, reason: 'Not enough resources' };
    U().pay(state.resources, cost);
    const dur = upgradeTime(state, room, count);
    room.construction = { kind: 'upgrade', endsAt: now + dur * 1000, duration: dur, levels: count };
    return { ok: true, cost, levels: count };
  }

  function demolish(state, roomId) {
    const room = state.rooms[roomId];
    if (!room) return { ok: false, reason: 'No such room' };
    const def = DE.Data.ROOMS[room.type];
    if (def.unique) return { ok: false, reason: 'Unique rooms cannot be demolished' };
    if (room.type === 'quarters' && Object.values(state.rooms).filter(r => r.type === 'quarters').length === 1)
      return { ok: false, reason: 'You need at least one Living Quarters' };
    // free workers
    room.workers.slice().forEach(id => DE.Survivors.assign(state, id, null));
    const floor = getFloor(state, room.floor);
    floor.slots.forEach((rid, k) => { if (rid === roomId) floor.slots[k] = null; });
    // refund 50% of what was spent on levels
    const refund = {};
    const spent = room.level > 0 ? U().addCost(def.cost, (() => { const o = {}; for (const r in def.cost) o[r] = U().geomSum(def.cost[r], def.costGrowth || C().COST_GROWTH, 1, room.level - 1); return o; })()) : def.cost;
    for (const r in spent) refund[r] = Math.floor(spent[r] * 0.5);
    for (const r in refund) state.resources[r] = Math.min(DE.Economy.storageCap(state, r), state.resources[r] + refund[r]);
    delete state.rooms[roomId];
    state._dirtyBunker = true;
    return { ok: true, refund };
  }

  /** Finish construction timers that have elapsed. Returns list of completed events. */
  function tickConstruction(state, now) {
    const events = [];
    for (const id in state.rooms) {
      const room = state.rooms[id];
      const c = room.construction;
      if (!c || now < c.endsAt) continue;
      if (c.kind === 'build') { room.level = 1; state.stats.roomsBuilt = (state.stats.roomsBuilt || 0) + 1; events.push({ type: 'built', room }); }
      else { room.level += c.levels; events.push({ type: 'upgraded', room, levels: c.levels }); }
      room.construction = null;
      state._dirtyBunker = true;
    }
    return events;
  }

  /** Adjacency: same-type neighbours +10% each, a generator neighbour +5% for production rooms. */
  function adjacencyBonus(state, room) {
    const def = DE.Data.ROOMS[room.type];
    if (!def.produces) return 0;
    const floor = getFloor(state, room.floor);
    if (!floor) return 0;
    const left = room.slot - 1 >= 0 ? floor.slots[room.slot - 1] : null;
    const right = room.slot + def.size < C().FLOOR_SLOTS ? floor.slots[room.slot + def.size] : null;
    let bonus = 0;
    [left, right].forEach(nid => {
      const n = nid ? state.rooms[nid] : null;
      if (!n || n.level < 1) return;
      if (n.type === room.type) bonus += 0.10;
      else if (n.type === 'generator' || n.type === 'geothermal') bonus += 0.05;
    });
    return bonus;
  }

  function housingCapacity(state) { return DE.Effects.get(state).housing; }
  function population(state) { return Object.keys(state.survivors).length; }

  function roomCount(state) { return Object.values(state.rooms).filter(r => r.level >= 1).length; }
  function totalLevels(state) { return Object.values(state.rooms).reduce((s, r) => s + r.level, 0); }

  return { getFloor, roomsOnFloor, isUnlocked, lockReason, canPlace, buildCost, buildTime, upgradeCost, upgradeTime, affordableLevels,
    placeRoom, build, upgrade, demolish, tickConstruction, adjacencyBonus, housingCapacity, population, roomCount, totalLevels };
})();
