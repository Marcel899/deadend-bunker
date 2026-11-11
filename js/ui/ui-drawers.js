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

 function survivorCard(s, sv, extra) {
 const need = DE.Survivors.xpNeeded(sv.level);
 const traits = (sv.traits || []).map(t => { const d = DE.Data.TRAITS[t]; return `<span class="trait" title="${esc(d.desc)}">${DE.Icons.img('trait', 'ico-inline')}${d.name}</span>`; }).join('');
 const away = sv.assignment && sv.assignment.kind === 'expedition';
 const rar = DE.Data.RARITIES[sv.rarity] || DE.Data.RARITIES.common; const mood = DE.Survivors.mood(s, sv);
 return `<div class="sv-card rar-${rar.id} ${sv.hp < 50 ? 'hurt' : ''}">
 <div class="sv-avatar" style="--rc:${rar.color}">${DE.Chars.crew(sv.profession, { anim: away ? 'walk' : sv.hp < 50 ? 'idle' : 'interact', h: 56, title: P()[sv.profession].name })}</div>
 <div class="sv-body"><b>${esc(sv.name)}</b> <span class="rarity" style="color:${rar.color}" title="${rar.name}: +${Math.round(rar.bonus * 100)}% efficiency">${rar.name}</span> <small class="muted">${P()[sv.profession].name} · Lv${sv.level}${sv.level >= DE.CONFIG.SURVIVOR_MAX_LEVEL ? ' ★' : ''} · ${moodIcon(mood)} ${mood}</small>
 ${bar(100 * sv.xp / need, 'xp')}
 <div class="needs-row"><span class="act-tag act-${sv.act ? sv.act.kind : 'idle'}">${DE.Needs.describe(sv)}</span><small title="Energy">${DE.Icons.img('power', 'ico-inline')}${bar(sv.energy == null ? 100 : sv.energy, 'energy')}</small><small title="Hunger">${DE.Icons.img('res.food', 'ico-inline')}${bar(100 - (sv.hunger == null ? 0 : sv.hunger), 'food')}</small></div>
 ${sv.hp < 100 ? `<div class="hp-row"><small>${sv.hp < 50 ? ' Injured' : ' Healing'}</small>${bar(sv.hp, 'hp')}</div>` : ''}
 <div class="sv-meta">${assignmentText(s, sv)} ${traits}${(() => { const f = Object.keys(sv.bonds || {}).filter(id => sv.bonds[id] >= 60 && s.survivors[id]).map(id => esc(s.survivors[id].name)); return f.length ? `<span class="trait friend" title="Friends work 4% better together">${DE.Icons.img('people', 'ico-inline')}${f.join(', ')}</span>` : ''; })()}</div></div>
 <div class="sv-actions">${extra != null ? extra : (away ? '' : `<button class="btn small" data-action="openAssignSurvivor" data-sid="${sv.id}">Assign…</button>${sv.assignment ? `<button class="btn small ghost" data-action="unassign" data-sid="${sv.id}">Unassign</button>` : ''}`)}</div>
 </div>`;
 }

 /* ================= SURVIVORS ================= */
 const survivors = {
 title: (s) => `Survivors <small>${DE.Bunker.population(s)} / ${DE.Bunker.housingCapacity(s)} housing</small>`,
 render(s) {
 const cost = DE.Survivors.recruitCost(s); const can = DE.Survivors.canRecruit(s);
 const prof = ui().recruitProfession || null;
 const filter = ui().survivorFilter;
 let list = Object.values(s.survivors);
 if (filter === 'idle') list = list.filter(v => !v.assignment);
 else if (filter === 'working') list = list.filter(v => v.assignment && v.assignment.kind === 'room');
 else if (filter === 'guards') list = list.filter(v => v.assignment && v.assignment.kind === 'guard');
 else if (filter === 'away') list = list.filter(v => v.assignment && v.assignment.kind === 'expedition');
 const filters = [['all', 'All'], ['idle', 'Idle'], ['working', 'Working'], ['guards', 'Guards'], ['away', 'Away']];
 return `<div class="card recruit-card"><h4>Recruit a survivor</h4>
 <p class="muted">Costs food and water; needs free housing. Pick a profession or leave it to chance.</p>
 <div class="prof-row">${DE.Data.PROFESSION_ORDER.map(p => `<button class="btn small ${prof === p ? 'active' : ''}" data-action="setRecruitProfession" data-prof="${p}" title="${esc(P()[p].desc)}">${DE.Icons.prof(p, 'ico-inline')} ${P()[p].name}</button>`).join('')}
 <button class="btn small ${!prof ? 'active' : ''}" data-action="setRecruitProfession" data-prof=""> Random</button></div>
 <button class="btn primary ${can.ok ? '' : 'cant'}" data-action="recruit" ${can.ok ? '' : 'disabled'}>Recruit <span class="cost">${U().costText(cost)}</span></button>
 ${can.ok ? '' : `<small class="neg">${can.reason}</small>`}
 <div class="muted small-note">Morale ${Math.round(s.morale)} → production ×${DE.Economy.moraleMult(s.morale).toFixed(2)}. Each survivor eats ${(DE.CONFIG.SURVIVOR_FOOD * 60).toFixed(1)} food & water per minute.</div></div>
 <div class="filters">${filters.map(([k, l]) => `<button class="btn small ${filter === k ? 'active' : ''}" data-action="setFilter" data-filter="${k}">${l}</button>`).join('')}</div>
 ${list.length ? list.map(v => survivorCard(s, v)).join('') : '<p class="muted">Nobody here.</p>'}`;
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
 const research = {
 title: (s) => `Research <small>${U().fmt(s.resources.research)}  available</small>`,
 render(s) {
 const cur = s.research.current; const now = Date.now(); const B = DE.Data.RESEARCH_BRANCHES;
 let html = '';
 if (cur) { const n = DE.Data.RESEARCH[cur.id]; html += `<div class="card current-research"><h4>${DE.Icons.branch(n.branch, 'ico-inline')} Researching: ${esc(n.name)}</h4>${bar(100 * (1 - (cur.endsAt - now) / (cur.duration * 1000)), 'purple')}<div class="row"><small class="muted">${U().fmtTime((cur.endsAt - now) / 1000)} left</small><button class="btn small ghost" data-action="cancelResearch">Cancel (50% refund)</button></div></div>`; }
 else if (!Object.values(s.rooms).some(r => r.type === 'lab' || r.type === 'server')) html += `<div class="card"><p> You have no Research Lab. Build one to generate  research points.</p></div>`;
 const br = ui().researchBranch;
 html += `<div class="tabs">${Object.keys(B).map(b => { const nodes = DE.Research.byBranch(b); const done = nodes.filter(n => s.research.done[n.id]).length; return `<button class="btn tab ${br === b ? 'active' : ''}" data-action="researchBranch" data-branch="${b}" style="--c:${B[b].color}">${DE.Icons.branch(b, 'ico-inline')} ${B[b].name} <small>${done}/${nodes.length}</small></button>`; }).join('')}</div>`;
 DE.Research.byBranch(br).forEach(n => {
 const done = s.research.done[n.id]; const avail = DE.Research.isAvailable(s, n.id); const c = DE.Research.canStart(s, n.id);
 const active = cur && cur.id === n.id;
 const cls = done ? 'done' : active ? 'active' : avail ? 'avail' : 'locked';
 html += `<div class="rs-node ${cls}"><div class="rs-icon">${DE.Icons.branch(n.branch, 'ico-inline')}</div><div class="rs-body"><b>${esc(n.name)}</b> <small class="muted"> ${U().fmt(n.cost)} · ${U().fmtTime(DE.Research.duration(s, n.id))}</small>
 <div class="rs-desc">${esc(n.desc)}</div>${n.requires.length && !done ? `<small class="muted">Requires: ${n.requires.map(r => (s.research.done[r] ? '✓ ' : '') + esc(DE.Data.RESEARCH[r].name)).join(', ')}</small>` : ''}</div>
 <div>${done ? '<span class="tag green">DONE</span>' : active ? '<span class="tag purple">IN PROGRESS</span>' : `<button class="btn primary small ${c.ok ? '' : 'cant'}" data-action="research" data-id="${n.id}" ${c.ok ? '' : 'disabled'} title="${esc(c.reason || '')}">Research</button>`}</div></div>`;
 });
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
 title: (s) => `Defense <small>wave ${s.defense.wave} in ${U().fmtTime((s.defense.nextWaveAt - Date.now()) / 1000)}</small>`,
 render(s) {
 const d = s.defense; const fx = s._fx; const now = Date.now();
 const hp = DE.Defense.waveHp(s); const pw = DE.Defense.defensePower(s); const maxHp = DE.Defense.wallMaxHp(s);
 const verdict = pw.total >= hp ? ['pos', ' The horde will be wiped out before reaching the wall.'] : pw.total + d.wall.hp >= hp * 1.0 ? ['warn', ` The wall will take about ${U().fmt(Math.ceil((hp - pw.total) * 1.2))} damage.`] : ['neg', ' BREACH LIKELY — you will lose resources and survivors get hurt.'];
 const compList = DE.Defense.waveComposition(hp, d.wave); const comp = DE.Defense.compositionSummary(compList);
 const boss = DE.Defense.isBossWave(d.wave);
 const nextReward = DE.Defense.waveReward(d.wave, 'victory');
 let html = `<div class="card wave-card ${boss ? 'boss' : ''}"><h4>${boss ? ' BOSS WAVE' : ' Wave'} ${d.wave} <small class="muted">in ${U().fmtTime((d.nextWaveAt - now) / 1000)} · every ${U().fmtTime(DE.Defense.waveInterval(s))}</small></h4>
 <div class="row"><span>Horde strength</span><b>${U().fmt(hp)}</b></div>
 ${(() => { const m = DE.Events.mutation(s); return m ? `<div class="row mut"><span>${DE.Icons.img('zombie', 'ico-inline')} Mutation: <b>${esc(m.name)}</b></span><small class="muted">${esc(m.desc)}</small></div>` : ''; })()}
 ${(() => { const n = DE.Events.noise(s); const lvl = DE.Events.noiseLevel(n); return `<div class="row"><span>Bunker noise <small class="muted">machines, turrets and trucks draw the horde</small></span><b class="noise ${lvl}">${n} · ${lvl}</b></div><div class="bar noise"><i style="width:${Math.min(100, n * 3)}%"></i></div>`; })()}
 <div class="row"><span>Composition (approx.)</span><b>${DE.Data.ZOMBIES.map(z => comp.counts[z.id] ? `<span class="comp-z" title="${esc(z.name)}">${DE.Chars.zombie(z.id, { anim: 'idle', h: 30 })}×${comp.counts[z.id]}</span>` : '').join('')}</b></div>
 <div class="row"><span>Wall damage multiplier</span><b>×${comp.dmgMult.toFixed(2)}${comp.toxic ? ` ·  ${comp.toxic} toxic` : ''}</b></div>
 <div class="row"><span>Reward on victory</span><b class="gold">${U().costText(nextReward)}</b></div>
 <div class="row"><span>Your firepower</span><b>${U().fmt(pw.total)}</b></div>
 <div class="row small"><span>Guards ${pw.guards} → ${U().fmt(pw.guardDps, 1)}/s · Turrets ${d.turrets} → ${U().fmt(pw.turretDps, 1)}/s ·${pw.missileDps ? ` Missiles → ${U().fmt(pw.missileDps, 1)}/s ·` : ''} Traps ${pw.trapsUsed} → ${pw.trapDmg}</span></div>
 ${bar(100 * Math.min(1, pw.total / hp), verdict[0] === 'pos' ? 'green' : verdict[0] === 'warn' ? 'orange' : 'red')}
 <p class="${verdict[0]}">${verdict[1]}</p><small class="muted">Waves last ${DE.CONFIG.WAVE_DURATION}s. Threat grows each wave and with depth.</small></div>`;

 const wc = DE.Defense.wallUpgradeCost(s); const rc = DE.Defense.repairCost(s);
 html += `<div class="card"><h4>${DE.Icons.structure('wall', 'ico-inline')} Wall · Level ${d.wall.level} <small class="muted">${d.wall.level < 3 ? 'cracked & patched' : d.wall.level < 6 ? 'steel-plated' : 'armoured'}</small></h4>${bar(100 * d.wall.hp / maxHp, d.wall.hp / maxHp < 0.3 ? 'red' : 'brown')}<div class="row"><span>HP</span><b>${U().fmt(d.wall.hp)} / ${U().fmt(maxHp)}</b></div>
 <div class="btn-row"><button class="btn primary small ${U().canAfford(s.resources, wc) ? '' : 'cant'}" data-action="wallUpgrade" ${U().canAfford(s.resources, wc) ? '' : 'disabled'}> Upgrade <span class="cost">${U().costText(wc)}</span></button>
 <button class="btn small ${rc.scrap > 0 ? '' : 'cant'}" data-action="wallRepair" ${rc.scrap > 0 ? '' : 'disabled'}> Repair <span class="cost">${U().costText(rc)}</span></button></div></div>`;

 const tc = DE.Defense.turretCost(s); const maxT = DE.Defense.maxTurrets(s);
 html += `<div class="card"><h4>${DE.Icons.structure('turret', 'ico-inline')} Auto-turrets · ${d.turrets}/${maxT}</h4><p class="muted">${DE.CONFIG.TURRET_DMG} dmg/s each (×${fx.turretDmgMult.toFixed(2)}), draw ${DE.CONFIG.TURRET_POWER}/s. More slots from Armory levels.</p>
 ${fx.turretsUnlocked ? `<button class="btn primary small ${U().canAfford(s.resources, tc) && d.turrets < maxT ? '' : 'cant'}" data-action="buyTurret" ${U().canAfford(s.resources, tc) && d.turrets < maxT ? '' : 'disabled'}>Build turret <span class="cost">${U().costText(tc)}</span></button>` : '<small class="neg"> Requires research: Heavy Machinery</small>'}</div>`;

 html += `<div class="card"><h4>${DE.Icons.structure('trap', 'ico-inline')} Traps · ${d.traps} stocked</h4><p class="muted">Each trap deals ${DE.CONFIG.TRAP_DMG} damage; up to ${DE.CONFIG.TRAPS_PER_WAVE} are used per wave. Consumed on use.</p>
 ${fx.trapsUnlocked ? `<div class="btn-row"><button class="btn small" data-action="buyTraps" data-n="1">+1 <span class="cost">${U().costText(DE.Defense.trapCost(s))}</span></button><button class="btn small" data-action="buyTraps" data-n="5">+5 <span class="cost">${U().costText(U().scaleCost(DE.Defense.trapCost(s), 5))}</span></button></div>` : '<small class="neg"> Requires research: Fortification</small>'}</div>`;

 const pool = DE.Survivors.available(s);
 html += `<div class="card"><h4>Guards <small class="muted">Soldiers +50%, guards level up in combat but can get hurt</small></h4>${pool.map(sv => { const g = sv.assignment && sv.assignment.kind === 'guard'; return `<div class="row"><span>${DE.Icons.prof(sv.profession, 'ico-inline')} ${esc(sv.name)} <small class="muted">Lv${sv.level} · ${U().fmt(DE.Survivors.guardPower(sv, fx), 1)} dmg/s${sv.hp < 50 ? ' · ' : ''}</small></span><button class="btn small ${g ? 'active' : ''}" data-action="toggleGuard" data-sid="${sv.id}">${g ? '✓ On duty' : 'Post as guard'}</button></div>`; }).join('')}</div>`;

 html += `<div class="card"><h4>${DE.Icons.img('map', 'ico-inline')} Perimeter <small class="muted">surface structures — visible on the overworld</small></h4>${DE.Data.OVERWORLD_ORDER.map(k => { const def = DE.Data.OVERWORLD[k]; const lvl = (s.overworld && s.overworld[k]) || 0; const cur = def.levels[lvl]; const next = DE.Defense.structureNext(s, k); const blocked = next && DE.Defense.structureBlocked(s, k); const ok = next && !blocked && U().canAfford(s.resources, next.cost);
 return `<div class="ow-row">${DE.Icons.structure ? DE.Icons.structure(k, 'ico-struct-row') : ''}<div class="ow-info"><b>${esc(def.name)}</b> <span class="tag">${esc(cur.name)}</span><small class="muted">${next ? esc(next.name) + ' — ' + esc(next.desc) : esc(cur.desc) + ' · fully upgraded'}</small>${blocked ? `<small class="bad">${esc(blocked)}</small>` : ''}</div>${next ? `<button class="btn primary small ${ok ? '' : 'cant'}" data-action="owUpgrade" data-key="${k}" ${ok ? '' : 'disabled'}>Upgrade <span class="cost">${U().costText(next.cost)}</span></button>` : '<b class="gold">MAX</b>'}</div>`; }).join('')}</div>`;
 html += `<div class="card"><h4>Bestiary</h4>${DE.Data.ZOMBIES.map(z => `<div class="row ${z.minWave > d.wave ? 'locked-row' : ''}"><span class="bestiary-row">${DE.Chars.zombie(z.id, { anim: z.minWave > d.wave ? 'idle' : 'walk', h: 44 })} <b>${esc(z.name)}</b> <small class="muted">${z.boss ? 'every ' + DE.Data.BOSS_EVERY + 'th wave' : 'from wave ' + z.minWave}</small></span><small class="muted">${z.boss ? '' : z.hp + ' HP · '}wall dmg ×${z.dmg} · ${esc(z.desc)}</small></div>`).join('')}</div>`;
 if (d.log.length) html += `<div class="card"><h4>Battle log</h4>${d.log.slice().reverse().slice(0, 8).map(r => `<div class="log-row ${r.outcome}"><b>${r.boss ? '' : ''}Wave ${r.wave}</b> ${r.outcome === 'victory' ? ' Repelled' : r.outcome === 'held' ? ' Wall held (−' + r.wallDamage + ' HP)' : ' BREACH'} · ${r.killed} killed${r.reward && Object.keys(r.reward).length ? ' · loot ' + U().costText(r.reward) : ''}${r.injured.length ? ' · injured: ' + r.injured.map(esc).join(', ') : ''}${r.breach ? ' · lost ' + Object.keys(r.losses).map(k => DE.Icons.res(k, 'ico-inline') + U().fmt(r.losses[k])).join('') : ''}</div>`).join('')}</div>`;
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
 html += `<div class="card bus-card"><h4>${DE.Icons.img('backpack', 'ico-inline')} Vehicle: ${esc(bus.name)} <small class="muted">${bus.capacity} seats · ${Math.round((1 - bus.speed) * 100)}% faster · ${Math.round(bus.safety * 100)}% safer · cargo x${bus.cargo}</small></h4><p class="muted">${esc(bus.desc)}</p>
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
 <button class="btn danger ${c.ok ? '' : 'cant'}" data-action="prestige" ${c.ok ? '' : 'disabled'}> Reconstruct for +${gain} LP</button>${c.ok ? '' : `<small class="neg">${c.reason}</small>`}</div>`;
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
