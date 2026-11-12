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

  function machine(L, layer, fx) {
    // machines stand back from the face so the crew works under the boom
    const x = fx - (layer === 'topsoil' || layer === 'clay' ? 96 : 168), y = G;
    switch (layer) {
      case 'limestone':   // compressor with a hose to the face
        return img('gascylinders', x, y, 46) + `<path d="M${x + 12} ${y - 30} q40 30 ${fx - x - 46} 6" fill="none" stroke="${INK}" stroke-width="5"/><path d="M${x + 12} ${y - 30} q40 30 ${fx - x - 46} 6" fill="none" stroke="#c93a3a" stroke-width="2.5"/>`;
      case 'granite': case 'basalt': {   // tracked drill rig, boom reaching the face
        const big = layer === 'basalt', c = big ? '#c9a24a' : '#f0a020', bx = fx - 30;
        return `<g class="dig-rig"><rect x="${x - 44}" y="${y - 22}" width="84" height="22" rx="11" fill="#3a3845" ${S3}/>${[0, 1, 2, 3].map(i => `<circle cx="${x - 32 + i * 20}" cy="${y - 11}" r="7" fill="#5a5866" ${S2}/>`).join('')}
          <rect x="${x - 36}" y="${y - 58}" width="40" height="38" rx="5" fill="${c}" ${S3}/><rect x="${x - 30}" y="${y - 54}" width="18" height="16" rx="2" fill="#9fe3ff" ${S2}/><rect x="${x + 2}" y="${y - 48}" width="30" height="26" rx="3" fill="${c}" ${S3}/>
          <path d="M${x + 16} ${y - 44} L${bx - 26} ${y - (big ? 104 : 92)}" stroke="${INK}" stroke-width="${big ? 16 : 13}" stroke-linecap="round"/><path d="M${x + 16} ${y - 44} L${bx - 26} ${y - (big ? 104 : 92)}" stroke="${c}" stroke-width="${big ? 10 : 7}" stroke-linecap="round"/>
          <g class="dig-bit"><path d="M${bx - 30} ${y - (big ? 116 : 102)} h22 l${big ? 18 : 14} ${big ? 12 : 10} l${big ? -18 : -14} ${big ? 12 : 10} h-22 z" fill="#8a8e98" ${S3}/><path d="M${bx - 22} ${y - (big ? 112 : 99)} l6 16 M${bx - 14} ${y - (big ? 112 : 99)} l6 16" ${S2} fill="none"/></g>
          ${big ? `<g class="dig-sparks"><circle cx="${bx - 4}" cy="${y - 98}" r="2.5" fill="#ffd34a"/><circle cx="${bx - 10}" cy="${y - 112}" r="2" fill="#fff4a8"/><circle cx="${bx - 6}" cy="${y - 88}" r="1.8" fill="#ffd34a"/></g>` : ''}</g>`;
      }
      case 'magma': {     // thermal borer: a heavy cylinder whose cone glows white-hot
        const bx = fx - 6;
        return `<g class="dig-rig"><rect x="${x - 50}" y="${y - 24}" width="96" height="24" rx="12" fill="#3a3845" ${S3}/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${x - 38 + i * 20}" cy="${y - 12}" r="7" fill="#5a5866" ${S2}/>`).join('')}
          <rect x="${x - 40}" y="${y - 96}" width="${bx - x + 14}" height="66" rx="14" fill="#8a8e98" ${S3}/><path d="M${x - 30} ${y - 82} h${bx - x - 20} M${x - 30} ${y - 46} h${bx - x - 20}" ${S2}/>
          <g class="dig-heat"><path d="M${bx - 26} ${y - 100} l30 37 l-30 37 z" fill="${L.glow}" ${S3}/><path d="M${bx - 22} ${y - 86} l16 23 l-16 23 z" fill="#fff1a8" stroke="none"/></g></g>`;
      }
      default:            // topsoil / clay: hand tools, a wheelbarrow and a bucket
        return img('shovel', x - 10, y, 34) + img('spade', x + 20, y, 30, true) + `<g transform="translate(${x + 54} ${y})"><path d="M-18 -26 h36 l-6 16 h-24 z" fill="#5a6f3a" ${S3}/><circle cx="12" cy="-6" r="6" fill="#3a3845" ${S2}/><path d="M-18 -24 l-12 -6" ${S3}/>${rock(-4, -26, 7, L.rock, true)}${rock(8, -27, 6, L.rock, true)}</g>`;
    }
  }

  function art(s, W) {
    const d = DE.Excavation.nextDepth(s), Lr = DE.Excavation.layer(d), layer = Lr.id, L = LOOK[layer] || LOOK.topsoil;
    const active = !!s.excavation, crew = DE.Excavation.miners(s).length, fx = faceAt(s, W), r = rng(d * 31 + 7);
    lay = { faceX: fx, cartX: 112, depth: d, active, W };
    // the carved tunnel: rough roof, jagged face, flat floor
    let roof = `M0 ${ROOF}`; for (let x = 30; x < fx - 10; x += 30) roof += ` L${x} ${ROOF + 4 + r() * 10}`;
    let face = ''; for (let y = ROOF + 6; y < G; y += 22) face += ` L${(fx + (r() * 14 - 7)).toFixed(0)} ${y}`;
    const cave = `${roof} L${fx - 6} ${ROOF + 8}${face} L${fx} ${G} L0 ${G} Z`;
    let o = `<defs><linearGradient id="dg-cave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${L.cave}"/><stop offset="1" stop-color="${L.wall}"/></linearGradient><clipPath id="dg-clip"><path d="${cave}"/></clipPath>
      <radialGradient id="dg-glow"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient></defs>`;
    o += `<path d="${cave}" fill="url(#dg-cave)"/>`;
    // back-wall texture: rock seams inside the tunnel
    let tex = ''; for (let i = 0; i < Math.max(3, fx / 60); i++) { const x = 20 + r() * (fx - 40), y = ROOF + 30 + r() * (G - ROOF - 70); tex += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} l${(10 + r() * 20).toFixed(0)} ${(r() * 8 - 4).toFixed(0)} l${(8 + r() * 14).toFixed(0)} ${(6 + r() * 6).toFixed(0)}" fill="none" stroke="#000" stroke-width="2.5" opacity=".28"/>`; if (L.gem && r() < .5) tex += `<path d="M${x.toFixed(0)} ${(y + 18).toFixed(0)} l4 -10 l4 10 l-4 4 z" fill="${L.gem}" ${S2}/>`; if (L.glow && r() < .5) tex += `<path d="M${x.toFixed(0)} ${(y + 10).toFixed(0)} q12 -6 24 2 q10 6 22 -2" fill="none" stroke="${L.glow}" stroke-width="2.5" opacity=".8" class="dig-ember"/>`; }
    o += `<g clip-path="url(#dg-clip)">${tex}<rect x="0" y="${G - 40}" width="${fx}" height="40" fill="#000" opacity=".22"/></g>`;
    // timber frames: posts, a header beam, braces
    for (let x = 64; x < fx - 40; x += 112) o += `<rect x="${x}" y="${ROOF + 8}" width="11" height="${G - ROOF - 8}" fill="#8a5a32" ${S3}/><rect x="${x - 10}" y="${ROOF + 4}" width="${Math.min(112, fx - x - 20) + 20}" height="11" rx="2" fill="#a06a3a" ${S3}/><path d="M${x + 11} ${ROOF + 30} l18 -15" ${S3} stroke-width="5" fill="none"/><path d="M${x + 11} ${ROOF + 30} l18 -15" stroke="#8a5a32" stroke-width="2.5" fill="none"/>`;
    // the lamp cable along the roof, a bulb every frame
    if (fx > 90) { let cable = `M0 ${ROOF + 26}`; const bulbs = []; for (let x = 70; x < fx - 20; x += 112) { cable += ` Q${x - 50} ${ROOF + 40} ${x} ${ROOF + 26}`; bulbs.push(x + 28); } o += `<path d="${cable}" fill="none" stroke="${INK}" stroke-width="2"/>`; bulbs.forEach(x => { o += `<ellipse cx="${x}" cy="${ROOF + 60}" rx="46" ry="40" fill="url(#dg-glow)" class="dig-lamp"/><path d="M${x} ${ROOF + 30} v8" stroke="${INK}" stroke-width="2"/><circle cx="${x}" cy="${ROOF + 42}" r="5" fill="#ffd98a" ${S2}/>`; }); }
    // rails with sleepers, the mine cart by the lift
    o += `<g>${Array.from({ length: Math.max(0, Math.floor((fx - 30) / 16)) }, (_, i) => `<rect x="${8 + i * 16}" y="${G - 1}" width="9" height="5" rx="1" fill="#4a3a2a"/>`).join('')}<path d="M0 ${G - 2} H${Math.max(0, fx - 24)}" stroke="#8a8e98" stroke-width="3"/><path d="M0 ${G - 2} H${Math.max(0, fx - 24)}" stroke="${INK}" stroke-width="1" opacity=".5"/></g>`;
    o += img('f3_minecart', lay.cartX, G + 1, 40) + (crew ? rock(lay.cartX - 8, G - 26, 8, L.rock, true) + rock(lay.cartX + 6, G - 27, 7, L.rock, true) : '');
    // tools against the wall near the lift
    if (fx > 300) o += img('pickaxe', 200, G - 2, 30) + img('lantern', 236, G - 2, 22);
    // rubble at the face, a little more the further the crew has dug
    for (let i = 0; i < 6; i++) o += rock(fx - 18 - i * 15 - r() * 8, G - (i % 2) * 2, 6 + r() * 6, i % 2 ? L.rock : L.face, true);
    if (active && fx > 330) o += machine(L, layer, fx);
    // the rock face itself: an outlined jagged edge with fresh chips
    o += `<path d="M${fx - 6} ${ROOF + 8}${face} L${fx} ${G}" fill="none" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/><path d="M${fx - 8} ${ROOF + 10}${face.replace(/L(\d+) /g, (m, x) => 'L' + (+x - 4) + ' ')} L${fx - 4} ${G}" fill="none" stroke="${L.hi}" stroke-width="2" opacity=".7"/>`;
    o += `<path d="${roof}" fill="none" stroke="${INK}" stroke-width="4"/><path d="M0 ${G} H${fx}" stroke="${INK}" stroke-width="3"/>`;
    // dust and falling pebbles while the crew is working
    if (crew) o += `<g class="dig-dust">${[0, 1, 2, 3].map(i => `<circle cx="${fx - 14 - i * 6}" cy="${G - 40 - i * 34}" r="${10 + i * 3}" fill="${L.hi}" style="animation-delay:${(i * .45).toFixed(2)}s"/>`).join('')}</g><g class="dig-pebbles">${[0, 1, 2].map(i => `<circle cx="${fx - 6 - i * 9}" cy="${ROOF + 30 + i * 30}" r="${2.5 - i * .4}" fill="${L.rock}" ${S2} style="animation-delay:${(i * .6).toFixed(2)}s"/>`).join('')}</g>`;
    return `<svg class="dig-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${o}</svg>`;
  }

  /** Rebuild the art when something visible changed; refresh the info panel every call. */
  function update(s, now) {
    const site = document.getElementById('dig-site'); if (!site) return;
    const W = site.clientWidth || 1200;
    const d = DE.Excavation.nextDepth(s), crew = DE.Excavation.miners(s).length;
    const sg = [d, s.excavation ? Math.floor(DE.Excavation.progress(s) * 100) : 'q', crew ? 1 : 0, W, DE.Excavation.layer(d).id].join(':');
    const artEl = document.getElementById('dig-art');
    if (sg !== sig || (artEl && !artEl.firstChild)) { sig = sg; if (artEl) artEl.innerHTML = art(s, W); }
    site.classList.toggle('active', !!s.excavation); site.classList.toggle('crewed', crew > 0);
    hud(s, now);
  }
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
