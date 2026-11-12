/* Elevator: the bunker's single lift — one continuous shaft from the surface hatch down to the
 * deepest built floor, one cabin, a landing (doors, floor indicator, call button) per floor.
 *
 * It is a small state machine driven by ride tickets:
 *   const t = DE.UI.Elevator.request(from, to, { onMove })
 *   t.state: 'wait' → 'board' (cabin at `from`, doors open: walk in) → 'aboard' (call t.boarded())
 *            → riding (onMove(y, seconds) fires whenever the cabin departs, so the rider moves in
 *            lock-step with it) → 'exit' (doors open at `to`: walk out) → 'done'.
 * The cabin serves stops in its current direction first (collective control), waits at a floor
 * while doors are open, and parks with doors open when nobody needs it.
 * Geometry is measured from the DOM relative to #floors, so it is correct whatever sits above
 * the floors (the surface scene) and however tall each floor is. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Elevator = (function () {
  const SPEED = 170;          // px per second
  const DOOR_MS = 500, DWELL_MS = 1200, CAB_H = 84;
  let el = null, cabin = null, floorsSig = '', stops = {}, depths = [];
  let cur = 1, dir = 0, state = 'open', until = 0, target = null, cabY = null, clock = 0;
  const tickets = [];
  /** Floors the cabin still has to visit, derived from the live tickets (so a cancelled ride never
   * leaves a stale call behind): where waiting riders stand, and where riders aboard are going. */
  function calls() {
    const s = new Set();
    for (const t of tickets) { if (t.state === 'wait' || t.state === 'board') s.add(t.from); else if (t.state === 'aboard') s.add(t.to); }
    return s;
  }

  function ensure() {
    const bunker = document.getElementById('bunker'), floors = document.getElementById('floors'); if (!bunker || !floors) return false;
    if (!el || el.parentElement !== bunker) {
      document.querySelectorAll('#elevator').forEach(e => e.remove());   // never more than one
      el = document.createElement('div'); el.id = 'elevator'; bunker.appendChild(el);
      el.innerHTML = `<div class="ev-rails"></div><div class="ev-winch"><i class="ev-wheel"></i><i class="ev-wheel"></i></div><div class="ev-cable"></div><div class="ev-stops"></div><div class="ev-cabin" id="ev-cabin"><div class="ev-cab-light"></div><div class="ev-cab-doors"><i></i><i></i></div><div class="ev-cab-panel"><b>B1</b></div></div>`;
      cabin = el.querySelector('#ev-cabin'); floorsSig = ''; cabY = null;
    }
    const fls = Array.from(floors.querySelectorAll('.floor[data-depth]'));
    if (!fls.length) return false;
    const base = floors.getBoundingClientRect();
    // one landing per floor, at the corridor level (where survivors walk)
    const geo = fls.map(f => { const r = f.getBoundingClientRect(); const cor = f.querySelector('.corridor'); const y = cor ? cor.getBoundingClientRect().bottom - base.top : r.bottom - base.top - 16; return [+f.dataset.depth, Math.round(y)]; });
    const sig = geo.map(g => g.join(':')).join('|') + '@' + Math.round(base.height);
    if (sig !== floorsSig) {
      floorsSig = sig; stops = {}; depths = geo.map(g => g[0]);
      // the shaft runs from the top of #floors to just below the deepest landing — never past it
      el.style.top = floors.offsetTop + 'px'; el.style.height = (geo[geo.length - 1][1] + 18) + 'px';
      const box = el.querySelector('.ev-stops'); box.innerHTML = '';
      geo.forEach(([depth, y]) => {
        stops[depth] = y;
        const d = document.createElement('div'); d.className = 'ev-stop'; d.dataset.depth = depth; d.style.top = (y - 90) + 'px';
        d.innerHTML = `<div class="ev-ind"><b>B${depth}</b><i class="ev-arrow"></i></div><div class="ev-frame"><div class="ev-doors"><i></i><i></i></div></div><div class="ev-sill"></div><div class="ev-call"><i></i></div>`;
        box.appendChild(d);
      });
      if (stops[cur] == null) cur = depths[0];
      if (state === 'moving' && stops[target] != null) {
        // the floors moved under a travelling cabin: carry on to the same landing at its new height,
        // and take the riders along (they follow onMove)
        const left = Math.max(0.05, (until - clock) / 1000);
        place(target, left);
        tickets.forEach(t => { if (t.state === 'aboard' && t.onMove) t.onMove(stops[target], left, target); });
      } else {
        if (state === 'moving') { state = 'opening'; until = 0; }
        place(cur, 0);
      }
      setDoors(state === 'open' || state === 'opening');
      indicators();
    }
    return true;
  }
  function yOf(depth) { return stops[depth] - CAB_H - 2; }
  function place(depth, secs) {
    if (!cabin || stops[depth] == null) return;
    const y = yOf(depth);
    cabin.style.transition = secs > 0 ? `transform ${secs}s ease-in-out` : 'none';
    cabin.style.transform = `translateY(${y}px)`; cabY = y;
  }
  function setDoors(open) {
    el.querySelectorAll('.ev-stop').forEach(s => s.classList.toggle('open', open && +s.dataset.depth === cur));
    cabin.classList.toggle('open', open);
  }
  function indicators() {
    const arrow = dir < 0 ? '▲' : dir > 0 ? '▼' : '';
    const c = calls();
    el.querySelectorAll('.ev-stop').forEach(s => { s.querySelector('b').textContent = 'B' + cur; s.querySelector('.ev-arrow').textContent = arrow; s.classList.toggle('called', c.has(+s.dataset.depth)); });
    cabin.querySelector('b').textContent = 'B' + cur;
  }

  /** A survivor wants to ride from one floor to another. Returns a ticket (see header). */
  function request(from, to, opts) {
    const t = Object.assign({ from, to, state: 'wait', boarded() { if (t.state === 'board') t.state = 'aboard'; } }, opts || {});
    tickets.push(t); return t;
  }
  function cancel(t) { const i = tickets.indexOf(t); if (i >= 0) tickets.splice(i, 1); }
  /** New game / prestige: an empty shaft, cabin parked at the top. */
  function reset() { tickets.length = 0; cur = 1; dir = 0; state = 'open'; target = null; until = 0; floorsSig = ''; }

  /** Next floor to serve: keep going in the current direction while there are calls that way. */
  function nextStop() {
    const list = Array.from(calls()).filter(d => stops[d] != null);
    if (!list.length) return null;
    const ahead = list.filter(d => dir > 0 ? d > cur : dir < 0 ? d < cur : false).sort((a, b) => dir > 0 ? a - b : b - a);
    if (ahead.length) return ahead[0];
    return list.sort((a, b) => Math.abs(a - cur) - Math.abs(b - cur))[0];
  }

  function update(now) {
    clock = now;
    if (!ensure()) return;
    // tickets whose floor vanished (re-render, prestige) are dropped
    for (let i = tickets.length - 1; i >= 0; i--) { const t = tickets[i]; if (t.state === 'done' || stops[t.from] == null || stops[t.to] == null) tickets.splice(i, 1); }
    if (now < until) return;
    switch (state) {
      case 'open': {
        // someone called the lift on the floor where it is already standing open: come in
        tickets.forEach(t => { if (t.state === 'wait' && t.from === cur) t.state = 'board'; });
        // keep the doors open while someone is still walking in or out
        if (tickets.some(t => (t.state === 'board' && t.from === cur) || (t.state === 'exit' && t.to === cur))) { until = now + 300; break; }
        const n = nextStop(); if (n == null || n === cur) { if (n == null) dir = 0; indicators(); until = now + 400; break; }
        state = 'closing'; setDoors(false); until = now + DOOR_MS; break;
      }
      case 'closing': {
        const n = nextStop();
        if (n == null || n === cur) { state = 'opening'; setDoors(true); until = now + DOOR_MS; break; }
        target = n; dir = n > cur ? 1 : -1;
        const secs = Math.abs(stops[n] - stops[cur]) / SPEED;
        place(n, secs); cabin.classList.add('moving'); el.classList.toggle('up', dir < 0); el.classList.toggle('down', dir > 0);
        // riders move with the cabin, same duration and easing
        tickets.forEach(t => { if (t.state === 'aboard' && t.onMove) t.onMove(stops[n], secs, n); });
        state = 'moving'; until = now + secs * 1000; indicators(); break;
      }
      case 'moving': {
        cur = target; target = null; cabin.classList.remove('moving'); el.classList.remove('up', 'down');
        state = 'opening'; setDoors(true); until = now + DOOR_MS; indicators(); break;
      }
      case 'opening': {
        tickets.forEach(t => { if (t.state === 'aboard' && t.to === cur) t.state = 'exit'; else if (t.state === 'wait' && t.from === cur) t.state = 'board'; });
        indicators();
        state = 'open'; until = now + DWELL_MS; break;
      }
    }
  }
  function relayout() { floorsSig = ''; }
  function floorY(depth) { return stops[depth]; }
  function status() { return { floor: cur, state, dir, target, calls: Array.from(calls()), tickets: tickets.length, cabinY: cabY, stops: Object.assign({}, stops) }; }

  return { update, request, cancel, reset, relayout, floorY, status };
})();
