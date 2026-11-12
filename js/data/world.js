/* Zombies, abandoned facilities, expedition locations and legacy (prestige) upgrades. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

/* Zombie types. hp = health, dmg = wall damage multiplier when they reach the wall,
 * minWave = first wave they appear in, toxic = injures guards more, boss = one per boss wave. */
DE.Data.ZOMBIES = [
  { id: 'walker', name: 'Walker', icon: '🧟',    hp: 20,   dmg: 1,   weight: 6, minWave: 1,  desc: 'Slow, numerous, dumb.' },
  { id: 'runner', name: 'Runner', icon: '🧟‍♂️', hp: 35,   dmg: 1.2, weight: 3, minWave: 2,  desc: 'Fast. Reaches the wall first.' },
  { id: 'brute',  name: 'Brute',  icon: '🧟‍♀️', hp: 120,  dmg: 2,   weight: 1, minWave: 4,  desc: 'Hits the wall like a truck.' },
  { id: 'toxic',  name: 'Toxic',  icon: '🤢',    hp: 60,   dmg: 1,   weight: 1, minWave: 7,  toxic: true, desc: 'Bursts into poison gas — guards get sick.' },
  { id: 'crawler', name: 'Crawler', icon: '🧟',  hp: 25,   dmg: 0.8, weight: 2, minWave: 3,  desc: 'Legless and low. Slips under fire.' },
  { id: 'bomber', name: 'Bomber',  icon: '🧨',   hp: 40,   dmg: 3,   weight: 0.8, minWave: 6, desc: 'Strapped with dynamite. Explodes on the wall.' },
  { id: 'leaper', name: 'Leaper',  icon: '🦘',   hp: 45,   dmg: 1.4, weight: 1.2, minWave: 5, desc: 'Vaults sandbags. Traps rarely catch it.' },
  { id: 'armored', name: 'Riot Walker', icon: '🛡️', hp: 160, dmg: 1.5, weight: 0.8, minWave: 8, desc: 'Still wearing the riot gear it died in.' },
  { id: 'cultist', name: 'Cultist', icon: '🔮',  hp: 90,   dmg: 1.2, weight: 0.5, minWave: 9, toxic: true, desc: 'Something glows in its hands. Guards get sick.' },
  { id: 'mutant', name: 'Mutant', icon: '👹',    hp: 300,  dmg: 2.5, weight: 0.6, minWave: 12, desc: 'Something went very wrong.' },
  { id: 'boss',   name: 'Colossus', icon: '🦖',  hp: 0.35, dmg: 4,   weight: 0, minWave: 10, boss: true, desc: 'Every 10th wave. hp = 35% of the horde.' },
];
DE.Data.BOSS_EVERY = 10;

/* Facilities found while excavating. `room` is the unique room placed on the new floor. */
DE.Data.FACILITIES = [
  { id: 'lab',   name: 'Abandoned Laboratory', icon: '🧫', room: 'server',     weight: 3, minDepth: 3,
    lore: 'Fluorescent lights flicker over rows of servers still crunching pre-war data.' },
  { id: 'vent',  name: 'Geothermal Vent',      icon: '🌋', room: 'geothermal', weight: 3, minDepth: 3,
    lore: 'The rock is warm to the touch. Someone already bolted a turbine to the vent.' },
  { id: 'lake',  name: 'Underground Lake',     icon: '🌊', room: 'aquifer',    weight: 3, minDepth: 3,
    lore: 'A black, glassy lake stretches into the dark. The water is cold and clean.' },
  { id: 'mine',  name: 'Collapsed Mine Shaft', icon: '⛏️', room: 'orevein',    weight: 3, minDepth: 3,
    lore: 'Old rail tracks lead to a glittering seam of ore nobody got to finish mining.' },
  { id: 'depot', name: 'Military Depot',       icon: '🎖️', room: 'cache',      weight: 2, minDepth: 4,
    lore: 'Stencilled crates, still sealed. The army left in a hurry.' },
  { id: 'dorm',  name: 'Sealed Dormitory',     icon: '🚪', room: 'dormitory',  weight: 2, minDepth: 3,
    lore: 'Rows of bunks behind a blast door. Dusty, but dry and safe.' },
];

/* Expedition locations. duration in seconds, danger = chance each member is injured, rescue = chance
 * to bring someone home. map = position on the expedition map (1000 x 380, the bunker sits at the left),
 * icon = HUD icon key, tags = which encounters can happen on the way. finds = rare discoveries rolled
 * when the team returns (effects use the same keys as events). mats = rare materials per trip [min, max]
 * (more the better the place is explored). Collectibles and blueprints found there: js/data/finds.js
 * and the rooms' blueprint field. */
