/* Battlefield: everything that moves on the surface — guards on patrol, auto-turrets, the missile
 * battery, the zombie horde, the expedition party and every shot fired.
 *
 * All of it lives in one "world" layer that uses the overworld SVG's own coordinate system
 * (W x H units, ground line at GROUND). The layer is scaled with exactly the transform the SVG
 * uses, so a guard at y = GROUND stands on the grass and a turret at the roof line sits on the
 * roof, at any screen size — nothing is positioned in percentages.
 *
 * It is a real (visual) simulation: zombies walk in from the right and attack the fence, turrets
 * pick the nearest target, rotate their head at a limited turn rate and only fire once the
 * barrel is on target, bullets are traced from the actual muzzle, missiles fly ballistic arcs
 * from the launcher rails to the predicted impact point and explode with splash damage. The
 * wave's outcome still comes from DE.Defense.resolveWave; fight() makes the field agree with it. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Battlefield = (function () {
  // slight per-zombie colour variation so a horde never looks cloned
  const ZTINT = ['', '', 'hue-rotate(-12deg)', 'hue-rotate(10deg) saturate(.85)', 'brightness(.9)', 'saturate(1.2) brightness(1.05)'];
  const NS = 'http://www.w3.org/2000/svg';
  const OW = () => DE.UI.Overworld;
  let root = null, world = null, fx = null, decals = null, scaleSig = '';
  let raf = 0, lastT = 0, running = false;
  const st = { zombies: [], turrets: [], guards: {}, party: {}, missiles: [], launcher: null, incoming: false, fighting: false, resolved: false, result: null, fightStart: 0, wave: -1, turretSig: '', missileLvl: 0, barricades: 0, ratio: 1, kills: 0, killBudget: 0, front: 0 };

  /* turret mounts in order of purchase: [x, baseY, ground?] */
  const MOUNTS = () => { const G = OW().GROUND, R = OW().LAYOUT.roofY; return [[262, R, false], [638, R, false], [118, G, true], [866, G, true], [330, R, false], [570, R, false], [56, G, true], [700, G, true]]; };
  const FENCE = () => OW().LAYOUT.fenceX;
  const PATROL = [70, 900];

  /* ---------- layer ---------- */
  function ensure() {
    const scene = document.getElementById('scene'); if (!scene) return false;
    if (!root || !root.isConnected) {
      root = document.createElement('div'); root.className = 'bf'; root.id = 'bf';
      root.innerHTML = `<div class="bf-world"><svg class="bf-decals" viewBox="0 0 ${OW().W} ${OW().H}" width="${OW().W}" height="${OW().H}" aria-hidden="true"></svg><svg class="bf-fx" viewBox="0 0 ${OW().W} ${OW().H}" width="${OW().W}" height="${OW().H}" aria-hidden="true"></svg></div>`;
      scene.appendChild(root); world = root.firstChild; decals = world.firstChild; fx = world.children[1]; scaleSig = '';
      st.zombies = []; st.turrets = []; st.guards = {}; st.party = {}; st.missiles = []; st.launcher = null; st.turretSig = ''; st.missileLvl = 0; st.wave = -1;
      // the clickable wall / hatch hot-spots and the entrance sign live in world space too
      ['hatch', 'wall', 'entrance-sign'].forEach(c => { const e = scene.querySelector('.ow-overlay .' + c); if (e) world.appendChild(e); });
    }
    // same transform as the SVG's preserveAspectRatio="xMidYMax slice"
    const cw = scene.clientWidth, ch = scene.clientHeight; const sig = cw + 'x' + ch;
    if (sig !== scaleSig && cw && ch) {
      scaleSig = sig; const k = Math.max(cw / OW().W, ch / OW().H);
      const ox = (cw - OW().W * k) / 2, oy = ch - OW().H * k;
      world.style.transform = `translate(${ox}px, ${oy}px) scale(${k})`;
    }
    return true;
  }
  function unit(html, cls) { const el = document.createElement('div'); el.className = 'bf-unit ' + (cls || ''); el.innerHTML = html; world.appendChild(el); return el; }
  function put(el, x, y) { el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`; }
  function anim(rig, a) {
    if (!rig || rig.dataset.anim === a) return; rig.dataset.anim = a;
    // copy the class list first: removing from a live DOMTokenList while iterating skips entries and
    // left stale animation classes behind (e.g. a-die, which fades the body out) on living units
    Array.from(rig.classList).forEach(c => { if (c.startsWith('a-')) rig.classList.remove(c); }); rig.classList.add('a-' + a);
  }
  function face(rig, left) { if (rig) rig.classList.toggle('flip', !!left); }
  const ang = (a) => { a = a % 360; if (a > 180) a -= 360; if (a < -180) a += 360; return a; };

  /* ---------- turrets ---------- */
  function turretSvg(ground) {
    const I = '#1c1020';
    return `<svg viewBox="-34 -34 68 56" width="68" height="56" aria-hidden="true">
      ${ground ? `<g fill="#d8b06e" stroke="${I}" stroke-width="2.5"><ellipse cx="-22" cy="16" rx="12" ry="6"/><ellipse cx="22" cy="16" rx="12" ry="6"/><ellipse cx="0" cy="18" rx="13" ry="6"/><ellipse cx="-11" cy="9" rx="11" ry="5"/><ellipse cx="11" cy="9" rx="11" ry="5"/></g>` : ''}
      <path d="M-14 22 L-8 6 H8 L14 22 Z" fill="#4e5058" stroke="${I}" stroke-width="3" stroke-linejoin="round"/><rect x="-5" y="0" width="10" height="8" fill="#3a3f4a" stroke="${I}" stroke-width="2.5"/>
      <g class="bf-head"><g class="bf-recoil">
        <rect x="8" y="-3.5" width="26" height="7" rx="2" fill="#2d2f36" stroke="${I}" stroke-width="2.5"/><rect x="30" y="-5" width="6" height="10" rx="1.5" fill="#3a3f4a" stroke="${I}" stroke-width="2"/>
        <rect x="-13" y="-10" width="25" height="20" rx="6" fill="#6a6e78" stroke="${I}" stroke-width="3"/><rect x="-9" y="-7" width="13" height="4" rx="2" fill="#a8acb6"/>
        <rect x="-8" y="3" width="10" height="9" rx="2" fill="#4f6a3a" stroke="${I}" stroke-width="2"/><circle cx="5" cy="-2" r="2.6" fill="#ff4a2e" class="bf-eye"/>
      </g></g>
      <circle class="bf-flash" cx="40" cy="0" r="7" fill="#fff4a8" opacity="0"/></svg>`;
  }
  function syncTurrets(s) {
    const n = Math.min(s.defense.turrets, MOUNTS().length); const sig = 't' + n;
    if (sig === st.turretSig) return; st.turretSig = sig;
    st.turrets.forEach(t => t.el.remove()); st.turrets = [];
    MOUNTS().slice(0, n).forEach(([x, y, ground], i) => {
      const el = unit(turretSvg(ground), 'bf-turret' + (ground ? ' ground' : ''));
      put(el, x - 34, y - 22 - 34 + (ground ? 0 : 0));
      // pivot (svg 0,0) sits 22 units above the mount line
      const t = { el, head: el.querySelector('.bf-head'), recoil: el.querySelector('.bf-recoil'), flash: el.querySelector('.bf-flash'), x, y, px: x, py: y - 22, a: -8 + i * 3, cd: Math.random() * .5, scan: Math.random() * 6, target: null };
      aimHead(t); st.turrets.push(t);
    });
  }
  function aimHead(t) {
    // keep the gun upright when aiming left (mirror vertically instead of turning upside down)
    const left = Math.abs(t.a) > 90;
    t.head.setAttribute('transform', `rotate(${t.a.toFixed(1)})${left ? ' scale(1 -1)' : ''}`);
    t.flash.setAttribute('cx', (40 * Math.cos(t.a * Math.PI / 180)).toFixed(1)); t.flash.setAttribute('cy', (40 * Math.sin(t.a * Math.PI / 180)).toFixed(1));
  }
  function stepTurret(t, dt, live) {
    t.cd -= dt;
    let want;
    if (live.length) {
      // nearest zombie to the turret
      // nearest zombie in range (retarget when the old one died, broke through or walked off)
      if (!t.target || t.target.dead || t.target.through || t.target.retreat || !live.includes(t.target)) t.target = live.filter(z => Math.abs(z.x - t.px) < 600).reduce((b, z) => (!b || Math.abs(z.x - t.px) < Math.abs(b.x - t.px) ? z : b), null);
      if (!t.target) { t.scan += dt; want = -6 + Math.sin(t.scan * .5) * 12; }
      else { const z = t.target; const aimY = z.y - z.h * .5; want = Math.atan2(aimY - t.py, z.x - t.px) * 180 / Math.PI; }
    } else { t.target = null; t.scan += dt; want = -6 + Math.sin(t.scan * .5) * 12; }
    const d = ang(want - t.a); const turn = 160 * dt;
    t.a = ang(t.a + Math.max(-turn, Math.min(turn, d))); aimHead(t);
    // fire only once the barrel is on target
    if (t.target && Math.abs(d) < 3 && t.cd <= 0 && (st.incoming || st.fighting) && t.target.x < OW().W - 10) {
      t.cd = .32 + Math.random() * .18;
      const r = t.a * Math.PI / 180; const mx = t.px + Math.cos(r) * 38, my = t.py + Math.sin(r) * 38;
      DE.Audio.sfx('heavy', 90);
      tracer(mx, my, t.target.x + (Math.random() - .5) * 8, t.target.y - t.target.h * (.35 + Math.random() * .3), true);
      t.flash.setAttribute('opacity', '1'); setTimeout(() => t.flash.setAttribute('opacity', '0'), 60);
      t.recoil.setAttribute('transform', 'translate(-3 0)'); setTimeout(() => t.recoil.removeAttribute('transform'), 70);
      hit(t.target, st.fighting ? 1 : .7, true);
    }
  }

  /* ---------- missile battery ---------- */
  function launcherSvg(lvl) {
    const I = '#1c1020'; const tubes = lvl >= 2 ? 3 : 2;
    let rails = ''; for (let i = 0; i < tubes; i++) rails += `<rect x="-6" y="${-14 + i * 10}" width="54" height="9" rx="3" fill="#5a5f6a" stroke="${I}" stroke-width="2.5"/><circle cx="48" cy="${-9.5 + i * 10}" r="3" fill="#1c1020"/><path class="bf-warhead" d="M44 ${-12.5 + i * 10} l8 3 l-8 3 z" fill="#d8303a"/>`;
    return `<svg viewBox="-60 -70 120 92" width="120" height="92" aria-hidden="true">
      <path d="M-34 22 L-26 4 H26 L34 22 Z" fill="#4e5058" stroke="${I}" stroke-width="3" stroke-linejoin="round"/><rect x="-30" y="16" width="60" height="6" fill="url(#ow-hazard)"/>
      <rect x="-10" y="-8" width="20" height="14" fill="#3a3f4a" stroke="${I}" stroke-width="3"/>
      <g class="bf-rails">${rails}<rect x="-16" y="-16" width="20" height="${tubes * 10 + 6}" rx="4" fill="#6a6e78" stroke="${I}" stroke-width="3"/><rect x="-12" y="-12" width="10" height="4" rx="2" fill="#ffd34a"/></g></svg>`;
  }
  function syncLauncher(s) {
    const lvl = (s.overworld && s.overworld.missile) || 0;
    if (lvl === st.missileLvl) return; st.missileLvl = lvl;
    if (st.launcher) { st.launcher.el.remove(); st.launcher = null; }
    if (!lvl) return;
    const x = OW().LAYOUT.bunkerC, y = 346;
    const el = unit(launcherSvg(lvl), 'bf-launcher'); put(el, x - 60, y - 22 - 70);
    st.launcher = { el, rails: el.querySelector('.bf-rails'), px: x, py: y - 22 - 4, a: -35, cd: 1.5, reload: lvl >= 2 ? 1.7 : 2.6, dmg: lvl >= 2 ? 2.2 : 1.5, tube: 0, target: null };
    st.launcher.rails.setAttribute('transform', `translate(0 -4) rotate(${st.launcher.a})`);
  }
  /** Ballistic arc: quadratic Bézier from the rails to the impact point, apex well above both. */
  function arc(x0, y0, x2, y2) { const d = Math.abs(x2 - x0); return { x0, y0, x1: (x0 + x2) / 2, y1: Math.min(y0, y2) - 140 - d * .18, x2, y2 }; }
  function stepLauncher(L, dt, live) {
    L.cd -= dt;
    if (!live.length) { L.target = null; const d = ang(-35 - L.a); L.a += Math.max(-60 * dt, Math.min(60 * dt, d)); L.rails.setAttribute('transform', `translate(0 -4) rotate(${L.a.toFixed(1)})`); return; }
    // biggest threat first, then nearest
    if (!L.target || L.target.dead) L.target = live.slice().sort((a, b) => (b.big - a.big) || (a.x - b.x))[0];
    const z = L.target, T = 1.3 + Math.abs(z.x - L.px) / 1000;
    const moving = z.mode === 'walk' && !z.through && !z.retreat; const ix = Math.max((st.front || 700) + 4, moving ? z.x - z.speed * T * .8 : z.x), iy = z.y - 4;
    const a = arc(L.px, L.py, ix, iy); const want = Math.atan2(a.y1 - a.y0, a.x1 - a.x0) * 180 / Math.PI;
    const d = ang(want - L.a); L.a = ang(L.a + Math.max(-70 * dt, Math.min(70 * dt, d)));
    L.rails.setAttribute('transform', `translate(0 -4) rotate(${L.a.toFixed(1)})`);
    if (Math.abs(d) < 4 && L.cd <= 0 && (st.incoming || st.fighting)) {
      L.cd = L.reload; L.tube = (L.tube + 1) % 3;
      const r = L.a * Math.PI / 180; const mx = L.px + Math.cos(r) * 52, my = L.py + Math.sin(r) * 52 - 4 + L.tube * 3;
      launch(arc(mx, my, ix, iy), T, L.dmg);
    }
  }
  function launch(a, T, dmg) {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'bf-missile');
    g.innerHTML = `<path class="bf-flame" d="M-16 0 l-10 -4 l3 4 l-3 4 z" fill="#ffb13a"/><rect x="-14" y="-3.5" width="22" height="7" rx="3" fill="#d8d6d1" stroke="#1c1020" stroke-width="2"/><path d="M8 -3.5 l7 3.5 l-7 3.5 z" fill="#d8303a" stroke="#1c1020" stroke-width="2" stroke-linejoin="round"/><path d="M-14 -3.5 l-4 -4 h6 z M-14 3.5 l-4 4 h6 z" fill="#5a5f6a" stroke="#1c1020" stroke-width="1.5"/>`;
    fx.appendChild(g); DE.Audio.sfx('launch', 200);
    st.missiles.push({ g, a, T, t: 0, dmg, smoke: 0 });
    puff(a.x0, a.y0, 9, 'bf-smoke big');
  }
  function bez(a, t) { const u = 1 - t; return [u * u * a.x0 + 2 * u * t * a.x1 + t * t * a.x2, u * u * a.y0 + 2 * u * t * a.y1 + t * t * a.y2]; }
  function stepMissile(m, dt) {
    m.t += dt / m.T; const t = Math.min(1, m.t);
    const [x, y] = bez(m.a, t); const [x2, y2] = bez(m.a, Math.min(1, t + .01));
    const rot = Math.atan2(y2 - y, x2 - x) * 180 / Math.PI;
    m.g.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})`);
    m.smoke -= dt; if (m.smoke <= 0) { m.smoke = .035; puff(x - Math.cos(rot * Math.PI / 180) * 18, y - Math.sin(rot * Math.PI / 180) * 18, 4 + Math.random() * 3, 'bf-smoke'); }
    if (t >= 1) { m.g.remove(); explode(m.a.x2, m.a.y2, m.dmg); return false; }
    return true;
  }
  function explode(x, y, dmg) {
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', 'bf-boom'); g.setAttribute('transform', `translate(${x} ${y})`);
    let debris = ''; for (let i = 0; i < 7; i++) { const a = -Math.PI * (i + .5) / 7; debris += `<rect class="bf-debris" style="--dx:${(Math.cos(a) * 60).toFixed(0)}px;--dy:${(Math.sin(a) * 70).toFixed(0)}px" x="-3" y="-3" width="6" height="6" fill="#5a3a26" stroke="#1c1020" stroke-width="1.5"/>`; }
    g.innerHTML = `<circle class="bf-boom-flash" r="46" fill="url(#ow-sunglow)"/><circle class="bf-boom-ball" r="26" fill="#ffb13a" stroke="#1c1020" stroke-width="3"/><circle class="bf-boom-core" r="14" fill="#fff4a8"/>${debris}<ellipse class="bf-boom-scorch" cy="4" rx="34" ry="6" fill="#1c1020" opacity=".45"/>`;
    fx.appendChild(g); setTimeout(() => g.remove(), 1100); DE.Audio.sfx('boom', 150);
    for (let i = 0; i < 4; i++) puff(x + (Math.random() - .5) * 40, y - 10 - Math.random() * 20, 12 + Math.random() * 8, 'bf-smoke big');
    // splash damage
    st.zombies.forEach(z => { if (!z.dead && z.delay <= 0 && Math.abs(z.x - x) < 70) hit(z, dmg * (1 - Math.abs(z.x - x) / 90), true); });
    root.classList.add('shake'); setTimeout(() => root && root.classList.remove('shake'), 220);
  }
  function puff(x, y, r, cls) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', r.toFixed(1)); fx.appendChild(c); setTimeout(() => c.remove(), cls.includes('big') ? 1400 : 900); }
  function tracer(x1, y1, x2, y2, heavy) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
    l.setAttribute('class', 'bf-tracer' + (heavy ? ' heavy' : '')); fx.appendChild(l); setTimeout(() => l.remove(), 160);
    const sp = document.createElementNS(NS, 'circle'); sp.setAttribute('class', 'bf-spark'); sp.setAttribute('cx', x2.toFixed(1)); sp.setAttribute('cy', y2.toFixed(1)); sp.setAttribute('r', heavy ? 5 : 3.5); fx.appendChild(sp); setTimeout(() => sp.remove(), 200);
  }

  /* ---------- zombies ----------
   * Navigation is a per-lane queue: every zombie walks left until it touches the zombie ahead in its
   * lane or, at the head of the lane, the current DEFENSIVE FRONT — sandbag nest, a guard, the
   * ground turret or the bunker wall (frontX(), recomputed every frame as guards move). There they
   * attack. When the one ahead dies, the queue moves up. Steel hedgehogs slow them down.
   * How many fall before reaching the front follows the real odds (firepower vs. wave strength):
   * before the wave resolves a "kill budget" limits deaths; after it resolves the field plays out
   * the actual result (wiped out / wall held / breach). */
  const LANES = 5;
  function frontX() {
    const L = OW().LAYOUT; let f = L.wallR + 12;
    if (st.barricades >= 1) f = Math.max(f, 872);                       // sandbag nest in front of the wall
    if (st.turrets.some(t => t.px > L.wallR)) f = Math.max(f, 900);      // the ground turret on the right
    for (const id in st.guards) { const g = st.guards[id]; if (g.combat && g.x > L.wallR) f = Math.max(f, g.x + 26); }
    return f;
  }
  function spawnHorde(s) {
    st.zombies.forEach(z => z.el.remove()); st.zombies = [];
    const all = DE.Defense.waveComposition(DE.Defense.waveHp(s), s.defense.wave);
    const comp = all.slice(0, 24);
    const pw = DE.Defense.defensePower(s), hp = DE.Defense.waveHp(s);
    st.ratio = hp > 0 ? pw.total / hp : 1; st.kills = 0; st.resolved = false; st.result = null;
    // arrivals spread over the warning window: a steady trickle instead of one big clump
    const secs = Math.max(20, (s.defense.nextWaveAt - Date.now()) / 1000);
    const gap = Math.max(1.1, Math.min(3.4, (secs - 14) / comp.length));
    comp.forEach((zd, i) => {
      const big = !!(zd.boss || zd.id === 'brute' || zd.id === 'mutant'); const h = zd.boss ? 120 : big ? 92 : 62;
      const speed = zd.id === 'runner' ? 70 : zd.id === 'leaper' ? 58 : zd.id === 'crawler' ? 34 : zd.boss ? 16 : big ? 22 : 28 + Math.random() * 6;
      const lane = i % LANES;
      const el = unit(DE.Chars.zombie(zd.id, { anim: zd.id === 'runner' ? 'run' : 'walk', h, flip: true, phase: Math.random() * 4, tint: ZTINT[(Math.random() * ZTINT.length) | 0] }), 'bf-z');
      const z = { el, rig: el.querySelector('.rig'), id: zd.id, big, boss: !!zd.boss, h, speed, lane, x: OW().W + 40, y: OW().GROUND + 2 + lane * 3,
        hp: zd.boss ? 4 : big ? 2.2 : 1, delay: i * gap + Math.random() * gap * .5, dead: false, through: false, retreat: false, mode: 'walk', atkCd: Math.random(), groanAt: 2 + Math.random() * 10,
        toxic: zd.id === 'toxic' || zd.id === 'cultist' };
      el.style.zIndex = 20 + lane; el.style.width = (h * 140 / 225) + 'px'; el.style.height = h + 'px'; el.style.visibility = 'hidden';
      place(z); st.zombies.push(z);
    });
    st.spawned = comp.length;
    st.killBudget = Math.round(comp.length * Math.min(1, st.ratio) * .9);
  }
  function place(z) { put(z.el, z.x - z.h * 70 / 225, z.y - z.h * 215 / 225); }

  /** A shot lands on a zombie: knock-back, flash, blood; it dies when out of health — unless the
   * odds say it should still reach the wall (kill budget, or it is one of a breach's survivors). */
  function hit(z, k, heavy) {
    if (z.dead || z.through) return;
    z.hp -= .38 * k;
    const protectedNow = (!st.resolved && st.kills >= st.killBudget) || (st.resolved && z.survivor);
    if (protectedNow) z.hp = Math.max(.12, z.hp);
    z.x += heavy ? 7 : 4; place(z);
    z.el.classList.remove('pinged'); void z.el.offsetWidth; z.el.classList.add('pinged');
    blood(z.x, z.y - z.h * (.45 + Math.random() * .25), heavy ? 6 : 4, z.toxic);
    DE.Audio.sfx('splat');
    if (z.hp <= 0) kill(z);
  }
  function kill(z) {
    if (z.dead) return;
    z.dead = true; st.kills++; anim(z.rig, 'die'); z.el.classList.add('dead');
    pool(z.x - 10, z.y, z.big ? 34 : 22, z.toxic);
    blood(z.x, z.y - z.h * .5, z.big ? 12 : 8, z.toxic);
    DE.Audio.sfx(z.big ? 'bigdie' : 'zdie', 90);
    if (z.big) { root.classList.add('shake'); setTimeout(() => root && root.classList.remove('shake'), 220); }
    setTimeout(() => z.el.remove(), 1800);
  }
  /* blood: droplets that arc out and a pool decal that fades — stylised, dark red (green for toxic) */
  function blood(x, y, n, toxic) {
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', (1.6 + Math.random() * 2.2).toFixed(1));
      c.setAttribute('class', 'bf-drop' + (toxic ? ' tox' : ''));
      c.style.setProperty('--dx', ((Math.random() * .8 + .2) * 34 * (Math.random() < .8 ? 1 : -1)).toFixed(0) + 'px'); c.style.setProperty('--dy', (8 + Math.random() * 22).toFixed(0) + 'px');
      fx.appendChild(c); setTimeout(() => c.remove(), 650);
    }
  }
  function pool(x, y, r, toxic) {
    const e = document.createElementNS(NS, 'ellipse'); e.setAttribute('cx', x.toFixed(1)); e.setAttribute('cy', (y + 2).toFixed(1)); e.setAttribute('rx', r); e.setAttribute('ry', (r * .22).toFixed(1));
    e.setAttribute('class', 'bf-pool' + (toxic ? ' tox' : '')); decals.appendChild(e); setTimeout(() => e.remove(), 9000);
    while (decals.children.length > 40) decals.firstChild.remove();
  }
  function dust(x, y) {
    for (let i = 0; i < 3; i++) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', (x + (Math.random() - .5) * 10).toFixed(1)); c.setAttribute('cy', (y + (Math.random() - .5) * 16).toFixed(1)); c.setAttribute('r', (3 + Math.random() * 4).toFixed(1)); c.setAttribute('class', 'bf-smoke'); fx.appendChild(c); setTimeout(() => c.remove(), 900); }
  }

  function stepZombies(dt) {
    const front = frontX();
    st.front = front;
    for (let lane = 0; lane < LANES; lane++) {
      const q = st.zombies.filter(z => z.lane === lane && !z.dead && !z.through && !z.retreat && z.delay <= 0).sort((a, b) => a.x - b.x);
      q.forEach((z, k) => {
        const ahead = q[k - 1];
        const gapX = ahead ? (ahead.big || z.big ? 40 : 26) : 0;
        const stop = ahead ? ahead.x + gapX : front + lane * 5;
        let spd = z.speed;
        if (st.barricades >= 2 && z.id !== 'leaper' && z.x > 960 && z.x < 1190) spd *= .45;   // steel hedgehogs
        if (z.x > stop + .5) {
          z.x = Math.max(stop, z.x - spd * dt); if (z._v !== spd) { z._v = spd; DE.UI.Anim.speed(z.rig, spd); }
          if (z.mode !== 'walk') { z.mode = 'walk'; anim(z.rig, z.id === 'runner' ? 'run' : 'walk'); }
        } else {
          // at the front of the lane: attack the defence; queued behind: press on (attacks the air when close)
          const atFront = !ahead;
          const mode = atFront || front + 70 > z.x ? 'attack' : 'idle';
          if (z.mode !== mode) { z.mode = mode; anim(z.rig, mode); }
          if (atFront) {
            z.atkCd -= dt;
            if (z.atkCd <= 0) {
              z.atkCd = .75 + Math.random() * .5;
              dust(z.x - 14, z.y - z.h * .45);
              DE.Audio.sfx('thud', 160);
              const g = guardAt(z.x - 26);
              if (g) { g.el.classList.remove('pinged'); void g.el.offsetWidth; g.el.classList.add('pinged'); }
              else if (z.x - 20 < OW().LAYOUT.wallR + 30) { const b = document.querySelector('#scene .ow-bunker'); if (b) { b.classList.remove('struck'); void b.getBBox; b.classList.add('struck'); } }
              // a breach: the survivors at the front force their way in
              if (st.resolved && st.result && st.result.breach && z.survivor && (z.blows = (z.blows || 0) + 1) > 2) { z.through = true; anim(z.rig, 'run'); }
            }
          }
        }
        place(z);
      });
    }
    // entering the field, groaning, breaking through, retreating
    st.zombies.forEach(z => {
      if (z.dead) return;
      if (z.delay > 0) { z.delay -= dt; if (z.delay <= 0) z.el.style.visibility = ''; return; }
      if ((z.groanAt -= dt) <= 0) { z.groanAt = 5 + Math.random() * 9; if (z.x < OW().W) DE.Audio.sfx(z.big ? 'groanbig' : 'groan', 700); }
      if (z.through) { z.x -= z.speed * 1.6 * dt; place(z); if (z.x < OW().LAYOUT.doorX + 30) { z.dead = true; z.el.classList.add('gone'); setTimeout(() => z.el.remove(), 600); } }
      else if (z.retreat) { z.x += z.speed * dt; face(z.rig, false); if (z.mode !== 'walk') { z.mode = 'walk'; anim(z.rig, 'walk'); } place(z); if (z.x > OW().W + 30) { z.dead = true; z.el.remove(); } }
    });
  }
  function guardAt(x) { for (const id in st.guards) { const g = st.guards[id]; if (g.combat && Math.abs(g.x - x) < 30) return g; } return null; }

  /* ---------- guards ---------- */
  function syncGuards(s) {
    const list = DE.Survivors.guards(s).slice(0, 8); const seen = {};
    list.forEach((g, i) => {
      seen[g.id] = true; let u = st.guards[g.id];
      if (!u || u.prof !== g.profession) {
        if (u) u.el.remove();
        const el = unit(DE.Chars.crew(g.profession, { anim: 'walk', h: 64, phase: Math.random() * 4, item: DE.Chars.dutyWeapon(g.profession), title: g.name }), 'bf-guard');
        el.style.width = (64 * 140 / 225) + 'px'; el.style.height = '64px'; el.title = g.name + ' · on guard';
        u = st.guards[g.id] = { el, rig: el.querySelector('.rig'), prof: g.profession, x: PATROL[0] + Math.random() * (PATROL[1] - PATROL[0]), y: OW().GROUND + 8, dir: Math.random() < .5 ? -1 : 1, pause: 0, cd: Math.random() };
      }
      u.i = i; u.n = list.length;
    });
    for (const id in st.guards) if (!seen[id]) { st.guards[id].el.remove(); delete st.guards[id]; }
  }
  const RANGE = 480;
  function stepGuard(u, dt, live) {
    const combat = (st.incoming || st.fighting) && live.length;
    u.combat = !!combat;
    if (combat) {
      // firing line in front of the bunker wall (inside the sandbag nest when built), spread out;
      // without cover a guard steps back when a zombie gets into arm's reach
      let post = 760 + (u.i % 4) * 30 - Math.floor(u.i / 4) * 18;
      const nearest = live.reduce((b, z) => (!b || z.x < b.x ? z : b), null);
      if (st.barricades < 1 && nearest && nearest.x - u.x < 34) u.hold = Math.max(OW().LAYOUT.wallR + 34, (u.hold || u.x) - 30 * dt);
      else if (st.barricades >= 1) u.hold = null;
      if (u.hold) post = Math.min(post, u.hold);
      if (Math.abs(u.x - post) > 2) { const d = Math.sign(post - u.x); DE.UI.Anim.speed(u.rig, u.hold ? 30 : 70); u.x += d * (u.hold ? 30 : 70) * dt; if (Math.sign(post - u.x) !== d) u.x = post; face(u.rig, d < 0 && !u.hold); anim(u.rig, u.hold ? 'shoot' : 'run'); }
      else {
        face(u.rig, false); u.cd -= dt;
        const z = live.filter(q => q.x - u.x < RANGE && q.x > u.x).reduce((b, q) => (!b || q.x < b.x ? q : b), null);
        if (!z) anim(u.rig, 'guard');
        else if (u.cd <= 0) {
          u.cd = .45 + Math.random() * .45; anim(u.rig, 'shoot'); DE.Audio.sfx('shot');
          const mx = u.x + 64 * .44, my = u.y - 64 * .55;
          tracer(mx, my, z.x, z.y - z.h * (.4 + Math.random() * .3), false); hit(z, .6, false);
          casing(mx - 10, my);
        }
      }
    } else {
      u.hold = null;
      // patrol: each guard walks its own stretch of grass, pausing at the ends to look around
      const span = (PATROL[1] - PATROL[0]) / u.n, a = PATROL[0] + u.i * span, b = a + span;
      if (u.pause > 0) { u.pause -= dt; anim(u.rig, 'guard'); }
      else {
        u.x += u.dir * 24 * dt; DE.UI.Anim.speed(u.rig, 24); anim(u.rig, 'walk'); face(u.rig, u.dir < 0);
        if (u.x < a) { u.x = a; u.dir = 1; u.pause = 1.2 + Math.random() * 2; } else if (u.x > b) { u.x = b; u.dir = -1; u.pause = 1.2 + Math.random() * 2; }
      }
    }
    put(u.el, u.x - 64 * 70 / 225, u.y - 64 * 215 / 225);
  }
  function casing(x, y) {
    const r = document.createElementNS(NS, 'rect'); r.setAttribute('x', x.toFixed(1)); r.setAttribute('y', y.toFixed(1)); r.setAttribute('width', 4); r.setAttribute('height', 2); r.setAttribute('class', 'bf-casing');
    fx.appendChild(r); setTimeout(() => r.remove(), 600); if (Math.random() < .25) DE.Audio.sfx('casing', 120);
  }

  /* ---------- expedition party: walks out along the road ---------- */
  function syncParty(s) {
    const members = []; s.expeditions.active.forEach(e => e.survivors.forEach(id => { const sv = s.survivors[id]; if (sv) members.push(sv); }));
    const seen = {};
    members.slice(0, 6).forEach((m, i) => {
      seen[m.id] = true; if (st.party[m.id]) return;
      const el = unit(DE.Chars.crew(m.profession, { anim: 'walk', h: 56, phase: Math.random() * 2 }), 'bf-party'); el.style.width = (56 * 140 / 225) + 'px'; el.style.height = '56px'; el.title = m.name + ' · on expedition';
      st.party[m.id] = { el, x: OW().LAYOUT.doorX - i * 26, y: OW().GROUND - 6 };
    });
    for (const id in st.party) if (!seen[id]) { st.party[id].el.remove(); delete st.party[id]; }
  }
  function stepParty(p, dt) { if (!p.v) { p.v = 34; DE.UI.Anim.speed(p.el.querySelector('.rig'), 34); } p.x += 34 * dt; if (p.x > OW().W + 40) p.x = OW().LAYOUT.doorX; put(p.el, p.x - 56 * 70 / 225, p.y - 56 * 215 / 225);  }

  /* ---------- loop ---------- */
  function frame(t) {
    raf = 0; if (!running || !root || !root.isConnected) { running = false; return; }
    const dt = Math.min(.05, Math.max(0, (t - (lastT || t)) / 1000)); lastT = t;
    if (!document.hidden) {
      const live = st.zombies.filter(z => !z.dead && !z.through && !z.retreat && z.delay <= 0 && z.x < OW().W - 10);
      stepZombies(dt);
      st.turrets.forEach(tu => stepTurret(tu, dt, live));
      if (st.launcher) stepLauncher(st.launcher, dt, live);
      st.missiles = st.missiles.filter(m => stepMissile(m, dt));
      for (const id in st.guards) stepGuard(st.guards[id], dt, live);
      for (const id in st.party) stepParty(st.party[id], dt);
      if (st.fighting) checkFightEnd();
      st.zombies = st.zombies.filter(z => z.el.isConnected);
    }
    raf = requestAnimationFrame(frame);
  }

  /** Called every UI tick from the bunker view. */
  function sync(s, flags) {
    if (!ensure()) return;
    st.barricades = (s.overworld && s.overworld.barricades) || 0;
    syncTurrets(s); syncLauncher(s); syncGuards(s); syncParty(s);
    st.incoming = !!flags.incoming;
    if (st.incoming && st.wave !== s.defense.wave && !st.fighting) { st.wave = st.hordeWave = s.defense.wave; spawnHorde(s); DE.Audio.sfx('alarm', 5000); }
    if (!st.incoming && !st.fighting && st.zombies.length && st.wave !== -1) { st.zombies.forEach(z => z.el.remove()); st.zombies = []; st.wave = -1; }
    const animOn = s.settings.animations;
    if (animOn && !running) { running = true; lastT = 0; raf = requestAnimationFrame(frame); }
    if (!animOn && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    if (!animOn) staticPose();
  }
  /** Without animations: units stand still in sensible places. */
  function staticPose() {
    for (const id in st.guards) { const u = st.guards[id]; const span = (PATROL[1] - PATROL[0]) / u.n; u.x = PATROL[0] + (u.i + .5) * span; anim(u.rig, 'guard'); face(u.rig, false); put(u.el, u.x - 64 * 70 / 225, u.y - 64 * 215 / 225); }
    const f = frontX(); const per = {};
    st.zombies.forEach(z => { if (!z.dead) { const k = per[z.lane] = (per[z.lane] || 0) + 1; z.x = f + z.lane * 5 + (k - 1) * 26; z.el.style.visibility = ''; place(z); } });
  }

  /** A wave just resolved: the field now plays out the real result. */
  function fight(result) {
    if (!ensure()) return;
    const s = DE.UI.state();
    // a horde only appears here if none was spawned for this wave (e.g. the page was opened mid-wave)
    if (st.hordeWave !== result.wave && s) { spawnHorde(s); st.zombies.forEach((z, i) => { z.delay = i * .35; z.x = 1250 + Math.random() * 300; }); }
    st.resolved = true; st.result = result; st.fighting = true; st.fightStart = performance.now();
    // anyone still waiting off-screen comes in quickly now
    st.zombies.forEach(z => { if (z.delay > 3) z.delay = 1 + Math.random() * 2; });
    if (result.breach) { const live = st.zombies.filter(z => !z.dead); live.forEach((z, i) => { if (i % 5 < 2) z.survivor = true; }); }
    if (!running) { st.zombies.forEach(z => z.survivor ? (z.el.remove(), z.dead = true) : kill(z)); endFight(); }
  }
  /** The fight ends when the field is clear. Zombies never turn back: whatever the guards and turrets
   * leave standing at the wall is finished off by the crew from the wall top, one at a time
   * (a shot from the parapet), so the horde always comes in, attacks and dies at the bunker. */
  function checkFightEnd() {
    const now = performance.now(), age = (now - st.fightStart) / 1000;
    const live = st.zombies.filter(z => !z.dead && !z.through && !z.retreat);
    if (!live.length) { endFight(); return; }
    const shooters = Object.keys(st.guards).length + st.turrets.length + (st.launcher ? 1 : 0);
    // give the defenders their moment first; then the wall crew clears the ones hammering at it
    if (age > (shooters ? 16 : 7) && now >= (st.wallShotAt || 0)) {
      const z = live.filter(z => !(st.result && st.result.breach && z.survivor) && z.delay <= 0 && (z.x < (st.front || 700) + 140 || age > 26)).sort((a, b) => a.x - b.x)[0];
      if (z) { wallShot(z); st.wallShotAt = now + (age > 26 ? 120 : 420 + Math.random() * 300); }
    }
    if (age > 34) { live.forEach(z => { if (!(st.result && st.result.breach && z.survivor)) kill(z); }); endFight(); }
  }
  /** A survivor on the wall top fires down at a zombie. */
  function wallShot(z) {
    const L = OW().LAYOUT, x0 = L.wallR - 8, y0 = L.roofY + 8;
    tracer(x0, y0, z.x, z.y - z.h * .55, z.big);
    DE.Audio.sfx('shot', 60);
    if (z.big && !z.wallHit) { z.wallHit = true; blood(z.x, z.y - z.h * .5, 5, z.toxic); return; }   // big ones take two
    kill(z);
  }
  function endFight() {
    st.fighting = false; st.resolved = false; st.wallShotAt = 0;
    // anything still out there (stragglers that never reached the wall) falls where it stands
    st.zombies.forEach(z => { if (!z.dead && !z.through && !z.retreat) kill(z); });
    st.wave = -1;
  }
  function status() { return { zombies: st.zombies.filter(z => !z.dead).length, turrets: st.turrets.map(t => ({ x: t.px, y: t.py, a: +t.a.toFixed(1), target: t.target ? t.target.x : null })), launcher: st.launcher ? { a: st.launcher.a, cd: st.launcher.cd } : null, missiles: st.missiles.length, guards: Object.values(st.guards).map(g => ({ x: +g.x.toFixed(1), y: g.y })), fighting: st.fighting, incoming: st.incoming, front: st.front, kills: st.kills, budget: st.killBudget, zs: st.zombies.filter(z => !z.dead).map(z => ({ id: z.id, x: Math.round(z.x), lane: z.lane, mode: z.mode, d: +z.delay.toFixed(1), t: z.through, r: z.retreat })) }; }

  return { sync, fight, status };
})();
