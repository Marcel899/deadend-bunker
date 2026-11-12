/* UI core: DOM helpers, event delegation, toasts, modals, screens, per-tick top bar. */
var DE = globalThis.DE = globalThis.DE || {};

DE.UI = (function () {
 const U = () => DE.Util;
 const $ = (sel) => document.querySelector(sel);
 const esc = (s) => DE.Util.escapeHtml(s);

 /* Transient UI state (not saved) */
 const ui = {
 screen: 'menu',
 selection: null,  // {type:'room', id} | {type:'slot', depth, slot}
 drawer: null,
 buyMode: 1,
 researchBranch: 'economy',
 expedition: { location: 'suburbs', members: [] },
 survivorFilter: 'all',
 lastDrawerHtml: '', lastSideHtml: '',
 };

 function state() { return DE.Game.state; }

 /* While a finger is on a scrolling panel, or its momentum is still running, its HTML is not swapped:
  * replacing the content mid-scroll stops iOS momentum scrolling and makes the panel jump. */
 const scrollAt = new WeakMap(); let touching = null;
 const SCROLLERS = '#drawer-body, #sidepanel, #bunker-wrap, .modal-body';
 function scrollBusy(el) { if (!el) return false; if (touching && (touching === el || el.contains(touching) || touching.contains(el))) return true; const t = scrollAt.get(el); return !!t && Date.now() - t < 700; }
 function watchScrolling() {
   const mark = (el) => { if (el) scrollAt.set(el, Date.now()); };
   document.addEventListener('touchstart', e => { touching = e.target.closest ? e.target.closest(SCROLLERS) : null; mark(touching); }, { passive: true, capture: true });
   const up = () => { mark(touching); touching = null; };
   document.addEventListener('touchend', up, { passive: true, capture: true }); document.addEventListener('touchcancel', up, { passive: true, capture: true });
   document.addEventListener('scroll', e => { if (e.target && e.target.nodeType === 1) mark(e.target); }, { passive: true, capture: true });
   document.addEventListener('wheel', e => { mark(e.target.closest ? e.target.closest(SCROLLERS) : null); }, { passive: true, capture: true });
 }
 function init() {
 watchScrolling();
 document.addEventListener('click', onClick);
 // subtle hover tick on interactive elements (mouse only; touch has no hover)
 let hoverEl = null;
 document.addEventListener('pointerover', e => { if (e.pointerType !== 'mouse') return; const el = e.target.closest('.btn:not(:disabled), .nav-btn, .menu-btn, .res, .chip, .dk-sec-head, .rs-card.avail, .cell, .room, .ov-tile'); if (el && el !== hoverEl) { hoverEl = el; DE.Audio.sfx('hover'); } else if (!el) hoverEl = null; });
 document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-place]'); if (!el || e.button !== 0) return; e.preventDefault(); DE.UI.Placement.start({ type: el.dataset.place }, e); });
 document.addEventListener('pointerdown', e => { const el = e.target.closest('[data-move]'); if (!el || e.button !== 0) return; e.preventDefault(); DE.UI.Placement.start({ roomId: el.dataset.move }, e); });
 const KEYS = { b: 'bunker', s: 'survivors', r: 'research', x: 'excavate', d: 'defense', e: 'expeditions', t: 'economy', l: 'legacy', o: 'settings' };
 document.addEventListener('keydown', e => {
 if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || !$('#modal-root').classList.contains('hidden') || !state()) return;
 const k = KEYS[(e.key || '').toLowerCase()]; if (!k || $('#game-screen').classList.contains('hidden')) return;
 if (k === 'bunker') closeDrawer(); else if (ui.drawer === k) closeDrawer(); else openDrawer(k);
 });
 document.addEventListener('keydown', e => { if (/^[1-4]$/.test(e.key)) { const b = document.querySelectorAll('#modal-root .choice')[+e.key - 1]; if (b && !b.disabled) { b.click(); return; } } if (e.key === 'Escape') { if (!$('#modal-root').classList.contains('hidden')) closeModal(); else closeDrawer(); } });
 renderResbar();
 }

 function onClick(e) {
 if (DE.UI.Placement && DE.UI.Placement.active() && DE.UI.Placement.onClickPlace(e)) { e.preventDefault(); return; }
 const el = e.target.closest('[data-action]');
 if (!el || el.disabled) return;
 if (el.matches('.btn, .nav-btn, .menu-btn, .res, .chip, .dk-sec-head, .room, .cell')) DE.Audio.sfx('click');
 const action = el.dataset.action;
 const fn = DE.Actions[action];
 if (!fn) { console.warn('No action', action); return; }
 const params = Object.assign({}, el.dataset);
 fn(params, el, e);
 }

 function showScreen(name) {
 ui.screen = name;
 $('#menu-screen').classList.toggle('hidden', name !== 'menu');
 $('#game-screen').classList.toggle('hidden', name !== 'game');
 if (name === 'menu') DE.UI.Menu.show(); else DE.UI.Menu.hide();
 }

 /* ---------- top bar ---------- */
 function renderResbar() {
 const R = DE.Data.RESOURCES;
  $('#resbar').innerHTML = DE.Data.RESOURCE_ORDER.map(r => `<div class="res ${R[r].capped ? 'capped' : 'open'}" data-res="${r}" title="${R[r].name}" style="--rc:${R[r].color}" data-action="openDrawer" data-drawer="economy">
 <span class="res-icon">${DE.Icons.res(r)}</span>
 <span class="res-body"><span class="res-line"><b class="res-amt">0</b><b class="res-max"></b></span><span class="res-cap"><i></i></span></span>
 ${R[r].capped ? '' : `<span class="res-plus" data-action="openDrawer" data-drawer="research" title="Research">+</span>`}
 <i class="res-rate">+0/s</i>
 </div>`).join('');
 // defense per second sits first, right before the survivor counter: damage/s plus a bar for how
 // much of the next wave that firepower would cut down
 $('#chips').innerHTML = `<div class="chip def" id="chip-def" data-action="openDrawer" data-drawer="defense" title="Defense">${DE.Icons.img('shield')}<span class="cd-body"><b>0/s</b><span class="cd-bar"><i></i></span></span></div>
 <div class="chip" id="chip-pop" data-action="openDrawer" data-drawer="survivors" title="Population / housing">${DE.Icons.img('pop')}<b>0/0</b></div>
 <div class="chip" id="chip-morale" title="Morale">${DE.Icons.img('morale')}<b>60</b></div>
 <div class="chip" id="chip-wave" data-action="openDrawer" data-drawer="defense" title="Next zombie wave">${DE.Icons.img('wave')}<b>--</b><small class="cw-n">W1</small></div>
 <div class="chip" id="chip-lp" data-action="openDrawer" data-drawer="legacy" title="Legacy Points">${DE.Icons.img('res.legacy')}<b>0</b></div>
 <div class="chip decide" id="chip-events" data-action="nextEvent" title="Decisions waiting for you">${DE.Icons.img('scroll')}<b>0</b></div>`;
 }

 /** Little red counters on the nav dock: what needs attention where. */
 /** Attention badges on the nav dock: a red counter (idle survivors) or the yellow "!" icon. */
 function updateNavBadges(s) {
 const idle = DE.Survivors.idle(s).length;
 const want = {
   survivors: idle ? { n: idle, tip: idle + ' idle survivor' + (idle > 1 ? 's' : '') } : null,
   research: !s.research.current && s.resources.research >= 40 ? { alert: true, tip: 'Research points ready — start a project' } : null,
   defense: (s.defense.nextWaveAt - Date.now()) / 1000 < DE.Defense.warningSec(s) ? { alert: true, danger: true, tip: 'A wave is incoming' } : null,
 };
 for (const nav in want) {
   const btn = document.querySelector(`#bottombar .nav-btn[data-nav="${nav}"]`); if (!btn) continue;
   const w = want[nav]; let el = btn.querySelector('.nb');
   const sig = w ? (w.alert ? 'a' + (w.danger ? 'd' : '') : 'n' + w.n) : '';
   if (!w) { if (el) el.remove(); continue; }
   if (el && el.dataset.sig === sig) continue;
   if (!el) { el = document.createElement('i'); btn.appendChild(el); }
   el.dataset.sig = sig; el.title = w.tip;
   el.className = 'nb ' + (w.alert ? 'nb-alert' + (w.danger ? ' nb-danger' : '') : 'nb-count');
   el.innerHTML = w.alert ? `<img src="assets/icons/alert.png" alt="!">` : `<b>${w.n > 9 ? '9+' : w.n}</b>`;
 }
 }
 let fitDirty = true; window.addEventListener('resize', () => { fitDirty = true; });
 function updateResbar() {
 const s = state(); const rates = s._rates; if (!rates) return;
 updateNavBadges(s);
 document.querySelectorAll('#resbar .res').forEach(el => {
 const r = el.dataset.res;
 const amt = s.resources[r], net = rates.net[r], cap = DE.Economy.storageCap(s, r);
 el.querySelector('.res-amt').textContent = U().fmt(amt);
 const rateEl = el.querySelector('.res-rate');
 rateEl.textContent = U().fmtRate(net);
 rateEl.className = 'res-rate ' + (net < -1e-6 ? 'neg' : net > 1e-6 ? 'pos' : '');
 const capEl = el.querySelector('.res-cap i');
 const maxEl = el.querySelector('.res-max');
 if (isFinite(cap)) { capEl.style.width = Math.min(100, amt / cap * 100) + '%'; capEl.parentElement.style.display = ''; capEl.parentElement.className = 'res-cap' + (amt >= cap * 0.98 ? ' full' : ''); maxEl.textContent = '\u00a0/\u00a0' + U().fmt(cap); }
 else { capEl.parentElement.style.display = 'none'; maxEl.textContent = ''; }
 // narrow screens: drop the "/ cap" when the number would not fit (the bar still shows the fill)
 const len = el.querySelector('.res-amt').textContent.length + maxEl.textContent.length;
 if (el._len !== len || fitDirty) { el._len = len; el.classList.remove('tight'); const line = el.querySelector('.res-line'); if (line.scrollWidth > line.clientWidth + 1) el.classList.add('tight'); }
 el.classList.toggle('empty', amt <= 0.01 && net < 0);
 const eta = net < -1e-6 ? '\nEmpty in ' + U().fmtTime(amt / -net) : (net > 1e-6 && isFinite(cap) && amt < cap) ? '\nFull in ' + U().fmtTime((cap - amt) / net) : '';
 el.title = DE.Data.RESOURCES[r].name + (isFinite(cap) ? ' · cap ' + U().fmt(cap) : '') + '\n+' + U().fmt(rates.production[r], 2) + '/s  −' + U().fmt(rates.consumption[r], 2) + '/s' + eta + '\nClick for the production dashboard';
 });
 fitDirty = false;
 const pop = DE.Bunker.population(s), cap = DE.Bunker.housingCapacity(s);
 $('#chip-pop b').textContent = pop + '/' + cap;
 $('#chip-pop').classList.toggle('warn', pop > cap);
 const m = Math.round(s.morale);
 const mc = $('#chip-morale'); mc.querySelector('b').textContent = m;
 mc.className = 'chip ' + (m >= 50 ? 'good' : m >= 30 ? 'warn' : 'bad');
 mc.title = 'Morale ' + m + ' → production ×' + DE.Economy.moraleMult(s.morale).toFixed(2);
 const secs = (s.defense.nextWaveAt - Date.now()) / 1000;
 const cw = $('#chip-wave'), boss = DE.Defense.isBossWave(s.defense.wave);
 cw.querySelector('b').textContent = clock(secs);
 cw.querySelector('.cw-n').textContent = (boss ? 'BOSS ' : 'W') + s.defense.wave;
 cw.classList.toggle('warn', secs < 30); cw.classList.toggle('boss', boss);
 cw.title = (boss ? 'BOSS wave ' : 'Zombie wave ') + s.defense.wave + ' in ' + U().fmtTime(secs) + '\nClick to open Defense';
 updateDefChip(s);
 const nEv = (s.events || []).length; const ce = $('#chip-events'); if (ce) { ce.querySelector('b').textContent = nEv; ce.style.display = nEv ? '' : 'none'; }
 $('#chip-lp b').textContent = U().fmt(s.prestige.points);
 $('#chip-lp').style.display = (s.prestige.lifetime > 0 || s.stats.maxDepth >= 3) ? '' : 'none';
 }

 /** "4:05" / "1:02:30" — compact countdown for the wave chip. */
 function clock(sec) {
 sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), x = sec % 60;
 return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0');
 }
 /** Shield chip: total damage per second of guards, turrets and missiles, and how much of the next
  *  wave it would kill (bar; green = the wave is beaten before it reaches the wall). */
 function updateDefChip(s) {
 const el = $('#chip-def'); if (!el) return;
 const pw = DE.Defense.defensePower(s), threat = DE.Defense.waveHp(s);
 const dps = pw.guardDps + pw.turretDps + pw.missileDps, ratio = threat > 0 ? pw.total / threat : 1;
 const f = (n) => U().fmt(n, n > 0 && n < 10 ? 1 : undefined);
 el.querySelector('b').textContent = f(dps) + '/s';
 el.querySelector('.cd-bar i').style.width = Math.min(100, ratio * 100).toFixed(1) + '%';
 const cls = 'chip def ' + (ratio >= 1 ? 'good' : ratio >= 0.6 ? 'meh' : 'bad');
 if (el.className !== cls) el.className = cls;
 el.title = 'Defense: ' + f(dps) + ' damage per second'
   + '\n• Guards ' + f(pw.guardDps) + '/s (' + pw.guards + ')'
   + '\n• Turrets ' + f(pw.turretDps) + '/s (' + s.defense.turrets + ')'
   + (pw.missileDps ? '\n• Missiles ' + f(pw.missileDps) + '/s' : '')
   + (pw.trapDmg ? '\n• Traps ' + f(pw.trapDmg) + ' per wave' : '')
   + '\nNext wave: ' + U().fmt(threat) + ' threat vs ' + U().fmt(pw.total) + ' damage (' + Math.round(ratio * 100) + '%)'
   + (ratio >= 1 ? ' — they fall before the wall' : ' — the wall will take hits')
   + '\nClick to open Defense';
 }

 /* ---------- notifications ---------- */
 // Compact pills stacked at the top of the bunker view, newest on top. A repeat of the same text
 // merges into one pill with a ×N counter; the same `key` (e.g. one room being upgraded again)
 // replaces the text instead of stacking. At most three are visible, hovering pauses the timer
 // and a tap dismisses.
 const TOAST_MAX = 3;
 function toast(msg, kind, ms, iconKey, opts) {
 const root = $('#toasts'); if (!root) return null;
 opts = opts || {}; kind = kind || 'info';
 const key = opts.key || kind + '|' + msg, dur = ms || (kind === 'err' ? 2400 : 3400);
 placeToasts();
 let el = Array.from(root.children).find(t => t.dataset.key === key && !t.classList.contains('out'));
 if (el) {
   if (el.dataset.msg === msg) { const n = (+el.dataset.n || 1) + 1; el.dataset.n = n; el.querySelector('.toast-n').textContent = '×' + n; el.classList.add('has-n'); }
   else { el.dataset.msg = msg; el.querySelector('.toast-msg').innerHTML = msg; }
   el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
   if (root.firstChild !== el) root.prepend(el);
   arm(el, dur); return el;
 }
 el = document.createElement('div');
 el.className = 'toast ' + kind; el.dataset.key = key; el.dataset.msg = msg; el.dataset.n = 1;
 const ic = iconKey || (kind === 'err' ? 'warning' : kind === 'warn' ? 'alert' : kind === 'ok' ? 'check' : 'info');
 el.innerHTML = `<span class="toast-ico">${ic.charAt(0) === '<' ? ic : DE.Icons.img(ic)}</span><span class="toast-msg">${msg}</span><b class="toast-n"></b><i class="toast-t"></i>`;
 el.addEventListener('click', () => dismissToast(el));
 el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { clearTimeout(el._t); el.classList.add('hold'); } });
 el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && el.classList.contains('hold')) { el.classList.remove('hold'); arm(el, 1500); } });
 root.prepend(el);
 requestAnimationFrame(() => el.classList.add('show'));
 arm(el, dur);
 Array.from(root.children).filter(t => !t.classList.contains('out')).slice(TOAST_MAX).forEach(dismissToast);
 return el;
 }
 function arm(el, ms) {
 clearTimeout(el._t);
 const bar = el.querySelector('.toast-t'); if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `toastT ${ms}ms linear forwards`; }
 el._t = setTimeout(() => dismissToast(el), ms);
 }
 function dismissToast(el) { if (!el || el.classList.contains('out')) return; clearTimeout(el._t); el.classList.add('out'); el.classList.remove('show'); setTimeout(() => el.remove(), 300); }
 /** Centre the stack over the bunker view, under the top bar (and under an open drawer's header). */
 function placeToasts() {
 const root = $('#toasts'), top = $('#topbar'), wrap = $('#bunker-wrap'), game = $('#game-screen'); if (!root || !top || !wrap || !game) return;
 const g = game.getBoundingClientRect(), r = wrap.getBoundingClientRect(), dr = $('#drawer');
 const open = !!dr && !dr.classList.contains('hidden');
 // over an open panel, notifications stack up from the bottom edge (the panel's header and first
 // buttons stay visible); over the bunker they hang from the top of the view
 root.classList.toggle('at-bottom', open);
 if (open) root.style.setProperty('--tb', Math.round(g.bottom - r.bottom + 14) + 'px');
 else root.style.top = Math.round(r.top - g.top + 10) + 'px';
 root.style.left = Math.round(r.left - g.left + r.width / 2) + 'px';
 root.style.maxWidth = Math.max(260, Math.min(520, r.width - 24)) + 'px';
 }
 window.addEventListener('resize', () => placeToasts());

 /* ---------- floaters ---------- */
 /** Feedback for a successful purchase: button pulse, floating cost, short toast. */
 function purchased(el, cost, msg) {
 DE.Audio.sfx(/upgrad/i.test(msg || '') ? 'upgrade' : 'buy');
 if (el) { el.classList.remove('bought'); void el.offsetWidth; el.classList.add('bought'); setTimeout(() => el.classList.remove('bought'), 700); }
 if (el && cost) { const r = el.getBoundingClientRect(); let i = 0; for (const k in cost) { if (!cost[k]) continue; const kk = k, ii = i; setTimeout(() => floatText(r.left + r.width / 2 + (ii % 2 ? 24 : -24), r.top - 4, '−' + DE.Util.fmt(cost[kk]), 'bad', DE.Icons.src('res.' + kk)), i * 120); i++; } }
 if (msg) toast(msg, 'ok', 2600, 'medal');
 }

 function floatText(x, y, text, cls, iconSrc) {
 if (!state().settings.animations) return;
 const root = $('#floaters'); if (!root) return;
 const el = document.createElement('div');
 el.className = 'floater ' + (cls || '');
 el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px';
 if (iconSrc) { const im = document.createElement('img'); im.src = iconSrc; im.className = 'ico ico-inline'; el.appendChild(im); }
 root.appendChild(el);
 setTimeout(() => el.remove(), 1300);
 }
 function floatAt(el, text, cls) {
 if (!el) return;
 const r = el.getBoundingClientRect();
 floatText(r.left + r.width / 2, r.top + 10, text, cls);
 }

 /* ---------- modal ---------- */
 function modal(opts) {
 const root = $('#modal-root');
 const buttons = (opts.buttons && !opts.buttons.length ? [] : (opts.buttons || [{ label: 'OK', action: 'closeModal', cls: 'primary' }]))
 .map(b => `<button class="btn ${b.cls || ''}" data-action="${b.action || 'closeModal'}" ${Object.keys(b.params || {}).map(k => `data-${k}="${esc(b.params[k])}"`).join('')}>${b.label}</button>`).join('');
 root.innerHTML = `<div class="modal-backdrop" data-action="${opts.locked ? 'noop' : 'closeModal'}"></div>
 <div class="modal panel ${opts.cls || ''}"><div class="modal-head"><h3>${opts.icon ? DE.Icons.img(opts.icon, 'ico-title') : ''}${opts.title || ''}</h3>${opts.locked ? '' : '<button class="btn close" data-action="closeModal">✕</button>'}</div>
 <div class="modal-body">${opts.html || ''}</div><div class="modal-foot">${buttons}</div></div>`;
 root.classList.remove('hidden');
 }
 /** A decision card: title, story text, one big button per choice. */
 function eventModal(ev) {
 DE.Audio.sfx('event');
 const s = state(); const buttons = ev.choices.map((c, i) => {
 const tr = c.trade; const can = DE.Events.canChoose(s, ev, i).ok;
 const label = tr ? `Give ${U().costText(tr.give)} for ${U().costText(tr.get)}` : esc(c.label);
 const chips = consequences(s, c).map(x => `<i class="cq ${x.cls}">${x.ic || ''}${x.t}</i>`).join('');
 return `<button class="btn choice ${i === 0 ? 'primary' : ''} ${can ? '' : 'cant'}" data-action="eventChoice" data-id="${ev.id}" data-i="${i}" ${can ? '' : 'disabled'}><kbd>${i + 1}</kbd><span><b>${label}</b>${c.desc ? `<small>${esc(c.desc)}</small>` : ''}<span class="cqs">${chips}</span></span></button>`; }).join('');
 // the people involved stand in the header scene
 const ids = ev.kind === 'expedition' ? (ev.ctx.members || []) : [ev.ctx.aId, ev.ctx.bId];
 const people = ids.map(id => s.survivors[id]).filter(Boolean).slice(0, 4);
 const cast = people.map((sv, i) => `<figure>${DE.Chars.portrait(sv.profession, { cls: i % 2 ? 'flip' : '' })}<figcaption>${esc(sv.name.split(' ')[0])}</figcaption></figure>`).join('');
 const eloc = ev.kind === 'expedition' && ev.ctx && DE.Expeditions.location(ev.ctx.location);
 const kind = ev.kind === 'expedition' ? 'On the road' + (eloc ? ' · ' + esc(eloc.name) : '') : 'Bunker event';
 modal({ title: `<span class="ev-kind">${kind}</span>${esc(ev.title)}`, icon: ev.kind === 'expedition' ? 'map' : 'scroll', cls: 'event ' + ev.kind, locked: true,
 html: `<div class="ev-stage ${ev.kind}">${cast || DE.Icons.img(ev.kind === 'expedition' ? 'map' : 'warning', 'ev-emblem')}</div><p class="story">${esc(ev.text)}</p><div class="choices">${buttons}</div>`, buttons: [] });
 }

 /** What a choice will do, as small coloured chips: gains green, costs red (dim when you cannot
  *  pay), gambles orange, rare finds gold. Built from the same effect keys DE.Events applies. */
 function consequences(s, c) {
 const out = [], fx = c.effects || {}, R = DE.Data.RESOURCES, im = (k) => DE.Icons.img(k, 'ico-inline');
 const res = (k, n) => { if (!n) return; const short = n < 0 && s.resources[k] + 1e-6 < -n; out.push({ cls: n > 0 ? 'good' : short ? 'bad short' : 'bad', ic: DE.Icons.res(k, 'ico-inline'), t: (n > 0 ? '+' : '−') + U().fmt(Math.abs(n)) + (short ? ' · have ' + U().fmt(s.resources[k]) : '') }); };
 if (c.trade) { for (const k in c.trade.give) res(k, -c.trade.give[k]); for (const k in c.trade.get) res(k, c.trade.get[k]); out.push({ cls: 'good', ic: im('people'), t: 'Traders +1' }); }
 for (const k in fx) {
   const v = fx[k];
   if (R[k]) { res(k, v); continue; }
   switch (k) {
     case 'loot': for (const r in v) res(r, Math.round(v[r] * DE.Events.bus(s).cargo)); break;
     case 'lootMult': out.push({ cls: v >= 1 ? 'good' : 'bad', ic: im('chest'), t: 'Haul ' + (v >= 1 ? '+' : '−') + Math.round(Math.abs(1 - v) * 100) + '%' }); break;
     case 'injure': out.push({ cls: 'risk', ic: im('medkit'), t: Math.round(v[0] * 100) + '% injury risk' }); break;
     case 'heal': out.push({ cls: 'good', ic: im('medkit'), t: 'Heal all +' + v }); break;
     case 'rescue': case 'recruit': if (v) { const bed = DE.Bunker.population(s) < DE.Bunker.housingCapacity(s); out.push({ cls: bed ? 'good' : 'warn', ic: im('pop'), t: bed ? '+1 survivor' : 'No free bed!' }); } break;
     case 'artifact': out.push({ cls: 'gold', ic: im('artifacts'), t: 'Artifact' }); break;
     case 'artifactOrScrap': out.push({ cls: 'gold', ic: im('artifacts'), t: '40% artifact, else +' + v + ' scrap' }); break;
     case 'morale': out.push({ cls: v >= 0 ? 'good' : 'bad', ic: im('morale'), t: (v > 0 ? '+' : '−') + Math.abs(v) + ' morale' }); break;
     case 'shock': out.push({ cls: 'bad', ic: im('morale'), t: 'Morale shaken' }); break;
     case 'rep': for (const f in v) out.push({ cls: v[f] >= 0 ? 'good' : 'bad', ic: im('people'), t: DE.Data.FACTIONS[f].name.split(' ').pop() + ' ' + (v[f] > 0 ? '+' : '') + v[f] }); break;
     case 'xp': case 'xpA': out.push({ cls: 'good', ic: im('star'), t: '+' + v + ' XP' }); break;
     case 'restA': out.push({ cls: 'good', ic: im('morale'), t: 'Fully rested' }); break;
     case 'energyA': out.push({ cls: v >= 0 ? 'good' : 'bad', ic: im('power'), t: (v > 0 ? '+' : '−') + Math.abs(v) + ' energy' }); break;
     case 'bond': case 'bondAB': out.push({ cls: 'good', ic: im('people'), t: 'Friendship' }); break;
     case 'waterPct': case 'electricityPct': out.push({ cls: 'bad', ic: DE.Icons.res(k === 'waterPct' ? 'water' : 'electricity', 'ico-inline'), t: '−' + Math.round(-v * 100) + '% stored' }); break;
     case 'traps': out.push({ cls: 'good', ic: im('traps'), t: '+' + v + ' traps' }); break;
     case 'risk': out.push({ cls: 'risk', ic: im('biohazard'), t: Math.round(v[0] * 100) + '% infected' }); break;
     case 'buff': out.push({ cls: 'good', ic: DE.Icons.room(v[0], 'ico-inline'), t: DE.Data.ROOMS[v[0]].name + ' +' + Math.round(v[1] * 100) + '% for ' + Math.round(v[2] / 60) + 'm' }); break;
     case 'noiseCalm': out.push({ cls: 'good', ic: im('noise'), t: 'Horde quieter ' + Math.round(v / 60) + 'm' }); break;
     case 'delay': out.push({ cls: 'bad', ic: im('timer'), t: '+' + U().fmtTime(v) + ' trip' }); break;
     case 'hurry': out.push({ cls: 'good', ic: im('timer'), t: '−' + U().fmtTime(v) + ' trip' }); break;
     case 'gamble': {
       out.push({ cls: 'risk', ic: im('star'), t: Math.round(v[0] * 100) + '% chance:' });
       consequences(s, { effects: v[1] || {} }).forEach(x => out.push(x));
       out.push({ cls: 'none', t: 'or else:' });
       consequences(s, { effects: v[2] || {} }).forEach(x => out.push(x));
       break;
     }
     default: break;
   }
 }
 if (!out.length) out.push({ cls: 'none', t: 'Nothing changes' });
 return out;
 }

 function closeModal() { const root = $('#modal-root'); root.classList.add('hidden'); root.innerHTML = ''; }
 function confirmModal(title, html, onYes, yesLabel) {
 DE.UI._confirmCb = onYes;
 modal({ title, html, cls: 'confirm', icon: 'warning', buttons: [{ label: 'Cancel', action: 'closeModal', cls: 'danger' }, { label: yesLabel || 'Confirm', action: 'confirmYes', cls: 'green' }] });
 }

 /* ---------- drawers ---------- */
 function openDrawer(name) {
 ui.drawer = name; ui.lastDrawerHtml = '';
 $('#drawer').classList.remove('hidden');
 document.querySelectorAll('#bottombar .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === name));
 renderDrawer(); placeToasts();
 }
 function closeDrawer() {
 ui.drawer = null;
 $('#drawer').classList.add('hidden');
 document.querySelectorAll('#bottombar .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === 'bunker'));
 placeToasts();
 }
 function renderDrawer(force) {
 if (!ui.drawer) return;
 const def = DE.UI.Drawers[ui.drawer]; if (!def) return;
 if (!force && def.live === false && ui.lastDrawerHtml) return; // drawers with text inputs only re-render on demand
 $('#drawer-title').innerHTML = DE.Icons.nav(ui.drawer, 'ico-title') + def.title(state());
 if (!force && scrollBusy($('#drawer-body'))) { if (def.tick) def.tick(state()); return; }
 const html = def.render(state());
 if (force || html !== ui.lastDrawerHtml) {
 const body = $('#drawer-body'); const st = body.scrollTop;
 body.innerHTML = html; body.scrollTop = st; ui.lastDrawerHtml = html;
 }
 if (def.tick) def.tick(state());   // live bits (positions, timers) without rebuilding the HTML
 }

 /* ---------- full refresh ---------- */
 function refresh(force) {
 const s = state(); if (!s) return;
 if (s._dirtyBunker || force) { DE.UI.Bunker.render(); s._dirtyBunker = false; }
 DE.UI.Bunker.update();
 updateResbar();
 DE.UI.Side.render(force);
 renderDrawer(force);
 }

 return { ui, $, esc, init, showScreen, renderResbar, updateResbar, toast, purchased, floatText, floatAt, modal, eventModal, closeModal, confirmModal,
 openDrawer, closeDrawer, renderDrawer, refresh, state, scrollBusy  };
})();
