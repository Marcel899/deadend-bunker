/* Bunker cosmetics (DE.Data.COSMETICS): unlock options once, then pick freely. No gameplay effect.
 * state.cosmetics = { sel: { slot: optionId }, owned: { 'slot:optionId': true }, name: 'SHELTER 07' } */
var DE = globalThis.DE = globalThis.DE || {};

DE.Cosmetics = (function () {
  const U = () => DE.Util;
  const D = () => DE.Data.COSMETICS;

  function ensure(state) {
    const c = state.cosmetics = U().isObj(state.cosmetics) ? state.cosmetics : {};
    if (!U().isObj(c.sel)) c.sel = {};
    if (!U().isObj(c.owned)) c.owned = {};
    if (typeof c.name !== 'string' || !c.name) c.name = DE.Data.COSMETIC_NAME_DEFAULT;
    return c;
  }
  function option(slot, id) { const d = D()[slot]; return d ? d.options.find(o => o.id === id) || null : null; }
  /** The option currently shown for a slot (falls back to the free default). */
  function selected(state, slot) {
    const c = state.cosmetics || {}, id = c.sel && c.sel[slot];
    return (id && option(slot, id) && owns(state, slot, id)) ? option(slot, id) : D()[slot].options[0];
  }
  function owns(state, slot, id) {
    const o = option(slot, id); if (!o) return false;
    return !o.cost || !!(state.cosmetics && state.cosmetics.owned && state.cosmetics.owned[slot + ':' + id]);
  }
  /** Buy (if needed) and select an option. */
  function choose(state, slot, id) {
    const o = option(slot, id); if (!o) return { ok: false, reason: 'Unknown option' };
    const c = ensure(state);
    let cost = null;
    if (!owns(state, slot, id)) {
      if (!U().canAfford(state.resources, o.cost)) return { ok: false, reason: 'Not enough resources' };
      U().pay(state.resources, o.cost); c.owned[slot + ':' + id] = true; cost = o.cost;
    }
    c.sel[slot] = id;
    return { ok: true, bought: !!cost, cost, option: o };
  }
  function cleanName(name) {
    return String(name == null ? '' : name).toUpperCase().replace(/[^A-Z0-9 .\-#!]/g, '').replace(/\s+/g, ' ').trim().slice(0, DE.Data.COSMETIC_NAME_MAX);
  }
  function setName(state, name) {
    const n = cleanName(name); if (!n) return { ok: false, reason: 'Pick a name with letters or numbers' };
    ensure(state).name = n; return { ok: true, name: n };
  }
  function name(state) { return (state.cosmetics && state.cosmetics.name) || DE.Data.COSMETIC_NAME_DEFAULT; }
  /** Rebuild a clean cosmetics object from untrusted save data. */
  function sanitize(src) {
    const out = { sel: {}, owned: {}, name: DE.Data.COSMETIC_NAME_DEFAULT };
    if (!U().isObj(src)) return out;
    if (U().isObj(src.owned)) for (const k in src.owned) { const [slot, id] = k.split(':'); const o = option(slot, id); if (o && o.cost && src.owned[k] === true) out.owned[k] = true; }
    if (U().isObj(src.sel)) for (const slot in D()) { const id = src.sel[slot], o = typeof id === 'string' && option(slot, id); if (o && (!o.cost || out.owned[slot + ':' + id])) out.sel[slot] = id; }
    const n = cleanName(src.name); if (n) out.name = n;
    return out;
  }
  function ownedCount(state) {
    let n = 0, all = 0; for (const slot in D()) for (const o of D()[slot].options) { all++; if (owns(state, slot, o.id)) n++; }
    return { n, all };
  }

  return { ensure, option, selected, owns, choose, setName, name, cleanName, sanitize, ownedCount };
})();
