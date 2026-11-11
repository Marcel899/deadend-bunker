# DEAD END: Underground

A browser-based idle / incremental bunker-building survival game. Vanilla HTML, CSS and JavaScript — no build step, no backend, saves in LocalStorage.

## Run it

Open `index.html` in a browser, or serve the folder (recommended so LocalStorage is per-origin):

```bash
python -m http.server 8765
```

then visit http://localhost:8765/.

Headless logic tests (Node 18+):

```bash
node tests/test.js
```

## How to play

- **Bunker view** is the centre of everything. Click a room to see its output, workers and upgrades; click an empty `+` slot to build. Rooms with 2 slots (Quarters, Cafeteria, Garage) use the clicked slot and the next one.
- **Survivors** eat food and water. Assign them to rooms (matching profession = +25%), post them as guards, or send them on expeditions. Unstaffed rooms still run at 25% (more with Automation research).
- **Power**: generators burn fuel. If the battery is empty and demand exceeds supply, powered rooms brown out. Build a Refinery or send a team to the Gas Station.
- **Research** needs a Lab. One project at a time; cost is paid up front.
- **Excavate** new floors from the dig zone at the bottom. Floors B3+ may hide abandoned facilities with unique rooms.
- **Zombie waves** hit every 5 minutes. Guards + turrets + traps must out-damage the horde or the wall takes damage; a breach costs resources and injures survivors. Waves are never fatal — repair and rebuild.
- **Offline**: production, timers and up to 3 waves are simulated when you come back (8h cap, extendable).
- **Reconstruction** (prestige) from floor B3: reset for Legacy Points and buy permanent upgrades.

## Code layout

```
index.html            page skeleton, script order
css/style.css         all styling (cartoon cutaway, drawers, modals)
js/data/              pure data: config, resources, rooms, research tree, survivors, world (zombies, facilities, locations, legacy)
js/core/
  util.js             formatting, RNG, cost helpers
  effects.js          aggregates research + legacy + room bonuses into one object
  state.js            blank / new-run state
  save.js             versioned LocalStorage save, export/import, validation, migrations
  economy.js          production formula, power grid, storage caps
  bunker.js           grid, placement, build/upgrade timers, adjacency, bulk buy
  survivors.js        recruitment, assignment, XP, injuries, morale
  research.js         research tree
  excavation.js       floors and facility discovery
  defense.js          waves, wall, turrets, traps
  expeditions.js      surface runs
  prestige.js         reconstruction and legacy upgrades
  sim.js              the single tick (used online and offline)
  offline.js          catch-up simulation
js/ui/
  ui-core.js          DOM helpers, delegation, toasts, modals, drawers, top bar
  ui-bunker.js        cutaway rendering and per-tick updates
  overworld.js        layered SVG surface scene; upgrade tiers shown via #scene data-levels
  daycycle.js         day/night (sun, moon, sky, ambient + artificial light layers) and seasons
  battlefield.js      guards, turrets, missile battery, horde and shots in overworld coordinates
  geology.js          one continuous underground cutaway (topsoil → dark earth → stone → deep rock)
  elevator.js         the single lift: one shaft, one cabin, ride tickets (board → ride → exit)
  actors.js           survivors walking, riding the lift, working, sleeping in allocated beds
  scenes.js           room prop library + renderer (100 units per cell, 1:1 scale)
  room-icons.js       generated build icons for every room and surface structure
assets/src/           furniture / weapon / tool sprite sheets; tools/cut_sprites.py cuts them into
                      assets/sprites/*.png + js/data/sprites.js (python tools/cut_sprites.py [--preview])
  chars.js            rigged characters; held items drawn in the hand's frame
  ui-side.js          side panel: overview / room / build menu
  ui-drawers.js       survivors, research, excavate, defense, expeditions, legacy, settings
  actions.js          every data-action handler
js/main.js            bootstrap, loop, autosave, event notifications
tests/test.js         Node tests for the rules engine
```

Formulas live in `js/core/economy.js` (production), `bunker.js` (costs), `defense.js` (waves) and `prestige.js` (Legacy Points); tuning constants in `js/data/config.js`.
