/* Shared helpers: number formatting, time formatting, RNG, cost math. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Util = (function () {
  const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

  /** Format a quantity: 0-999 plain, then K/M/B... */
  function fmt(n, dec) {
    if (n == null || !isFinite(n)) return n === Infinity ? '∞' : '0';
    const neg = n < 0; n = Math.abs(n);
    if (n < 1000) {
      if (dec != null) return (neg ? '-' : '') + n.toFixed(dec);
      return (neg ? '-' : '') + (n < 10 && n !== Math.floor(n) ? n.toFixed(1) : Math.floor(n).toString());
    }
    let i = 0;
    while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
    return (neg ? '-' : '') + n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0) + SUFFIX[i];
  }

  /** Format a per-second rate with sign. */
  function fmtRate(n) {
    const a = Math.abs(n);
    const s = a < 10 ? a.toFixed(2) : fmt(a);
    return (n < 0 ? '-' : '+') + s + '/s';
  }

  /** Seconds → "1h 05m", "4m 12s", "33s". */
  function fmtTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm';
    if (m > 0) return m + 'm ' + String(s).padStart(2, '0') + 's';
    return s + 's';
  }

  function fmtPct(x, dec) { return ((x) * 100).toFixed(dec == null ? 0 : dec) + '%'; }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  function weightedPick(list, weightKey) {
    const total = list.reduce((s, x) => s + (x[weightKey || 'weight'] || 1), 0);
    let r = Math.random() * total;
    for (const x of list) { r -= (x[weightKey || 'weight'] || 1); if (r <= 0) return x; }
    return list[list.length - 1];
  }

  /** Sum of base * g^k for k = start .. start+count-1 */
  function geomSum(base, g, start, count) {
    if (count <= 0) return 0;
    if (Math.abs(g - 1) < 1e-9) return base * count;
    return base * Math.pow(g, start) * (Math.pow(g, count) - 1) / (g - 1);
  }

  /* ---- cost objects: { scrap: 10, concrete: 5 } ---- */
  function scaleCost(cost, m) {
    const out = {};
    for (const k in cost) out[k] = Math.ceil(cost[k] * m);
    return out;
  }
  function addCost(a, b) {
    const out = Object.assign({}, a);
    for (const k in b) out[k] = (out[k] || 0) + b[k];
    return out;
  }
  function canAfford(resources, cost) {
    for (const k in cost) if ((resources[k] || 0) < cost[k] - 1e-9) return false;
    return true;
  }
  function pay(resources, cost) {
    for (const k in cost) resources[k] = Math.max(0, (resources[k] || 0) - cost[k]);
  }
  function costText(cost) {
    const R = DE.Data.RESOURCES;
    const icon = (k) => DE.Icons ? DE.Icons.res(k, 'ico-inline') : (R[k] ? R[k].icon : '');
    return Object.keys(cost).filter(k => cost[k] > 0).map(k => `<span class="cost-item">${icon(k)}${fmt(cost[k])}</span>`).join(' ');
  }

  const deepClone = (o) => JSON.parse(JSON.stringify(o));
  const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const num = (v, d) => (typeof v === 'number' && isFinite(v)) ? v : d;

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  return { fmt, fmtRate, fmtTime, fmtPct, clamp, rand, randInt, pick, chance, weightedPick, geomSum,
    scaleCost, addCost, canAfford, pay, costText, deepClone, isObj, num, escapeHtml };
})();
