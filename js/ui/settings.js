/* Player settings for this device (localStorage, not the save file): graphics, effects, interface.
 * Audio volumes live in DE.Audio's own prefs. Every setting is applied the moment it changes:
 *   - body classes for CSS (q-low|q-medium|q-high, hq, perf, no-ambient, no-weather, no-rain,
 *     no-seasonal, no-speech, anim-reduced, no-anim, fx-off|fx-soft, pd-low|pd-med|pd-high)
 *   - getters the game code asks (on(key), density(), fps(), shake())
 * Graphics presets set the detail values below them; touching one of those makes the preset "Custom".
 * Defaults: Medium, or Low on small/older devices (few CPU cores); High Quality Mode stays off until
 * the player turns it on. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Settings = (function () {
  const KEY = 'deadend_settings_v1';
  const weak = typeof navigator !== 'undefined' && navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  const PRESETS = {
    low: { hq: false, particles: .4, anim: 'reduced', ambient: false },
    medium: { hq: false, particles: .7, anim: 'full', ambient: true },
    high: { hq: true, particles: 1, anim: 'full', ambient: true },
  };
  const DEFAULTS = Object.assign({ quality: weak ? 'low' : 'medium', weather: true, rain: true, seasonal: true, speech: true, autoEvents: true, screenFx: 'full', perf: false }, PRESETS[weak ? 'low' : 'medium']);
  let P = Object.assign({}, DEFAULTS);
  try { const saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && typeof saved === 'object') for (const k in DEFAULTS) if (saved[k] !== undefined && typeof saved[k] === typeof DEFAULTS[k]) P[k] = saved[k]; } catch (e) { /* defaults */ }
  if (!['low', 'medium', 'high', 'custom'].includes(P.quality)) P.quality = DEFAULTS.quality;
  if (!['full', 'reduced', 'off'].includes(P.anim)) P.anim = 'full';
  if (!['off', 'soft', 'full'].includes(P.screenFx)) P.screenFx = 'full';
  P.particles = Math.max(0, Math.min(1, +P.particles || 0));

  function save() { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* private mode: this session only */ } }
  function get(k) { return P[k]; }
  /** A feature switch, taking performance mode into account. */
  function on(k) {
    if (P.perf && (k === 'hq' || k === 'ambient')) return false;
    if ((k === 'rain' || k === 'seasonal') && !P.weather) return false;
    return !!P[k];
  }
  /** Particle density 0..1 (performance mode halves it). */
  function density() { return Math.max(0, Math.min(1, P.particles)) * (P.perf ? .5 : 1); }
  /** Character animator: frames to skip (1 = every frame at ~60, 2 = ~30 fps, 4 = ~15 fps). */
  function frameSkip() { return P.anim === 'reduced' || P.perf ? 4 : 2; }
  /** Screen shake / flashes: 0 off, .5 soft, 1 full. */
  function screenFx() { return P.screenFx === 'off' ? 0 : P.screenFx === 'soft' ? .5 : 1; }

  function set(k, v) {
    if (!(k in DEFAULTS)) return;
    if (k === 'quality') { P.quality = v; if (PRESETS[v]) Object.assign(P, PRESETS[v]); }
    else { P[k] = v; if (['hq', 'particles', 'anim', 'ambient'].includes(k) && P.quality !== 'custom') { const pr = PRESETS[P.quality]; if (pr && pr[k] !== v) P.quality = 'custom'; } }
    save(); apply();
  }
  function apply() {
    const b = document.body; if (!b) return;
    const cls = (c, onOff) => b.classList.toggle(c, !!onOff);
    ['low', 'medium', 'high', 'custom'].forEach(q => cls('q-' + q, P.quality === q));
    cls('hq', on('hq')); cls('perf', P.perf); cls('no-ambient', !on('ambient'));
    cls('no-weather', !P.weather); cls('no-rain', !on('rain')); cls('no-seasonal', !on('seasonal')); cls('no-speech', !P.speech);
    cls('anim-reduced', P.anim === 'reduced' || P.perf);
    const d = density(); cls('pd-low', d < .5); cls('pd-med', d >= .5 && d < .85); cls('pd-high', d >= .85);
    cls('fx-off', P.screenFx === 'off'); cls('fx-soft', P.screenFx === 'soft');
    // "Animations off" freezes motion everywhere (the same switch the save used to hold)
    const s = DE.Game && DE.Game.state; if (s && s.settings) s.settings.animations = P.anim !== 'off';
    cls('no-anim', P.anim === 'off');
    document.documentElement.style.setProperty('--particles', d.toFixed(2));
  }
  /** An older save carried "animations off": respect it once, then the device setting rules. */
  function adoptSave(s) { if (s && s.settings && s.settings.animations === false && P.anim !== 'off') { P.anim = 'off'; save(); } apply(); }

  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply(); }
  return { get, on, set, apply, adoptSave, density, frameSkip, screenFx, PRESETS, DEFAULTS, all: () => Object.assign({}, P) };
})();
