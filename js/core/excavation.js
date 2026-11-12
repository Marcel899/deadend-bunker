/* Excavation: digging new floors down through the rock layers under the bunker, with a crew.
 *
 * Every floor sits in a rock layer (DE.Data.STRATA). Deeper layers are harder: more work for the
 * crew, a bigger bill (scrap, then concrete for shoring, fuel for the drills, research for deep
 * surveys), and the right equipment (research) plus a big enough Mining Station before digging
 * can start at all.
 *
 * A dig is an amount of work (crew-seconds). The mining crew — survivors on the 'dig' assignment —
 * does it: speed = a slow 0.3 for whoever lends a hand when nobody is posted, plus 0.4 for every
 * miner at full efficiency (level, rarity, traits, energy and hunger; engineers and mechanics know
 * the tools best), times the Mining Station's bonus. Between digs the crew quarries the rock face
 * for the next layer's material, and a finished floor's rubble pays out in it too (spoils). */
var DE = globalThis.DE = globalThis.DE || {};

DE.Excavation = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;
  const PROF = { engineer: 1.25, mechanic: 1.2, scavenger: 1.1, soldier: 1.05 };   // who handles a pick best
  const QUARRY = 0.07;     // value per second a miner at efficiency 1 cuts from the face (× hardness)

  function nextDepth(state) { return state.floors.length + 1; }
  function maxDepth(state) { return Math.min(C().MAX_FLOORS, DE.Effects.get(state).maxFloor); }
  function layer(depth) { return DE.Data.stratumAt(depth); }
  /** The rock the crew is working in: the layer of the next floor down (or the last one). */
  function faceLayer(state) { return layer(Math.min(C().MAX_FLOORS, nextDepth(state))); }
  function mineLevel(state) { let l = 0; for (const id in state.rooms) { const r = state.rooms[id]; if (r.type === 'minehead' && r.level > l) l = r.level; } return l; }

  function cost(state, depth) {
    const m = DE.Effects.get(state).excavationCostMult;
    const out = { scrap: Math.ceil(200 * Math.pow(1.9, depth - 2) * m) };
    if (depth >= 3) out.concrete = Math.ceil(60 * Math.pow(2, depth - 3) * m);
    if (depth >= 5) out.fuel = Math.ceil(60 * Math.pow(1.8, depth - 5) * m);
    if (depth >= 9) out.research = Math.ceil(400 * Math.pow(1.75, depth - 9) * m);
    return out;
  }
  /** Crew-seconds of digging a floor takes (seconds at speed 1). */
  function work(state, depth) {
    return Math.max(10, 90 * Math.pow(1.6, depth - 2) * layer(depth).hardness * DE.Effects.get(state).excavationTimeMult);
  }

  /* ---------- the crew ---------- */
  function miners(state) { return Object.values(state.survivors).filter(s => s.assignment && s.assignment.kind === 'dig'); }
  function minerCap(state) { return Math.min(12, DE.Effects.get(state).minerSlots || C().MINERS_BASE); }
  /** How much one survivor adds to the crew (1 = a standard miner). */
  function minerEff(state, s, fx) {
    fx = fx || DE.Effects.get(state);
    return DE.Survivors.efficiency(s, null, fx) * (PROF[s.profession] || 1) * DE.Needs.needsMult(s) * DE.Needs.presence(s);
  }
  /** Potential of a survivor as a miner, ignoring how tired they are right now (for picking crews). */
  function minerSkill(state, s) { return DE.Survivors.efficiency(s, null, DE.Effects.get(state)) * (PROF[s.profession] || 1); }
  function speed(state) {
    const fx = DE.Effects.get(state); let sum = 0;
    for (const id in state.survivors) { const s = state.survivors[id]; if (s.assignment && s.assignment.kind === 'dig') sum += minerEff(state, s, fx); }
    return (0.3 + 0.4 * sum) * (1 + (fx.digSpeed || 0));
  }
  /** Seconds a dig of `depth` would take with the crew as it is now. */
  function time(state, depth) { return work(state, depth) / speed(state); }

  /* ---------- what a layer asks for ---------- */
  /** The equipment research and Mining Station level a depth needs. */
  function requirements(state, depth) {
    const L = layer(depth), out = [];
    if (L.research) { const n = DE.Data.RESEARCH[L.research]; out.push({ kind: 'research', id: L.research, ok: depth <= maxDepth(state), text: (n ? n.name : L.research) + ' research', tool: L.tool }); }
    if (L.mine) { const have = mineLevel(state); out.push({ kind: 'mine', ok: have >= L.mine, text: have ? 'Mining Station Lv ' + L.mine + ' (have ' + have + ')' : 'A Mining Station' + (L.mine > 1 ? ' at Lv ' + L.mine : ''), need: L.mine, have }); }
    return out;
  }
  function canStart(state) {
    const d = nextDepth(state);
    if (state.excavation) return { ok: false, reason: 'Already digging' };
    if (d > C().MAX_FLOORS) return { ok: false, reason: 'Bedrock reached' };
    const miss = requirements(state, d).filter(r => !r.ok);
    if (miss.length) return { ok: false, reason: layer(d).name + ' needs ' + miss.map(r => r.text).join(' and ') };
    if (!U().canAfford(state.resources, cost(state, d))) return { ok: false, reason: 'Not enough resources' };
    return { ok: true };
  }
  function start(state, now) {
    now = now || Date.now();
    const c = canStart(state); if (!c.ok) return c;
    const d = nextDepth(state);
    U().pay(state.resources, cost(state, d));
    state.excavation = { depth: d, work: 0, need: work(state, d), startedAt: now };
    return { ok: true };
  }
  /** Old saves stored a fixed end time: turn it into work done so far. */
  function upgradeOld(ex, now) {
    if (ex.need != null) return;
    const dur = Math.max(1, ex.duration || 1);
    ex.need = dur; ex.work = dur * U().clamp(1 - ((ex.endsAt || now) - now) / (dur * 1000), 0, 1);
  }
  function progress(state) { const ex = state.excavation; return ex && ex.need ? Math.min(1, ex.work / ex.need) : 0; }
  function remaining(state) { const ex = state.excavation; return ex ? Math.max(0, (ex.need - ex.work) / Math.max(0.01, speed(state))) : 0; }

  /* ---------- material ---------- */
  /** The rubble of a floor, worth a share of what digging it cost, in its layer's material. */
  function spoils(state, depth) {
    const L = layer(depth), c = cost(state, depth), R = DE.Data.RESOURCES; let value = 0;
    for (const r in c) value += c[r] * R[r].value;
    const out = {}; for (const r in L.spoils || {}) out[r] = Math.round(value * L.spoils[r] / R[r].value);
    return out;
  }
  /** Per-second material the crew cuts from the face while nothing is being dug. */
  function quarryRates(state, fx) {
    const out = {}; if (state.excavation) return out;
    fx = fx || DE.Effects.get(state); let sum = 0;
    for (const id in state.survivors) { const s = state.survivors[id]; if (s.assignment && s.assignment.kind === 'dig') sum += minerEff(state, s, fx); }
    if (!sum) return out;
    const L = faceLayer(state), w = L.spoils || { scrap: 1 }; let tot = 0; for (const r in w) tot += w[r];
    const value = sum * QUARRY * L.hardness * (1 + (fx.digSpeed || 0));
    for (const r in w) out[r] = value * (w[r] / tot) / DE.Data.RESOURCES[r].value;
    return out;
  }

  /* ---------- facilities and finds ---------- */
  /** Decide if a facility is uncovered on a new floor. */
  function rollFacility(state, depth) {
    const candidates = DE.Data.FACILITIES.filter(f => f.minDepth <= depth && !state.floors.some(fl => fl.facility === f.id));
    if (!candidates.length || depth < 3) return null;
    const sinceLast = state.flags.floorsSinceFacility || 0;
    const p = 0.3 + 0.2 * sinceLast; // pity timer
    if (!U().chance(p)) return null;
    return U().weightedPick(candidates);
  }
  /** Something turned up while digging: a supply cache, a survivor trapped in an old shelter, or
   * research notes. Bigger finds deeper down. */
  function rollFind(state, depth) {
    const scale = Math.pow(1.55, depth - 2), r = Math.random();
    const give = (loot) => { for (const k in loot) { state.resources[k] = Math.min(DE.Economy.storageCap(state, k), state.resources[k] + loot[k]); } return loot; };
    if (r < .45) return { kind: 'cache', text: 'An old supply cache in the rubble.', loot: give(depth >= 3 ? { scrap: Math.round(140 * scale), concrete: Math.round(30 * scale) } : { scrap: Math.round(160 * scale) }) };
    if (r < .62 && DE.Bunker.population(state) < DE.Bunker.housingCapacity(state)) { const sv = DE.Survivors.spawn(state); state.stats.recruited++; return { kind: 'survivor', text: sv.name + ' was trapped in a collapsed shelter — and is grateful.', name: sv.name, id: sv.id }; }
    if (r < .8) return { kind: 'notes', text: 'Water-stained research notes in a sealed tube.', loot: give({ research: Math.round(45 * scale) }) };
    return null;
  }

  function tick(state, now, dt) {
    const ex = state.excavation; if (!ex) return null;
    upgradeOld(ex, now);
    ex.work += (dt || 0) * speed(state);
    if (ex.work < ex.need) return null;
    state.excavation = null;
    const floor = DE.State.emptyFloor(ex.depth);
    state.floors.push(floor);
    state.stats.maxDepth = Math.max(state.stats.maxDepth, ex.depth);
    const fac = rollFacility(state, ex.depth);
    if (fac) {
      floor.facility = fac.id;
      DE.Bunker.placeRoom(state, fac.room, ex.depth, floor.slots.length - DE.Data.ROOMS[fac.room].size, 1, now);
      state.flags.floorsSinceFacility = 0;
    } else state.flags.floorsSinceFacility = (state.flags.floorsSinceFacility || 0) + 1;
    // the rubble: the layer's material, worth a share of what the dig cost
    const sp = spoils(state, ex.depth);
    for (const r in sp) { const n = Math.min(sp[r], Math.max(0, DE.Economy.storageCap(state, r) - state.resources[r])); state.resources[r] += n; state.stats.produced[r] += n; sp[r] = Math.round(n); }
    // the crew learns from every floor
    miners(state).forEach(s => { s.xp += 30 * ex.depth * DE.Effects.get(state).xpMult; });
    const find = rollFind(state, ex.depth);
    state._fx = null;
    state._dirtyBunker = true;
    return { depth: ex.depth, facility: fac, find, spoils: sp, layer: layer(ex.depth).name };
  }

  return { nextDepth, maxDepth, layer, faceLayer, mineLevel, cost, work, time, miners, minerCap, minerEff, minerSkill, speed, requirements, canStart, start, progress, remaining, spoils, quarryRates, tick, upgradeOld };
})();
