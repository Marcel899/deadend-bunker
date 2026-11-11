/* Audio: every sound and the soundtrack are synthesised with the Web Audio API (no audio files).
 *
 *   DE.Audio.sfx(name)   click · buy · upgrade · error · shot · heavy · launch · boom · alarm · event · dig · hit
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
    dig: (t) => { noise(t, .18, .25, 300, .8, 'lowpass', 120); tone(80, t, .12, 'triangle', .12); },
    hit: (t) => { noise(t, .06, .15, 1200, 1.5); },
  };
  /** Play a sound effect. Fast repeats (gunfire) are rate-limited per sound. */
  function sfx(name, minGapMs) {
    if (!prefs.sfxOn || !FX[name] || !ensure()) return;
    const now = performance.now(); const gap = minGapMs != null ? minGapMs : (name === 'shot' ? 55 : name === 'hit' ? 40 : 30);
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
  // range sliders in the settings drawer: <input data-audio="music|sfx">
  document.addEventListener('input', e => { const k = e.target && e.target.dataset && e.target.dataset.audio; if (k) set(k, +e.target.value); });

  /** Current output level 0..1 (peak of the last few ms) — for tests and a future VU meter. */
  function level() { if (!meter) return 0; const a = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(a); let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return m; }
  return { level, sfx, set, setNight, prefs: () => prefs, ensure, stopMusic };
})();
