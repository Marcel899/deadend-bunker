/* Bunker cutaway view: surface defenses, floors, rooms, dig zone. render() rebuilds structure,
 * update() refreshes the cheap dynamic bits every tick. */
var DE = globalThis.DE = globalThis.DE || {};

DE.UI.Bunker = (function () {
  const U = () => DE.Util;
  const esc = (s) => DE.Util.escapeHtml(s);
  const $ = (sel) => document.querySelector(sel);
  const Ic = () => DE.Icons;
  let hordeWave = -1, fightUntil = 0;

  function render() {
    const s = DE.UI.state(); const root = document.getElementById('bunker');
    // the surface scene persists across re-renders so its animations (horde, party) keep running
    if (!root.querySelector('#surface')) { root.innerHTML = renderSurface(s) + '<div id="floors"></div>'; hordeWave = -1; partySig = ''; }
    let html = '';
    s.floors.forEach(f => html += renderFloor(s, f));
    html += renderDigZone(s);
    root.querySelector('#floors').innerHTML = html;
    DE.UI.Actors.relayout(); DE.UI.Elevator.relayout();
    update();
  }

  function renderSurface() {
    return `<div class="surface" id="surface">
      <div class="scene" id="scene">
        ${DE.UI.Overworld.svg()}
        <div class="horde" id="horde"></div>
        <div class="ow-overlay">
          <div class="guards" id="guards"></div>
          <div class="party" id="party"></div>
          <div class="turrets" id="turrets"></div>
          <div class="hatch" data-action="selectNone" title="Bunker overview"></div>
          <div class="wall" id="wall" data-action="openDrawer" data-drawer="defense" title="Wall — open Defense">
            <div class="wall-label">WALL <b id="wall-lvl"></b></div>
            <div class="wall-hp"><i id="wall-hp"></i></div>
          </div>
          <div class="entrance-sign">DEAD END</div>
          <div class="wave-info" id="wave-info" data-action="openDrawer" data-drawer="defense"></div>
          <div class="fight-fx" id="fight-fx"></div>
          <div class="shots" id="shots"></div>
        </div>
      </div>
    </div>`;
  }

  /** Geological layer for a depth: topsoil → clay → stone → bedrock. */
  function strata(depth) { return depth <= 2 ? 'strata-soil' : depth <= 5 ? 'strata-clay' : depth <= 8 ? 'strata-stone' : 'strata-bedrock'; }

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
      <div class="room-head"><span class="room-name">${esc(def.name)}</span><span class="room-lvl"></span></div>
      <div class="room-foot"><span class="room-rate"></span><span class="room-flag"></span></div>
      <div class="room-progress"><i></i><span></span></div>
    </div>`;
  }

  function renderDigZone(s) {
    const d = DE.Excavation.nextDepth(s);
    if (d > DE.CONFIG.MAX_FLOORS) return `<div class="floor bedrock strata-bedrock"><div class="shaft-slot"></div><div class="bedrock-label">Bedrock. Nothing further down.</div></div>`;
    return `<div class="floor dig ${strata(d)}" data-action="openDrawer" data-drawer="excavate" id="dig-floor"><div class="shaft-slot"></div><div class="dig-zone" id="dig-zone"></div></div>`;
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
      setHtml(el.querySelector('.room-rate'), rate);
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
      el.classList.toggle('selected', !!(sel && sel.type === 'room' && sel.id === id));
      const tier = room.level >= 50 ? 4 : room.level >= 25 ? 3 : room.level >= 10 ? 2 : 1;
      if (!el.classList.contains('tier-' + tier)) { el.classList.remove('tier-1', 'tier-2', 'tier-3', 'tier-4'); el.classList.add('tier-' + tier); }
    }
    document.querySelectorAll('.cell').forEach(el => el.classList.toggle('selected', !!(sel && sel.type === 'slot' && String(sel.depth) === el.dataset.depth && String(sel.slot) === el.dataset.slot)));
    updateSurface(s, now);
    updateDig(s, now);
    updateWings(s, now);
    DE.UI.Elevator.update(now);
    DE.UI.Actors.update(now);
  }
  function updateWings(s, now) {
    s.floors.forEach(f => {
      const el = document.getElementById('wing-' + f.depth); if (!el) return;
      const body = el.querySelector('.wing-body');
      if (f.expansion) { const pct = Math.min(100, 100 * (1 - (f.expansion.endsAt - now) / (f.expansion.duration * 1000))); setHtml(body, `<b>Digging…</b><div class="dig-prog"><i style="width:${pct}%"></i></div><small>${U().fmtTime((f.expansion.endsAt - now) / 1000)}</small>`); el.classList.add('digging'); }
      else { const ok = DE.Bunker.canExpand(s, f.depth).ok; setHtml(body, `${Ic().img('dig', 'ico-inline')}<b>Dig wing</b><small>+${DE.CONFIG.WING_CELLS} cells</small><span class="cost">${U().costText(DE.Bunker.expansionCost(s, f.depth))}</span><small>${U().fmtTime(DE.Bunker.expansionTime(s, f.depth))}</small>`); el.classList.toggle('cant', !ok); el.classList.remove('digging'); }
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
    const tEl = $('#turrets'); const tSig = 't' + d.turrets; if (tEl && tEl.dataset.sig !== tSig) { tEl.dataset.sig = tSig; tEl.innerHTML = Array.from({ length: Math.min(d.turrets, 5) }, (_, i) => `<span class="turret" style="animation-delay:${(-i * .9).toFixed(1)}s"><svg viewBox="0 0 40 34" aria-hidden="true"><rect x="6" y="24" width="28" height="8" rx="3" fill="#3a3f4a" stroke="#1c1020" stroke-width="3"/><rect x="12" y="12" width="16" height="14" rx="4" fill="#5a5f6a" stroke="#1c1020" stroke-width="3"/><g class="barrel"><rect x="20" y="14" width="20" height="6" rx="3" fill="#2f2d38" stroke="#1c1020" stroke-width="3"/></g><circle cx="16" cy="18" r="2.5" fill="#ff5a3c"/></svg></span>`).join('') + (d.turrets > 5 ? `<small>+${d.turrets - 5}</small>` : ''); }
    const guards = DE.Survivors.guards(s);
    const fightingNow = now < fightUntil; const gSig = guards.slice(0, 8).map(g => g.id + g.profession).join(',') + (fightingNow ? 'F' : '');
    const gEl = $('#guards'); if (gEl && gEl.dataset.sig !== gSig) { gEl.dataset.sig = gSig; gEl.innerHTML = guards.slice(0, 6).map((g, i) => `<span class="guard" style="--i:${i}" title="${esc(g.name)} · on guard">${DE.Chars.crew(g.profession, { anim: fightingNow ? 'shoot' : 'guard', h: 60, flip: true })}</span>`).join('') + (guards.length > 6 ? '<small>+' + (guards.length - 6) + '</small>' : ''); }
    updateParty(s);
    const secs = (d.nextWaveAt - now) / 1000;
    const power = DE.Defense.defensePower(s); const hp = DE.Defense.waveHp(s);
    const verdict = power.total >= hp ? 'ok' : power.total >= hp * 0.6 ? 'warn' : 'danger';
    const info = $('#wave-info');
    if (info) {
      setHtml(info, `${Ic().img('wave', 'ico-inline')} ${DE.Defense.isBossWave(d.wave) ? 'BOSS ' : ''}Wave ${d.wave} in <b>${U().fmtTime(secs)}</b> · threat ${U().fmt(hp)} vs defense ${U().fmt(power.total)}`);
      info.className = 'wave-info ' + verdict;
    }
    const surface = $('#surface'); if (!surface) return;
    const wrap = document.getElementById('bunker-wrap'); if (wrap) { const w = wrap.clientWidth + 'px'; if (surface.style.width !== w) surface.style.width = w; }
    const scene = $('#scene'); if (scene && s.overworld) for (const k in s.overworld) { const v = String(s.overworld[k] || 0); if (scene.dataset[k] !== v) scene.dataset[k] = v; }
    const incoming = secs < DE.Defense.warningSec(s); const fighting = now < fightUntil;
    surface.classList.toggle('incoming', incoming && !fighting);
    surface.classList.toggle('fight', fighting);
    if (incoming && !fighting && hordeWave !== d.wave) { hordeWave = d.wave; buildHorde(s); }
    fire(s, now, incoming, fighting);
    if (!incoming && !fighting && hordeWave !== -1) { hordeWave = -1; setHtml($('#horde'), ''); }
  }

  /* ---- defenders shoot: tracers from turrets and guards to zombies on the surface ---- */
  let nextShot = 0;
  function fire(s, now, incoming, fighting) {
    if (!(incoming || fighting) || now < nextShot || !s.settings.animations) return;
    const scene = $('#scene'), shots = $('#shots'); if (!scene || !shots) return;
    const zs = Array.from(document.querySelectorAll('#horde .z:not(.dead) .rig')); if (!zs.length) return;
    const shooters = Array.from(document.querySelectorAll('#turrets .turret, #guards .guard')); if (!shooters.length) return;
    nextShot = now + (fighting ? 90 : 260) + Math.random() * 120;
    const base = scene.getBoundingClientRect();
    const sh = shooters[(Math.random() * shooters.length) | 0]; const z = zs[(Math.random() * zs.length) | 0];
    const a = sh.getBoundingClientRect(), b = z.getBoundingClientRect();
    const x1 = a.left + a.width * .7 - base.left, y1 = a.top + a.height * .45 - base.top;
    const x2 = b.left + b.width * .5 - base.left, y2 = b.top + b.height * .5 - base.top;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
    const t = document.createElement('i'); t.className = 'tracer ' + (sh.classList.contains('turret') ? 'heavy' : '');
    t.style.cssText = `left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${ang}deg)`;
    shots.appendChild(t); setTimeout(() => t.remove(), 320);
    sh.classList.add('firing'); setTimeout(() => sh.classList.remove('firing'), 110);
    // impact: the zombie flinches
    const zEl = z.closest('.z');
    setTimeout(() => { if (!zEl || !zEl.isConnected) return; zEl.classList.add('pinged'); setTimeout(() => zEl.classList.remove('pinged'), 160); }, 90);
    while (shots.children.length > 14) shots.firstChild.remove();
  }

  function buildHorde(s) {
    const comp = DE.Defense.waveComposition(DE.Defense.waveHp(s), s.defense.wave).slice(0, 24);
    const h = $('#horde'); if (!h) return;
    h.innerHTML = comp.map((z) => { const big = z.boss || z.id === 'brute' || z.id === 'mutant'; const dur = (z.id === 'runner' ? 9 : z.id === 'leaper' ? 12 : big ? 30 : 20) + Math.random() * 8;
      return `<span class="z ${z.id}" style="--lane:${(Math.random() * 12) | 0}px;--start:${(30 + Math.random() * 60).toFixed(0)}vw;animation-duration:${dur.toFixed(1)}s;animation-delay:${(Math.random() * 6).toFixed(1)}s">${DE.Chars.zombie(z.id, { anim: z.id === 'runner' ? 'run' : 'walk', h: big ? 78 : 50, flip: true })}</span>`; }).join('');
    h.querySelectorAll('.z').forEach(el => el.addEventListener('animationend', (e) => { if (e.target !== el) return; const r = el.querySelector('.rig'); if (r && !el.classList.contains('dead')) setAnim(r, 'attack'); }));
  }

  /** Survivors away on expeditions walk along the fence on the surface. */
  let partySig = '';
  function updateParty(s) {
    const p = $('#party'); if (!p) return;
    const members = []; s.expeditions.active.forEach(e => e.survivors.forEach(id => { const sv = s.survivors[id]; if (sv) members.push(sv); }));
    const sig = members.map(m => m.id + m.profession).join(',');
    if (sig === partySig) return; partySig = sig;
    p.innerHTML = members.slice(0, 6).map((m, i) => `<span class="pm" style="animation-delay:${(-i * 1.1).toFixed(1)}s" title="${esc(m.name)} · on expedition">${DE.Chars.crew(m.profession, { anim: 'walk', h: 46 })}</span>`).join('');
  }

  /** Called when a wave resolves: brief battle animation. */
  function playWave(result) {
    fightUntil = Date.now() + 4200;
    // zombies react: hits during the fight, then deaths (or a breach push) at the end
    Array.from(document.querySelectorAll('#horde .z')).forEach((el, i) => { const r = el.querySelector('.rig'); if (!r) return;
      setTimeout(() => { if (el.isConnected) { const was = (r.className.baseVal.match(/a-\w+/) || ['a-attack'])[0].slice(2); setAnim(r, 'hit'); setTimeout(() => el.isConnected && setAnim(r, was), 380); } }, 200 + Math.random() * 1400);
      const dies = !result.breach || Math.random() < 0.6;
      if (dies) setTimeout(() => { if (el.isConnected) { el.classList.add('dead'); setAnim(r, 'die'); } }, 1800 + i * 90);
      else setTimeout(() => { if (el.isConnected) el.classList.add('through'); }, 2000); });
    const fx = $('#fight-fx'); if (!fx) return;
    fx.innerHTML = '';
    for (let i = 0; i < 14; i++) {
      const sp = document.createElement('span'); sp.className = 'spark s' + (i % 3);
      sp.style.left = (30 + Math.random() * 60) + '%'; sp.style.animationDelay = (Math.random() * 2) + 's'; fx.appendChild(sp);
    }
    setTimeout(() => { if (fx) fx.innerHTML = ''; }, 2800);
    const surface = $('#surface'); if (surface) { surface.classList.add(result.breach ? 'breached' : 'won'); setTimeout(() => surface.classList.remove("breached", "won"), 4200); }
  }

  function flashRoom(id, cls) {
    const el = document.getElementById('room-' + id); if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 1500);
  }
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

  function updateDig(s, now) {
    const el = $('#dig-zone'); if (!el) return;
    const d = DE.Excavation.nextDepth(s);
    if (s.excavation) {
      const ex = s.excavation; const pct = Math.min(100, 100 * (1 - (ex.endsAt - now) / (ex.duration * 1000)));
      setHtml(el, `<div class="dig-prog"><i style="width:${pct}%"></i></div><span>Excavating B${ex.depth} · ${U().fmtTime((ex.endsAt - now) / 1000)}</span>`);
    } else if (d > DE.Excavation.maxDepth(s)) setHtml(el, `<span>${Ic().img('dig', 'ico-inline')} B${d} locked — needs excavation research</span>`);
    else setHtml(el, `<span>${Ic().img('dig', 'ico-inline')} Excavate B${d} · ${U().costText(DE.Excavation.cost(s, d))} · ${U().fmtTime(DE.Excavation.time(s, d))}</span>`);
  }

  function scrollToFloor(depth) {
    const el = document.querySelector(`.floor[data-depth="${depth}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return { render, update, playWave, scrollToFloor, flashRoom, revealFloor, collectAt };
})();