DE.Data.LOCATIONS = [
  { id: 'suburbs', mats: { chem: [0, 1] }, name: 'Suburbs', icon: 'home', map: [250, 250], duration: 240, danger: 0.1, minDepth: 1, tags: ['suburbs', 'road'],
    desc: 'Pantries, garden sheds and garages. Low risk, steady haul.',
    loot: { food: [40, 120], water: [30, 90], scrap: [30, 80] }, rescue: 0.15,
    finds: [{ chance: 0.12, text: 'A hidden pantry behind a false wall', effects: { gain: { food: 4, water: 3 } } }, { chance: 0.06, text: 'A toolbox nobody looted', effects: { gain: { scrap: 5 } } }] },
  { id: 'farmland', mats: { chem: [1, 2] }, name: 'Overgrown Farmland', icon: 'chest', map: [205, 110], duration: 360, danger: 0.12, minDepth: 1, tags: ['farmland', 'road'],
    desc: 'Fields gone wild, silos and a farmhouse. Food, seed stock and the odd straggler.',
    loot: { food: [90, 200], water: [20, 60] }, rescue: 0.12,
    finds: [{ chance: 0.18, text: 'Sealed seed stock', effects: { buff: ['farm', 0.3, 600] } }, { chance: 0.08, text: 'A farmer’s diary of the outbreak', effects: { gain: { research: 3 } } }] },
  { id: 'gas', mats: { alloy: [0, 1], chem: [0, 1] }, name: 'Gas Station', icon: 'barrel', map: [370, 300], duration: 480, danger: 0.2, minDepth: 1, tags: ['gas', 'road'],
    desc: 'Pumps and wrecked cars. Fuel and scrap.',
    loot: { fuel: [40, 110], scrap: [50, 120] }, rescue: 0.05,
    finds: [{ chance: 0.15, text: 'An underground tank still half full', effects: { gain: { fuel: 5 } } }] },
  { id: 'police', mats: { circuits: [1, 2] }, name: 'Police Station', icon: 'shield', map: [430, 165], duration: 600, danger: 0.28, minDepth: 2, tags: ['police', 'city'],
    desc: 'Cells, an evidence room and a locked armoury. Scrap, gear and paperwork.',
    loot: { scrap: [90, 210], research: [20, 60] }, rescue: 0.12,
    finds: [{ chance: 0.2, text: 'Riot gear and caltrops', effects: { traps: 4 } }, { chance: 0.08, text: 'The evidence locker', effects: { artifactOr: 6 } }] },
  { id: 'hospital', mats: { chem: [1, 3] }, name: 'Hospital', icon: 'hospital', map: [540, 260], duration: 720, danger: 0.3, minDepth: 2, tags: ['hospital', 'city'],
    desc: 'Medicine, notes, and plenty of patients who never left.',
    loot: { research: [50, 140], food: [20, 60] }, rescue: 0.3,
    finds: [{ chance: 0.2, text: 'A sealed crate of medical supplies', effects: { heal: 30 } }, { chance: 0.06, text: 'A surgeon’s field kit', effects: { artifactOr: 5 } }] },
  { id: 'waterplant', mats: { chem: [1, 2], alloy: [0, 1] }, name: 'Water Treatment Plant', icon: 'water', map: [330, 55], duration: 540, danger: 0.2, minDepth: 2, tags: ['waterplant', 'road'],
    desc: 'Settling tanks and a chemical store. Clean water and chemistry.',
    loot: { water: [120, 260], research: [20, 50] }, rescue: 0.06,
    finds: [{ chance: 0.2, text: 'Unopened filter cartridges', effects: { buff: ['water', 0.3, 600] } }] },
  { id: 'mall', mats: { circuits: [1, 2], alloy: [0, 1] }, name: 'Shopping Mall', icon: 'coins', map: [650, 145], duration: 1200, danger: 0.3, minDepth: 2, tags: ['mall', 'city'],
    desc: 'Big haul, big crowd.',
    loot: { scrap: [120, 300], food: [80, 200], concrete: [30, 90] }, rescue: 0.2,
    finds: [{ chance: 0.12, text: 'A stockroom behind the escalators', effects: { gain: { food: 5, scrap: 5 } } }] },
  { id: 'factory', mats: { alloy: [2, 4] }, name: 'Abandoned Factory', icon: 'factory', map: [652, 312], duration: 1500, danger: 0.35, minDepth: 3, tags: ['factory', 'industrial'],
    desc: 'Assembly halls and a cement silo. Scrap and concrete by the truckload.',
    loot: { scrap: [200, 450], concrete: [60, 160] }, rescue: 0.08,
    finds: [{ chance: 0.2, text: 'Spare machine parts', effects: { buff: ['workshop', 0.35, 900] } }, { chance: 0.06, text: 'A drafting office full of plans', effects: { artifactOr: 7 } }] },
  { id: 'trainyard', mats: { alloy: [1, 3], cells: [0, 1] }, name: 'Rail Yard', icon: 'construction', map: [760, 260], duration: 1320, danger: 0.3, minDepth: 3, tags: ['trainyard', 'industrial'],
    desc: 'Tank cars and freight wagons stranded on the tracks.',
    loot: { fuel: [120, 260], scrap: [100, 240], concrete: [40, 120] }, rescue: 0.08,
    finds: [{ chance: 0.15, text: 'A tank car of diesel', effects: { gain: { fuel: 7 } } }] },
  { id: 'radiotower', mats: { circuits: [2, 3] }, name: 'Radio Tower', icon: 'signal', map: [800, 70], duration: 960, danger: 0.25, minDepth: 4, tags: ['radiotower', 'road'],
    desc: 'A broadcast station on the ridge. Frequencies, logs and old military codes.',
    loot: { research: [120, 260], scrap: [60, 140] }, rescue: 0.1,
    finds: [{ chance: 0.25, text: 'A list of survivor frequencies', effects: { rep: { traders: 1, growers: 1 } } }, { chance: 0.08, text: 'An intact military transceiver', effects: { artifactOr: 6 } }] },
  { id: 'base', mats: { alloy: [1, 3], cells: [1, 2], circuits: [1, 2] }, name: 'Military Base', icon: 'helmet', map: [880, 190], duration: 1800, danger: 0.5, minDepth: 4, tags: ['base', 'industrial'],
    desc: 'Heavily infested. Heavily stocked.',
    loot: { scrap: [300, 700], fuel: [150, 300], research: [200, 400], concrete: [100, 250] }, rescue: 0.1,
    finds: [{ chance: 0.2, text: 'A crate of mines', effects: { traps: 8 } }, { chance: 0.1, text: 'A sealed armoury', effects: { artifactOr: 8 } }] },
  { id: 'airport', mats: { cells: [2, 3], alloy: [1, 2] }, name: 'Airport', icon: 'gift', map: [915, 296], duration: 2400, danger: 0.55, minDepth: 5, tags: ['airport', 'city'],
    desc: 'Cargo planes on the apron and a terminal full of the dead. The biggest haul on the map.',
    loot: { fuel: [250, 500], scrap: [300, 650], food: [150, 300] }, rescue: 0.15,
    finds: [{ chance: 0.2, text: 'A cargo hold of relief supplies', effects: { gain: { food: 8, water: 8 } } }, { chance: 0.12, text: 'A diplomatic pouch', effects: { artifactOr: 10 } }] },
  { id: 'cdclab', mats: { circuits: [2, 4], chem: [2, 3], cells: [1, 2] }, name: 'CDC Research Lab', icon: 'labbuilding', map: [925, 46], duration: 2100, danger: 0.5, minDepth: 6, tags: ['cdclab', 'city'],
    desc: 'Where they studied the outbreak. Samples, servers and a lot of locked doors.',
    loot: { research: [350, 700], concrete: [80, 200] }, rescue: 0.1,
    finds: [{ chance: 0.3, text: 'A cold-storage sample vault', effects: { gain: { research: 8 } } }, { chance: 0.15, text: 'A prototype in a sealed case', effects: { artifact: 'random' } }] },
];

