/* Characters: every survivor profession and zombie type drawn as a parametric SVG rig, plus the
 * illustrated cut-outs (assets/chars, the player's art) used as their icons in the UI.
 *
 * A rig is a chibi body split into bones: torso, head, upper arm → forearm → hand, thigh → shin →
 * boot. Each bone is a <g class="j j-*"> whose local origin is its joint, so css/rigs.css animates
 * the figure like a skeleton — elbows and knees bend, the torso leans from the hips and carries the
 * head and both arms with it. Rest angles of the arms come from CSS variables set by what the hands
 * hold (hold-gun, hold-tool, …), so every animation works for every profession.
 *
 * Shading uses small gradients shared per character type: one <defs> per type inside a single
 * hidden-but-rendered <svg id="rig-defs">, so a rig inside a closed panel can never break the fills
 * of the others (gradients referenced from a display:none subtree do not paint in WebKit/Blink).
 *
 * Coordinates: ground centre (0,0), up is -y, the figure faces +x; viewBox -70 -215 140 225.
 *   DE.Chars.crew(prof, { h, anim, flip, item, phase, title, cls }) → <svg class="rig …">
 *   DE.Chars.zombie(id, { h, anim, flip, phase, tint })             → <svg class="rig …">
 *   DE.Chars.portrait(id, { cls, title })                          → <span class="cport …"> icon */
var DE = globalThis.DE = globalThis.DE || {};

