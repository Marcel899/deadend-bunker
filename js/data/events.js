/* Living-world content: the expedition bus, expedition encounters with decisions, bunker events,
 * survivor personal events, trader offers, artifacts (unique permanent finds), zombie wave
 * mutations and the objective ladder. Effects use plain keys consumed by DE.Events.apply:
 *   loot:{res:n}  lootMult:x  injure:[chance,amount]  rescue:bool  artifact:'id'|'random'
 *   morale:n  scrap/food/water/fuel/research/concrete: n (cost if negative)  rep:{faction:n}
 *   recruit:bool  xp:n  bond:n  shock:n  noiseCalm:sec  heal:n */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.BUS = [
  { level: 1, name: 'Pickup truck', desc: 'A dented pickup. Three seats, no armour.', capacity: 3, speed: 1, safety: 0, cargo: 1, cost: null },
  { level: 2, name: 'Armoured van', desc: 'Steel plates on the doors, a roof rack. Four seats, 15% safer, 20% more cargo.', capacity: 4, speed: 0.9, safety: 0.15, cargo: 1.2, cost: { scrap: 600, concrete: 80 } },
  { level: 3, name: 'Expedition bus', desc: 'A school bus turned fortress: six seats, bunks, a mounted gun. 30% safer, faster, +50% cargo.', capacity: 6, speed: 0.75, safety: 0.3, cargo: 1.5, cost: { scrap: 2600, concrete: 500, fuel: 200 } },
  { level: 4, name: 'Mobile base', desc: 'Bus plus trailer workshop and drone mast. Eight seats, 45% safer, double cargo, scouts spot extra sites.', capacity: 8, speed: 0.6, safety: 0.45, cargo: 2, cost: { scrap: 9000, concrete: 2000, fuel: 800, research: 600 } },
];

DE.Data.FACTIONS = {
  traders: { id: 'traders', name: 'Road Traders', desc: 'Caravans that will deal with anyone who has scrap. Friendly traders discount construction.', bonus: { buildCostMult: -0.04 } },
  militia: { id: 'militia', name: 'Hilltop Militia', desc: 'Hard people with hard rules. Allies lend you their aim.', bonus: { guardDmgMult: 0.06 } },
  growers: { id: 'growers', name: 'Riverside Growers', desc: 'A farming commune downriver. Friends share seed stock.', bonus: { roomMult: 'farm', value: 0.06 } },
};

DE.Data.ARTIFACTS = {
  seedvault: { id: 'seedvault', name: 'Pre-war Seed Vault', icon: 'can', desc: 'Sealed heirloom seeds. Farms, hydroponics and greenhouses +20%.', effects: [{ type: 'roomMult', room: 'farm', value: 0.2 }, { type: 'roomMult', room: 'hydroponics', value: 0.2 }, { type: 'roomMult', room: 'greenhouse', value: 0.2 }] },
  blueprints: { id: 'blueprints', name: 'Engineer’s Blueprints', icon: 'scroll', desc: 'Annotated construction plans. Build costs -12%, build time -15%.', effects: [{ type: 'buildCostMult', value: -0.12 }, { type: 'buildTimeMult', value: -0.15 }] },
  radiocore: { id: 'radiocore', name: 'Military Radio Core', icon: 'flask', desc: 'A hardened transceiver. Research +15%, more callers answer the radio.', effects: [{ type: 'researchSpeed', value: 0.15 }] },
  turretchip: { id: 'turretchip', name: 'Targeting Chip', icon: 'shield', desc: 'Pulled from a downed drone. Turrets +25% damage.', effects: [{ type: 'turretDmgMult', value: 0.25 }] },
  generator: { id: 'generator', name: 'Fusion Cell Prototype', icon: 'power', desc: 'Still warm. Generators +30%, fuel use -20%.', effects: [{ type: 'roomMult', room: 'generator', value: 0.3 }, { type: 'fuelUseMult', value: -0.2 }] },
  medkit: { id: 'medkit', name: 'Field Surgeon’s Kit', icon: 'medal', desc: 'Everything a trauma team needs. Healing x2, toxic injuries -20%.', effects: [{ type: 'healMult', value: 1 }] },
  map: { id: 'map', name: 'Scavenger’s Atlas', icon: 'map', desc: 'Every cache marked in pencil. Expedition loot +25%.', effects: [{ type: 'lootBonusAdd', value: 0.25 }] },
  bell: { id: 'bell', name: 'Church Bell', icon: 'badge', desc: 'Rung before every wave. +15 morale, waves come 10% less often.', effects: [{ type: 'moraleBonus', value: 15 }, { type: 'waveIntervalMult', value: 0.1 }] },
};

