/* Start screen: the real overworld at dusk as a living backdrop — the bunker, a guard at the
 * hatch, a horde shambling in from the wasteland — with the menu card on the left and a summary
 * of the saved bunker on the Continue button.
 * The backdrop SVG is only in the DOM while the menu is visible (its gradient ids would otherwise
 * clash with the in-game scene). */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Menu = (function () {
  const esc = (s) => DE.Util.escapeHtml(s);
  let raf = 0, world = null, units = [], last = 0;
  const TIPS = [
    'Survivors sleep only in real beds — build Quarters before they collapse.',
    'Turrets turn toward their target before firing. More mounts, more barrels.',
    'Night falls every few minutes. Floodlights make the dark less lonely.',
    'Harder rock needs better excavation research.',
    'Winter is coming every few days. Stock food.',
    'The missile battery is endgame artillery: fortify first.',
  ];

  function summary() {
    try {
      const raw = DE.Save.load(); const s = raw && (raw.state || raw); if (!s || !s.floors) return '';
      const surv = Object.keys(s.survivors || {}).length, depth = s.floors.length;
      const c = DE.UI.DayCycle ? DE.UI.DayCycle.clock(s) : null;
      const ago = s.lastSave ? Math.max(0, (Date.now() - s.lastSave) / 1000) : 0;
      return `${c ? 'Day ' + c.day + ' · ' : ''}B${depth} · ${surv} survivors · wave ${s.defense ? s.defense.wave : 1}${ago ? ' · saved ' + DE.Util.fmtTime(ago) + ' ago' : ''}`;
    } catch (e) { return ''; }
  }

  function show() {
    const root = document.getElementById('menu-screen'); if (!root) return;
    const OW = DE.UI.Overworld;
    root.querySelector('.menu-bg').innerHTML = `<div class="menu-scene">${OW.svg()}<div class="menu-world"></div><div class="menu-light"></div></div>`;
    const sc = root.querySelector('.menu-scene');
    // anchor the scene's left edge (the bunker) just right of the menu card
    sc.querySelector('.ow-svg').setAttribute('preserveAspectRatio', 'xMinYMax slice');
    // the weakest version of the base: plank fence, cracked bunker, no towers
    Object.assign(sc.dataset, { fence: '0', barricades: '0', towers: '0', lights: '0', road: '0', missile: '0', walltier: '0' });
    world = sc.querySelector('.menu-world'); units = [];
    const Z = DE.Data.ZOMBIES.filter(z => !z.boss).map(z => z.id);
    for (let i = 0; i < 9; i++) {
      const id = Z[i % Z.length], big = id === 'brute' || id === 'mutant', h = big ? 96 : 66;
      const el = document.createElement('div'); el.className = 'menu-unit'; el.innerHTML = DE.Chars.zombie(id, { anim: id === 'runner' ? 'run' : 'walk', h, flip: true }); world.appendChild(el);
      units.push({ el, h, x: 1000 + i * 90 + Math.random() * 60, stop: OW.LAYOUT.fenceX + 20 + (i % 5) * 26, y: OW.GROUND + 4 + (i % 3) * 3, v: id === 'runner' ? 46 : big ? 16 : 22 + Math.random() * 8 });
    }
    const g = document.createElement('div'); g.className = 'menu-unit guard'; g.innerHTML = DE.Chars.crew('guard', { anim: 'guard', h: 66 }); world.appendChild(g);
    units.push({ el: g, h: 66, x: OW.LAYOUT.bunkerC + 150, y: OW.GROUND + 8, v: 0 });
    // card contents
    const has = DE.Save.hasSave();
    const cont = root.querySelector('#btn-continue'); cont.style.display = has ? '' : 'none';
    const sub = cont.querySelector('small'); if (sub) sub.textContent = has ? summary() : '';
    root.querySelector('.menu-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];
    fit(); window.addEventListener('resize', fit);
    if (!raf && !(document.body.classList.contains('no-anim'))) { last = 0; raf = requestAnimationFrame(step); }
  }
  /** Same transform as the SVG's xMidYMax slice, so units stand on its grass. */
  function fit() {
    const sc = document.querySelector('.menu-scene'); if (!sc || !world) return;
    const OW = DE.UI.Overworld, svg0 = sc.querySelector('.ow-svg'), off = svg0.getBoundingClientRect().left - sc.getBoundingClientRect().left, cw = sc.clientWidth - off, ch = sc.clientHeight;
    // the scene fills ~3/4 of the height (or the full width, if that is larger); a matching sky
    // gradient continues above it, and the right side is cropped rather than the bunker
    const k = Math.max(cw / OW.W, .8 * ch / OW.H), svg = sc.querySelector('.ow-svg');
    svg.setAttribute('preserveAspectRatio', 'xMinYMax slice'); svg.style.top = 'auto'; svg.style.height = Math.min(ch, OW.H * k) + 'px';
    world.style.transform = `translate(${off}px, ${ch - OW.H * k}px) scale(${k})`;
    units.forEach(place);
  }
  function place(u) { u.el.style.transform = `translate(${(u.x - u.h * 70 / 225).toFixed(1)}px, ${(u.y - u.h * 215 / 225).toFixed(1)}px)`; }
  function step(t) {
    raf = 0; if (!world || !world.isConnected) return;
    const dt = Math.min(.05, (t - (last || t)) / 1000); last = t;
    const W = DE.UI.Overworld.W;
    units.forEach(u => {
      if (!u.v) return;
      if (u.wait > 0) { u.wait -= dt; if (u.wait <= 0) { u.x = W + 40 + Math.random() * 240; setAnim(u, 'walk'); } else return; }
      u.x -= u.v * dt;
      // reach the fence: claw at it for a while, then a fresh one shambles in from the right
      if (u.x < u.stop) { u.x = u.stop; u.wait = 5 + Math.random() * 6; setAnim(u, 'attack'); }
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
  return { show, hide };
})();
