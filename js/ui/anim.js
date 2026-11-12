/* Character animator: poses every drawn rig (js/ui/chars.js) from one requestAnimationFrame loop.
 * Each bone (<g class="j j-*">) gets an SVG transform attribute computed from smooth curves.
 * Why script instead of CSS keyframes:
 *  - walk cycles follow how fast a character really moves (Anim.speed), so feet don't slide;
 *  - switching animation blends over a fifth of a second instead of snapping between poses;
 *  - characters off screen are skipped, and while a panel is being scrolled the animator drops to a
 *    few frames a second, which keeps scrolling on an iPad smooth;
 *  - it behaves identically in every browser (no var()/calc() inside @keyframes).
 * The animation is still picked with a class on the <svg> (a-idle, a-walk, a-run, a-work, a-repair,
 * a-carry, a-interact, a-eat, a-sleep, a-heal, a-guard, a-shoot, a-attack, a-hit, a-die, the room jobs
 * a-farm (trowel), a-study (clipboard), a-operate (console), a-cook (ladle), and for the
 * mining crew a-dig, a-haul (walking with a basket of rocks), a-push (a wheelbarrow)); the rig's
 * build and gait come from its data-* attributes, its arm rest pose from DE.Chars.pose(hold). */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Anim = (function () {
  const TAU = Math.PI * 2, D2R = Math.PI / 180;
  const { sin, cos, exp, min, max } = Math;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const frac = (x) => x - Math.floor(x);
  const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
  const easeIn = (k) => { k = clamp(k, 0, 1); return k * k; };
  const easeOut = (k) => { k = clamp(k, 0, 1); return 1 - (1 - k) * (1 - k); };
  /** periodic bump (0..1) centred on c with width w, for a phase p in 0..1 */
  const bump = (p, c, w) => { let d = p - c; d -= Math.round(d); return exp(-(d * d) / (w * w)); };
  /** a smooth wandering value in about -1..1 */
  const wander = (t, s) => .55 * sin(t * 1.31 + s) + .3 * sin(t * 2.71 + s * 1.7) + .15 * sin(t * 4.13 + s * 2.3);

  const KEYS = ['bx', 'by', 'br', 'bo', 'bs', 'b2x', 'b2y', 'b2r', 'tr', 'tsx', 'tsy', 'hr', 'hy', 'aF', 'fF', 'aB', 'fB', 'lL', 'sL', 'lR', 'sR', 'mz'];
  const rigs = new Map();          // svg element → state
  const speeds = new WeakMap();    // svg element → ground speed in its own px per second
  let raf = 0, lastT = 0, scanAt = 0, frameNo = 0, scrolledAt = 0, io = null, live = null;

  /* ---------- registry ---------- */
  function init(el) {
    const q = (n) => el.querySelector('.j-' + n), d = el.dataset;
    const H = DE.Chars && DE.Chars.pose ? DE.Chars.pose(d.hold) : { uaF: 3, faF: -10, uaB: -3, faB: -10, auF: -58, afF: -32, auB: -72, afB: -22, k: 1, lean: 0 };
    const seed = (+d.ph || 0) + Math.random() * .01;
    const st = {
      el, H, J: { body: q('body'), body2: q('body2'), torso: q('torso'), head: q('head'), armF: q('armF'), foreF: q('foreF'), armB: q('armB'), foreB: q('foreB'), legL: q('legL'), shinL: q('shinL'), legR: q('legR'), shinR: q('shinR') },
      muzzle: el.querySelector('.muzzle'), id: d.c || '', zombie: d.k === 'zombie', big: d.big === '1',
      gun: d.hold === 'gun' || d.hold === 'pistol', H0: DE.Chars && DE.Chars.pose ? DE.Chars.pose('none') : H,
      T: +d.t || 1, la: +d.la || 20, aa: +d.aa || 14, bob: +d.bob || 5, leg: +d.leg || 50, h: +d.h || 48,
      seed, t: seed * 1.7, ta: 0, p: frac(seed * .37), anim: '', cls: null, visible: true, from: null, blend: 1, pose: null, last: {},
    };
    if (io) io.observe(el);
    return st;
  }
  function scan() {
    if (!live) return;
    for (let i = 0; i < live.length; i++) { const el = live[i]; if (el.dataset && el.dataset.c && !rigs.has(el)) { const st = init(el); rigs.set(el, st); update(st, 0); } }
    rigs.forEach((st, el) => { if (!el.isConnected) { if (io) io.unobserve(el); rigs.delete(el); } });
  }

  /* ---------- poses ---------- */
  function rest(st) {
    const H = st.H;
    return { bx: 0, by: 0, br: 0, bo: 1, bs: 1, b2x: 0, b2y: 0, b2r: 0, tr: H.lean, tsx: 1, tsy: 1, hr: 0, hy: 0, aF: H.uaF, fF: H.faF, aB: H.uaB, fB: H.faB, lL: 0, sL: 0, lR: 0, sR: 0, mz: 0 };
  }
  /** Gait cycle length: from the real ground speed when known (stride matches the distance covered,
   *  so the feet don't slide), else the character's own step time. */
  function cycleLen(st, A, fallback) {
    const v = speeds.get(st.el); if (!v) return fallback;
    const legPx = st.leg * st.h / 225, stride = 4 * legPx * sin(A * D2R) * .8;
    return clamp(stride / v, .42, 2.4);
  }
  function advance(st, dt, T) { st.p = frac(st.p + dt / T); return st.p; }
  /** Two-bone legs over a gait phase p: the thigh swings forward (−) and back (+), the knee bends a
   *  little as the weight lands and a lot as the foot swings through. drag: the far leg drags. */
  function legs(P, p, A, knee, drag) {
    P.lL = -A * cos(TAU * p); P.sL = 4 + 9 * bump(p, .1, .07) + knee * bump(p, .67, .11);
    const q = p + .5;
    if (drag) { P.lR = -A * .55 * cos(TAU * q); P.sR = 3 + knee * .3 * bump(q, .7, .15); }
    else { P.lR = -A * cos(TAU * q); P.sR = 4 + 9 * bump(q, .1, .07) + knee * bump(q, .67, .11); }
  }

  function walk(st, P, dt) {
    const H = st.H, A = st.la * (st.zombie ? 1.25 : 1.15), p = advance(st, dt, cycleLen(st, A, st.T));
    legs(P, p, A, st.zombie ? 34 : 52, st.zombie && !st.big);
    P.b2y = -st.bob * (1 - cos(2 * TAU * p)) / 2;
    if (st.zombie) {
      P.tr = H.lean + 9 + 4 * sin(TAU * p); P.hr = 2 + 8 * sin(TAU * p + 1) + 2 * wander(st.t, st.seed);
      P.aF = H.uaF - 6 * H.k * cos(TAU * p); P.aB = H.uaB + 6 * H.k * cos(TAU * p);
      P.fF = H.faF - 4 - 7 * sin(2 * TAU * p); P.fB = H.faB - 4 - 7 * sin(2 * TAU * p + 1);
      if (!st.big) P.b2y += 2 * bump(p, .6, .07);   // the dragged leg makes it dip
    } else {
      const sw = st.aa * H.k, c = cos(TAU * p);
      P.tr = H.lean + 2.5 + 1.2 * cos(2 * TAU * p); P.hr = -1.4 * cos(2 * TAU * p) + .8 * wander(st.t * .5, st.seed);
      P.aF = H.uaF - sw * c; P.aB = H.uaB + sw * c;
      P.fF = H.faF - (5 + 11 * (1 + c) / 2) * H.k; P.fB = H.faB - (5 + 11 * (1 - c) / 2) * H.k;
    }
  }
  function run(st, P, dt) {
    const H = st.H, A = st.la * 1.5, p = advance(st, dt, cycleLen(st, A, st.T * .62)), c = cos(TAU * p);
    legs(P, p, A, 92, false);
    P.b2y = 1 - st.bob * 1.7 * (1 - cos(2 * TAU * p)) / 2;
    P.tr = H.lean + 11 + 2 * cos(2 * TAU * p); P.hr = -4 + 2 * cos(2 * TAU * p);
    if (st.zombie) { P.aF = -70 + 28 * sin(TAU * p); P.aB = -70 - 28 * sin(TAU * p); P.fF = P.fB = -24; P.hr += 4 * wander(st.t * 2, st.seed); }
    else if (H.k < .5) { P.aF = H.uaF - 6 * c; P.aB = H.uaB + 6 * c; }   // a gun stays in both hands
    else { P.aF = -16 - 36 * c; P.aB = -16 + 36 * c; P.fF = -86 + 10 * c; P.fB = -86 - 10 * c; }
  }
  function idle(st, P) {
    // standing still, only a gun stays in hand: other tools are put away, so the arms hang relaxed
    const H = st.zombie || st.gun ? st.H : st.H0, t = st.t, b = (1 - cos(TAU * t / 3.9)) / 2;
    if (st.zombie) {
      const s = (1 + sin(TAU * t / 3.6)) / 2;
      P.tr = H.lean + 6 + 5 * s; P.hr = -4 + 14 * (1 + sin(TAU * t / 3.6 + 1.2)) / 2 + 2 * wander(t, st.seed);
      P.aF = H.uaF + 7 * H.k * sin(TAU * t / 3.6); P.aB = H.uaB - 7 * H.k * sin(TAU * t / 3.6 + .6);
      P.fF = H.faF - 5 * sin(TAU * t / 1.8); P.fB = H.faB - 5 * sin(TAU * t / 1.8 + 1); P.b2y = 1.2 * s;
      return;
    }
    // breathing lifts the chest and shoulders; now and then the weight moves onto the near leg
    P.tsy = 1 + .024 * b; P.tsx = 1 + .01 * b; P.tr = H.lean + .6 * b;
    P.aF = H.uaF + 2.2 * b; P.aB = H.uaB - 2 * b; P.fF = H.faF - 3.5 * b; P.fB = H.faB - 2 * b;
    const w = smooth((sin(TAU * t / 9.6 + st.seed) + .2) * 1.4);
    P.b2x = 3.5 * w; P.lL = -3.5 * w; P.lR = -2 * w; P.sL = 3 * w;
    P.hr = 3.4 * wander(t * .55, st.seed) + .6 * b; P.hy = -.5 * b;
  }
  function work(st, P) {
    const t = st.t, s = st.seed;
    P.tr = 6 + 1.4 * sin(TAU * t / 6.2); P.tsy = 1 + .01 * (1 - cos(TAU * t / 3.1)) / 2;
    P.hr = 8 - 11 * bump(t / 6.2 + s, .72, .06);                     // a glance up now and then
    P.aF = -27 + 3.5 * wander(t * 2.2, s); P.fF = -56 + 8 * wander(t * 3.1, s + 2);   // busy hands at chest height
    P.aB = -22 + 3 * wander(t * 1.9, s + 4); P.fB = -52 + 7 * wander(t * 2.7, s + 6);
    P.lL = 4; P.lR = -5; P.sR = 3;
  }
  function repair(st, P) {
    // three hammer blows (raise .38s, strike .2s), then a look at the result, then again
    const c = frac(st.t / 3.6) * 3.6; let up;
    if (c < 1.74) { const l = c - Math.floor(c / .58) * .58; up = l < .38 ? easeOut(l / .38) : 1 - easeIn((l - .38) / .2); P.b2y = 1.6 * exp(-((l / .06) ** 2)) * (c > .5 ? 1 : 0); }
    else up = .3 * smooth((c - 1.74) / .4) * (1 - smooth((c - 3.2) / .4));
    P.aF = -32 - 16 * up; P.fF = -34 - 70 * up;
    P.tr = 14; P.hr = 10 - 8 * smooth((c - 1.9) / .3) * (1 - smooth((c - 3.0) / .3));
    P.aB = -40; P.fB = -36; P.lL = 8; P.sL = 6; P.lR = -12; P.sR = 10;
  }
  function carry(st, P) {
    // haul a crate across the room and back; the legs follow the distance covered
    const D = 70, c = frac(st.t / 7.4) * 7.4, A = 18;
    const u = c < 3.3 ? smooth(c / 3.3) : c < 3.7 ? 1 : c < 7 ? smooth((c - 3.7) / 3.3) : 1;
    P.bx = c < 3.7 ? -D + 2 * D * u : D - 2 * D * u;
    P.bs = c < 3.3 ? 1 : c < 3.7 ? cos(Math.PI * (c - 3.3) / .4) : c < 7 ? -1 : -cos(Math.PI * (c - 7) / .4);
    const moving = (c > .05 && c < 3.25) || (c > 3.75 && c < 6.95);
    const stride = 4 * st.leg * sin(A * D2R) * .8, p = frac((c < 3.7 ? 2 * D * u : 2 * D + 2 * D * u) / stride);
    if (moving) { legs(P, p, A, 40, false); P.b2y = -st.bob * .7 * (1 - cos(2 * TAU * p)) / 2; }
    P.tr = -3; P.aF = -30; P.fF = -78; P.aB = -36; P.fB = -70; P.hr = moving ? -1.2 * cos(2 * TAU * p) : 3;
  }
  function dig(st, P) {
    // pickaxe: wind up over the shoulder, swing down into the rock face, a jolt, wrench it free
    const T = 1.3, c = frac(st.t / T + st.seed * .13);
    const up = c < .52 ? smooth(c / .52) : c < .64 ? 1 - easeIn((c - .52) / .12) : 0;
    const hit = c >= .64 ? exp(-(((c - .64) / .05) ** 2)) : 0, pull = c > .72 ? smooth((c - .72) / .28) : 0;
    P.aF = -50 - 106 * up + 6 * pull; P.fF = -12 - 66 * up + 8 * hit;
    P.aB = -40 - 108 * up + 6 * pull; P.fB = -22 - 34 * up + 6 * hit;
    P.tr = 18 - 26 * up + 4 * hit - 4 * pull; P.hr = 8 - 14 * up;
    P.b2y = 4 + 2.5 * hit - 2 * up; P.lL = 14; P.sL = 12; P.lR = -18; P.sR = 16;
  }
  function farm(st, P) {
    // standing at the bed, bent over the plants: the trowel works the soil in short strokes, the other
    // hand parts the leaves; now and then up straight to stretch and wipe the brow
    const t = st.t, c = frac(t / 8 + st.seed * .07) * 8;
    const up = c < 6 ? 0 : c < 6.5 ? smooth((c - 6) / .5) : c < 7.5 ? 1 : 1 - smooth((c - 7.5) / .5), down = 1 - up;
    const jab = down * Math.pow(max(0, sin(TAU * t / 1.1 + st.seed)), 3), sway = wander(t * .6, st.seed);
    P.tr = 22 * down + 1 * up + 1.5 * sway * down; P.hr = 10 * down - 8 * up + 2 * sway;
    P.b2y = 2 * down; P.lL = 6; P.sL = 5 * down; P.lR = -9; P.sR = 7 * down + 2;
    P.aF = -34 * down - 10 * jab - 4 * up; P.fF = -26 * down + 18 * jab - 12 * up;
    const wipe = up * sin(TAU * t * 1.6) * 8, part = down * 6 * wander(t * 1.4, st.seed + 3);
    P.aB = (-26 + part) * down - 128 * up; P.fB = -30 * down - 96 * up + wipe;
  }
  function study(st, P) {
    // over the bench (samples, microscope), then notes on the clipboard; every third time a "got it!" finger
    const t = st.t, n = Math.floor(t / 7 + st.seed), c = frac(t / 7 + st.seed) * 7;
    const notes = c < 3.6 ? 0 : c < 4 ? smooth((c - 3.6) / .4) : c < 6.6 ? 1 : 1 - smooth((c - 6.6) / .4), bench = 1 - notes;
    const fid = wander(t * 2.4, st.seed);
    P.tr = 16 * bench + 3 * notes; P.hr = 18 * bench + 9 * notes + 2 * fid * bench;
    P.aF = -16 * bench - 34 * notes; P.fF = -18 * bench - 84 * notes;                        // clipboard: down by the side, then up to read
    P.aB = (-42 + 3 * fid) * bench - 30 * notes; P.fB = (-40 + 6 * wander(t * 3, st.seed + 1)) * bench + (-92 + 3 * sin(TAU * t * 2.6)) * notes;
    if (n % 3 === 0) { const e = smooth((c - 4.5) / .25) * (1 - smooth((c - 5.4) / .3)); P.aB -= 96 * e; P.fB += 44 * e; P.hr -= 12 * e; P.b2y -= 2 * e; }
    P.lL = 4; P.lR = -6; P.sR = 4;
  }
  function operate(st, P) {
    // at a console: quick keys with both hands, a look up at the screen, now and then a lever pulled down
    const t = st.t, c = frac(t / 6 + st.seed * .1) * 6;
    const lift = c > 4.4 && c < 5.1 ? smooth((c - 4.4) / .7) : c >= 5.1 && c < 5.9 ? 1 - smooth((c - 5.1) / .8) : 0;
    const kF = max(0, sin(TAU * t * 2.7 + st.seed)), kB = max(0, sin(TAU * t * 2.3 + st.seed + 1.7)), keys = 1 - lift;
    P.tr = 7 - 3 * lift; P.hr = -4 + 3 * wander(t * .8, st.seed) - 8 * lift;
    P.aF = (-40 + 3 * kF) * keys - 112 * lift; P.fF = (-56 - 9 * kF) * keys - 30 * lift;
    P.aB = -36 + 3 * kB; P.fB = -58 - 9 * kB;
    P.lL = 3; P.lR = -5; P.sR = 3;
  }
  /** Climbing down a ladder seen from the side (the ladder in front of the character): the hands take
   *  turns gripping the rail above the head and at the shoulder, the feet take turns on the rungs, and
   *  the body drops one rung per beat. The element itself slides down at a steady speed (Anim.speed);
   *  the pose turns that slide into rung-by-rung steps, so hands and feet never float. */
  const RUNG = 25;   // rung spacing in the character's own world px
  function climb(st, P) {
    const v = speeds.get(st.el) || 0, H = st.h || 74, Tr = v > 0 ? RUNG / v : .7;
    const ph = st.t / Tr, n = Math.floor(ph), f = ph - n, odd = n % 2 === 1;
    const drop = smooth((f - .3) / .5);                 // the body drops onto the next rung mid-beat
    const corr = v > 0 ? RUNG * (drop - f) : 0;         // steady slide → steps
    const s = odd ? drop : 1 - drop;                    // which side reaches up (blends across the beat)
    P.b2y = corr * 225 / H;
    P.aF = -92 - 42 * s; P.fF = -28 + 14 * s;           // the near hand high on the rail, then at the shoulder
    P.aB = -92 - 42 * (1 - s); P.fB = -28 + 14 * (1 - s);
    P.lL = -16 - 40 * (1 - s); P.sL = 22 + 58 * (1 - s); // the opposite foot is up on a rung
    P.lR = -16 - 40 * s; P.sR = 22 + 58 * s;
    P.tr = 8; P.hr = 12 + 5 * sin(TAU * st.t / 2.3);     // close to the ladder, glancing down
  }
  function cook(st, P) {
    // stirring the pot (the ladle goes round), a taste every few rounds
    const t = st.t, c = frac(t / 7 + st.seed * .1) * 7, w = TAU * t / 1.4;
    const taste = c > 5.2 && c < 6.4 ? sin(Math.PI * (c - 5.2) / 1.2) : 0, stir = 1 - taste;
    P.tr = 9 * stir + 2; P.hr = 12 * stir - 6 * taste;
    P.aF = (-30 + 9 * cos(w)) * stir - 50 * taste; P.fF = (-44 + 12 * sin(w)) * stir - 118 * taste;
    P.aB = -40; P.fB = -38 + 4 * sin(w + 1);
    P.lL = 4; P.lR = -6; P.sR = 4; P.b2y = .8 * sin(2 * w);
  }
  function interact(st, P) {
    // talking: two gestures at chest height per phrase, nods, the other hand on the hip
    const t = st.t, c = frac(t / 5.6 + st.seed * .1), b = (1 - cos(TAU * t / 3.9)) / 2;
    const e1 = smooth((c - .08) / .06) * (1 - smooth((c - .32) / .08)), e2 = smooth((c - .70) / .05) * (1 - smooth((c - .86) / .06));
    P.aF = 4 - 16 * e1 - 9 * e2; P.fF = -12 - (56 + 8 * sin(TAU * t * 2.1)) * e1 - 34 * e2;
    P.aB = 18; P.fB = -106;
    P.hr = 3.5 * e1 * sin(TAU * t * 1.3) + 2 * e2 + 1.5 * wander(t * .6, st.seed);
    P.tsy = 1 + .02 * b; P.tr = .8 * b + 1.5 * e1;
    P.lL = 3; P.lR = -6; P.sR = 5;
    // now and then a laugh: head back, shoulders shaking, a hand on the belly
    const L = frac(t / 13 + st.seed * .31), lg = smooth((L - .1) / .04) * (1 - smooth((L - .22) / .05));
    if (lg > 0) { const sh = sin(TAU * t * 7); P.hr = P.hr * (1 - lg) - 14 * lg; P.tr = P.tr * (1 - lg) - 4 * lg; P.tsy += .02 * sh * lg; P.b2y += 1.2 * Math.abs(sh) * lg; P.aB = P.aB * (1 - lg) - 24 * lg; P.fB = P.fB * (1 - lg) - 84 * lg; }
  }
  function eat(st, P) {
    // seated: a bite now and then, chewing, cutting in between
    const t = st.t, c = frac(t / 4.6 + st.seed * .1);
    const e = smooth((c - .10) / .07) * (1 - smooth((c - .25) / .08)), chew = c > .26 && c < .5 ? sin(TAU * t * 3.2) : 0;
    P.b2y = 22; P.lL = P.lR = -82; P.sL = P.sR = 84;
    P.aF = -26 - 36 * e; P.fF = -62 - 62 * e + 4 * sin(TAU * t * 1.7) * (1 - e);
    P.aB = -30; P.fB = -60 + 3 * sin(TAU * t * 1.7 + 1);
    P.tr = 4 + 3 * e; P.hr = 4 + 5 * e + 1.6 * chew;
  }
  function sleep(st, P) {
    const t = st.t, b = (1 - cos(TAU * t / 4.4)) / 2;
    P.bx = -6; P.by = -30; P.br = -90;
    P.tsx = 1 + .03 * b; P.tsy = 1 + .01 * b;
    P.aF = -22; P.fF = -92 + 2 * b; P.aB = 6; P.fB = -8;
    P.lR = -10; P.sR = 18; P.hr = 10 + 1.5 * wander(t * .15, st.seed);
  }
  function guard(st, P, shoot) {
    const H = st.H, t = st.t, s = (1 + sin(TAU * t / 5.2)) / 2, b = (1 - cos(TAU * t / 3.4)) / 2;
    P.aF = H.auF + .8 * sin(TAU * t / 5.2 + 1); P.fF = H.afF; P.aB = H.auB; P.fB = H.afB;
    P.lL = 12; P.sL = 4; P.lR = -15; P.sR = 8;
    P.tr = -2 + 3.5 * s; P.tsy = 1 + .012 * b; P.hr = -4 + 3 * (1 + sin(TAU * t / 5.2 + .6)) / 2;
    if (shoot) { const c = frac(st.ta / .36) * .36, k = exp(-c / .05); P.aF -= 7 * k; P.b2x = -4 * k; P.tr = -3 - 2 * k; P.mz = c < .07 ? 1 : 0; }
  }
  function attack(st, P) {
    const p = frac(st.t / .9), l = bump(p, .45, .14);
    const sw = (q) => (q < .3 ? 0 : q < .52 ? easeIn((q - .3) / .22) : 1 - smooth((q - .52) / .48));
    P.tr = 4 + 13 * l; P.b2x = 4 * l;
    P.aF = -128 + 94 * sw(p); P.aB = -128 + 94 * sw(frac(p + .5)); P.fF = P.fB = -22;
    P.hr = -6 + 16 * bump(p, .5, .12); P.lL = 14; P.lR = -18; P.sR = 10;
  }
  function die(st, P) {
    const t = st.ta, k = clamp(t / .5, 0, 1), fall = easeIn(k) * (1 + .08 * sin(k * Math.PI));
    P.br = -84 * fall; P.bx = -4 * fall; P.by = 4 * fall; P.bo = t < .9 ? 1 : max(0, 1 - (t - .9) / .7);
    P.aF = P.aB = -150 * smooth(k * 1.3); P.fF = P.fB = -20; P.lR = -30 * smooth(k); P.sR = 40 * smooth(k);
  }

  /* per-type bodies that move their own way */
  function crawler(st, P, dt) {
    const moving = st.anim === 'walk' || st.anim === 'run';
    P.b2y = 24; P.tr = 70; P.hr = -60; P.lL = P.lR = -52; P.sL = P.sR = 112; P.aF = P.aB = -82; P.fF = P.fB = 10; P.b2x = 0;
    if (moving) {
      const p = advance(st, dt, cycleLen(st, 22, st.T)), c = cos(TAU * p);
      P.aF = -62 - 21 * (1 - c); P.aB = -62 - 21 * (1 + c); P.lL = -44 - 8 * (1 - c); P.lR = -44 - 8 * (1 + c);
      P.b2x = 3 * sin(TAU * p); P.b2y = 24 - (1 - cos(2 * TAU * p)); P.hr = -60 + 4 * sin(2 * TAU * p);
    } else if (st.anim === 'attack') { const l = bump(frac(st.t / .9), .45, .14); P.tr = 70 - 14 * l; P.b2x = 4 * l; P.aF = -82 - 40 * l; }
    else { P.hr = -60 + 6 * wander(st.t * .7, st.seed); }
  }
  function leaper(st, P, dt) {
    P.b2y = 14; P.tr = 16; P.hr = -10; P.lL = P.lR = -36; P.sL = P.sR = 72;
    if (st.anim === 'walk' || st.anim === 'run') {
      const p = advance(st, dt, clamp(cycleLen(st, 40, st.T), .7, 1.6));
      const air = p > .2 && p < .78 ? sin(Math.PI * (p - .2) / .58) : 0, ext = bump(p, .3, .06), tuck = bump(p, .55, .12);
      P.b2y = 14 - 52 * air + (p < .2 ? 3 * sin(Math.PI * p / .2) : 0);
      P.lL = P.lR = -36 + 50 * ext - 22 * tuck; P.sL = P.sR = 72 - 64 * ext + 24 * tuck; P.tr = 16 - 12 * ext + 6 * tuck;
    }
  }

  /* ---------- update & apply ---------- */
  function update(st, dt) {
    const el = st.el, cls = el.getAttribute('class');
    if (cls !== st.cls) {
      st.cls = cls; const m = /(?:^|\s)a-(\w+)/.exec(cls || ''); const a = m ? m[1] : 'idle';
      if (a !== st.anim) { st.from = st.pose ? Object.assign({}, st.pose) : null; st.blend = st.from && a !== 'hit' ? 0 : 1; st.anim = a; st.ta = 0; }
    }
    if (st.pose && !st.visible) return;
    st.t += dt; st.ta += dt;
    const P = rest(st);
    switch (st.anim) {
      case 'walk': walk(st, P, dt); break;
      case 'run': run(st, P, dt); break;
      case 'work': work(st, P); break;
      case 'repair': repair(st, P); break;
      case 'carry': carry(st, P); break;
      case 'dig': dig(st, P); break;
      case 'haul': walk(st, P, dt); P.aF = -30; P.fF = -80; P.aB = -38; P.fB = -72; P.tr += 3; break;
      case 'push': walk(st, P, dt); P.aF = -40 + 2 * sin(TAU * st.p); P.fF = -16; P.aB = -48; P.fB = -12; P.tr = 13 + 1.5 * cos(2 * TAU * st.p); P.hr = -6; break;
      case 'interact': interact(st, P); break;
      case 'farm': farm(st, P); break;
      case 'study': study(st, P); break;
      case 'operate': operate(st, P); break;
      case 'cook': cook(st, P); break;
      case 'climb': climb(st, P); break;
      case 'eat': eat(st, P); break;
      case 'sleep': case 'heal': sleep(st, P); break;
      case 'guard': guard(st, P, false); break;
      case 'shoot': guard(st, P, true); break;
      case 'attack': attack(st, P); break;
      case 'die': die(st, P); break;
      case 'hit': idle(st, P); P.b2x -= 10 * exp(-st.ta / .1); P.b2r = -6 * exp(-st.ta / .1); break;
      default: idle(st, P);
    }
    if (st.anim !== 'die') {
      if (st.id === 'crawler') crawler(st, P, dt);
      else if (st.id === 'leaper') leaper(st, P, dt);
      else if (st.id === 'cultist') { P.b2y = -4 - 9 * (1 + sin(TAU * st.t / 3)) / 2; P.aF += 6 * sin(TAU * st.t / 2.2); P.aB -= 6 * sin(TAU * st.t / 2.2 + .5); }
      if (st.big && st.anim === 'walk') P.b2y *= 1.4;
    }
    if (st.blend < 1 && st.from) {
      st.blend = min(1, st.blend + dt / (st.anim === 'die' ? .12 : .22)); const k = smooth(st.blend);
      for (const key of KEYS) P[key] = st.from[key] + (P[key] - st.from[key]) * k;
    }
    st.pose = P; apply(st, P);
  }
  const f = (v) => Math.round(v * 10) / 10;
  function set(st, key, node, val) { if (node && st.last[key] !== val) { st.last[key] = val; node.setAttribute('transform', val); } }
  function apply(st, P) {
    const J = st.J;
    set(st, 'b', J.body, `translate(${f(P.bx)} ${f(P.by)}) rotate(${f(P.br)}) scale(${Math.round(P.bs * 100) / 100} 1)`);
    set(st, 'b2', J.body2, `translate(${f(P.b2x)} ${f(P.b2y)}) rotate(${f(P.b2r)})`);
    set(st, 't', J.torso, `rotate(${f(P.tr)}) scale(${Math.round(P.tsx * 1000) / 1000} ${Math.round(P.tsy * 1000) / 1000})`);
    set(st, 'h', J.head, `translate(0 ${f(P.hy)}) rotate(${f(P.hr)})`);
    set(st, 'aF', J.armF, `rotate(${f(P.aF)})`); set(st, 'fF', J.foreF, `rotate(${f(P.fF)})`);
    set(st, 'aB', J.armB, `rotate(${f(P.aB)})`); set(st, 'fB', J.foreB, `rotate(${f(P.fB)})`);
    set(st, 'lL', J.legL, `rotate(${f(P.lL)})`); set(st, 'sL', J.shinL, `rotate(${f(P.sL)})`);
    set(st, 'lR', J.legR, `rotate(${f(P.lR)})`); set(st, 'sR', J.shinR, `rotate(${f(P.sR)})`);
    const o = Math.round(P.bo * 100) / 100; if (J.body && st.last.o !== o) { st.last.o = o; J.body.setAttribute('opacity', o); }
    if (st.muzzle && st.last.mz !== P.mz) { st.last.mz = P.mz; st.muzzle.setAttribute('opacity', P.mz); }
  }

  /* ---------- loop ---------- */
  function frame(now) {
    raf = requestAnimationFrame(frame); frameNo++;
    if (now - scanAt > 150) { scanAt = now; scan(); }
    // ~30 fps; a few frames a second while something is being scrolled (keeps scrolling smooth)
    const scrolling = Date.now() - scrolledAt < 260;
    const skip = DE.UI.Settings ? DE.UI.Settings.frameSkip() : 2;
    if (frameNo % (scrolling ? 8 : skip) !== 0) return;
    const dt = lastT ? min(.12, (now - lastT) / 1000) : 0; lastT = now;
    const frozen = document.body && document.body.classList.contains('no-anim');
    rigs.forEach(st => update(st, frozen ? 0 : dt));
  }
  /** Tell the animator how fast a character is moving over the ground (its own px per second);
   *  0 when it stops. Walk and run cycles are timed from this so the feet don't slide. */
  function speed(el, v) { if (!el) return; if (v > 0) speeds.set(el, v); else speeds.delete(el); }
  function start() {
    if (raf || typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
    live = document.getElementsByClassName('rig');
    if (typeof IntersectionObserver !== 'undefined') io = new IntersectionObserver(es => es.forEach(e => { const st = rigs.get(e.target); if (st) st.visible = e.isIntersecting; }), { rootMargin: '120px' });
    const mark = () => { scrolledAt = Date.now(); };
    document.addEventListener('scroll', mark, { passive: true, capture: true });
    document.addEventListener('touchmove', mark, { passive: true, capture: true });
    raf = requestAnimationFrame(frame);
  }
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start(); }
  return { speed, start, scan };
})();