/* ---- expedition encounters: a decision when a team is out ---- */
DE.Data.ENCOUNTERS = [
  { id: 'pharmacy', tags: ['suburbs', 'hospital', 'mall'], title: 'A locked pharmacy', text: 'The shutters are down but intact. Someone sealed this place before the end. The team can force it, or move on while the street is quiet.',
    choices: [{ label: 'Force the shutters', desc: 'Medicine and chemicals, but the noise draws attention.', effects: { loot: { research: 60, fuel: 40 }, injure: [0.35, 25], heal: 10 } }, { label: 'Move on', desc: 'Keep what you have.', effects: {} }] },
  { id: 'survivor', tags: ['suburbs', 'gas', 'mall', 'hospital'], title: 'Someone is hiding in the attic', text: 'A voice from upstairs. They say they can work. They also say they have not eaten in four days.',
    choices: [{ label: 'Bring them home', desc: 'A new survivor, if there is room. Costs 40 food on the road.', effects: { recruit: true, food: -40 } }, { label: 'Leave supplies, move on', desc: '+1 reputation with the Growers.', effects: { food: -20, rep: { growers: 1 } } }] },
  { id: 'caravan', tags: ['gas', 'suburbs', 'base'], title: 'Road Traders on the highway', text: 'An armoured caravan flags the team down. They are short on fuel and long on scrap.',
    choices: [{ label: 'Trade 60 fuel for 400 scrap', desc: 'And a better name with the traders.', effects: { fuel: -60, scrap: 400, rep: { traders: 1 } } }, { label: 'Wave and keep driving', desc: 'No deal.', effects: {} }, { label: 'Rob them', desc: 'Big haul, people get hurt, the traders remember.', effects: { scrap: 900, fuel: 120, injure: [0.6, 35], rep: { traders: -2 }, morale: -5 } }] },
  { id: 'horde', tags: ['hospital', 'mall', 'base'], title: 'The horde is between you and the truck', text: 'Forty walkers in the car park. The team can wait them out in the dark, or sprint with what they can carry.',
    choices: [{ label: 'Wait it out', desc: 'Slower, safer, lose some of the haul to rot.', effects: { lootMult: 0.7 } }, { label: 'Run for it', desc: 'Full haul if nobody falls.', effects: { injure: [0.5, 40], xp: 80 } }] },
  { id: 'vault', tags: ['base', 'hospital', 'mall'], title: 'A sealed basement', text: 'Blast door, pre-war lock, a faint hum behind it. Cutting through takes most of the night.',
    choices: [{ label: 'Cut it open', desc: 'Whatever is in there, nobody else has it.', effects: { artifact: 'random', fuel: -30, injure: [0.2, 20] } }, { label: 'Mark it on the map', desc: 'Come back another day. +100 research.', effects: { research: 100 } }] },
  { id: 'militia', tags: ['base', 'gas'], title: 'Hilltop Militia checkpoint', text: 'Sandbags, a machine gun, a woman with a clipboard. They want to know who you are.',
    choices: [{ label: 'Share ammunition', desc: '-150 scrap, +2 militia reputation.', effects: { scrap: -150, rep: { militia: 2 } } }, { label: 'Share information', desc: 'Tell them about the horde routes. +1 reputation, +60 research.', effects: { rep: { militia: 1 }, research: 60 } }, { label: 'Turn around', desc: 'Lose a third of the haul backtracking.', effects: { lootMult: 0.66 } }] },
  { id: 'bus', tags: ['suburbs', 'gas'], title: 'A school bus on its side', text: 'The engine looks whole. With a day of work it could be dragged home.',
    choices: [{ label: 'Drag it home', desc: 'Materials for the next bus upgrade: +500 scrap, +40 fuel.', effects: { scrap: 500, fuel: 40 } }, { label: 'Strip the seats', desc: '+120 scrap, quick and quiet.', effects: { scrap: 120 } }] },
  { id: 'quiet', tags: ['suburbs', 'gas', 'hospital', 'mall', 'base'], title: 'An uneventful trip', text: 'For once the road is empty and the team comes home singing. Morale +4.', choices: [{ label: 'Good', desc: '', effects: { morale: 4, bond: 10 } }] },
];

