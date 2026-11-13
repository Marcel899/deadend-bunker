/* The Research screen: one tech tree per branch (DE.Data.RESEARCH, rules in js/core/research.js).
 *
 *   The tree   nodes sit in tiers by prerequisite depth, each one under the parents it needs, joined
 *              by connectors. Lines light up as research is done and "power" flows along them into
 *              what can be researched next. A node shows its icon, a state ring (done, ready, running
 *              with its progress, too expensive, locked), a badge for what it unlocks and its cost.
 *              Locked projects further down the tree are silhouettes: you see that something is
 *              there, and what it needs, before you know what it is.
 *   The panel  the selected project: what it does, what it unlocks (rooms, forge recipes, room
 *              games, rock layers, defenses), what it needs and what it leads to, where it connects
 *              to the rest of the bunker (with links there), and the button to research it.
 *
 * render() only changes when something meaningful does (a project done or started, a node becoming
 * affordable, the selection, the branch, the drawer's size), so the drawer is not rebuilt every tick;
 * tick() keeps the live numbers (points, progress, time left) current and plays the animations. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.RTree = (function () {
  const U = () => DE.Util, esc = (s) => DE.Util.escapeHtml(String(s)), ui = () => DE.UI.ui, RS = () => DE.Data.RESEARCH;
  const img = (k, c) => DE.Icons.img(k, c || 'ico-inline');

  /* ---------- how a project looks ---------- */
  const K = '#1c1020';
  const SVG = {
    sprout: `<svg viewBox="0 0 64 64" class="rt-svg"><path d="M10 56 Q32 41 54 56 Z" fill="#8a5a32" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M32 51 V26" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M32 51 V26" stroke="#5fbf3a" stroke-width="4" stroke-linecap="round"/><path d="M31 33 C19 33 9 25 9 11 C23 11 31 20 31 33 Z" fill="#7fdc3e" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M33 29 C43 27 53 20 55 6 C41 6 33 15 33 29 Z" fill="#a6f26a" stroke="${K}" stroke-width="4" stroke-linejoin="round"/></svg>`,
    gun: `<svg viewBox="0 0 64 64" class="rt-svg"><path d="M3 27 H44 L48 23 H61 V31 H51 L48 35 H37 L33 50 H23 L26 35 H14 L12 40 H3 Z" fill="#6f7380" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><path d="M3 27 V40 H12 L14 35" fill="#a8703e" stroke="${K}" stroke-width="4" stroke-linejoin="round"/><rect x="21" y="18" width="17" height="7" rx="2" fill="#3a3e48" stroke="${K}" stroke-width="3"/><path d="M47 26 H58" stroke="#fff" stroke-width="2" opacity=".45"/></svg>`,
    vest: `<svg viewBox="0 0 40 40" class="rt-svg"><path d="M8 8 l8 -3 q4 4 8 0 l8 3 l-2 8 v18 h-20 v-18 z" fill="#8a7a5a" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/><path d="M14 18 h12 M14 24 h12" stroke="${K}" stroke-width="1.5" opacity=".5"/></svg>`,
    ammo: `<svg viewBox="0 0 40 40" class="rt-svg"><rect x="6" y="14" width="28" height="20" rx="3" fill="#5a6f3a" stroke="${K}" stroke-width="2.5"/><path d="M10 14 v-6 q2 -4 4 0 v6 M18 14 v-6 q2 -4 4 0 v6 M26 14 v-6 q2 -4 4 0 v6" fill="#c9a24a" stroke="${K}" stroke-width="2"/></svg>`,
    blade: `<svg viewBox="0 0 40 40" class="rt-svg"><path d="M6 32 L28 8 Q34 6 34 12 L12 34 Z" fill="#c9cdd6" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 32 l6 2 l-3 4 l-6 -2 z" fill="#8a5a32" stroke="${K}" stroke-width="2.5" stroke-linejoin="round"/></svg>`,
  };
  const ICON = {
    farming1: 'svg:sprout', purification: 'water', recycling: 'refresh', farming2: 'svg:sprout', purification2: 'barrel', automation: 'gear', logistics: 'chest', automation2: 'factory',
    construction: 'construction', metalwork: 'hammer', gunsmith: 'svg:gun', excavation1: 'shovel', electricity: 'power', machinery: 'wrench', construction2: 'brick', excavation2: 'pickaxe', fusion: 'radiation',
    blueprints2: 'scroll', blueprints3: 'scroll', blueprints4: 'scroll', blueprints5: 'scroll', excavation3: 'pickaxe', excavation4: 'fire',
    medicine: 'medkit', housing: 'home', defense1: 'shield', efficiency: 'medal', defense2: 'turret', dampening: 'eyeoff', medicine2: 'hospital', offline: 'clock', housing2: 'bunker', efficiency2: 'badge',
  };
  const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];
  const icon = (n) => { const k = ICON[n.id] || 'flask'; return k.startsWith('svg:') ? SVG[k.slice(4)] : img(k, 'rt-img'); };
  const numeral = (n) => { const m = /(\d)$/.exec(n.id); return m && +m[1] >= 2 ? ROMAN[+m[1]] || '' : ''; };
  const branchOf = (b) => DE.Data.RESEARCH_BRANCHES[b] || { name: b, color: '#d7a6ff' };

  /* ---------- what a project does ---------- */
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  const BI = { consumptionMult: 'refresh', unmannedBase: 'gear', storageMult: 'chest', globalMult: 'up', buildTimeMult: 'clock', buildCostMult: 'coins', maxFloor: 'shovel', powerUseMult: 'power',
    excavationCostMult: 'pickaxe', unlockTurrets: 'turret', unlockTraps: 'spikes', fuelUseMult: 'jerrycan', noiseMult: 'eyeoff', healMult: 'medkit', housingPerLevel: 'home', wallHpMult: 'brick',
    workerEff: 'wrench', guardDmgMult: 'shield', turretDmgMult: 'turret', moraleBonus: 'heart', survivorConsumptionMult: 'can', offlineCapHours: 'clock', xpMult: 'star', unlockRoom: 'scroll' };
  /** One effect as a line of text, an icon and the part of the game it touches. */
  function benefit(e) {
    const room = e.room && DE.Data.ROOMS[e.room], v = e.value;
    const T = {
      roomMult: [room ? room.name + ' output ' + pct(v) : 'Room output ' + pct(v), 'production'],
      unlockRoom: [room ? 'Unlocks the ' + room.name : 'New room blueprints: tier ' + (/(\d)$/.exec(e.room) || [0, '?'])[1], 'rooms'],
      consumptionMult: ['Room inputs ' + pct(v), 'production'], unmannedBase: ['Unstaffed rooms run at ' + Math.round(v * 100) + '%', 'production'],
      storageMult: ['Storage capacity ×' + (1 + v), 'production'], globalMult: ['All production ' + pct(v), 'production'], powerUseMult: ['Room power use ' + pct(v), 'production'],
      fuelUseMult: ['Fuel use ' + pct(v), 'production'], buildTimeMult: ['Build time ' + pct(v), 'rooms'], buildCostMult: ['Build and upgrade costs ' + pct(v), 'rooms'],
      maxFloor: ['Dig down to B' + v, 'excavation'], excavationCostMult: ['Excavation costs ' + pct(v), 'excavation'],
      unlockTurrets: ['Auto-turrets for the wall', 'defense'], unlockTraps: ['Traps on the approach', 'defense'], noiseMult: ['Bunker noise ' + pct(v) + ': smaller, rarer hordes', 'defense'],
      wallHpMult: ['Wall HP ' + pct(v), 'defense'], guardDmgMult: ['Guard damage ' + pct(v), 'defense'], turretDmgMult: ['Turret damage ' + pct(v), 'defense'],
      healMult: ['Healing ' + pct(v), 'survivors'], housingPerLevel: ['Quarters +' + v + ' beds per level', 'survivors'], workerEff: ['Workers ' + pct(v) + ' efficient', 'survivors'],
      moraleBonus: ['Morale +' + v, 'survivors'], survivorConsumptionMult: ['Survivors eat and drink ' + pct(v), 'survivors'], offlineCapHours: ['Keeps running ' + v + 'h longer while you are away', 'survivors'],
      xpMult: ['Experience ' + pct(v), 'survivors'],
    }[e.type] || [e.type + (v != null ? ' ' + v : ''), 'production'];
    const ico = room ? DE.Icons.room(e.room, 'rt-bi') : img(BI[e.type] || 'up', 'rt-bi');
    return { text: T[0], tag: T[1], ico };
  }
  const EXP_KEYS = ['expeditionSlots', 'lootBonus', 'expeditionSpeed', 'expeditionSafety', 'findBonus', 'extraTeam'];
  /** Everything new a project makes possible: rooms, forge recipes, room games, rock layers, defenses. */
  function unlocks(n) {
    const out = [], rooms = [];
    const addRoom = (id) => { if (!rooms.includes(id) && DE.Data.ROOMS[id] && !DE.Data.ROOMS[id].unique) rooms.push(id); };
    n.effects.forEach(e => { if (e.type === 'unlockRoom') addRoom(e.room); });
    Object.values(DE.Data.ROOMS).forEach(d => { if (d.unlock === n.id) addRoom(d.id); });
    rooms.forEach(id => { const d = DE.Data.ROOMS[id]; out.push({ kind: 'room', id, name: d.name, sub: d.minDepth > 1 ? 'from B' + d.minDepth : 'any floor', ico: DE.Icons.room(id, 'rt-ui') }); });
    if (DE.Gear) {
      const forgeNew = rooms.includes('forge');
      DE.Gear.recipes().filter(r => r.research === n.id || (forgeNew && !r.research)).forEach(r => out.push({ kind: 'recipe', id: r.id, name: r.name,
        sub: r.forge ? 'Forge Lv ' + r.forge + (r.mat ? ' + rare materials' : '') : 'at the forge', ico: r.kind === 'armor' ? SVG.vest : r.kind === 'ammo' ? SVG.ammo : r.ammo ? SVG.gun : SVG.blade }));
    }
    if (DE.Minigames) for (const g in DE.Minigames.GAMES) { const G = DE.Minigames.GAMES[g]; if (G.research.includes(n.id)) out.push({ kind: 'game', id: g, name: G.name + ' game', sub: 'harder, pays more', ico: DE.Icons.room(G.rooms[0], 'rt-ui') }); }
    (DE.Data.STRATA || []).filter(st => st.research === n.id).forEach(st => out.push({ kind: 'layer', id: st.id, name: st.name + ' layer', sub: st.tool + (st.mine ? ' · Mining Station Lv ' + st.mine : ''), ico: img('pickaxe', 'rt-ui') }));
    n.effects.forEach(e => { if (e.type === 'unlockTurrets') out.push({ kind: 'defense', id: 'turret', name: 'Auto-turrets', sub: 'on the wall', ico: img('turret', 'rt-ui') }); if (e.type === 'unlockTraps') out.push({ kind: 'defense', id: 'trap', name: 'Traps', sub: 'on the approach', ico: img('spikes', 'rt-ui') }); });
    return { list: out, rooms };
  }
  /** The parts of the game a project feeds into (and where to go to see it). */
  const CON = {
    production: { name: 'Production', ico: 'chart', act: 'data-action="openDrawer" data-drawer="economy"' },
    rooms: { name: 'Building', ico: 'construction', act: '' },
    excavation: { name: 'Excavation', ico: 'pickaxe', act: 'data-action="openDrawer" data-drawer="excavate"' },
    defense: { name: 'Defense', ico: 'shield', act: 'data-action="openDrawer" data-drawer="defense"' },
    survivors: { name: 'Survivors', ico: 'group', act: 'data-action="openDrawer" data-drawer="survivors"' },
    crafting: { name: 'Forge & armory', ico: 'hammer', act: 'data-action="openForge"' },
    games: { name: 'Room games', ico: 'play', act: '' },
    expeditions: { name: 'Expeditions', ico: 'truck', act: 'data-action="openDrawer" data-drawer="expeditions"' },
  };
  function connections(n, un) {
    const set = new Set(n.effects.map(e => benefit(e).tag));
    un.list.forEach(u => set.add({ room: 'rooms', recipe: 'crafting', game: 'games', layer: 'excavation', defense: 'defense' }[u.kind]));
    un.rooms.forEach(id => { const d = DE.Data.ROOMS[id], fx = d.effects || {};
      if (d.produces) set.add('production');
      if (EXP_KEYS.some(k => fx[k]) || id === 'garage' || id === 'vehicleshop') set.add('expeditions');
      if (fx.guardDmg || fx.turretCap || fx.wallHp || fx.trapDmg || id === 'armory' || id === 'forge') set.add('defense');
      if (fx.heal || fx.morale || fx.housing) set.add('survivors');
      if (id === 'training' || id === 'barracks') { set.add('defense'); set.add('expeditions'); }
      if (id === 'radio' || id === 'comms') set.add('expeditions');
    });
    return Object.keys(CON).filter(k => set.has(k));
  }

  /* ---------- the tree's shape ---------- */
  const shapes = {};
  /** Tiers by prerequisite depth; each node is placed under the parents it needs, pushed apart where
   *  they would overlap (x in columns, fractional). Cached per branch. */
  function shape(branch) {
    if (shapes[branch]) return shapes[branch];
    const nodes = DE.Research.byBranch(branch), depth = {};
    const d = (n) => depth[n.id] != null ? depth[n.id] : (depth[n.id] = n.requires.length ? 1 + Math.max(...n.requires.map(r => d(RS()[r]))) : 0);
    nodes.forEach(d);
    const tiers = []; nodes.forEach(n => (tiers[depth[n.id]] = tiers[depth[n.id]] || []).push(n));
    const x = {};
    tiers.forEach((t, i) => {
      if (!i) { t.forEach((n, k) => { x[n.id] = (k - (t.length - 1) / 2) * 1.15; }); return; }
      const want = (n) => n.requires.reduce((s, r) => s + x[r], 0) / n.requires.length;
      t.sort((a, b) => want(a) - want(b) || a.cost - b.cost);
      const pos = t.map(want);
      for (let it = 0; it < 40; it++) { let moved = false; for (let k = 1; k < pos.length; k++) { const gap = pos[k] - pos[k - 1]; if (gap < 1) { const p = (1 - gap) / 2 + .001; pos[k - 1] -= p; pos[k] += p; moved = true; } } if (!moved) break; }
      t.forEach((n, k) => { x[n.id] = pos[k]; });
    });
    const xs = Object.values(x), min = Math.min(...xs), max = Math.max(...xs);
    for (const id in x) x[id] -= min;
    const kids = {}; nodes.forEach(n => n.requires.forEach(r => (kids[r] = kids[r] || []).push(n.id)));
    return (shapes[branch] = { nodes, tiers, depth, x, cols: max - min + 1, kids });
  }

  /* ---------- state of a project ---------- */
  function stateOf(s, n) {
    if (s.research.done[n.id]) return 'done';
    if (s.research.current && s.research.current.id === n.id) return 'active';
    if (DE.Research.isAvailable(s, n.id)) return s.resources.research >= n.cost ? 'ready' : 'avail';
    // locked: are its missing prerequisites at least within reach?
    return n.requires.every(r => s.research.done[r] || DE.Research.isAvailable(s, r) || (s.research.current && s.research.current.id === r)) ? 'locked' : 'hidden';
  }
  const ancestors = (id, set) => { set = set || new Set(); (RS()[id] ? RS()[id].requires : []).forEach(r => { if (!set.has(r)) { set.add(r); ancestors(r, set); } }); return set; };
  /** How many projects still stand between here and this one. */
  function stepsTo(s, id) { const a = ancestors(id); let n = 0; a.forEach(r => { if (!s.research.done[r]) n++; }); return n; }
  function pickDefault(s, sh) {
    const cur = s.research.current; if (cur && sh.nodes.some(n => n.id === cur.id)) return cur.id;
    const by = (st) => sh.nodes.filter(n => stateOf(s, n) === st).sort((a, b) => a.cost - b.cost)[0];
    const n = by('ready') || by('avail') || by('locked') || sh.nodes.find(m => !s.research.done[m.id]) || sh.nodes[0];
    return n && n.id;
  }
  const hasLab = (s) => Object.values(s.rooms).some(r => (r.type === 'lab' || r.type === 'server') && r.level > 0 && !r.construction);

  /* ---------- render ---------- */
  let intro = 0, lastTick = 0, known = null;
  function render(s) {
    const B = DE.Data.RESEARCH_BRANCHES, cur = s.research.current;
    let br = ui().researchBranch; if (!B[br]) br = ui().researchBranch = 'economy';
    const sh = shape(br);
    let sel = ui().rtSel; if (!sel || !sh.nodes.some(n => n.id === sel)) sel = ui().rtSel = pickDefault(s, sh);
    // size the tree to the drawer: two columns when there is room, stacked otherwise
    const body = document.getElementById('drawer-body'), BW = body ? body.clientWidth - 32 : 900;
    const wide = BW >= 700, side = wide ? Math.round(Math.max(270, Math.min(340, BW * .36))) : 0;
    const avail = (wide ? BW - side - 12 : BW) - 30;
    const CW = Math.round(Math.max(92, Math.min(140, avail / Math.max(3, sh.cols)))), NODE = Math.round(Math.max(54, Math.min(72, CW - 50))), LBL = 60, RH = NODE + LBL + 44, PADX = 15, PADY = 18;
    const W = Math.max(avail, Math.round(PADX * 2 + sh.cols * CW)), H = PADY * 2 + sh.tiers.length * RH - 40;
    const off = (W - (PADX * 2 + sh.cols * CW)) / 2;
    const pos = (n) => ({ x: Math.round(off + PADX + sh.x[n.id] * CW), y: PADY + sh.depth[n.id] * RH });
    const st = {}; sh.nodes.forEach(n => { st[n.id] = stateOf(s, n); });
    const chain = ancestors(sel); chain.add(sel);
    const color = branchOf(br).color;

    // the header: points, the running project, the branches
    let html = `<div class="rt ${wide ? 'wide' : 'stack'}" style="--bc:${color}${wide ? ';--side:' + side + 'px' : ''}">`;
    html += `<div class="rt-top"><div class="rt-rp">${img('flask', 'rt-big')}<span><small>Research points</small><b class="rt-rpv">0</b><i class="rt-rate"></i></span></div>`;
    if (cur) { const n = RS()[cur.id], nb = branchOf(n.branch);
      html += `<div class="rt-cur" style="--cc:${nb.color}"><span class="rt-cico">${icon(n)}</span><div><small>Researching · ${esc(nb.name)}</small><b>${esc(n.name)}</b><i class="rt-bar"><b class="rt-barv"></b></i><small class="rt-left"></small></div>
        <span class="rt-cbtn">${n.branch !== br || sel !== n.id ? `<button class="btn small" data-action="rtSelect" data-id="${n.id}" data-branch="${n.branch}" type="button">Show</button>` : ''}<button class="btn small danger" data-action="cancelResearch" type="button" title="Half the points come back">Cancel</button></span></div>`; }
    else html += `<div class="rt-cur idle">${img(hasLab(s) ? 'info' : 'warning', 'rt-big')}<div><b>${hasLab(s) ? 'The lab is free' : 'No Research Lab'}</b><small>${hasLab(s) ? 'Pick a glowing project in the tree.' : 'Build a Research Lab: scientists there make research points.'}</small></div>${hasLab(s) ? '' : `<span class="rt-cbtn"><button class="btn small primary" data-action="rtBuild" data-type="lab" type="button">Build a lab</button></span>`}</div>`;
    html += `</div><div class="rt-tabs">${Object.keys(B).map(b => { const nodes = DE.Research.byBranch(b), done = nodes.filter(n => s.research.done[n.id]).length, ready = nodes.filter(n => stateOf(s, n) === 'ready').length;
      return `<button class="rt-tab ${b === br ? 'on' : ''}" data-action="researchBranch" data-branch="${b}" type="button" style="--tc:${B[b].color}">${DE.Icons.branch(b, 'rt-tico')}<span><b>${esc(B[b].name)}</b><i class="rt-tbar"><b style="width:${Math.round(100 * done / nodes.length)}%"></b></i></span><small>${done}/${nodes.length}</small>${ready ? `<em class="rt-ready" title="Ready to research">${ready}</em>` : ''}</button>`; }).join('')}
      <span class="rt-legend"><i class="lg done"></i>Done<i class="lg ready"></i>Ready<i class="lg active"></i>Running<i class="lg locked"></i>Locked</span></div>`;

    // the connectors
    let lines = '', guides = '';
    sh.tiers.forEach((t, i) => { const y = PADY + i * RH + NODE / 2; guides += `<path d="M0 ${y} H${W}" class="rt-guide"/>`; });
    sh.nodes.forEach(n => n.requires.forEach(r => {
      const pa = RS()[r], a = pos(pa), b = pos(n), x1 = a.x + CW / 2, y1 = a.y + NODE + LBL, x2 = b.x + CW / 2, y2 = b.y - 7, my = (y1 + y2) / 2;
      const cls = st[r] === 'done' ? (st[n.id] === 'done' ? 'done' : st[n.id] === 'locked' || st[n.id] === 'hidden' ? 'half' : 'flow') : 'off';
      const d = `M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
      lines += `<g class="rt-ln ${cls}${chain.has(r) && chain.has(n.id) ? ' chain' : ''}" style="--t:${sh.depth[n.id]}"><path d="${d}" class="o"/><path d="${d}" class="c"/>${cls === 'flow' ? `<path d="${d}" class="f"/>` : ''}<circle cx="${x2}" cy="${y2 + 2}" r="4.5" class="dot"/></g>`;
    }));

    // the nodes
    let nodes = '';
    sh.nodes.forEach(n => {
      const p = pos(n), S = st[n.id], un = unlocks(n), num = numeral(n);
      const badge = un.list.find(u => u.kind === 'room') ? ['room', 'home'] : un.list.find(u => u.kind === 'recipe') ? ['recipe', 'hammer'] : n.effects.some(e => e.type === 'maxFloor') ? ['dig', 'shovel'] : un.list.find(u => u.kind === 'defense') ? ['def', 'shield'] : null;
      const cost = S === 'done' ? '' : S === 'active' ? `<small class="rt-c run"><span class="rt-nleft"></span></small>`
        : `<small class="rt-c ${S === 'ready' ? 'go' : S === 'avail' ? 'poor' : ''}">${img('flask', 'rt-ci')}${U().fmt(n.cost)}</small>`;
      nodes += `<button class="rt-node st-${S}${n.id === sel ? ' sel' : ''}${chain.has(n.id) && n.id !== sel ? ' chain' : ''}" data-action="rtSelect" data-id="${n.id}" type="button" style="left:${p.x}px;top:${p.y}px;width:${CW}px;--n:${NODE}px;--t:${sh.depth[n.id]}" aria-label="${esc(n.name)}">
        <span class="rt-face">${icon(n)}${S === 'hidden' ? '<i class="rt-q">?</i>' : ''}${num ? `<i class="rt-num">${num}</i>` : ''}${badge && S !== 'hidden' ? `<i class="rt-badge b-${badge[0]}">${img(badge[1], '')}</i>` : ''}${S === 'done' ? `<i class="rt-ok">${img('check', '')}</i>` : S === 'locked' ? `<i class="rt-lk">${img('lock', '')}</i>` : ''}</span>
        <span class="rt-lbl"><b>${esc(n.name)}</b>${cost}</span></button>`;
    });
    html += `<div class="rt-main"><div class="rt-scroll" data-keep="rt-${br}"><div class="rt-map" data-branch="${br}" style="width:${W}px;height:${H}px"><svg class="rt-lines" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${guides}${lines}</svg>${nodes}</div></div>`;
    html += panel(s, RS()[sel], st[sel] || stateOf(s, RS()[sel]), sh) + `</div></div>`;
    return html;
  }

  /* ---------- the details panel ---------- */
  function panel(s, n, S, sh) {
    if (!n) return '<aside class="rt-side"></aside>';
    const b = branchOf(n.branch), un = unlocks(n), cons = connections(n, un), cur = s.research.current, c = DE.Research.canStart(s, n.id);
    const status = {
      done: `<span class="rt-st ok">${img('check', 'rt-ci')} Researched</span>`,
      active: `<span class="rt-st run">Researching · <b class="rt-left2"></b></span>`,
      ready: `<span class="rt-st go">Ready to research</span>`,
      avail: `<span class="rt-st poor">Needs <b class="rt-need">${U().fmt(Math.max(0, n.cost - s.resources.research))}</b> more research points</span>`,
      locked: `<span class="rt-st lock">${img('lock', 'rt-ci')} Locked</span>`,
      hidden: `<span class="rt-st hid">Classified · ${stepsTo(s, n.id)} projects away</span>`,
    }[S];
    const ben = n.effects.map(benefit).filter(x => !(x.tag === 'rooms' && /^Unlocks the /.test(x.text) && un.rooms.length));
    const req = n.requires.map(r => { const m = RS()[r], ok = s.research.done[r]; return `<button class="rt-chip ${ok ? 'ok' : ''}" data-action="rtSelect" data-id="${r}" data-branch="${m.branch}" type="button">${img(ok ? 'check' : 'lock', 'rt-ci')}${esc(m.name)}</button>`; }).join('');
    const kids = (sh.kids[n.id] || []).map(id => { const m = RS()[id], ms = stateOf(s, m); return `<button class="rt-chip ${ms === 'done' ? 'ok' : ''}" data-action="rtSelect" data-id="${id}" type="button"><span class="rt-mini">${icon(m)}</span>${esc(ms === 'hidden' ? '???' : m.name)}</button>`; }).join('');
    const unl = un.list.map(u => { const can = u.kind === 'room' && S === 'done' && DE.Bunker.isUnlocked(s, u.id);
      return `<div class="rt-unl k-${u.kind}"><span class="rt-uico">${u.ico}</span><span class="rt-utx"><b>${esc(u.name)}</b><small>${esc(u.sub)}</small></span>${can ? `<button class="btn tiny primary" data-action="rtBuild" data-type="${u.id}" type="button">Build</button>` : u.kind === 'recipe' && S === 'done' && DE.Gear.forgeLevel(s) ? '<button class="btn tiny" data-action="openForge" type="button">Forge</button>' : ''}</div>`; }).join('');
    let act;
    if (S === 'done') act = `<div class="rt-done">${img('check', 'rt-ci')} In use across the bunker</div>`;
    else if (S === 'active') act = `<div class="rt-prog"><i class="rt-bar"><b class="rt-barv"></b></i><button class="btn small danger" data-action="cancelResearch" type="button">Cancel (half back)</button></div>`;
    else if (S === 'ready' || S === 'avail') act = `<button class="btn primary rt-go ${c.ok ? '' : 'cant'}" data-action="research" data-id="${n.id}" type="button" ${c.ok ? '' : 'disabled'}><span>${c.ok ? 'Research' : esc(cur ? 'The lab is busy' : s.resources.research < n.cost ? 'Not enough points' : c.reason || 'Not now')}</span><small>${img('flask', 'rt-ci')}${U().fmt(n.cost)} · ${U().fmtTime(DE.Research.duration(s, n.id))}</small></button>`;
    else act = `<button class="btn rt-go cant" type="button" disabled><span>Locked</span><small>${img('flask', 'rt-ci')}${U().fmt(n.cost)} · ${U().fmtTime(DE.Research.duration(s, n.id))}</small></button>`;
    return `<aside class="rt-side st-${S}" style="--bc:${b.color}">
      <div class="rt-dh"><span class="rt-face big st-${S}">${icon(n)}${S === 'hidden' ? '<i class="rt-q">?</i>' : ''}</span><div><small>${esc(b.name)} · Tier ${DE.Research.tier(n.id)}</small><b class="rt-title">${esc(n.name)}</b>${status}</div></div>
      <div class="rt-scrollp"><p class="rt-desc">${esc(n.desc)}</p>
      ${ben.length ? `<h5>What it does</h5><ul class="rt-ben">${ben.map(x => `<li>${x.ico}<span>${esc(x.text)}</span></li>`).join('')}</ul>` : ''}
      ${unl ? `<h5>Unlocks</h5><div class="rt-unls">${unl}</div>` : ''}
      ${req ? `<h5>Needs</h5><div class="rt-chips">${req}</div>` : ''}
      ${kids ? `<h5>Leads to</h5><div class="rt-chips">${kids}</div>` : ''}
      ${cons.length ? `<h5>Connected to</h5><div class="rt-cons">${cons.map(k => { const C = CON[k]; return C.act ? `<button class="rt-con" ${C.act} type="button">${img(C.ico, 'rt-ci')}${C.name}</button>` : `<span class="rt-con">${img(C.ico, 'rt-ci')}${C.name}</span>`; }).join('')}</div>` : ''}</div>
      <div class="rt-act">${act}</div></aside>`;
  }

  /* ---------- live bits and animations ---------- */
  function tick(s) {
    const root = document.querySelector('#drawer-body .rt'); if (!root) return;
    const now = Date.now(), cur = s.research.current;
    if (now - lastTick > 1500) intro = now;            // the drawer was just opened
    lastTick = now;
    const set = (sel, fn) => root.querySelectorAll(sel).forEach(fn);
    const rate = (s._rates && s._rates.net && s._rates.net.research) || 0;
    set('.rt-rpv', e => { e.textContent = U().fmt(s.resources.research); });
    set('.rt-rate', e => { e.textContent = U().fmtRate(rate); e.classList.toggle('pos', rate > 0); });
    if (cur) {
      const p = Math.max(0, Math.min(1, 1 - (cur.endsAt - now) / (cur.duration * 1000))), left = U().fmtTime(Math.max(0, (cur.endsAt - now) / 1000));
      set('.rt-barv', e => { e.style.width = (p * 100).toFixed(1) + '%'; });
      set('.rt-left', e => { e.textContent = left + ' left'; });
      set('.rt-left2', e => { e.textContent = left + ' left'; });
      set('.rt-node.st-active', e => { e.style.setProperty('--p', (p * 100).toFixed(1)); });
      set('.rt-nleft', e => { e.textContent = left; });
    }
    const sel = ui().rtSel && RS()[ui().rtSel];
    if (sel) set('.rt-need', e => { e.textContent = U().fmt(Math.max(0, sel.cost - s.resources.research)); });
    // a fresh tree plays its entrance once
    const map = root.querySelector('.rt-map');
    if (map && !map.dataset.seen) { map.dataset.seen = '1'; if (now - intro < 600 && !document.body.classList.contains('no-anim')) { map.classList.add('intro'); setTimeout(() => map.classList.remove('intro'), 1600); } }
    // something finished since the last look: it bursts
    const done = Object.keys(s.research.done);
    if (known) done.forEach(id => { if (!known.has(id)) { const el = root.querySelector(`.rt-node[data-id="${id}"]`); if (el) { el.classList.add('burst'); setTimeout(() => el.classList.remove('burst'), 1400); } try { DE.Audio.sfx('reveal'); } catch (e) { /* no audio */ } } });
    known = new Set(done);
  }
  /** Play the entrance (a new branch was picked). */
  function replay() { intro = Date.now(); }
  return { render, tick, replay, title: (s) => { const n = Object.keys(DE.Data.RESEARCH).length, d = Object.keys(s.research.done).filter(id => DE.Data.RESEARCH[id]).length; return `Research <small>${d}/${n} projects done · tech tree</small>`; }, unlocks, benefit };
})();
