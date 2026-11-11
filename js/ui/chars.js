/* Characters: every zombie type and survivor profession drawn as a parametric SVG rig
 * (no bitmaps). Each rig is a chibi body split into joint groups — head, torso, two arms,
 * two legs, plus a held item — each wrapped in a <g class="j j-*"> whose local origin is
 * the joint pivot, so CSS rotations in css/rigs.css animate them like bones.
 *
 * Shading: every rig carries its own small <defs> (gradients keyed by character id) so skin,
 * cloth and hair get a lit top and a shaded underside; folds, highlights, dirt and wear are
 * drawn on top. Coordinates: ground centre is (0,0); up is negative y; viewBox -70..70 x -215..10.
 *   DE.Chars.rig(id, { h: 48, anim: 'walk', flip: true, cls, title })  → <svg> markup
 *   DE.Chars.CREW / DE.Chars.ZOMBIES                                    → config tables */
var DE = globalThis.DE = globalThis.DE || {};

DE.Chars = (function () {
  const INK = '#1c1020';
  const SKIN = { light: ['#f6d2ad', '#d9a074', '#fff0dc'], tan: ['#e9b98e', '#b9805a', '#f7d8bc'], zombie: ['#9cb878', '#5f7d4d', '#c3d8a2'], pale: ['#b3c498', '#6e8560', '#d3dec0'], dark: ['#789160', '#46603a', '#a3b88a'], grey: ['#9aa394', '#5d6a5a', '#c2c9bd'] };
  const sw = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const sw3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const sw2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = (c, w) => `stroke="${c}" stroke-width="${w || 2}" stroke-linecap="round" fill="none"`;

  /* ---------- colour helpers ---------- */
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(c, t, k) { const a = hex(c), b = hex(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
  const dark = (c, k) => mix(c, '#1c1020', k == null ? .35 : k), light = (c, k) => mix(c, '#ffffff', k == null ? .35 : k);

  /* ---------- per-rig gradient defs ---------- */
  function defs(id, c) {
    const grad = (name, top, bot, x2, y2) => `<linearGradient id="${id}-${name}" x1="0" y1="0" x2="${x2 || 0}" y2="${y2 == null ? 1 : y2}"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
    let s = '<defs>';
    s += grad('skin', c.skin[2], c.skin[0]) + grad('skinside', c.skin[0], c.skin[1], 1, 0);
    s += grad('shirt', light(c.shirt, .18), dark(c.shirt, .3)) + grad('pants', light(c.pants, .12), dark(c.pants, .35)) + grad('boots', light(c.boots, .15), dark(c.boots, .35));
    if (c.sleeve) s += grad('sleeve', light(c.sleeve, .18), dark(c.sleeve, .3));
    if (c.jacket) s += grad('jacket', light(c.jacket.color, .15), dark(c.jacket.color, .35));
    if (c.hair) s += grad('hair', light(c.hair.color || '#000', .22), dark(c.hair.color || '#000', .3));
    if (c.hat && c.hat.color) s += grad('hat', light(c.hat.color, .22), dark(c.hat.color, .3));
    if (c.robe) s += grad('robe', light(c.robe, .15), dark(c.robe, .35));
    s += `<radialGradient id="${id}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9dff5a" stop-opacity=".9"/><stop offset="1" stop-color="#9dff5a" stop-opacity="0"/></radialGradient>`;
    return s + '</defs>';
  }

  /* ---------- body part drawers (local coords, pivot at 0,0) ---------- */
  // head: pivot at the neck; face centred at (0,-44)
  function head(c, id) {
    const cy = -44; const rx = c.headW || 36, ry = c.headH || 40;
    let s = `<g class="hair-back">${hairBack(c, cy, rx, ry, id)}</g>`;
    s += `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#${id}-skin)" ${sw}/>`;
    // jaw / cheek shading and a top highlight
    s += `<path d="M${-rx + 6} ${cy + 8} q${rx - 6} 30 ${rx * 2 - 12} 0 q-${rx - 6} 20 -${rx * 2 - 12} 0 z" fill="${c.skin[1]}" opacity=".45"/>`;
    s += `<path d="M${-rx * .55} ${cy - ry * .72} q${rx * .4} -8 ${rx * .9} -2" ${thin(c.skin[2], 4)} opacity=".7"/>`;
    // ears with inner shade
    s += `<ellipse cx="${-rx + 2}" cy="${cy + 4}" rx="6" ry="8" fill="url(#${id}-skin)" ${sw3}/><ellipse cx="${rx - 2}" cy="${cy + 4}" rx="6" ry="8" fill="url(#${id}-skin)" ${sw3}/><ellipse cx="${-rx + 2}" cy="${cy + 5}" rx="2.5" ry="4" fill="${c.skin[1]}"/><ellipse cx="${rx - 2}" cy="${cy + 5}" rx="2.5" ry="4" fill="${c.skin[1]}"/>`;
    if (c.kind === 'zombie') s += zombieFaceDamage(c, cy, rx, ry);
    else if (c.dirt) s += `<g fill="${dark(c.skin[1], .4)}" opacity=".35"><path d="M${rx - 18} ${cy + 14} q6 2 10 -2 q2 4 -4 6 z"/><circle cx="${-rx + 12}" cy="${cy + 18}" r="2"/></g>`;
    s += face(c, cy, rx);
    s += `<g class="hair-front">${hairFront(c, cy, rx, ry, id)}</g>`;
    s += headgear(c, cy, rx, ry, id);
    return s;
  }
  function zombieFaceDamage(c, cy, rx, ry) {
    let s = `<g fill="${c.skin[1]}" opacity=".55"><ellipse cx="${rx - 12}" cy="${cy + 16}" rx="7" ry="4"/><ellipse cx="${-rx + 14}" cy="${cy - 6}" rx="5" ry="3"/></g>`;
    // open wound with stitches, rot patch, exposed bone on heavy types
    s += `<path d="M${-rx + 8} ${cy - 14} l8 10 l-4 7" fill="none" ${thin('#5b2a2a', 3)}/><path d="M${-rx + 9} ${cy - 10} l4 -2 M${-rx + 12} ${cy - 6} l4 -2 M${-rx + 13} ${cy - 1} l4 -1" ${thin(INK, 1.5)}/>`;
    s += `<ellipse cx="${rx - 14}" cy="${cy + 12}" rx="7" ry="4" fill="#5b7a3f"/><ellipse cx="${rx - 16}" cy="${cy + 11}" rx="2" ry="1.2" fill="#8aa85a"/>`;
    if (c.big || c.bone) s += `<path d="M${rx - 10} ${cy - 24} q10 2 12 12 q-6 -2 -8 2" fill="#efe6d0" ${sw2}/><path d="M${rx - 6} ${cy - 20} l4 4" ${thin(INK, 1.5)}/>`;
    if (c.drip) s += `<path d="M${-6} ${cy + 36} q-2 8 1 14 q3 -6 1 -14 z" fill="#8f1e2e" ${sw2}/>`;
    return s;
  }
  function face(c, cy, rx) {
    const ey = cy + 2; let s = '';
    const eye = c.eyes || 'normal';
    if (eye === 'sunglasses') s += `<path d="M-27 ${ey - 3} h23 v11 h-23 z M4 ${ey - 3} h23 v11 h-23 z" fill="#15131a" ${sw3}/><path d="M-4 ${ey + 1} h8" ${sw3}/><path d="M-23 ${ey - 1} h7 M8 ${ey - 1} h7" stroke="#7a8aa0" stroke-width="2"/><path d="M-26 ${ey - 3} l-4 -4 M27 ${ey - 3} l4 -4" ${sw3}/>`;
    else if (eye === 'visor') s += `<path d="M-28 ${ey - 10} h56 v22 q0 6 -6 6 h-44 q-6 0 -6 -6 z" fill="#1d1a26" ${sw}/><path d="M-22 ${ey - 4} h18" stroke="#6d6a86" stroke-width="3"/><ellipse cx="-10" cy="${ey + 3}" rx="5" ry="3" fill="#f3e36a" opacity=".7"/><ellipse cx="12" cy="${ey + 3}" rx="5" ry="3" fill="#f3e36a" opacity=".7"/>`;
    else {
      const glow = eye === 'glow' || eye === 'greenglow'; const col = eye === 'greenglow' ? '#7dff5a' : glow ? '#f3e36a' : '#ffffff';
      const irisC = c.eyeColor || '#2a1a24';
      if (glow) s += `<ellipse cx="-12" cy="${ey}" rx="13" ry="11" fill="${col}" opacity=".3" stroke="none"/><ellipse cx="12" cy="${ey}" rx="13" ry="11" fill="${col}" opacity=".3" stroke="none"/>`;
      // eye whites with a shadow under the lid
      const ry = c.angry ? 7 : 9;
      s += `<ellipse cx="-12" cy="${ey}" rx="8" ry="${ry}" fill="${col}" ${sw3}/><ellipse cx="12" cy="${ey}" rx="8" ry="${ry}" fill="${col}" ${sw3}/>`;
      s += `<path d="M-19 ${ey - ry + 3} q7 -2 14 0 M5 ${ey - ry + 3} q7 -2 14 0" ${thin(glow ? dark(col, .3) : '#c9c2d8', 2)} opacity=".7"/>`;
      if (!glow) {
        const px = c.look == null ? 1 : c.look;
        s += `<circle cx="${-12 + px}" cy="${ey + 1}" r="4.5" fill="${irisC}"/><circle cx="${12 + px}" cy="${ey + 1}" r="4.5" fill="${irisC}"/><circle cx="${-12 + px}" cy="${ey + 1}" r="2.2" fill="#000"/><circle cx="${12 + px}" cy="${ey + 1}" r="2.2" fill="#000"/><circle cx="${-14 + px}" cy="${ey - 2}" r="1.6" fill="#fff"/><circle cx="${10 + px}" cy="${ey - 2}" r="1.6" fill="#fff"/>`;
      } else s += `<circle cx="-12" cy="${ey + 1}" r="2.6" fill="#2a1a24"/><circle cx="12" cy="${ey + 1}" r="2.6" fill="#2a1a24"/><circle cx="-14" cy="${ey - 2}" r="1.2" fill="#fff" opacity=".8"/><circle cx="10" cy="${ey - 2}" r="1.2" fill="#fff" opacity=".8"/>`;
      // brows
      const bc = c.hair && c.hair.color ? dark(c.hair.color, .3) : INK;
      if (c.angry) s += `<path d="M-23 ${ey - 13} l17 6 M23 ${ey - 13} l-17 6" stroke="${bc}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
      else if (c.brows === 'stern') s += `<path d="M-21 ${ey - 12} q9 -4 17 -2 M4 ${ey - 14} q8 -2 17 2" stroke="${bc}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`;
      else if (c.brows !== false) s += `<path d="M-20 ${ey - 13} q8 -4 16 -1 M4 ${ey - 14} q8 -3 16 1" stroke="${bc}" stroke-width="3" stroke-linecap="round" fill="none"/>`;
      if (eye === 'glasses') s += `<circle cx="-12" cy="${ey}" r="11.5" fill="#bfe6ff" fill-opacity=".18" ${sw3}/><circle cx="12" cy="${ey}" r="11.5" fill="#bfe6ff" fill-opacity=".18" ${sw3}/><path d="M-1 ${ey} h2 M-23 ${ey - 1} l-8 -2 M23 ${ey - 1} l8 -2" ${sw3}/><path d="M-18 ${ey - 6} l4 -3 M6 ${ey - 6} l4 -3" ${thin('#fff', 2)} opacity=".8"/>`;
    }
    // nose
    s += `<path d="M-2 ${cy + 8} q3 4 5 0" ${thin(dark(c.skin[1], .2), 2.5)}/>`;
    const m = c.mouth || 'smile'; const my = cy + 20;
    if (m === 'smile') s += `<path d="M-8 ${my} q8 6 16 0" fill="none" ${sw3}/><path d="M-5 ${my + 1} q5 3 10 0" ${thin('#fff', 1.5)} opacity=".6"/>`;
    else if (m === 'grim') s += `<path d="M-9 ${my} h18" fill="none" ${sw3}/><path d="M-9 ${my} l-2 -2 M9 ${my} l2 -2" ${sw3}/>`;
    else if (m === 'open') s += `<path d="M-13 ${my - 5} q13 -5 26 0 q-2 17 -13 17 q-11 0 -13 -17 z" fill="#3a1424" ${sw3}/><path d="M-10 ${my - 3} l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5" fill="#fff" stroke="none"/><path d="M-6 ${my + 8} q6 4 12 0" fill="#8f1e2e"/>`;
    else if (m === 'drool') s += `<path d="M-13 ${my - 5} q13 -5 26 0 q-2 15 -13 15 q-11 0 -13 -15 z" fill="#3a1424" ${sw3}/><path d="M-9 ${my - 3} l3 5 l3 -5 l3 5" fill="#fff" stroke="none"/><path class="slime" d="M-4 ${my + 8} q-2 14 4 26 q6 -12 2 -26 z" fill="#9dff3a" ${sw3} stroke="#4c8a1e"/><circle cx="2" cy="${my + 30}" r="4" fill="#9dff3a" stroke="#4c8a1e" stroke-width="2"/>`;
    else if (m === 'fangs') s += `<path d="M-15 ${my - 7} q15 -6 30 0 q-2 19 -15 19 q-13 0 -15 -19 z" fill="#3a1424" ${sw3}/><path d="M-11 ${my - 5} l3 10 l3 -10 M5 ${my - 5} l3 10 l3 -10" fill="#fff" stroke="none"/><path d="M-8 ${my + 10} q8 5 16 0" fill="#8f1e2e"/>`;
    else if (m === 'stubble') s += `<path d="M-7 ${my} q7 4 14 0" fill="none" ${sw3}/><g fill="#5b4a3a" opacity=".5"><circle cx="-16" cy="${my + 2}" r="1.5"/><circle cx="18" cy="${my + 1}" r="1.5"/><circle cx="-10" cy="${my + 8}" r="1.5"/><circle cx="10" cy="${my + 8}" r="1.5"/><circle cx="0" cy="${my + 10}" r="1.5"/><circle cx="-14" cy="${my + 7}" r="1.2"/><circle cx="15" cy="${my + 6}" r="1.2"/></g>`;
    else if (m === 'smirk') s += `<path d="M-7 ${my + 1} q8 6 15 -2" fill="none" ${sw3}/>`;
    if (c.beard) s += beard(c, my);
    if (c.cheeks) s += `<ellipse cx="-20" cy="${cy + 12}" rx="5" ry="3" fill="#ff8a7a" opacity=".3"/><ellipse cx="20" cy="${cy + 12}" rx="5" ry="3" fill="#ff8a7a" opacity=".3"/>`;
    return s;
  }
  function beard(c, my) {
    const col = c.beard.color, hi = light(col, .25);
    if (c.beard.style === 'full') return `<path d="M-30 ${my - 12} q4 30 30 32 q26 -2 30 -32 q-8 20 -30 18 q-22 2 -30 -18 z" fill="${col}" ${sw}/><path d="M-20 ${my + 2} q6 10 14 12 M18 ${my} q-4 10 -12 13" ${thin(hi, 2.5)} opacity=".7"/><path d="M-9 ${my + 1} q9 4 18 0" fill="none" ${sw3}/>`;
    if (c.beard.style === 'long') return `<path d="M-32 ${my - 14} q2 36 32 44 q30 -8 32 -44 q-10 22 -32 20 q-22 2 -32 -20 z" fill="${col}" ${sw}/><path d="M-22 ${my - 2} q4 18 16 28 M22 ${my - 2} q-4 18 -16 28" ${thin(hi, 2.5)} opacity=".7"/><path d="M-20 ${my - 6} q20 8 40 0" fill="none" ${sw3} stroke="#cfcfd8"/>`;
    return `<path d="M-26 ${my - 8} q4 22 26 24 q22 -2 26 -24 q-8 14 -26 12 q-18 2 -26 -12 z" fill="${col}" opacity=".9" ${sw3}/>`;
  }
  function hairBack(c, cy, rx, ry, id) {
    const h = c.hair; if (!h) return ''; const col = `url(#${id}-hair)`;
    if (h.style === 'ponytail') return `<path d="M${rx - 6} ${cy - 10} q30 10 22 60 q-10 10 -16 0 q10 -30 -6 -50 z" fill="${col}" ${sw}/><path d="M${rx + 4} ${cy + 4} q10 14 6 34" ${thin(light(h.color, .3), 2.5)} opacity=".8"/><path d="M${rx - 2} ${cy + 20} h18" ${thin('#c93a3a', 4)}/>`;
    if (h.style === 'messy' || h.style === 'wild') return `<path d="M${-rx - 6} ${cy - 6} q-6 30 8 46 q6 -14 2 -30 M${rx + 6} ${cy - 6} q6 30 -8 46 q-6 -14 -2 -30" fill="${col}" ${sw}/>`;
    if (h.style === 'long') return `<path d="M${-rx - 2} ${cy - 10} q-8 40 6 56 h${rx * 2 - 8} q14 -16 6 -56 z" fill="${col}" ${sw}/>`;
    return '';
  }
  function hairFront(c, cy, rx, ry, id) {
    const h = c.hair; if (!h) return ''; const col = `url(#${id}-hair)`; const hi = h.color ? light(h.color, .35) : '#fff'; const top = cy - ry;
    switch (h.style) {
      case 'short': return `<path d="M${-rx + 2} ${cy - 8} q-2 -34 ${rx - 2} -36 q${rx} 2 ${rx - 2} 36 q-10 -14 -22 -16 q-8 10 -20 6 q-10 -2 -16 10 z" fill="${col}" ${sw}/><path d="M${-rx + 12} ${cy - 24} q10 -10 24 -8" ${thin(hi, 3)} opacity=".6"/>`;
      case 'messy': return `<path d="M${-rx} ${cy - 2} q-4 -40 ${rx} -42 q${rx + 4} 2 ${rx} 42 l-8 -12 l-8 10 l-8 -14 l-8 12 l-8 -12 l-8 12 l-8 -10 l-8 10 z" fill="${col}" ${sw}/><path d="M${-rx + 10} ${cy - 26} q12 -10 26 -8 M${rx - 14} ${cy - 18} l6 -8" ${thin(hi, 3)} opacity=".6"/>`;
      case 'wild': return `<path d="M${-rx - 4} ${cy} l-6 -22 l12 6 l-2 -24 l14 10 l2 -22 l12 14 l6 -18 l8 18 l12 -14 l0 22 l14 -10 l-4 26 l12 -6 l-8 24 q-${rx} -22 -${rx * 2} 0 z" fill="${col}" ${sw}/><path d="M${-rx + 6} ${cy - 20} l8 -14 M${rx - 10} ${cy - 22} l-4 -14" ${thin(hi, 2.5)} opacity=".55"/>`;
      case 'ponytail': return `<path d="M${-rx} ${cy - 6} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-6 -16 -18 -18 q-14 8 -30 2 q-10 0 -16 16 z" fill="${col}" ${sw}/><path d="M${rx - 14} ${cy - 30} q14 -6 18 8" fill="none" ${sw3}/><path d="M${-rx + 10} ${cy - 24} q12 -12 28 -10" ${thin(hi, 3)} opacity=".65"/>`;
      case 'bun': return `<path d="M${-rx} ${cy - 6} q-2 -34 ${rx} -36 q${rx + 2} 2 ${rx} 36 q-12 -14 -24 -12 q-12 -8 -22 2 q-8 0 -12 10 z" fill="${col}" ${sw}/><circle cx="${rx - 10}" cy="${top - 2}" r="12" fill="${col}" ${sw}/><path d="M${rx - 16} ${top - 6} q6 -6 12 -2" ${thin(hi, 2.5)} opacity=".7"/><path d="M${-rx + 10} ${cy - 24} q12 -10 26 -8" ${thin(hi, 3)} opacity=".6"/>`;
      case 'mohawk': return `<path d="M-6 ${top + 4} l-4 -22 l8 4 l2 -20 l8 14 l4 -12 l4 20 l6 -8 l-2 24 q-10 -8 -26 0 z" fill="${col}" ${sw}/><path d="M-2 ${top - 10} l4 -14 M6 ${top - 8} l2 -10" ${thin('#ffd34a', 2.5)} opacity=".8"/><path d="M-8 ${cy - 8} q-${rx - 6} 4 -${rx - 2} 12 M8 ${cy - 8} q${rx - 6} 4 ${rx - 2} 12" fill="none" ${sw3}/>`;
      case 'white': return `<path d="M${-rx} ${cy - 4} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-8 -16 -20 -16 q-10 6 -24 0 q-10 0 -16 14 z" fill="${col}" ${sw}/><path d="M${-rx + 8} ${cy - 22} q10 -10 24 -10 M${rx - 20} ${cy - 20} l8 -6" ${thin('#fff', 2.5)} opacity=".7"/>`;
      case 'bald': return `<path d="M${-rx + 4} ${cy - 20} q4 -8 10 -6 M${rx - 14} ${cy - 24} q6 -2 8 4" fill="none" ${sw3} stroke="#4c6a3c"/><path d="M${-rx + 14} ${cy - 30} q${rx - 10} -8 ${rx * 2 - 34} 2" ${thin(c.skin[2], 3)} opacity=".6"/>`;
      case 'spikes': return `<path d="M-30 ${cy - 24} l-6 -20 l12 8 l-2 -22 l12 14 l4 -22 l8 18 l8 -18 l4 22 l12 -14 l-2 22 l12 -8 l-6 20 q-${rx} -14 -${rx * 2} 0 z" fill="${col}" ${sw}/><path d="M-22 ${cy - 34} l4 -10 M2 ${cy - 42} l2 -10 M20 ${cy - 36} l6 -8" ${thin(hi, 2.5)} opacity=".6"/>`;
      default: return '';
    }
  }
  function headgear(c, cy, rx, ry, id) {
    const g = c.hat; if (!g) return ''; const top = cy - ry; const col = g.color ? `url(#${id}-hat)` : '#f6f4ee'; const hi = g.color ? light(g.color, .4) : '#fff';
    switch (g.type) {
      case 'hardhat': return `<path d="M${-rx - 6} ${cy - 20} q4 -40 ${rx + 6} -40 q${rx + 2} 0 ${rx + 6} 40 z" fill="${col}" ${sw}/><rect x="${-rx - 10}" y="${cy - 24}" width="${rx * 2 + 20}" height="10" rx="4" fill="${col}" ${sw}/><path d="M-8 ${top - 14} h16 M-22 ${top - 6} l4 -4" ${thin(hi, 4)} opacity=".7"/><path d="M${rx - 12} ${top - 2} l6 6" ${thin(dark(g.color, .4), 2)}/><path d="M${-rx} ${cy - 20} h${rx * 2}" ${thin(dark(g.color, .3), 2)} opacity=".6"/>`;
      case 'helmet': return `<path d="M${-rx - 6} ${cy - 18} q2 -44 ${rx + 6} -44 q${rx + 4} 0 ${rx + 6} 44 z" fill="${col}" ${sw}/><rect x="${-rx - 9}" y="${cy - 22}" width="${rx * 2 + 18}" height="9" rx="4" fill="${g.color2 || g.color}" ${sw}/><path d="M${-rx} ${cy - 30} h12 M4 ${cy - 44} l10 4 M${rx - 18} ${cy - 36} l8 -3" stroke="#2e3a22" stroke-width="3" opacity=".8"/><path d="M${-rx + 6} ${cy - 36} q8 -14 22 -14" ${thin(hi, 3)} opacity=".5"/><path d="M${-rx - 4} ${cy - 18} h${rx * 2 + 8}" ${thin('#6b7a4a', 4)}/><path d="M${-rx - 6} ${cy - 18} l${-2} 14 M${rx + 6} ${cy - 18} l2 14" ${thin('#3a2a22', 3)}/>`;
      case 'riot': return `<path d="M${-rx - 5} ${cy - 10} q0 -38 ${rx + 5} -38 q${rx + 5} 0 ${rx + 5} 38 z" fill="${col}" ${sw}/><path d="M${-rx - 7} ${cy - 16} h${rx * 2 + 14} v26 q0 6 -6 6 h${-(rx * 2 + 2)} q-6 0 -6 -6 z" fill="#1d1a26" fill-opacity=".82" ${sw}/><path d="M${-rx} ${cy - 8} h${rx * 2 - 6}" stroke="#6d6a86" stroke-width="3" opacity=".6"/><path d="M${-rx + 2} ${cy - 40} q${rx - 2} -6 ${rx * 2 - 4} 0" fill="none" stroke="#55536a" stroke-width="3"/><path d="M${-rx - 7} ${cy + 16} q${rx + 7} 10 ${rx * 2 + 14} 0" fill="none" ${sw3}/><path d="M${-rx + 4} ${cy - 30} l8 -8 l4 1" ${thin('#8a88a0', 2)}/><path d="M${rx - 14} ${cy - 2} l6 10" ${thin('#8a88a0', 2)} opacity=".6"/>`;
      case 'chef': return `<path d="M${-rx + 2} ${cy - 26} v-18 h${rx * 2 - 4} v18 z" fill="#f6f4ee" ${sw}/><path d="M${-rx - 2} ${cy - 44} q-6 -30 16 -30 q8 -14 22 -6 q14 -8 22 6 q20 0 16 30 z" fill="#f6f4ee" ${sw}/><path d="M${-rx + 6} ${cy - 50} q6 -14 14 -16 M${rx - 20} ${cy - 54} l8 -8" ${thin('#cfcbc0', 2.5)}/><path d="M${-rx + 8} ${cy - 36} v10 M0 ${cy - 36} v10 M${rx - 8} ${cy - 36} v10" ${thin('#d8d4ca', 2)}/>`;
      case 'cap': return `<path d="M${-rx} ${cy - 16} q0 -34 ${rx} -36 q${rx} 2 ${rx} 36 z" fill="${col}" ${sw}/><path d="M${-rx - 2} ${cy - 16} h${rx * 2 + 4} l12 8 q-${rx + 14} 6 -${rx * 2 + 28} 0 z" fill="${col}" ${sw}/><circle cx="0" cy="${cy - 30}" r="4" fill="${g.color2 || '#fff'}" stroke="none"/><path d="M${-rx + 8} ${cy - 28} q10 -14 26 -14" ${thin(hi, 3)} opacity=".5"/><path d="M0 ${cy - 52} v36" ${thin(dark(g.color, .3), 2)}/>`;
      case 'police': return `<path d="M${-rx - 2} ${cy - 20} v-10 q${rx + 2} -22 ${rx * 2 + 4} 0 v10 z" fill="${col}" ${sw}/><rect x="${-rx - 6}" y="${cy - 22}" width="${rx * 2 + 12}" height="9" rx="3" fill="#15131a" ${sw3}/><path d="M-6 ${cy - 44} l6 -6 l6 6 l-2 8 h-8 z" fill="#ffd34a" ${sw3}/><path d="M${-rx + 4} ${cy - 30} q10 -12 24 -14" ${thin(hi, 3)} opacity=".45"/><path d="M${-rx - 4} ${cy - 17} h${rx * 2 + 8}" ${thin('#ffd34a', 2)} opacity=".8"/>`;
      case 'goggles': return `<path d="M${-rx - 2} ${cy - 22} q${rx + 2} -8 ${rx * 2 + 4} 0" fill="none" stroke="#5a3a2a" stroke-width="6"/><circle cx="-13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="-13" cy="${cy - 26}" r="5.5" fill="#bfe6ff" opacity=".85"/><circle cx="13" cy="${cy - 26}" r="5.5" fill="#bfe6ff" opacity=".85"/><circle cx="-15" cy="${cy - 28}" r="1.8" fill="#fff"/><circle cx="11" cy="${cy - 28}" r="1.8" fill="#fff"/>`;
      case 'hood': return `<path d="M${-rx - 12} ${cy + 36} q-6 -70 ${rx + 12} -92 q${rx + 18} 22 ${rx + 12} 92 q-${rx + 12} 8 -${rx * 2 + 24} 0 z" fill="${col}" ${sw}/><path d="M${-rx + 2} ${cy + 24} q-2 -50 ${rx - 2} -56 q${rx} 6 ${rx - 2} 56 q-${rx - 2} 6 -${rx * 2 - 4} 0 z" fill="#2a1030" ${sw}/><path d="M${-rx - 6} ${cy + 10} q2 -40 ${rx + 4} -56" ${thin(hi, 3)} opacity=".4"/><path d="M${rx - 4} ${cy + 30} l6 -16 M${-rx + 2} ${cy + 32} l-6 -14" ${thin(dark(g.color, .4), 2.5)}/>`;
      default: return '';
    }
  }

  // torso: pivot at hips (0,0); neck at (0,-L); widths at shoulders / hips
  function torso(c, id) {
    const L = c.torsoLen || 52, ws = c.shoulderW || 30, wh = c.hipW || 24;
    const body = `M${-wh} 2 L${-ws} ${-L + 10} q0 -10 10 -10 h${ws * 2 - 20} q10 0 10 10 L${wh} 2 z`;
    let s = `<path d="${body}" fill="url(#${id}-shirt)" ${sw}/>`;
    // folds & side shade
    s += `<path d="M${-ws + 8} ${-L + 14} q-2 ${L * .5} 4 ${L - 16}" ${thin(dark(c.shirt, .3), 2.5)} opacity=".5"/><path d="M${ws - 8} ${-L + 14} q2 ${L * .5} -4 ${L - 16}" ${thin(light(c.shirt, .3), 2)} opacity=".45"/>`;
    if (c.belly) s += `<ellipse cx="2" cy="${-L * .42}" rx="${ws - 2}" ry="${L * .36}" fill="url(#${id}-shirt)" ${sw}/><path d="M-12 ${-L * .3} q14 8 28 0" ${thin(dark(c.shirt, .35), 2.5)} opacity=".6"/><path d="M-6 ${-L * .6} q8 -4 16 0" ${thin(light(c.shirt, .4), 3)} opacity=".5"/><circle cx="4" cy="${-L * .28}" r="2.5" fill="${dark(c.shirt, .4)}"/>`;
    if (c.torn) s += `<path d="M${-wh + 4} 0 l6 -8 l5 8 l6 -10 l6 10 l5 -8 l6 8" fill="url(#${id}-skin)" stroke="none"/><path d="M${-wh + 4} 0 l6 -8 l5 8 l6 -10 l6 10 l5 -8 l6 8" fill="none" ${sw2}/><ellipse cx="-8" cy="${-L * .5}" rx="6" ry="4" fill="#6b3a3a" opacity=".6"/><ellipse cx="10" cy="${-L * .3}" rx="4" ry="6" fill="#6b3a3a" opacity=".5"/><path d="M${ws - 14} ${-L + 16} l6 8 l-8 2" fill="url(#${id}-skin)" ${sw2}/>`;
    if (c.ribs) s += `<path d="M-14 ${-L * .62} q10 4 20 0 M-12 ${-L * .5} q10 4 18 0 M-10 ${-L * .38} q8 4 14 0" ${thin('#efe6d0', 3)}/><path d="M-14 ${-L * .62} q10 4 20 0 M-12 ${-L * .5} q10 4 18 0 M-10 ${-L * .38} q8 4 14 0" ${thin(INK, 1)} opacity=".5"/>`;
    if (c.jacket) {
      const j = c.jacket, len = j.len || L + 6, jc = `url(#${id}-jacket)`;
      s += `<path d="M${-ws + 2} ${-L + 6} q-6 ${L * .5} -4 ${len} h${ws - 10} L-6 ${-L + 4} z" fill="${jc}" ${sw}/><path d="M${ws - 2} ${-L + 6} q6 ${L * .5} 4 ${len} h${-(ws - 10)} L6 ${-L + 4} z" fill="${jc}" ${sw}/>`;
      s += `<path d="M${-ws + 2} ${-L + 6} l${ws - 10} 14 M${ws - 2} ${-L + 6} l${-(ws - 10)} 14" fill="none" ${sw3} stroke="${j.lapel || j.color}"/>`;
      s += `<path d="M${-ws + 6} ${-L + 20} q-1 ${L * .5} 1 ${len - 24} M${ws - 6} ${-L + 20} q1 ${L * .5} -1 ${len - 24}" ${thin(dark(j.color, .35), 2)} opacity=".6"/><path d="M${-ws + 4} ${len - 10} h${ws - 14}" ${thin(dark(j.color, .35), 2)} opacity=".5"/>`;
      if (j.pocket) s += `<path d="M${-ws + 5} ${-L * .3} h${ws - 16} v10 h${-(ws - 16)} z M${ws - 5} ${-L * .3} h${-(ws - 16)} v10 h${ws - 16} z" fill="none" ${sw2}/>`;
    }
    if (c.vest) s += `<path d="M${-ws + 4} ${-L + 6} l${ws - 14} 8 v${L - 10} h${-(ws - 12)} z M${ws - 4} ${-L + 6} l${-(ws - 14)} 8 v${L - 10} h${ws - 12} z" fill="${c.vest}" ${sw3}/><path d="M${-ws + 6} ${-L * .5} h${ws - 16} M${ws - 6} ${-L * .5} h${-(ws - 16)}" stroke="#f3f0d0" stroke-width="3"/><path d="M${-ws + 6} ${-L * .5 + 6} h${ws - 16} M${ws - 6} ${-L * .5 + 6} h${-(ws - 16)}" stroke="#f3f0d0" stroke-width="1.5" opacity=".7"/>`;
    if (c.apron) s += `<path d="M-16 ${-L + 10} h32 v${L - 12} q-16 6 -32 0 z" fill="${c.apron}" ${sw3}/><path d="M-16 ${-L + 10} l-8 -6 M16 ${-L + 10} l8 -6" ${sw3}/><path d="M-10 ${-L * .4} h20 v10 h-20 z" fill="none" ${sw2}/><path d="M-12 ${-L + 20} q0 ${L * .5} 2 ${L - 28}" ${thin(dark(c.apron, .35), 2)} opacity=".6"/><path d="M-4 ${-L * .55} l3 -6 l3 6" ${thin('#8a8e98', 2)}/>`;
    if (c.cross) s += `<rect x="-14" y="${-L * .62}" width="12" height="12" rx="2" fill="#fff" ${sw3}/><path d="M-8 ${-L * .62 + 2} v8 M-12 ${-L * .62 + 6} h8" stroke="#d8303a" stroke-width="3"/>`;
    if (c.stethoscope) s += `<path d="M-14 ${-L + 8} q-10 18 -4 30 q6 8 14 2 M14 ${-L + 8} q10 18 4 30" fill="none" ${thin('#3a3f4a', 3)}/><circle cx="-4" cy="${-L * .4}" r="4" fill="#c9ccd4" ${sw2}/>`;
    if (c.armor) s += `<path d="M${-ws + 4} ${-L + 8} h${ws * 2 - 8} v${L - 14} q-${ws - 4} 10 -${ws * 2 - 8} 0 z" fill="#2f2d38" ${sw3}/><path d="M-10 ${-L + 16} h20 M-10 ${-L * .55} h20 M-10 ${-L * .3} h20" stroke="#56546a" stroke-width="3"/><circle cx="${-ws + 8}" cy="${-L * .7}" r="3" fill="#8a8898"/><circle cx="${ws - 8}" cy="${-L * .7}" r="3" fill="#8a8898"/><path d="M${-ws + 6} ${-L + 12} l6 6" ${thin('#8a88a0', 2)} opacity=".7"/><path d="M${ws - 14} ${-L * .45} l-4 8 l6 2" ${thin('#8a88a0', 2)} opacity=".6"/><text x="0" y="${-L * .18}" font-family="Lilita One, Impact, sans-serif" font-size="8" fill="#9a98b0" text-anchor="middle">RIOT</text>`;
    if (c.bandolier) s += `<path d="M${-ws + 2} ${-L + 10} L${ws - 4} ${-L * .25}" ${thin('#5a3a24', 7)}/><path d="M${-ws + 2} ${-L + 10} L${ws - 4} ${-L * .25}" ${thin(INK, 9)} opacity=".25"/><g fill="#d8b04a" ${sw2}>${[0.2, 0.4, 0.6, 0.8].map(t => `<rect x="${-ws + 2 + (ws * 2 - 6) * t - 2}" y="${-L + 10 + (L * .75 - 10) * t - 5}" width="4" height="9" rx="1"/>`).join('')}</g>`;
    if (c.toolbelt) s += `<rect x="${-wh - 2}" y="-12" width="${wh * 2 + 4}" height="10" fill="#6b4a2e" ${sw3}/><rect x="${-wh + 2}" y="-6" width="10" height="8" fill="#8a6a4a" ${sw2}/><rect x="${wh - 12}" y="-6" width="10" height="8" fill="#8a6a4a" ${sw2}/><path d="M${-wh + 5} -6 v-6 M${wh - 7} -6 v-5" ${thin('#c9ccd4', 3)}/>`;
    if (c.badge) s += `<path d="M${-ws + 10} ${-L * .7} l5 -5 l5 5 l-2 6 h-6 z" fill="#ffd34a" ${sw2}/><rect x="${ws - 18}" y="${-L * .75}" width="8" height="12" rx="2" fill="#2a2a34" ${sw2}/><path d="M${ws - 14} ${-L * .75} v-6" ${thin(INK, 2)}/>`;
    if (c.backpack) s += `<path d="M${-ws - 10} ${-L + 14} h14 v${L * .7} h-14 z" fill="#5a4a3a" ${sw3}/><path d="M${-ws - 8} ${-L * .55} h10" ${thin(INK, 2)}/><path d="M${-ws - 2} ${-L + 12} q6 -4 12 0" ${thin('#5a4a3a', 4)}/>`;
    if (c.dynamite) s += `<g class="dyn"><rect x="-18" y="${-L * .7}" width="36" height="18" rx="3" fill="#2a2630" ${sw3}/><rect x="-14" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="-4" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="6" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><path d="M-10 ${-L * .66} q-2 -8 4 -10 M0 ${-L * .66} q-2 -8 4 -10 M10 ${-L * .66} q-2 -8 4 -10" fill="none" stroke="#e7c35a" stroke-width="2"/><circle class="fuse" cx="14" cy="${-L * .66 - 10}" r="3" fill="#ffb13a"/><path d="M-12 ${-L * .6} v6 M-2 ${-L * .6} v6 M8 ${-L * .6} v6" ${thin('#ff8a7a', 1.5)} opacity=".8"/></g>`;
    if (c.robe) s += `<path d="M${-wh - 8} 8 q${wh + 8} 8 ${wh * 2 + 16} 0 L${ws} ${-L + 6} h${-ws * 2} z" fill="url(#${id}-robe)" ${sw}/><path d="M-4 ${-L + 10} v${L + 4}" stroke="${dark(c.robe, .4)}" stroke-width="3"/><path d="M${-wh - 2} 2 q-2 -${L * .5} -6 -${L - 12} M${wh + 2} 2 q2 -${L * .5} 6 -${L - 12}" ${thin(dark(c.robe, .35), 2.5)} opacity=".6"/><path d="M-8 ${-L * .5} l-3 8 l6 0 z M8 ${-L * .3} l-3 8 l6 0 z" fill="#5a2a70"/><path d="M-12 ${-L * .72} q12 -6 24 0" ${thin('#9dff5a', 2)} opacity=".7"/>`;
    if (c.spikes) s += `<g class="spikes"><path d="M${ws - 6} ${-L + 4} l14 -18 l2 20 l12 -12 l-2 20 l12 -8 l-6 18 l10 -2 l-10 14 l6 10 l-12 -2 l2 14 l-12 -10 l-4 12 l-6 -14 z" fill="#b25a8f" ${sw}/><path d="M${ws + 2} ${-L + 10} l6 -8 M${ws + 10} ${-L * .6} l8 -4 M${ws + 6} ${-L * .3} l8 2" stroke="#e9a1cf" stroke-width="3"/><path d="M${ws + 4} ${-L * .8} l10 -10" ${thin('#7a2a60', 2.5)}/></g>`;
    if (c.belt) s += `<rect x="${-wh - 2}" y="-6" width="${wh * 2 + 4}" height="8" fill="#3a2418" ${sw3}/><rect x="-5" y="-6" width="10" height="8" fill="#d8b04a" stroke="none"/><rect x="-3" y="-4" width="6" height="4" fill="#3a2418"/>`;
    if (c.kind === 'zombie') s += `<path d="M${-ws + 10} ${-L + 18} l4 6 M${ws - 20} ${-L * .4} l6 4" ${thin('#5b2a2a', 3)} opacity=".8"/>`;
    s += `<path d="M-6 ${-L} h12" stroke="${c.skin[0]}" stroke-width="12"/><path d="M-6 ${-L + 4} h12" stroke="${c.skin[1]}" stroke-width="3" opacity=".6"/>`; // neck
    return s;
  }
  // arm: pivot at shoulder; hangs down (0..len); hand at the end
  function arm(c, len, hand, id) {
    const glove = c.gloves; const col = c.sleeve ? `url(#${id}-sleeve)` : `url(#${id}-shirt)`; const base = c.sleeve || c.shirt;
    let s = `<path d="M-7 0 h14 v${len - 12} q0 8 -7 8 q-7 0 -7 -8 z" fill="${col}" ${sw}/>`;
    s += `<path d="M-4 6 q-1 ${len * .4} 0 ${len - 20}" ${thin(dark(base, .35), 2)} opacity=".5"/><path d="M4 8 q1 ${len * .3} 0 ${len - 24}" ${thin(light(base, .35), 1.5)} opacity=".5"/>`;
    s += `<path d="M-7 12 q7 3 14 0" ${thin(dark(base, .3), 2)} opacity=".5"/>`;
    if (c.sleeveShort) s += `<path d="M-7 ${len * .4} h14 v${len - 12 - len * .4} q0 8 -7 8 q-7 0 -7 -8 z" fill="url(#${id}-skin)" ${sw}/><path d="M-7 ${len * .4} q7 4 14 0" ${thin(dark(base, .3), 2.5)}/>`;
    if (c.kind === 'zombie' && !c.armor) s += `<path d="M-4 ${len * .55} l3 5 l-2 6" ${thin('#5b2a2a', 2.5)} opacity=".8"/>`;
    if (c.boneArm) s += `<path d="M-7 ${len * .62} h14 v${len * .18} h-14 z" fill="#efe6d0" ${sw2}/><path d="M-3 ${len * .66} v${len * .1} M3 ${len * .66} v${len * .1}" ${thin(INK, 1.2)} opacity=".6"/>`;
    // hand: palm + three fingers + thumb
    const hc = glove ? glove : c.skin[0], hcd = glove ? dark(glove, .35) : c.skin[1];
    s += `<circle cx="0" cy="${len}" r="9" fill="${hc}" ${sw}/><path d="M-6 ${len + 4} l-1 6 M-1 ${len + 7} v6 M5 ${len + 5} l1 6" ${thin(INK, 2.5)}/><path d="M-6 ${len + 4} l-1 6 M-1 ${len + 7} v6 M5 ${len + 5} l1 6" ${thin(hc, 1.5)}/><path d="M-8 ${len - 3} q-4 2 -3 6" ${thin(hcd, 2)}/><path d="M-3 ${len - 5} q3 -2 6 0" ${thin(light(hc, .4), 2)} opacity=".7"/>`;
    if (c.claws) s += `<path d="M-8 ${len + 4} l-5 11 M-2 ${len + 8} l-1 12 M5 ${len + 7} l4 11" ${thin(INK, 3.5)}/><path d="M-8 ${len + 4} l-5 11 M-2 ${len + 8} l-1 12 M5 ${len + 7} l4 11" ${thin('#efe6d0', 1.8)}/>`;
    if (c.glowHands) s += `<circle class="orb" cx="0" cy="${len + 2}" r="16" fill="url(#${id}-glow)" stroke="none"/><circle cx="0" cy="${len + 2}" r="7" fill="#c9ffb8" stroke="#2f8a2a" stroke-width="2"/><circle cx="-2" cy="${len}" r="2" fill="#fff"/>`;
    if (c.pads) s += `<path d="M-9 ${len * .45} h18 v12 h-18 z" fill="#3a3845" ${sw3}/><path d="M-6 ${len * .45 + 4} h12" ${thin('#56546a', 2)}/>`;
    if (c.wristband) s += `<path d="M-7 ${len - 14} h14" ${thin(c.wristband, 5)}/>`;
    if (hand) s += `<g class="item">${item(hand, len)}</g>`;
    return s;
  }
  // leg: pivot at hip; down to the foot
  function leg(c, len, id) {
    let s = `<path d="M-8 0 h16 v${len - 10} h-16 z" fill="url(#${id}-pants)" ${sw}/>`;
    s += `<path d="M-4 4 q-1 ${len * .4} 0 ${len - 20}" ${thin(dark(c.pants, .35), 2)} opacity=".5"/><path d="M-8 ${len * .45} q8 3 16 0" ${thin(dark(c.pants, .3), 2)} opacity=".5"/>`;
    if (c.kneepads) s += `<path d="M-8 ${len * .42} h16 v10 h-16 z" fill="#2a2a2a" ${sw2}/>`;
    if (c.torn) s += `<path d="M-8 ${len - 10} l4 -8 l4 8 l4 -10 l4 10" fill="url(#${id}-skin)" stroke="none"/><path d="M-8 ${len - 10} l4 -8 l4 8 l4 -10 l4 10" fill="none" ${sw2}/><path d="M-5 ${len * .6} l3 4" ${thin('#5b2a2a', 2.5)} opacity=".7"/>`;
    // boot with sole, heel and laces
    s += `<path d="M-10 ${len - 12} h20 v10 q0 6 -6 6 h-22 q-5 0 -5 -5 q0 -11 13 -11 z" fill="url(#${id}-boots)" ${sw}/><path d="M-22 ${len + 1} h32" ${thin(dark(c.boots, .5), 3)}/><path d="M-6 ${len - 9} l6 2 M-6 ${len - 5} l6 2" ${thin(light(c.boots, .5), 1.8)} opacity=".8"/>`;
    if (c.sneakers) s += `<path d="M-19 ${len - 1} h28" stroke="#fff" stroke-width="3"/><circle cx="-14" cy="${len - 5}" r="2" fill="#fff"/>`;
    if (c.kind === 'zombie') s += `<path d="M-16 ${len} l-3 3" ${thin('#5b7a3f', 3)}/>`;
    return s;
  }
  /* Held items are drawn in the HAND's frame: origin = centre of the palm, +y points along the
   * forearm away from the shoulder (the direction the item extends / a gun fires) and +x is the
   * thumb side, which faces up when the arm is raised to aim. So a weapon always points where the
   * arm points — hanging at low-ready when idle, level when aiming — and every pose stays aligned. */
  /* Cut-out sprites for held items (assets/sprites). size = longest side in rig units;
   * grip / tip = points in the sprite (0..1 fractions): the grip sits in the palm and the sprite is
   * rotated so grip→tip points along +y (the way the arm points). `hang` items (cases, lanterns)
   * dangle below the hand upright instead. */
  const HELD = {
    rifle: { s: 'rifle', size: 74, grip: [.4, .72], tip: [1, .3] }, shotgun: { s: 'shotgun', size: 72, grip: [.33, .7], tip: [1, .25] },
    pistol: { s: 'pistol', size: 32, grip: [.22, .8], tip: [1, .22] }, sniper: { s: 'sniper', size: 82, grip: [.42, .7], tip: [1, .3] }, ak: { s: 'ak', size: 72, grip: [.42, .72], tip: [1, .3] },
    wrench: { s: 'wrench', size: 48, grip: [.2, .82], tip: [.85, .15] }, pipewrench: { s: 'pipewrench', size: 44, grip: [.22, .85], tip: [.8, .12] },
    crowbar: { s: 'crowbar', size: 58, grip: [.14, .86], tip: [.9, .1] }, pitchfork: { s: 'rake', size: 78, grip: [.72, .28], tip: [.1, .92] },
    cleaver: { s: 'cleaver', size: 40, grip: [.86, .45], tip: [.1, .5] }, shovel: { s: 'shovel', size: 56, grip: [.8, .18], tip: [.2, .85] },
    medkit: { s: 'medkit2', size: 32, hang: true }, flashlight: { s: 'lantern', size: 30, hang: true }, toolbox: { s: 'toolbox', size: 30, hang: true },
  };
  function held(t, len) {
    const h = HELD[t], px = h && DE.Data && DE.Data.SPRITES && DE.Data.SPRITES[h.s]; if (!px) return null;
    const k = h.size / Math.max(px[0], px[1]), w = px[0] * k, ht = px[1] * k;
    const img = `<image href="assets/sprites/${h.s}.png" width="${w.toFixed(1)}" height="${ht.toFixed(1)}"/>`;
    if (h.hang) return `<g transform="translate(${(-w / 2).toFixed(1)} ${(len + 4).toFixed(1)})">${img}</g>`;
    const gx = h.grip[0] * w, gy = h.grip[1] * ht, ang = Math.atan2(h.tip[1] * ht - gy, h.tip[0] * w - gx) * 180 / Math.PI;
    return `<g transform="translate(0 ${len}) rotate(${(90 - ang).toFixed(1)}) translate(${(-gx).toFixed(1)} ${(-gy).toFixed(1)})">${img}</g>`;
  }
  function item(t, len) {
    const spr = held(t, len); if (spr) return spr;
    const at = (body) => `<g transform="translate(0 ${len})">${body}</g>`;
    const metal = '#3a3540', metal2 = '#6e717b', wood = '#6b4226';
    switch (t) {
      case 'rifle': return at(`<path d="M2 -30 h12 l-2 22 h-10 z" fill="${wood}" ${sw3}/><rect x="3" y="-10" width="13" height="30" rx="2" fill="${metal}" ${sw3}/><rect x="6" y="18" width="7" height="44" rx="2" fill="${metal}" ${sw3}/><rect x="4" y="22" width="11" height="16" rx="2" fill="${wood}" ${sw3}/><path d="M-9 2 h12 v9 h-12 z" fill="#2a2530" ${sw3}/><rect x="15" y="-4" width="5" height="12" rx="1" fill="#2a2530" ${sw2}/><path d="M9 22 v38" ${thin(metal2, 1.5)}/><rect x="5" y="60" width="9" height="5" fill="#1c1020"/>`);
      case 'shotgun': return at(`<path d="M2 -32 h12 l-1 24 h-10 z" fill="${wood}" ${sw3}/><rect x="3" y="-10" width="12" height="22" rx="2" fill="#4a4652" ${sw3}/><rect x="6" y="10" width="7" height="58" rx="2" fill="#4a4652" ${sw3}/><rect x="1" y="22" width="9" height="18" rx="3" fill="${wood}" ${sw3}/><path d="M9 14 v52" ${thin('#8a8e98', 1.5)}/>`);
      case 'pistol': return at(`<rect x="-4" y="-6" width="9" height="12" rx="2" fill="#2a2530" ${sw3}/><rect x="3" y="-8" width="10" height="30" rx="2" fill="${metal}" ${sw3}/><path d="M8 -4 v22" ${thin(metal2, 1.5)}/><rect x="5" y="22" width="6" height="3" fill="#1c1020"/>`);
      case 'wrench': return at(`<rect x="-4" y="-8" width="9" height="50" rx="3" fill="#8a8c96" ${sw3}/><path d="M-11 40 h23 v10 l-6 6 v-8 h-11 v8 l-6 -6 z" fill="#8a8c96" ${sw3}/><path d="M-1 -4 v40" ${thin('#c9ccd4', 2)} opacity=".7"/><rect x="-5" y="-6" width="11" height="12" rx="3" fill="#c93a3a" ${sw2}/>`);
      case 'crowbar': return at(`<path d="M0 -14 V46 q0 12 12 12 h4" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M0 -14 V46 q0 12 12 12 h4" fill="none" stroke="#c93a3a" stroke-width="4.5" stroke-linecap="round"/><path d="M0 -14 l-5 -6" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M0 -14 l-5 -6" stroke="#8a8c96" stroke-width="3" stroke-linecap="round"/>`);
      case 'pitchfork': return at(`<rect x="-3" y="-44" width="7" height="96" rx="3" fill="#9a6238" ${sw3}/><path d="M-12 52 h25 v6 h-25 z" fill="#8a8c96" ${sw3}/><path d="M-10 58 v18 M0 58 v20 M10 58 v18" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M-10 58 v18 M0 58 v20 M10 58 v18" stroke="#c9ccd4" stroke-width="2.4" stroke-linecap="round"/>`);
      case 'medkit': return at(`<path d="M-6 2 q6 -9 12 0" fill="none" ${sw3}/><rect x="-18" y="4" width="36" height="28" rx="4" fill="#d8303a" ${sw}/><rect x="-5" y="11" width="10" height="14" fill="#fff"/><rect x="-10" y="15" width="20" height="6" fill="#fff"/><path d="M-15 8 h30" ${thin('#ff8a7a', 2)} opacity=".7"/>`);
      case 'pan': return at(`<rect x="-4" y="-6" width="8" height="40" rx="3" fill="#2a2630" ${sw3}/><ellipse cx="0" cy="52" rx="16" ry="22" fill="#2f2b36" ${sw}/><ellipse cx="2" cy="52" rx="10" ry="15" fill="#6b6775" stroke="none"/><ellipse cx="5" cy="46" rx="3" ry="7" fill="#8a8e98" opacity=".7"/>`);
      case 'flashlight': return at(`<rect x="-6" y="-8" width="12" height="30" rx="3" fill="#3a3540" ${sw3}/><path d="M-10 22 h20 l-4 12 h-12 z" fill="#5a5666" ${sw3}/><ellipse class="beam" cx="0" cy="36" rx="12" ry="5" fill="#fff4a8" ${sw3}/><path class="beam" d="M-10 40 l-14 60 h48 l-14 -60 z" fill="#fff4a8" opacity=".25" stroke="none"/><rect x="-4" y="2" width="8" height="4" fill="#d8303a"/>`);
      case 'clipboard': return at(`<rect x="-14" y="-2" width="30" height="38" rx="3" fill="#a87a4a" ${sw3}/><rect x="-10" y="4" width="22" height="28" fill="#f6f4ee" stroke="none"/><rect x="-4" y="-5" width="10" height="7" rx="2" fill="#8a8c96" ${sw2}/><path d="M-6 12 h14 M-6 18 h14 M-6 24 h9" ${thin('#5a6a8a', 2)}/>`);
      default: return '';
    }
  }
  const GUNS = { rifle: 1, shotgun: 1, pistol: 1, sniper: 1, ak: 1 };

  /* ---------- assemble a rig ---------- */
  function rig(id, o) {
    o = o || {}; const c = ALL[id]; if (!c) return '';
    const p = Object.assign({ hips: [0, -52], neck: [0, -104], shoulders: [[-24, -98], [24, -98]], hipOff: 11, legLen: 50, armLen: 46, lean: 0, armF: 0, armB: 0, legL: 0, legR: 0, headTilt: 0 }, c.pose || {});
    // o.item overrides the profession's default (e.g. guards on duty always carry a firearm)
    const item = o.item !== undefined ? o.item : (c.item || null);
    const legLen = p.legLen, armLen = p.armLen;
    const dx = p.neck[0] - p.hips[0], dy = p.neck[1] - p.hips[1];
    const tL = Math.hypot(dx, dy); const tRot = Math.atan2(dx, -dy) * 180 / Math.PI;
    const cc = Object.assign({}, c, { torsoLen: tL });
    const parts = `
      <g class="pivot-armB" transform="translate(${p.shoulders[0][0]} ${p.shoulders[0][1]}) rotate(${p.armB})"><g class="j j-armB">${arm(cc, armLen, null, id)}</g></g>
      <g class="pivot-legL" transform="translate(${p.hips[0] - p.hipOff} ${p.hips[1]}) rotate(${p.legL})"><g class="j j-legL">${leg(cc, legLen, id)}</g></g>
      <g class="pivot-legR" transform="translate(${p.hips[0] + p.hipOff} ${p.hips[1]}) rotate(${p.legR})"><g class="j j-legR">${leg(cc, legLen, id)}</g></g>
      <g class="pivot-torso" transform="translate(${p.hips[0]} ${p.hips[1]}) rotate(${tRot.toFixed(1)})"><g class="j j-torso">${torso(cc, id)}</g></g>
      <g class="pivot-head" transform="translate(${p.neck[0]} ${p.neck[1]}) rotate(${p.headTilt})"><g class="j j-head">${head(cc, id)}</g></g>
      <g class="pivot-armF" transform="translate(${p.shoulders[1][0]} ${p.shoulders[1][1]}) rotate(${p.armF})"><g class="j j-armF">${arm(cc, armLen, item, id)}</g></g>`;
    const h = o.h || 48; const w = Math.round(h * 140 / 225);
    const vars = Object.entries(c.vars || {}).map(([k, v]) => `${k}:${v}`).join(';');
    const style = `height:${h}px;width:${w}px;${vars}${c.filter ? ';filter:' + c.filter : ''}`;
    return `<svg class="rig rig-${id} kind-${c.kind} a-${o.anim || 'idle'} ${o.flip ? 'flip' : ''} ${o.cls || ''}" viewBox="-70 -215 140 225" style="${style}" ${o.title ? `data-title="${o.title}"` : ''} aria-hidden="true"><title>${o.title || c.name || id}</title>${defs(id, c)}
      <ellipse class="shadow" cx="0" cy="2" rx="${c.big ? 40 : 30}" ry="6" fill="#000" opacity=".3"/>
      <g class="j j-body" transform="rotate(${p.lean})"><g class="j j-body2">${parts}</g></g></svg>`;
  }

  /* ---------- character tables (matched to the reference sheet) ---------- */
  const Z = (x) => Object.assign({ kind: 'zombie', skin: SKIN.zombie, eyes: 'glow', mouth: 'open', angry: true, torn: true, boots: '#3a2a2a' }, x);
  const C = (x) => Object.assign({ kind: 'crew', skin: SKIN.light, eyes: 'normal', mouth: 'smile', belt: true, boots: '#5a3a24', dirt: true }, x);
  const ZOMBIES = {
    walker:  Z({ name: 'Walker', hair: { style: 'bald' }, shirt: '#e9e4dc', pants: '#3f4f72', boots: '#3a2a2a', ribs: true, drip: true, pose: { armF: -70, armB: 65, lean: 3 }, vars: { '--t': '1.5s', '--la': '16deg', '--aa': '10deg', '--bob': '2px' } }),
    runner:  Z({ name: 'Runner', skin: SKIN.pale, hair: { style: 'messy', color: '#2d1e22' }, shirt: '#3a2f33', jacket: { color: '#c73a3a', lapel: '#8f2626', pocket: true }, sleeve: '#c73a3a', pants: '#2e3a4e', boots: '#a0303a', pose: { lean: 14, armF: -40, armB: 40, legL: -10, legR: 14 }, vars: { '--t': '.55s', '--la': '34deg', '--aa': '38deg', '--bob': '4px' } }),
    brute:   Z({ name: 'Brute', big: true, skin: SKIN.zombie, headW: 40, headH: 42, hair: { style: 'bald' }, shirt: '#ece7dc', sleeveShort: true, sleeve: '#9cb878', pants: '#6b4a2a', boots: '#9cb878', belly: true, boneArm: true, shoulderW: 46, hipW: 38, pose: { hips: [0, -60], neck: [0, -122], shoulders: [[-42, -112], [42, -112]], hipOff: 19, legLen: 56, armLen: 64, armF: -22, armB: 22 }, vars: { '--t': '2.4s', '--la': '12deg', '--aa': '8deg', '--bob': '5px' } }),
    toxic:   Z({ name: 'Spitter', skin: SKIN.dark, hair: { style: 'bald' }, mouth: 'drool', shirt: '#3a4a3a', pants: '#3a3a3a', glowHands: true, pose: { armF: -80, armB: 80, lean: 2 }, vars: { '--t': '1.7s', '--la': '14deg', '--aa': '14deg', '--bob': '2px' } }),
    crawler: Z({ name: 'Crawler', skin: SKIN.grey, hair: { style: 'bald' }, mouth: 'fangs', shirt: '#5a5a62', pants: '#3a3a40', torn: true, ribs: true, bone: true, pose: { hips: [30, -22], neck: [-18, -34], shoulders: [[-20, -30], [-4, -34]], hipOff: 6, legLen: 38, armLen: 30, legL: -96, legR: -84, armF: 6, armB: -6, headTilt: -24, lean: 0 }, vars: { '--t': '1.3s', '--la': '8deg', '--aa': '26deg', '--bob': '1px' } }),
    bomber:  Z({ name: 'Bomber', hair: { style: 'mohawk', color: '#ff5a2a' }, shirt: '#2a2630', jacket: { color: '#3a3540', lapel: '#55536a' }, sleeve: '#3a3540', pants: '#3a3a40', dynamite: true, pose: { armF: -30, armB: 30, lean: 4 }, vars: { '--t': '.8s', '--la': '26deg', '--aa': '30deg', '--bob': '3px' } }),
    leaper:  Z({ name: 'Leaper', hair: { style: 'wild', color: '#3a2420' }, mouth: 'fangs', shirt: '#4a3a30', pants: '#5a4a3a', claws: true, pose: { lean: 8, armF: -120, armB: -100, legL: -34, legR: 24, hips: [0, -42], neck: [-8, -90], shoulders: [[-30, -84], [14, -84]], headTilt: 10 }, vars: { '--t': '.9s', '--la': '30deg', '--aa': '20deg', '--bob': '8px' } }),
    armored: Z({ name: 'Riot Walker', skin: SKIN.zombie, eyes: 'glow', mouth: 'grim', torn: false, hat: { type: 'riot', color: '#2a2834' }, shirt: '#2a2834', armor: true, pads: true, kneepads: true, pants: '#2a2834', boots: '#1a1820', gloves: '#2f2d38', shoulderW: 34, hipW: 26, pose: { armF: -20, armB: 20 }, vars: { '--t': '2s', '--la': '12deg', '--aa': '8deg', '--bob': '3px' } }),
    cultist: Z({ name: 'Cultist', skin: SKIN.dark, eyes: 'greenglow', mouth: 'grim', torn: false, hat: { type: 'hood', color: '#7a3ab0' }, shirt: '#5a2a80', robe: '#7a3ab0', pants: '#4a2070', boots: '#2a1040', glowHands: true, pose: { armF: -60, armB: 60 }, vars: { '--t': '2.2s', '--la': '4deg', '--aa': '10deg', '--bob': '6px' } }),
    mutant:  Z({ name: 'Mutant', big: true, skin: SKIN.zombie, headW: 38, headH: 40, hair: { style: 'spikes', color: '#b25a8f' }, mouth: 'fangs', shirt: '#9cb878', sleeve: '#9cb878', pants: '#4a3a62', boots: '#9cb878', claws: true, spikes: true, boneArm: true, shoulderW: 42, hipW: 32, pose: { hips: [0, -58], neck: [0, -116], shoulders: [[-38, -108], [38, -108]], hipOff: 17, legLen: 54, armLen: 66, armF: -50, armB: 50, lean: 6 }, vars: { '--t': '1.6s', '--la': '16deg', '--aa': '18deg', '--bob': '4px' } }),
  };
  ZOMBIES.boss = Object.assign({}, ZOMBIES.mutant, { name: 'Colossus', headW: 42, headH: 44, shoulderW: 50, hipW: 38, pose: { hips: [0, -64], neck: [0, -128], shoulders: [[-46, -118], [46, -118]], hipOff: 20, legLen: 60, armLen: 76, armF: -55, armB: 55, lean: 6 }, filter: 'hue-rotate(-40deg) saturate(1.4) contrast(1.15)', vars: { '--t': '2.6s', '--la': '14deg', '--aa': '14deg', '--bob': '6px' } });
  const CREW = {
    scavenger: C({ name: 'Scavenger', hair: { style: 'messy', color: '#5a3a22' }, brows: 'stern', shirt: '#d9c7a6', jacket: { color: '#6b4a2e', lapel: '#4a3220', pocket: true }, sleeve: '#6b4a2e', pants: '#2f2f3a', boots: '#6b4a2e', backpack: true, wristband: '#3a2a2a', item: 'crowbar', pose: { armF: -28, armB: 18 }, vars: { '--t': '1s', '--la': '24deg', '--aa': '22deg', '--bob': '2px' } }),
    hunter:    C({ name: 'Hunter', hair: { style: 'ponytail', color: '#f2d060' }, mouth: 'smirk', cheeks: true, shirt: '#f4efe6', jacket: { color: '#c93a3a', lapel: '#9a2a2a', len: 30 }, sleeve: '#c93a3a', gloves: '#3a2a2a', pants: '#2b3350', boots: '#6b4a2e', bandolier: true, item: 'sniper', pose: { armF: -28, armB: 10 }, vars: { '--t': '.9s', '--la': '26deg', '--aa': '18deg', '--bob': '2px' } }),
    engineer:  C({ name: 'Engineer', skin: SKIN.tan, hair: { style: 'short', color: '#6b3a1e' }, beard: { style: 'full', color: '#6b3a1e' }, brows: 'stern', mouth: 'grim', hat: { type: 'hardhat', color: '#f3c21a' }, shirt: '#2f7fd0', vest: '#f08a2a', sleeve: '#2f7fd0', pants: '#3a5a9a', boots: '#6b4a2e', toolbelt: true, kneepads: true, item: 'wrench', pose: { armF: -30, armB: 12 }, vars: { '--t': '1.1s', '--la': '20deg', '--aa': '16deg', '--bob': '2px' } }),
    medic:     C({ name: 'Medic', hair: { style: 'bun', color: '#4a2a1a' }, eyes: 'glasses', cheeks: true, dirt: false, shirt: '#9ad3ef', jacket: { color: '#f6f4ee', lapel: '#d9d6cf', len: 56, pocket: true }, sleeve: '#f6f4ee', cross: true, stethoscope: true, pants: '#4a4a58', boots: '#3a2a2a', item: 'medkit', pose: { armF: 6, armB: -6 }, vars: { '--t': '1.1s', '--la': '20deg', '--aa': '10deg', '--bob': '2px' } }),
    soldier:   C({ name: 'Soldier', skin: SKIN.tan, mouth: 'stubble', brows: 'stern', hat: { type: 'helmet', color: '#4f6a3a', color2: '#3e5530' }, shirt: '#55683c', sleeve: '#55683c', gloves: '#2a2a2a', pants: '#4a5c36', boots: '#2a2a2a', bandolier: true, kneepads: true, item: 'ak', pose: { armF: -28, armB: 18 }, vars: { '--t': '.95s', '--la': '24deg', '--aa': '20deg', '--bob': '2px' } }),
    farmer:    C({ name: 'Farmer', hair: { style: 'white', color: '#e6e6ea' }, beard: { style: 'long', color: '#e6e6ea' }, brows: 'stern', mouth: 'grim', shirt: '#7c8390', jacket: { color: '#7a5a3a', lapel: '#5a4028', len: 62, pocket: true }, sleeve: '#7a5a3a', pants: '#2f2f3a', boots: '#3a2a2a', bandolier: false, item: 'pitchfork', pose: { armF: -24, armB: 14 }, vars: { '--t': '1.4s', '--la': '16deg', '--aa': '12deg', '--bob': '2px' } }),
    mechanic:  C({ name: 'Mechanic', hair: { style: 'short', color: '#5a3a22' }, hat: { type: 'goggles' }, cheeks: true, shirt: '#d9731f', sleeve: '#d9731f', gloves: '#3a2a2a', pants: '#b85f18', boots: '#3a2a2a', toolbelt: true, item: 'pipewrench', pose: { armF: 10, armB: -10 }, vars: { '--t': '1s', '--la': '22deg', '--aa': '18deg', '--bob': '3px' } }),
    cook:      C({ name: 'Cook', hair: { style: 'short', color: '#5a3a22' }, hat: { type: 'chef' }, dirt: false, shirt: '#f6f4ee', sleeve: '#f6f4ee', apron: '#6b4a2e', pants: '#2f2f3a', boots: '#3a2a2a', item: 'cleaver', pose: { armF: 24, armB: -8 }, vars: { '--t': '1.2s', '--la': '18deg', '--aa': '14deg', '--bob': '2px' } }),
    guard:     C({ name: 'Guard', eyes: 'sunglasses', mouth: 'grim', hat: { type: 'police', color: '#2b3350' }, dirt: false, shirt: '#2b3350', sleeve: '#2b3350', gloves: '#1a1a22', pants: '#222a44', boots: '#1a1a22', badge: true, item: 'rifle', pose: { armF: -28, armB: 18 }, vars: { '--t': '1.05s', '--la': '20deg', '--aa': '16deg', '--bob': '2px' } }),
    scout:     C({ name: 'Scout', hair: { style: 'messy', color: '#5a3a22' }, cheeks: true, hat: { type: 'cap', color: '#d8303a', color2: '#f6f4ee' }, shirt: '#f6f4ee', jacket: { color: '#d8303a', lapel: '#a02028', len: 50, pocket: true }, sleeve: '#d8303a', pants: '#3a5a9a', boots: '#6b4a2e', sneakers: true, backpack: true, item: 'flashlight', pose: { armF: -40, armB: 20 }, vars: { '--t': '.8s', '--la': '28deg', '--aa': '22deg', '--bob': '3px' } }),
  };
  CREW.scientist = Object.assign({}, CREW.medic, { name: 'Scientist', cross: false, stethoscope: false, item: 'clipboard', shirt: '#8fe3d8', hair: { style: 'bun', color: '#2a1a14' }, filter: 'hue-rotate(-12deg)', pose: { armF: -20, armB: 10 } });
  const ALL = Object.assign({}, ZOMBIES, CREW);

  function zombie(id, o) { return rig(ZOMBIES[id] ? id : 'walker', o); }
  function crew(prof, o) { return rig(CREW[prof] ? prof : 'scavenger', o); }

  /** Weapon a survivor carries on guard duty: their own firearm, else a rifle. */
  function dutyWeapon(prof) { const c = CREW[prof]; return c && GUNS[c.item] ? c.item : 'rifle'; }
  return { rig, zombie, crew, dutyWeapon, ZOMBIES, CREW, ALL };
})();
