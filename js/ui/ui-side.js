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
 const el = document.getElementById('sidepanel'); if (!force && DE.UI.scrollBusy && DE.UI.scrollBusy(el)) return;
 const st = el.scrollTop;
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
 const act = (label, attrs) => ` <button class="tip-btn" ${attrs}>${label}</button>`;
 if (idle > 0) tips.push(` ${idle} survivor${idle > 1 ? 's' : ''} idle — assign them to rooms.` + act('Put to work', 'data-action="assignIdle"'));
 if (pop >= cap) tips.push(' Housing is full — upgrade Living Quarters to recruit more.');
 if (rates.powerFactor < 1) tips.push(' Brownout! Build or upgrade generators, or get fuel.');
 if (s.resources.fuel <= 0) tips.push(' Out of fuel — generators run at 30%. Build a Refinery or send an expedition to a Gas Station.');
 if (rates.net.food < 0) tips.push(' Food is running down.');
 if (rates.net.water < 0) tips.push(' Water is running down.');
 if (!cur && s.resources.research >= 40) tips.push(' Research points available — start a project.' + act('Research', 'data-action="openDrawer" data-drawer="research"'));
 if (power.total < hp) tips.push(' Defense is weaker than the next wave. Add guards, upgrade the wall.' + act('Defense', 'data-action="openDrawer" data-drawer="defense"'));
 if (s.defense.wall.hp < DE.Defense.wallMaxHp(s) * 0.5) tips.push(' The wall is damaged.' + act('Repair', 'data-action="wallRepair"'));
 if (!tips.length) tips.push(' Things are stable. Upgrade production or dig deeper.');
 const goals = DE.Events.activeGoals(s); const nEv = (s.events || []).length; const noise = DE.Events.noise(s);
 const I = (k) => DE.Icons.img(k, 'ico-ov');
 const ago = (t) => { const d = Math.max(0, (Date.now() - t) / 1000); return d < 60 ? 'now' : d < 3600 ? Math.floor(d / 60) + 'm ago' : d < 86400 ? Math.floor(d / 3600) + 'h ago' : Math.floor(d / 86400) + 'd ago'; };
 const logIcon = (m) => /wave|horde|breach|zombie/i.test(m) ? 'zombie' : /research/i.test(m) ? 'research' : /join|recruit|survivor|friends/i.test(m) ? 'pop' : /power|brownout|fuel/i.test(m) ? 'power' : /dug|excavat|floor/i.test(m) ? 'dig' : /upgrad|built|install|complete/i.test(m) ? 'up' : /injur|hurt|died|lost/i.test(m) ? 'warning' : 'star';
 const tile = (icon, label, value, cls) => `<div class="ov-tile">${I(icon)}<span><small>${label}</small><b class="${cls || ''}">${value}</b></span></div>`;
 const noiseLvl = DE.Events.noiseLevel(noise);
 return `<div class="ov-head">${DE.Icons.img('home', 'ov-home')}<div><h3>Bunker Overview</h3><p>Click a room to manage it, or assign your crew.</p></div></div>
 ${nEv ? `<button class="btn primary decide-btn" data-action="nextEvent">${DE.Icons.img('events', 'ico-btn')} ${nEv} decision${nEv > 1 ? 's' : ''} waiting</button>` : ''}
 <div class="ov-card"><h4>${DE.Icons.img('alert', 'ico-h4')} Objectives</h4>${goals.map(g => `<div class="ov-goal"><span class="ov-badge tier-${g.tier}">${DE.Icons.img('star', '')}</span><div><b>${esc(g.name)}</b><small>${esc(g.desc)}</small></div><span class="ov-reward">${Object.keys(g.reward).slice(0, 2).map(k => DE.Data.RESOURCES[k] ? `<span class="pill">${U().fmt(g.reward[k])}${DE.Icons.res(k, '')}</span>` : `<span class="pill">+${g.reward[k]}</span>`).join('')}</span></div>`).join('') || `<div class="ov-goal done"><span class="ov-badge">${DE.Icons.img('check', '')}</span><div><b>All objectives done</b><small>The bunker is yours.</small></div></div>`}</div>
 <div class="ov-grid">
 ${tile('floors', 'Floors', s.floors.length)}${tile('rooms', 'Rooms', DE.Bunker.roomCount(s))}${tile('pop', 'Survivors', pop + '/' + cap, pop > cap ? 'neg' : '')}
 ${tile('morale', 'Morale', Math.round(s.morale) + '%', s.morale >= 50 ? 'pos' : s.morale >= 30 ? 'warn' : 'neg')}${tile('power', 'Power', `${U().fmt(rates.powerGen, 1)}<i>/${U().fmt(rates.powerUse, 1)}</i>`, rates.powerFactor < 1 ? 'neg' : 'cyan')}${tile('wave', 'Wave ' + s.defense.wave, `${U().fmt(power.total)}<i>/${U().fmt(hp)}</i>`, power.total < hp ? 'neg' : 'pos')}
 ${tile(noiseLvl === 'quiet' ? 'noise' : 'noise.loud', 'Noise', noiseLvl.charAt(0).toUpperCase() + noiseLvl.slice(1), noiseLvl === 'quiet' ? 'pos' : noiseLvl === 'loud' || noiseLvl === 'deafening' ? 'neg' : 'warn')}${tile('vehicle', 'Vehicle', esc(DE.Events.bus(s).name.split(' ').slice(-1)[0]))}${tile('artifacts', 'Artifacts', Object.keys(s.artifacts || {}).length)}
 </div>
 <div class="ov-card"><h4>${DE.Icons.img('info', 'ico-h4')} Status</h4><ul class="ov-tips">${tips.map(t => `<li>${t.trim()}</li>`).join('')}</ul><button class="btn small" data-action="openDrawer" data-drawer="economy">${DE.Icons.img('chart', 'ico-btn')} Production dashboard</button></div>
 ${cur ? `<div class="ov-card"><h4>${DE.Icons.img('research', 'ico-h4')} Researching ${esc(DE.Data.RESEARCH[cur.id].name)}</h4>${bar(100 * (1 - (cur.endsAt - now) / (cur.duration * 1000)), 'purple')}<small class="muted">${U().fmtTime((cur.endsAt - now) / 1000)} left</small></div>` : ''}
 ${s.excavation ? `<div class="ov-card"><h4>${DE.Icons.img('dig', 'ico-h4')} Excavating B${s.excavation.depth}</h4>${bar(100 * DE.Excavation.progress(s), 'brown')}<small class="muted">${U().fmtTime(DE.Excavation.remaining(s))} left · ${DE.Excavation.miners(s).length} miner${DE.Excavation.miners(s).length === 1 ? '' : 's'}</small></div>` : ''}
 ${s.expeditions.active.length ? `<div class="ov-card"><h4>${DE.Icons.img('truck', 'ico-h4')} Expeditions out: ${s.expeditions.active.length}</h4>${s.expeditions.active.map(e => `<small>${DE.Icons.img('location', 'ico-inline')} ${esc(DE.Expeditions.location(e.location).name)} · ${U().fmtTime((e.endsAt - now) / 1000)}</small>`).join('<br>')}</div>` : ''}
 <div class="ov-card"><h4>Recent events</h4><ul class="ov-log">${s.log.slice(-6).reverse().map(l => `<li>${DE.Icons.img(logIcon(l.msg), 'ico-log')}<span>${esc(l.msg)}</span><time>${ago(l.t)}</time></li>`).join('')}</ul></div>`;
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
 html += `<div class="row worker-row"><span class="worker-cell">${DE.Icons.prof(sv.profession, 'ava')}<span><b>${esc(sv.name)}</b> <small class="muted">Lv${sv.level} · ${Math.round(eff * 100)}%${sv.hp < 50 ? ' · injured' : ''}</small><br><small class="act-tag act-${sv.act ? sv.act.kind : 'idle'}">${DE.Needs.describe(sv)}</small></span></span><button class="btn small" data-action="unassign" data-sid="${sid}">Unassign</button></div>`;
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

 if (!def.unique) { const mc = DE.Bunker.moveCost(s, room), rf = DE.Bunker.demolishRefund(s, room), canMove = !room.construction && U().canAfford(s.resources, mc);
 html += `<div class="room-actions"><button class="ra-btn btn drag-handle ${canMove ? '' : 'cant'}" data-move="${room.id}" ${room.construction ? 'disabled' : ''} title="Drag (or tap, then tap a spot) to move the room">${DE.Icons.img('move4', 'ra-ico')}<span><b>Relocate</b><small>costs ${U().costText(mc)}</small></span></button>
 <button class="ra-btn btn danger" data-action="demolish" data-id="${room.id}" title="Tear down this room">${DE.Icons.img('trash', 'ra-ico')}<span><b>Demolish</b><small>refund ${U().costText(rf)}</small></span></button></div>`; }
 html += `<button class="btn ghost" data-action="selectNone">← Back to overview</button>`;
 return html;
 }

 /* ---------- build menu ---------- */
 // Category tabs, how much room the selected spot has, then one card per room: icon, name, size /
 // staff / power chips, a two-line description, output, and Build here / Drag. Hovering (or
 // touching) a card previews its footprint on the grid in green or red.
 const BM_CATS = [['all', 'All', 'build'], ['production', 'Production', 'chart'], ['housing', 'Housing', 'home'], ['support', 'Support', 'gear'], ['defense', 'Defense', 'shield']];
 function renderBuild(s, depth, slot) {
 bindPreview();
 const ui = DE.UI.ui, cat = ui.buildCat || 'all', floor = DE.Bunker.getFloor(s, depth);
 let free = 0; for (let k = slot; k < floor.slots.length && floor.slots[k] == null; k++) free++;
 let html = `<div class="panel-head bm-head"><h3>Build on B${depth} · cell ${slot + 1}</h3><p class="bm-free">${DE.Icons.img('rooms', 'ico-inline')} <b>${free}</b> free cell${free === 1 ? '' : 's'} from here · drag a room to place it anywhere</p></div>
 <div class="bm-tabs">${BM_CATS.map(([id, label, ic]) => `<button class="bm-tab ${cat === id ? 'on' : ''}" data-action="buildCat" data-cat="${id}">${DE.Icons.img(ic, 'ico-inline')}<span>${label}</span></button>`).join('')}</div>`;
 const tiers = {};
 DE.Data.ROOM_BUILD_ORDER.forEach(type => { const def = DE.Data.ROOMS[type]; if (cat !== 'all' && def.category !== cat) return; (tiers[def.tier] = tiers[def.tier] || []).push(def); });
 Object.keys(tiers).sort().forEach(t => {
 const defs = tiers[t]; const unlockedCount = defs.filter(d => DE.Bunker.isUnlocked(s, d.id)).length;
 const gate = defs.find(d => d.unlock && d.unlock.startsWith('blueprints'));
 html += `<details class="tier-group" ${unlockedCount ? 'open' : ''}><summary><span class="tag tier-${t}">Tier ${t}</span> ${esc(DE.Data.TIER_LABELS[t])} <small class="muted">${unlockedCount}/${defs.length} unlocked${!unlockedCount && gate ? ' · ' + esc(DE.Bunker.lockReason(s, gate.id) || '') : ''}</small></summary>`;
 defs.forEach(def => {
 const type = def.id; const unlocked = DE.Bunker.isUnlocked(s, type);
 const place = DE.Bunker.canPlace(s, type, depth, slot); const cost = DE.Bunker.buildCost(s, type); const afford = U().canAfford(s.resources, cost);
 const ok = unlocked && place.ok && afford;
 const fits = def.size <= free;
 const reason = !unlocked ? DE.Bunker.lockReason(s, type) : !place.ok ? (fits ? place.reason : `Needs ${def.size} free cells here (${free} free) — or drag it elsewhere`) : !afford ? 'Not enough resources' : '';
 let outputs = def.produces ? Object.keys(def.produces).map(r => `<span>+${def.produces[r]}${DE.Icons.res(r, 'ico-inline')}/s</span>`).join('') : '';
 if (def.effects && def.upgradeDesc) outputs += `<span>${esc(def.upgradeDesc)}</span>`;
 const chips = `<i class="bc-chip ${fits ? '' : 'bad'}" title="${def.size} cells wide">${Array.from({ length: def.size }, () => '<em></em>').join('')}${def.size}</i>`
   + (def.workers ? `<i class="bc-chip">${DE.Icons.img('pop', 'ico-inline')}${def.workers}${def.profession ? ' ' + esc(DE.Data.PROFESSIONS[def.profession].name.toLowerCase()) + (def.workers > 1 ? 's' : '') : ''}</i>` : '<i class="bc-chip">no staff</i>')
   + (def.powerUse ? `<i class="bc-chip">${DE.Icons.res('electricity', 'ico-inline')}${def.powerUse}</i>` : '');
 html += `<div class="build-card cat-${def.category} ${unlocked ? '' : 'locked'} ${fits ? '' : 'nofit'}" data-fp="${def.size}" data-fok="${place.ok ? 1 : 0}" data-depth="${depth}" data-slot="${slot}"><div class="bc-icon">${DE.Icons.room(def.id, 'ico-inline')}</div>
 <div class="bc-body"><b>${esc(def.name)}</b><div class="bc-chips">${chips}</div>
 <div class="bc-desc">${esc(def.desc)}</div>${outputs ? `<div class="bc-out">${outputs}</div>` : ''}${reason ? `<div class="bc-reason">${esc(reason)}</div>` : ''}</div>
 <div class="bc-actions"><button class="btn primary small ${ok ? '' : 'cant'}" data-action="build" data-type="${type}" data-depth="${depth}" data-slot="${slot}" ${ok ? '' : 'disabled'}>Build here<span class="cost">${U().costText(cost)}</span><small>${U().fmtTime(DE.Bunker.buildTime(s, type))}</small></button>${unlocked ? `<button class="btn small drag-handle" data-place="${type}" title="Drag onto the bunker">${DE.Icons.img('move4', 'ico-inline')} Drag</button>` : ''}</div></div>`;
 });
 html += `</details>`;
 });
 html += `<button class="btn ghost" data-action="selectNone">← Back to overview</button>`;
 return html;
 }
 /** Footprint preview while a build card is hovered or touched. */
 let previewBound = false;
 function bindPreview() {
 if (previewBound) return; previewBound = true;
 const panel = document.getElementById('sidepanel'); if (!panel) return;
 panel.addEventListener('pointerover', (e) => {
   const card = e.target.closest && e.target.closest('.build-card[data-fp]');
   if (!card) { DE.UI.Bunker.clearFootprint(); return; }
   DE.UI.Bunker.previewFootprint(+card.dataset.depth, +card.dataset.slot, +card.dataset.fp, card.dataset.fok === '1');
 });
 panel.addEventListener('pointerleave', () => DE.UI.Bunker.clearFootprint());
 }

 return { render, bar, costBtn };
})();
