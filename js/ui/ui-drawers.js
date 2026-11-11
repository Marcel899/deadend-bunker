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
 <div class="sc-portrait"><div class="sc-glow"></div>${DE.Chars.crew(sv.profession, { anim: away ? 'walk' : sv.act && sv.act.kind === 'sleep' ? 'idle' : 'idle', h: 92, title: P()[sv.profession].name })}
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
 const economy = {
 title: (s) => `Production <small>morale ×${DE.Economy.moraleMult(s.morale).toFixed(2)} · power ${s._rates.powerFactor < 1 ? '<span class="neg">brownout ×' + s._rates.powerFactor.toFixed(2) + '</span>' : 'OK'}</small>`,
 render(s) {
 const r = s._rates;
 const rows = DE.Data.RESOURCE_ORDER.map(id => {
 const d = R()[id]; const stock = s.resources[id], cap = DE.Economy.storageCap(s, id), net = r.net[id];
 let eta = '—', warn = '';
 if (net < -1e-6) { eta = ' empty in ' + U().fmtTime(stock / -net); if (stock / -net < 300) warn = 'neg'; }
 else if (net > 1e-6 && isFinite(cap)) { eta = stock >= cap - 1 ? ' full' : ' full in ' + U().fmtTime((cap - stock) / net); if (stock >= cap - 1) warn = 'warn'; }
 if (stock <= 0.01 && r.consumption[id] > 0) warn = 'neg';
 return `<tr class="${warn}"><td>${DE.Icons.res(id, 'ico-inline')} ${d.name}</td><td>${U().fmt(stock)}${isFinite(cap) ? ' / ' + U().fmt(cap) : ''}</td><td class="pos">+${U().fmt(r.production[id], 2)}</td><td class="neg">−${U().fmt(r.consumption[id], 2)}</td><td><b class="${net < 0 ? 'neg' : 'pos'}">${U().fmtRate(net)}</b></td><td>${eta}</td></tr>`;
 }).join('');
 const warnings = [];
 if (r.powerFactor < 1) warnings.push(` Brownout: demand ${U().fmt(r.powerUse, 2)}/s exceeds supply ${U().fmt(r.powerGen, 2)}/s. Powered rooms run at ${Math.round(r.powerFactor * 100)}%.`);
 DE.Data.RESOURCE_ORDER.forEach(id => { if (s.resources[id] <= 0.01 && r.consumption[id] > 0) warnings.push(`${DE.Icons.res(id, 'ico-inline')} Out of ${R()[id].name} — rooms that need it are starved.`); });
 if (r.net.food < 0 && s.resources.food / -r.net.food < 600) warnings.push(' Food runs out within 10 minutes.');
 if (r.net.water < 0 && s.resources.water / -r.net.water < 600) warnings.push(' Water runs out within 10 minutes.');
 const rooms = Object.values(s.rooms).filter(x => x.level > 0 && r.perRoom[x.id]).map(x => { const i = r.perRoom[x.id]; const def = DE.Data.ROOMS[x.type]; const out = Object.keys(i.produces).map(k => `<span class="pos">+${U().fmt(i.produces[k], 2)}${DE.Icons.res(k, 'ico-inline')}</span>`).join(''); const inp = Object.keys(i.consumes).map(k => `<span class="neg">−${U().fmt(i.consumes[k], 2)}${DE.Icons.res(k, 'ico-inline')}</span>`).join('') + (i.powerUse ? ` <span class="neg">−${U().fmt(i.powerUse, 2)}</span>` : ''); return { x, def, i, html: `<div class="row econ-row" data-action="selectRoom" data-id="${x.id}"><span>${DE.Icons.room(def.id, 'ico-inline')} ${esc(def.name)} <small class="muted">B${x.floor} Lv${x.level} · ${x.workers.length}/${def.workers} workers · eff ${Math.round(i.workerMult * i.power * i.starve * 100)}%</small></span><span>${out} ${inp}</span></div>` }; });
 return `<div class="card"><table class="econ"><thead><tr><th>Resource</th><th>Stock</th><th>Income</th><th>Use</th><th>Net</th><th>Forecast</th></tr></thead><tbody>${rows}</tbody></table>
 <div class="row small"><span>Survivors eat ${U().fmt(r.survivorFood, 2)} /s and drink ${U().fmt(r.survivorWater, 2)} /s · Power ${U().fmt(r.powerGen, 2)} generated / ${U().fmt(r.powerUse, 2)} used</span></div></div>
 ${warnings.length ? `<div class="card warn-card"><h4>Warnings</h4>${warnings.map(w => `<p>${w}</p>`).join('')}</div>` : '<div class="card"><p class="pos"> No shortages.</p></div>'}
 <div class="card"><h4>Per room <small class="muted">click to select</small></h4>${rooms.map(q => q.html).join('') || '<p class="muted">No active rooms.</p>'}</div>`;
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
 ${row('trophy', 'Reward on victory', U().costText(reward) || '—')}
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
   </svg><div class="dk-horde">${kinds.slice(0, 4).map((z, i) => `<span style="animation-delay:${-i * .9}s" title="${esc(z.name)} ×${comp.counts[z.id]}">${DE.Chars.zombie(z.id, { anim: 'walk', h: z.boss || z.id === 'brute' || z.id === 'mutant' ? 74 : 58, flip: true })}<em>×${comp.counts[z.id]}</em></span>`).join('')}</div><div class="dk-flag">${I('battle', '')}</div></div></div>`;
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
   gs.length ? `${U().fmt(pw.guardDps, 1)} dmg/s on duty` : 'Nobody on guard duty', gs.length ? 'pos' : 'warn', DE.Chars.crew('soldier', { anim: 'guard', h: 58, item: 'ak' }),
   pool.map(sv => { const g = sv.assignment && sv.assignment.kind === 'guard'; return `<div class="dk-line">${DE.Chars.crew(sv.profession, { anim: 'idle', h: 34 })}<span><b>${esc(sv.name)}</b><small>Lv${sv.level} · ${U().fmt(DE.Survivors.guardPower(sv, fx), 1)} dmg/s${sv.hp < 50 ? ' · hurt' : ''}</small></span><button class="btn small ${g ? 'active' : ''}" data-action="toggleGuard" data-sid="${sv.id}">${g ? I('check', 'ico-btn') + ' On duty' : 'Post as guard'}</button></div>`; }).join('') || '<p>No survivors available.</p>');
 const owDone = DE.Data.OVERWORLD_ORDER.filter(k => !DE.Defense.structureNext(s, k)).length;
 html += section('perimeter', I('perimeter', 'dk-big'), 'Perimeter', 'Fence, barricades, towers, lights, road and the missile battery.', `${owDone}/${DE.Data.OVERWORLD_ORDER.length} fully upgraded`, '', DE.Icons.structure('fence', 'dk-art'),
   DE.Data.OVERWORLD_ORDER.map(k => { const def = DE.Data.OVERWORLD[k]; const lv = (s.overworld && s.overworld[k]) || 0; const cur = def.levels[lv]; const next = DE.Defense.structureNext(s, k); const blocked = next && DE.Defense.structureBlocked(s, k); const ok = next && !blocked && U().canAfford(s.resources, next.cost);
   return `<div class="dk-line">${DE.Icons.structure(k, 'dk-mid')}<span><b>${esc(def.name)} <em class="tag">${esc(cur.name)}</em></b><small>${next ? esc(next.name) + ' — ' + esc(next.desc) : esc(cur.desc) + ' · fully upgraded'}</small>${blocked ? `<small class="neg">${esc(blocked)}</small>` : ''}</span>${next ? `<button class="btn primary small ${ok ? '' : 'cant'}" data-action="owUpgrade" data-key="${k}" ${ok ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(next.cost)}</span></button>` : '<b class="gold">MAX</b>'}</div>`; }).join(''));
 html += section('bestiary', I('zombies', 'dk-big'), 'Bestiary', 'Know what is coming.', `${DE.Data.ZOMBIES.filter(z => z.minWave <= d.wave).length}/${DE.Data.ZOMBIES.length} sighted`, '', '',
   DE.Data.ZOMBIES.map(z => `<div class="dk-line ${z.minWave > d.wave ? 'locked-row' : ''}">${DE.Chars.zombie(z.id, { anim: 'idle', h: 40 })}<span><b>${esc(z.name)}</b><small>${z.boss ? 'every ' + DE.Data.BOSS_EVERY + 'th wave' : 'from wave ' + z.minWave + ' · ' + z.hp + ' HP'} · wall dmg ×${z.dmg} · ${esc(z.desc)}</small></span></div>`).join(''));
 if (d.log.length) html += section('log', I('battle', 'dk-big'), 'Battle log', 'The last waves at the gate.', (() => { const r = d.log[d.log.length - 1]; return 'Last: wave ' + r.wave + ' · ' + (r.outcome === 'victory' ? 'repelled' : r.outcome === 'held' ? 'wall held' : 'BREACH'); })(), d.log[d.log.length - 1].outcome === 'breach' ? 'neg' : 'pos', '',
   d.log.slice().reverse().slice(0, 8).map(r => `<div class="dk-line log ${r.outcome}">${I(r.outcome === 'breach' ? 'warning' : 'check', 'dk-ico')}<span><b>Wave ${r.wave} · ${r.outcome === 'victory' ? 'Repelled' : r.outcome === 'held' ? 'Wall held (−' + r.wallDamage + ' HP)' : 'BREACH'}</b><small>${r.killed} killed${r.reward && Object.keys(r.reward).length ? ' · loot ' + U().costText(r.reward) : ''}${r.injured.length ? ' · injured: ' + r.injured.map(esc).join(', ') : ''}</small></span></div>`).join(''));
 return html;
 },
 };

 /* ================= EXPEDITIONS ================= */
 const expeditions = {
 title: (s) => `Expeditions <small>${s.expeditions.active.length}/${DE.Expeditions.slots(s)} teams out</small>`,
 render(s) {
 const now = Date.now(); const ex = ui().expedition;
 if (!DE.Expeditions.unlocked(s)) return `<div class="card"><h4>No Garage</h4><p>Build a  <b>Garage</b> (needs research: Reinforced Construction) to send survivors to the surface for loot, fuel and new recruits.</p></div>`;
 let html = '';
 const bus = DE.Events.bus(s), nextBus = DE.Events.busNext(s);
 html += `<div class="card bus-card"><h4>${DE.Icons.img('truck', 'ico-inline')} Vehicle: ${esc(bus.name)} <small class="muted">${bus.capacity} seats · ${Math.round((1 - bus.speed) * 100)}% faster · ${Math.round(bus.safety * 100)}% safer · cargo x${bus.cargo}</small></h4><p class="muted">${esc(bus.desc)}</p>
 ${nextBus ? `<div class="row"><span><b>Next:</b> ${esc(nextBus.name)} <small class="muted">${esc(nextBus.desc)}</small></span><button class="btn primary small ${U().canAfford(s.resources, nextBus.cost) ? '' : 'cant'}" data-action="busUpgrade" ${U().canAfford(s.resources, nextBus.cost) ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(nextBus.cost)}</span></button></div>` : '<b class="gold">Fully upgraded</b>'}
 <div class="row small"><span>Factions</span><b>${DE.Data.OVERWORLD ? Object.values(DE.Data.FACTIONS).map(f => `<span class="tag" title="${esc(f.desc)}">${esc(f.name)} ${(s.rep && s.rep[f.id]) || 0 >= 0 ? '+' : ''}${(s.rep && s.rep[f.id]) || 0}</span>`).join(' ') : ''}</b></div></div>`;
 if (s.expeditions.active.length) html += `<div class="card"><h4>Teams in the field</h4>${s.expeditions.active.map(e => { const loc = DE.Expeditions.location(e.location); return `<div class="exp-active"><b>${DE.Icons.img('location', 'ico-inline')} ${esc(loc.name)}</b> <small class="muted">${e.survivors.map(id => s.survivors[id] ? esc(s.survivors[id].name) : '?').join(', ')}</small>${bar(100 * (1 - (e.endsAt - now) / (e.duration * 1000)), 'blue')}<small class="muted">${U().fmtTime((e.endsAt - now) / 1000)} left</small></div>`; }).join('')}</div>`;
 const locs = DE.Data.LOCATIONS; const sel = DE.Expeditions.location(ex.location) || locs[0];
 html += `<div class="card"><h4>Destination</h4><div class="loc-grid">${locs.map(l => { const ok = l.minDepth <= s.floors.length; return `<button class="loc ${ex.location === l.id ? 'active' : ''} ${ok ? '' : 'locked'}" data-action="expLocation" data-id="${l.id}" ${ok ? '' : 'disabled'}><span class="loc-icon">${DE.Icons.img('location', 'ico-inline')}</span><b>${esc(l.name)}</b><small>${ok ? U().fmtTime(l.duration) + ' · risk ' + Math.round(l.danger * 100) + '%' : ' needs B' + l.minDepth}</small></button>`; }).join('')}</div>
 <p class="muted">${esc(sel.desc)} Loot: ${Object.keys(sel.loot).map(r => `${DE.Icons.res(r, 'ico-inline')} ${sel.loot[r][0]}–${sel.loot[r][1]}`).join(', ')}${sel.rescue ? ` · ${Math.round(sel.rescue * 100)}% chance to rescue a survivor` : ''}. Loot ×${s._fx.lootBonus.toFixed(2)} (garage) ×${(1 + 0.3 * (s.floors.length - 1)).toFixed(2)} (depth), more with bigger teams and scavengers.</p></div>`;
 const pool = DE.Survivors.available(s);
 html += `<div class="card"><h4>Team <small class="muted">${ex.members.length}/${bus.capacity} · scavengers find more and get hurt less</small></h4><div class="exp-team">${ex.members.map(id => s.survivors[id]).filter(Boolean).map(sv => `<span title="${esc(sv.name)}">${DE.Chars.crew(sv.profession, { anim: 'walk', h: 64 })}</span>`).join('') || `<span class="muted">Pick up to ${bus.capacity} survivors below.</span>`}</div>${pool.map(sv => { const on = ex.members.includes(sv.id); const hurt = sv.hp < 50; return `<div class="row"><span>${DE.Icons.prof(sv.profession, 'ico-inline')} ${esc(sv.name)} <small class="muted">Lv${sv.level}${hurt ? ' ·  injured' : ''}${sv.assignment ? ' · ' + assignmentText(s, sv) : ''}</small></span><button class="btn small ${on ? 'active' : ''}" data-action="expToggle" data-sid="${sv.id}" ${hurt ? 'disabled' : ''}>${on ? '✓ Going' : 'Add'}</button></div>`; }).join('')}
 ${(() => { const c = DE.Expeditions.canSend(s, ex.location, ex.members); return `<button class="btn primary ${c.ok ? '' : 'cant'}" data-action="expSend" ${c.ok ? '' : 'disabled'}> Send team to ${esc(sel.name)}</button>${c.ok ? '' : `<small class="neg">${c.reason}</small>`}`; })()}</div>`;
 if (s.expeditions.log.length) html += `<div class="card"><h4>Reports</h4>${s.expeditions.log.slice().reverse().slice(0, 8).map(r => { const loc = DE.Expeditions.location(r.location); return `<div class="log-row">${DE.Icons.img('location', 'ico-inline')} <b>${esc(loc.name)}</b>: ${Object.keys(r.loot).map(k => DE.Icons.res(k, 'ico-inline') + U().fmt(r.loot[k])).join('')}${r.rescued ? ' ·  rescued ' + esc(r.rescued) : ''}${r.injured.length ? ' ·  ' + r.injured.map(esc).join(', ') : ''}</div>`; }).join('')}</div>`;
 return html;
 },
 };

 /* ================= LEGACY ================= */
 const legacy = {
 title: (s) => `Reconstruction <small>${U().fmt(s.prestige.points)} Legacy Points</small>`,
 render(s) {
 const gain = DE.Prestige.potentialPoints(s); const c = DE.Prestige.canReset(s); const b = DE.Prestige.breakdown(s);
 const f1 = (v) => v.toFixed(1);
 let html = `<div class="card"><h4>${DE.Icons.img('badge', 'ico-inline')} Artifacts <small class="muted">unique finds from expeditions and the rock — one survives Reconstruction</small></h4>${Object.keys(DE.Data.ARTIFACTS).map(id => { const a = DE.Data.ARTIFACTS[id]; const have = s.artifacts && s.artifacts[id]; return `<div class="row ${have ? '' : 'locked-row'}"><span>${DE.Icons.img(a.icon, 'ico-inline')} <b>${esc(a.name)}</b> <small class="muted">${have ? esc(a.desc) : 'Not found yet'}</small></span>${have ? '<b class="gold">OWNED</b>' : ''}</div>`; }).join('')}${s.prestige.relic ? `<small class="muted">Relic carried from the last run: ${esc(DE.Data.ARTIFACTS[s.prestige.relic].name)}</small>` : ''}</div>`;
 html += `<div class="card"><h4>Start over, stronger</h4><p>Reconstruction abandons this bunker and begins a new one. You keep <b>Legacy Points</b>, legacy upgrades and lifetime records; rooms, floors, survivors, research and resources are lost.</p>
 <div class="row"><span>Resources produced (score ${U().fmt(s.stats.runScore)}, depth bonus)</span><b>${f1(b.production)}</b></div>
 <div class="row"><span>Rooms constructed (${s.stats.roomsBuilt})</span><b>${f1(b.rooms)}</b></div>
 <div class="row"><span>Deepest floor (B${s.stats.maxDepth})</span><b>${f1(b.depth)}</b></div>
 <div class="row"><span>Survivors recruited (${s.stats.recruited})</span><b>${f1(b.survivors)}</b></div>
 <div class="row"><span>Research unlocked (${Object.keys(s.research.done).length})</span><b>${f1(b.research)}</b></div>
 <div class="row"><span>Waves defeated (${s.stats.wavesSurvived})</span><b>${f1(b.waves)}</b></div>
 <div class="row total"><span>Legacy Points on reset</span><b class="gold">+${gain}</b></div>
 <div class="row"><span>Resets so far</span><b>${s.prestige.resets}</b></div>
 <p class="muted">Requires floor B${DE.CONFIG.PRESTIGE_MIN_DEPTH} and at least ${DE.CONFIG.PRESTIGE_MIN_GAIN} LP.</p>
 <button class="btn danger ${c.ok ? '' : 'cant'}" data-action="prestige" ${c.ok ? '' : 'disabled'}>${DE.Icons.img('refresh', 'ico-btn')} Reconstruct for +${gain} LP</button>${c.ok ? '' : `<small class="neg">${c.reason}</small>`}</div>`;
 html += `<div class="card"><h4>Legacy upgrades <small class="muted">${U().fmt(s.prestige.points)} LP available</small></h4>${DE.Data.LEGACY_ORDER.map(id => { const d = DE.Data.LEGACY[id]; const lvl = s.prestige.upgrades[id] || 0; const cost = DE.Prestige.upgradeCost(id, lvl); const maxed = lvl >= d.max; const ok = !maxed && s.prestige.points >= cost; return `<div class="lg-row"><div class="lg-icon">${DE.Icons.img('nav.legacy')}</div><div class="lg-body"><b>${esc(d.name)}</b> <small class="muted">${lvl}/${d.max}</small><div class="muted">${esc(d.desc)}</div></div>${maxed ? '<span class="tag gold">MAX</span>' : `<button class="btn primary small ${ok ? '' : 'cant'}" data-action="buyLegacy" data-id="${id}" ${ok ? '' : 'disabled'}>${cost} LP</button>`}</div>`; }).join('')}</div>`;
 return html;
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
