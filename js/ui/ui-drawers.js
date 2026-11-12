/* Drawer screens: survivors, research, excavation, defense, expeditions, legacy, settings. */
var DE = globalThis.DE = globalThis.DE || {};

DE.UI.Drawers = (function () {
 const U = () => DE.Util;
 const esc = (s) => DE.Util.escapeHtml(s);
 const R = () => DE.Data.RESOURCES;
 const P = () => DE.Data.PROFESSIONS;
 const bar = (pct, cls) => DE.UI.Side.bar(pct, cls);
 const ui = () => DE.UI.ui;

 function assignmentText(s, sv) {
 const a = sv.assignment; if (!a) return '<span class="muted"> Idle</span>';
 if (a.kind === 'guard') return ' Guard duty';
 if (a.kind === 'expedition') { const e = s.expeditions.active.find(x => x.id === a.id); const loc = e && DE.Expeditions.location(e.location); return '' + (loc ? DE.Icons.img('location', 'ico-inline') + '' + esc(loc.name) : 'Away'); }
 const room = s.rooms[a.id]; return room ? DE.Icons.room(room.type, 'ico-inline') + '' + esc(DE.Data.ROOMS[room.type].name) + ' B' + room.floor : 'Working';
 }

 function moodIcon(m) { return m >= 75 ? '' : m >= 50 ? '' : m >= 30 ? '' : ''; }

 /* A survivor card: sprite portrait on a rarity backdrop, identity, level ring, vitals, strengths,
  * traits and what they are doing — plus the assign / unassign actions. */
 function survivorCard(s, sv, extra) {
 const need = DE.Survivors.xpNeeded(sv.level); const fx = s._fx;
 const away = sv.assignment && sv.assignment.kind === 'expedition';
 const rar = DE.Data.RARITIES[sv.rarity] || DE.Data.RARITIES.common; const mood = DE.Survivors.mood(s, sv);
 const room = sv.assignment && sv.assignment.kind === 'room' ? s.rooms[sv.assignment.id] : null;
 const def = room ? DE.Data.ROOMS[room.type] : null;
 const eff = Math.round(100 * DE.Survivors.efficiency(sv, def, fx));
 const best = def && def.profession === sv.profession;
 const traits = (sv.traits || []).map(t => { const d = DE.Data.TRAITS[t]; return d ? `<span class="sc-trait" title="${esc(d.desc)}">${esc(d.name)}</span>` : ''; }).join('');
 const friends = Object.keys(sv.bonds || {}).filter(id => sv.bonds[id] >= 60 && s.survivors[id]).map(id => esc(s.survivors[id].name.split(' ')[0]));
 const vbar = (label, v, cls) => `<div class="sc-vital" title="${label} ${Math.round(v)}%"><small>${label}</small><span class="sc-bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></span></div>`;
 const xpPct = Math.min(100, 100 * sv.xp / need);
 return `<div class="sc rar-${rar.id} ${sv.hp < 50 ? 'hurt' : ''}" style="--rc:${rar.color}">
 <div class="sc-portrait"><div class="sc-glow"></div>${DE.Chars.portrait(sv.profession, { title: P()[sv.profession].name })}
   <span class="sc-lvl" style="--xp:${xpPct}%" title="Level ${sv.level} · ${Math.round(sv.xp)}/${need} XP"><b>${sv.level}</b></span>
   <span class="sc-rar">${esc(rar.name)}</span></div>
 <div class="sc-body">
   <div class="sc-name"><b>${esc(sv.name)}</b><span class="sc-prof">${DE.Icons.prof(sv.profession, 'ico-inline')}${P()[sv.profession].name}</span></div>
   <div class="sc-doing"><span class="act-tag act-${sv.act ? sv.act.kind : 'idle'}">${DE.Needs.describe(sv)}</span><span class="sc-where">${assignmentText(s, sv)}</span></div>
   <div class="sc-stats"><span title="Work efficiency${def ? ' in ' + def.name : ''}"><small>Work</small><b class="${best ? 'pos' : ''}">${eff}%</b></span><span title="Damage per second on guard duty"><small>Guard</small><b>${U().fmt(DE.Survivors.guardPower(sv, fx), 1)}</b></span><span title="Mood"><small>Mood</small><b class="${mood >= 50 ? 'pos' : mood >= 30 ? 'warn' : 'neg'}">${Math.round(mood)}</b></span></div>
   <div class="sc-vitals">${vbar('Health', sv.hp, 'hp')}${vbar('Energy', sv.energy == null ? 100 : sv.energy, 'en')}${vbar('Fed', 100 - (sv.hunger == null ? 0 : sv.hunger), 'fd')}</div>
   ${traits || friends.length ? `<div class="sc-traits">${traits}${friends.length ? `<span class="sc-trait friend" title="Friends work 4% better together">♥ ${friends.join(', ')}</span>` : ''}</div>` : ''}
   <div class="sc-actions">${extra != null ? extra : (away ? '<small class="muted">Away on an expedition</small>' : `<button class="btn small primary" data-action="openAssignSurvivor" data-sid="${sv.id}">Assign…</button>${sv.assignment ? `<button class="btn small" data-action="unassign" data-sid="${sv.id}">Unassign</button>` : ''}`)}</div>
 </div></div>`;
 }

 /* ================= SURVIVORS ================= */
 const survivors = {
 title: (s) => `Survivors <small>${DE.Bunker.population(s)} / ${DE.Bunker.housingCapacity(s)} housing</small>`,
 render(s) {
 const cost = DE.Survivors.recruitCost(s); const can = DE.Survivors.canRecruit(s);
 const filter = ui().survivorFilter || 'all';
 const all = Object.values(s.survivors);
 const groups = { all: all, idle: all.filter(v => !v.assignment), working: all.filter(v => v.assignment && v.assignment.kind === 'room'), guards: all.filter(v => v.assignment && v.assignment.kind === 'guard'), away: all.filter(v => v.assignment && v.assignment.kind === 'expedition'), hurt: all.filter(v => v.hp < 100) };
 const list = (groups[filter] || all).slice().sort((a, b) => (b.level - a.level) || a.name.localeCompare(b.name));
 const filters = [['all', 'All'], ['idle', 'Idle'], ['working', 'Working'], ['guards', 'Guards'], ['away', 'Away'], ['hurt', 'Hurt']];
 const odds = Object.values(DE.Data.RARITIES); const tw = odds.reduce((a, r) => a + r.weight, 0);
 const pop = DE.Bunker.population(s), capH = DE.Bunker.housingCapacity(s);
 return `<div class="sv-top">
   <div class="rc-card"><div class="rc-radio"><span class="rv-signal"><i></i><i></i><i></i></span>${DE.Icons.img('signal', 'rc-ico')}</div>
     <div class="rc-text"><b>Recruit a survivor</b><small>Someone out there is always listening. Who answers is up to fate.</small>
       <div class="rc-odds">${odds.map(r => `<span style="--c:${r.color}"><i></i>${r.name} ${Math.round(100 * r.weight / tw)}%</span>`).join('')}</div></div>
     <div class="rc-go"><button class="btn primary ${can.ok ? '' : 'cant'}" data-action="recruit" ${can.ok ? '' : 'disabled'}>${DE.Icons.img('signal', 'ico-btn')} Call on the radio <span class="cost">${U().costText(cost)}</span></button>${can.ok ? '' : `<small class="neg">${esc(can.reason)}</small>`}</div></div>
   <div class="sv-sum">
     <div><small>Housing</small><b class="${pop >= capH ? 'warn' : ''}">${pop}/${capH}</b></div>
     <div><small>Morale</small><b class="${s.morale >= 50 ? 'pos' : s.morale >= 30 ? 'warn' : 'neg'}">${Math.round(s.morale)}</b></div>
     <div><small>Output bonus</small><b>×${DE.Economy.moraleMult(s.morale).toFixed(2)}</b></div>
     <div><small>Food & water</small><b>${(DE.CONFIG.SURVIVOR_FOOD * 60 * all.length).toFixed(1)}/min</b></div>
   </div></div>
 <div class="sv-tabs">${filters.map(([k, l]) => `<button class="btn small ${filter === k ? 'active' : ''}" data-action="setFilter" data-filter="${k}">${l} <span class="cost">${groups[k].length}</span></button>`).join('')}</div>
 <div class="sv-grid">${list.length ? list.map(v => survivorCard(s, v)).join('') : '<p class="muted">Nobody here.</p>'}</div>`;
 },
 };


 /* ================= ECONOMY DASHBOARD ================= */
 /* Production dashboard: alerts first, then one tile per resource (net rate, in/out, stock meter,
  * forecast), the power grid and crew upkeep, the multipliers in play, and every producing room
  * grouped by what it makes, each with an efficiency meter that names what holds it back. */
 const PD_STATUS = { crit: 'warning', warn: 'alert', ok: null };
 function pdTile(s, r, id) {
 const d = R()[id], stock = s.resources[id], cap = DE.Economy.storageCap(s, id), net = r.net[id], inn = r.production[id], out = r.consumption[id];
 let eta = 'Stable', st = 'ok', badge = '';
 const T = (sec) => sec >= 3600 || sec < 600 ? U().fmtTime(sec) : Math.round(sec / 60) + 'm';   // "46m", "4m 12s", "1h 09m"
 if (net < -1e-6) { const t = stock / -net; eta = 'Empty in ' + T(t); if (t < 300) { st = 'crit'; badge = stock <= .01 ? 'Empty!' : 'Running out'; } }
 else if (net > 1e-6 && isFinite(cap)) { if (stock >= cap - 1) { eta = 'Storage full'; st = 'warn'; badge = 'Full'; } else eta = 'Full in ' + T((cap - stock) / net); }
 else if (net > 1e-6) eta = 'Growing';
 if (stock <= .01 && out > 0) { st = 'crit'; badge = 'Empty!'; }
 const pct = isFinite(cap) ? Math.min(100, stock / cap * 100) : 0;
 const tip = `${d.name}: ${U().fmt(stock)}${isFinite(cap) ? ' of ' + U().fmt(cap) : ''}\nIncome +${U().fmt(inn, 2)}/s, use −${U().fmt(out, 2)}/s\n${eta}`;
 return `<div class="pd-tile ${st}" style="--rc:${d.color}" title="${esc(tip)}">
 <div class="pd-th">${DE.Icons.res(id, 'pd-ico')}<span>${d.name}</span>${badge ? `<em class="pd-badge ${st}">${DE.Icons.img(PD_STATUS[st], 'ico-inline')}${badge}</em>` : ''}</div>
 <div class="pd-net ${net < -1e-6 ? 'down' : net > 1e-6 ? 'up' : ''}">${net < -1e-6 ? '▼' : net > 1e-6 ? '▲' : '•'} ${U().fmt(Math.abs(net), Math.abs(net) < 10 ? 2 : undefined)}<small>/s</small></div>
 <div class="pd-io"><span>+${U().fmt(inn, 2)} in</span><span>−${U().fmt(out, 2)} out</span></div>
 ${isFinite(cap) ? `<div class="pd-meter"><i style="width:${pct.toFixed(1)}%"></i></div>` : '<div class="pd-meter none"></div>'}
 <div class="pd-stock"><span><b>${U().fmt(stock)}</b>${isFinite(cap) ? ' / ' + U().fmt(cap) : ''}</span><span class="pd-eta">${eta}</span></div></div>`;
 }
 function pdMeter(pct, sev) { return `<span class="pd-bar ${sev}"><i style="width:${Math.max(0, Math.min(100, pct)).toFixed(1)}%"></i></span>`; }
 const economy = {
 title: (s) => `Production <small>morale ×${DE.Economy.moraleMult(s.morale).toFixed(2)} · power ${s._rates.powerFactor < 1 ? '<span class="neg">brownout ×' + s._rates.powerFactor.toFixed(2) + '</span>' : 'OK'}</small>`,
 render(s) {
 const r = s._rates, fx = DE.Effects.get(s);
 // alerts: icon + text, most severe first
 const alerts = [];
 if (r.powerFactor < 1) alerts.push({ sev: 'crit', ic: 'power', t: `<b>Brownout</b> — demand ${U().fmt(r.powerUse, 2)}/s is above supply ${U().fmt(r.powerGen, 2)}/s, powered rooms run at ${Math.round(r.powerFactor * 100)}%. Build or staff a generator.` });
 DE.Data.RESOURCE_ORDER.forEach(id => { if (s.resources[id] <= 0.01 && r.consumption[id] > 0) alerts.push({ sev: 'crit', ic: 'res.' + id, t: `<b>Out of ${R()[id].name}</b> — rooms that need it are starved.` }); });
 ['food', 'water'].forEach(id => { if (r.net[id] < 0 && s.resources[id] > 0.01 && s.resources[id] / -r.net[id] < 600) alerts.push({ sev: 'warn', ic: 'res.' + id, t: `<b>${R()[id].name}</b> runs out in ${U().fmtTime(s.resources[id] / -r.net[id])}.` }); });
 const idle = DE.Survivors.idle(s).length; if (idle) alerts.push({ sev: 'info', ic: 'pop', t: `<b>${idle} idle survivor${idle > 1 ? 's' : ''}</b> — put them to work for more output.` });
 const alertHtml = alerts.length ? `<div class="pd-alerts">${alerts.map(a => `<div class="pd-alert ${a.sev}">${DE.Icons.img(a.ic, 'pd-aico')}<span>${a.t}</span></div>`).join('')}</div>` : `<div class="pd-alerts"><div class="pd-alert good">${DE.Icons.img('check', 'pd-aico')}<span><b>All systems running</b> — no shortages.</span></div></div>`;
 const tiles = DE.Data.RESOURCE_ORDER.map(id => pdTile(s, r, id)).join('');
 // power grid + crew upkeep + multipliers
 const load = r.powerGen > 0 ? r.powerUse / r.powerGen : (r.powerUse > 0 ? 2 : 0);
 const grid = `<div class="pd-card pd-grid"><h4>${DE.Icons.img('power', 'ico-inline')} Power grid</h4>
 <div class="pd-kv"><span>Load</span>${pdMeter(load * 100, load > 1 ? 'crit' : load > .85 ? 'warn' : 'ok')}<b>${Math.round(load * 100)}%</b></div>
 <p class="pd-sub">${U().fmt(r.powerGen, 2)}/s generated · ${U().fmt(r.powerUse, 2)}/s used${s.defense.turrets ? ' (turrets included)' : ''}</p></div>`;
 const pop = DE.Bunker.population(s);
 const crew = `<div class="pd-card"><h4>${DE.Icons.img('pop', 'ico-inline')} Crew upkeep <small>${pop} survivors</small></h4>
 <div class="pd-kv"><span>${DE.Icons.res('food', 'ico-inline')} Eat</span><b>${U().fmt(r.survivorFood, 2)}/s</b></div>
 <div class="pd-kv"><span>${DE.Icons.res('water', 'ico-inline')} Drink</span><b>${U().fmt(r.survivorWater, 2)}/s</b></div></div>`;
 const season = DE.Season ? DE.Season.clock(s) : null, sm = DE.Season ? DE.Season.mods(s) : null;
 const mm = DE.Economy.moraleMult(s.morale);
 const mods = `<div class="pd-card"><h4>${DE.Icons.img('up', 'ico-inline')} Multipliers</h4>
 <div class="pd-kv"><span>${DE.Icons.img('morale', 'ico-inline')} Morale ${Math.round(s.morale)}</span><b class="${mm >= 1 ? 'pos' : 'neg'}">×${mm.toFixed(2)}</b></div>
 ${fx.globalMult ? `<div class="pd-kv"><span>${DE.Icons.img('research', 'ico-inline')} Research & legacy</span><b class="pos">+${Math.round(fx.globalMult * 100)}%</b></div>` : ''}
 ${season ? `<div class="pd-kv"><span>${DE.Icons.img('timer', 'ico-inline')} ${season.seasonName}</span><b>${esc(sm.label)}</b></div>` : ''}</div>`;
 // rooms grouped by product
 const groups = {}; const support = [];
 Object.values(s.rooms).filter(x => x.level > 0 && r.perRoom[x.id]).forEach(x => {
   const i = r.perRoom[x.id], def = DE.Data.ROOMS[x.type], key = Object.keys(i.produces)[0];
   (key ? (groups[key] = groups[key] || []) : support).push({ x, i, def });
 });
 const roomRow = ({ x, i, def }) => {
   const eff = i.workerMult * i.power * i.starve;
   const why = i.starve < 1 ? 'no input' : i.power < 1 ? 'brownout' : def.workers && x.workers.length < def.workers ? 'needs workers' : i.workerMult < .95 ? 'tired crew' : '';
   const pips = def.workers ? `<span class="pd-pips" title="${x.workers.length}/${def.workers} workers">${Array.from({ length: def.workers }, (_, k) => `<i class="${k < x.workers.length ? 'on' : ''}"></i>`).join('')}</span>` : '<span class="pd-pips"></span>';
   const out = Object.keys(i.produces).map(k => `<span class="pos">+${U().fmt(i.produces[k], 2)}${DE.Icons.res(k, 'ico-inline')}</span>`).join(' ');
   const inp = Object.keys(i.consumes).map(k => `<span class="neg">−${U().fmt(i.consumes[k], 2)}${DE.Icons.res(k, 'ico-inline')}</span>`).join(' ') + (i.powerUse ? ` <span class="neg">−${U().fmt(i.powerUse, 2)}${DE.Icons.res('electricity', 'ico-inline')}</span>` : '');
   const tip = `${def.name} · B${x.floor} level ${x.level}\nStaff ×${i.workerMult.toFixed(2)} · power ×${i.power.toFixed(2)}${i.starve < 1 ? ' · starved' : ''}${i.adjacency ? '\nNeighbour bonus +' + Math.round(i.adjacency * 100) + '%' : ''}${i.seasonal !== 1 ? '\nSeason ×' + i.seasonal.toFixed(2) : ''}\nClick to select`;
   return `<div class="pd-room" data-action="selectRoom" data-id="${x.id}" title="${esc(tip)}">${DE.Icons.room(def.id, 'pd-rico')}<span class="pd-rn"><b>${esc(def.name)}</b><small>B${x.floor} · Lv ${x.level}</small></span>${pips}<span class="pd-eff">${pdMeter(eff * 100, eff >= .9 ? 'ok' : eff >= .6 ? 'warn' : 'crit')}<small>${Math.round(eff * 100)}%${why ? ' · ' + why : ''}</small></span><span class="pd-out">${out}${inp ? '<br>' + inp : ''}</span></div>`;
 };
 const groupHtml = DE.Data.RESOURCE_ORDER.filter(k => groups[k]).map(k => {
   const total = groups[k].reduce((a, q) => a + (q.i.produces[k] || 0), 0);
   return `<div class="pd-group"><div class="pd-gh">${DE.Icons.res(k, 'ico-inline')} ${R()[k].name}<span class="pos">+${U().fmt(total, 2)}/s</span></div>${groups[k].sort((a, b) => (b.i.produces[k] || 0) - (a.i.produces[k] || 0)).map(roomRow).join('')}</div>`;
 }).join('');
 const supportHtml = support.length ? `<div class="pd-group"><div class="pd-gh">${DE.Icons.img('home', 'ico-inline')} Support rooms</div>${support.map(roomRow).join('')}</div>` : '';
 return `${alertHtml}<div class="pd-tiles">${tiles}${grid}</div><div class="pd-row">${crew}${mods}</div>
 <div class="card pd-rooms"><h4>Rooms <small class="muted">grouped by what they make · click one to select it</small></h4>${groupHtml || '<p class="muted">No producing rooms yet.</p>'}${supportHtml}</div>`;
 },
 };

 /* ================= RESEARCH ================= */
 /* Research: a tech tree per branch. Nodes sit in tiers by prerequisite depth and are joined by
  * connector lines; each card shows an effect icon, name, cost/time and its state. */
 const RS_ICON = { roomMult: null, consumptionMult: 'recycle', unmannedBase: 'gear', storageMult: 'chest', globalMult: 'up', unlockRoom: 'build', buildTimeMult: 'timer', maxFloor: 'dig2',
   powerUseMult: 'power', excavationCostMult: 'dig2', unlockTurrets: 'turret', buildCostMult: 'coin', fuelUseMult: 'res.fuel', noiseMult: 'noise', healMult: 'medkit', housingPerLevel: 'rooms',
   unlockTraps: 'traps', wallHpMult: 'wallicon', workerEff: 'repair2', guardDmgMult: 'guards', turretDmgMult: 'turret', moraleBonus: 'morale', survivorConsumptionMult: 'res.food', offlineCapHours: 'timer', xpMult: 'star' };
 function rsIcon(n) { const e = n.effects[0] || {}; if (e.type === 'roomMult' || e.type === 'unlockRoom') return DE.Icons.room(e.room, 'rs-ico'); return DE.Icons.img(RS_ICON[e.type] || 'research', 'rs-ico'); }
 function rsLayout(nodes) {
   const depth = {}; const d = (n) => depth[n.id] != null ? depth[n.id] : (depth[n.id] = n.requires.length ? 1 + Math.max(...n.requires.map(r => d(DE.Data.RESEARCH[r]))) : 0);
   nodes.forEach(d); const tiers = []; nodes.forEach(n => (tiers[depth[n.id]] = tiers[depth[n.id]] || []).push(n));
   // order each tier by the average column of its parents so lines cross less
   const col = {}; tiers.forEach((t, i) => { if (i) t.sort((a, b) => avg(a) - avg(b)); t.forEach((n, k) => col[n.id] = k); });
   function avg(n) { return n.requires.reduce((s, r) => s + (col[r] || 0), 0) / Math.max(1, n.requires.length); }
   return { tiers, col, depth };
 }
 const research = {
 title: (s) => `Research <small>${U().fmt(s.resources.research)} research points available</small>`,
 render(s) {
 const cur = s.research.current; const now = Date.now(); const B = DE.Data.RESEARCH_BRANCHES;
 const hasLab = Object.values(s.rooms).some(r => (r.type === 'lab' || r.type === 'server') && r.level > 0);
 const rate = (s._rates && s._rates.net && s._rates.net.research) || 0;
 let html = `<div class="rs-top"><div class="rs-points">${DE.Icons.img('research', 'rs-big')}<span><small>Research points</small><b>${U().fmt(s.resources.research)}</b><i class="${rate > 0 ? 'pos' : ''}">${U().fmtRate(rate)}</i></span></div>`;
 if (cur) { const n = DE.Data.RESEARCH[cur.id]; const pct = 100 * (1 - (cur.endsAt - now) / (cur.duration * 1000));
   html += `<div class="rs-current">${rsIcon(n)}<div><small>Researching</small><b>${esc(n.name)}</b><div class="dk-bar"><i style="width:${pct}%;background:linear-gradient(180deg,#d7a6ff,#9a5ae0)"></i></div><small>${U().fmtTime((cur.endsAt - now) / 1000)} left</small></div><button class="btn small danger" data-action="cancelResearch">Cancel</button></div>`; }
 else html += `<div class="rs-current idle">${DE.Icons.img(hasLab ? 'info' : 'warning', 'rs-ico')}<div><b>${hasLab ? 'No project running' : 'No Research Lab'}</b><small>${hasLab ? 'Pick an available project below.' : 'Build a Research Lab to generate research points.'}</small></div></div>`;
 html += `</div>`;
 const br = ui().researchBranch;
 html += `<div class="rs-tabs">${Object.keys(B).map(b => { const nodes = DE.Research.byBranch(b); const done = nodes.filter(n => s.research.done[n.id]).length; return `<button class="btn ${br === b ? 'active' : ''}" data-action="researchBranch" data-branch="${b}">${DE.Icons.branch(b, 'ico-btn')} ${B[b].name} <span class="cost">${done}/${nodes.length}</span></button>`; }).join('')}</div>`;
 const nodes = DE.Research.byBranch(br); const L = rsLayout(nodes);
 const CW = 200, CH = 128, GX = 26, GY = 44, cols = Math.max(...L.tiers.map(t => t.length));
 const W = cols * CW + (cols - 1) * GX, H = L.tiers.length * CH + (L.tiers.length - 1) * GY;
 const pos = (n) => { const t = L.tiers[L.depth[n.id]]; const off = (W - (t.length * CW + (t.length - 1) * GX)) / 2; return { x: off + L.col[n.id] * (CW + GX), y: L.depth[n.id] * (CH + GY) }; };
 let lines = '';
 nodes.forEach(n => n.requires.forEach(r => { const a = pos(DE.Data.RESEARCH[r]), b = pos(n); const x1 = a.x + CW / 2, y1 = a.y + CH, x2 = b.x + CW / 2, y2 = b.y, my = (y1 + y2) / 2;
   const lit = s.research.done[r]; lines += `<path d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}" class="rs-link ${lit ? 'lit' : ''}"/>`; }));
 let cards = '';
 nodes.forEach(n => {
   const done = s.research.done[n.id]; const avail = DE.Research.isAvailable(s, n.id); const c = DE.Research.canStart(s, n.id); const active = cur && cur.id === n.id;
   const cls = done ? 'done' : active ? 'active' : avail ? 'avail' : 'locked'; const p = pos(n);
   const state = done ? `<span class="rs-state ok">${DE.Icons.img('check', '')} Done</span>` : active ? `<span class="rs-state run">In progress</span>`
     : avail ? `<button class="btn primary small ${c.ok ? '' : 'cant'}" data-action="research" data-id="${n.id}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason || '')}">Research</button>`
     : `<span class="rs-state lock">${DE.Icons.img('lock', '')} Locked</span>`;
   cards += `<div class="rs-card ${cls}" style="left:${p.x}px;top:${p.y}px;width:${CW}px;height:${CH}px" title="${esc(n.desc)}${n.requires.length && !done ? '\nRequires: ' + n.requires.map(r => DE.Data.RESEARCH[r].name).join(', ') : ''}">
     <div class="rs-head">${rsIcon(n)}<b>${esc(n.name)}</b></div><p>${esc(n.desc)}</p>
     <div class="rs-foot"><span class="rs-cost">${DE.Icons.img('research', '')}${U().fmt(n.cost)} · ${U().fmtTime(DE.Research.duration(s, n.id))}</span>${state}</div></div>`;
 });
 html += `<div class="rs-tree-wrap"><div class="rs-tree" style="width:${W}px;height:${H}px"><svg class="rs-lines" width="${W}" height="${H}">${lines}</svg>${cards}</div></div>`;
 return html;
 },
 };

 /* ================= EXCAVATE ================= */
 const excavate = {
 title: (s) => `Excavation <small>${s.floors.length} floor${s.floors.length > 1 ? 's' : ''} · max B${DE.Excavation.maxDepth(s)}</small>`,
 render(s) {
 const d = DE.Excavation.nextDepth(s); const now = Date.now(); const max = DE.Excavation.maxDepth(s);
 let html = '';
 if (s.excavation) { const ex = s.excavation; html += `<div class="card"><h4>Digging floor B${ex.depth}</h4>${bar(100 * (1 - (ex.endsAt - now) / (ex.duration * 1000)), 'brown')}<small class="muted">${U().fmtTime((ex.endsAt - now) / 1000)} left</small></div>`; }
 else if (d > DE.CONFIG.MAX_FLOORS) html += `<div class="card"><p>⬛ You have reached bedrock. The bunker is as deep as it can go.</p></div>`;
 else {
 const c = DE.Excavation.canStart(s); const cost = DE.Excavation.cost(s, d);
 html += `<div class="card"><h4>Next floor: B${d}</h4><p class="muted">Each floor is a ${DE.CONFIG.FLOOR_SLOTS}-cell grid you can widen by digging sideways. Costs grow with depth. From B3 down you may uncover abandoned facilities with unique rooms.</p>
 <div class="row"><span>Cost</span><b>${U().costText(cost)}</b></div><div class="row"><span>Time</span><b>${U().fmtTime(DE.Excavation.time(s, d))}</b></div>
 ${d > max ? `<p class="neg"> Floor B${d} needs more excavation research (Engineering branch).</p>` : ''}
 <button class="btn primary ${c.ok ? '' : 'cant'}" data-action="excavate" ${c.ok ? '' : 'disabled'}> Excavate B${d}</button>${c.ok ? '' : `<small class="neg">${c.reason}</small>`}</div>`;
 }
 const found = s.floors.filter(f => f.facility);
 html += `<div class="card"><h4>Discoveries ${found.length}/${DE.Data.FACILITIES.length}</h4>${DE.Data.FACILITIES.map(f => { const fl = found.find(x => x.facility === f.id); return `<div class="fac ${fl ? 'found' : ''}"><span class="fac-icon">${DE.Icons.img('facility', 'ico-inline')}</span><div><b>${fl ? esc(f.name) : '???'}</b> <small class="muted">${fl ? 'B' + fl.depth : 'from B' + f.minDepth}</small><div class="muted">${fl ? esc(f.lore) : 'Unique room: ' + esc(DE.Data.ROOMS[f.room].name)}</div></div></div>`; }).join('')}</div>`;
 html += `<div class="card"><h4>Floors</h4>${s.floors.map(f => `<div class="row"><span>B${f.depth} ${f.facility ? DE.Icons.img('facility', 'ico-inline') : ''}</span><span>${DE.Bunker.roomsOnFloor(s, f.depth).length} rooms · ${f.slots.filter(x => !x).length} free slots</span><button class="btn small ghost" data-action="scrollFloor" data-depth="${f.depth}">Show</button></div>`).join('')}</div>`;
 return html;
 },
 };

 /* ================= DEFENSE ================= */
 const defense = {
 title: (s) => `Defense <small>Manage the bunker's defenses · wave ${s.defense.wave} in ${U().fmtTime((s.defense.nextWaveAt - Date.now()) / 1000)}</small>`,
 render(s) {
 const d = s.defense; const fx = s._fx; const now = Date.now(); const ui = DE.UI.ui; ui.defOpen = ui.defOpen || {};
 const hp = DE.Defense.waveHp(s); const pw = DE.Defense.defensePower(s); const maxHp = DE.Defense.wallMaxHp(s);
 const dmg = Math.max(0, Math.ceil((hp - pw.total) * 1.2));
 const verdict = pw.total >= hp ? ['pos', 'The horde will be wiped out before reaching the wall.', 'Your firepower outmatches this wave.']
   : pw.total + d.wall.hp >= hp ? ['warn', `The wall will take about ${U().fmt(dmg)} damage.`, 'Watch out! Add guards, turrets or traps to stop them earlier.']
   : ['neg', 'BREACH LIKELY', 'You will lose resources and survivors get hurt. Repair and reinforce now.'];
 const compList = DE.Defense.waveComposition(hp, d.wave); const comp = DE.Defense.compositionSummary(compList);
 const boss = DE.Defense.isBossWave(d.wave); const reward = DE.Defense.waveReward(d.wave, 'victory');
 const I = (k, c) => DE.Icons.img(k, c || 'dk-ico');
 const row = (icon, label, value) => `<div class="dk-row">${I(icon)}<span>${label}</span><b>${value}</b></div>`;
 const kinds = DE.Data.ZOMBIES.filter(z => comp.counts[z.id]);
 const skulls = Math.min(5, 1 + Math.floor(d.wave / 4));
 const m = DE.Events.mutation(s); const n = DE.Events.noise(s), lvl = DE.Events.noiseLevel(n);
 // ---- wave card ----
 let html = `<div class="dk-card wave ${boss ? 'boss' : ''}"><div class="dk-wave-main">
 <h4>${I('zombies', 'ico-h4')} ${boss ? 'BOSS wave' : 'Wave'} ${d.wave} <small>in ${U().fmtTime((d.nextWaveAt - now) / 1000)}</small><span class="dk-skulls">${Array.from({ length: 5 }, (_, i) => `<i class="${i < skulls ? 'on' : ''}">${I('skull2', '')}</i>`).join('')}</span></h4>
 ${row('wave', 'Horde strength', U().fmt(hp))}
 ${row('alert', 'Wall damage multiplier', comp.dmgMult.toFixed(2) + 'x' + (comp.toxic ? ` · ${comp.toxic} toxic` : ''))}
 ${row('trophy', 'Reward on victory', (U().costText(reward) || '—') + (d.winStreak ? ` <small class="pos">+${Math.min(50, 10 * d.winStreak)}% streak bonus</small>` : ''))}
 ${d.winStreak ? row('star', 'Victory streak', d.winStreak + ' in a row') : ''}
 ${d.breachStreak ? row('wave', 'Horde regrouping', `next wave −${Math.round((1 - Math.max(0.6, Math.pow(0.85, d.breachStreak))) * 100)}% after ${d.breachStreak} breach${d.breachStreak > 1 ? 'es' : ''}`) : ''}
 ${row('shield', 'Your firepower', `${U().fmt(pw.total)} <small>(guards ${U().fmt(pw.guardDps, 1)}/s · turrets ${U().fmt(pw.turretDps, 1)}/s${pw.missileDps ? ' · missiles ' + U().fmt(pw.missileDps, 1) + '/s' : ''} · traps ${pw.trapDmg})</small>`)}
 ${row('timer', 'Combat time', DE.CONFIG.WAVE_DURATION + 's')}
 ${row('noise', 'Bunker noise', `<span class="noise ${lvl}">${lvl}</span>`)}
 ${m ? row('biohazard', 'Mutation', esc(m.name) + ` <small>${esc(m.desc)}</small>`) : ''}
 <div class="dk-bar ${verdict[0]}"><i style="width:${Math.min(100, 100 * pw.total / hp)}%"></i></div>
 <div class="dk-verdict ${verdict[0]}">${I(verdict[0] === 'pos' ? 'check' : 'warning')}<div><b>${verdict[1]}</b><small>${verdict[2]}</small></div></div></div>
 <div class="dk-wave-art"><svg class="dk-field" viewBox="0 0 300 190" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
   <defs><linearGradient id="dkf-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a5e"/><stop offset=".55" stop-color="#c8604a"/><stop offset="1" stop-color="#f0a050"/></linearGradient>
   <linearGradient id="dkf-gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8a2e"/><stop offset="1" stop-color="#4c6020"/></linearGradient></defs>
   <rect width="300" height="190" fill="url(#dkf-sky)"/><circle cx="235" cy="112" r="20" fill="#ffd27a" opacity=".9"/>
   <path d="M0 132 V102 H18 V84 H36 V102 H52 V92 H70 V132 Z M110 132 V96 H128 V78 H150 V100 H166 V132 Z M196 132 V104 H214 V88 H230 V132 Z M250 132 V96 H272 V108 H300 V132 Z" fill="#6a2f5f" opacity=".85"/>
   <path d="M0 132 Q75 120 150 130 T300 126 V140 H0 Z" fill="#7a5a44"/>
   <g stroke="#1c1020" stroke-width="2">${Array.from({ length: 8 }, (_, i) => `<rect x="${6 + i * 11}" y="${118 + (i % 2)}" width="8" height="${30 - (i % 3) * 3}" fill="#8d5b36"/>`).join('')}</g>
   <rect x="0" y="146" width="300" height="44" fill="url(#dkf-gr)" stroke="#1c1020" stroke-width="2"/><rect x="0" y="160" width="300" height="30" fill="#5a3a26"/>
   </svg><div class="dk-horde">${kinds.slice(0, 4).map((z, i) => `<span style="animation-delay:${-i * .9}s" title="${esc(z.name)} ×${comp.counts[z.id]}">${DE.Chars.portrait(z.id, { cls: 'flip' + (z.boss || z.id === 'brute' || z.id === 'mutant' ? ' big' : '') })}<em>×${comp.counts[z.id]}</em></span>`).join('')}</div><div class="dk-flag">${I('battle', '')}</div></div></div>`;
 // ---- wall ----
 const wc = DE.Defense.wallUpgradeCost(s); const rc = DE.Defense.repairCost(s); const wpct = 100 * d.wall.hp / maxHp;
 html += `<div class="dk-card dk-wallcard">${DE.Icons.structure('wall', 'dk-big')}<div class="dk-body"><div class="dk-titleline"><b>Wall · Level ${d.wall.level}</b><small>${d.wall.level < 3 ? 'cracked & patched' : d.wall.level < 6 ? 'steel-plated' : 'armoured'}</small><span class="dk-hp">${U().fmt(d.wall.hp)} / ${U().fmt(maxHp)}</span></div>
 <div class="dk-bar ${wpct < 30 ? 'neg' : 'pos'}"><i style="width:${wpct}%"></i></div>
 <div class="btn-row"><button class="btn primary ${U().canAfford(s.resources, wc) ? '' : 'cant'}" data-action="wallUpgrade" ${U().canAfford(s.resources, wc) ? '' : 'disabled'}>${I('star', 'ico-btn')} Upgrade <span class="cost">${U().costText(wc)}</span></button>
 <button class="btn ${rc.scrap > 0 ? '' : 'cant'}" data-action="wallRepair" ${rc.scrap > 0 ? '' : 'disabled'}>${I('repair2', 'ico-btn')} Repair <span class="cost">${U().costText(rc)}</span></button></div></div></div>`;
 // ---- expandable sections ----
 const section = (key, icon, title, desc, status, statusCls, art, body) => { const open = !!ui.defOpen[key];
   return `<div class="dk-sec ${open ? 'open' : ''}"><div class="dk-sec-head" data-action="defToggle" data-key="${key}">${icon}<div class="dk-sec-text"><b>${title}</b><small>${desc}</small>${status ? `<small class="dk-status ${statusCls || ''}">${status}</small>` : ''}</div><div class="dk-sec-art">${art || ''}</div><img class="dk-chev" src="assets/ui/chevron.png" alt=""></div>${open ? `<div class="dk-sec-body">${body}</div>` : ''}</div>`; };
 const tc = DE.Defense.turretCost(s); const maxT = DE.Defense.maxTurrets(s); const canT = fx.turretsUnlocked && U().canAfford(s.resources, tc) && d.turrets < maxT;
 const cc = DE.Defense.calibreCost(s); const canC = fx.turretsUnlocked && d.turrets > 0 && U().canAfford(s.resources, cc); const tdmg = DE.Defense.turretDmg(s);
 html += section('turrets', DE.Icons.structure('turret', 'dk-big'), `Auto-turrets · ${d.turrets}/${maxT}`, 'Automatic defense units. Aim at incoming threats.',
   fx.turretsUnlocked ? `${U().fmt(tdmg, 1)} dmg/s each · calibre ${d.turretLevel || 0} · ${U().fmt(pw.turretDps, 1)} dmg/s total` : 'Requires research: Heavy Machinery', fx.turretsUnlocked ? '' : 'neg', I('turret', 'dk-art'),
   fx.turretsUnlocked ? `<div class="dk-stats"><span><small>Per turret</small><b>${U().fmt(tdmg, 1)}/s</b></span><span><small>All turrets</small><b>${U().fmt(pw.turretDps, 1)}/s</b></span><span><small>Per wave</small><b>${U().fmt(pw.turretDps * DE.CONFIG.WAVE_DURATION)}</b></span><span><small>Power draw</small><b>${(DE.CONFIG.TURRET_POWER * d.turrets).toFixed(1)}/s</b></span></div>
   <div class="btn-row"><button class="btn primary ${canT ? '' : 'cant'}" data-action="buyTurret" ${canT ? '' : 'disabled'}>${I('plus', 'ico-btn')} Install turret <span class="cost">${U().costText(tc)}</span></button>
   <button class="btn ${canC ? '' : 'cant'}" data-action="upgradeCalibre" ${canC ? '' : 'disabled'} title="+25% damage for every turret">${I('up', 'ico-btn')} Calibre ${(d.turretLevel || 0) + 1} <span class="cost">${U().costText(cc)}</span></button></div>
   <p class="muted">${d.turrets >= maxT ? 'All mounts used — Armory levels and floodlight masts add more.' : 'More mounts come from Armory levels and floodlight masts.'} Calibre adds +25% damage to every turret.</p>` : '<p>Research Heavy Machinery to unlock turrets.</p>');
 html += section('traps', DE.Icons.structure('trap', 'dk-big'), `Traps · ${d.traps} stocked`, 'Set up traps to slow down the enemy.',
   fx.trapsUnlocked ? `${DE.CONFIG.TRAP_DMG} dmg each · up to ${DE.CONFIG.TRAPS_PER_WAVE} used per wave` : 'Requires research: Fortification', fx.trapsUnlocked ? '' : 'neg', I('traps', 'dk-art'),
   fx.trapsUnlocked ? `<div class="btn-row"><button class="btn" data-action="buyTraps" data-n="1">+1 <span class="cost">${U().costText(DE.Defense.trapCost(s))}</span></button><button class="btn" data-action="buyTraps" data-n="5">+5 <span class="cost">${U().costText(U().scaleCost(DE.Defense.trapCost(s), 5))}</span></button></div>` : '<p>Research Fortification to unlock traps.</p>');
 const pool = DE.Survivors.available(s); const gs = DE.Survivors.guards(s);
 html += section('guards', I('guards', 'dk-big'), `Guards · ${gs.length}/${fx.guardCap}`, 'A trained squad to defend the bunker. Soldiers +50%.',
   gs.length ? `${U().fmt(pw.guardDps, 1)} dmg/s on duty` : 'Nobody on guard duty', gs.length ? 'pos' : 'warn', DE.Chars.portrait('soldier', { cls: 'dk-port' }),
   pool.map(sv => { const g = sv.assignment && sv.assignment.kind === 'guard'; return `<div class="dk-line">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b><small>Lv${sv.level} · ${U().fmt(DE.Survivors.guardPower(sv, fx), 1)} dmg/s${sv.hp < 50 ? ' · hurt' : ''}</small></span><button class="btn small ${g ? 'active' : ''}" data-action="toggleGuard" data-sid="${sv.id}">${g ? I('check', 'ico-btn') + ' On duty' : 'Post as guard'}</button></div>`; }).join('') || '<p>No survivors available.</p>');
 const owDone = DE.Data.OVERWORLD_ORDER.filter(k => !DE.Defense.structureNext(s, k)).length;
 html += section('perimeter', I('perimeter', 'dk-big'), 'Perimeter', 'Fence, barricades, towers, lights, road and the missile battery.', `${owDone}/${DE.Data.OVERWORLD_ORDER.length} fully upgraded`, '', DE.Icons.structure('fence', 'dk-art'),
   DE.Data.OVERWORLD_ORDER.map(k => { const def = DE.Data.OVERWORLD[k]; const lv = (s.overworld && s.overworld[k]) || 0; const cur = def.levels[lv]; const next = DE.Defense.structureNext(s, k); const blocked = next && DE.Defense.structureBlocked(s, k); const ok = next && !blocked && U().canAfford(s.resources, next.cost);
   return `<div class="dk-line">${DE.Icons.structure(k, 'dk-mid')}<span><b>${esc(def.name)} <em class="tag">${esc(cur.name)}</em></b><small>${next ? esc(next.name) + ' — ' + esc(next.desc) : esc(cur.desc) + ' · fully upgraded'}</small>${blocked ? `<small class="neg">${esc(blocked)}</small>` : ''}</span>${next ? `<button class="btn primary small ${ok ? '' : 'cant'}" data-action="owUpgrade" data-key="${k}" ${ok ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(next.cost)}</span></button>` : '<b class="gold">MAX</b>'}</div>`; }).join(''));
 html += section('bestiary', I('zombies', 'dk-big'), 'Bestiary', 'Know what is coming.', `${DE.Data.ZOMBIES.filter(z => z.minWave <= d.wave).length}/${DE.Data.ZOMBIES.length} sighted`, '', '',
   DE.Data.ZOMBIES.map(z => `<div class="dk-line ${z.minWave > d.wave ? 'locked-row' : ''}">${DE.Icons.zombie(z.id, 'ava')}<span><b>${esc(z.name)}</b><small>${z.boss ? 'every ' + DE.Data.BOSS_EVERY + 'th wave' : 'from wave ' + z.minWave + ' · ' + z.hp + ' HP'} · wall dmg ×${z.dmg} · ${esc(z.desc)}</small></span></div>`).join(''));
 if (d.log.length) html += section('log', I('battle', 'dk-big'), 'Battle log', 'The last waves at the gate.', (() => { const r = d.log[d.log.length - 1]; return 'Last: wave ' + r.wave + ' · ' + (r.outcome === 'victory' ? 'repelled' : r.outcome === 'held' ? 'wall held' : 'BREACH'); })(), d.log[d.log.length - 1].outcome === 'breach' ? 'neg' : 'pos', '',
   d.log.slice().reverse().slice(0, 8).map(r => `<div class="dk-line log ${r.outcome}">${I(r.outcome === 'breach' ? 'warning' : 'check', 'dk-ico')}<span><b>Wave ${r.wave} · ${r.outcome === 'victory' ? 'Repelled' : r.outcome === 'held' ? 'Wall held (−' + r.wallDamage + ' HP)' : 'BREACH'}</b><small>${r.killed} killed${r.reward && Object.keys(r.reward).length ? ' · loot ' + U().costText(r.reward) : ''}${(r.injured || []).length ? ' · injured: ' + r.injured.map(esc).join(', ') : ''}</small></span></div>`).join(''));
 return html;
 },
 };

 /* ================= EXPEDITIONS ================= */
 /* The expedition screen: a map of the wasteland (roads from the bunker to every destination,
  * locked ones greyed, trucks driving out and back while a team is away), the selected
  * destination's numbers for the chosen team (time, injury risk, loot, rescues, discoveries, road
  * events), the team picker with seats, teams in the field and trip reports. Time-dependent bits
  * (truck positions, ETAs, progress) are written by tick() so the drawer HTML stays stable and the
  * trucks glide instead of being redrawn every second. */
 const EM = { W: 1000, H: 380, HOME: [70, 318] };
 function emRoute(loc) {
 const [x, y] = loc.map, [hx, hy] = EM.HOME;
 return { x0: hx, y0: hy, cx: (hx + x) / 2 + (y - hy) * 0.18, cy: (hy + y) / 2 - Math.abs(x - hx) * 0.1, x1: x, y1: y };
 }
 function emPoint(r, t) { const u = 1 - t; return [u * u * r.x0 + 2 * u * t * r.cx + t * t * r.x1, u * u * r.y0 + 2 * u * t * r.cy + t * t * r.y1]; }
 const emLeg = (f) => f < 0.5 ? f * 2 : 2 - f * 2;      // out until halfway, then home
 const PROF_TRIP = { scavenger: '+30% loot · −15% risk', hunter: '−20% risk', scout: '−20% trip time', medic: '−25% risk' };
 function emMap(s, sel) {
 const locs = DE.Data.LOCATIONS, active = s.expeditions.active;
 const roads = locs.map(l => { const r = emRoute(l), open = DE.Expeditions.isOpen(s, l), on = active.some(e => e.location === l.id);
   return `<path class="em-road ${open ? '' : 'locked'} ${l.id === sel.id ? 'sel' : ''} ${on ? 'active' : ''}" d="M${r.x0} ${r.y0} Q${r.cx.toFixed(0)} ${r.cy.toFixed(0)} ${r.x1} ${r.y1}"/>`; }).join('');
 const pins = locs.map(l => { const open = DE.Expeditions.isOpen(s, l), [x, y] = l.map, on = active.some(e => e.location === l.id);
   return `<g class="em-pin ${open ? '' : 'locked'} ${l.id === sel.id ? 'sel' : ''} ${on ? 'busy' : ''}" transform="translate(${x} ${y})" data-action="expLocation" data-id="${l.id}"><title>${esc(l.name)}</title><circle class="em-hit" r="40"/><circle class="em-halo" r="33"/><circle class="em-disc" r="25"/><image href="${DE.Icons.src(open ? l.icon : 'lock')}" x="-17" y="-17" width="34" height="34"/>
   <text class="em-name" y="44">${esc(l.name)}</text>${open ? `<text class="em-risk r${l.danger >= 0.45 ? 3 : l.danger >= 0.25 ? 2 : 1}" y="59">${Math.round(l.danger * 100)}% risk</text>` : `<text class="em-risk" y="59">reach B${l.minDepth}</text>`}</g>`; }).join('');
 const stops = active.map(e => { const r = emRoute(DE.Expeditions.location(e.location)); return (e.stops || []).map((f, i) => { const [x, y] = emPoint(r, emLeg(f)); return `<circle class="em-stop ${i < (e.stop || 0) ? 'past' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`; }).join(''); }).join('');
 const trucks = active.map(e => `<g class="em-truck" data-trip="${e.id}" style="opacity:0"><g class="em-flip"><image href="${DE.Icons.src('vehicle')}" x="-22" y="-34" width="44" height="44"/></g><text class="em-eta" y="22" data-eta="${e.id}"></text></g>`).join('');
 const hills = [[150, 60, 120, 40], [470, 350, 180, 50], [700, 40, 160, 45], [880, 360, 170, 40], [300, 200, 90, 30], [760, 180, 70, 26]].map(([x, y, rx, ry]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" class="em-hill"/>`).join('');
 const blocks = [[560, 120], [585, 175], [615, 110], [680, 190], [470, 205], [500, 300], [870, 250]].map(([x, y], i) => `<rect x="${x}" y="${y}" width="${18 + (i % 3) * 6}" height="${14 + (i % 2) * 8}" class="em-block"/>`).join('');
 return `<div class="exp-map"><svg viewBox="0 0 ${EM.W} ${EM.H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Expedition map">
 <defs><radialGradient id="em-bg" cx=".3" cy=".75" r="1"><stop offset="0" stop-color="#5b5f45"/><stop offset=".6" stop-color="#3f4434"/><stop offset="1" stop-color="#2b2f25"/></radialGradient>
 <pattern id="em-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0 H0 V50" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="1"/></pattern></defs>
 <rect width="${EM.W}" height="${EM.H}" fill="url(#em-bg)"/>${hills}
 <path class="em-river" d="M520 -10 C 470 80, 560 140, 500 200 S 400 300, 455 390"/>
 ${blocks}<rect width="${EM.W}" height="${EM.H}" fill="url(#em-grid)"/>
 <g>${roads}</g><g>${stops}</g>
 <g class="em-home" transform="translate(${EM.HOME[0]} ${EM.HOME[1]})"><circle r="30" class="em-disc home"/><image href="${DE.Icons.src('home')}" x="-20" y="-21" width="40" height="40"/><text class="em-name" y="48">Bunker</text></g>
 <g>${pins}</g><g>${trucks}</g>
 <text class="em-title" x="${EM.W - 16}" y="${EM.H - 14}">THE WASTELAND</text></svg></div>`;
 }
 const expeditions = {
 title: (s) => `Expeditions <small>${s.expeditions.active.length}/${DE.Expeditions.slots(s)} teams out · ${DE.Expeditions.availableLocations(s).length}/${DE.Data.LOCATIONS.length} places known</small>`,
 render(s) {
 const ex = ui().expedition;
 if (!DE.Expeditions.unlocked(s)) return `<div class="card"><h4>No Garage</h4><p>Build a <b>Garage</b> (needs research: Reinforced Construction) to send survivors to the surface for loot, fuel and new recruits.</p></div>`;
 const bus = DE.Events.bus(s), nextBus = DE.Events.busNext(s), locs = DE.Data.LOCATIONS;
 const sel = DE.Expeditions.location(ex.location) || locs[0], open = DE.Expeditions.isOpen(s, sel);
 ex.members = ex.members.filter(id => s.survivors[id] && !(s.survivors[id].assignment && s.survivors[id].assignment.kind === 'expedition'));
 const plan = DE.Expeditions.plan(s, sel.id, ex.members.length ? ex.members : []);
 let html = emMap(s, sel);
 // ---- destination ----
 const lootChips = Object.keys(sel.loot).map(r => `<i class="ex-chip">${DE.Icons.res(r, 'ico-inline')}${U().fmt(sel.loot[r][0] * plan.lootMult)}–${U().fmt(sel.loot[r][1] * plan.lootMult)}</i>`).join('');
 const finds = (sel.finds || []).map(f => `<i class="ex-chip find">${DE.Icons.img('star', 'ico-inline')}${Math.round(f.chance * 100)}% ${esc(f.text)}</i>`).join('');
 const risk = plan.danger, riskSev = risk >= 0.4 ? 'crit' : risk >= 0.2 ? 'warn' : 'ok';
 const road = plan.stops.length > 1 ? '2 checkpoints · 60% chance of an event at each' : '1 checkpoint · 75% chance of an event';
 html += `<div class="ex-grid"><div class="card ex-dest ${open ? '' : 'locked'}"><div class="ex-dh"><span class="ex-dico">${DE.Icons.img(open ? sel.icon : 'lock')}</span><div><h4>${esc(sel.name)}</h4><p>${esc(sel.desc)}</p></div></div>
 ${open ? `<div class="ex-kv"><span>${DE.Icons.img('timer', 'ico-inline')} Trip time</span><b>${U().fmtTime(plan.duration)}</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('medkit', 'ico-inline')} Injury risk</span><span class="pd-bar ${riskSev}"><i style="width:${Math.min(100, risk * 100 / 0.6).toFixed(0)}%"></i></span><b>${Math.round(risk * 100)}%</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('pop', 'ico-inline')} Rescue chance</span><b>${Math.round(plan.rescue * 100)}%</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('scroll', 'ico-inline')} On the road</span><b>${road}</b></div>
 <div class="ex-sub">Expected haul <small>×${plan.lootMult.toFixed(2)} with this team, depth and vehicle</small></div><div class="ex-chips">${lootChips}</div>
 ${finds ? `<div class="ex-sub">Possible discoveries</div><div class="ex-chips">${finds}</div>` : ''}` : `<p class="ex-lock">${DE.Icons.img('lock', 'ico-inline')} Dig down to <b>B${sel.minDepth}</b> to learn the way there.</p>`}</div>`;
 // ---- team ----
 const pool = DE.Survivors.available(s);
 const seats = Array.from({ length: bus.capacity }, (_, i) => { const sv = s.survivors[ex.members[i]]; return sv ? `<button class="ex-seat on" data-action="expToggle" data-sid="${sv.id}" title="Remove ${esc(sv.name)}">${DE.Chars.portrait(sv.profession)}<small>${esc(sv.name.split(' ')[0])}</small></button>` : `<span class="ex-seat"><small>empty seat</small></span>`; }).join('');
 const cands = pool.filter(sv => !ex.members.includes(sv.id)).map(sv => { const hurt = sv.hp < 50; const prof = DE.Data.PROFESSIONS[sv.profession];
   return `<button class="ex-cand ${hurt ? 'hurt' : ''}" data-action="expToggle" data-sid="${sv.id}" ${hurt ? 'disabled' : ''} title="${esc(sv.name)}${sv.assignment ? ' — leaves ' + esc(assignmentText(s, sv)) : ''}">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b><small>${esc(prof ? prof.name : sv.profession)} · Lv ${sv.level}${PROF_TRIP[sv.profession] ? ' · <em>' + PROF_TRIP[sv.profession] + '</em>' : ''}</small><span class="ex-hp"><i style="width:${Math.max(0, Math.min(100, sv.hp))}%" class="${hurt ? 'low' : ''}"></i></span></span></button>`; }).join('');
 const c = DE.Expeditions.canSend(s, sel.id, ex.members);
 html += `<div class="card ex-team"><h4>Team <small class="muted">${ex.members.length}/${bus.capacity} seats · ${esc(bus.name)}</small></h4><div class="ex-seats">${seats}</div>
 <button class="btn primary ex-go ${c.ok ? '' : 'cant'}" data-action="expSend" ${c.ok ? '' : 'disabled'}>${DE.Icons.img('vehicle', 'ico-btn')} Send ${ex.members.length || ''} to ${esc(sel.name)}${c.ok ? `<small>back in ${U().fmtTime(plan.duration)}</small>` : ''}</button>${c.ok ? '' : `<small class="ex-why">${esc(c.reason)}</small>`}
 <div class="ex-sub">Available survivors <small>tap to add · scavengers, hunters, scouts and medics have trip bonuses</small></div><div class="ex-cands">${cands || '<p class="muted">Everyone is busy or away.</p>'}</div></div></div>`;
 // ---- teams in the field ----
 if (s.expeditions.active.length) html += `<div class="card"><h4>Teams in the field</h4>${s.expeditions.active.map(e => { const l = DE.Expeditions.location(e.location); const wait = (s.events || []).some(v => v.ctx && v.ctx.expId === e.id);
   return `<div class="ex-field">${DE.Icons.img(l.icon, 'ex-fico')}<div class="ex-fb"><div class="ex-ft"><b>${esc(l.name)}</b><span class="ex-crew">${e.survivors.map(id => s.survivors[id]).filter(Boolean).map(sv => DE.Icons.prof(sv.profession, 'ava', esc(sv.name))).join('')}</span>${wait ? `<button class="ex-wait" data-action="nextEvent">${DE.Icons.img('alert', 'ico-inline')} Decision waiting</button>` : ''}<small data-eta="${e.id}"></small></div>
   <div class="ex-track"><i data-prog="${e.id}"></i>${(e.stops || []).map((f, i) => `<em class="${i < (e.stop || 0) ? 'past' : ''}" style="left:${(f * 100).toFixed(1)}%"></em>`).join('')}<span style="left:50%">turn back</span></div>
   ${(e.notes || []).length ? `<div class="ex-notes">${e.notes.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : ''}</div></div>`; }).join('')}</div>`;
 // ---- vehicle & factions ----
 html += `<div class="card bus-card"><h4>${DE.Icons.img('vehicle', 'ico-inline')} ${esc(bus.name)} <small class="muted">${bus.capacity} seats · ${Math.round((1 - bus.speed) * 100)}% faster · ${Math.round(bus.safety * 100)}% safer · cargo ×${bus.cargo}</small></h4>
 ${nextBus ? `<div class="row"><span><b>Next:</b> ${esc(nextBus.name)} <small class="muted">${esc(nextBus.desc)}</small></span><button class="btn primary small ${U().canAfford(s.resources, nextBus.cost) ? '' : 'cant'}" data-action="busUpgrade" ${U().canAfford(s.resources, nextBus.cost) ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(nextBus.cost)}</span></button></div>` : '<p class="muted">The best vehicle there is.</p>'}
 <div class="ex-chips">${Object.values(DE.Data.FACTIONS).map(f => { const v = (s.rep && s.rep[f.id]) || 0; return `<i class="ex-chip ${v > 0 ? 'good' : v < 0 ? 'bad' : ''}" title="${esc(f.desc)}">${DE.Icons.img('pop', 'ico-inline')}${esc(f.name)} ${v > 0 ? '+' : ''}${v}</i>`; }).join('')}</div></div>`;
 // ---- reports ----
 if (s.expeditions.log.length) html += `<div class="card"><h4>Reports</h4>${s.expeditions.log.slice().reverse().slice(0, 8).map(r => { const l = DE.Expeditions.location(r.location) || { name: r.location, icon: 'location' };
   return `<div class="ex-rep">${DE.Icons.img(l.icon, 'ex-fico')}<div><b>${esc(l.name)}</b> <small class="muted">${esc((r.members || []).join(', '))}</small><div class="ex-chips">${Object.keys(r.loot || {}).filter(k => r.loot[k] > 0).map(k => `<i class="ex-chip good">${DE.Icons.res(k, 'ico-inline')}+${U().fmt(r.loot[k])}</i>`).join('')}${r.rescued ? `<i class="ex-chip good">${DE.Icons.img('pop', 'ico-inline')}${esc(r.rescued)} joined</i>` : ''}${(r.injured || []).length ? `<i class="ex-chip bad">${DE.Icons.img('medkit', 'ico-inline')}${r.injured.map(esc).join(', ')} hurt</i>` : ''}</div>
   ${(r.finds || []).map(f => `<div class="ex-line find">${DE.Icons.img('star', 'ico-inline')}${esc(f)}</div>`).join('')}${(r.notes || []).map(n => `<div class="ex-line">${DE.Icons.img('scroll', 'ico-inline')}${esc(n)}</div>`).join('')}</div></div>`; }).join('')}</div>`;
 return html;
 },
 tick(s) {
 const body = document.getElementById('drawer-body'); if (!body) return; const now = Date.now();
 s.expeditions.active.forEach(e => {
   const l = DE.Expeditions.location(e.location); if (!l) return;
   const f = DE.Expeditions.progress(e, now), [x, y] = emPoint(emRoute(l), emLeg(f));
   const g = body.querySelector(`.em-truck[data-trip="${e.id}"]`);
   if (g) {
     const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
     if (!g.dataset.placed) { g.style.transition = 'none'; g.style.transform = tf; void g.getBoundingClientRect(); g.style.transition = ''; g.style.opacity = '1'; g.dataset.placed = '1'; }
     else if (g.style.transform !== tf) g.style.transform = tf;
     g.classList.toggle('back', f >= 0.5);
   }
   body.querySelectorAll(`[data-eta="${e.id}"]`).forEach(el => { const t = U().fmtTime((e.endsAt - now) / 1000); if (el.textContent !== t) el.textContent = t; });
   body.querySelectorAll(`[data-prog="${e.id}"]`).forEach(el => { el.style.width = (f * 100).toFixed(1) + '%'; });
 });
 },
 };

 /* ================= LEGACY ================= */
 /* Legacy: a hero panel with the points you hold and what a Reconstruction would pay (with the two
  * requirements as meters), where the points would come from, the permanent upgrades grouped by
  * theme (each card: icon, level pips, what it gives now → next level, price) and the artifact
  * collection. */
 const LG_ICON = { contacts: 'pop', hands: 'up', stock: 'chest', friends: 'guards', tunnels: 'floors', science: 'research', archive: 'labbuilding', autonomy: 'timer', scars: 'shield', prints: 'hammer', digger: 'dig2', patience: 'noise' };
 const LG_GROUPS = [['Production', ['hands', 'stock', 'archive', 'prints']], ['Crew & contacts', ['friends', 'contacts', 'autonomy']], ['Digging', ['tunnels', 'digger', 'science']], ['Defense', ['scars', 'patience']]];
 function lgEffect(e, lvl) {
 const v = e.value * lvl, pct = (x) => (x > 0 ? '+' : '−') + Math.round(Math.abs(x) * 100) + '%';
 switch (e.type) {
   case 'globalMult': return pct(v) + ' production'; case 'researchSpeed': return pct(v) + ' research speed';
   case 'startResources': return '+' + U().fmt(v) + ' starting supplies'; case 'startSurvivors': return '+' + v + ' starting survivor' + (v === 1 ? '' : 's');
   case 'startFloors': return '+' + v + ' floor' + (v === 1 ? '' : 's') + ' dug'; case 'startResearchTier': return 'research tier ' + v + ' done';
   case 'startRep': return '+' + v + ' trader reputation'; case 'offlineCapHours': return '+' + v + 'h offline cap';
   case 'wallHpMult': return pct(v) + ' wall HP'; case 'guardDmgMult': return pct(v) + ' guard damage';
   case 'buildCostMult': return pct(v) + ' build cost'; case 'buildTimeMult': return pct(v) + ' build time';
   case 'excavationCostMult': return pct(v) + ' dig cost'; case 'excavationTimeMult': return pct(v) + ' dig time';
   case 'waveIntervalMult': return pct(v) + ' time between waves';
   default: return '';
 }
 }
 const legacy = {
 title: (s) => `Legacy <small>${U().fmt(s.prestige.points)} Legacy Points · ${s.prestige.resets} reconstruction${s.prestige.resets === 1 ? '' : 's'}</small>`,
 render(s) {
 const gain = DE.Prestige.potentialPoints(s), c = DE.Prestige.canReset(s), b = DE.Prestige.breakdown(s), C = DE.CONFIG;
 const depthPct = Math.min(100, s.stats.maxDepth / C.PRESTIGE_MIN_DEPTH * 100), gainPct = Math.min(100, gain / C.PRESTIGE_MIN_GAIN * 100);
 const hero = `<div class="lg-hero ${c.ok ? 'ready' : ''}">
 <div class="lg-hero-l">${DE.Icons.img('trophy', 'lg-trophy')}<div><small>Legacy Points</small><b class="lg-big">${U().fmt(s.prestige.points)}</b><small>${U().fmt(s.prestige.lifetime)} earned in total</small></div></div>
 <div class="lg-hero-r"><h4>Reconstruction</h4><p>Abandon this bunker and start a new one, stronger. You keep Legacy Points, legacy upgrades, one artifact and your records; rooms, floors, survivors, research and resources are lost.</p>
 <div class="lg-req"><span>${DE.Icons.img('floors', 'ico-inline')} Reach B${C.PRESTIGE_MIN_DEPTH}</span><span class="pd-bar ${depthPct >= 100 ? 'ok' : 'warn'}"><i style="width:${depthPct}%"></i></span><b>B${s.stats.maxDepth}</b></div>
 <div class="lg-req"><span>${DE.Icons.img('star', 'ico-inline')} Earn ${C.PRESTIGE_MIN_GAIN}+ LP</span><span class="pd-bar ${gainPct >= 100 ? 'ok' : 'warn'}"><i style="width:${gainPct}%"></i></span><b>${gain}</b></div>
 <button class="btn ${c.ok ? 'danger' : 'cant'} lg-go" data-action="prestige" ${c.ok ? '' : 'disabled'}>${DE.Icons.img('recycle', 'ico-btn')} Reconstruct for +${gain} LP</button>${c.ok ? '' : `<small class="lg-why">${esc(c.reason)}</small>`}</div></div>`;
 // where the points come from (meter list, one hue)
 const src = [['production', 'chart', 'Resources produced', 'score ' + U().fmt(s.stats.runScore)], ['depth', 'floors', 'Deepest floor', 'B' + s.stats.maxDepth], ['research', 'research', 'Research done', Object.keys(s.research.done).length], ['rooms', 'rooms', 'Rooms built', s.stats.roomsBuilt], ['survivors', 'pop', 'Survivors recruited', s.stats.recruited], ['waves', 'wave', 'Waves defeated', s.stats.wavesSurvived]];
 const maxPart = Math.max(0.0001, ...src.map(x => b[x[0]]));
 const earn = `<div class="card lg-earn"><h4>This run would earn <b class="gold">+${gain} LP</b> <small class="muted">fractions add up; the total is rounded down</small></h4>${src.map(([k, ic, name, stat]) => `<div class="lg-src">${DE.Icons.img(ic, 'ico-inline')}<span class="lg-sn">${name}<small>${stat}</small></span><span class="pd-bar gold"><i style="width:${(b[k] / maxPart * 100).toFixed(1)}%"></i></span><b>+${b[k].toFixed(1)}</b></div>`).join('')}</div>`;
 // permanent upgrades
 const card = (id) => {
   const d = DE.Data.LEGACY[id], lvl = s.prestige.upgrades[id] || 0, cost = DE.Prestige.upgradeCost(id, lvl), maxed = lvl >= d.max, ok = !maxed && s.prestige.points >= cost;
   const now = lvl ? d.effects.map(e => lgEffect(e, lvl)).filter(Boolean).join(', ') : 'Not learned yet';
   const next = maxed ? '' : d.effects.map(e => lgEffect(e, lvl + 1)).filter(Boolean).join(', ');
   const pips = d.max <= 12 ? `<span class="lg-pips">${Array.from({ length: d.max }, (_, k) => `<i class="${k < lvl ? 'on' : ''}"></i>`).join('')}</span>` : `<span class="lg-lvbar"><i style="width:${lvl / d.max * 100}%"></i></span>`;
   return `<div class="lg-card ${maxed ? 'maxed' : ''} ${lvl ? 'owned' : ''}"><div class="lg-ci">${DE.Icons.img(LG_ICON[id] || 'trophy')}</div>
   <div class="lg-cb"><div class="lg-ct"><b>${esc(d.name)}</b><small>${lvl}/${d.max}</small></div>${pips}<p>${esc(d.desc)}</p>
   <div class="lg-now"><span>Now</span>${esc(now)}</div>${next ? `<div class="lg-next"><span>Next</span>${esc(next)}</div>` : ''}</div>
   ${maxed ? '<span class="tag gold lg-max">MAX</span>' : `<button class="btn ${ok ? 'primary' : 'cant'} small lg-buy" data-action="buyLegacy" data-id="${id}" ${ok ? '' : 'disabled'}>${DE.Icons.img('star', 'ico-btn')}${cost} LP</button>`}</div>`;
 };
 const ups = `<div class="card"><h4>Legacy upgrades <small class="muted">permanent — they carry into every future bunker</small></h4>${LG_GROUPS.map(([name, ids]) => `<div class="lg-gh">${name}</div><div class="lg-grid">${ids.filter(id => DE.Data.LEGACY[id]).map(card).join('')}</div>`).join('')}</div>`;
 // artifacts
 const ids = Object.keys(DE.Data.ARTIFACTS), found = ids.filter(id => s.artifacts && s.artifacts[id]).length;
 const arts = `<div class="card"><h4>${DE.Icons.img('artifacts', 'ico-inline')} Artifacts <small class="muted">${found}/${ids.length} found · from expeditions and the rock · one survives a Reconstruction</small></h4><div class="lg-arts">${ids.map(id => { const a = DE.Data.ARTIFACTS[id], have = s.artifacts && s.artifacts[id], relic = s.prestige.relic === id; return `<div class="lg-art ${have ? 'have' : ''}" title="${esc(have ? a.name + ' — ' + a.desc : 'Unknown artifact — keep exploring')}">${DE.Icons.img(a.icon, 'lg-aico')}<b>${have ? esc(a.name) : '???'}</b><small>${have ? esc(a.desc) : 'Not found yet'}</small>${relic ? '<em>Relic</em>' : ''}</div>`; }).join('')}</div></div>`;
 return hero + earn + ups + arts;
 },
 };

 /* ================= SETTINGS / MENU ================= */
 const settings = {
 live: false,
 title: () => ' Menu & Saves',
 render(s) {
 const st = s.stats;
 return `<div class="card"><h4>Save</h4><p class="muted">Autosaves every ${DE.CONFIG.AUTOSAVE_SEC}s and when you leave. Last saved: ${s.lastSave ? U().fmtTime((Date.now() - s.lastSave) / 1000) + ' ago' : 'never'}.</p>
 <div class="btn-row"><button class="btn primary" data-action="saveNow">Save now</button><button class="btn" data-action="exportSave">Export to text</button><button class="btn" data-action="copyExport">Copy export</button></div>
 <textarea id="export-area" class="save-area" placeholder="Export string appears here" readonly></textarea></div>
 <div class="card"><h4>Import</h4><p class="muted">Paste an exported save. It is validated and never executed.</p><textarea id="import-area" class="save-area" placeholder="Paste export string here"></textarea><button class="btn" data-action="importSave">Import save (replaces current run)</button></div>
 <div class="card"><h4>Sound</h4>${(() => { const a = DE.Audio.prefs(); return `<div class="row"><span>Music</span><input type="range" min="0" max="1" step="0.05" value="${a.music}" data-audio="music" class="vol"><button class="btn small ${a.musicOn ? 'active' : ''}" data-action="toggleMusic">${a.musicOn ? 'On' : 'Off'}</button></div>
 <div class="row"><span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${a.sfx}" data-audio="sfx" class="vol"><button class="btn small ${a.sfxOn ? 'active' : ''}" data-action="toggleSfx">${a.sfxOn ? 'On' : 'Off'}</button></div>`; })()}</div>
 <div class="card"><h4>Options</h4><div class="row"><span>Animations</span><button class="btn small ${s.settings.animations ? 'active' : ''}" data-action="toggleAnimations">${s.settings.animations ? 'On' : 'Off'}</button></div>
 <div class="row"><span>Offline cap</span><b>${s._fx.offlineCapHours}h</b></div></div>
 <div class="card"><h4>Statistics</h4><div class="stats-grid">
 <div><small>Playtime</small><b>${U().fmtTime(s.playtime)}</b></div><div><small>Zombies killed</small><b>${U().fmt(st.zombiesKilled)}</b></div>
 <div><small>Waves survived</small><b>${st.wavesSurvived}</b></div><div><small>Breaches</small><b>${st.breaches}</b></div>
 <div><small>Recruited</small><b>${st.recruited}</b></div><div><small>Expeditions</small><b>${st.expeditions}</b></div>
 <div><small>Deepest floor</small><b>B${st.maxDepth}</b></div><div><small>Lifetime LP</small><b>${U().fmt(s.prestige.lifetime)}</b></div></div>
 <h4>Lifetime production</h4><div class="row wrap">${DE.Data.RESOURCE_ORDER.map(r => `<span>${DE.Icons.res(r, 'ico-inline')} ${U().fmt(st.produced[r])}</span>`).join('')}</div></div>
 <div class="card"><h4>Event log</h4><ul class="log">${s.log.slice(-15).reverse().map(l => `<li>${esc(l.msg)}</li>`).join('')}</ul></div>
 <div class="card danger-zone"><h4>Danger zone</h4><div class="btn-row"><button class="btn" data-action="toMenu">← Main menu</button><button class="btn danger" data-action="hardReset"> Delete save & restart</button></div></div>
 <p class="muted center">DEAD END: Underground · built with vanilla JS · no servers, no accounts.</p>`;
 },
 };

 return { survivors, economy, research, excavate, defense, expeditions, legacy, settings, survivorCard, assignmentText };
})();