DE.Chars = (function () {
  const INK = '#1c1020';
  const SKIN = {
    light: ['#f6d2ad', '#d9a074', '#fff0dc'], tan: ['#e9b98e', '#b9805a', '#f7d8bc'],
    zombie: ['#9cb878', '#5f7d4d', '#c3d8a2'], pale: ['#b3c498', '#6e8560', '#d3dec0'], dark: ['#789160', '#46603a', '#a3b88a'], grey: ['#9aa394', '#5d6a5a', '#c2c9bd'],
  };
  const sw = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const sw3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const sw2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = (c, w) => `stroke="${c}" stroke-width="${w || 2}" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const esc = (s) => (DE.Util && DE.Util.escapeHtml ? DE.Util.escapeHtml(String(s)) : String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]));

  /* ---------- colour helpers ---------- */
  function hex(c) { const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function mix(c, t, k) { const a = hex(c), b = hex(t); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * k).toString(16).padStart(2, '0')).join(''); }
  const dark = (c, k) => mix(c, '#1c1020', k == null ? .35 : k), light = (c, k) => mix(c, '#ffffff', k == null ? .35 : k);
  const F = (id, name) => `url(#rg-${id}-${name})`;

  /* ---------- shared gradients ---------- */
  function defsFor(id, c) {
    const P = 'rg-' + id + '-';
    const grad = (name, top, bot, x2, y2) => `<linearGradient id="${P}${name}" x1="0" y1="0" x2="${x2 || 0}" y2="${y2 == null ? 1 : y2}"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
    let s = `<defs id="rigdefs-${id}">`;
    s += grad('skin', c.skin[2], c.skin[0]);
    s += grad('shirt', light(c.shirt, .18), dark(c.shirt, .3)) + grad('pants', light(c.pants, .12), dark(c.pants, .35)) + grad('boots', light(c.boots, .15), dark(c.boots, .35));
    if (c.sleeve) s += grad('sleeve', light(c.sleeve, .18), dark(c.sleeve, .3));
    if (c.jacket) s += grad('jacket', light(c.jacket.color, .15), dark(c.jacket.color, .35));
    if (c.hair) s += grad('hair', light(c.hair.color || '#000', .22), dark(c.hair.color || '#000', .3));
    if (c.hat && c.hat.color) s += grad('hat', light(c.hat.color, .22), dark(c.hat.color, .3));
    if (c.robe) s += grad('robe', light(c.robe, .15), dark(c.robe, .35));
    if (c.glowHands) s += `<radialGradient id="${P}glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#9dff5a" stop-opacity=".9"/><stop offset="1" stop-color="#9dff5a" stop-opacity="0"/></radialGradient>`;
    return s + '</defs>';
  }
  const madeDefs = {};
  function ensureDefs(id, c) {
    if (typeof document === 'undefined' || !document.body) return;
    let host = document.getElementById('rig-defs');
    if (!host) {
      for (const k in madeDefs) delete madeDefs[k];
      host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.id = 'rig-defs';
      host.setAttribute('aria-hidden', 'true'); host.setAttribute('focusable', 'false');
      host.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none';
      document.body.appendChild(host);
    }
    if (madeDefs[id]) return;
    // parse as inline SVG inside HTML (works in every engine), then move the <defs> into the host
    const tmp = document.createElement('div'); tmp.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg">${defsFor(id, c)}</svg>`;
    const defs = tmp.firstChild && tmp.firstChild.firstChild; if (defs) host.appendChild(defs);
    madeDefs[id] = true;
  }

  /* ---------- head ---------- */
  // pivot at the neck; face centred at (0,-44)
  function head(c, id) {
    const cy = -44, rx = c.headW || 34, ry = c.headH || 38;
    let s = '';
    if (c.hat && c.hat.type === 'hood') {
      // the hood hangs behind the head; the face shows in its dark opening
      s += `<path d="M${-rx - 14} ${cy + 40} q-8 -74 ${rx + 14} -96 q${rx + 20} 22 ${rx + 14} 96 q-${rx + 14} 9 -${rx * 2 + 28} 0 z" fill="${F(id, 'hat')}" ${sw}/><path d="M${rx + 2} ${cy + 34} l6 -18 M${-rx - 4} ${cy + 36} l-6 -16" ${thin(dark(c.hat.color, .4), 2.5)}/>`;
      s += `<ellipse cx="0" cy="${cy + 4}" rx="${rx + 4}" ry="${ry + 4}" fill="#2a1030"/>`;
    }
    s += `<g class="hair-back">${hairBack(c, cy, rx, ry, id)}</g>`;
    s += `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="${ry}" fill="${F(id, 'skin')}" ${sw}/>`;
    // jaw shade, a cool shadow on the back of the head, a top highlight
    s += `<path d="M${-rx + 6} ${cy + 8} q${rx - 6} 30 ${rx * 2 - 12} 0 q-${rx - 6} 20 -${rx * 2 - 12} 0 z" fill="${c.skin[1]}" opacity=".42"/>`;
    s += `<path d="M${-rx + 3} ${cy - 12} q-3 22 8 ${ry - 4}" ${thin(c.skin[1], 5)} opacity=".35"/>`;
    s += `<path d="M${-rx * .55} ${cy - ry * .72} q${rx * .4} -8 ${rx * .9} -2" ${thin(c.skin[2], 4)} opacity=".75"/>`;
    s += `<ellipse cx="${-rx + 2}" cy="${cy + 4}" rx="6" ry="8" fill="${F(id, 'skin')}" ${sw3}/><ellipse cx="${rx - 2}" cy="${cy + 4}" rx="6" ry="8" fill="${F(id, 'skin')}" ${sw3}/><ellipse cx="${-rx + 2}" cy="${cy + 5}" rx="2.5" ry="4" fill="${c.skin[1]}"/><ellipse cx="${rx - 2}" cy="${cy + 5}" rx="2.5" ry="4" fill="${c.skin[1]}"/>`;
    if (c.kind === 'zombie') s += zombieFaceDamage(c, cy, rx, ry);
    else if (c.dirt) s += `<g fill="${dark(c.skin[1], .4)}" opacity=".32"><path d="M${rx - 18} ${cy + 14} q6 2 10 -2 q2 4 -4 6 z"/><circle cx="${-rx + 12}" cy="${cy + 18}" r="2"/></g>`;
    if (c.scar) s += `<path d="M${rx - 22} ${cy - 16} l8 14" ${thin(dark(c.skin[1], .2), 2.5)}/><path d="M${rx - 21} ${cy - 11} l4 -2 M${rx - 18} ${cy - 6} l4 -2" ${thin(dark(c.skin[1], .2), 1.5)}/>`;
    s += face(c, cy, rx);
    s += `<g class="hair-front">${hairFront(c, cy, rx, ry, id)}</g>`;
    s += headgear(c, cy, rx, ry, id);
    return s;
  }
  function zombieFaceDamage(c, cy, rx, ry) {
    // sunken eye sockets, a stitched gash, rot patches, exposed bone on the heavy types
    let s = `<ellipse cx="-12" cy="${cy + 2}" rx="12" ry="11" fill="${c.skin[1]}" opacity=".55"/><ellipse cx="12" cy="${cy + 2}" rx="12" ry="11" fill="${c.skin[1]}" opacity=".55"/>`;
    s += `<g fill="${c.skin[1]}" opacity=".55"><ellipse cx="${rx - 12}" cy="${cy + 18}" rx="7" ry="4"/><ellipse cx="${-rx + 14}" cy="${cy - 8}" rx="5" ry="3"/></g>`;
    s += `<path d="M${-rx + 8} ${cy - 16} l8 10 l-4 7" fill="none" ${thin('#5b2a2a', 3)}/><path d="M${-rx + 9} ${cy - 12} l4 -2 M${-rx + 12} ${cy - 8} l4 -2 M${-rx + 13} ${cy - 3} l4 -1" ${thin(INK, 1.5)}/>`;
    s += `<ellipse cx="${rx - 14}" cy="${cy + 12}" rx="7" ry="4" fill="#5b7a3f"/><ellipse cx="${rx - 16}" cy="${cy + 11}" rx="2" ry="1.2" fill="#8aa85a"/>`;
    s += `<path d="M${rx - 6} ${cy - 30} q-4 6 -2 12" ${thin('#7a1f2a', 3)} opacity=".7"/>`;
    if (c.big || c.bone) s += `<path d="M${rx - 10} ${cy - 24} q10 2 12 12 q-6 -2 -8 2" fill="#efe6d0" ${sw2}/><path d="M${rx - 6} ${cy - 20} l4 4" ${thin(INK, 1.5)}/>`;
    if (c.drip) s += `<path d="M-6 ${cy + 36} q-2 8 1 14 q3 -6 1 -14 z" fill="#8f1e2e" ${sw2}/>`;
    return s;
  }
  function face(c, cy, rx) {
    const ey = cy + 3; let s = '';
    const eye = c.eyes || 'normal';
    const bc = c.hair && c.hair.color && c.hair.style !== 'bald' ? dark(c.hair.color, .38) : INK;
    if (eye === 'sunglasses') {
      s += `<path d="M-28 ${ey - 5} h24 v11 q0 4 -4 4 h-16 q-4 0 -4 -4 z M4 ${ey - 5} h24 v11 q0 4 -4 4 h-16 q-4 0 -4 -4 z" fill="#15131a" ${sw3}/><path d="M-4 ${ey - 1} h8" ${sw3}/><path d="M-23 ${ey - 2} l6 0 M9 ${ey - 2} l6 0" stroke="#7a8aa0" stroke-width="2.5" stroke-linecap="round"/><path d="M-27 ${ey - 5} l-5 -3 M27 ${ey - 5} l5 -3" ${sw3}/>`;
    } else if (eye === 'visor') {
      s += `<path d="M-28 ${ey - 12} h56 v22 q0 6 -6 6 h-44 q-6 0 -6 -6 z" fill="#1d1a26" ${sw}/><path d="M-22 ${ey - 6} h18" stroke="#6d6a86" stroke-width="3"/><ellipse cx="-10" cy="${ey + 1}" rx="5" ry="3" fill="#f3e36a" opacity=".75"/><ellipse cx="12" cy="${ey + 1}" rx="5" ry="3" fill="#f3e36a" opacity=".75"/>`;
    } else if (eye === 'glow' || eye === 'greenglow') {
      const col = eye === 'greenglow' ? '#7dff5a' : '#f3e36a', ry = c.angry ? 5.6 : 7;
      s += `<g class="z-eyes"><ellipse cx="-12" cy="${ey}" rx="11" ry="9" fill="#1a0e14" opacity=".45"/><ellipse cx="12" cy="${ey}" rx="11" ry="9" fill="#1a0e14" opacity=".45"/><ellipse cx="-12" cy="${ey}" rx="11" ry="9" fill="${col}" opacity=".18"/><ellipse cx="12" cy="${ey}" rx="11" ry="9" fill="${col}" opacity=".18"/>`;
      s += `<ellipse cx="-12" cy="${ey}" rx="7" ry="${ry}" fill="${col}" ${sw3}/><ellipse cx="12" cy="${ey}" rx="7" ry="${ry}" fill="${col}" ${sw3}/><path d="M-20 ${ey - ry + 1} L-4 ${ey - 1} M20 ${ey - ry + 1} L4 ${ey - 1}" ${thin(INK, 3.2)}/><circle cx="-10.5" cy="${ey + .5}" r="1.8" fill="#2a1a24"/><circle cx="13.5" cy="${ey + .5}" r="1.8" fill="#2a1a24"/><circle cx="-13" cy="${ey - 1.6}" r="1.1" fill="#fff" opacity=".8"/><circle cx="11" cy="${ey - 1.6}" r="1.1" fill="#fff" opacity=".8"/></g>`;
    } else {
      // survivors: dark irises with a glint in small whites — reads as eyes (not goggles) at any size
      const ic = c.eyeColor || '#2b1d22', px = c.look == null ? 1.6 : c.look, lid = dark(c.skin[1], .45);
      s += '<g class="eyes">';
      for (const x of [-12, 12]) s += `<ellipse cx="${x}" cy="${ey}" rx="6.8" ry="8.4" fill="#fff" stroke="${lid}" stroke-width="1.6"/><ellipse cx="${x + px}" cy="${ey + 1}" rx="5" ry="6.6" fill="${ic}"/><circle cx="${x + px - 1.8}" cy="${ey - 2.2}" r="2.1" fill="#fff"/><circle cx="${x + px + 2}" cy="${ey + 3.6}" r="1" fill="#fff" opacity=".7"/>`;
      s += `<path d="M-19.5 ${ey - 6} q7.5 -4.5 15 -1 M4.5 ${ey - 7} q7.5 -3.5 15 1" ${thin(INK, 2.8)}/></g>`;
      s += `<g class="eyes-shut"><path d="M-18 ${ey + 1} q6 4 12 0 M6 ${ey + 1} q6 4 12 0" ${thin(INK, 2.8)}/></g>`;
      if (eye === 'glasses') s += `<circle cx="-12" cy="${ey}" r="11.5" fill="#bfe6ff" fill-opacity=".16" ${sw3}/><circle cx="12" cy="${ey}" r="11.5" fill="#bfe6ff" fill-opacity=".16" ${sw3}/><path d="M-1 ${ey} h2 M-23 ${ey - 1} l-8 -2 M23 ${ey - 1} l8 -2" ${sw3}/><path d="M-18 ${ey - 6} l4 -3 M6 ${ey - 6} l4 -3" ${thin('#fff', 2)} opacity=".85"/>`;
    }
    // brows: thick and determined
    if (eye !== 'visor') {
      if (c.angry) s += `<path d="M-24 ${ey - 15} l17 6 M24 ${ey - 15} l-17 6" stroke="${bc}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`;
      else if (c.brows === 'stern') s += `<path d="M-22 ${ey - 15} q9 -3 17 2 M5 ${ey - 13} q8 -5 17 -2" stroke="${bc}" stroke-width="4.2" stroke-linecap="round" fill="none"/>`;
      else if (c.brows !== false) s += `<path d="M-21 ${ey - 15} q8 -4 16 -1 M5 ${ey - 16} q8 -3 16 1" stroke="${bc}" stroke-width="3.6" stroke-linecap="round" fill="none"/>`;
    }
    // nose and mouth
    s += `<path d="M-1 ${cy + 9} q4 4 6 0" ${thin(dark(c.skin[1], .2), 2.5)}/>`;
    const m = c.mouth || 'smile'; const my = cy + 21;
    if (m === 'smile') s += `<path d="M-8 ${my} q8 6 16 0" fill="none" ${sw3}/>`;
    else if (m === 'grim') s += `<path d="M-8 ${my + 1} q8 -2 16 0" fill="none" ${sw3}/>`;
    else if (m === 'smirk') s += `<path d="M-7 ${my + 1} q8 5 15 -2" fill="none" ${sw3}/>`;
    else if (m === 'stubble') s += `<path d="M-7 ${my} q7 3 14 0" fill="none" ${sw3}/><g fill="#5b4a3a" opacity=".45"><circle cx="-16" cy="${my + 2}" r="1.5"/><circle cx="18" cy="${my + 1}" r="1.5"/><circle cx="-10" cy="${my + 8}" r="1.5"/><circle cx="10" cy="${my + 8}" r="1.5"/><circle cx="0" cy="${my + 10}" r="1.5"/><circle cx="-14" cy="${my + 7}" r="1.2"/><circle cx="15" cy="${my + 6}" r="1.2"/></g>`;
    else if (m === 'open') s += `<path d="M-13 ${my - 5} q13 -5 26 0 q-2 17 -13 17 q-11 0 -13 -17 z" fill="#3a1424" ${sw3}/><path d="M-10 ${my - 3} l3 5 l3 -5 l3 5 l3 -5 l3 5 l3 -5" fill="#efe6d0" stroke="none"/><path d="M-6 ${my + 8} q6 4 12 0" fill="#8f1e2e"/>`;
    else if (m === 'drool') s += `<path d="M-13 ${my - 5} q13 -5 26 0 q-2 15 -13 15 q-11 0 -13 -15 z" fill="#3a1424" ${sw3}/><path d="M-9 ${my - 3} l3 5 l3 -5 l3 5" fill="#efe6d0" stroke="none"/><path class="slime" d="M-4 ${my + 8} q-2 14 4 26 q6 -12 2 -26 z" fill="#9dff3a" stroke="#4c8a1e" stroke-width="2.5"/><circle cx="2" cy="${my + 30}" r="4" fill="#9dff3a" stroke="#4c8a1e" stroke-width="2"/>`;
    else if (m === 'fangs') s += `<path d="M-15 ${my - 7} q15 -6 30 0 q-2 19 -15 19 q-13 0 -15 -19 z" fill="#3a1424" ${sw3}/><path d="M-11 ${my - 5} l3 10 l3 -10 M5 ${my - 5} l3 10 l3 -10" fill="#efe6d0" stroke="none"/><path d="M-8 ${my + 10} q8 5 16 0" fill="#8f1e2e"/>`;
    if (c.beard) s += beard(c, my);
    if (c.cheeks) s += `<ellipse cx="-21" cy="${cy + 13}" rx="5" ry="3" fill="#ff8a7a" opacity=".32"/><ellipse cx="21" cy="${cy + 13}" rx="5" ry="3" fill="#ff8a7a" opacity=".32"/>`;
    return s;
  }
  function beard(c, my) {
    const col = c.beard.color, hi = light(col, .25);
    if (c.beard.style === 'full') return `<path d="M-30 ${my - 12} q4 30 30 32 q26 -2 30 -32 q-8 20 -30 18 q-22 2 -30 -18 z" fill="${col}" ${sw}/><path d="M-20 ${my + 2} q6 10 14 12 M18 ${my} q-4 10 -12 13" ${thin(hi, 2.5)} opacity=".7"/><path d="M-9 ${my + 1} q9 3 18 0" fill="none" ${sw3}/>`;
    if (c.beard.style === 'long') return `<path d="M-32 ${my - 14} q2 36 32 44 q30 -8 32 -44 q-10 22 -32 20 q-22 2 -32 -20 z" fill="${col}" ${sw}/><path d="M-22 ${my - 2} q4 18 16 28 M22 ${my - 2} q-4 18 -16 28" ${thin(hi, 2.5)} opacity=".7"/><path d="M-20 ${my - 6} q20 8 40 0" fill="none" ${sw3} stroke="${dark(col, .25)}"/>`;
    return `<path d="M-26 ${my - 8} q4 22 26 24 q22 -2 26 -24 q-8 14 -26 12 q-18 2 -26 -12 z" fill="${col}" opacity=".9" ${sw3}/>`;
  }
  function hairBack(c, cy, rx, ry, id) {
    const h = c.hair; if (!h) return ''; const col = F(id, 'hair');
    if (h.style === 'ponytail') return `<path d="M${rx - 6} ${cy - 12} q32 8 24 60 q-10 10 -16 0 q10 -30 -6 -50 z" fill="${col}" ${sw}/><path d="M${rx + 4} ${cy + 2} q10 14 6 34" ${thin(light(h.color, .3), 2.5)} opacity=".8"/><path d="M${rx - 2} ${cy + 18} h18" ${thin('#c93a3a', 4)}/>`;
    if (h.style === 'messy' || h.style === 'wild') return `<path d="M${-rx - 6} ${cy - 6} q-6 30 8 46 q6 -14 2 -30 M${rx + 6} ${cy - 6} q6 30 -8 46 q-6 -14 -2 -30" fill="${col}" ${sw}/>`;
    if (h.style === 'long') return `<path d="M${-rx - 2} ${cy - 10} q-8 40 6 56 h${rx * 2 - 8} q14 -16 6 -56 z" fill="${col}" ${sw}/>`;
    if (h.style === 'bun') return `<path d="M${-rx + 2} ${cy + 6} q-6 -10 -2 -20" ${thin(INK, 4)}/>`;
    return '';
  }
  function hairFront(c, cy, rx, ry, id) {
    const h = c.hair; if (!h) return ''; const col = F(id, 'hair'); const hi = h.color ? light(h.color, .35) : '#fff'; const top = cy - ry;
    switch (h.style) {
      case 'short': return `<path d="M${-rx + 2} ${cy - 8} q-2 -34 ${rx - 2} -36 q${rx} 2 ${rx - 2} 36 q-10 -14 -22 -16 q-8 10 -20 6 q-10 -2 -16 10 z" fill="${col}" ${sw}/><path d="M${-rx + 12} ${cy - 24} q10 -10 24 -8" ${thin(hi, 3)} opacity=".6"/>`;
      case 'messy': return `<path d="M${-rx} ${cy - 2} q-4 -40 ${rx} -42 q${rx + 4} 2 ${rx} 42 l-8 -12 l-8 10 l-8 -14 l-8 12 l-8 -12 l-8 12 l-8 -10 l-8 10 z" fill="${col}" ${sw}/><path d="M${-rx + 10} ${cy - 26} q12 -10 26 -8 M${rx - 14} ${cy - 18} l6 -8" ${thin(hi, 3)} opacity=".6"/><path d="M${-6} ${top + 2} l-6 -10 l10 4 l4 -10 l4 12" fill="${col}" ${sw3}/>`;
      case 'wild': return `<path d="M${-rx - 4} ${cy} l-6 -22 l12 6 l-2 -24 l14 10 l2 -22 l12 14 l6 -18 l8 18 l12 -14 l0 22 l14 -10 l-4 26 l12 -6 l-8 24 q-${rx} -22 -${rx * 2} 0 z" fill="${col}" ${sw}/><path d="M${-rx + 6} ${cy - 20} l8 -14 M${rx - 10} ${cy - 22} l-4 -14" ${thin(hi, 2.5)} opacity=".55"/>`;
      case 'ponytail': return `<path d="M${-rx} ${cy - 6} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-6 -16 -18 -18 q-14 8 -30 2 q-10 0 -16 16 z" fill="${col}" ${sw}/><path d="M${rx - 14} ${cy - 30} q14 -6 18 8" fill="none" ${sw3}/><path d="M${-rx + 10} ${cy - 24} q12 -12 28 -10" ${thin(hi, 3)} opacity=".65"/><path d="M${-rx + 4} ${cy - 4} q-4 14 2 26" ${thin(INK, 3.5)}/><path d="M${-rx + 4} ${cy - 4} q-4 14 2 26" ${thin(h.color, 2)}/>`;
      case 'bun': return `<path d="M${-rx} ${cy - 6} q-2 -34 ${rx} -36 q${rx + 2} 2 ${rx} 36 q-12 -14 -24 -12 q-12 -8 -22 2 q-8 0 -12 10 z" fill="${col}" ${sw}/><circle cx="${rx - 10}" cy="${top - 2}" r="12" fill="${col}" ${sw}/><path d="M${rx - 16} ${top - 6} q6 -6 12 -2" ${thin(hi, 2.5)} opacity=".7"/><path d="M${-rx + 10} ${cy - 24} q12 -10 26 -8" ${thin(hi, 3)} opacity=".6"/>`;
      case 'mohawk': return `<path d="M-6 ${top + 4} l-4 -22 l8 4 l2 -20 l8 14 l4 -12 l4 20 l6 -8 l-2 24 q-10 -8 -26 0 z" fill="${col}" ${sw}/><path d="M-2 ${top - 10} l4 -14 M6 ${top - 8} l2 -10" ${thin('#ffd34a', 2.5)} opacity=".8"/><path d="M-8 ${cy - 8} q-${rx - 6} 4 -${rx - 2} 12 M8 ${cy - 8} q${rx - 6} 4 ${rx - 2} 12" fill="none" ${sw3}/>`;
      case 'white': return `<path d="M${-rx} ${cy - 4} q-2 -36 ${rx} -38 q${rx + 2} 2 ${rx} 38 q-8 -16 -20 -16 q-10 6 -24 0 q-10 0 -16 14 z" fill="${col}" ${sw}/><path d="M${-rx + 8} ${cy - 22} q10 -10 24 -10 M${rx - 20} ${cy - 20} l8 -6" ${thin('#fff', 2.5)} opacity=".7"/>`;
      case 'bald': return `<path d="M${-rx + 4} ${cy - 20} q4 -8 10 -6 M${rx - 14} ${cy - 24} q6 -2 8 4" fill="none" ${sw3} stroke="#4c6a3c"/><path d="M${-rx + 14} ${cy - 30} q${rx - 10} -8 ${rx * 2 - 34} 2" ${thin(c.skin[2], 3)} opacity=".6"/><path d="M${-8} ${top + 4} l-3 -6 M2 ${top + 2} l1 -7 M10 ${top + 4} l3 -6" ${thin(dark(c.skin[1], .3), 2)}/>`;
      case 'spikes': return `<path d="M-30 ${cy - 24} l-6 -20 l12 8 l-2 -22 l12 14 l4 -22 l8 18 l8 -18 l4 22 l12 -14 l-2 22 l12 -8 l-6 20 q-${rx} -14 -${rx * 2} 0 z" fill="${col}" ${sw}/><path d="M-22 ${cy - 34} l4 -10 M2 ${cy - 42} l2 -10 M20 ${cy - 36} l6 -8" ${thin(hi, 2.5)} opacity=".6"/>`;
      default: return '';
    }
  }
  function headgear(c, cy, rx, ry, id) {
    const g = c.hat; if (!g) return ''; const top = cy - ry; const col = g.color ? F(id, 'hat') : '#f6f4ee'; const hi = g.color ? light(g.color, .4) : '#fff';
    switch (g.type) {
      case 'hardhat': return `<path d="M${-rx - 6} ${cy - 20} q4 -40 ${rx + 6} -40 q${rx + 2} 0 ${rx + 6} 40 z" fill="${col}" ${sw}/><rect x="${-rx - 10}" y="${cy - 24}" width="${rx * 2 + 20}" height="10" rx="4" fill="${col}" ${sw}/><path d="M-8 ${top - 14} h16 M-22 ${top - 6} l4 -4" ${thin(hi, 4)} opacity=".7"/><path d="M0 ${top - 18} v22" ${thin(dark(g.color, .25), 5)} opacity=".5"/><path d="M${-rx} ${cy - 20} h${rx * 2}" ${thin(dark(g.color, .3), 2)} opacity=".6"/>`;
      case 'helmet': return `<path d="M${-rx - 6} ${cy - 18} q2 -44 ${rx + 6} -44 q${rx + 4} 0 ${rx + 6} 44 z" fill="${col}" ${sw}/><rect x="${-rx - 9}" y="${cy - 22}" width="${rx * 2 + 18}" height="9" rx="4" fill="${g.color2 || g.color}" ${sw}/><path d="M${-rx} ${cy - 30} h12 M4 ${cy - 44} l10 4 M${rx - 18} ${cy - 36} l8 -3" stroke="#2e3a22" stroke-width="3" opacity=".8"/><path d="M${-rx + 6} ${cy - 36} q8 -14 22 -14" ${thin(hi, 3)} opacity=".5"/><path d="M${-rx - 4} ${cy - 18} h${rx * 2 + 8}" ${thin('#6b7a4a', 4)}/><path d="M${-rx - 6} ${cy - 18} l-2 14 M${rx + 6} ${cy - 18} l2 14" ${thin('#3a2a22', 3)}/>`;
      case 'riot': return `<path d="M${-rx - 5} ${cy - 10} q0 -38 ${rx + 5} -38 q${rx + 5} 0 ${rx + 5} 38 z" fill="${col}" ${sw}/><path d="M${-rx - 7} ${cy - 16} h${rx * 2 + 14} v26 q0 6 -6 6 h${-(rx * 2 + 2)} q-6 0 -6 -6 z" fill="#1d1a26" fill-opacity=".82" ${sw}/><path d="M${-rx} ${cy - 8} h${rx * 2 - 6}" stroke="#6d6a86" stroke-width="3" opacity=".6"/><path d="M${-rx + 2} ${cy - 40} q${rx - 2} -6 ${rx * 2 - 4} 0" fill="none" stroke="#55536a" stroke-width="3"/><path d="M${-rx - 7} ${cy + 16} q${rx + 7} 10 ${rx * 2 + 14} 0" fill="none" ${sw3}/><path d="M${-rx + 4} ${cy - 30} l8 -8 l4 1" ${thin('#8a88a0', 2)}/><path d="M${rx - 14} ${cy - 2} l6 10" ${thin('#8a88a0', 2)} opacity=".6"/>`;
      case 'chef': return `<path d="M${-rx + 2} ${cy - 26} v-18 h${rx * 2 - 4} v18 z" fill="#f6f4ee" ${sw}/><path d="M${-rx - 2} ${cy - 44} q-6 -30 16 -30 q8 -14 22 -6 q14 -8 22 6 q20 0 16 30 z" fill="#f6f4ee" ${sw}/><path d="M${-rx + 6} ${cy - 50} q6 -14 14 -16 M${rx - 20} ${cy - 54} l8 -8" ${thin('#cfcbc0', 2.5)}/><path d="M${-rx + 8} ${cy - 36} v10 M0 ${cy - 36} v10 M${rx - 8} ${cy - 36} v10" ${thin('#d8d4ca', 2)}/>`;
      case 'cap': return `<path d="M${-rx + 1} ${cy - 12} q-2 -32 ${rx - 1} -34 q${rx + 1} 2 ${rx - 1} 34 z" fill="${col}" ${sw}/><path d="M0 ${top - 6} v${ry - 20} M${-rx * .55} ${cy - 38} q4 12 4 24 M${rx * .55} ${cy - 38} q-4 12 -4 24" ${thin(dark(g.color, .3), 2)} opacity=".7"/><path d="M${-rx + 8} ${cy - 30} q8 -12 22 -12" ${thin(hi, 3)} opacity=".5"/><circle cx="0" cy="${top - 7}" r="3.5" fill="${dark(g.color, .2)}" ${sw2}/><path d="M${-rx - 1} ${cy - 14} q${rx + 6} -7 ${rx * 2 + 14} 1 q3 6 -4 8 q${-rx - 4} -7 ${-rx * 2 - 9} -1 z" fill="${dark(g.color, .12)}" ${sw}/><circle cx="${rx * .1}" cy="${cy - 26}" r="5" fill="${g.color2 || '#fff'}" ${sw2}/>`;
      case 'police': return `<path d="M${-rx - 2} ${cy - 20} v-10 q${rx + 2} -22 ${rx * 2 + 4} 0 v10 z" fill="${col}" ${sw}/><rect x="${-rx - 6}" y="${cy - 22}" width="${rx * 2 + 12}" height="9" rx="3" fill="#15131a" ${sw3}/><path d="M-6 ${cy - 44} l6 -6 l6 6 l-2 8 h-8 z" fill="#ffd34a" ${sw3}/><path d="M${-rx + 4} ${cy - 30} q10 -12 24 -14" ${thin(hi, 3)} opacity=".45"/><path d="M${-rx - 4} ${cy - 17} h${rx * 2 + 8}" ${thin('#ffd34a', 2)} opacity=".8"/>`;
      case 'goggles': return `<path d="M${-rx - 2} ${cy - 22} q${rx + 2} -8 ${rx * 2 + 4} 0" fill="none" stroke="#5a3a2a" stroke-width="6"/><circle cx="-13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="13" cy="${cy - 26}" r="10" fill="#c8a24a" ${sw3}/><circle cx="-13" cy="${cy - 26}" r="5.5" fill="#bfe6ff" opacity=".85"/><circle cx="13" cy="${cy - 26}" r="5.5" fill="#bfe6ff" opacity=".85"/><circle cx="-15" cy="${cy - 28}" r="1.8" fill="#fff"/><circle cx="11" cy="${cy - 28}" r="1.8" fill="#fff"/>`;
      case 'hood': return `<path d="M${-rx - 3} ${cy + 18} q-6 -60 ${rx + 3} -66 q${rx + 10} 6 ${rx + 3} 66" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M${-rx - 3} ${cy + 18} q-6 -60 ${rx + 3} -66 q${rx + 10} 6 ${rx + 3} 66" fill="none" stroke="${g.color}" stroke-width="8" stroke-linecap="round"/><path d="M${-rx + 2} ${cy - 12} q4 -30 ${rx - 2} -38" ${thin(hi, 2.5)} opacity=".55"/>`;
      default: return '';
    }
  }

  /* ---------- torso: pivot at the hips (0,0), neck at (0,-L) ---------- */
  function torso(c, L, id) {
    const ws = c.shoulderW || 31, wh = c.hipW || 25;
    const body = `M${-wh} 2 L${-ws} ${-L + 10} q0 -10 10 -10 h${ws * 2 - 20} q10 0 10 10 L${wh} 2 z`;
    let s = '';
    if (c.robe) s += `<path d="M${-wh - 10} 44 q${wh + 10} 8 ${wh * 2 + 20} 0 L${wh + 2} -4 h${-(wh * 2 + 4)} z" fill="${F(id, 'robe')}" ${sw}/><path d="M${-wh - 4} 40 q-2 -20 2 -40 M${wh + 4} 40 q2 -20 -2 -40 M0 4 v40" ${thin(dark(c.robe, .35), 2.5)} opacity=".6"/>`;
    s += `<path d="${body}" fill="${F(id, 'shirt')}" ${sw}/><path d="M${-wh + 2} 0 L${-ws + 2} ${-L + 10} q0 -7 7 -7 h6 L${-wh + 12} 0 z" fill="#000" opacity=".13"/>`;
    s += `<path d="M${-ws + 8} ${-L + 14} q-2 ${L * .5} 4 ${L - 16}" ${thin(dark(c.shirt, .3), 2.5)} opacity=".5"/><path d="M${ws - 8} ${-L + 14} q2 ${L * .5} -4 ${L - 16}" ${thin(light(c.shirt, .3), 2)} opacity=".45"/>`;
    if (c.belly) s += `<ellipse cx="2" cy="${-L * .42}" rx="${ws - 2}" ry="${L * .36}" fill="${F(id, 'shirt')}" ${sw}/><path d="M-12 ${-L * .3} q14 8 28 0" ${thin(dark(c.shirt, .35), 2.5)} opacity=".6"/><path d="M-6 ${-L * .6} q8 -4 16 0" ${thin(light(c.shirt, .4), 3)} opacity=".5"/><circle cx="4" cy="${-L * .28}" r="2.5" fill="${dark(c.shirt, .4)}"/><ellipse cx="-10" cy="${-L * .55}" rx="7" ry="5" fill="#6b4a2a" opacity=".35"/>`;
    if (c.torn) s += `<path d="M${-wh + 4} 0 l6 -8 l5 8 l6 -10 l6 10 l5 -8 l6 8" fill="${F(id, 'skin')}" stroke="none"/><path d="M${-wh + 4} 0 l6 -8 l5 8 l6 -10 l6 10 l5 -8 l6 8" fill="none" ${sw2}/><ellipse cx="-8" cy="${-L * .5}" rx="6" ry="4" fill="#7a1f2a" opacity=".55"/><ellipse cx="10" cy="${-L * .3}" rx="4" ry="6" fill="#7a1f2a" opacity=".45"/><path d="M${ws - 14} ${-L + 16} l6 8 l-8 2" fill="${F(id, 'skin')}" ${sw2}/>`;
    if (c.ribs) s += `<path d="M-14 ${-L * .62} q10 4 20 0 M-12 ${-L * .5} q10 4 18 0 M-10 ${-L * .38} q8 4 14 0" ${thin('#efe6d0', 3)}/><path d="M-14 ${-L * .62} q10 4 20 0 M-12 ${-L * .5} q10 4 18 0 M-10 ${-L * .38} q8 4 14 0" ${thin(INK, 1)} opacity=".5"/>`;
    if (c.jacket) {
      const j = c.jacket, len = j.len || L + 6, jc = F(id, 'jacket');
      s += `<path d="M${-ws + 2} ${-L + 6} q-6 ${L * .5} -4 ${len} h${ws - 10} L-6 ${-L + 4} z" fill="${jc}" ${sw}/><path d="M${ws - 2} ${-L + 6} q6 ${L * .5} 4 ${len} h${-(ws - 10)} L6 ${-L + 4} z" fill="${jc}" ${sw}/>`;
      s += `<path d="M${-ws + 2} ${-L + 6} l${ws - 10} 14 M${ws - 2} ${-L + 6} l${-(ws - 10)} 14" fill="none" ${sw3} stroke="${j.lapel || j.color}"/>`;
      s += `<path d="M${-ws + 6} ${-L + 20} q-1 ${L * .5} 1 ${len - 24} M${ws - 6} ${-L + 20} q1 ${L * .5} -1 ${len - 24}" ${thin(dark(j.color, .35), 2)} opacity=".6"/><path d="M${-ws + 4} ${len - L - 4} h${ws - 14}" ${thin(dark(j.color, .35), 2)} opacity=".5"/>`;
      if (j.pocket) s += `<path d="M${-ws + 5} ${-L * .3} h${ws - 16} v10 h${-(ws - 16)} z M${ws - 5} ${-L * .3} h${-(ws - 16)} v10 h${ws - 16} z" fill="none" ${sw2}/>`;
      if (j.hood) s += `<path d="M${-ws + 4} ${-L + 4} q${ws - 4} 12 ${ws * 2 - 8} 0" fill="none" ${thin(dark(j.color, .2), 6)}/>`;
    }
    if (c.vest) s += `<path d="M${-ws + 4} ${-L + 6} l${ws - 14} 8 v${L - 10} h${-(ws - 12)} z M${ws - 4} ${-L + 6} l${-(ws - 14)} 8 v${L - 10} h${ws - 12} z" fill="${c.vest}" ${sw3}/><path d="M${-ws + 6} ${-L * .5} h${ws - 16} M${ws - 6} ${-L * .5} h${-(ws - 16)}" stroke="#f3f0d0" stroke-width="3"/><path d="M${-ws + 6} ${-L * .5 + 6} h${ws - 16} M${ws - 6} ${-L * .5 + 6} h${-(ws - 16)}" stroke="#f3f0d0" stroke-width="1.5" opacity=".7"/>`;
    if (c.apron) s += `<path d="M-16 ${-L + 10} h32 v${L + 6} q-16 6 -32 0 z" fill="${c.apron}" ${sw3}/><path d="M-16 ${-L + 10} l-8 -6 M16 ${-L + 10} l8 -6" ${sw3}/><path d="M-10 ${-L * .4} h20 v10 h-20 z" fill="none" ${sw2}/><path d="M-12 ${-L + 20} q0 ${L * .5} 2 ${L - 10}" ${thin(dark(c.apron, .35), 2)} opacity=".6"/>`;
    if (c.cross) s += `<rect x="${ws - 24}" y="${-L * .66}" width="12" height="12" rx="2" fill="#fff" ${sw3}/><path d="M${ws - 18} ${-L * .66 + 2} v8 M${ws - 22} ${-L * .66 + 6} h8" stroke="#d8303a" stroke-width="3"/>`;
    if (c.stethoscope) s += `<path d="M-14 ${-L + 8} q-10 18 -4 30 q6 8 14 2 M14 ${-L + 8} q10 18 4 30" fill="none" ${thin('#3a3f4a', 3)}/><circle cx="-4" cy="${-L * .4}" r="4" fill="#c9ccd4" ${sw2}/>`;
    if (c.armor) s += `<path d="M${-ws + 4} ${-L + 8} h${ws * 2 - 8} v${L - 14} q-${ws - 4} 10 -${ws * 2 - 8} 0 z" fill="#2f2d38" ${sw3}/><path d="M-10 ${-L + 16} h20 M-10 ${-L * .55} h20 M-10 ${-L * .3} h20" stroke="#56546a" stroke-width="3"/><circle cx="${-ws + 8}" cy="${-L * .7}" r="3" fill="#8a8898"/><circle cx="${ws - 8}" cy="${-L * .7}" r="3" fill="#8a8898"/><path d="M${-ws + 6} ${-L + 12} l6 6" ${thin('#8a88a0', 2)} opacity=".7"/><text x="0" y="${-L * .18}" font-family="Lilita One, Impact, sans-serif" font-size="8" fill="#9a98b0" text-anchor="middle">RIOT</text>`;
    if (c.camo) s += `<g fill="${dark(c.shirt, .3)}" opacity=".55"><path d="M${-ws + 8} ${-L + 16} q8 -4 12 2 q-6 6 -12 -2 z"/><path d="M4 ${-L * .5} q8 -6 14 0 q-6 8 -14 0 z"/><path d="M${-wh + 4} -12 q6 -6 12 0 q-6 6 -12 0 z"/></g>`;
    if (c.bandolier) s += `<path d="M${-ws + 2} ${-L + 10} L${ws - 4} ${-L * .25}" ${thin(INK, 9)} opacity=".3"/><path d="M${-ws + 2} ${-L + 10} L${ws - 4} ${-L * .25}" ${thin('#5a3a24', 7)}/><g fill="#d8b04a" ${sw2}>${[0.2, 0.4, 0.6, 0.8].map(t => `<rect x="${(-ws + 2 + (ws * 2 - 6) * t - 2).toFixed(1)}" y="${(-L + 10 + (L * .75 - 10) * t - 5).toFixed(1)}" width="4" height="9" rx="1"/>`).join('')}</g>`;
    if (c.toolbelt) s += `<rect x="${-wh - 2}" y="-12" width="${wh * 2 + 4}" height="10" fill="#6b4a2e" ${sw3}/><rect x="${-wh + 2}" y="-6" width="10" height="8" fill="#8a6a4a" ${sw2}/><rect x="${wh - 12}" y="-6" width="10" height="8" fill="#8a6a4a" ${sw2}/><path d="M${-wh + 5} -6 v-6 M${wh - 7} -6 v-5" ${thin('#c9ccd4', 3)}/>`;
    if (c.badge) s += `<path d="M${-ws + 10} ${-L * .7} l5 -5 l5 5 l-2 6 h-6 z" fill="#ffd34a" ${sw2}/><rect x="${ws - 18}" y="${-L * .75}" width="8" height="12" rx="2" fill="#2a2a34" ${sw2}/><path d="M${ws - 14} ${-L * .75} v-6" ${thin(INK, 2)}/>`;
    if (c.backpack) s += `<path d="M${-ws - 12} ${-L + 12} h16 q2 0 2 2 v${L * .66} q0 2 -2 2 h-16 q-2 0 -2 -2 v${-L * .66} q0 -2 2 -2 z" fill="${c.backpack}" ${sw3}/><path d="M${-ws - 10} ${-L * .5} h12" ${thin(INK, 2)}/><path d="M${-ws - 2} ${-L + 12} q6 -4 12 0" ${thin(c.backpack, 4)}/><path d="M${-ws + 6} ${-L + 6} q-2 ${L * .4} 2 ${L * .7}" ${thin(dark(c.backpack, .2), 4)}/>`;
    if (c.dynamite) s += `<g class="dyn"><rect x="-18" y="${-L * .7}" width="36" height="18" rx="3" fill="#2a2630" ${sw3}/><rect x="-14" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="-4" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><rect x="6" y="${-L * .66}" width="7" height="12" rx="2" fill="#d8303a" ${sw3}/><path d="M-10 ${-L * .66} q-2 -8 4 -10 M0 ${-L * .66} q-2 -8 4 -10 M10 ${-L * .66} q-2 -8 4 -10" fill="none" stroke="#e7c35a" stroke-width="2"/><circle class="fuse" cx="14" cy="${-L * .66 - 10}" r="3" fill="#ffb13a"/></g>`;
    if (c.spikes) s += `<g class="spikes"><path d="M${ws - 6} ${-L + 4} l14 -18 l2 20 l12 -12 l-2 20 l12 -8 l-6 18 l10 -2 l-10 14 l6 10 l-12 -2 l2 14 l-12 -10 l-4 12 l-6 -14 z" fill="#b25a8f" ${sw}/><path d="M${ws + 2} ${-L + 10} l6 -8 M${ws + 10} ${-L * .6} l8 -4 M${ws + 6} ${-L * .3} l8 2" stroke="#e9a1cf" stroke-width="3"/></g>`;
    if (c.robe) s += `<path d="M-4 ${-L + 10} v${L + 4}" stroke="${dark(c.robe, .4)}" stroke-width="3"/><path d="M-12 ${-L * .72} q12 -6 24 0" ${thin('#9dff5a', 2)} opacity=".7"/>`;
    if (c.belt) s += `<rect x="${-wh - 2}" y="-6" width="${wh * 2 + 4}" height="8" fill="#3a2418" ${sw3}/><rect x="-5" y="-6" width="10" height="8" fill="#d8b04a" stroke="none"/><rect x="-3" y="-4" width="6" height="4" fill="#3a2418"/>`;
    if (c.kind === 'zombie') s += `<path d="M${-ws + 10} ${-L + 18} l4 6 M${ws - 20} ${-L * .4} l6 4" ${thin('#5b2a2a', 3)} opacity=".8"/><path d="M${ws - 16} ${-L * .55} q4 8 0 14" ${thin('#7a1f2a', 4)} opacity=".55"/>`;
    // neck and the shadow the head casts on the collar
    s += `<path d="M-6 ${-L} h12" stroke="${c.skin[0]}" stroke-width="12"/><path d="M-6 ${-L + 4} h12" stroke="${c.skin[1]}" stroke-width="3" opacity=".6"/><ellipse cx="2" cy="${-L + 7}" rx="${ws - 10}" ry="5" fill="#000" opacity=".14"/>`;
    return s;
  }

  /* ---------- limbs (two bones each) ---------- */
  const sleeve = (c, id) => c.sleeve ? F(id, 'sleeve') : F(id, 'shirt');
  // upper arm: pivot at the shoulder, elbow at (0,len)
  function upperArm(c, len, id) {
    const base = c.sleeve || c.shirt;
    let s = `<path d="M-7.5 -4 h15 v${len + 4} a7.5 7.5 0 0 1 -15 0 z" fill="${c.sleeveShort ? F(id, 'skin') : sleeve(c, id)}" ${sw}/><path d="M-5.5 -2 h4.5 v${len + 3} q-4.5 -1 -4.5 -4 z" fill="#000" opacity=".14"/>`;
    if (c.sleeveShort) s += `<path d="M-7.5 -4 h15 v${len * .5} q-7.5 4 -15 0 z" fill="${sleeve(c, id)}" ${sw}/>`;
    else s += `<path d="M-3.5 2 q-1 ${len * .5} 0 ${len}" ${thin(dark(base, .35), 2)} opacity=".45"/><path d="M4 3 q1 ${len * .4} 0 ${len - 4}" ${thin(light(base, .35), 1.6)} opacity=".45"/>`;
    if (c.pads) s += `<path d="M-10 -6 h20 v13 q-10 6 -20 0 z" fill="#3a3845" ${sw3}/><path d="M-6 0 h12" ${thin('#56546a', 2)}/>`;
    if (c.kind === 'zombie' && !c.armor && !c.sleeveShort) s += `<path d="M-3 ${len * .5} l3 4 l-2 5" ${thin('#5b2a2a', 2.2)} opacity=".75"/>`;
    return s;
  }
  // forearm: pivot at the elbow, hand at (0,len); items are drawn in the hand's frame
  function foreArm(c, len, it, id, side) {
    const base = c.sleeve || c.shirt, bare = c.sleeveShort || c.bareArms;
    let s = `<path d="M-7 0 a7 7 0 0 1 14 0 v${len - 7} q0 6 -7 6 q-7 0 -7 -6 z" fill="${bare ? F(id, 'skin') : sleeve(c, id)}" ${sw}/><path d="M-5 2 h4 v${len - 9} h-4 z" fill="#000" opacity=".14"/><path d="M4.5 3 v${len - 12}" ${thin('#fff', 1.6)} opacity=".18"/>`;
    if (!bare) s += `<path d="M-6.5 ${len - 8} h13" ${thin(dark(base, .4), 3)} opacity=".55"/>`;
    if (c.boneArm) s += `<path d="M-7 ${len * .25} h14 v${len * .3} h-14 z" fill="#efe6d0" ${sw2}/><path d="M-3 ${len * .3} v${len * .2} M3 ${len * .3} v${len * .2}" ${thin(INK, 1.2)} opacity=".6"/>`;
    if (c.wristband) s += `<path d="M-7 ${len - 7} h14" ${thin(c.wristband, 5)}/>`;
    const hc = c.gloves || c.skin[0], hcd = c.gloves ? dark(c.gloves, .35) : c.skin[1];
    // a mitten hand: palm, thumb on the +x side, two finger creases
    s += `<ellipse cx="7" cy="${len - 2}" rx="4.6" ry="5.2" fill="${hc}" ${sw3}/><ellipse cx="0" cy="${len + 1}" rx="9" ry="9.8" fill="${hc}" ${sw}/><path d="M-6 ${len - 2} q-1 6 3 9" ${thin(hcd, 2.2)} opacity=".5"/><path d="M-5.5 ${len + 1} q2.5 3 6 3 M-4.5 ${len + 5} q2.5 2.5 5.5 2.5" ${thin(hcd, 1.7)} opacity=".8"/><path d="M-3 ${len - 5} q3 -2 6 0" ${thin(light(hc, .4), 2)} opacity=".7"/>`;
    if (c.claws) s += `<path d="M-8 ${len + 4} l-5 11 M-2 ${len + 8} l-1 12 M5 ${len + 7} l4 11" ${thin(INK, 3.5)}/><path d="M-8 ${len + 4} l-5 11 M-2 ${len + 8} l-1 12 M5 ${len + 7} l4 11" ${thin('#efe6d0', 1.8)}/>`;
    if (c.glowHands) s += `<circle class="orb" cx="0" cy="${len + 2}" r="16" fill="${F(id, 'glow')}" stroke="none"/><circle cx="0" cy="${len + 2}" r="7" fill="#c9ffb8" stroke="#2f8a2a" stroke-width="2"/><circle cx="-2" cy="${len}" r="2" fill="#fff"/>`;
    if (it) s += `<g class="item">${item(it, len)}</g>`;
    if (side === 'F' && c.kind === 'crew') s += `<g class="hammer" transform="translate(0 ${len})"><rect x="-3.5" y="-4" width="7" height="32" rx="3" fill="#8a5a32" ${sw3}/><path d="M-14 24 h24 q5 0 5 5 v5 q0 5 -5 5 h-24 z" fill="#6e717b" ${sw3}/><path d="M-11 28 h19" ${thin('#b9bcc6', 2)}/></g>`;
    return s;
  }
  // thigh: pivot at the hip, knee at (0,len)
  function thigh(c, len, id) {
    let s = `<path d="M-8.5 -4 h17 v${len + 4} a8.5 8.5 0 0 1 -17 0 z" fill="${F(id, 'pants')}" ${sw}/><path d="M-6.5 -2 h5 v${len + 3} q-5 -1 -5 -4 z" fill="#000" opacity=".15"/>`;
    s += `<path d="M-4 2 q-1 ${len * .5} 0 ${len}" ${thin(dark(c.pants, .35), 2)} opacity=".45"/><path d="M4.5 3 q1 ${len * .4} 0 ${len - 4}" ${thin(light(c.pants, .3), 1.6)} opacity=".35"/>`;
    return s;
  }
  // shin: pivot at the knee; boot sole at (0,len+1), toes pointing +x (the way the figure faces)
  function shin(c, len, id) {
    let s = `<path d="M-8 0 a8 8 0 0 1 16 0 v${len - 8} h-16 z" fill="${F(id, 'pants')}" ${sw}/><path d="M-6 2 h4.5 v${len - 11} h-4.5 z" fill="#000" opacity=".15"/>`;
    if (c.kneepads) s += `<path d="M-9.5 -6 h19 v11 q-9.5 5 -19 0 z" fill="#2a2a2a" ${sw2}/><path d="M-5 -2 h10" ${thin('#4a4a4a', 2)}/>`;
    if (c.torn) s += `<path d="M-8 ${len - 10} l4 -8 l4 8 l4 -10 l4 10" fill="${F(id, 'skin')}" stroke="none"/><path d="M-8 ${len - 10} l4 -8 l4 8 l4 -10 l4 10" fill="none" ${sw2}/><path d="M-5 ${len * .35} l3 4" ${thin('#5b2a2a', 2.5)} opacity=".7"/>`;
    s += `<path d="M11 ${len - 15} h-22 v13 q0 3 3 3 h28 q5 0 5 -5 q0 -11 -14 -11 z" fill="${F(id, 'boots')}" ${sw}/><path d="M25 ${len + 1} h-35" ${thin(dark(c.boots, .55), 3.5)}/>`;
    s += `<path d="M14 ${len - 10} q6 0 9 4" ${thin(light(c.boots, .45), 2.4)} opacity=".7"/><path d="M6 ${len - 11} l-6 2 M6 ${len - 7} l-6 2" ${thin(light(c.boots, .5), 1.8)} opacity=".75"/><path d="M-9 ${len - 13} h4 v12 h-4 z" fill="#000" opacity=".16"/>`;
    if (c.sneakers) s += `<path d="M22 ${len - 1} h-31" stroke="#fff" stroke-width="3"/><circle cx="17" cy="${len - 6}" r="2.2" fill="#fff"/>`;
    return s;
  }

  /* ---------- held items ----------
   * Drawn in the HAND's frame: origin = centre of the palm, +y points along the forearm away from
   * the elbow (the direction the item extends / a gun fires), +x is the thumb side. So a weapon
   * always points where the forearm points — angled down at low ready, level when aiming. */
  const GUNS = { rifle: 1, shotgun: 1, pistol: 1, sniper: 1, ak: 1 };
  /* Cut-out sprites (assets/sprites): size = longest side in rig units; grip / tip = points in the
   * sprite (0..1): the grip sits in the palm and grip→tip points along +y. `hang` items dangle. */
  const HELD = {
    rifle: { s: 'rifle', size: 92, grip: [.4, .72], tip: [1, .3] }, shotgun: { s: 'shotgun', size: 90, grip: [.33, .7], tip: [1, .25] },
    pistol: { s: 'pistol', size: 40, grip: [.22, .8], tip: [1, .22] }, sniper: { s: 'sniper', size: 102, grip: [.42, .7], tip: [1, .3] }, ak: { s: 'ak', size: 90, grip: [.42, .72], tip: [1, .3] },
    wrench: { s: 'wrench', size: 60, grip: [.2, .82], tip: [.85, .15] }, pipewrench: { s: 'pipewrench', size: 55, grip: [.22, .85], tip: [.8, .12] },
    crowbar: { s: 'crowbar', size: 72, grip: [.14, .86], tip: [.9, .1] }, cleaver: { s: 'cleaver', size: 50, grip: [.86, .45], tip: [.1, .5] },
    shovel: { s: 'shovel', size: 70, grip: [.8, .18], tip: [.2, .85] },
    medkit: { s: 'medkit2', size: 40, hang: true }, toolbox: { s: 'toolbox', size: 38, hang: true },
  };
  function held(t, len) {
    const h = HELD[t], px = h && DE.Data && DE.Data.SPRITES && DE.Data.SPRITES[h.s]; if (!px) return null;
    const k = h.size / Math.max(px[0], px[1]), w = px[0] * k, ht = px[1] * k;
    const img = `<image href="assets/sprites/${h.s}.png" width="${w.toFixed(1)}" height="${ht.toFixed(1)}"/>`;
    if (h.hang) return `<g transform="translate(${(-w / 2).toFixed(1)} ${(len + 4).toFixed(1)})">${img}</g>`;
    const gx = h.grip[0] * w, gy = h.grip[1] * ht, ang = Math.atan2(h.tip[1] * ht - gy, h.tip[0] * w - gx) * 180 / Math.PI;
    const dist = Math.hypot(h.tip[0] * w - gx, h.tip[1] * ht - gy);
    const flash = GUNS[t] ? `<g class="muzzle" opacity="0" transform="translate(0 ${(len + dist + 3).toFixed(1)}) rotate(90)"><path d="M0 0 L16 -7 L11 0 L16 7 Z M0 0 L9 -11 L7 0 L9 11 Z" fill="#ffe27a" stroke="#ff9a2a" stroke-width="1.5"/><circle r="4.5" fill="#fff6c8"/></g>` : '';
    return `<g transform="translate(0 ${len}) rotate(${(90 - ang).toFixed(1)}) translate(${(-gx).toFixed(1)} ${(-gy).toFixed(1)})">${img}</g>${flash}`;
  }
  function item(t, len) {
    const spr = held(t, len); if (spr) return spr;
    const at = (body) => `<g transform="translate(0 ${len})">${body}</g>`;
    switch (t) {
      case 'rifle': return at(`<rect x="3" y="-10" width="13" height="30" rx="2" fill="#3a3540" ${sw3}/><rect x="6" y="18" width="7" height="44" rx="2" fill="#3a3540" ${sw3}/><rect x="4" y="22" width="11" height="16" rx="2" fill="#6b4226" ${sw3}/>`);
      case 'pistol': return at(`<rect x="-4" y="-6" width="9" height="12" rx="2" fill="#2a2530" ${sw3}/><rect x="3" y="-8" width="10" height="30" rx="2" fill="#3a3540" ${sw3}/>`);
      case 'medkit': return at(`<path d="M-6 2 q6 -9 12 0" fill="none" ${sw3}/><rect x="-18" y="4" width="36" height="28" rx="4" fill="#d8303a" ${sw}/><rect x="-5" y="11" width="10" height="14" fill="#fff"/><rect x="-10" y="15" width="20" height="6" fill="#fff"/>`);
      case 'pan': return at(`<rect x="-4" y="-6" width="8" height="36" rx="3" fill="#2a2630" ${sw3}/><ellipse cx="0" cy="48" rx="16" ry="20" fill="#2f2b36" ${sw}/><ellipse cx="2" cy="48" rx="10" ry="13" fill="#5b5763" stroke="none"/><ellipse cx="5" cy="43" rx="3" ry="6" fill="#8a8e98" opacity=".7"/>`);
      case 'flashlight': return at(`<rect x="-6" y="-8" width="12" height="28" rx="3" fill="#3a3540" ${sw3}/><path d="M-10 20 h20 l-3 11 h-14 z" fill="#5a5666" ${sw3}/><ellipse class="beam" cx="0" cy="33" rx="11" ry="4.5" fill="#fff4a8" ${sw3}/><path class="beam" d="M-9 36 l-16 64 h50 l-16 -64 z" fill="#fff4a8" opacity=".22" stroke="none"/><rect x="-4" y="2" width="8" height="4" fill="#d8303a"/>`);
      case 'clipboard': return at(`<rect x="-14" y="-2" width="30" height="38" rx="3" fill="#a87a4a" ${sw3}/><rect x="-10" y="4" width="22" height="28" fill="#f6f4ee" stroke="none"/><rect x="-4" y="-5" width="10" height="7" rx="2" fill="#8a8c96" ${sw2}/><path d="M-6 12 h14 M-6 18 h14 M-6 24 h9" ${thin('#5a6a8a', 2)}/>`);
      case 'wrench': return at(`<rect x="-4" y="-8" width="9" height="50" rx="3" fill="#8a8c96" ${sw3}/><path d="M-11 40 h23 v10 l-6 6 v-8 h-11 v8 l-6 -6 z" fill="#8a8c96" ${sw3}/>`);
      default: return '';
    }
  }
  // what the hands hold decides the rest pose of the arms
  const HOLD = { rifle: 'gun', ak: 'gun', shotgun: 'gun', sniper: 'gun', pistol: 'pistol', wrench: 'tool', pipewrench: 'tool', crowbar: 'tool', cleaver: 'tool', pan: 'tool', shovel: 'tool', medkit: 'hang', toolbox: 'hang', flashlight: 'torch', clipboard: 'board' };
  /* Rest angles in degrees (negative = forward / up): upper arm and forearm, near (F) and far (B),
   * aiming angles (au*, af*), arm-swing factor k and a forward lean. Read by js/ui/anim.js. */
  const POSE_BASE = { uaF: 3, faF: -10, uaB: -3, faB: -10, auF: -58, afF: -32, auB: -72, afB: -22, k: 1, lean: 0 };
  const POSES = {
    none: {}, gun: { uaF: -12, faF: -58, uaB: -32, faB: -50, k: .25 }, pistol: { uaF: 4, faF: -18, auF: -84, afF: -6, auB: 8, afB: -16 },
    tool: { uaF: 3, faF: -26 }, hang: { uaF: 2, faF: -4 }, torch: { uaF: -14, faF: -56, k: .35 }, board: { uaF: -6, faF: -100, k: .3 },
    reach: { uaF: -60, faF: -26, uaB: -96, faB: -8, k: .6 }, heavy: { uaF: -12, faF: -28, uaB: -44, faB: -30 }, hunch: { uaF: -22, faF: -12, uaB: -28, faB: -10, lean: 12 },
    cast: { uaF: -98, faF: -36, uaB: -112, faB: -30, k: .4 }, pounce: { uaF: -78, faF: -52, uaB: -88, faB: -46 }, flail: { uaF: -42, faF: -32, uaB: -52, faB: -22 }, crawl: {},
  };
  const pose = (hold) => Object.assign({}, POSE_BASE, POSES[hold] || {});
  // a crate carried in both arms (shown by .a-carry), in the torso's frame
  const CRATE = `<g class="crate"><rect x="8" y="-46" width="42" height="34" rx="3" fill="#b0824e" ${sw}/><path d="M10 -29 h38 M29 -45 v32" stroke="#7a5230" stroke-width="3"/><path d="M12 -43 l34 28" stroke="#7a5230" stroke-width="2.5" opacity=".6"/><path d="M11 -43 h36" ${thin('#dcb27c', 2)} opacity=".8"/><rect x="22" y="-38" width="14" height="6" rx="1" fill="#e9dcc0" opacity=".85"/></g>`;

  /* ---------- assemble ---------- */
  const BODY = { hip: -56, neck: -110, sh: 25, shY: 6, hipOff: 11.5, thigh: 28, shin: 26, upper: 23, fore: 22 };
  function rig(id, o) {
    o = o || {}; const c = ALL[id]; if (!c) return '';
    const B = Object.assign({}, BODY, c.body || {}), L = B.hip - B.neck;
    const it = o.item !== undefined ? o.item : (c.item || null);
    const hold = c.kind === 'crew' ? (HOLD[it] || 'none') : (c.hold || 'reach');
    ensureDefs(id, c);
    const P = pose(hold);
    const leg = (side, x) => `<g transform="translate(${x} ${B.hip})"><g class="j j-leg${side}">${thigh(c, B.thigh, id)}<g transform="translate(0 ${B.thigh})"><g class="j j-shin${side}">${shin(c, B.shin, id)}</g></g></g></g>`;
    const arm = (side, x, held) => `<g transform="translate(${x} ${-L + B.shY})"><g class="j j-arm${side}" transform="rotate(${P['ua' + side]})">${upperArm(c, B.upper, id)}<g transform="translate(0 ${B.upper})"><g class="j j-fore${side}" transform="rotate(${P['fa' + side]})">${foreArm(c, B.fore, held, id, side)}</g></g></g></g>`;
    const parts = leg('L', -B.hipOff) + leg('R', B.hipOff)
      + `<g transform="translate(0 ${B.hip})"><g class="j j-torso" transform="rotate(${P.lean})">${arm('B', B.shB != null ? B.shB : -B.sh, null)}${torso(c, L, id)}${c.kind === 'crew' ? CRATE : ''}<g transform="translate(0 ${-L})"><g class="j j-head">${head(c, id)}</g></g>${arm('F', B.sh, it)}</g></g>`;
    const h = o.h || 48, w = Math.round(h * 140 / 225);
    const v = c.vars || {}, num = (k, d) => (v[k] != null ? parseFloat(v[k]) : d);
    const phase = o.phase != null ? Math.abs(+o.phase || 0) : 0;
    const filter = [c.filter, o.tint].filter(Boolean).join(' ');
    const style = `height:${h}px;width:${w}px;--ph:-${phase.toFixed(2)}s` + (filter ? `;filter:${filter}` : '');
    const cls = `rig rig-${id} kind-${c.kind} hold-${hold} a-${o.anim || 'idle'}${GUNS[it] ? ' armed' : ''}${o.flip ? ' flip' : ''}${c.big ? ' big' : ''}${o.cls ? ' ' + o.cls : ''}`;
    // the animator (js/ui/anim.js) reads the character's build and gait from these
    const data = `data-c="${id}" data-k="${c.kind}" data-hold="${hold}" data-t="${num('--t', 1)}" data-la="${num('--la', 20)}" data-aa="${num('--aa', 14)}" data-bob="${num('--bob', 5)}" data-ph="${phase.toFixed(2)}" data-leg="${B.thigh + B.shin}" data-h="${h}" data-big="${c.big ? 1 : 0}"`;
    return `<svg class="${cls}" viewBox="-70 -215 140 225" style="${style}" ${data}${o.title ? ` data-title="${esc(o.title)}"` : ''} aria-hidden="true"><title>${esc(o.title || c.name || id)}</title><ellipse class="shadow" cx="0" cy="1" rx="${c.big ? 44 : 30}" ry="6" fill="#000" opacity=".3"/><g class="j j-body"><g class="j j-body2">${parts}</g></g></svg>`;
  }

  /* ---------- portraits: the illustrated cut-outs, used as icons around the UI ---------- */
  const PORT = { scientist: 'medic', boss: 'mutant' };
  const PORT_TINT = { scientist: 'hue-rotate(-25deg) saturate(1.15)', boss: 'hue-rotate(-40deg) saturate(1.3) brightness(.9)' };
  function portrait(id, o) {
    o = o || {}; const c = ALL[id] ? id : 'scavenger'; const src = PORT[c] || c;
    const tint = PORT_TINT[c] ? ` style="filter:${PORT_TINT[c]}"` : '';
    return `<span class="cport cport-${ALL[c].kind} cport-${c}${o.cls ? ' ' + o.cls : ''}"${o.title ? ` title="${esc(o.title)}"` : ''}><img src="assets/chars/${src}.png" alt="" draggable="false"${tint}></span>`;
  }

  /* ---------- character tables (matched to the illustrated sheet) ---------- */
  // zombies are turned toward their prey: the far shoulder sits near the front, so both arms reach out
  const Z = (x) => Object.assign({ kind: 'zombie', skin: SKIN.zombie, eyes: 'glow', mouth: 'open', angry: true, torn: true, boots: '#3a2a2a' }, x, { body: Object.assign({ shB: 10, upper: 25, fore: 25 }, x.body || {}) });
  const C = (x) => Object.assign({ kind: 'crew', skin: SKIN.light, eyes: 'normal', mouth: 'smile', belt: true, boots: '#5a3a24', dirt: true }, x);
  const BIG = { hip: -60, neck: -122, sh: 42, shB: 14, shY: 10, hipOff: 19, thigh: 30, shin: 27, upper: 31, fore: 30 };
  const ZOMBIES = {
    walker:  Z({ name: 'Walker', hair: { style: 'bald' }, shirt: '#e9e4dc', pants: '#3f4f72', ribs: true, drip: true, vars: { '--t': '1.5s', '--la': '15deg', '--aa': '9deg', '--bob': '4px' } }),
    runner:  Z({ name: 'Runner', skin: SKIN.pale, hair: { style: 'messy', color: '#2d1e22' }, shirt: '#3a2f33', jacket: { color: '#c73a3a', lapel: '#8f2626', pocket: true, hood: true }, sleeve: '#c73a3a', pants: '#2e3a4e', boots: '#a0303a', hold: 'flail', vars: { '--t': '.62s', '--la': '30deg', '--aa': '34deg', '--bob': '8px' } }),
    brute:   Z({ name: 'Brute', big: true, headW: 40, headH: 42, hair: { style: 'bald' }, shirt: '#ece7dc', sleeveShort: true, sleeve: '#ece7dc', pants: '#6b4a2a', boots: '#4a3a2a', belly: true, boneArm: true, shoulderW: 46, hipW: 38, body: BIG, hold: 'heavy', vars: { '--t': '2.1s', '--la': '12deg', '--aa': '8deg', '--bob': '9px' } }),
    toxic:   Z({ name: 'Spitter', skin: SKIN.dark, hair: { style: 'bald' }, mouth: 'drool', shirt: '#3a4a3a', pants: '#3a3a3a', glowHands: true, hold: 'hunch', vars: { '--t': '1.7s', '--la': '13deg', '--aa': '10deg', '--bob': '4px' } }),
    crawler: Z({ name: 'Crawler', skin: SKIN.grey, hair: { style: 'bald' }, mouth: 'fangs', shirt: '#5a5a62', pants: '#3a3a40', ribs: true, bone: true, claws: true, hold: 'crawl', vars: { '--t': '1.3s', '--la': '10deg', '--aa': '22deg', '--bob': '2px' } }),
    bomber:  Z({ name: 'Bomber', hair: { style: 'mohawk', color: '#ff5a2a' }, shirt: '#2a2630', jacket: { color: '#3a3540', lapel: '#55536a' }, sleeve: '#3a3540', pants: '#3a3a40', dynamite: true, vars: { '--t': '.85s', '--la': '24deg', '--aa': '14deg', '--bob': '6px' } }),
    leaper:  Z({ name: 'Leaper', hair: { style: 'wild', color: '#3a2420' }, mouth: 'fangs', shirt: '#4a3a30', pants: '#5a4a3a', claws: true, hold: 'pounce', vars: { '--t': '.95s', '--la': '26deg', '--aa': '16deg', '--bob': '8px' } }),
    armored: Z({ name: 'Riot Walker', mouth: 'grim', torn: false, hat: { type: 'riot', color: '#2a2834' }, shirt: '#2a2834', armor: true, pads: true, kneepads: true, pants: '#2a2834', boots: '#1a1820', gloves: '#2f2d38', shoulderW: 34, hipW: 26, hold: 'heavy', vars: { '--t': '1.9s', '--la': '12deg', '--aa': '6deg', '--bob': '5px' } }),
    cultist: Z({ name: 'Cultist', skin: SKIN.dark, eyes: 'greenglow', mouth: 'grim', torn: false, hat: { type: 'hood', color: '#7a3ab0' }, shirt: '#5a2a80', robe: '#7a3ab0', pants: '#4a2070', boots: '#2a1040', glowHands: true, hold: 'cast', vars: { '--t': '2.2s', '--la': '5deg', '--aa': '8deg', '--bob': '6px' } }),
    mutant:  Z({ name: 'Mutant', big: true, headW: 38, headH: 40, hair: { style: 'spikes', color: '#b25a8f' }, mouth: 'fangs', shirt: '#9cb878', sleeve: '#9cb878', bareArms: true, pants: '#4a3a62', boots: '#5f7d4d', claws: true, spikes: true, boneArm: true, shoulderW: 42, hipW: 32, body: { hip: -58, neck: -116, sh: 38, shY: 8, hipOff: 17, thigh: 29, shin: 27, upper: 31, fore: 31 }, vars: { '--t': '1.6s', '--la': '15deg', '--aa': '12deg', '--bob': '7px' } }),
  };
  ZOMBIES.boss = Object.assign({}, ZOMBIES.mutant, { name: 'Colossus', headW: 42, headH: 44, shoulderW: 50, hipW: 38, body: { hip: -64, neck: -128, sh: 46, shY: 10, hipOff: 20, thigh: 32, shin: 30, upper: 36, fore: 36 }, filter: 'hue-rotate(-40deg) saturate(1.4) contrast(1.1)', vars: { '--t': '2.4s', '--la': '13deg', '--aa': '10deg', '--bob': '9px' } });
  const CREW = {
    scavenger: C({ name: 'Scavenger', hair: { style: 'messy', color: '#5a3a22' }, brows: 'stern', mouth: 'grim', shirt: '#d9c7a6', jacket: { color: '#7a5434', lapel: '#4a3220', pocket: true, len: 62 }, sleeve: '#7a5434', pants: '#2f3550', boots: '#6b4a2e', backpack: '#5a4a3a', wristband: '#3a2a2a', item: 'ak', vars: { '--t': '1s', '--la': '22deg', '--aa': '16deg', '--bob': '6px' } }),
    hunter:    C({ name: 'Hunter', hair: { style: 'ponytail', color: '#f2d060' }, mouth: 'smirk', cheeks: true, shirt: '#f4efe6', jacket: { color: '#c93a3a', lapel: '#9a2a2a', len: 30 }, sleeve: '#c93a3a', gloves: '#3a2a2a', pants: '#2b3350', boots: '#6b4a2e', item: 'pistol', vars: { '--t': '.92s', '--la': '23deg', '--aa': '17deg', '--bob': '6px' } }),
    engineer:  C({ name: 'Engineer', skin: SKIN.tan, hair: { style: 'short', color: '#6b3a1e' }, beard: { style: 'full', color: '#6b3a1e' }, brows: 'stern', mouth: 'grim', hat: { type: 'hardhat', color: '#f3c21a' }, shirt: '#2f7fd0', vest: '#f08a2a', sleeve: '#2f7fd0', pants: '#3a5a9a', boots: '#6b4a2e', toolbelt: true, item: 'wrench', vars: { '--t': '1.08s', '--la': '20deg', '--aa': '15deg', '--bob': '5.5px' } }),
    medic:     C({ name: 'Medic', hair: { style: 'bun', color: '#4a2a1a' }, eyes: 'glasses', cheeks: true, dirt: false, shirt: '#9ad3ef', jacket: { color: '#f6f4ee', lapel: '#d9d6cf', len: 58, pocket: true }, sleeve: '#f6f4ee', cross: true, stethoscope: true, pants: '#3e4458', boots: '#3a2a2a', item: 'medkit', vars: { '--t': '1.05s', '--la': '19deg', '--aa': '13deg', '--bob': '5.5px' } }),
    soldier:   C({ name: 'Soldier', skin: SKIN.tan, mouth: 'stubble', brows: 'stern', hat: { type: 'helmet', color: '#4f6a3a', color2: '#3e5530' }, shirt: '#55683c', sleeve: '#55683c', camo: true, gloves: '#2a2a2a', pants: '#4a5c36', boots: '#2a2a2a', bandolier: true, kneepads: true, item: 'rifle', vars: { '--t': '.96s', '--la': '22deg', '--aa': '15deg', '--bob': '6px' } }),
    farmer:    C({ name: 'Farmer', hair: { style: 'white', color: '#e6e6ea' }, beard: { style: 'long', color: '#e6e6ea' }, brows: 'stern', mouth: 'grim', shirt: '#33406a', jacket: { color: '#7a5a3a', lapel: '#5a4028', len: 64, pocket: true }, sleeve: '#7a5a3a', pants: '#2f2f3a', boots: '#3a2a2a', item: 'shotgun', vars: { '--t': '1.3s', '--la': '16deg', '--aa': '11deg', '--bob': '4.5px' } }),
    mechanic:  C({ name: 'Mechanic', hair: { style: 'ponytail', color: '#6a3a1e' }, hat: { type: 'goggles' }, cheeks: true, shirt: '#d9731f', sleeve: '#d9731f', gloves: '#3a2a2a', pants: '#a5561a', boots: '#3a2a2a', toolbelt: true, item: 'pipewrench', vars: { '--t': '.98s', '--la': '21deg', '--aa': '16deg', '--bob': '6.5px' } }),
    cook:      C({ name: 'Cook', hair: { style: 'short', color: '#5a3a22' }, hat: { type: 'chef' }, dirt: false, shirt: '#f6f4ee', sleeve: '#f6f4ee', apron: '#6b4a2e', pants: '#2f2f3a', boots: '#3a2a2a', item: 'pan', vars: { '--t': '1.12s', '--la': '18deg', '--aa': '13deg', '--bob': '5.5px' } }),
    guard:     C({ name: 'Guard', eyes: 'sunglasses', mouth: 'grim', hat: { type: 'police', color: '#2b3350' }, dirt: false, shirt: '#2b3350', sleeve: '#2b3350', gloves: '#1a1a22', pants: '#222a44', boots: '#1a1a22', badge: true, item: 'rifle', vars: { '--t': '1.02s', '--la': '20deg', '--aa': '14deg', '--bob': '5.5px' } }),
    scout:     C({ name: 'Scout', hair: { style: 'messy', color: '#5a3a22' }, cheeks: true, hat: { type: 'cap', color: '#d8303a', color2: '#f6f4ee' }, shirt: '#f6f4ee', jacket: { color: '#d8303a', lapel: '#a02028', len: 46, pocket: true }, sleeve: '#d8303a', pants: '#3a5a9a', boots: '#6b4a2e', sneakers: true, backpack: '#4f7a3a', item: 'flashlight', vars: { '--t': '.84s', '--la': '25deg', '--aa': '18deg', '--bob': '7px' } }),
  };
  CREW.scientist = Object.assign({}, CREW.medic, { name: 'Scientist', cross: false, stethoscope: false, item: 'clipboard', shirt: '#8fe3d8', hair: { style: 'bun', color: '#2a1a14' } });
  const ALL = Object.assign({}, ZOMBIES, CREW);

  function zombie(id, o) { return rig(ZOMBIES[id] ? id : 'walker', o); }
  function crew(prof, o) { return rig(CREW[prof] ? prof : 'scavenger', o); }
  /** Weapon a survivor carries on guard duty: their own firearm, else a rifle. */
  function dutyWeapon(prof) { const c = CREW[prof]; return c && GUNS[c.item] ? c.item : 'rifle'; }
  return { rig, zombie, crew, portrait, dutyWeapon, pose, ZOMBIES, CREW, ALL };
})();