/* ---- bunker events: things that happen at home ---- */
DE.Data.BUNKER_EVENTS = [
  { id: 'pipe', weight: 3, title: 'Burst pipe', cond: (s) => s.resources.water > 50, text: 'A main in the lower corridor let go overnight. Water is pouring into the rock.',
    choices: [{ label: 'Patch it now', desc: '-80 scrap.', effects: { scrap: -80 } }, { label: 'Let it drain', desc: 'Lose 25% of stored water.', effects: { waterPct: -0.25 } }] },
  { id: 'stranger', weight: 3, title: 'A stranger at the gate', cond: (s) => DE.Bunker.population(s) < DE.Bunker.housingCapacity(s), text: 'A thin man with a rifle and a bite-shaped bandage on his arm asks to come in.',
    choices: [{ label: 'Let him in', desc: 'A survivor joins. 30% chance he was infected: the medbay fills for a while.', effects: { recruit: true, risk: [0.3, 'shock', 10] } }, { label: 'Turn him away', desc: 'Morale -3.', effects: { morale: -3 } }, { label: 'Quarantine first', desc: 'Needs a Quarantine Ward or Infirmary. Safe recruit.', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && (r.type === 'quarantine' || r.type === 'infirmary')), effects: { recruit: true } }] },
  { id: 'argument', weight: 2, title: 'Argument in the canteen', cond: (s) => DE.Bunker.population(s) >= 4, text: '{A} and {B} are shouting about who ate the last tin. Half the bunker is picking sides.',
    choices: [{ label: 'Let them sort it out', desc: 'Morale -4 for a while.', effects: { shock: 6 } }, { label: 'Throw a dinner', desc: '-60 food, everyone calms down and the two make up.', effects: { food: -60, morale: 3, bondAB: 25 } }] },
  { id: 'birthday', weight: 2, title: '{A}’s birthday', text: 'Somebody found a candle. {A} has not had a birthday in two years.',
    choices: [{ label: 'Celebrate', desc: '-30 food, +5 morale, {A} gains experience.', effects: { food: -30, morale: 5, xpA: 120 } }, { label: 'Work goes on', desc: 'Nothing happens.', effects: {} }] },
  { id: 'nightmare', weight: 2, title: '{A} cannot sleep', text: 'Nightmares about the surface. {A} is exhausted and asks for a day off.',
    choices: [{ label: 'Give the day off', desc: '{A} rests fully; production dips slightly.', effects: { restA: true } }, { label: 'Everyone works', desc: '{A} loses 30 energy, morale -2.', effects: { energyA: -30, morale: -2 } }] },
  { id: 'trader', weight: 3, title: 'Road Traders at the fence', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && (r.type === 'radio' || r.type === 'comms')), text: 'A caravan heard your broadcast. Two offers, good for today only.', trade: true },
  { id: 'generatorfail', weight: 2, title: 'Generator coughing', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && r.type === 'generator'), text: 'The diesel is sputtering. A mechanic says it needs new injectors.',
    choices: [{ label: 'Replace injectors', desc: '-120 scrap. Generators +15% for an hour.', effects: { scrap: -120, buff: ['generator', 0.15, 3600] } }, { label: 'Nurse it along', desc: 'Lose 20% of stored power.', effects: { electricityPct: -0.2 } }] },
  { id: 'discovery', weight: 1, title: 'Something in the rock', cond: (s) => s.floors.length >= 3, text: 'Digging crews broke into a pocket of old concrete. There is a crate inside.',
    choices: [{ label: 'Open it', desc: 'Random artifact, or a lot of scrap.', effects: { artifactOrScrap: 400 } }] },
  { id: 'militiavisit', weight: 1, title: 'Militia patrol', cond: (s) => (s.rep && s.rep.militia || 0) >= 2, text: 'The Hilltop Militia drop off two crates of ammunition and ask for nothing. Allies, apparently.', choices: [{ label: 'Thank them', desc: '+6 traps, +1 reputation.', effects: { traps: 6, rep: { militia: 1 } } }] },
  { id: 'growers', weight: 1, title: 'Seed delivery', cond: (s) => (s.rep && s.rep.growers || 0) >= 2, text: 'A Riverside Growers cart leaves sacks at the gate.', choices: [{ label: 'Accept', desc: '+300 food.', effects: { food: 300 } }] },
  { id: 'quiet', weight: 2, title: 'A quiet night', text: 'No alarms, no breaches, nobody hurt. {A} plays guitar in the corridor.', choices: [{ label: 'Listen', desc: '+3 morale, friendships deepen.', effects: { morale: 3, bond: 8 } }] },
];

