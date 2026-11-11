/* Side panel: bunker overview, selected room details & upgrades, build menu for an empty slot. */
var DE = globalThis.DE = globalThis.DE || {};

DE.UI.Side = (function () {
 const U = () => DE.Util;
 const esc = (s) => DE.Util.escapeHtml(s);
 const R = () => DE.Data.RESOURCES;

 function render(force) {
 const s = DE.UI.state(); const ui = DE.UI.ui; if (!s) return;
 let html; const sel = ui.selection;
 if (sel && sel.type === 'room' && s.rooms[sel.id]) html = renderRoom(s, s.rooms[sel.id]);
 else if (sel && sel.type === 'slot' && DE.Bunker.getFloor(s, sel.depth)) html = renderBuild(s, sel.depth, sel.slot);
 else { ui.selection = null; html = renderOverview(s); }
 if (force || html !== ui.lastSideHtml) {
 const el = document.getElementById('sidepanel'); const st = el.scrollTop;
 el.innerHTML = html; el.scrollTop = st; ui.lastSideHtml = html;
 }
 }

 function bar(pct, cls) { return `<div class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`; }
 function costBtn(label, cost, s, extra) {
 const ok = U().canAfford(s.resources, cost);
 return `<button class="btn primary ${ok ? '' : 'cant'}" ${extra || ''} ${ok ? '' : 'disabled'}>${label} <span class="cost">${U().costText(cost)}</span></button>`;
 }

 /* ---------- overview ---------- */
 function renderOverview(s) {
 const rates = s._rates || DE.Economy.computeRates(s);
 const pop = DE.Bunker.population(s), cap = DE.Bunker.housingCapacity(s);
 const power = DE.Defense.defensePower(s), hp = DE.Defense.waveHp(s);
 const cur = s.research.current; const now = Date.now();
 const idle = DE.Survivors.idle(s).length;
 const tips = [];
 if (idle > 0) tips.push(` ${idle} survivor${idle > 1 ? 's' : ''} idle — assign them to rooms.`);
 if (pop >= cap) tips.push(' Housing is full — upgrade Living Quarters to recruit more.');
 if (rates.powerFactor < 1) tips.push(' Brownout! Build or upgrade generators, or get fuel.');
 if (s.resources.fuel <= 0) tips.push(' Out of fuel — generators run at 30%. Build a Refinery or send an expedition to a Gas Station.');
 if (rates.net.food < 0) tips.push(' Food is running down.');
 if (rates.net.water < 0) tips.push(' Water is running down.');
 if (!cur && s.resources.research >= 40) tips.push(' Research points available — start a project.');
 if (power.total < hp) tips.push(' Defense is weaker than the next wave. Add guards, upgrade the wall.');
 if (s.defense.wall.hp < DE.Defense.wallMaxHp(s) * 0.5) tips.push(' The wall is damaged — repair it in Defense.');
 if (!tips.length) tips.push(' Things are stable. Upgrade production or dig deeper.');
 return `<div class="panel-head"><h3> Bunker Overview</h3><p class="muted">Select a room or an empty slot to manage it.</p></div>
 <div class="card stats-grid">
 <div><small>Floors</small><b>${s.floors.length}</b></div>
 <div><small>Rooms</small><b>${DE.Bunker.roomCount(s)}</b></div>
 <div><small>Survivors</small><b>${pop}/${cap}</b></div>
 <div><small>Morale</small><b>${Math.round(s.morale)}</b></div>
 <div><small>Power</small><b class="${rates.powerFactor < 1 ? 'neg' : ''}">${U().fmt(rates.powerGen, 1)}/${U().fmt(rates.powerUse, 1)}</b></div>
 <div><small>Wave ${s.defense.wave}</small><b class="${power.total < hp ? 'neg' : 'pos'}">${U().fmt(power.total)} vs ${U().fmt(hp)}</b></div>
 </div>
 <div class="card"><h4>Status</h4><ul class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul><button class="btn small" data-action="openDrawer" data-drawer="economy"> Production dashboard</button></div>
 ${cur ? `<div class="card"><h4> Researching ${esc(DE.Data.RESEARCH[cur.id].name)}</h4>${bar(100 * (1 - (cur.endsAt - now) / (cur.duration * 1000)), 'purple')}<small class="muted">${U().fmtTime((cur.endsAt - now) / 1000)} left</small></div>` : ''}
 ${s.excavation ? `<div class="card"><h4> Excavating B${s.excavation.depth}</h4>${bar(100 * (1 - (s.excavation.endsAt - now) / (s.excavation.duration * 1000)), 'brown')}<small class="muted">${U().fmtTime((s.excavation.endsAt - now) / 1000)} left</small></div>` : ''}
 ${s.expeditions.active.length ? `<div class="card"><h4> Expeditions out: ${s.expeditions.active.length}</h4>${s.expeditions.active.map(e => `<small>${DE.Icons.img('location','ico-inline')} ${esc(DE.Expeditions.location(e.location).name)} · ${U().fmtTime((e.endsAt - now) / 1000)}</small>`).join('<br>')}</div>` : ''}
 <div class="card"><h4>Recent events</h4><ul class="log">${s.log.slice(-6).reverse().map(l => `<li>${esc(l.msg)}</li>`).join('')}</ul></div>`;
 }

 /* ---------- effect labels ---------- */
 const EFFECT_LABELS = {
 housing: ['Housing', (v) => '+' + v], storage: ['Storage cap', (v) => '+' + U().fmt(v)], morale: ['Morale', (v) => '+' + v], foodSave: ['Food use', (v) => '−' + Math.round(Math.min(.6, v) * 100) + '%'],
 heal: ['Healing', (v) => '+' + (0.5 * v).toFixed(1) + ' hp/s'], guardDmg: ['Guard damage', (v) => '+' + Math.round(v * 100) + '%'], turretCap: ['Turret slots', (v) => '+' + v], xp: ['Experience', (v) => '+' + Math.round(v * 100) + '%'],
 recruitDiscount: ['Recruit cost', (v) => '−' + Math.round(Math.min(.7, v) * 100) + '%'], radio: ['Radio callers', (v) => '+' + v], expeditionSlots: ['Expedition teams', (v) => '+' + v], lootBonus: ['Expedition loot', (v) => '+' + Math.round(v * 100) + '%'],
 sleepSpeed: ['Sleep recovery', (v) => '+' + Math.round(v * 100) + '%'], eatSpeed: ['Meal speed', (v) => '+' + Math.round(v * 100) + '%'], hungerSlow: ['Hunger rate', (v) => '−' + Math.round(Math.min(.6, v) * 100) + '%'],
 waterCap: ['Water cap', (v) => '+' + U().fmt(v)], foodCap: ['Food cap', (v) => '+' + U().fmt(v)], guardCap: ['Guard posts', (v) => '+' + v], waveWarning: ['Wave warning', (v) => '+' + v + 's'], waveLoot: ['Wave loot', (v) => '+' + Math.round(v * 100) + '%'],
 turretDmg: ['Turret damage', (v) => '+' + Math.round(v * 100) + '%'], trapDmg: ['Trap damage', (v) => '+' + Math.round(v * 100) + '%'], wallHp: ['Wall HP', (v) => '+' + Math.round(v * 100) + '%'], defenseFlat: ['Flat defense', (v) => '+' + U().fmt(v)],
 bossWeaken: ['Boss HP', (v) => '−' + Math.round(Math.min(.8, v) * 100) + '%'], expeditionSpeed: ['Expedition speed', (v) => '+' + Math.round(Math.min(.7, v) * 100) + '%'], expeditionSafety: ['Expedition safety', (v) => '+' + Math.round(Math.min(.8, v) * 100) + '%'],
 consumptionSave: ['Room inputs', (v) => '−' + Math.round(v * 100) + '%'], toxicResist: ['Toxic resistance', (v) => Math.round(Math.min(.9, v) * 100) + '%'], cryoSlots: ['Stasis pods', (v) => v + ' survivors'], allLocations: ['Expedition sites', () => 'all revealed'],
 autoAssign: ['Auto-assignment', () => 'idle survivors put to work'], globalMult: ['All production', (v) => '+' + Math.round(v * 100) + '%'], offlineCap: ['Offline cap', (v) => '+' + v + 'h'], workerEff: ['Worker efficiency', (v) => '+' + Math.round(v * 100) + '%'], digBonus: ['Excavation cost & time', (v) => '−' + Math.round(v * 100) + '%'],
 };
 function effectRows(s, def, level) {
 let h = '';
 for (const k in def.effects) { const L = EFFECT_LABELS[k]; if (!L) continue; let v = def.effects[k] * level; if (k === 'housing' && def.id === 'quarters') v += s._fx.housingPerLevel * level; h += `<div class="row"><span>${L[0]}</span><b class="pos">${L[1](v)}</b></div>`; }
 return h;
 }
 function nextEffects(def, from, to) {
 const out = []; for (const k in def.effects || {}) { const L = EFFECT_LABELS[k]; if (!L) continue; out.push(L[0] + ' ' + L[1](def.effects[k] * from) + ' → ' + L[1](def.effects[k] * to)); } return out;
 }

 /* ---------- room detail ---------- */
 function renderRoom(s, room) {
 const def = DE.Data.ROOMS[room.type]; const ui = DE.UI.ui; const now = Date.now();
 const info = s._rates && s._rates.perRoom[room.id];
 let html = `<div class="panel-head room-head-big cat-${def.category}"><div class="big-icon">${DE.Icons.room(def.id, 'ico-big')}</div>
 <div><h3>${esc(def.name)} ${def.unique ? '<span class="tag gold">UNIQUE</span>' : ''}</h3>
 <div class="muted">B${room.floor} · ${room.level > 0 ? 'Level ' + room.level + ' / ' + def.maxLevel : 'Under construction'}${def.tier ? ' · <span class="tag tier-' + def.tier + '">Tier ' + def.tier + '</span>' : ''}</div></div></div>
 <p class="desc">${esc(def.desc)}</p>`;

 if (room.construction) {
 const c = room.construction; const pct = 100 * (1 - (c.endsAt - now) / (c.duration * 1000));
 html += `<div class="card"><h4>${c.kind === 'build' ? ' Building' : ' Upgrading +' + c.levels}</h4>${bar(pct, 'orange')}<small class="muted">${U().fmtTime((c.endsAt - now) / 1000)} remaining</small></div>`;
 }

 // production / effects
 if (room.level > 0 && info && def.produces) {
 html += `<div class="card"><h4>Output</h4>`;
 for (const r in info.produces) html += `<div class="row big-rate"><span>${DE.Icons.res(r, 'ico-inline')} ${R()[r].name}</span><b class="pos">+${U().fmt(info.produces[r], 2)}/s</b></div>`;
 for (const r in info.consumes) html += `<div class="row"><span>${DE.Icons.res(r, 'ico-inline')} ${R()[r].name} used</span><b class="neg">−${U().fmt(info.consumes[r], 2)}/s</b></div>`;
 if (info.powerUse) html += `<div class="row"><span> Power draw</span><b class="neg">−${U().fmt(info.powerUse, 2)}/s</b></div>`;
 html += `<details class="breakdown"><summary>Multipliers</summary><div class="row"><span>Level ${room.level}</span><b>×${DE.Economy.levelMult(room.level).toFixed(2)}</b></div>
 <div class="row"><span>Workers (${room.workers.length}/${def.workers})</span><b>×${info.workerMult.toFixed(2)}</b></div>
 <div class="row"><span>Adjacency</span><b>×${(1 + info.adjacency).toFixed(2)}</b></div>
 <div class="row"><span>Research</span><b>×${info.research.toFixed(2)}</b></div>
 <div class="row"><span>Legacy & global</span><b>×${(1 + s._fx.globalMult).toFixed(2)}</b></div>
 <div class="row"><span>Morale</span><b>×${DE.Economy.moraleMult(s.morale).toFixed(2)}</b></div>
 ${info.power < 1 ? `<div class="row neg"><span>Brownout</span><b>×${info.power.toFixed(2)}</b></div>` : ''}
 ${info.starve < 1 ? `<div class="row neg"><span>Missing input</span><b>×${info.starve.toFixed(2)}</b></div>` : ''}
 <small class="muted">Same-type neighbours +10% each, generator neighbour +5%.</small></details></div>`;
 } else if (room.level > 0 && def.effects) {
 html += `<div class="card"><h4>Effect <small class="muted">${esc(def.upgradeDesc)}</small></h4>${effectRows(s, def, room.level)}${info && info.powerUse ? `<div class="row"><span>${DE.Icons.res('electricity', 'ico-inline')} Power draw</span><b class="neg">−${U().fmt(info.powerUse, 2)}/s</b></div>` : ''}</div>`;
 }
 if (room.level > 0 && def.produces && def.effects) html += `<div class="card"><h4>Also provides</h4>${effectRows(s, def, room.level)}</div>`;

 // workers
 if (def.workers > 0 && room.level > 0) {
 const prof = def.profession ? DE.Data.PROFESSIONS[def.profession] : null;
 html += `<div class="card"><h4>Workers ${room.workers.length}/${def.workers} ${prof ? `<small class="muted">best: ${DE.Icons.prof(prof.id,'ico-inline')} ${prof.name}</small>` : ''}</h4>`;
 room.workers.forEach(sid => {
 const sv = s.survivors[sid]; if (!sv) return;
 const eff = DE.Survivors.efficiency(sv, def, s._fx);
 html += `<div class="row worker-row"><span class="worker-cell">${DE.Chars.crew(sv.profession, { anim: 'idle', h: 34 })}<span><b>${esc(sv.name)}</b> <small class="muted">Lv${sv.level} · ${Math.round(eff * 100)}%${sv.hp < 50 ? ' · injured' : ''}</small><br><small class="act-tag act-${sv.act ? sv.act.kind : 'idle'}">${DE.Needs.describe(sv)}</small></span></span><button class="btn small" data-action="unassign" data-sid="${sid}">Unassign</button></div>`;
 });
 if (room.workers.length < def.workers) {
 const idle = DE.Survivors.idle(s).length;
 html += `<button class="btn ${idle ? '' : 'cant'}" data-action="openAssign" data-id="${room.id}">＋ Assign survivor ${idle ? `(${idle} idle)` : '(none idle)'}</button>`;
 }
 html += `</div>`;
 }

 // upgrade
 if (room.level > 0 && room.level < def.maxLevel) {
 const modes = [1, 10, 25, 'max'];
 const n = room.construction ? 0 : DE.Bunker.affordableLevels(s, room, ui.buyMode);
 const want = ui.buyMode === 'max' ? Math.max(1, n) : ui.buyMode;
 const shown = Math.max(1, n || want);
 const cost = DE.Bunker.upgradeCost(s, room, shown);
 const time = DE.Bunker.upgradeTime(s, room, shown);
 html += `<div class="card"><h4>Upgrade <small class="muted">${esc(def.upgradeDesc)}</small></h4>
 <div class="buymodes">${modes.map(m => `<button class="btn small ${ui.buyMode === m ? 'active' : ''}" data-action="setBuyMode" data-mode="${m}">${m === 'max' ? 'MAX' : 'x' + m}</button>`).join('')}</div>`;
 if (def.produces && info) {
 const next = DE.Economy.levelMult(room.level + shown) / DE.Economy.levelMult(room.level);
 html += `<div class="row"><span>Output after +${shown}</span><b class="pos">×${next.toFixed(2)}</b></div>`;
 }
 if (def.effects && !def.produces) nextEffects(def, room.level, room.level + shown).forEach(t => { html += `<div class="row small"><span>${t}</span></div>`; });
 html += `<div class="row"><span>Time</span><b>${U().fmtTime(time)}</b></div>
 <button class="btn primary ${n > 0 ? '' : 'cant'}" data-action="upgrade" data-id="${room.id}" data-n="${shown}" ${n > 0 && !room.construction ? '' : 'disabled'}> Upgrade +${shown} <span class="cost">${U().costText(cost)}</span></button>
 ${room.construction ? '<small class="muted">Wait for current construction.</small>' : ''}</div>`;
 } else if (room.level >= def.maxLevel) html += `<div class="card"><b class="gold">★ MAX LEVEL</b></div>`;

 if (!def.unique) html += `<div class="card"><button class="btn danger small" data-action="demolish" data-id="${room.id}"> Demolish (50% refund)</button></div>`;
 html += `<button class="btn ghost" data-action="selectNone">← Back to overview</button>`;
 return html;
 }

 /* ---------- build menu ---------- */
 function renderBuild(s, depth, slot) {
 let html = `<div class="panel-head"><h3> Build on B${depth}, slot ${slot + 1}</h3><p class="muted">Rooms that need 2 slots use this slot and the next one.</p></div>`;
 const tiers = {};
 DE.Data.ROOM_BUILD_ORDER.forEach(type => { const def = DE.Data.ROOMS[type]; (tiers[def.tier] = tiers[def.tier] || []).push(def); });
 Object.keys(tiers).sort().forEach(t => {
 const defs = tiers[t]; const unlockedCount = defs.filter(d => DE.Bunker.isUnlocked(s, d.id)).length;
 const gate = defs.find(d => d.unlock && d.unlock.startsWith('blueprints'));
 html += `<details class="tier-group" ${unlockedCount ? 'open' : ''}><summary><span class="tag tier-${t}">Tier ${t}</span> ${esc(DE.Data.TIER_LABELS[t])} <small class="muted">${unlockedCount}/${defs.length} unlocked${!unlockedCount && gate ? ' · ' + esc(DE.Bunker.lockReason(s, gate.id) || '') : ''}</small></summary>`;
 defs.forEach(def => {
 const type = def.id; const unlocked = DE.Bunker.isUnlocked(s, type);
 const place = DE.Bunker.canPlace(s, type, depth, slot); const cost = DE.Bunker.buildCost(s, type); const afford = U().canAfford(s.resources, cost);
 const ok = unlocked && place.ok && afford;
 const reason = !unlocked ? DE.Bunker.lockReason(s, type) : !place.ok ? place.reason : !afford ? 'Not enough resources' : '';
 let outputs = def.produces ? Object.keys(def.produces).map(r => `+${def.produces[r]}${DE.Icons.res(r, 'ico-inline')}/s`).join('') : '';
 if (def.effects) outputs += (outputs ? ' · ' : '') + esc(def.upgradeDesc);
 html += `<div class="build-card cat-${def.category} ${unlocked ? '' : 'locked'}"><div class="bc-icon">${DE.Icons.room(def.id, 'ico-inline')}</div>
 <div class="bc-body"><b>${esc(def.name)}</b> <small class="muted">${def.size} slot${def.size > 1 ? 's' : ''} · ${def.workers ? def.workers + ' ' + (def.profession ? DE.Data.PROFESSIONS[def.profession].name.toLowerCase() + 's' : 'workers') : 'no staff'}${def.powerUse ? ' · ' + def.powerUse + ' power' : ''}</small>
 <div class="bc-desc">${esc(def.desc)}</div><div class="bc-out">${outputs}</div>${reason ? `<div class="bc-reason">${esc(reason)}</div>` : ''}</div>
 <button class="btn primary small ${ok ? '' : 'cant'}" data-action="build" data-type="${type}" data-depth="${depth}" data-slot="${slot}" ${ok ? '' : 'disabled'}>Build<span class="cost">${U().costText(cost)}</span><small>${U().fmtTime(DE.Bunker.buildTime(s, type))}</small></button></div>`;
 });
 html += `</details>`;
 });
 html += `<button class="btn ghost" data-action="selectNone">← Back to overview</button>`;
 return html;
 }

 return { render, bar, costBtn };
})();
