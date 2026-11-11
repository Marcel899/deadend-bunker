/* Resource definitions. `capped:false` resources ignore storage limits. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Data.RESOURCES = {
  food:        { id: 'food',        name: 'Food',        icon: '🥫', color: '#e8a74a', capped: true,  value: 1 },
  water:       { id: 'water',       name: 'Water',       icon: '💧', color: '#5bb8f0', capped: true,  value: 1 },
  electricity: { id: 'electricity', name: 'Power',       icon: '⚡', color: '#f5e04e', capped: true,  value: 1.5 },
  scrap:       { id: 'scrap',       name: 'Scrap',       icon: '🔩', color: '#b7b7c4', capped: true,  value: 1.2 },
  concrete:    { id: 'concrete',    name: 'Concrete',    icon: '🧱', color: '#d08a6a', capped: true,  value: 3 },
  fuel:        { id: 'fuel',        name: 'Fuel',        icon: '🛢️', color: '#9ad36b', capped: true,  value: 2.5 },
  research:    { id: 'research',    name: 'Research',    icon: '🧪', color: '#c77dff', capped: false, value: 4 },
};
DE.Data.RESOURCE_ORDER = ['food', 'water', 'electricity', 'scrap', 'concrete', 'fuel', 'research'];

DE.Data.START_RESOURCES = { food: 250, water: 250, electricity: 80, scrap: 220, concrete: 0, fuel: 150, research: 0 };
