/* Every data-action="..." in the DOM maps to a function here. Actions mutate state through the
 * core modules, then ask the UI to refresh. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Actions = (function () {
 const UI = () => DE.UI;
 const U = () => DE.Util;
 const esc = (s) => DE.Util.escapeHtml(s);
 const S = () => DE.Game.state;
 const P = () => DE.Data.PROFESSIONS;
 const done = () => DE.Game.afterAction();
 const fail = (res) => { DE.Audio.sfx('error'); UI().toast(res && res.reason ? res.reason : 'Cannot do that', 'err'); };

 const A = {};
 A.noop = () => {};
 A.defToggle = (p) => { const o = UI().ui.defOpen = UI().ui.defOpen || {}; o[p.key] = !o[p.key]; UI().renderDrawer(true); };
 A.closeModal = () => UI().closeModal();
 A.confirmYes = () => { const cb = UI()._confirmCb; UI()._confirmCb = null; UI().closeModal(); if (cb) cb(); };

 /* ---- menu ---- */
 A.continueGame = () => DE.Game.continueGame();
 A.newGame = () => {
 if (DE.Save.hasSave()) UI().confirmModal('Start a new bunker?', '<p>Your existing save will be <b>deleted</b>. Export it first from the in-game menu if you want to keep it.</p>', () => DE.Game.newGame(), 'Delete & start new');
 else DE.Game.newGame();
 };
 A.menuSettings = () => DE.UI.Menu.settings();
 A.menuCredits = () => DE.UI.Menu.credits();
 A.menuSaves = () => DE.UI.Menu.saves();
 A.menuToggleAudio = (p) => { DE.Audio.set(p.key, !DE.Audio.prefs()[p.key]); DE.UI.Menu.settings(); };
 A.menuExport = () => { const st = DE.Save.load(); const ta = document.getElementById('export-area'); if (st && ta) { ta.hidden = false; ta.value = DE.Save.exportString(st); ta.select(); } };
 A.menuDeleteSave = () => UI().confirmModal('Delete the save?', '<p>Your bunker will be gone for good. Export it first if you want to keep it.</p>', () => { DE.Save.clear(); UI().showScreen('menu'); UI().toast('Save deleted', 'warn'); }, 'Delete');
 A.menuImport = () => {
 UI().modal({ title: 'Import save', html: '<p class="muted">Paste an exported save string. It is validated and never executed.</p><textarea id="import-area" class="save-area" placeholder="DEU1:..."></textarea>',
 buttons: [{ label: 'Import', action: 'importSave', cls: 'primary' }, { label: 'Cancel', action: 'closeModal' }] });
 };

 /* ---- navigation ---- */
 A.openDrawer = (p) => UI().openDrawer(p.drawer);
 A.closeDrawer = () => UI().closeDrawer();
 A.selectRoom = (p) => { UI().ui.selection = { type: 'room', id: p.id }; UI().closeDrawer(); UI().refresh(true); };
 A.buildCat = (p) => { UI().ui.buildCat = p.cat; DE.UI.Side.render(true); };
 A.selectSlot = (p) => { UI().ui.selection = { type: 'slot', depth: +p.depth, slot: +p.slot }; UI().closeDrawer(); UI().refresh(true); };
 A.selectSurvivor = (p) => { UI().ui.survivorFilter = 'all'; UI().ui.focusSurvivor = p.sid; UI().openDrawer('survivors'); };
 A.expandFloor = (p, el) => { const cost = DE.Bunker.expansionCost(S(), +p.depth); const r = DE.Bunker.expand(S(), +p.depth); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Digging a new wing on B' + p.depth); done(); };
 A.startPlace = (p, el, ev) => { DE.UI.Placement.start({ type: p.type }, ev && ev.type === 'pointerdown' ? ev : null); };
 A.startMove = (p, el, ev) => { DE.UI.Placement.start({ roomId: p.id }, null); };
 A.moveRoom = (p) => { const r = DE.Bunker.move(S(), p.id, +p.depth, +p.slot); if (!r.ok) return fail(r); if (r.cost) UI().purchased(null, null, 'Room relocated'); UI().ui.selection = { type: 'room', id: p.id }; done(); };
 A.nextEvent = () => { const ev = (S().events || [])[0]; if (ev) UI().eventModal(ev); };
 A.eventChoice = (p, el) => {
 const ev = (S().events || []).find(e => e.id === p.id); const r = DE.Events.choose(S(), p.id, +p.i); if (!r.ok) return fail(r);
 UI().closeModal(); UI().toast((ev ? '<b>' + UI().esc(ev.title) + '</b> · ' : '') + UI().esc(r.summary || 'Done.'), 'ok', 4500, 'scroll');
 done();
 };
 A.busUpgrade = (p, el) => { const next = DE.Events.busNext(S()); const r = DE.Events.upgradeBus(S()); if (!r.ok) return fail(r); UI().purchased(el, r.cost, 'New vehicle: ' + next.name); S().log.push({ t: Date.now(), msg: 'Expedition vehicle upgraded to ' + next.name + '.' }); done(); };
 A.selectNone = () => { UI().ui.selection = null; UI().refresh(true); };
 /** Replay the intro (the game is paused behind it: its loop stops and restarts afterwards). */
 A.replayIntro = () => { if (!DE.UI.Intro || DE.UI.Intro.running()) return; UI().closeDrawer(); DE.Game.stop(); DE.UI.Intro.play(() => DE.Game.start()); };
 A.scrollFloor = (p) => { UI().closeDrawer(); DE.UI.Bunker.scrollToFloor(+p.depth); };
 A.setBuyMode = (p) => { UI().ui.buyMode = p.mode === 'max' ? 'max' : +p.mode; UI().refresh(true); };

 /* ---- bunker ---- */
 A.build = (p, el) => {
 const cost = DE.Bunker.buildCost(S(), p.type);
 const r = DE.Bunker.build(S(), p.type, +p.depth, +p.slot);
 if (!r.ok) return fail(r);
 UI().purchased(el, cost, 'Building ' + DE.Data.ROOMS[p.type].name);
 UI().ui.selection = { type: 'room', id: r.room.id };
 done(); DE.Audio.sfx('ratchet');
 setTimeout(() => UI().flyCost(cost, document.getElementById('room-' + r.room.id)), 60);
 };
 A.upgrade = (p, el) => {
 const r = DE.Bunker.upgrade(S(), p.id, +p.n);
 if (!r.ok) return fail(r);
 UI().purchased(el, r.cost, '+' + r.levels + ' level' + (r.levels > 1 ? 's' : ''));
 done(); UI().flyCost(r.cost, document.getElementById('room-' + p.id));
 };
 A.demolish = (p) => {
 const room = S().rooms[p.id]; if (!room) return;
 UI().confirmModal('Demolish ' + DE.Data.ROOMS[room.type].name + '?', '<p>Workers are unassigned and you get 50% of the scrap and concrete back.</p>', () => {
 const r = DE.Bunker.demolish(S(), p.id); if (!r.ok) return fail(r);
 UI().ui.selection = null; UI().toast('Demolished. Refund ' + U().costText(r.refund)); done();
 }, 'Demolish');
 };

 /* ---- survivors ---- */
 A.openAssign = (p) => {
 const s = S(); const room = s.rooms[p.id]; if (!room) return;
 const def = DE.Data.ROOMS[room.type];
 const idle = DE.Survivors.idle(s);
 const html = idle.length ? idle.map(sv => `<div class="row"><span>${DE.Icons.prof(sv.profession, 'ico-inline')} ${esc(sv.name)} <small class="muted">${P()[sv.profession].name} Lv${sv.level} · ${Math.round(DE.Survivors.efficiency(sv, def, s._fx) * 100)}%</small></span><button class="btn small primary" data-action="assignTo" data-sid="${sv.id}" data-room="${room.id}">Assign</button></div>`).join('')
 : '<p class="muted">Nobody is idle. Unassign someone or recruit more survivors.</p>';
 UI().modal({ title: 'Assign to ' + DE.Icons.room(def.id, 'ico-inline') + '' + def.name, html, buttons: [{ label: 'Close', action: 'closeModal' }] });
 };
 A.assignTo = (p) => {
 const r = DE.Survivors.assign(S(), p.sid, { kind: 'room', id: p.room }); if (!r.ok) return fail(r);
 const room = S().rooms[p.room]; const def = DE.Data.ROOMS[room.type];
 if (room.workers.length >= def.workers || DE.Survivors.idle(S()).length === 0) UI().closeModal(); else A.openAssign({ id: p.room });
 done();
 };
 A.openAssignSurvivor = (p) => {
 const s = S(); const sv = s.survivors[p.sid]; if (!sv) return;
 const rooms = Object.values(s.rooms).filter(r => r.level > 0 && DE.Data.ROOMS[r.type].workers > r.workers.length).sort((a, b) => a.floor - b.floor || a.slot - b.slot);
 let html = `<div class="row"><span> Guard duty <small class="muted">${U().fmt(DE.Survivors.guardPower(sv, s._fx), 1)} dmg/s</small></span><button class="btn small primary" data-action="assignGuard" data-sid="${sv.id}">Post</button></div>`;
 html += `<div class="row"><span>${DE.Icons.img('dig', 'ico-inline')} Mining crew <small class="muted">${DE.Excavation.miners(s).length}/${DE.Excavation.minerCap(s)} posts · ${Math.round(DE.Excavation.minerSkill(s, sv) * 100)}% as a miner</small></span><button class="btn small" data-action="assignMiner" data-sid="${sv.id}">Dig</button></div>`;
 html += rooms.map(r => { const def = DE.Data.ROOMS[r.type]; const best = def.profession === sv.profession; return `<div class="row"><span>${DE.Icons.room(def.id, 'ico-inline')} ${esc(def.name)} B${r.floor} <small class="muted">${r.workers.length}/${def.workers}${best ? ' ·  matches profession' : ''}</small></span><button class="btn small ${best ? 'primary' : ''}" data-action="assignTo2" data-sid="${sv.id}" data-room="${r.id}">Assign</button></div>`; }).join('');
 if (!rooms.length) html += '<p class="muted">No room has a free work station.</p>';
 UI().modal({ title: 'Assign ' + esc(sv.name), html, buttons: [{ label: 'Close', action: 'closeModal' }] });
 };
 A.assignTo2 = (p) => { const r = DE.Survivors.assign(S(), p.sid, { kind: 'room', id: p.room }); if (!r.ok) return fail(r); UI().closeModal(); done(); };
 A.assignGuard = (p) => { const r = DE.Survivors.assign(S(), p.sid, { kind: 'guard' }); if (!r.ok) return fail(r); UI().closeModal(); done(); };
 A.unassign = (p) => { const r = DE.Survivors.assign(S(), p.sid, null); if (!r.ok) return fail(r); done(); };
 A.assignMiner = (p) => { const r = DE.Survivors.assign(S(), p.sid, { kind: 'dig' }); if (!r.ok) return fail(r); UI().closeModal(); DE.Audio.sfx('done'); done(); };
 /** Fill the free mining posts: idle survivors first (best miners first), then nobody else. */
 A.fillMiners = () => {
 const s = S(); let free = DE.Excavation.minerCap(s) - DE.Excavation.miners(s).length, n = 0;
 const cands = DE.Survivors.idle(s).filter(sv => sv.hp >= 40).sort((a, b) => DE.Excavation.minerSkill(s, b) - DE.Excavation.minerSkill(s, a));
 for (const sv of cands) { if (free <= 0) break; if (DE.Survivors.assign(s, sv.id, { kind: 'dig' }).ok) { free--; n++; } }
 if (!n) return fail({ reason: free <= 0 ? 'Every mining post is taken — upgrade the Mining Station' : 'Nobody is idle — pick miners from the list' });
 UI().toast(n + (n > 1 ? ' miners' : ' miner') + ' sent to the dig site', 'ok', 2400, 'dig', { key: 'fillminers' }); DE.Audio.sfx('done'); done();
 };
 /** Put every idle survivor to work where they do best: matching profession first, then efficiency. */
 A.assignIdle = () => {
 const s = S(), fx = s._fx || DE.Effects.get(s); let n = 0;
 const idle = DE.Survivors.idle(s).filter(sv => sv.hp >= 25).sort((a, b) => b.level - a.level);
 for (const sv of idle) {
   const open = Object.values(s.rooms).filter(r => r.level > 0 && !r.construction && DE.Data.ROOMS[r.type].workers > r.workers.length);
   if (!open.length) break;
   let best = null, score = -1;
   open.forEach(r => { const def = DE.Data.ROOMS[r.type]; const e = DE.Survivors.efficiency(sv, def, fx) + (def.profession === sv.profession ? .5 : 0); if (e > score) { score = e; best = r; } });
   if (best && DE.Survivors.assign(s, sv.id, { kind: 'room', id: best.id }).ok) n++;
 }
 if (!n) return fail({ reason: idle.length ? 'No free work stations — build or upgrade a room' : 'Nobody is idle' });
 UI().toast(n + (n > 1 ? ' survivors' : ' survivor') + ' put to work', 'ok', 2600, 'pop', { key: 'assignidle' }); DE.Audio.sfx('done'); done();
 };
 /** Fill the empty guard posts with idle, healthy survivors — the strongest shots first. */
 A.fillGuards = () => {
 const s = S(), fx = DE.Effects.get(s); let free = fx.guardCap - DE.Survivors.guards(s).length; let n = 0;
 const cands = DE.Survivors.idle(s).filter(sv => sv.hp >= 50).sort((a, b) => DE.Survivors.guardPower(b, fx) - DE.Survivors.guardPower(a, fx));
 for (const sv of cands) { if (free <= 0) break; if (DE.Survivors.assign(s, sv.id, { kind: 'guard' }).ok) { free--; n++; } }
 if (!n) return fail({ reason: free <= 0 ? 'Every guard post is taken' : 'Nobody idle and healthy to post' });
 UI().toast(n + (n > 1 ? ' guards' : ' guard') + ' posted', 'ok', 2400, 'guards', { key: 'fillguards' }); DE.Audio.sfx('done'); done();
 };
 A.toggleGuard = (p) => {
 const sv = S().survivors[p.sid]; if (!sv) return;
 const isGuard = sv.assignment && sv.assignment.kind === 'guard';
 const r = DE.Survivors.assign(S(), p.sid, isGuard ? null : { kind: 'guard' }); if (!r.ok) return fail(r); done();
 };
 A.recruit = (p, el) => {
 // always random: the profession, rarity and traits are rolled by the simulation, then revealed
 const r = DE.Survivors.recruit(S()); if (!r.ok) return fail(r);
 S().log.push({ t: Date.now(), msg: r.survivor.name + ' (' + P()[r.survivor.profession].name + ') joined the bunker.' });
 done(); DE.UI.Reveal.show(r.survivor);
 };
 A.revealAssign = (p) => { UI().closeModal(); A.openAssignSurvivor({ sid: p.sid }); };
 A.setRecruitProfession = () => {};   // recruiting is random now (kept for old bindings)
 A.setFilter = (p) => { UI().ui.survivorFilter = UI().ui.survivorFilter === p.filter && p.filter !== 'all' ? 'all' : p.filter; UI().refresh(true); };
 A.svProf = (p) => { UI().ui.svProf = p.prof || ''; UI().refresh(true); };
 A.svSort = (p, el) => { UI().ui.svSort = p.value; if (el) el.blur(); UI().refresh(true); };
 A.svGroup = (p, el) => { UI().ui.svGroup = p.value; if (el) el.blur(); UI().refresh(true); };
 A.svView = (p) => { UI().ui.svView = p.view; UI().refresh(true); };
 /** Search filters the rows in place (no rebuild, so the keyboard stays up). */
 A.svSearch = (p) => {
 const q = (UI().ui.svSearch = p.value || '').trim().toLowerCase();
 document.querySelectorAll('#drawer-body [data-q]').forEach(el => el.classList.toggle('sv-hide', !!q && !el.dataset.q.includes(q)));
 };
 /** The one-tap job picker on a survivor row. */
 A.assignSel = (p, el) => {
 const v = p.value || '', target = !v ? null : v === 'guard' ? { kind: 'guard' } : v === 'dig' ? { kind: 'dig' } : v.startsWith('r:') ? { kind: 'room', id: v.slice(2) } : null;
 const r = DE.Survivors.assign(S(), p.sid, target); if (el) el.blur();
 if (!r.ok) { fail(r); UI().refresh(true); return; }
 DE.Audio.sfx('click'); done();
 };
 A.svDetail = (p) => { const s = S(), sv = s.survivors[p.sid]; if (!sv) return; UI().modal({ title: esc(sv.name), cls: 'sv-detail', html: DE.UI.Drawers.survivorCard(s, sv), buttons: [{ label: 'Close', action: 'closeModal' }] }); };
 /** Staff one room with the best idle survivors (matching profession first). */
 A.fillRoom = (p) => {
 const s = S(), room = s.rooms[p.room]; if (!room) return; const def = DE.Data.ROOMS[room.type], fx = s._fx || DE.Effects.get(s); let n = 0;
 const cands = DE.Survivors.idle(s).filter(v => v.hp >= 25).sort((a, b) => DE.Survivors.efficiency(b, def, fx) - DE.Survivors.efficiency(a, def, fx));
 for (const sv of cands) { if (room.workers.length >= def.workers) break; if (DE.Survivors.assign(s, sv.id, { kind: 'room', id: room.id }).ok) n++; }
 if (!n) return fail({ reason: cands.length ? 'The room is full' : 'Nobody is idle — move someone with their job picker' });
 UI().toast(n + ' to ' + def.name, 'ok', 2000, DE.Icons.room(def.id), { key: 'fillroom' }); DE.Audio.sfx('done'); done();
 };
 /** Re-deal room jobs (people working in rooms and the idle) so professions land in their rooms:
  *  best matches first, production rooms before support, rooms that were staffed kept staffed.
  *  Guards, miners and expedition teams are left alone. */
 A.optimizeJobs = () => {
 const s = S(), fx = s._fx || DE.Effects.get(s);
 const pool = Object.values(s.survivors).filter(v => (!v.assignment || v.assignment.kind === 'room') && v.hp >= 25);
 const rooms = Object.values(s.rooms).filter(r => r.level > 0 && !r.construction && DE.Data.ROOMS[r.type].workers > 0);
 if (!pool.length || !rooms.length) return fail({ reason: 'Nobody to re-deal' });
 const before = {}; pool.forEach(v => before[v.id] = v.assignment && v.assignment.id || ''); const had = {}; rooms.forEach(r => had[r.id] = r.workers.length);
 const cap = {}; rooms.forEach(r => cap[r.id] = DE.Data.ROOMS[r.type].workers);
 const left = new Set(pool.map(v => v.id)), plan = {};
 const score = (v, r) => { const d = DE.Data.ROOMS[r.type]; return DE.Survivors.efficiency(v, d, fx) + (d.produces ? .3 : 0) + (had[r.id] ? .15 : 0) + (before[v.id] === r.id ? .05 : 0); };
 for (let guard = 0; guard < 500 && left.size; guard++) {
 let best = null, bs = -1;
 left.forEach(id => { const v = s.survivors[id]; rooms.forEach(r => { if (cap[r.id] <= 0) return; const sc = score(v, r); if (sc > bs) { bs = sc; best = [id, r.id]; } }); });
 if (!best) break; plan[best[0]] = best[1]; cap[best[1]]--; left.delete(best[0]);
 }
 let moves = 0; for (const id in before) if ((plan[id] || '') !== before[id]) moves++;
 if (!moves) { UI().toast('Everyone already has their best job', 'ok', 2200, 'check', { key: 'optjobs' }); return; }
 UI().confirmModal('Re-deal ' + moves + ' job' + (moves > 1 ? 's' : '') + '?', '<p>Professions go to the rooms they are trained for, production rooms first. Guards, miners and expedition teams stay where they are.</p>', () => {
 pool.forEach(v => DE.Survivors.assign(s, v.id, null));
 for (const id in plan) DE.Survivors.assign(s, id, { kind: 'room', id: plan[id] });
 UI().closeModal(); UI().toast(moves + ' survivor' + (moves > 1 ? 's' : '') + ' changed jobs', 'ok', 2600, 'pop', { key: 'optjobs' }); DE.Audio.sfx('done'); done();
 }, 'Re-deal');
 };

 /* ---- research ---- */
 A.researchBranch = (p) => { UI().ui.researchBranch = p.branch; UI().refresh(true); };
 A.research = (p) => { const r = DE.Research.start(S(), p.id); if (!r.ok) return fail(r); UI().toast('Researching ' + DE.Data.RESEARCH[p.id].name); done(); };
 A.cancelResearch = () => { DE.Research.cancel(S()); done(); };

 /* ---- excavation ---- */
 A.excavate = (p, el) => {
 const s = S(), d = DE.Excavation.nextDepth(s), cost = DE.Excavation.cost(s, d); const r = DE.Excavation.start(s); if (!r.ok) return fail(r);
 DE.Audio.sfx('dig'); UI().purchased(el, cost, 'Digging B' + d + (DE.Excavation.miners(s).length ? '' : ' — post miners to speed it up')); done();
 };

 /* ---- defense ---- */
 A.wallUpgrade = (p, el) => { const cost = DE.Defense.wallUpgradeCost(S()); const r = DE.Defense.upgradeWall(S()); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Wall reinforced'); done(); };
 A.owUpgrade = (p, el) => {
 const next = DE.Defense.structureNext(S(), p.key); const r = DE.Defense.upgradeStructure(S(), p.key); if (!r.ok) return fail(r);
 UI().purchased(el, r.cost, DE.Data.OVERWORLD[p.key].name + ': ' + next.name);
 const sc = document.getElementById('scene'); if (sc) { sc.classList.remove('just-upgraded'); void sc.offsetWidth; sc.classList.add('just-upgraded'); }
 DE.UI.Bunker.surfaceBurst(p.key); DE.Audio.sfx('complete');
 S().log.push({ t: Date.now(), msg: DE.Data.OVERWORLD[p.key].name + ' upgraded to ' + next.name + '.' });
 done();
 };
 A.wallRepair = () => { const r = DE.Defense.repairWall(S()); if (!r.ok) return fail(r); UI().toast(r.partial ? 'Partial repair (not enough scrap)' : ' Wall repaired', 'ok'); done(); };
 A.upgradeCalibre = (p, el) => { const cost = DE.Defense.calibreCost(S()); const r = DE.Defense.upgradeCalibre(S()); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Turret calibre ' + r.level); done(); };
 A.buyTurret = (p, el) => { const cost = DE.Defense.turretCost(S()); const r = DE.Defense.buyTurret(S()); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Turret installed'); done(); };
 A.buyTraps = (p) => { const r = DE.Defense.buyTraps(S(), +p.n); if (!r.ok) return fail(r); done(); };

 /* ---- expeditions ---- */
 A.expLocation = (p) => { UI().ui.expedition.location = p.id; UI().refresh(true); };
 A.expToggle = (p) => {
 const ex = UI().ui.expedition; const i = ex.members.indexOf(p.sid);
 const cap = DE.Events.bus(S()).capacity; if (i >= 0) ex.members.splice(i, 1); else if (ex.members.length < cap) ex.members.push(p.sid); else return UI().toast('The vehicle seats ' + cap, 'err');
 UI().refresh(true);
 };
 /** Fill the free seats: healthy idle survivors first (guards last), trip specialists first, one medic. */
 A.expAuto = () => {
 const s = S(), ex = UI().ui.expedition, cap = DE.Events.bus(s).capacity;
 const busy = (sv) => !sv.assignment ? 0 : sv.assignment.kind === 'room' ? 1 : 2;
 const rank = { scavenger: 4, scout: 3, hunter: 3, medic: 2 };
 const pool = DE.Survivors.available(s).filter(sv => sv.hp >= 50 && !ex.members.includes(sv.id))
   .sort((a, b) => busy(a) - busy(b) || (rank[b.profession] || 0) - (rank[a.profession] || 0) || b.level - a.level);
 let n = 0, medic = ex.members.some(id => s.survivors[id] && s.survivors[id].profession === 'medic');
 for (const sv of pool) { if (ex.members.length >= cap) break; if (sv.profession === 'medic') { if (medic) continue; medic = true; } ex.members.push(sv.id); n++; }
 if (!n) return fail({ reason: ex.members.length >= cap ? 'Every seat is taken' : 'Nobody healthy is free' });
 DE.Audio.sfx('click'); UI().refresh(true);
 };
 A.expSend = () => {
 const ex = UI().ui.expedition; const r = DE.Expeditions.send(S(), ex.location, ex.members); if (!r.ok) return fail(r);
 UI().toast('Team sent to ' + DE.Expeditions.location(ex.location).name, 'ok'); ex.members = []; done();
 };

 /* ---- prestige ---- */
 A.prestige = () => {
 const c = DE.Prestige.canReset(S()); if (!c.ok) return fail(c);
 UI().confirmModal(' Reconstruct the bunker?', `<p>You will earn <b class="gold">+${c.gain} Legacy Points</b>.</p><p><b>Kept:</b> Legacy Points & upgrades, lifetime stats, settings.<br><b>Lost:</b> all rooms, floors, survivors, research, resources and defenses.</p>`, () => {
 const r = DE.Prestige.reset(S()); if (!r.ok) return fail(r);
 DE.Game.replaceState(r.state); UI().ui.selection = null; UI().closeDrawer();
 UI().toast('Reconstruction complete. +' + r.gain + ' Legacy Points!', 'ok', 5000); UI().openDrawer('legacy');
 }, 'Reconstruct');
 };
 A.buyLegacy = (p) => { const r = DE.Prestige.buy(S(), p.id); if (!r.ok) return fail(r); done(); };

 /* ---- settings / saves ---- */
 A.saveNow = () => { DE.Game.save(); UI().toast('Saved', 'ok'); UI().renderDrawer(true); };
 A.exportSave = () => { const ta = document.getElementById('export-area'); if (ta) { ta.value = DE.Save.exportString(S()); ta.select(); } };
 A.copyExport = () => {
 const str = DE.Save.exportString(S()); const ta = document.getElementById('export-area'); if (ta) ta.value = str;
 if (navigator.clipboard) navigator.clipboard.writeText(str).then(() => UI().toast('Copied to clipboard', 'ok'), () => UI().toast('Copy failed — select the text manually', 'err'));
 };
 A.importSave = () => {
 const ta = document.getElementById('import-area'); const r = DE.Save.importString(ta ? ta.value : '');
 if (!r.ok) return UI().toast('Import failed: ' + r.error, 'err', 5000);
 UI().closeModal(); UI().closeDrawer();
 DE.Game.loadState(r.state); UI().toast('Save imported', 'ok');
 };
 A.toggleMusic = () => { DE.Audio.set('musicOn', !DE.Audio.prefs().musicOn); UI().renderDrawer(true); };
 A.toggleSfx = () => { DE.Audio.set('sfxOn', !DE.Audio.prefs().sfxOn); DE.Audio.sfx('click'); UI().renderDrawer(true); };
 A.toggleAnimations = () => { S().settings.animations = !S().settings.animations; document.body.classList.toggle('no-anim', !S().settings.animations); UI().renderDrawer(true); };
 A.hardReset = () => UI().confirmModal('Delete everything?', '<p>This deletes your save, including Legacy Points. There is no undo.</p>', () => { DE.Save.clear(); DE.Game.newGame(); }, 'Delete save');
 A.toMenu = () => { DE.Game.save(); DE.Game.stop(); UI().closeDrawer(); UI().showScreen('menu'); };

 return A;
})();
