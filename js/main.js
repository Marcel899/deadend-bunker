/* Game bootstrap and main loop: ticking, autosave, offline catch-up, event notifications. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Game = (function () {
 const C = () => DE.CONFIG;
 const U = () => DE.Util;
 const esc = (s) => DE.Util.escapeHtml(s);
 const G = { state: null, _timer: null, _lastAutosave: 0 };

 G.init = function () {
 DE.UI.init();
 DE.UI.showScreen('menu');
 // optional image assets: when any exist, re-render with them
 DE.Assets.load(() => { if (DE.Assets.count() > 0) { DE.UI.renderResbar(); if (G.state) { G.state._dirtyBunker = true; DE.UI.refresh(true); } } });
 window.addEventListener('beforeunload', () => G.save());
 document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); });
 };

 G.newGame = function () {
 const start = () => {
   DE.UI.ui.selection = null;
   G.loadState(DE.State.create(null, Date.now()));
   DE.UI.toast('Welcome to the Dead End. Assign survivors, keep the lights on, and dig.', 'ok', 6000);
 };
 // the very first bunker starts with the intro (skippable; it does not play by itself again)
 if (DE.UI.Intro && !DE.UI.Intro.seen()) DE.UI.Intro.play(start); else start();
 };

 G.continueGame = function () {
 const s = DE.Save.load();
 if (!s) { DE.UI.toast('No valid save found', 'err'); return; }
 const summary = DE.Offline.process(s, Date.now());
 G.loadState(s);
 if (summary) G.showOffline(summary);
 };

 /** Replace the active state with `s` and (re)start the loop. */
 G.loadState = function (s) {
 G.stop();
 // a different bunker: nobody of the old one is still walking about or riding the lift
 if (G.state !== s) { if (DE.UI.Actors) DE.UI.Actors.reset(); if (DE.UI.Elevator) DE.UI.Elevator.reset(); }
 G.state = s;
 s._fx = DE.Effects.compute(s);
 s._rates = DE.Economy.computeRates(s, s._fx);
 if (DE.UI.Settings) DE.UI.Settings.adoptSave(s); else document.body.classList.toggle('no-anim', !s.settings.animations);
 DE.UI.showScreen('game');
 DE.UI.refresh(true);
 G.save();
 G.start();
 };
 G.replaceState = function (s) { G.loadState(s); };

 G.start = function () {
 if (G._timer) return;
 G._lastAutosave = Date.now();
 G._timer = setInterval(G.loop, C().TICK_MS);
 };
 G.stop = function () { if (G._timer) { clearInterval(G._timer); G._timer = null; } };

 G.loop = function () {
 const s = G.state; if (!s) return;
 const now = Date.now();
 const dt = (now - s.lastTick) / 1000;
 if (dt >= C().OFFLINE_MIN_SEC) {
 // tab was asleep / machine suspended: run the offline catch-up
 const summary = DE.Offline.process(s, now);
 if (summary && summary.elapsed > 120) G.showOffline(summary);
 else if (summary) G.handleEvents(summary.events);
 } else if (dt > 0) {
 DE.Sim.tick(s, dt, now);
 G.handleEvents(DE.Sim.takeEvents(s));
 }
 DE.UI.refresh();
 // heads-up once per wave when the horde shows up on the surface; an alarm when the forecast is bad
 const lead = (s.defense.nextWaveAt - now) / 1000;
 if (lead > 0 && lead <= DE.Defense.warningSec(s) && G._warnedWave !== s.defense.wave) {
 G._warnedWave = s.defense.wave;
 const hp = DE.Defense.waveHp(s), pw = DE.Defense.defensePower(s).total, risk = pw + s.defense.wall.hp < hp ? 2 : pw < hp ? 1 : 0;
 DE.UI.toast('<b>Wave ' + s.defense.wave + '</b> is on its way — ' + ['your defense should hold', 'the wall will take hits', 'they will break in, reinforce now!'][risk], ['info', 'warn', 'err'][risk], 5200, 'wave', { key: 'wavewarn' });
 if (risk) DE.Audio.sfx('alarm');
 }
 // decisions pop up only at a quiet moment (no drawer, no recent input, no fight, not too soon after
 // the last one, not while snoozed); until then they wait in the pill on the surface
 if (s.events && s.events.length && document.getElementById('modal-root').classList.contains('hidden') && now >= (G._evSnoozeUntil || 0) && (!DE.UI.Settings || DE.UI.Settings.get('autoEvents')) && DE.UI.eventQuiet(now)) { if (!G._evShownAt || now - G._evShownAt > 1500) { G._evShownAt = now; DE.UI.eventModal(s.events[0]); } }
 if (s.settings.autosave && now - G._lastAutosave > C().AUTOSAVE_SEC * 1000) { G.save(); G._lastAutosave = now; }
 };

 G.afterAction = function () {
 const s = G.state; if (!s) return;
 s._fx = DE.Effects.compute(s);
 s._rates = DE.Economy.computeRates(s, s._fx);
 DE.UI.refresh(true);
 };

 G.save = function () { if (G.state) DE.Save.save(G.state); };

 /* ---- events from the simulation → notifications ---- */
 G.handleEvents = function (events) {
 const s = G.state; if (!events || !events.length) return;
 events.forEach(e => {
 switch (e.type) {
 case 'built': { const d = DE.Data.ROOMS[e.room.type]; DE.UI.toast('<b>' + d.name + '</b> built on B' + e.room.floor, 'ok', 3200, DE.Icons.room(d.id)); log(d.name + ' built on B' + e.room.floor + '.'); DE.UI.refresh(); DE.UI.Bunker.flashRoom(e.room.id, 'just-built', d.name.toUpperCase() + ' READY!'); DE.Audio.sfx('complete'); break; }
 case 'upgraded': { const d = DE.Data.ROOMS[e.room.type], was = e.room.level - (e.levels || 1), Sc = DE.Scenes; const big = Sc.gradeOf(was) !== Sc.gradeOf(e.room.level) || Sc.tierOf(was) !== Sc.tierOf(e.room.level);
 DE.UI.toast('<b>' + d.name + '</b> upgraded to level ' + e.room.level + (big ? ' — new look!' : ''), 'ok', 3200, DE.Icons.room(d.id), { key: 'up:' + e.room.id }); DE.UI.refresh(); DE.UI.Bunker.flashRoom(e.room.id, 'just-upgraded', (big ? 'NEW LOOK · ' : '') + 'LEVEL ' + e.room.level, big); DE.Audio.sfx(big ? 'complete' : 'levelup'); break; }
 // infection: nobody notices a fresh bite; symptoms, a screening, getting worse, a cure and the worst case do
 case 'symptoms': DE.UI.toast('<b>' + DE.UI.esc(e.name) + '</b> is showing symptoms of the infection — isolate them before it spreads.', 'warn', 6000, 'biohazard', { key: 'inf:' + e.id }); log(e.name + ' shows symptoms of the infection.'); DE.Audio.sfx('error'); DE.UI.refresh(); break;
 case 'detected': DE.UI.toast('Medical screening: <b>' + DE.UI.esc(e.name) + '</b> carries the infection. Isolate them early.', 'warn', 5500, 'biohazard', { key: 'inf:' + e.id }); log('Screening found the infection in ' + e.name + '.'); DE.UI.refresh(); break;
 case 'worse': DE.UI.toast('<b>' + DE.UI.esc(e.name) + '</b> is getting worse (' + e.stage.toLowerCase() + ').', e.stage === 'Turning' ? 'err' : 'warn', 5000, 'biohazard', { key: 'inf:' + e.id }); break;
 case 'cured': DE.UI.toast('<b>' + DE.UI.esc(e.name) + '</b> has recovered and is back on their feet.', 'ok', 4500, 'medkit'); log(e.name + ' recovered from the infection.'); DE.Audio.sfx('done'); DE.UI.refresh(); break;
 case 'turned': DE.UI.toast('<b>' + DE.UI.esc(e.name) + '</b> turned. The others had to put them down.', 'err', 7000, 'skull'); log(e.name + ' was lost to the infection.'); DE.Audio.sfx('bigdie'); DE.UI.refresh(); break;
 case 'infected': case 'spread': break;
 case 'expanded': DE.UI.toast('B' + e.depth + ' widened: ' + DE.CONFIG.WING_CELLS + ' new cells', 'ok', 3400, 'dig'); log('Floor B' + e.depth + ' widened.'); DE.UI.refresh(); break;
      case 'research': {
        DE.UI.toast('Research complete: <b>' + esc(e.node.name) + '</b>', 'ok', 4500, 'research'); log('Researched ' + e.node.name + '.');
        // rooms this research opens up get a moment in the spotlight
        const keys = (e.node.effects || []).filter(f => f.type === 'unlockRoom').map(f => f.room);
        const rooms = Object.values(DE.Data.ROOMS).filter(d => keys.includes(d.id) || (d.unlock && keys.includes(d.unlock) && d.unlock.startsWith('blueprints'))).map(d => d.id);
        if (rooms.length) DE.UI.unlockBanner(rooms, 'New rooms to build');
        break;
      }
 case 'excavated':
 log('Floor B' + e.depth + ' excavated' + (e.facility ? ' — discovered ' + e.facility.name + '!' : '.'));
 DE.UI.refresh(); DE.UI.Bunker.revealFloor(e.depth);
 if (e.facility) DE.UI.modal({ title: DE.Icons.img('facility', 'ico-inline') + ' Discovery: ' + esc(e.facility.name), cls: 'discovery', html: `<p class="lore">${esc(e.facility.lore)}</p><p>Floor B${e.depth} now contains a unique room: <b>${DE.Icons.room(e.facility.room, 'ico-inline')} ${esc(DE.Data.ROOMS[e.facility.room].name)}</b> — ${esc(DE.Data.ROOMS[e.facility.room].desc)}</p>` });
 else DE.UI.toast('Floor <b>B' + e.depth + '</b> is ready to build on', 'ok', 4000, 'floors');
 if (e.spoils && Object.values(e.spoils).some(v => v > 0)) { DE.UI.toast('Rubble from the ' + esc(e.layer || 'rock') + ': ' + U().costText(e.spoils), 'ok', 4500, 'dig'); DE.UI.Bunker.collectAt('#dig-site', e.spoils); }
 if (e.find) { const f = e.find; const what = f.loot ? ' ' + U().costText(f.loot) : ''; DE.UI.toast(esc(f.text) + what, 'ok', 5500, f.kind === 'survivor' ? 'pop' : f.kind === 'notes' ? 'research' : f.kind === 'tech' ? 'mat.' + f.mat : 'chest'); log('Digging B' + e.depth + ': ' + f.text); }
 break;
 case 'wave': {
 const r = e.result; DE.UI.Bunker.playWave(r);
 if (r.raid && !r.breach && (r.ammo || r.weapon)) setTimeout(() => DE.UI.toast('Off the raiders: ' + (r.ammo ? '+' + r.ammo + ' rounds' : '') + (r.weapon ? (r.ammo ? ', ' : '') + 'a ' + esc(r.weapon.toLowerCase()) + ' for the Armory' : ''), 'ok', 5000, 'shield'), 900);
 const loot = r.reward && Object.keys(r.reward).length ? ' Salvaged ' + U().costText(r.reward) + '.' : '';
 if (loot) setTimeout(() => DE.UI.Bunker.collectAt('#wall', r.reward), 1200);
 if (r.refugee) { DE.UI.toast('<b>' + esc(r.refugee) + '</b> saw you hold the gate and joined', 'ok', 5000, 'pop'); log(r.refugee + ' joined after wave ' + r.wave + '.'); }
 // bites in the fight: who is infected is not known yet (a medic on duty screens for it)
 if (r.infected) setTimeout(() => DE.UI.toast('Some of the wounded were bitten. Watch for symptoms' + (DE.Infection.hasWard(DE.Game.state) ? '' : ' — a Medical Bay or Quarantine Ward can screen and treat') + '.', 'warn', 6000, 'biohazard', { key: 'bites' }), 1800);
 if (r.outcome === 'victory') { DE.UI.toast('<b>' + (r.boss ? 'BOSS wave ' : r.raid ? 'Raid ' : 'Wave ') + r.wave + (r.raid ? ' driven off' : ' repelled') + '</b>' + (r.streak > 1 ? ' · ' + r.streak + ' in a row' : '') + (r.reward && Object.keys(r.reward).length ? ' · ' + U().costText(r.reward) : ''), 'ok', 4500, 'trophy'); log('Wave ' + r.wave + ' repelled.'); }
 else if (r.outcome === 'held') { DE.UI.toast('<b>' + (r.raid ? 'Raid ' : 'Wave ') + r.wave + ' held</b> · wall −' + U().fmt(r.wallDamage) + (r.injured.length ? ' · ' + r.injured.length + ' injured' : '') + (r.reward && Object.keys(r.reward).length ? ' · ' + U().costText(r.reward) : ''), 'warn', 5000, 'wallicon'); log('Wave ' + r.wave + ': wall damaged (−' + r.wallDamage + ').'); }
 else {
 log('Wave ' + r.wave + ': BREACH! Resources lost.');
 DE.UI.modal({ title: (r.raid ? 'Raid ' : 'Wave ') + r.wave + ' — BREACH', cls: 'breach', html: `<p>${r.raid ? 'The raiders got through the gate and loaded up their trucks.' : 'The horde broke through the wall.'}</p><p><b>Lost:</b> ${Object.keys(r.losses).map(k => DE.Icons.res(k, 'ico-inline') + '' + U().fmt(r.losses[k])).join(', ')}</p>${r.injured.length ? `<p><b>Injured:</b> ${r.injured.map(esc).join(', ')}</p>` : ''}<p class="muted">Repair the wall, post guards and consider turrets. Morale takes a hit for a while.</p>`, buttons: [{ label: 'To Defense', action: 'openDrawer', params: { drawer: 'defense' }, cls: 'primary' }, { label: 'Close', action: 'closeModal' }] });
 }
 break;
 }
 case 'expedition': {
 const r = e.result; const loc = DE.Expeditions.location(r.location);
 DE.UI.toast('<b>Team back from ' + esc(loc.name) + '</b>' + (Object.keys(r.loot).length ? ' · ' + U().costText(r.loot) : '') + (r.rescued ? ' · rescued ' + esc(r.rescued) : '') + (r.injured.length ? ' · ' + r.injured.length + ' injured' : '') + ((r.finds || []).length ? ' · found: ' + esc(r.finds[0].split(' — ')[0]) : ''), 'ok', 5000, 'vehicle');
 log('Expedition to ' + loc.name + ' returned.' + (r.rescued ? ' Rescued ' + r.rescued + '.' : ''));
 DE.UI.Bunker.collectAt('.hatch', r.loot);
 if (r.mats && Object.keys(r.mats).length) DE.UI.toast('Rare materials: ' + Object.keys(r.mats).map(m => DE.Icons.mat(m) + '+' + r.mats[m] + ' ' + DE.Data.MATERIALS[m].short).join(' '), 'ok', 4200, 'artifacts');
 if ((r.collected && r.collected.length) || (r.blueprints && r.blueprints.length)) G.showFinds(r.collected || [], r.sets || [], r.blueprints || [], loc.name);
 break;
 }
 case 'collected': { G.showFinds(e.ids || [], e.sets || [], [], ''); break;
 }
 case 'goal': DE.UI.toast('Objective complete: <b>' + esc(e.goal.name) + '</b> · ' + U().costText(e.goal.reward), 'ok', 4500, 'star'); DE.UI.Bunker.collectAt('#chip-pop', e.goal.reward); break;
 case 'friends': DE.UI.toast('<b>' + esc(e.a) + '</b> and <b>' + esc(e.b) + '</b> are friends now — they work better together', 'info', 4000, 'pop'); break;
 case 'radio': DE.UI.toast('<b>' + esc(e.survivor.name) + '</b> heard the broadcast and joined', 'ok', 4500, 'pop'); log(e.survivor.name + ' answered the radio and joined.'); break;
 default: break;
 }
 });
 function log(msg) { s.log.push({ t: Date.now(), msg }); if (s.log.length > 60) s.log.shift(); }
 };

 G.showOffline = function (sum) {
 const R = DE.Data.RESOURCES;
 const rows = DE.Data.RESOURCE_ORDER.filter(r => Math.abs(sum.gains[r]) >= 1).map(r => `<div class="row"><span>${DE.Icons.res(r, 'ico-inline')} ${R[r].name}</span><b class="${sum.gains[r] >= 0 ? 'pos' : 'neg'}">${sum.gains[r] >= 0 ? '+' : ''}${U().fmt(sum.gains[r])}</b></div>`).join('');
 const built = sum.events.filter(e => e.type === 'built' || e.type === 'upgraded').length;
 const research = sum.events.filter(e => e.type === 'research').map(e => e.node.name);
 const dug = sum.events.filter(e => e.type === 'excavated').length;
 const exp = sum.events.filter(e => e.type === 'expedition').length;
 DE.UI.modal({ title: 'While you were away', cls: 'offline', html: `<p class="muted">Gone ${U().fmtTime(sum.elapsed)} · simulated ${U().fmtTime(sum.simulated)}${sum.capped ? ` <b class="warn">(capped at ${sum.capHours}h — extend it with research & legacy)</b>` : ''}</p>
 ${rows || '<p class="muted">Resources barely changed.</p>'}
 <div class="row"><span> Waves</span><b>${sum.waves} survived${sum.breaches ? ', <span class="neg">' + sum.breaches + ' breach</span>' : ''} · ${sum.kills} killed</b></div>
 ${built ? `<div class="row"><span> Constructions finished</span><b>${built}</b></div>` : ''}
 ${research.length ? `<div class="row"><span> Research done</span><b>${research.map(esc).join(', ')}</b></div>` : ''}
 ${dug ? `<div class="row"><span> Floors excavated</span><b>${dug}</b></div>` : ''}
 ${exp ? `<div class="row"><span> Expeditions returned</span><b>${exp}</b></div>` : ''}
 ${sum.newSurvivors > 0 ? `<div class="row"><span> New survivors</span><b>${sum.newSurvivors}</b></div>` : ''}`,
 buttons: [{ label: 'Back to work', action: 'closeModal', cls: 'primary' }] });
 // facilities discovered offline deserve their own note
 sum.events.filter(e => e.type === 'excavated' && e.facility).forEach(e => DE.UI.toast('Discovered <b>' + esc(e.facility.name) + '</b> on B' + e.depth, 'ok', 6000, 'facility'));
 };

 return G;
})();

