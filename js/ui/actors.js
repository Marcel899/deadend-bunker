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
      // sleeping / treated survivors lie on the berth the simulation allocated to them
      if ((kind === 'sleep' || kind === 'heal') && a.bed != null) {
        const bed = DE.Data.bedsFor(room.type, room.level)[a.bed];
        if (bed) return { room: roomId, kind, anim: bed.upright ? 'idle' : kind === 'heal' ? 'sleep' : 'sleep', sx: bed.x, bed, size: def.size };
      }
      let list = DE.Scenes.stations(def, stationKind);
      if (kind === 'heal' && (!list || !list.length)) list = DE.Scenes.stations(def, 'sleep');
      if (!list || !list.length) list = DE.Scenes.stations(def, 'rest') || DE.Scenes.stations(def, 'work');
      let idx;
      if (kind === 'work' || kind === 'build') idx = Math.max(0, room.workers.indexOf(sv.id));
      else idx = hash(sv.id) % list.length;
      const sx = list[idx % list.length] + (idx >= list.length ? 12 * Math.floor(idx / list.length) : 0);
      return { room: roomId, kind, anim: kind === 'work' ? roomAnim(def, room) : anim, sx, size: def.size };
    }
    // nowhere to go: hang around the elevator landing on the top floor (never sleeping on the floor)
    return { room: null, kind, anim: 'idle', floor: 1, sx: null };
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
    return { x: r.left - base.left + r.width * (sx / (DE.Scenes.CELL * size)), y: r.bottom - base.top - 4, floor: +el.closest('.floor').dataset.depth };
  }
  /** Where a survivor lies on a berth: the mattress surface, shifted so the lying body (which
   * extends from the feet towards the head on the left) is centred on the bed. */
  function bedPoint(roomId, bed) {
    const el = document.getElementById('room-' + roomId); if (!el) return null;
    const base = layer.getBoundingClientRect(); const r = el.getBoundingClientRect();
    const size = (DE.Data.ROOMS[(DE.UI.state().rooms[roomId] || {}).type] || { size: 1 }).size;
    const kx = r.width / (DE.Scenes.CELL * size), ky = r.height / (180 + DE.Scenes.TOP);
    const lying = bed.upright ? 0 : 38;   // a lying figure extends left of its feet: centre it on the mattress
    return { x: r.left - base.left + (bed.x * kx) + lying, y: r.top - base.top + (DE.Scenes.TOP + DE.Scenes.FLOOR + bed.y) * ky, floor: +el.closest('.floor').dataset.depth };
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
  function moveTo(a, x, y, dur, flip, ease) {
    a.el.style.transition = dur > 0 ? `transform ${dur}s ${ease || 'linear'}` : 'none';
    a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    a.x = x; a.y = y;
    if (flip != null) a.rig.classList.toggle('flip', flip);
  }
  function bubble(a, text, cls) { a.bubble.textContent = text; a.bubble.className = 'bubble ' + (cls || '') + (text ? ' show' : ''); }

  /** Plan a path from the actor's position to a point (same floor: walk; other floor: walk→ride→walk). */
  function plan(a, dest) {
    a.queue = [];
    // getting out of bed first: step down to the floor under the berth
    if (a.placed && a.bedFloorY != null) { const fy = a.bedFloorY; a.bedFloorY = null; a.queue.push({ x: a.x, y: fy, floor: a.floor, dur: 0.3, climb: true }); const q = a.queue; plan2(a, dest, q, a.x, fy); return; }
    plan2(a, dest, a.queue, a.x, a.y);
  }
  function plan2(a, dest, queue, ax, ay) {
    if (!a.placed) { queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0 }); return; }
    if (a.floor !== dest.floor) {
      const s1 = shaftPoint(a.floor), s2 = shaftPoint(dest.floor); if (!s1 || !s2) { queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0 }); return; }
      // wait beside the landing doors, ride the cabin (see liftStep), then walk out to the destination
      const wx = s1.x + 50 + (hash(a.id) % 22);
      queue.push({ x: wx, y: s1.y, floor: a.floor, dur: Math.hypot(wx - ax, s1.y - ay) / WALK });
      queue.push({ lift: true, from: a.floor, to: dest.floor, x: s2.x, y: s2.y, floor: dest.floor });
      queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: Math.hypot(dest.x - s2.x, dest.y - s2.y) / WALK });
    } else queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: Math.abs(dest.x - ax) / WALK });
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
      const key = (t.room || 'none') + ':' + t.kind + ':' + (t.sx | 0) + (t.bed ? ':' + t.bed.y : '');
      const pointFor = () => t.room ? (t.bed ? bedPoint(t.room, t.bed) : roomPoint(t.room, t.sx)) : shaftPoint(t.floor || 1);
      // mid-ride survivors finish the ride before re-planning; ones still waiting just leave the queue
      const riding = a.lift && a.lift.ticket.state !== 'wait';
      if (key !== a.key && !riding) {
        if (a.lift) { DE.UI.Elevator.cancel(a.lift.ticket); a.lift = null; }
        a.key = key;
        const dest = pointFor();
        if (dest) {
          if (t.room == null) dest.x += 40 + (hash(id) % 50);
          if (t.bed && a.placed) {
            // walk along the floor to the bed, then climb onto the berth
            const foot = roomPoint(t.room, t.bed.x); plan(a, foot || dest);
            if (foot) a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0.35, climb: true });
          } else plan(a, dest);
          a.pendingAnim = t.anim; a.segEnd = 0; bubble(a, '', '');
        }
      } else if (!a.queue.length && a.segEnd === 0 && a.placed) {
        // standing at a station whose room may have moved (re-render): snap if far off
        const dest = t.room ? pointFor() : null;
        if (dest && (Math.abs(dest.x - a.x) > 3 || Math.abs(dest.y - a.y) > 3)) moveTo(a, dest.x, dest.y, 0);
      }
      if (a.lift) liftStep(a, now);
      if (a.exitTicket && now >= a.exitDoneAt) { a.exitTicket.state = 'done'; a.exitTicket = null; }
      // advance the path
      if (!a.lift && a.queue.length && now >= a.segEnd) {
        const seg = a.queue.shift();
        if (seg.lift) {
          // call the cabin and wait at the landing; liftStep() takes over until we step out
          const shaft = shaftPoint(seg.from);
          const ticket = DE.UI.Elevator.request(seg.from, seg.to);
          a.lift = { ticket, seg, shaftX: shaft ? shaft.x : a.x };
          // the cabin reports each departure (landing y in #floors space); ride along with it
          ticket.onMove = (y, secs) => { if (!a.lift) return; const dy = y - DE.UI.Elevator.floorY(ticket.from); moveTo(a, a.lift.shaftX, a.lift.y0 + dy, secs, null, 'ease-in-out'); };
          setAnim(a, 'idle'); a.segEnd = Infinity; continue;
        }
        const flip = seg.x < a.x - 1 ? true : seg.x > a.x + 1 ? false : null;
        if (seg.climb && seg.y < a.y) a.bedFloorY = a.y;
        a.el.classList.remove('riding');
        setAnim(a, seg.climb ? 'idle' : seg.dur > 0.05 ? 'walk' : (a.pendingAnim || 'idle'));
        moveTo(a, seg.x, seg.y, seg.dur, flip); a.floor = seg.floor; a.placed = true;
        a.segEnd = now + seg.dur * 1000;
        if (!a.queue.length) a.arriveAt = a.segEnd;
      } else if (!a.queue.length && a.segEnd && now >= a.segEnd) {
        a.segEnd = 0;
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

  /** Elevator ride, driven by the ticket the cabin updates: wait → walk in → ride → walk out. */
  function liftStep(a, now) {
    const L = a.lift, t = L.ticket;
    if (t.state === 'board' && !L.walkIn) {
      const sp = shaftPoint(t.from); if (!sp) return;
      L.walkIn = now + 600; setAnim(a, 'walk'); moveTo(a, sp.x, sp.y, 0.6, sp.x < a.x);
    } else if (t.state === 'board' && now >= L.walkIn) {
      L.y0 = a.y; t.boarded(); setAnim(a, 'idle'); a.el.classList.add('riding');
    } else if (t.state === 'exit') {
      // doors open at the destination: we are at its landing now
      const sp = shaftPoint(t.to); if (sp) moveTo(a, sp.x, sp.y, 0);
      a.floor = t.to; a.el.classList.remove('riding'); a.lift = null; a.segEnd = 0;
      a.exitTicket = t; a.exitDoneAt = now + 700;
    }
  }

  /** Rooms were re-rendered: positions are stale, snap everyone to where they should be. */
  function relayout() { for (const id in actors) { const a = actors[id]; a.key = ''; a.placed = false; a.bedFloorY = null; if (a.lift) { DE.UI.Elevator.cancel(a.lift.ticket); a.lift = null; a.segEnd = 0; a.el.classList.remove('riding'); } } last = 0; }
  function reset() { for (const id in actors) actors[id].el.remove(); for (const id in actors) delete actors[id]; }

  return { update, relayout, reset, target };
})();
