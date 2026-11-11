/* The single simulation step. Online ticks and offline catch-up both go through here,
 * so there is exactly one copy of the game rules. `now` is the virtual clock (ms). */
var DE = globalThis.DE = globalThis.DE || {};

DE.Sim = (function () {
  function tick(state, dt, now) {
    state._events = state._events || [];
    const fx = state._fx = DE.Effects.compute(state);

    // timers
    DE.Bunker.tickConstruction(state, now).forEach(e => state._events.push(e));
    const res = DE.Research.tick(state, now);
    if (res) state._events.push({ type: 'research', node: res });
    const dig = DE.Excavation.tick(state, now);
    if (dig) state._events.push({ type: 'excavated', depth: dig.depth, facility: dig.facility });
    DE.Expeditions.tick(state, now);
    // research / excavation may have changed effects
    if (!state._fx) state._fx = DE.Effects.compute(state);

    // economy
    const rates = DE.Economy.computeRates(state, state._fx);
    state._rates = rates;
    DE.Economy.apply(state, rates, dt, state._fx);

    // people
    DE.Survivors.tick(state, dt, state._fx);
    DE.Needs.tick(state, dt, state._fx);

    // zombies
    DE.Defense.tick(state, now);
    // clamp wall hp if max changed
    const maxHp = DE.Defense.wallMaxHp(state);
    if (state.defense.wall.hp > maxHp) state.defense.wall.hp = maxHp;

    state.playtime += dt;
    state.lastTick = now;
    return state._events;
  }

  /** Drain queued events (UI consumes them). */
  function takeEvents(state) { const e = state._events || []; state._events = []; return e; }

  return { tick, takeEvents };
})();
