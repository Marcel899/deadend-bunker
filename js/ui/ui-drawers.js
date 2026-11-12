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
 if (a.kind === 'dig') return DE.Icons.img('dig', 'ico-inline') + ' Mining crew';
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
 /* Built for big crews. Overview chips that double as filters; warnings with one-tap fixes (empty
  * work stations, open guard and mining posts, the hurt and the exhausted); search, sort, a
  * profession filter and grouping by profession or by job; a compact list (or the big cards) where
  * every row shows what someone is doing, where, how they are and how good they are at it, and
  * moves them to another job with one tap; and a staffing table of every work station. While the
  * search box or a job picker has focus the panel is not rebuilt (see renderDrawer). */
 const RAR_ORDER = { common: 0, uncommon: 1, rare: 2, legendary: 3 };
 const SV_FILTERS = [['all', 'All'], ['idle', 'Idle'], ['working', 'Working'], ['guards', 'Guards'], ['miners', 'Mining'], ['away', 'Away'], ['hurt', 'Hurt'], ['tired', 'Tired'], ['hungry', 'Hungry']];
 const SV_TEST = {
   all: () => true, idle: (v) => !v.assignment, working: (v) => v.assignment && v.assignment.kind === 'room', guards: (v) => v.assignment && v.assignment.kind === 'guard',
   miners: (v) => v.assignment && v.assignment.kind === 'dig', away: (v) => v.assignment && v.assignment.kind === 'expedition', hurt: (v) => v.hp < 100,
   tired: (v) => (v.energy == null ? 100 : v.energy) < 30, hungry: (v) => (v.hunger || 0) > 80,
 };
 const SV_SORTS = [['level', 'Level'], ['eff', 'Skill at job'], ['name', 'Name'], ['prof', 'Profession'], ['health', 'Health'], ['energy', 'Energy'], ['mood', 'Mood'], ['rarity', 'Rarity']];
 /** How good someone is at what they are doing now (or at their best job when idle). */
 function svSkill(s, sv) {
   const a = sv.assignment, fx = s._fx;
   if (a && a.kind === 'guard') return { v: DE.Survivors.guardPower(sv, fx), t: U().fmt(DE.Survivors.guardPower(sv, fx), 1) + ' dmg/s' };
   if (a && a.kind === 'dig') return { v: DE.Excavation.minerSkill(s, sv), t: Math.round(DE.Excavation.minerSkill(s, sv) * 100) + '% miner' };
   const room = a && a.kind === 'room' ? s.rooms[a.id] : null, def = room ? DE.Data.ROOMS[room.type] : null;
   const e = DE.Survivors.efficiency(sv, def, fx); return { v: e, t: Math.round(e * 100) + '%' + (def && def.profession === sv.profession ? ' ★' : '') };
 }
 /** The group a survivor falls in when grouping by job: one per room, then guards, miners, away, idle. */
 function svJob(s, sv) {
   const a = sv.assignment;
   if (!a) return { key: 'z-idle', label: 'Idle', ic: DE.Icons.img('pop', 'ico-inline') };
   if (a.kind === 'guard') return { key: 'g', label: 'Guard duty', ic: DE.Icons.img('guards', 'ico-inline') };
   if (a.kind === 'dig') return { key: 'm', label: 'Mining crew', ic: DE.Icons.img('dig', 'ico-inline') };
   if (a.kind === 'expedition') return { key: 'x', label: 'On expeditions', ic: DE.Icons.img('truck', 'ico-inline') };
   const r = s.rooms[a.id]; if (!r) return { key: 'z-idle', label: 'Idle', ic: '' };
   const def = DE.Data.ROOMS[r.type];
   return { key: 'r' + String(r.floor).padStart(2, '0') + String(r.slot).padStart(2, '0'), label: def.name + ' · B' + r.floor + ' · ' + r.workers.length + '/' + def.workers, ic: DE.Icons.room(def.id, 'ico-inline') };
 }
 /** One-tap job picker: idle, guard duty, the mining crew, or any room with a free station. */
 function jobSelect(s, sv) {
   const a = sv.assignment, cur = !a ? '' : a.kind === 'room' ? 'r:' + a.id : a.kind;
   if (a && a.kind === 'expedition') return '<span class="sv-away">On the road</span>';
   const fx = s._fx, gFull = DE.Survivors.guards(s).length >= fx.guardCap, mFull = DE.Excavation.miners(s).length >= DE.Excavation.minerCap(s);
   const opt = (v, label, dis) => `<option value="${v}"${v === cur ? ' selected' : ''}${dis && v !== cur ? ' disabled' : ''}>${esc(label)}</option>`;
   const rooms = Object.values(s.rooms).filter(r => r.level > 0 && DE.Data.ROOMS[r.type].workers > 0).sort((x, y) => x.floor - y.floor || x.slot - y.slot);
   return `<select class="sv-job" id="svj-${sv.id}" data-change="assignSel" data-sid="${sv.id}" aria-label="Job for ${esc(sv.name)}">${opt('', 'Idle')}${opt('guard', 'Guard duty' + (gFull ? ' (full)' : ''), gFull)}${opt('dig', 'Mining crew' + (mFull ? ' (full)' : ''), mFull)}<optgroup label="Rooms">${rooms.map(r => { const d = DE.Data.ROOMS[r.type], full = r.workers.length >= d.workers; return opt('r:' + r.id, (d.profession === sv.profession ? '★ ' : '') + d.name + ' B' + r.floor + ' (' + r.workers.length + '/' + d.workers + ')', full); }).join('')}</optgroup></select>`;
 }
 const tens = (v) => Math.round(Math.max(0, Math.min(100, v)) / 10) * 10;
 function svRow(s, sv) {
   const rar = DE.Data.RARITIES[sv.rarity] || DE.Data.RARITIES.common, mood = Math.round(DE.Survivors.mood(s, sv)), sk = svSkill(s, sv);
   const en = sv.energy == null ? 100 : sv.energy, fed = 100 - (sv.hunger || 0);
   const traits = (sv.traits || []).map(t => DE.Data.TRAITS[t]).filter(Boolean).map(d => `<i title="${esc(d.name + ': ' + d.desc)}">${esc(d.name)}</i>`).join('');
   const bar = (cls, v, label) => `<span class="svb ${cls}" title="${label} ${Math.round(v)}%"><i style="width:${tens(v)}%"></i></span>`;
   return `<div class="sv-row rar-${rar.id}${sv.hp < 50 ? ' hurt' : ''}${ui().focusSurvivor === sv.id ? ' focus' : ''}" style="--rc:${rar.color}" data-sv="${sv.id}">
     <button class="sv-ava" data-action="svDetail" data-sid="${sv.id}" title="Details">${DE.Icons.prof(sv.profession, 'ava')}<b>${sv.level}</b></button>
     <div class="sv-id"><b data-action="svDetail" data-sid="${sv.id}">${esc(sv.name)}</b><small>${esc(P()[sv.profession].name)} · <span style="color:${rar.color}">${esc(rar.name)}</span>${traits ? ' · ' : ''}<span class="sv-tr">${traits}</span></small></div>
     <div class="sv-do"><span class="act-tag act-${sv.act ? sv.act.kind : 'idle'}">${DE.Needs.describe(sv)}</span><small>${assignmentText(s, sv)}</small></div>
     <div class="sv-vit">${bar('hp', sv.hp, 'Health')}${bar('en', en, 'Energy')}${bar('fd', fed, 'Fed')}</div>
     <div class="sv-num"><b class="${mood >= 50 ? 'pos' : mood >= 30 ? 'warn' : 'neg'}" title="Mood">${mood}</b><small title="Skill at the current job">${sk.t}</small></div>
     <div class="sv-pick">${jobSelect(s, sv)}</div></div>`;
 }
 /** Problems with the crew, each with a fix. */
 function svWarnings(s) {
   const out = [], fx = s._fx, I = (k) => DE.Icons.img(k, 'pd-aico');
   const idle = DE.Survivors.idle(s).filter(v => v.hp >= 25).length;
   const rooms = Object.values(s.rooms).filter(r => r.level > 0 && !r.construction && DE.Data.ROOMS[r.type].workers > 0);
   const empty = rooms.filter(r => !r.workers.length && DE.Data.ROOMS[r.type].produces), short = rooms.filter(r => r.workers.length && r.workers.length < DE.Data.ROOMS[r.type].workers);
   empty.slice(0, 3).forEach(r => { const d = DE.Data.ROOMS[r.type]; out.push({ sev: 'crit', ic: DE.Icons.room(d.id, 'pd-aico'), t: `<b>${esc(d.name)} B${r.floor}</b> has nobody working — it runs at ${Math.round(fx.unmannedBase * 100)}%.`, btn: idle ? `<button class="btn tiny primary" data-action="fillRoom" data-room="${r.id}">Staff it</button>` : '' }); });
   if (empty.length > 3) out.push({ sev: 'crit', ic: I('warning'), t: `<b>${empty.length - 3} more rooms</b> are unstaffed.` });
   const free = short.reduce((n, r) => n + DE.Data.ROOMS[r.type].workers - r.workers.length, 0);
   if (short.length) out.push({ sev: 'warn', ic: I('alert'), t: `<b>${short.length} room${short.length > 1 ? 's' : ''} understaffed</b> — ${free} free work station${free > 1 ? 's' : ''}.`, btn: idle ? `<button class="btn tiny primary" data-action="assignIdle">Fill with idle</button>` : '' });
   if (idle && !empty.length && !short.length) out.push({ sev: 'info', ic: I('pop'), t: `<b>${idle} idle</b> and every station is full — build or upgrade rooms, post guards or miners.` });
   const gOpen = fx.guardCap - DE.Survivors.guards(s).length; if (gOpen > 0 && s.defense.wave > 1) out.push({ sev: 'info', ic: I('guards'), t: `<b>${gOpen} guard post${gOpen > 1 ? 's' : ''}</b> empty.`, btn: idle ? `<button class="btn tiny" data-action="fillGuards">Post guards</button>` : '' });
   const mOpen = DE.Excavation.minerCap(s) - DE.Excavation.miners(s).length; if (s.excavation && mOpen > 0) out.push({ sev: 'info', ic: I('dig'), t: `<b>${mOpen} mining post${mOpen > 1 ? 's' : ''}</b> open while B${s.excavation.depth} is being dug.`, btn: idle ? `<button class="btn tiny" data-action="fillMiners">Send miners</button>` : '' });
   const hurt = Object.values(s.survivors).filter(v => v.hp < 50).length; const ward = DE.Needs.findRoom(s, DE.Needs.HEAL_ROOMS);
   if (hurt) out.push({ sev: ward ? 'info' : 'warn', ic: I('medkit'), t: `<b>${hurt} badly hurt</b> — they work at half pace${ward ? ' and are being treated' : '. A Medical Bay would treat them'}.` });
   const beds = DE.Needs.BED_ROOMS ? Object.values(s.rooms).filter(r => r.level > 0 && DE.Needs.BED_ROOMS.includes(r.type)).reduce((n, r) => n + DE.Data.bedsFor(r.type, r.level).length, 0) : 99;
   const tired = Object.values(s.survivors).filter(v => (v.energy == null ? 100 : v.energy) < 12 && !(v.act && v.act.kind === 'sleep')).length;
   if (tired) out.push({ sev: 'warn', ic: I('power'), t: `<b>${tired} exhausted</b> and waiting for a bed (${beds} berth${beds === 1 ? '' : 's'}) — upgrade the Sleeping Quarters.` });
   return out;
 }
 /** Every room with work stations: who is there, how full, how well it runs. */
 function staffing(s) {
   const fx = s._fx, idle = DE.Survivors.idle(s).filter(v => v.hp >= 25).length;
   const rooms = Object.values(s.rooms).filter(r => r.level > 0 && DE.Data.ROOMS[r.type].workers > 0).sort((a, b) => a.floor - b.floor || a.slot - b.slot);
   if (!rooms.length) return '';
   const rows = rooms.map(r => {
     const d = DE.Data.ROOMS[r.type], n = r.workers.length, info = s._rates && s._rates.perRoom[r.id], wm = info ? info.workerMult : 0;
     const faces = r.workers.map(id => s.survivors[id]).filter(Boolean).map(v => `<span title="${esc(v.name)}${d.profession === v.profession ? ' ★' : ''}" class="${d.profession === v.profession ? 'match' : ''}">${DE.Icons.prof(v.profession, 'ava')}</span>`).join('');
     return `<div class="st-row ${!n ? 'none' : n < d.workers ? 'short' : 'full'}"><span class="st-room" data-action="selectRoom" data-id="${r.id}">${DE.Icons.room(d.id, 'ico-inline')}<b>${esc(d.name)}</b><small>B${r.floor} · Lv${r.level}${d.profession ? ' · ' + esc(P()[d.profession].name) + 's ★' : ''}</small></span>
       <span class="st-faces">${faces}${'<i class="st-empty"></i>'.repeat(Math.max(0, d.workers - n))}</span><span class="st-n">${n}/${d.workers}<small>${Math.round(wm * 100)}% staffed</small></span>
       <span class="st-act">${n < d.workers && idle ? `<button class="btn tiny primary" data-action="fillRoom" data-room="${r.id}">+ Fill</button>` : ''}</span></div>`;
   }).join('');
   const tot = rooms.reduce((a, r) => a + DE.Data.ROOMS[r.type].workers, 0), on = rooms.reduce((a, r) => a + r.workers.length, 0);
   return `<div class="sv-sec"><h4>${DE.Icons.img('rooms', 'ico-h4')} Work stations <small>${on}/${tot} staffed</small></h4><div class="st-list">${rows}</div></div>`;
 }
 const survivors = {
 title: (s) => `Survivors <small>${DE.Bunker.population(s)} / ${DE.Bunker.housingCapacity(s)} housing</small>`,
 tick() {
   // bring a survivor picked in the bunker into view, once
   const f = ui().focusSurvivor; if (!f) return; const row = document.querySelector(`.sv-row[data-sv="${f}"]`);
   if (row) { row.scrollIntoView({ block: 'center' }); ui().focusSurvivor = null; setTimeout(() => row.classList.remove('focus'), 2500); }
 },
 render(s) {
 const u = ui(), cost = DE.Survivors.recruitCost(s), can = DE.Survivors.canRecruit(s);
 const filter = SV_TEST[u.survivorFilter] ? u.survivorFilter : 'all', prof = u.svProf || '', sort = u.svSort || 'level', group = u.svGroup || 'none', q = (u.svSearch || '').trim().toLowerCase();
 const all = Object.values(s.survivors), pop = all.length, capH = DE.Bunker.housingCapacity(s);
 const view = u.svView || (pop > 6 ? 'list' : 'cards');
 const odds = Object.values(DE.Data.RARITIES), tw = odds.reduce((a, r) => a + r.weight, 0);
 // ---- the crew at a glance ----
 const avg = (f) => all.length ? all.reduce((a, v) => a + f(v), 0) / all.length : 0;
 const working = all.filter(SV_TEST.working).length + all.filter(SV_TEST.guards).length + all.filter(SV_TEST.miners).length;
 const chips = SV_FILTERS.map(([k, l]) => { const n = all.filter(SV_TEST[k]).length; if (!n && k !== 'all' && k !== 'idle' && filter !== k) return ''; return `<button class="sv-chip ${filter === k ? 'active' : ''} f-${k}" data-action="setFilter" data-filter="${k}"><b>${n}</b><small>${l}</small></button>`; }).join('');
 const profs = DE.Data.PROFESSION_ORDER.map(p => [p, all.filter(v => v.profession === p).length]).filter(x => x[1]);
 const warn = svWarnings(s);
 let html = `<div class="sv-top">
   <div class="rc-card"><div class="rc-radio"><span class="rv-signal"><i></i><i></i><i></i></span>${DE.Icons.img('signal', 'rc-ico')}</div>
     <div class="rc-text"><b>Recruit a survivor</b><small>Someone out there is always listening. Who answers is up to fate.</small>
       <div class="rc-odds">${odds.map(r => `<span style="--c:${r.color}"><i></i>${r.name} ${Math.round(100 * r.weight / tw)}%</span>`).join('')}</div></div>
     <div class="rc-go"><button class="btn primary ${can.ok ? '' : 'cant'}" data-action="recruit" ${can.ok ? '' : 'disabled'}>${DE.Icons.img('signal', 'ico-btn')} Call on the radio <span class="cost">${U().costText(cost)}</span></button>${can.ok ? '' : `<small class="neg">${esc(can.reason)}</small>`}</div></div>
   <div class="sv-sum">
     <div><small>Housing</small><b class="${pop >= capH ? 'warn' : ''}">${pop}/${capH}</b></div>
     <div><small>Morale</small><b class="${s.morale >= 50 ? 'pos' : s.morale >= 30 ? 'warn' : 'neg'}">${Math.round(s.morale)}</b></div>
     <div><small>On a job</small><b>${working}/${pop}</b></div>
     <div><small>Avg level</small><b>${avg(v => v.level).toFixed(1)}</b></div>
     <div><small>Avg health</small><b class="${avg(v => v.hp) >= 80 ? 'pos' : 'warn'}">${Math.round(avg(v => v.hp))}%</b></div>
     <div><small>Food & water</small><b>${(DE.CONFIG.SURVIVOR_FOOD * 60 * pop).toFixed(1)}/min</b></div>
   </div></div>
 ${warn.length ? `<div class="pd-alerts sv-warn">${warn.map(w => `<div class="pd-alert ${w.sev}">${w.ic}<span>${w.t}</span>${w.btn || ''}</div>`).join('')}</div>` : ''}
 <div class="sv-chips">${chips}</div>
 <div class="sv-tools">
   <label class="sv-search">${DE.Icons.img('search', 'ico-inline')}<input type="search" id="sv-search" data-input="svSearch" placeholder="Search name, job, trait…" value="${esc(u.svSearch || '')}" autocomplete="off" spellcheck="false"></label>
   <label class="sv-sel"><small>Sort</small><select id="sv-sort" data-change="svSort">${SV_SORTS.map(([k, l]) => `<option value="${k}"${sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
   <label class="sv-sel"><small>Group</small><select id="sv-group" data-change="svGroup">${[['none', 'None'], ['prof', 'Profession'], ['job', 'Job']].map(([k, l]) => `<option value="${k}"${group === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
   <span class="sv-views"><button class="btn tiny ${view === 'list' ? 'active' : ''}" data-action="svView" data-view="list">List</button><button class="btn tiny ${view === 'cards' ? 'active' : ''}" data-action="svView" data-view="cards">Cards</button></span>
   ${DE.Survivors.idle(s).length ? `<button class="btn small primary sv-putwork" data-action="assignIdle" title="Every idle survivor goes to the free work station they are best at">${DE.Icons.img('pop', 'ico-btn')} Put ${DE.Survivors.idle(s).length} idle to work</button>` : ''}
   <button class="btn small" data-action="optimizeJobs" title="Re-deal the room jobs so professions match their rooms (guards, miners and expeditions stay put)">${DE.Icons.img('recycle', 'ico-btn')} Best jobs</button>
 </div>
 <div class="sv-profs"><button class="sv-pf ${prof ? '' : 'active'}" data-action="svProf" data-prof="">All jobs</button>${profs.map(([p, n]) => `<button class="sv-pf ${prof === p ? 'active' : ''}" data-action="svProf" data-prof="${p}" title="${esc(P()[p].name)}: ${esc(P()[p].desc)}">${DE.Icons.prof(p, 'ico-inline')}<b>${n}</b></button>`).join('')}</div>`;
 // ---- the list ----
 const match = (v) => { if (!q) return true; const hay = (v.name + ' ' + P()[v.profession].name + ' ' + (v.traits || []).map(t => (DE.Data.TRAITS[t] || {}).name || '').join(' ') + ' ' + svJob(s, v).label + ' ' + DE.Needs.describe(v)).toLowerCase(); return hay.includes(q); };
 const cmp = {
   level: (a, b) => b.level - a.level || b.xp - a.xp, name: (a, b) => a.name.localeCompare(b.name), prof: (a, b) => a.profession.localeCompare(b.profession) || b.level - a.level,
   eff: (a, b) => svSkill(s, b).v - svSkill(s, a).v, health: (a, b) => a.hp - b.hp, energy: (a, b) => (a.energy == null ? 100 : a.energy) - (b.energy == null ? 100 : b.energy),
   mood: (a, b) => DE.Survivors.mood(s, a) - DE.Survivors.mood(s, b), rarity: (a, b) => (RAR_ORDER[b.rarity] || 0) - (RAR_ORDER[a.rarity] || 0) || b.level - a.level,
 }[sort] || ((a, b) => b.level - a.level);
 const list = all.filter(SV_TEST[filter]).filter(v => !prof || v.profession === prof).sort((a, b) => cmp(a, b) || a.name.localeCompare(b.name));
 const hidden = all.length - list.length;
 const rowsOf = (vs) => view === 'cards' ? `<div class="sv-grid">${vs.map(v => `<div class="sv-cardwrap${match(v) ? '' : ' sv-hide'}" data-q="${esc((v.name + ' ' + P()[v.profession].name + ' ' + svJob(s, v).label).toLowerCase())}">${survivorCard(s, v)}</div>`).join('')}</div>`
   : `<div class="sv-list">${vs.map(v => svRow(s, v).replace('class="sv-row', `data-q="${esc((v.name + ' ' + P()[v.profession].name + ' ' + (v.traits || []).map(t => (DE.Data.TRAITS[t] || {}).name || '').join(' ') + ' ' + svJob(s, v).label + ' ' + DE.Needs.describe(v)).toLowerCase())}" class="sv-row${match(v) ? '' : ' sv-hide'}`)).join('')}</div>`;
 if (!list.length) html += `<p class="muted sv-none">Nobody here${hidden ? ' — ' + hidden + ' hidden by the filters' : ''}.</p>`;
 else if (group === 'none') html += rowsOf(list);
 else {
   const groups = {};
   list.forEach(v => { const g = group === 'prof' ? { key: v.profession, label: P()[v.profession].name + 's', ic: DE.Icons.prof(v.profession, 'ico-inline') } : svJob(s, v); (groups[g.key] = groups[g.key] || { g, vs: [] }).vs.push(v); });
   Object.keys(groups).sort().forEach(k => { const G = groups[k]; html += `<div class="sv-group"><h5>${G.g.ic}${esc(G.g.label)}<span class="cost">${G.vs.length}</span></h5>${rowsOf(G.vs)}</div>`; });
 }
 html += staffing(s);
 return html;
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
 /* The dig site: the dig in progress or the next floor (what the rock asks for and what it gives
  * back), the mining crew (posts, who is on them, the best picks), the ladder of rock layers down to
  * the mantle, and what digging has turned up. */
 const excavate = {
 title: (s) => `Excavation <small>${s.floors.length} floor${s.floors.length > 1 ? 's' : ''} · ${esc(DE.Excavation.faceLayer(s).name)}</small>`,
 render(s) {
 const X = DE.Excavation, d = X.nextDepth(s), L = X.layer(d), crew = X.miners(s), cap = X.minerCap(s), sp = X.speed(s), mh = X.mineLevel(s);
 const I = (k, c) => DE.Icons.img(k, c || 'ico-inline'), look = (id) => (DE.UI.DigSite.LOOK[id] || {}).face || '#777';
 const mhRoom = Object.values(s.rooms).filter(r => r.type === 'minehead').sort((a, b) => b.level - a.level)[0];
 let html = '';
 // ---- the dig ----
 if (s.excavation) {
   const p = X.progress(s);
   html += `<div class="card xv-now"><div class="xv-head"><i class="xv-swatch" style="background:${look(L.id)}"></i><div><h4>Digging B${s.excavation.depth} · ${esc(L.name)}</h4><small class="muted">${esc(L.desc)}</small></div></div>
     ${bar(100 * p, 'brown')}<div class="xv-stats"><span><b>${Math.floor(100 * p)}%</b>dug</span><span><b>${U().fmtTime(X.remaining(s))}</b>left</span><span><b>×${sp.toFixed(1)}</b>pace</span><span><b>${U().costText(X.spoils(s, s.excavation.depth)) || '—'}</b>rubble when done</span></div>
     ${crew.length ? '' : `<p class="neg">Nobody is on the mining crew — the dig crawls along. Post miners below.</p>`}</div>`;
 } else if (d > DE.CONFIG.MAX_FLOORS) html += `<div class="card"><p>You have reached the mantle. The bunker is as deep as it can go.</p></div>`;
 else {
   const c = X.canStart(s), req = X.requirements(s, d);
   const reqRow = (r) => `<div class="xv-req ${r.ok ? 'ok' : 'no'}">${I(r.ok ? 'check' : 'lock')}<span>${esc(r.text)}${r.tool ? ` <small class="muted">· ${esc(r.tool)}</small>` : ''}</span>${r.ok ? '' : r.kind === 'research' ? `<button class="btn tiny" data-action="openDrawer" data-drawer="research">Research</button>` : mhRoom ? `<button class="btn tiny" data-action="selectRoom" data-id="${mhRoom.id}">Upgrade</button>` : `<small class="muted">build it in an empty cell</small>`}</div>`;
   html += `<div class="card xv-now"><div class="xv-head"><i class="xv-swatch" style="background:${look(L.id)}"></i><div><h4>Next floor: B${d} · ${esc(L.name)}</h4><small class="muted">${esc(L.desc)}</small></div></div>
     ${req.length ? `<div class="xv-reqs">${req.map(reqRow).join('')}</div>` : ''}
     <div class="xv-stats"><span><b>${U().costText(X.cost(s, d))}</b>cost</span><span><b>${U().fmtTime(X.time(s, d))}</b>with ${crew.length || 'no'} miner${crew.length === 1 ? '' : 's'}</span><span><b>×${L.hardness}</b>rock hardness</span><span><b>${U().costText(X.spoils(s, d)) || '—'}</b>rubble</span></div>
     <p class="muted">A new floor has ${DE.CONFIG.FLOOR_SLOTS} cells (rooms take 2 or 4) and can be widened sideways — plan what goes where. From B3 down you may break into abandoned facilities.</p>
     <button class="btn primary ${c.ok ? '' : 'cant'}" data-action="excavate" ${c.ok ? '' : 'disabled'}>${I('dig', 'ico-btn')} Excavate B${d}</button>${c.ok ? '' : `<small class="neg">${esc(c.reason)}</small>`}</div>`;
 }
 // ---- the crew ----
 const free = cap - crew.length, fxs = s._fx || DE.Effects.get(s);
 const q = (s._rates && s._rates.quarry) || {}, qs = Object.keys(q).filter(r => q[r] > 0).map(r => '+' + U().fmt(q[r], 2) + ' ' + DE.Icons.res(r, 'ico-inline') + '/s').join(' ');
 const line = (sv, on) => { const e = on ? X.minerEff(s, sv, fxs) : X.minerSkill(s, sv); const where = !on && sv.assignment ? ' · leaves ' + assignmentText(s, sv) : !on ? ' · idle' : ' · ' + esc(DE.Needs.describe(sv).toLowerCase());
   return `<div class="dk-line${on ? ' on' : ''}">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b><small>${esc(P()[sv.profession].name)} · Lv${sv.level} · ${Math.round(e * 100)}% miner${where}</small></span>${on ? `<button class="btn small" data-action="unassign" data-sid="${sv.id}">Off duty</button>` : `<button class="btn small ${sv.assignment ? '' : 'primary'}" data-action="assignMiner" data-sid="${sv.id}">Dig</button>`}</div>`; };
 const cands = Object.values(s.survivors).filter(v => !(v.assignment && (v.assignment.kind === 'dig' || v.assignment.kind === 'expedition')) && v.hp >= 40)
   .sort((a, b) => (a.assignment ? 1 : 0) - (b.assignment ? 1 : 0) || X.minerSkill(s, b) - X.minerSkill(s, a)).slice(0, 6);
 html += `<div class="card xv-crew"><div class="xv-crew-head"><h4>${I('dig', 'ico-h4')} Mining crew <span class="cost">${crew.length}/${cap} posts</span></h4>${free > 0 && DE.Survivors.idle(s).length ? `<button class="btn small primary" data-action="fillMiners">Fill posts</button>` : ''}</div>
   <p class="muted">Miners do the digging: each one adds pace (engineers and mechanics best, rested and fed miners more). ${mh ? `Mining Station Lv ${mh}: ${cap} posts, +${Math.round((fxs.digSpeed || 0) * 100)}% pace.` : 'A Mining Station adds posts and pace — and the deeper layers require one.'}${qs ? ' Between digs the crew quarries the face: ' + qs + '.' : ''}</p>
   ${crew.map(sv => line(sv, true)).join('') || '<p class="neg">Nobody is digging.</p>'}
   ${free > 0 && cands.length ? `<h5>Best picks for the ${free} free post${free > 1 ? 's' : ''}</h5>${cands.map(sv => line(sv, false)).join('')}` : ''}</div>`;
 // ---- the layers ----
 html += `<div class="card xv-layers"><h4>${I('floors', 'ico-h4')} Down through the rock</h4>${DE.Data.STRATA.map(st => {
   const done = s.floors.length >= Math.min(st.to, DE.CONFIG.MAX_FLOORS), here = d >= st.from && d <= st.to, n = st.research && DE.Data.RESEARCH[st.research];
   const resOk = !st.research || X.maxDepth(s) >= st.from, mineOk = mh >= (st.mine || 0);
   return `<div class="xv-layer ${done ? 'done' : here ? 'here' : ''}"><i class="xv-swatch" style="background:${look(st.id)}"></i><div><b>${esc(st.name)}</b> <small class="muted">B${st.from}–B${Math.min(st.to, DE.CONFIG.MAX_FLOORS)} · hardness ×${st.hardness} · ${esc(st.tool)}</small>
     <div class="xv-tags">${n ? `<i class="${resOk ? 'ok' : ''}">${I(resOk ? 'check' : 'research')}${esc(n.name)}</i>` : ''}${st.mine ? `<i class="${mineOk ? 'ok' : ''}">${I(mineOk ? 'check' : 'dig')}Mining Station Lv ${st.mine}</i>` : ''}<i>${I('chest')}rubble: ${Object.keys(st.spoils || {}).map(r => DE.Data.RESOURCES[r].name.toLowerCase()).join(', ')}</i></div></div>${done ? `<span class="xv-st">${I('check')}</span>` : here ? '<span class="xv-st here">YOU ARE HERE</span>' : ''}</div>`; }).join('')}</div>`;
 const found = s.floors.filter(f => f.facility);
 html += `<div class="card"><h4>Discoveries ${found.length}/${DE.Data.FACILITIES.length}</h4>${DE.Data.FACILITIES.map(f => { const fl = found.find(x => x.facility === f.id); return `<div class="fac ${fl ? 'found' : ''}"><span class="fac-icon">${DE.Icons.img('facility', 'ico-inline')}</span><div><b>${fl ? esc(f.name) : '???'}</b> <small class="muted">${fl ? 'B' + fl.depth : 'from B' + f.minDepth}</small><div class="muted">${fl ? esc(f.lore) : 'Unique room: ' + esc(DE.Data.ROOMS[f.room].name)}</div></div></div>`; }).join('')}</div>`;
 html += `<div class="card"><h4>Floors</h4>${s.floors.map(f => `<div class="row"><span>B${f.depth} ${f.facility ? DE.Icons.img('facility', 'ico-inline') : ''} <small class="muted">${esc(DE.Data.stratumAt(f.depth).name)}</small></span><span>${DE.Bunker.roomsOnFloor(s, f.depth).length} rooms · ${f.slots.filter(x => !x).length}/${f.slots.length} cells free</span><button class="btn small ghost" data-action="scrollFloor" data-depth="${f.depth}">Show</button></div>`).join('')}</div>`;
 return html;
 },
 };

 /* ================= DEFENSE ================= */
 /* A battle forecast up top (who is coming, the battle math, what to do about it), then the four
  * levers — wall, guards, turrets, traps — as tiles with their main actions, then the roster,
  * perimeter, bestiary and log. The countdown ticks in place, so the screen only rebuilds when
  * something actually changes. */
 const defense = {
 title: (s) => `Defense <small>Wave ${s.defense.wave} · ${DE.Defense.isBossWave(s.defense.wave) ? 'boss wave' : 'next attack'} in <span data-wave-clock>${U().fmtTime(Math.max(0, (s.defense.nextWaveAt - Date.now()) / 1000))}</span></small>`,
 tick(s) {
   const t = U().fmtTime(Math.max(0, (s.defense.nextWaveAt - Date.now()) / 1000));
   document.querySelectorAll('[data-wave-clock]').forEach(el => { if (el.textContent !== t) el.textContent = t; });
 },
 render(s) {
 const d = s.defense, fx = s._fx, ui = DE.UI.ui; ui.defOpen = ui.defOpen || {};
 const I = (k, c) => DE.Icons.img(k, c || 'dk-ico'), W = DE.CONFIG.WAVE_DURATION;
 const hp = DE.Defense.waveHp(s), pw = DE.Defense.defensePower(s), maxHp = DE.Defense.wallMaxHp(s);
 const boss = DE.Defense.isBossWave(d.wave);
 const comp = DE.Defense.compositionSummary(DE.Defense.waveComposition(hp, d.wave));
 // battle math: what the firepower shoots down, what the wall soaks up, what breaks through
 const killed = Math.min(hp, pw.total), toWall = Math.min(d.wall.hp, hp - killed), through = Math.max(0, hp - killed - toWall);
 const tone = through > 0 ? 'neg' : toWall > 0 ? 'warn' : 'pos';
 const ratio = pw.total / Math.max(1, hp);
 const threat = tone === 'neg' ? ['Deadly', 5] : tone === 'warn' ? ['High', 4] : ratio < 1.4 ? ['Moderate', 3] : ratio < 2.2 ? ['Low', 2] : ['Minimal', 1];
 const pct = (v) => (100 * v / Math.max(1, hp)).toFixed(1) + '%';
 const verdict = tone === 'pos' ? ['Wiped out before the wall', 'Your firepower outmatches this wave — the wall stays untouched.']
   : tone === 'warn' ? [`The wall takes about ${U().fmt(Math.ceil(toWall * 1.2))} damage`, 'Post more guards, add turrets or stock traps to stop them sooner.']
   : ['Breach likely', 'They will get inside: supplies are lost and survivors get hurt. Reinforce now.'];
 const reward = DE.Defense.waveReward(d.wave, 'victory');
 const m = DE.Events.mutation(s), lvl = DE.Events.noiseLevel(DE.Events.noise(s));
 const chip = (icon, text, cls) => `<span class="d3-chip ${cls || ''}">${I(icon, 'ico-inline')}${text}</span>`;
 const regroup = d.breachStreak ? Math.round((1 - Math.max(0.6, Math.pow(0.85, d.breachStreak))) * 100) : 0;
 const chips = [
   chip('trophy', 'Win: ' + (U().costText(reward) || '—'), 'gold'),
   d.winStreak ? chip('star', `${d.winStreak} wins in a row · +${Math.min(50, 10 * d.winStreak)}% loot`, 'pos') : '',
   regroup ? chip('wave', `Horde regrouping · −${regroup}%`, 'pos') : '',
   comp.dmgMult > 1.05 ? chip('alert', `Wall damage ×${comp.dmgMult.toFixed(2)}`, 'warn') : '',
   comp.toxic ? chip('biohazard', `${comp.toxic} toxic`, 'warn') : '',
   m ? chip('biohazard', 'Mutation: ' + esc(m.name), 'neg') : '',
   chip('noise', 'Noise: ' + lvl, 'noise ' + lvl),
 ].join('');
 const kinds = DE.Data.ZOMBIES.filter(z => comp.counts[z.id]).sort((a, b) => (b.boss ? 1e9 : 0) + b.hp * comp.counts[b.id] - ((a.boss ? 1e9 : 0) + a.hp * comp.counts[a.id]));
 const horde = kinds.slice(0, 6).map((z, i) => `<figure class="d3-z${z.boss ? ' boss' : ''}${z.hp >= 60 ? ' big' : ''}" style="--i:${i}" title="${esc(z.name)} ×${comp.counts[z.id]} · ${z.hp} HP each">${DE.Chars.portrait(z.id, { cls: 'flip' })}<b>×${comp.counts[z.id]}</b><figcaption>${esc(z.name)}</figcaption></figure>`).join('')
   + (kinds.length > 6 ? `<span class="d3-more">+${kinds.length - 6} more</span>` : '');
 let html = `<div class="d3-hero ${tone}${boss ? ' boss' : ''}">
 <div class="d3-top"><div class="d3-title">${I('zombies', 'd3-zico')}<div><small>${boss ? 'Boss wave' : 'Incoming'}</small><b>Wave ${d.wave}</b></div></div>
   <div class="d3-clock"><small>arrives in</small><b data-wave-clock>${U().fmtTime(Math.max(0, (d.nextWaveAt - Date.now()) / 1000))}</b></div>
   <div class="d3-threat t${threat[1]}"><small>Threat</small><b>${threat[0]}</b><span>${Array.from({ length: 5 }, (_, i) => `<i class="${i < threat[1] ? 'on' : ''}"></i>`).join('')}</span></div></div>
 <div class="d3-field"><div class="d3-gate">${DE.Icons.structure('wall', 'd3-gateico')}<span class="d3-gatehp"><i style="width:${(100 * d.wall.hp / maxHp).toFixed(1)}%"></i></span></div><div class="d3-horde">${horde}</div>${boss ? `<div class="d3-bossflag">${I('skull2', '')} BOSS</div>` : ''}</div>
 <div class="d3-math"><div class="d3-vs"><span>${I('shield', 'ico-inline')} Your firepower <b>${U().fmt(pw.total)}</b></span><span>Horde strength <b>${U().fmt(hp)}</b> ${I('zombies', 'ico-inline')}</span></div>
   <div class="d3-bar" title="Of the horde's ${U().fmt(hp)} strength: ${U().fmt(killed)} shot down, ${U().fmt(toWall)} against the wall, ${U().fmt(through)} breaking in"><i class="k" style="width:${pct(killed)}"></i><i class="w" style="width:${pct(toWall)}"></i><i class="b" style="width:${pct(through)}"></i></div>
   <div class="d3-legend"><span class="k"><i></i>Shot down <b>${U().fmt(killed)}</b></span>${toWall > 0 ? `<span class="w"><i></i>Hits the wall <b>${U().fmt(toWall)}</b></span>` : ''}${through > 0 ? `<span class="b"><i></i>Breaks in <b>${U().fmt(through)}</b></span>` : ''}<span class="t">${W}s of combat</span></div></div>
 <div class="d3-verdict">${I(tone === 'pos' ? 'check' : 'warning', 'd3-vico')}<div><b>${verdict[0]}</b><small>${verdict[1]}</small></div></div>
 <div class="d3-chips">${chips}</div></div>`;
 // ---- the four levers ----
 const wc = DE.Defense.wallUpgradeCost(s), rc = DE.Defense.repairCost(s), wpct = 100 * d.wall.hp / maxHp, canW = U().canAfford(s.resources, wc);
 const gs = DE.Survivors.guards(s), free = Math.max(0, fx.guardCap - gs.length);
 const idleOk = DE.Survivors.idle(s).filter(sv => sv.hp >= 50).length;
 const tc = DE.Defense.turretCost(s), maxT = DE.Defense.maxTurrets(s), canT = fx.turretsUnlocked && U().canAfford(s.resources, tc) && d.turrets < maxT;
 const cc = DE.Defense.calibreCost(s), canC = fx.turretsUnlocked && d.turrets > 0 && U().canAfford(s.resources, cc), tdmg = DE.Defense.turretDmg(s);
 const trc = DE.Defense.trapCost(s), stock = Math.max(1, DE.CONFIG.TRAPS_PER_WAVE - d.traps), stockCost = U().scaleCost(trc, stock);
 const btn = (cls, ok, attrs, body, tip) => `<button class="btn small ${cls} ${ok ? '' : 'cant'}" ${attrs} ${ok ? '' : 'disabled'}${tip ? ` title="${tip}"` : ''}>${body}</button>`;
 const tile = (cls, icon, title, big, sub, meter, actions, locked) => `<div class="d3-tile ${cls}${locked ? ' locked' : ''}"><div class="d3-th">${icon}<div class="d3-tt"><b>${title}</b><small>${sub}</small></div><em>${big}</em></div>${meter}<div class="d3-act">${actions}</div></div>`;
 const toResearch = `<button class="btn small" data-action="openDrawer" data-drawer="research">${I('flask', 'ico-btn')} Research</button>`;
 html += '<div class="d3-tiles">';
 html += tile('d3-t-wall', DE.Icons.structure('wall', 'd3-tico'), `Wall · Lv ${d.wall.level}`, `${U().fmt(d.wall.hp)}<small>/${U().fmt(maxHp)}</small>`, d.wall.level < 3 ? 'cracked & patched' : d.wall.level < 6 ? 'steel-plated' : 'armoured',
   `<div class="d3-meter ${wpct < 30 ? 'neg' : wpct < 70 ? 'warn' : 'pos'}"><i style="width:${wpct.toFixed(1)}%"></i></div>`,
   btn('primary', canW, 'data-action="wallUpgrade"', `${I('up', 'ico-btn')} Reinforce <span class="cost">${U().costText(wc)}</span>`, `More wall HP (max ${U().fmt(maxHp)} now)`)
   + btn('', rc.scrap > 0, 'data-action="wallRepair"', `${I('repair2', 'ico-btn')} ${rc.scrap > 0 ? 'Repair <span class="cost">' + U().costText(rc) + '</span>' : 'Intact'}`));
 html += tile('d3-t-guards', I('guards', 'd3-tico'), 'Guards', `${gs.length}<small>/${fx.guardCap}</small>`, gs.length ? `${U().fmt(pw.guardDps, 1)} dmg/s on duty` : 'nobody on duty',
   `<div class="d3-faces">${gs.map(g => DE.Icons.prof(g.profession, 'ava', esc(g.name))).join('')}${'<i class="d3-post"></i>'.repeat(free)}</div>`,
   btn('primary', free > 0 && idleOk > 0, 'data-action="fillGuards"', `${I('plus', 'ico-btn')} Fill posts`, free <= 0 ? 'Every guard post is taken' : idleOk ? 'Posts idle, healthy survivors — strongest first' : 'Nobody idle and healthy to post')
   + `<button class="btn small" data-action="defToggle" data-key="guards">${ui.defOpen.guards ? 'Hide roster' : 'Roster'}</button>`);
 html += tile('d3-t-turrets', DE.Icons.structure('turret', 'd3-tico'), 'Auto-turrets', fx.turretsUnlocked ? `${d.turrets}<small>/${maxT}</small>` : I('lock', 'd3-lock'), fx.turretsUnlocked ? `${U().fmt(tdmg, 1)} dmg/s each · calibre ${d.turretLevel || 0}` : 'needs Heavy Machinery',
   fx.turretsUnlocked ? `<div class="d3-pips">${Array.from({ length: Math.max(maxT, 1) }, (_, i) => `<i class="${i < d.turrets ? 'on' : ''}"></i>`).join('')}</div>` : '<div class="d3-pips"></div>',
   fx.turretsUnlocked ? btn('primary', canT, 'data-action="buyTurret"', `${I('plus', 'ico-btn')} Install <span class="cost">${U().costText(tc)}</span>`, d.turrets >= maxT ? 'All mounts used — Armory levels and floodlight masts add more' : '')
     + btn('', canC, 'data-action="upgradeCalibre"', `${I('up', 'ico-btn')} Calibre ${(d.turretLevel || 0) + 1} <span class="cost">${U().costText(cc)}</span>`, '+25% damage for every turret') : toResearch, !fx.turretsUnlocked);
 html += tile('d3-t-traps', DE.Icons.structure('trap', 'd3-tico'), 'Traps', fx.trapsUnlocked ? `${d.traps}` : I('lock', 'd3-lock'), fx.trapsUnlocked ? `${DE.CONFIG.TRAP_DMG} dmg each · ${DE.CONFIG.TRAPS_PER_WAVE} per wave` : 'needs Fortification',
   fx.trapsUnlocked ? `<div class="d3-pips">${Array.from({ length: DE.CONFIG.TRAPS_PER_WAVE }, (_, i) => `<i class="${i < d.traps ? 'on' : ''}"></i>`).join('')}</div>` : '<div class="d3-pips"></div>',
   fx.trapsUnlocked ? btn('', U().canAfford(s.resources, trc), 'data-action="buyTraps" data-n="1"', `+1 <span class="cost">${U().costText(trc)}</span>`)
     + btn('primary', d.traps < DE.CONFIG.TRAPS_PER_WAVE && U().canAfford(s.resources, stockCost), `data-action="buyTraps" data-n="${stock}"`, `Stock up <span class="cost">${U().costText(stockCost)}</span>`, d.traps >= DE.CONFIG.TRAPS_PER_WAVE ? 'Fully stocked for the next wave' : 'Enough traps for a whole wave') : toResearch, !fx.trapsUnlocked);
 html += '</div>';
 // ---- where the firepower comes from ----
 const src = [['s-guards', 'Guards', pw.guardDps * W], ['s-turrets', 'Turrets', pw.turretDps * W], ['s-missiles', 'Missiles', pw.missileDps * W], ['s-traps', 'Traps', pw.trapDmg], ['s-flat', 'Fortifications', pw.flat || 0]].filter(x => x[2] > 0);
 const tot = src.reduce((a, x) => a + x[2], 0);
 if (tot > 0) html += `<div class="d3-src"><small>Firepower per wave</small><div class="d3-srcbar">${src.map(x => `<i class="${x[0]}" style="width:${(100 * x[2] / tot).toFixed(1)}%"></i>`).join('')}</div><div class="d3-srclg">${src.map(x => `<span class="${x[0]}"><i></i>${x[1]} <b>${U().fmt(x[2])}</b></span>`).join('')}</div></div>`;
 // ---- expandable sections ----
 const section = (key, icon, title, desc, status, statusCls, body) => { const open = !!ui.defOpen[key];
   return `<div class="dk-sec ${open ? 'open' : ''}"><div class="dk-sec-head" data-action="defToggle" data-key="${key}">${icon}<div class="dk-sec-text"><b>${title}</b><small>${desc}</small>${status ? `<small class="dk-status ${statusCls || ''}">${status}</small>` : ''}</div><img class="dk-chev" src="assets/ui/chevron.png" alt=""></div>${open ? `<div class="dk-sec-body">${body}</div>` : ''}</div>`; };
 const pool = DE.Survivors.available(s).sort((a, b) => DE.Survivors.guardPower(b, fx) - DE.Survivors.guardPower(a, fx));
 html += section('guards', I('guards', 'dk-big'), `Guard roster · ${gs.length}/${fx.guardCap}`, 'Soldiers +50%, guards +35%, hunters +25%. Strongest first.',
   gs.length ? `${U().fmt(pw.guardDps, 1)} dmg/s on duty` : 'Nobody on guard duty', gs.length ? 'pos' : 'warn',
   pool.map(sv => { const g = sv.assignment && sv.assignment.kind === 'guard'; return `<div class="dk-line${g ? ' on' : ''}">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b><small>${esc(P()[sv.profession].name)} · Lv${sv.level} · ${U().fmt(DE.Survivors.guardPower(sv, fx), 1)} dmg/s${sv.hp < 50 ? ' · <i class="neg">hurt</i>' : ''}${!g && sv.assignment ? ' · leaves ' + esc(assignmentText(s, sv)) : ''}</small></span><button class="btn small ${g ? 'active' : ''}" data-action="toggleGuard" data-sid="${sv.id}">${g ? I('check', 'ico-btn') + ' On duty' : 'Post'}</button></div>`; }).join('') || '<p>No survivors available.</p>');
 const owDone = DE.Data.OVERWORLD_ORDER.filter(k => !DE.Defense.structureNext(s, k)).length;
 html += section('perimeter', I('perimeter', 'dk-big'), 'Perimeter', 'Fence, barricades, towers, lights, road and the missile battery.', `${owDone}/${DE.Data.OVERWORLD_ORDER.length} fully upgraded`, '',
   DE.Data.OVERWORLD_ORDER.map(k => { const def = DE.Data.OVERWORLD[k]; const lv = (s.overworld && s.overworld[k]) || 0; const cur = def.levels[lv]; const next = DE.Defense.structureNext(s, k); const blocked = next && DE.Defense.structureBlocked(s, k); const ok = next && !blocked && U().canAfford(s.resources, next.cost);
   return `<div class="dk-line">${DE.Icons.structure(k, 'dk-mid')}<span><b>${esc(def.name)} <em class="tag">${esc(cur.name)}</em></b><small>${next ? esc(next.name) + ' — ' + esc(next.desc) : esc(cur.desc) + ' · fully upgraded'}</small>${blocked ? `<small class="neg">${esc(blocked)}</small>` : ''}</span>${next ? `<button class="btn primary small ${ok ? '' : 'cant'}" data-action="owUpgrade" data-key="${k}" ${ok ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(next.cost)}</span></button>` : '<b class="gold">MAX</b>'}</div>`; }).join(''));
 const seen = DE.Data.ZOMBIES.filter(z => z.minWave <= d.wave || (z.boss && d.wave >= DE.Data.BOSS_EVERY));
 html += section('bestiary', I('zombies', 'dk-big'), 'Bestiary', 'Know what is coming.', `${seen.length}/${DE.Data.ZOMBIES.length} sighted`, '',
   `<div class="d3-best">${DE.Data.ZOMBIES.map(z => { const known = seen.includes(z); return `<div class="d3-bz${known ? '' : ' unknown'}">${DE.Icons.zombie(z.id, 'ava')}<span><b>${known ? esc(z.name) : '???'}</b><small>${known ? `${z.hp} HP · wall dmg ×${z.dmg}${z.toxic ? ' · toxic' : ''}` : z.boss ? 'every ' + DE.Data.BOSS_EVERY + 'th wave' : 'appears from wave ' + z.minWave}</small>${known ? `<small class="d3-bzd">${esc(z.desc)}</small>` : ''}</span></div>`; }).join('')}</div>`);
 if (d.log.length) { const last = d.log[d.log.length - 1];
   html += section('log', I('battle', 'dk-big'), 'Battle log', 'The last waves at the gate.', 'Last: wave ' + last.wave + ' · ' + (last.outcome === 'victory' ? 'repelled' : last.outcome === 'held' ? 'wall held' : 'BREACH'), last.outcome === 'breach' ? 'neg' : 'pos',
   d.log.slice().reverse().slice(0, 8).map(r => `<div class="dk-line log ${r.outcome}">${I(r.outcome === 'breach' ? 'warning' : 'check', 'dk-ico')}<span><b>Wave ${r.wave} · ${r.outcome === 'victory' ? 'Repelled' : r.outcome === 'held' ? 'Wall held (−' + r.wallDamage + ' HP)' : 'BREACH'}</b><small>${r.killed} killed${r.reward && Object.keys(r.reward).length ? ' · loot ' + U().costText(r.reward) : ''}${(r.injured || []).length ? ' · injured: ' + r.injured.map(esc).join(', ') : ''}</small></span></div>`).join('')); }
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
 const EM = { W: 1000, H: 440, HOME: [70, 362] };
 const emXY = (l) => [l.map[0], 36 + l.map[1]];
 function emRoute(loc) {
 const [x, y] = emXY(loc), [hx, hy] = EM.HOME;
 return { x0: hx, y0: hy, cx: (hx + x) / 2 + (y - hy) * 0.18, cy: (hy + y) / 2 - Math.abs(x - hx) * 0.1, x1: x, y1: y };
 }
 function emPoint(r, t) { const u = 1 - t; return [u * u * r.x0 + 2 * u * t * r.cx + t * t * r.x1, u * u * r.y0 + 2 * u * t * r.cy + t * t * r.y1]; }
 const emLeg = (f) => f < 0.5 ? f * 2 : 2 - f * 2;      // out until halfway, then home
 const PROF_TRIP = { scavenger: '+30% loot · −15% risk', hunter: '−20% risk', scout: '−20% trip time · maps twice as fast', medic: '−25% risk' };
 const skullsOf = (l) => l.danger < 0.2 ? 1 : l.danger < 0.4 ? 2 : 3;
 const DANGER = ['', 'Low danger', 'Dangerous', 'Deadly'];
 /** The wasteland: mountains in the north-west, forests, a river, the ruins of the old city, a highway. */
 function emTerrain() {
 const INK = '#1c1020'; let t = '';
 [[0, 110, 50, 34, 100], [60, 110, 118, 22, 176], [150, 110, 196, 52, 246], [232, 110, 282, 30, 336], [-20, 140, 24, 70, 70]].forEach(([x0, y0, px, py, x1]) => {
   t += `<path d="M${x0} ${y0} L${px} ${py} L${x1} ${y0} Z" fill="#5c5446" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M${px} ${py} L${(px + x1) / 2 + 6} ${y0} L${x1} ${y0} Z" fill="#000" opacity=".18"/><path d="M${px} ${py} l-9 16 l6 -2 l5 6 l4 -8 l5 2 z" fill="#cfc8b4" opacity=".75"/>`; });
 const forest = (cx, cy, n, seed) => { let f = ''; for (let i = 0; i < n; i++) { const a = (i * 2.4 + seed), r = 6 + (i % 3) * 7, x = cx + Math.cos(a) * r * 1.6, y = cy + Math.sin(a) * r * .7, R = 9 + ((i * 7 + seed) % 5); f += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${R}" fill="#3e5a2e" stroke="${INK}" stroke-width="2.5"/><circle cx="${(x - R * .35).toFixed(0)}" cy="${(y - R * .35).toFixed(0)}" r="${(R * .3).toFixed(1)}" fill="#fff" opacity=".12"/>`; } return f; };
 t += forest(140, 236, 7, 1) + forest(310, 400, 6, 3) + forest(468, 120, 5, 5) + forest(732, 420, 6, 2) + forest(860, 160, 4, 4) + forest(30, 280, 5, 6);
 t += `<path class="em-river" d="M520 -10 C 470 90, 560 160, 500 230 S 400 350, 455 450"/>`;
 [[560, 150], [585, 205], [615, 140], [690, 215], [470, 235], [500, 330], [870, 280], [640, 230], [720, 170]].forEach(([x, y], i) => { const w = 18 + (i % 3) * 7, h = 14 + (i % 2) * 9; t += `<path d="M${x} ${y + h} V${y + 3} l${w * .3} -3 l${w * .25} 4 l${w * .45} -4 V${y + h} Z" class="em-block"/>`; });
 t += `<path d="M${EM.HOME[0]} ${EM.HOME[1] + 6} C 300 430, 640 432, 1010 410" fill="none" stroke="#3a3632" stroke-width="16" stroke-linecap="round"/><path d="M${EM.HOME[0]} ${EM.HOME[1] + 6} C 300 430, 640 432, 1010 410" fill="none" stroke="#e8c84a" stroke-width="2" stroke-dasharray="10 12" opacity=".7"/>`;
 return t;
 }
 function emMap(s, sel) {
 const locs = DE.Data.LOCATIONS, active = s.expeditions.active, X = DE.Expeditions, coll = s.collection || {}, bps = s.blueprints || {};
 const roads = locs.map(l => { const r = emRoute(l), open = X.isOpen(s, l), on = active.some(e => e.location === l.id);
   return `<path class="em-road ${open ? '' : 'locked'} ${l.id === sel.id ? 'sel' : ''} ${on ? 'active' : ''}" d="M${r.x0} ${r.y0} Q${r.cx.toFixed(0)} ${r.cy.toFixed(0)} ${r.x1} ${r.y1}"/>`; }).join('');
 const pins = locs.map(l => {
   const open = X.isOpen(s, l), [x, y] = emXY(l), on = active.some(e => e.location === l.id), lvl = X.explore(s, l.id), sk = skullsOf(l);
   const items = X.collectiblesAt(l.id), got = items.filter(c => coll[c.id]).length, bp = X.blueprintsAt(l.id).filter(d => !bps[d.id]).length;
   const badges = !open ? '' : (bp ? `<g class="em-bp" transform="translate(40 -44)"><title>A blueprint is waiting here</title><circle r="12"/><image href="${DE.Icons.src('scroll')}" x="-9" y="-9" width="18" height="18"/></g>` : '')
     + (items.length ? `<g class="em-cl ${got === items.length ? 'full' : ''}" transform="translate(-40 -44)"><title>Collectibles found here</title><circle r="12"/><text y="4">${got}/${items.length}</text></g>` : '');
   return `<g class="em-pin ${open ? '' : 'locked'} ${l.id === sel.id ? 'sel' : ''} ${on ? 'busy' : ''}" transform="translate(${x} ${y})" data-action="expLocation" data-id="${l.id}"><title>${esc(l.name)}${open ? ' · ' + DANGER[sk] + ' · explored ' + lvl + '/' + X.MAX_EXPLORE : ' · reach B' + l.minDepth}</title>
   <rect class="em-hit" x="-52" y="-62" width="104" height="128"/><ellipse class="em-halo" cx="0" cy="11" rx="52" ry="14"/><g class="lm">${DE.UI.Landmarks.draw(l.id, !open)}</g>
   <text class="em-name" y="31">${esc(l.name)}</text>
   ${open ? `<g transform="translate(${-sk * 8 + 1} 37)">${Array.from({ length: sk }, (_, i) => `<image href="${DE.Icons.src('skull')}" x="${i * 16}" y="0" width="14" height="14"/>`).join('')}</g><g class="em-pips">${Array.from({ length: X.MAX_EXPLORE }, (_, i) => `<circle cx="${-16 + i * 8}" cy="60" r="3.2" class="${i < lvl ? 'on' : ''}"/>`).join('')}</g>` : `<text class="em-risk" y="48">reach B${l.minDepth}</text>`}${badges}</g>`; }).join('');
 const stops = active.map(e => { const r = emRoute(X.location(e.location)); return (e.stops || []).map((f, i) => { const [x, y] = emPoint(r, emLeg(f)); return `<circle class="em-stop ${i < (e.stop || 0) ? 'past' : ''}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6"/>`; }).join(''); }).join('');
 const trucks = active.map(e => `<g class="em-truck" data-trip="${e.id}" style="opacity:0"><g class="em-flip"><image href="${DE.Icons.src('vehicle')}" x="-22" y="-34" width="44" height="44"/></g><text class="em-eta" y="22" data-eta="${e.id}"></text></g>`).join('');
 return `<div class="exp-map"><svg viewBox="0 0 ${EM.W} ${EM.H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Expedition map">
 <defs><radialGradient id="em-bg" cx=".3" cy=".75" r="1"><stop offset="0" stop-color="#6a6448"/><stop offset=".6" stop-color="#4a4a38"/><stop offset="1" stop-color="#2f3024"/></radialGradient>
 <pattern id="em-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0 H0 V50" fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="1"/></pattern>
 <radialGradient id="em-vig" cx=".5" cy=".5" r=".75"><stop offset=".65" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></radialGradient></defs>
 <rect width="${EM.W}" height="${EM.H}" fill="url(#em-bg)"/>${emTerrain()}<rect width="${EM.W}" height="${EM.H}" fill="url(#em-grid)"/>
 <g>${roads}</g><g>${stops}</g>
 <g class="em-home" transform="translate(${EM.HOME[0]} ${EM.HOME[1]})"><circle r="30" class="em-disc home"/><image href="${DE.Icons.src('home')}" x="-20" y="-21" width="40" height="40"/><text class="em-name" y="48">Bunker</text></g>
 <g>${pins}</g><g>${trucks}</g><rect width="${EM.W}" height="${EM.H}" fill="url(#em-vig)" pointer-events="none"/>
 <text class="em-title" x="${EM.W - 16}" y="${EM.H - 14}">THE WASTELAND</text></svg></div>`;
 }
 /** What a place still holds: its exploration track, collectibles, blueprint and rare materials. */
 function exThumb(s, c, lvl) {
   const got = s.collection && s.collection[c.id], can = !got && c.explore <= Math.max(1, lvl + 1);
   return `<span class="cl-thumb ${got ? 'got' : can ? 'can' : 'unk'}" title="${esc(got ? c.name + ' — ' + c.desc : can ? c.name + ' — can turn up on the next trip' : 'Undiscovered — explore to level ' + Math.max(1, c.explore))}"><img src="assets/sprites/${c.sprite}.png" alt="" draggable="false">${got ? DE.Icons.img('check', 'cl-ok') : can ? '<i>?</i>' : ''}</span>`;
 }
 function exTrack(s, l) {
   const X = DE.Expeditions, lvl = X.explore(s, l.id), items = X.collectiblesAt(l.id), bps = X.blueprintsAt(l.id);
   return `<div class="xp-track">${Array.from({ length: X.MAX_EXPLORE }, (_, i) => { const k = i + 1;
     const here = items.filter(c => Math.max(1, c.explore) === k).map(c => `<img src="assets/sprites/${c.sprite}.png" class="${s.collection[c.id] ? 'got' : ''}" title="${esc(c.name)}" alt="">`).join('') + bps.filter(d => (d.explore || 1) === k).map(d => `<span class="xp-bp${s.blueprints[d.id] ? ' got' : ''}" title="Blueprint: ${esc(d.name)}">${DE.Icons.room(d.id, 'ico-inline')}</span>`).join('') + (k === X.MAX_EXPLORE ? `<span class="xp-max" title="Fully explored: +25% haul">+25%</span>` : '');
     return `<span class="xp-step ${k <= lvl ? 'done' : k === lvl + 1 ? 'next' : ''}"><b>${k}</b><span>${here}</span></span>`; }).join('')}</div>`;
 }
 function exCollections(s) {
   const X = DE.Expeditions, coll = s.collection || {}, all = Object.values(DE.Data.COLLECTIBLES), sets = DE.Data.COLLECTION_ORDER.map(k => DE.Data.COLLECTIONS[k]);
   const doneSets = sets.filter(st => X.setDone(s, st.id)).length, bpRooms = Object.values(DE.Data.ROOMS).filter(d => d.blueprint), bpGot = bpRooms.filter(d => s.blueprints[d.id]).length;
   const mats = DE.Data.MATERIAL_ORDER.map(m => `<span class="cl-mat" title="${esc(DE.Data.MATERIALS[m].desc)}">${DE.Icons.mat(m, 'cl-mico')}<b>${(s.materials && s.materials[m]) || 0}</b><small>${esc(DE.Data.MATERIALS[m].name)}</small></span>`).join('');
   return `<div class="card ex-coll"><h4>${DE.Icons.img('artifacts', 'ico-h4')} Finds & collections <small class="muted">${X.owned(s)}/${all.length} collectibles · ${doneSets}/${sets.length} sets · ${bpGot}/${bpRooms.length} blueprints</small></h4>
   <div class="cl-mats">${mats}</div>
   <div class="cl-grid">${sets.map(st => { const items = all.filter(c => c.set === st.id), n = items.filter(c => coll[c.id]).length, done = n === items.length;
     return `<div class="cl-set ${done ? 'done' : ''}"><div class="cl-sh"><b>${esc(st.name)}</b><small>${n}/${items.length}</small></div><div class="cl-items">${items.map(c => `<span class="cl-thumb ${coll[c.id] ? 'got' : 'unk'}" title="${esc(coll[c.id] ? c.name + ' — ' + c.desc : 'Undiscovered · ' + ((X.location(c.where) || {}).name || c.where) + ', explore ' + Math.max(1, c.explore))}"><img src="assets/sprites/${c.sprite}.png" alt="" draggable="false"></span>`).join('')}</div><div class="cl-bonus">${done ? DE.Icons.img('check', 'ico-inline') : DE.Icons.img('lock', 'ico-inline')}${esc(st.bonusText)}</div></div>`; }).join('')}</div>
   <h5 class="cl-h5">Blueprints for exclusive rooms</h5><div class="cl-bps">${bpRooms.map(d => { const got = s.blueprints[d.id], loc = X.location(d.blueprint);
     return `<div class="cl-bpr ${got ? 'got' : ''}">${DE.Icons.room(d.id, 'cl-ric')}<span><b>${esc(d.name)}</b><small>${got ? 'Recovered — build it from any free cell ' + DE.Icons.rare(d.rare) : esc(loc ? loc.name : d.blueprint) + ' · explore ' + (d.explore || 1) + ' (now ' + X.explore(s, d.blueprint) + ')'}</small></span></div>`; }).join('')}</div></div>`;
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
 const X = DE.Expeditions, lvl = X.explore(s, sel.id), sk = skullsOf(sel);
 const lootChips = Object.keys(sel.loot).map(r => `<i class="ex-chip">${DE.Icons.res(r, 'ico-inline')}${U().fmt(sel.loot[r][0] * plan.lootMult)}–${U().fmt(sel.loot[r][1] * plan.lootMult)}</i>`).join('');
 const matChips = Object.keys(sel.mats || {}).map(m => { const [a, b] = sel.mats[m]; const lo = Math.floor(a * plan.matMult), hi = Math.floor(b * plan.matMult); return hi > 0 ? `<i class="ex-chip rare" title="${esc(DE.Data.MATERIALS[m].desc)}">${DE.Icons.mat(m)}${lo === hi ? hi : lo + '–' + hi} ${esc(DE.Data.MATERIALS[m].short)}</i>` : ''; }).join('');
 const items = X.collectiblesAt(sel.id), bpHere = X.blueprintsAt(sel.id);
 const finds = (sel.finds || []).map(f => `<i class="ex-chip find">${DE.Icons.img('star', 'ico-inline')}${Math.round(f.chance * 100)}% ${esc(f.text)}</i>`).join('');
 const risk = plan.danger, riskSev = risk >= 0.4 ? 'crit' : risk >= 0.2 ? 'warn' : 'ok';
 const road = plan.stops.length > 1 ? '2 checkpoints · 60% chance of an event at each' : '1 checkpoint · 75% chance of an event';
 html += `<div class="ex-grid"><div class="card ex-dest ${open ? '' : 'locked'}"><div class="ex-dh"><span class="ex-lm"><svg viewBox="-56 -66 112 82" aria-hidden="true">${DE.UI.Landmarks.draw(sel.id, !open)}</svg></span><div><h4>${esc(sel.name)}</h4>
   ${open ? `<div class="ex-danger s${sk}">${Array.from({ length: sk }, () => DE.Icons.img('skull', 'ico-inline')).join('')}<b>${DANGER[sk]}</b><span>Explored ${lvl}/${X.MAX_EXPLORE}</span></div>` : ''}<p>${esc(sel.desc)}</p></div></div>
 ${open ? `${exTrack(s, sel)}<p class="xp-note">Every trip maps more of it${plan.mapGain > 1 ? ' — <b>this team maps twice as fast</b> (scout)' : ' (scouts map twice as fast)'}: +5% haul per level, more collectibles turn up${bpHere.length ? ', and the blueprint is recovered at level ' + bpHere.map(d => d.explore || 1).join('/') : ''}.</p>
 <div class="ex-kv"><span>${DE.Icons.img('timer', 'ico-inline')} Trip time</span><b>${U().fmtTime(plan.duration)}</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('medkit', 'ico-inline')} Injury risk</span><span class="pd-bar ${riskSev}"><i style="width:${Math.min(100, risk * 100 / 0.6).toFixed(0)}%"></i></span><b>${Math.round(risk * 100)}%</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('pop', 'ico-inline')} Rescue chance</span><b>${Math.round(plan.rescue * 100)}%</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('artifacts', 'ico-inline')} Find chance</span><b>${Math.round(plan.findChance * 100)}%</b></div>
 <div class="ex-kv"><span>${DE.Icons.img('scroll', 'ico-inline')} On the road</span><b>${road}</b></div>
 <div class="ex-sub">Expected haul <small>×${plan.lootMult.toFixed(2)} with this team, depth, vehicle and map</small></div><div class="ex-chips">${lootChips}${matChips}</div>
 ${items.length ? `<div class="ex-sub">Collectibles here <small>${items.filter(c => s.collection[c.id]).length}/${items.length} found · at most one per trip</small></div><div class="cl-row">${items.map(c => exThumb(s, c, lvl)).join('')}</div>` : ''}
 ${bpHere.length ? `<div class="ex-sub">Blueprint</div>${bpHere.map(d => `<div class="ex-bp ${s.blueprints[d.id] ? 'got' : ''}">${DE.Icons.room(d.id, 'cl-ric')}<span><b>${esc(d.name)}</b><small>${s.blueprints[d.id] ? 'Recovered — build it from any free cell' : 'Recovered when this place is explored to level ' + (d.explore || 1)} · needs ${DE.Icons.rare(d.rare)}</small></span></div>`).join('')}` : ''}
 ${finds ? `<div class="ex-sub">Possible discoveries</div><div class="ex-chips">${finds}</div>` : ''}` : `<p class="ex-lock">${DE.Icons.img('lock', 'ico-inline')} Dig down to <b>B${sel.minDepth}</b> to learn the way there.</p>`}</div>`;
 // ---- team ----
 const pool = DE.Survivors.available(s);
 const seats = Array.from({ length: bus.capacity }, (_, i) => { const sv = s.survivors[ex.members[i]]; return sv ? `<button class="ex-seat on" data-action="expToggle" data-sid="${sv.id}" title="Remove ${esc(sv.name)}">${DE.Chars.portrait(sv.profession)}<small>${esc(sv.name.split(' ')[0])}</small></button>` : `<span class="ex-seat"><small>empty seat</small></span>`; }).join('');
 const cands = pool.filter(sv => !ex.members.includes(sv.id)).map(sv => { const hurt = sv.hp < 50; const prof = DE.Data.PROFESSIONS[sv.profession];
   return `<button class="ex-cand ${hurt ? 'hurt' : ''}" data-action="expToggle" data-sid="${sv.id}" ${hurt ? 'disabled' : ''} title="${esc(sv.name)}${sv.assignment ? ' — leaves ' + esc(assignmentText(s, sv)) : ''}">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b><small>${esc(prof ? prof.name : sv.profession)} · Lv ${sv.level}${PROF_TRIP[sv.profession] ? ' · <em>' + PROF_TRIP[sv.profession] + '</em>' : ''}</small><span class="ex-hp"><i style="width:${Math.max(0, Math.min(100, sv.hp))}%" class="${hurt ? 'low' : ''}"></i></span></span></button>`; }).join('');
 const c = DE.Expeditions.canSend(s, sel.id, ex.members);
 html += `<div class="card ex-team"><h4>Team <small class="muted">${ex.members.length}/${bus.capacity} seats · ${esc(bus.name)}</small>${ex.members.length < bus.capacity && pool.some(sv => sv.hp >= 50 && !ex.members.includes(sv.id)) ? `<button class="btn small ex-auto" data-action="expAuto" title="Fill the free seats: idle survivors first, trip specialists first">${DE.Icons.img('pop', 'ico-btn')} Pick a team</button>` : ''}</h4><div class="ex-seats">${seats}</div>
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
 html += exCollections(s);
 if (s.expeditions.log.length) html += `<div class="card"><h4>Reports</h4>${s.expeditions.log.slice().reverse().slice(0, 8).map(r => { const l = DE.Expeditions.location(r.location) || { name: r.location, icon: 'location' };
   return `<div class="ex-rep">${DE.Icons.img(l.icon, 'ex-fico')}<div><b>${esc(l.name)}</b> <small class="muted">${esc((r.members || []).join(', '))}${r.explored ? ' · map ' + r.explored[0] + ' → ' + r.explored[1] : ''}</small><div class="ex-chips">${Object.keys(r.loot || {}).filter(k => r.loot[k] > 0).map(k => `<i class="ex-chip good">${DE.Icons.res(k, 'ico-inline')}+${U().fmt(r.loot[k])}</i>`).join('')}${Object.keys(r.mats || {}).map(m => `<i class="ex-chip rare">${DE.Icons.mat(m)}+${r.mats[m]}</i>`).join('')}${(r.collected || []).map(id => DE.Data.COLLECTIBLES[id]).filter(Boolean).map(c => `<i class="ex-chip gold"><img src="assets/sprites/${c.sprite}.png" class="ico-inline" alt="">${esc(c.name)}</i>`).join('')}${(r.blueprints || []).map(id => DE.Data.ROOMS[id]).filter(Boolean).map(d => `<i class="ex-chip gold">${DE.Icons.room(d.id, 'ico-inline')}Blueprint: ${esc(d.name)}</i>`).join('')}${r.rescued ? `<i class="ex-chip good">${DE.Icons.img('pop', 'ico-inline')}${esc(r.rescued)} joined</i>` : ''}${(r.injured || []).length ? `<i class="ex-chip bad">${DE.Icons.img('medkit', 'ico-inline')}${r.injured.map(esc).join(', ')} hurt</i>` : ''}</div>
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
 <div class="row"><span>Offline cap</span><b>${s._fx.offlineCapHours}h</b></div>
 <div class="row"><span>Intro</span><button class="btn small" data-action="replayIntro">${DE.Icons.img('play', 'ico-btn')} Watch it again</button></div></div>
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
