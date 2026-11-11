/* Room scenes: a prop library (furniture, machines, screens, plants, vehicles…) and a renderer
 * that composes a cutaway room from a layout in js/data/scenes.js. Every prop is vector art in
 * the game's outlined cartoon style; animated parts carry p-* classes driven by css/rooms.css.
 *
 * Scene space: 100 units per grid cell wide (one unit = one CSS pixel), 180 tall plus a 20-unit
 * ceiling slab above y=0, so the 200px-tall room renders at a uniform 1:1 scale (no stretching).
 * Ceiling beam 0..12, back wall 12..150, floor line y=150 (props sit on it), floor plate 150..180
 * where survivors walk. Every prop is drawn with its bottom-centre at (x, y).
 * Every prop is drawn with its bottom-centre at (x, y). */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.Scenes = (function () {
  const INK = '#1c1020';
  const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const S2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const FLOOR = 150;
  const CELL = 100, TOP = 20;   // scene units per grid cell; ceiling slab above y=0
  /* Free-standing furniture and machines always stand on the floor line, whatever y a layout
   * gives them (wall-mounted props — signs, screens, shelves, pipes — keep their y). */
  const GROUNDED = { bunk: 1, bed: 1, medbed: 1, cryopod: 1, benchseat: 1, bike: 1, cage: 1, carlift: 1, crystal: 1, forge: 1, freezer: 1, generator: 1, locker: 1, missile: 1,
    plant: 1, planter: 1, pod: 1, press: 1, railing: 1, robotarm: 1, sofa: 1, tank: 1, traytower: 1, treadmill: 1, tree: 1, truck: 1, watertank: 1, conveyor: 1, filtercol: 1, anvil: 1, lathe: 1, turretmodel: 1, seismo: 1, hologram: 1, testtubes: 0, glasswall: 1, flag: 1, cage: 1, dish: 1, dronepad: 1, minecart: 1, ore: 1, rock: 1, crystal: 1, water: 1, sprinkler: 1, lava: 1, fusioncore: 1, pod: 1, missile: 1,
    table: 1, desk: 1, seismo: 1, punchbag: 1, workbench: 1, labbench: 1, reactor: 1, fusioncore: 1, counter: 1, arcade: 1, ammobox: 1, barrel: 1, crate: 1, weaponrack: 1, serverrack: 1 };
  const g = (cls, inner, x, y, extra) => `<g class="${cls || ''}" transform="translate(${x} ${y})${extra ? ' ' + extra : ''}">${inner}</g>`;
  const rect = (x, y, w, h, fill, r, s) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}" fill="${fill}" ${s === false ? '' : s || S}/>`;
  const circ = (x, y, r, fill, s) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${s === false ? '' : s || S2}/>`;
  const path = (d, fill, s) => `<path d="${d}" fill="${fill}" ${s === false ? '' : s || S}/>`;
  const txt = (x, y, t, size, fill) => `<text x="${x}" y="${y}" font-family="Lilita One, Impact, sans-serif" font-size="${size || 9}" fill="${fill || '#fff'}" text-anchor="middle" stroke="${INK}" stroke-width="2" paint-order="stroke">${t}</text>`;
  const shade = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" opacity=".18"/>`;
  const hl = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" opacity=".18"/>`;
  const screen = (x, y, w, h, col, cls) => `<g class="${cls || 'p-screen'}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${col || '#3a8ad8'}"/><rect x="${x}" y="${y}" width="${w}" height="${h / 2}" fill="#fff" opacity=".12"/></g>`;
  const led = (x, y, col, cls) => `<circle class="${cls || 'p-led'}" cx="${x}" cy="${y}" r="1.8" fill="${col || '#7dff5a'}"/>`;

  /* ============ PROPS ============ (bottom-centre anchored) */
  const P = {};
  // --- furniture ---
  P.bunk = (o) => { const w = 64, c = o.color || '#3a5a8a', c2 = o.sheet || '#d8e6f2'; let s = '';
    for (let i = 0; i < 2; i++) { const y = -24 - i * 30; s += rect(-w / 2, y - 8, w, 12, '#6b4a2e', 3) + rect(-w / 2 + 4, y - 14, w - 8, 8, c, 2) + rect(-w / 2 + 6, y - 18, 16, 8, c2, 3) + hl(-w / 2 + 22, y - 14, w - 30, 3); }
    s += rect(-w / 2 - 3, -66, 6, 66, '#5a3a22', 2) + rect(w / 2 - 3, -66, 6, 66, '#5a3a22', 2) + path(`M${-w / 2 - 3} -66 h${w + 6} v6 h${-w - 6} z`, '#5a3a22');
    if (o.v >= 2) s += rect(-w / 2 + 2, -4, 20, 4, '#8a6a4a', 1); // rug
    return s; };
  P.bed = (o) => { const w = 54, c = o.color || '#c93a3a'; return rect(-w / 2, -16, w, 12, '#6b4a2e', 3) + rect(-w / 2 + 2, -22, w - 4, 8, c, 2) + rect(-w / 2 + 4, -26, 14, 8, '#f3f0e8', 3) + rect(-w / 2 - 3, -30, 6, 30, '#5a3a22', 2) + rect(w / 2 - 3, -22, 6, 22, '#5a3a22', 2) + hl(-w / 2 + 20, -22, w - 26, 3); };
  P.medbed = (o) => { const w = 56; let s = rect(-w / 2, -14, w, 10, '#c9ccd4', 3) + rect(-w / 2 + 2, -20, w - 4, 8, '#f3f6fa', 2) + rect(-w / 2 + 4, -24, 14, 8, '#dfe6ee', 3) + rect(-w / 2 - 3, -30, 6, 30, '#8a8e98', 2) + rect(w / 2 - 3, -24, 6, 24, '#8a8e98', 2) + rect(-w / 2 - 4, -40, 8, 12, '#2a2a34', 2) + rect(-w / 2 - 2, -38, 4, 5, '#7dff5a', 0, false);
    if (o.v >= 2) s += rect(w / 2 + 4, -44, 4, 44, '#8a8e98', 1) + rect(w / 2 - 2, -56, 16, 14, '#f3f6fa', 3) + path(`M${w / 2 + 2} -52 h8 M${w / 2 + 6} -56 v8`, 'none', `stroke="#d8303a" stroke-width="2"`) + rect(w / 2 + 2, -58, 12, 4, '#2a2a34', 1);
    if (o.v >= 3) s += `<g class="p-screen">${rect(-w / 2 - 14, -62, 24, 16, '#1d1a26', 2)}<path class="p-ecg" d="M${-w / 2 - 12} -54 l4 0 l2 -5 l3 9 l2 -4 h7" fill="none" stroke="#7dff5a" stroke-width="1.5"/></g>`;
    return s; };
  P.cryopod = (o) => { const w = 36, h = o.h || 80; return `<g class="p-glow">${rect(-w / 2, -h, w, h - 8, '#7fe3ff', 8)}<rect x="${-w / 2 + 4}" y="${-h + 6}" width="${w - 8}" height="${h - 20}" rx="6" fill="#bff5ff" opacity=".5"/></g>` + rect(-w / 2 - 4, -12, w + 8, 12, '#2f2d38', 3) + rect(-w / 2 - 4, -h - 6, w + 8, 10, '#2f2d38', 3) + led(-w / 2 + 2, -6, '#7dff5a') + led(w / 2 - 2, -6, '#ff5a3c', 'p-led2') + `<g class="p-bubbles">${circ(-6, -h / 2, 2, '#fff', false)}${circ(5, -h / 2 - 14, 1.5, '#fff', false)}${circ(0, -h / 2 + 16, 1.2, '#fff', false)}</g>` + path(`M-6 ${-h + 24} a8 10 0 1 0 12 0 a8 10 0 1 0 -12 0`, '#2a1a24', false) + path(`M-10 ${-h + 40} h20 v${h - 56} h-20 z`, '#3a2f44', false); };
  P.sofa = (o) => { const w = 58, c = o.color || '#c93a3a'; return rect(-w / 2, -22, w, 18, c, 5) + rect(-w / 2 - 4, -30, 10, 26, c, 4) + rect(w / 2 - 6, -30, 10, 26, c, 4) + rect(-w / 2 + 6, -32, w - 12, 10, c, 4) + hl(-w / 2 + 8, -20, w - 16, 3) + rect(-w / 2 + 4, -4, 6, 4, INK, 1, false) + rect(w / 2 - 10, -4, 6, 4, INK, 1, false); };
  P.table = (o) => { const w = o.w || 60, c = o.color || '#8a5a2e'; let s = rect(-w / 2, -28, w, 6, c, 2) + rect(-w / 2 + 4, -22, 5, 22, c, 1) + rect(w / 2 - 9, -22, 5, 22, c, 1) + hl(-w / 2 + 2, -27, w - 4, 2);
    if (o.items) s += o.items.map((it, i) => it === 'mug' ? rect(-w / 2 + 10 + i * 16, -36, 7, 8, '#e8e0d0', 2, S2) : it === 'bowl' ? path(`M${-w / 2 + 8 + i * 16} -30 q6 6 12 0 z`, '#d8d0c0', S2) : it === 'plate' ? `<ellipse cx="${-w / 2 + 12 + i * 16}" cy="-29" rx="7" ry="2.5" fill="#f0ece4" ${S2}/>` : '').join('');
    return s; };
  P.benchseat = (o) => { const w = o.w || 56; return rect(-w / 2, -14, w, 5, '#6b4a2e', 2) + rect(-w / 2 + 4, -9, 4, 9, '#5a3a22', 1) + rect(w / 2 - 8, -9, 4, 9, '#5a3a22', 1); };
  P.stool = (o) => rect(-7, -16, 14, 5, o.color || '#c93a3a', 2) + rect(-4, -11, 3, 11, '#5a3a22', 1) + rect(1, -11, 3, 11, '#5a3a22', 1);
  P.chair = (o) => rect(-8, -18, 16, 5, o.color || '#2f2d38', 2) + rect(6, -34, 5, 20, o.color || '#2f2d38', 2) + rect(-6, -13, 3, 13, '#2a2a34', 1) + rect(4, -13, 3, 13, '#2a2a34', 1);
  P.locker = (o) => { const n = o.n || 2, w = n * 16; let s = rect(-w / 2, -54, w, 54, o.color || '#6e7382', 3);
    for (let i = 0; i < n; i++) { const x = -w / 2 + i * 16; s += rect(x + 2, -52, 12, 50, o.color || '#7c8292', 2, S2) + path(`M${x + 5} -46 h6 M${x + 5} -43 h6 M${x + 5} -40 h6`, 'none', `stroke="${INK}" stroke-width="1.2"`) + rect(x + 11, -30, 2, 5, INK, 0, false); }
    return s; };
  P.shelf = (o) => { const w = o.w || 56, rows = o.rows || 3; let s = rect(-w / 2, -72, w, 72, '#5a4a3a', 2);
    for (let r = 0; r < rows; r++) { const y = -62 + r * 22; s += rect(-w / 2 + 2, y, w - 4, 4, '#8a6a4a', 1, S2);
      for (let i = 0; i < Math.floor((w - 8) / 14); i++) { const k = (r + i + (o.seed || 0)) % 4; const x = -w / 2 + 5 + i * 14; s += k === 0 ? rect(x, y - 12, 10, 12, '#c9a24a', 1, S2) : k === 1 ? rect(x, y - 10, 10, 10, '#4a7fb0', 1, S2) : k === 2 ? rect(x + 1, y - 14, 8, 14, '#d8303a', 3, S2) : rect(x, y - 8, 10, 8, '#8a6a4a', 1, S2); } }
    return s; };
  P.crate = (o) => { const n = o.n || 1; let s = ''; for (let i = 0; i < n; i++) { const w = 30 - i * 4, y = -24 * (i + 1); s += rect(-w / 2 + (i % 2 ? 3 : 0), y, w, 24, o.color || '#8a6a3a', 3) + path(`M${-w / 2 + 4 + (i % 2 ? 3 : 0)} ${y + 4} l${w - 8} 16 M${w / 2 - 4 + (i % 2 ? 3 : 0)} ${y + 4} l${-w + 8} 16`, 'none', S2) + hl(-w / 2 + 2 + (i % 2 ? 3 : 0), y + 2, w - 4, 3); } return s; };
  P.barrel = (o) => rect(-11, -32, 22, 32, o.color || '#3a4e9a', 5) + path('M-11 -22 h22 M-11 -10 h22', 'none', S2) + hl(-8, -30, 4, 26);
  P.sack = (o) => path('M-12 0 q-4 -14 2 -22 q6 -6 20 0 q6 8 2 22 z', o.color || '#c9b07a') + path('M-6 -24 q8 -6 14 0', 'none', S2);
  P.plant = (o) => { const h = o.h || 34; return rect(-9, -12, 18, 12, o.pot || '#b05a3a', 3) + `<g class="p-sway">${path(`M0 -12 q-14 -10 -10 -${h} q10 6 10 ${h - 14} M0 -12 q14 -10 10 -${h} q-10 6 -10 ${h - 14} M0 -12 q-2 -16 0 -${h + 4}`, '#4a8a3a')}</g>`; };
  P.tree = (o) => { const h = o.h || 90; return rect(-5, -h * .45, 10, h * .45, '#6b4a2e', 2) + `<g class="p-sway">${path(`M0 -${h} q-28 10 -26 40 q-14 10 -4 26 q14 8 30 0 q12 -14 -2 -26 q4 -30 -24 -40 z`, o.color || '#4a8a3a')}${path(`M-10 -${h - 20} q8 10 2 30`, 'none', `stroke="#7fc45a" stroke-width="2"`)}</g>`; };
  P.planter = (o) => { const w = o.w || 44, st = o.stage == null ? 2 : o.stage; let s = rect(-w / 2, -14, w, 14, '#6b4a2e', 2) + rect(-w / 2 + 2, -12, w - 4, 5, '#4a3020', 0, false);
    for (let i = 0; i < Math.floor(w / 11); i++) { const x = -w / 2 + 6 + i * 11; s += st === 0 ? circ(x, -14, 1.5, '#7fc45a', false) : st === 1 ? path(`M${x} -12 v-8 M${x} -16 l-4 -4 M${x} -16 l4 -4`, 'none', `stroke="#4a8a3a" stroke-width="2"`) : `<g class="p-sway">${path(`M${x} -12 v-14 M${x} -20 q-6 -4 -7 -10 M${x} -18 q6 -4 7 -10`, 'none', `stroke="#4a8a3a" stroke-width="2.5"`)}${st >= 3 ? circ(x + 3, -26, 3, '#d8303a') : ''}</g>`; }
    if (o.lamp) s += rect(-w / 2, -70, w, 6, '#2f2d38', 2) + `<rect class="p-growlight" x="${-w / 2 + 2}" y="-64" width="${w - 4}" height="3" fill="${o.lamp}"/>` + `<path d="M${-w / 2 + 2} -62 L${-w / 2 - 6} -16 h${w + 12} L${w / 2 - 2} -62 z" fill="${o.lamp}" opacity=".12"/>` + rect(-2, -74, 4, 4, '#2f2d38', 0, false);
    return s; };
  P.traytower = (o) => { const w = 46, rows = o.rows || 3; let s = rect(-w / 2 - 3, -rows * 22 - 10, 6, rows * 22 + 10, '#8a8e98', 1) + rect(w / 2 - 3, -rows * 22 - 10, 6, rows * 22 + 10, '#8a8e98', 1);
    for (let r = 0; r < rows; r++) { const y = -8 - r * 22; s += rect(-w / 2, y - 8, w, 8, '#3a3f4a', 2) + `<rect class="p-growlight" x="${-w / 2 + 2}" y="${y - 20}" width="${w - 4}" height="3" rx="1" fill="${o.lamp || '#c07aff'}"/>` + `<rect x="${-w / 2 + 2}" y="${y - 18}" width="${w - 4}" height="10" fill="${o.lamp || '#c07aff'}" opacity=".15"/>`;
      for (let i = 0; i < 4; i++) s += `<g class="p-sway">${path(`M${-w / 2 + 7 + i * 11} ${y - 8} v-6 M${-w / 2 + 7 + i * 11} ${y - 11} l-3 -4 M${-w / 2 + 7 + i * 11} ${y - 11} l3 -4`, 'none', `stroke="#5ab04a" stroke-width="2"`)}</g>`; }
    return s; };
  P.poster = (o) => rect(-12, -14, 24, 28, o.color || '#c9a24a', 1) + (o.kind === 'zombie' ? path('M-4 -8 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 M-6 6 q6 -10 12 0', '#4a8a3a', S2) : o.kind === 'map' ? path('M-8 -8 q6 4 4 10 q6 -2 8 6', 'none', `stroke="#3a6a9a" stroke-width="2"`) : path('M-6 4 l6 -12 l6 12 z', '#d8303a', S2));
  P.dartboard = (o) => circ(0, -20, 12, '#f3f0e8') + circ(0, -20, 8, '#d8303a', false) + circ(0, -20, 4, '#2a2a34', false) + circ(0, -20, 1.5, '#d8303a', false) + path('M4 -24 l8 -6', 'none', `stroke="#ffd34a" stroke-width="2"`);
  P.pooltable = () => rect(-40, -30, 80, 10, '#3a8a4a', 3) + rect(-44, -34, 88, 6, '#6b4a2e', 3) + rect(-36, -20, 6, 20, '#5a3a22', 1) + rect(30, -20, 6, 20, '#5a3a22', 1) + circ(-10, -32, 2.5, '#fff', false) + circ(6, -32, 2.5, '#d8303a', false) + circ(14, -32, 2.5, '#ffd34a', false) + path('M-30 -36 l50 -6', 'none', `stroke="#c9a24a" stroke-width="2.5"`);
  P.arcade = (o) => rect(-16, -70, 32, 70, o.color || '#4a3a9a', 4) + screen(-11, -62, 22, 18, '#2a1a44', 'p-screen') + `<g class="p-blink">${rect(-7, -58, 4, 4, '#ff5a3c', 0, false)}${rect(3, -52, 4, 4, '#7dff5a', 0, false)}</g>` + rect(-13, -40, 26, 8, '#2f2d38', 2, S2) + circ(-6, -36, 2.5, '#ff5a3c') + circ(4, -36, 2.5, '#ffd34a') + rect(-14, -76, 28, 8, o.color || '#4a3a9a', 3);
  P.weights = () => rect(-30, -8, 60, 8, '#3a3f4a', 2) + rect(-28, -40, 4, 32, '#3a3f4a', 1) + rect(24, -40, 4, 32, '#3a3f4a', 1) + path('M-26 -36 h52 M-26 -22 h52', 'none', S) + rect(-22, -40, 8, 8, '#2a2a34', 2) + rect(14, -40, 8, 8, '#2a2a34', 2) + rect(-20, -26, 6, 8, '#2a2a34', 2) + rect(14, -26, 6, 8, '#2a2a34', 2);
  P.gymbench = () => rect(-26, -20, 52, 6, '#c93a3a', 3) + rect(-20, -14, 4, 14, '#3a3f4a', 1) + rect(16, -14, 4, 14, '#3a3f4a', 1) + rect(-30, -40, 60, 4, '#3a3f4a', 1) + rect(-34, -46, 10, 10, '#2a2a34', 3) + rect(24, -46, 10, 10, '#2a2a34', 3);
  P.punchbag = () => `<g class="p-swing">${rect(-2, -110, 4, 30, '#8a8e98', 1, S2)}${rect(-12, -80, 24, 56, '#c93a3a', 8)}${hl(-9, -76, 4, 46)}</g>`;
  P.treadmill = () => rect(-30, -8, 60, 8, '#2f2d38', 3) + rect(-26, -4, 52, 3, '#5a5f6a', 0, false) + rect(22, -50, 6, 42, '#3a3f4a', 2) + rect(10, -54, 30, 8, '#3a3f4a', 3) + screen(14, -52, 10, 4, '#7dff5a') + `<g class="p-belt"><path d="M-24 -2 h48" stroke="#8a8e98" stroke-width="2" stroke-dasharray="4 4"/></g>`;
  // --- screens & electronics ---
  P.desk = (o) => { const w = o.w || 50; let s = rect(-w / 2, -28, w, 6, o.color || '#6b4a2e', 2) + rect(-w / 2 + 3, -22, 10, 22, o.color || '#6b4a2e', 1) + rect(w / 2 - 13, -22, 10, 22, o.color || '#6b4a2e', 1);
    const n = o.screens == null ? 1 : o.screens; for (let i = 0; i < n; i++) { const x = -((n - 1) * 20) / 2 + i * 20; s += rect(x - 9, -48, 18, 14, '#2f2d38', 2) + screen(x - 7, -46, 14, 10, o.col || '#3a8ad8') + rect(x - 2, -34, 4, 6, '#2f2d38', 0, false); }
    if (o.kb) s += rect(-10, -31, 20, 3, '#3a3f4a', 1, S2);
    if (o.lamp) s += path(`M${w / 2 - 8} -28 l-6 -16 l-10 -4`, 'none', S2) + path(`M${w / 2 - 28} -50 l8 4 l-4 6 z`, '#ffd34a', S2) + `<path class="p-glow" d="M${w / 2 - 26} -44 l-14 18 h22 z" fill="#ffd34a" opacity=".15"/>`;
    return s; };
  P.monitorwall = (o) => { const cols = o.cols || 3, rows = o.rows || 2, w = cols * 24 + 4, h = rows * 18 + 4; let s = rect(-w / 2, -h - 40, w, h, '#2f2d38', 3);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const k = (r * cols + c + (o.seed || 0)) % 4; const col = o.col || (k === 0 ? '#3a8ad8' : k === 1 ? '#2a6a9a' : k === 2 ? '#4aa0e0' : '#5a3a8a'); s += `<g class="p-screen" style="animation-delay:${((r * cols + c) * .37) % 2}s">${rect(-w / 2 + 3 + c * 24, -h - 38 + r * 18, 20, 14, col, 1, false)}<rect x="${-w / 2 + 5 + c * 24}" y="${-h - 36 + r * 18}" width="16" height="2" fill="#fff" opacity=".35"/>${k === 1 ? `<path d="M${-w / 2 + 5 + c * 24} ${-h - 28 + r * 18} l4 -3 l3 4 l4 -5 l5 3" fill="none" stroke="#9fe3ff" stroke-width="1.2"/>` : k === 2 ? `<circle class="p-radar" cx="${-w / 2 + 13 + c * 24}" cy="${-h - 31 + r * 18}" r="5" fill="none" stroke="#bff" stroke-width="1"/>` : ''}</g>`; }
    if (o.stand !== false) s += rect(-6, -40, 12, 40, '#3a3f4a', 1);
    return s; };
  P.mapscreen = (o) => { const w = o.w || 90, h = o.h || 50; return rect(-w / 2 - 3, -h - 50, w + 6, h + 6, '#2f2d38', 3) + `<g class="p-screen">${rect(-w / 2, -h - 47, w, h, '#1d4f8a', 2, false)}<path d="M${-w / 2 + 10} ${-h - 30} q10 -10 22 -4 q8 -8 18 2 q6 10 -4 16 q-10 4 -16 -2 q-12 8 -20 -2 z M${w / 2 - 30} ${-h - 36} q10 -4 16 4 q4 10 -6 14 q-12 2 -14 -8 z" fill="#4aa0e0"/><circle class="p-blink" cx="${-w / 2 + 24}" cy="${-h - 30}" r="2.5" fill="#ff5a3c"/><circle class="p-blink" cx="${w / 2 - 22}" cy="${-h - 28}" r="2.5" fill="#ffd34a" style="animation-delay:.7s"/><rect x="${-w / 2}" y="${-h - 47}" width="${w}" height="${h}" fill="url(#sc-scan)" opacity=".25"/></g>` + rect(-8, -44, 16, 44, '#3a3f4a', 1); };
  P.serverrack = (o) => { const n = o.n || 1; let s = ''; for (let k = 0; k < n; k++) { const x = -((n - 1) * 26) / 2 + k * 26; s += rect(x - 11, -70, 22, 70, '#2f2d38', 3);
    for (let i = 0; i < 6; i++) { const y = -66 + i * 11; s += rect(x - 9, y, 18, 9, '#3a3f4a', 1, S2) + led(x - 5, y + 4.5, i % 2 ? '#7dff5a' : '#4aa0e0', 'p-led') + led(x - 1, y + 4.5, '#7dff5a', 'p-led2') + rect(x + 2, y + 3, 5, 3, '#1d1a26', 0, false); } } return s; };
  P.radio = (o) => rect(-24, -32, 48, 32, o.color || '#6b4a2e', 3) + rect(-20, -28, 18, 12, '#2f2d38', 2, S2) + screen(-18, -26, 14, 8, '#7dff5a') + circ(10, -22, 5, '#2f2d38') + circ(10, -22, 1.5, '#ffd34a', false) + rect(-18, -12, 36, 6, '#3a3f4a', 1, S2) + `<path d="M18 -32 v-30" ${S2}/><g class="p-radio"><path d="M12 -66 q6 -6 12 0 M8 -70 q10 -10 20 0" fill="none" stroke="#ffd34a" stroke-width="2"/></g>` + rect(-10, -4, 20, 4, '#3a3f4a', 1, S2);
  P.dish = (o) => { const r = o.r || 26; return `<g class="p-dish">${path(`M${-r} -${r + 10} q${r} -${r * .8} ${r * 2} 0 q-${r} ${r * .5} -${r * 2} 0 z`, '#c9ccd4')}${path(`M0 -${r + 8} l6 -${r * .7}`, 'none', S2)}${circ(6, -r * 1.7 - 8, 3, '#ff5a3c')}</g>` + rect(-5, -r - 10, 10, r + 10, '#8a8e98', 2) + rect(-16, -6, 32, 6, '#3a3f4a', 2); };
  P.console = (o) => { const w = o.w || 60; let s = path(`M${-w / 2} 0 v-26 l6 -10 h${w - 12} l6 10 v26 z`, o.color || '#3a3f4a') + rect(-w / 2 + 6, -34, w - 12, 8, '#2f2d38', 1, S2);
    for (let i = 0; i < Math.floor(w / 10) - 1; i++) s += led(-w / 2 + 10 + i * 10, -30, i % 3 === 0 ? '#ff5a3c' : i % 3 === 1 ? '#ffd34a' : '#7dff5a', i % 2 ? 'p-led' : 'p-led2') + rect(-w / 2 + 8 + i * 10, -20, 4, 8, '#2f2d38', 1, S2);
    if (o.screen) s += screen(-w / 4, -56, w / 2, 20, o.screen) + rect(-w / 4 - 2, -58, w / 2 + 4, 24, 'none', 2);
    return s; };
  P.bigmap = () => rect(-50, -30, 100, 8, '#6b4a2e', 3) + rect(-44, -22, 8, 22, '#5a3a22', 1) + rect(36, -22, 8, 22, '#5a3a22', 1) + rect(-46, -34, 92, 5, '#d8d0b0', 1, S2) + path('M-40 -32 q10 -4 20 0 t20 0 t20 0', 'none', `stroke="#3a6a9a" stroke-width="1.5"`) + rect(-30, -38, 4, 4, '#d8303a', 0, false) + rect(0, -38, 4, 4, '#4aa0e0', 0, false) + rect(26, -37, 4, 4, '#ffd34a', 0, false) + `<path class="p-glow" d="M-46 -36 h92" stroke="#ffd34a" stroke-width="1" opacity=".5"/>`;
  P.hologram = (o) => `<g class="p-glow">${rect(-20, -8, 40, 8, '#2f2d38', 3)}<path d="M-16 -8 l-8 -56 h48 l-8 56 z" fill="#4affd8" opacity=".12"/><g class="p-helix">${path('M0 -58 q-12 8 0 16 q12 8 0 16 q-12 8 0 16', 'none', `stroke="#4affd8" stroke-width="2"`)}${path('M0 -58 q12 8 0 16 q-12 8 0 16 q12 8 0 16', 'none', `stroke="#9fffe8" stroke-width="2"`)}</g></g>`;
  // --- machines ---
  P.generator = (o) => { const w = o.w || 70; let s = rect(-w / 2, -40, w, 40, o.color || '#c9a24a', 4) + rect(-w / 2 + 4, -36, w * .5, 20, '#2f2d38', 3) + `<g class="p-spin">${circ(-w / 2 + 4 + w * .25, -26, 7, '#8a8e98')}${path(`M${-w / 2 + 4 + w * .25 - 7} -26 h14 M${-w / 2 + 4 + w * .25} -33 v14`, 'none', S2)}</g>` + rect(w / 2 - 22, -34, 16, 16, '#3a3f4a', 2) + txt(w / 2 - 14, -22, '⚡', 10, '#ffd34a') + rect(-w / 2 - 4, -14, 6, 14, '#8a8e98', 1, S2) + `<g class="p-vibrate">${rect(w / 2 - 8, -58, 8, 20, '#3a3f4a', 2)}</g><g class="p-smoke">${circ(w / 2 - 4, -64, 4, '#9a9aa8', false)}${circ(w / 2 - 1, -72, 3, '#9a9aa8', false)}</g>` + led(-w / 2 + 8, -8, '#7dff5a') + led(-w / 2 + 14, -8, '#ff5a3c', 'p-led2');
    if (o.v >= 2) s += rect(-w / 2 - 20, -30, 14, 30, '#3a4e9a', 3) + path(`M${-w / 2 - 20} -22 h14 M${-w / 2 - 20} -10 h14`, 'none', S2); return s; };
  P.reactor = (o) => { const w = o.w || 110; return path(`M${-w / 2} 0 v-50 q0 -50 ${w / 2} -50 q${w / 2} 0 ${w / 2} 50 v50 z`, '#7c8292') + `<g class="p-glow">${path(`M${-w / 2 + 16} -20 v-34 q0 -30 ${w / 2 - 16} -30 q${w / 2 - 16} 0 ${w / 2 - 16} 30 v34 z`, '#2a2a34')}<circle class="p-core" cx="0" cy="-54" r="16" fill="#7dff5a" opacity=".9"/><circle cx="0" cy="-54" r="24" fill="#7dff5a" opacity=".25"/></g>` + path(`M${-w / 2 + 16} -20 h${w - 32}`, 'none', S) + rect(-w / 2 - 10, -40, 10, 40, '#5a5f6a', 2) + rect(w / 2, -40, 10, 40, '#5a5f6a', 2) + `<g class="p-vibrate">${path(`M${-w / 2 - 5} -40 v-20 h${w + 10} v20`, 'none', `stroke="#5a5f6a" stroke-width="5"`)}</g>` + txt(0, -8, '☢', 14, '#ffd34a') + rect(-w / 2 + 4, -16, w - 8, 10, '#ffd34a', 1, false) + `<path d="M${-w / 2 + 4} -16 h${w - 8}" stroke="${INK}" stroke-width="2" stroke-dasharray="8 8"/>`; };
  P.fusioncore = (o) => { const r = o.r || 34; return rect(-r - 10, -14, r * 2 + 20, 14, '#2f2d38', 3) + rect(-6, -r - 50, 12, r + 36, '#5a5f6a', 2) + `<g class="p-glow"><g class="p-spin-slow"><ellipse cx="0" cy="${-r - 14}" rx="${r}" ry="${r * .5}" fill="none" stroke="#7fe3ff" stroke-width="5"/><ellipse cx="0" cy="${-r - 14}" rx="${r * .5}" ry="${r}" fill="none" stroke="#bff5ff" stroke-width="4"/></g><circle class="p-core" cx="0" cy="${-r - 14}" r="${r * .4}" fill="#fff7c0"/><circle cx="0" cy="${-r - 14}" r="${r * .7}" fill="#7fe3ff" opacity=".25"/></g>` + rect(-r - 6, -r * 2 - 36, 10, 40, '#5a5f6a', 2) + rect(r - 4, -r * 2 - 36, 10, 40, '#5a5f6a', 2); };
  P.tank = (o) => { const w = o.w || 30, h = o.h || 60, c = o.color || '#7fe3ff'; return rect(-w / 2 - 3, -8, w + 6, 8, '#3a3f4a', 2) + `<g class="p-glow">${rect(-w / 2, -h, w, h - 8, c, 6)}<rect x="${-w / 2 + 3}" y="${-h + 4}" width="${w - 6}" height="${h - 16}" rx="4" fill="#fff" opacity=".2"/><g class="p-bubbles">${circ(-w / 4, -h / 2, 2, '#fff', false)}${circ(w / 4, -h / 2 - 12, 1.5, '#fff', false)}${circ(0, -h / 2 + 10, 1.2, '#fff', false)}</g></g>` + rect(-w / 2 - 3, -h - 6, w + 6, 8, '#3a3f4a', 2) + path(`M${-w / 2 - 6} -14 h-8 v10`, 'none', `stroke="#8a8e98" stroke-width="4"`); };
  P.watertank = (o) => { const w = o.w || 46, h = o.h || 64; return rect(-w / 2, -h, w, h, o.color || '#3a7fb8', 8) + path(`M${-w / 2} ${-h * .7} h${w} M${-w / 2} ${-h * .35} h${w}`, 'none', S2) + hl(-w / 2 + 5, -h + 6, 6, h - 14) + rect(-10, -h * .55, 20, 12, '#f3f6fa', 2, S2) + `<path class="p-needle" d="M0 ${-h * .55 + 10} l4 -7" stroke="#d8303a" stroke-width="2"/>` + path(`M${w / 2} -20 h10 v20`, 'none', `stroke="#8a8e98" stroke-width="4"`) + circ(w / 2 + 10, -14, 4, '#d8303a'); };
  P.pipe = (o) => { const w = o.w || 120, y = o.y == null ? -120 : o.y; let s = `<g class="p-pipe">${rect(-w / 2, y - 4, w, 8, o.color || '#8a8e98', 4)}<path d="M${-w / 2 + 6} ${y - 2} h${w - 12}" stroke="#fff" stroke-width="1.5" opacity=".35"/>`;
    for (let i = 1; i < Math.floor(w / 40); i++) s += rect(-w / 2 + i * 40 - 3, y - 7, 6, 14, '#5a5f6a', 1, S2);
    if (o.valve) s += circ(-w / 2 + 30, y - 10, 6, '#d8303a') + path(`M${-w / 2 + 30} ${y - 4} v4`, 'none', S2);
    return s + '</g>'; };
  P.pump = (o) => rect(-24, -30, 48, 30, '#3a4e9a', 4) + `<g class="p-piston">${rect(-8, -50, 16, 22, '#8a8e98', 2)}</g>` + rect(-12, -34, 24, 6, '#2f2d38', 1, S2) + path('M24 -20 h10 v20', 'none', `stroke="#8a8e98" stroke-width="4"`) + led(-16, -8, '#7dff5a') + circ(14, -14, 6, '#f3f6fa') + `<path class="p-needle" d="M14 -14 l3 -4" stroke="#d8303a" stroke-width="1.5"/>`;
  P.filtercol = (o) => { const n = o.n || 3; let s = rect(-n * 10 - 4, -8, n * 20 + 8, 8, '#3a3f4a', 2); for (let i = 0; i < n; i++) { const x = -n * 10 + 10 + i * 20; s += rect(x - 8, -62, 16, 54, '#c9ccd4', 5) + rect(x - 6, -52, 12, 30, '#7fe3ff', 3, S2) + `<rect class="p-uv" x="${x - 5}" y="-48" width="10" height="4" fill="#c07aff"/>` + `<g class="p-bubbles">${circ(x, -36, 1.5, '#fff', false)}${circ(x + 3, -44, 1.2, '#fff', false)}</g>`; } s += path(`M${-n * 10 + 2} -66 h${n * 20 - 4}`, 'none', `stroke="#8a8e98" stroke-width="5"`); return s; };
  P.workbench = (o) => { const w = o.w || 60; let s = rect(-w / 2, -30, w, 8, '#8a5a2e', 2) + rect(-w / 2 + 4, -22, 6, 22, '#5a3a22', 1) + rect(w / 2 - 10, -22, 6, 22, '#5a3a22', 1) + rect(-w / 2 + 6, -22, w - 12, 10, '#6b4a2e', 1, S2);
    s += rect(w / 2 - 22, -38, 12, 8, '#8a8e98', 2, S2) + path(`M${w / 2 - 16} -38 v-6`, 'none', S2) + rect(-w / 2 + 8, -34, 14, 4, '#3a3f4a', 1, S2) + rect(-4, -36, 10, 6, '#d8303a', 1, S2);
    if (o.tools) s += rect(-w / 2, -76, w, 30, '#5a4a3a', 2) + path(`M${-w / 2 + 8} -70 v12 M${-w / 2 + 18} -70 v16 M${-w / 2 + 28} -70 v10 M${-w / 2 + 38} -70 v14 M${-w / 2 + 48} -70 v12`, 'none', `stroke="#c9ccd4" stroke-width="3"`) + path(`M${-w / 2 + 6} -58 h4 M${-w / 2 + 16} -54 h4 M${-w / 2 + 36} -56 h4`, 'none', `stroke="#8a8e98" stroke-width="4"`);
    return s; };
  P.anvil = () => path('M-16 -8 h32 v-6 h-10 l4 -8 h-20 l4 8 h-10 z', '#5a5f6a') + rect(-8, -8, 16, 8, '#3a3f4a', 1);
  P.lathe = () => rect(-32, -22, 64, 22, '#3a7f5a', 3) + rect(-28, -28, 12, 6, '#3a3f4a', 1, S2) + `<g class="p-spin">${circ(-10, -32, 7, '#8a8e98')}${path('M-17 -32 h14 M-10 -39 v14', 'none', S2)}</g>` + rect(-4, -34, 28, 6, '#8a8e98', 2, S2) + rect(18, -36, 8, 10, '#3a3f4a', 1, S2) + `<g class="p-sparks">${circ(2, -40, 1.5, '#ffd34a', false)}${circ(6, -44, 1, '#ff9a3c', false)}</g>` + led(26, -12, '#7dff5a');
  P.press = () => rect(-20, -8, 40, 8, '#3a3f4a', 2) + rect(-14, -70, 6, 62, '#5a5f6a', 1) + rect(8, -70, 6, 62, '#5a5f6a', 1) + rect(-18, -76, 36, 8, '#3a3f4a', 2) + `<g class="p-press">${rect(-10, -60, 20, 16, '#c9a24a', 2)}${rect(-6, -44, 12, 8, '#8a8e98', 1, S2)}</g>` + rect(-12, -14, 24, 6, '#8a8e98', 1, S2) + led(-16, -4, '#ff5a3c', 'p-led2');
  P.forge = () => rect(-22, -30, 44, 30, '#5a5f6a', 3) + rect(-16, -26, 32, 14, '#2a1a24', 2, S2) + `<g class="p-flame">${path('M-10 -14 q4 -14 8 -6 q2 -10 6 -2 q4 -8 6 2 q0 8 -10 8 q-10 0 -10 -2 z', '#ff7a2a', S2)}${path('M-5 -14 q3 -8 5 -4 q2 -6 4 0 q0 6 -5 6 q-4 0 -4 -2 z', '#ffd34a', false)}</g>` + rect(-26, -58, 52, 10, '#3a3f4a', 2) + rect(-6, -58, 12, 30, '#3a3f4a', 1, S2) + `<g class="p-smoke">${circ(0, -64, 4, '#9a9aa8', false)}</g>`;
  P.conveyor = (o) => { const w = o.w || 110; let s = rect(-w / 2, -14, w, 10, '#3a3f4a', 4) + `<g class="p-belt"><path d="M${-w / 2 + 6} -9 h${w - 12}" stroke="#8a8e98" stroke-width="3" stroke-dasharray="6 6"/></g>` + rect(-w / 2 + 6, -4, 5, 4, '#2f2d38', 0, false) + rect(w / 2 - 11, -4, 5, 4, '#2f2d38', 0, false);
    for (let i = 0; i < Math.floor(w / 36); i++) s += `<g class="p-cargo" style="animation-delay:${-i * 1.2}s">${rect(-w / 2 + 10 + i * 36, -26, 16, 12, i % 2 ? '#c9a24a' : '#8a6a3a', 2, S2)}</g>`;
    return s; };
  P.robotarm = (o) => rect(-14, -10, 28, 10, '#3a3f4a', 2) + `<g class="p-arm">${rect(-5, -46, 10, 36, o.color || '#f0a84a', 3)}<g class="p-arm2" style="transform-origin:0 -46px">${rect(-4, -48, 36, 8, o.color || '#f0a84a', 3)}${rect(28, -50, 8, 12, '#3a3f4a', 2, S2)}${path('M30 -38 l-4 6 M34 -38 l4 6', 'none', S2)}</g>${circ(0, -46, 5, '#2f2d38')}</g>` + led(-10, -5, '#7dff5a');
  P.drone = (o) => `<g class="p-hover" style="animation-delay:${o.d || 0}s">${rect(-10, -8, 20, 8, '#3a3f4a', 3)}${path('M-10 -6 l-10 -4 M10 -6 l10 -4', 'none', S2)}<g class="p-rotor">${rect(-26, -12, 12, 3, '#8a8e98', 1, false)}</g><g class="p-rotor">${rect(14, -12, 12, 3, '#8a8e98', 1, false)}</g>${circ(0, -2, 2.5, '#ff5a3c', false)}</g>`;
  P.dronepad = () => rect(-22, -6, 44, 6, '#3a3f4a', 2) + circ(0, -3, 10, 'none', `stroke="#ffd34a" stroke-width="2"`) + `<g class="p-blink">${led(-18, -3, '#7dff5a')}${led(18, -3, '#7dff5a')}</g>`;
  P.truck = (o) => { const c = o.color || '#5a7fb0'; return rect(-44, -34, 58, 24, c, 4) + path('M14 -34 h20 l10 14 v10 h-30 z', c) + rect(20, -30, 14, 10, '#9fe3ff', 2, S2) + rect(-40, -30, 50, 14, '#3a4e9a', 2, S2) + circ(-28, -8, 9, '#2a2a34') + circ(-28, -8, 3.5, '#8a8e98', false) + circ(26, -8, 9, '#2a2a34') + circ(26, -8, 3.5, '#8a8e98', false) + rect(42, -22, 4, 6, '#ffd34a', 1, false) + `<g class="p-smoke">${circ(-48, -16, 3, '#9a9aa8', false)}</g>`; };
  P.bike = () => circ(-14, -8, 8, '#2a2a34') + circ(14, -8, 8, '#2a2a34') + path('M-14 -8 l10 -14 h12 l6 14 M-4 -22 l-6 -4 M8 -22 l6 -6', 'none', S) + rect(-6, -24, 14, 6, '#c93a3a', 2, S2);
  P.carlift = () => rect(-40, -10, 80, 10, '#3a3f4a', 2) + rect(-36, -14, 8, 4, '#ffd34a', 0, false) + rect(28, -14, 8, 4, '#ffd34a', 0, false) + `<g class="p-lift">${rect(-30, -46, 60, 20, '#c93a3a', 6)}${rect(-18, -58, 30, 12, '#c93a3a', 4)}${rect(-14, -56, 22, 8, '#9fe3ff', 2, S2)}${circ(-18, -24, 7, '#2a2a34')}${circ(18, -24, 7, '#2a2a34')}</g>` + rect(-34, -18, 6, 8, '#5a5f6a', 1, S2) + rect(28, -18, 6, 8, '#5a5f6a', 1, S2);
  P.weaponrack = (o) => { const n = o.n || 3; let s = rect(-n * 9 - 4, -60, n * 18 + 8, 60, '#5a4a3a', 2) + rect(-n * 9 - 2, -58, n * 18 + 4, 56, '#3a2f2a', 1, false);
    for (let i = 0; i < n; i++) { const x = -n * 9 + 9 + i * 18; s += `<g transform="translate(${x} -30) rotate(-6)">${rect(-2, -22, 4, 44, '#3a3540', 1, S2)}${rect(-3, -12, 6, 8, '#5a3a24', 1, S2)}${rect(-4, 4, 8, 10, '#2a2530', 1, S2)}</g>`; }
    return s + rect(-n * 9 - 4, -6, n * 18 + 8, 6, '#5a4a3a', 1, S2); };
  P.ammobox = (o) => { const n = o.n || 2; let s = ''; for (let i = 0; i < n; i++) s += rect(-14 + (i % 2) * 4, -12 * (i + 1), 28, 12, '#4a5a3a', 2) + rect(-10 + (i % 2) * 4, -12 * (i + 1) + 3, 8, 3, '#ffd34a', 0, false); return s; };
  P.turretmodel = () => rect(-16, -8, 32, 8, '#3a3f4a', 2) + rect(-10, -22, 20, 14, '#5a5f6a', 3) + `<g class="p-scan" style="transform-origin:0 -18px">${rect(0, -22, 24, 6, '#2f2d38', 2)}</g>` + led(-6, -14, '#ff5a3c', 'p-led2');
  P.missile = (o) => { const h = o.h || 130; return rect(-24, -8, 48, 8, '#3a3f4a', 2) + rect(-34, -h - 10, 6, h + 10, '#5a5f6a', 1) + rect(28, -h - 10, 6, h + 10, '#5a5f6a', 1) + path(`M-34 ${-h - 10} h68 M-34 ${-h / 2} h-8 M34 ${-h / 2} h8`, 'none', `stroke="#5a5f6a" stroke-width="4"`) + path(`M-12 -8 v-${h - 30} q0 -24 12 -30 q12 6 12 30 v${h - 30} z`, '#c9ccd4') + path(`M-12 -8 l-10 -18 v18 z M12 -8 l10 -18 v18 z`, '#d8303a') + rect(-12, -h * .55, 24, 8, '#d8303a', 0, false) + txt(0, -h * .35, '☢', 10, '#ffd34a') + `<g class="p-blink">${led(-30, -h - 4, '#ff5a3c')}${led(30, -h - 4, '#ff5a3c')}</g>` + path('M-8 -12 h16', 'none', `stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"`); };
  // --- medical & lab ---
  P.cabinet = (o) => rect(-16, -50, 32, 50, '#f3f6fa', 3) + rect(-13, -47, 26, 44, '#dfe6ee', 2, S2) + path('M0 -47 v44', 'none', S2) + (o.cross !== false ? path('M-5 -32 h10 M0 -37 v10', 'none', `stroke="#d8303a" stroke-width="3"`) : '') + rect(-9, -20, 6, 6, '#d8303a', 1, S2) + rect(3, -20, 6, 6, '#4a7fb0', 1, S2) + rect(-9, -12, 6, 4, '#7dff5a', 1, S2);
  P.ivstand = () => rect(-2, -62, 4, 62, '#8a8e98', 1, S2) + path('M-8 -62 h16', 'none', S2) + rect(-10, -82, 8, 20, '#dfe6ee', 3, S2) + rect(-9, -74, 6, 10, '#7fe3ff', 1, false) + path('M-6 -62 q0 20 4 40', 'none', `stroke="#9fe3ff" stroke-width="1.5"`) + path('M-10 0 h20 M-6 0 l-4 -4 M6 0 l4 -4', 'none', S2);
  P.microscope = () => rect(-12, -6, 24, 6, '#3a3f4a', 2) + path('M-4 -6 v-28 q0 -8 8 -8 l6 8', 'none', `stroke="#3a3f4a" stroke-width="5"`) + rect(2, -46, 10, 14, '#5a5f6a', 2, S2) + rect(-10, -10, 20, 4, '#c9ccd4', 1, S2) + `<circle class="p-glow" cx="7" cy="-30" r="3" fill="#7fe3ff"/>`;
  P.testtubes = (o) => { const n = o.n || 4; let s = rect(-n * 5 - 2, -8, n * 10 + 4, 8, '#5a5f6a', 2); for (let i = 0; i < n; i++) { const x = -n * 5 + 5 + i * 10, c = ['#7dff5a', '#7fe3ff', '#ff5a9a', '#ffd34a'][i % 4]; s += rect(x - 3, -30, 6, 24, '#e8f4ff', 3, S2) + rect(x - 2, -18 - (i % 3) * 3, 4, 10 + (i % 3) * 3, c, 2, false) + `<g class="p-bubbles">${circ(x, -22, 1, '#fff', false)}</g>`; } return s; };
  P.labbench = (o) => { const w = o.w || 70; return rect(-w / 2, -30, w, 6, '#dfe6ee', 2) + rect(-w / 2 + 2, -24, w - 4, 24, '#c9ccd4', 2) + path(`M${-w / 2 + 2} -12 h${w - 4}`, 'none', S2) + rect(-w / 2 + 8, -20, 10, 6, '#4a7fb0', 1, S2) + rect(w / 2 - 18, -20, 10, 6, '#4a7fb0', 1, S2); };
  P.dnascreen = () => rect(-30, -70, 60, 44, '#2f2d38', 3) + `<g class="p-screen">${rect(-26, -66, 52, 36, '#0f2a3a', 2, false)}<g class="p-helix-x">${path('M-18 -48 q6 -12 12 0 t12 0 t12 0', 'none', `stroke="#7fe3ff" stroke-width="2"`)}${path('M-18 -48 q6 12 12 0 t12 0 t12 0', 'none', `stroke="#ff5a9a" stroke-width="2"`)}<path d="M-14 -54 v12 M-6 -54 v12 M2 -54 v12 M10 -54 v12" stroke="#fff" stroke-width="1" opacity=".5"/></g></g>` + rect(-6, -26, 12, 26, '#3a3f4a', 1);
  P.glasswall = (o) => { const w = o.w || 80, h = o.h || 100; return `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="3" fill="#9fe3ff" opacity=".18" ${S}/><path d="M0 ${-h} v${h}" ${S2}/><path d="M${-w / 2 + 6} ${-h + 6} l10 22" stroke="#fff" stroke-width="2" opacity=".4"/>` + rect(-w / 2 - 4, -8, w + 8, 8, '#8a8e98', 2) + txt(0, -h + 16, '☣', 12, '#ffd34a'); };
  P.fridge = (o) => rect(-16, -60, 32, 60, o.color || '#dfe6ee', 4) + path('M-16 -36 h32', 'none', S2) + rect(10, -52, 3, 10, '#8a8e98', 1, false) + rect(10, -30, 3, 14, '#8a8e98', 1, false) + hl(-13, -56, 4, 50);
  P.stove = () => rect(-24, -32, 48, 32, '#dfe6ee', 3) + rect(-20, -28, 40, 10, '#2f2d38', 2, S2) + `<g class="p-flame">${circ(-10, -23, 4, '#ff7a2a', false)}${circ(10, -23, 4, '#ff7a2a', false)}${circ(-10, -23, 2, '#ffd34a', false)}</g>` + rect(-18, -14, 36, 10, '#3a3f4a', 1, S2) + circ(-12, -8, 2, '#8a8e98', false) + circ(0, -8, 2, '#8a8e98', false) + circ(12, -8, 2, '#8a8e98', false) + rect(-18, -40, 36, 8, '#8a8e98', 2, S2) + rect(-10, -44, 20, 4, '#2f2d38', 1, S2) + `<g class="p-steam">${circ(-10, -50, 3, '#fff', false)}${circ(8, -54, 2.5, '#fff', false)}</g>`;
  P.counter = (o) => { const w = o.w || 60; return rect(-w / 2, -30, w, 30, '#8a6a4a', 3) + rect(-w / 2 - 2, -34, w + 4, 6, '#c9ccd4', 2) + path(`M${-w / 2 + 4} -24 h${w / 2 - 8} v18 h${-w / 2 + 8} z M${4} -24 h${w / 2 - 8} v18 h${-w / 2 + 8} z`, 'none', S2) + (o.sink ? rect(-14, -38, 28, 6, '#8a8e98', 2, S2) + path('M0 -38 v-10 q0 -6 8 -6', 'none', `stroke="#8a8e98" stroke-width="3"`) + `<g class="p-drip">${circ(8, -48, 1.5, '#7fe3ff', false)}</g>` : rect(-10, -40, 20, 6, '#d8303a', 2, S2)); };
  P.freezer = (o) => rect(-30, -40, 60, 40, '#c9ccd4', 4) + rect(-26, -36, 52, 20, '#9fe3ff', 2, S2) + `<g class="p-frost">${path('M-18 -28 l6 6 M-12 -28 l-6 6 M10 -30 l6 6 M16 -30 l-6 6', 'none', `stroke="#fff" stroke-width="1.5"`)}</g>` + rect(-26, -14, 52, 8, '#8a8e98', 1, S2) + led(22, -10, '#7fe3ff') + `<g class="p-steam">${circ(-20, -46, 3, '#dff', false)}${circ(20, -46, 2.5, '#dff', false)}</g>`;
  P.cage = (o) => { const w = o.w || 60, h = o.h || 60; let s = rect(-w / 2, -h, w, h, 'none', 2); for (let i = 1; i < w / 10; i++) s += `<path d="M${-w / 2 + i * 10} ${-h} v${h}" stroke="${INK}" stroke-width="1.5" opacity=".6"/>`; return s; };
  P.vent = (o) => rect(-14, -14, 28, 14, '#5a5f6a', 2) + `<g class="p-fan" style="transform-origin:0 -7px">${path('M0 -7 l-6 -4 l6 -2 z M0 -7 l6 -4 l-6 -2 z M0 -7 l-6 4 l6 2 z M0 -7 l6 4 l-6 2 z', '#2f2d38', false)}</g>` + path('M-10 -7 h20', 'none', `stroke="${INK}" stroke-width="1" opacity=".5"`);
  P.seismo = () => rect(-30, -34, 60, 34, '#5a4a3a', 3) + rect(-26, -30, 52, 22, '#f3f0e8', 2, S2) + `<g class="p-belt"><path class="p-seis" d="M-24 -18 l4 0 l2 -6 l3 10 l2 -4 l3 2 l2 -8 l3 9 l2 -3 l4 0 l3 -7 l3 10 l2 -3 h8" fill="none" stroke="#d8303a" stroke-width="1.5"/></g>` + `<g class="p-needle">${path('M18 -34 v-10', 'none', `stroke="#3a3f4a" stroke-width="3"`)}</g>` + rect(-12, -40, 24, 6, '#3a3f4a', 1, S2);
  P.scaffold = (o) => { const w = o.w || 180, h = o.h || 120; let s = ''; for (let i = 0; i <= w / 60; i++) s += rect(-w / 2 + i * 60 - 2, -h, 4, h, '#c9a24a', 1, S2); for (let r = 1; r <= h / 40; r++) s += rect(-w / 2, -r * 40, w, 4, '#c9a24a', 1, S2) + path(`M${-w / 2} ${-r * 40 + 4} l60 36 M${-w / 2 + 60} ${-r * 40 + 4} l-60 36`, 'none', `stroke="#c9a24a" stroke-width="2" opacity=".6"`); return s + `<g class="p-sparks">${circ(w * .2, -h * .5, 2, '#ffd34a', false)}${circ(w * .22, -h * .55, 1.5, '#ff9a3c', false)}${circ(-w * .25, -h * .3, 2, '#ffd34a', false)}</g>` + rect(-w / 2, -h - 10, w, 6, '#ffd34a', 0, false) + `<path d="M${-w / 2} ${-h - 7} h${w}" stroke="${INK}" stroke-width="6" stroke-dasharray="14 14"/>`; };
  P.cablebox = () => rect(-10, -22, 20, 22, '#5a5f6a', 2) + path('M-6 -22 q-10 -10 -4 -24 M6 -22 q10 -10 4 -24', 'none', `stroke="#d8303a" stroke-width="2"`) + led(-4, -10, '#ffd34a', 'p-led2') + led(4, -10, '#7dff5a');
  P.flag = (o) => rect(-2, -70, 4, 70, '#8a8e98', 1, S2) + `<g class="p-flagwave">${path(`M2 -68 l34 6 l-2 20 l-32 2 z`, o.color || '#2a2a34')}</g>`;
  P.hatchdoor = () => rect(-30, -70, 60, 70, '#5a5f6a', 4) + rect(-24, -64, 48, 58, '#3a3f4a', 3) + path('M0 -64 v58', 'none', S2) + path('M-24 -46 h48', 'none', `stroke="#ffd34a" stroke-width="4" stroke-dasharray="8 8"`) + circ(-6, -34, 3, '#c9ccd4') + circ(6, -34, 3, '#c9ccd4') + `<rect class="p-glow" x="-10" y="-76" width="20" height="4" fill="#ffd34a"/>`;
  P.sprinkler = () => rect(-2, -150, 4, 30, '#8a8e98', 1, false) + `<g class="p-drip">${circ(-6, -112, 1.5, '#7fe3ff', false)}${circ(0, -108, 1.5, '#7fe3ff', false)}${circ(6, -112, 1.5, '#7fe3ff', false)}</g>`;
  P.pod = (o) => rect(-16, -46, 32, 46, '#dfe6ee', 8) + rect(-12, -42, 24, 26, '#9fe3ff', 5, S2) + hl(-10, -40, 4, 20) + rect(-10, -12, 20, 6, '#3a3f4a', 1, S2) + led(6, -9, '#7dff5a');
  P.warningstripe = (o) => { const w = o.w || 60; return `<rect x="${-w / 2}" y="-6" width="${w}" height="6" fill="#ffd34a"/><path d="M${-w / 2} -3 h${w}" stroke="${INK}" stroke-width="6" stroke-dasharray="10 10"/>`; };
  P.toolboard = (o) => { const w = o.w || 50; return rect(-w / 2, -40, w, 34, '#5a4a3a', 2) + path(`M${-w / 2 + 8} -34 v10 M${-w / 2 + 18} -34 v14 M${-w / 2 + 28} -34 v8 M${-w / 2 + 38} -34 v12`, 'none', `stroke="#c9ccd4" stroke-width="3"`) + path(`M${-w / 2 + 6} -24 h4 M${-w / 2 + 16} -20 h4 M${-w / 2 + 36} -22 h4`, 'none', `stroke="#8a8e98" stroke-width="4"`) + circ(-w / 2 + 28, -24, 3, '#d8303a', S2); };
  P.clock = () => circ(0, -10, 9, '#f3f0e8') + path('M0 -10 v-6 M0 -10 l4 2', 'none', S2);
  P.sign = (o) => rect(-22, -16, 44, 16, o.color || '#d8303a', 2) + txt(0, -4, o.text || 'KEEP OUT', 7, '#fff');
  P.wire = (o) => { const w = o.w || 100; return `<path d="M${-w / 2} 0 q${w / 4} 18 ${w / 2} 0 t${w / 2} 0" fill="none" stroke="${INK}" stroke-width="2.5"/>`; };
  P.lamp = (o) => { const d = o.drop || 10, c = o.color || '#ffd98a'; return `<path d="M0 0 v${d}" stroke="${INK}" stroke-width="2"/>` + rect(-14, d, 28, 6, '#3a3f4a', 2, S2)
    + `<g class="p-light"><ellipse cx="0" cy="${d + 40}" rx="48" ry="34" fill="${c}" opacity=".16" filter="url(#sc-blur8)"/><path class="p-lampcone" d="M-11 ${d + 8} L-58 ${d + 136} H58 L11 ${d + 8} z" fill="${c}" opacity=".22" mask="none" style="fill:${c}"/><path d="M-11 ${d + 8} L-58 ${d + 136} H58 L11 ${d + 8} z" fill="url(#sc-cone)" opacity=".35"/><ellipse class="p-pool" cx="0" cy="${d + 136}" rx="52" ry="9" fill="${c}" opacity=".28" filter="url(#sc-blur4)"/></g>`
    + `<rect class="p-lamp" x="-11" y="${d + 5}" width="22" height="3" fill="${c}"/><ellipse cx="0" cy="${d + 7}" rx="16" ry="6" fill="${c}" opacity=".6" filter="url(#sc-blur4)"/>`; };
  P.neon = (o) => { const w = o.w || 40, c = o.color || '#c07aff'; return `<rect x="${-w / 2}" y="-6" width="${w}" height="10" rx="4" fill="${c}" opacity=".5" filter="url(#sc-blur4)"/><rect class="p-lamp" x="${-w / 2}" y="-4" width="${w}" height="4" rx="2" fill="${c}"/><rect x="${-w / 2}" y="-2" width="${w}" height="34" fill="url(#sc-cone)" opacity=".25" style="fill:${c}"/>`; };
  P.railing = (o) => { const w = o.w || 60; let s = rect(-w / 2, -22, w, 3, '#8a8e98', 1, S2); for (let i = 0; i <= w / 15; i++) s += rect(-w / 2 + i * 15 - 1, -22, 3, 22, '#8a8e98', 1, S2); return s; };
  P.rock = (o) => path(`M-${o.w || 20} 0 l6 -14 l12 -8 l${(o.w || 20) * .9} 4 l6 18 z`, o.color || '#5e5c66');
  P.lava = (o) => `<g class="p-glow">${path(`M-${o.w || 40} 0 q10 -10 20 -4 q10 -8 20 0 q10 -8 20 4 z`, '#ff7a2a')}${path(`M-${(o.w || 40) * .6} -2 q8 -5 16 0`, 'none', `stroke="#ffd34a" stroke-width="2"`)}</g>`;
  P.water = (o) => `<g class="p-glow">${path(`M-${o.w || 60} 0 v-10 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 v10 z`, '#3a7fb8')}<path class="p-wave" d="M-${(o.w || 60) - 6} -8 q8 -4 16 0 t16 0 t16 0" fill="none" stroke="#9fe3ff" stroke-width="2"/></g>`;
  P.crystal = (o) => path(`M-8 0 l2 -24 l6 -8 l6 10 l2 22 z`, o.color || '#7fe3ff') + path('M-2 -4 l2 -20', 'none', `stroke="#fff" stroke-width="1.5" opacity=".6"`);
  P.ore = () => rock({ w: 24, color: '#4a4a6a' }) + `<g class="p-glow">${circ(-6, -10, 3, '#ffd34a', false)}${circ(4, -14, 2.5, '#ffd34a', false)}${circ(8, -6, 2, '#ffd34a', false)}</g>`;
  function rock(o) { return P.rock(o); }
  P.minecart = () => path('M-18 -8 l4 -16 h28 l4 16 z', '#5a5f6a') + path('M-12 -24 q12 -10 24 0', '#6a5a4a', S2) + circ(-8, -4, 4, '#2a2a34') + circ(8, -4, 4, '#2a2a34');
  P.bars = (o) => { const w = o.w || 40; let s = ''; for (let i = 0; i < w / 8; i++) s += rect(-w / 2 + i * 8, -60, 3, 60, '#8a8e98', 1, S2); return s + rect(-w / 2 - 2, -62, w + 4, 4, '#5a5f6a', 1, S2); };

  /* ============ RENDERER ============ */
  const THEMES = {
    default: { wall: '#5f5c6e', wall2: '#4c495a', floor: '#3a3744', trim: '#2f2c3a', lamp: '#ffd98a' },
    warm:    { wall: '#6b5a4a', wall2: '#564636', floor: '#3e3328', trim: '#2a2118', lamp: '#ffd98a' },
    cold:    { wall: '#4f6072', wall2: '#3e4c5c', floor: '#2f3a46', trim: '#232c36', lamp: '#bfe8ff' },
    green:   { wall: '#4f6a52', wall2: '#3e5642', floor: '#2e3e30', trim: '#1f2c22', lamp: '#d8ffb0' },
    lab:     { wall: '#5a5f7a', wall2: '#484c64', floor: '#353848', trim: '#262836', lamp: '#d0f0ff' },
    med:     { wall: '#7a8a96', wall2: '#64727e', floor: '#4a5560', trim: '#333c44', lamp: '#f3f6fa' },
    danger:  { wall: '#6a4a4a', wall2: '#553a3a', floor: '#3e2a2a', trim: '#2a1c1c', lamp: '#ffd98a' },
    dark:    { wall: '#3a3a4a', wall2: '#2e2e3c', floor: '#242430', trim: '#18181f', lamp: '#9fe3ff' },
    rock:    { wall: '#5a4a44', wall2: '#463834', floor: '#332824', trim: '#1f1816', lamp: '#ffb070' },
    purple:  { wall: '#5a4a7a', wall2: '#483a64', floor: '#352a48', trim: '#261e36', lamp: '#e0b0ff' },
  };

  function defs() {
    return `<defs><pattern id="sc-scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#fff"/></pattern>
      <pattern id="sc-panel" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 0 H40 V40" fill="none" stroke="#000" stroke-width="1.5" opacity=".18"/><circle cx="4" cy="4" r="1.2" fill="#000" opacity=".25"/></pattern>
      <filter id="sc-blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter><filter id="sc-blur4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter><linearGradient id="sc-ambient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".42"/><stop offset=".35" stop-color="#000" stop-opacity=".05"/><stop offset=".8" stop-color="#000" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient><linearGradient id="sc-cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><radialGradient id="sc-vig" cx=".5" cy=".55" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient><pattern id="sc-grate" width="12" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="none"/><path d="M0 4 H12" stroke="#000" stroke-width="1.2" opacity=".25"/></pattern></defs>`;
  }

  /** Background for a room: ceiling beam, wall panels, pipes, floor plate, hanging lamps. */
  function base(def, theme, size, level, construction) {
    const W = CELL * size, t = THEMES[theme] || THEMES.default;
    let s = `<rect x="0" y="${-TOP}" width="${W}" height="${TOP}" fill="${t.trim}"/><rect x="0" y="${-TOP}" width="${W}" height="${TOP}" fill="#000" opacity=".35"/><rect x="0" y="0" width="${W}" height="${FLOOR}" fill="${t.wall}"/><rect x="0" y="0" width="${W}" height="${FLOOR}" fill="url(#sc-panel)"/>
      <rect x="0" y="${FLOOR * .62}" width="${W}" height="${FLOOR * .38}" fill="${t.wall2}" opacity=".85"/>
      <rect x="0" y="0" width="${W}" height="14" fill="${t.trim}"/><rect x="0" y="12" width="${W}" height="4" fill="#000" opacity=".3"/>
      <rect x="0" y="${FLOOR}" width="${W}" height="${180 - FLOOR}" fill="${t.floor}"/><rect x="0" y="${FLOOR}" width="${W}" height="${180 - FLOOR}" fill="url(#sc-grate)"/>
      <rect x="0" y="${FLOOR - 3}" width="${W}" height="5" fill="${INK}"/><rect x="0" y="${FLOOR + 2}" width="${W}" height="2" fill="#fff" opacity=".12"/>
      <rect x="0" y="${-TOP}" width="4" height="${180 + TOP}" fill="${INK}"/><rect x="${W - 4}" y="${-TOP}" width="4" height="${180 + TOP}" fill="${INK}"/>`;
    // lamps: one per slot, better lamps at higher tiers
    const tier = tierOf(level);
    s += `<rect x="0" y="${-TOP}" width="${W}" height="${180 + TOP}" fill="url(#sc-ambient)"/>`;
    const lamps = Math.max(1, Math.round(size / 2));
    for (let i = 0; i < lamps; i++) s += g('', P.lamp({ drop: tier >= 3 ? 6 : 10, color: t.lamp }), W * (i + 0.5) / lamps, 14);
    if (tier >= 2) s += g('', P.neon({ w: 60, color: t.lamp }), W - 50, 30);
    if (tier >= 4) s += g('', P.neon({ w: 60, color: t.lamp }), 50, 30);
    return s;
  }
  function tierOf(level) { return level >= 50 ? 4 : level >= 25 ? 3 : level >= 10 ? 2 : 1; }

  /** Full scene markup for a room. */
  function render(room, def, state) {
    const layout = DE.Data.SCENES[def.id] || DE.Data.SCENES._default;
    const size = def.size, W = CELL * size, level = room.level, tier = tierOf(level);
    let s = `<svg class="scene" viewBox="0 ${-TOP} ${W} ${180 + TOP}" preserveAspectRatio="none" aria-hidden="true">${defs()}${base(def, layout.theme, size, level, room.construction)}`;
    // sprite furniture: laid out by DE.Data.layoutRoom (packed floor, bench tops, eye-level wall items)
    const lay = DE.Data.layoutRoom(def.id, level);
    const img = (it, y, flip) => `<g transform="translate(${it.x.toFixed(1)} ${y.toFixed(1)})"><image href="assets/sprites/${it.s}.png" x="${(-it.w / 2).toFixed(1)}" y="${(-it.h).toFixed(1)}" width="${it.w.toFixed(1)}" height="${it.h.toFixed(1)}" preserveAspectRatio="xMidYMax meet"${flip ? ' transform="scale(-1 1)"' : ''}/></g>`;
    lay.wall.forEach(it => { s += `<g class="prop sprite sp-${it.name}">${img(it, it.y)}</g>`; });
    lay.floor.forEach(it => {
      const FB = FLOOR + DE.Data.FLOOR_DROP;
      let out = `<ellipse cx="${it.x.toFixed(1)}" cy="${FB}" rx="${(it.wfull * .48).toFixed(1)}" ry="3.5" fill="#000" opacity=".35"/>`;
      if (it.sp.pair) out += img(Object.assign({}, it, { x: it.x - it.sp.pair }), FB) + img(Object.assign({}, it, { x: it.x + it.sp.pair }), FB, true);
      else out += img(it, FB);
      s += `<g class="prop sprite sp-${it.name}">${out}</g>`;
    });
    lay.top.forEach(it => { s += `<g class="prop sprite sp-${it.name}">${img(it, it.y)}</g>`; });
    // remaining vector-drawn props (pipes, wires, lamps...) keep their authored spots
    [layout.props, tier >= 2 && layout.lv10, tier >= 3 && layout.lv25, tier >= 4 && layout.lv50].filter(Boolean).flat().forEach(p => {
      const [name, x, y, o] = p; if (DE.Data.SPRITE_PROPS[name]) return; const fn = P[name]; if (!fn) return;
      const opts = Object.assign({}, o || {}); if (opts.v == null) opts.v = tier;
      s += g('prop p-' + name, fn(opts), x, y == null || GROUNDED[name] ? FLOOR : y, opts.scale ? `scale(${opts.scale})` : '');
    });
    if (room.construction) s += g('construction', P.scaffold({ w: W - 30, h: 110 }), W / 2, FLOOR);
    s += `<rect x="0" y="${-TOP}" width="${W}" height="${180 + TOP}" fill="url(#sc-vig)" class="vig"/></svg>`;
    return s;
  }

  /** A prop drawn with its cut-out sprite (DE.Data.SPRITE_PROPS): bottom-centred at the origin,
   * aspect ratio preserved, `n` copies side by side, a soft contact shadow under floor items. */
  function sprite(name, o) {
    const sp = DE.Data.SPRITE_PROPS && DE.Data.SPRITE_PROPS[name], px = sp && DE.Data.SPRITES && DE.Data.SPRITES[sp.s]; if (!px) return null;
    const h = sp.h * ((o && o.scale) || 1), stretch = (name === 'pipe' || name === 'warningstripe' || name === 'neon' || name === 'conveyor') && o && o.w, w = stretch ? o.w : h * px[0] / px[1], n = Math.max(1, Math.min(4, (o && o.n && name !== 'weaponrack' && name !== 'serverrack') ? Math.ceil(o.n / 2) : 1));
    let out = '';
    const xs = sp.pair ? [-sp.pair, sp.pair] : Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (w * .92));
    for (let i = 0; i < xs.length; i++) { const cx = xs[i], fl = sp.pair && i === 1; out += (sp.wall ? '' : `<ellipse cx="${cx.toFixed(1)}" cy="0" rx="${(w * .48).toFixed(1)}" ry="3.5" fill="#000" opacity=".35"/>`) + `<g transform="translate(${cx.toFixed(1)} 0)${fl ? ' scale(-1 1)' : ''}"><image href="assets/sprites/${sp.s}.png" x="${(-w / 2).toFixed(1)}" y="${(-h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="${stretch ? 'none' : 'xMidYMax meet'}"/></g>`; }
    return out;
  }

  /** Station positions (scene x units) for an activity in a room. */
  function stations(def, kind) {
    const layout = DE.Data.SCENES[def.id] || DE.Data.SCENES._default; const st = layout.stations || {};
    let list = st[kind];
    if (!list) { if (kind === 'work') list = st.work; if (!list) { const n = Math.max(1, def.workers || 2); list = []; for (let i = 0; i < n; i++) list.push(30 + (CELL * def.size - 60) * (i + 0.5) / n); } }
    return list;
  }

  return { P, render, sprite, stations, tierOf, defs, THEMES, FLOOR, CELL, TOP };
})();