DE.Data.TRADES = [
  { give: { scrap: 500 }, get: { fuel: 60 } }, { give: { food: 300 }, get: { scrap: 350 } }, { give: { fuel: 80 }, get: { concrete: 120 } },
  { give: { scrap: 900 }, get: { research: 150 } }, { give: { water: 300 }, get: { food: 260 } }, { give: { concrete: 150 }, get: { fuel: 140 } }, { give: { research: 120 }, get: { scrap: 1200 } },
];

/* ---- wave mutations: announced in advance from wave 8 on ---- */
DE.Data.MUTATIONS = [
  { id: 'armored', name: 'Armoured horde', desc: 'Thick hides: +30% horde HP, loot +40%.', hp: 1.3, dmg: 1, loot: 1.4 },
  { id: 'fast', name: 'Runner swarm', desc: 'Fast and furious: wall damage x1.5, but 20% less HP.', hp: 0.8, dmg: 1.5, loot: 1 },
  { id: 'toxic', name: 'Toxic cloud', desc: 'The horde reeks: guards exposed to gas, +50% loot.', hp: 1, dmg: 1, loot: 1.5, toxic: 3 },
  { id: 'giant', name: 'Giants', desc: 'Brutes and mutants lead: +60% HP, wall damage x1.3, loot x2.', hp: 1.6, dmg: 1.3, loot: 2 },
  { id: 'weak', name: 'Starving stragglers', desc: 'A thin wave: -35% HP.', hp: 0.65, dmg: 1, loot: 0.7 },
];

