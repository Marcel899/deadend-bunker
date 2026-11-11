/* Recruit reveal: recruiting is always random — the simulation has already picked the profession,
 * rarity and traits (DE.Survivors.recruit); this plays the reveal. Silhouettes of every profession
 * cycle on the radio card, slowing down like a slot reel, then the real survivor flashes into
 * colour with a rarity-coloured burst, followed by their name, rarity, traits and strengths. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Reveal = (function () {
  const esc = (s) => DE.Util.escapeHtml(s);
  let timer = 0;

  function bestRooms(prof) {
    return Object.values(DE.Data.ROOMS).filter(r => r.profession === prof).slice(0, 3).map(r => r.name);
  }
  function show(sv) {
    const P = DE.Data.PROFESSIONS[sv.profession], rar = DE.Data.RARITIES[sv.rarity] || DE.Data.RARITIES.common;
    const big = sv.rarity === 'rare' || sv.rarity === 'legendary';
    const traits = (sv.traits || []).map(t => { const d = DE.Data.TRAITS[t]; return d ? `<li><b>${esc(d.name)}</b><small>${esc(d.desc)}</small></li>` : ''; }).join('') || '<li class="none"><small>No special traits.</small></li>';
    const rooms = bestRooms(sv.profession);
    DE.UI.modal({ title: '', cls: 'reveal', locked: true, buttons: [],
      html: `<div class="rv" style="--rc:${rar.color}">
        <div class="rv-head"><span class="rv-signal"><i></i><i></i><i></i></span><b>A survivor answers the radio…</b></div>
        <div class="rv-stage"><div class="rv-rays"></div><div class="rv-card"><div class="rv-fig"></div></div><div class="rv-rarity">${esc(rar.name)}</div></div>
        <div class="rv-info">
          <h3>${esc(sv.name)}</h3>
          <p class="rv-prof">${DE.Icons.prof(sv.profession, 'ico-inline')} <b>${esc(P.name)}</b> · <span style="color:${rar.color}">${esc(rar.name)}</span>${rar.bonus ? ` · +${Math.round(rar.bonus * 100)}% efficiency` : ''}</p>
          <p class="rv-desc">${esc(P.desc || '')}</p>
          ${rooms.length ? `<p class="rv-best"><small>Works best in</small> ${rooms.map(n => `<span class="pill">${esc(n)}</span>`).join(' ')}</p>` : ''}
          <ul class="rv-traits">${traits}</ul>
          <div class="btn-row"><button class="btn primary" data-action="revealAssign" data-sid="${sv.id}">Assign now</button><button class="btn" data-action="closeModal">Welcome aboard</button></div>
        </div></div>` });
    const root = document.querySelector('#modal-root .rv'); if (!root) return;
    const fig = root.querySelector('.rv-fig');
    const pool = DE.Data.PROFESSION_ORDER.filter(p => p !== sv.profession);
    // slot-reel: ~16 silhouettes, each shown a little longer than the last
    let i = 0, delay = 45; const steps = 14;
    const spin = () => {
      if (!root.isConnected) return;
      if (i < steps) {
        const p = pool[(i * 3 + 1) % pool.length];
        fig.innerHTML = DE.Chars.crew(p, { anim: 'idle', h: 170 }); fig.className = 'rv-fig sil';
        DE.Audio.sfx('tick', 20); i++; delay *= 1.13; timer = setTimeout(spin, delay); return;
      }
      fig.innerHTML = DE.Chars.crew(sv.profession, { anim: 'interact', h: 170 }); fig.className = 'rv-fig sil';
      timer = setTimeout(() => { if (!root.isConnected) return; fig.className = 'rv-fig lit'; root.classList.add('done', big ? 'big' : 'small'); DE.Audio.sfx(big ? 'upgrade' : 'reveal'); }, 260);
    };
    clearTimeout(timer); spin();
  }
  return { show };
})();
