/* Offline progression: replay the elapsed time through the normal simulation in coarse steps.
 * Production is capped by the offline cap (research/legacy extend it); timers (construction,
 * research, excavation, expeditions) are absolute timestamps and always complete when due. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Offline = (function () {
  const C = () => DE.CONFIG;

  function capSeconds(state) { return DE.Effects.compute(state).offlineCapHours * 3600; }

  /** Simulate from state.lastTick to `now`. Returns a summary, or null if the gap was tiny. */
  function process(state, now) {
    now = now || Date.now();
    const elapsed = Math.max(0, (now - state.lastTick) / 1000);
    if (elapsed < C().OFFLINE_MIN_SEC) { state.lastTick = now; return null; }
    const cap = capSeconds(state);
    const simulated = Math.min(elapsed, cap);
    const before = Object.assign({}, state.resources);
    const beforeStats = { waves: state.stats.wavesSurvived, breaches: state.stats.breaches, kills: state.stats.zombiesKilled, pop: Object.keys(state.survivors).length };

    state._offline = true; state._offlineWaves = 0; state._events = [];
    const steps = Math.min(C().OFFLINE_MAX_STEPS, Math.max(1, Math.ceil(simulated)));
    const dt = simulated / steps;
    let t = state.lastTick;
    for (let i = 0; i < steps; i++) { t += dt * 1000; DE.Sim.tick(state, dt, t); }
    // Zero-length tick at the real clock: completes timers that expired during uncredited (capped) time.
    if (now > t) DE.Sim.tick(state, 0, now);
    state._offline = false;
    const events = state._events.slice(); state._events = [];
    state.lastTick = now;

    const gains = {};
    DE.Data.RESOURCE_ORDER.forEach(r => gains[r] = state.resources[r] - before[r]);
    return {
      elapsed, simulated, capped: elapsed > cap + 1, capHours: cap / 3600,
      gains, events,
      waves: state.stats.wavesSurvived - beforeStats.waves,
      breaches: state.stats.breaches - beforeStats.breaches,
      kills: state.stats.zombiesKilled - beforeStats.kills,
      newSurvivors: Object.keys(state.survivors).length - beforeStats.pop,
    };
  }

  return { process, capSeconds };
})();
