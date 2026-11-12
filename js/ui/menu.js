/* Start screen: the overworld zoomed in on a fortified bunker at dusk, a guard on watch and a few
 * zombies shambling up to the sandbags — logo top-left, Continue / New Game / Settings on the
 * right, Credits and Save Management bottom-left, version badge bottom-right.
 * The backdrop SVG is only in the DOM while the menu is visible (its gradient ids would otherwise
 * clash with the in-game scene). */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Menu = (function () {
  const esc = (s) => DE.Util.escapeHtml(s);
  let raf = 0, world = null, units = [], last = 0, view = null;
  const TIPS = [
    'Survivors sleep only in real beds — build Quarters before they collapse.',
    'Turrets turn toward their target before firing. More mounts, more barrels.',
    'Sandbags give guards cover: zombies have to claw through them first.',
    'Harder rock needs better excavation research.',
    'Seasons last for days. Stock food before winter.',
    'Who answers the radio is up to fate — legendary survivors are rare.',
  ];
  // the part of the overworld the menu shows: the compound, a slice of the wasteland, the sky
  const VIEW = { x: 0, y: 40, w: 1180, h: 560 };

  function summary() {
    try {
      const s = DE.Save.load(); if (!s || !s.floors) return '';
      const c = DE.UI.DayCycle ? DE.UI.DayCycle.clock(s) : null;
      return `${c ? 'Day ' + c.day + ' · ' : ''}B${s.floors.length} · ${Object.keys(s.survivors || {}).length} survivors · wave ${s.defense ? s.defense.wave : 1}`;
    } catch (e) { return ''; }
  }

  function show() {
    const root = document.getElementById('menu-screen'); if (!root) return;
    const OW = DE.UI.Overworld;
    root.querySelector('.menu-bg').innerHTML = `<div class="menu-scene">${OW.svg()}<div class="menu-world"></div><div class="menu-light"></div></div>`;
    const sc = root.querySelector('.menu-scene');
    const svg = sc.querySelector('.ow-svg');
    svg.setAttribute('viewBox', `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`); svg.setAttribute('preserveAspectRatio', 'xMinYMax slice');
    // a well-defended bunker: steel mesh fence, sandbags, manned towers, lamp posts, plated walls
    Object.assign(sc.dataset, { fence: '1', barricades: '1', towers: '1', lights: '1', road: '1', missile: '0', walltier: '1', season: 'autumn', tod: 'twilight' });
    world = sc.querySelector('.menu-world'); units = [];
    const zs = ['walker', 'runner', 'brute', 'walker', 'crawler', 'toxic', 'walker'];
    zs.forEach((id, i) => {
      const big = id === 'brute', h = big ? 96 : 68;
      const el = document.createElement('div'); el.className = 'menu-unit'; el.innerHTML = DE.Chars.zombie(id, { anim: id === 'runner' ? 'run' : 'walk', h, flip: true, phase: i * .37 }); world.appendChild(el);
      units.push({ el, h, x: 1000 + i * 140 + Math.random() * 80, stop: 884 + (i % 4) * 22, y: OW.GROUND + 2 + (i % 3) * 3, v: id === 'runner' ? 44 : big ? 16 : id === 'crawler' ? 20 : 22 + Math.random() * 8 });
    });
    [['guard', 772], ['soldier', 818]].forEach(([prof, x]) => {
      const g = document.createElement('div'); g.className = 'menu-unit guard'; g.innerHTML = DE.Chars.crew(prof, { anim: 'guard', h: 70, phase: x / 100 }); world.appendChild(g);
      units.push({ el: g, h: 70, x, y: OW.GROUND + 8, v: 0, guard: true });
    });
    const has = DE.Save.hasSave();
    const cont = root.querySelector('#btn-continue'); cont.style.display = has ? '' : 'none';
    const sub = cont.querySelector('small'); if (sub) sub.textContent = has ? summary() : '';
    root.querySelector('.menu-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
    fit(); window.addEventListener('resize', fit);
    if (!raf && !document.body.classList.contains('no-anim')) { last = 0; raf = requestAnimationFrame(step); }
  }
  /** Map the SVG's viewBox (xMidYMax slice) to the unit layer so units stand on its grass. */
  function fit() {
    const sc = document.querySelector('.menu-scene'); if (!sc || !world) return;
    const cw = sc.clientWidth, ch = sc.clientHeight;
    // landscape: fill the screen (crop the right); portrait: show the whole width, sky above it
    const tall = cw / ch < 1.25, k = tall ? Math.max(cw / VIEW.w, .55 * ch / VIEW.h) : Math.max(cw / VIEW.w, ch / VIEW.h);
    // tall screens: the scene fills the lower part (cropped on the right) and fades into the sky
    sc.classList.toggle('tall', tall); sc.style.setProperty('--sh', (VIEW.h * k).toFixed(0) + 'px');
    const ox = -VIEW.x * k, oy = ch - (VIEW.y + VIEW.h) * k;
    world.style.transform = `translate(${ox.toFixed(1)}px, ${oy.toFixed(1)}px) scale(${k.toFixed(4)})`;
    units.forEach(place);
  }
  function place(u) { u.el.style.transform = `translate(${(u.x - u.h * 70 / 225).toFixed(1)}px, ${(u.y - u.h * 215 / 225).toFixed(1)}px)`; }
  function step(t) {
    raf = 0; if (!world || !world.isConnected) return;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    const W = DE.UI.Overworld.W;
    units.forEach(u => {
      if (u.guard) { u.cd = (u.cd || Math.random() * 2) - dt; if (u.cd <= 0) { u.cd = 1.6 + Math.random() * 2.4; setAnim(u, 'shoot'); setTimeout(() => setAnim(u, 'guard'), 400); } return; }
      if (u.wait > 0) { u.wait -= dt; if (u.wait <= 0) { u.x = W + 40 + Math.random() * 240; setAnim(u, 'walk'); u.el.classList.remove('gone'); } else return; }
      u.x -= u.v * dt; if (!u.sp) { u.sp = 1; DE.UI.Anim.speed(u.el.querySelector('.rig'), u.v); }
      // reach the sandbags: claw at them, then fall and a fresh one shambles in from the right
      if (u.x < u.stop) { u.x = u.stop; u.wait = 4 + Math.random() * 5; setAnim(u, 'attack'); setTimeout(() => { setAnim(u, 'die'); setTimeout(() => u.el.classList.add('gone'), 900); }, (u.wait - 1.2) * 1000); }
      place(u);
    });
    raf = requestAnimationFrame(step);
  }
  function setAnim(u, a) { const r = u.el.querySelector('.rig'); if (!r) return; Array.from(r.classList).forEach(c => { if (c.startsWith('a-')) r.classList.remove(c); }); r.classList.add('a-' + a); }
  function hide() {
    if (raf) cancelAnimationFrame(raf); raf = 0; world = null; units = [];
    window.removeEventListener('resize', fit);
    const bg = document.querySelector('#menu-screen .menu-bg'); if (bg) bg.innerHTML = '';
  }

  /* ---------- menu panels ---------- */
  function settings() {
    const a = DE.Audio.prefs();
    DE.UI.modal({ title: 'Settings', icon: 'gear', cls: 'menu-panel', html: `
      <div class="row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${a.music}" data-audio="music" class="vol"><button class="btn small ${a.musicOn ? 'active' : ''}" data-action="menuToggleAudio" data-key="musicOn">${a.musicOn ? 'On' : 'Off'}</button></div>
      <div class="row"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${a.sfx}" data-audio="sfx" class="vol"><button class="btn small ${a.sfxOn ? 'active' : ''}" data-action="menuToggleAudio" data-key="sfxOn">${a.sfxOn ? 'On' : 'Off'}</button></div>
      <p class="muted small-note">Animations and other options live in the in-game menu.</p>`, buttons: [{ label: 'Done', action: 'closeModal', cls: 'primary' }] });
  }
  function credits() {
    DE.UI.modal({ title: 'Credits', icon: 'scroll', cls: 'menu-panel', html: `
      <div class="cr"><img src="assets/ui/logo.png" alt=""><p><b>DEAD END: Underground</b> — an idle bunker-survival game.</p>
      <dl><dt>Design & art direction</dt><dd>The bunker's commander (you know who you are)</dd><dt>Code, systems & synthesised audio</dt><dd>Built with Claude Code</dd>
      <dt>Character, furniture, weapon & UI sprites</dt><dd>Provided sprite sheets, cut by tools/cut_sprites.py</dd><dt>Engine</dt><dd>Plain HTML, CSS and JavaScript — no build step</dd></dl>
      <p class="muted">Thanks for keeping the lights on.</p></div>`, buttons: [{ label: 'Close', action: 'closeModal', cls: 'primary' }] });
  }
  function saves() {
    const has = DE.Save.hasSave(); const sum = has ? summary() : '';
    DE.UI.modal({ title: 'Save Management', icon: 'save', cls: 'menu-panel', html: `
      <div class="sm-slot ${has ? '' : 'empty'}">${DE.Icons.img(has ? 'home' : 'warning', 'sm-ico')}<div><b>${has ? 'Bunker save' : 'No save yet'}</b><small>${has ? esc(sum) : 'Start a new game to create one. Saves live in this browser.'}</small></div></div>
      <div class="btn-row">${has ? `<button class="btn" data-action="menuExport">Export to text</button><button class="btn danger" data-action="menuDeleteSave">Delete save</button>` : ''}<button class="btn primary" data-action="menuImport">Import save…</button></div>
      <textarea id="export-area" class="save-area" placeholder="The export string appears here — copy it somewhere safe." readonly ${has ? '' : 'hidden'}></textarea>`, buttons: [{ label: 'Close', action: 'closeModal' }] });
  }
  return { show, hide, settings, credits, saves, summary };
})();