/* Legacy upgrades bought with Legacy Points after a Reconstruction. */
DE.Data.LEGACY = {
  contacts: { id: 'contacts', name: 'Old Contacts',     icon: '🤝', max: 2, cost: 3, growth: 2,
    desc: 'Start each run known to the Road Traders (+1 reputation) and with the next expedition vehicle', effects: [{ type: 'startRep', value: 1 }] },
  hands:    { id: 'hands',    name: 'Veteran Hands',   icon: '✋', max: 20, cost: 2, growth: 1.5,
    desc: '+10% all production per level', effects: [{ type: 'globalMult', value: 0.1 }] },
  stock:    { id: 'stock',    name: 'Stockpile',       icon: '🧰', max: 10, cost: 1, growth: 1.4,
    desc: 'Start with +400 food, water, scrap and fuel per level', effects: [{ type: 'startResources', value: 400 }] },
  friends:  { id: 'friends',  name: 'Old Friends',     icon: '🤝', max: 6,  cost: 3, growth: 1.6,
    desc: '+1 starting survivor per level', effects: [{ type: 'startSurvivors', value: 1 }] },
  tunnels:  { id: 'tunnels',  name: 'Mapped Tunnels',  icon: '🗺️', max: 3,  cost: 5, growth: 2,
    desc: 'Start with +1 floor already excavated per level', effects: [{ type: 'startFloors', value: 1 }] },
  archive:  { id: 'archive',  name: 'Archive',         icon: '📚', max: 10, cost: 2, growth: 1.5,
    desc: 'Research +15% faster per level', effects: [{ type: 'researchSpeed', value: 0.15 }] },
  autonomy: { id: 'autonomy', name: 'Autonomy',        icon: '🕰️', max: 6,  cost: 3, growth: 1.5,
    desc: 'Offline cap +4 hours per level', effects: [{ type: 'offlineCapHours', value: 4 }] },
  scars:    { id: 'scars',    name: 'Battle Scars',    icon: '⚔️', max: 10, cost: 2, growth: 1.5,
    desc: 'Wall HP and guard damage +15% per level', effects: [{ type: 'wallHpMult', value: 0.15 }, { type: 'guardDmgMult', value: 0.15 }] },
  prints:   { id: 'prints',   name: 'Blueprints',      icon: '📐', max: 8,  cost: 3, growth: 1.5,
    desc: 'Build & upgrade costs -5%, build time -10% per level', effects: [{ type: 'buildCostMult', value: -0.05 }, { type: 'buildTimeMult', value: -0.10 }] },
  patience: { id: 'patience', name: 'Quiet Nights',    icon: '🌃', max: 5,  cost: 4, growth: 1.6,
    desc: 'Zombie waves come 10% less often per level', effects: [{ type: 'waveIntervalMult', value: 0.10 }] },
  science:  { id: 'science',  name: 'Inherited Science', icon: '🧬', max: 2, cost: 8, growth: 2.5,
    desc: 'Start each run with research tier 1 (then tier 2) already completed', effects: [{ type: 'startResearchTier', value: 1 }] },
  digger:   { id: 'digger',   name: 'Deep Roots',      icon: '🪨', max: 8,  cost: 2, growth: 1.5,
    desc: 'Excavation cost and time -8% per level', effects: [{ type: 'excavationCostMult', value: -0.08 }, { type: 'excavationTimeMult', value: -0.08 }] },
};
DE.Data.LEGACY_ORDER = ['contacts', 'hands', 'stock', 'friends', 'tunnels', 'science', 'archive', 'autonomy', 'scars', 'prints', 'digger', 'patience'];

