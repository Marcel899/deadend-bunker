/* Headless logic tests. Run: node tests/test.js
 * Loads the game's data + core scripts into this process (no DOM needed). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const FILES = [
  'js/data/config.js', 'js/data/resources.js', 'js/data/rooms.js', 'js/data/research.js', 'js/data/survivors.js', 'js/data/world.js', 'js/data/overworld.js', 'js/data/events.js', 'js/data/sprites.js', 'js/data/scenes.js', 'js/data/icons.js',
  'js/core/util.js', 'js/core/season.js', 'js/core/effects.js', 'js/core/state.js', 'js/core/save.js', 'js/core/economy.js', 'js/core/bunker.js',
  'js/core/survivors.js', 'js/core/events.js', 'js/core/needs.js', 'js/core/research.js', 'js/core/excavation.js', 'js/core/defense.js', 'js/core/expeditions.js',
  'js/core/prestige.js', 'js/core/sim.js', 'js/core/offline.js',
];
// minimal localStorage shim
const store = {};
globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
FILES.forEach(f => vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f }));
const DE = globalThis.DE;

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { fail++; console.log('  ✗ ' + name + '\n      ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n      ')); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const approx = (a, b, eps, m) => assert(Math.abs(a - b) <= (eps || 1e-6), (m || '') + ' expected ' + b + ' got ' + a);

function run(state, seconds, now, step) {
  step = step || 0.25;
  let t0 = now;
  for (let s = 0; s < seconds; s += step) { t0 += step * 1000; DE.Sim.tick(state, step, t0); }
  return t0;
}

console.log('State');
let now = 1700000000000;
let S = DE.State.create(null, now);
t('new game has 5 starter rooms and 4 survivors, all assigned', () => {
  assert(Object.keys(S.rooms).length === 5); assert(Object.keys(S.survivors).length === 4);
  assert(Object.values(S.survivors).every(sv => sv.assignment && sv.assignment.kind === 'room'), 'everyone works');
  assert(S.floors.length === 1);
});
t('starter survivors are assigned to matching rooms', () => {
  const farm = Object.values(S.rooms).find(r => r.type === 'farm');
  assert(farm.workers.length === 1, 'farm has a farmer');
  const sv = S.survivors[farm.workers[0]]; assert(sv.profession === 'farmer');
});
t('wall starts at full HP', () => { assert(S.defense.wall.hp === DE.Defense.wallMaxHp(S) && S.defense.wall.hp > 0); });

console.log('Economy');
t('rates: food produced and consumed', () => {
  const r = DE.Economy.computeRates(S);
  assert(r.production.food > 0, 'food prod'); assert(r.consumption.food > 0, 'food cons');
  assert(r.production.electricity > 0 && r.consumption.electricity > 0);
});
t('ticking increases food stock when net positive', () => {
  const before = S.resources.food; now = run(S, 10, now);
  const r = DE.Economy.computeRates(S);
  if (r.net.food > 0) assert(S.resources.food > before); else assert(S.resources.food <= before);
});
t('storage caps clamp resources', () => {
  const cap = DE.Economy.storageCap(S, 'food'); S.resources.food = cap + 500; now = run(S, 1, now);
  assert(S.resources.food <= cap + 500 && S.resources.food >= cap - 1);
  S.resources.food = 300;
});
t('level multiplier milestones', () => { assert(DE.Economy.levelMult(10) > DE.Economy.levelMult(9) * 2); });
t('unmanned room runs at base 25%', () => {
  const farm = Object.values(S.rooms).find(r => r.type === 'farm');
  const w = farm.workers.slice(); w.forEach(id => DE.Survivors.assign(S, id, null));
  S._fx = null; const r = DE.Economy.computeRates(S);
  approx(r.perRoom[farm.id].workerMult, 0.25, 1e-9, 'unmanned');
  w.forEach(id => DE.Survivors.assign(S, id, { kind: 'room', id: farm.id }));
});

console.log('Bunker');
let BUILT = null;
t('build deducts cost and starts a timer', () => {
  S.resources.scrap = 1000; const scrapBefore = S.resources.scrap;
  const res = DE.Bunker.build(S, 'workshop', 1, 12, now); BUILT = res.room;
  assert(res.ok, res.reason); assert(S.resources.scrap === scrapBefore - 70);
  assert(res.room.level === 0 && res.room.construction && res.room.construction.kind === 'build');
});
t('cannot build on occupied cells', () => { const r = DE.Bunker.build(S, 'farm', 1, 12, now); assert(!r.ok); });
t('cannot build a 4-cell room where only 2 cells are free', () => {
  const r = DE.Bunker.canPlace(S, 'quarters', 1, 14); assert(!r.ok);
});
t('construction completes after its timer', () => {
  const ws = BUILT;
  now = run(S, ws.construction.duration + 1, now, 1);
  assert(ws.level === 1 && !ws.construction);
});
t('upgrade x1 deducts geometric cost', () => {
  const farm = Object.values(S.rooms).find(r => r.type === 'farm');
  S.resources.scrap = 10000; const before = S.resources.scrap;
  const cost = DE.Bunker.upgradeCost(S, farm, 1); assert(cost.scrap === Math.ceil(50 * DE.CONFIG.COST_GROWTH));
  const r = DE.Bunker.upgrade(S, farm.id, 1, now); assert(r.ok);
  assert(S.resources.scrap === before - cost.scrap);
  now = run(S, farm.construction.duration + 1, now, 1); assert(farm.level === 2);
});
t('bulk upgrade x10 / max', () => {
  const farm = Object.values(S.rooms).find(r => r.type === 'farm');
  S.resources.scrap = 1e6;
  const n10 = DE.Bunker.affordableLevels(S, farm, 10); assert(n10 === 10);
  const r = DE.Bunker.upgrade(S, farm.id, n10, now); assert(r.ok && r.levels === 10);
  now = run(S, farm.construction.duration + 1, now, 1); assert(farm.level === 12, 'level ' + farm.level);
  S.resources.scrap = 500; const nmax = DE.Bunker.affordableLevels(S, farm, 'max'); assert(nmax >= 0 && nmax < 10);
  assert(DE.Util.canAfford(S.resources, DE.Bunker.upgradeCost(S, farm, nmax)));
  if (nmax < 500) assert(!DE.Util.canAfford(S.resources, DE.Bunker.upgradeCost(S, farm, nmax + 1)));
});
t('adjacency bonus: farm next to generator', () => {
  const water = Object.values(S.rooms).find(r => r.type === 'water'); // cells 6-7, generator at 8
  assert(DE.Bunker.adjacencyBonus(S, water) >= 0.05);
});
t('demolish refunds and frees slot', () => {
  const ws = BUILT; const before = S.resources.scrap;
  const r = DE.Bunker.demolish(S, ws.id); assert(r.ok); assert(S.floors[0].slots[12] === null); assert(S.resources.scrap > before);
});

t('floors expand sideways and rooms relocate', () => {
  S.resources.scrap = 1e5; S.resources.concrete = 1e5;
  const r = DE.Bunker.expand(S, 1, now); assert(r.ok, r.reason);
  now = run(S, DE.Bunker.getFloor(S, 1).expansion.duration + 1, now, 1);
  assert(DE.Bunker.getFloor(S, 1).slots.length === DE.CONFIG.FLOOR_SLOTS + DE.CONFIG.WING_CELLS, 'cols ' + DE.Bunker.getFloor(S, 1).slots.length);
  const b2 = DE.Bunker.build(S, 'workshop', 1, 12, now); assert(b2.ok, b2.reason); const ws = b2.room; ws.level = 1; ws.construction = null; const m = DE.Bunker.move(S, ws.id, 1, 16); assert(m.ok, m.reason); assert(ws.slot === 16);
  assert(DE.Bunker.getFloor(S, 1).slots[16] === ws.id && DE.Bunker.getFloor(S, 1).slots[12] === null);
  assert(!DE.Bunker.move(S, ws.id, 1, 0).ok, 'cannot move onto quarters');
  DE.Bunker.demolish(S, ws.id);
});

console.log('Living world');
t('events: choose applies effects and clears the queue', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E);
  E.events.push({ id: 'ex1', kind: 'bunker', def: 'pipe', title: 'Burst pipe', text: '', ctx: {}, choices: [{ label: 'Patch', effects: { scrap: -80 } }, { label: 'Drain', effects: { waterPct: -0.25 } }] });
  const sc = E.resources.scrap; const r = DE.Events.choose(E, 'ex1', 0); assert(r.ok); assert(E.resources.scrap === sc - 80); assert(E.events.length === 0);
  assert(!DE.Events.choose(E, 'ex1', 0).ok, 'gone');
});
t('events: a cost you cannot pay blocks that choice, never the whole card', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E); E.resources.scrap = 50;
  const ev = { id: 'ex2', kind: 'bunker', title: 'Pipe', text: '', ctx: {}, choices: [{ label: 'Patch', effects: { scrap: -80 } }, { label: 'Drain', effects: { waterPct: -0.25 } }] };
  E.events.push(ev);
  assert(!DE.Events.canChoose(E, ev, 0).ok && DE.Events.canChoose(E, ev, 1).ok, 'patch blocked, drain open');
  assert(!DE.Events.choose(E, 'ex2', 0).ok && E.resources.scrap === 50, 'nothing paid');
  // when no choice is affordable, every choice stays open so the card can always be closed
  const ev3 = { id: 'ex3', kind: 'bunker', title: 'Toll', text: '', ctx: {}, choices: [{ label: 'Pay', effects: { scrap: -80 } }, { label: 'Pay more', effects: { scrap: -200 } }] };
  E.events.push(ev3); assert(DE.Events.canChoose(E, ev3, 0).ok && DE.Events.choose(E, 'ex3', 0).ok);
});
t('bus upgrade raises team capacity and expedition speed', () => {
  const E = DE.State.create(null, now); E.research.done.construction = true; E._fx = null; E.resources.scrap = 1e5; E.resources.concrete = 1e5; E.resources.fuel = 1e5; E.resources.research = 1e5;
  assert(DE.Events.bus(E).capacity === 3);
  E.floors[0].slots.push(null, null, null, null); const gb = DE.Bunker.build(E, 'garage', 1, 12, now); assert(gb.ok, gb.reason); Object.values(E.rooms).find(r => r.type === 'garage').level = 1; Object.values(E.rooms).find(r => r.type === 'garage').construction = null; E._fx = null;
  const r = DE.Events.upgradeBus(E); assert(r.ok, r.reason); assert(DE.Events.bus(E).capacity === 4);
});
t('goals complete and pay out', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E); E.resources.research = 0;
  // objectives are shown in order, three at a time: mark everything before 'Dig to B2' as done
  for (const g of DE.Data.GOALS) { if (g.id === 'g_b2') break; E.goals.done[g.id] = true; }
  const sc = E.resources.research; E.floors.push(DE.State.emptyFloor(2)); DE.Events.tick(E, 0.25, now);
  assert(E.goals.done.g_b2, 'B2 goal'); assert(E.resources.research === sc + 40, 'reward');
});
t('noise raises wave strength; dampening lowers it', () => {
  const E = DE.State.create(null, now); const n1 = DE.Events.noise(E); assert(n1 > 0);
  const hp1 = DE.Defense.waveHp(E); E.research.done.dampening = true; E._fx = null; const n2 = DE.Events.noise(E); assert(n2 < n1); assert(DE.Defense.waveHp(E) <= hp1);
});
t('artifact effects reach the economy', () => {
  const E = DE.State.create(null, now); const farm = Object.values(E.rooms).find(r => r.type === 'farm');
  const before = DE.Economy.computeRates(E).perRoom[farm.id].produces.food; E.artifacts = { seedvault: true }; E._fx = null;
  approx(DE.Economy.computeRates(E).perRoom[farm.id].produces.food, before * 1.2, 1e-6, 'seed vault');
});

console.log('Survivors');
t('recruit needs housing', () => {
  S.resources.food = 5000; S.resources.water = 5000;
  const cap = DE.Bunker.housingCapacity(S); assert(cap === 4);
  // the four starters fill the bunks: growing means upgrading the quarters first
  const r = DE.Survivors.recruit(S); assert(!r.ok && /housing/i.test(r.reason));
});
t('recruit works with housing and deducts cost', () => {
  const q = Object.values(S.rooms).find(r => r.type === 'quarters'); q.level = 3; S._fx = null;
  const cost = DE.Survivors.recruitCost(S); const f = S.resources.food;
  const r = DE.Survivors.recruit(S, 'scientist'); assert(r.ok, r.reason); assert(S.resources.food === f - cost.food);
});
t('room capacity enforced', () => {
  const water = Object.values(S.rooms).find(r => r.type === 'water'); // max 2
  const ids = Object.keys(S.survivors);
  let okCount = 0; ids.forEach(id => { if (DE.Survivors.assign(S, id, { kind: 'room', id: water.id }).ok) okCount++; });
  assert(water.workers.length === 2, 'water has ' + water.workers.length);
});
t('survivors gain xp and level up', () => {
  const sv = Object.values(S.survivors).find(s => s.assignment); const lvl = sv.level;
  now = run(S, 200, now, 1); assert(sv.level > lvl);
});
t('profession bonus affects efficiency', () => {
  const fx = DE.Effects.compute(S);
  const farmer = { level: 1, profession: 'farmer', traits: [], hp: 100 };
  assert(DE.Survivors.efficiency(farmer, DE.Data.ROOMS.farm, fx) > DE.Survivors.efficiency(farmer, DE.Data.ROOMS.water, fx));
});

console.log('Research');
t('research needs points and unlocks rooms', () => {
  assert(!DE.Bunker.isUnlocked(S, 'concrete'));
  S.resources.research = 0; assert(!DE.Research.start(S, 'construction', now).ok);
  S.resources.research = 100; const r = DE.Research.start(S, 'construction', now); assert(r.ok, r.reason);
  assert(S.resources.research === 50); assert(!DE.Research.start(S, 'farming1', now).ok, 'busy');
  now = run(S, S.research.current.duration + 1, now, 1);
  assert(S.research.done.construction); assert(DE.Bunker.isUnlocked(S, 'concrete')); assert(DE.Bunker.isUnlocked(S, 'garage'));
});
t('prerequisites enforced', () => { S.resources.research = 1e6; assert(!DE.Research.start(S, 'machinery', now).ok); assert(DE.Research.start(S, 'excavation1', now).ok); now = run(S, 200, now, 1); });
t('research multiplier applies', () => {
  const farm = Object.values(S.rooms).find(r => r.type === 'farm');
  const before = DE.Economy.computeRates(S).perRoom[farm.id].produces.food;
  S.research.done.farming1 = true; S._fx = null;
  const after = DE.Economy.computeRates(S).perRoom[farm.id].produces.food;
  approx(after / before, 1.25, 1e-6);
});

console.log('Excavation');
t('excavation costs scale and creates floors', () => {
  S.resources.scrap = 1e6; S.resources.concrete = 1e6;
  const c2 = DE.Excavation.cost(S, 2), c3 = DE.Excavation.cost(S, 3); assert(c3.scrap > c2.scrap && c3.concrete > 0);
  let r = DE.Excavation.start(S, now); assert(r.ok, r.reason); assert(!DE.Excavation.start(S, now).ok, 'double dig');
  now = run(S, S.excavation.duration + 1, now, 1); assert(S.floors.length === 2);
  r = DE.Excavation.start(S, now); assert(r.ok); now = run(S, S.excavation.duration + 1, now, 1); assert(S.floors.length === 3);
  r = DE.Excavation.start(S, now); assert(r.ok); now = run(S, S.excavation.duration + 1, now, 1); assert(S.floors.length === 4);
  assert(!DE.Excavation.canStart(S).ok, 'max depth 4 without machinery');
});
t('facilities eventually appear (pity timer)', () => {
  S.research.done.machinery = true; S.research.done.excavation2 = true; S.research.done.excavation3 = true; S._fx = null;
  let found = S.floors.some(f => f.facility);
  while (!found && S.floors.length < 12) { const r = DE.Excavation.start(S, now); assert(r.ok, r.reason); now = run(S, S.excavation.duration + 1, now, 5); found = S.floors.some(f => f.facility); }
  assert(found, 'no facility found by floor ' + S.floors.length);
  const fl = S.floors.find(f => f.facility); const room = Object.values(S.rooms).find(r => r.floor === fl.depth);
  assert(room && DE.Data.ROOMS[room.type].unique);
});

console.log('Defense');
t('wave resolves: victory with strong defense', () => {
  S.defense.wave = 1; S.defense.turrets = 10; S.research.done.machinery = true; S._fx = null;
  const res = DE.Defense.resolveWave(S, now); assert(res.outcome === 'victory', res.outcome); assert(S.defense.wave === 2);
});
t('wave resolves: breach damages wall and steals resources', () => {
  S.defense.turrets = 0; Object.values(S.survivors).forEach(s => { if (s.assignment && s.assignment.kind === 'guard') DE.Survivors.assign(S, s, null); });
  S.defense.wave = 40; S.defense.wall.hp = 10; S.resources.food = 1000;
  const res = DE.Defense.resolveWave(S, now); assert(res.breach, 'breach'); assert(S.resources.food < 1000); assert(S.defense.wall.hp === 0);
  S.defense.wave = 1;
});
t('wall upgrade & repair', () => {
  S.resources.scrap = 1e6; S.resources.concrete = 1e6;
  const l = S.defense.wall.level; assert(DE.Defense.upgradeWall(S).ok); assert(S.defense.wall.level === l + 1);
  assert(DE.Defense.repairWall(S).ok); assert(S.defense.wall.hp === DE.Defense.wallMaxHp(S));
});
t('turrets capped by slots; traps need research', () => {
  const cap = DE.Defense.maxTurrets(S); let n = 0; while (DE.Defense.buyTurret(S).ok) n++; assert(n === cap, n + ' vs ' + cap);
  delete S.research.done.defense1; S._fx = null; assert(!DE.Defense.buyTraps(S, 1).ok);
  S.research.done.defense1 = true; S._fx = null; assert(DE.Defense.buyTraps(S, 3).ok && S.defense.traps === 3);
});
t('guards contribute damage', () => {
  const sv = Object.values(S.survivors)[0]; DE.Survivors.assign(S, sv.id, { kind: 'guard' });
  assert(DE.Defense.defensePower(S).guardDps > 0);
});

console.log('Expeditions');
t('needs garage; sends and returns loot', () => {
  Object.values(S.survivors).forEach(sv => sv.hp = 100); // earlier breach test may have injured them
  const ids = Object.keys(S.survivors).slice(0, 2);
  assert(!DE.Expeditions.send(S, 'suburbs', ids, now).ok);
  const r = DE.Bunker.build(S, 'garage', 2, 0, now); assert(r.ok, r.reason); now = run(S, r.room.construction.duration + 1, now, 1); S._fx = null;
  const s = DE.Expeditions.send(S, 'suburbs', ids, now); assert(s.ok, s.reason);
  assert(S.survivors[ids[0]].assignment.kind === 'expedition');
  assert(!DE.Survivors.assign(S, ids[0], null).ok, 'cannot reassign while away');
  const scrap = S.resources.scrap = 0;
  now = run(S, 241, now, 10);
  assert(S.expeditions.active.length === 0); assert(S.resources.scrap > scrap); assert(S.survivors[ids[0]].assignment === null);
  assert(S.expeditions.log.length === 1);
});

console.log('Offline');
t('offline progression credits production and caps', () => {
  const O = DE.State.create(null, now);
  O.resources.fuel = 1e5; O.resources.scrap = 1e5; // keep generator alive
  const food = O.resources.food; const start = O.lastTick;
  const summary = DE.Offline.process(O, start + 2 * 3600 * 1000);
  assert(summary && summary.simulated === 7200 && !summary.capped);
  assert(O.resources.food !== food, 'food changed');
  const O2 = DE.State.create(null, now);
  const s2 = DE.Offline.process(O2, O2.lastTick + 30 * 3600 * 1000);
  assert(s2.capped && s2.simulated === 8 * 3600, 'cap 8h');
  assert(O2.lastTick === now + 30 * 3600 * 1000);
});
t('offline completes construction timers and limits waves', () => {
  const O = DE.State.create(null, now); O.resources.scrap = 1000; O.resources.fuel = 1e5;
  const r = DE.Bunker.build(O, 'workshop', 1, 12, now);
  DE.Offline.process(O, now + 10 * 3600 * 1000);
  assert(r.room.level === 1, 'built'); assert(O.defense.wave <= 1 + DE.CONFIG.OFFLINE_MAX_WAVES + 1, 'waves ' + O.defense.wave);
  assert(O.defense.nextWaveAt > now + 10 * 3600 * 1000 - 1000, 'next wave in the future');
});

console.log('Save / load');
t('save → load roundtrip preserves rooms, survivors, research', () => {
  assert(DE.Save.save(S)); const L = DE.Save.load(); assert(L);
  assert(Object.keys(L.rooms).length === Object.keys(S.rooms).length);
  assert(Object.keys(L.survivors).length === Object.keys(S.survivors).length);
  assert(L.research.done.construction && L.floors.length === S.floors.length);
  assert(L.defense.turrets === S.defense.turrets);
});
t('export → import roundtrip', () => {
  const str = DE.Save.exportString(S); assert(str.startsWith('DEU1:'));
  const r = DE.Save.importString(str); assert(r.ok, r.error); assert(r.state.resources.scrap === S.resources.scrap);
});
t('import rejects garbage and never evaluates', () => {
  assert(!DE.Save.importString('hello world').ok);
  assert(!DE.Save.importString('{"v":1,"state":"alert(1)"}').ok);
  const r = DE.Save.importString('{"v":1,"state":{"resources":{"food":"1e9"},"rooms":{"bad":{"type":"nope"}}}}');
  assert(r.ok && r.state.resources.food === 0 && Object.keys(r.state.rooms).length === 0);
});
t('import sanitizes impossible values', () => {
  const str = DE.Save.serialize(S); const raw = JSON.parse(str);
  raw.state.resources.food = -500; raw.state.survivors[Object.keys(raw.state.survivors)[0]].level = 9999; raw.state.morale = 500;
  raw.state.floors[0].slots[0] = 'ghost';
  const r = DE.Save.parse(JSON.stringify(raw)); assert(r.ok);
  assert(r.state.resources.food === 0); assert(r.state.morale === 100);
  assert(Object.values(r.state.survivors)[0].level === DE.CONFIG.SURVIVOR_MAX_LEVEL); assert(r.state.floors[0].slots[0] === null);
});
t('future version rejected', () => { assert(!DE.Save.parse('{"v":99,"state":{}}').ok); });

console.log('Beds & sleep');
t('beds come from the bed furniture a room actually shows', () => {
  assert(DE.Data.bedsFor('quarters', 1).length === 4, 'two bunks = four berths');
  assert(DE.Data.bedsFor('quarters', 10).length === 6, 'a third bunk at level 10');
  assert(DE.Data.bedsFor('farm', 1).length === 0, 'no beds in a farm');
});
t('survivors sleep only in free beds, one per berth', () => {
  const B = DE.State.create(null, now);
  for (let i = 0; i < 4; i++) DE.Survivors.recruit(B);
  Object.values(B.survivors).forEach(sv => { DE.Needs.init(sv); sv.energy = 5; sv.act = { kind: 'idle', until: 0, room: null }; });
  DE.Needs.tick(B, 0.25, DE.Effects.compute(B));
  const sleepers = Object.values(B.survivors).filter(sv => sv.act.kind === 'sleep');
  const beds = DE.Data.bedsFor('quarters', 1).length;
  assert(sleepers.length === Math.min(beds, Object.keys(B.survivors).length), 'sleepers ' + sleepers.length);
  const keys = sleepers.map(sv => sv.act.room + ':' + sv.act.bed); assert(new Set(keys).size === keys.length, 'no shared berth');
  assert(sleepers.every(sv => B.rooms[sv.act.room].type === 'quarters'), 'in a bed room');
});
t('nobody sleeps on the floor when there is no bed room', () => {
  const B = DE.State.create(null, now);
  for (const id in B.rooms) if (B.rooms[id].type === 'quarters') { const f = B.floors[0]; f.slots = f.slots.map(x => x === id ? null : x); delete B.rooms[id]; }
  Object.values(B.survivors).forEach(sv => { DE.Needs.init(sv); sv.energy = 3; });
  DE.Needs.tick(B, 0.25, DE.Effects.compute(B));
  assert(Object.values(B.survivors).every(sv => sv.act.kind !== 'sleep'), 'no bed, no sleep');
});

console.log('Defense structures');
t('start is weak: no towers, plank fence, no missile battery', () => {
  const B = DE.State.create(null, now);
  assert(B.overworld.fence === 0 && B.overworld.towers === 0 && B.overworld.missile === 0 && B.overworld.barricades === 0);
  assert(DE.Defense.defensePower(B).missileDps === 0);
});
t('missile battery is an expensive endgame upgrade with prerequisites and real damage', () => {
  const B = DE.State.create(null, now); B.resources.scrap = 1e7; B.resources.concrete = 1e7; B.resources.fuel = 1e6;
  const r1 = DE.Defense.upgradeStructure(B, 'missile'); assert(!r1.ok && /Requires/.test(r1.reason), 'needs fence + towers first');
  const cost = DE.Data.OVERWORLD.missile.levels[1].cost; assert(cost.scrap >= 20000, 'endgame price');
  B.overworld.fence = 2; B.overworld.towers = 2;
  const before = DE.Defense.defensePower(B).total;
  assert(DE.Defense.upgradeStructure(B, 'missile').ok); B._fx = null;
  const pw = DE.Defense.defensePower(B); assert(pw.missileDps > 0 && pw.total > before, 'adds firepower');
});
t('old saves without the new structures load with them at level 0', () => {
  const B = DE.State.create(null, now); const raw = JSON.parse(DE.Save.serialize ? DE.Save.serialize(B) : JSON.stringify({ v: DE.CONFIG.SAVE_VERSION, state: B }));
  const st = raw.state || raw; delete st.overworld.barricades; delete st.overworld.missile; st.overworld.fence = 2;
  const r = DE.Save.parse(JSON.stringify(raw)); assert(r.ok, r.reason);
  assert(r.state.overworld.barricades === 0 && r.state.overworld.missile === 0 && r.state.overworld.fence === 2);
});

console.log('Geology');
t('every diggable depth belongs to a layer; deeper layers are harder', () => {
  for (let d = 1; d <= DE.CONFIG.MAX_FLOORS; d++) assert(DE.Data.stratumAt(d), 'layer at ' + d);
  const ids = DE.Data.STRATA.map(x => x.id); assert(ids.join() === 'topsoil,dirt,stone,deeprock');
  for (let i = 1; i < DE.Data.STRATA.length; i++) assert(DE.Data.STRATA[i].hardness > DE.Data.STRATA[i - 1].hardness);
});

console.log('Prestige');
t('reset requires depth and gain', () => {
  const P = DE.State.create(null, now); assert(!DE.Prestige.canReset(P).ok);
});
t('reset grants LP, keeps upgrades, applies legacy', () => {
  S.stats.runScore = 5e6; S.stats.maxDepth = Math.max(S.stats.maxDepth, 3);
  const gain = DE.Prestige.potentialPoints(S); assert(gain >= 3, 'gain ' + gain);
  const r = DE.Prestige.reset(S, now); assert(r.ok, r.reason);
  const N = r.state; assert(N.prestige.points === gain && N.prestige.resets === 1);
  assert(Object.keys(N.rooms).length === 5 && N.floors.length === 1, 'fresh run');
  N.prestige.points = 100;
  assert(DE.Prestige.buy(N, 'hands').ok); assert(DE.Prestige.buy(N, 'tunnels').ok); assert(DE.Prestige.buy(N, 'friends').ok);
  const N2 = DE.Prestige.reset(Object.assign(N, { stats: Object.assign(N.stats, { runScore: 5e6, maxDepth: 3 }) }), now).state;
  assert(N2.floors.length === 2, 'tunnels gives extra floor'); assert(Object.keys(N2.survivors).length === 5, 'friends: 4 starters + 1');
  assert(DE.Effects.compute(N2).globalMult >= 0.1);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
