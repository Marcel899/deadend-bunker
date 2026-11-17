/* Cosmetic customisation of the bunker as seen on the surface. Purely visual: no effects.
 * Each slot has options; the first is free and owned from the start, the others are bought once
 * (scrap / concrete) and can then be switched freely. Options carry the colours or artwork the
 * overworld uses (js/ui/customize.js writes them onto #scene as CSS variables / data-attributes).
 * Unlocks survive Reconstruction. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.COSMETICS = {
  paint: { id: 'paint', name: 'Shell paint', icon: 'bunker', desc: 'The colour of the bunker shell.',
    options: [
      { id: 'concrete', name: 'Raw concrete', c: ['#c4c2bd', '#95928f', '#6c6865'], cost: null },
      { id: 'olive', name: 'Olive drab', c: ['#9aa070', '#6e7448', '#4a5030'], cost: { scrap: 150 } },
      { id: 'sand', name: 'Desert tan', c: ['#e0c89a', '#b89a68', '#8a7048'], cost: { scrap: 150 } },
      { id: 'rust', name: 'Rust red', c: ['#c0745a', '#94503c', '#663428'], cost: { scrap: 300 } },
      { id: 'navy', name: 'Navy steel', c: ['#7c8cac', '#56637e', '#363f56'], cost: { scrap: 300 } },
      { id: 'arctic', name: 'Arctic white', c: ['#f2f4f6', '#c8ccd2', '#9aa0a8'], cost: { scrap: 600, concrete: 40 } },
      { id: 'char', name: 'Night black', c: ['#6a6670', '#46424c', '#2a2830'], cost: { scrap: 900, concrete: 80 } },
    ] },
  stripes: { id: 'stripes', name: 'Door stripes', icon: 'warning', desc: 'Warning paint around the blast door.',
    options: [
      { id: 'hazard', name: 'Hazard yellow', c: ['#f0b63c', '#1c1020'], cost: null },
      { id: 'fire', name: 'Fire red', c: ['#e04a3a', '#f6f0e6'], cost: { scrap: 120 } },
      { id: 'ice', name: 'Ice blue', c: ['#5ab0e8', '#f6f0e6'], cost: { scrap: 120 } },
      { id: 'toxic', name: 'Toxic green', c: ['#8ad84a', '#1c1020'], cost: { scrap: 250 } },
      { id: 'royal', name: 'Royal', c: ['#8a5ad8', '#ffd34a'], cost: { scrap: 500 } },
    ] },
  flag: { id: 'flag', name: 'Flag colours', icon: 'star', desc: 'The cloth flying over the roof.',
    options: [
      { id: 'amber', name: 'Amber', c: ['#c7782a', '#8a4a18', '#f0b060'], cost: null },
      { id: 'army', name: 'Army green', c: ['#5e7a3a', '#3a5024', '#8eaa5a'], cost: { scrap: 100 } },
      { id: 'blood', name: 'Blood red', c: ['#b8302a', '#741a16', '#e8604a'], cost: { scrap: 100 } },
      { id: 'sky', name: 'Sky blue', c: ['#3a7ac8', '#22508a', '#7ab0ee'], cost: { scrap: 200 } },
      { id: 'black', name: 'Black', c: ['#2e2a34', '#18141c', '#5a5462'], cost: { scrap: 300 } },
      { id: 'white', name: 'Truce white', c: ['#eeeae2', '#b8b2a6', '#ffffff'], cost: { scrap: 300 } },
    ] },
  emblem: { id: 'emblem', name: 'Flag emblem', icon: 'badge', desc: 'The sign on your flag.',
    options: [
      { id: 'trefoil', name: 'Radiation', cost: null },
      { id: 'skull', name: 'Skull', cost: { scrap: 200 } },
      { id: 'star', name: 'Star', cost: { scrap: 200 } },
      { id: 'wrench', name: 'Wrenches', cost: { scrap: 350 } },
      { id: 'heart', name: 'Heart', cost: { scrap: 350 } },
      { id: 'crown', name: 'Crown', cost: { scrap: 1200, concrete: 100 } },
    ] },
  roof: { id: 'roof', name: 'Roof gear', icon: 'signal', desc: 'Something to put on the roof.',
    options: [
      { id: 'none', name: 'Bare roof', cost: null },
      { id: 'dish', name: 'Satellite dish', cost: { scrap: 400 } },
      { id: 'garden', name: 'Rooftop garden', cost: { scrap: 300, food: 60 } },
      { id: 'tank', name: 'Water tank', cost: { scrap: 500, concrete: 50 } },
      { id: 'solar', name: 'Solar panels', cost: { scrap: 900, concrete: 60 } },
    ] },
  yard: { id: 'yard', name: 'Yard', icon: 'home', desc: 'What lies around in front of the bunker.',
    options: [
      { id: 'none', name: 'Bare dirt', cost: null },
      { id: 'campfire', name: 'Campfire', cost: { scrap: 80, fuel: 20 } },
      { id: 'mailbox', name: 'Mailbox & sign', cost: { scrap: 150 } },
      { id: 'gnomes', name: 'Garden gnomes', cost: { scrap: 400 } },
      { id: 'scarecrow', name: 'Zombie scarecrow', cost: { scrap: 600 } },
    ] },
};
DE.Data.COSMETIC_ORDER = ['paint', 'stripes', 'flag', 'emblem', 'roof', 'yard'];
DE.Data.COSMETIC_NAME_DEFAULT = 'SHELTER 07';
DE.Data.COSMETIC_NAME_MAX = 14;
