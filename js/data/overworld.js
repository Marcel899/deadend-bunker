/* Upgradeable surface structures. Each has levels with cost and effects; the overworld scene
 * shows the matching artwork (css/overworld.css toggles groups by #scene data-attributes). */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.OVERWORLD = {
  fence: { id: 'fence', name: 'Perimeter Fence', icon: 'shield', desc: 'The line the horde has to cross before it reaches the wall.',
    levels: [
      { name: 'Plank fence', desc: 'Scavenged planks nailed to posts. Full of gaps.', cost: null },
      { name: 'Iron mesh', desc: 'Steel posts and welded iron mesh. Wall HP +20%.', cost: { scrap: 400, concrete: 60 }, effects: { wallHpMult: 0.2 } },
      { name: 'Concrete barrier', desc: 'Jersey barriers topped with razor wire. Wall HP +50%, traps +20%.', cost: { scrap: 1500, concrete: 350 }, effects: { wallHpMult: 0.3, trapDmgMult: 0.2 } },
      { name: 'Fortress wall', desc: 'Poured concrete with firing slits. Wall HP +100%, traps +40%.', cost: { scrap: 6000, concrete: 1500 }, effects: { wallHpMult: 0.5, trapDmgMult: 0.2 } },
    ] },
  barricades: { id: 'barricades', name: 'Sandbags & Barricades', icon: 'brick', desc: 'Cover for the guards and obstacles that slow the horde.',
    levels: [
      { name: 'None', desc: 'Open ground in front of the hatch.', cost: null },
      { name: 'Sandbag nests', desc: 'Sandbag walls for the guards. Guards +10% damage, wall HP +10%.', cost: { scrap: 250, concrete: 30 }, effects: { guardDmgMult: 0.1, wallHpMult: 0.1 } },
      { name: 'Barricades', desc: 'Steel hedgehogs and timber barricades. Traps +25%, wall HP +15%.', cost: { scrap: 1200, concrete: 250 }, effects: { trapDmgMult: 0.25, wallHpMult: 0.15 } },
    ] },
  gate: { id: 'gate', name: 'Front Wall & Gate', icon: 'shield', desc: 'A walled forecourt in front of the blast door, with a gate the horde has to break.',
    levels: [
      { name: 'None', desc: 'Nothing between the horde and the blast door.', cost: null },
      { name: 'Timber palisade', desc: 'Sharpened logs and a swing gate. Wall HP +10%.', cost: { scrap: 300, concrete: 40 }, effects: { wallHpMult: 0.1 } },
      { name: 'Brick wall', desc: 'Brick and mortar with an iron bar gate. Wall HP +25%, traps +10%.', cost: { scrap: 1400, concrete: 300 }, effects: { wallHpMult: 0.15, trapDmgMult: 0.1 } },
      { name: 'Blast gate', desc: 'Reinforced concrete and a sliding steel gate. Wall HP +45%, guards +10%.', cost: { scrap: 5000, concrete: 1300 }, effects: { wallHpMult: 0.2, guardDmgMult: 0.1 } },
      { name: 'Gatehouse', desc: 'Crenellated walls and an armoured gatehouse with a lookout. Wall HP +70%, guards +20%, +15s warning.', cost: { scrap: 20000, concrete: 6000, fuel: 1000 }, effects: { wallHpMult: 0.25, guardDmgMult: 0.1, waveWarning: 15 } },
    ] },
  towers: { id: 'towers', name: 'Watchtowers', icon: 'people', desc: 'Guards see further from up high.',
    levels: [
      { name: 'None', desc: 'Nobody is watching the horizon.', cost: null },
      { name: 'Manned towers', desc: 'Two timber towers, lanterns lit, a sentry in each. Guards +15% damage, +20s wave warning.', cost: { scrap: 350, concrete: 40 }, effects: { guardDmgMult: 0.15, waveWarning: 20 } },
      { name: 'Searchlights', desc: 'Sweeping searchlights on both towers. Guards +25%, +40s warning.', cost: { scrap: 1800, concrete: 400 }, effects: { guardDmgMult: 0.25, waveWarning: 40 } },
    ] },
  lights: { id: 'lights', name: 'Floodlights', icon: 'power', desc: 'Turrets cannot hit what they cannot see.',
    levels: [
      { name: 'None', desc: 'Only the door lamp.', cost: null },
      { name: 'Lamp posts', desc: 'Lamp posts along the fence. Turrets +15% damage.', cost: { scrap: 500, concrete: 80 }, effects: { turretDmgMult: 0.15 } },
      { name: 'Floodlight masts', desc: 'Stadium floods on both towers. Turrets +35% damage, +1 slot.', cost: { scrap: 2400, concrete: 500 }, effects: { turretDmgMult: 0.2, turretCap: 1 } },
    ] },
  road: { id: 'road', name: 'Access Road', icon: 'map', desc: 'Expedition trucks move faster on a cleared road.',
    levels: [
      { name: 'Dirt track', desc: 'Tyre ruts through the weeds.', cost: null },
      { name: 'Gravel road', desc: 'Graded and gravelled, wrecks pushed aside. Expeditions 10% faster.', cost: { scrap: 450, concrete: 100 }, effects: { expeditionSpeed: 0.1 } },
      { name: 'Paved road', desc: 'Asphalt, barriers and a checkpoint. Expeditions 25% faster, 10% safer.', cost: { scrap: 2200, concrete: 600 }, effects: { expeditionSpeed: 0.15, expeditionSafety: 0.1 } },
    ] },
  electric: { id: 'electric', name: 'Electric Fence', icon: 'power', desc: 'Live wire along the fence. Draws power while armed.',
    requires: { fence: 1 },
    levels: [
      { name: 'None', desc: 'The fence is just a fence.', cost: null },
      { name: 'Shock wire', desc: 'Insulated wire on the fence top. +150 damage per wave, draws 0.5 power/s.', cost: { scrap: 900, fuel: 120 }, effects: { defenseFlat: 150 } },
      { name: 'High-voltage grid', desc: 'Three live strands and arc posts. +600 damage per wave, draws 1 power/s.', cost: { scrap: 4200, concrete: 500, fuel: 600 }, effects: { defenseFlat: 450 } },
    ] },
  mortar: { id: 'mortar', name: 'Mortar Pit', icon: 'target', desc: 'Lobs shells over the wall into the thick of the horde.',
    requires: { towers: 1 },
    levels: [
      { name: 'None', desc: 'Nobody is shelling anything.', cost: null },
      { name: 'Mortar', desc: 'A light mortar on the roof. +400 damage per wave.', cost: { scrap: 1600, concrete: 200, fuel: 200 }, effects: { defenseFlat: 400 } },
      { name: 'Twin mortars', desc: 'Two heavy tubes and a spotter. +1,200 damage per wave, bosses 10% weaker.', cost: { scrap: 7500, concrete: 1200, fuel: 900 }, effects: { defenseFlat: 800, bossWeaken: 0.1 } },
    ] },
  trench: { id: 'trench', name: 'Trench Line', icon: 'shield', desc: 'A ditch out in the approach that every zombie has to cross.',
    levels: [
      { name: 'None', desc: 'Flat ground all the way to the fence.', cost: null },
      { name: 'Spike ditch', desc: 'A dug ditch lined with sharpened stakes. Traps +30%.', cost: { scrap: 500, concrete: 60 }, effects: { trapDmgMult: 0.3 } },
      { name: 'Fire trench', desc: 'Fuel-soaked and lit when a wave comes. Traps +60%, +300 damage per wave.', cost: { scrap: 2600, concrete: 300, fuel: 800 }, effects: { trapDmgMult: 0.3, defenseFlat: 300 } },
    ] },
  missile: { id: 'missile', name: 'Missile Battery', icon: 'radiation', desc: 'Endgame artillery on the bunker roof. Fires guided rockets at the biggest threat.',
    requires: { fence: 2, towers: 2 },
    levels: [
      { name: 'None', desc: 'An empty concrete pad on the roof.', cost: null },
      { name: 'Missile battery', desc: 'Quad rocket launcher. +40 dmg/s area damage, draws 1 power/s.', cost: { scrap: 30000, concrete: 9000, fuel: 2500 }, effects: { missileDps: 40 } },
      { name: 'Heavy battery', desc: 'Bigger warheads, faster reload. +100 dmg/s area damage.', cost: { scrap: 90000, concrete: 25000, fuel: 8000 }, effects: { missileDps: 60 } },
    ] },
};
DE.Data.OVERWORLD_ORDER = ['fence', 'gate', 'barricades', 'trench', 'towers', 'lights', 'electric', 'mortar', 'road', 'missile'];
