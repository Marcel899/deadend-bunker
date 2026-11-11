/* Characters: every zombie type and survivor profession drawn as a parametric SVG rig
 * (no bitmaps). Each rig is a chibi body split into joint groups — head, torso, two arms,
 * two legs, plus a held item — each wrapped in a <g class="j j-*"> whose local origin is
 * the joint pivot, so CSS rotations in css/rigs.css animate them like bones.
 *
 * Coordinates: ground centre is (0,0); up is negative y. The svg viewBox is -70..70 x -215..10.
 *   DE.Chars.rig(id, { h: 48, anim: 'walk', flip: true, cls, title })  → <svg> markup
 *   DE.Chars.CREW / DE.Chars.ZOMBIES                                    → config tables */
var DE = globalThis.DE = globalThis.DE || {};

DE.Chars = (function () {
  const INK = '#1c1020';
  const SKIN = { light: ['#f3c9a2', '#d59a70'], tan: ['#e6b58b', '#b9805a'], zombie: ['#8fae72', '#5f7d4d'], pale: ['#a9bb8f', '#6e8560'], dark: ['#6f8657', '#46603a'] };
  const sw = 'stroke="' + INK + '" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"';
  const sw3 = 'stroke="' + INK + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';

  /* ---------- body part drawers (local coords, pivot at 0,0) ---------- */
  // head: pivot at the neck; face centred at (0,-44)
  function head(c) {
    const [sk, sk2] = c.skin; const cy = -44; const rx = c.headW || 36, ry = c.headH || 40;
    let s = `<g class="hair-back">${hairBack(c, cy, rx, ry)}</g>`;
    s += `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="${sk}" ${sw}/>`;
    s += `<path d="M${-rx + 6} ${cy + 10} q6 20 ${rx - 6} 24 q${rx - 6} -4 ${rx - 6} -24" fill="${sk2}" opacity=".45" stroke="none"/>`; // jaw shadow
    s += `<ellipse cx="${-rx + 2}" cy="${cy + 4}" rx="6" ry="8" fill="${sk}" ${sw3}/><ellipse cx="${rx - 2}" cy="${cy + 4}" rx="6" ry="8" fill="${sk}" ${sw3}/>`; // ears
    if (c.wounds) s += `<path d="M${-rx + 10} ${cy - 10} l6 8 l-4 6" fill="none" ${sw3} stroke="#5b3a3a"/><ellipse cx="${rx - 14}" cy="${cy + 14}" rx="7" ry="4" fill="#5b7a3f" stroke="none"/>`;
    s += face(c, cy, rx);
    s += `<g class="hair-front">${hairFront(c, cy, rx, ry)}</g>`;
    s += headgear(c, cy, rx, ry);
    return s;
  }
  function face(c, cy, rx) {
    const ey = cy + 2; let s = '';
    const eye = c.eyes || 'normal';
    if (eye === 'sunglasses') s += `<path d="M-26 ${ey - 2} h22 v10 h-22 z M4 ${ey - 2} h22 v10 h-22 z" fill="#15131a" ${sw3}/><path d="M-4 ${ey + 2} h8" ${sw3}/><path d="M-22 ${ey} h6 M8 ${ey} h6" stroke="#5a6a7a" stroke-width="2"/>`;
    else if (eye === 'visor') s += `<path d="M-28 ${ey - 10} h56 v22 q0 6 -6 6 h-44 q-6 0 -6 -6 z" fill="#1d1a26" ${sw}/><path d="M-22 ${ey - 4} h18" stroke="#6d6a86" stroke-width="3"/><ellipse cx="-10" cy="${ey + 3}" rx="5" ry="3" fill="#f3e36a" opacity=".7"/><ellipse cx="12" cy="${ey + 3}" rx="5" ry="3" fill="#f3e36a" opacity=".7"/>`;
    else {
      const glow = eye === 'glow' || eye === 'greenglow'; const col = eye === 'greenglow' ? '#7dff5a' : glow ? '#f3e36a' : '#ffffff';
      const irisC = c.eyeColor || '#2a1a24';
      if (glow) s += `<ellipse cx="-12" cy="${ey}" rx="12" ry="10" fill="${col}" opacity=".35" stroke="none"/><ellipse cx="12" cy="${ey}" rx="12" ry="10" fill="${col}" opacity=".35" stroke="none"/>`;
      s += `<ellipse cx="-12" cy="${ey}" rx="8" ry="${c.angry ? 7 : 9}" fill="${col}" ${sw3}/><ellipse cx="12" cy="${ey}" rx="8" ry="${c.angry ? 7 : 9}" fill="${col}" ${sw3}/>`;
      if (!glow) s += `<circle cx="-11" cy="${ey + 1}" r="4" fill="${irisC}"/><circle cx="13" cy="${ey + 1}" r="4" fill="${irisC}"/><circle cx="-13" cy="${ey - 2}" r="1.5" fill="#fff"/><circle cx="11" cy="${ey - 2}" r="1.5" fill="#fff"/>`;
      else s += `<circle cx="-12" cy="${ey + 1}" r="2.5" fill="#2a1a24"/><circle cx="12" cy="${ey + 1}" r="2.5" fill="#2a1a24"/>`;
      if (c.angry) s += `<path d="M-22 ${ey - 12} l16 6 M22 ${ey - 12} l-16 6" ${sw3}/>`;
      else if (c.brows !== false) s += `<path d="M-20 ${ey - 13} q8 -4 16 -1 M4 ${ey - 14} q8 -3 16 1" ${sw3}/>`;
      if (eye === 'glasses') s += `<circle cx="-12" cy="${ey}" r="11" fill="none" ${sw3}/><circle cx="12" cy="${ey}" r="11" fill="none" ${sw3}/><path d="M-1 ${ey} h2" ${sw3}/>`;
    }
    const m = c.mouth || 'smile'; const my = cy + 20;
    if (m === 'smile') s += `<path d="M-7 ${my} q7 5 14 0" fill="none" ${sw3}/>`;
    else if (m === 'grim') s += `<path d="M-8 ${my} h16" fill="none" ${sw3}/>`;
    else if (m === 'open') s += `<path d="M-12 ${my - 4} q12 -4 24 0 q-2 16 -12 16 q-10 0 -12 -16 z" fill="#3a1424" ${sw3}/><path d="M-9 ${my - 2} l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5" fill="#fff" stroke="none"/>`;
    else if (m === 'drool') s += `<path d="M-12 ${my - 4} q12 -4 24 0 q-2 14 -12 14 q-10 0 -12 -14 z" fill="#3a1424" ${sw3}/><path class="slime" d="M-4 ${my + 8} q-2 14 4 26 q6 -12 2 -26 z" fill="#9dff3a" ${sw3} stroke="#4c8a1e"/><circle cx="2" cy="${my + 30}" r="4" fill="#9dff3a" stroke="#4c8a1e" stroke-width="2"/>`;
    else if (m === 'fangs') s += `<path d="M-14 ${my - 6} q14 -6 28 0 q-2 18 -14 18 q-12 0 -14 -18 z" fill="#3a1424" ${sw3}/><path d="M-10 ${my - 4} l3 9 l3 -9 M4 ${my - 4} l3 9 l3 -9" fill="#fff" stroke="none"/>`;
    else if (m === 'stubble') s += `<path d="M-7 ${my} q7 4 14 0" fill="none" ${sw3}/><g fill="#5b4a3a" opacity=".5"><circle cx="-16" cy="${my + 2}" r="1.5"/><circle cx="18" cy="${my + 1}" r="1.5"/><circle cx="-10" cy="${my + 8}" r="1.5"/><circle cx="10" cy="${my + 8}" r="1.5"/><circle cx="0" cy="${my + 10}" r="1.5"/></g>`;
    if (c.beard) s += beard(c, my);
    return s;
  }
  function beard(c, my) {
    const col = c.beard.color;
    if (c.beard.style === 'full') return `<path d="M-30 ${my - 12} q4 30 30 32 q26 -2 30 -32 q-8 20 -30 18 q-22 2 -30 -18 z" fill="${col}" ${sw}/><path d="M-9 ${my + 1} q9 4 18 0" fill="none" ${sw3}/>`;
    if (c.beard.style === 'long') return `<path d="M-32 ${my - 14} q2 36 32 44 q30 -8 32 -44 q-10 22 -32 20 q-22 2 -32 -20 z" fill="${col}" ${sw}/><path d="M-20 ${my - 6} q20 8 40 0" fill="none" ${sw3} stroke="#cfcfd8"/>`;
    return `<path d="M-26 ${my - 8} q4 22 26 24 q22 -2 26 -24 q-8 14 -26 12 q-18 2 -26 -12 z" fill="${col}" opacity=".9" ${sw3}/>`;
  }
  function hairBack(c, cy, rx, ry) {
    const h = c.hair; if (!h) return ''; const col = h.color;
    if (h.style === 'ponytail') return `<path d="M${rx - 6} ${cy - 10} q30 10 22 60 q-10 10 -16 0 q10 -30 -6 -50 z" fill="${col}" ${sw}/>`;
    if (h.style === 'messy' || h.style === 'wild') return `<path d="M${-rx - 6} ${cy - 6} q-6 30 8 46 q6 -14 2 -30 M${rx + 6} ${cy - 6} q6 30 -8 46 q-6 -14 -2 -30" fill="${col}" ${sw}/>`;
    if (h.style === 'long') return `<path d="M${-rx - 2} ${cy - 10} q-8 40 6 56 h${rx * 2 - 8} q14 -16 6 -56 z" fill="${col}" ${sw}/>`;
    return '';
  }
  function hairFront(c, cy, rx, ry) {
    const h = c.hair; if (!h) return ''; const col = h.color; const top = cy - ry;
    switch (h.style) {
      case 'short': return `<path d="M${-rx + 2} ${cy - 8} q-2 -34 ${rx - 2} -36 q${rx} 2 ${rx - 2} 36 q-10 -14 -22 -16 q-8 10 -20 6 q-10 -2 -16 10 z" fill="${col}" ${sw}/>`;
      case 'messy': return `<path d="M${-rx} ${cy - 2} q-4 -40 ${rx} -42 q${rx + 4} 2 ${rx} 42 l-8 -12 l-8 10 l-8 -14 l-8 12 l-8 -12 l-8 12 l-8 -10 l-8 10 z" fill="${col}" ${sw}/>`;
      case 'wild': return `<path d="M${-rx - 4} ${cy} l-6 -22 l12 6 l-2 -24 l14 10 l2 -22 l12 14 l6 -18 l8 18 l12 -14 l0 22 l14 -10 l-4 26 l12 -6 l-8 24 q-${rx} -22 -${rx * 2} 0 z" fill="${col}" ${sw}/>`;
      case 'ponytail': return `<path d="M${-rx} ${cy - 6} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-6 -16 -18 -18 q-14 8 -30 2 q-10 0 -16 16 z" fill="${col}" ${sw}/><path d="M${rx - 14} ${cy - 30} q14 -6 18 8" fill="none" ${sw3}/>`;
      case 'bun': return `<path d="M${-rx} ${cy - 6} q-2 -34 ${rx} -36 q${rx + 2} 2 ${rx} 36 q-12 -14 -24 -12 q-12 -8 -22 2 q-8 0 -12 10 z" fill="${col}" ${sw}/><circle cx="${rx - 10}" cy="${top - 2}" r="12" fill="${col}" ${sw}/>`;
      case 'mohawk': return `<path d="M-6 ${top + 4} l-4 -22 l8 4 l2 -20 l8 14 l4 -12 l4 20 l6 -8 l-2 24 q-10 -8 -26 0 z" fill="${col}" ${sw}/><path d="M-8 ${cy - 8} q-${rx - 6} 4 -${rx - 2} 12 M8 ${cy - 8} q${rx - 6} 4 ${rx - 2} 12" fill="none" ${sw3}/>`;
      case 'white': return `<path d="M${-rx} ${cy - 4} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-8 -16 -20 -16 q-10 6 -24 0 q-10 0 -16 14 z" fill="${col}" ${sw}/>`;
      case 'bald': return `<path d="M${-rx + 4} ${cy - 20} q4 -8 10 -6 M${rx - 14} ${cy - 24} q6 -2 8 4" fill="none" ${sw3} stroke="#4c6a3c"/>`;
      case 'spikes': return `<path d="M-30 ${cy - 24} l-6 -20 l12 8 l-2 -22 l12 14 l4 -22 l8 18 l8 -18 l4 22 l12 -14 l-2 22 l12 -8 l-6 20 q-${rx} -14 -${rx * 2} 0 z" fill="${col}" ${sw}/>`;
      default: return '';
    }
  }
  function headgear(c, cy, rx, ry) {
    const g = c.hat; if (!g) return ''; const top = cy - ry;
    switch (g.type) {
      case 'hardhat': return `<path d="M${-rx - 6} ${cy - 20} q4 -40 ${rx + 6} -40 q${rx + 2} 0 ${rx + 6} 40 z" fill="${g.color}" ${sw}/><rect x="${-rx - 10}" y="${cy - 24}" width="${rx * 2 + 20}" height="10" rx="4" fill="${g.color}" ${sw}/><path d="M-8 ${top - 14} h16" stroke="#fff" stroke-width="4" opacity=".6"/>`;
      case 'helmet': return `<path d="M${-rx - 6} ${cy - 18} q2 -44 ${rx + 6} -44 q${rx + 4} 0 ${rx + 6} 44 z" fill="${g.color}" ${sw}/><rect x="${-rx - 9}" y="${cy - 22}" width="${rx * 2 + 18}" height="9" rx="4" fill="${g.color2 || g.color}" ${sw}/><path d="M${-rx} ${cy - 30} h12 M4 ${cy - 44} l10 4" stroke="#3a4a2a" stroke-width="3"/>`;
      case 'riot': return `<path d="M${-rx - 5} ${cy - 10} q0 -38 ${rx + 5} -38 q${rx + 5} 0 ${rx + 5} 38 z" fill="${g.color}" ${sw}/><path d="M${-rx - 7} ${cy - 16} h${rx * 2 + 14} v26 q0 6 -6 6 h${-(rx * 2 + 2)} q-6 0 -6 -6 z" fill="#1d1a26" fill-opacity=".82" ${sw}/><path d="M${-rx} ${cy - 8} h${rx * 2 - 6}" stroke="#6d6a86" stroke-width="3" opacity=".6"/><path d="M${-rx - 7} ${cy + 16} q${rx + 7} 10 ${rx * 2 + 14} 0" fill="none" ${sw3}/>`;
      case 'chef': return `<path d="M${-rx + 2} ${cy - 26} v-18 h${rx * 2 - 4} v18 z" fill="#f6f4ee" ${sw}/><path d="M${-rx - 2} ${cy - 44} q-6 -30 16 -30 q8 -14 22 -6 q14 -8 22 6 q20 0 16 30 z" fill="#f6f4ee" ${sw}/>`;
      case 'cap': return `<path d="M${-rx} ${cy - 16} q0 -34 ${rx} -36 q${rx} 2 ${rx} 36 z" fill="${g.color}" ${sw}/><path d="M${-rx - 2} ${cy - 16} h${rx * 2 + 4} l12 8 q-${rx + 14} 6 -${rx * 2 + 28} 0 z" fill="${g.color}" ${sw}/><circle cx="0" cy="${cy - 30}" r="4" fill="${g.color2 || '#fff'}" stroke="none"/>`;
      case 'police': return `<path d="M${-rx - 2} ${cy - 20} v-10 q${rx + 2} -22 ${rx * 2 + 4} 0 v10 z" fill="${g.color}" ${sw}/><rect x="${-rx - 6}" y="${cy - 22}" width="${rx * 2 + 12}" height="9" rx="3" fill="#15131a" ${sw3}/><path d="M-6 ${cy - 44} l6 -6 l6 6 l-2 8 h-8 z" fill="#ffd34a" ${sw3}/>`;
      case 'goggles': return `<path d="M${-rx - 2} ${cy - 22} q${rx + 2} -8 ${rx * 2 + 4} 0" fill="none" stroke="#5a3a2a" stroke-width="6"/><circle cx="-13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="-13" cy="${cy - 26}" r="5" fill="#f3f0d0" opacity=".8"/><circle cx="13" cy="${cy - 26}" r="5" fill="#f3f0d0" opacity=".8"/>`;
      case 'hood': return `<path d="M${-rx - 12} ${cy + 36} q-6 -70 ${rx + 12} -92 q${rx + 18} 22 ${rx + 12} 92 q-${rx + 12} 8 -${rx * 2 + 24} 0 z" fill="${g.color}" ${sw}/><path d="M${-rx + 2} ${cy + 24} q-2 -50 ${rx - 2} -56 q${rx} 6 ${rx - 2} 56 q-${rx - 2} 6 -${rx * 2 - 4} 0 z" fill="#2a1030" ${sw}/>`;
      default: return '';
    }
  }

  // torso: pivot at hips (0,0); neck at (0,-neckLen); widths at shoulders / hips
  function torso(c) {
    const L = c.torsoLen || 52, ws = c.shoulderW || 30, wh = c.hipW || 24;
    const body = `M${-wh} 2 L${-ws} ${-L + 10} q0 -10 10 -10 h${ws * 2 - 20} q10 0 10 10 L${wh} 2 z`;
    let s = `<path d="${body}" fill="${c.shirt}" ${sw}/>`;
    if (c.belly) s += `<ellipse cx="2" cy="${-L * .42}" rx="${ws - 2}" ry="${L * .36}" fill="${c.shirt}" ${sw}/><path d="M-10 ${-L * .3} q10 6 20 0" fill="none" stroke="#000" stroke-width="2" opacity=".25"/>`;
    if (c.torn) s += `<path d="M${-wh + 4} 0 l6 -8 l5 8 l6 -10 l6 10 l5 -8 l6 8" fill="${c.skin[0]}" stroke="none"/><ellipse cx="-8" cy="${-L * .5}" rx="6" ry="4" fill="#6b3a3a" opacity=".6"/><ellipse cx="10" cy="${-L * .3}" rx="4" ry="6" fill="#6b3a3a" opacity=".5"/>`;
    if (c.jacket) { // open coat: two lapels over the shirt
      const j = c.jacket, len = j.len || L + 6;
      s += `<path d="M${-ws + 2} ${-L + 6} q-6 ${L * .5} -4 ${len} h${ws - 10} L-6 ${-L + 4} z" fill="${j.color}" ${sw}/><path d="M${ws - 2} ${-L + 6} q6 ${L * .5} 4 ${len} h${-(ws - 10)} L6 ${-L + 4} z" fill="${j.color}" ${sw}/>`;
      s += `<path d="M${-ws + 2} ${-L + 6} l${ws - 10} 14 M${ws - 2} ${-L + 6} l${-(ws - 10)} 14" fill="none" ${sw3} stroke="${j.lapel || j.color}"/>`;
    }
    if (c.vest) s += `<path d="M${-ws + 4} ${-L + 6} l${ws - 14} 8 v${L - 10} h${-(ws - 12)} z M${ws - 4} ${-L + 6} l${-(ws - 14)} 8 v${L - 10} h${ws - 12} z" fill="${c.vest}" ${sw3}/><path d="M${-ws + 6} ${-L * .5} h${ws - 16} M${ws - 6} ${-L * .5} h${-(ws - 16)}" stroke="#f3f0d0" stroke-width="3"/>`;
    if (c.apron) s += `<path d="M-16 ${-L + 10} h32 v${L - 12} q-16 6 -32 0 z" fill="${c.apron}" ${sw3}/><path d="M-16 ${-L + 10} l-8 -6 M16 ${-L + 10} l8 -6" ${sw3}/>`;
    if (c.cross) s += `<rect x="-14" y="${-L * .62}" width="12" height="12" rx="2" fill="#fff" ${sw3}/><path d="M-8 ${-L * .62 + 2} v8 M-12 ${-L * .62 + 6} h8" stroke="#d8303a" stroke-width="3"/>`;
    if (c.armor) s += `<path d="M${-ws + 4} ${-L + 8} h${ws * 2 - 8} v${L - 14} q-${ws - 4} 10 -${ws * 2 - 8} 0 z" fill="#2f2d38" ${sw3}/><path d="M-10 ${-L + 16} h20 M-10 ${-L * .55} h20 M-10 ${-L * .3} h20" stroke="#56546a" stroke-width="3"/><circle cx="${-ws + 8}" cy="${-L * .7}" r="3" fill="#8a8898"/><circle cx="${ws - 8}" cy="${-L * .7}" r="3" fill="#8a8898"/>`;
    if (c.dynamite) s += `<g class="dyn"><rect x="-18" y="${-L * .7}" width="36" height="18" rx="3" fill="#2a2630" ${sw3}/><rect x="-14" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="-4" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="6" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><path d="M-10 ${-L * .66} q-2 -8 4 -10 M0 ${-L * .66} q-2 -8 4 -10 M10 ${-L * .66} q-2 -8 4 -10" fill="none" stroke="#e7c35a" stroke-width="2"/><circle class="fuse" cx="14" cy="${-L * .66 - 10}" r="3" fill="#ffb13a"/></g>`;
    if (c.robe) s += `<path d="M${-wh - 8} 8 q${wh + 8} 8 ${wh * 2 + 16} 0 L${ws} ${-L + 6} h${-ws * 2} z" fill="${c.robe}" ${sw}/><path d="M-4 ${-L + 10} v${L + 4}" stroke="#5a2a70" stroke-width="3"/>`;
    if (c.spikes) s += `<g class="spikes"><path d="M${ws - 6} ${-L + 4} l14 -18 l2 20 l12 -12 l-2 20 l12 -8 l-6 18 l10 -2 l-10 14 l6 10 l-12 -2 l2 14 l-12 -10 l-4 12 l-6 -14 z" fill="#b25a8f" ${sw}/><path d="M${ws + 2} ${-L + 10} l6 -8 M${ws + 10} ${-L * .6} l8 -4" stroke="#e9a1cf" stroke-width="3"/></g>`;
    if (c.belt) s += `<rect x="${-wh - 2}" y="-6" width="${wh * 2 + 4}" height="8" fill="#3a2418" ${sw3}/><rect x="-5" y="-6" width="10" height="8" fill="#d8b04a" stroke="none"/>`;
    s += `<path d="M-6 ${-L} h12" stroke="${c.skin[0]}" stroke-width="12"/>`; // neck
    return s;
  }
  // arm: pivot at shoulder; hangs down (0..len); hand at the end
  function arm(c, len, hand) {
    const glove = c.gloves; const col = c.sleeve || c.shirt;
    let s = `<path d="M-7 0 h14 v${len - 12} q0 8 -7 8 q-7 0 -7 -8 z" fill="${col}" ${sw}/>`;
    if (c.sleeveShort) s += `<path d="M-7 ${len * .4} h14 v${len - 12 - len * .4} q0 8 -7 8 q-7 0 -7 -8 z" fill="${c.skin[0]}" ${sw}/>`;
    s += `<circle cx="0" cy="${len}" r="9" fill="${glove || c.skin[0]}" ${sw}/>`;
    if (c.claws) s += `<path d="M-8 ${len + 4} l-4 10 M-2 ${len + 8} l-1 11 M5 ${len + 7} l3 10" ${sw3}/>`;
    if (c.glowHands) s += `<circle class="orb" cx="0" cy="${len + 2}" r="14" fill="#5aff4a" opacity=".55" stroke="none"/><circle cx="0" cy="${len + 2}" r="7" fill="#c9ffb8" stroke="#2f8a2a" stroke-width="2"/>`;
    if (c.pads) s += `<path d="M-9 ${len * .45} h18 v12 h-18 z" fill="#3a3845" ${sw3}/>`;
    if (hand) s += `<g class="item">${item(hand, len)}</g>`;
    return s;
  }
  // leg: pivot at hip; down to the foot
  function leg(c, len) {
    let s = `<path d="M-8 0 h16 v${len - 10} h-16 z" fill="${c.pants}" ${sw}/>`;
    if (c.torn) s += `<path d="M-8 ${len - 10} l4 -8 l4 8 l4 -10 l4 10" fill="${c.skin[0]}" stroke="none"/>`;
    s += `<path d="M-10 ${len - 12} h20 v10 q0 6 -6 6 h-22 q-5 0 -5 -5 q0 -11 13 -11 z" fill="${c.boots}" ${sw}/>`;
    if (c.sneakers) s += `<path d="M-11 ${len - 2} h22" stroke="#fff" stroke-width="3"/>`;
    return s;
  }
  function item(t, len) {
    const y = len;
    switch (t) {
      case 'rifle': return `<g transform="translate(0 ${y}) rotate(-12)"><rect x="-44" y="-5" width="84" height="10" rx="3" fill="#3a3540" ${sw3}/><rect x="-62" y="-4" width="22" height="7" rx="2" fill="#2a2530" ${sw3}/><path d="M-10 5 l-4 16 h10 l2 -16 z" fill="#5a3a24" ${sw3}/><path d="M18 5 v14 h8 v-14" fill="#3a3540" ${sw3}/><rect x="30" y="-4" width="16" height="8" rx="2" fill="#5a3a24" ${sw3}/></g>`;
      case 'shotgun': return `<g transform="translate(0 ${y}) rotate(-10)"><rect x="-50" y="-5" width="92" height="9" rx="3" fill="#4a4652" ${sw3}/><rect x="-10" y="-3" width="30" height="10" rx="3" fill="#6b4226" ${sw3}/><path d="M20 4 l10 16 h8 l-6 -18 z" fill="#6b4226" ${sw3}/></g>`;
      case 'pistol': return `<g transform="translate(0 ${y - 2})"><rect x="-6" y="-8" width="32" height="10" rx="3" fill="#3a3540" ${sw3}/><rect x="-6" y="0" width="10" height="14" rx="2" fill="#2a2530" ${sw3}/></g>`;
      case 'wrench': return `<g transform="translate(0 ${y}) rotate(20)"><rect x="-5" y="-30" width="10" height="56" rx="3" fill="#8a8c96" ${sw3}/><path d="M-12 -30 q12 -14 24 0 l-6 10 h-12 z" fill="#8a8c96" ${sw3}/><path d="M-10 28 q10 10 20 0 l-5 -8 h-10 z" fill="#8a8c96" ${sw3}/></g>`;
      case 'medkit': return `<g transform="translate(0 ${y + 4})"><rect x="-18" y="2" width="36" height="28" rx="4" fill="#d8303a" ${sw}/><path d="M-6 0 q6 -8 12 0" fill="none" ${sw3}/><rect x="-5" y="10" width="10" height="12" fill="#fff"/><rect x="-9" y="13" width="18" height="6" fill="#fff"/></g>`;
      case 'pan': return `<g transform="translate(0 ${y}) rotate(-30)"><rect x="-4" y="-2" width="8" height="40" rx="3" fill="#2a2630" ${sw3}/><ellipse cx="0" cy="54" rx="26" ry="14" fill="#2f2b36" ${sw}/><ellipse cx="0" cy="50" rx="18" ry="8" fill="#6b6775" stroke="none"/></g>`;
      case 'flashlight': return `<g transform="translate(0 ${y}) rotate(40)"><rect x="-6" y="-4" width="12" height="30" rx="3" fill="#3a3540" ${sw3}/><path d="M-10 26 h20 l-4 12 h-12 z" fill="#5a5666" ${sw3}/><ellipse class="beam" cx="0" cy="40" rx="12" ry="5" fill="#fff4a8" ${sw3}/><path class="beam" d="M-10 44 l-14 60 h48 l-14 -60 z" fill="#fff4a8" opacity=".25" stroke="none"/></g>`;
      default: return '';
    }
  }

  /* ---------- assemble a rig ---------- */
  function rig(id, o) {
    o = o || {}; const c = ALL[id]; if (!c) return '';
    const p = Object.assign({ hips: [0, -52], neck: [0, -104], shoulders: [[-24, -98], [24, -98]], hipOff: 11, legLen: 50, armLen: 46, lean: 0, armF: 0, armB: 0, legL: 0, legR: 0, headTilt: 0 }, c.pose || {});
    const item = c.item || null; const twoHanded = item === 'rifle' || item === 'shotgun' || item === 'pan';
    const legLen = p.legLen, armLen = p.armLen;
    // torso drawn relative to hips, so compute torso length from hips→neck
    const dx = p.neck[0] - p.hips[0], dy = p.neck[1] - p.hips[1];
    const tL = Math.hypot(dx, dy); const tRot = Math.atan2(dx, -dy) * 180 / Math.PI;
    const cc = Object.assign({}, c, { torsoLen: tL });
    const parts = `
      <g class="pivot-armB" transform="translate(${p.shoulders[0][0]} ${p.shoulders[0][1]}) rotate(${p.armB})"><g class="j j-armB">${arm(cc, armLen, twoHanded ? null : null)}</g></g>
      <g class="pivot-legL" transform="translate(${p.hips[0] - p.hipOff} ${p.hips[1]}) rotate(${p.legL})"><g class="j j-legL">${leg(cc, legLen)}</g></g>
      <g class="pivot-legR" transform="translate(${p.hips[0] + p.hipOff} ${p.hips[1]}) rotate(${p.legR})"><g class="j j-legR">${leg(cc, legLen)}</g></g>
      <g class="pivot-torso" transform="translate(${p.hips[0]} ${p.hips[1]}) rotate(${tRot.toFixed(1)})"><g class="j j-torso">${torso(cc)}</g></g>
      <g class="pivot-head" transform="translate(${p.neck[0]} ${p.neck[1]}) rotate(${p.headTilt})"><g class="j j-head">${head(cc)}</g></g>
      <g class="pivot-armF" transform="translate(${p.shoulders[1][0]} ${p.shoulders[1][1]}) rotate(${p.armF})"><g class="j j-armF">${arm(cc, armLen, item)}</g></g>`;
    const h = o.h || 48; const w = Math.round(h * 140 / 225);
    const vars = Object.entries(c.vars || {}).map(([k, v]) => `${k}:${v}`).join(';');
    const style = `height:${h}px;width:${w}px;${vars}${c.filter ? ';filter:' + c.filter : ''}`;
    return `<svg class="rig rig-${id} kind-${c.kind} a-${o.anim || 'idle'} ${o.flip ? 'flip' : ''} ${o.cls || ''}" viewBox="-70 -215 140 225" style="${style}" ${o.title ? `data-title="${o.title}"` : ''} aria-hidden="true"><title>${o.title || c.name || id}</title>
      <ellipse class="shadow" cx="0" cy="2" rx="${c.kind === 'zombie' && c.big ? 40 : 30}" ry="6" fill="#000" opacity=".3"/>
      <g class="j j-body" transform="rotate(${p.lean})"><g class="j j-body2">${parts}</g></g></svg>`;
  }

  /* ---------- character tables (matched to the reference sheet) ---------- */
  const Z = (x) => Object.assign({ kind: 'zombie', skin: SKIN.zombie, eyes: 'glow', mouth: 'open', angry: true, wounds: true, torn: true, boots: '#3a2a2a' }, x);
  const C = (x) => Object.assign({ kind: 'crew', skin: SKIN.light, eyes: 'normal', mouth: 'smile', belt: true, boots: '#5a3a24' }, x);
  const ZOMBIES = {
    walker:  Z({ name: 'Walker', hair: { style: 'bald' }, shirt: '#e9e4dc', pants: '#3f4f72', boots: '#3a2a2a', pose: { armF: -70, armB: 65, lean: 3 }, vars: { '--t': '1.5s', '--la': '16deg', '--aa': '10deg', '--bob': '2px' } }),
    runner:  Z({ name: 'Runner', skin: SKIN.pale, hair: { style: 'messy', color: '#2d1e22' }, shirt: '#3a2f33', jacket: { color: '#c73a3a', lapel: '#8f2626' }, pants: '#2e3a4e', boots: '#a0303a', pose: { lean: 14, armF: -40, armB: 40, legL: -10, legR: 14 }, vars: { '--t': '.55s', '--la': '34deg', '--aa': '38deg', '--bob': '4px' } }),
    brute:   Z({ name: 'Brute', big: true, skin: SKIN.zombie, headW: 40, headH: 42, hair: { style: 'bald' }, shirt: '#ece7dc', sleeveShort: true, sleeve: '#8fae72', pants: '#6b4a2a', boots: '#8fae72', belly: true, shoulderW: 44, hipW: 36, pose: { hips: [0, -58], neck: [0, -118], shoulders: [[-40, -108], [40, -108]], hipOff: 18, legLen: 54, armLen: 60, armF: -22, armB: 22 }, vars: { '--t': '2.4s', '--la': '12deg', '--aa': '8deg', '--bob': '5px' }, filter: 'none' }),
    toxic:   Z({ name: 'Spitter', skin: SKIN.dark, hair: { style: 'bald' }, mouth: 'drool', shirt: '#3a4a3a', pants: '#3a3a3a', glowHands: true, pose: { armF: -80, armB: 80, lean: 2 }, vars: { '--t': '1.7s', '--la': '14deg', '--aa': '14deg', '--bob': '2px' } }),
    crawler: Z({ name: 'Crawler', skin: SKIN.pale, hair: { style: 'bald' }, mouth: 'fangs', shirt: '#5a5a62', pants: '#3a3a40', torn: true, pose: { hips: [30, -22], neck: [-18, -34], shoulders: [[-20, -30], [-4, -34]], hipOff: 6, legLen: 38, armLen: 30, legL: -96, legR: -84, armF: 6, armB: -6, headTilt: -24, lean: 0 }, vars: { '--t': '1.3s', '--la': '8deg', '--aa': '26deg', '--bob': '1px' } }),
    bomber:  Z({ name: 'Bomber', hair: { style: 'mohawk', color: '#ff5a2a' }, shirt: '#2a2630', jacket: { color: '#3a3540' }, pants: '#3a3a40', dynamite: true, pose: { armF: -30, armB: 30, lean: 4 }, vars: { '--t': '.8s', '--la': '26deg', '--aa': '30deg', '--bob': '3px' } }),
    leaper:  Z({ name: 'Leaper', hair: { style: 'wild', color: '#3a2420' }, mouth: 'fangs', shirt: '#4a3a30', pants: '#5a4a3a', pose: { lean: 8, armF: -120, armB: -100, legL: -34, legR: 24, hips: [0, -42], neck: [-8, -90], shoulders: [[-30, -84], [14, -84]], headTilt: 10 }, vars: { '--t': '.9s', '--la': '30deg', '--aa': '20deg', '--bob': '8px' } }),
    armored: Z({ name: 'Riot Walker', skin: SKIN.zombie, eyes: 'glow', mouth: 'grim', wounds: false, torn: false, hat: { type: 'riot', color: '#2a2834' }, shirt: '#2a2834', armor: true, pads: true, pants: '#2a2834', boots: '#1a1820', gloves: '#2f2d38', shoulderW: 34, hipW: 26, pose: { armF: -20, armB: 20 }, vars: { '--t': '2s', '--la': '12deg', '--aa': '8deg', '--bob': '3px' } }),
    cultist: Z({ name: 'Cultist', skin: SKIN.dark, eyes: 'greenglow', mouth: 'grim', wounds: false, torn: false, hat: { type: 'hood', color: '#7a3ab0' }, shirt: '#5a2a80', robe: '#7a3ab0', pants: '#4a2070', boots: '#2a1040', glowHands: true, pose: { armF: -60, armB: 60 }, vars: { '--t': '2.2s', '--la': '4deg', '--aa': '10deg', '--bob': '6px' } }),
    mutant:  Z({ name: 'Mutant', big: true, skin: SKIN.zombie, headW: 38, headH: 40, hair: { style: 'spikes', color: '#b25a8f' }, mouth: 'fangs', shirt: '#8fae72', sleeve: '#8fae72', pants: '#4a3a62', boots: '#8fae72', claws: true, spikes: true, shoulderW: 40, hipW: 30, pose: { hips: [0, -56], neck: [0, -112], shoulders: [[-36, -104], [36, -104]], hipOff: 16, legLen: 52, armLen: 62, armF: -50, armB: 50, lean: 6 }, vars: { '--t': '1.6s', '--la': '16deg', '--aa': '18deg', '--bob': '4px' } }),
  };
  ZOMBIES.boss = Object.assign({}, ZOMBIES.mutant, { name: 'Colossus', filter: 'hue-rotate(-40deg) saturate(1.4) contrast(1.15)', vars: { '--t': '2.6s', '--la': '14deg', '--aa': '14deg', '--bob': '6px' } });
  const CREW = {
    scavenger: C({ name: 'Scavenger', hair: { style: 'messy', color: '#5a3a22' }, shirt: '#d9c7a6', jacket: { color: '#6b4a2e', lapel: '#4a3220' }, sleeve: '#6b4a2e', pants: '#2f2f3a', boots: '#6b4a2e', item: 'rifle', pose: { armF: -28, armB: 18 }, vars: { '--t': '1s', '--la': '24deg', '--aa': '22deg', '--bob': '2px' } }),
    hunter:    C({ name: 'Hunter', hair: { style: 'ponytail', color: '#f2d060' }, shirt: '#f4efe6', jacket: { color: '#c93a3a', lapel: '#9a2a2a', len: 30 }, sleeve: '#c93a3a', gloves: '#3a2a2a', pants: '#2b3350', boots: '#6b4a2e', item: 'pistol', pose: { armF: -70, armB: 10 }, vars: { '--t': '.9s', '--la': '26deg', '--aa': '18deg', '--bob': '2px' } }),
    engineer:  C({ name: 'Engineer', skin: SKIN.tan, hair: { style: 'short', color: '#6b3a1e' }, beard: { style: 'full', color: '#6b3a1e' }, mouth: 'grim', hat: { type: 'hardhat', color: '#f3c21a' }, shirt: '#2f7fd0', vest: '#f08a2a', sleeve: '#2f7fd0', pants: '#3a5a9a', boots: '#6b4a2e', item: 'wrench', pose: { armF: -30, armB: 12 }, vars: { '--t': '1.1s', '--la': '20deg', '--aa': '16deg', '--bob': '2px' } }),
    medic:     C({ name: 'Medic', hair: { style: 'bun', color: '#4a2a1a' }, eyes: 'glasses', shirt: '#9ad3ef', jacket: { color: '#f6f4ee', lapel: '#d9d6cf', len: 56 }, sleeve: '#f6f4ee', cross: true, pants: '#4a4a58', boots: '#3a2a2a', item: 'medkit', pose: { armF: 6, armB: -6 }, vars: { '--t': '1.1s', '--la': '20deg', '--aa': '10deg', '--bob': '2px' } }),
    soldier:   C({ name: 'Soldier', skin: SKIN.tan, mouth: 'stubble', hat: { type: 'helmet', color: '#4f6a3a', color2: '#3e5530' }, shirt: '#55683c', sleeve: '#55683c', gloves: '#2a2a2a', pants: '#4a5c36', boots: '#2a2a2a', item: 'rifle', pose: { armF: -28, armB: 18 }, vars: { '--t': '.95s', '--la': '24deg', '--aa': '20deg', '--bob': '2px' } }),
    farmer:    C({ name: 'Farmer', hair: { style: 'white', color: '#e6e6ea' }, beard: { style: 'long', color: '#e6e6ea' }, mouth: 'grim', shirt: '#7c8390', jacket: { color: '#7a5a3a', lapel: '#5a4028', len: 62 }, sleeve: '#7a5a3a', pants: '#2f2f3a', boots: '#3a2a2a', item: 'shotgun', pose: { armF: -24, armB: 14 }, vars: { '--t': '1.4s', '--la': '16deg', '--aa': '12deg', '--bob': '2px' } }),
    mechanic:  C({ name: 'Mechanic', hair: { style: 'short', color: '#5a3a22' }, hat: { type: 'goggles' }, shirt: '#d9731f', sleeve: '#d9731f', gloves: '#3a2a2a', pants: '#b85f18', boots: '#3a2a2a', item: 'wrench', pose: { armF: 10, armB: -10 }, vars: { '--t': '1s', '--la': '22deg', '--aa': '18deg', '--bob': '3px' } }),
    cook:      C({ name: 'Cook', hair: { style: 'short', color: '#5a3a22' }, hat: { type: 'chef' }, shirt: '#f6f4ee', sleeve: '#f6f4ee', apron: '#6b4a2e', pants: '#2f2f3a', boots: '#3a2a2a', item: 'pan', pose: { armF: 24, armB: -8 }, vars: { '--t': '1.2s', '--la': '18deg', '--aa': '14deg', '--bob': '2px' } }),
    guard:     C({ name: 'Guard', eyes: 'sunglasses', mouth: 'grim', hat: { type: 'police', color: '#2b3350' }, shirt: '#2b3350', sleeve: '#2b3350', gloves: '#1a1a22', pants: '#222a44', boots: '#1a1a22', item: 'rifle', pose: { armF: -28, armB: 18 }, vars: { '--t': '1.05s', '--la': '20deg', '--aa': '16deg', '--bob': '2px' } }),
    scout:     C({ name: 'Scout', hair: { style: 'messy', color: '#5a3a22' }, hat: { type: 'cap', color: '#d8303a', color2: '#f6f4ee' }, shirt: '#f6f4ee', jacket: { color: '#d8303a', lapel: '#a02028', len: 50 }, sleeve: '#d8303a', pants: '#3a5a9a', boots: '#6b4a2e', sneakers: true, item: 'flashlight', pose: { armF: -40, armB: 20 }, vars: { '--t': '.8s', '--la': '28deg', '--aa': '22deg', '--bob': '3px' } }),
  };
  CREW.scientist = Object.assign({}, CREW.medic, { name: 'Scientist', cross: false, item: null, shirt: '#8fe3d8', filter: 'hue-rotate(-12deg)', pose: { armF: -20, armB: 10 } });
  const ALL = Object.assign({}, ZOMBIES, CREW);

  /** Convenience wrappers used across the UI. */
  function zombie(id, o) { return rig(ZOMBIES[id] ? id : 'walker', o); }
  function crew(prof, o) { return rig(CREW[prof] ? prof : 'scavenger', o); }

  return { rig, zombie, crew, ZOMBIES, CREW, ALL };
})();
