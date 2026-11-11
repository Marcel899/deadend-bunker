/* Day / night cycle and seasons for the overworld.
 *
 * Time comes from state.playtime (saved, and advanced by offline catch-up), so the clock and the
 * season continue where you left them. One day lasts DAY_SEC real seconds; a season lasts
 * DAYS_PER_SEASON days (spring → summer → autumn → winter).
 *
 * Lighting is layered like a real exposure rather than recoloured art:
 *   1. the sky gradient, sun and moon move with the time of day (sun rises east, sets west),
 *   2. an ambient layer (mix-blend multiply) darkens and tints everything under it — cool blue
 *      moonlight at night, warm amber at dawn/dusk, neutral at noon,
 *   3. a light layer (mix-blend screen) adds the artificial lights — door lamp, lamp posts,
 *      tower lanterns, floodlights, lit windows — whose strength rises as the sun goes down,
 *   4. ground shadows stretch and swing away from the sun.
 * Seasons switch the vegetation palette, add snow, falling leaves, rain or snowfall. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.DayCycle = (function () {
  const DAY_SEC = 480, DAYS_PER_SEASON = 3;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const SEASON_NAME = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  const NS = 'http://www.w3.org/2000/svg';
  let built = null, lastKey = '';

  /* ---------- colour helpers ---------- */
  const hex = (c) => { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgb = (a) => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return rgb(x.map((v, i) => v + (y[i] - v) * t)); };
  const smooth = (t) => t * t * (3 - 2 * t);

  /* sky keyframes by hour: [top, middle, horizon] */
  const SKY = [
    [0, ['#070a1e', '#121a3e', '#1e2a52']], [4.5, ['#0b1030', '#1c2550', '#2c3666']], [5.5, ['#2a2560', '#8a4a7a', '#f08a5a']],
    [6.5, ['#3a5aa8', '#e2908a', '#ffc27a']], [8, ['#3f7fd0', '#86b9ea', '#d6ecf6']], [16, ['#3a7ccc', '#8cbce9', '#dcedf3']],
    [17.6, ['#4e3a8a', '#d26a5a', '#f6b45a']], [18.6, ['#3a1f5e', '#a2406a', '#e2703f']], [19.6, ['#141838', '#2a2a5a', '#46406e']], [24, ['#070a1e', '#121a3e', '#1e2a52']],
  ];
  /* ambient tint (multiply) by hour */
  const AMB = [[0, '#3a4a92'], [4.5, '#44549a'], [5.6, '#b88aa0'], [6.6, '#ffd2b0'], [8, '#ffffff'], [16, '#ffffff'], [17.5, '#ffd8b0'], [18.6, '#d08a8a'], [19.8, '#4a5aa0'], [24, '#3a4a92']];
  function keyed(list, h) {
    for (let i = 0; i < list.length - 1; i++) { const [h0, a] = list[i], [h1, b] = list[i + 1]; if (h >= h0 && h <= h1) { const t = smooth((h - h0) / (h1 - h0 || 1)); return Array.isArray(a) ? a.map((c, k) => mix(c, b[k], t)) : mix(a, b, t); } }
    return list[0][1];
  }

  /** Clock for a state: hour 0..24, day number, season id. */
  function clock(state) {
    const t = (state && state.playtime || 0) + DAY_SEC * 0.3;   // a new game starts mid-morning
    const dayF = t / DAY_SEC, day = Math.floor(dayF) + 1, hour = (dayF % 1) * 24;
    const season = SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % 4];
    const sunUp = hour >= 6 && hour <= 18.5;
    return { hour, day, season, sunUp, night: hour < 5.5 || hour > 19.5 };
  }
  /** 0 at full daylight … 1 in deep night. */
  function darkness(h) { if (h >= 7.5 && h <= 16.5) return 0; if (h < 4.5 || h > 19.8) return 1; return h < 12 ? 1 - smooth((h - 4.5) / 3) : smooth((h - 16.5) / 3.3); }

  /* ---------- scene layers ---------- */
  function build(scene) {
    const OW = DE.UI.Overworld, W = OW.W, H = OW.H, G = OW.GROUND, L = OW.LAYOUT;
    const amb = document.createElement('div'); amb.className = 'dc-ambient';
    const lights = document.createElementNS(NS, 'svg'); lights.setAttribute('class', 'ow-svg dc-lights'); lights.setAttribute('viewBox', `0 0 ${W} ${H}`); lights.setAttribute('preserveAspectRatio', 'xMidYMax slice');
    const pool = (x, y, r, c, cls, sy) => `<ellipse class="${cls || ''}" cx="${x}" cy="${y}" rx="${r}" ry="${r * (sy || 1)}" fill="url(#dc-${c})"/>`;
    const cone = (x, y, w, h, cls) => `<path class="${cls || ''}" d="M${x - 6} ${y} L${x - w / 2} ${y + h} H${x + w / 2} L${x + 6} ${y} Z" fill="url(#dc-cone)"/>`;
    lights.innerHTML = `<defs>
        <radialGradient id="dc-warm"><stop offset="0" stop-color="#ffd890" stop-opacity=".95"/><stop offset=".35" stop-color="#ffa850" stop-opacity=".45"/><stop offset="1" stop-color="#ff8a30" stop-opacity="0"/></radialGradient>
        <radialGradient id="dc-white"><stop offset="0" stop-color="#f4f8ff" stop-opacity=".95"/><stop offset=".4" stop-color="#cfe0ff" stop-opacity=".4"/><stop offset="1" stop-color="#a0c0ff" stop-opacity="0"/></radialGradient>
        <radialGradient id="dc-red"><stop offset="0" stop-color="#ff6a4a" stop-opacity=".9"/><stop offset="1" stop-color="#ff3a2a" stop-opacity="0"/></radialGradient>
        <linearGradient id="dc-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0c0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd080" stop-opacity="0"/></linearGradient>
        <radialGradient id="dc-moon"><stop offset="0" stop-color="#cfdcff" stop-opacity=".35"/><stop offset="1" stop-color="#8aa0ff" stop-opacity="0"/></radialGradient></defs>
      <g class="dc-art">
        ${pool(L.bunkerC, 410, 150, 'warm', '', .55)}${pool(L.bunkerC, G + 8, 170, 'warm', '', .12)}
        <g class="lv ge-lights-1">${[120, 500, 880].map(x => cone(x + 27, G - 128, 120, 128) + pool(x + 27, G - 128, 30, 'warm') + pool(x + 27, G + 6, 80, 'warm', '', .14)).join('')}</g>
        <g class="lv ge-towers-1">${[L.towerL, L.towerR].map(x => pool(x, 244, 70, 'warm', 'dc-flicker') + pool(x - 53, 154, 22, 'red', 'dc-blink')).join('')}</g>
        <g class="lv ge-lights-2">${[L.towerL, L.towerR].map(x => cone(x, 156, 320, G - 156) + pool(x, 156, 40, 'white') + pool(x, G + 6, 200, 'white', '', .12)).join('')}</g>
        <g class="dc-windows">${[[216, 277], [696, 277], [1050, 293], [1458, 305]].map(([x, y]) => pool(x, y, 26, 'warm', 'dc-flicker')).join('')}</g>
      </g>
      <ellipse class="dc-moonglow" cx="0" cy="0" rx="160" ry="160" fill="url(#dc-moon)"/>`;
    const fx = document.createElement('div'); fx.className = 'dc-weather';
    // weather particles: cheap CSS-animated spans, generated once
    let p = ''; for (let i = 0; i < 70; i++) { const x = (i * 37.3) % 100, d = (i * 0.61) % 7, dur = 4 + (i * 13 % 50) / 10, s = 2 + (i % 4); p += `<i style="left:${x.toFixed(1)}%;animation-delay:-${d.toFixed(1)}s;animation-duration:${dur.toFixed(1)}s;--s:${s}px;--dx:${(i % 7) * 6 - 18}px"></i>`; }
    fx.innerHTML = p;
    const chip = document.createElement('div'); chip.className = 'dc-chip';
    // order: art SVG, battlefield, then ambient darkness, then lights, then weather, then UI overlay
    const bf = scene.querySelector('.bf');
    const after = bf ? bf.nextSibling : scene.querySelector('.ow-overlay');
    scene.insertBefore(amb, after); scene.insertBefore(lights, after); scene.insertBefore(fx, after);
    (scene.querySelector('.ow-overlay') || scene).appendChild(chip);
    built = { scene, amb, lights, fx, chip, svg: scene.querySelector('.ow-svg:not(.dc-lights)') };
    built.stops = Array.from(built.svg.querySelectorAll('#ow-sky stop'));
    built.sun = built.svg.querySelector('.ow-sunwrap'); built.stars = built.svg.querySelector('.ow-stars');
    built.moon = built.svg.querySelector('.dc-moon'); built.shadows = built.svg.querySelectorAll('.ow-shadows');
    built.rays = built.svg.querySelector('.ow-godrays'); built.haze = built.svg.querySelector('.ow-horizonhaze');
    built.moonGlow = lights.querySelector('.dc-moonglow');
    built.cloudStops = Array.from(built.svg.querySelectorAll('#ow-cloudbody stop'));
  }

  function update(state) {
    const scene = document.getElementById('scene'); if (!scene || !state) return;
    if (!built || built.scene !== scene || !built.amb.isConnected) { built = null; build(scene); }
    const c = clock(state), h = c.hour, dark = darkness(h);
    const key = Math.round(h * 20) + c.season; if (key === lastKey) return; lastKey = key;
    // sky
    const [top, mid, hor] = keyed(SKY, h);
    const cols = [top, mix(top, mid, .5), mid, mix(mid, hor, .45), hor, hor];
    built.stops.forEach((s, i) => s.setAttribute('stop-color', cols[Math.min(i, cols.length - 1)]));
    // sun: an arc from east (right) at 6:00 to west (left) at 18:30; the art's sun sits at (1120, 265)
    const W = DE.UI.Overworld.W;
    const sp = Math.max(-.08, Math.min(1.08, (h - 6) / 12.5)), sx = W * (.92 - .84 * sp), sy = 430 - Math.sin(Math.max(0, Math.min(1, sp)) * Math.PI) * 330;
    built.sun.setAttribute('transform', `translate(${(sx - 1120).toFixed(1)} ${(sy - 265).toFixed(1)})`);
    built.sun.style.opacity = c.sunUp ? 1 : 0;
    const low = 1 - Math.sin(Math.max(0, Math.min(1, sp)) * Math.PI);           // 1 near the horizon
    if (built.rays) built.rays.style.opacity = (c.sunUp ? Math.max(0, low - .45) * 1.1 : 0).toFixed(2);   // god-rays only when the sun is low
    if (built.haze) built.haze.style.opacity = (.15 + .35 * low * (1 - dark)).toFixed(2);
    // moon: opposite arc at night
    const mh = (h + 12) % 24, mp = Math.max(-.08, Math.min(1.08, (mh - 6) / 12.5)), mx = W * (.92 - .84 * mp), my = 420 - Math.sin(Math.max(0, Math.min(1, mp)) * Math.PI) * 300;
    built.moon.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)})`); built.moon.style.opacity = dark.toFixed(2);
    built.moonGlow.setAttribute('cx', mx.toFixed(1)); built.moonGlow.setAttribute('cy', my.toFixed(1)); built.moonGlow.style.opacity = dark.toFixed(2);
    // clouds are lit by the sky: white at noon, peach/pink at the ends of the day, blue-grey at night
    const ct = dark > .6 ? ['#5a6488', '#3e4870', '#2a3050'] : [mix('#ffffff', '#ffe2c8', low), mix('#e8eef6', '#f4ab9c', low), mix('#b8c4d8', '#c8628a', low)];
    built.cloudStops.forEach((st, i) => st.setAttribute('stop-color', ct[i] || ct[2]));
    built.stars.style.opacity = Math.max(0, dark * 1.1 - .1).toFixed(2);
    // shadows lean away from the sun and lengthen when it is low; at night they fade
    const lean = (sx - W / 2) / (W / 2);                                              // +1 sun far right
    built.shadows.forEach(s => { s.style.transform = `skewX(${(-lean * (25 + 30 * low)).toFixed(1)}deg) scaleY(${(1 + low).toFixed(2)})`; s.style.opacity = ((1 - dark) * .5).toFixed(2); });
    // ambient tint and artificial lights
    let amb = keyed(AMB, h); if (c.season === 'winter') amb = mix(amb, '#dfe8ff', .25 * (1 - dark));
    built.amb.style.backgroundColor = amb;
    built.lights.style.opacity = Math.min(1, dark * 1.15).toFixed(2);
    // units are above the light layers: dim them to match (a little cooler at night, warmer at golden hour)
    scene.style.setProperty('--unit-light', (1 - .42 * dark).toFixed(3)); scene.style.setProperty('--unit-sat', (1 - .3 * dark).toFixed(3));
    // season + weather
    if (scene.dataset.season !== c.season) scene.dataset.season = c.season;
    scene.dataset.tod = c.night ? 'night' : (h < 8 || h > 17) ? 'twilight' : 'day';
    const hh = Math.floor(h), mm = Math.floor((h % 1) * 60 / 15) * 15;
    built.chip.innerHTML = `${c.season === 'winter' ? '<img class="dc-snow" src="assets/icons/snow.png" alt="">' : ''}<b>${c.night ? '☾' : '☀'}</b> ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${c.day} · ${SEASON_NAME[c.season]}`;
  }

  return { update, clock, darkness, DAY_SEC, DAYS_PER_SEASON, SEASONS };
})();
