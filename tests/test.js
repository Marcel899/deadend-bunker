/* Headless logic tests. Run: node tests/test.js
 * Loads the game's data + core scripts into this process (no DOM needed). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const FILES = [
  'js/data/config.js', 'js/data/resources.js', 'js/data/rooms.js', 'js/data/research.js', 'js/data/survivors.js', 'js/data/world.js', 'js/data/overworld.js', 'js/data/finds.js', 'js/data/crafting.js', 'js/data/events.js', 'js/data/sprites.js', 'js/data/scenes.js', 'js/data/icons.js', 'js/data/room_icons.js',
  'js/core/util.js', 'js/core/season.js', 'js/core/effects.js', 'js/core/state.js', 'js/core/save.js', 'js/core/economy.js', 'js/core/bunker.js',
  'js/core/survivors.js', 'js/core/events.js', 'js/core/needs.js', 'js/core/infection.js', 'js/core/gear.js', 'js/core/minigames.js', 'js/core/research.js', 'js/core/excavation.js', 'js/core/defense.js', 'js/core/expeditions.js',
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
t('new game starts nearly empty: quarters + generator, 4 survivors', () => {
  assert(Object.values(S.rooms).map(r => r.type).sort().join() === 'generator,quarters'); assert(Object.keys(S.survivors).length === 4);
  assert(Object.values(S.rooms).every(r => r.level === 1 && !r.construction), 'starters are finished');
  assert(S.floors.length === 1);
  const gen = Object.values(S.rooms).find(r => r.type === 'generator'); assert(gen.workers.length === 2, 'generator staffed');
});
t('starting scrap covers farm, water and workshop', () => {
  const R = DE.Data.ROOMS, need = R.farm.cost.scrap + R.water.cost.scrap + R.workshop.cost.scrap;
  assert(S.resources.scrap >= need + 100, 'scrap ' + S.resources.scrap + ' vs ' + need);
});
// the rest of the suite uses the classic five-room layout
(function classic() {
  const gen = Object.values(S.rooms).find(r => r.type === 'generator');
  gen.workers.slice().forEach(id => DE.Survivors.assign(S, id, null));
  S.floors[0].slots[4] = S.floors[0].slots[5] = null; delete S.rooms[gen.id];
  [['farm', 4], ['water', 6], ['generator', 8], ['workshop', 10]].forEach(([type, slot]) => DE.Bunker.placeRoom(S, type, 1, slot, 1, now));
  const by = {}; for (const id in S.rooms) by[S.rooms[id].type] = id;
  const jobs = { farmer: 'farm', mechanic: 'water', engineer: 'generator', scavenger: 'workshop' };
  for (const id in S.survivors) DE.Survivors.assign(S, id, { kind: 'room', id: by[jobs[S.survivors[id].profession]] });
  S._fx = null;
})();
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
  assert(DE.Bunker.getFloor(S, 1).slots.length === DE.CONFIG.START_FLOOR_SLOTS + DE.CONFIG.WING_CELLS, 'cols ' + DE.Bunker.getFloor(S, 1).slots.length);
  assert(DE.Bunker.wingCount(DE.Bunker.getFloor(S, 1)) === 1, 'one wing');
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
t('events: costs are a share of what you have; rewards keep pace with the economy', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E); E._rates = DE.Economy.computeRates(E);
  E.resources.scrap = 1000; assert(DE.Events.resolve(E, { cost: { scrap: 0.1 } }).scrap === -100, '10% of 1000');
  E.resources.scrap = 20000; E._fx = null; assert(DE.Events.resolve(E, { cost: { scrap: 0.1 } }).scrap === -2000, '10% of 20000');
  E.resources.scrap = 0; assert(!DE.Events.resolve(E, { cost: { scrap: 0.1 } }).scrap, 'nothing to pay from an empty store');
  const early = DE.Events.worth(E, 'food', 3); assert(early > 0, 'a reward early on');
  for (const id in E.rooms) E.rooms[id].level = 30; DE.Bunker.placeRoom(E, 'storage', 1, 12, 50); E._fx = null; E._rates = DE.Economy.computeRates(E);
  const late = DE.Events.worth(E, 'food', 3); assert(late > early * 5, 'rewards grow with output: ' + early + ' → ' + late);
  assert(DE.Events.worth(E, 'concrete', 3) > 0, 'concrete rewards before any mixer exists');
});
t('every bunker event and road encounter can be drawn and every choice taken', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E);
  for (let d = 2; d <= 5; d++) E.floors.push(DE.State.emptyFloor(d));
  for (const k in E.resources) E.resources[k] = 5000; E.defense.wave = 12; E.rep.traders = 2; E.rep.militia = 2; E.rep.growers = 2;
  for (let i = 0; i < 6; i++) DE.Survivors.spawn(E); E.rooms[Object.keys(E.rooms)[0]].level = 6; E._fx = null; E._rates = DE.Economy.computeRates(E);
  const snap = JSON.stringify(E);
  DE.Data.BUNKER_EVENTS.forEach(def => {
    const probe = JSON.parse(snap); probe._rates = E._rates; const ev = DE.Events.makeEvent(probe, def);
    assert(ev.choices.length >= 1, def.id + ' has choices');
    ev.choices.forEach((c, i) => {
      const T = JSON.parse(snap); T._rates = E._rates; DE.Events.ensure(T); T.events = [Object.assign({}, ev, { id: 'eX' })];
      const r = DE.Events.choose(T, 'eX', i); assert(r.ok, def.id + ' choice ' + i + ': ' + r.reason);
      for (const k in T.resources) assert(T.resources[k] >= 0 && isFinite(T.resources[k]), def.id + ' left ' + k + ' at ' + T.resources[k]);
      assert(!/\{[ABDR]\}/.test(ev.title + ev.text + c.label + c.desc), def.id + ' has unfilled names');
    });
  });
  DE.Data.ENCOUNTERS.forEach(def => def.choices.forEach(c => { const fx = DE.Events.resolve(E, c.effects); for (const k in fx) if (DE.Data.RESOURCES[k]) assert(isFinite(fx[k]), def.id + ' ' + k); }));
});
t('choices have consequences: chained events come back later; refusing raiders feeds the next wave', () => {
  const E = DE.State.create(null, now); DE.Events.ensure(E); E.resources.food = 2000; E._rates = DE.Economy.computeRates(E);
  const rats = DE.Data.BUNKER_EVENTS.find(e => e.id === 'rats');
  const ev = DE.Events.makeEvent(E, rats); ev.choices[2].effects = Object.assign({}, ev.choices[2].effects, { chain: ['rats2', 10, 10, 1] }); E.events = [Object.assign(ev, { id: 'eR' })];
  assert(DE.Events.choose(E, 'eR', 2).ok && E.eventChains.length === 1, 'consequence scheduled');
  let t0 = now; for (let i = 0; i < 40 && !E.events.some(x => x.def === 'rats2'); i++) { t0 += 1000; DE.Sim.tick(E, 1, t0); }
  assert(E.events.some(x => x.def === 'rats2') && !E.eventChains.length, 'the rats came back');
  const before = DE.Defense.waveHp(E); DE.Events.applyEffects(E, { waveHp: 1.35 }, {});
  approx(DE.Defense.waveHp(E) / before, 1.35, 0.02, 'next wave is bigger');
  DE.Defense.resolveWave(E, t0); assert(E.defense.waveMult === 1, 'only that wave');
  const L = DE.Save.sanitize(JSON.parse(JSON.stringify(Object.assign(E, { eventChains: [{ def: 'envoy2', at: 99, ctx: { A: 'Ann' } }] }))), now);
  assert(L.eventChains.length === 1 && L.eventChains[0].ctx.A === 'Ann', 'pending consequences survive a save');
});
t('trades give a share of one stock for its value in another, better with a good name', () => {
  const E = DE.State.create(null, now); E.resources.scrap = 1000; const tr = { give: 'scrap', pct: 0.15, get: 'fuel', rate: 1.2 };
  const a = DE.Events.tradeAmounts(E, tr); assert(a.give.scrap === 150 && a.get.fuel > 0, 'offer');
  E.rep.traders = 3; assert(DE.Events.tradeAmounts(E, tr).get.fuel > a.get.fuel, 'reputation helps');
  assert(DE.Events.tradeAmounts(E, { give: { scrap: 500 }, get: { fuel: 60 } }).give.scrap === 500, 'old fixed offers still work');
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
  const E = DE.State.create(null, now); const farm = DE.Bunker.placeRoom(E, 'farm', 1, 6, 1, now); E._fx = null;
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
function digOut(state, t0) { for (let i = 0; i < 4000 && state.excavation; i++) t0 = run(state, 5, t0, 1); return t0; }
const fill = (state) => { for (const k in state.resources) state.resources[k] = Math.max(state.resources[k], 1e7); };
t('excavation: deeper layers cost more and are more work', () => {
  const c2 = DE.Excavation.cost(S, 2), c3 = DE.Excavation.cost(S, 3), c5 = DE.Excavation.cost(S, 5), c9 = DE.Excavation.cost(S, 9);
  assert(c3.scrap > c2.scrap && c3.concrete > 0 && !c2.concrete, 'concrete for shoring from B3');
  assert(c5.fuel > 0 && !c3.fuel && c9.research > 0 && !c5.research, 'drill fuel from B5, deep surveys from B9');
  assert(c9.scrap > c5.scrap * 10, 'B9 is a major milestone: ' + c5.scrap + ' → ' + c9.scrap);
  assert(DE.Excavation.work(S, 7) > DE.Excavation.work(S, 6) * 1.6, 'granite is far more work than limestone');
});
t('excavation: a mining crew digs, faster with more and better miners', () => {
  fill(S); S.flags.floorsSinceFacility = 0;
  let r = DE.Excavation.start(S, now); assert(r.ok, r.reason); assert(!DE.Excavation.start(S, now).ok, 'double dig');
  const solo = DE.Excavation.speed(S);
  const ids = Object.keys(S.survivors).filter(id => !S.survivors[id].assignment || S.survivors[id].assignment.kind !== 'expedition');
  assert(DE.Survivors.assign(S, ids[0], { kind: 'dig' }).ok && DE.Survivors.assign(S, ids[1], { kind: 'dig' }).ok, 'two posts to start with');
  assert(!DE.Survivors.assign(S, ids[2], { kind: 'dig' }).ok, 'no third post without a Mining Station');
  S._fx = null; assert(DE.Excavation.speed(S) > solo * 2, 'two miners more than double the pace');
  let t0 = now; run(S, 3, t0, 1); assert(S.survivors[ids[0]].act.kind === 'mine' || S.survivors[ids[0]].act.kind === 'sleep' || S.survivors[ids[0]].act.kind === 'eat', 'miners go to the dig site');
  now = digOut(S, now); assert(S.floors.length === 2 && !S.excavation, 'B2 dug');
  assert(DE.Bunker.getFloor(S, 2).slots.length === DE.CONFIG.FLOOR_SLOTS, 'new floors are ' + DE.CONFIG.FLOOR_SLOTS + ' cells');
});
t('excavation: the clay needs Excavation I and a Mining Station; limestone needs more', () => {
  fill(S); delete S.research.done.excavation1; S._fx = null;
  let c = DE.Excavation.canStart(S); assert(!c.ok && /Excavation I/.test(c.reason) && /Mining Station/.test(c.reason), c.reason);
  S.research.done.excavation1 = true; S._fx = null; c = DE.Excavation.canStart(S); assert(!c.ok && /Mining Station/.test(c.reason), 'still needs the station');
  const mh = DE.Bunker.build(S, 'minehead', 2, 10, now); assert(mh.ok, mh.reason); now = run(S, mh.room.construction.duration + 1, now, 1); S._fx = null;
  assert(DE.Excavation.canStart(S).ok, 'clay open'); assert(DE.Excavation.minerCap(S) === 2, 'Lv1 adds no post yet');
  mh.room.level = 4; S._fx = null; assert(DE.Excavation.minerCap(S) === 4, 'Lv4: two more posts');
  DE.Excavation.start(S, now); const before = S.resources.concrete; now = digOut(S, now); assert(S.floors.length === 3, 'B3 dug');
  fill(S); DE.Excavation.start(S, now); now = digOut(S, now); assert(S.floors.length === 4, 'B4 dug');
  c = DE.Excavation.canStart(S); assert(!c.ok && /Heavy Machinery/.test(c.reason) && /Lv 5/.test(c.reason), c.reason);
  S.research.done.machinery = true; S._fx = null; assert(!DE.Excavation.canStart(S).ok, 'machinery alone is not enough');
  mh.room.level = 5; S._fx = null; fill(S); const c5 = DE.Excavation.canStart(S); assert(c5.ok, 'limestone open: ' + c5.reason);
});
t('excavation: rubble pays out in the layer material; the crew quarries between digs', () => {
  const sp = DE.Excavation.spoils(S, 5); assert(sp.concrete > 0, 'limestone gives concrete');
  assert(DE.Excavation.spoils(S, 9).research > 0, 'basalt gives research');
  assert(!S.excavation && DE.Excavation.miners(S).length > 0, 'idle crew');
  const q = DE.Economy.computeRates(S).quarry; assert(q && Object.values(q).some(v => v > 0), 'quarrying');
  S.excavation = { depth: 5, work: 0, need: 100 }; assert(!Object.keys(DE.Economy.computeRates(S).quarry).length, 'no quarrying while digging'); S.excavation = null;
});
t('excavation: old saves with a timed dig keep their progress', () => {
  const old = JSON.parse(JSON.stringify(S)); old.excavation = { depth: old.floors.length + 1, endsAt: Date.now() + 50000, duration: 100 };
  const L = DE.Save.sanitize(old); assert(L.excavation && Math.abs(L.excavation.work / L.excavation.need - 0.5) < 0.05, 'half done');
  const o2 = JSON.parse(JSON.stringify(S)); o2.floors.forEach(f => delete f.base);
  const L2 = DE.Save.sanitize(o2); assert(L2.floors[1].base === 16 && DE.Bunker.wingCount(L2.floors[1]) === 0, 'old floors were 16 wide');
  const o3 = JSON.parse(JSON.stringify(S)); const sid = Object.keys(o3.survivors)[0]; o3.survivors[sid].assignment = { kind: 'dig' };
  assert(DE.Save.sanitize(o3).survivors[sid].assignment.kind === 'dig', 'miners stay miners');
});
t('facilities eventually appear (pity timer)', () => {
  S.research.done.machinery = true; S.research.done.excavation2 = true; S.research.done.excavation3 = true; S.research.done.excavation4 = true; S._fx = null;
  Object.values(S.rooms).filter(r => r.type === 'minehead').forEach(r => r.level = 40); S._fx = null;
  let found = S.floors.some(f => f.facility);
  while (!found && S.floors.length < 12) { fill(S); const r = DE.Excavation.start(S, now); assert(r.ok, r.reason); now = digOut(S, now); found = S.floors.some(f => f.facility); }
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
  Object.values(S.survivors).forEach(sv => { sv.hp = 100; sv.infection = null; }); // earlier fights may have injured or infected them
  const ids = Object.keys(S.survivors).slice(0, 2);
  assert(!DE.Expeditions.send(S, 'suburbs', ids, now).ok);
  const r = DE.Bunker.build(S, 'garage', 2, 0, now); assert(r.ok, r.reason); now = run(S, r.room.construction.duration + 1, now, 1); S._fx = null;
  ids.forEach(id => { S.survivors[id].infection = null; S.survivors[id].hp = 100; });   // the waves during the build may have bitten someone
  const s = DE.Expeditions.send(S, 'suburbs', ids, now); assert(s.ok, s.reason);
  assert(S.survivors[ids[0]].assignment.kind === 'expedition');
  assert(!DE.Survivors.assign(S, ids[0], null).ok, 'cannot reassign while away');
  const scrap = S.resources.scrap = 0;
  now = run(S, 241, now, 10);
  assert(S.expeditions.active.length === 0); assert(S.resources.scrap > scrap); assert(S.survivors[ids[0]].assignment === null);
  assert(S.expeditions.log.length === 1);
});
t('at most two decisions wait: no new events or road encounters beyond that', () => {
  const E = DE.State.create(null, now); E.events = []; E.eventChains = [];
  for (let i = 0; i < 6; i++) { E.nextEventAt = 1; E.playtime = 1000 + i; DE.Events.tick(E, 0.1, now); }
  assert(E.events.length === 2, 'events ' + E.events.length);
  assert(DE.Events.encounter(E, { id: 'x1', location: 'suburbs', survivors: [], seen: [] }) === null, 'road quiet while two wait');
  E.events.push({ id: 'old', kind: 'bunker', choices: [] }); DE.Events.tick(E, 0.1, now); assert(E.events.length === 2, 'old saves trimmed to two');
});
t('road encounters change the trip that is still out; finds and notes reach the report', () => {
  Object.values(S.survivors).forEach(sv => { sv.hp = 100; sv.infection = null; });
  const ids = Object.keys(S.survivors).filter(id => !S.survivors[id].assignment || S.survivors[id].assignment.kind !== 'expedition').slice(0, 2);
  const r = DE.Expeditions.send(S, 'suburbs', ids, now); assert(r.ok, r.reason);
  const trip = S.expeditions.active[S.expeditions.active.length - 1];
  S.events = [];   // no decisions waiting (at most two can wait)
  const ev = DE.Events.encounter(S, trip); assert(ev && ev.ctx.expId === trip.id, 'encounter tied to the trip');
  assert(DE.Data.ENCOUNTERS.find(e => e.id === ev.def).tags.some(t => DE.Expeditions.location('suburbs').tags.includes(t) || t === 'suburbs'), 'matches the location');
  assert(trip.seen.includes(ev.def), 'remembered so it does not repeat');
  const ends = trip.endsAt, ctx = { members: ids, expId: trip.id };
  DE.Events.applyEffects(S, { lootMult: 2, loot: { scrap: 100 }, delay: 60 }, ctx);
  assert(trip.mult === 2 && trip.bonus.scrap > 0 && trip.endsAt === ends + 60000, 'haul doubled, scrap loaded, detour');
  DE.Events.applyEffects(S, { gamble: [1, { loot: { food: 50 } }, { lootMult: 0 }] }, ctx); assert(trip.bonus.food > 0 && trip.mult === 2, 'a sure gamble pays the win');
  DE.Events.applyEffects(S, { gamble: [0, { loot: { food: 50 } }, { lootMult: 0.5 }] }, ctx); assert(trip.mult === 1, 'a lost gamble pays the loss');
  S.events = S.events.filter(e => e.id !== ev.id); S.events.push(ev);
  assert(DE.Events.choose(S, ev.id, ev.choices.length - 1).ok); assert(trip.notes.length === 1, 'the choice is noted on the trip');
  // the save keeps trip state
  const L = DE.Save.sanitize(JSON.parse(JSON.stringify(S)), now); const t2 = L.expeditions.active.find(e => e.id === trip.id);
  assert(t2 && t2.mult === trip.mult && t2.bonus.scrap === trip.bonus.scrap && t2.notes.length === 1 && t2.seen.length === 1, 'trip survives save/load');
  const scrap = S.resources.scrap = 0;
  now = run(S, (trip.endsAt - now) / 1000 + 2, now, 10);
  const rep = S.expeditions.log[S.expeditions.log.length - 1];
  assert(rep.id === trip.id && rep.loot.scrap >= trip.bonus.scrap && S.resources.scrap > scrap, 'loaded scrap comes home');
  assert(Array.isArray(rep.finds) && rep.notes.length === 1, 'report has finds and notes');
});

t('expeditions explore places: blueprints, collectibles and rare materials come home', () => {
  const E = DE.State.create(null, now); E.research.done.construction = true; E._fx = null; fill(E);
  E.floors.push(DE.State.emptyFloor(2)); const g = DE.Bunker.build(E, 'garage', 2, 0, now); assert(g.ok, g.reason); g.room.level = 1; g.room.construction = null; E._fx = null;
  const ids = Object.keys(E.survivors).slice(0, 2); Object.values(E.survivors).forEach(v => v.hp = 100);
  assert(!DE.Bunker.isUnlocked(E, 'mushroom') && /Blueprint/.test(DE.Bunker.lockReason(E, 'mushroom')), 'exclusive rooms start locked');
  let t0 = now;
  for (let trip = 0; trip < 2; trip++) {
    const r = DE.Expeditions.send(E, 'farmland', ids, t0); assert(r.ok, r.reason); t0 = run(E, r.duration + 2, t0, 5); ids.forEach(id => E.survivors[id].hp = 100);
  }
  const rep = E.expeditions.log[E.expeditions.log.length - 1];
  assert(DE.Expeditions.explore(E, 'farmland') >= 2, 'two trips: level 2');
  assert(E.blueprints.mushroom && rep.blueprints.includes('mushroom'), 'the mushroom plans at level 2');
  assert(DE.Bunker.isUnlocked(E, 'mushroom'), 'now buildable');
  assert(E.materials.chem > 0, 'chemicals from the farmland');
  E.materials.chem = 0; let b = DE.Bunker.build(E, 'mushroom', 2, 6, t0); assert(!b.ok && /rare/.test(b.reason), 'needs its rare materials');
  E.materials.chem = 5; b = DE.Bunker.build(E, 'mushroom', 2, 6, t0); assert(b.ok, b.reason); assert(E.materials.chem === 3, 'paid 2 chemicals');
  // a complete set changes the effects
  const before = DE.Effects.compute(E).moraleBonus;
  Object.values(DE.Data.COLLECTIBLES).filter(c => c.set === 'memories').forEach(c => E.collection[c.id] = true); E._fx = null;
  assert(DE.Expeditions.setDone(E, 'memories') && DE.Effects.compute(E).moraleBonus === before + 8, 'Life Before: +8 morale');
  // the save keeps it all
  const L = DE.Save.sanitize(JSON.parse(JSON.stringify(E)));
  assert(L.blueprints.mushroom && L.materials.chem === 3 && L.explore.farmland === E.explore.farmland && Object.keys(L.collection).length === Object.keys(E.collection).length, 'saved');
  // road effects: materials, a collectible, map knowledge
  const sent = DE.Expeditions.send(E, 'suburbs', ids, t0); assert(sent.ok, sent.reason); const tr = E.expeditions.active[0];
  DE.Events.applyEffects(E, { mat: { circuits: 2 }, explore: 1 }, { members: ids, expId: tr.id });
  assert(tr.mats.circuits === 2 && tr.explore === 1, 'loaded on the truck');
  const c = DE.Expeditions.grantCollectible(E, 'gas', true); assert(c && c.where === 'gas', 'a collectible from the place');
  every = Object.values(DE.Data.COLLECTIBLES); assert(every.length === 24 && DE.Data.COLLECTION_ORDER.every(k => DE.Expeditions.setSize(k) === 4), '6 sets of 4');
  assert(Object.values(DE.Data.ROOMS).filter(d => d.blueprint).every(d => DE.Expeditions.location(d.blueprint) && d.rare), 'every blueprint has a place and a rare cost');
});
var every;

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
  const ids = DE.Data.STRATA.map(x => x.id); assert(ids.join() === 'topsoil,clay,limestone,granite,basalt,magma');
  for (let i = 1; i < DE.Data.STRATA.length; i++) assert(DE.Data.STRATA[i].mine > DE.Data.STRATA[i - 1].mine && DE.Data.RESEARCH[DE.Data.STRATA[i].research], 'each layer needs more');
  for (let i = 1; i < DE.Data.STRATA.length; i++) assert(DE.Data.STRATA[i].hardness > DE.Data.STRATA[i - 1].hardness);
});

console.log('Infection');
t('infection: hidden at first, symptoms show, gets worse, turns if left alone', () => {
  const E = DE.State.create(null, now); E._fx = DE.Effects.compute(E); const sv = Object.values(E.survivors)[0];
  const orig = Math.random; Math.random = () => 0; assert(DE.Infection.expose(E, sv, .5)); Math.random = orig;
  assert(sv.infection && !sv.infection.known, 'quiet at first'); assert(DE.Infection.stage(sv).id === 'incubating');
  for (let i = 0; i < 400; i++) { DE.Infection.tick(E, 1, E._fx); E.playtime += 1; }
  assert(sv.infection.known, 'symptoms after ~6 min'); assert(DE.Survivors.efficiency(sv, null, E._fx) < DE.Survivors.efficiency(Object.values(E.survivors)[1], null, E._fx) * 1.3);
  let turned = false; for (let i = 0; i < 1600 && E.survivors[sv.id]; i++) { E._events = []; DE.Infection.tick(E, 1, E._fx); E.playtime += 1; if (E._events.some(e => e.type === 'turned')) turned = true; }
  assert(turned && !E.survivors[sv.id], 'turned and lost after ~25 min untreated');
});
t('infection: isolation stops it and the ward cures it; the survivor goes back to work', () => {
  const E = DE.State.create(null, now); for (const k in E.resources) E.resources[k] = 1e6;
  const q = DE.Bunker.placeRoom(E, 'quarantine', 1, 6, 2, now); E._fx = DE.Effects.compute(E);
  const sv = Object.values(E.survivors).find(v => v.assignment && v.assignment.kind === 'room'), job = Object.assign({}, sv.assignment);
  sv.infection = { sev: .6, known: true, ward: null, prev: null, since: 0 };
  assert(!DE.Expeditions.send(E, 'suburbs', [sv.id], now).ok, 'infected stay home');
  const r = DE.Infection.isolate(E, sv.id); assert(r.ok && r.room.id === q.id, r.reason);
  assert(!sv.assignment && sv.infection.ward === q.id, 'off duty, in the ward');
  assert(!DE.Survivors.assign(E, sv.id, { kind: 'guard' }).ok, 'cannot be put to work while isolated');
  DE.Needs.tick(E, 1, E._fx); assert(sv.act.kind === 'heal' && sv.act.room === q.id, 'lies in the ward');
  let cured = false; for (let i = 0; i < 600 && sv.infection; i++) { E._events = []; DE.Infection.tick(E, 1, E._fx); E.playtime += 1; if (E._events.some(e => e.type === 'cured')) cured = true; }
  assert(cured && !sv.infection, 'cured in the ward'); assert(sv.immuneUntil > E.playtime, 'immune for a while');
  assert(sv.assignment && sv.assignment.kind === job.kind, 'back to the old job');
  assert(!DE.Infection.expose(E, sv, 1), 'immune right after');
});
t('infection: survives save/load; the sick pass it on', () => {
  const E = DE.State.create(null, now); E._fx = DE.Effects.compute(E); const [a, b] = Object.values(E.survivors);
  a.infection = { sev: .9, known: true, ward: null, prev: null, since: 3 }; b.immuneUntil = 999;
  const L = DE.Save.sanitize(JSON.parse(JSON.stringify(E)));
  assert(L.survivors[a.id].infection && Math.abs(L.survivors[a.id].infection.sev - .9) < 1e-9 && L.survivors[a.id].infection.known); assert(L.survivors[b.id].immuneUntil === 999);
  Object.values(E.survivors).forEach(v => { v.act.room = 'r1'; v.immuneUntil = 0; }); a.hp = 100; a.infection.sev = .6;
  const orig = Math.random; Math.random = () => .0001; let spread = 0;
  try { for (let i = 0; i < 3; i++) { E._events = []; DE.Infection.tick(E, 1, E._fx); E.playtime += 1; spread += E._events.filter(e => e.type === 'spread').length; } } finally { Math.random = orig; }
  assert(spread >= 1, 'spread to a roommate');
});

console.log('Gear & minigames');
t('forge: research gates recipes; quality follows the score; armory gear makes guards stronger', () => {
  const E = DE.State.create(null, now); for (const k in E.resources) E.resources[k] = 1e6; E._fx = DE.Effects.compute(E);
  assert(!DE.Gear.canCraft(E, 'pistol').ok, 'needs a forge');
  DE.Bunker.placeRoom(E, 'forge', 1, 6, 1, now); E._fx = null;
  assert(DE.Gear.canCraft(E, 'pistol').ok); assert(!DE.Gear.canCraft(E, 'rifle').ok && DE.Gear.canCraft(E, 'rifle').locked, 'rifle needs metalwork + forge 5');
  const lo = DE.Gear.craft(E, 'pistol', .1), hi = DE.Gear.craft(E, 'pistol', .97);
  assert(lo.ok && lo.quality.id === 'crude' && hi.quality.id === 'master', lo.quality.id + '/' + hi.quality.id); assert(hi.item.max > lo.item.max, 'better durability');
  const g = Object.values(E.survivors)[0]; DE.Survivors.assign(E, g.id, { kind: 'guard' }); E._fx = null;
  const p0 = DE.Defense.defensePower(E).guardDps;
  DE.Gear.equip(E, hi.item.id, g.id); E.gear.ammo = 50; const p1 = DE.Defense.defensePower(E).guardDps;
  assert(p1 > p0 * 1.25, 'pistol helps ' + p0.toFixed(1) + ' → ' + p1.toFixed(1));
  E.gear.ammo = 0; assert(DE.Defense.defensePower(E).guardDps < p1, 'no ammo, less use');
  E.gear.ammo = 50; const before = hi.item.dur; const w = DE.Gear.afterWave(E, { breach: false, injured: [] });
  assert(hi.item.dur === before - 1 && w.rounds === 1 && E.gear.ammo === 49, 'wear and rounds');
  assert(DE.Gear.craft(E, 'ammo', .5).amount > 0);
  const L = DE.Save.sanitize(JSON.parse(JSON.stringify(E))); assert(L.gear.items.length === 2 && L.gear.items.find(i => i.id === hi.item.id).owner === g.id, 'gear saved');
});
t('minigames: cooldown, mastery, tier; grid pays power and a generator buff; range drills guards', () => {
  const E = DE.State.create(null, now); E._fx = DE.Effects.compute(E); E.resources.electricity = 0;
  assert(DE.Minigames.canPlay(E, 'grid').ok, 'generator room plays the grid');
  const r = DE.Minigames.finish(E, 'grid', .95, {}); assert(r.rewards.electricity > 0 && E.buffs.some(b => b.room === 'generator'), 'power and buff');
  assert(!DE.Minigames.canPlay(E, 'grid').ok, 'cooldown'); E.playtime += 400; assert(DE.Minigames.canPlay(E, 'grid').ok, 'ready again');
  assert(DE.Minigames.level(E, 'grid') >= 1 && E.mg.best.grid === .95);
  assert(!DE.Minigames.canPlay(E, 'range').ok, 'needs a training room');
  DE.Bunker.placeRoom(E, 'training', 1, 6, 1, now); const g = Object.values(E.survivors)[0]; DE.Survivors.assign(E, g.id, { kind: 'guard' }); E._fx = null;
  const p0 = DE.Defense.defensePower(E).guardDps; DE.Minigames.finish(E, 'range', .9, {});
  assert(g.training >= 1 && g.drill.until > E.playtime, 'trained and drilled'); assert(DE.Defense.defensePower(E).guardDps > p0, 'stronger after a drill');
});
t('minigames: triage heals the real injured and treats infection; radio can bring a survivor', () => {
  const E = DE.State.create(null, now); E._fx = DE.Effects.compute(E); DE.Bunker.placeRoom(E, 'medbay', 1, 6, 1, now); E._fx = null;
  const [a, b] = Object.values(E.survivors); a.hp = 30; b.infection = { sev: .5, known: true, ward: null, prev: null, since: 0 };
  DE.Minigames.finish(E, 'triage', .8, { treated: [{ id: a.id, ok: true }, { id: b.id, ok: true, cure: true }] });
  assert(a.hp > 60, 'healed'); assert(!b.infection || b.infection.sev < .3, 'infection pushed back');
  const q = Object.values(E.rooms).find(r => r.type === 'quarters'); q.level = 5; E._fx = null; const n = Object.keys(E.survivors).length;
  DE.Bunker.placeRoom(E, 'radio', 1, 8, 1, now); DE.Minigames.finish(E, 'radio', .9, { signal: 'survivor' });
  assert(Object.keys(E.survivors).length === n + 1, 'a survivor followed the directions');
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
  assert(Object.keys(N.rooms).length === 2 && N.floors.length === 1 && !N.excavation, 'fresh run: nothing carried over');
  assert(Object.values(N.survivors).every(v => !v.assignment || (v.assignment.kind === 'room' && N.rooms[v.assignment.id])), 'no stale assignments');
  N.prestige.points = 100;
  assert(DE.Prestige.buy(N, 'hands').ok); assert(DE.Prestige.buy(N, 'tunnels').ok); assert(DE.Prestige.buy(N, 'friends').ok);
  const N2 = DE.Prestige.reset(Object.assign(N, { stats: Object.assign(N.stats, { runScore: 5e6, maxDepth: 3 }) }), now).state;
  assert(N2.floors.length === 2, 'tunnels gives extra floor'); assert(Object.keys(N2.survivors).length === 5, 'friends: 4 starters + 1');
  assert(DE.Effects.compute(N2).globalMult >= 0.1);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
