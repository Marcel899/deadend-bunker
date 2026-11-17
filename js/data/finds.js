/* What expeditions bring home besides ordinary resources:
 *   MATERIALS     rare materials, only found out there; exclusive rooms and the best vehicle need them
 *   COLLECTIONS   sets of collectibles; a complete set gives a permanent bonus
 *   COLLECTIBLES  unique objects, each found at one place once the team knows it well enough
 *                 (explore = exploration level of that place needed before it can turn up)
 * Blueprints for exclusive rooms are part of the rooms themselves (DE.Data.ROOMS[*].blueprint /
 * .explore): a team recovers the plans when it has explored that place far enough. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.MATERIALS = {
  circuits: { id: 'circuits', name: 'Circuit boards', short: 'circuits', desc: 'Working electronics pulled out of dead machines.' },
  alloy: { id: 'alloy', name: 'Alloy plates', short: 'alloy', desc: 'Light, hard pre-war metal: armour plate, turbine blades.' },
  chem: { id: 'chem', name: 'Chemicals', short: 'chemicals', desc: 'Sealed reagents, solvents and fertiliser.' },
  cells: { id: 'cells', name: 'Fuel cells', short: 'fuel cells', desc: 'Military power cells that still hold a charge.' },
};
DE.Data.MATERIAL_ORDER = ['circuits', 'alloy', 'chem', 'cells'];

/* Each set: the bonus for completing it (effects in the DE.Effects format). */
DE.Data.COLLECTIONS = {
  memories: { id: 'memories', name: 'Life Before', desc: 'Things people kept from the old world.', bonusText: '+8 morale', effects: [{ type: 'moraleBonus', value: 8 }] },
  arsenal: { id: 'arsenal', name: 'Old-World Arsenal', desc: 'Weapons from collections, armouries and wrecks.', bonusText: '+15% guard damage', effects: [{ type: 'guardDmgMult', value: 0.15 }] },
  tech: { id: 'tech', name: 'Abandoned Technology', desc: 'Pre-war machines nobody knows how to build any more.', bonusText: '+20% research speed', effects: [{ type: 'researchSpeed', value: 0.2 }] },
  field: { id: 'field', name: 'Field Kit', desc: 'Everything a scavenging team wishes it had.', bonusText: 'Trips 15% safer and 10% faster', effects: [{ type: 'expeditionSafety', value: 0.15 }, { type: 'expeditionSpeed', value: 0.1 }] },
  medicine: { id: 'medicine', name: 'Medicine Cabinet', desc: 'Hospital equipment that still works.', bonusText: 'Healing +50%', effects: [{ type: 'healMult', value: 0.5 }] },
  salvage: { id: 'salvage', name: 'Industrial Salvage', desc: 'Parts from the plants that used to run the city.', bonusText: 'Generators +25%, rooms use 10% less power', effects: [{ type: 'roomMult', room: 'generator', value: 0.25 }, { type: 'powerUseMult', value: -0.1 }] },
};
DE.Data.COLLECTION_ORDER = ['memories', 'arsenal', 'tech', 'field', 'medicine', 'salvage'];

