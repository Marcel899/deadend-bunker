/* The intro: a short cinematic the first time someone starts a new game. It never plays on its
 * own again after it has been finished or skipped (a flag in localStorage); Settings can replay it.
 *
 * One long stage in world units (the camera shows 1000 x 600 of it, letterboxed to fit any screen):
 *   x 0-1600     the city burning at dusk, ash falling, the dead shambling through the ruins
 *   x 1600-3000  a road at night under the moon: four strangers and one flashlight
 *   x 3000-4200  a hillside with a sealed hatch; the engineer cranks the wheel, warm light spills out
 *   y 600-1300   below the hatch: a ladder shaft and dark, dusty rooms whose lights come on
 * The camera glides between shots (CSS transitions on one transform), the characters are the game's
 * own rigs (animated by DE.UI.Anim), captions type themselves at the bottom, and the sound is the game's
 * synthesiser: wind, groans, the ratchet of the wheel, a creaking door, lights clanking on, a fanfare. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Intro = (function () {
  const KEY = 'deadend_intro_v1', INK = '#1c1020';
  const S = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const S2 = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
  let root = null, stage = null, world = null, timers = [], onEnd = null, running = false, k = 1;

  function seen() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function mark() { try { localStorage.setItem(KEY, '1'); } catch (e) { /* private mode: it may show again */ } }
  const sfx = (n, gap) => { try { DE.Audio.sfx(n, gap); } catch (e) { /* no audio */ } };
  function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }

  /* ---------- the sets ---------- */
  function city() {
    const r = rng(3); let s = `<defs><linearGradient id="in-dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e0c26"/><stop offset=".45" stop-color="#6a2238"/><stop offset=".72" stop-color="#e0683a"/><stop offset="1" stop-color="#f3a050"/></linearGradient>
      <radialGradient id="in-fire"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".4" stop-color="#ff7a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff3a1a" stop-opacity="0"/></radialGradient>
      <radialGradient id="in-sun"><stop offset="0" stop-color="#fff0b0"/><stop offset=".5" stop-color="#ffb46a" stop-opacity=".85"/><stop offset="1" stop-color="#ff7a3a" stop-opacity="0"/></radialGradient>
      <filter id="in-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="12"/></filter></defs>
      <rect width="1600" height="600" fill="url(#in-dusk)"/><circle cx="1180" cy="430" r="190" fill="url(#in-sun)"/><circle cx="1180" cy="430" r="70" fill="#ffd690" opacity=".9"/>`;
    // far skyline with lit windows
    for (let x = 0; x < 1600;) { const w = 50 + r() * 80, h = 90 + r() * 170; s += `<path d="M${x} 440 V${440 - h} h${w * .3} l${w * .15} ${-10 - r() * 20} l${w * .2} ${12 + r() * 20} h${w * .35} V440 Z" fill="#3a1830"/>`; for (let i = 0; i < 4; i++) if (r() < .5) s += `<rect class="in-win" x="${(x + 8 + r() * (w - 20)).toFixed(0)}" y="${(440 - h + 20 + r() * (h - 40)).toFixed(0)}" width="6" height="8" fill="#ffcf6a" opacity=".8" style="animation-delay:${(r() * 4).toFixed(1)}s"/>`; x += w + 6; }
    // fires and smoke columns
    [[260, 420], [690, 430], [1010, 420], [1430, 435]].forEach(([x, y], i) => {
      s += `<circle class="in-fire" cx="${x}" cy="${y}" r="70" fill="url(#in-fire)" style="animation-delay:${i * .4}s"/>`;
      s += `<g class="in-smoke" filter="url(#in-blur)" style="animation-delay:${i * 1.3}s">${[0, 1, 2, 3].map(j => `<circle cx="${x + j * 14 - 18}" cy="${y - 40 - j * 55}" r="${24 + j * 12}" fill="#1e1018" opacity="${(.6 - j * .12).toFixed(2)}"/>`).join('')}</g>`;
    });
    // nearer ruins, cracked and broken
    for (let x = -40; x < 1640;) { const w = 120 + r() * 120, h = 140 + r() * 140; s += `<path d="M${x} 480 V${480 - h} l${w * .25} ${-14} l${w * .1} ${24} l${w * .3} ${-30} l${w * .35} ${40} V480 Z" fill="#241220" ${S}/>`;
      for (let i = 0; i < 5; i++) s += `<rect x="${(x + 14 + (i % 3) * (w / 3.4)).toFixed(0)}" y="${(480 - h + 40 + Math.floor(i / 3) * 50).toFixed(0)}" width="14" height="18" fill="${r() < .25 ? '#ff9a4a' : '#160a14'}" opacity=".9"/>`;
      x += w + 70 + r() * 90; }
    // street: rubble, a burned-out car, a bent lamp post
    s += `<rect y="470" width="1600" height="130" fill="#2a1c18"/><path d="M0 470 H1600" stroke="${INK}" stroke-width="5"/><rect y="520" width="1600" height="8" fill="#3a2a24"/>`;
    for (let i = 0; i < 26; i++) { const x = r() * 1600, w = 8 + r() * 18; s += `<path d="M${x.toFixed(0)} ${485 + r() * 100} l${w * .4} ${-w * .7} l${w} ${w * .2} l${w * .3} ${w * .6} z" fill="#4a3a34" ${S2}/>`; }
    s += `<g transform="translate(560 500)"><path d="M0 0 h150 l-14 -34 h-40 l-20 -24 h-44 l-14 24 h-18 z" fill="#3a2a2a" ${S}/><circle cx="34" cy="2" r="14" fill="#1a1416" ${S2}/><circle cx="118" cy="2" r="14" fill="#1a1416" ${S2}/><circle class="in-fire" cx="70" cy="-40" r="34" fill="url(#in-fire)"/></g>`;
    s += `<g transform="translate(1260 470)"><path d="M0 0 V-130 q0 -16 18 -10 l40 18" fill="none" stroke="${INK}" stroke-width="8"/><path d="M0 0 V-130 q0 -16 18 -10 l40 18" fill="none" stroke="#4a4458" stroke-width="4"/></g>`;
    return s;
  }
  function road() {
    const r = rng(7); let s = `<defs><linearGradient id="in-night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07061a"/><stop offset=".7" stop-color="#1e1a3e"/><stop offset="1" stop-color="#2e2650"/></linearGradient>
      <radialGradient id="in-moon"><stop offset="0" stop-color="#fffbe0" stop-opacity=".6"/><stop offset="1" stop-color="#fffbe0" stop-opacity="0"/></radialGradient>
      <linearGradient id="in-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff4a8" stop-opacity=".55"/><stop offset="1" stop-color="#fff4a8" stop-opacity="0"/></linearGradient></defs>
      <rect width="1400" height="600" fill="url(#in-night)"/>`;
    for (let i = 0; i < 70; i++) s += `<circle class="in-star" cx="${(r() * 1400).toFixed(0)}" cy="${(r() * 330).toFixed(0)}" r="${(.8 + r() * 1.6).toFixed(1)}" fill="#fff" style="animation-delay:${(r() * 3).toFixed(1)}s"/>`;
    s += `<circle cx="1040" cy="120" r="120" fill="url(#in-moon)"/><circle cx="1040" cy="120" r="44" fill="#f4eccf" ${S2}/><circle cx="1026" cy="108" r="8" fill="#d8ceb0"/><circle cx="1054" cy="134" r="6" fill="#d8ceb0"/><circle cx="1050" cy="100" r="4" fill="#d8ceb0"/>`;
    s += `<path d="M0 420 Q160 330 330 400 T700 380 T1060 410 T1400 380 V600 H0 Z" fill="#14122a"/><path d="M0 450 Q220 400 420 440 T860 430 T1400 440 V600 H0 Z" fill="#1c1a30"/>`;
    [[120, 1], [380, .8], [930, 1.1], [1250, .9]].forEach(([x, sc]) => { s += `<g transform="translate(${x} 470) scale(${sc})"><path d="M0 0 V-90 M0 -60 l-26 -26 M0 -70 l22 -30 M-14 -74 l-10 -14 M10 -86 l10 -8" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M0 0 V-90 M0 -60 l-26 -26 M0 -70 l22 -30" fill="none" stroke="#3a2e3a" stroke-width="3" stroke-linecap="round"/></g>`; });
    s += `<rect y="468" width="1400" height="58" fill="#26222e"/><path d="M0 468 H1400 M0 526 H1400" stroke="${INK}" stroke-width="4"/><path d="M0 497 H1400" stroke="#c9b24a" stroke-width="3" stroke-dasharray="30 26" opacity=".6"/><rect y="526" width="1400" height="74" fill="#18141e"/>`;
    s += `<g transform="translate(640 480)"><path d="M-70 0 h140 l-10 -30 h-30 l-14 -22 h-50 l-14 22 h-16 z" fill="#5a3a2a" ${S} transform="rotate(-8)"/><circle cx="-44" cy="0" r="12" fill="#1a1416" ${S2}/><circle cx="40" cy="-10" r="12" fill="#1a1416" ${S2}/></g>`;
    s += `<g transform="translate(300 468)"><path d="M0 0 V-70" stroke="${INK}" stroke-width="6"/><path d="M-30 -86 h56 l10 10 l-10 10 h-56 z" fill="#3a6a3a" ${S2} transform="rotate(12 0 -76)"/><text x="0" y="-70" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="13" fill="#e8f0d8" transform="rotate(12 0 -76)">CITY 12</text></g>`;
    s += `<rect class="in-fog" x="-200" y="430" width="1800" height="120" fill="#8a86b0" opacity=".12"/>`;
    return s;
  }
  function hill() {
    const r = rng(11); let s = `<defs><linearGradient id="in-dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e0c26"/><stop offset=".6" stop-color="#3a2c5a"/><stop offset="1" stop-color="#8a5a6a"/></linearGradient>
      <linearGradient id="in-light" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe08a" stop-opacity=".85"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></linearGradient>
      <radialGradient id="in-glow"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".9"/><stop offset="1" stop-color="#ffb04a" stop-opacity="0"/></radialGradient></defs>
      <rect width="1200" height="600" fill="url(#in-dawn)"/>`;
    for (let i = 0; i < 40; i++) s += `<circle class="in-star" cx="${(r() * 1200).toFixed(0)}" cy="${(r() * 260).toFixed(0)}" r="${(.8 + r() * 1.4).toFixed(1)}" fill="#fff" style="animation-delay:${(r() * 3).toFixed(1)}s"/>`;
    s += `<path d="M-20 600 V430 Q200 300 470 250 Q640 220 800 280 Q1000 350 1220 420 V600 Z" fill="#3e4a2e" ${S}/><path d="M-20 600 V470 Q300 380 560 360 Q900 360 1220 460 V600 Z" fill="#33402a"/>`;
    for (let i = 0; i < 30; i++) { const x = 40 + r() * 1120, y = 300 + r() * 160; if (y < 250 + Math.abs(x - 560) * .3) continue; s += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l4 -10 l3 9 l4 -12 l3 13" fill="none" stroke="#5a6a3a" stroke-width="2.5" stroke-linecap="round"/>`; }
    // the hatch: a concrete collar in the hillside, a round steel door with a wheel
    s += `<g transform="translate(600 400)"><path d="M-110 70 V-40 Q-110 -86 0 -86 Q110 -86 110 -40 V70 Z" fill="#7a7684" ${S}/><path d="M-96 70 V-34 Q-96 -72 0 -72 Q96 -72 96 -34 V70 Z" fill="#141018"/>
      <g class="in-puffs">${Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1.05 + i * .11); return `<circle cx="0" cy="0" r="${10 + (i % 3) * 5}" fill="#b8ab9a" style="--px:${(Math.cos(a) * 120).toFixed(0)}px;--py:${(Math.sin(a) * 70 - 10).toFixed(0)}px;animation-delay:${(i * .04).toFixed(2)}s"/>`; }).join('')}</g>
      <g class="in-spill" opacity="0"><ellipse cx="0" cy="-6" rx="92" ry="72" fill="#ffd27a" opacity=".85"/><circle cx="0" cy="0" r="150" fill="url(#in-glow)"/><ellipse cx="10" cy="92" rx="210" ry="30" fill="url(#in-glow)"/></g>
      <g class="in-door"><circle r="66" fill="#5a5f6a" ${S}/><circle r="54" fill="#6c717c" ${S2}/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${(60 * Math.cos(i * Math.PI / 6)).toFixed(1)}" cy="${(60 * Math.sin(i * Math.PI / 6)).toFixed(1)}" r="3" fill="${INK}"/>`).join('')}
        <g class="in-wheel"><circle r="28" fill="none" stroke="${INK}" stroke-width="9"/><circle r="28" fill="none" stroke="#c93a3a" stroke-width="5"/><path d="M-28 0 H28 M0 -28 V28" stroke="${INK}" stroke-width="8"/><path d="M-28 0 H28 M0 -28 V28" stroke="#c93a3a" stroke-width="4"/><circle r="7" fill="#8a8e98" ${S2}/></g></g>
      <g transform="translate(-178 -30)"><path d="M0 0 V100" stroke="${INK}" stroke-width="6"/><rect x="-40" y="-44" width="80" height="48" rx="4" fill="#f0c020" ${S}/><circle cx="-22" cy="-20" r="11" fill="${INK}"/><path d="M-22 -31 l4 7 h-8 z M-11 -14 l-7 1 l3 -7 z M-33 -14 l4 -6 l3 7 z" fill="#f0c020"/><text x="12" y="-24" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="11" fill="${INK}">SHELTER</text><text x="12" y="-10" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="13" fill="${INK}">No. 7</text></g></g>`;
    [[180, 420, 1], [1010, 430, .9]].forEach(([x, y, sc]) => { s += `<g transform="translate(${x} ${y}) scale(${sc})"><path d="M0 0 V-80 M0 -50 l-22 -24 M0 -62 l20 -26" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M0 0 V-80 M0 -50 l-22 -24 M0 -62 l20 -26" fill="none" stroke="#3a2e3a" stroke-width="3" stroke-linecap="round"/></g>`; });
    return s;
  }
  /** Below the hatch: earth, a ladder shaft, two dark rooms (the game's own room art). */
  function below() {
    // the shaft: a ladder seen from the side (rail and rung stubs, the climbers face it), the light that
    // falls in through the opened hatch with dust drifting in it, a wall lamp, a vent fan in the corridor
    let s = `<div class="in-earth"></div><div class="in-shaft"><i></i><b class="in-beam"></b><span class="in-motes">${Array.from({ length: 9 }, (_, i) => `<u style="left:${8 + (i * 23) % 74}px;animation-delay:-${(i * 1.3).toFixed(1)}s;animation-duration:${(6 + (i % 4)).toFixed(0)}s"></u>`).join('')}</span><em class="in-lamp"></em></div>`
      + `<div class="in-fan"><i></i></div>`;
    const room = (type, x, w) => { const def = DE.Data.ROOMS[type]; return `<div class="in-room" style="left:${x}px;width:${w}px">${DE.Scenes.render({ type, level: 1, construction: null }, def, null)}<div class="in-dark"></div></div>`; };
    s += `<div class="in-corr"></div>` + room('quarters', 140, 400) + room('generator', 660, 200) + room('farm', 870, 200);
    return s;
  }

  /* ---------- camera, actors, captions ---------- */
  const VIEW_W = 1000, VIEW_H = 600;
  function fit() {
    if (!stage) return; const W = window.innerWidth, H = window.innerHeight;
    k = Math.min(W / VIEW_W, H / VIEW_H); stage.style.width = VIEW_W * k + 'px'; stage.style.height = VIEW_H * k + 'px';
    // letterboxed on a tall screen (an iPad held upright): caption and Skip sit right by the picture
    const free = (H - VIEW_H * k) / 2, cap = root.querySelector('.in-cap'), skip = root.querySelector('.in-skip');
    if (free > 110) { cap.style.bottom = (free - 76) + 'px'; skip.style.top = (free - 58) + 'px'; root.classList.add('tall'); }
    else { cap.style.bottom = ''; skip.style.top = ''; root.classList.remove('tall'); }
    if (world && world._cam) camera(world._cam[0], world._cam[1], world._cam[2], 0);
  }
  /** Point the camera at world centre (cx, cy) with zoom z, gliding over `dur` seconds. */
  function camera(cx, cy, z, dur, ease) {
    if (!world) return; world._cam = [cx, cy, z];
    const x = cx - VIEW_W / 2 / z, y = cy - VIEW_H / 2 / z;
    world.style.transition = dur ? `transform ${dur}s ${ease || 'cubic-bezier(.45,.05,.55,.95)'}` : 'none';
    world.style.transform = `scale(${(k * z).toFixed(4)}) translate(${(-x).toFixed(1)}px, ${(-y).toFixed(1)}px)`;
  }
  function actor(html, x, y, cls) { const el = document.createElement('div'); el.className = 'in-actor ' + (cls || ''); el.style.left = x + 'px'; el.style.top = y + 'px'; el.innerHTML = html; world.appendChild(el); return el; }
  function rigOf(el) { return el.querySelector('.rig'); }
  function setAnim(el, a, speed) { const r = rigOf(el); if (!r) return; Array.from(r.classList).forEach(c => { if (c.startsWith('a-')) r.classList.remove(c); }); r.classList.add('a-' + a); DE.UI.Anim.speed(r, speed || 0); }
  function move(el, dx, dy, dur, ease) { el.style.transition = `transform ${dur}s ${ease || 'linear'}`; el.style.transform = `translate(${dx}px, ${dy}px)`; }
  function caption(text) {
    const box = root.querySelector('.in-cap'); if (!box) return; box.classList.remove('show'); void box.offsetWidth;
    box.textContent = ''; box.classList.add('show'); let i = 0;
    const step = () => { if (!running) return; i++; box.textContent = text.slice(0, i); if (i < text.length) timers.push(setTimeout(step, 28)); };
    step();
  }
  const at = (ms, fn) => timers.push(setTimeout(() => { if (running) fn(); }, ms));

  /* ---------- the film ---------- */
  function play(done) {
    if (running) return; running = true; onEnd = done || null;
    root = document.createElement('div'); root.id = 'intro'; root.innerHTML = `<div class="in-stage"><div class="in-world">
      <svg class="in-set" style="left:0;top:0" width="1600" height="600" viewBox="0 0 1600 600">${city()}</svg>
      <svg class="in-set" style="left:1600px;top:0" width="1400" height="600" viewBox="0 0 1400 600">${road()}</svg>
      <svg class="in-set" style="left:3000px;top:0" width="1200" height="600" viewBox="0 0 1200 600">${hill()}</svg>
      <div class="in-below" style="left:3000px;top:600px">${below()}</div>
      <div class="in-ash">${Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 47) % 1600}px;animation-delay:${(i * .37 % 6).toFixed(2)}s;animation-duration:${(5 + (i % 5)).toFixed(1)}s"></i>`).join('')}</div>
      </div><div class="in-flash"></div><div class="in-vig"></div></div>
      <div class="in-bar top"></div><div class="in-bar bot"></div><div class="in-cap"></div>
      <button class="in-skip" type="button">Skip ▸▸</button>
      <div class="in-title"><img src="assets/ui/logo.png" alt="DEAD END: Underground"><p>It’s a dead end. Make it a home.</p><button class="btn primary in-go" type="button">Begin</button></div>`;
    document.body.appendChild(root);
    stage = root.querySelector('.in-stage'); world = root.querySelector('.in-world');
    root.querySelector('.in-skip').addEventListener('click', () => finish(true));
    root.querySelector('.in-go').addEventListener('click', () => finish(false));
    window.addEventListener('resize', fit); document.addEventListener('keydown', onKey);
    fit();
    try { DE.Audio.ensure(); DE.Audio.ambience('snow', 1); } catch (e) { /* no audio */ }

    // cast: the dead in the ruins, four survivors on the road
    const ZH = (z) => z === 'brute' ? 124 : 98;
    const Z = ['walker', 'runner', 'brute', 'walker', 'crawler', 'walker'].map((z, i) => actor(DE.Chars.zombie(z, { anim: 'walk', h: ZH(z), flip: true, phase: i * .7 }), 880 + i * 150 + (i % 2) * 40, 506 - ZH(z) + (i % 2) * 8, 'z'));
    const crew = ['engineer', 'scavenger', 'farmer', 'mechanic'], PH = 96;
    const P = crew.map((c, i) => actor(DE.Chars.crew(c, { anim: 'walk', h: PH, phase: i * .9, item: c === 'scavenger' ? 'flashlight' : undefined }), 1760 - i * 78, 500 - PH + (i % 2) * 4, 'p'));

    // 1 · the city burns (0-6.8s)
    camera(500, 300, 1, 0); setTimeout(() => camera(860, 290, 1.06, 6.8), 50);
    Z.forEach((z, i) => { DE.UI.Anim.speed(rigOf(z), 22); move(z, -170 - i * 10, 0, 7, 'linear'); });
    at(300, () => caption('When the dead rose, the cities fell in a week.'));
    at(900, () => sfx('groanbig')); at(2600, () => sfx('groan')); at(4300, () => sfx('groan'));
    at(3500, () => caption('Those who were left kept moving — and kept losing people.'));
    // 2 · the road at night (6.8-13.6s)
    at(6800, () => {
      flash(.5); camera(1960, 300, 1.12, 0);
      P.forEach(p => { setAnim(p, 'walk', 64); move(p, 440, 0, 6.9, 'linear'); });
      setTimeout(() => camera(2400, 300, 1.12, 6.8, 'linear'), 40);
      caption('Four strangers. One flashlight. No plan.');
    });
    // 3 · the hatch in the hill (13.6-21s)
    at(13600, () => {
      flash(.6); camera(3600, 330, 1.25, 0);
      P.forEach((p, i) => { p.style.transition = 'none'; p.style.left = (3330 - i * 80) + 'px'; p.style.top = (510 - PH) + 'px'; p.style.transform = 'none'; setAnim(p, 'walk', 64); });
      setTimeout(() => P.forEach((p, i) => move(p, 170 - i * 4, 0, 3.4, 'linear')), 40);
      caption('Then, in a hillside: a hatch. Sealed. Untouched.');
    });
    at(17000, () => { P.forEach((p, i) => setAnim(p, i === 0 ? 'repair' : 'idle')); camera(3600, 350, 1.55, 1.6); });
    at(17300, () => { root.querySelector('.in-wheel').classList.add('turn'); sfx('ratchet'); });
    at(18100, () => sfx('ratchet')); at(18800, () => sfx('clank'));
    at(19300, () => { root.querySelector('.in-door').classList.add('open'); root.querySelector('.in-spill').classList.add('on'); root.classList.add('opened'); sfx('creak'); P.forEach(p => setAnim(p, 'idle')); });
    // 4 · down into the dark (21-28s)
    at(21000, () => {
      caption('Below it: a shelter someone built for the end of the world.');
      camera(3600, 640, 1.15, 2.6);
      P.forEach((p, i) => { p.style.transition = 'opacity .4s'; p.style.opacity = '0'; });
    });
    // inside, people are drawn at room scale; one after the other they climb down the ladder, facing it,
    // hand over hand and rung by rung, step off at the bottom and spread out between the rooms
    const FLOOR_Y = 1079, IH = 74, TOP = 640, V = 80, CLIMB = (FLOOR_Y - TOP) / V, GAP = 1350;
    at(22600, () => {
      P.forEach(p => { const r = rigOf(p); r.style.height = IH + 'px'; r.style.width = Math.round(IH * 140 / 225) + 'px'; r.dataset.h = IH; p.style.transition = 'none'; p.style.left = '3600px'; p.style.top = (TOP - IH) + 'px'; p.style.transform = 'none'; p.style.opacity = '0'; r.classList.remove('flip'); });
      camera(3600, 760, 1.3, 1.4);
      setTimeout(() => camera(3600, 960, 1.08, CLIMB + 1.6, 'linear'), 1500);
    });
    P.forEach((p, i) => {
      const t0 = 23000 + i * GAP;
      at(t0, () => { p.style.transition = 'opacity .25s'; p.style.opacity = '1'; setAnim(p, 'climb', V); setTimeout(() => move(p, 0, FLOOR_Y - TOP, CLIMB, 'linear'), 30); });
      // a clink on the rungs for the first two climbers (the others are drowned out)
      if (i < 2) for (let k = 0; k < Math.floor(CLIMB * V / 25); k += 2) at(t0 + 200 + k * 25 / V * 1000, () => sfx('rung', 60));
      at(t0 + CLIMB * 1000 + 120, () => {
        sfx('thud', 200); setAnim(p, 'idle');
        const tx = [-300, -170, 190, 330][i];
        setTimeout(() => { if (!running) return; setAnim(p, 'walk', 70); rigOf(p).classList.toggle('flip', tx < 0); move(p, tx, FLOOR_Y - TOP, Math.abs(tx) / 110, 'linear');
          setTimeout(() => { if (running) setAnim(p, 'idle'); }, Math.abs(tx) / 110 * 1000); }, 350);
      });
    });
    // the generator coughs into life, the rooms light up one by one, the fan starts turning
    const lit = 23000 + 3 * GAP + CLIMB * 1000 + 900;
    at(lit, () => { sfx('powerup'); root.classList.add('powered'); });
    root.querySelectorAll('.in-dark').forEach((d, i) => at(lit + 500 + i * 650, () => { d.classList.add('on'); sfx('clank'); }));
    at(lit + 2600, () => say(P[1], 'Whoa...'));
    at(lit + 3600, () => say(P[0], 'Home, sweet home.'));
    // 5 · title
    at(lit + 5600, () => { caption(''); root.querySelector('.in-cap').classList.remove('show'); root.classList.add('titled'); sfx('reveal'); });
    at(lit + 13600, () => finish(false));
  }
  /** A little speech bubble over one of the cast. */
  function say(el, text) { if (!el) return; const b = document.createElement('span'); b.className = 'say good'; b.textContent = text; el.appendChild(b); void b.offsetWidth; b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 2400); setTimeout(() => b.remove(), 2800); }
  function flash(o) { const f = root && root.querySelector('.in-flash'); if (!f) return; f.style.transition = 'none'; f.style.opacity = o; void f.offsetWidth; f.style.transition = 'opacity .6s'; f.style.opacity = 0; }
  function onKey(e) { if (e.key === 'Escape') finish(true); else if (e.key === 'Enter' && root && root.classList.contains('titled')) finish(false); }
  function finish(skipped) {
    if (!running) return; running = false; mark();
    timers.forEach(clearTimeout); timers = [];
    window.removeEventListener('resize', fit); document.removeEventListener('keydown', onKey);
    try { DE.Audio.ambience('', 0); } catch (e) { /* no audio */ }
    const el = root; root = stage = world = null;
    if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 600); }
    const cb = onEnd; onEnd = null; if (cb) cb(!!skipped);
  }
  return { play, seen, running: () => running, finish };
})();
