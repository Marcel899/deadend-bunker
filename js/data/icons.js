/* Icon registry: every picture the UI shows comes from the cut-out reference art in /assets.
 * Keys are semantic ("res.food", "room.farm", "nav.defense"); values are files. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Icons = (function () {
  const I = 'assets/icons/', R = 'assets/rooms/';
  const MAP = {
    // resources
    'res.food': I + 'can.png', 'res.water': I + 'drop.png', 'res.electricity': I + 'power.png', 'res.scrap': I + 'ingot.png',
    'res.concrete': I + 'brick.png', 'res.fuel': I + 'barrel.png', 'res.research': I + 'flask.png', 'res.legacy': I + 'badge.png',
    // navigation / HUD
    'nav.bunker': I + 'home.png', 'nav.survivors': I + 'people.png', 'nav.research': I + 'flask.png', 'nav.excavate': I + 'map.png',
    'nav.defense': I + 'shield.png', 'nav.expeditions': I + 'backpack.png', 'nav.legacy': I + 'badge.png', 'nav.settings': I + 'gear.png',
    'nav.economy': I + 'chart.png', 'brand': I + 'radiation.png', 'wave': I + 'zombie.png', 'morale': I + 'medal.png', 'pop': I + 'people.png',
    'build': I + 'factory.png', 'housing': I + 'home.png', 'warning': I + 'radiation.png', 'xp': I + 'medal.png', 'loot': I + 'backpack.png',
    'clock': I + 'gear.png', 'dig': I + 'map.png', 'facility': I + 'factory.png', 'trait': I + 'medal.png', 'rescue': I + 'people.png',
    // rooms
    'room.quarters': R + 'quarters-thumb.png', 'room.farm': R + 'farm-thumb.png', 'room.water': I + 'drop.png', 'room.generator': R + 'generator-thumb.png',
    'room.workshop': R + 'workshop-thumb.png', 'room.refinery': I + 'barrel.png', 'room.lab': R + 'lab-thumb.png', 'room.storage': R + 'storage-thumb.png',
    'room.concrete': I + 'brick.png', 'room.cafeteria': I + 'can.png', 'room.medbay': I + 'flask.png', 'room.armory': I + 'shield.png',
    'room.training': I + 'medal.png', 'room.radio': I + 'factory.png', 'room.garage': I + 'scroll.png',
    'room.geothermal': I + 'power.png', 'room.aquifer': I + 'drop.png', 'room.orevein': I + 'ingot.png', 'room.server': R + 'lab-thumb.png',
    'room.cache': I + 'badge.png', 'room.dormitory': R + 'quarters-thumb.png',
    // research branches
    'branch.economy': I + 'chart.png', 'branch.engineering': I + 'gear.png', 'branch.survival': I + 'shield.png',
    // people & enemies
    'prof': I + 'people.png', 'zombie': I + 'zombie.png', 'zombie.art': 'assets/zombies/walker-art.png',
    'location': I + 'map.png', 'wall': I + 'brick.png', 'turret': I + 'power.png', 'trap': I + 'gear.png', 'guard': I + 'shield.png',
    'logo': 'assets/ui/logo.png', 'entrance': 'assets/ui/bunker-entrance.png',
  };
  /* A profession's portrait is the people icon tinted per job (CSS filter). */
  const PROF_HUE = { farmer: 60, mechanic: 20, engineer: 0, scientist: 180, soldier: 300, medic: 330, cook: 40, scavenger: 90 };
  /* Zombie variants: hue shift + scale on the one sprite. */
  const ZOMBIE_STYLE = { walker: 'filter:none', runner: 'filter:hue-rotate(-20deg) saturate(1.3);transform:scaleX(-1)', brute: 'filter:hue-rotate(20deg) contrast(1.2);transform:scale(1.5)',
    toxic: 'filter:hue-rotate(60deg) saturate(2)', mutant: 'filter:hue-rotate(-90deg) saturate(1.6);transform:scale(1.8)', boss: 'filter:hue-rotate(-140deg) saturate(1.5) contrast(1.2);transform:scale(2.6)' };

  function src(key) { return MAP[key] || MAP.brand; }
  function img(key, cls, title) {
    return `<img class="ico ${cls || ''}" src="${src(key)}" alt="" draggable="false"${title ? ` title="${title}"` : ''}>`;
  }
  const res = (r, cls) => img('res.' + r, cls || 'ico-res');
  const room = (type, cls) => img('room.' + type, cls || 'ico-room');
  const nav = (n, cls) => img('nav.' + n, cls || 'ico-nav');
  const branch = (b, cls) => img('branch.' + b, cls);
  function prof(p, cls, title) { return `<img class="ico ico-prof ${cls || ''}" src="${MAP.prof}" alt="" style="filter:hue-rotate(${PROF_HUE[p] || 0}deg)"${title ? ` title="${title}"` : ''}>`; }
  function zombie(id, cls) { return `<img class="ico ico-zombie ${id} ${cls || ''}" src="${MAP.zombie}" alt="" style="${ZOMBIE_STYLE[id] || ''}">`; }

  return { MAP, src, img, res, room, nav, branch, prof, zombie, PROF_HUE };
})();
