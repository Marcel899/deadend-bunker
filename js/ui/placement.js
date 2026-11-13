/* Placement: drag a room (new build or relocation) over the bunker grid. A translucent preview
 * of the room follows the pointer, snaps to cells, turns green/red for valid/invalid spots and
 * shows cost + footprint. Works as drag-and-drop (press, move, release) and as click-to-place
 * (click the Place button, click a spot). Escape or right-click cancels. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Placement = (function () {
  const CELL = 100;
  let mode = null;   // { type, roomId, size, ghost, tip, floor, slot, valid, moved, startX, startY, sticky }

  function start(opts, ev) {
    cancel();
    const s = DE.UI.state(); if (!s) return;
    const type = opts.roomId ? s.rooms[opts.roomId].type : opts.type; const def = DE.Data.ROOMS[type]; if (!def) return;
    const floors = document.getElementById('floors'); if (!floors) return;
    const ghost = document.createElement('div'); ghost.className = 'room-ghost'; ghost.style.width = (def.size * CELL) + 'px';
    ghost.innerHTML = `<div class="room-scene">${DE.Scenes.render({ level: 1, construction: null }, def, s)}</div><div class="ghost-label">${DE.Util.escapeHtml(def.name)}<small>${def.size} cells</small></div>`;
    const tip = document.createElement('div'); tip.className = 'ghost-tip';
    floors.appendChild(ghost); floors.appendChild(tip);
    mode = { type, roomId: opts.roomId || null, size: def.size, ghost, tip, floor: null, slot: null, valid: false, moved: false, startX: ev ? ev.clientX : 0, startY: ev ? ev.clientY : 0, sticky: !ev };
    document.body.classList.add('placing');
    document.querySelectorAll('.floor:not(.dig) .cells').forEach(c => c.classList.add('placing'));
    if (ev) track(ev);
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp); window.addEventListener('keydown', onKey); window.addEventListener('contextmenu', onCtx);
    DE.UI.toast(opts.roomId ? 'Drag the room to a new spot. Esc cancels.' : 'Drag ' + def.name + ' onto the bunker. Esc cancels.', 'ok', 2500, 'home');
  }
  function onMove(ev) { if (!mode) return; if (Math.hypot(ev.clientX - mode.startX, ev.clientY - mode.startY) > 8) mode.moved = true; track(ev); }
  function onUp(ev) {
    if (!mode) return;
    if (mode.moved && mode.valid) { commit(); return; }
    if (mode.moved && !mode.valid) { cancel(); DE.UI.toast('Nowhere to put it there.', 'warn'); return; }
    // no drag: sticky click-to-place; the NEXT click decides (the click that ends this very press is ignored)
    mode.sticky = true; mode.moved = true; mode.skipClick = true;
  }
  function onKey(e) { if (e.key === 'Escape') cancel(); }
  function onCtx(e) { if (mode) { e.preventDefault(); cancel(); } }
  function onClickPlace(ev) { if (!mode || !mode.sticky) return false; if (mode.skipClick) { mode.skipClick = false; return true; } track(ev); if (mode.valid) commit(); else { DE.UI.toast('Cannot build there.', 'warn'); } return true; }

  /** Position the ghost under the pointer, snapped to the grid, and evaluate validity. */
  function track(ev) {
    const s = DE.UI.state(); const floors = document.getElementById('floors'); const base = floors.getBoundingClientRect();
    let hit = null;
    document.querySelectorAll('.floor[data-depth]:not(.dig) .cells').forEach(c => { const r = c.getBoundingClientRect(); if (ev.clientY >= r.top - 20 && ev.clientY <= r.bottom + 20 && ev.clientX >= r.left - 40 && ev.clientX <= r.right + 40) hit = { el: c, r, depth: +c.closest('.floor').dataset.depth }; });
    if (!hit) { mode.ghost.style.display = 'none'; mode.tip.style.display = 'none'; mode.valid = false; return; }
    const floor = DE.Bunker.getFloor(s, hit.depth); const cols = floor.slots.length;
    let slot = Math.round((ev.clientX - hit.r.left) / CELL - mode.size / 2); slot = Math.max(0, Math.min(cols - mode.size, slot));
    const place = DE.Bunker.canPlace(s, mode.type, hit.depth, slot, mode.roomId);
    let reason = place.ok ? '' : place.reason;
    let cost;
    if (mode.roomId) { cost = DE.Bunker.moveCost(s, s.rooms[mode.roomId]); if (place.ok && !DE.Util.canAfford(s.resources, cost)) reason = 'Not enough resources to relocate'; }
    else { cost = DE.Bunker.buildCost(s, mode.type); if (!DE.Bunker.isUnlocked(s, mode.type)) reason = DE.Bunker.lockReason(s, mode.type); else if (place.ok && !DE.Util.canAfford(s.resources, cost)) reason = 'Not enough resources'; else if (place.ok && !DE.Expeditions.hasRare(s, DE.Data.ROOMS[mode.type].rare)) reason = 'Needs rare materials from expeditions'; }
    mode.valid = !reason; mode.floor = hit.depth; mode.slot = slot;
    const g = mode.ghost; g.style.display = ''; g.style.left = (hit.r.left - base.left + slot * CELL) + 'px'; g.style.top = (hit.r.top - base.top) + 'px'; g.style.height = hit.r.height + 'px';
    g.classList.toggle('valid', mode.valid); g.classList.toggle('invalid', !mode.valid);
    const t = mode.tip; t.style.display = ''; t.style.left = g.style.left; t.style.top = (hit.r.top - base.top - 30) + 'px';
    t.innerHTML = `<b>B${hit.depth} · cells ${slot + 1}–${slot + mode.size}</b> ${DE.Util.costText(cost)}${reason ? `<span class="neg"> · ${DE.Util.escapeHtml(reason)}</span>` : ''}`;
    // highlight the target cells
    hit.el.querySelectorAll('.cell').forEach(c => { const k = +c.dataset.slot; c.classList.toggle('target', k >= slot && k < slot + mode.size); c.classList.toggle('bad', !mode.valid && k >= slot && k < slot + mode.size); });
  }
  function commit() {
    const m = mode; cancel();
    if (m.roomId) { const r = DE.UI.state().rooms[m.roomId]; if (r && r.floor === m.floor && r.slot === m.slot) return; DE.Actions.moveRoom({ id: m.roomId, depth: m.floor, slot: m.slot }); }
    else DE.Actions.build({ type: m.type, depth: m.floor, slot: m.slot }, null);
  }
  function cancel() {
    if (!mode) return;
    mode.ghost.remove(); mode.tip.remove(); mode = null;
    document.body.classList.remove('placing');
    document.querySelectorAll('.cell').forEach(c => c.classList.remove('target', 'bad'));
    document.querySelectorAll('.floor .cells').forEach(c => c.classList.remove('placing'));
    window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('keydown', onKey); window.removeEventListener('contextmenu', onCtx);
  }
  function active() { return !!mode; }

  return { start, cancel, active, onClickPlace };
})();
