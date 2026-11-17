/* What the Blacksmith Forge makes and the Armory hands out.
 *   WEAPONS  dmg = guard damage multiplier, dur = durability (waves fought), ammo = rounds per wave
 *   ARMORS   guard = share of injuries and bites it stops
 *   QUALITY  from the forging minigame: damage/protection and durability multipliers
 * A recipe needs its research (if any), a Forge (level for the tier) and its cost. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.WEAPONS = {
  machete: { id: 'machete', name: 'Machete', item: 'cleaver', dmg: 1.12, dur: 24, ammo: 0, tier: 1, cost: { scrap: 70 }, desc: 'No ammo, no noise, no excuses.' },
  pistol: { id: 'pistol', name: 'Pistol', item: 'pistol', dmg: 1.25, dur: 30, ammo: 1, tier: 1, cost: { scrap: 140 }, desc: 'Light, reliable, needs ammo.' },
  shotgun: { id: 'shotgun', name: 'Pump shotgun', item: 'shotgun', dmg: 1.45, dur: 34, ammo: 2, tier: 2, research: 'metalwork', forge: 3, cost: { scrap: 300, fuel: 25 }, desc: 'Clears a doorway in one go.' },
  rifle: { id: 'rifle', name: 'Hunting rifle', item: 'rifle', dmg: 1.6, dur: 40, ammo: 2, tier: 2, research: 'metalwork', forge: 5, cost: { scrap: 480, concrete: 40 }, desc: 'Reach and stopping power from the wall.' },
  carbine: { id: 'carbine', name: 'Assault carbine', item: 'ak', dmg: 1.85, dur: 46, ammo: 3, tier: 3, research: 'gunsmith', forge: 8, cost: { scrap: 900, fuel: 60 }, mat: { alloy: 1 }, desc: 'Rifled barrel, folding stock, a lot of noise.' },
  marksman: { id: 'marksman', name: 'Marksman rifle', item: 'sniper', dmg: 2.1, dur: 50, ammo: 3, tier: 4, research: 'gunsmith', forge: 12, cost: { scrap: 1400 }, mat: { alloy: 2, circuits: 1 }, desc: 'Scoped. Picks the big ones off before they reach the wall.' },
};
DE.Data.ARMORS = {
  vest: { id: 'vest', name: 'Padded vest', guard: .2, dur: 26, tier: 1, cost: { scrap: 160 }, desc: 'Layers of canvas and old tyres.' },
  riot: { id: 'riot', name: 'Riot armour', guard: .35, dur: 34, tier: 2, research: 'metalwork', forge: 4, cost: { scrap: 520, concrete: 60 }, desc: 'Police surplus, re-riveted.' },
  plate: { id: 'plate', name: 'Alloy plate', guard: .5, dur: 44, tier: 3, research: 'gunsmith', forge: 10, cost: { scrap: 1100 }, mat: { alloy: 2 }, desc: 'Light as a jacket, stops a bite cold.' },
};
DE.Data.AMMO = { id: 'ammo', name: 'Ammo crate', amount: 24, cost: { scrap: 70, fuel: 10 }, desc: 'Hand-loaded rounds for every gun in the armory.' };
DE.Data.QUALITY = [
  { id: 'crude', name: 'Crude', min: 0, mult: .85, dur: .7, color: '#9a9caa' },
  { id: 'standard', name: 'Standard', min: .35, mult: 1, dur: 1, color: '#e8e2d0' },
  { id: 'fine', name: 'Fine', min: .65, mult: 1.15, dur: 1.25, color: '#7fdc3e' },
  { id: 'master', name: 'Masterwork', min: .9, mult: 1.3, dur: 1.6, color: '#ffc531' },
];
DE.Data.qualityFor = (score) => { const Q = DE.Data.QUALITY; let q = Q[0]; for (const x of Q) if (score >= x.min) q = x; return q; };
