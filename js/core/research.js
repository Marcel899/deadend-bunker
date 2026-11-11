/* Research tree: one project at a time, cost paid upfront, timer scaled by research speed. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Research = (function () {
  const U = () => DE.Util;

  function isDone(state, id) { return !!state.research.done[id]; }
  function isAvailable(state, id) {
    const node = DE.Data.RESEARCH[id];
    return !!node && !isDone(state, id) && node.requires.every(r => isDone(state, r));
  }
  function canStart(state, id) {
    const node = DE.Data.RESEARCH[id];
    if (!node) return { ok: false, reason: 'Unknown research' };
    if (isDone(state, id)) return { ok: false, reason: 'Already researched' };
    if (state.research.current) return { ok: false, reason: 'Lab is busy' };
    if (!isAvailable(state, id)) return { ok: false, reason: 'Requires ' + node.requires.map(r => DE.Data.RESEARCH[r].name).join(', ') };
    if (state.resources.research < node.cost) return { ok: false, reason: 'Not enough research points' };
    return { ok: true };
  }
  function duration(state, id) { return DE.Data.RESEARCH[id].time / DE.Effects.get(state).researchSpeed; }

  function start(state, id, now) {
    now = now || Date.now();
    const c = canStart(state, id);
    if (!c.ok) return c;
    state.resources.research -= DE.Data.RESEARCH[id].cost;
    const dur = duration(state, id);
    state.research.current = { id, endsAt: now + dur * 1000, duration: dur };
    return { ok: true };
  }

  function cancel(state) {
    const cur = state.research.current;
    if (!cur) return { ok: false };
    state.resources.research += DE.Data.RESEARCH[cur.id].cost * 0.5;
    state.research.current = null;
    return { ok: true };
  }

  function tick(state, now) {
    const cur = state.research.current;
    if (!cur || now < cur.endsAt) return null;
    state.research.done[cur.id] = true;
    state.research.current = null;
    state._fx = null; // force effects recompute
    state._dirtyBunker = true;
    return DE.Data.RESEARCH[cur.id];
  }

  function byBranch(branch) { return Object.values(DE.Data.RESEARCH).filter(n => n.branch === branch); }

  /** Depth in the tree: 1 for roots, 1 + max(prereq tier) otherwise. */
  function tier(id) {
    const n = DE.Data.RESEARCH[id]; if (!n || !n.requires.length) return 1;
    return 1 + Math.max(...n.requires.map(tier));
  }

  return { isDone, isAvailable, canStart, duration, start, cancel, tick, byBranch, tier };
})();
