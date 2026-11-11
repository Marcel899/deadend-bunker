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
  const NS = 'http://www.w3.org/2000/svg';
  const OW = () => DE.UI.Overworld;
  let root = null, world = null, fx = null, scaleSig = '';
  let raf = 0, lastT = 0, running = false;
  const st = { zombies: [], turrets: [], guards: {}, party: {}, missiles: [], launcher: null, incoming: false, fighting: false, fightEnd: 0, breach: false, wave: -1, turretSig: '', missileLvl: 0 };

  /* turret mounts in order of purchase: [x, baseY, ground?] */
  const MOUNTS = () => { const G = OW().GROUND, R = OW().LAYOUT.roofY; return [[262, R, false], [638, R, false], [118, G, true], [866, G, true], [330, R, false], [570, R, false], [56, G, true], [700, G, true]]; };
  const FENCE = () => OW().LAYOUT.fenceX;
  const PATROL = [70, 900];

  /* ---------- layer ---------- */
  function ensure() {
    const scene = document.getElementById('scene'); if (!scene) return false;
    if (!root || !root.isConnected) {
      root = document.createElement('div'); root.className = 'bf'; root.id = 'bf';
      root.innerHTML = `<div class="bf-world"><svg class="bf-fx" viewBox="0 0 ${OW().W} ${OW().H}" width="${OW().W}" height="${OW().H}" aria-hidden="true"></svg></div>`;
      scene.appendChild(root); world = root.firstChild; fx = world.firstChild; scaleSig = '';
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
  function anim(rig, a) { if (!rig || rig.dataset.anim === a) return; rig.dataset.anim = a; rig.classList.forEach(c => { if (c.startsWith('a-')) rig.classList.remove(c); }); rig.classList.add('a-' + a); }
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
      if (!t.target || t.target.dead) t.target = live.reduce((b, z) => (!b || Math.abs(z.x - t.px) < Math.abs(b.x - t.px) ? z : b), null);
      const z = t.target; const aimY = z.y - z.h * .5;
      want = Math.atan2(aimY - t.py, z.x - t.px) * 180 / Math.PI;
    } else { t.target = null; t.scan += dt; want = -6 + Math.sin(t.scan * .5) * 12; }
    const d = ang(want - t.a); const turn = 160 * dt;
    t.a = ang(t.a + Math.max(-turn, Math.min(turn, d))); aimHead(t);
    // fire only once the barrel is on target
    if (t.target && Math.abs(d) < 3 && t.cd <= 0 && (st.incoming || st.fighting) && t.target.x < OW().W - 10) {
      t.cd = .32 + Math.random() * .18;
      const r = t.a * Math.PI / 180; const mx = t.px + Math.cos(r) * 38, my = t.py + Math.sin(r) * 38;
      tracer(mx, my, t.target.x + (Math.random() - .5) * 8, t.target.y - t.target.h * (.35 + Math.random() * .3), true);
      t.flash.setAttribute('opacity', '1'); setTimeout(() => t.flash.setAttribute('opacity', '0'), 60);
      t.recoil.setAttribute('transform', 'translate(-3 0)'); setTimeout(() => t.recoil.removeAttribute('transform'), 70);
      hit(t.target, st.fighting ? 1 : .55);
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
    const ix = Math.max(FENCE() + 10, z.walking ? z.x - z.speed * T : z.x), iy = z.y - 4;
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
    fx.appendChild(g);
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
    fx.appendChild(g); setTimeout(() => g.remove(), 1100);
    for (let i = 0; i < 4; i++) puff(x + (Math.random() - .5) * 40, y - 10 - Math.random() * 20, 12 + Math.random() * 8, 'bf-smoke big');
    // splash damage
    st.zombies.forEach(z => { if (!z.dead && Math.abs(z.x - x) < 70) hit(z, dmg * (1 - Math.abs(z.x - x) / 90)); });
    root.classList.add('shake'); setTimeout(() => root && root.classList.remove('shake'), 220);
  }
  function puff(x, y, r, cls) { const c = document.createElementNS(NS, 'circle'); c.setAttribute('class', cls); c.setAttribute('cx', x.toFixed(1)); c.setAttribute('cy', y.toFixed(1)); c.setAttribute('r', r.toFixed(1)); fx.appendChild(c); setTimeout(() => c.remove(), cls.includes('big') ? 1400 : 900); }
  function tracer(x1, y1, x2, y2, heavy) {
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', x1.toFixed(1)); l.setAttribute('y1', y1.toFixed(1)); l.setAttribute('x2', x2.toFixed(1)); l.setAttribute('y2', y2.toFixed(1));
    l.setAttribute('class', 'bf-tracer' + (heavy ? ' heavy' : '')); fx.appendChild(l); setTimeout(() => l.remove(), 160);
    const sp = document.createElementNS(NS, 'circle'); sp.setAttribute('class', 'bf-spark'); sp.setAttribute('cx', x2.toFixed(1)); sp.setAttribute('cy', y2.toFixed(1)); sp.setAttribute('r', heavy ? 5 : 3.5); fx.appendChild(sp); setTimeout(() => sp.remove(), 200);
  }

  /* ---------- zombies ---------- */
  function spawnHorde(s) {
    st.zombies.forEach(z => z.el.remove()); st.zombies = [];
    const comp = DE.Defense.waveComposition(DE.Defense.waveHp(s), s.defense.wave).slice(0, 22);
    comp.forEach((zd, i) => {
      const big = !!(zd.boss || zd.id === 'brute' || zd.id === 'mutant'); const h = big ? 92 : 62;
      const speed = zd.id === 'runner' ? 74 : zd.id === 'leaper' ? 62 : zd.id === 'crawler' ? 38 : big ? 22 : 30;
      const lane = (i * 7) % 5;
      const el = unit(DE.Chars.zombie(zd.id, { anim: zd.id === 'runner' ? 'run' : 'walk', h, flip: true }), 'bf-z');
      const z = { el, rig: el.querySelector('.rig'), id: zd.id, big, h, speed, lane, x: OW().W + 30 + Math.random() * 60 + i * 34, y: OW().GROUND + 4 + lane * 3,
        stopX: FENCE() + 18 + lane * 9 + Math.random() * 70, hp: 1, delay: Math.random() * 5, walking: true, dead: false, through: false };
      el.style.zIndex = 20 + lane; el.style.width = (h * 140 / 225) + 'px'; el.style.height = h + 'px';
      place(z); st.zombies.push(z);
    });
  }
  function place(z) { put(z.el, z.x - z.h * 70 / 225, z.y - z.h * 215 / 225); }
  /** A shot lands. Before the wave resolves (incoming) they are only wounded; during the fight they die. */
  function hit(z, k) {
    if (z.dead) return;
    z.hp -= .34 * k; if (!st.fighting) z.hp = Math.max(.2, z.hp);
    z.el.classList.add('pinged'); setTimeout(() => z.el.classList.remove('pinged'), 140);
    if (z.hp <= 0 && !(st.breach && z.survivor)) kill(z);
  }
  function kill(z) { z.dead = true; z.walking = false; anim(z.rig, 'die'); z.el.classList.add('dead'); setTimeout(() => { z.el.remove(); }, 1600); }
  function stepZombie(z, dt) {
    if (z.dead) return;
    if (z.delay > 0) { z.delay -= dt; return; }
    if (z.through) { z.x -= z.speed * 1.4 * dt; place(z); if (z.x < OW().LAYOUT.doorX + 20) { z.dead = true; z.el.classList.add('gone'); setTimeout(() => z.el.remove(), 600); } return; }
    if (z.walking) { z.x -= z.speed * dt; if (z.x <= z.stopX) { z.x = z.stopX; z.walking = false; anim(z.rig, 'attack'); } place(z); }
  }

  /* ---------- guards ---------- */
  function syncGuards(s) {
    const list = DE.Survivors.guards(s).slice(0, 8); const seen = {};
    list.forEach((g, i) => {
      seen[g.id] = true; let u = st.guards[g.id];
      if (!u || u.prof !== g.profession) {
        if (u) u.el.remove();
        const el = unit(DE.Chars.crew(g.profession, { anim: 'walk', h: 64, item: DE.Chars.dutyWeapon(g.profession), title: g.name }), 'bf-guard');
        el.style.width = (64 * 140 / 225) + 'px'; el.style.height = '64px'; el.title = g.name + ' · on guard';
        u = st.guards[g.id] = { el, rig: el.querySelector('.rig'), prof: g.profession, x: PATROL[0] + Math.random() * (PATROL[1] - PATROL[0]), y: OW().GROUND + 8, dir: Math.random() < .5 ? -1 : 1, pause: 0, cd: Math.random() };
      }
      u.i = i; u.n = list.length;
    });
    for (const id in st.guards) if (!seen[id]) { st.guards[id].el.remove(); delete st.guards[id]; }
  }
  function stepGuard(u, dt, live) {
    const combat = (st.incoming || st.fighting) && live.length;
    if (combat) {
      // firing line behind the fence (sandbag nests when built), spread out
      const post = Math.min(FENCE() - 40, 760 + (u.i % 4) * 34 - Math.floor(u.i / 4) * 20);
      if (Math.abs(u.x - post) > 2) { const d = Math.sign(post - u.x); u.x += d * 70 * dt; if (Math.sign(post - u.x) !== d) u.x = post; face(u.rig, d < 0); anim(u.rig, 'run'); }
      else {
        face(u.rig, false); u.cd -= dt;
        if (u.cd <= 0) {
          const z = live.reduce((b, z) => (!b || z.x < b.x ? z : b), null);
          u.cd = .45 + Math.random() * .45; anim(u.rig, 'shoot');
          tracer(u.x + 64 * .44, u.y - 64 * .62, z.x, z.y - z.h * (.4 + Math.random() * .3), false); hit(z, .6);
        }
      }
    } else {
      // patrol: each guard walks its own stretch of grass, pausing at the ends to look around
      const span = (PATROL[1] - PATROL[0]) / u.n, a = PATROL[0] + u.i * span, b = a + span;
      if (u.pause > 0) { u.pause -= dt; anim(u.rig, 'guard'); }
      else {
        u.x += u.dir * 24 * dt; anim(u.rig, 'walk'); face(u.rig, u.dir < 0);
        if (u.x < a) { u.x = a; u.dir = 1; u.pause = 1.2 + Math.random() * 2; } else if (u.x > b) { u.x = b; u.dir = -1; u.pause = 1.2 + Math.random() * 2; }
      }
    }
    put(u.el, u.x - 64 * 70 / 225, u.y - 64 * 215 / 225);
  }

  /* ---------- expedition party: walks out along the road ---------- */
  function syncParty(s) {
    const members = []; s.expeditions.active.forEach(e => e.survivors.forEach(id => { const sv = s.survivors[id]; if (sv) members.push(sv); }));
    const seen = {};
    members.slice(0, 6).forEach((m, i) => {
      seen[m.id] = true; if (st.party[m.id]) return;
      const el = unit(DE.Chars.crew(m.profession, { anim: 'walk', h: 56 }), 'bf-party'); el.style.width = (56 * 140 / 225) + 'px'; el.style.height = '56px'; el.title = m.name + ' · on expedition';
      st.party[m.id] = { el, x: OW().LAYOUT.doorX - i * 26, y: OW().GROUND - 6 };
    });
    for (const id in st.party) if (!seen[id]) { st.party[id].el.remove(); delete st.party[id]; }
  }
  function stepParty(p, dt) { p.x += 34 * dt; if (p.x > OW().W + 40) p.x = OW().LAYOUT.doorX; put(p.el, p.x - 56 * 70 / 225, p.y - 56 * 215 / 225); p.el.style.opacity = p.x > OW().W - 60 ? .3 : 1; }

  /* ---------- loop ---------- */
  function frame(t) {
    raf = 0; if (!running || !root || !root.isConnected) { running = false; return; }
    const dt = Math.min(.05, Math.max(0, (t - (lastT || t)) / 1000)); lastT = t;
    if (!document.hidden) {
      const live = st.zombies.filter(z => !z.dead && z.delay <= 0 && z.x < OW().W);
      st.zombies.forEach(z => stepZombie(z, dt));
      st.turrets.forEach(tu => stepTurret(tu, dt, live));
      if (st.launcher) stepLauncher(st.launcher, dt, live);
      st.missiles = st.missiles.filter(m => stepMissile(m, dt));
      for (const id in st.guards) stepGuard(st.guards[id], dt, live);
      for (const id in st.party) stepParty(st.party[id], dt);
      if (st.fighting && performance.now() > st.fightEnd) endFight();
      st.zombies = st.zombies.filter(z => z.el.isConnected);
    }
    raf = requestAnimationFrame(frame);
  }

  /** Called every UI tick from the bunker view. */
  function sync(s, flags) {
    if (!ensure()) return;
    syncTurrets(s); syncLauncher(s); syncGuards(s); syncParty(s);
    st.incoming = !!flags.incoming;
    if (st.incoming && st.wave !== s.defense.wave && !st.fighting) { st.wave = s.defense.wave; spawnHorde(s); }
    if (!st.incoming && !st.fighting && st.zombies.length && st.wave !== -1) { st.zombies.forEach(z => z.el.remove()); st.zombies = []; st.wave = -1; }
    const animOn = s.settings.animations;
    if (animOn && !running) { running = true; lastT = 0; raf = requestAnimationFrame(frame); }
    if (!animOn && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    if (!animOn) staticPose();
  }
  /** Without animations: units stand still in sensible places. */
  function staticPose() {
    for (const id in st.guards) { const u = st.guards[id]; const span = (PATROL[1] - PATROL[0]) / u.n; u.x = PATROL[0] + (u.i + .5) * span; anim(u.rig, 'guard'); face(u.rig, false); put(u.el, u.x - 64 * 70 / 225, u.y - 64 * 215 / 225); }
    st.zombies.forEach(z => { if (!z.dead) { z.x = z.stopX; place(z); } });
  }

  /** A wave just resolved: the field plays out the result. */
  function fight(result) {
    if (!ensure()) return;
    if (!st.zombies.length) { const s = DE.UI.state(); if (s) spawnHorde(s); st.zombies.forEach(z => { z.delay = 0; z.x = z.stopX + 40 + Math.random() * 120; }); }
    st.fighting = true; st.breach = !!result.breach; st.fightEnd = performance.now() + 4200;
    // on a breach some of the horde gets through no matter what
    if (st.breach) st.zombies.forEach(z => { if (Math.random() < .4) z.survivor = true; });
    if (!running) { // animations off: resolve instantly
      st.zombies.forEach(z => z.survivor ? (z.el.remove(), z.dead = true) : kill(z)); st.fighting = false;
    }
  }
  function endFight() {
    st.fighting = false;
    st.zombies.forEach(z => { if (z.dead) return; if (st.breach && z.survivor) { z.through = true; z.walking = false; anim(z.rig, 'run'); } else kill(z); });
    st.breach = false; st.wave = -1;
  }
  function status() { return { zombies: st.zombies.filter(z => !z.dead).length, turrets: st.turrets.map(t => ({ x: t.px, y: t.py, a: +t.a.toFixed(1), target: t.target ? t.target.x : null })), launcher: st.launcher ? { a: st.launcher.a, cd: st.launcher.cd } : null, missiles: st.missiles.length, guards: Object.values(st.guards).map(g => ({ x: +g.x.toFixed(1), y: g.y })), fighting: st.fighting, incoming: st.incoming }; }

  return { sync, fight, status };
})();
