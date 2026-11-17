/* Camera: the main view is a map you drag and zoom, in one of two views.
 *  - Bunker view: the floors (cutaway), with the surface hidden.
 *  - Surface view: the overworld only, filling the view's height.
 * #bunker-wrap no longer scrolls: #bunker is moved with a transform (translate + scale), so the
 * same controls work everywhere. Drag (mouse or one finger) pans, the mouse wheel, a trackpad
 * pinch or two fingers zoom around the pointer; a trackpad two-finger swipe pans. Keys: V switches
 * the view, + / - zoom, 0 resets, arrow keys pan.
 * Code that measures the bunker with getBoundingClientRect uses Camera.rect() / Camera.k() to get
 * unscaled #bunker coordinates. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Camera = (function () {
  const OW_RATIO = 1664 / 600, SURF_BORDER = 10;
  const LIMITS = { both: [0.2, 2.5], bunker: [0.25, 2.5], surface: [0.3, 3] };
  let wrap = null, bunker = null, ctl = null, hud = null;
  let mode = 'both';
  let k = 1, tx = 0, ty = 0;
  const saved = {};                 // per view: { k, cx, cy } (view centre in content px)
  let anim = 0, inertia = 0;
  const ptrs = new Map();           // active pointers: id -> { x, y }
  let drag = null;                  // { moved, lastX, lastY, vx, vy, t, pinch: { d, mx, my } }
  let suppressClick = false;
  let fresh = true;                 // no input since the view was framed: re-frame when the content changes size

  try { const m = localStorage.getItem('de.view'); if (m === 'surface' || m === 'bunker' || m === 'both') mode = m; } catch (e) { /* private mode */ }

  /* ---------- geometry ---------- */
  function viewSize() { return { w: wrap.clientWidth, h: wrap.clientHeight }; }
  /** Width the overworld is laid out at in surface view: it fills the view's height (or its width
   *  on very wide screens). In bunker view the surface is hidden. */
  function surfaceWidth() {
    if (!wrap) return 0; const v = viewSize();
    if (mode === 'both') { const f = document.getElementById('floors'); return Math.max(v.w, f ? f.offsetWidth : 0); }   // spans the floors below
    return Math.round(Math.max(v.w, (v.h - SURF_BORDER) * OW_RATIO));
  }
  function natural() { return { w: bunker.offsetWidth || 1, h: bunker.offsetHeight || 1 }; }
  function limits() {
    const v = viewSize(), n = natural(), [lo, hi] = LIMITS[mode];
    // zooming out stops once everything is in view (the whole bunker; the overworld's full width)
    const fit = mode === 'surface' ? v.w / n.w : Math.min(v.w / n.w, v.h / n.h);
    return [Math.max(lo, Math.min(1, fit)), hi];
  }
  function clampAxis(t, size, view) { return size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, t)); }
  function clamp() {
    const [lo, hi] = limits(); k = Math.max(lo, Math.min(hi, k));
    const v = viewSize(), n = natural();
    tx = clampAxis(tx, n.w * k, v.w); ty = mode !== 'surface' && n.h * k <= v.h ? 0 : clampAxis(ty, n.h * k, v.h);   // a short bunker hangs from the top
  }
  function apply() {
    if (!bunker) return;
    clamp();
    bunker.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${k.toFixed(4)})`;
    if (ctl) { const [lo, hi] = limits(); ctl.querySelector('[data-zoom="out"]').disabled = k <= lo + 1e-3; ctl.querySelector('[data-zoom="in"]').disabled = k >= hi - 1e-3; }
    // panels and the animator treat this like scrolling (they hold heavy work while it moves)
    wrap.dispatchEvent(new Event('scroll'));
  }
  /** Zoom to `nk` keeping the content point under screen point (px, py) (relative to the view) fixed. */
  function zoomAt(nk, px, py) {
    const [lo, hi] = limits(); nk = Math.max(lo, Math.min(hi, nk));
    const cx = (px - tx) / k, cy = (py - ty) / k;
    k = nk; tx = px - cx * k; ty = py - cy * k; apply();
  }
  function stopMotion() { cancelAnimationFrame(anim); cancelAnimationFrame(inertia); anim = inertia = 0; }
  /** Glide to scale nk with content point (cx, cy) at the view centre. */
  function glide(nk, cx, cy, ms) {
    stopMotion();
    const v = viewSize(), k0 = k, x0 = tx, y0 = ty;
    const [lo, hi] = limits(); nk = Math.max(lo, Math.min(hi, nk));
    let k1 = nk, x1 = v.w / 2 - cx * nk, y1 = v.h / 2 - cy * nk;
    // where the clamp would put it, so the glide does not bounce at the end
    const sk = k, sx = tx, sy = ty; k = k1; tx = x1; ty = y1; clamp(); k1 = k; x1 = tx; y1 = ty; k = sk; tx = sx; ty = sy;
    if (!ms) { k = k1; tx = x1; ty = y1; apply(); return; }
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3);
      k = k0 + (k1 - k0) * e; tx = x0 + (x1 - x0) * e; ty = y0 + (y1 - y0) * e; apply();
      anim = p < 1 ? requestAnimationFrame(step) : 0;
    };
    anim = requestAnimationFrame(step);
  }
  function centre() { const v = viewSize(); return { cx: (v.w / 2 - tx) / k, cy: (v.h / 2 - ty) / k }; }
  function zoomBy(f) { const c = centre(); glide(k * f, c.cx, c.cy, 180); }

  /** Default framing of a view. */
  function home(ms) {
    const v = viewSize(), n = natural();
    if (mode === 'surface') glide(1, n.w * 0.32, n.h / 2, ms);       // the bunker gate sits left of centre
    else { const nk = Math.min(1, Math.max(limits()[0], 0.6, v.w / n.w)); glide(nk, v.w / 2 / nk, v.h / 2 / nk, ms); }   // top left (lift and first rooms); fit the width (not below 60% on phones)
  }

  /* ---------- views ---------- */
  function setMode(m, opts) {
    if (m !== 'bunker' && m !== 'surface' && m !== 'both') return;
    if (bunker && m === mode && !(opts && opts.force)) return;
    stopMotion();
    if (bunker && m !== mode) saved[mode] = Object.assign({ k }, centre());
    mode = m;
    try { localStorage.setItem('de.view', m); } catch (e) { /* ignore */ }
    if (!wrap) return;
    wrap.classList.toggle('view-bunker', m === 'bunker'); wrap.classList.toggle('view-both', m === 'both'); wrap.classList.toggle('view-surface', m === 'surface');
    if (ctl) ctl.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === m));
    const sf = document.getElementById('surface'); if (sf && m !== 'bunker') sf.style.width = surfaceWidth() + 'px';
    // the floors' layers (survivors, lift, badges) measure the floors: lay them out again now they show
    if (m !== 'surface' && DE.UI.Bunker && DE.UI.state && DE.UI.state()) DE.UI.Bunker.render();
    const s = saved[m];
    if (s) glide(s.k, s.cx, s.cy, 0); else { home(0); fresh = true; }
    bunker.classList.remove('cam-in'); void bunker.offsetWidth; bunker.classList.add('cam-in');
  }
  function toggle() { setMode(mode === 'both' ? 'bunker' : mode === 'bunker' ? 'surface' : 'both'); }

  /** Centre an element of the bunker (switching to bunker view if needed). */
  function focus(el, ms) {
    if (!el) return;
    if (mode === 'surface') setMode('both');
    const r = rect(el); if (!r) return;
    glide(k, r.left + r.width / 2, r.top + r.height / 2, ms == null ? 400 : ms);
  }

  /** An element's box in unscaled #bunker coordinates (like offsetLeft/Top relative to #bunker). */
  function rect(el) {
    if (!el || !bunker) return null;
    const b = bunker.getBoundingClientRect(), r = el.getBoundingClientRect();
    const left = (r.left - b.left) / k, top = (r.top - b.top) / k, width = r.width / k, height = r.height / k;
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  }
  /** The visible part of #bunker, in its unscaled coordinates. */
  function view() { if (!wrap) return { x: 0, y: 0, w: 1e9, h: 1e9 }; const v = viewSize(); return { x: -tx / k, y: -ty / k, w: v.w / k, h: v.h / k }; }

  /* ---------- input ---------- */
  const NO_PAN = '#view-ctl, #view-hud .wave-info, #view-hud .ev-pill, [data-place], [data-move], input, select, textarea, .no-pan';
  function local(e) { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function pinchInfo() { const [a, b] = Array.from(ptrs.values()); return { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (e.target.closest(NO_PAN) || (DE.UI.Placement && DE.UI.Placement.active())) return;
    fresh = false;
    stopMotion();
    ptrs.set(e.pointerId, local(e));
    if (ptrs.size === 1) { const p = local(e); drag = { moved: false, sx: p.x, sy: p.y, lastX: p.x, lastY: p.y, vx: 0, vy: 0, t: performance.now(), pinch: null, touch: e.pointerType !== 'mouse' }; }
    else if (ptrs.size === 2 && drag) { drag.pinch = pinchInfo(); drag.moved = true; wrap.classList.add('dragging'); }
  }
  function onMove(e) {
    if (!drag || !ptrs.has(e.pointerId)) return;
    const p = local(e); ptrs.set(e.pointerId, p);
    if (drag.pinch && ptrs.size >= 2) {
      const q = pinchInfo(), f = q.d / drag.pinch.d;
      tx += q.mx - drag.pinch.mx; ty += q.my - drag.pinch.my;
      zoomAt(k * f, q.mx, q.my); drag.pinch = q; return;
    }
    if (!drag.moved) {
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) < (drag.touch ? 10 : 6)) return;
      drag.moved = true; wrap.classList.add('dragging');
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      drag.lastX = p.x; drag.lastY = p.y;
    }
    const now = performance.now(), dt = Math.max(1, now - drag.t), dx = p.x - drag.lastX, dy = p.y - drag.lastY;
    tx += dx; ty += dy; apply();
    // smoothed velocity for the fling
    drag.vx = drag.vx * 0.6 + (dx / dt) * 0.4; drag.vy = drag.vy * 0.6 + (dy / dt) * 0.4;
    drag.lastX = p.x; drag.lastY = p.y; drag.t = now;
  }
  function onUp(e) {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (!drag) return;
    if (ptrs.size === 1 && drag.pinch) { const [p] = Array.from(ptrs.values()); drag.pinch = null; drag.lastX = p.x; drag.lastY = p.y; drag.vx = drag.vy = 0; drag.t = performance.now(); return; }
    if (ptrs.size) return;
    const d = drag; drag = null; wrap.classList.remove('dragging');
    if (!d.moved) return;
    suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
    // fling: keep gliding with the release speed, slowing down
    let vx = d.vx, vy = d.vy;
    if (performance.now() - d.t > 80 || Math.hypot(vx, vy) < 0.15) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(40, now - last); last = now;
      tx += vx * dt; ty += vy * dt; apply();
      const f = Math.pow(0.994, dt); vx *= f; vy *= f;
      inertia = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : 0;
    };
    inertia = requestAnimationFrame(step);
  }
  function onWheel(e) {
    if (e.target.closest('#view-ctl')) return;
    e.preventDefault(); stopMotion(); fresh = false;
    const p = local(e), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewSize().h : 1;
    const dx = e.deltaX * unit, dy = e.deltaY * unit;
    // pinch on a trackpad (ctrl+wheel) or a mouse wheel (line steps / big notches): zoom
    const mouseWheel = e.deltaMode === 1 || (e.deltaX === 0 && Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY));
    if (e.ctrlKey) { zoomAt(k * Math.exp(-dy * 0.01), p.x, p.y); return; }
    if (mouseWheel && !e.shiftKey) { zoomAt(k * Math.pow(1.0015, -dy), p.x, p.y); return; }
    // trackpad two-finger swipe (or shift+wheel): pan
    if (e.shiftKey && !dx) { tx -= dy; } else { tx -= dx; ty -= dy; }
    apply();
  }
  // Safari's trackpad pinch
  let gStart = 1;
  function onGesture(e) {
    e.preventDefault();
    if (e.type === 'gesturestart') { gStart = k; return; }
    const p = local(e); zoomAt(gStart * e.scale, p.x, p.y);
  }
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !wrap) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '')) return;
    const game = document.getElementById('game-screen'), modal = document.getElementById('modal-root');
    if (!game || game.classList.contains('hidden') || (modal && !modal.classList.contains('hidden')) || document.body.classList.contains('drawer-open') || (DE.UI.MG && DE.UI.MG.active())) return;
    const key = e.key; let hit = true;
    if (key === 'v' || key === 'V') toggle();
    else if (key === '+' || key === '=') zoomBy(1.25);
    else if (key === '-' || key === '_') zoomBy(0.8);
    else if (key === '0') home(250);
    else if (key.startsWith('Arrow')) { stopMotion(); const s = 90; if (key === 'ArrowLeft') tx += s; else if (key === 'ArrowRight') tx -= s; else if (key === 'ArrowUp') ty += s; else ty -= s; apply(); }
    else hit = false;
    if (hit) { e.preventDefault(); fresh = false; }
  }

  function buildCtl() {
    const icon = (n) => (DE.Icons ? DE.Icons.img(n) : '');
    ctl = document.createElement('div'); ctl.id = 'view-ctl';
    ctl.innerHTML = `<div class="vc-seg" role="tablist" aria-label="View">
        <button type="button" data-view="both" title="Surface and bunker together (V)">${icon('home')}<span>Both</span></button>
        <button type="button" data-view="bunker" title="Bunker view (V)">${icon('bunker')}<span>Bunker</span></button>
        <button type="button" data-view="surface" title="Surface view (V)">${icon('map')}<span>Surface</span></button>
      </div>
      <div class="vc-zoom">
        <button type="button" data-zoom="out" title="Zoom out (−)" aria-label="Zoom out">−</button>
        <button type="button" data-zoom="home" title="Reset view (0)" aria-label="Reset view">⟲</button>
        <button type="button" data-zoom="in" title="Zoom in (+)" aria-label="Zoom in">+</button>
      </div>`;
    ctl.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return; e.stopPropagation(); fresh = false;
      if (b.dataset.view) setMode(b.dataset.view);
      else if (b.dataset.zoom === 'in') zoomBy(1.25); else if (b.dataset.zoom === 'out') zoomBy(0.8); else home(250);
      if (DE.Audio) DE.Audio.sfx('click');
    });
    wrap.appendChild(ctl);
    hud = document.createElement('div'); hud.id = 'view-hud'; wrap.appendChild(hud);
  }
  /** The surface's status overlays (attack bar, decisions pill, day clock) are pinned to the view
   *  instead of riding on the zoomed overworld, so they stay readable and show in both views. */
  function pinHud() {
    const sf = document.getElementById('surface'); if (!sf || !hud) return;
    sf.querySelectorAll('.wave-info, .ev-pill, .dc-chip').forEach(el => hud.appendChild(el));
    const inc = sf.classList.contains('incoming'), fight = sf.classList.contains('fight');
    if (hud.classList.contains('incoming') !== inc) hud.classList.toggle('incoming', inc);
    if (hud.classList.contains('fight') !== fight) hud.classList.toggle('fight', fight);
  }

  function init() {
    wrap = document.getElementById('bunker-wrap'); bunker = document.getElementById('bunker');
    if (!wrap || !bunker) return;
    buildCtl();
    wrap.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
    wrap.addEventListener('wheel', onWheel, { passive: false });
    wrap.addEventListener('gesturestart', onGesture); wrap.addEventListener('gesturechange', onGesture);
    wrap.addEventListener('dragstart', e => e.preventDefault());
    // a drag that moved the map is not a click on whatever was under the pointer
    wrap.addEventListener('click', e => { if (suppressClick) { suppressClick = false; e.stopPropagation(); e.preventDefault(); } }, true);
    // the view never scrolls natively (focus or scrollIntoView elsewhere could nudge it)
    wrap.addEventListener('scroll', () => { if (wrap.scrollTop || wrap.scrollLeft) { wrap.scrollTop = 0; wrap.scrollLeft = 0; } });
    document.addEventListener('keydown', onKey);
    // content or view size changes (new floor, wider floor, window resize): keep the view in bounds
    let lastSurfW = 0;
    const onResize = () => {
      if (mode !== 'bunker') { const sf = document.getElementById('surface'), w = surfaceWidth(); if (sf && w !== lastSurfW) { const c = centre(), ow = natural().w; lastSurfW = w; sf.style.width = w + 'px'; const f = natural().w / ow; glide(k, c.cx * f, c.cy * f, 0); return; } }
      if (fresh && !saved[mode]) home(0); else apply();
    };
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(onResize); ro.observe(wrap); ro.observe(bunker); }
    else window.addEventListener('resize', onResize);
    // the Surface button pulses while an attack is coming and you are looking at the bunker
    setInterval(() => {
      pinHud();
      const sf = document.getElementById('surface'), b = ctl && ctl.querySelector('[data-view="surface"]'); if (!b) return;
      const hot = mode === 'bunker' && !!sf && (sf.classList.contains('incoming') || sf.classList.contains('fight'));
      if (b.classList.contains('alert') !== hot) b.classList.toggle('alert', hot);
    }, 500);
    setMode(mode, { force: true });
  }

  return {
    init, pinHud, setMode, toggle, focus, rect, view, surfaceWidth, home,
    mode: () => mode, k: () => k,
  };
})();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => DE.UI.Camera.init()); else DE.UI.Camera.init();
