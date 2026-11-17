/* Calendar, seasons and weather — deterministic from state.playtime, so they are saved implicitly
 * and continue through offline catch-up.
 *
 *   one day     = DAY_SEC real seconds (8 min)
 *   one season  = DAYS_PER_SEASON days (7 days ≈ 56 min): spring → summer → autumn → winter
 *   weather     = rolled per block of BLOCK_DAYS (1.4 days ≈ 11 min, exactly 5 blocks per season, so a
 *                 block never straddles a season change); it fades in and out at the block edges
 *                 and is light or heavy. Snow covers the ground through winter and melts in early
 *                 spring; leaves pile up in autumn; flowers come out after the thaw.
 * Seasons also nudge the economy a little (DE.Season.mods) so the year has a rhythm: plan food for
 * winter, use the spring rains. */
var DE = globalThis.DE = globalThis.DE || {};

DE.Season = (function () {
  const DAY_SEC = 480, DAYS_PER_SEASON = 7, BLOCK_DAYS = DAYS_PER_SEASON / 5;
  const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  const NAME = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
  // weather chances per block, by season
  const TABLE = { spring: [['rain', .45]], summer: [['rain', .15]], autumn: [['rain', .3], ['leaves', .45]], winter: [['snow', .62]] };
  const WEATHER_NAME = { clear: 'Clear', rain: 'Rain', snow: 'Snow', leaves: 'Windy' };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function clock(state) {
    const t = ((state && state.playtime) || 0) + DAY_SEC * 0.3;          // a new game starts mid-morning
    const dayF = t / DAY_SEC, day = Math.floor(dayF) + 1, hour = (dayF % 1) * 24;
    const sIdx = Math.floor(dayF / DAYS_PER_SEASON), season = SEASONS[sIdx % 4];
    const seasonDays = dayF - sIdx * DAYS_PER_SEASON;
    const bIdx = Math.floor(dayF / BLOCK_DAYS), bt = (dayF - bIdx * BLOCK_DAYS) / BLOCK_DAYS;
    // the very first block of a run is always clear, so a new bunker starts in calm weather
    let weather = 'clear'; const r = hash(bIdx);
    if (bIdx > 0) { let acc = 0; for (const [w, p] of TABLE[season]) { acc += p; if (r < acc) { weather = w; break; } } }
    const heavy = hash(bIdx + 17.3) < .35;
    const fade = clamp01(Math.min(bt / .06, (1 - bt) / .06));
    const intensity = weather === 'clear' ? 0 : fade * (heavy ? 1 : .6);
    // ground cover
    const snow = season === 'winter' ? clamp01(seasonDays / .6) : season === 'spring' ? clamp01(1 - seasonDays / .8) : 0;
    const leaves = season === 'autumn' ? clamp01(seasonDays / 1) : season === 'winter' ? clamp01(1 - seasonDays / .7) * (1 - snow) : 0;
    const flowers = season === 'spring' ? clamp01((seasonDays - .6) / 1) : season === 'summer' ? clamp01(1 - seasonDays / 1.5) : 0;
    return { hour, day, dayF, season, seasonName: NAME[season], seasonDay: Math.floor(seasonDays) + 1, seasonDays, daysPerSeason: DAYS_PER_SEASON,
      nextSeasonIn: (DAYS_PER_SEASON - seasonDays) * DAY_SEC, nextSeason: SEASONS[(sIdx + 1) % 4],
      weather: intensity > .02 ? weather : 'clear', rolled: weather, heavy, intensity, weatherName: WEATHER_NAME[weather],
      cover: { snow, leaves, flowers }, sunUp: hour >= 6 && hour <= 18.5, night: hour < 5.5 || hour > 19.5 };
  }

  /** Gentle seasonal effects on production (multipliers per room type) and upkeep. */
  const MODS = {
    spring: { label: 'Farms +15%, water +10%', room: { farm: .15, hydroponics: .1, greenhouse: .15, water: .1, aquifer: .1 } },
    summer: { label: 'Farms +10%, water −10%', room: { farm: .1, greenhouse: .1, water: -.1, purification: -.1 } },
    autumn: { label: 'Harvest: farms +20%', room: { farm: .2, greenhouse: .2, hydroponics: .1 } },
    winter: { label: 'Cold: farms −25%, fuel use +15%', room: { farm: -.25, greenhouse: -.15 }, fuelUse: .15 },
  };
  function mods(state) {
    const c = clock(state), m = MODS[c.season];
    const out = { room: Object.assign({}, m.room), fuelUse: m.fuelUse || 0, label: m.label };
    if (c.weather === 'rain') { out.room.water = (out.room.water || 0) + .2 * c.intensity; out.room.aquifer = (out.room.aquifer || 0) + .2 * c.intensity; out.label += ' · rain: water +' + Math.round(20 * c.intensity) + '%'; }
    return out;
  }
  return { clock, mods, MODS, DAY_SEC, DAYS_PER_SEASON, SEASONS, NAME };
})();
