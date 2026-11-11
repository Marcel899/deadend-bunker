/* Upgradeable surface structures. Each has levels with cost and effects; the overworld scene
 * shows the matching artwork (css/overworld.css toggles groups by #scene data-attributes). */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.OVERWORLD = {
  fence: { id: 'fence', name: 'Perimeter Fence', icon: 'shield', desc: 'The line the horde has to cross before it reaches the wall.',
    levels: [
      { name: 'Chain-link', desc: 'Rusty chain-link and a strand of barbed wire.', cost: null },
      { name: 'Reinforced', desc: 'Steel posts, double wire, sandbag footing. Wall HP +20%.', cost: { scrap: 400, concrete: 60 }, effects: { wallHpMult: 0.2 } },
      { name: 'Concrete barrier', desc: 'Jersey barriers and razor wire. Wall HP +50%, traps +20%.', cost: { scrap: 1500, concrete: 350 }, effects: { wallHpMult: 0.3, trapDmgMult: 0.2 } },
      { name: 'Fortress wall', desc: 'Poured concrete with firing slits. Wall HP +100%, traps +40%.', cost: { scrap: 6000, concrete: 1500 }, effects: { wallHpMult: 0.5, trapDmgMult: 0.2 } },
    ] },
  towers: { id: 'towers', name: 'Watchtowers', icon: 'people', desc: 'Guards see further from up high.',
    levels: [
      { name: 'Dark', desc: 'Two empty towers.', cost: null },
      { name: 'Manned', desc: 'Lanterns lit, a sentry in each. Guards +15% damage, +20s wave warning.', cost: { scrap: 350, concrete: 40 }, effects: { guardDmgMult: 0.15, waveWarning: 20 } },
      { name: 'Searchlights', desc: 'Sweeping searchlights and sandbag nests. Guards +25%, +40s warning.', cost: { scrap: 1800, concrete: 400 }, effects: { guardDmgMult: 0.25, waveWarning: 40 } },
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
};
DE.Data.OVERWORLD_ORDER = ['fence', 'towers', 'lights', 'road'];
