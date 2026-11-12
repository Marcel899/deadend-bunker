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

  /** Clock for a state (calendar, season, weather): see js/core/season.js. */
  function clock(state) { return DE.Season.clock(state); }
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
    // weather particles: cheap CSS-animated spans, generated once. Rain, snow and leaves each have their
    // own layer (and particles), so a shower in autumn never stops the leaves, and switching weather
    // never makes a falling particle jump. Everything falls to the bottom of the layer = the grass line.
    const parts = (n, f) => { let p = ''; for (let i = 0; i < n; i++) p += f(i); return p; };
    const rain = parts(72, i => `<i style="left:${((i * 37.3) % 126).toFixed(1)}%;--d:${(.5 + (i * 7 % 10) / 45).toFixed(2)}s;animation-delay:-${((i * .173) % 1).toFixed(2)}s;--l:${14 + (i % 4) * 4}px"></i>`);
    const splash = parts(22, i => `<b style="left:${((i * 53.9) % 100).toFixed(1)}%;--d:${(.8 + (i % 4) * .17).toFixed(2)}s;animation-delay:-${((i * .37) % 1.2).toFixed(2)}s"></b>`);
    const leaves = parts(24, i => `<i style="left:${((i * 29.1) % 100).toFixed(1)}%;--d:${(6 + (i * 11 % 40) / 10).toFixed(1)}s;animation-delay:-${((i * .83) % 9).toFixed(1)}s;--s:${3 + (i % 3)}px;--dx:${(i % 5) * 16 - 40}px"></i>`);
    const snow = parts(60, i => `<i style="left:${((i * 41.7) % 104).toFixed(1)}%;--d:${(5 + (i * 13 % 50) / 10).toFixed(1)}s;animation-delay:-${((i * .61) % 9).toFixed(1)}s;--s:${2 + (i % 4)}px;--dx:${(i % 7) * 6 - 22}px"></i>`);
    fx.innerHTML = `<div class="wx wx-rain">${rain}</div><div class="wx wx-splash">${splash}</div><div class="wx wx-leaves">${leaves}</div><div class="wx wx-snow">${snow}</div>`;
    const chip = document.createElement('div'); chip.className = 'dc-chip';
    // order: art SVG, battlefield, then ambient darkness, then lights, then weather, then UI overlay
    const bf = scene.querySelector('.bf');
    const after = bf ? bf.nextSibling : scene.querySelector('.ow-overlay');
    scene.insertBefore(amb, after); scene.insertBefore(lights, after); scene.insertBefore(fx, after);
    (scene.querySelector('.ow-overlay') || scene).appendChild(chip);
    built = { scene, amb, lights, fx, chip, svg: scene.querySelector('.ow-svg:not(.dc-lights)') };
    built.wx = { rain: fx.querySelector('.wx-rain'), splash: fx.querySelector('.wx-splash'), leaves: fx.querySelector('.wx-leaves'), snow: fx.querySelector('.wx-snow') };
    built.stops = Array.from(built.svg.querySelectorAll('#ow-sky stop'));
    built.sun = built.svg.querySelector('.ow-sunwrap'); built.stars = built.svg.querySelector('.ow-stars');
    built.moon = built.svg.querySelector('.dc-moon'); built.shadows = built.svg.querySelectorAll('.ow-shadows');
    built.rays = built.svg.querySelector('.ow-godrays'); built.haze = built.svg.querySelector('.ow-horizonhaze');
    built.moonGlow = lights.querySelector('.dc-moonglow');
    built.cloudStops = Array.from(built.svg.querySelectorAll('#ow-cloudbody stop'));
  }

  /** Show one weather layer at intensity v (0..1); light weather shows half its particles. */
  function layer(el, v, gain, heavy) {
    const on = v > .01;
    if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
    if (el.classList.contains('light') === !!heavy) el.classList.toggle('light', !heavy);
    const o = on ? Math.min(1, v * gain).toFixed(2) : '0'; if (el.style.opacity !== o) el.style.opacity = o;
  }

  function update(state) {
    const scene = document.getElementById('scene'); if (!scene || !state) return;
    if (!built || built.scene !== scene || !built.amb.isConnected) { built = null; build(scene); }
    const c = clock(state), h = c.hour, dark = darkness(h);
    const wx = c.intensity, key = Math.round(h * 20) + c.season + c.weather + Math.round(wx * 20) + Math.round(c.cover.snow * 20) + Math.round(c.cover.leaves * 20) + Math.round(c.cover.flowers * 20);
    if (key === lastKey) return; lastKey = key;
    const overcast = c.weather === 'rain' ? wx : c.weather === 'snow' ? wx * .7 : 0;
    // sky
    const [top, mid, hor] = keyed(SKY, h);
    const grey = (col, k) => mix(col, dark > .6 ? '#242838' : '#7a8092', k);
    const cols = [top, mix(top, mid, .5), mid, mix(mid, hor, .45), hor, hor].map(col => grey(col, .45 * overcast));
    built.stops.forEach((s, i) => s.setAttribute('stop-color', cols[Math.min(i, cols.length - 1)]));
    // sun: an arc from east (right) at 6:00 to west (left) at 18:30; the art's sun sits at (1120, 265)
    const W = DE.UI.Overworld.W;
    const sp = Math.max(-.08, Math.min(1.08, (h - 6) / 12.5)), sx = W * (.92 - .84 * sp), sy = 430 - Math.sin(Math.max(0, Math.min(1, sp)) * Math.PI) * 330;
    built.sun.setAttribute('transform', `translate(${(sx - 1120).toFixed(1)} ${(sy - 265).toFixed(1)})`);
    built.sun.style.opacity = c.sunUp ? (1 - .75 * overcast).toFixed(2) : 0;
    const low = 1 - Math.sin(Math.max(0, Math.min(1, sp)) * Math.PI);           // 1 near the horizon
    if (built.rays) built.rays.style.opacity = (c.sunUp ? Math.max(0, low - .45) * 1.1 : 0).toFixed(2);   // god-rays only when the sun is low
    if (built.haze) built.haze.style.opacity = (.15 + .35 * low * (1 - dark)).toFixed(2);
    // moon: opposite arc at night
    const mh = (h + 12) % 24, mp = Math.max(-.08, Math.min(1.08, (mh - 6) / 12.5)), mx = W * (.92 - .84 * mp), my = 420 - Math.sin(Math.max(0, Math.min(1, mp)) * Math.PI) * 300;
    built.moon.setAttribute('transform', `translate(${mx.toFixed(1)} ${my.toFixed(1)})`); built.moon.style.opacity = dark.toFixed(2);
    built.moonGlow.setAttribute('cx', mx.toFixed(1)); built.moonGlow.setAttribute('cy', my.toFixed(1)); built.moonGlow.style.opacity = dark.toFixed(2);
    // clouds are lit by the sky: white at noon, peach/pink at the ends of the day, blue-grey at night
    const ct = dark > .6 ? ['#5a6488', '#3e4870', '#2a3050'] : [mix('#ffffff', '#ffe2c8', low), mix('#e8eef6', '#f4ab9c', low), mix('#b8c4d8', '#c8628a', low)];
    built.cloudStops.forEach((st, i) => st.setAttribute('stop-color', grey(ct[i] || ct[2], .5 * overcast)));
    built.stars.style.opacity = Math.max(0, dark * 1.1 - .1).toFixed(2);
    // shadows lean away from the sun and lengthen when it is low; at night they fade
    const lean = (sx - W / 2) / (W / 2);                                              // +1 sun far right
    built.shadows.forEach(s => { s.style.transform = `skewX(${(-lean * (25 + 30 * low)).toFixed(1)}deg) scaleY(${(1 + low).toFixed(2)})`; s.style.opacity = ((1 - dark) * .5).toFixed(2); });
    // ambient tint and artificial lights
    let amb = keyed(AMB, h); if (c.cover.snow > 0) amb = mix(amb, '#dfe8ff', .25 * c.cover.snow * (1 - dark));
    if (overcast) amb = mix(amb, c.weather === 'snow' ? '#c8cede' : '#9aa2b6', .38 * overcast * (1 - dark * .5));
    built.amb.style.backgroundColor = amb;
    built.lights.style.opacity = Math.min(1, dark * 1.15).toFixed(2);
    // units are above the light layers: dim them to match (a little cooler at night, warmer at golden hour)
    scene.style.setProperty('--unit-light', (1 - .42 * dark).toFixed(3)); scene.style.setProperty('--unit-sat', (1 - .3 * dark).toFixed(3));
    // season + weather
    // weather stops at the grass line (the scene is drawn bottom-anchored and scaled to cover)
    const OW = DE.UI.Overworld, k = Math.max(scene.clientWidth / OW.W, scene.clientHeight / OW.H);
    built.fx.style.bottom = ((OW.H - OW.GROUND - 2) * k).toFixed(0) + 'px';
    if (DE.Audio) DE.Audio.setNight(dark > .6);
    if (scene.dataset.season !== c.season) scene.dataset.season = c.season;
    // weather particles + ground cover fade with their intensity (CSS reads the variables)
    if (scene.dataset.weather !== c.weather) scene.dataset.weather = c.weather;
    scene.classList.toggle('wx-heavy', c.heavy);
    scene.style.setProperty('--wx', wx.toFixed(2)); scene.style.setProperty('--snow', c.cover.snow.toFixed(2)); scene.style.setProperty('--leaves', c.cover.leaves.toFixed(2)); scene.style.setProperty('--flowers', c.cover.flowers.toFixed(2));
    // the layers: rain (with splashes on the grass), snow, and leaves — blown about on windy days,
    // drifting down lightly all autumn long (rain included)
    const W2 = built.wx, rain = c.weather === 'rain' ? wx : 0;
    layer(W2.rain, rain, 1.25, c.heavy); layer(W2.splash, rain, 1.25, c.heavy);
    layer(W2.snow, c.weather === 'snow' ? wx : 0, 1.4, c.heavy);
    const windy = c.weather === 'leaves';
    layer(W2.leaves, windy ? wx : c.season === 'autumn' && c.weather !== 'snow' ? c.cover.leaves : 0, windy ? 1.6 : 1, windy ? c.heavy : true);
    W2.leaves.classList.toggle('drift', !windy);
    const fh = built.fx.clientHeight;
    if (fh && fh !== built.fh) { built.fh = fh; built.fx.style.setProperty('--fallH', fh + 'px'); built.fx.style.setProperty('--rx', (-fh * .2126).toFixed(0) + 'px'); }
    if (DE.Audio && DE.Audio.ambience) DE.Audio.ambience(c.weather, wx);
    scene.dataset.tod = c.night ? 'night' : (h < 8 || h > 17) ? 'twilight' : 'day';
    const hh = Math.floor(h), mm = Math.floor((h % 1) * 60 / 15) * 15;
    const wxTxt = c.weather === 'clear' ? '' : ` · ${c.weather === 'snow' ? '<img class="dc-snow" src="assets/icons/snow.png" alt="">' : ''}${c.heavy ? 'Heavy ' : ''}${c.weatherName.toLowerCase()}`;
    built.chip.innerHTML = `<b>${c.night ? '☾' : '☀'}</b> ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · Day ${c.day} · ${c.seasonName} ${c.seasonDay}/${c.daysPerSeason}${wxTxt}`;
    built.chip.title = c.seasonName + ': ' + DE.Season.mods(state).label + '\nNext: ' + DE.Season.NAME[c.nextSeason] + ' in ' + DE.Util.fmtTime(c.nextSeasonIn);
  }

  return { update, clock, darkness, DAY_SEC: DE.Season.DAY_SEC, DAYS_PER_SEASON: DE.Season.DAYS_PER_SEASON, SEASONS: DE.Season.SEASONS };
})();
