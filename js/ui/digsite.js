/* The dig site: the excavation under the deepest floor, drawn as a working mine.
 *
 * A tunnel is carved from the lift shaft towards the far end of the future floor; its length is the
 * dig's progress. Timber frames hold up the roof, a lamp cable runs along it, rails carry a mine cart
 * to the lift, rubble piles up at the face, and the equipment matches the rock layer: shovels and
 * picks in the topsoil and clay, a compressor and jackhammer hose in the limestone, a hydraulic drill
 * rig in the granite, a deep-core drill in the basalt and a glowing thermal borer in the magma rock.
 * Dust puffs and pebbles fall from the face while the crew works. Between digs the crew works a
 * small quarry alcove next to the shaft.
 *
 * The miners are the survivors' own rigs (js/ui/actors.js asks layout() where the face and the cart
 * are). The art is rebuilt only when something visible changes (progress in 1% steps). */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.DigSite = (function () {
  const INK = '#1c1020', H = 266, G = 246, ROOF = 24;      // site height, ground line, roof line (site px)
  const S3 = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const S2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const LOOK = {
    topsoil: { cave: '#2b1e18', wall: '#45301f', face: '#74503a', hi: '#9a7452', rock: '#86603f' },
    clay: { cave: '#2a1a14', wall: '#55361f', face: '#8a5a3e', hi: '#b07a52', rock: '#9a6a48' },
    limestone: { cave: '#2e2b29', wall: '#5e5a52', face: '#b8b2a2', hi: '#e4dfcf', rock: '#c9c2b0' },
    granite: { cave: '#23232b', wall: '#45464f', face: '#7c7e8a', hi: '#a9abb6', rock: '#8a8c98' },
    basalt: { cave: '#16141c', wall: '#2a2734', face: '#4a4658', hi: '#6c6880', rock: '#3c384a', gem: '#9b6ad6' },
    magma: { cave: '#1d0f10', wall: '#3a1c1a', face: '#5a2a24', hi: '#8a4a3a', rock: '#4a2622', glow: '#ff7a2a' },
  };
  let sig = '', lay = { faceX: 170, cartX: 120, depth: 0, active: false, W: 1200 };

  function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  const img = (s, x, y, h, flip) => { const px = (DE.Data.SPRITES || {})[s]; if (!px) return ''; const w = h * px[0] / px[1]; return `<image href="assets/sprites/${s}.png" x="${(x - w / 2).toFixed(1)}" y="${(y - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h}"${flip ? ` transform="translate(${(2 * x).toFixed(1)} 0) scale(-1 1)"` : ''}/>`; };
  const rock = (x, y, w, fill, k) => `<path d="M${x - w} ${y} l${w * .3} ${-w * .7} l${w * .6} ${-w * .4} l${w * .9} ${w * .2} l${w * .3} ${w * .9} z" fill="${fill}" ${k ? S2 : S3}/>`;

  /** Where the rock face is: the tunnel grows with progress; between digs, a small quarry alcove. */
  function faceAt(s, W) {
    if (!s.excavation) return 180;
    return Math.round(110 + DE.Excavation.progress(s) * (W - 140));
  }

  /* Machines are drawn relative to the face (x = 0) and travel with it. */
  const f1 = (v) => (+v).toFixed(1);
  /** A tracked undercarriage: track belt with tread lugs, road wheels with hubs, an idler and a toothed sprocket. */
  function tracks(x, w, h) {
    const y = G - h; let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#2e2c38" ${S3}/>`;
    for (let k = x + 8; k < x + w - 6; k += 9) o += `<path d="M${k} ${y + 1} v4 M${k} ${G - 1} v-4" stroke="#55536a" stroke-width="3"/>`;
    const n = Math.max(3, Math.floor((w - 24) / 20));
    for (let i = 0; i < n; i++) { const cx = x + 14 + i * (w - 28) / (n - 1); o += `<circle cx="${f1(cx)}" cy="${G - h / 2}" r="${h / 2 - 5}" fill="#5a5866" ${S2}/><circle cx="${f1(cx)}" cy="${G - h / 2}" r="2.6" fill="#a9adb8"/>`; }
    o += `<circle cx="${x + w - 12}" cy="${G - h / 2}" r="${h / 2 - 3}" fill="#46444f" stroke="${INK}" stroke-width="2" stroke-dasharray="3 2"/>`;
    return o;
  }
  /** Diagonal hazard stripes on a strip. */
  function hazard(x, y, w, h) {
    let o = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffd34a" ${S2}/>`;
    for (let k = x + 2; k < x + w - 2; k += 8) o += `<path d="M${k} ${y + h - 1} l${Math.min(5, x + w - k - 1)} ${-(h - 2)}" stroke="${INK}" stroke-width="3"/>`;
    return o;
  }
  /** Exhaust stack with smoke puffs. */
  function stack(x, y, hgt) {
    return `<rect x="${x}" y="${y - hgt}" width="7" height="${hgt}" fill="#5a5866" ${S2}/><rect x="${x - 2}" y="${y - hgt - 4}" width="11" height="5" rx="1" fill="#3a3845" ${S2}/>`
      + `<g class="dig-smoke">${[0, 1, 2].map(i => `<circle cx="${x + 3}" cy="${y - hgt - 9}" r="${5 + i}" fill="#8a8494" style="animation-delay:${(i * .8).toFixed(1)}s"/>`).join('')}</g>`;
  }
  /** A drill boom from a pivot to the face, with its hydraulic cylinder, hose, headlight and a fluted bit. */
  function boom(px, py, tipX, tipY, c, big, k) {
    const ang = Math.atan2(tipY - py, tipX - px), len = Math.hypot(tipX - px, tipY - py) - 34, ex = px + Math.cos(ang) * len, ey = py + Math.sin(ang) * len;
    const mx = px + Math.cos(ang) * len * .55, my = py + Math.sin(ang) * len * .55, deg = (ang * 180 / Math.PI).toFixed(1), wB = big ? 15 : 12;
    let o = `<g class="dig-boom" style="animation-delay:${(k * .7).toFixed(1)}s">`;
    // hydraulic cylinder under the boom: barrel and a polished rod
    o += `<path d="M${px + 8} ${py + 16} L${f1(mx)} ${f1(my + 7)}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M${px + 8} ${py + 16} L${f1((px + mx) / 2)} ${f1((py + 16 + my + 7) / 2)}" stroke="#5a5f6a" stroke-width="5" stroke-linecap="round"/><path d="M${f1((px + mx) / 2)} ${f1((py + 16 + my + 7) / 2)} L${f1(mx)} ${f1(my + 7)}" stroke="#d0d3dc" stroke-width="3" stroke-linecap="round"/>`;
    // the boom: outlined beam, a darker web and two bolt plates
    o += `<path d="M${px} ${py} L${f1(ex)} ${f1(ey)}" stroke="${INK}" stroke-width="${wB + 5}" stroke-linecap="round"/><path d="M${px} ${py} L${f1(ex)} ${f1(ey)}" stroke="${c}" stroke-width="${wB}" stroke-linecap="round"/><path d="M${px + 6} ${py + 3} L${f1(ex - 4)} ${f1(ey + 3)}" stroke="#000" stroke-width="2" opacity=".22"/>`;
    o += `<circle cx="${px}" cy="${py}" r="${wB / 2 + 2}" fill="#5a5866" ${S2}/><circle cx="${px}" cy="${py}" r="2.5" fill="#d0d3dc"/><circle cx="${f1(mx)}" cy="${f1(my)}" r="3" fill="#3a3845"/>`;
    // hose along the boom to the drill motor
    o += `<path d="M${px - 6} ${py + 6} Q${f1(mx)} ${f1(my + 22)} ${f1(ex - 10)} ${f1(ey + 9)}" fill="none" stroke="${INK}" stroke-width="4"/><path d="M${px - 6} ${py + 6} Q${f1(mx)} ${f1(my + 22)} ${f1(ex - 10)} ${f1(ey + 9)}" fill="none" stroke="#c93a3a" stroke-width="2"/>`;
    // headlight and its beam on the face
    o += `<path d="M${f1(mx + 6)} ${f1(my - 9)} L${tipX + 4} ${tipY - 34} L${tipX + 4} ${tipY + 30} Z" fill="#fff6c0" opacity=".14"/><rect x="${f1(mx)}" y="${f1(my - 13)}" width="9" height="7" rx="2" fill="#fff6c0" ${S2}/>`;
    // drill motor and bit, rotated along the boom; the flutes run (spinning) and the bit chatters
    o += `<g transform="translate(${f1(ex)} ${f1(ey)}) rotate(${deg})"><rect x="-6" y="-9" width="22" height="18" rx="3" fill="#6e717b" ${S3}/><path d="M-2 -9 v18 M4 -9 v18" stroke="${INK}" stroke-width="1.5" opacity=".5"/>`
      + `<g class="dig-bit"><rect x="16" y="-4" width="10" height="8" fill="#a9adb8" ${S2}/><path d="M26 -8 L44 0 L26 8 Z" fill="#c9ccd4" ${S3}/><path class="dig-flute" d="M28 -6 L40 -1 M28 6 L40 1 M27 0 L43 0" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 2.5"/></g></g>`;
    return o + '</g>';
  }
  function jumbo(L, big) {
    // a drilling jumbo on tracks: engine house with stack, cab with an operator, one boom (two in basalt)
    const c = big ? '#d6a43a' : '#f0a020', cd = big ? '#9a7426' : '#c07a10', x = big ? -262 : -232, w = 118, th = 24, deck = G - th - 11;
    let o = `<g class="dig-rig">` + tracks(x, w, th);
    o += `<g class="dig-shake"><rect x="${x + 4}" y="${deck}" width="${w - 8}" height="12" rx="3" fill="${cd}" ${S3}/>${hazard(x + w - 40, deck + 2, 30, 8)}`;
    // engine house with louvres and a fuel cap, the exhaust stack behind
    o += stack(x + 14, deck - 30, 18) + `<rect x="${x + 6}" y="${deck - 34}" width="44" height="34" rx="4" fill="${c}" ${S3}/>` + [0, 1, 2, 3].map(i => `<path d="M${x + 12} ${deck - 27 + i * 7} h20" stroke="${INK}" stroke-width="2" opacity=".55"/>`).join('') + `<circle cx="${x + 41}" cy="${deck - 24}" r="3.5" fill="#3a3845" ${S2}/>`;
    // cab: frame, glass with a glare, the operator in a hard hat
    const cx = x + 54; o += `<path d="M${cx} ${deck} V${deck - 44} q0 -6 6 -6 h28 q6 0 6 6 V${deck} Z" fill="${c}" ${S3}/><rect x="${cx + 5}" y="${deck - 42}" width="30" height="24" rx="3" fill="#9fe3ff" ${S2}/>`
      + `<circle cx="${cx + 18}" cy="${deck - 27}" r="5" fill="#e8b48a" stroke="${INK}" stroke-width="1.5"/><path d="M${cx + 12} ${deck - 29} q6 -9 12 0 z" fill="#ffd34a" stroke="${INK}" stroke-width="1.5"/><path d="M${cx + 13} ${deck - 21} h10 v3 h-10 z" fill="#3a6aa8"/>`
      + `<path d="M${cx + 9} ${deck - 40} l8 0 l-10 14 l-4 0 z" fill="#fff" opacity=".45"/><circle class="dig-beacon" cx="${cx + 20}" cy="${deck - 54}" r="4" fill="#ff7a2a" ${S2}/><rect x="${cx + 16}" y="${deck - 51}" width="8" height="3" fill="#3a3845"/></g>`;
    // booms
    const px = x + w - 14, py = deck - 4;
    o += boom(px, py, -6, G - (big ? 150 : 128), c, big, 0);
    if (big) o += boom(px - 6, py + 4, -6, G - 70, c, big, 1);
    return o + '</g>';
  }
  function airDrill(L) {
    // a compressor on wheels feeds an air-leg rock drill set against the face
    const x = -250, ty = G - 44;
    let o = `<g class="dig-rig"><g class="dig-shake">`;
    o += `<path d="M${x - 20} ${G - 16} l-16 6" ${S3}/><circle cx="${x - 38}" cy="${G - 9}" r="4" fill="#3a3845" ${S2}/>`;   // tow bar
    o += `<rect x="${x - 22}" y="${ty}" width="82" height="30" rx="15" fill="#d8443a" ${S3}/><path d="M${x - 10} ${ty + 6} h58" stroke="#fff" stroke-width="2.5" opacity=".35"/><path d="M${x - 2} ${ty} v30 M${x + 40} ${ty} v30" stroke="${INK}" stroke-width="2" opacity=".45"/>`;
    o += `<rect x="${x + 4}" y="${ty - 22}" width="36" height="22" rx="3" fill="#4a4f63" ${S3}/>` + [0, 1, 2].map(i => `<path d="M${x + 9} ${ty - 17 + i * 6} h18" stroke="#8a8e98" stroke-width="2"/>`).join('');
    o += `<circle cx="${x + 50}" cy="${ty - 8}" r="8" fill="#f4efe2" ${S2}/><path class="dig-gauge" d="M${x + 50} ${ty - 8} l0 -6" stroke="#c93a3a" stroke-width="2" stroke-linecap="round"/>`;
    o += stack(x + 30, ty - 22, 10) + `</g>`;
    o += [x - 6, x + 44].map(cx => `<circle cx="${cx}" cy="${G - 9}" r="10" fill="#2e2c38" ${S3}/><circle cx="${cx}" cy="${G - 9}" r="3.5" fill="#a9adb8"/>`).join('');
    // hose along the floor to the drill
    const hy = G - 78;
    o += `<path d="M${x + 60} ${ty + 14} C${x + 120} ${G + 2}, -140 ${G + 2}, -78 ${hy + 6}" fill="none" stroke="${INK}" stroke-width="5"/><path d="M${x + 60} ${ty + 14} C${x + 120} ${G + 2}, -140 ${G + 2}, -78 ${hy + 6}" fill="none" stroke="#3a3845" stroke-width="2.5"/>`;
    // the air leg (telescopic support), then the drill body and its steel, chattering against the rock
    o += `<path d="M-104 ${G} L-70 ${hy + 8}" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><path d="M-104 ${G} L-86 ${(G + hy) / 2 + 2}" stroke="#5a5f6a" stroke-width="5" stroke-linecap="round"/><path d="M-86 ${(G + hy) / 2 + 2} L-70 ${hy + 8}" stroke="#d0d3dc" stroke-width="3" stroke-linecap="round"/><rect x="-112" y="${G - 4}" width="16" height="4" fill="#3a3845" ${S2}/>`;
    o += `<g class="dig-bit"><rect x="-86" y="${hy - 8}" width="46" height="16" rx="4" fill="#ffd34a" ${S3}/><path d="M-78 ${hy - 8} v16 M-70 ${hy - 8} v16" stroke="${INK}" stroke-width="1.6" opacity=".5"/>`
      + `<path d="M-96 ${hy - 4} h10 M-96 ${hy + 4} h10 M-96 ${hy - 8} v16" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="-40" y="${hy - 2.5}" width="34" height="5" fill="#a9adb8" ${S2}/><path d="M-6 ${hy - 4} l6 4 l-6 4 z" fill="#c9ccd4" ${S2}/></g>`;
    return o + '</g>';
  }
  function borer(L) {
    // a thermal borer: riveted steel drum on long tracks, cooling fins, pipes and a gauge; the cutter
    // head spins and glows white-hot at the face
    const x = -300, w = 248, th = 26, cy = G - th - 44, r = 36, ex = -38;
    let o = `<g class="dig-rig">` + tracks(x + 6, w - 40, th);
    o += `<g class="dig-shake"><rect x="${x}" y="${cy - r}" width="${ex - x}" height="${2 * r}" rx="18" fill="#8a8e98" ${S3}/>`
      + `<rect x="${x + 8}" y="${cy - r + 6}" width="${ex - x - 16}" height="9" rx="4" fill="#c9ccd4" opacity=".75"/><rect x="${x + 8}" y="${cy + r - 14}" width="${ex - x - 16}" height="8" rx="4" fill="#000" opacity=".2"/>`;
    for (let bx = x + 46; bx < ex - 20; bx += 52) { o += `<rect x="${bx}" y="${cy - r}" width="8" height="${2 * r}" fill="#6e717b" ${S2}/>`; for (let k = 0; k < 4; k++) o += `<circle cx="${bx + 4}" cy="${cy - r + 10 + k * 17}" r="1.8" fill="#d0d3dc"/>`; }
    for (let k = 0; k < 6; k++) o += `<path d="M${x + 10 + k * 5} ${cy - r + 16} v${2 * r - 32}" stroke="${INK}" stroke-width="2" opacity=".55"/>`;   // cooling fins
    o += `<path d="M${x + 30} ${cy - r - 6} H${ex - 30}" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M${x + 30} ${cy - r - 6} H${ex - 30}" stroke="#c93a3a" stroke-width="4" stroke-linecap="round"/>`
      + [x + 60, x + 140].map(px => `<rect x="${px}" y="${cy - r - 9}" width="6" height="9" fill="#3a3845"/>`).join('');
    o += `<circle cx="${x + 100}" cy="${cy}" r="10" fill="#f4efe2" ${S2}/><path class="dig-gauge" d="M${x + 100} ${cy} l0 -7" stroke="#c93a3a" stroke-width="2.2" stroke-linecap="round"/>`
      + `<path d="M${x + 150} ${cy + 8} l9 -16 l9 16 z" fill="#ffd34a" ${S2}/><path d="M${x + 159} ${cy - 3} v5 M${x + 159} ${cy + 5} v1" stroke="${INK}" stroke-width="2"/>`
      + stack(x + 24, cy - r, 14) + `</g>`;
    // cutter head: a cone of segments with teeth, glowing
    o += `<g class="dig-heat"><path d="M${ex} ${cy - r + 2} L${ex + 34} ${cy} L${ex} ${cy + r - 2} Z" fill="${L.glow}" ${S3}/><path d="M${ex + 3} ${cy - r + 14} L${ex + 24} ${cy} L${ex + 3} ${cy + r - 14} Z" fill="#fff1a8" stroke="none"/></g>`
      + `<path class="dig-flute" d="M${ex} ${cy - r + 2} L${ex + 34} ${cy} M${ex} ${cy + r - 2} L${ex + 34} ${cy} M${ex} ${cy - 12} L${ex + 30} ${cy} M${ex} ${cy + 12} L${ex + 30} ${cy}" stroke="${INK}" stroke-width="2" stroke-dasharray="5 3" fill="none"/>`
      + `<g class="dig-sparks">${[0, 1, 2, 3].map(i => `<circle cx="${ex + 30 - i * 4}" cy="${cy - 22 + i * 15}" r="${2.4 - i * .3}" fill="${i % 2 ? '#ffd34a' : '#ff9a3a'}"/>`).join('')}</g>`;
    return o + '</g>';
  }
  function handTools(L) {
    // topsoil / clay: shovels in a dirt heap, a wheelbarrow, a bucket and a sieve
    const x = -96, y = G;
    return `<path d="M${x - 50} ${y} q22 -26 44 0 z" fill="${L.face}" ${S2}/>` + img('shovel', x - 30, y - 6, 34) + img('spade', x - 14, y - 4, 30, true)
      + `<g transform="translate(${x + 40} ${y})"><path d="M-18 -26 h36 l-6 16 h-24 z" fill="#5a6f3a" ${S3}/><path d="M-14 -22 h28" stroke="#7a9a52" stroke-width="2"/><circle cx="12" cy="-6" r="6" fill="#3a3845" ${S2}/><circle cx="12" cy="-6" r="2" fill="#a9adb8"/><path d="M-18 -24 l-12 -6" ${S3}/><path d="M-6 -10 l-3 10 M8 -10 l2 4" ${S2}/>${rock(-4, -26, 7, L.rock, true)}${rock(8, -27, 6, L.rock, true)}</g>`
      + `<g transform="translate(${x - 70} ${y})"><path d="M-9 -16 h18 l-3 16 h-12 z" fill="#8a8e98" ${S2}/><path d="M-9 -16 q9 -10 18 0" fill="none" ${S2}/></g>`
      + `<g transform="translate(${x + 82} ${y})"><ellipse cx="0" cy="-6" rx="13" ry="4" fill="#a06a3a" ${S2}/><path d="M-11 -6 h22" stroke="${INK}" stroke-width="1" stroke-dasharray="2 2"/></g>`;
  }
  function machine(L, layer) {
    switch (layer) {
      case 'limestone': return airDrill(L);
      case 'granite': return jumbo(L, false);
      case 'basalt': return jumbo(L, true);
      case 'magma': return borer(L);
      default: return handTools(L);
    }
  }

  /** The whole tunnel as it will be when this floor is dug out. Only the part up to the face shows:
   *  #dig-reveal widens smoothly as the dig progresses, so the frames, lamps and rails appear as the
   *  crew advances and the untouched ground (the floor's own rock) stays beyond the face. */
  function tunnel(L, d, W) {
    const r = rng(d * 31 + 7), full = W - 30;
    let roof = `M0 ${ROOF}`; for (let x = 30; x < full; x += 30) roof += ` L${x} ${ROOF + 4 + r() * 10}`;
    const cave = `${roof} L${full} ${ROOF + 8} L${full} ${G} L0 ${G} Z`;
    let o = `<defs><linearGradient id="dg-cave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.cave}"/><stop offset="1" stop-color="${L.wall}"/></linearGradient><clipPath id="dg-clip"><path d="${cave}"/></clipPath>
      <radialGradient id="dg-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>`;
    o += `<path d="${cave}" fill="url(#dg-cave)"/>`;
    // back-wall texture: rock seams inside the tunnel
    let tex = ''; for (let i = 0; i < Math.max(3, full / 60); i++) { const x = 20 + r() * (full - 40), y = ROOF + 30 + r() * (G - ROOF - 70); tex += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l${(10 + r() * 20).toFixed(0)} ${(r() * 8 - 4).toFixed(0)} l${(8 + r() * 14).toFixed(0)} ${(6 + r() * 6).toFixed(0)}" fill="none" stroke="#000" stroke-width="2.5" opacity=".28"/>`; if (L.gem && r() < .5) tex += `<path d="M${x.toFixed(0)} ${(y + 18).toFixed(0)} l4 -10 l4 10 l-4 4 z" fill="${L.gem}" ${S2}/>`; if (L.glow && r() < .5) tex += `<path d="M${x.toFixed(0)} ${(y + 10).toFixed(0)} q12 -6 24 2 q10 6 22 -2" fill="none" stroke="${L.glow}" stroke-width="2.5" opacity=".8" class="dig-ember"/>`; }
    o += `<g clip-path="url(#dg-clip)">${tex}<rect x="0" y="${G - 40}" width="${full}" height="40" fill="#000" opacity=".22"/></g>`;
    // timber frames: posts, a header beam, braces
    for (let x = 64; x < full - 40; x += 112) o += `<rect x="${x}" y="${ROOF + 8}" width="11" height="${G - ROOF - 8}" fill="#8a5a32" ${S3}/><rect x="${x - 10}" y="${ROOF + 4}" width="${Math.min(112, full - x - 20) + 20}" height="11" rx="2" fill="#a06a3a" ${S3}/><path d="M${x + 11} ${ROOF + 30} l18 -15" ${S3} stroke-width="5" fill="none"/><path d="M${x + 11} ${ROOF + 30} l18 -15" stroke="#8a5a32" stroke-width="2.5" fill="none"/>`;
    // the lamp cable along the roof, a bulb every frame
    let cable = `M0 ${ROOF + 26}`; const bulbs = []; for (let x = 70; x < full - 20; x += 112) { cable += ` Q${x - 50} ${ROOF + 40} ${x} ${ROOF + 26}`; bulbs.push(x + 28); }
    o += `<path d="${cable}" fill="none" stroke="${INK}" stroke-width="2"/>`; bulbs.forEach(x => { o += `<ellipse cx="${x}" cy="${ROOF + 60}" rx="46" ry="40" fill="url(#dg-glow)" class="dig-lamp"/><path d="M${x} ${ROOF + 30} v8" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${ROOF + 42}" r="5" fill="#ffd98a" ${S2}/>`; });
    // rails with sleepers
    o += `<g>${Array.from({ length: Math.max(0, Math.floor((full - 30) / 16)) }, (_, i) => `<rect x="${8 + i * 16}" y="${G - 1}" width="9" height="5" rx="1" fill="#4a3a2a"/>`).join('')}<path d="M0 ${G - 2} H${full}" stroke="#8a8e98" stroke-width="3"/><path d="M0 ${G - 2} H${full}" stroke="${INK}" stroke-width="1" opacity=".5"/></g>`;
    // tools against the wall near the lift
    o += img('pickaxe', 200, G - 2, 30) + img('lantern', 236, G - 2, 22);
    o += `<path d="${roof}" fill="none" stroke="${INK}" stroke-width="4"/><path d="M0 ${G} H${full}" stroke="${INK}" stroke-width="3"/>`;
    return `<svg class="dig-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${o}</svg>`;
  }

  /** Everything that travels with the face, drawn around x = 0: the fresh rock face (a band of the
   *  layer's rock with a jagged edge), the rubble pile, the machine, and while the crew works: dust
   *  billowing off the face, chips flying back, dirt trickling from the roof and pebbles bouncing. */
  const FW = 470, FX = 420;            // front layer width, and where x = 0 sits inside it
  function front(L, layer, d, digging, machineOn) {
    const r = rng(d * 17 + 3);
    let jag = ''; const pts = []; for (let y = ROOF + 6; y <= G; y += 22) pts.push([Math.round(r() * 14 - 8), Math.min(G, y)]);
    jag = pts.map(([x, y], i) => (i ? 'L' : 'M') + x + ' ' + y).join(' ');
    let o = '';
    if (digging && machineOn) o += machine(L, layer);
    // the rubble pile at the foot of the face (grows and is carted away: .dig-pile)
    o += `<g class="dig-pile">`; for (let i = 0; i < 6; i++) o += rock(-18 - i * 15 - r() * 8, G - (i % 2) * 2, 6 + r() * 6, i % 2 ? L.rock : L.face, true); o += `</g>`;
    // the face: a band of fresh rock, its jagged edge outlined, a highlight just inside
    o += `<path d="${jag} L14 ${G} L14 ${ROOF + 6} Z" fill="${L.face}"/><path d="${jag}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
      + `<path d="${pts.map(([x, y], i) => (i ? 'L' : 'M') + (x + 4) + ' ' + y).join(' ')}" fill="none" stroke="${L.hi}" stroke-width="2" opacity=".75"/>`;
    for (let i = 0; i < 5; i++) { const y = ROOF + 26 + i * 40 + r() * 14; o += `<path d="M${(2 + r() * 6).toFixed(0)} ${y.toFixed(0)} l8 -3 l3 6 z" fill="${L.hi}" opacity=".7"/>`; }
    // work effects
    o += `<g class="dig-fx">`
      + `<g class="dig-dust">${[0, 1, 2, 3, 4].map(i => `<circle cx="${-12 - i * 7}" cy="${G - 30 - i * 32}" r="${10 + i * 3}" fill="${L.hi}" style="animation-delay:${(i * .38).toFixed(2)}s"/>`).join('')}</g>`
      + `<g class="dig-chips">${[0, 1, 2, 3, 4, 5].map(i => `<path d="M-6 ${G - 50 - i * 26} l5 -3 l3 5 l-6 2 z" fill="${i % 2 ? L.rock : L.hi}" ${S2} style="--cx:${-30 - (i % 3) * 22}px;--cy:${10 + (i % 2) * 12}px;animation-delay:${(i * .31).toFixed(2)}s"/>`).join('')}</g>`
      + `<g class="dig-dirt">${[0, 1, 2, 3].map(i => `<rect x="${-26 - i * 14}" y="${ROOF + 12}" width="${2 + (i % 2)}" height="${6 + i * 2}" rx="1" fill="${L.face}" style="animation-delay:${(i * .7).toFixed(2)}s"/>`).join('')}</g>`
      + `<g class="dig-pebbles">${[0, 1, 2].map(i => `<circle cx="${-6 - i * 9}" cy="${ROOF + 30 + i * 30}" r="${2.5 - i * .4}" fill="${L.rock}" ${S2} style="animation-delay:${(i * .6).toFixed(2)}s"/>`).join('')}</g></g>`;
    return `<svg class="dig-front-svg" width="${FW}" height="${H}" viewBox="${-FX} 0 ${FW} ${H}" aria-hidden="true">${o}</svg>`;
  }

  /** The mine cart shuttles between the lift and the face: rolls up empty, is loaded (the rubble pile
   *  shrinks), rolls back full and tips its load at the lift. Timed from the dig's pace. */
  let cartAnim = null, cartKey = '';
  function runCart(site, fx, pace, on) {
    const cart = site.querySelector('.dig-cart'), load = site.querySelector('.dig-cart-load'), pile = site.querySelector('.dig-front .dig-pile');
    if (!cart || !cart.animate) return;
    const dist = Math.max(0, fx - 150 - lay.cartX), key = on ? Math.round(dist / 40) + ':' + pace.toFixed(1) : 'off';
    if (key === cartKey && cartAnim && cartAnim.playState === 'running') return;
    cartKey = key; if (cartAnim) cartAnim.cancel(); cartAnim = null;
    if (!on || dist < 40 || document.body.classList.contains('no-anim')) { if (load) load.style.opacity = on ? '1' : '0'; return; }
    const ms = Math.round(Math.max(6, Math.min(18, (8 + dist / 60) / pace)) * 1000);
    cartAnim = cart.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${dist}px)`, offset: .4 }, { transform: `translateX(${dist}px)`, offset: .55 }, { transform: 'translateX(0)', offset: .92 }, { transform: 'translateX(0)' }],
      { duration: ms, easing: 'ease-in-out' });
    if (load) load.animate([{ opacity: 0 }, { opacity: 0, offset: .47 }, { opacity: 1, offset: .53 }, { opacity: 1, offset: .93 }, { opacity: 0, offset: .97 }, { opacity: 0 }], { duration: ms });
    if (pile) pile.animate([{ transform: 'scale(1, 1)' }, { transform: 'scale(1, 1.15)', offset: .45 }, { transform: 'scale(.95, .55)', offset: .55 }, { transform: 'scale(1, 1)' }], { duration: ms });
    cartAnim.onfinish = () => { cartAnim = null; cartKey = ''; };
  }

  /** Rebuild the art when something visible changed; move the face every call; refresh the info panel. */
  function update(s, now) {
    const site = document.getElementById('dig-site'); if (!site) return;
    const W = site.clientWidth || 1200;
    const d = DE.Excavation.nextDepth(s), crew = DE.Excavation.miners(s).length, digging = !!s.excavation;
    const Lr = DE.Excavation.layer(d), layer = Lr.id, L = LOOK[layer] || LOOK.topsoil;
    const fx = faceAt(s, W), machineOn = fx > 330;
    lay = { faceX: fx, cartX: 112, depth: d, active: digging, W };
    const sg = [d, digging ? 1 : 0, crew ? 1 : 0, W, layer, machineOn ? 1 : 0].join(':');
    const artEl = document.getElementById('dig-art');
    if (artEl && (sg !== sig || !artEl.firstChild)) {
      sig = sg; cartKey = ''; if (cartAnim) { cartAnim.cancel(); cartAnim = null; }
      artEl.innerHTML = `<div class="dig-reveal" style="width:${fx}px">${tunnel(L, d, W)}</div>`
        + `<div class="dig-cart" style="left:${lay.cartX - 22}px;top:${G - 40}px">${img2('f3_minecart', 44, 40)}<div class="dig-cart-load">${rockHtml(L)}</div></div>`
        + `<div class="dig-front" style="left:${-FX}px;transform:translateX(${fx}px)">${front(L, layer, d, digging, machineOn)}</div>`;
      void artEl.offsetWidth; artEl.classList.add('smooth');
    } else if (artEl) {
      const rv = artEl.querySelector('.dig-reveal'), fr = artEl.querySelector('.dig-front');
      if (rv && rv.style.width !== fx + 'px') rv.style.width = fx + 'px';
      const tf = `translateX(${fx}px)`; if (fr && fr.style.transform !== tf) fr.style.transform = tf;
    }
    const pace = Math.max(.3, DE.Excavation.speed(s));
    if (artEl) artEl.style.setProperty('--pace', (1 / Math.min(2.5, Math.max(.6, pace))).toFixed(2));
    site.classList.toggle('active', digging); site.classList.toggle('crewed', crew > 0);
    runCart(site, fx, pace, digging || crew > 0);
    hud(s, now);
  }
  /** A sprite as an <img> (the cart rides in HTML so it can be animated smoothly). */
  function img2(sp, w, h) { return `<img src="assets/sprites/${sp}.png" alt="" draggable="false" style="width:${w}px;height:${h}px;object-fit:contain">`; }
  function rockHtml(L) { return `<svg width="40" height="22" viewBox="-20 -22 40 22" aria-hidden="true">${rock(-6, 0, 8, L.rock, true)}${rock(7, 0, 7, L.face, true)}${rock(0, -6, 6, L.rock, true)}</svg>`; }
  function hud(s) {
    const el = document.getElementById('dig-zone'); if (!el) return;
    const U = DE.Util, d = DE.Excavation.nextDepth(s), L = DE.Excavation.layer(d), crew = DE.Excavation.miners(s), sp = DE.Excavation.speed(s);
    const ic = (k) => DE.Icons.img(k, 'ico-inline');
    let h;
    if (s.excavation) {
      const p = DE.Excavation.progress(s);
      h = `<b>${ic('dig')} B${s.excavation.depth} · ${U.escapeHtml(L.name)}</b><div class="dig-prog"><i style="width:${(100 * p).toFixed(1)}%"></i></div><span>${Math.floor(100 * p)}% · ${U.fmtTime(DE.Excavation.remaining(s))} left</span><span class="dh-crew">${crew.length ? crew.length + ' miner' + (crew.length > 1 ? 's' : '') + ' · ×' + sp.toFixed(1) + ' pace' : '<i class="neg">No miners — very slow</i>'}</span>`;
    } else {
      const c = DE.Excavation.canStart(s), miss = DE.Excavation.requirements(s, d).filter(r => !r.ok);
      const q = (s._rates && s._rates.quarry) || {}; const qs = Object.keys(q).filter(r => q[r] > 0).map(r => '+' + U.fmt(q[r], 2) + DE.Icons.res(r, 'ico-inline') + '/s').join(' ');
      h = `<b>${ic('dig')} Next: B${d} · ${U.escapeHtml(L.name)}</b>` + (miss.length ? `<span class="neg">Needs ${miss.map(r => U.escapeHtml(r.text)).join(' + ')}</span>` : `<span>${U.costText(DE.Excavation.cost(s, d))}</span><span>≈ ${U.fmtTime(DE.Excavation.time(s, d))} with ${crew.length || 'no'} miner${crew.length === 1 ? '' : 's'}</span>`)
        + (qs ? `<span class="dh-crew">Quarrying ${qs}</span>` : '') + (c.ok ? `<span class="dh-go">Tap to start digging</span>` : '');
    }
    if (el.innerHTML !== h) el.innerHTML = h;
  }
  function layout() { return lay; }
  function relayout() { sig = ''; }

  /** A little mining scene for a floor wing that is being dug out sideways. */
  function wingScene(depth) {
    const L = LOOK[DE.Data.stratumAt(depth).id] || LOOK.topsoil;
    return `<span class="wing-mine"><svg viewBox="0 0 100 120" aria-hidden="true"><path d="M0 18 L60 14 L74 30 L66 58 L80 84 L70 120 L0 120 Z" fill="${L.cave}" ${S3}/>${rock(28, 118, 9, L.rock, true)}${rock(46, 119, 7, L.face, true)}<g class="dig-dust"><circle cx="66" cy="60" r="10" fill="${L.hi}"/><circle cx="70" cy="90" r="8" fill="${L.hi}" style="animation-delay:.6s"/></g></svg>${DE.Chars.crew('mechanic', { anim: 'dig', h: 46 })}</span>`;
  }

  return { update, layout, relayout, wingScene, LOOK };
})();
