/* Elevator: one shaft spanning every floor, with a cabin that physically travels between
 * floors, doors that open on arrival, floor indicators and a winch at the top. Actors request
 * rides (DE.UI.Elevator.request) so the cabin follows them; otherwise it patrols idly. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Elevator = (function () {
  const SPEED = 110;          // px per second (matches actors' ride speed)
  let el = null, cabin = null, floorsSig = '', stops = {}, cur = 1, target = 1, busyUntil = 0, idleAt = 0, queue = [];

  function ensure() {
    const bunker = document.getElementById('bunker'), floors = document.getElementById('floors'); if (!bunker || !floors) return false;
    if (!el || el.parentElement !== bunker) {
      el = document.getElementById('elevator'); if (!el) { el = document.createElement('div'); el.id = 'elevator'; bunker.appendChild(el); }
      el.innerHTML = `<div class="ev-rails"></div><div class="ev-winch"><i class="ev-wheel"></i><i class="ev-wheel"></i></div><div class="ev-cable"></div><div class="ev-stops"></div><div class="ev-cabin" id="ev-cabin"><div class="ev-cab-light"></div><div class="ev-cab-doors"><i></i><i></i></div><div class="ev-cab-panel"><b>B1</b></div></div>`;
      cabin = el.querySelector('#ev-cabin');
    }
    // geometry follows the floors container
    const t = floors.offsetTop + 'px', h = floors.offsetHeight + 'px';
    if (el.style.top !== t) el.style.top = t; if (el.style.height !== h) el.style.height = h;
    // one landing per floor
    const fls = Array.from(floors.querySelectorAll('.floor[data-depth]'));
    const sig = fls.map(f => f.dataset.depth + ':' + f.offsetTop + ':' + f.offsetHeight).join('|');
    if (sig !== floorsSig) {
      floorsSig = sig; stops = {};
      const box = el.querySelector('.ev-stops'); box.innerHTML = '';
      fls.forEach(f => {
        const depth = +f.dataset.depth; const y = f.offsetTop + f.offsetHeight - 16 - 36; // corridor line
        stops[depth] = y;
        const d = document.createElement('div'); d.className = 'ev-stop'; d.dataset.depth = depth; d.style.top = (y - 88) + 'px';
        d.innerHTML = `<div class="ev-ind"><b>B${depth}</b><i class="ev-arrow"></i></div><div class="ev-frame"><div class="ev-doors"><i></i><i></i></div></div><div class="ev-sill"></div><div class="ev-call"><i></i></div>`;
        box.appendChild(d);
      });
      place(cur, true);
    }
    return true;
  }
  function place(depth, instant) {
    if (!cabin || stops[depth] == null) return;
    const y = stops[depth] - 84;
    cabin.style.transition = instant ? 'none' : `transform ${Math.abs(stops[depth] - (stops[cur] || stops[depth])) / SPEED}s ease-in-out`;
    cabin.style.transform = `translateY(${y}px)`;
    cabin.querySelector('b').textContent = 'B' + depth;
  }
  function setDoors(depth, open) { el.querySelectorAll('.ev-stop').forEach(s => s.classList.toggle('open', open && +s.dataset.depth === depth)); cabin.classList.toggle('open', open); }

  /** An actor wants to ride from one floor to another; the cabin heads there first. */
  function request(from, to) { queue.push(from, to); }

  function update(now) {
    if (!ensure()) return;
    if (now < busyUntil) return;
    if (queue.length) { const next = queue.shift(); if (next !== cur) go(next, now); return; }
    // idle patrol every so often
    if (!idleAt) idleAt = now + 9000;
    if (now > idleAt) { idleAt = now + 9000 + Math.random() * 8000; const depths = Object.keys(stops).map(Number); if (depths.length > 1) { const d = depths[(Math.random() * depths.length) | 0]; if (d !== cur) go(d, now); } }
    else setDoors(cur, true);
  }
  function go(depth, now) {
    if (stops[depth] == null) return;
    setDoors(cur, false);
    const dur = Math.abs(stops[depth] - stops[cur]) / SPEED;
    cabin.classList.add('moving'); el.classList.toggle('up', depth < cur); el.classList.toggle('down', depth > cur);
    setTimeout(() => { place(depth); }, 250);
    cur = target = depth; busyUntil = now + dur * 1000 + 500;
    setTimeout(() => { cabin.classList.remove('moving'); el.classList.remove('up', 'down'); setDoors(depth, true); }, dur * 1000 + 300);
  }
  function relayout() { floorsSig = ''; }
  function floorY(depth) { return stops[depth]; }

  return { update, request, relayout, floorY };
})();