DE.Data.COLLECTIBLES = {
  painting: { id: 'painting', set: 'memories', name: 'Mountain painting', sprite: 'painting', where: 'suburbs', explore: 0, desc: 'Somebody carried it out of a burning house.' },
  bike: { id: 'bike', set: 'memories', name: 'Blue bicycle', sprite: 'bike', where: 'suburbs', explore: 2, desc: 'Barely ridden. The kids in the bunker fight over it.' },
  camera: { id: 'camera', set: 'memories', name: 'Film camera', sprite: 'camera', where: 'mall', explore: 0, desc: 'Still loaded. Nobody has dared to develop the roll.' },
  clock: { id: 'clock', set: 'memories', name: 'Station clock', sprite: 'clock', where: 'mall', explore: 2, desc: 'Stopped at 4:17, the afternoon the sirens started.' },
  revolver: { id: 'revolver', set: 'arsenal', name: 'Sheriff’s revolver', sprite: 'revolver', where: 'police', explore: 0, desc: 'Engraved grip, six empty chambers.' },
  katana: { id: 'katana', set: 'arsenal', name: 'Collector’s katana', sprite: 'katana', where: 'mall', explore: 3, desc: 'From a display case in the antiques shop. Very sharp.' },
  rpg: { id: 'rpg', set: 'arsenal', name: 'Rocket launcher', sprite: 'rpg', where: 'base', explore: 0, desc: 'One rocket left. Saving it for something big.' },
  flamethrower: { id: 'flamethrower', set: 'arsenal', name: 'Flamethrower', sprite: 'flamethrower', where: 'airport', explore: 2, desc: 'Ground crew used it to clear the runway.' },
  laptop: { id: 'laptop', set: 'tech', name: 'Field laptop', sprite: 'laptop', where: 'radiotower', explore: 0, desc: 'Rugged, password-protected, full of frequencies.' },
  terminal: { id: 'terminal', set: 'tech', name: 'Command terminal', sprite: 'terminal', where: 'base', explore: 2, desc: 'Still logged in to the base network.' },
  server: { id: 'server', set: 'tech', name: 'Research server', sprite: 'server2', where: 'cdclab', explore: 0, desc: 'Petabytes of outbreak data.' },
  raygun: { id: 'raygun', set: 'tech', name: 'Prototype emitter', sprite: 'raygun', where: 'cdclab', explore: 3, desc: 'Nobody knows what it does. It hums.' },
  rope: { id: 'rope', set: 'field', name: 'Climbing rope', sprite: 'rope', where: 'trainyard', explore: 0, desc: 'Forty metres of good rope.' },
  satchel: { id: 'satchel', set: 'field', name: 'Army satchel', sprite: 'satchel', where: 'gas', explore: 0, desc: 'Waterproof, with a dozen pockets.' },
  lantern: { id: 'lantern', set: 'field', name: 'Storm lantern', sprite: 'lantern', where: 'farmland', explore: 0, desc: 'Burns for a whole night on a cup of fuel.' },
  flare: { id: 'flare', set: 'field', name: 'Signal flares', sprite: 'flare', where: 'radiotower', explore: 2, desc: 'Red, for “come and get us”.' },
  firstaid: { id: 'firstaid', set: 'medicine', name: 'Trauma cabinet', sprite: 'firstaid', where: 'police', explore: 2, desc: 'Fully stocked. Somebody restocked it after the end.' },
  vitals: { id: 'vitals', set: 'medicine', name: 'Vital-signs monitor', sprite: 'vitals', where: 'hospital', explore: 0, desc: 'Beeps when it works. It works.' },
  oxygen: { id: 'oxygen', set: 'medicine', name: 'Oxygen cart', sprite: 'oxygen', where: 'hospital', explore: 2, desc: 'Full bottle, clean mask.' },
  microscope: { id: 'microscope', set: 'medicine', name: 'Lab microscope', sprite: 'microscope', where: 'cdclab', explore: 2, desc: 'With a shelf of stains and slides.' },
  reactorbox: { id: 'reactorbox', set: 'salvage', name: 'Reactor control box', sprite: 'reactorbox', where: 'factory', explore: 0, desc: 'Every switch still clicks.' },
  pipes: { id: 'pipes', set: 'salvage', name: 'Valve assembly', sprite: 'pipes', where: 'waterplant', explore: 0, desc: 'Brass and steel, built to last a century.' },
  gascyl: { id: 'gascyl', set: 'salvage', name: 'Gas cylinders', sprite: 'gascylinders', where: 'trainyard', explore: 2, desc: 'Welding gas, both bottles full.' },
  extinguisher: { id: 'extinguisher', set: 'salvage', name: 'Halon extinguisher', sprite: 'extinguisher', where: 'gas', explore: 2, desc: 'The good kind, from before they banned it.' },
};
