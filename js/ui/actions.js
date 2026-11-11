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
 const fail = (res) => { UI().toast(res && res.reason ? res.reason : 'Cannot do that', 'err'); };

 const A = {};
 A.noop = () => {};
 A.closeModal = () => UI().closeModal();
 A.confirmYes = () => { const cb = UI()._confirmCb; UI()._confirmCb = null; UI().closeModal(); if (cb) cb(); };

 /* ---- menu ---- */
 A.continueGame = () => DE.Game.continueGame();
 A.newGame = () => {
 if (DE.Save.hasSave()) UI().confirmModal('Start a new bunker?', '<p>Your existing save will be <b>deleted</b>. Export it first from the in-game menu if you want to keep it.</p>', () => DE.Game.newGame(), 'Delete & start new');
 else DE.Game.newGame();
 };
 A.menuImport = () => {
 UI().modal({ title: ' Import save', html: '<p class="muted">Paste an exported save string. It is validated and never executed.</p><textarea id="import-area" class="save-area" placeholder="DEU1:..."></textarea>',
 buttons: [{ label: 'Import', action: 'importSave', cls: 'primary' }, { label: 'Cancel', action: 'closeModal' }] });
 };

 /* ---- navigation ---- */
 A.openDrawer = (p) => UI().openDrawer(p.drawer);
 A.closeDrawer = () => UI().closeDrawer();
 A.selectRoom = (p) => { UI().ui.selection = { type: 'room', id: p.id }; UI().closeDrawer(); UI().refresh(true); };
 A.selectSlot = (p) => { UI().ui.selection = { type: 'slot', depth: +p.depth, slot: +p.slot }; UI().closeDrawer(); UI().refresh(true); };
 A.selectSurvivor = (p) => { UI().ui.survivorFilter = 'all'; UI().ui.focusSurvivor = p.sid; UI().openDrawer('survivors'); };
 A.selectNone = () => { UI().ui.selection = null; UI().refresh(true); };
 A.scrollFloor = (p) => { UI().closeDrawer(); DE.UI.Bunker.scrollToFloor(+p.depth); };
 A.setBuyMode = (p) => { UI().ui.buyMode = p.mode === 'max' ? 'max' : +p.mode; UI().refresh(true); };

 /* ---- bunker ---- */
 A.build = (p, el) => {
 const cost = DE.Bunker.buildCost(S(), p.type);
 const r = DE.Bunker.build(S(), p.type, +p.depth, +p.slot);
 if (!r.ok) return fail(r);
 UI().purchased(el, cost, 'Building ' + DE.Data.ROOMS[p.type].name);
 UI().ui.selection = { type: 'room', id: r.room.id };
 done();
 };
 A.upgrade = (p, el) => {
 const r = DE.Bunker.upgrade(S(), p.id, +p.n);
 if (!r.ok) return fail(r);
 UI().purchased(el, r.cost, '+' + r.levels + ' level' + (r.levels > 1 ? 's' : ''));
 done();
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
 html += rooms.map(r => { const def = DE.Data.ROOMS[r.type]; const best = def.profession === sv.profession; return `<div class="row"><span>${DE.Icons.room(def.id, 'ico-inline')} ${esc(def.name)} B${r.floor} <small class="muted">${r.workers.length}/${def.workers}${best ? ' ·  matches profession' : ''}</small></span><button class="btn small ${best ? 'primary' : ''}" data-action="assignTo2" data-sid="${sv.id}" data-room="${r.id}">Assign</button></div>`; }).join('');
 if (!rooms.length) html += '<p class="muted">No room has a free work station.</p>';
 UI().modal({ title: 'Assign ' + esc(sv.name), html, buttons: [{ label: 'Close', action: 'closeModal' }] });
 };
 A.assignTo2 = (p) => { const r = DE.Survivors.assign(S(), p.sid, { kind: 'room', id: p.room }); if (!r.ok) return fail(r); UI().closeModal(); done(); };
 A.assignGuard = (p) => { const r = DE.Survivors.assign(S(), p.sid, { kind: 'guard' }); if (!r.ok) return fail(r); UI().closeModal(); done(); };
 A.unassign = (p) => { const r = DE.Survivors.assign(S(), p.sid, null); if (!r.ok) return fail(r); done(); };
 A.toggleGuard = (p) => {
 const sv = S().survivors[p.sid]; if (!sv) return;
 const isGuard = sv.assignment && sv.assignment.kind === 'guard';
 const r = DE.Survivors.assign(S(), p.sid, isGuard ? null : { kind: 'guard' }); if (!r.ok) return fail(r); done();
 };
 A.recruit = (p, el) => {
 const r = DE.Survivors.recruit(S(), UI().ui.recruitProfession || undefined); if (!r.ok) return fail(r);
 UI().toast('' + esc(r.survivor.name) + ' the ' + P()[r.survivor.profession].name + ' joined the bunker', 'ok');
 S().log.push({ t: Date.now(), msg: r.survivor.name + ' (' + P()[r.survivor.profession].name + ') was recruited.' });
 done();
 };
 A.setRecruitProfession = (p) => { UI().ui.recruitProfession = p.prof || null; UI().refresh(true); };
 A.setFilter = (p) => { UI().ui.survivorFilter = p.filter; UI().refresh(true); };

 /* ---- research ---- */
 A.researchBranch = (p) => { UI().ui.researchBranch = p.branch; UI().refresh(true); };
 A.research = (p) => { const r = DE.Research.start(S(), p.id); if (!r.ok) return fail(r); UI().toast(' Researching ' + DE.Data.RESEARCH[p.id].name); done(); };
 A.cancelResearch = () => { DE.Research.cancel(S()); done(); };

 /* ---- excavation ---- */
 A.excavate = () => { const r = DE.Excavation.start(S()); if (!r.ok) return fail(r); UI().toast(' Excavation started'); done(); };

 /* ---- defense ---- */
 A.wallUpgrade = (p, el) => { const cost = DE.Defense.wallUpgradeCost(S()); const r = DE.Defense.upgradeWall(S()); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Wall reinforced'); done(); };
 A.owUpgrade = (p, el) => {
 const next = DE.Defense.structureNext(S(), p.key); const r = DE.Defense.upgradeStructure(S(), p.key); if (!r.ok) return fail(r);
 UI().purchased(el, r.cost, DE.Data.OVERWORLD[p.key].name + ': ' + next.name);
 const sc = document.getElementById('scene'); if (sc) { sc.classList.remove('just-upgraded'); void sc.offsetWidth; sc.classList.add('just-upgraded'); }
 S().log.push({ t: Date.now(), msg: DE.Data.OVERWORLD[p.key].name + ' upgraded to ' + next.name + '.' });
 done();
 };
 A.wallRepair = () => { const r = DE.Defense.repairWall(S()); if (!r.ok) return fail(r); UI().toast(r.partial ? 'Partial repair (not enough scrap)' : ' Wall repaired', 'ok'); done(); };
 A.buyTurret = (p, el) => { const cost = DE.Defense.turretCost(S()); const r = DE.Defense.buyTurret(S()); if (!r.ok) return fail(r); UI().purchased(el, cost, 'Turret installed'); done(); };
 A.buyTraps = (p) => { const r = DE.Defense.buyTraps(S(), +p.n); if (!r.ok) return fail(r); done(); };

 /* ---- expeditions ---- */
 A.expLocation = (p) => { UI().ui.expedition.location = p.id; UI().refresh(true); };
 A.expToggle = (p) => {
 const ex = UI().ui.expedition; const i = ex.members.indexOf(p.sid);
 if (i >= 0) ex.members.splice(i, 1); else if (ex.members.length < 3) ex.members.push(p.sid); else return UI().toast('Max 3 per team', 'err');
 UI().refresh(true);
 };
 A.expSend = () => {
 const ex = UI().ui.expedition; const r = DE.Expeditions.send(S(), ex.location, ex.members); if (!r.ok) return fail(r);
 UI().toast(' Team sent to ' + DE.Expeditions.location(ex.location).name, 'ok'); ex.members = []; done();
 };

 /* ---- prestige ---- */
 A.prestige = () => {
 const c = DE.Prestige.canReset(S()); if (!c.ok) return fail(c);
 UI().confirmModal(' Reconstruct the bunker?', `<p>You will earn <b class="gold">+${c.gain} Legacy Points</b>.</p><p><b>Kept:</b> Legacy Points & upgrades, lifetime stats, settings.<br><b>Lost:</b> all rooms, floors, survivors, research, resources and defenses.</p>`, () => {
 const r = DE.Prestige.reset(S()); if (!r.ok) return fail(r);
 DE.Game.replaceState(r.state); UI().ui.selection = null; UI().closeDrawer();
 UI().toast(' Reconstruction complete. +' + r.gain + ' Legacy Points!', 'ok', 5000); UI().openDrawer('legacy');
 }, 'Reconstruct');
 };
 A.buyLegacy = (p) => { const r = DE.Prestige.buy(S(), p.id); if (!r.ok) return fail(r); done(); };

 /* ---- settings / saves ---- */
 A.saveNow = () => { DE.Game.save(); UI().toast(' Saved', 'ok'); UI().renderDrawer(true); };
 A.exportSave = () => { const ta = document.getElementById('export-area'); if (ta) { ta.value = DE.Save.exportString(S()); ta.select(); } };
 A.copyExport = () => {
 const str = DE.Save.exportString(S()); const ta = document.getElementById('export-area'); if (ta) ta.value = str;
 if (navigator.clipboard) navigator.clipboard.writeText(str).then(() => UI().toast(' Copied to clipboard', 'ok'), () => UI().toast('Copy failed — select the text manually', 'err'));
 };
 A.importSave = () => {
 const ta = document.getElementById('import-area'); const r = DE.Save.importString(ta ? ta.value : '');
 if (!r.ok) return UI().toast('Import failed: ' + r.error, 'err', 5000);
 UI().closeModal(); UI().closeDrawer();
 DE.Game.loadState(r.state); UI().toast(' Save imported', 'ok');
 };
 A.toggleAnimations = () => { S().settings.animations = !S().settings.animations; document.body.classList.toggle('no-anim', !S().settings.animations); UI().renderDrawer(true); };
 A.hardReset = () => UI().confirmModal('Delete everything?', '<p>This deletes your save, including Legacy Points. There is no undo.</p>', () => { DE.Save.clear(); DE.Game.newGame(); }, 'Delete save');
 A.toMenu = () => { DE.Game.save(); DE.Game.stop(); UI().closeDrawer(); UI().showScreen('menu'); };

 return A;
})();
