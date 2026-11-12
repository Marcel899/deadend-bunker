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
  const WALK = 34, RIDE = 110;       // px per second (walking pace matches the stride of a 54px survivor)
  const SHAFT_X = 40;                // elevator column centre within a floor
  const WORK_LIFT = 9;               // workers stand this much higher at their station than on the floor
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
    if (kind === 'mine') return mineTarget(state, sv);
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
      let idx, spread = 0;
      if (kind === 'work' || kind === 'build') idx = Math.max(0, room.workers.indexOf(sv.id));
      else {
        // people taking a break or eating gather around a station, not on the same spot
        const mates = Object.values(state.survivors).filter(o => o.act && o.act.kind === kind && o.act.room === roomId).map(o => o.id).sort();
        const k = Math.max(0, mates.indexOf(sv.id)); idx = (hash(sv.id) + Math.floor(k / 3)) % list.length;
        spread = [0, -16, 16][k % 3] + (k >= 3 ? 6 : 0);
      }
      const sx = list[idx % list.length] + spread + (idx >= list.length ? 12 * Math.floor(idx / list.length) : 0);
      return { room: roomId, kind, anim: kind === 'work' ? roomAnim(def, room, idx) : anim, sx, size: def.size };
    }
    // nowhere to go: hang around the elevator landing on the top floor (never sleeping on the floor)
    return { room: null, kind, anim: 'idle', floor: 1, sx: null };
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff; return h; }
  /** The mining crew: two of every three swing picks at the rock face; the rest haul the rubble to
   *  the mine cart by the lift and walk back (the first hauler pushes a wheelbarrow), turning round
   *  on a timer long enough for the walk plus a few seconds of loading. */
  function mineTarget(state, sv) {
    const L = DE.UI.DigSite.layout();
    const crew = Object.values(state.survivors).filter(o => o.act && o.act.kind === 'mine').map(o => o.id).sort();
    const i = Math.max(0, crew.indexOf(sv.id)), hauler = i % 3 === 2;
    if (!hauler) { const k = i - Math.floor((i + 1) / 3); return { site: true, kind: 'mine', anim: 'dig', sx: Math.max(70, L.faceX - 24 - 26 * (k % 4) - (k >= 4 ? 13 : 0)) }; }
    const k = Math.floor(i / 3), far = Math.max(L.cartX + 70, L.faceX - 44 - 10 * k), near = L.cartX + 36 + 8 * k, trip = (far - near) / WALK + 4.5;
    const back = Math.floor((Date.now() / 1000 + (hash(sv.id) % 9)) / trip) % 2 === 1;
    return { site: true, kind: 'mine', anim: 'work', sx: back ? near : far, walk: k === 0 ? 'push' : back ? 'haul' : 'walk' };
  }
  /** Where a survivor stands at the dig site (scene x in site px, on the tunnel floor). */
  function sitePoint(sx) {
    const el = document.getElementById('dig-site'); if (!el || !layer) return null;
    const fl = el.closest('.floor'), base = layer.getBoundingClientRect(), r = el.getBoundingClientRect();
    const cor = fl && fl.querySelector('.corridor'), y = cor ? cor.getBoundingClientRect().bottom - base.top - 6 : r.bottom - base.top - 22;
    return { x: r.left - base.left + sx, y, floor: fl ? +fl.dataset.depth : 0 };
  }
  /* the jobs a room's workers do; several entries are handed out by station, so a crew does not move
     in lockstep (one at the console, one with the hammer) */
  const ROOM_ANIM = {
    farm: ['farm'], greenhouse: ['farm'], hydroponics: ['farm', 'work'], mushroom: ['farm', 'carry'],
    lab: ['study', 'operate'], medresearch: ['study'], chemlab: ['study', 'work'], museum: ['study', 'interact'],
    radio: ['operate'], comms: ['operate'], signal: ['operate'], security: ['operate'],
    generator: ['repair', 'operate'], water: ['operate', 'repair'], purification: ['operate', 'repair'], reservoir: ['operate', 'carry'], aquifer: ['operate', 'repair'],
    condenser: ['operate'], geothermal: ['operate', 'repair'], reactor: ['operate'], fusion: ['operate'], solar: ['operate', 'repair'],
    workshop: ['repair', 'work'], advworkshop: ['repair', 'operate'], smelter: ['repair', 'operate'],
    kitchen: ['cook'], cafeteria: ['cook', 'interact'],
  };
  function roomAnim(def, room, idx) {
    if (room.construction) return 'repair';
    const list = ROOM_ANIM[def.id]; if (list) return list[(idx || 0) % list.length];
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
    el.innerHTML = DE.Chars.crew(sv.profession, { anim: 'idle', h: 54, title: sv.name, phase: (hash(sv.id) % 900) / 100 }) + `<span class="bubble"></span>`;
    el.dataset.sid = sv.id; el.dataset.action = 'selectSurvivor';
    layer.appendChild(el);
    const a = { id: sv.id, el, rig: el.querySelector('.rig'), bubble: el.querySelector('.bubble'), x: 0, y: 0, floor: 0, queue: [], segEnd: 0, key: '', placed: false, anim: 'idle', prof: sv.profession };
    actors[sv.id] = a; return a;
  }
  function setAnim(a, anim) {
    DE.UI.Anim.speed(a.rig, anim === 'walk' || anim === 'haul' || anim === 'push' ? WALK : 0);
    if (a.anim === anim) return; a.anim = anim;
    Array.from(a.rig.classList).forEach(c => { if (c.startsWith('a-')) a.rig.classList.remove(c); }); a.rig.classList.add('a-' + anim);
  }
  function moveTo(a, x, y, dur, flip, ease) {
    a.el.style.transition = dur > 0 ? `transform ${dur}s ${ease || 'linear'}` : 'none';
    a.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    a.x = x; a.y = y;
    if (flip != null) a.rig.classList.toggle('flip', flip);
  }
  function bubble(a, text, cls) { a.bubble.textContent = text; a.bubble.className = 'bubble ' + (cls || '') + (text && !/\bquiet\b/.test(cls || '') ? ' show' : ''); }

  /* ---------- speech: short contextual lines (DE.Data.SPEECH) ----------
   * Needs first (hurt, starving, tired, thirsty when the water runs low), then the work or activity a
   * survivor just started, now and then some chatter; big moments (a horde coming, a fight won or
   * lost, the weather turning, a newcomer) get one speaker. Never more than two bubbles at once, a
   * gap between any two, a long cooldown per survivor and no line repeated within a few minutes. */
  const TALK = { last: 0, wave: -1, fight: -1, weather: '', ready: false, built: {} };
  const SAY_MS = 3000, GAP_MS = 4000, MAX_SAYING = 2;
  function sayingCount(now) { let n = 0; for (const id in actors) if (actors[id].sayUntil > now) n++; document.querySelectorAll('.room .builder .say.on').forEach(() => n++); return n; }
  /* Lines come out of a shuffled bag per topic: every line of a topic is said once before any comes
   * round again, and the bags are kept in this browser (localStorage), so a reload does not start
   * the same lines over. The bags hold the text itself, so lines added later join in on the next round. */
  const BAG_KEY = 'deadend_speech_v1'; let bags = null, bagSave = 0;
  function loadBags() { if (bags) return bags; try { bags = JSON.parse(localStorage.getItem(BAG_KEY) || '{}') || {}; } catch (e) { bags = {}; } if (typeof bags !== 'object') bags = {}; return bags; }
  function saveBags() { clearTimeout(bagSave); bagSave = setTimeout(() => { try { localStorage.setItem(BAG_KEY, JSON.stringify(bags)); } catch (e) { /* private mode: bags live for this session */ } }, 600); }
  function pickLine(topic) {
    const list = (DE.Data.SPEECH || {})[topic]; if (!list || !list.length) return null;
    const B = loadBags(), lastKey = '_' + topic;
    let bag = Array.isArray(B[topic]) ? B[topic].filter(l => list.includes(l)) : [];
    if (!bag.length) {
      bag = list.slice(); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
      if (bag.length > 1 && bag[0] === B[lastKey]) bag.push(bag.shift());   // never the same line twice in a row across rounds
    }
    const line = bag.shift(); B[topic] = bag; B[lastKey] = line; saveBags(); return line;
  }
  function canTalk(now) { return now - TALK.last >= GAP_MS && sayingCount(now) < MAX_SAYING; }
  function sayEl(host) { let e = host.querySelector(':scope > .say'); if (!e) { e = document.createElement('span'); e.className = 'say'; host.appendChild(e); } return e; }
  /** Pop the bubble in at full size (the untyped rest is laid out but invisible, so the bubble never
   *  jumps), then type the line left to right with a soft blip every other letter. */
  function typeLine(e, text, cls, pitch) {
    clearTimeout(e._typer);
    e.className = 'say ' + (cls || ''); e.innerHTML = '<span class="st"></span><span class="sr"></span>';
    const st = e.firstChild, sr = e.lastChild; st.textContent = ''; sr.textContent = text;
    void e.offsetWidth; e.classList.add('on');
    if (document.body.classList.contains('no-anim')) { st.textContent = text; sr.textContent = ''; return; }
    let i = 0;
    const audible = () => !DE.UI.ui.drawer && document.getElementById('modal-root').classList.contains('hidden') && !document.hidden;
    const step = () => {
      if (!e.isConnected) return;
      i++; st.textContent = text.slice(0, i); sr.textContent = text.slice(i);
      const ch = text[i - 1];
      if (i % 2 === 1 && /[a-z0-9]/i.test(ch) && audible()) DE.Audio.blip(pitch * (.94 + Math.random() * .12));
      if (i < text.length) e._typer = setTimeout(step, /[.,!?]/.test(ch) ? 110 : 34);
    };
    e._typer = setTimeout(step, 160);   // once the bubble has popped in
  }
  function sayText(a, text, cls, now) {
    const e = a.sayEl || (a.sayEl = sayEl(a.el));
    typeLine(e, text, cls, 300 + (hash(a.id) % 9) * 26);
    a.el.classList.add('saying'); a.sayUntil = now + SAY_MS + text.length * 40;
    TALK.last = now; return true;
  }
  function say(a, topic, cls, now) { const text = pickLine(topic); return text ? sayText(a, text, cls, now) : false; }
  /** A two-person joke: this survivor asks, someone standing close by answers once the question is out. */
  function joke(a, now) {
    const near = Object.values(actors).filter(o => o !== a && o.placed && o.floor === a.floor && Math.abs(o.x - a.x) < 170 && !(o.sayUntil > now) && o.anim !== 'sleep'
      && !o.el.classList.contains('riding') && !o.el.classList.contains('paused'));
    if (!near.length) return say(a, 'chat', '', now);
    const pair = pickLine('jokes'); if (!pair) return false;
    const [q, ans] = pair.split('|'), b = near[Math.floor(Math.random() * near.length)];
    sayText(a, q, '', now);
    const delay = 160 + q.length * 34 + 1000;
    a.sayUntil = now + delay + 600; b.nextSay = Math.max(b.nextSay || 0, now + delay + 30000);
    setTimeout(() => { if (b.el.isConnected && b.placed && !b.el.classList.contains('riding')) sayText(b, ans, 'good', Date.now()); }, delay);
    return true;
  }
  function hush(a, now) { if (a.sayUntil && now >= a.sayUntil) { a.sayUntil = 0; if (a.sayEl) a.sayEl.classList.remove('on'); a.el.classList.remove('saying'); } }
  /** What this survivor has on their mind right now (null: nothing worth saying). */
  function topicFor(a, sv, s, now) {
    const act = sv.act || {}, k = act.kind, room = act.room && s.rooms[act.room];
    if (k === 'sleep' && a.segEnd === 0 && !a.queue.length) return null;           // asleep: z z z only
    if (sv.infection && sv.infection.known) {
      const st = DE.Infection.stage(sv);
      if (sv.infection.ward) return Math.random() < .15 ? { t: 'patient' } : null;
      if (st.id === 'turning') return { t: 'turning', cls: 'alarm', urgent: true };
      if (st.id !== 'incubating') return Math.random() < .6 ? { t: 'sick', cls: 'bad', urgent: true } : null;
    }
    if (sv.hp < 45 && k !== 'heal') return { t: 'hurt', cls: 'bad', urgent: true };
    if (sv.hunger > 84 && k !== 'eat') return { t: 'starving', cls: 'bad', urgent: true };
    const R = s._rates, waterLow = s.resources.water < 25 || (R && R.net && R.net.water < 0 && s.resources.water < 70);
    if (waterLow && Math.random() < .5) return { t: 'thirsty', cls: 'bad', urgent: true };
    if (sv.energy < 14 && k !== 'sleep') return { t: 'tired', cls: 'warn', urgent: true };
    if (room && R && R.perRoom && R.perRoom[room.id] && R.perRoom[room.id].power < .5 && Math.random() < .5) return { t: 'dark', cls: 'warn' };
    if (a.lift && a.lift.ticket.state === 'wait') return Math.random() < .25 ? { t: 'lift' } : null;
    if (room && room.construction && k === 'work') {
      const c = room.construction, p = 1 - (c.endsAt - now) / Math.max(1, c.duration * 1000);
      return p > .8 ? { t: 'almost', cls: 'good' } : Math.random() < .35 ? { t: 'build' } : null;
    }
    if (a.planned === 'sleep' && now - a.plannedAt < 4000) return Math.random() < .3 ? { t: 'sleep' } : null;
    const moving = a.queue.length > 0 || a.segEnd !== 0;
    const fresh = !moving && a.arriveAt && now >= a.arriveAt && now - a.arriveAt < 7000;
    if (Math.random() > (fresh ? .45 : .12)) return null;
    // banter (on the way or at ease): quips, nods to old zombie stories, a joke for whoever is nearby
    const banter = moving ? .65 : k === 'rest' || k === 'eat' || k === 'idle' ? .5 : k === 'work' || k === 'mine' ? .18 : 0;
    if (Math.random() < banter) return Math.random() < .4 ? { t: 'joke' } : { t: 'chat' };
    if (moving) return null;   // the job itself is talked about once there, not on the way through other rooms
    if (k === 'work') return { t: room && DE.Data.SPEECH[room.type] ? room.type : 'work', cls: room && /farm|hydroponics|greenhouse|mushroom|kitchen/.test(room.type) ? 'good' : '' };
    if (k === 'mine') return { t: 'mine' };
    if (k === 'eat') return { t: 'eat', cls: 'good' };
    if (k === 'rest') return { t: 'rest' };
    if (k === 'heal') return { t: 'heal' };
    if (k === 'idle') return { t: 'idle' };
    if (sv.hunger > 66) return { t: 'hungry' };
    if (s.resources.food < 50) return { t: 'foodlow', cls: 'warn' };
    return null;
  }
  /** A visible, awake survivor to speak for everyone (big moments). */
  function speaker(now) {
    const list = Object.values(actors).filter(a => a.placed && !a.el.classList.contains('paused') && !(a.sayUntil > now) && a.anim !== 'sleep');
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }
  function moments(s, now) {
    const surf = document.getElementById('surface'); if (!surf || !canTalk(now)) return;
    const wave = s.defense.wave;
    if (surf.classList.contains('incoming') && TALK.wave !== wave) { const a = speaker(now); if (a && say(a, 'wave', 'alarm', now)) TALK.wave = wave; return; }
    const won = surf.classList.contains('won'), lost = surf.classList.contains('breached');
    if ((won || lost) && TALK.fight !== wave) { const a = speaker(now); if (a && say(a, lost ? 'breach' : 'won', lost ? 'bad' : 'good', now)) TALK.fight = wave; return; }
    const w = DE.Season ? DE.Season.clock(s).weather : '';
    if (w !== TALK.weather) { const prev = TALK.weather; TALK.weather = w; if (prev && (w === 'rain' || w === 'snow') && Math.random() < .6) { const a = speaker(now); if (a) say(a, w, '', now); } return; }
    // the builder on a site that is nearly done
    for (const id in s.rooms) {
      const r = s.rooms[id], c = r.construction; if (!c || TALK.built[id + ':' + c.endsAt]) continue;
      const p = 1 - (c.endsAt - now) / Math.max(1, c.duration * 1000); if (p < .82 || c.duration < 8) continue;
      const el = document.getElementById('room-' + id); if (!el || el.classList.contains('offscreen')) continue;
      const b = el.querySelector('.builder'); if (!b) continue;
      TALK.built[id + ':' + c.endsAt] = true;
      const text = pickLine('almost'); if (!text) return;
      const e = sayEl(b); typeLine(e, text, 'good', 250);
      TALK.last = now; setTimeout(() => e.classList.remove('on'), SAY_MS + 400 + text.length * 40); return;
    }
  }
  function talk(a, sv, s, now) {
    hush(a, now);
    if (DE.UI.Settings && !DE.UI.Settings.get('speech')) { if (a.sayUntil) { a.sayUntil = now; hush(a, now); } return; }
    if (!TALK.ready || a.sayUntil > now || now < (a.nextSay || 0) || !a.placed || a.el.classList.contains('paused') || a.el.classList.contains('riding')) return;
    if (a.isNew) { a.isNew = false; if (canTalk(now) && say(a, 'newbie', 'good', now)) { a.nextSay = now + 60000; return; } }
    if (!canTalk(now)) return;
    const tp = topicFor(a, sv, s, now);
    if (!tp) { a.nextSay = now + 3000 + Math.random() * 5000; return; }
    if (tp.t === 'joke' ? joke(a, now) : say(a, tp.t, tp.cls, now)) a.nextSay = now + (tp.urgent ? 40000 : 55000) + Math.random() * 45000;
    else a.nextSay = now + 8000;
  }

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
    } else queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: Math.abs(dest.x - ax) / WALK, walk: a.walkAnim });
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
      let a = actors[id]; if (!a) { a = make(sv); a.isNew = TALK.ready; }
      if (a.prof !== sv.profession) { a.el.remove(); delete actors[id]; a = make(sv); }
      const t = target(s, sv);
      const key = (t.room || 'none') + ':' + t.kind + ':' + (t.sx | 0) + (t.bed ? ':' + t.bed.y : '');
      // at a work station they stand a step up, at the machine (they step up when they arrive)
      const atWork = t.kind === 'work' && t.room && !t.bed && !t.site;
      const pointFor = () => { const q = t.site ? sitePoint(t.sx) : t.room ? (t.bed ? bedPoint(t.room, t.bed) : roomPoint(t.room, t.sx)) : shaftPoint(t.floor || 1); if (q && atWork) q.y -= WORK_LIFT; return q; };
      // mid-ride survivors finish the ride before re-planning; ones still waiting just leave the queue
      const riding = a.lift && a.lift.ticket.state !== 'wait';
      if (a.snap && !riding) {
        a.snap = false; const sp = shaftPoint(a.floor);
        if (sp) { moveTo(a, a.x, sp.y, 0); setAnim(a, 'idle'); a.queue = []; a.segEnd = 0; } else a.placed = false;
      }
      if (key !== a.key && !riding) {
        if (a.lift) { DE.UI.Elevator.cancel(a.lift.ticket); a.lift = null; }
        a.key = key; a.walkAnim = t.walk || null; a.planned = t.kind; a.plannedAt = now;
        const dest = pointFor();
        if (dest) {
          if (t.room == null && !t.site) dest.x += 40 + (hash(id) % 50);
          if (t.bed && a.placed) {
            // walk along the floor to the bed, then climb onto the berth
            const foot = roomPoint(t.room, t.bed.x); plan(a, foot || dest);
            if (foot) a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0.35, climb: true });
          } else if (atWork && a.placed) {
            // walk along the floor to the station, then the small step up to it
            plan(a, { x: dest.x, y: dest.y + WORK_LIFT, floor: dest.floor });
            a.queue.push({ x: dest.x, y: dest.y, floor: dest.floor, dur: 0.25, climb: true });
          } else plan(a, dest);
          a.pendingAnim = t.anim; a.segEnd = 0; bubble(a, '', '');
        }
      } else if (!a.queue.length && a.segEnd === 0 && a.placed) {
        // standing at a station whose room may have moved (re-render): snap if far off
        const dest = t.room || t.site ? pointFor() : null;
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
          // (positions come from the landing itself, so they stay right after a re-layout)
          ticket.onMove = (y, secs, depth) => { if (!a.lift) return; const sp = shaftPoint(depth); if (sp) moveTo(a, sp.x, sp.y, secs, null, 'ease-in-out'); };
          setAnim(a, 'idle'); a.segEnd = Infinity; continue;
        }
        const flip = seg.x < a.x - 1 ? true : seg.x > a.x + 1 ? false : null;
        if (seg.climb && seg.y < a.y) a.bedFloorY = a.y;
        a.el.classList.remove('riding');
        setAnim(a, seg.climb ? 'idle' : seg.dur > 0.05 ? (seg.walk || 'walk') : (a.pendingAnim || 'idle'));
        moveTo(a, seg.x, seg.y, seg.dur, flip); a.floor = seg.floor; a.placed = true;
        a.segEnd = now + seg.dur * 1000;
        if (!a.queue.length) a.arriveAt = a.segEnd;
      } else if (!a.queue.length && a.segEnd && now >= a.segEnd) {
        a.segEnd = 0;
        setAnim(a, a.pendingAnim || 'idle');
        // sleeping and recovering show a bubble; eating and breaks only on hover (no pile of labels)
        if (t.kind === 'sleep') bubble(a, 'z z z', 'zz'); else if (t.kind === 'eat') bubble(a, 'nom', 'eat quiet'); else if (t.kind === 'heal') bubble(a, '+ resting', 'hurt'); else if (t.kind === 'rest') bubble(a, 'break', 'quiet'); else bubble(a, '', '');
        if (a.pendingAnim === 'sleep' || a.pendingAnim === 'heal') a.rig.classList.remove('flip');
      }
      talk(a, sv, s, now);
      a.el.classList.toggle('hurt', sv.hp < 50);
      // symptoms show on the character: a sickly glow, worse with the stage, spores while still about
      const ist = sv.infection && sv.infection.known ? DE.Infection.stage(sv).id : '';
      if ((a.el.dataset.inf || '') !== ist) { a.el.dataset.inf = ist; a.el.classList.toggle('infected', !!ist); }
      a.el.classList.toggle('paused', a.y < viewTop || a.y > viewBot);
      a.el.title = sv.name + ' · ' + DE.Needs.describe(sv) + (sv.act && sv.act.room && s.rooms[sv.act.room] ? ' in ' + DE.Data.ROOMS[s.rooms[sv.act.room].type].name : '');
    }
    for (const id in actors) if (!seen[id]) { actors[id].el.remove(); delete actors[id]; }
    if (TALK.ready) { if (!DE.UI.Settings || DE.UI.Settings.get('speech')) moments(s, now); } else { TALK.ready = true; TALK.weather = DE.Season ? DE.Season.clock(s).weather : ''; const sf = document.getElementById('surface'); TALK.wave = sf && sf.classList.contains('incoming') ? s.defense.wave : -1; TALK.fight = s.defense.wave; TALK.last = now; }
  }

  /** Elevator ride, driven by the ticket the cabin updates: wait → walk in → ride → walk out. */
  function liftStep(a, now) {
    const L = a.lift, t = L.ticket;
    if (t.state === 'board' && !L.walkIn) {
      const sp = shaftPoint(t.from); if (!sp) return;
      L.walkIn = now + 600; setAnim(a, 'walk'); moveTo(a, sp.x, sp.y, 0.6, sp.x < a.x);
    } else if (t.state === 'board' && now >= L.walkIn) {
      t.boarded(); setAnim(a, 'idle'); a.el.classList.add('riding');
    } else if (t.state === 'aboard' && L.resync) {
      // the bunker was re-laid out while we stood in the cabin: stand where the cabin is now
      L.resync = false; const st = DE.UI.Elevator.status();
      if (st.state !== 'moving') { const sp = shaftPoint(st.floor); if (sp) moveTo(a, sp.x, sp.y, 0); }
    } else if (t.state === 'exit') {
      // doors open at the destination: we are at its landing now
      const sp = shaftPoint(t.to); if (sp) moveTo(a, sp.x, sp.y, 0);
      a.floor = t.to; a.el.classList.remove('riding'); a.lift = null; a.segEnd = 0;
      a.exitTicket = t; a.exitDoneAt = now + 700;
    }
  }

  /** Rooms were re-rendered: positions are stale, snap everyone to where they should be. */
  function relayout() {
    for (const id in actors) {
      const a = actors[id]; a.key = ''; a.bedFloorY = null;
      // riders already in (or stepping into) the cabin finish the ride; then they re-plan from the landing
      if (a.lift && a.lift.ticket.state !== 'wait') { a.queue = []; a.lift.resync = true; continue; }
      // everyone else stays on the floor they are on (no teleporting between floors): drop them onto
      // its corridor at the new layout and let them walk or ride from there
      if (a.placed) a.snap = true;
      if (a.lift) { DE.UI.Elevator.cancel(a.lift.ticket); a.lift = null; a.segEnd = 0; a.el.classList.remove('riding'); }
    }
    last = 0;
  }
  function reset() { for (const id in actors) actors[id].el.remove(); for (const id in actors) delete actors[id]; TALK.ready = false; TALK.built = {}; }

  /** For tests: where each actor is and what it is doing. */
  function debug() { const o = {}; for (const id in actors) { const a = actors[id]; o[id] = { floor: a.floor, x: Math.round(a.x), y: Math.round(a.y), q: a.queue.length, lift: a.lift ? a.lift.ticket.state : null, key: a.key, placed: a.placed, segEnd: a.segEnd, nextSay: a.nextSay || 0, paused: a.el.classList.contains('paused'), anim: a.anim }; } return o; }
  return { update, relayout, reset, target, debug };
})();