/* Geology under the bunker, top to bottom. Every floor sits in one layer. Deeper layers are
 * harder (more work for the mining crew), need better equipment (research) and a bigger Mining
 * Station (mine = its level) before digging can start, and their rubble pays out in a different
 * material (spoils: share of the dig's cost value returned as that resource; miners also quarry
 * it between digs). The cutaway (js/ui/geology.js) paints these as continuous bands. */
DE.Data.STRATA = [
  { id: 'topsoil', name: 'Topsoil', from: 1, to: 2, hardness: 1, tool: 'Shovels & picks', research: null, mine: 0, spoils: { scrap: 0.12 },
    desc: 'Loose earth, roots and old foundations. Anyone with a shovel can dig here.' },
  { id: 'clay', name: 'Packed clay', from: 3, to: 4, hardness: 1.35, tool: 'Picks & timber shoring', research: 'excavation1', mine: 1, spoils: { scrap: 0.08, concrete: 0.12 },
    desc: 'Heavy wet clay. Every metre has to be shored up as the crew goes.' },
  { id: 'limestone', name: 'Limestone', from: 5, to: 6, hardness: 1.8, tool: 'Jackhammers', research: 'machinery', mine: 5, spoils: { concrete: 0.25 },
    desc: 'Pale rock that breaks into good aggregate for concrete.' },
  { id: 'granite', name: 'Granite', from: 7, to: 8, hardness: 2.4, tool: 'Hydraulic drill rig', research: 'excavation2', mine: 12, spoils: { concrete: 0.18, scrap: 0.1 },
    desc: 'Hard grey stone. Drill bits wear out fast.' },
  { id: 'basalt', name: 'Basalt', from: 9, to: 10, hardness: 3.2, tool: 'Deep-core drills', research: 'excavation3', mine: 20, spoils: { scrap: 0.12, research: 0.06 },
    desc: 'Black volcanic rock laced with crystal geodes worth studying.' },
  { id: 'magma', name: 'Magma rock', from: 11, to: 99, hardness: 4.2, tool: 'Thermal borer', research: 'excavation4', mine: 30, spoils: { fuel: 0.12, research: 0.08 },
    desc: 'Hot glassy rock close to the mantle, with pockets of gas and rare minerals.' },
];
DE.Data.stratumAt = function (depth) { return DE.Data.STRATA.find(s => depth >= s.from && depth <= s.to) || DE.Data.STRATA[DE.Data.STRATA.length - 1]; };
