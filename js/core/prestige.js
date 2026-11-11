/* Reconstruction (prestige): reset the run for Legacy Points, spend them on permanent upgrades. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Prestige = (function () {
  const C = () => DE.CONFIG;

  /** Breakdown of Legacy Points the current run would award. */
  function breakdown(state) {
    const st = state.stats;
    const research = Object.keys(state.research.done).length;
    const parts = {
      production: Math.sqrt(st.runScore / C().LEGACY_DIVISOR) * (1 + 0.1 * (st.maxDepth - 1)),
      rooms: st.roomsBuilt * 0.05,
      depth: Math.max(0, st.maxDepth - 2) * 0.5,
      survivors: st.recruited * 0.1,
      research: research * 0.2,
      waves: st.wavesSurvived * 0.05,
    };
    parts.total = Math.floor(Object.values(parts).reduce((s, v) => s + v, 0));
    return parts;
  }
  /** Legacy Points the current run would award. */
  function potentialPoints(state) { return breakdown(state).total; }

  function canReset(state) {
    if (state.stats.maxDepth < C().PRESTIGE_MIN_DEPTH) return { ok: false, reason: 'Reach floor ' + C().PRESTIGE_MIN_DEPTH + ' first' };
    const gain = potentialPoints(state);
    if (gain < C().PRESTIGE_MIN_GAIN) return { ok: false, reason: 'Would only earn ' + gain + ' LP (need ' + C().PRESTIGE_MIN_GAIN + ')' };
    return { ok: true, gain };
  }

  /** Perform the reset. Returns the new state. */
  function reset(state, now) {
    const c = canReset(state);
    if (!c.ok) return { ok: false, reason: c.reason };
    const prestige = DE.Util.deepClone(state.prestige);
    prestige.points += c.gain; prestige.lifetime += c.gain; prestige.resets++;
    const fresh = DE.State.create(prestige, now || Date.now());
    fresh.settings = DE.Util.deepClone(state.settings);
    fresh.stats.zombiesKilled = 0;
    fresh.flags.lifetimeKills = (state.flags.lifetimeKills || 0) + state.stats.zombiesKilled;
    fresh.log.push({ t: fresh.createdAt, msg: 'Reconstruction #' + prestige.resets + ': the bunker is rebuilt from memory. +' + c.gain + ' Legacy Points.' });
    return { ok: true, state: fresh, gain: c.gain };
  }

  function upgradeCost(id, level) { const d = DE.Data.LEGACY[id]; return Math.ceil(d.cost * Math.pow(d.growth, level)); }

  function buy(state, id) {
    const d = DE.Data.LEGACY[id];
    if (!d) return { ok: false, reason: 'Unknown upgrade' };
    const lvl = state.prestige.upgrades[id] || 0;
    if (lvl >= d.max) return { ok: false, reason: 'Maxed' };
    const cost = upgradeCost(id, lvl);
    if (state.prestige.points < cost) return { ok: false, reason: 'Not enough Legacy Points' };
    state.prestige.points -= cost;
    state.prestige.upgrades[id] = lvl + 1;
    state._fx = null;
    return { ok: true };
  }

  return { breakdown, potentialPoints, canReset, reset, upgradeCost, buy };
})();
