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

/* Expedition locations. duration in seconds, danger = chance each member is injured. */
DE.Data.LOCATIONS = [
  { id: 'suburbs', name: 'Suburbs', icon: '🏘️', duration: 240, danger: 0.1, minDepth: 1,
    desc: 'Pantries and garden sheds. Low risk.',
    loot: { food: [40, 120], water: [30, 90], scrap: [30, 80] }, rescue: 0.15 },
  { id: 'gas', name: 'Gas Station', icon: '⛽', duration: 480, danger: 0.2, minDepth: 1,
    desc: 'Pumps and wrecked cars. Fuel and scrap.',
    loot: { fuel: [40, 110], scrap: [50, 120] }, rescue: 0.05 },
  { id: 'hospital', name: 'Hospital', icon: '🏥', duration: 720, danger: 0.3, minDepth: 2,
    desc: 'Medicine, notes, and plenty of patients who never left.',
    loot: { research: [50, 140], food: [20, 60] }, rescue: 0.3 },
  { id: 'mall', name: 'Shopping Mall', icon: '🏬', duration: 1200, danger: 0.3, minDepth: 2,
    desc: 'Big haul, big crowd.',
    loot: { scrap: [120, 300], food: [80, 200], concrete: [30, 90] }, rescue: 0.2 },
  { id: 'base', name: 'Military Base', icon: '🪖', duration: 1800, danger: 0.5, minDepth: 4,
    desc: 'Heavily infested. Heavily stocked.',
    loot: { scrap: [300, 700], fuel: [150, 300], research: [200, 400], concrete: [100, 250] }, rescue: 0.1 },
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
