/* Survivor professions, traits and name pools. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.PROFESSIONS = {
  farmer:    { id: 'farmer',    name: 'Farmer',    icon: '🧑‍🌾', desc: '+25% in Farms' },
  mechanic:  { id: 'mechanic',  name: 'Mechanic',  icon: '🧑‍🔧', desc: '+25% in Purifiers, Workshops, Ore Veins' },
  engineer:  { id: 'engineer',  name: 'Engineer',  icon: '👷', desc: '+25% in Generators, Refineries, Mixers' },
  scientist: { id: 'scientist', name: 'Scientist', icon: '🧑‍🔬', desc: '+25% in Labs, Radio, Servers' },
  soldier:   { id: 'soldier',   name: 'Soldier',   icon: '🪖', desc: '+50% damage as guard, +25% in Armory' },
  medic:     { id: 'medic',     name: 'Medic',     icon: '🧑‍⚕️', desc: '+25% in Medical Bay' },
  cook:      { id: 'cook',      name: 'Cook',      icon: '🧑‍🍳', desc: '+25% in Cafeteria' },
  scavenger: { id: 'scavenger', name: 'Scavenger', icon: '🎒', desc: '+30% expedition loot, safer trips' },
  hunter:    { id: 'hunter',    name: 'Hunter',    icon: '🔫', desc: '+25% guard damage, safer expeditions' },
  guard:     { id: 'guard',     name: 'Guard',     icon: '👮', desc: '+35% guard damage, +25% in Training Grounds' },
  scout:     { id: 'scout',     name: 'Scout',     icon: '🔦', desc: 'Expeditions 20% faster' },
};
DE.Data.PROFESSION_ORDER = ['farmer', 'mechanic', 'engineer', 'scientist', 'soldier', 'medic', 'cook', 'scavenger', 'hunter', 'guard', 'scout'];

/* Rarity: chance weights, number of traits rolled, flat efficiency bonus. */
DE.Data.RARITIES = {
  common:    { id: 'common',    name: 'Common',    color: '#a79fb8', weight: 60, traits: [0, 1], bonus: 0 },
  uncommon:  { id: 'uncommon',  name: 'Uncommon',  color: '#7cc46a', weight: 26, traits: [1, 1], bonus: 0.05 },
  rare:      { id: 'rare',      name: 'Rare',      color: '#5bb8f0', weight: 11, traits: [1, 2], bonus: 0.12 },
  legendary: { id: 'legendary', name: 'Legendary', color: '#ffd166', weight: 3,  traits: [2, 2], bonus: 0.25 },
};

/* Traits: prod = production efficiency, xp = learning speed, guard = combat, hunger = food/water use, loot = expedition */
DE.Data.TRAITS = {
  hardy:     { id: 'hardy',     name: 'Hardy',        icon: '💪', desc: 'Takes half injury damage', injury: -0.5 },
  quick:     { id: 'quick',     name: 'Quick Study',  icon: '📚', desc: '+50% experience', xp: 0.5 },
  tireless:  { id: 'tireless',  name: 'Tireless',     icon: '🔋', desc: '+15% work efficiency', prod: 0.15 },
  frugal:    { id: 'frugal',    name: 'Frugal',       icon: '🍽️', desc: 'Eats 30% less', hunger: -0.3 },
  brave:     { id: 'brave',     name: 'Brave',        icon: '🦁', desc: '+40% guard damage', guard: 0.4 },
  lucky:     { id: 'lucky',     name: 'Lucky',        icon: '🍀', desc: '+30% expedition loot', loot: 0.3 },
  glutton:   { id: 'glutton',   name: 'Glutton',      icon: '🍖', desc: 'Eats 30% more, +10% efficiency', hunger: 0.3, prod: 0.1 },
  clumsy:    { id: 'clumsy',    name: 'Clumsy',       icon: '🩼', desc: '-10% efficiency, +40% experience', prod: -0.1, xp: 0.4 },
  cheerful:  { id: 'cheerful',  name: 'Cheerful',     icon: '😄', desc: '+2 bunker morale', morale: 2 },
};

DE.Data.NAMES_FIRST = ['Ava', 'Mateo', 'Yuki', 'Omar', 'Lena', 'Kofi', 'Ines', 'Rafael', 'Nadia', 'Bjorn', 'Priya', 'Tomas',
  'Zara', 'Idris', 'Mila', 'Jonah', 'Sofia', 'Dmitri', 'Hana', 'Luca', 'Amara', 'Felix', 'Noor', 'Ezra', 'Greta', 'Kai',
  'Rosa', 'Arlo', 'Freya', 'Santi', 'Wren', 'Diego', 'Maya', 'Ruben', 'Elin', 'Bo', 'Tariq', 'Juno', 'Otto', 'Sana'];
DE.Data.NAMES_LAST = ['Reyes', 'Okafor', 'Lindqvist', 'Tanaka', 'Haddad', 'Novak', 'Mbeki', 'Costa', 'Fischer', 'Moreau',
  'Petrov', 'Singh', 'Walsh', 'Zhang', 'Kowalski', 'Romero', 'Ahmed', 'Sato', 'Brandt', 'Dubois', 'Ortega', 'Nilsen'];
