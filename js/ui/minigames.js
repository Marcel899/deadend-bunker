/* Room minigames (rules and rewards: js/core/minigames.js, gear: js/core/gear.js).
 * One overlay: an intro card (what it is, difficulty, staff bonus, what it pays), the game, then the
 * results (stars, score, rewards counting up, mastery). Every game works with mouse, touch and keys.
 *   forge   heat with the bellows, hammer on the beat, quench at cherry red → item quality
 *   grid    rotate cables to power every consumer; repair broken runs, flip the switches
 *   radio   tune the frequency and gain until the signal locks; drift and interference
 *   sort    drag (or tap, then tap a bin) supplies off the belt into the right bins; hazards apart
 *   triage  examine patients, give the right treatment, most urgent first, supplies are limited
 *   range   shoot the dead as they come over the sandbags, spare the civilians, reload in time
 * Plus the Armory: hand the forge's weapons and armour to the guards. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.MG = (function () {
  const esc = (s) => DE.Util.escapeHtml(String(s));
  const S = () => DE.Game.state;
  const ic = (k, c) => DE.Icons.img(k, c || 'ico-inline');
  /** A cut-out sprite from the minigame sheets (assets/mg, made by tools/cut_mg.py). */
  const SP = (n, c) => `<img class="sp ${c || ''}" src="assets/mg/${n}.png" alt="" draggable="false">`;
  const preloaded = new Set();
  function preload(names) { names.forEach(n => { if (preloaded.has(n)) return; preloaded.add(n); const im = new Image(); im.src = 'assets/mg/' + n + '.png'; }); }
  const ART = { grid: ['p_core', 'p_lamp', 'p_sw_on', 'p_spark'], radio: ['radio_set', 'mic', 'dish'], sort: ['crate_open', 'can_tomato', 'rad_barrel', 'bullets'],
    triage: ['medkit', 'syringe', 'pills', 'bandage'], range: ['crosshair', 'pistol', 'bullets'] };
  const USES = { grid: ['p_core', 'p_lamp', 'p_sw_off', 'p_sw_on', 'p_spark', 'p_broken', 'p_straight', 'p_half', 'p_elbow', 'p_hub', 'p_ok'], radio: ['knob', 'led_green', 'led_yellow', 'led_red', 'led_off', 'tower_ok', 'tower_lost', 'lock', 'static', 'dish', 'antenna'],
    sort: ['bin_green', 'bin_blue', 'crate_open', 'crate_hazard', 'box_grey', 'crate_mil', 'drum', 'box_blue'], triage: ['face0', 'face1', 'face2', 'face3', 'bandage', 'gauze', 'bottle', 'syringe', 'pills', 'ok', 'no', 'ico_heart', 'stethoscope'],
    range: ['cartridge', 'ico_heart', 'bullets', 'burst', 'crate', 'crate2', 'crate_mil'], common: ['star_gold', 'star_grey', 'trophy', 'ok', 'no', 'stopwatch'] };
  let root = null, shellFx = [], gameFx = [], current = null;
  const snd = (n, gap) => { try { DE.Audio.mg(n, gap); } catch (e) { /* no audio */ } };
  const note = (f, d, type, vol, glide) => { try { DE.Audio.mgTone(f, d, type, vol, glide); } catch (e) { /* no audio */ } };
  function later(fn, ms) { const id = setTimeout(() => { if (root) fn(); }, ms); gameFx.push(() => clearTimeout(id)); return id; }
  function loop(fn) { let id = 0, last = 0; const f = (t) => { const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t; if (!root) return; if (fn(dt, t) !== false) id = requestAnimationFrame(f); }; id = requestAnimationFrame(f); gameFx.push(() => cancelAnimationFrame(id)); }
  function on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); gameFx.push(() => el.removeEventListener(ev, fn, opt)); }
  function stopGame() { gameFx.forEach(f => { try { f(); } catch (e) { /* gone */ } }); gameFx = []; }
  const rnd = (a, b) => a + Math.random() * (b - a), irnd = (a, b) => Math.floor(rnd(a, b + 1)), pick = (a) => a[Math.floor(Math.random() * a.length)];

  /* ---------- the overlay ---------- */
  function shell(title, icon, sub) {
    close(true);
    root = document.createElement('div'); root.id = 'mg-root';
    root.innerHTML = `<div class="mg-back"></div><div class="mg-panel" role="dialog"><div class="mg-head"><span class="mg-ico">${icon}</span><div class="mg-titles"><b>${esc(title)}</b><small>${sub}</small></div><button class="mg-x" type="button" aria-label="Close">${SP('no')}</button></div><div class="mg-body"></div></div>`;
    document.body.appendChild(root);
    const x = () => close(); root.querySelector('.mg-x').addEventListener('click', x); root.querySelector('.mg-back').addEventListener('click', x);
    const key = (e) => { if (e.key === 'Escape') close(); }; document.addEventListener('keydown', key); shellFx.push(() => document.removeEventListener('keydown', key));
    requestAnimationFrame(() => root && root.classList.add('in'));
    return root.querySelector('.mg-body');
  }
  function close(instant) {
    stopGame(); shellFx.forEach(f => f()); shellFx = [];
    const r = root; root = null; if (!r) return;
    if (instant) r.remove(); else { r.classList.remove('in'); r.classList.add('out'); setTimeout(() => r.remove(), 260); }
    if (DE.Game.afterAction) DE.Game.afterAction();
  }
  const HOW = {
    grid: 'The bunker\'s power runs through these cables. <b>Tap a tile to turn it</b> until current flows from the generator to every <b>lamp</b>. Broken runs (red) need a tap to <b>patch</b> first; <b>switches</b> must be flipped on. Faster is better.',
    radio: 'Somebody is out there. <b>Drag the dial</b> to find the frequency and set the <b>gain</b> until the wave on the scope matches the signal, then <b>hold it</b> until it locks. Signals drift and static bursts come and go.',
    sort: 'The supply belt is moving. <b>Drag each item into its bin</b> — or tap the item, then the bin. <b>Hazards</b> (leaking, toxic) go in the red bin, apart from the rest. Streaks of correct sorts build a combo.',
    triage: 'Patients are coming in. <b>Examine</b> each one to see what is wrong, pick a treatment from the tray and <b>give it</b> to them. The worst cases slip fastest — treat them first. Supplies are limited.',
    range: 'Drill on the range. <b>Tap the dead</b> as they come over the sandbags before they reach you — <b>not the civilians</b> in blue. Six rounds a magazine: <b>reload</b> (tap the button or press R) in time.',
  };
  /* a challenge per run: an optional goal, different each time, worth +25% rewards and extra mastery */
  const CHAL = {
    grid: () => pick([{ id: 'par', text: 'Light every lamp within par moves' }, { id: 'fast', text: 'Finish with half the time left' }]),
    radio: () => pick([{ id: 'fast', text: 'Lock on in the first half of the time' }, { id: 'clean', text: 'Lock on with the signal at 95% or better' }]),
    sort: (T) => pick([{ id: 'clean', text: 'Not one item in the wrong bin' }, { id: 'combo', text: 'Build a ×3 combo' }, { id: 'count', n: 12 + 3 * T, text: 'Sort ' + (12 + 3 * T) + ' items' }]),
    triage: () => pick([{ id: 'nolost', text: 'Nobody slips away' }, { id: 'nowrong', text: 'Not a single wrong treatment' }]),
    range: (T) => pick([{ id: 'nociv', text: 'Don\'t hit a single civilian' }, { id: 'wall', text: 'Nobody gets through' }, { id: 'hits', n: 10 + 2 * T, text: 'Hit ' + (10 + 2 * T) + ' of the dead' }]),
    forge: () => pick([{ id: 'perfect', text: 'Two perfect hammer blows' }, { id: 'cherry', text: 'Quench right at cherry red' }, { id: 'heat', text: 'Keep the metal in the band nearly all the time' }]),
  };
  const PAYS = { grid: 'power now, hotter generators for a while', radio: 'survivors, places mapped, research, blueprint leads, materials', sort: 'supplies into stores — more after an expedition came home', triage: 'heals the bunker\'s injured and infected', range: 'guard training and a fresh-drill damage bonus' };

  function open(g) {
    const s = S(); if (!s) return;
    if (g === 'forge') return forgeMenu();
    const c = DE.Minigames.canPlay(s, g); if (!c.ok) { DE.UI.toast(c.reason, 'err'); DE.Audio.sfx('error'); return; }
    const G = DE.Minigames.GAMES[g], room = c.room, tier = DE.Minigames.tier(s, g, room), skill = DE.Minigames.skill(s, g, room), lv = DE.Minigames.level(s, g), chal = CHAL[g](tier);
    const body = shell(G.name, DE.Icons.room(room.type, 'mg-room'), `${esc(DE.Data.ROOMS[room.type].name)} · <span class="mg-stars-sm">${'★'.repeat(tier)}${'☆'.repeat(4 - tier)}</span> · Mastery ${lv}`);
    preload(USES[g].concat(USES.common));
    body.innerHTML = `<div class="mg-intro"><div class="mg-art">${ART[g].map((n, i) => SP(n, 'a' + i)).join('')}</div><p class="mg-how">${HOW[g]}</p><div class="mg-perks"><span>${ic('star')} Difficulty ${tier}/4</span><span>${ic('pop')} Staff bonus +${Math.round(skill * 100)}%</span><span>${ic('chest')} ${esc(PAYS[g])}</span></div>
      <div class="mg-chal">${SP('trophy')}<span><small>Challenge</small>${esc(chal.text)}</span><b>+25%</b></div>
      <button class="btn primary mg-go" type="button">Start</button></div>`;
    body.querySelector('.mg-go').addEventListener('click', () => { snd('click'); run(g, body, { tier, skill, level: lv, room, chal }); });
  }
  function run(g, body, env) {
    body.innerHTML = `<div class="mg-hud"></div><div class="mg-stage mg-${g}"></div>`;
    env.hud = body.querySelector('.mg-hud'); env.done = (score, ctx) => { current = null; results(g, body, score, ctx || {}, env); }; current = env;
    GAME[g](body.querySelector('.mg-stage'), env);
  }
  function stars(score) { return score >= .85 ? 3 : score >= .55 ? 2 : score >= .25 ? 1 : 0; }
  function results(g, body, score, ctx, env) {
    stopGame();
    const s = S(), out = g === 'forge' ? ctx.out : DE.Minigames.finish(s, g, score, ctx);
    const n = stars(score), nx = DE.Minigames.xpToNext(s, g);
    body.innerHTML = `<div class="mg-res">
      ${n === 3 ? SP('trophy', 'mg-trophy') : ''}<div class="mg-starrow">${[0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}" style="animation-delay:${(.15 + i * .2).toFixed(2)}s">${SP(i < n ? 'star_gold' : 'star_grey')}</i>`).join('')}</div>
      <div class="mg-score"><b data-to="${Math.round(score * 100)}">0</b><small>%</small></div>
      ${ctx.headline ? `<p class="mg-headline">${ctx.headline}</p>` : ''}
      ${env.chal ? `<div class="mg-chalr ${ctx.challenge ? 'ok' : ''}">${SP(ctx.challenge ? 'ok' : 'no')}<span>Challenge: ${esc(env.chal.text)}</span>${ctx.challenge ? '<b>+25%</b>' : ''}</div>` : ''}
      ${ctx.card || ''}
      <div class="mg-rewards">${Object.keys(out.rewards || {}).map((r, i) => `<span class="mg-rw" style="animation-delay:${(.5 + i * .12).toFixed(2)}s">${DE.Icons.res(r, 'ico-inline')} +<b data-to="${out.rewards[r]}">0</b></span>`).join('')}</div>
      <ul class="mg-lines">${(out.lines || []).map((l, i) => `<li style="animation-delay:${(.7 + i * .15).toFixed(2)}s">${esc(l)}</li>`).join('')}</ul>
      ${nx ? `<div class="mg-mast"><span>Mastery ${out.mastery}</span><i><b style="width:${Math.round(100 * nx.have / nx.need)}%"></b></i></div>` : out.mastery ? `<div class="mg-mast"><span>Mastery ${out.mastery} — max</span></div>` : ''}
      <div class="mg-btns">${g === 'forge' ? '<button class="btn mg-again" type="button">Forge another</button>' : ''}<button class="btn primary mg-done" type="button">Done</button></div></div>`;
    body.querySelector('.mg-done').addEventListener('click', () => close());
    const again = body.querySelector('.mg-again'); if (again) again.addEventListener('click', () => forgeMenu());
    // count the numbers up, chime per star
    body.querySelectorAll('[data-to]').forEach(el => { const to = +el.dataset.to, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1 && el.isConnected) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    for (let i = 0; i < n; i++) setTimeout(() => note(660 * Math.pow(1.26, i), .25, 'triangle', .09), 180 + i * 200);
    if (n === 3 || ctx.challenge) setTimeout(() => snd('reveal'), 900);
    if (DE.Game.afterAction) DE.Game.afterAction();
  }
  const hudSet = (env, html) => { if (env.hud.innerHTML !== html) env.hud.innerHTML = html; };
  const clock = (sec) => `<span class="mg-clock ${sec < 6 ? 'low' : ''}">${SP('stopwatch')} ${Math.max(0, Math.ceil(sec))}s</span>`;

  /* ================= POWER GRID ================= */
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // N E S W as bits 1 2 4 8
  const rot = (m, k) => { k = ((k % 4) + 4) % 4; for (let i = 0; i < k; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
  function gridGame(stage, env) {
    const T = env.tier, n = [4, 5, 5, 6][T - 1], nCons = [2, 3, 4, 5][T - 1], nBroken = [0, 1, 2, 3][T - 1], nSwitch = T >= 2 ? T - 1 : 0;
    const limit = (35 + n * n * 1.6) * (1 + env.skill);
    // a random spanning tree from the generator, pruned to the paths that reach the lamps
    const cells = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) cells.push({ x, y, m: 0 });
    const at = (x, y) => (x < 0 || y < 0 || x >= n || y >= n) ? null : cells[y * n + x];
    const src = at(0, irnd(0, n - 1)); const seen = new Set([src]); const stack = [src];
    while (stack.length) { const c = stack[stack.length - 1]; const nb = [0, 1, 2, 3].filter(d => { const o = at(c.x + DIRS[d][0], c.y + DIRS[d][1]); return o && !seen.has(o); });
      if (!nb.length) { stack.pop(); continue; } const d = pick(nb), o = at(c.x + DIRS[d][0], c.y + DIRS[d][1]); c.m |= 1 << d; o.m |= 1 << ((d + 2) % 4); seen.add(o); stack.push(o); }
    const others = cells.filter(c => c !== src).sort(() => Math.random() - .5); const cons = new Set(others.slice(0, nCons));
    let pruned = true; while (pruned) { pruned = false; for (const c of cells) { if (c === src || cons.has(c) || !c.m) continue; const deg = [0, 1, 2, 3].filter(d => c.m & (1 << d)).length; if (deg === 1) { const d = [0, 1, 2, 3].find(d => c.m & (1 << d)); const o = at(c.x + DIRS[d][0], c.y + DIRS[d][1]); c.m = 0; o.m &= ~(1 << ((d + 2) % 4)); pruned = true; } } }
    const path = cells.filter(c => c.m && c !== src && !cons.has(c));
    path.sort(() => Math.random() - .5).slice(0, nBroken).forEach(c => c.broken = true);
    path.filter(c => !c.broken && (c.m === 5 || c.m === 10)).slice(0, nSwitch).forEach(c => { c.sw = true; c.on = false; });
    for (const c of cells) { if (!c.m) c.m = pick([5, 10, 3, 6, 12, 9]); c.dead = !path.includes(c) && c !== src && !cons.has(c); c.r = c.sw ? 0 : irnd(0, 3); c.cur = rot(c.m, -c.r); }
    // the generator turns too, so it is never a giveaway; the board is never solved from the start
    const S2 = 64, pad = 6, W = n * S2;
    stage.innerHTML = `<svg class="gr-board" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${W + 2 * pad}">${cells.map((c, i) => `<g class="gc${c === src ? ' src' : ''}${cons.has(c) ? ' cons' : ''}${c.broken ? ' broken' : ''}${c.sw ? ' sw' : ''}" data-i="${i}" transform="translate(${c.x * S2} ${c.y * S2})"><rect class="gbg" x="2" y="2" width="${S2 - 4}" height="${S2 - 4}" rx="9"/><g class="gp" style="transform:rotate(${c.r * 90}deg)">${pipes(c.m, S2)}</g>${c === src ? img('p_core', 5, 5, 54, 54, 'gsrc') : ''}${cons.has(c) ? img('p_lamp', 14, 14, 36, 36, 'glamp') : ''}${c.sw ? img('p_sw_off', 13, 13, 38, 38, 'goff') + img('p_sw_on', 13, 13, 38, 38, 'gon') : ''}${c.broken ? img('p_broken', 10, 16, 44, 32, 'gbrk') + img('p_spark', 14, 10, 36, 36, 'gspark') : ''}</g>`).join('')}</svg><div class="gr-legend"><span>${SP('p_core', 'lg')}Power core</span><span>${SP('p_lamp', 'lg')}Lamp</span>${nBroken ? `<span>${SP('p_spark', 'lg')}Broken: tap to patch</span>` : ''}${nSwitch ? `<span>${SP('p_sw_off', 'lg')}Switch: tap to flip</span>` : ''}</div>`;
    function img(n, x, y, w, h, cls) { return `<image href="assets/mg/${n}.png" x="${x}" y="${y}" width="${w}" height="${h}" class="${cls}" preserveAspectRatio="xMidYMid meet"/>`; }
    /* cables from the power sheet: a straight run, an elbow, or half-runs meeting at a joint (all 128 px tiles, rotated) */
    function pipes(m, s) {
      const I = (n, rot) => `<image href="assets/mg/${n}.png" x="0" y="0" width="${s}" height="${s}" class="pc"${rot ? ` transform="rotate(${rot} ${s / 2} ${s / 2})"` : ''}/>`;
      if (m === 10) return I('p_straight', 0); if (m === 5) return I('p_straight', 90);
      const EL = { 6: 0, 12: 90, 9: 180, 3: 270 }; if (EL[m] != null) return I('p_elbow', EL[m]);
      return [0, 1, 2, 3].filter(d => m & (1 << d)).map(d => I('p_half', [-90, 0, 90, 180][d])).join('') + I('p_hub', 0);
    }
    const els = Array.from(stage.querySelectorAll('.gc'));
    // par: the fewest moves to the intended solution (straight runs solve at two turns, a cross at any)
    const minRot = (c) => { const a = (4 - (((c.r % 4) + 4) % 4)) % 4; return c.sw || c.m === 15 ? 0 : c.m === 5 || c.m === 10 ? a % 2 : a; };
    const par = cells.filter(c => !c.dead).reduce((n, c) => n + minRot(c) + (c.broken ? 1 : 0) + (c.sw ? 1 : 0), 0);
    let moves = 0, t = 0, over = false;
    function flood() {
      const lit = new Set([src]), q = [src]; const conducts = (c) => !c.broken && !(c.sw && !c.on);
      while (q.length) { const c = q.shift(); if (!conducts(c)) continue; const m = rot(c.m, c.r); for (let d = 0; d < 4; d++) { if (!(m & (1 << d))) continue; const o = at(c.x + DIRS[d][0], c.y + DIRS[d][1]); if (!o || lit.has(o)) continue; if (rot(o.m, o.r) & (1 << ((d + 2) % 4))) { lit.add(o); q.push(o); } } }
      els.forEach((e, i) => e.classList.toggle('lit', lit.has(cells[i])));
      return [...cons].filter(c => lit.has(c)).length;
    }
    function finish(win) {
      if (over) return; over = true; const lit = flood();
      const score = win ? Math.min(1, .55 + .45 * Math.max(0, 1 - t / limit) - Math.max(0, moves - cells.length * 1.2) * .004) : .3 * lit / nCons;
      if (win) { snd('upgrade'); stage.classList.add('won'); stage.insertAdjacentHTML('beforeend', SP('p_ok', 'gr-ok')); }
      const chal = win && (env.chal.id === 'par' ? moves <= par + 3 : t <= limit / 2);
      later(() => env.done(score, { challenge: chal, headline: win ? 'Every lamp is lit. The generators hum along.' : lit + ' of ' + nCons + ' lamps powered when the shift ended.' }), win ? 1100 : 300);
    }
    els.forEach((e, i) => on(e, 'pointerdown', (ev) => {
      ev.preventDefault(); if (over) return; const c = cells[i];
      if (c.broken) { c.broken = false; e.classList.remove('broken'); e.classList.add('patched'); snd('ratchet'); }
      else if (c.sw) { c.on = !c.on; e.classList.toggle('on', c.on); note(c.on ? 880 : 520, .06, 'square', .05); }
      else { c.r = (c.r + 1) % 4; e.querySelector('.gp').style.transform = `rotate(${c.r * 90}deg)`; note(1200 + Math.random() * 120, .03, 'triangle', .04); }
      moves++;
      if (flood() === nCons) finish(true);
    }));
    flood();
    loop((dt) => { if (over) return false; t += dt; hudSet(env, `${clock(limit - t)}<span>${ic('power')} ${[...cons].filter((c) => els[cells.indexOf(c)].classList.contains('lit')).length}/${nCons} lamps</span><span>Moves ${moves}${env.chal.id === 'par' ? ' · par ' + (par + 3) : ''}</span>`); if (t >= limit) finish(false); });
  }

  /* ================= RADIO ================= */
  function radioGame(stage, env) {
    const T = env.tier, s = S(), sig = DE.Minigames.pickSignal(s);
    const limit = (30 - T * 2) * (1 + env.skill), bw = (5.2 - T * .7) * (1 + env.skill * 1.5), drift = [0, .25, .5, .8][T - 1];
    let fT = rnd(89, 107), gT = rnd(.35, .9), f = rnd(88, 108), g = .5, lock = 0, t = 0, best = 0, burst = 0, over = false;
    stage.innerHTML = `<div class="rd-wrap"><div class="rd-top">${SP('dish', 'rd-dish')}<div class="rd-screen"><canvas class="rd-scope" width="640" height="200"></canvas>${SP('static', 'rd-static')}</div>${SP('antenna', 'rd-ant')}</div>
      <div class="rd-row"><button class="rd-knob" type="button" aria-label="Tuning knob">${SP('knob')}</button><div class="rd-dial"><div class="rd-band"></div><div class="rd-needle"></div><span class="rd-mhz">${f.toFixed(1)} MHz</span></div>
      <label class="rd-gain">Gain<input type="range" min="0" max="1" step="0.01" value="${g}"></label></div>
      <div class="rd-status"><span class="rd-tower">${SP('tower_lost', 'off')}${SP('tower_ok', 'on')}</span><span class="rd-leds">${Array.from({ length: 10 }, (_, i) => `<i>${SP('led_off', 'o')}${SP(i < 6 ? 'led_green' : i < 8 ? 'led_yellow' : 'led_red', 'l')}</i>`).join('')}</span><div class="rd-meter"><i></i><b>LOCK</b></div></div><p class="rd-tx"></p></div>`;
    const cv = stage.querySelector('canvas'), cx = cv.getContext('2d'), dial = stage.querySelector('.rd-dial'), needle = stage.querySelector('.rd-needle'), mhz = stage.querySelector('.rd-mhz'), gain = stage.querySelector('.rd-gain input'), meter = stage.querySelector('.rd-meter i'), tx = stage.querySelector('.rd-tx');
    const knob = stage.querySelector('.rd-knob'), knobImg = knob.querySelector('img'), leds = Array.from(stage.querySelectorAll('.rd-leds i')), tower = stage.querySelector('.rd-tower'), stat = stage.querySelector('.rd-static'); let litN = -1;
    const setF = (v) => { f = Math.max(88, Math.min(108, v)); needle.style.left = ((f - 88) / 20 * 100).toFixed(2) + '%'; mhz.textContent = f.toFixed(1) + ' MHz'; knobImg.style.transform = `rotate(${((f - 88) / 20 * 300 - 150).toFixed(1)}deg)`; };
    setF(f);
    let drag = false, x0 = 0, f0 = 0;
    on(dial, 'pointerdown', (e) => { drag = true; x0 = e.clientX; f0 = f; dial.setPointerCapture(e.pointerId); });
    on(dial, 'pointermove', (e) => { if (!drag) return; const w = dial.getBoundingClientRect().width; setF(f0 + (e.clientX - x0) / w * 20 * .6); });
    on(dial, 'pointerup', () => { drag = false; });
    // the knob turns too: drag sideways or up and down
    let kd = null;
    on(knob, 'pointerdown', (e) => { e.preventDefault(); kd = { x: e.clientX, y: e.clientY, f }; knob.setPointerCapture(e.pointerId); });
    on(knob, 'pointermove', (e) => { if (!kd) return; setF(kd.f + ((e.clientX - kd.x) - (e.clientY - kd.y)) * .04); });
    on(knob, 'pointerup', () => { kd = null; });
    on(gain, 'input', () => { g = +gain.value; });
    on(document, 'keydown', (e) => { if (e.key === 'ArrowLeft') setF(f - .1); if (e.key === 'ArrowRight') setF(f + .1); if (e.key === 'ArrowUp') { g = Math.min(1, g + .03); gain.value = g; } if (e.key === 'ArrowDown') { g = Math.max(0, g - .03); gain.value = g; } });
    const lines = { survivor: '…anyone… we\'re hiding in the old school… three of us… please…', location: '…grid reference seven-four-two… fuel inside, the dead are thin there…', research: '…the experiment logs, part twelve… the samples respond to cold…', blueprint: '…the pump schematics are in the control room, second cabinet…', trader: '…caravan heading east, trading fuel for food, friendly…', rare: '…%#& …encrypted packet… cache… coordinates… &%#…' };
    function finish(locked) { if (over) return; over = true;
      const score = locked ? Math.min(1, .6 + .4 * Math.max(0, 1 - t / limit)) : .35 * best;
      if (locked) { snd('reveal'); tower.classList.add('locked'); tower.insertAdjacentHTML('beforeend', SP('lock', 'lk')); tx.textContent = ''; const L = lines[sig.id]; let i = 0; const st = () => { if (!root) return; i++; tx.textContent = '“' + L.slice(0, i); if (i < L.length) later(st, 26); }; st(); }
      const chal = locked && (env.chal.id === 'fast' ? t <= limit / 2 : best >= .95);
      later(() => env.done(score, { signal: sig.id, challenge: chal, headline: locked ? 'Locked on: ' + esc(sig.name) + '.' : 'The signal faded into static.' }), locked ? 2600 : 300);
    }
    loop((dt) => {
      if (over) return false; t += dt;
      fT = Math.max(88.5, Math.min(107.5, fT + Math.sin(t * .7) * drift * dt));
      if (T >= 3 && burst <= 0 && Math.random() < dt * .25) burst = .9; burst = Math.max(0, burst - dt);
      const mf = Math.exp(-Math.pow((f - fT) / bw * 2.2, 2)), mg = Math.max(0, 1 - Math.abs(g - gT) * 2.4), match = mf * mg * (burst > 0 ? .55 : 1);
      best = Math.max(best, match);
      lock = match > .8 ? lock + dt / (1.6 - env.skill) : Math.max(0, lock - dt * .8);
      meter.style.width = Math.round(Math.min(1, lock) * 100) + '%'; meter.parentElement.classList.toggle('hot', match > .8);
      const nl = Math.round(match * 10); if (nl !== litN) { litN = nl; leds.forEach((l, i) => l.classList.toggle('on', i < nl)); tower.classList.toggle('ok', match > .55 && burst <= 0); }
      stat.style.opacity = Math.min(.75, (1 - match) * .45 + (burst > 0 ? .4 : 0)).toFixed(2);
      if (match > .8 && Math.random() < dt * 6) note(1400 + match * 400, .03, 'sine', .025);
      // the scope: static, with the station's wave coming through as it is tuned in
      const W = cv.width, H = cv.height; cx.fillStyle = '#0c1a12'; cx.fillRect(0, 0, W, H);
      cx.strokeStyle = 'rgba(80,255,140,.14)'; cx.lineWidth = 1; for (let x = 0; x < W; x += 40) { cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke(); } for (let y = 0; y < H; y += 40) { cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke(); }
      cx.strokeStyle = 'rgba(255,255,255,.18)'; cx.setLineDash([6, 6]); cx.beginPath(); for (let x = 0; x <= W; x += 4) { const y = H / 2 + Math.sin(x * .045 + t * 3) * gT * 70 * (.7 + .3 * Math.sin(x * .011)); x ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.stroke(); cx.setLineDash([]);
      cx.strokeStyle = match > .8 ? '#7fff9a' : '#3fe070'; cx.lineWidth = 2.5; cx.beginPath();
      for (let x = 0; x <= W; x += 3) { const clean = Math.sin(x * .045 + t * 3) * g * 70 * (.7 + .3 * Math.sin(x * .011)); const y = H / 2 + clean * mf + (Math.random() - .5) * 80 * (1 - match) * (burst > 0 ? 1.8 : 1); x ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.stroke();
      hudSet(env, `${clock(limit - t)}<span>${ic('signal')} Signal ${Math.round(match * 100)}%</span>${burst > 0 ? '<span class="neg">Interference!</span>' : ''}`);
      if (lock >= 1) finish(true); else if (t >= limit) finish(false);
    });
  }

  /* ================= SUPPLY SORTING ================= */
  const BINS = [
    { id: 'food', name: 'Food', box: 'bin_green', icon: () => DE.Icons.res('food', 'ico-inline') },
    { id: 'water', name: 'Water', box: 'bin_blue', icon: () => DE.Icons.res('water', 'ico-inline') },
    { id: 'scrap', name: 'Scrap', box: 'crate_open', icon: () => DE.Icons.res('scrap', 'ico-inline') },
    { id: 'hazard', name: 'Hazard', box: 'crate_hazard', icon: () => ic('biohazard') },
    { id: 'medicine', name: 'Medicine', box: 'box_grey', icon: () => ic('medkit') },
    { id: 'ammo', name: 'Ammo', box: 'crate_mil', icon: () => `<svg class="ico-inline" viewBox="0 0 20 20"><rect x="7" y="6" width="6" height="12" rx="1" fill="#c9a24a" stroke="#1c1020" stroke-width="1.5"/><path d="M7 6 Q10 0 13 6 Z" fill="#d8b06e" stroke="#1c1020" stroke-width="1.5"/></svg>` },
    { id: 'fuel', name: 'Fuel', box: 'drum', icon: () => DE.Icons.res('fuel', 'ico-inline') },
    { id: 'rare', name: 'Rare', box: 'box_blue', icon: () => ic('diamond') },
  ];
  const ITEMS = {
    food: [['can_tomato', 'Tomato soup'], ['can_fish', 'Canned fish']], water: [['water_bottle', 'Bottled water'], ['water_jug', 'Water jug'], ['canister_blue', 'Water flask']],
    scrap: [['metal_bars', 'Scrap metal'], ['gear', 'Old gear'], ['tire', 'Tyre'], ['wrench', 'Wrench'], ['pliers', 'Pliers'], ['crowbar', 'Crowbar'], ['hammer_s', 'Hammer']],
    hazard: [['rad_barrel', 'Toxic barrel'], ['rad_canister', 'Leaking canister'], ['rad_box', 'Hot crate'], ['leaky_can', 'Leaking can']],
    medicine: [['medkit_small', 'First-aid kit'], ['bandage_roll', 'Bandages'], ['tape', 'Medical tape'], ['firstaid', 'Field dressing']],
    ammo: [['bullets', 'Loose rounds'], ['grenade', 'Grenade'], ['grenade2', 'Frag grenade']], fuel: [['jerrycan', 'Jerry can'], ['fuel_can', 'Petrol can'], ['fuel_yellow', 'Fuel tin'], ['cartridge', 'Gas cartridge']],
    rare: [['circuit', 'Circuit board'], ['crystal_blue', 'Strange crystal'], ['crystal_purple', 'Purple crystal'], ['cell_green', 'Power cell'], ['cell_blue', 'Charged cell'], ['alien_device', 'Odd device'], ['orb', 'Glowing orb']] };
  function sortGame(stage, env) {
    const T = env.tier, bins = BINS.slice(0, [4, 6, 7, 8][T - 1]), limit = (40 + 10 * env.skill) | 0, every = [1.25, 1.05, .9, .75][T - 1], beltT = [6.5, 5.6, 4.8, 4.1][T - 1] * (1 + env.skill * .5);
    stage.innerHTML = `<div class="so-belt"><i class="so-rollers"></i></div><div class="so-items"></div><div class="so-bins">${bins.map(b => `<button class="so-bin b-${b.id}" data-bin="${b.id}" type="button">${SP(b.box, 'so-box')}<span>${b.icon()}${b.name}</span></button>`).join('')}</div><div class="so-pop"></div><div class="so-combo"><b>×1</b><small>combo</small><em></em></div>`;
    const lane = stage.querySelector('.so-items'), pop = stage.querySelector('.so-pop'), comboEl = stage.querySelector('.so-combo');
    const showCombo = (bad) => { const m = Math.min(5, 1 + Math.floor(combo / 3)); comboEl.querySelector('b').textContent = '×' + m; comboEl.querySelector('em').textContent = good + ' sorted' + (total - good > 0 ? ' · ' + (total - good) + ' missed' : ''); comboEl.className = 'so-combo m' + m + (bad ? ' bad' : ''); void comboEl.offsetWidth; comboEl.classList.add(bad ? 'shake' : 'pulse'); };
    let t = 0, next = .4, items = [], score = 0, combo = 0, best = 0, wrong = 0, good = 0, total = 0, sel = null, over = false; const sorted = {};
    const binAt = (x, y) => { for (const b of stage.querySelectorAll('.so-bin')) { const r = b.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b; } return null; };
    function spawn() {
      const b = pick(bins), [spr, name] = pick(ITEMS[b.id]); const el = document.createElement('button'); el.type = 'button'; el.className = 'so-item' + (b.id === 'hazard' ? ' haz' : ''); el.innerHTML = `${SP(spr)}<small>${esc(name)}</small>`;
      lane.appendChild(el); const it = { el, kind: b.id, x: -12, y: rnd(28, 72), dead: false }; items.push(it); total++;
      on(el, 'pointerdown', (e) => { e.preventDefault(); if (it.dead) return; sel && sel.el.classList.remove('sel'); sel = it; it.el.classList.add('sel', 'held'); it.drag = { px: e.clientX, py: e.clientY }; el.setPointerCapture(e.pointerId); });
      on(el, 'pointermove', (e) => { if (!it.drag) return; it.el.style.translate = `${e.clientX - it.drag.px}px ${e.clientY - it.drag.py}px`; });
      on(el, 'pointerup', (e) => { if (!it.drag) return; const moved = Math.hypot(e.clientX - it.drag.px, e.clientY - it.drag.py) > 12; it.drag = null; it.el.classList.remove('held'); it.el.style.translate = ''; if (moved) { const bin = binAt(e.clientX, e.clientY); if (bin) drop(it, bin); } });
    }
    function drop(it, bin) {
      if (it.dead || over) return; it.dead = true; it.el.remove(); sel = null; const ok = bin.dataset.bin === it.kind;
      bin.classList.remove('good', 'bad'); void bin.offsetWidth; bin.classList.add(ok ? 'good' : 'bad');
      if (ok) { combo++; good++; best = Math.max(best, combo); const pts = 10 * Math.min(5, 1 + Math.floor(combo / 3)); score += pts; sorted[it.kind] = (sorted[it.kind] || 0) + 1; note(700 + Math.min(combo, 12) * 45, .07, 'triangle', .07); flyText(bin, '+' + pts + (combo >= 3 ? ' ×' + Math.min(5, 1 + Math.floor(combo / 3)) : '')); showCombo(false); }
      else { combo = 0; wrong++; score -= it.kind === 'hazard' || bin.dataset.bin === 'hazard' ? 15 : 5; snd('error'); flyText(bin, it.kind === 'hazard' ? 'Spill!' : 'Wrong bin'); showCombo(true); }
    }
    function flyText(bin, txt) { const r = bin.getBoundingClientRect(), s2 = stage.getBoundingClientRect(); const d = document.createElement('b'); d.textContent = txt; d.style.left = (r.left - s2.left + r.width / 2) + 'px'; d.style.top = (r.top - s2.top) + 'px'; pop.appendChild(d); later(() => d.remove(), 900); }
    stage.querySelectorAll('.so-bin').forEach(b => on(b, 'click', () => { if (sel) drop(sel, b); }));
    function finish() { if (over) return; over = true; const acc = total ? good / total : 0; const sc = Math.max(0, Math.min(1, acc * .8 + Math.min(.2, score / (total * 60 || 1)))); sorted.medicine && (sorted.medicine = sorted.medicine);
      const C = env.chal, chal = C.id === 'clean' ? wrong === 0 && good >= 8 : C.id === 'combo' ? best >= 6 : good >= C.n;
      later(() => env.done(sc, { sorted, challenge: chal, headline: good + ' of ' + total + ' items sorted' + (total - good ? '' : ' — not one in the wrong bin') + '.' }), 400); }
    loop((dt) => {
      if (over) return false; t += dt; next -= dt; if (next <= 0 && t < limit - 2) { spawn(); next = every * rnd(.8, 1.2); }
      for (const it of items) { if (it.dead) continue; if (!it.drag) it.x += 112 / beltT * dt; it.el.style.left = it.x + '%'; it.el.style.top = it.y + '%'; if (it.x > 100) { it.dead = true; it.el.classList.add('fall'); later(() => it.el.remove(), 400); combo = 0; showCombo(true); } }
      items = items.filter(i => !i.dead || i.el.isConnected);
      hudSet(env, `${clock(limit - t)}<span>Score ${score}</span><span class="${combo >= 3 ? 'pos' : ''}">Combo ${combo}</span>`);
      if (t >= limit) finish();
    });
  }

  /* ================= MEDICAL TRIAGE ================= */
  const AIL = [
    { id: 'cut', name: 'Deep cut', sym: 'Bleeding heavily, pale', cure: 'bandage', rate: 1.3 },
    { id: 'bone', name: 'Broken arm', sym: 'Swollen forearm, can\'t move it', cure: 'splint', rate: .7 },
    { id: 'fever', name: 'Infection', sym: 'Fever, a red, angry wound', cure: 'antibiotics', rate: .9 },
    { id: 'bite', name: 'Bite', sym: 'Bite mark, grey skin around it, fever', cure: 'antiviral', rate: 1.1 },
    { id: 'shock', name: 'Shock', sym: 'Shaking, cold sweat, racing pulse', cure: 'painkillers', rate: 1.2 },
  ];
  const CURES = [['bandage', 'Bandage'], ['splint', 'Splint'], ['antibiotics', 'Antibiotics'], ['antiviral', 'Antiviral'], ['painkillers', 'Painkillers']];
  const CURE_SP = { bandage: 'bandage', splint: 'gauze', antibiotics: 'bottle', antiviral: 'syringe', painkillers: 'pills' };
  const ECG = (() => { let d = 'M0 12'; for (let k = 0; k < 4; k++) { const o = k * 60; d += ` H${o + 18} l3 -9 l4 18 l3 -13 l2 4 H${o + 60}`; } return d; })();
  const VISITORS = ['A stranger', 'A scavenger', 'A trader', 'A lost kid', 'A soldier'];
  function triageGame(stage, env) {
    const s = S(), T = env.tier, n = Math.min(5, 2 + T);
    const real = Object.values(s.survivors).filter(v => !(v.assignment && v.assignment.kind === 'expedition') && (v.hp < 75 || v.infection)).sort((a, b) => (b.infection ? 1 : 0) - (a.infection ? 1 : 0) || a.hp - b.hp).slice(0, n);
    const pats = real.map(v => ({ id: v.id, name: v.name, prof: v.profession, ail: v.infection ? AIL[3] : v.hp < 40 ? pick([AIL[0], AIL[1]]) : pick([AIL[2], AIL[4], AIL[1]]) }));
    while (pats.length < n) pats.push({ id: null, name: pick(VISITORS), prof: pick(['scavenger', 'farmer', 'mechanic', 'soldier', 'medic']), ail: pick(AIL) });
    const faces = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - .5);   // strangers get faces from the portrait sheet
    pats.forEach(p => { p.stab = rnd(.55, .95); p.known = false; p.done = false; p.ok = false; if (!p.id) p.face = 'face' + faces.pop(); });
    const stock = {}; CURES.forEach(([id]) => stock[id] = 0); pats.forEach(p => stock[p.ail.cure]++); for (let i = 0; i < Math.max(1, 3 - T); i++) stock[pick(CURES)[0]]++;
    stage.innerHTML = `<div class="tr-pats">${pats.map((p, i) => `<div class="tr-pat" data-i="${i}"><div class="tr-top"><div class="tr-face">${p.face ? SP(p.face) : DE.Icons.prof(p.prof, 'tr-pic')}<i class="tr-badge"></i></div><div class="tr-info"><b>${esc(p.name)}</b><small class="tr-sym">Not examined</small></div></div><svg class="tr-ecg" viewBox="0 0 120 24" preserveAspectRatio="none"><path class="tr-wave" d="${ECG}"/><path class="tr-flat" d="M0 12 H120"/></svg><span class="tr-vit">${SP('ico_heart')}<i class="tr-stab"><b></b></i></span><button class="btn small tr-ex" type="button">${SP('stethoscope')}Examine</button></div>`).join('')}</div>
      <div class="tr-tray">${CURES.map(([id, nm]) => `<button class="tr-cure" data-c="${id}" type="button">${SP(CURE_SP[id])}<span>${esc(nm)}</span><b>${stock[id]}</b></button>`).join('')}</div>`;
    let chosen = null, t = 0, over = false, wrongs = 0;
    const rows = Array.from(stage.querySelectorAll('.tr-pat'));
    rows.forEach((row, i) => {
      on(row.querySelector('.tr-ex'), 'click', (e) => { e.stopPropagation(); const p = pats[i]; if (p.known || p.done) return; row.classList.add('exam'); note(440, .08, 'sine', .05); later(() => { p.known = true; row.classList.remove('exam'); row.querySelector('.tr-sym').textContent = p.ail.sym; row.querySelector('.tr-ex').disabled = true; note(660, .1, 'sine', .05); }, 600 * (1 - env.skill)); });
      on(row, 'click', () => {
        const p = pats[i]; if (!chosen || p.done || over) return;
        if (stock[chosen] <= 0) { snd('error'); return; }
        stock[chosen]--; stage.querySelector(`.tr-cure[data-c="${chosen}"] b`).textContent = stock[chosen];
        if (chosen === p.ail.cure) { p.done = true; p.ok = true; row.classList.add('saved'); row.querySelector('.tr-sym').textContent = p.ail.name + ' — treated'; snd('done'); }
        else { wrongs++; p.stab = Math.max(0, p.stab - .25); row.classList.remove('wrong'); void row.offsetWidth; row.classList.add('wrong'); snd('error'); }
        stage.querySelectorAll('.tr-cure').forEach(b => b.classList.remove('on')); chosen = null; stage.classList.remove('giving');
        if (pats.every(q => q.done)) finish();
      });
    });
    stage.querySelectorAll('.tr-cure').forEach(b => on(b, 'click', () => { chosen = chosen === b.dataset.c ? null : b.dataset.c; stage.querySelectorAll('.tr-cure').forEach(x => x.classList.toggle('on', x.dataset.c === chosen)); stage.classList.toggle('giving', !!chosen); note(900, .04, 'triangle', .04); }));
    function finish() { if (over) return; over = true;
      const ok = pats.filter(p => p.ok).length, sc = Math.min(1, ok / pats.length * .85 + (ok === pats.length ? .15 * Math.max(0, 1 - t / 60) : 0));
      const chal = env.chal.id === 'nolost' ? ok === pats.length : wrongs === 0 && ok > 0;
      later(() => env.done(sc, { challenge: chal, treated: pats.filter(p => p.id).map(p => ({ id: p.id, ok: p.ok, cure: p.ok && p.ail.id === 'bite' })), visitorSaved: pats.some(p => !p.id && p.ok), headline: ok + ' of ' + pats.length + ' patients stabilised.' }), 600); }
    loop((dt) => {
      if (over) return false; t += dt;
      pats.forEach((p, i) => { if (p.done) return; p.stab -= dt * .022 * p.ail.rate * (1 + .15 * (T - 1)) * (1 - env.skill); const row = rows[i]; row.querySelector('.tr-stab b').style.width = Math.max(0, p.stab * 100) + '%'; row.classList.toggle('crit', p.stab < .3);
        if (p.stab <= 0) { p.done = true; row.classList.add('lost'); row.querySelector('.tr-sym').textContent = p.id ? 'Needs more time than you have — back to bed' : 'Didn\'t make it'; snd('error'); if (pats.every(q => q.done)) finish(); } });
      hudSet(env, `<span>${ic('medkit')} ${pats.filter(p => p.ok).length}/${pats.length} treated</span><span>${chosen ? 'Giving: ' + CURES.find(c => c[0] === chosen)[1] : 'Pick a treatment'}</span>`);
    });
  }

  /* ================= TRAINING RANGE ================= */
  function rangeGame(stage, env) {
    const T = env.tier, limit = 30, mag = 6, reloadT = 1.1 * (1 - env.skill), life = [3.2, 2.7, 2.2, 1.8][T - 1] * (1 + env.skill), every = [1, .85, .72, .6][T - 1], civ = [.1, .15, .2, .25][T - 1];
    stage.innerHTML = `<div class="rg-field">${[0, 1, 2].map(r => `<div class="rg-lane l${r}"><i class="rg-bags"></i>${SP(pick(['crate', 'crate2', 'crate_mil']), 'rg-crate c' + r)}</div>`).join('')}</div><div class="rg-bar"><div class="rg-ammo"></div><button class="btn small rg-reload" type="button">${SP('bullets')}Reload (R)</button><span class="rg-hearts"></span></div>`;
    const field = stage.querySelector('.rg-field'), lanes = Array.from(stage.querySelectorAll('.rg-lane')), ammoEl = stage.querySelector('.rg-ammo'), hearts = stage.querySelector('.rg-hearts');
    let t = 0, next = .6, ammo = mag, reloading = 0, hits = 0, misses = 0, escaped = 0, civHit = 0, lives = 3, over = false, targets = [];
    const drawAmmo = () => { ammoEl.innerHTML = Array.from({ length: mag }, (_, i) => SP('cartridge', i < ammo ? 'on' : 'off')).join('') + (reloading > 0 ? '<b>Reloading…</b>' : ''); hearts.innerHTML = [0, 1, 2].map(i => SP('ico_heart', i < lives ? 'on' : 'off')).join(''); };
    drawAmmo();
    const reload = () => { if (reloading > 0 || ammo === mag || over) return; reloading = reloadT; snd('ratchet'); drawAmmo(); };
    on(stage.querySelector('.rg-reload'), 'click', reload); on(document, 'keydown', (e) => { if (e.key === 'r' || e.key === 'R') reload(); });
    function spawn() {
      const lane = irnd(0, 2), isCiv = Math.random() < civ, el = document.createElement('div'); el.className = 'rg-t' + (isCiv ? ' civ' : '');
      el.innerHTML = isCiv ? `<svg viewBox="0 0 40 60"><circle cx="20" cy="13" r="9" fill="#f0c8a0" stroke="#1c1020" stroke-width="2.5"/><path d="M8 58 V30 q0 -8 12 -8 q12 0 12 8 V58 Z" fill="#3a7fe8" stroke="#1c1020" stroke-width="2.5"/><path d="M8 32 l-6 -14 M32 32 l6 -14" stroke="#1c1020" stroke-width="4" stroke-linecap="round"/></svg>`
        : `<svg viewBox="0 0 40 60"><circle cx="20" cy="13" r="10" fill="#8ab06a" stroke="#1c1020" stroke-width="2.5"/><circle cx="16" cy="12" r="2" fill="#ff5a4d"/><circle cx="24" cy="12" r="2" fill="#ff5a4d"/><path d="M7 58 V31 q0 -8 13 -8 q13 0 13 8 V58 Z" fill="#6a5a4a" stroke="#1c1020" stroke-width="2.5"/><path d="M7 33 l-5 6 M33 33 l6 4" stroke="#1c1020" stroke-width="4" stroke-linecap="round"/></svg>`;
      el.style.left = rnd(6, 86) + '%'; lanes[lane].appendChild(el);
      const tg = { el, civ: isCiv, age: 0, life: life * rnd(.85, 1.15), dead: false }; targets.push(tg);
      on(el, 'pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); shoot(tg, e); });
    }
    function mark(e, hit) { if (!e) return; const r = field.getBoundingClientRect(), m = document.createElement('i'); m.className = 'rg-mark' + (hit ? ' hit' : ''); m.style.left = (e.clientX - r.left) + 'px'; m.style.top = (e.clientY - r.top) + 'px'; field.appendChild(m); later(() => m.remove(), 450); }
    function shoot(tg, e) {
      if (over) return; if (reloading > 0) return; if (ammo <= 0) { note(180, .05, 'square', .05); return; }
      ammo--; mark(e, tg && !tg.dead && !tg.civ); snd('shot', 40); stage.classList.remove('kick'); void stage.offsetWidth; stage.classList.add('kick');
      if (tg && !tg.dead) { tg.dead = true; tg.el.classList.add('hit'); later(() => tg.el.remove(), 350);
        if (tg.civ) { civHit++; lives = Math.max(0, lives - 1); snd('error'); } else { hits++; note(300, .08, 'square', .05, 120); } }
      else misses++;
      if (ammo === 0) later(reload, 150); drawAmmo();
      if (lives <= 0) finish();
    }
    on(field, 'pointerdown', (e) => { if (e.target === field || e.target.classList.contains('rg-lane') || e.target.classList.contains('rg-bags')) shoot(null, e); });
    function finish() { if (over) return; over = true;
      const shotAt = hits + misses + escaped, sc = Math.max(0, Math.min(1, (shotAt ? hits / shotAt : 0) * (1 - .2 * civHit) * (lives > 0 ? 1 : .6)));
      const C = env.chal, chal = lives > 0 && (C.id === 'nociv' ? civHit === 0 && hits >= 5 : C.id === 'wall' ? escaped === 0 && hits >= 5 : hits >= C.n);
      later(() => env.done(sc, { challenge: chal, headline: hits + ' hits, ' + escaped + ' got through' + (civHit ? ', ' + civHit + ' civilian' + (civHit > 1 ? 's' : '') + ' hit' : '') + '.' }), 400); }
    loop((dt) => {
      if (over) return false; t += dt; next -= dt; if (reloading > 0) { reloading -= dt; if (reloading <= 0) { ammo = mag; drawAmmo(); note(900, .05, 'triangle', .05); } }
      if (next <= 0 && t < limit - 1) { spawn(); next = every * rnd(.7, 1.3); }
      for (const tg of targets) { if (tg.dead) continue; tg.age += dt; const k = tg.age / tg.life; tg.el.style.transform = `translateY(${(1 - Math.min(1, k * 3)) * 70}%) scale(${(.75 + .5 * k).toFixed(3)})`;
        if (k >= 1) { tg.dead = true; tg.el.classList.add('gone'); later(() => tg.el.remove(), 300); if (!tg.civ) { escaped++; lives = Math.max(0, lives - 1); snd('thud'); drawAmmo(); if (lives <= 0) finish(); } } }
      targets = targets.filter(x => !x.dead || x.el.isConnected);
      hudSet(env, `${clock(limit - t)}<span>Hits ${hits}</span><span>Through ${escaped}</span>`);
      if (t >= limit) finish();
    });
  }

  /* ================= FORGE ================= */
  function forgeMenu() {
    const s = S(); if (!s) return;
    const lvl = DE.Gear.forgeLevel(s); const g = DE.Gear.ensure(s);
    preload(['furnace', 'anvil_base', 'hammer', 'barrels', 'pillar', 'plank', 'arrow', 'btn_hammer'].concat(USES.common));
    const body = shell('Blacksmith Forge', DE.Icons.room('forge', 'mg-room'), lvl ? `Forge level ${lvl} · ${g.items.length} item${g.items.length === 1 ? '' : 's'} in stock · ${g.ammo} rounds` : 'Build a Blacksmith Forge');
    const stat = (r) => r.kind === 'weapon' ? `×${r.dmg.toFixed(2)} damage · ${r.dur} waves${r.ammo ? ' · ' + r.ammo + ' rnd/wave' : ' · no ammo'}` : r.kind === 'armor' ? `stops ${Math.round(r.guard * 100)}% of injuries & bites · ${r.dur} hits` : `${r.amount} rounds (more if well made)`;
    body.innerHTML = `<div class="fg-list">${DE.Gear.recipes().map(r => { const c = DE.Gear.canCraft(s, r.id);
      return `<div class="fg-card ${c.ok ? '' : c.locked ? 'locked' : 'cant'}"><div class="fg-ico">${itemIcon(r)}</div><div class="fg-info"><b>${esc(r.name)}</b><small>${esc(stat(r))}</small><small class="muted">${esc(r.desc)}</small>
        <span class="fg-cost">${DE.Util.costText(r.cost)}${r.mat ? DE.Icons.rare(r.mat, s.materials) : ''}</span>${c.ok ? '' : `<span class="fg-why">${ic(c.locked ? 'lock' : 'alert')} ${esc(c.reason)}</span>`}</div>
        <button class="btn ${c.ok ? 'primary' : 'cant'} fg-go" data-id="${r.id}" type="button" ${c.ok ? '' : 'disabled'}>Forge</button></div>`; }).join('')}</div>
      <p class="muted center">Forged gear goes to the Armory; guards carry it into fights. ${DE.Bunker && Object.values(s.rooms).some(r => r.type === 'armory' && r.level > 0) ? '' : 'Build an Armory to hand it out.'}</p>`;
    body.querySelectorAll('.fg-go').forEach(b => b.addEventListener('click', () => { snd('click'); forge(body, b.dataset.id); }));
  }
  /* item pictures: weapons and gear from the item / workshop sheets (two long guns from the weapon sprites) */
  const ITEM_SP = { machete: 'mg/machete', pistol: 'mg/pistol', shotgun: 'mg/shotgun', rifle: 'sprites/rifle', carbine: 'mg/ak', marksman: 'sprites/sniper',
    vest: 'mg/armor_vest', riot: 'mg/armor_riot', plate: 'mg/armor_plate', ammo: 'mg/bullets' };
  function itemIcon(r) {
    const k = ITEM_SP[r.id] || (r.kind === 'ammo' ? 'mg/bullets' : 'mg/pistol');
    return `<img class="sp fg-pic k-${r.kind || 'weapon'}" src="assets/${k}.png" alt="" draggable="false">`;
  }
  function forge(body, id) {
    const s = S(), r = DE.Gear.recipe(id), c = DE.Gear.canCraft(s, id); if (!c.ok) { DE.UI.toast(c.reason, 'err'); return; }
    const room = DE.Minigames.bestRoom(s, 'forge'), skill = DE.Minigames.skill(s, 'forge', room), tier = r.tier || 1;
    body.innerHTML = `<div class="mg-hud"></div><div class="mg-stage mg-forge"><div class="fg-scene">${SP('pillar', 'fg-pil')}<div class="fg-furnace">${SP('furnace')}<i class="fg-fire"></i></div><div class="fg-anvil">${SP('anvil_base', 'fg-anv')}<i class="fg-bar"></i>${SP('hammer', 'fg-hammer')}<span class="fg-sparks"></span></div>${SP('barrels', 'fg-tub')}
      <div class="fg-craft"><span class="fg-slot">${DE.Icons.res('scrap', 'fg-mat')}</span>${SP('arrow', 'fg-arr')}<span class="fg-slot out">${itemIcon(r)}</span></div>${SP('plank', 'fg-plank')}</div><div class="fg-ui"></div></div>`;
    const hud = body.querySelector('.mg-hud'), ui = body.querySelector('.fg-ui'), bar = body.querySelector('.fg-bar'), fire = body.querySelector('.fg-fire'), hammer = body.querySelector('.fg-hammer'), sparks = body.querySelector('.fg-sparks');
    const score = { heat: 0, hammer: 0, quench: 0 }, chal = CHAL.forge(); let perfect = 0;
    const chalTag = `<span class="mg-hchal">${ic('trophy')} ${esc(chal.text)}</span>`;
    const press = (cb) => { const h = (e) => { if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return; if (e.type === 'keydown') e.preventDefault(); cb(e); }; on(document, 'keydown', h); return h; };
    // 1 · heat: hold the bellows to keep the metal in the glowing band
    const heat = () => {
      hud.innerHTML = '<b>1 · Heat</b><span>Hold the bellows to keep the metal in the band</span>' + chalTag;
      ui.innerHTML = `<div class="fg-gauge"><i class="fg-band"></i><b class="fg-temp"></b></div><button class="btn primary fg-bellows" type="button">Hold: bellows</button>`;
      const temp = ui.querySelector('.fg-temp'), band = ui.querySelector('.fg-band'), btn = ui.querySelector('.fg-bellows');
      let blowing = false, T0 = 0, v = .15, inBand = 0, t = 0; const dur = 5, bw = (.2 - .025 * tier) * (1 + skill);
      const down = (e) => { e.preventDefault(); blowing = true; btn.classList.add('on'); }, up = () => { blowing = false; btn.classList.remove('on'); };
      on(btn, 'pointerdown', down); on(btn, 'pointerup', up); on(btn, 'pointerleave', up); on(document, 'keydown', (e) => { if (e.key === ' ') { e.preventDefault(); blowing = true; } }); on(document, 'keyup', (e) => { if (e.key === ' ') blowing = false; });
      loop((dt) => { t += dt; const center = .62 + .16 * Math.sin(t * (.9 + .25 * tier)); band.style.left = ((center - bw / 2) * 100) + '%'; band.style.width = (bw * 100) + '%';
        v += (blowing ? 1.15 : -.75) * dt * .55; v = Math.max(0, Math.min(1, v)); T0 = v; temp.style.left = (T0 * 100) + '%';
        const ok = Math.abs(T0 - center) < bw / 2; if (ok) inBand += dt; temp.classList.toggle('ok', ok);
        bar.style.setProperty('--glow', T0.toFixed(2)); fire.style.setProperty('--fire', (.4 + .6 * (blowing ? 1 : .3)).toFixed(2));
        if (blowing && Math.random() < dt * 8) note(90 + Math.random() * 30, .12, 'sawtooth', .02);
        if (t >= dur) { score.heat = Math.min(1, inBand / dur / .85); stopGame(); hammerPhase(); return false; } });
    };
    // 2 · hammer: strike when the marker crosses the sweet spot; it narrows and speeds up
    const hammerPhase = () => {
      const strikes = 3 + tier; let n = 0, sum = 0, x = 0, dir = 1;
      hud.innerHTML = `<b>2 · Hammer</b><span>Strike when the marker is in the green — ${strikes} blows</span>` + chalTag;
      ui.innerHTML = `<div class="fg-track"><i class="fg-sweet"></i><b class="fg-mark"></b></div><button class="fg-strike" type="button" aria-label="Strike">${SP('btn_hammer')}<small>Strike · Space</small></button><div class="fg-blows"></div>`;
      const mark = ui.querySelector('.fg-mark'), sweet = ui.querySelector('.fg-sweet'), blows = ui.querySelector('.fg-blows');
      const width = () => Math.max(.06, (.26 - .03 * tier - .02 * n) * (1 + skill));
      const strike = () => { if (n >= strikes) return; const w = width(), acc = Math.max(0, 1 - Math.abs(x - .5) / (w / 2) * .5 - Math.max(0, Math.abs(x - .5) - w / 2) * 3); sum += Math.min(1, acc); n++; if (acc > .8) perfect++;
        hammer.classList.remove('hit'); void hammer.offsetWidth; hammer.classList.add('hit'); snd('clank', 0); note(acc > .8 ? 1760 : acc > .5 ? 1320 : 880, .12, 'triangle', .07);
        sparks.classList.remove('go'); void sparks.offsetWidth; sparks.classList.add('go'); bar.style.setProperty('--shape', (n / strikes).toFixed(2));
        blows.innerHTML += `<i class="${acc > .8 ? 'great' : acc > .5 ? 'ok' : 'meh'}">${acc > .8 ? 'Perfect' : acc > .5 ? 'Good' : 'Off'}</i>`;
        if (n >= strikes) { score.hammer = sum / strikes; later(() => { stopGame(); quench(); }, 500); } };
      on(ui.querySelector('.fg-strike'), 'pointerdown', (e) => { e.preventDefault(); strike(); }); press(strike);
      loop((dt) => { const sp = (.7 + .12 * tier + .08 * n) * (1 - skill * .4); x += dir * sp * dt; if (x > 1) { x = 1; dir = -1; } if (x < 0) { x = 0; dir = 1; } mark.style.left = (x * 100) + '%'; const w = width(); sweet.style.left = ((.5 - w / 2) * 100) + '%'; sweet.style.width = (w * 100) + '%'; });
    };
    // 3 · quench: dip it when the steel shows cherry red
    const quench = () => {
      hud.innerHTML = '<b>3 · Quench</b><span>Dip it in the water when it glows cherry red</span>' + chalTag;
      ui.innerHTML = `<div class="fg-heatbar"><i class="fg-cherry"></i><b class="fg-now"></b></div><button class="btn primary fg-dip" type="button">Quench (Space)</button>`;
      const now = ui.querySelector('.fg-now'); let k = 0, done = false; const span = (.14 - .02 * tier) * (1 + skill), center = rnd(.45, .65);
      ui.querySelector('.fg-cherry').style.cssText = `left:${(center - span / 2) * 100}%;width:${span * 100}%`;
      const dip = () => { if (done) return; done = true; score.quench = Math.max(0, 1 - Math.abs(k - center) / (span / 2) * .5 - Math.max(0, Math.abs(k - center) - span / 2) * 4); snd('splat'); note(2400, .5, 'sine', .02, 300); bar.classList.add('quenched'); later(() => { stopGame(); doneForge(); }, 500); };
      on(ui.querySelector('.fg-dip'), 'pointerdown', (e) => { e.preventDefault(); dip(); }); press(dip);
      loop((dt) => { if (done) return false; k += dt * (.28 + .05 * tier); now.style.left = (Math.min(1, k) * 100) + '%'; bar.style.setProperty('--glow', (1 - k).toFixed(2)); if (k >= 1.05) dip(); });
    };
    const doneForge = () => {
      const met = chal.id === 'perfect' ? perfect >= 2 : chal.id === 'cherry' ? score.quench >= .75 : score.heat >= .9;
      const sc = Math.max(0, Math.min(1, .3 * score.heat + .5 * score.hammer + .2 * score.quench + (met ? .08 : 0)));
      const res = DE.Gear.craft(S(), id, sc); if (!res.ok) { DE.UI.toast(res.reason, 'err'); return close(); }
      const outSlot = body.querySelector('.fg-slot.out'); if (outSlot) outSlot.classList.add('made');
      const mg = DE.Minigames.ensure(S()); mg.plays.forge = (mg.plays.forge || 0) + 1; mg.best.forge = Math.max(mg.best.forge || 0, sc); mg.xp.forge = (mg.xp.forge || 0) + Math.round(10 + 25 * sc + (met ? 15 : 0));
      const q = res.quality, out = { rewards: {}, lines: res.kind === 'ammo' ? ['+' + res.amount + ' rounds for the armory'] : [q.name + ' ' + r.name + ' — ' + res.item.max + ' durability', 'Waiting in the Armory'], mastery: DE.Minigames.level(S(), 'forge') };
      const card = res.item ? `<div class="fg-made" style="--qc:${q.color}"><div class="fg-ico">${itemIcon(r)}</div><b>${esc(q.name)} ${esc(r.name)}</b><small>Heat ${Math.round(score.heat * 100)}% · Hammer ${Math.round(score.hammer * 100)}% · Quench ${Math.round(score.quench * 100)}%</small></div>` : '';
      results('forge', body, sc, { out, card, challenge: met, headline: res.item ? 'The ' + esc(r.name.toLowerCase()) + ' is done.' : 'A crate of fresh rounds.' }, { chal: Object.assign({}, chal, { text: chal.text + ' (finer work)' }) });
    };
    heat();
  }

  /* ================= ARMORY ================= */
  function armory(selected) {
    const s = S(); if (!s) return; const g = DE.Gear.ensure(s), guards = DE.Survivors.guards(s);
    const body = shell('Armory', DE.Icons.room('armory', 'mg-room'), `${guards.length} guard${guards.length === 1 ? '' : 's'} on duty · ${g.ammo} rounds · ${g.items.length} item${g.items.length === 1 ? '' : 's'}`);
    const sel = selected && s.survivors[selected] ? selected : guards[0] && guards[0].id;
    const Q = (it) => DE.Data.QUALITY.find(x => x.id === it.q) || DE.Data.QUALITY[1];
    const itemHtml = (it, act) => { const d = DE.Gear.defOf(it), q = Q(it); return `<div class="ar-item ${it.dur <= 0 ? 'broken' : ''}" style="--qc:${q.color}"><div class="fg-ico">${itemIcon(Object.assign({ kind: it.kind }, d))}</div><div><b>${esc(q.name)} ${esc(d.name)}</b><i class="ar-dur"><b style="width:${Math.round(100 * it.dur / it.max)}%"></b></i><small>${it.dur}/${it.max}${it.kind === 'weapon' ? ' · ×' + (1 + (d.dmg - 1) * q.mult).toFixed(2) + ' dmg' : ' · stops ' + Math.round(Math.min(.6, d.guard * q.mult) * 100) + '%'}</small></div>${act}</div>`; };
    const free = g.items.filter(i => !i.owner);
    body.innerHTML = `<div class="ar-deco">${['rifle_rack', 'gun_cabinet', 'armor_vest', 'ammo_cabinet', 'armor_plate', 'helmet_shelf'].map(n => SP(n)).join('')}</div><div class="ar-wrap"><div class="ar-guards">${guards.length ? guards.map(v => { const gi = DE.Gear.itemsOf(s, v.id); return `<button class="ar-guard ${v.id === sel ? 'on' : ''}" data-sid="${v.id}" type="button">${DE.Icons.prof(v.profession, 'ava')}<span><b>${esc(v.name)}</b><small>${gi.weapon ? esc(DE.Data.WEAPONS[gi.weapon.type].name) : 'No weapon'} · ${gi.armor ? esc(DE.Data.ARMORS[gi.armor.type].name) : 'no armour'}${v.training ? ' · training ' + (+v.training).toFixed(1) : ''}</small></span><em>×${DE.Gear.guardMult(s, v).toFixed(2)}</em></button>`; }).join('') : '<p class="muted">No guards on duty. Post survivors as guards in the Defense screen.</p>'}</div>
      <div class="ar-side">${sel ? `<h4>${esc(s.survivors[sel].name)}'s kit</h4>${['weapon', 'armor'].map(k => { const it = DE.Gear.itemsOf(s, sel)[k]; return it ? itemHtml(it, `<button class="btn tiny" data-un="${it.id}" type="button">Take back</button>`) : `<div class="ar-empty">No ${k === 'weapon' ? 'weapon' : 'armour'}</div>`; }).join('')}` : ''}
        <h4>In the racks <small class="muted">${free.length}</small></h4><div class="ar-rack">${free.length ? free.map(it => itemHtml(it, `<span class="ar-acts">${sel ? `<button class="btn tiny primary" data-eq="${it.id}" type="button">Hand out</button>` : ''}${it.dur < it.max ? `<button class="btn tiny" data-rep="${it.id}" type="button">Repair ${DE.Util.costText(DE.Gear.repairCost(it))}</button>` : ''}<button class="btn tiny danger" data-sal="${it.id}" type="button">Salvage</button></span>`)).join('') : '<p class="muted">Empty. Forge weapons and armour at the Blacksmith Forge.</p>'}</div>
        <div class="btn-row"><button class="btn" data-auto="1" type="button">Equip all guards</button>${DE.Gear.forgeLevel(s) ? '<button class="btn" data-forge="1" type="button">Open the forge</button>' : ''}</div></div></div>`;
    const act = (fn, msg) => { const r = fn(); if (r && r.ok === false) { DE.UI.toast(r.reason, 'err'); DE.Audio.sfx('error'); return; } if (msg) DE.UI.toast(msg, 'ok', 2200); DE.Audio.sfx('click'); armory(sel); };
    body.querySelectorAll('[data-sid]').forEach(b => b.addEventListener('click', () => { DE.Audio.sfx('click'); armory(b.dataset.sid); }));
    body.querySelectorAll('[data-eq]').forEach(b => b.addEventListener('click', () => act(() => DE.Gear.equip(S(), b.dataset.eq, sel))));
    body.querySelectorAll('[data-un]').forEach(b => b.addEventListener('click', () => act(() => DE.Gear.unequip(S(), b.dataset.un))));
    body.querySelectorAll('[data-rep]').forEach(b => b.addEventListener('click', () => act(() => DE.Gear.repair(S(), b.dataset.rep), 'Repaired')));
    body.querySelectorAll('[data-sal]').forEach(b => b.addEventListener('click', () => act(() => DE.Gear.salvage(S(), b.dataset.sal), 'Salvaged for scrap')));
    const auto = body.querySelector('[data-auto]'); if (auto) auto.addEventListener('click', () => act(() => DE.Gear.autoEquip(S()), 'Guards equipped'));
    const fo = body.querySelector('[data-forge]'); if (fo) fo.addEventListener('click', () => forgeMenu());
  }

  const GAME = { grid: gridGame, radio: radioGame, sort: sortGame, triage: triageGame, range: rangeGame };
  return { open, close, armory, forge: forgeMenu, active: () => !!root, _finish: (score, ctx) => current && current.done(score, ctx || {}) };
})();
