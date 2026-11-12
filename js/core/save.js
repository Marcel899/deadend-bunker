/* Versioned LocalStorage saves, export/import and defensive validation.
 * Imported data is parsed as JSON only — never evaluated. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Save = (function () {
  const C = () => DE.CONFIG;
  const U = () => DE.Util;

  /* Migrations: key = version being upgraded FROM. Each returns the upgraded raw object. */
  const MIGRATIONS = {
    // 1 → 2: floors became cell grids (12 cells, rooms 2 or 4 cells wide instead of 6 slots of 1-2)
    1: (raw) => {
      const st = raw.state || {};
      if (Array.isArray(st.floors)) st.floors.forEach(f => { if (f && Array.isArray(f.slots) && f.slots.length <= 6) f.slots = new Array(12).fill(null); });
      if (st.rooms && typeof st.rooms === 'object') for (const id in st.rooms) {
        const r = st.rooms[id]; if (!r || typeof r !== 'object') continue;
        r.slot = (r.slot || 0) * 2; const def = DE.Data.ROOMS[r.type]; const size = def ? def.size : 2;
        const f = Array.isArray(st.floors) ? st.floors.find(x => x && x.depth === r.floor) : null;
        if (f) for (let k = 0; k < size; k++) if (r.slot + k < f.slots.length) f.slots[r.slot + k] = id;
      }
      raw.v = 2; return raw;
    },
  };

  function storage() {
    try { return globalThis.localStorage || null; } catch (e) { return null; }
  }

  function serialize(state) {
    const copy = Object.assign({}, state);
    // strip transient caches (keys starting with _)
    for (const k in copy) if (k[0] === '_') delete copy[k];
    return JSON.stringify({ v: C().SAVE_VERSION, t: Date.now(), state: copy });
  }

  function save(state) {
    const ls = storage(); if (!ls) return false;
    try { state.lastSave = Date.now(); ls.setItem(C().SAVE_KEY, serialize(state)); return true; }
    catch (e) { console.warn('Save failed', e); return false; }
  }

  function hasSave() { const ls = storage(); return !!(ls && ls.getItem(C().SAVE_KEY)); }

  function load() {
    const ls = storage(); if (!ls) return null;
    const raw = ls.getItem(C().SAVE_KEY); if (!raw) return null;
    const res = parse(raw);
    if (!res.ok) { console.warn('Save rejected:', res.error); return null; }
    return res.state;
  }

  function clear() { const ls = storage(); if (ls) ls.removeItem(C().SAVE_KEY); }

  /* ---- export / import ---- */
  function toBase64(str) {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
    return Buffer.from(str, 'utf8').toString('base64');
  }
  function fromBase64(b64) {
    if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  function exportString(state) { return 'DEU1:' + toBase64(serialize(state)); }

  function importString(str) {
    try {
      str = String(str || '').trim();
      if (!str) return { ok: false, error: 'Empty import string.' };
      let json;
      if (str.startsWith('DEU1:')) json = fromBase64(str.slice(5));
      else if (str[0] === '{') json = str;
      else json = fromBase64(str);
      return parse(json);
    } catch (e) { return { ok: false, error: 'Could not decode save: ' + e.message }; }
  }

  /** Parse + migrate + validate a JSON save string. */
  function parse(json) {
    let raw;
    try { raw = JSON.parse(json); } catch (e) { return { ok: false, error: 'Not valid JSON.' }; }
    if (!U().isObj(raw) || !U().isObj(raw.state)) return { ok: false, error: 'Unrecognised save format.' };
    let v = U().num(raw.v, 0);
    let guard = 0;
    while (v < C().SAVE_VERSION && guard++ < 50) {
      const m = MIGRATIONS[v];
      if (!m) break;
      raw = m(raw); v = U().num(raw.v, v + 1);
    }
    if (v > C().SAVE_VERSION) return { ok: false, error: 'Save is from a newer version (' + v + ').' };
    const state = sanitize(raw.state);
    if (!state) return { ok: false, error: 'Save data is corrupted.' };
    return { ok: true, state };
  }

  /* ---- Validation: rebuild a clean state from a blank template, copying only well-formed data ---- */
  function sanitize(src) {
    const now = Date.now();
    const s = DE.State.blank(now);
    const N = (v, d) => U().num(v, d);
    const NN = (v, d) => Math.max(0, N(v, d)); // non-negative
    try {
      s.createdAt = N(src.createdAt, now);
      s.lastTick = Math.min(now, N(src.lastTick, now));
      s.playtime = NN(src.playtime, 0);
      s.morale = U().clamp(N(src.morale, 60), 0, 100);
      // resources
      if (U().isObj(src.resources)) for (const r of DE.Data.RESOURCE_ORDER) s.resources[r] = NN(src.resources[r], 0);
      // floors
      if (Array.isArray(src.floors)) {
        src.floors.forEach((f, i) => {
          if (!U().isObj(f)) return;
          // floors from older versions were all dug 16 cells wide; newer ones remember their width
          const base = U().clamp(N(f.base, C().START_FLOOR_SLOTS), 4, C().MAX_COLS);
          const cols = U().clamp(Array.isArray(f.slots) ? f.slots.length : base, base, C().MAX_COLS);
          const floor = DE.State.emptyFloor(N(f.depth, i + 1), cols); floor.base = base;
          if (Array.isArray(f.slots)) for (let k = 0; k < cols; k++) floor.slots[k] = typeof f.slots[k] === 'string' ? f.slots[k] : null;
          if (U().isObj(f.expansion)) floor.expansion = { endsAt: N(f.expansion.endsAt, now), duration: NN(f.expansion.duration, 1), cells: C().WING_CELLS };
          floor.facility = typeof f.facility === 'string' && DE.Data.FACILITIES.some(x => x.id === f.facility) ? f.facility : null;
          s.floors.push(floor);
        });
      }
      if (!s.floors.length) s.floors.push(DE.State.emptyFloor(1));
      s.floors.sort((a, b) => a.depth - b.depth);
      // rooms
      if (U().isObj(src.rooms)) for (const id in src.rooms) {
        const r = src.rooms[id];
        if (!U().isObj(r) || !DE.Data.ROOMS[r.type]) continue;
        const room = { id, type: r.type, floor: N(r.floor, 1), slot: N(r.slot, 0), level: NN(r.level, 1),
          workers: Array.isArray(r.workers) ? r.workers.filter(x => typeof x === 'string') : [], construction: null };
        if (U().isObj(r.construction)) room.construction = { kind: r.construction.kind === 'upgrade' ? 'upgrade' : 'build',
          endsAt: N(r.construction.endsAt, now), duration: NN(r.construction.duration, 1), levels: Math.max(1, N(r.construction.levels, 1)) };
        s.rooms[id] = room;
      }
      // drop slot references to missing rooms, and rooms not referenced by any slot
      const referenced = {};
      s.floors.forEach(f => f.slots.forEach((rid, k) => { if (rid && !s.rooms[rid]) f.slots[k] = null; else if (rid) referenced[rid] = true; }));
      for (const id in s.rooms) if (!referenced[id]) delete s.rooms[id];
      // survivors
      if (U().isObj(src.survivors)) for (const id in src.survivors) {
        const v = src.survivors[id];
        if (!U().isObj(v) || !DE.Data.PROFESSIONS[v.profession]) continue;
        const sv = { id, name: typeof v.name === 'string' ? v.name.slice(0, 40) : 'Survivor', profession: v.profession,
          rarity: DE.Data.RARITIES[v.rarity] ? v.rarity : 'common',
          level: U().clamp(N(v.level, 1), 1, C().SURVIVOR_MAX_LEVEL), xp: NN(v.xp, 0), hp: U().clamp(N(v.hp, 100), 0, 100),
          traits: Array.isArray(v.traits) ? v.traits.filter(t => DE.Data.TRAITS[t]) : [], assignment: null,
          energy: U().clamp(N(v.energy, 100), 0, 100), hunger: U().clamp(N(v.hunger, 0), 0, 100),
          act: U().isObj(v.act) && typeof v.act.kind === 'string' ? { kind: v.act.kind.slice(0, 12), until: NN(v.act.until, 0), room: typeof v.act.room === 'string' ? v.act.room : null, ...(Number.isInteger(v.act.bed) && v.act.bed >= 0 ? { bed: v.act.bed } : {}) } : { kind: 'idle', until: 0, room: null }, bonds: {} };
        if (U().isObj(v.bonds)) for (const o in v.bonds) if (typeof o === 'string') sv.bonds[o] = U().clamp(N(v.bonds[o], 0), 0, 100);
        if (U().isObj(v.infection)) {
          const i = v.infection, p = U().isObj(i.prev) ? i.prev : null;
          sv.infection = { sev: U().clamp(N(i.sev, .05), 0, 1), known: !!i.known, ward: typeof i.ward === 'string' && s.rooms[i.ward] ? i.ward : null, since: NN(i.since, 0),
            prev: p && (p.kind === 'guard' || p.kind === 'dig' || (p.kind === 'room' && typeof p.id === 'string')) ? (p.kind === 'room' ? { kind: 'room', id: p.id } : { kind: p.kind }) : null };
        }
        if (Number.isFinite(+v.immuneUntil) && +v.immuneUntil > 0) sv.immuneUntil = +v.immuneUntil;
        if (U().isObj(v.assignment)) {
          const a = v.assignment;
          if (a.kind === 'room' && s.rooms[a.id]) sv.assignment = { kind: 'room', id: a.id };
          else if (a.kind === 'guard') sv.assignment = { kind: 'guard' };
          else if (a.kind === 'dig') sv.assignment = { kind: 'dig' };
          else if (a.kind === 'expedition' && typeof a.id === 'string') sv.assignment = { kind: 'expedition', id: a.id };
        }
        s.survivors[id] = sv;
      }
      // reconcile room worker lists with survivor assignments (survivor record is the truth)
      for (const id in s.rooms) s.rooms[id].workers = [];
      for (const id in s.survivors) {
        const a = s.survivors[id].assignment;
        if (a && a.kind === 'room') {
          const room = s.rooms[a.id]; const def = DE.Data.ROOMS[room.type];
          if (room.workers.length < def.workers) room.workers.push(id); else s.survivors[id].assignment = null;
        }
      }
      s.nextId = Math.max(1, N(src.nextId, 1));
      // research
      if (U().isObj(src.research)) {
        if (U().isObj(src.research.done)) for (const id in src.research.done) if (DE.Data.RESEARCH[id]) s.research.done[id] = true;
        const cur = src.research.current;
        if (U().isObj(cur) && DE.Data.RESEARCH[cur.id] && !s.research.done[cur.id])
          s.research.current = { id: cur.id, endsAt: N(cur.endsAt, now), duration: NN(cur.duration, 1) };
      }
      // excavation
      if (U().isObj(src.excavation)) {
        const e = src.excavation; const ex = { depth: s.floors.length + 1, startedAt: N(e.startedAt, now) };
        if (e.need != null) { ex.need = Math.max(1, N(e.need, 1)); ex.work = U().clamp(N(e.work, 0), 0, ex.need); }
        else { ex.endsAt = N(e.endsAt, now); ex.duration = NN(e.duration, 1); DE.Excavation.upgradeOld(ex, now); delete ex.endsAt; delete ex.duration; }
        s.excavation = ex;
      }
      // defense
      if (U().isObj(src.defense)) {
        const d = src.defense;
        if (U().isObj(d.wall)) { s.defense.wall.level = Math.max(1, N(d.wall.level, 1)); s.defense.wall.hp = NN(d.wall.hp, 0); }
        s.defense.turrets = NN(d.turrets, 0); s.defense.traps = NN(d.traps, 0);
        s.defense.turretLevel = Math.min(50, NN(d.turretLevel, 0)); s.defense.breachStreak = Math.min(20, NN(d.breachStreak, 0)); s.defense.winStreak = Math.min(1000, NN(d.winStreak, 0));
        s.defense.nextWaveAt = N(d.nextWaveAt, now + C().FIRST_WAVE_SEC * 1000);
        s.defense.wave = Math.max(1, N(d.wave, 1)); s.defense.shock = NN(d.shock, 0); s.defense.calmUntil = NN(d.calmUntil, 0);
        s.defense.waveMult = U().clamp(N(d.waveMult, 1), 0.3, 3);
        if (Array.isArray(d.log)) s.defense.log = d.log.filter(U().isObj).slice(-20);
        if (U().isObj(d.lastResult)) s.defense.lastResult = d.lastResult;
      }
      // expeditions
      if (U().isObj(src.expeditions)) {
        if (Array.isArray(src.expeditions.active)) src.expeditions.active.forEach(e => {
          if (!U().isObj(e) || !DE.Data.LOCATIONS.some(l => l.id === e.location)) return;
          const members = Array.isArray(e.survivors) ? e.survivors.filter(id => s.survivors[id]) : [];
          if (!members.length) return;
          const trip = { id: typeof e.id === 'string' ? e.id : 'x' + (s.nextId++), location: e.location, survivors: members, endsAt: N(e.endsAt, now), duration: NN(e.duration, 1) };
          trip.startedAt = N(e.startedAt, trip.endsAt - trip.duration * 1000);
          trip.stops = Array.isArray(e.stops) ? e.stops.filter(x => typeof x === 'number' && x > 0 && x < 1).slice(0, 3) : [];
          trip.stop = Math.min(trip.stops.length, NN(e.stop, 0)); trip.mult = Math.min(5, NN(e.mult, 1));
          trip.bonus = {}; if (U().isObj(e.bonus)) for (const r in e.bonus) if (DE.Data.RESOURCES[r]) trip.bonus[r] = NN(e.bonus[r], 0);
          trip.notes = Array.isArray(e.notes) ? e.notes.filter(x => typeof x === 'string').slice(0, 6) : [];
          trip.seen = Array.isArray(e.seen) ? e.seen.filter(x => typeof x === 'string').slice(0, 10) : [];
          trip.mats = {}; if (U().isObj(e.mats)) for (const m in e.mats) if (DE.Data.MATERIALS[m]) trip.mats[m] = Math.floor(NN(e.mats[m], 0));
          trip.explore = U().clamp(Math.floor(N(e.explore, 0)), 0, 5);
          s.expeditions.active.push(trip);
        });
        if (Array.isArray(src.expeditions.log)) s.expeditions.log = src.expeditions.log.filter(U().isObj).slice(-20);
      }
      // survivors on expeditions that no longer exist are freed
      const activeIds = {}; s.expeditions.active.forEach(e => activeIds[e.id] = true);
      for (const id in s.survivors) { const a = s.survivors[id].assignment; if (a && a.kind === 'expedition' && !activeIds[a.id]) s.survivors[id].assignment = null; }
      // prestige
      if (U().isObj(src.prestige)) {
        s.prestige.points = NN(src.prestige.points, 0); s.prestige.lifetime = NN(src.prestige.lifetime, 0); s.prestige.resets = NN(src.prestige.resets, 0);
        if (typeof src.prestige.relic === 'string' && DE.Data.ARTIFACTS[src.prestige.relic]) s.prestige.relic = src.prestige.relic;
        if (U().isObj(src.prestige.upgrades)) for (const id in src.prestige.upgrades) if (DE.Data.LEGACY[id]) s.prestige.upgrades[id] = U().clamp(N(src.prestige.upgrades[id], 0), 0, DE.Data.LEGACY[id].max);
      }
      // stats
      if (U().isObj(src.stats)) {
        for (const k of ['runScore', 'zombiesKilled', 'wavesSurvived', 'breaches', 'recruited', 'maxDepth', 'expeditions', 'roomsBuilt']) s.stats[k] = NN(src.stats[k], s.stats[k]);
        if (U().isObj(src.stats.produced)) for (const r of DE.Data.RESOURCE_ORDER) s.stats.produced[r] = NN(src.stats.produced[r], 0);
      }
      if (Array.isArray(src.log)) s.log = src.log.filter(x => U().isObj(x) && typeof x.msg === 'string').slice(-50);
      if (U().isObj(src.settings)) { s.settings.autosave = src.settings.autosave !== false; s.settings.animations = src.settings.animations !== false; }
      if (Array.isArray(src.events)) s.events = src.events.filter(e => U().isObj(e) && typeof e.title === 'string' && Array.isArray(e.choices)).slice(0, 6).map(e => ({ id: typeof e.id === 'string' ? e.id : 'e' + (s.nextId++), kind: e.kind === 'expedition' ? 'expedition' : 'bunker', def: String(e.def || ''), title: String(e.title).slice(0, 120), text: String(e.text || '').slice(0, 600), ctx: U().isObj(e.ctx) ? e.ctx : {}, choices: e.choices.filter(U().isObj).slice(0, 4).map(c => ({ label: String(c.label || 'OK').slice(0, 60), desc: String(c.desc || '').slice(0, 200), effects: U().isObj(c.effects) ? c.effects : {}, trade: U().isObj(c.trade) ? c.trade : undefined })) }));
      if (U().isObj(src.artifacts)) for (const id in src.artifacts) if (DE.Data.ARTIFACTS[id]) s.artifacts[id] = true;
      if (U().isObj(src.materials)) for (const m of DE.Data.MATERIAL_ORDER) s.materials[m] = Math.floor(NN(src.materials[m], 0));
      if (U().isObj(src.collection)) for (const id in src.collection) if (DE.Data.COLLECTIBLES[id]) s.collection[id] = true;
      if (U().isObj(src.blueprints)) for (const id in src.blueprints) if (DE.Data.ROOMS[id] && DE.Data.ROOMS[id].blueprint) s.blueprints[id] = true;
      if (U().isObj(src.explore)) for (const id in src.explore) if (DE.Data.LOCATIONS.some(l => l.id === id)) s.explore[id] = U().clamp(Math.floor(N(src.explore[id], 0)), 0, 5);
      if (U().isObj(src.rep)) for (const f in DE.Data.FACTIONS) s.rep[f] = U().clamp(N(src.rep[f], 0), -5, 5);
      if (U().isObj(src.bus)) s.bus.level = U().clamp(N(src.bus.level, 1), 1, DE.Data.BUS.length);
      if (U().isObj(src.goals) && U().isObj(src.goals.done)) for (const id in src.goals.done) if (DE.Data.GOALS.some(g => g.id === id)) s.goals.done[id] = true;
      if (Array.isArray(src.buffs)) s.buffs = src.buffs.filter(b => U().isObj(b) && (b.room === '*' || DE.Data.ROOMS[b.room])).map(b => ({ room: b.room, mult: U().clamp(N(b.mult, 0), -0.9, 2), until: NN(b.until, 0) }));
      if (Array.isArray(src.eventChains)) s.eventChains = src.eventChains.filter(c => U().isObj(c) && typeof c.def === 'string' && DE.Data.BUNKER_EVENTS.some(e => e.id === c.def)).slice(0, 8)
        .map(c => ({ def: c.def, at: NN(c.at, 0), ctx: U().isObj(c.ctx) ? { A: typeof c.ctx.A === 'string' ? c.ctx.A : undefined, B: typeof c.ctx.B === 'string' ? c.ctx.B : undefined, aId: typeof c.ctx.aId === 'string' ? c.ctx.aId : undefined, bId: typeof c.ctx.bId === 'string' ? c.ctx.bId : undefined, D: typeof c.ctx.D === 'string' ? c.ctx.D : undefined, R: typeof c.ctx.R === 'string' ? c.ctx.R : undefined, room: typeof c.ctx.room === 'string' && DE.Data.ROOMS[c.ctx.room] ? c.ctx.room : undefined } : {} }));
      s.nextEventAt = NN(src.nextEventAt, 0);
      if (U().isObj(src.defense) && typeof src.defense.nextMut === 'string' && DE.Data.MUTATIONS.some(m => m.id === src.defense.nextMut)) s.defense.nextMut = src.defense.nextMut;
      if (U().isObj(src.overworld) && DE.Data.OVERWORLD) for (const k in DE.Data.OVERWORLD) s.overworld[k] = U().clamp(N(src.overworld[k], 0), 0, DE.Data.OVERWORLD[k].levels.length - 1);
      if (U().isObj(src.flags)) for (const k in src.flags) if (typeof src.flags[k] === 'boolean' || typeof src.flags[k] === 'number') s.flags[k] = src.flags[k];
      return s;
    } catch (e) {
      console.warn('sanitize failed', e);
      return null;
    }
  }

  return { save, load, clear, hasSave, exportString, importString, parse, sanitize, serialize, MIGRATIONS };
})();
