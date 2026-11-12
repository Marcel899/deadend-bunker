/* Living-world content: the expedition bus, expedition encounters with decisions, bunker events,
 * survivor personal events, trader offers, artifacts (unique permanent finds), zombie wave
 * mutations and the objective ladder. Effects use plain keys consumed by DE.Events.apply:
 *   cost:{res:share}  gain:{res:minutes}  haul:{res:minutes}   (scaled, see DE.Events.resolve)
 *   lootMult:x  injure:[chance,amount]  rescue:bool  artifact:'id'|'random'  artifactOr:minutes
 *   morale:n  rep:{faction:n}  recruit:bool  recruitN:n  xp:n  levelA:share of a level  bond:n
 *   shock:n  noiseCalm:sec  heal:n  buff:[room|'*', mult, sec]  waveHp:mult  chain:[event, min, max, chance, hint]
 *   (fixed resource numbers and loot:{res:n} still work for events saved by older versions) */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.BUS = [
  { level: 1, name: 'Pickup truck', desc: 'A dented pickup. Three seats, no armour.', capacity: 3, speed: 1, safety: 0, cargo: 1, cost: null },
  { level: 2, name: 'Armoured van', desc: 'Steel plates on the doors, a roof rack. Four seats, 15% safer, 20% more cargo.', capacity: 4, speed: 0.9, safety: 0.15, cargo: 1.2, cost: { scrap: 600, concrete: 80 } },
  { level: 3, name: 'Expedition bus', desc: 'A school bus turned fortress: six seats, bunks, a mounted gun. 30% safer, faster, +50% cargo.', capacity: 6, speed: 0.75, safety: 0.3, cargo: 1.5, cost: { scrap: 2600, concrete: 500, fuel: 200 } },
  { level: 4, name: 'Mobile base', desc: 'Bus plus trailer workshop and drone mast. Eight seats, 45% safer, double cargo, scouts spot extra sites.', capacity: 8, speed: 0.6, safety: 0.45, cargo: 2, cost: { scrap: 9000, concrete: 2000, fuel: 800, research: 600 }, rare: { alloy: 6, circuits: 4, cells: 3 } },
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

/* ---- expedition encounters: a decision when a team is out ----
 * Amounts scale (see DE.Events.resolve): cost:{r:share of your stock}, haul:{r:minutes of your
 * bunker's output, loaded on the truck}, gain:{r:minutes of output, delivered home}. */
DE.Data.ENCOUNTERS = [
  { id: 'pharmacy', tags: ['suburbs', 'hospital', 'mall', 'city', 'police'], title: 'A locked pharmacy', text: 'The shutters are down but intact. Someone sealed this place before the end. The team can force it, or move on while the street is quiet.',
    choices: [{ label: 'Force the shutters', desc: 'Medicine and chemicals, but the noise draws attention.', effects: { haul: { research: 3, fuel: 2 }, injure: [0.35, 25], heal: 10 } }, { label: 'Move on', desc: 'Keep what you have.', effects: {} }] },
  { id: 'survivor', tags: ['suburbs', 'gas', 'mall', 'hospital', 'farmland', 'city', 'trainyard'], title: 'Someone is hiding in the attic', text: 'A voice from upstairs. They say they can work. They also say they have not eaten in four days.',
    choices: [{ label: 'Bring them home', desc: 'A new survivor, if there is a free bed. They eat on the way.', effects: { recruit: true, cost: { food: 0.05 } } }, { label: 'Leave supplies, move on', desc: 'The Riverside Growers hear about it.', effects: { cost: { food: 0.03 }, rep: { growers: 1 } } }] },
  { id: 'caravan', tags: ['gas', 'suburbs', 'base', 'road', 'trainyard'], title: 'Road Traders on the highway', text: 'An armoured caravan flags the team down. They are short on fuel and long on scrap.',
    choices: [{ label: 'Trade fuel for scrap', desc: 'A fair deal, and a better name with the traders.', effects: { cost: { fuel: 0.15 }, gain: { scrap: 5 }, rep: { traders: 1 } } }, { label: 'Wave and keep driving', desc: 'No deal.', effects: {} }, { label: 'Rob them', desc: 'Big haul, people get hurt, the traders remember.', effects: { haul: { scrap: 9, fuel: 3 }, injure: [0.6, 35], rep: { traders: -2 }, morale: -5 } }] },
  { id: 'horde', tags: ['hospital', 'mall', 'base', 'city', 'airport', 'factory'], title: 'The horde is between you and the truck', text: 'Forty walkers in the car park. The team can wait them out in the dark, or sprint with what they can carry.',
    choices: [{ label: 'Wait it out', desc: 'Slower, safer, lose some of the haul to rot.', effects: { lootMult: 0.7, delay: 90 } }, { label: 'Run for it', desc: 'Full haul if nobody falls.', effects: { injure: [0.5, 40], xp: 80 } }] },
  { id: 'vault', tags: ['base', 'hospital', 'mall', 'cdclab', 'radiotower', 'industrial'], title: 'A sealed basement', text: 'Blast door, pre-war lock, a faint hum behind it. Cutting through takes most of the night.',
    choices: [{ label: 'Cut it open', desc: 'Whatever is in there, nobody else has it. The torch burns fuel.', effects: { artifact: 'random', cost: { fuel: 0.06 }, injure: [0.2, 20], delay: 120 } }, { label: 'Mark it on the map', desc: 'Come back another day. The notes are worth something.', effects: { gain: { research: 3 } } }] },
  { id: 'militia', tags: ['base', 'gas', 'radiotower', 'police', 'road'], title: 'Hilltop Militia checkpoint', text: 'Sandbags, a machine gun, a woman with a clipboard. They want to know who you are.',
    choices: [{ label: 'Share ammunition', desc: 'They will remember the favour.', effects: { cost: { scrap: 0.08 }, rep: { militia: 2 } } }, { label: 'Share information', desc: 'Tell them about the horde routes.', effects: { rep: { militia: 1 }, gain: { research: 2 } } }, { label: 'Turn around', desc: 'Lose a third of the haul backtracking.', effects: { lootMult: 0.66 } }] },
  { id: 'bus', tags: ['suburbs', 'gas', 'road', 'trainyard'], title: 'A school bus on its side', text: 'The engine looks whole. With a day of work it could be dragged home.',
    choices: [{ label: 'Drag it home', desc: 'Parts for the garage, but it takes the rest of the day.', effects: { haul: { scrap: 7, fuel: 1 }, delay: 120 } }, { label: 'Strip the seats', desc: 'Quick and quiet.', effects: { haul: { scrap: 2 } } }] },
  /* ---- more encounters on the road (decisions with consequences; gamble: [chance, win, lose, winText, loseText]) ---- */
  { id: 'bridge', tags: ['road', 'farmland', 'waterplant'], title: 'The bridge is down', text: 'The river crossing collapsed. There is a ford upstream, a long detour around, or a rusted rail bridge that might hold.',
    choices: [{ label: 'Take the detour', desc: 'Safe, but the trip takes longer and burns fuel.', effects: { delay: 120, cost: { fuel: 0.04 } } },
      { label: 'Cross the rail bridge', desc: 'Fast. If it gives way, people get hurt and cargo is lost.', effects: { gamble: [0.65, { hurry: 60 }, { injure: [0.7, 30], lootMult: 0.75 }, 'the bridge held', 'the bridge buckled'] } }] },
  { id: 'dog', tags: ['suburbs', 'farmland', 'road', 'gas'], title: 'A dog follows the truck', text: 'Thin, limping, and it will not stop following. It growls at every shadow before the team even sees them.',
    choices: [{ label: 'Bring it home', desc: 'Morale up, and it keeps watch at the gate.', effects: { morale: 6, cost: { food: 0.02 }, bond: 8 } }, { label: 'Leave some food', desc: 'A little kindness.', effects: { cost: { food: 0.01 }, morale: 2 } }, { label: 'Drive on', desc: '', effects: {} }] },
  { id: 'ambush', tags: ['road', 'gas', 'trainyard', 'police', 'industrial'], title: 'Raiders block the road', text: 'Cars across the lanes, rifles on the roofs. Their leader wants a toll — or the truck.',
    choices: [{ label: 'Pay the toll', desc: 'Lose some scrap, everyone goes home.', effects: { cost: { scrap: 0.1 } } },
      { label: 'Fight through', desc: 'Win and take their stash; lose and people get hurt.', effects: { gamble: [0.55, { haul: { scrap: 6, fuel: 2 }, xp: 60 }, { injure: [0.6, 35], lootMult: 0.6 }, 'the raiders broke and ran', 'the team was beaten back'] } },
      { label: 'Turn back', desc: 'Lose a third of the haul on the long way round.', effects: { lootMult: 0.66 } }] },
  { id: 'airdrop', tags: ['farmland', 'road', 'airport', 'base'], title: 'A supply drop in the trees', text: 'A parachute crate hangs in a pine, military markings, still sealed. The rope looks rigged.',
    choices: [{ label: 'Cut it down carefully', desc: 'Could be a trap. Could be a month of supplies.', effects: { gamble: [0.7, { haul: { food: 5, water: 5, research: 1 } }, { injure: [0.5, 30] }, 'supplies, untouched', 'it was booby-trapped'] } }, { label: 'Leave it', desc: '', effects: {} }] },
  { id: 'signal', tags: ['radiotower', 'city', 'road', 'police'], title: 'A voice on the radio', text: 'A looping message: a family trapped in a basement two streets away. It could be real. Raiders use this trick.',
    choices: [{ label: 'Go and look', desc: 'Maybe new survivors, maybe an ambush.', effects: { gamble: [0.6, { rescue: true, morale: 3 }, { injure: [0.5, 30] }, 'they were real', 'it was a trap'] } }, { label: 'Note the frequency', desc: 'Pass it on to the traders.', effects: { rep: { traders: 1 } } }] },
  { id: 'nest', tags: ['city', 'industrial', 'mall', 'hospital', 'airport'], title: 'A nest in the basement', text: 'Dozens of them, packed into the dark below the team’s route home. They are asleep — for now.',
    choices: [{ label: 'Burn it', desc: 'Costs fuel, but the horde will be quieter for a while.', effects: { cost: { fuel: 0.08 }, noiseCalm: 600, xp: 40 } }, { label: 'Sneak past', desc: 'Quiet and slow; some of the haul is left behind.', effects: { lootMult: 0.8, delay: 60 } }] },
  { id: 'library', tags: ['city', 'suburbs', 'radiotower', 'cdclab'], title: 'A library with the lights on', text: 'Someone rigged a solar panel to the reading room. Shelves of manuals, journals and maps.',
    choices: [{ label: 'Load the books', desc: 'Research, but it takes time.', effects: { haul: { research: 5 }, delay: 90 } }, { label: 'Take the solar panel', desc: 'Generators run hotter for a while.', effects: { buff: ['generator', 0.3, 900] } }] },
  { id: 'cargo', tags: ['trainyard', 'industrial', 'airport'], title: 'An unopened freight car', text: 'The seals are intact. Whatever is inside has been waiting since the first winter.',
    choices: [{ label: 'Break the seals', desc: 'Loud. Worth it?', effects: { gamble: [0.6, { haul: { scrap: 6, concrete: 3 } }, { injure: [0.4, 25], haul: { scrap: 1 } }, 'construction supplies!', 'walkers inside — and a little scrap'] } }, { label: 'Mark it and move on', desc: '', effects: { gain: { research: 1 } } }] },
  { id: 'beast', tags: ['farmland', 'waterplant', 'industrial', 'cdclab', 'base'], title: 'Something big in the reeds', text: 'Larger than any walker, and it moves like it is thinking. Tracks lead back to its lair — and its kills.',
    choices: [{ label: 'Hunt it', desc: 'Dangerous. Its lair holds whatever it dragged home, and samples for the lab.', effects: { gamble: [0.5, { haul: { research: 6, scrap: 3 }, xp: 100 }, { injure: [0.8, 45] }, 'the beast went down', 'it nearly took the truck'] } }, { label: 'Give it a wide berth', desc: 'Lose time.', effects: { delay: 90 } }] },
  { id: 'stash', tags: ['suburbs', 'police', 'mall', 'gas'], title: 'A survivor’s stash', text: 'A note on the door: "Back soon. Do not take more than you need." The dust says nobody has been back in months.',
    choices: [{ label: 'Take what you need', desc: 'A modest haul, and you feel all right about it.', effects: { haul: { food: 2, scrap: 2 }, morale: 2 } }, { label: 'Take everything', desc: 'A big haul. Somebody might come back.', effects: { haul: { food: 5, scrap: 5, fuel: 1 }, morale: -3 } }] },
  { id: 'medic', tags: ['hospital', 'cdclab', 'police'], title: 'A doctor in the ruins', text: 'A woman in a stained coat stitches her own arm by candlelight. She will come with you if you take her patients too.',
    choices: [{ label: 'Take them all', desc: 'A medic joins; the others need food and beds.', effects: { recruit: true, cost: { food: 0.08 }, heal: 15 } }, { label: 'Trade medicine', desc: 'Give scrap, get her medical notes.', effects: { cost: { scrap: 0.06 }, haul: { research: 4 } } }] },
  { id: 'storm', tags: ['road', 'farmland', 'waterplant', 'trainyard', 'airport'], title: 'A storm rolls in', text: 'Black sky, hail like gravel. The truck can wait it out under a bridge — or race it home.',
    choices: [{ label: 'Wait it out', desc: 'Safe, slower.', effects: { delay: 150 } }, { label: 'Race the storm', desc: 'Home sooner, if nobody slips.', effects: { gamble: [0.7, { hurry: 120 }, { injure: [0.5, 25] }, 'they made it through', 'the truck went into a ditch'] } }] },
  { id: 'wreck', tags: ['road', 'airport', 'base', 'farmland'], title: 'A crashed helicopter', text: 'Rotor blades in the mud, a cockpit full of dead instruments, and a locked flight case strapped to the seat.',
    choices: [{ label: 'Salvage the engine', desc: 'Heavy, slow, worth a lot of scrap and fuel.', effects: { haul: { scrap: 6, fuel: 3 }, delay: 120 } }, { label: 'Take the flight case', desc: 'Something someone wanted badly.', effects: { gamble: [0.45, { artifact: 'random' }, { haul: { research: 3 } }, 'a pre-war relic', 'flight logs — still useful'] } }] },
  { id: 'cache', tags: ['police', 'base', 'factory', 'industrial', 'trainyard'], title: 'Spray paint on a manhole', text: 'An arrow and a number. Below: a dry tunnel, ammunition boxes, and a crowbar left in a hurry.',
    choices: [{ label: 'Clear it out', desc: 'Traps and scrap for the wall.', effects: { traps: 4, haul: { scrap: 3 } } }, { label: 'Leave a mark of your own', desc: 'Other scavengers will know you play fair.', effects: { rep: { traders: 1, militia: 1 } } }] },
  { id: 'drone', tags: ['radiotower', 'base', 'airport', 'city', 'police'], title: 'A crashed surveillance drone', text: 'It came down in a car park, rotors snapped, the camera still blinking. Military hardware.',
    choices: [{ label: 'Strip the electronics', desc: 'Circuit boards, and it takes a while.', effects: { mat: { circuits: 2 }, delay: 60 } }, { label: 'Pull its flight log', desc: 'It mapped the whole district.', effects: { explore: 1, gain: { research: 2 } } }] },
  { id: 'museum', tags: ['city', 'mall', 'suburbs'], title: 'A looted museum', text: 'The front halls are stripped bare. The storerooms in the basement are locked, and dark.',
    choices: [{ label: 'Search the storerooms', desc: 'Something the looters missed — if anything.', effects: { collect: 1, delay: 90, injure: [0.2, 20] } }, { label: 'Take the display steel', desc: 'Good alloy in those cases.', effects: { mat: { alloy: 1 }, haul: { scrap: 2 } } }] },
  { id: 'tanker', tags: ['road', 'trainyard', 'gas', 'industrial', 'waterplant'], title: 'An overturned tanker', text: 'Hazard placards, a slow leak, the cab crushed. Whatever it carried could be useful — or burn you.',
    choices: [{ label: 'Drain the chemicals', desc: 'Careful work with bad fumes.', effects: { mat: { chem: 2 }, injure: [0.25, 20] } }, { label: 'Cut off the tank plating', desc: 'Alloy, and nobody breathes anything.', effects: { mat: { alloy: 1 }, delay: 45 } }] },
  { id: 'hatch', tags: ['base', 'police', 'radiotower', 'industrial'], title: 'Another bunker’s hatch', text: 'A blast hatch in a hillside, the wheel lock rusted shut. Somebody else had the same idea as you.',
    choices: [{ label: 'Force it open', desc: 'Abandoned and stocked? Or not abandoned at all.', effects: { gamble: [0.5, { mat: { cells: 2, circuits: 1 }, collect: 1 }, { injure: [0.6, 35] }, 'abandoned — and stocked', 'not abandoned'] } }, { label: 'Leave a note', desc: 'Word gets around that you are decent.', effects: { rep: { traders: 1 }, explore: 1 } }] },
  { id: 'surveyor', tags: ['suburbs', 'farmland', 'road', 'city', 'gas'], title: 'A surveyor’s van', text: 'Theodolites, rolls of plans, and maps of every street in the county with notes in red pen.',
    choices: [{ label: 'Copy the maps', desc: 'The team will know this place far better.', effects: { explore: 2 } }, { label: 'Take the van battery', desc: 'A fuel cell, practically.', effects: { mat: { cells: 1 } } }] },
  { id: 'quiet', tags: ['suburbs', 'gas', 'hospital', 'mall', 'base', 'road', 'city', 'industrial', 'farmland', 'waterplant'], title: 'An uneventful trip', text: 'For once the road is empty and the team comes home singing.', choices: [{ label: 'Good', desc: '', effects: { morale: 4, bond: 10 } }] },
];

/* ---- bunker events: things that happen at home ----
 * {A}/{B} are two survivors, {D} a floor, {R} a production room ('$R' in a buff). chain: a follow-up
 * event [id, min s, max s, chance, hint] that comes later as a consequence of the choice. */
(function () {
const HAS = (type) => (s) => Object.values(s.rooms).some(r => r.level > 0 && r.type === type);
const POP = (n) => (s) => DE.Bunker.population(s) >= n;
DE.Data.BUNKER_EVENTS = [
  { id: 'pipe', weight: 3, title: 'Burst pipe', cond: (s) => s.resources.water > 50, text: 'A main in the lower corridor let go overnight. Water is pouring into the rock.',
    choices: [{ label: 'Patch it now', desc: 'Scrap for clamps and a welder’s time.', effects: { cost: { scrap: 0.08 } } }, { label: 'Let it drain', desc: 'Lose a quarter of the stored water.', effects: { waterPct: -0.25 } },
      { label: 'Run it into the farm beds', desc: 'Lose some water, but the crops drink well for a while.', cond: HAS('farm'), effects: { waterPct: -0.15, buff: ['farm', 0.25, 900] } }] },
  { id: 'stranger', weight: 3, title: 'A stranger at the gate', cond: (s) => DE.Bunker.population(s) < DE.Bunker.housingCapacity(s), text: 'A thin man with a rifle and a bite-shaped bandage on his arm asks to come in.',
    choices: [{ label: 'Let him in', desc: 'A survivor joins. He might be infected — and he is hiding something.', effects: { recruit: true, risk: [0.3, 'shock', 10], chain: ['stranger2', 600, 1500, 0.6, 'He is hiding something'] } }, { label: 'Turn him away', desc: 'It does not sit well with anyone.', effects: { morale: -3 } }, { label: 'Quarantine first', desc: 'Needs a Quarantine Ward or Infirmary. A safe recruit.', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && (r.type === 'quarantine' || r.type === 'infirmary')), effects: { recruit: true } }] },
  { id: 'stranger2', chainOnly: true, weight: 1, title: 'The stranger’s secret', text: 'The man from the gate finally talks. He ran supply trucks for the army — and he still knows where one of the depots is.',
    choices: [{ label: 'Send a crew to the depot', desc: 'A risky run, a big payoff.', effects: { gamble: [0.65, { gain: { scrap: 8, fuel: 4 } }, { injure: [0.5, 30] }, 'the depot was untouched', 'the depot was overrun'] } }, { label: 'Sell the location to the traders', desc: 'Safe money and a better name.', effects: { gain: { scrap: 4 }, rep: { traders: 1 } } }] },
  { id: 'argument', weight: 2, title: 'Argument in the canteen', cond: POP(4), text: '{A} and {B} are shouting about who ate the last tin. Half the bunker is picking sides.',
    choices: [{ label: 'Let them sort it out', desc: 'Morale suffers for a while.', effects: { shock: 6 } }, { label: 'Throw a dinner', desc: 'Everyone calms down and the two make up.', effects: { cost: { food: 0.08 }, morale: 3, bondAB: 25 } }, { label: 'Put them on the same shift', desc: 'They will learn to get along. Or not.', effects: { gamble: [0.6, { bondAB: 40, morale: 2 }, { bondAB: -30, shock: 8 }, '{A} and {B} are friends now', 'it got worse'] } }] },
  { id: 'birthday', weight: 2, title: '{A}’s birthday', text: 'Somebody found a candle. {A} has not had a birthday in two years.',
    choices: [{ label: 'Celebrate', desc: 'A little cake, a lot of noise. {A} feels like a person again.', effects: { cost: { food: 0.04 }, morale: 5, levelA: 0.5 } }, { label: 'Work goes on', desc: 'Nothing happens.', effects: {} }] },
  { id: 'nightmare', weight: 2, title: '{A} cannot sleep', text: 'Nightmares about the surface. {A} is exhausted and asks for a day off.',
    choices: [{ label: 'Give the day off', desc: '{A} rests fully; production dips slightly.', effects: { restA: true } }, { label: 'Everyone works', desc: '{A} loses energy, and the others notice.', effects: { energyA: -30, morale: -2 } }] },
  { id: 'trader', weight: 3, title: 'Road Traders at the fence', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && (r.type === 'radio' || r.type === 'comms')), text: 'A caravan heard your broadcast. Two offers, good for today only. The better they know you, the better the rate.', trade: true },
  { id: 'generatorfail', weight: 2, title: 'Generator coughing', cond: HAS('generator'), text: 'The diesel is sputtering. A mechanic says it needs new injectors.',
    choices: [{ label: 'Replace injectors', desc: 'Generators run better for an hour.', effects: { cost: { scrap: 0.1 }, buff: ['generator', 0.15, 3600] } }, { label: 'Nurse it along', desc: 'Lose a fifth of the stored power.', effects: { electricityPct: -0.2 } }] },
  { id: 'discovery', weight: 1, title: 'Something in the rock', cond: (s) => s.floors.length >= 3, text: 'Digging crews broke into a pocket of old concrete on {D}. There is a crate inside.',
    choices: [{ label: 'Open it', desc: 'An artifact, or a lot of scrap.', effects: { artifactOr: 6 } }] },
  { id: 'militiavisit', weight: 1, title: 'Militia patrol', cond: (s) => (s.rep && s.rep.militia || 0) >= 2, text: 'The Hilltop Militia drop off two crates of ammunition and ask for nothing. Allies, apparently.', choices: [{ label: 'Thank them', desc: 'Traps for the gate, and goodwill.', effects: { traps: 6, rep: { militia: 1 } } }] },
  { id: 'growers', weight: 1, title: 'Seed delivery', cond: (s) => (s.rep && s.rep.growers || 0) >= 2, text: 'A Riverside Growers cart leaves sacks at the gate.', choices: [{ label: 'Accept', desc: 'A good harvest’s worth of food.', effects: { gain: { food: 6 } } }] },
  { id: 'quiet', weight: 2, title: 'A quiet night', text: 'No alarms, no breaches, nobody hurt. {A} plays guitar in the corridor.', choices: [{ label: 'Listen', desc: 'Friendships deepen.', effects: { morale: 3, bond: 8 } }] },
  /* ---- new: choices with consequences ---- */
  { id: 'cavein', weight: 2, title: 'Cave-in on {D}', cond: (s) => s.floors.length >= 2, text: 'A support beam on {D} gave way. {A} is behind the rubble with a storeroom’s worth of supplies.',
    choices: [{ label: 'Dig {A} out by hand', desc: 'Fast. Everyone pitches in; someone may get hurt.', effects: { morale: 4, injure: [0.2, 20] } },
      { label: 'Shore it up properly', desc: 'Concrete and time, and nobody else gets hurt.', cond: (s) => s.resources.concrete >= 10, effects: { cost: { concrete: 0.12 }, morale: 2 } },
      { label: 'Use the scrap pile', desc: 'Wedge it with whatever is lying around.', effects: { cost: { scrap: 0.1 }, injureA: 15 } }] },
  { id: 'rats', weight: 2, title: 'Rats in the pantry', cond: (s) => s.resources.food > 150, text: 'Something has been chewing through the grain sacks for a week. The droppings say: a lot of something.',
    choices: [{ label: 'Set traps everywhere', desc: 'Scrap for wire and springs.', effects: { cost: { scrap: 0.05 } } },
      { label: 'Adopt the cat from B1', desc: 'It might work. It might just sleep.', effects: { gamble: [0.55, { morale: 4 }, { cost: { food: 0.08 } }, 'the cat is a hunter', 'the cat is a pillow'] } },
      { label: 'Ignore it', desc: 'Lose some food. They will be back.', effects: { cost: { food: 0.1 }, chain: ['rats2', 900, 1800, 0.7, 'They will be back'] } }] },
  { id: 'rats2', chainOnly: true, weight: 1, title: 'The rats are back', text: 'There are twice as many now, and they have found the water filters.',
    choices: [{ label: 'Gas the storerooms', desc: 'Fuel, and a day of airing out.', effects: { cost: { fuel: 0.1 }, buff: ['*', -0.1, 600] } }, { label: 'Throw out the spoiled stock', desc: 'A painful loss.', effects: { cost: { food: 0.2, water: 0.1 } } }] },
  { id: 'flu', weight: 2, title: 'Fever in the bunks', cond: POP(5), text: '{A} is burning up, and two others are coughing. In a sealed bunker this spreads fast.',
    choices: [{ label: 'Quarantine the sick', desc: 'Everyone slows down for a while, nobody gets worse.', effects: { buff: ['*', -0.15, 600] } },
      { label: 'Broth and rest for all', desc: 'Costs food and water; everyone heals a little.', effects: { cost: { food: 0.05, water: 0.05 }, heal: 10 } },
      { label: 'Work through it', desc: 'Production holds. Bodies may not.', effects: { injure: [0.35, 30], morale: -3 } }] },
  { id: 'thief', weight: 2, title: 'Rations are going missing', cond: POP(6), text: 'Someone raids the stores at night. {A} saw {B} near the pantry, but {B} swears it was not them.',
    choices: [{ label: 'Confront {B}', desc: 'If {A} is right, the stash is recovered. If not…', effects: { gamble: [0.5, { gain: { food: 2 }, morale: 2 }, { bondAB: -40, morale: -5 }, 'it was {B} — the stash is back', 'it was not {B}, and everyone knows it'] } },
      { label: 'Lock the stores', desc: 'Scrap for padlocks. People feel watched.', effects: { cost: { scrap: 0.06 }, morale: -1 } },
      { label: 'Let it go', desc: 'Lose a little. It may not stop.', effects: { cost: { food: 0.06, water: 0.06 }, chain: ['thief2', 900, 2400, 0.5, 'It may not stop'] } }] },
  { id: 'thief2', chainOnly: true, weight: 1, title: 'The thief again', text: 'The pantry lock is cut and fuel cans are gone too. Whoever it is, they are getting bolder.',
    choices: [{ label: 'Post a night watch', desc: 'Someone loses sleep, the thief is caught.', effects: { energyA: -40, morale: 3 } }, { label: 'Write it off', desc: 'Another loss.', effects: { cost: { food: 0.08, fuel: 0.08 }, morale: -3 } }] },
  { id: 'surge', weight: 2, title: 'Power surge', cond: HAS('generator'), text: 'The grid spiked and half the lights blew. The breaker panel is smoking.',
    choices: [{ label: 'Shut down and rewire', desc: 'Lose stored power; the new wiring runs cleaner.', effects: { electricityPct: -0.3, buff: ['generator', 0.12, 1800] } },
      { label: 'Keep it running', desc: 'Probably fine.', effects: { gamble: [0.6, { morale: 1 }, { buff: ['generator', -0.4, 900], injure: [0.2, 20] }, 'the panel held', 'the panel burned out'] } }] },
  { id: 'envoy', weight: 2, title: 'Raider envoy', cond: (s) => s.defense.wave >= 5, text: 'A man with a white rag on a rifle walks up to the wall. His crew wants tribute — or they will lead the horde to your door.',
    choices: [{ label: 'Pay the tribute', desc: 'They leave. They might come back for more.', effects: { cost: { scrap: 0.12, food: 0.08 }, chain: ['envoy2', 1500, 2700, 0.45, 'They might come back'] } },
      { label: 'Refuse', desc: 'The next wave will be bigger. Nobody here bows.', effects: { waveHp: 1.35, morale: 3 } },
      { label: 'Call in the militia', desc: 'They owe you one — now they do not.', cond: (s) => (s.rep && s.rep.militia || 0) >= 1, effects: { rep: { militia: -1 } } }] },
  { id: 'envoy2', chainOnly: true, weight: 1, title: 'The raiders return', text: 'Same rag, same rifle, a bigger number. “Business is business.”',
    choices: [{ label: 'Pay again', desc: 'Expensive peace.', effects: { cost: { scrap: 0.15, food: 0.1 } } }, { label: 'Not this time', desc: 'They will make the next wave hurt.', effects: { waveHp: 1.5, morale: 4 } }] },
  { id: 'tremor', weight: 1, title: 'Tremors', cond: (s) => s.floors.length >= 4, text: 'The deep floors are shaking. Dust sifts from the ceiling on {D} and the lights sway.',
    choices: [{ label: 'Reinforce the supports', desc: 'Concrete and scrap; everyone sleeps better.', effects: { cost: { concrete: 0.1, scrap: 0.05 }, morale: 2 } },
      { label: 'Investigate the noise', desc: 'Could be a hollow full of salvage. Could be a collapse.', effects: { gamble: [0.5, { gain: { scrap: 6, concrete: 3, research: 2 } }, { injure: [0.4, 30] }, 'a hollow full of salvage', 'a section caved in'] } },
      { label: 'Ride it out', desc: 'People are scared.', effects: { shock: 8 } }] },
  { id: 'festival', weight: 2, title: 'Founders’ Day', cond: POP(6), text: '{A} wants a feast to mark how long you have survived down here.',
    choices: [{ label: 'Throw a feast', desc: 'A big dent in the pantry; a big lift for everyone.', effects: { cost: { food: 0.15, water: 0.1 }, morale: 12, bond: 12 } }, { label: 'A small toast', desc: '', effects: { cost: { food: 0.04 }, morale: 4 } }, { label: 'No time for parties', desc: '', effects: { morale: -2 } }] },
  { id: 'inventor', weight: 2, room: true, title: '{A} has an idea', cond: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].produces && !DE.Data.ROOMS[r.type].unique), text: '{A} sketched a better way to run the {R}. It needs parts, notes and a few late nights.',
    choices: [{ label: 'Fund the prototype', desc: 'The {R} runs much better for half an hour; {A} learns a lot.', effects: { cost: { scrap: 0.1, research: 0.1 }, buff: ['$R', 0.35, 1800], levelA: 0.5 } }, { label: 'Not now', desc: '{A} is disappointed.', effects: { morale: -1 } }] },
  { id: 'refugees', weight: 2, title: 'A family at the gate', cond: (s) => DE.Bunker.housingCapacity(s) - DE.Bunker.population(s) >= 2, text: 'Three people, one of them a child, have walked for days. They saw your smoke.',
    choices: [{ label: 'Take them all in', desc: 'Three more mouths, three more pairs of hands.', effects: { recruitN: 3, cost: { food: 0.1, water: 0.1 }, morale: 4 } },
      { label: 'Take the adults', desc: '', effects: { recruitN: 2, cost: { food: 0.05 }, morale: -2 } },
      { label: 'Give supplies, send them on', desc: 'The Growers will hear of it.', effects: { cost: { food: 0.06, water: 0.06 }, rep: { growers: 1 } } },
      { label: 'Turn them away', desc: '', effects: { morale: -6 } }] },
  { id: 'vents', weight: 2, title: 'Something in the vents', cond: (s) => s.floors.length >= 2, text: 'Scratching in the air ducts on {D}. A walker must have crawled in from the surface.',
    choices: [{ label: 'Send {A} in with a crowbar', desc: '{A} learns fast or gets hurt.', effects: { gamble: [0.65, { levelA: 0.6, morale: 2 }, { injureA: 35 }, '{A} got it', 'it fought back'] } },
      { label: 'Seal the vent', desc: 'Concrete and scrap.', effects: { cost: { concrete: 0.05, scrap: 0.04 } } },
      { label: 'Gas the ducts', desc: 'Fuel, and the floor smells for a day.', effects: { cost: { fuel: 0.08 }, morale: -1 } }] },
  { id: 'mentor', weight: 2, title: '{A} wants to learn', cond: POP(4), text: '{A} asks to shadow {B} for a few shifts.',
    choices: [{ label: 'Pair them up', desc: '{A} learns, and the two get closer.', effects: { levelA: 0.6, bondAB: 20 } }, { label: 'Everyone sticks to their job', desc: '', effects: {} }] },
  { id: 'smuggler', weight: 1, title: 'A smuggler’s offer', cond: (s) => (s.rep && s.rep.traders || 0) >= 1 || HAS('radio')(s), text: 'A trader with too many rings offers something “not on the official list”.',
    choices: [{ label: 'Buy research notes', desc: 'Pre-war lab notebooks.', effects: { cost: { scrap: 0.15 }, gain: { research: 6 } } },
      { label: 'Buy the strange device', desc: 'Half the time these are fakes.', effects: { cost: { scrap: 0.2, fuel: 0.1 }, gamble: [0.5, { artifact: 'random' }, { gain: { scrap: 2 } }, 'a genuine relic', 'a fake — scrap metal'] } },
      { label: 'Report him to the militia', desc: 'The militia approve. The traders do not.', effects: { rep: { militia: 1, traders: -1 } } }] },
  { id: 'fumes', weight: 1, title: 'Exhaust fumes', cond: HAS('generator'), text: 'The generator room smells sweet. {A} has a headache that will not go away.',
    choices: [{ label: 'Shut it down and vent', desc: 'Lose stored power; {A} recovers.', effects: { electricityPct: -0.25, restA: true } },
      { label: 'Install a vent fan', desc: 'Scrap now, a cleaner burn after.', effects: { cost: { scrap: 0.08 }, buff: ['generator', 0.1, 1800] } },
      { label: 'Prop a door open', desc: 'Probably enough.', effects: { gamble: [0.6, {}, { injure: [0.4, 25] }, 'the air cleared', 'three people collapsed'] } }] },
  { id: 'letter', weight: 1, title: 'A letter from before', text: '{A} found a letter in an old coat, written by someone they lost.',
    choices: [{ label: 'Give {A} the evening', desc: '', effects: { restA: true, morale: -1 } }, { label: 'Read it to everyone', desc: 'Grief shared is grief halved.', effects: { morale: 4, bond: 6 } }] },
  { id: 'tools', weight: 2, title: 'Tools wearing out', cond: HAS('workshop'), text: 'Half the wrenches are cracked and the grinder is throwing sparks.',
    choices: [{ label: 'Replace the tools', desc: 'The workshops run better for a while.', effects: { cost: { scrap: 0.1 }, buff: ['workshop', 0.2, 1800] } }, { label: 'Make do', desc: 'The workshops slow down.', effects: { buff: ['workshop', -0.25, 1200] } }] },
  { id: 'seam', weight: 1, title: 'A seam of ore', cond: (s) => s.floors.length >= 3, text: 'The diggers on {D} hit a glittering vein in the rock wall. Mining it means stopping other work for a shift.',
    choices: [{ label: 'Mine it', desc: 'Everything slows for a while; the vein pays.', effects: { buff: ['*', -0.1, 600], gain: { scrap: 8, concrete: 3 } } }, { label: 'Note it for later', desc: '', effects: { gain: { research: 1 } } }] },
];
})();