/* ---- objective ladder: short, medium and long-term goals with rewards ---- */
DE.Data.GOALS = [
  { id: 'g_canteen', tier: 1, name: 'Open a Canteen', desc: 'Build a Canteen so survivors eat together.', check: (s) => Object.values(s.rooms).some(r => r.type === 'cafeteria' && r.level > 0), reward: { scrap: 150 } },
  { id: 'g_staff', tier: 1, name: 'Everyone works', desc: 'Have no idle survivors for a moment.', check: (s) => DE.Bunker.population(s) >= 4 && DE.Survivors.idle(s).length === 0, reward: { food: 120, water: 120 } },
  { id: 'g_wave3', tier: 1, name: 'Hold the line', desc: 'Survive 3 waves without a breach.', check: (s) => s.stats.wavesSurvived >= 3, reward: { scrap: 200 } },
  { id: 'g_b2', tier: 1, name: 'Dig to B2', desc: 'Excavate a second floor.', check: (s) => s.floors.length >= 2, reward: { research: 40 } },
  { id: 'g_research', tier: 2, name: 'First breakthrough', desc: 'Complete any research.', check: (s) => Object.keys(s.research.done).length >= 1, reward: { research: 60 } },
  { id: 'g_garage', tier: 2, name: 'Wheels', desc: 'Build a Garage and send an expedition.', check: (s) => s.stats.expeditions >= 1, reward: { fuel: 120 } },
  { id: 'g_wing', tier: 2, name: 'Widen a floor', desc: 'Dig a sideways wing on any floor.', check: (s) => s.floors.some(f => f.slots.length > DE.CONFIG.FLOOR_SLOTS), reward: { concrete: 100 } },
  { id: 'g_pop8', tier: 2, name: 'A real settlement', desc: 'Reach 8 survivors.', check: (s) => DE.Bunker.population(s) >= 8, reward: { morale: 10, food: 300 } },
  { id: 'g_bus', tier: 2, name: 'Better wheels', desc: 'Upgrade the expedition vehicle.', check: (s) => (s.bus && s.bus.level || 1) >= 2, reward: { scrap: 400 } },
  { id: 'g_friends', tier: 3, name: 'Friends', desc: 'Two survivors become friends.', check: (s) => Object.values(s.survivors).some(v => v.bonds && Object.values(v.bonds).some(b => b >= 60)), reward: { morale: 8 } },
  { id: 'g_wave10', tier: 3, name: 'Veteran defenders', desc: 'Survive wave 10.', check: (s) => s.defense.wave > 10, reward: { scrap: 1200, research: 200 } },
  { id: 'g_tier2', tier: 3, name: 'Improved infrastructure', desc: 'Build any Tier 2 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 2), reward: { concrete: 200 } },
  { id: 'g_artifact', tier: 3, name: 'Relic hunter', desc: 'Find an artifact on an expedition.', check: (s) => Object.keys(s.artifacts || {}).length >= 1, reward: { research: 300 } },
  { id: 'g_b5', tier: 3, name: 'Deep bunker', desc: 'Reach B5.', check: (s) => s.floors.length >= 5, reward: { scrap: 2500 } },
  { id: 'g_faction', tier: 4, name: 'Allies', desc: 'Reach reputation 3 with any faction.', check: (s) => s.rep && Object.values(s.rep).some(v => v >= 3), reward: { scrap: 3000, fuel: 400 } },
  { id: 'g_tier3', tier: 4, name: 'Advanced facilities', desc: 'Build any Tier 3 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 3), reward: { research: 800 } },
  { id: 'g_wave25', tier: 4, name: 'Siege survivors', desc: 'Survive wave 25.', check: (s) => s.defense.wave > 25, reward: { scrap: 8000 } },
  { id: 'g_pop20', tier: 4, name: 'Underground town', desc: 'Reach 20 survivors.', check: (s) => DE.Bunker.population(s) >= 20, reward: { morale: 15 } },
  { id: 'g_tier4', tier: 5, name: 'High technology', desc: 'Build any Tier 4 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 4), reward: { research: 3000 } },
  { id: 'g_ark', tier: 5, name: 'Preserve humanity', desc: 'Build the Ark Habitat.', check: (s) => Object.values(s.rooms).some(r => r.type === 'ark' && r.level > 0), reward: { morale: 30 } },
  { id: 'g_prestige', tier: 5, name: 'Reconstruction', desc: 'Reach the point where the bunker can be rebuilt from memory (B3 and 3 Legacy Points).', check: (s) => DE.Prestige.canReset(s).ok, reward: { research: 500 } },
];
