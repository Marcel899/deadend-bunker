/* Optional image assets. Drop PNGs into /assets using the names below and they are used
 * automatically; anything missing falls back to the built-in emoji/CSS art.
 *
 *   assets/rooms/<roomType>.png      room interior (e.g. rooms/farm.png), ~400x220, used as background
 *   assets/zombies/<zombieId>.png    zombie sprite (walker, runner, brute, toxic, mutant, boss)
 *   assets/icons/<resourceId>.png    resource icon (food, water, electricity, scrap, concrete, fuel, research)
 *   assets/professions/<id>.png      survivor portrait per profession
 *   assets/surface.png               sky/ruins backdrop behind the surface strip
 */
var DE = globalThis.DE = globalThis.DE || {};

DE.Assets = (function () {
  const loaded = {};   // key → url
  let pending = 0;

  /* Only the extras that actually ship are probed (probing every room type cost ~70 failed requests
   * on each load). Add a key here when you drop a matching PNG into /assets. */
  const SHIPPED = [];   // e.g. ['room.farm', 'surface']
  function manifest() {
    return SHIPPED.map(k => [k, k === 'surface' ? 'assets/surface.png' : 'assets/rooms/' + k.slice(5) + '.png']);
  }

  /** Probe every optional asset; `onDone` fires once when all probes settle. */
  function load(onDone) {
    if (typeof Image === 'undefined') { if (onDone) onDone(); return; }
    const list = manifest(); pending = list.length; if (!pending) { if (onDone) onDone(); return; }
    const settle = () => { if (--pending === 0 && onDone) onDone(); };
    list.forEach(([key, url]) => {
      const img = new Image();
      img.onload = () => { loaded[key] = url; settle(); };
      img.onerror = settle;
      img.src = url;
    });
  }

  function has(key) { return !!loaded[key]; }
  function url(key) { return loaded[key] || null; }
  function count() { return Object.keys(loaded).length; }

  /** `<img>` if the asset exists, otherwise the emoji fallback. */
  function icon(key, fallback, cls) {
    return loaded[key] ? `<img class="asset-icon ${cls || ''}" src="${loaded[key]}" alt="">` : fallback;
  }

  return { load, has, url, icon, count, manifest };
})();
