/* Audio: every sound and the soundtrack are synthesised with the Web Audio API (no audio files).
 *
 *   DE.Audio.sfx(name)   click · buy · upgrade · error · shot · heavy · launch · boom · alarm · event · dig · hit
 *                        · clank · ratchet (building sites) · complete · levelup
 *   DE.Audio.music(on)   ambient loop: a slow minor pad with a sparse plucked melody and a soft
 *                        heartbeat kick; darker and sparser at night (DE.Audio.setNight)
 *
 * Browsers (iOS/iPadOS Safari especially) only allow audio after a user gesture, so the context
 * is created/resumed on the first pointer/touch/key event. Volumes live in localStorage (per
 * device, not in the save file). */
var DE = globalThis.DE = globalThis.DE || {};

DE.Audio = (function () {
  const KEY = 'deadend_audio_v1';
  let prefs = { music: 0.45, sfx: 0.7, musicOn: true, sfxOn: true };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* defaults */ }
  let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null, verb = null;
  let meter = null, musicTimer = 0, step = 0, night = false, last = {};

  function save() { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* private mode */ } }
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    meter = ctx.createAnalyser(); meter.fftSize = 512; master.connect(meter);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    // a cheap reverb: a feedback delay network on the music bus
    verb = ctx.createDelay(1); verb.delayTime.value = 0.23; const fb = ctx.createGain(); fb.gain.value = 0.38; const lp = ctx.createBiquadFilter(); lp.frequency.value = 1800;
    verb.connect(lp); lp.connect(fb); fb.connect(verb); lp.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    if (prefs.musicOn) startMusic();
    return true;
  }
  function applyVolumes() {
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(prefs.sfxOn ? prefs.sfx : 0, ctx.currentTime, .05);
    musicBus.gain.setTargetAtTime(prefs.musicOn ? prefs.music * 1.1 : 0, ctx.currentTime, .3);
  }
  // unlock on the first gesture (required by iOS / iPadOS Safari)
  ['pointerdown', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, () => ensure(), { passive: true }));

  /* ---------- building blocks ---------- */
  function tone(freq, t0, dur, type, vol, bus, glideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0); if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(.02, dur / 4)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t0); o.stop(t0 + dur + .05); return g;
  }
  function noise(t0, dur, vol, freq, q, type, sweepTo) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.setValueAtTime(freq, t0); f.Q.value = q || 1;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t0, Math.random() * .5); s.stop(t0 + dur + .05);
  }

  /* ---------- sound effects ---------- */
  const FX = {
    click: (t) => { tone(880, t, .05, 'square', .05); tone(1320, t + .02, .04, 'sine', .04); },
    buy: (t) => { [523, 659, 784].forEach((f, i) => tone(f, t + i * .06, .18, 'triangle', .12)); noise(t, .08, .1, 3000, 2); },
    upgrade: (t) => { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * .07, .25, 'triangle', .11)); tone(1568, t + .38, .4, 'sine', .06); },
    error: (t) => { tone(160, t, .16, 'sawtooth', .08, null, 120); tone(150, t + .17, .2, 'sawtooth', .07, null, 100); },
    shot: (t) => { noise(t, .07, .22, 1800, .8, 'bandpass', 600); tone(120, t, .06, 'square', .05, null, 60); },
    heavy: (t) => { noise(t, .12, .3, 900, .7, 'lowpass', 200); tone(90, t, .1, 'square', .09, null, 45); },
    launch: (t) => { noise(t, .7, .18, 400, .6, 'bandpass', 2400); tone(220, t, .5, 'sawtooth', .04, null, 660); },
    boom: (t) => { noise(t, .9, .55, 600, .5, 'lowpass', 60); tone(70, t, .6, 'sine', .35, null, 30); },
    alarm: (t) => { for (let i = 0; i < 3; i++) { tone(620, t + i * .6, .3, 'sawtooth', .07, null, 880); tone(880, t + i * .6 + .3, .3, 'sawtooth', .07, null, 620); } },
    event: (t) => { tone(988, t, .6, 'sine', .12); tone(1319, t + .12, .7, 'sine', .08); tone(1976, t + .12, .5, 'sine', .03); },
    // a decision taken: a soft stamp and a rising two-note answer
    choice: (t) => { noise(t, .06, .16, 500, .9, 'lowpass', 160); tone(140, t, .08, 'sine', .14, null, 70); tone(659, t + .07, .16, 'triangle', .1); tone(988, t + .15, .26, 'triangle', .09); },
    dig: (t) => { noise(t, .18, .25, 300, .8, 'lowpass', 120); tone(80, t, .12, 'triangle', .12); },
    hit: (t) => { noise(t, .06, .15, 1200, 1.5); },
    // combat
    splat: (t) => { noise(t, .07, .16, 700 + Math.random() * 300, 1.2, 'lowpass', 180); tone(95 + Math.random() * 20, t, .07, 'sine', .07, null, 55); },
    zdie: (t) => { growl(t, 150 + Math.random() * 30, .55, .06, 70); noise(t + .02, .18, .14, 500, .8, 'lowpass', 120); },
    bigdie: (t) => { growl(t, 90, .9, .09, 40); noise(t, .35, .3, 300, .7, 'lowpass', 50); tone(55, t + .05, .4, 'sine', .25, null, 30); },
    groan: (t) => { growl(t, 120 + Math.random() * 50, .9 + Math.random() * .5, .035, 85 + Math.random() * 20); },
    groanbig: (t) => { growl(t, 75 + Math.random() * 15, 1.3, .05, 50); },
    thud: (t) => { noise(t, .12, .2, 260, .7, 'lowpass', 80); tone(62, t, .14, 'sine', .14, null, 40); },
    casing: (t) => { tone(4200 + Math.random() * 600, t, .05, 'sine', .025); tone(3100, t + .07, .04, 'sine', .015); },
    // UI
    hover: (t) => { tone(1900, t, .035, 'sine', .018); },
    done: (t) => { tone(784, t, .16, 'triangle', .07); tone(1175, t + .08, .3, 'triangle', .07); tone(1568, t + .16, .25, 'sine', .04); },
    reveal: (t) => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * .09, .45, 'triangle', .09)); noise(t + .4, .5, .06, 6000, 2, 'highpass'); },
    tick: (t) => { tone(1400 + Math.random() * 200, t, .025, 'square', .02); },
    // building sites: a hammer on steel, a ratchet, the fanfare when a room is finished
    clank: (t) => { [0, .19].forEach((d, i) => { noise(t + d, .05, .05, 2600, 4, 'bandpass'); tone(1650 - i * 230 + Math.random() * 80, t + d, .16, 'triangle', .022); tone(3100 - i * 300, t + d, .08, 'sine', .01); }); },
    ratchet: (t) => { for (let i = 0; i < 5; i++) noise(t + i * .05, .025, .045, 3400, 6, 'bandpass'); tone(220, t, .25, 'sawtooth', .012, null, 180); },
    complete: (t) => { noise(t, .2, .12, 500, .8, 'lowpass', 200); [523, 659, 784, 1047].forEach((f, i) => tone(f, t + .08 + i * .08, .3, 'triangle', .09)); tone(1568, t + .42, .55, 'sine', .07); noise(t + .4, .45, .05, 7000, 2, 'highpass'); },
    creak: (t) => { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(140, t + .9); o.frequency.linearRampToValueAtTime(95, t + 1.6);
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .15); g.gain.setValueAtTime(.07, t + 1.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.7);
      o.connect(f); f.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 1.8); noise(t + 1.5, .5, .25, 300, .7, 'lowpass', 80); tone(60, t + 1.5, .5, 'sine', .2, null, 35); },
    levelup: (t) => { [659, 880, 1175].forEach((f, i) => tone(f, t + i * .07, .22, 'triangle', .08)); tone(1760, t + .22, .35, 'sine', .04); },
  };
  /* a zombie growl: a wobbling sawtooth through a vowel-ish formant filter, pitch sagging */
  function growl(t0, f0, dur, vol, fEnd) {
    const o = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), bp = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(fEnd || f0 * .6, t0 + dur);
    lfo.frequency.value = 7 + Math.random() * 5; lg.gain.value = f0 * .06; lfo.connect(lg); lg.connect(o.frequency);
    bp.type = 'bandpass'; bp.frequency.setValueAtTime(650, t0); bp.frequency.linearRampToValueAtTime(420, t0 + dur); bp.Q.value = 3;
    bp2.type = 'lowpass'; bp2.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + .08); g.gain.setValueAtTime(vol, t0 + dur * .6); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(bp); bp.connect(bp2); bp2.connect(g); g.connect(sfxBus); o.start(t0); lfo.start(t0); o.stop(t0 + dur + .05); lfo.stop(t0 + dur + .05);
  }
  /** Play a sound effect. Fast repeats (gunfire) are rate-limited per sound. */
  function sfx(name, minGapMs) {
    if (!prefs.sfxOn || !FX[name] || !ensure()) return;
    const now = performance.now(); const gap = minGapMs != null ? minGapMs : (name === 'shot' ? 55 : name === 'hit' || name === 'splat' ? 45 : name === 'hover' ? 60 : 30);
    if (now - (last[name] || 0) < gap) return; last[name] = now;
    FX[name](ctx.currentTime + .005);
  }

  /* ---------- music: A minor, 4-bar progression, 72 bpm, 8th-note grid ---------- */
  const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];       // Am · F · C · G
  const MEL = [76, null, 72, null, 74, 72, null, 69, 72, null, 67, null, 69, null, null, null];
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function pad(notes, t0, dur) {
    notes.forEach((n, i) => [-6, 6].forEach(det => {
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = midi(n - 12); o.detune.value = det + i;
      f.type = 'lowpass'; f.frequency.setValueAtTime(night ? 420 : 700, t0); f.frequency.linearRampToValueAtTime(night ? 600 : 1100, t0 + dur / 2); f.frequency.linearRampToValueAtTime(night ? 380 : 650, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(.035, t0 + dur * .3); g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      o.connect(f); f.connect(g); g.connect(musicBus); g.connect(verb); o.start(t0); o.stop(t0 + dur + .1);
    }));
  }
  function pluck(n, t0) { const g = tone(midi(n), t0, .9, 'triangle', .07, musicBus); g.connect(verb); }
  function kick(t0) { tone(70, t0, .28, 'sine', .14, musicBus, 38); }
  function startMusic() {
    if (!ctx || musicTimer) return;
    const BEAT = 60 / 72 / 2; let next = ctx.currentTime + .1;
    musicTimer = setInterval(() => {
      if (!ctx) return;
      while (next < ctx.currentTime + .6) {
        const bar = Math.floor(step / 8) % 4, s8 = step % 8;
        if (s8 === 0) pad(PROG[bar], next, BEAT * 8 + .4);
        if (s8 === 0 || s8 === 4) kick(next);
        const m = MEL[step % 16]; if (m && (!night || step % 2 === 0) && Math.floor(step / 32) % 2 === 1) pluck(night ? m - 12 : m, next);
        if (s8 === 6 && !night) pluck(PROG[bar][2] + 12, next);
        step++; next += BEAT;
      }
    }, 150);
  }
  function stopMusic() { if (musicTimer) clearInterval(musicTimer); musicTimer = 0; }

  function set(key, value) {
    prefs[key] = value; save();
    if (key === 'musicOn') { if (value) { ensure(); startMusic(); } }
    applyVolumes();
  }
  function setNight(v) { night = !!v; }
  /* weather ambience: a looping filtered-noise bed — rain hiss or winter wind — faded by intensity */
  let amb = null;
  function ambience(kind, level) {
    if (!ctx || !prefs.sfxOn) { if (amb) amb.g.gain.setTargetAtTime(0, ctx ? ctx.currentTime : 0, .5); return; }
    if (!amb) {
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .13; lg.gain.value = 0; lfo.connect(lg); lg.connect(g.gain);
      src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); lfo.start(); amb = { f, g, lg, kind: '' };
    }
    const t = ctx.currentTime, on = kind === 'rain' || kind === 'snow' || kind === 'leaves';
    if (on && amb.kind !== kind) {
      amb.kind = kind;
      if (kind === 'rain') { amb.f.type = 'highpass'; amb.f.frequency.setTargetAtTime(1400, t, .3); amb.f.Q.value = .4; }
      else { amb.f.type = 'lowpass'; amb.f.frequency.setTargetAtTime(kind === 'snow' ? 380 : 520, t, .3); amb.f.Q.value = .7; }
    }
    const vol = !on ? 0 : (kind === 'rain' ? .05 : .035) * level;
    amb.g.gain.setTargetAtTime(vol, t, 1.5); amb.lg.gain.setTargetAtTime(kind === 'rain' ? 0 : vol * .6, t, 1.5);
  }
  // range sliders in the settings drawer: <input data-audio="music|sfx">
  document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.audio; if (k) set(k, +e.target.value); });

  /** Current output level 0..1 (peak of the last few ms) — for tests and a future VU meter. */
  function level() { if (!meter) return 0; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; }
  return { ambience, level, sfx, set, setNight, prefs: () => prefs, ensure, stopMusic };
})();
