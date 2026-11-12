/* Bunker cutaway view: surface defenses, floors, rooms, dig zone. render() rebuilds structure,
 * update() refreshes the cheap dynamic bits every tick. */
var DE = globalThis.DE = globalThis.DE || {};

DE.UI.Bunker = (function () {
  const U = () => DE.Util;
  const esc = (s) => DE.Util.escapeHtml(s);
  const $ = (sel) => document.querySelector(sel);
  const Ic = () => DE.Icons;
  let fightUntil = 0;

  function render() {
    const s = DE.UI.state(); const root = document.getElementById('bunker');
    // the surface scene persists across re-renders so its animations (horde, party) keep running
    if (!root.querySelector('#surface')) { root.innerHTML = renderSurface(s) + '<div id="floors"></div>';  }
    let html = '';
    s.floors.forEach(f => html += renderFloor(s, f));
    html += renderDigZone(s);
    root.querySelector('#floors').innerHTML = html;
    tagsDirty = true; DE.UI.DigSite.relayout();
    DE.UI.Actors.relayout(); DE.UI.Elevator.relayout(); DE.UI.Geology.relayout();
    update();
  }

  function renderSurface() {
    return `<div class="surface" id="surface">
      <div class="scene" id="scene">
        ${DE.UI.Overworld.svg()}
        <div class="ow-overlay">
          <div class="hatch" data-action="selectNone" title="Bunker overview"></div>
          <div class="wall" id="wall" data-action="openDrawer" data-drawer="defense" title="Wall — open Defense">
            <div class="wall-label">WALL <b id="wall-lvl"></b></div>
            <div class="wall-hp"><i id="wall-hp"></i></div>
          </div>
          <div class="entrance-sign">DEAD END</div>
          <div class="wave-info" id="wave-info" data-action="openDrawer" data-drawer="defense"></div>
        </div>
      </div>
    </div>`;
  }

  /** Geological layer for a depth: topsoil → clay → stone → bedrock. */
  function strata(depth) { return 'strata-' + DE.Data.stratumAt(depth).id; }

  function renderFloor(s, f) {
    const cols = f.slots.length; let cells = '';
    for (let k = 0; k < cols; k++) {
      const rid = f.slots[k];
      if (!rid) { cells += `<div class="cell" data-action="selectSlot" data-depth="${f.depth}" data-slot="${k}" id="slot-${f.depth}-${k}" style="grid-column:${k + 1}" title="Empty cell — click to build"><span class="plus">+</span></div>`; continue; }
      const room = s.rooms[rid]; if (!room || room.slot !== k) continue;
      cells += renderRoom(room);
    }
    const fac = f.facility ? DE.Data.FACILITIES.find(x => x.id === f.facility) : null;
    const wing = cols < DE.CONFIG.MAX_COLS ? `<div class="wing ${f.expansion ? 'digging' : ''}" data-action="${f.expansion ? 'noop' : 'expandFloor'}" data-depth="${f.depth}" style="grid-column:${cols + 1}" id="wing-${f.depth}"><span class="wing-body"></span></div>` : '';
    return `<div class="floor ${fac ? 'has-facility' : ''} ${strata(f.depth)}" data-depth="${f.depth}" style="--cols:${cols}">
      <div class="shaft-slot"><div class="floor-num">B${f.depth}</div></div>
      <div class="cells" style="grid-template-columns: repeat(${cols + 1}, 100px)">
        <div class="ceiling"></div>${cells}${wing}
        <div class="corridor"><i class="stripe"></i></div>
      </div>
      ${fac ? `<div class="facility-tag" title="${esc(fac.lore)}">${Ic().img('facility', 'ico-inline')} ${esc(fac.name)}</div>` : ''}
    </div>`;
  }

  function renderRoom(room) {
    const def = DE.Data.ROOMS[room.type];
    return `<div class="room cat-${def.category} type-${room.type} ${def.unique ? 'unique' : ''} w-${def.size}" style="grid-column: ${room.slot + 1} / span ${def.size}"
        data-action="selectRoom" data-id="${room.id}" id="room-${room.id}" data-sig="">
      <div class="door"></div>
      <div class="room-scene"></div>
      <div class="builder">${DE.Chars.crew('engineer', { anim: 'repair', h: 48 })}</div>
      <div class="room-head"><span class="room-name">${esc(def.name)}</span><span class="room-lvl"></span><span class="room-flag"></span></div>
      <div class="room-foot"></div>
      <div class="room-progress"><i></i><span></span></div>
    </div>`;
  }

  function renderDigZone(s) {
    const d = DE.Excavation.nextDepth(s);
    if (d > DE.CONFIG.MAX_FLOORS) return `<div class="floor bedrock strata-bedrock"><div class="shaft-slot"></div><div class="bedrock-label">Bedrock. Nothing further down.</div></div>`;
    // the dig site below the deepest floor: the lift reaches it, so miners ride down to work
    const cols = DE.CONFIG.FLOOR_SLOTS;
    return `<div class="floor dig ${strata(d)}" data-depth="${d}" id="dig-floor">
      <div class="shaft-slot"><div class="floor-num">B${d}</div></div>
      <div class="cells dig-cells" style="grid-template-columns: repeat(${cols}, 100px)"><div class="dig-row" style="grid-column: 1 / span ${cols}"></div>
        <div class="dig-site" id="dig-site" data-action="openDrawer" data-drawer="excavate" style="width:${cols * 100}px" title="Dig site — open Excavation"><div class="dig-art" id="dig-art"></div><div class="dig-hud" id="dig-zone"></div></div>
        <div class="corridor dig-ground"></div>
      </div>
    </div>`;
  }

  /* ---------- room output badges ----------
     They live in their own layer above the walking survivors (#actors), so someone working at a
     station never hides what the room makes. Positions are read from the rooms after a rebuild. */
  let tagLayer = null, tagsDirty = true, tagTop = '';
  const tags = {};
  function tagFor(id) {
    const bunker = document.getElementById('bunker'); if (!bunker) return null;
    if (!tagLayer || tagLayer.parentElement !== bunker) {
      tagLayer = document.getElementById('room-tags') || document.createElement('div'); tagLayer.id = 'room-tags'; bunker.appendChild(tagLayer);
      tagLayer.innerHTML = ''; for (const k in tags) delete tags[k];
    }
    let t = tags[id];
    if (!t) { t = tags[id] = document.createElement('div'); t.className = 'room-rate rtag'; tagLayer.appendChild(t); tagsDirty = true; }
    return t;
  }
  function placeTags() {
    const floors = document.getElementById('floors'); if (!tagLayer || !floors) return;
    const top = floors.offsetTop + 'px'; if (top !== tagTop) { tagTop = top; tagLayer.style.top = top; }
    if (!tagsDirty) return; tagsDirty = false;
    const base = floors.getBoundingClientRect();
    for (const id in tags) {
      const el = document.getElementById('room-' + id), t = tags[id];
      if (!el) { t.remove(); delete tags[id]; continue; }
      const r = el.getBoundingClientRect();
      t.style.left = Math.round(r.left - base.left + 14) + 'px'; t.style.top = Math.round(r.bottom - base.top - 5) + 'px';
    }
  }

  /* ---------- per-tick ---------- */
  function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
  function setHtml(el, html) { if (el && el.innerHTML !== html) el.innerHTML = html; }

  function update() {
    const s = DE.UI.state(); if (!s) return;
    const rates = s._rates; const now = Date.now(); const sel = DE.UI.ui.selection;
    for (const id in s.rooms) {
      const room = s.rooms[id]; const el = document.getElementById('room-' + id); if (!el) continue;
      const def = DE.Data.ROOMS[room.type];
      const c = room.construction; const info = rates && rates.perRoom[id];
      // scene art: re-rendered only when its level tier or construction state changes
      const sig = room.type + ':' + DE.Scenes.tierOf(room.level) + ':' + (c ? 1 : 0);
      if (el.dataset.sig !== sig) { el.dataset.sig = sig; el.querySelector('.room-scene').innerHTML = DE.Scenes.render(room, def, s); observe(el); }
      setText(el.querySelector('.room-lvl'), room.level > 0 ? 'Lv ' + room.level : '');
      let rate = '', flag = '';
      if (room.level > 0 && info) {
        const parts = [];
        for (const r in info.produces) parts.push('+' + U().fmt(info.produces[r], info.produces[r] < 10 ? 2 : undefined) + Ic().res(r, 'ico-inline'));
        rate = parts.join(' ');
        if (!rate && def.effects) {
          if (def.effects.housing) rate = Ic().img('housing', 'ico-inline') + ' ' + (def.effects.housing + (room.type === 'quarters' ? s._fx.housingPerLevel : 0)) * room.level;
          else if (def.effects.storage) rate = '+' + U().fmt(def.effects.storage * room.level) + ' storage';
          else if (def.effects.morale) rate = '+' + def.effects.morale * room.level + ' morale';
          else if (def.effects.guardDmg) rate = '+' + Math.round(def.effects.guardDmg * room.level * 100) + '% guard dmg';
          else if (def.effects.xp) rate = '+' + Math.round(def.effects.xp * room.level * 100) + '% XP';
          else if (def.effects.expeditionSlots) rate = def.effects.expeditionSlots * room.level + ' team' + (room.level > 1 ? 's' : '');
        }
        if (info.power < 1) flag = 'BROWNOUT';
        else if (info.starve < 1) flag = 'NO INPUT';
        else if (def.workers > 0 && room.workers.length === 0) flag = 'UNSTAFFED';
      }
      // counter box: a label tab above a UI-sheet slot holding the value
      const label = room.level > 0 && info && Object.keys(info.produces || {}).length ? 'Makes /s' : def.effects && def.effects.housing ? 'Housing' : def.effects && def.effects.storage ? 'Storage' : 'Bonus';
      setHtml(tagFor(id), rate ? `<span class="rc-label">${label}</span><span class="rc-box">${rate}</span>` : '');
      setText(el.querySelector('.room-flag'), flag);
      const prog = el.querySelector('.room-progress');
      if (c) {
        const pct = Math.min(100, 100 * (1 - (c.endsAt - now) / (c.duration * 1000)));
        prog.querySelector('i').style.width = pct + '%';
        setText(prog.querySelector('span'), (c.kind === 'build' ? 'Building ' : 'Upgrading +' + c.levels + ' ') + U().fmtTime((c.endsAt - now) / 1000));
      }
      el.classList.toggle('building', !!c && c.kind === 'build');
      el.classList.toggle('upgrading', !!c && c.kind === 'upgrade');
      el.classList.toggle('unstaffed', room.level > 0 && def.workers > 0 && room.workers.length === 0);
      el.classList.toggle('brownout', !!(info && info.power < 1));
      if (info && info.power < 1) { const v = Math.max(0, info.power).toFixed(2); if (el.style.getPropertyValue('--pw') !== v) el.style.setProperty('--pw', v); }
      el.classList.toggle('selected', !!(sel && sel.type === 'room' && sel.id === id));
      const tier = room.level >= 50 ? 4 : room.level >= 25 ? 3 : room.level >= 10 ? 2 : 1;
      if (!el.classList.contains('tier-' + tier)) { el.classList.remove('tier-1', 'tier-2', 'tier-3', 'tier-4'); el.classList.add('tier-' + tier); }
    }
    placeTags();
    document.querySelectorAll('.cell').forEach(el => el.classList.toggle('selected', !!(sel && sel.type === 'slot' && String(sel.depth) === el.dataset.depth && String(sel.slot) === el.dataset.slot)));
    updateSurface(s, now);
    updateDig(s, now);
    updateWings(s, now);
    DE.UI.Geology.render();
    DE.UI.Elevator.update(now);
    DE.UI.Actors.update(now);
  }
  function updateWings(s, now) {
    s.floors.forEach(f => {
      const el = document.getElementById('wing-' + f.depth); if (!el) return;
      const body = el.querySelector('.wing-body');
      if (f.expansion) {
        const pct = Math.min(100, 100 * (1 - (f.expansion.endsAt - now) / (f.expansion.duration * 1000)));
        if (!el.querySelector('.wing-mine')) el.insertAdjacentHTML('afterbegin', DE.UI.DigSite.wingScene(f.depth));
        setHtml(body, `<b>Digging…</b><div class="dig-prog"><i style="width:${pct}%"></i></div><small>${U().fmtTime((f.expansion.endsAt - now) / 1000)}</small>`); el.classList.add('digging');
      }
      else { const old = el.querySelector('.wing-mine'); if (old) old.remove(); const ok = DE.Bunker.canExpand(s, f.depth).ok; setHtml(body, `${Ic().img('dig', 'ico-inline')}<b>Dig wing</b><small>+${DE.CONFIG.WING_CELLS} cells</small><span class="cost">${U().costText(DE.Bunker.expansionCost(s, f.depth))}</span><small>${U().fmtTime(DE.Bunker.expansionTime(s, f.depth))}</small>`); el.classList.toggle('cant', !ok); el.classList.remove('digging'); }
    });
  }

  /* Rooms that scroll out of view pause their animations. */
  let io = null;
  function observe(el) {
    if (typeof IntersectionObserver === 'undefined') return;
    if (!io) io = new IntersectionObserver(entries => entries.forEach(e => e.target.classList.toggle('offscreen', !e.isIntersecting)), { root: document.getElementById('bunker-wrap'), rootMargin: '120px' });
    io.observe(el);
  }

  function setAnim(rig, a) { Array.from(rig.classList).forEach(c => { if (c.startsWith('a-')) rig.classList.remove(c); }); rig.classList.add('a-' + a); }

  function updateSurface(s, now) {
    const d = s.defense; const maxHp = DE.Defense.wallMaxHp(s);
    setText($('#wall-lvl'), 'Lv ' + d.wall.level);
    const hpEl = $('#wall-hp'); if (hpEl) { hpEl.style.width = Math.max(0, 100 * d.wall.hp / maxHp) + '%'; hpEl.className = d.wall.hp / maxHp < 0.3 ? 'low' : ''; }
    const secs = (d.nextWaveAt - now) / 1000;
    const power = DE.Defense.defensePower(s); const hp = DE.Defense.waveHp(s);
    const verdict = power.total >= hp ? 'ok' : power.total >= hp * 0.6 ? 'warn' : 'danger';
    const info = $('#wave-info');
    if (info) {
      const say = verdict === 'ok' ? 'defense holds' : verdict === 'warn' ? 'the wall will take hits' : 'defense too weak!';
      setHtml(info, `${Ic().img('wave', 'ico-inline')} ${DE.Defense.isBossWave(d.wave) ? 'BOSS ' : ''}Wave ${d.wave} in <b>${U().fmtTime(secs)}</b> · <span class="wi-v">${say}</span>`);
      info.title = `Threat ${U().fmt(hp)} vs your ${U().fmt(power.total)} damage per fight — click to open Defense`;
      info.className = 'wave-info ' + verdict;
    }
    const surface = $('#surface'); if (!surface) return;
    const wrap = document.getElementById('bunker-wrap'); if (wrap) { const w = wrap.clientWidth + 'px'; if (surface.style.width !== w) surface.style.width = w; }
    // structure levels drive which overworld artwork is visible (css/overworld.css)
    const scene = $('#scene');
    if (scene) {
      const lv = Object.assign({}, s.overworld || {}, { walltier: d.wall.level >= 6 ? 2 : d.wall.level >= 3 ? 1 : 0 });
      for (const k in DE.Data.OVERWORLD) if (lv[k] == null) lv[k] = 0;
      for (const k in lv) { const v = String(lv[k] || 0); if (scene.dataset[k] !== v) scene.dataset[k] = v; }
    }
    const incoming = secs < DE.Defense.warningSec(s); const fighting = now < fightUntil;
    surface.classList.toggle('incoming', incoming && !fighting);
    surface.classList.toggle('fight', fighting);
    DE.UI.Battlefield.sync(s, { incoming, fighting });
    DE.UI.DayCycle.update(s);
  }

  /** Called when a wave resolves: the battlefield plays out the result (see battlefield.js). */
  function playWave(result) {
    fightUntil = Date.now() + 4200;
    DE.UI.Battlefield.fight(result);
    const surface = $('#surface'); if (surface) { surface.classList.add(result.breach ? 'breached' : 'won'); setTimeout(() => surface.classList.remove('breached', 'won'), 4200); }
  }


  /** Highlight a room after it is built or upgraded; with a label, a ribbon and a burst of stars. */
  function flashRoom(id, cls, label) {
    const el = document.getElementById('room-' + id); if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 1500);
    if (!label || !DE.UI.state().settings.animations) return;
    const b = document.createElement('div'); b.className = 'lvl-burst ' + cls;
    b.innerHTML = `<b>${label}</b>` + Array.from({ length: 10 }, (_, i) => `<i style="--a:${i * 36 + (Math.random() * 16 - 8)}deg;--d:${50 + Math.random() * 40}px;animation-delay:${(Math.random() * .12).toFixed(2)}s"></i>`).join('');
    el.appendChild(b); setTimeout(() => b.remove(), 1700);
  }
  /** Footprint preview on the grid (build menu hover): the cells a room of `size` would take. */
  function previewFootprint(depth, slot, size, ok) {
    clearFootprint();
    const cells = document.querySelector(`.floor[data-depth="${depth}"] .cells`); if (!cells) return;
    const el = document.createElement('div'); el.className = 'fp-preview ' + (ok ? 'ok' : 'bad');
    el.style.left = (slot * 100) + 'px'; el.style.width = (size * 100) + 'px';
    el.innerHTML = `<span>${ok ? '' : '✕ '}${size} cell${size > 1 ? 's' : ''}</span>`;
    cells.appendChild(el);
  }
  function clearFootprint() { document.querySelectorAll('.fp-preview').forEach(e => e.remove()); }
  function revealFloor(depth) {
    const el = document.querySelector(`.floor[data-depth="${depth}"]`); if (!el) return;
    el.classList.add('revealing'); setTimeout(() => el.classList.remove('revealing'), 1800);
    const wrap = document.getElementById('bunker-wrap'); if (wrap) { wrap.classList.add('rumble'); setTimeout(() => wrap.classList.remove('rumble'), 900); }
  }
  /** Floating resource gain near an element (expeditions, wave loot). */
  function collectAt(selector, items) {
    const el = document.querySelector(selector); if (!el) return;
    const r = el.getBoundingClientRect(); let i = 0;
    for (const k in items) { if (!items[k]) continue; setTimeout(() => DE.UI.floatText(r.left + r.width / 2 + (i % 2 ? 30 : -30), r.top + 10, '+' + U().fmt(items[k]), 'good', Ic().src('res.' + k)), i * 180); i++; }
  }

  function updateDig(s, now) { DE.UI.DigSite.update(s, now); }

  function scrollToFloor(depth) {
    const el = document.querySelector(`.floor[data-depth="${depth}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { render, update, playWave, scrollToFloor, flashRoom, previewFootprint, clearFootprint, revealFloor, collectAt };
})();
