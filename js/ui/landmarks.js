/* Landmarks: a small cartoon building for every expedition destination, drawn in the game's
 * outlined style. Used on the expedition map and in the destination header. Places the teams have
 * not found yet are drawn in grey under fog.
 * Each drawing sits in a box of about x -46..46, y -50..12 with the ground at y = 10. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Landmarks = (function () {
  const INK = '#1c1020';
  const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const S2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const GREY = ['#6c6876', '#5a5664', '#7a7684', '#4c4856'];
  let grey = false, gi = 0;
  const c = (col) => grey ? GREY[(gi++) % GREY.length] : col;
  const rect = (x, y, w, h, f, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 0}" fill="${c(f)}" ${S}/>`;
  const poly = (d, f) => `<path d="${d}" fill="${c(f)}" ${S}/>`;
  const win = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w || 6}" height="${h || 6}" rx="1" fill="${grey ? '#3a3644' : '#ffe9a8'}" ${S2}/>`;
  const tree = (x, s) => `<path d="M${x} 10 v-${10 * s}" stroke="${INK}" stroke-width="4"/><circle cx="${x}" cy="${-14 * s}" r="${10 * s}" fill="${c('#4f7a3a')}" ${S}/><circle cx="${x - 4 * s}" cy="${-17 * s}" r="${3 * s}" fill="#fff" opacity=".18"/>`;
  const shadow = (w) => `<ellipse cx="0" cy="11" rx="${w}" ry="6" fill="#000" opacity=".28"/>`;

  const DRAW = {
    suburbs: () => shadow(44) + tree(-36, 1) + rect(-28, -14, 26, 24, '#e8c27a') + poly('M-32 -12 L-15 -30 L2 -12 Z', '#c9503a') + win(-22, -6) + rect(-12, -2, 7, 12, '#7a4a2a')
      + rect(4, -20, 34, 30, '#d8dce6') + poly('M0 -18 L21 -38 L42 -18 Z', '#5a6f9a') + win(10, -12) + win(24, -12) + rect(18, -2, 8, 12, '#7a4a2a'),
    farmland: () => shadow(44) + rect(-40, -22, 40, 32, '#c9503a') + poly('M-44 -20 L-34 -36 L-6 -36 L4 -20 Z', '#8a2a2a') + `<path d="M-30 10 V-8 H-12 V10 M-30 -8 L-12 10 M-12 -8 L-30 10" fill="none" stroke="#fff" stroke-width="2.5"/>`
      + rect(10, -40, 22, 50, '#c9ccd4', 2) + `<path d="M10 -40 Q21 -54 32 -40" fill="${c('#a9abb6')}" ${S}/><path d="M14 -28 H28 M14 -14 H28" ${S2}/>` + tree(40, .7),
    gas: () => shadow(46) + rect(-42, -40, 70, 9, '#d8303a') + `<path d="M-36 -31 V10 M20 -31 V10" stroke="${INK}" stroke-width="5"/><path d="M-36 -31 V10 M20 -31 V10" stroke="${c('#c9ccd4')}" stroke-width="2.5"/>`
      + rect(-14, -14, 14, 24, '#f0a020', 3) + rect(-11, -10, 8, 6, '#2a2a34') + `<path d="M0 -6 q8 2 6 10" fill="none" ${S}/>` + rect(30, -48, 14, 10, '#ffd34a', 2) + `<path d="M37 -38 V10" stroke="${INK}" stroke-width="3"/>`,
    police: () => shadow(44) + rect(-40, -26, 76, 36, '#5a6f9a') + rect(-44, -32, 84, 8, '#3a4a6a') + win(-32, -18, 8, 8) + win(-18, -18, 8, 8) + win(12, -18, 8, 8) + win(26, -18, 8, 8) + rect(-6, -10, 12, 20, '#2a3450')
      + rect(-12, -40, 10, 8, '#e8392f', 2) + rect(2, -40, 10, 8, '#3a7fe8', 2) + `<path d="M0 -24 l3 6 l6 1 l-5 4 l1 6 l-5 -3 l-5 3 l1 -6 l-5 -4 l6 -1 z" fill="${c('#ffd34a')}" ${S2}/>`,
    hospital: () => shadow(44) + rect(-40, -30, 80, 40, '#eef2f6') + rect(-44, -36, 88, 8, '#c9ccd4') + `<path d="M-6 -26 h12 v8 h8 v12 h-8 v8 h-12 v-8 h-8 v-12 h8 z" fill="${c('#e8392f')}" ${S2}/>`
      + win(-34, -22, 9, 8) + win(-22, -22, 9, 8) + win(14, -22, 9, 8) + win(26, -22, 9, 8) + win(-34, -8, 9, 8) + win(26, -8, 9, 8) + rect(-7, 0, 14, 10, '#7aa0c9'),
    waterplant: () => shadow(46) + rect(-42, -22, 34, 32, '#7aa0c9') + `<ellipse cx="-25" cy="-22" rx="17" ry="6" fill="${c('#9fc0e0')}" ${S}/>` + rect(4, -32, 36, 42, '#6a8aac') + `<ellipse cx="22" cy="-32" rx="18" ry="6" fill="${c('#8ab0d6')}" ${S}/>`
      + `<path d="M-8 -4 H4" stroke="${INK}" stroke-width="7"/><path d="M-8 -4 H4" stroke="${c('#c9ccd4')}" stroke-width="3"/><path d="M-36 -10 H-14 M10 -18 H34" ${S2}/>`,
    mall: () => shadow(48) + rect(-46, -28, 92, 38, '#d8c9b0') + rect(-46, -36, 92, 10, '#c93a8a') + `<text x="0" y="-28" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="8" fill="#fff">MALL</text>`
      + rect(-14, -12, 28, 22, '#7ad0ff') + `<path d="M0 -12 V10" ${S2}/>` + win(-38, -18, 14, 8) + win(24, -18, 14, 8) + `<path d="M-42 -26 L-36 -20 M36 -26 L42 -20" ${S2}/>`,
    factory: () => shadow(46) + rect(-12, -52, 9, 40, '#8a5a3a') + rect(4, -46, 9, 34, '#8a5a3a') + `<g class="lm-smoke"><circle cx="-8" cy="-60" r="6" fill="#c9ccd4" opacity=".7"/><circle cx="-2" cy="-68" r="5" fill="#c9ccd4" opacity=".5"/></g>`
      + poly('M-44 10 V-14 L-32 -24 V-14 L-20 -24 V-14 L-8 -24 V-14 L4 -24 V-14 L16 -24 V-14 L28 -24 V-14 L44 -14 V10 Z', '#a8a090') + win(-36, -6, 10, 7) + win(-18, -6, 10, 7) + win(0, -6, 10, 7) + win(20, -6, 10, 7),
    trainyard: () => shadow(48) + `<path d="M-48 8 H48" stroke="${INK}" stroke-width="4"/><path d="M-48 8 H48" stroke="${c('#8a8e98')}" stroke-width="2"/>` + rect(-44, -22, 52, 26, '#c9703a', 2) + `<path d="M-38 -16 h40 M-38 -6 h40" ${S2}/>`
      + rect(12, -18, 32, 22, '#5a7a3a', 2) + [-36, -6, 18, 38].map(x => `<circle cx="${x}" cy="5" r="5" fill="${c('#3a3845')}" ${S2}/>`).join(''),
    radiotower: () => shadow(30) + `<path d="M-16 10 L0 -52 L16 10" fill="none" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M-16 10 L0 -52 L16 10" fill="none" stroke="${c('#c9503a')}" stroke-width="3"/>`
      + `<path d="M-12 -4 H12 M-8 -20 H8 M-5 -34 H5 M-12 -4 L8 -20 M12 -4 L-8 -20 M-8 -20 L5 -34 M8 -20 L-5 -34" stroke="${INK}" stroke-width="2"/>` + `<circle class="lm-blink" cx="0" cy="-54" r="4.5" fill="${grey ? '#5a5664' : '#ff5a4d'}" ${S2}/>` + rect(20, -10, 22, 20, '#8a8e98', 2) + win(25, -5, 12, 6),
    base: () => shadow(48) + rect(-44, -2, 88, 12, '#a8946a', 3) + poly('M-40 -2 L-28 -24 L-16 -2 Z', '#5a6f3a') + poly('M-14 -2 L-2 -24 L10 -2 Z', '#4f6a3a')
      + `<path d="M24 10 V-30 M40 10 V-30" stroke="${INK}" stroke-width="5"/><path d="M24 10 V-30 M40 10 V-30" stroke="${c('#8a5a32')}" stroke-width="2.5"/>` + rect(18, -44, 28, 16, '#6a5a3a', 2) + poly('M16 -44 L32 -54 L48 -44 Z', '#4f6a3a'),
    airport: () => shadow(48) + rect(-38, -16, 10, 26, '#c9ccd4') + rect(-44, -30, 22, 14, '#7ad0ff', 3) + rect(-46, -34, 26, 6, '#5a6f9a', 2)
      + poly('M-8 -2 L36 -6 Q46 -6 46 -2 Q46 2 36 2 L-8 2 Z', '#eef2f6') + poly('M10 -4 L22 -18 L28 -18 L22 -4 Z', '#c9ccd4') + poly('M8 2 L20 12 L26 12 L22 2 Z', '#c9ccd4') + poly('M-6 -2 L-10 -12 L-4 -12 L2 -2 Z', '#c93a3a'),
    cdclab: () => shadow(46) + rect(-44, -12, 88, 22, '#d8dce6') + `<path d="M-28 -12 A28 28 0 0 1 28 -12 Z" fill="${c('#9fc0e0')}" ${S}/><path d="M-18 -16 A20 20 0 0 1 4 -34" fill="none" stroke="#fff" stroke-width="3" opacity=".6"/>`
      + `<circle cx="0" cy="0" r="7" fill="${c('#ffd34a')}" ${S2}/><path d="M0 -3 l-3 5 h6 z" fill="${INK}"/>` + win(-38, -6, 10, 7) + win(28, -6, 10, 7),
  };

  /** SVG markup (no <svg> wrapper) for a destination; `locked` draws it grey under fog. */
  function draw(id, locked) {
    grey = !!locked; gi = 0;
    const f = DRAW[id] || DRAW.suburbs; let s = f();
    if (locked) s += `<g class="lm-fog"><ellipse cx="-14" cy="-16" rx="30" ry="16" fill="#cfd2dc" opacity=".55"/><ellipse cx="18" cy="-24" rx="26" ry="14" fill="#cfd2dc" opacity=".5"/><ellipse cx="4" cy="-6" rx="40" ry="14" fill="#e4e6ee" opacity=".45"/></g><text x="0" y="-8" text-anchor="middle" font-family="Lilita One, Impact, sans-serif" font-size="26" fill="#fff" stroke="${INK}" stroke-width="4" paint-order="stroke">?</text>`;
    grey = false; return s;
  }
  return { draw };
})();
