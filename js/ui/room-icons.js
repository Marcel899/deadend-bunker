/* Build icons. Rooms use the icons composed from the furniture sprites by tools/build_icons.py
 * (assets/rooms/icons, listed in DE.Data.ROOM_ICONS); the vector icons below remain the fallback.
 * Originally: an individually composed icon for every buildable room and surface structure.
 * Room icons are drawn from the same vector props the room itself shows (DE.Scenes.P), so an
 * icon always matches the room's actual look: each room has a hand-picked "signature" of one to
 * three props, set in a framed mini-cutaway with the room's wall/floor theme colours. Every icon
 * shares the same frame, outline weight, lighting and floor line, and is rasterised once to a
 * data-URI <img> so it stays crisp and cheap at any UI size. Structure icons are drawn directly. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.RoomIcons = (function () {
  const INK = '#1c1020', FLOORY = 80;
  /* room id → [[prop, x, scale, opts], …]  (x in a 100-wide icon, props stand on the floor line) */
  const SIG = {
    quarters: [['bunk', 34, .62], ['locker', 76, .6, { n: 1 }]], dormitory: [['bunk', 30, .58], ['bunk', 70, .58, { v: 2 }]],
    cafeteria: [['table', 50, .7, { w: 70, items: ['mug', 'plate'] }], ['benchseat', 50, .7]], kitchen: [['stove', 38, .6], ['fridge', 76, .55]],
    storage: [['shelf', 34, .55], ['crate', 72, .6, { n: 2 }]], coldstorage: [['freezer', 34, .58], ['freezer', 72, .58]],
    generator: [['generator', 50, .66]], watertank: [['watertank', 50, .62]], workshop: [['workbench', 50, .62], ['toolboard', 50, .5, { w: 60 }, 42]],
    medbay: [['medbed', 46, .78], ['ivstand', 80, .6]], radio: [['radio', 50, .9]], farm: [['planter', 32, .62, { stage: 3 }], ['planter', 72, .62, { stage: 2 }]],
    security: [['monitorwall', 50, .6, {}, 52], ['desk', 50, .55]], water: [['filtercol', 36, .6], ['pump', 72, .6]], concrete: [['generator', 40, .55], ['sack', 80, .7]],
    hydroponics: [['traytower', 32, .55], ['traytower', 72, .55]], purification: [['filtercol', 32, .6], ['tank', 72, .5]], armory: [['weaponrack', 50, .66, { n: 3 }]],
    barracks: [['bunk', 34, .6, { color: '#4a5a3a', sheet: '#8a8e98' }], ['weaponrack', 76, .5, { n: 2 }]], advworkshop: [['lathe', 36, .55], ['press', 74, .5]],
    infirmary: [['medbed', 34, .62], ['medbed', 72, .62]], garage: [['truck', 50, .62]], training: [['weights', 34, .8], ['punchbag', 74, .6, {}, 14]],
    comms: [['dish', 46, 1.05], ['serverrack', 84, .4, { n: 1 }]], lab: [['labbench', 50, .6], ['microscope', 40, .65, {}, 55], ['testtubes', 64, .7, { n: 3 }, 55]],
    refinery: [['tank', 36, .5], ['tank', 72, .5]], greenhouse: [['tree', 34, .5, { h: 110 }], ['planter', 74, .6, { stage: 3 }]], recycling: [['conveyor', 50, .55], ['press', 50, .45]],
    seccontrol: [['console', 40, .6], ['turretmodel', 74, .8]], vehicleshop: [['carlift', 50, .6], ['truck', 50, .32, {}, 72]], ammofactory: [['press', 36, .5], ['ammobox', 76, .7, { n: 2 }]],
    quarantine: [['glasswall', 50, .55, { w: 110, h: 100 }], ['medbed', 50, .55]], intel: [['mapscreen', 50, .75, {}, 56], ['desk', 50, .5]], reactor: [['reactor', 50, .45]],
    genetics: [['tank', 34, .5], ['dnascreen', 70, .6, {}, 46]], autofarm: [['traytower', 30, .5], ['robotarm', 70, .55]], hospital: [['medbed', 40, .7, { v: 3 }], ['ivstand', 78, .55]],
    dronehangar: [['dronepad', 50, 1], ['drone', 50, 1.1, {}, 46]], heavyweapons: [['turretmodel', 36, .9], ['forge', 74, .5]], tactical: [['mapscreen', 46, .75, {}, 56], ['flag', 84, .55]],
    cryo: [['cryopod', 34, .6], ['cryopod', 70, .6]], seismic: [['seismo', 46, .7], ['rock', 82, .7, { w: 20 }]], defcontrol: [['console', 34, .55], ['turretmodel', 70, .8]],
    fusion: [['fusioncore', 50, .5]], bioeng: [['pod', 36, .6], ['hologram', 72, .7, {}, 62]], reservoir: [['water', 50, .6, { w: 70 }], ['pump', 80, .5]],
    aicommand: [['hologram', 50, .8, {}, 60], ['serverrack', 22, .45, { n: 1 }], ['serverrack', 80, .45, { n: 1 }]], autoplant: [['conveyor', 50, .55], ['robotarm', 50, .5]],
    warroom: [['mapscreen', 50, .75, {}, 56], ['flag', 86, .5], ['weaponrack', 16, .45, { n: 1 }]], uplink: [['dish', 50, 1.2]], medresearch: [['labbench', 44, .55], ['dnascreen', 76, .55, {}, 46]],
    silo: [['missile', 50, .42]], ark: [['tree', 32, .45, { h: 110 }], ['bunk', 72, .5, { color: '#4a8a3a', sheet: '#f3f0e8' }]], geothermal: [['lava', 50, .6, {}, 80], ['generator', 50, .5]],
    aquifer: [['water', 50, .6, { w: 70 }], ['crystal', 80, .7]], orevein: [['ore', 34, .7], ['minecart', 70, .55]], minehead: [['minecart', 40, .6], ['rock', 76, .7, { w: 16 }]], server: [['serverrack', 36, .5, { n: 2 }], ['desk', 76, .45]],
    cache: [['crate', 32, .6, { n: 2, color: '#4a5a3a' }], ['weaponrack', 74, .5, { n: 2 }]],
  };
  const CAT = { production: '#7cc46a', support: '#5bb8f0', defense: '#e74c5a', housing: '#ffc531' };
  const cache = {};

  function frame(inner, theme, cat, id) {
    const t = (DE.Scenes.THEMES[theme] || DE.Scenes.THEMES.default);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
      <defs>${DE.Scenes.defs()}<clipPath id="ic-${id}"><rect x="5" y="5" width="90" height="90" rx="16"/></clipPath>
        <linearGradient id="icw-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.wall}"/><stop offset="1" stop-color="${t.wall2}"/></linearGradient>
        <radialGradient id="icl-${id}" cx=".5" cy=".1" r=".75"><stop offset="0" stop-color="${t.lamp}" stop-opacity=".55"/><stop offset="1" stop-color="${t.lamp}" stop-opacity="0"/></radialGradient></defs>
      <g clip-path="url(#ic-${id})"><rect width="100" height="100" fill="url(#icw-${id})"/><rect width="100" height="100" fill="url(#icl-${id})"/>
        <rect x="0" y="${FLOORY}" width="100" height="${100 - FLOORY}" fill="${t.floor}"/><rect x="0" y="${FLOORY - 2}" width="100" height="4" fill="${INK}"/><rect x="0" y="0" width="100" height="10" fill="${t.trim}"/>
        ${inner}
        <rect width="100" height="100" fill="url(#sc-vig)" opacity=".6"/></g>
      <rect x="5" y="5" width="90" height="90" rx="16" fill="none" stroke="${INK}" stroke-width="6"/>
      <rect x="9" y="9" width="82" height="82" rx="12" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>
      <circle cx="84" cy="16" r="7" fill="${CAT[cat] || '#aaa'}" stroke="${INK}" stroke-width="3"/></svg>`;
  }
  function roomSvg(type) {
    const def = DE.Data.ROOMS[type]; if (!def) return null;
    const layout = DE.Data.SCENES[type] || DE.Data.SCENES._default;
    let sig = SIG[type];
    if (!sig) { const first = (layout.props || []).find(p => DE.Scenes.P[p[0]] && !['pipe', 'wire', 'sign', 'poster', 'neon', 'vent', 'clock', 'warningstripe', 'lamp', 'cablebox'].includes(p[0])); sig = first ? [[first[0], 50, .6, first[3]]] : []; }
    const inner = sig.map(([name, x, k, o, y]) => { const fn = DE.Scenes.P[name]; if (!fn) return ''; const opts = Object.assign({ v: 2 }, o || {}); return `<g transform="translate(${x} ${y == null ? FLOORY : y}) scale(${k})">${fn(opts)}</g>`; }).join('');
    return frame(inner, layout.theme, def.category, type);
  }
  function uri(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/\s+/g, ' ')); }
  function roomSrc(type) { if (!(type in cache)) { const s = roomSvg(type); cache[type] = s ? uri(s) : null; } return cache[type]; }

  /* ---------- surface structures ---------- */
  const STRUCT = {
    fence: `<rect x="14" y="30" width="72" height="50" fill="none" stroke="#8a8e98" stroke-width="3"/><path d="M14 40 H86 M14 50 H86 M14 60 H86 M14 70 H86 M26 30 V80 M38 30 V80 M50 30 V80 M62 30 V80 M74 30 V80" stroke="#3a3f4a" stroke-width="2.4"/><rect x="10" y="24" width="10" height="58" rx="2" fill="#5a5f6a" stroke="${INK}" stroke-width="3"/><rect x="80" y="24" width="10" height="58" rx="2" fill="#5a5f6a" stroke="${INK}" stroke-width="3"/><path d="M14 26 H86" stroke="${INK}" stroke-width="4"/>`,
    barricades: `<g fill="#d8b06e" stroke="${INK}" stroke-width="3">${[[30, 76], [52, 76], [74, 76], [41, 64], [63, 64], [52, 52]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="13" ry="7"/>`).join('')}</g><path d="M20 76 h4 M46 76 h4 M68 76 h4" stroke="#7a5a32" stroke-width="2"/>`,
    towers: `<g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"><path d="M36 50 L28 82 M64 50 L72 82 M32 66 H68" fill="none" stroke-width="4.5"/><rect x="28" y="40" width="44" height="12" rx="2" fill="#6b4228"/><rect x="31" y="22" width="38" height="20" rx="2" fill="#ffb13a"/><rect x="24" y="15" width="52" height="9" rx="3" fill="#6b4228"/><path d="M44 22 V42 M56 22 V42"/></g><circle cx="50" cy="32" r="4" fill="#2a1a28"/>`,
    lights: `<path d="M50 42 L18 82 H82 Z" fill="#fff7c0" opacity=".35"/><rect x="46" y="40" width="8" height="42" fill="#5a5f6a" stroke="${INK}" stroke-width="3"/><rect x="32" y="24" width="36" height="18" rx="4" fill="#2f2d38" stroke="${INK}" stroke-width="3.5"/><rect x="36" y="36" width="28" height="4" fill="#fff7c0"/>`,
    road: `<path d="M38 26 L22 82 H78 L62 26 Z" fill="#4a4650" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/><path d="M50 30 V40 M50 48 V60 M50 68 V80" stroke="#ffd34a" stroke-width="4"/><path d="M80 58 l7 22 H73 Z" fill="#f08a2a" stroke="${INK}" stroke-width="2.5"/>`,
    missile: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M28 74 l40 -40" stroke="#5a5f6a" stroke-width="12" stroke-linecap="round"/><path d="M34 70 l34 -34" stroke="#d8d6d1" stroke-width="7" stroke-linecap="round"/><path d="M68 36 l6 -14 l-14 6 z" fill="#d8303a"/><path d="M26 66 l-6 -2 l6 10 z M36 78 l-2 -6 l10 6 z" fill="#5a5f6a"/><path d="M18 84 l10 -10" stroke="#ffb13a" stroke-width="5"/></g>`,
    wall: `<g stroke="${INK}" stroke-width="3"><rect x="14" y="34" width="72" height="48" fill="#b8b5ae"/><path d="M14 50 H86 M14 66 H86 M38 34 V50 M62 34 V50 M26 50 V66 M50 50 V66 M74 50 V66 M38 66 V82 M62 66 V82" stroke="#6c6865" stroke-width="2.5"/></g><rect x="14" y="30" width="72" height="8" rx="2" fill="#d8d6d1" stroke="${INK}" stroke-width="3"/>`,
    turret: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M32 82 L38 64 H62 L68 82 Z" fill="#4e5058"/><g transform="rotate(-14 50 54)"><rect x="54" y="49" width="34" height="9" rx="2" fill="#2d2f36"/><rect x="34" y="42" width="28" height="22" rx="7" fill="#6a6e78"/></g></g><circle cx="52" cy="52" r="3" fill="#ff4a2e"/>`,
    trap: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><ellipse cx="50" cy="72" rx="32" ry="9" fill="#5a5f6a"/><path d="M22 70 l6 -18 l6 16 l6 -18 l6 16 l6 -18 l6 16 l6 -18 l6 16 l6 -14" fill="none" stroke-width="3.5"/><path d="M22 70 l6 -18 l6 16 l6 -18 l6 16 l6 -18 l6 16 l6 -18 l6 16 l6 -14" fill="none" stroke="#c9ccd4" stroke-width="1.5"/></g>`,
  };
  function structSrc(key) {
    if (!STRUCT[key]) return null; const ck = 's:' + key;
    if (!(ck in cache)) cache[ck] = uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb46a"/><stop offset="1" stop-color="#8a3a6a"/></linearGradient></defs><rect x="5" y="5" width="90" height="90" rx="16" fill="url(#sk)"/><rect x="5" y="80" width="90" height="15" fill="#5b6e22"/><path d="M5 80 H95" stroke="${INK}" stroke-width="3"/>${STRUCT[key]}<rect x="5" y="5" width="90" height="90" rx="16" fill="none" stroke="${INK}" stroke-width="6"/><rect x="9" y="9" width="82" height="82" rx="12" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="2"/></svg>`);
    return cache[ck];
  }

  /* hook into the icon registry: rooms and structures now use these */
  function install() {
    if (!DE.Icons || DE.Icons._roomIcons) return;
    DE.Icons._roomIcons = true;
    // composed sprite icons (tools/build_icons.py) first; the vector mini-cutaway is the fallback
    const PNG = new Set((DE.Data && DE.Data.ROOM_ICONS) || []);
    DE.Icons.roomSrc = (type) => PNG.has(type) ? 'assets/rooms/icons/' + type + '.png' : roomSrc(type);
    DE.Icons.room = (type, cls) => { const s = DE.Icons.roomSrc(type); return s ? `<img class="ico ico-room ${cls || ''}" src="${s}" alt="" draggable="false">` : DE.Icons.img('room.' + type, cls || 'ico-room'); };
    const SPNG = new Set((DE.Data && DE.Data.STRUCT_ICONS) || []);
    DE.Icons.structure = (key, cls) => { const s = SPNG.has(key) ? 'assets/rooms/icons/s-' + key + '.png' : structSrc(key); return s ? `<img class="ico ico-struct ${cls || ''}" src="${s}" alt="" draggable="false">` : ''; };
  }
  install();
  return { roomSrc, structSrc, SIG, install };
})();
