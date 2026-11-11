/* Actors: one rigged survivor per person in the bunker, living in an overlay above the floors.
 * The simulation (DE.Needs) decides what each survivor is doing and in which room; this module
 * turns that into movement: walk along the floor to the elevator, ride to the right floor, walk
 * to a station in the room, then play the activity animation. Positions are read from the DOM so
 * rooms can be any size. Guards and survivors on expeditions are shown on the surface instead. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Actors = (function () {
  const esc = (s) => DE.Util.escapeHtml(s);
  const actors = {};                 // survivorId → actor
  const WALK = 60, RIDE = 110;       // px per second
  const SHAFT_X = 40;                // elevator column centre within a floor
  let last = 0, layer = null;

  function ensureLayer() {
    const floors = document.getElementById('floors'), bunker = document.getElementById('bunker'); if (!floors || !bunker) return null;
    if (!layer || layer.parentElement !== bunker) { layer = document.getElementById('actors'); if (!layer) { layer = document.createElement('div'); layer.id = 'actors'; } bunker.appendChild(layer); }
    // the layer is a sibling of #floors (so room re-renders never destroy actors) laid exactly over it
    const t = floors.offsetTop + 'px', h = floors.offsetHeight + 'px';
    if (layer.style.top !== t) layer.style.top = t; if (layer.style.height !== h) layer.style.height = h;
    return layer;
  }

  /** Where a survivor should be right now: {room, kind, x, y, anim}. */
  function target(state, sv) {
    const a = sv.act || { kind: 'idle' };
    const kind = a.kind;
    let roomId = a.room;
    const anim = { work: 'work', build: 'repair', sleep: 'sleep', eat: 'eat', rest: 'interact', heal: 'heal', idle: 'idle' }[kind] || 'idle';
    const stationKind = kind === 'build' ? 'work' : kind === 'heal' ? 'heal' : kind;
    if (roomId && state.rooms[roomId]) {
      const room = state.rooms[roomId], def = DE.Data.ROOMS[room.type];
      let list = DE.Scenes.stations(def, stationKind);
      if (kind === 'heal' && (!list || !list.length)) list = DE.Scenes.stations(def, 'sleep');
      if (!list || !list.length) list = DE.Scenes.stations(def, 'rest') || DE.Scenes.stations(def, 'work');
      let idx;
      if (kind === 'work' || kind === 'build') idx = Math.max(0, room.workers.indexOf(sv.id));
      else idx = hash(sv.id) % list.length;
      const sx = list[idx % list.length] + (idx >= list.length ? 12 * Math.floor(idx / list.length) : 0);
      return { room: roomId, kind, anim: kind === 'work' ? roomAnim(def, room) : anim, sx, size: def.size };
    }
    // nowhere to go: hang around the elevator on the top floor
    return { room: null, kind, anim: kind === 'sleep' ? 'sleep' : 'idle', floor: 1, sx: null };
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
  function roomAnim(def, room) {
    if (room.construction) return 'repair';
    if (def.category === 'housing' || ['cafeteria', 'kitchen', 'medbay', 'infirmary', 'hospital', 'radio', 'comms', 'quarantine', 'bioeng', 'medresearch'].includes(def.id)) return 'interact';
    if (['storage', 'coldstorage', 'cache', 'garage', 'dronehangar', 'recycling'].includes(def.id)) return 'carry';
    if (['workshop', 'advworkshop', 'generator', 'refinery', 'geothermal', 'vehicleshop', 'reactor', 'fusion', 'autoplant', 'ammofactory', 'heavyweapons', 'concrete', 'water', 'purification', 'reservoir', 'aquifer', 'orevein'].includes(def.id)) return 'repair';
    if (def.category === 'defense') return 'shoot';
    return 'work';
  }

  /** Pixel position (within #floors) of a scene x in a room, and of the shaft on a floor. */
  function roomPoint(roomId, sx) {
    const el = document.getElementById('room-' + roomId); if (!el) return null;
    const base = layer.getBoundingClientRect(); const r = el.getBoundingClientRect();
    const size = (DE.Data.ROOMS[(DE.UI.state().rooms[roomId] || {}).type] || { size: 1 }).size;
    return { x: r.left - base.left + r.width * (sx / (100 * size)), y: r.bottom - base.top - 4, floor: +el.closest('.floor').dataset.depth };
  }
  function shaftPoint(depth) {
    const fl = document.querySelector(`.floor[data-depth="${depth}"]`); if (!fl || !layer) return null;
    const base = layer.getBoundingClientRect(); const r = fl.getBoundingClientRect();
    const cor = fl.querySelector('.corridor'); const cy = cor ? cor.getBoundingClientRect().bottom - base.top - 6 : r.bottom - base.top - 20;
    return { x: r.left - base.left + SHAFT_X, y: cy, floor: depth };
  }

  function make(sv) {
    const el = document.createElement('div'); el.className = 'actor';
    el.innerHTML = DE.Chars.crew(sv.profession, { anim: 'idle', h: 54, title: sv.name }) + `<span class="bubble"></span>`;
    el.dataset.sid = sv.id; el.dataset.action = 'selectSurvivor';
    layer.appendChild(el);
    const a = { id: sv.id, el, rig: el.querySelector('.rig'), bubble: el.querySelector('.bubble'), x: 0, y: 0, floor: 0, queue: [], segEnd: 0, key: '', placed: false, anim: 'idle', prof: sv.profession };
    actors[sv.id] = a; return a;
  }
  function setAnim(a, anim) {
    if (a.anim === anim) return; a.anim = anim;
    Array.from(a.rig.classList).forEach(c => { if (c.startsWith('a-')) a.rig.classList.remove(c); }); a.rig.classList.add('a-' + anim);
  }
  function moveTo(a, x, y, dur, flip) {
    a.el.style.transition = dur > 0 ? `transform ${dur}s linear` : 'none';
    a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    a.x = x; a.y = y;
    if (flip != null) a.rig.classList.toggle('flip', flip);
  }
  function bubble(a, text, cls) { a.bubble.textContent = text; a.bubble.className = 'bubble ' + (cls || '') + (text ? ' show' : ''); }

  /** Plan a path from the actor's position to a point (same floor: walk; other floor: walk→ride→walk). */
  function plan(a, dest) {
    a.queue = [];
    if (!a.placed) { a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0 }); return; }
    if (a.floor !== dest.floor) {
      const s1 = shaftPoint(a.floor), s2 = shaftPoint(dest.floor); if (!s1 || !s2) { a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0 }); return; }
      a.queue.push({ x: s1.x, y: s1.y, floor: a.floor, dur: Math.hypot(s1.x - a.x, s1.y - a.y) / WALK });
      a.queue.push({ x: s2.x, y: s2.y, floor: dest.floor, dur: Math.abs(s2.y - s1.y) / RIDE, ride: true, from: a.floor, to: dest.floor });
      a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: Math.hypot(dest.x - s2.x, dest.y - s2.y) / WALK });
    } else a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: Math.abs(dest.x - a.x) / WALK });
  }

  function update(now) {
    const s = DE.UI.state(); if (!s || !ensureLayer()) return;
    if (now - last < 350) return; last = now;
    const wrap = document.getElementById('bunker-wrap'); const viewTop = wrap ? wrap.scrollTop - 150 : -1e9, viewBot = wrap ? wrap.scrollTop + wrap.clientHeight + 150 : 1e9;
    const seen = {};
    for (const id in s.survivors) {
      const sv = s.survivors[id]; const assign = sv.assignment;
      // guards and expedition members are shown on the surface
      if (assign && (assign.kind === 'expedition' || (assign.kind === 'guard' && sv.act && (sv.act.kind === 'guard' || sv.act.kind === 'idle')))) continue;
      seen[id] = true;
      let a = actors[id] || make(sv);
      if (a.prof !== sv.profession) { a.el.remove(); delete actors[id]; a = make(sv); }
      const t = target(s, sv);
      const key = (t.room || 'none') + ':' + t.kind + ':' + (t.sx | 0);
      if (key !== a.key) {
        a.key = key;
        const dest = t.room ? roomPoint(t.room, t.sx) : shaftPoint(t.floor || 1);
        if (dest) { if (t.room == null) dest.x += 40 + (hash(id) % 50); plan(a, dest); a.pendingAnim = t.anim; a.segEnd = 0; bubble(a, '', ''); }
      } else if (!a.queue.length && a.segEnd === 0 && a.placed) {
        // standing at a station whose room may have moved (re-render): snap if far off
        const dest = t.room ? roomPoint(t.room, t.sx) : null;
        if (dest && (Math.abs(dest.x - a.x) > 3 || Math.abs(dest.y - a.y) > 3)) moveTo(a, dest.x, dest.y, 0);
      }
      // advance the path
      if (a.queue.length && now >= a.segEnd) {
        const seg = a.queue.shift();
        const flip = seg.x < a.x - 1 ? true : seg.x > a.x + 1 ? false : null;
        a.el.classList.toggle('riding', !!seg.ride); if (seg.ride) DE.UI.Elevator.request(seg.from, seg.to);
        setAnim(a, seg.ride ? 'idle' : seg.dur > 0.05 ? 'walk' : (a.pendingAnim || 'idle'));
        moveTo(a, seg.x, seg.y, seg.dur, flip); a.floor = seg.floor; a.placed = true;
        a.segEnd = now + seg.dur * 1000;
        if (!a.queue.length) a.arriveAt = a.segEnd;
      } else if (!a.queue.length && a.segEnd && now >= a.segEnd) {
        a.segEnd = 0; a.el.classList.remove('riding');
        setAnim(a, a.pendingAnim || 'idle');
        if (t.kind === 'sleep') bubble(a, 'z z z', 'zz'); else if (t.kind === 'eat') bubble(a, 'nom', 'eat'); else if (t.kind === 'heal') bubble(a, '+ resting', 'hurt'); else if (t.kind === 'rest') bubble(a, 'break', ''); else bubble(a, '', '');
        if (a.pendingAnim === 'sleep' || a.pendingAnim === 'heal') a.rig.classList.remove('flip');
      }
      a.el.classList.toggle('hurt', sv.hp < 50);
      a.el.classList.toggle('paused', a.y < viewTop || a.y > viewBot);
      a.el.title = sv.name + ' · ' + DE.Needs.describe(sv) + (sv.act && sv.act.room && s.rooms[sv.act.room] ? ' in ' + DE.Data.ROOMS[s.rooms[sv.act.room].type].name : '');
    }
    for (const id in actors) if (!seen[id]) { actors[id].el.remove(); delete actors[id]; }
  }

  /** Rooms were re-rendered: positions are stale, snap everyone to where they should be. */
  function relayout() { for (const id in actors) { actors[id].key = ''; actors[id].placed = false; } last = 0; }
  function reset() { for (const id in actors) actors[id].el.remove(); for (const id in actors) delete actors[id]; }

  return { update, relayout, reset, target };
})();