/* Trader offers: give a share of your stock for its value in something else (rate > 1 is a good
 * deal; reputation with the traders improves every rate). */
DE.Data.TRADES = [
  { give: 'scrap', pct: 0.15, get: 'fuel', rate: 1.2 }, { give: 'food', pct: 0.2, get: 'scrap', rate: 1.15 }, { give: 'fuel', pct: 0.15, get: 'concrete', rate: 1.2 },
  { give: 'scrap', pct: 0.2, get: 'research', rate: 1.1 }, { give: 'water', pct: 0.2, get: 'food', rate: 1.2 }, { give: 'concrete', pct: 0.15, get: 'fuel', rate: 1.2 },
  { give: 'research', pct: 0.15, get: 'scrap', rate: 1.25 }, { give: 'food', pct: 0.15, get: 'concrete', rate: 1.1 },
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
/* Objectives, shown three at a time in this order: a guided path from the first room to the endgame. */
DE.Data.GOALS = [
  { id: 'g_lab', tier: 1, name: 'Turn on the lab', desc: 'Build a Research Laboratory.', check: (s) => Object.values(s.rooms).some(r => r.type === 'lab' && r.level > 0), reward: { scrap: 120, research: 30 } },
  { id: 'g_staff', tier: 1, name: 'Everyone works', desc: 'Have no idle survivors for a moment.', check: (s) => DE.Bunker.population(s) >= 4 && DE.Survivors.idle(s).length === 0, reward: { food: 120, water: 120 } },
  { id: 'g_house', tier: 1, name: 'Room to grow', desc: 'Upgrade the Sleeping Quarters to level 2.', check: (s) => Object.values(s.rooms).some(r => r.type === 'quarters' && r.level >= 2), reward: { food: 150, water: 150 } },
  { id: 'g_recruit', tier: 1, name: 'Who is out there?', desc: 'Recruit a survivor over the radio.', check: (s) => s.stats.recruited >= 1, reward: { scrap: 150 } },
  { id: 'g_research', tier: 2, name: 'First breakthrough', desc: 'Complete any research.', check: (s) => Object.keys(s.research.done).length >= 1, reward: { research: 60 } },
  { id: 'g_canteen', tier: 1, name: 'Open a Canteen', desc: 'Build a Canteen so survivors eat together.', check: (s) => Object.values(s.rooms).some(r => r.type === 'cafeteria' && r.level > 0), reward: { scrap: 150 } },
  { id: 'g_guard', tier: 1, name: 'On watch', desc: 'Post a survivor on guard duty.', check: (s) => Object.values(s.survivors).some(v => v.assignment && v.assignment.kind === 'guard'), reward: { scrap: 150 } },
  { id: 'g_wave3', tier: 1, name: 'Hold the line', desc: 'Survive 3 waves without a breach.', check: (s) => s.stats.wavesSurvived >= 3, reward: { scrap: 200 } },
  { id: 'g_b2', tier: 1, name: 'Dig to B2', desc: 'Excavate a second floor.', check: (s) => s.floors.length >= 2, reward: { research: 40 } },
  { id: 'g_mixer', tier: 2, name: 'Mix concrete', desc: 'Build a Concrete Mixer (research Construction first).', check: (s) => Object.values(s.rooms).some(r => r.type === 'concrete' && r.level > 0), reward: { concrete: 80 } },
  { id: 'g_perim', tier: 2, name: 'Fortify', desc: 'Upgrade any perimeter structure in Defense.', check: (s) => s.overworld && Object.values(s.overworld).some(v => v > 0), reward: { concrete: 120 } },
  { id: 'g_mine', tier: 2, name: 'Mining crew', desc: 'Build a Mining Station and post a miner at the dig site.', check: (s) => Object.values(s.rooms).some(r => r.type === 'minehead' && r.level > 0) && Object.values(s.survivors).some(v => v.assignment && v.assignment.kind === 'dig'), reward: { scrap: 200 } },
  { id: 'g_b3', tier: 2, name: 'Into the clay', desc: 'Excavate down to B3 (Excavation I research, Mining Station).', check: (s) => s.floors.length >= 3, reward: { concrete: 150, research: 80 } },
  { id: 'g_turret', tier: 2, name: 'Automated defense', desc: 'Install an auto-turret.', check: (s) => s.defense.turrets >= 1, reward: { scrap: 400 } },
  { id: 'g_pop8', tier: 2, name: 'A real settlement', desc: 'Reach 8 survivors.', check: (s) => DE.Bunker.population(s) >= 8, reward: { morale: 10, food: 300 } },
  { id: 'g_wing', tier: 2, name: 'Widen a floor', desc: 'Dig a sideways wing on any floor.', check: (s) => s.floors.some(f => DE.Bunker.wingCount(f) > 0), reward: { concrete: 100 } },
  { id: 'g_garage', tier: 2, name: 'Wheels', desc: 'Build a Garage and send an expedition.', check: (s) => s.stats.expeditions >= 1, reward: { fuel: 120 } },
  { id: 'g_lv10', tier: 2, name: 'Specialist', desc: 'Upgrade any room to level 10 (output doubles there).', check: (s) => Object.values(s.rooms).some(r => r.level >= 10), reward: { research: 200 } },
  { id: 'g_wave10', tier: 3, name: 'Veteran defenders', desc: 'Survive wave 10.', check: (s) => s.defense.wave > 10, reward: { scrap: 1200, research: 200 } },
  { id: 'g_rare', tier: 3, name: 'Lucky call', desc: 'Have a Rare or Legendary survivor.', check: (s) => Object.values(s.survivors).some(v => v.rarity === 'rare' || v.rarity === 'legendary'), reward: { morale: 10, scrap: 300 } },
  { id: 'g_streak5', tier: 3, name: 'Untouchable', desc: 'Repel 5 waves in a row without the wall getting hit.', check: (s) => (s.defense.winStreak || 0) >= 5, reward: { scrap: 1000, recruit: 1 } },
  { id: 'g_bus', tier: 2, name: 'Better wheels', desc: 'Upgrade the expedition vehicle.', check: (s) => (s.bus && s.bus.level || 1) >= 2, reward: { scrap: 400 } },
  { id: 'g_friends', tier: 3, name: 'Friends', desc: 'Two survivors become friends.', check: (s) => Object.values(s.survivors).some(v => v.bonds && Object.values(v.bonds).some(b => b >= 60)), reward: { morale: 8 } },
  { id: 'g_tier2', tier: 3, name: 'Improved infrastructure', desc: 'Build any Tier 2 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 2), reward: { concrete: 200 } },
  { id: 'g_artifact', tier: 3, name: 'Relic hunter', desc: 'Find an artifact on an expedition.', check: (s) => Object.keys(s.artifacts || {}).length >= 1, reward: { research: 300 } },
  { id: 'g_b5', tier: 3, name: 'Through the limestone', desc: 'Reach B5.', check: (s) => s.floors.length >= 5, reward: { scrap: 2500 } },
  { id: 'g_b7', tier: 4, name: 'Granite', desc: 'Reach B7 — hydraulic drills and a Mining Station at level 12.', check: (s) => s.floors.length >= 7, reward: { concrete: 3000, research: 1500 } },
  { id: 'g_b9', tier: 5, name: 'Black basalt', desc: 'Reach B9.', check: (s) => s.floors.length >= 9, reward: { research: 6000 } },
  { id: 'g_calibre', tier: 4, name: 'Bigger guns', desc: 'Upgrade turret calibre to level 3.', check: (s) => (s.defense.turretLevel || 0) >= 3, reward: { scrap: 2500 } },
  { id: 'g_faction', tier: 4, name: 'Allies', desc: 'Reach reputation 3 with any faction.', check: (s) => s.rep && Object.values(s.rep).some(v => v >= 3), reward: { scrap: 3000, fuel: 400 } },
  { id: 'g_tier3', tier: 4, name: 'Advanced facilities', desc: 'Build any Tier 3 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 3), reward: { research: 800 } },
  { id: 'g_lv25', tier: 4, name: 'Master craft', desc: 'Upgrade any room to level 25 (output doubles again).', check: (s) => Object.values(s.rooms).some(r => r.level >= 25), reward: { research: 1000 } },
  { id: 'g_wave25', tier: 4, name: 'Siege survivors', desc: 'Survive wave 25.', check: (s) => s.defense.wave > 25, reward: { scrap: 8000 } },
  { id: 'g_pop20', tier: 4, name: 'Underground town', desc: 'Reach 20 survivors.', check: (s) => DE.Bunker.population(s) >= 20, reward: { morale: 15 } },
  { id: 'g_tier4', tier: 5, name: 'High technology', desc: 'Build any Tier 4 room.', check: (s) => Object.values(s.rooms).some(r => r.level > 0 && DE.Data.ROOMS[r.type].tier === 4), reward: { research: 3000 } },
  { id: 'g_missile', tier: 5, name: 'Endgame artillery', desc: 'Build the Missile Battery.', check: (s) => s.overworld && s.overworld.missile >= 1, reward: { research: 5000 } },
  { id: 'g_ark', tier: 5, name: 'Preserve humanity', desc: 'Build the Ark Habitat.', check: (s) => Object.values(s.rooms).some(r => r.type === 'ark' && r.level > 0), reward: { morale: 30 } },
  { id: 'g_prestige', tier: 5, name: 'Reconstruction', desc: 'Reach the point where the bunker can be rebuilt from memory (B3 and 3 Legacy Points).', check: (s) => DE.Prestige.canReset(s).ok, reward: { research: 500 } },
];
