/* Geology: the underground cutaway behind the floors, painted as ONE continuous SVG that spans
 * the whole bunker width and depth, instead of a separate tiled background per floor (which left
 * gaps, cut textures off at floor edges and stopped wherever a floor's grid ended).
 *
 * Layers come from DE.Data.STRATA (topsoil → clay → limestone → granite → basalt → magma rock). Each layer
 * band starts at the first floor in it, has a wavy hand-drawn boundary, its own seamless texture
 * (every shape sits fully inside its pattern tile, so nothing is clipped at tile seams) and gets
 * darker and more rugged with depth. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Geology = (function () {
  const INK = '#1c1020';
  let sig = '';
  const LOOK = {
    topsoil: { top: '#74503a', bot: '#5e3f2c', line: '#3b2418' },
    clay: { top: '#7a4a32', bot: '#5e3624', line: '#33190f' },
    limestone: { top: '#8c8676', bot: '#6f6a5c', line: '#3e3a32' },
    granite: { top: '#5d5f6a', bot: '#474853', line: '#23232c' },
    basalt: { top: '#34303f', bot: '#211e2a', line: '#0e0b14' },
    magma: { top: '#3e2020', bot: '#2a1414', line: '#120808' },
  };

  /* deterministic pseudo-random so the ground does not change between renders */
  function rng(seed) { return () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }; }
  const f0 = (n) => n.toFixed(0);
  /* texture builders: every shape sits fully inside its 240x160 tile, so nothing is cut at seams */
  function clods(r, a, b, line, n) {   // lumpy clods (clay)
    let t = ''; for (let i = 0; i < n; i++) { const x = 22 + r() * 196, y = 18 + r() * 124, w = 10 + r() * 14; t += `<path d="M${f0(x - w)} ${f0(y)} q${f0(w * .4)} ${f0(-w * .8)} ${f0(w)} ${f0(-w * .5)} q${f0(w * .8)} ${f0(w * .1)} ${f0(w)} ${f0(w * .6)} q${f0(-w * .5)} ${f0(w * .6)} ${f0(-w * 1.2)} ${f0(w * .4)} z" fill="${r() < .5 ? a : b}" stroke="${line}" stroke-width="2.5"/>`; }
    return t;
  }
  function blocks(r, a, b, line, hi) {  // interlocking angular blocks with highlights (limestone, granite)
    let t = ''; for (let i = 0; i < 7; i++) { const x = 26 + (i % 4) * 58 + r() * 10, y = 26 + Math.floor(i / 4) * 70 + r() * 16, w = 18 + r() * 8, h = 14 + r() * 8;
      t += `<path d="M${f0(x - w)} ${f0(y + h * .2)} L${f0(x - w * .5)} ${f0(y - h)} L${f0(x + w * .6)} ${f0(y - h * .8)} L${f0(x + w)} ${f0(y + h * .3)} L${f0(x + w * .2)} ${f0(y + h)} L${f0(x - w * .7)} ${f0(y + h * .8)} Z" fill="${r() < .5 ? a : b}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/><path d="M${f0(x - w * .45)} ${f0(y - h * .7)} L${f0(x + w * .45)} ${f0(y - h * .6)}" stroke="${hi}" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`; }
    return t + `<path d="M8 150 l14 -10 l6 6 l16 -12" fill="none" stroke="${line}" stroke-width="2"/><path d="M150 152 l10 -14 l12 4" fill="none" stroke="${line}" stroke-width="2"/>`;
  }
  function shards(r, a, b, line, hi) { // big dark shards and fissures (basalt, magma rock)
    let t = ''; for (let i = 0; i < 5; i++) { const x = 34 + (i % 3) * 80 + r() * 12, y = 40 + Math.floor(i / 3) * 80 + r() * 10, w = 26 + r() * 10, h = 22 + r() * 8;
      t += `<path d="M${f0(x - w)} ${f0(y + h * .4)} L${f0(x - w * .3)} ${f0(y - h)} L${f0(x + w)} ${f0(y - h * .3)} L${f0(x + w * .5)} ${f0(y + h)} Z" fill="${r() < .5 ? a : b}" stroke="${line}" stroke-width="3.5" stroke-linejoin="round"/><path d="M${f0(x - w * .3)} ${f0(y - h * .8)} L${f0(x + w * .7)} ${f0(y - h * .3)}" stroke="${hi}" stroke-width="2.5" stroke-linecap="round"/>`; }
    return t + `<path d="M120 4 l-6 22 l10 14 l-8 26" fill="none" stroke="${line}" stroke-width="2.5"/>`;
  }
  function patterns() {
    const r = rng(11); let s = '';
    const pat = (id, body) => `<pattern id="geo-${id}" width="240" height="160" patternUnits="userSpaceOnUse">${body}</pattern>`;
    // topsoil: rounded pebbles and lighter specks
    let t = ''; for (let i = 0; i < 9; i++) { const x = 18 + r() * 204, y = 14 + r() * 132, rx = 6 + r() * 12; t += `<ellipse cx="${f0(x)}" cy="${f0(y)}" rx="${f0(rx)}" ry="${f0(rx * .65)}" fill="${r() < .5 ? '#86603f' : '#6b4a32'}" stroke="#3b2418" stroke-width="2.5"/>`; }
    for (let i = 0; i < 14; i++) t += `<circle cx="${f0(6 + r() * 228)}" cy="${f0(6 + r() * 148)}" r="${(1.5 + r() * 2).toFixed(1)}" fill="#a07a52" opacity=".6"/>`;
    s += pat('topsoil', t);
    // roots hang only from the top of the topsoil band
    s += `<pattern id="geo-roots" width="300" height="120" patternUnits="userSpaceOnUse"><g fill="none" stroke="#2e1c12" stroke-width="3" stroke-linecap="round"><path d="M40 0 q-6 30 6 52 q8 18 -4 40"/><path d="M46 52 q14 6 22 22"/><path d="M180 0 q10 26 -2 48 q-6 14 4 30"/><path d="M178 48 q-14 8 -18 22"/><path d="M262 0 q-4 18 8 30"/></g><g fill="none" stroke="#7a5236" stroke-width="1.2" stroke-linecap="round" opacity=".7"><path d="M40 0 q-6 30 6 52 q8 18 -4 40"/><path d="M180 0 q10 26 -2 48 q-6 14 4 30"/></g></pattern>`;
    // packed clay: heavy clods and wet streaks
    t = clods(r, '#8e5a3c', '#734530', '#33190f', 9); for (let i = 0; i < 4; i++) { const y = 20 + r() * 120; t += `<path d="M${f0(10 + r() * 60)} ${f0(y)} q40 -8 ${f0(60 + r() * 60)} 4" fill="none" stroke="#9a6a48" stroke-width="2" opacity=".6"/>`; }
    s += pat('clay', t);
    // limestone: pale blocks, and the odd fossil shell
    t = blocks(r, '#b3ad9c', '#9c9686', '#4e4a40', '#e4dfcf') + `<g fill="none" stroke="#4e4a40" stroke-width="2"><path d="M200 130 a6 6 0 1 1 -6 -6 a10 10 0 1 1 10 10"/><path d="M40 30 a4 4 0 1 1 -4 -4 a7 7 0 1 1 7 7"/></g>`;
    s += pat('limestone', t);
    // granite: grey blocks with dark and pink speckles
    t = blocks(r, '#6c6e7a', '#555763', '#23232c', '#9a9caa'); for (let i = 0; i < 18; i++) t += `<circle cx="${f0(6 + r() * 228)}" cy="${f0(6 + r() * 148)}" r="${(1.2 + r() * 1.6).toFixed(1)}" fill="${r() < .5 ? '#2a2a32' : '#b48a8a'}" opacity=".75"/>`;
    s += pat('granite', t);
    // basalt: dark shards with crystal geodes
    t = shards(r, '#3c384a', '#2e2b3a', '#0e0b14', '#5a566c') + `<g stroke="${INK}" stroke-width="2" stroke-linejoin="round"><path d="M200 132 l6 -16 l6 16 l-6 6 z" fill="#9b6ad6"/><path d="M212 136 l4 -10 l4 10 l-4 4 z" fill="#c9a0ff"/><path d="M30 146 l5 -12 l5 12 l-5 5 z" fill="#5ad6c9"/></g>`;
    s += pat('basalt', t);
    // magma rock: dark red shards with glowing veins
    t = shards(r, '#4a2622', '#3a1c1a', '#120808', '#6a3a30') + `<g fill="none" stroke-linecap="round"><path d="M10 120 q30 -12 60 2 q24 10 50 -6" stroke="#ff7a2a" stroke-width="3" opacity=".85"/><path d="M140 40 q20 10 40 -2 q20 -10 50 4" stroke="#ffb02a" stroke-width="2.5" opacity=".7"/></g>`;
    s += pat('magma', t);
    return s;
  }
  /** Wavy band edge at height y across width w (deterministic per seed). */
  function edge(y, w, seed) { const r = rng(seed); let d = `M0 ${y}`; for (let x = 0; x < w; x += 60) d += ` q30 ${(r() * 16 - 8).toFixed(1)} 60 ${(r() * 8 - 4).toFixed(1)}`; return d; }

  function render() {
    const bunker = document.getElementById('bunker'), floors = document.getElementById('floors'); if (!bunker || !floors) return;
    const fls = Array.from(floors.children).filter(f => f.classList.contains('floor'));
    if (!fls.length) return;
    const top = floors.offsetTop, w = Math.max(bunker.scrollWidth, bunker.clientWidth), h = Math.max(bunker.scrollHeight - top, floors.offsetHeight);
    // the first floor of each layer marks where that layer begins
    const bands = []; let prev = null;
    fls.forEach((f, i) => {
      const depth = f.dataset.depth ? +f.dataset.depth : i + 1;
      const layer = DE.Data.stratumAt(depth).id;
      if (layer !== prev) { bands.push({ layer, name: DE.Data.stratumAt(depth).name, y: f.offsetTop - (f.offsetParent === floors ? 0 : top) }); prev = layer; }
    });
    const s2 = w + 'x' + h + ':' + bands.map(b => b.layer + b.y).join(',');
    let el = document.getElementById('geology');
    if (el && el.parentElement === bunker && s2 === sig) return;
    sig = s2;
    if (!el) { el = document.createElement('div'); el.id = 'geology'; }
    if (el.parentElement !== bunker) bunker.insertBefore(el, bunker.firstChild);
    el.style.top = top + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px';
    let body = '';
    bands.forEach((b, i) => {
      const y0 = i === 0 ? 0 : b.y, y1 = i + 1 < bands.length ? bands[i + 1].y : h, L = LOOK[b.layer];
      const ed = i === 0 ? `M0 0 H${w}` : edge(y0, w, 7 + i * 13); if (!L) return;
      const shape = `${ed} V${y1 + 20} H0 Z`;
      body += `<path d="${shape}" fill="url(#geo-g-${b.layer})"/><path d="${shape}" fill="url(#geo-${b.layer})"/>`;
      if (b.layer === 'topsoil') body += `<rect x="0" y="${y0}" width="${w}" height="120" fill="url(#geo-roots)" opacity=".85"/>`;
      if (i > 0) body += `<path d="${ed}" fill="none" stroke="${INK}" stroke-width="6"/><path d="${ed}" fill="none" stroke="${LOOK[bands[i].layer].top}" stroke-width="2" transform="translate(0 5)" opacity=".8"/>`;

    });
    const grads = Object.keys(LOOK).map(k => `<linearGradient id="geo-g-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LOOK[k].top}"/><stop offset="1" stop-color="${LOOK[k].bot}"/></linearGradient>`).join('');
    el.innerHTML = `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs>${grads}${patterns()}<linearGradient id="geo-depth" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></linearGradient></defs>${body}<rect width="${w}" height="${h}" fill="url(#geo-depth)"/></svg>`;
  }
  function relayout() { sig = ''; }
  return { render, relayout };
})();
