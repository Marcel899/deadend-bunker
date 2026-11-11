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

 function init() {
 document.addEventListener('click', onClick);
 document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal-root').classList.contains('hidden')) closeModal(); else closeDrawer(); } });
 renderResbar();
 }

 function onClick(e) {
 const el = e.target.closest('[data-action]');
 if (!el || el.disabled) return;
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
 if (name === 'menu') {
 $('#btn-continue').style.display = DE.Save.hasSave() ? '' : 'none';
 renderMenuHorde();
 }
 }

 function renderMenuHorde() {
 const h = $('.menu-horde'); if (!h || h.children.length) return;
 const Z = DE.Data.ZOMBIES.filter(z => !z.boss);
 let html = '';
 for (let i = 0; i < 14; i++) {
 const z = Z[i % Z.length];
 html += `<span class="mz" style="left:${(i * 8 + Math.random() * 4)}%;animation-delay:${-(Math.random() * 6).toFixed(2)}s;animation-duration:${(5 + Math.random() * 4).toFixed(2)}s;">${DE.Chars.zombie(z.id, { anim: 'walk', h: (60 + Math.random() * 40) | 0, flip: true })}</span>`;
 }
 h.innerHTML = html;
 }

 /* ---------- top bar ---------- */
 function renderResbar() {
 const R = DE.Data.RESOURCES;
 $('#resbar').innerHTML = DE.Data.RESOURCE_ORDER.map(r => `<div class="res" data-res="${r}" title="${R[r].name}" data-action="openDrawer" data-drawer="economy">
 <span class="res-icon">${DE.Icons.res(r)}</span>
 <span class="res-body"><b class="res-amt">0</b><i class="res-rate">+0/s</i></span>
 <div class="res-cap"><i></i></div>
 </div>`).join('');
 $('#chips').innerHTML = `<div class="chip" id="chip-pop" data-action="openDrawer" data-drawer="survivors" title="Population / housing">${DE.Icons.img('pop')}<b>0/0</b></div>
 <div class="chip" id="chip-morale" title="Morale">${DE.Icons.img('morale')}<b>60</b></div>
 <div class="chip" id="chip-wave" data-action="openDrawer" data-drawer="defense" title="Next zombie wave">${DE.Icons.img('wave')}<b>--</b></div>
 <div class="chip" id="chip-lp" data-action="openDrawer" data-drawer="legacy" title="Legacy Points">${DE.Icons.img('res.legacy')}<b>0</b></div>`;
 }

 function updateResbar() {
 const s = state(); const rates = s._rates; if (!rates) return;
 document.querySelectorAll('#resbar .res').forEach(el => {
 const r = el.dataset.res;
 const amt = s.resources[r], net = rates.net[r], cap = DE.Economy.storageCap(s, r);
 el.querySelector('.res-amt').textContent = U().fmt(amt);
 const rateEl = el.querySelector('.res-rate');
 rateEl.textContent = U().fmtRate(net);
 rateEl.className = 'res-rate ' + (net < -1e-6 ? 'neg' : net > 1e-6 ? 'pos' : '');
 const capEl = el.querySelector('.res-cap i');
 if (isFinite(cap)) { capEl.style.width = Math.min(100, amt / cap * 100) + '%'; capEl.parentElement.style.display = ''; capEl.parentElement.className = 'res-cap' + (amt >= cap * 0.98 ? ' full' : ''); }
 else capEl.parentElement.style.display = 'none';
 el.classList.toggle('empty', amt <= 0.01 && net < 0);
 const eta = net < -1e-6 ? '\nEmpty in ' + U().fmtTime(amt / -net) : (net > 1e-6 && isFinite(cap) && amt < cap) ? '\nFull in ' + U().fmtTime((cap - amt) / net) : '';
 el.title = DE.Data.RESOURCES[r].name + (isFinite(cap) ? ' · cap ' + U().fmt(cap) : '') + '\n+' + U().fmt(rates.production[r], 2) + '/s  −' + U().fmt(rates.consumption[r], 2) + '/s' + eta + '\nClick for the production dashboard';
 });
 const pop = DE.Bunker.population(s), cap = DE.Bunker.housingCapacity(s);
 $('#chip-pop b').textContent = pop + '/' + cap;
 $('#chip-pop').classList.toggle('warn', pop > cap);
 const m = Math.round(s.morale);
 const mc = $('#chip-morale'); mc.querySelector('b').textContent = m;
 mc.className = 'chip ' + (m >= 50 ? 'good' : m >= 30 ? 'warn' : 'bad');
 mc.title = 'Morale ' + m + ' → production ×' + DE.Economy.moraleMult(s.morale).toFixed(2);
 const secs = (s.defense.nextWaveAt - Date.now()) / 1000;
 $('#chip-wave b').textContent = 'W' + s.defense.wave + '' + U().fmtTime(secs);
 $('#chip-wave').classList.toggle('warn', secs < 30);
 $('#chip-lp b').textContent = U().fmt(s.prestige.points);
 $('#chip-lp').style.display = (s.prestige.lifetime > 0 || s.stats.maxDepth >= 3) ? '' : 'none';
 }

 /* ---------- toasts & floaters ---------- */
 function toast(msg, kind, ms, iconKey) {
 const root = $('#toasts'); if (!root) return;
 const dup = Array.from(root.children).find(t => t.dataset.msg === msg);
 if (dup) { dup.classList.add('show'); clearTimeout(dup._t); dup._t = setTimeout(() => { dup.classList.remove('show'); setTimeout(() => dup.remove(), 400); }, ms || 3200); return; }
 const el = document.createElement('div'); el.dataset.msg = msg;
 el.className = 'toast ' + (kind || '');
 const ic = iconKey || (kind === 'err' ? 'warning' : kind === 'warn' ? 'wave' : 'morale');
 el.innerHTML = `<span class="toast-ico ${kind || ''}">${DE.Icons.img(ic)}</span><span>${msg}</span>`;
 root.appendChild(el);
 requestAnimationFrame(() => el.classList.add('show'));
 el._t = setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 400); }, ms || 3200);
 while (root.children.length > 3) root.firstChild.remove();
 }
 /** Feedback for a successful purchase: button pulse, floating cost, short toast. */
 function purchased(el, cost, msg) {
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
 const buttons = (opts.buttons || [{ label: 'OK', action: 'closeModal', cls: 'primary' }])
 .map(b => `<button class="btn ${b.cls || ''}" data-action="${b.action || 'closeModal'}" ${Object.keys(b.params || {}).map(k => `data-${k}="${esc(b.params[k])}"`).join('')}>${b.label}</button>`).join('');
 root.innerHTML = `<div class="modal-backdrop" data-action="${opts.locked ? 'noop' : 'closeModal'}"></div>
 <div class="modal panel ${opts.cls || ''}"><div class="modal-head"><h3>${opts.icon ? DE.Icons.img(opts.icon, 'ico-title') : ''}${opts.title || ''}</h3>${opts.locked ? '' : '<button class="btn close" data-action="closeModal">✕</button>'}</div>
 <div class="modal-body">${opts.html || ''}</div><div class="modal-foot">${buttons}</div></div>`;
 root.classList.remove('hidden');
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
 renderDrawer();
 }
 function closeDrawer() {
 ui.drawer = null;
 $('#drawer').classList.add('hidden');
 document.querySelectorAll('#bottombar .nav-btn').forEach(b => b.classList.toggle('active', b.dataset.nav === 'bunker'));
 }
 function renderDrawer(force) {
 if (!ui.drawer) return;
 const def = DE.UI.Drawers[ui.drawer]; if (!def) return;
 if (!force && def.live === false && ui.lastDrawerHtml) return; // drawers with text inputs only re-render on demand
 $('#drawer-title').innerHTML = DE.Icons.nav(ui.drawer, 'ico-title') + def.title(state());
 const html = def.render(state());
 if (force || html !== ui.lastDrawerHtml) {
 const body = $('#drawer-body'); const st = body.scrollTop;
 body.innerHTML = html; body.scrollTop = st; ui.lastDrawerHtml = html;
 }
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

 return { ui, $, esc, init, showScreen, renderResbar, updateResbar, toast, purchased, floatText, floatAt, modal, closeModal, confirmModal,
 openDrawer, closeDrawer, renderDrawer, refresh, state };
})();
