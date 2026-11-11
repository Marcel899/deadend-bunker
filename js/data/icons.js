/* Icon registry: every picture the UI shows comes from the cut-out reference art in /assets.
 * Keys are semantic ("res.food", "room.farm", "nav.defense"); values are files. */
var DE = globalThis.DE = globalThis.DE || {};
DE.Data = DE.Data || {};

DE.Icons = (function () {
  const I = 'assets/icons/', R = 'assets/rooms/';
  const MAP = {
    // resources
    'res.food': I + 'can.png', 'res.water': I + 'water.png', 'res.electricity': I + 'power.png', 'res.scrap': I + 'ingot.png',
    'res.concrete': I + 'brick.png', 'res.fuel': I + 'jerrycan.png', 'res.research': I + 'flask.png', 'res.legacy': I + 'crown.png',
    // navigation / HUD
    'nav.bunker': I + 'home.png', 'nav.survivors': I + 'group.png', 'nav.research': I + 'flask.png', 'nav.excavate': I + 'pickaxe.png',
    'nav.defense': I + 'shield.png', 'nav.expeditions': I + 'truck.png', 'nav.legacy': I + 'trophy.png', 'nav.settings': I + 'gear.png',
    'nav.economy': I + 'chart.png', 'brand': I + 'radiation.png', 'wave': I + 'zombie.png', 'morale': I + 'heart.png', 'pop': I + 'people.png',
    'build': I + 'hammer.png', 'housing': I + 'home.png', 'warning': I + 'warning.png', 'xp': I + 'star.png', 'loot': I + 'chest.png',
    'clock': I + 'clock.png', 'dig': I + 'shovel.png', 'facility': I + 'factory.png', 'trait': I + 'star.png', 'rescue': I + 'people.png',
    // rooms
    'room.quarters': R + 'quarters-thumb.png', 'room.farm': R + 'farm-thumb.png', 'room.water': I + 'water.png', 'room.generator': R + 'generator-thumb.png',
    'room.workshop': R + 'workshop-thumb.png', 'room.refinery': I + 'barrel.png', 'room.lab': R + 'lab-thumb.png', 'room.storage': R + 'storage-thumb.png',
    'room.concrete': I + 'brick.png', 'room.cafeteria': I + 'can.png', 'room.medbay': I + 'flask.png', 'room.armory': I + 'shield.png',
    'room.training': I + 'medal.png', 'room.radio': I + 'factory.png', 'room.garage': I + 'scroll.png',
    'room.geothermal': I + 'power.png', 'room.aquifer': I + 'water.png', 'room.orevein': I + 'ingot.png', 'room.server': R + 'lab-thumb.png',
    'room.cache': I + 'badge.png', 'room.dormitory': R + 'quarters-thumb.png',
    'home': I + 'home.png', 'info': I + 'info.png', 'alert': I + 'alert.png', 'gear': I + 'gear.png', 'chest': I + 'chest.png', 'coin': I + 'coin.png', 'lock': I + 'lock.png', 'recycle': I + 'refresh.png', 'dig2': I + 'pickaxe.png', 'medkit': I + 'medkit.png', 'trash': I + 'trash.png', 'trophy': I + 'trophy.png', 'biohazard': I + 'biohazard.png', 'zombies': I + 'zombie.png', 'coin': I + 'coin.png', 'timer': I + 'clock.png', 'guards': I + 'helmet.png', 'traps': I + 'spikes.png', 'shield': I + 'shield.png', 'skull2': I + 'skull.png', 'wallicon': I + 'brick.png', 'perimeter': I + 'barrier.png', 'book': I + 'scroll.png', 'battle': I + 'fire.png', 'up': I + 'up.png', 'vehicle': I + 'van.png', 'check': I + 'check.png', 'floors': I + 'bunker.png', 'rooms': I + 'home.png', 'noise': I + 'eyeoff.png', 'noise.loud': I + 'eye.png', 'artifacts': I + 'diamond.png', 'power': I + 'power.png', 'research': I + 'flask.png', 'objectives': I + 'alert.png', 'events': I + 'scroll.png', 'repair2': I + 'wrench.png', 'skull': I + 'skull.png', 'fire': I + 'fire.png', 'star': I + 'star.png', 'chart': I + 'chart.png',
    'move': I + 'move.png', 'refresh': I + 'refresh.png', 'repair': I + 'refresh.png', 'snow': I + 'snow.png', 'truck': I + 'truck.png', 'vehicle': I + 'truck.png',
    // research branches
    'branch.economy': I + 'chart.png', 'branch.engineering': I + 'gear.png', 'branch.survival': I + 'shield.png',
    // people & enemies
    'prof': I + 'people.png', 'zombie': I + 'zombie.png', 'zombie.art': 'assets/zombies/walker-art.png',
    'location': I + 'mappin.png', 'wall': I + 'brick.png', 'turret': I + 'turret.png', 'trap': I + 'spikes.png', 'guard': I + 'shield.png',
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