/** A team brought home something unique: show it off (collectibles, finished sets, blueprints). */
DE.Game.showFinds = function (ids, sets, bps, where) {
  const esc = (x) => DE.Util.escapeHtml(x), X = DE.Expeditions, s = DE.Game.state; if (!s) return;
  const items = ids.map(id => DE.Data.COLLECTIBLES[id]).filter(Boolean), rooms = bps.map(id => DE.Data.ROOMS[id]).filter(Boolean);
  let html = '<div class="fd-list">';
  items.forEach(c => { const st = DE.Data.COLLECTIONS[c.set]; html += `<div class="fd-item"><span class="fd-art"><img src="assets/sprites/${c.sprite}.png" alt=""></span><div><b>${esc(c.name)}</b><small>${esc(c.desc)}</small><em>${esc(st.name)} · ${X.setCount(s, c.set)}/${X.setSize(c.set)}</em></div></div>`; });
  rooms.forEach(d => { html += `<div class="fd-item bp"><span class="fd-art">${DE.Icons.room(d.id, 'fd-room')}</span><div><b>Blueprint: ${esc(d.name)}</b><small>${esc(d.desc)}</small><em>Build it from any free cell · needs ${DE.Icons.rare(d.rare)}</em></div></div>`; });
  sets.map(k => DE.Data.COLLECTIONS[k]).filter(Boolean).forEach(st => { html += `<div class="fd-set">${DE.Icons.img('trophy', 'ico-inline')} <b>${esc(st.name)}</b> complete — ${esc(st.bonusText)}, for good.</div>`; });
  html += '</div>';
  DE.Audio.sfx('done');
  DE.UI.modal({ title: (where ? esc(where) + ': ' : '') + (rooms.length ? 'Blueprint recovered!' : 'A rare find!'), icon: rooms.length ? 'scroll' : 'artifacts', cls: 'finds', html, buttons: [{ label: 'Wonderful', action: 'closeModal', cls: 'primary' }] });
};
document.addEventListener('DOMContentLoaded', () => DE.Game.init());
