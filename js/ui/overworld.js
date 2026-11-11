/* Overworld: the illustrated surface above the bunker, built as layered SVG so every part
 * (clouds, sun, towers, flag, lights, trees, fence, bunker, props) animates on its own.
 * Coordinate system: 1664 x 600 (ground line y=490, dirt from y=520). The bunker compound sits
 * on the LEFT third; the right two thirds are wasteland with a road the expeditions use.
 * Upgradeable structures (DE.Data.OVERWORLD) are extra groups with class "up up-<key>-<level>"
 * that css/overworld.css reveals from #scene[data-<key>]. */
var DE = globalThis.DE = globalThis.DE || {};
DE.UI = DE.UI || {};

DE.UI.Overworld = (function () {
  const INK = '#1c1020';
  const W = 1664, H = 600, GROUND = 490;
  // compound geometry (x)
  const BK = { l: 200, r: 700, c: 450, doorL: 345, doorR: 555 };   // bunker body
  const TL = 20, TR = 760;                                          // tower x (150 wide)
  const FL = 10, FR = 930;                                          // fence extent

  /* ---------- defs ---------- */
  function defs() {
    return `<defs>
      <linearGradient id="ow-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4e1f6e"/><stop offset=".22" stop-color="#8a3078"/><stop offset=".48" stop-color="#d4553f"/><stop offset=".7" stop-color="#f08a36"/><stop offset=".88" stop-color="#f7b94c"/><stop offset="1" stop-color="#f5c45a"/>
      </linearGradient>
      <linearGradient id="ow-atmo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9a4a" stop-opacity="0"/><stop offset="1" stop-color="#ffb060" stop-opacity=".45"/></linearGradient><linearGradient id="ow-grasslight" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1a30" stop-opacity=".35"/><stop offset=".45" stop-color="#2a1a30" stop-opacity="0"/><stop offset="1" stop-color="#ffd27a" stop-opacity=".28"/></linearGradient><radialGradient id="ow-ray" cx="0" cy=".5" r="1"><stop offset="0" stop-color="#fff2b0" stop-opacity=".5"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></radialGradient><filter id="ow-blur6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter><radialGradient id="ow-sunglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6c8" stop-opacity=".95"/><stop offset=".45" stop-color="#ffd27a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
      <radialGradient id="ow-sun" cx=".45" cy=".4" r=".6"><stop offset="0" stop-color="#fffbe0"/><stop offset=".7" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffc24a"/></radialGradient>
      <linearGradient id="ow-cloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd2b4"/><stop offset=".4" stop-color="#f29a94"/><stop offset=".75" stop-color="#c6567e"/><stop offset="1" stop-color="#8a3474"/></linearGradient>
      <linearGradient id="ow-cloud2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8a98c"/><stop offset=".6" stop-color="#c25a7c"/><stop offset="1" stop-color="#7a2f6b"/></linearGradient>
      <linearGradient id="ow-ruinfar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8e4374"/><stop offset="1" stop-color="#5f2b62"/></linearGradient>
      <linearGradient id="ow-ruinnear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a2f5f"/><stop offset="1" stop-color="#3f1f45"/></linearGradient>
      <linearGradient id="ow-concrete" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4c2bd"/><stop offset=".55" stop-color="#95928f"/><stop offset="1" stop-color="#6c6865"/></linearGradient>
      <linearGradient id="ow-concrete2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8d6d1"/><stop offset="1" stop-color="#9a9794"/></linearGradient>
      <linearGradient id="ow-steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7d7f86"/><stop offset=".5" stop-color="#4e5058"/><stop offset="1" stop-color="#2d2f36"/></linearGradient>
      <linearGradient id="ow-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b06e"/><stop offset="1" stop-color="#a47a42"/></linearGradient>
      <linearGradient id="ow-wood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d5b36"/><stop offset="1" stop-color="#4f3020"/></linearGradient>
      <linearGradient id="ow-wood2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6b4228"/><stop offset=".5" stop-color="#9a6238"/><stop offset="1" stop-color="#5a351f"/></linearGradient>
      <linearGradient id="ow-pine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2d4a30"/><stop offset=".5" stop-color="#4a6e3a"/><stop offset="1" stop-color="#243a28"/></linearGradient>
      <linearGradient id="ow-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8ca03a"/><stop offset="1" stop-color="#5b6e22"/></linearGradient>
      <linearGradient id="ow-dirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4530"/><stop offset="1" stop-color="#4a2e20"/></linearGradient>
      <linearGradient id="ow-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a7a5ab"/><stop offset="1" stop-color="#5e5c66"/></linearGradient>
      <linearGradient id="ow-lamp" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7c0"/><stop offset="1" stop-color="#ffb63a"/></linearGradient>
      <linearGradient id="ow-glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#b86a2a"/></linearGradient>
      <linearGradient id="ow-asphalt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a4650"/><stop offset="1" stop-color="#2f2c36"/></linearGradient>
      <radialGradient id="ow-lampglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd36a" stop-opacity=".8"/><stop offset="1" stop-color="#ffd36a" stop-opacity="0"/></radialGradient>
      <radialGradient id="ow-redglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff5a3c" stop-opacity=".9"/><stop offset="1" stop-color="#ff5a3c" stop-opacity="0"/></radialGradient>
      <linearGradient id="ow-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff7c0" stop-opacity=".55"/><stop offset="1" stop-color="#fff7c0" stop-opacity="0"/></linearGradient>
      <pattern id="ow-hazard" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="24" height="24" fill="#f0b63c"/><rect width="12" height="24" fill="#1c1020"/></pattern>
      <pattern id="ow-chain" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 11 H22 M11 0 V22" stroke="#2a1d2e" stroke-width="2.2" fill="none"/></pattern>
      <pattern id="ow-dirtpat" width="160" height="110" patternUnits="userSpaceOnUse">
        <ellipse cx="30" cy="28" rx="26" ry="20" fill="#7a5238" stroke="#3b2418" stroke-width="3"/><ellipse cx="105" cy="60" rx="34" ry="24" fill="#73503a" stroke="#3b2418" stroke-width="3"/>
        <ellipse cx="50" cy="88" rx="22" ry="15" fill="#6d4a33" stroke="#3b2418" stroke-width="3"/><ellipse cx="140" cy="14" rx="18" ry="13" fill="#7a5238" stroke="#3b2418" stroke-width="3"/>
        <circle cx="78" cy="20" r="6" fill="#55392a" stroke="#3b2418" stroke-width="2"/><circle cx="12" cy="68" r="5" fill="#55392a" stroke="#3b2418" stroke-width="2"/><circle cx="128" cy="96" r="7" fill="#55392a" stroke="#3b2418" stroke-width="2"/>
      </pattern>
      <pattern id="ow-blocks" width="70" height="36" patternUnits="userSpaceOnUse"><path d="M0 0 H70 M0 18 H70 M35 0 V18 M0 18 V36 M70 18 V36 M0 36 H70" stroke="#4d4a48" stroke-width="2.5" fill="none" opacity=".55"/></pattern>
      <pattern id="ow-gravel" width="30" height="16" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2" fill="#a89a88"/><circle cx="18" cy="11" r="2.4" fill="#9a8c7a"/><circle cx="26" cy="3" r="1.6" fill="#b8aa98"/></pattern>
      <filter id="ow-haze" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
      ${symbols()}
    </defs>`;
  }
  function symbols() {
    return `<symbol id="ow-cloudsym" viewBox="-12 -12 324 154" overflow="visible">
        <clipPath id="ow-cloudsym-clip"><g><circle cx="70" cy="78" r="40"/><circle cx="120" cy="56" r="54"/><circle cx="176" cy="60" r="48"/><circle cx="230" cy="76" r="40"/><circle cx="150" cy="92" r="30"/><ellipse cx="150.0" cy="106" rx="130.0" ry="22"/></g></clipPath>
        <g fill="url(#ow-cloud)" stroke="#1c1020" stroke-width="6" stroke-linejoin="round"><ellipse cx="150.0" cy="106" rx="130.0" ry="22"/><circle cx="70" cy="78" r="40"/><circle cx="120" cy="56" r="54"/><circle cx="176" cy="60" r="48"/><circle cx="230" cy="76" r="40"/><circle cx="150" cy="92" r="30"/></g>
        <g fill="url(#ow-cloud)" stroke="none"><ellipse cx="150.0" cy="106" rx="130.0" ry="22"/><circle cx="70" cy="78" r="40"/><circle cx="120" cy="56" r="54"/><circle cx="176" cy="60" r="48"/><circle cx="230" cy="76" r="40"/><circle cx="150" cy="92" r="30"/></g>
        <g clip-path="url(#ow-cloudsym-clip)"><rect x="0" y="71.5" width="300" height="130" fill="#7a2c6a" opacity=".55"/><rect x="0" y="93.6" width="300" height="130" fill="#5a1e58" opacity=".5"/><path d="M0 110 q150.0 -30 300 0 v40 h-300 z" fill="#ff9a6a" opacity=".35"/></g>
        <g fill="#ffe2c8" opacity=".75"><circle cx="56" cy="60" r="12"/><circle cx="101" cy="32" r="16"/><circle cx="159" cy="38" r="14"/><circle cx="216" cy="58" r="12"/></g>
        <g fill="#fff3e4" opacity=".6"><circle cx="52" cy="56" r="5"/><circle cx="96" cy="26" r="6"/><circle cx="154" cy="34" r="6"/><circle cx="212" cy="54" r="5"/></g>
      </symbol>
      <symbol id="ow-cloudsym2" viewBox="-12 -12 324 160" overflow="visible">
        <clipPath id="ow-cloudsym2-clip"><g><circle cx="60" cy="90" r="36"/><circle cx="100" cy="60" r="48"/><circle cx="150" cy="44" r="56"/><circle cx="205" cy="62" r="46"/><circle cx="250" cy="86" r="34"/><ellipse cx="150.0" cy="112" rx="130.0" ry="22"/></g></clipPath>
        <g fill="url(#ow-cloud)" stroke="#1c1020" stroke-width="6" stroke-linejoin="round"><ellipse cx="150.0" cy="112" rx="130.0" ry="22"/><circle cx="60" cy="90" r="36"/><circle cx="100" cy="60" r="48"/><circle cx="150" cy="44" r="56"/><circle cx="205" cy="62" r="46"/><circle cx="250" cy="86" r="34"/></g>
        <g fill="url(#ow-cloud)" stroke="none"><ellipse cx="150.0" cy="112" rx="130.0" ry="22"/><circle cx="60" cy="90" r="36"/><circle cx="100" cy="60" r="48"/><circle cx="150" cy="44" r="56"/><circle cx="205" cy="62" r="46"/><circle cx="250" cy="86" r="34"/></g>
        <g clip-path="url(#ow-cloudsym2-clip)"><rect x="0" y="74.80000000000001" width="300" height="136" fill="#7a2c6a" opacity=".55"/><rect x="0" y="97.92" width="300" height="136" fill="#5a1e58" opacity=".5"/><path d="M0 116 q150.0 -30 300 0 v40 h-300 z" fill="#ff9a6a" opacity=".35"/></g>
        <g fill="#ffe2c8" opacity=".75"><circle cx="83" cy="38" r="14"/><circle cx="130" cy="19" r="17"/><circle cx="189" cy="41" r="14"/></g>
        <g fill="#fff3e4" opacity=".6"><circle cx="78" cy="34" r="6"/><circle cx="125" cy="13" r="7"/><circle cx="184" cy="37" r="6"/></g>
      </symbol>
      <symbol id="ow-pine" viewBox="0 0 120 220">
        <g stroke="${INK}" stroke-width="5" stroke-linejoin="round"><rect x="52" y="180" width="16" height="36" fill="url(#ow-wood)"/><path d="M60 10 L22 76 H40 L8 132 H34 L0 190 H120 L86 132 H112 L80 76 H98 Z" fill="url(#ow-pine)"/></g>
        <path d="M60 24 L38 68 H52 L30 124 H46 L24 180" stroke="#7fa455" stroke-width="4" fill="none" opacity=".6"/>
      </symbol>
      <symbol id="ow-deadtree" viewBox="0 0 100 160">
        <path d="M50 158 V70 M50 100 L22 60 M22 60 L10 44 M22 60 L30 30 M50 70 L78 40 M78 40 L92 30 M78 40 L74 14 M50 84 L66 70" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M50 158 V70 M50 100 L22 60 M22 60 L10 44 M22 60 L30 30 M50 70 L78 40 M78 40 L92 30 M78 40 L74 14 M50 84 L66 70" fill="none" stroke="#4a3328" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      </symbol>
      <symbol id="ow-crate" viewBox="0 0 80 64"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><rect x="2" y="2" width="76" height="60" rx="5" fill="currentColor"/><path d="M2 18 H78 M2 46 H78" fill="none"/><path d="M14 18 L66 46 M66 18 L14 46" fill="none" opacity=".7"/></g><rect x="8" y="6" width="64" height="8" rx="3" fill="#fff" opacity=".18"/></symbol>
      <symbol id="ow-barrel" viewBox="0 0 52 70"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><rect x="2" y="2" width="48" height="66" rx="8" fill="currentColor"/><path d="M2 18 H50 M2 52 H50" fill="none" opacity=".8"/></g><rect x="8" y="6" width="10" height="58" rx="4" fill="#fff" opacity=".15"/></symbol>
      <symbol id="ow-post" viewBox="0 0 24 150"><rect x="4" y="4" width="16" height="142" rx="3" fill="url(#ow-wood2)" stroke="${INK}" stroke-width="4"/><circle cx="12" cy="30" r="3" fill="${INK}"/><circle cx="12" cy="70" r="3" fill="${INK}"/><circle cx="12" cy="110" r="3" fill="${INK}"/></symbol>
      <symbol id="ow-steelpost" viewBox="0 0 24 150"><rect x="5" y="4" width="14" height="142" rx="2" fill="url(#ow-steel)" stroke="${INK}" stroke-width="4"/><rect x="2" y="140" width="20" height="8" fill="#5a5f6a" stroke="${INK}" stroke-width="3"/></symbol>
      <symbol id="ow-tower" viewBox="0 0 150 310">
        <g stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
          <path d="M30 110 L14 306 M120 110 L136 306" stroke-width="9" fill="none"/><path d="M22 160 H128 M18 210 H132 M15 258 H135" fill="none" stroke-width="6"/>
          <path d="M22 160 L128 210 M128 160 L22 210 M18 210 L132 258 M132 210 L18 258 M15 258 L135 306 M135 258 L15 306" fill="none" stroke-width="5" stroke="#3a2418"/>
          <path d="M22 160 L128 210 M128 160 L22 210 M18 210 L132 258 M132 210 L18 258 M15 258 L135 306 M135 258 L15 306" fill="none" stroke-width="3" stroke="#a46a3c"/>
          <rect x="18" y="86" width="114" height="30" rx="4" fill="url(#ow-wood)"/><rect x="24" y="30" width="102" height="58" rx="4" fill="url(#ow-glass)"/>
          <path d="M24 30 V88 M126 30 V88 M58 30 V88 M92 30 V88" fill="none" stroke-width="6"/><rect x="10" y="14" width="130" height="20" rx="5" fill="url(#ow-wood)"/>
          <rect x="20" y="86" width="110" height="10" fill="#3a2418" stroke="none"/><path d="M20 116 V132 H130 V116" fill="none" stroke-width="5"/><path d="M40 116 V132 M60 116 V132 M80 116 V132 M100 116 V132 M120 116 V132" fill="none" stroke-width="3"/>
        </g>
        <circle class="ow-lampglow" cx="75" cy="60" r="34" fill="url(#ow-lampglow)"/><rect class="ow-lantern" x="66" y="42" width="18" height="24" rx="4" fill="url(#ow-lamp)" stroke="${INK}" stroke-width="3"/>
        <path class="ow-sentry" d="M40 88 C40 70 60 66 60 50 a8 8 0 1 1 16 0 c0 16 18 20 18 38 Z" fill="#2a1a28" opacity=".85"/>
        <path d="M22 14 V-26" stroke="${INK}" stroke-width="5"/><circle class="ow-redglow" cx="22" cy="-30" r="20" fill="url(#ow-redglow)"/><circle class="ow-redlight" cx="22" cy="-30" r="7" fill="#ff4a2e" stroke="${INK}" stroke-width="3"/>
      </symbol>
      <symbol id="ow-car" viewBox="0 0 130 56"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M6 42 V28 Q8 22 16 22 L32 8 H86 L102 22 H118 Q126 22 126 30 V42 Z" fill="currentColor"/><path d="M36 22 L44 12 H80 L92 22 Z" fill="#6c4668"/><circle cx="32" cy="42" r="11" fill="#241626"/><circle cx="98" cy="42" r="11" fill="#241626"/><circle cx="32" cy="42" r="4" fill="#6b5062"/><circle cx="98" cy="42" r="4" fill="#6b5062"/></g><path d="M50 14 l6 6 l-4 4" stroke="${INK}" stroke-width="2" fill="none"/></symbol>
      <symbol id="ow-bus" viewBox="0 0 220 80"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M6 64 V22 q0 -10 10 -10 H200 q12 0 12 12 V64 Z" fill="#8a6a3a"/><rect x="16" y="20" width="26" height="20" fill="#5a4a60"/><rect x="50" y="20" width="26" height="20" fill="#5a4a60"/><rect x="84" y="20" width="26" height="20" fill="#5a4a60"/><rect x="118" y="20" width="26" height="20" fill="#5a4a60"/><rect x="152" y="20" width="26" height="20" fill="#5a4a60"/><circle cx="48" cy="64" r="12" fill="#241626"/><circle cx="170" cy="64" r="12" fill="#241626"/><path d="M60 12 l16 -8 M100 12 l-8 -9" stroke-width="3"/></g><path d="M130 44 l20 -2 l-6 10 z" fill="#3a2418"/><path d="M6 44 h206" stroke="#5a4028" stroke-width="3" opacity=".7"/></symbol>
      <symbol id="ow-rock" viewBox="0 0 140 90"><g stroke="${INK}" stroke-width="5" stroke-linejoin="round"><path d="M8 84 L18 44 L48 14 L96 8 L128 36 L136 84 Z" fill="url(#ow-rock)"/></g><path d="M30 42 L52 22 L92 16" stroke="#d4d2d8" stroke-width="5" fill="none" stroke-linecap="round" opacity=".7"/><path d="M60 80 L72 48 L112 40" stroke="#3f3c47" stroke-width="4" fill="none" stroke-linecap="round" opacity=".5"/></symbol>
      <symbol id="ow-rubble" viewBox="0 0 160 70"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M4 66 L20 40 L48 46 L60 24 L96 36 L120 20 L150 44 L156 66 Z" fill="#6a5a60"/><rect x="30" y="50" width="26" height="10" fill="#8a7a70" transform="rotate(-12 43 55)"/><rect x="100" y="48" width="30" height="10" fill="#8a7a70" transform="rotate(8 115 53)"/></g><path d="M70 40 l8 -10 M84 48 l10 -6" stroke="#3a2a30" stroke-width="3"/></symbol>
      <symbol id="ow-lamppost" viewBox="0 0 40 160"><rect x="17" y="20" width="6" height="140" fill="#4e5058" stroke="${INK}" stroke-width="3"/><path d="M20 20 h12 v10 h-12" fill="#3a3f4a" stroke="${INK}" stroke-width="3"/><rect class="ow-lampbulb" x="22" y="28" width="10" height="5" fill="#fff7c0"/><path class="ow-lampcone" d="M22 33 L2 150 H52 L32 33 z" fill="#fff7c0" opacity=".16"/><circle class="ow-lampglow" cx="27" cy="32" r="18" fill="url(#ow-lampglow)"/></symbol>
      <symbol id="ow-barrier" viewBox="0 0 80 50"><path d="M4 48 V20 q0 -8 8 -8 h56 q8 0 8 8 V48 z" fill="#b8b5ae" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M4 30 h72" stroke="#8a8780" stroke-width="3"/><rect x="10" y="34" width="60" height="8" fill="url(#ow-hazard)"/></symbol>`;
  }

  /* ---------- background ---------- */
  function sky() {
    return `<rect class="ow-skyfill" x="0" y="0" width="${W}" height="${GROUND + 10}" fill="url(#ow-sky)"/>
      <ellipse class="ow-horizonhaze" cx="1000" cy="330" rx="900" ry="110" fill="#ffb460" opacity=".35" filter="url(#ow-haze)"/>
      <g class="ow-stars" fill="#fff6d8">${stars()}</g>
      <g class="ow-sunwrap"><circle class="ow-sunglow" cx="1120" cy="265" r="230" fill="url(#ow-sunglow)"/>
      <g class="ow-godrays" opacity=".55">${[0, 25, 55, 95, 130, 160, 200, 235, 275, 300, 330].map(a => `<path d="M1120 265 L${(1120 + Math.cos(a * Math.PI / 180) * 700).toFixed(0)} ${(265 + Math.sin(a * Math.PI / 180) * 700 - 40).toFixed(0)} L${(1120 + Math.cos((a + 9) * Math.PI / 180) * 700).toFixed(0)} ${(265 + Math.sin((a + 9) * Math.PI / 180) * 700 + 40).toFixed(0)} z" fill="url(#ow-ray)"/>`).join('')}</g>
      <circle class="ow-sun" cx="1120" cy="265" r="68" fill="url(#ow-sun)" stroke="#ffd98a" stroke-width="4"/><circle cx="1120" cy="265" r="84" fill="none" stroke="#fff3b0" stroke-width="6" opacity=".25"/>
      <g class="ow-flare" opacity=".5">${[[0.2, 14, '#ffd27a'], [0.42, 8, '#ff9a6a'], [0.62, 20, '#ffe8a0'], [0.8, 6, '#ffb3b0']].map(([t, r, c]) => `<circle cx="${(1120 + (520 - 1120) * t).toFixed(0)}" cy="${(265 + (470 - 265) * t).toFixed(0)}" r="${r}" fill="${c}" opacity=".35"/>`).join('')}</g></g>`;
  }
  function stars() {
    let s = ''; let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 46; i++) { const x = (rnd() * W).toFixed(0), y = (rnd() * 150).toFixed(0), r = (0.8 + rnd() * 1.6).toFixed(1); s += `<circle class="ow-star" style="--d:${(-rnd() * 5).toFixed(1)}s" cx="${x}" cy="${y}" r="${r}" opacity="${(0.25 + (1 - y / 150) * 0.55).toFixed(2)}"/>`; }
    return s;
  }
  function clouds() {
    const C = [[40, 30, 320, 130, 0], [420, 84, 240, 160, -40], [700, 16, 380, 180, -90], [1020, 60, 280, 150, -20], [1260, 104, 330, 170, -70], [1470, 10, 300, 140, -110], [220, 150, 200, 210, -30], [1140, 150, 220, 220, -120]];
    return C.map(([x, y, w, sp, d], i) => `<g class="ow-cloud" style="--spd:${sp}s;--d:${d}s"><use href="#ow-cloudsym${i % 2 ? '2' : ''}" x="${x}" y="${y}" width="${w}" height="${w * 130 / 300}"/></g>`).join('');
  }
  function win(list, w = 10, h = 12) { return list.map(([x, y]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`).join(''); }
  function skyline() {
    const far = `<g class="ow-ruins-far" fill="url(#ow-ruinfar)" stroke="${INK}" stroke-width="4" stroke-linejoin="round">
      <path d="M0 340 V300 H40 V250 H90 V300 H120 V270 H160 V340 Z"/><path d="M480 340 V268 H520 V236 H570 V288 H600 V250 H640 V340 Z"/><path d="M690 340 V282 H735 V246 H790 V300 H820 V340 Z"/>
      <path d="M1040 340 V262 H1080 V228 H1150 V290 H1190 V340 Z"/><path d="M1500 340 V286 H1540 V250 H1600 V300 H1664 V340 Z"/><path d="M1220 340 V300 H1250 V270 H1290 V310 H1320 V340 Z"/></g>
    <g fill="#2d1536" opacity=".55">${win([[52, 262], [70, 262], [52, 285], [532, 248], [550, 248], [532, 270], [750, 258], [770, 258], [1095, 240], [1120, 240], [1095, 262], [1552, 262], [1572, 262], [1262, 282]])}</g>`;
    const near = `<g class="ow-ruins-near" fill="url(#ow-ruinnear)" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
      <path d="M150 360 V290 L178 282 V232 H224 L238 250 V300 H270 V360 Z"/><path d="M440 360 V272 H470 L478 250 H530 L536 262 V300 H552 V360 Z"/><path d="M600 360 V300 H660 V262 L700 248 V300 H730 V360 Z"/>
      <path d="M960 360 V292 H1000 L1016 246 H1060 V290 H1095 V326 H1120 V360 Z"/><path d="M1180 360 V312 L1220 300 V236 H1262 V284 H1300 V360 Z"/><path d="M1400 360 V300 L1440 288 V260 H1480 V320 H1500 V360 Z"/>
      <path d="M1330 360 V320 H1350 V300 L1372 296 V360 Z"/></g>
    <g fill="#1a0e22">${win([[190, 248], [210, 248], [190, 270], [210, 270], [490, 266], [508, 266], [670, 270], [690, 270], [1026, 262], [1044, 262], [1026, 286], [1232, 250], [1232, 274], [1452, 276], [1452, 298]], 12, 14)}</g>
    <g class="ow-ruins-glow" fill="#ffb347" opacity=".9">${win([[210, 270], [690, 270], [1044, 286], [1452, 298]], 12, 14)}</g>
    <g class="ow-rubble-far" fill="#3a1e3f" stroke="${INK}" stroke-width="4"><path d="M270 360 L300 338 L340 350 L372 334 L400 360 Z"/><path d="M1300 360 L1322 342 L1358 352 L1382 340 L1400 360 Z"/><path d="M840 360 L860 346 L890 352 L910 360 Z"/></g>
    <g class="ow-gasstation" stroke="${INK}" stroke-width="4" stroke-linejoin="round"><rect x="1080" y="318" width="110" height="42" fill="#5a2f5e"/><rect x="1060" y="306" width="150" height="14" rx="3" fill="#6e3a66"/><rect x="1070" y="320" width="6" height="40" fill="#4a2a4e"/><rect x="1196" y="320" width="6" height="40" fill="#4a2a4e"/><rect x="1100" y="330" width="22" height="30" fill="#2d1536"/><rect x="1150" y="330" width="22" height="30" fill="#2d1536"/><text x="1135" y="317" font-family="Lilita One, Impact, sans-serif" font-size="11" fill="#ffb347" text-anchor="middle" stroke="none">GAS</text></g>`;
    return far + near + `<rect x="0" y="200" width="${W}" height="170" fill="url(#ow-atmo)"/>`;
  }
  function farLandmarks() {
    const lattice = `<g class="ow-latticetower" transform="translate(1000 0)" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
      <path d="M78 172 L60 330 M130 172 L148 330" stroke-width="8"/><path d="M72 215 H136 M66 262 H142 M62 300 H146" stroke-width="5"/>
      <path d="M72 215 L136 262 M136 215 L72 262 M66 262 L142 300 M142 262 L66 300 M62 300 L148 330 M148 300 L60 330" stroke="#5d3a2a" stroke-width="3"/>
      <rect x="58" y="146" width="92" height="30" rx="4" fill="#5a3a2c"/><rect x="66" y="112" width="76" height="36" rx="3" fill="#7a4a60"/><rect x="54" y="100" width="100" height="16" rx="4" fill="#5a3a2c"/>
      <path d="M60 176 V192 H148 V176 M80 176 V192 M100 176 V192 M120 176 V192" fill="none"/><rect x="74" y="118" width="18" height="22" fill="#2a1830"/><rect x="116" y="118" width="18" height="22" fill="#2a1830"/></g>`;
    const spokes = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<line x1="1570" y1="235" x2="${1570 + Math.cos(a) * 92}" y2="${235 + Math.sin(a) * 92}"/>`; }).join('');
    const cabins = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<rect x="${1570 + Math.cos(a) * 92 - 9}" y="${235 + Math.sin(a) * 92 - 6}" width="18" height="14" rx="3" fill="${i % 3 ? '#6e3a5e' : '#b05a5a'}"/>`; }).join('');
    const ferris = `<g class="ow-ferris" stroke="${INK}" stroke-width="5" stroke-linejoin="round"><path d="M1570 235 L1500 360 M1570 235 L1640 360 M1522 320 H1618" fill="none" stroke-width="8"/>
      <g class="ow-ferris-wheel"><circle cx="1570" cy="235" r="92" fill="none" stroke-width="7"/><circle cx="1570" cy="235" r="62" fill="none" stroke-width="4" opacity=".8"/><g stroke-width="4" opacity=".9">${spokes}</g>${cabins}<circle cx="1570" cy="235" r="12" fill="#8a4a6a"/></g></g>`;
    const pylons = `<g class="ow-pylons" stroke="${INK}" stroke-width="4" stroke-linecap="round"><path d="M1420 350 V250 M1410 262 h20 M1412 290 h16" /><path d="M1250 350 V262 M1240 274 h20 M1242 300 h16"/><path d="M1260 268 q80 30 160 -6" fill="none" stroke-width="2"/></g>`;
    return lattice + pylons + ferris;
  }
  function hills() {
    return `<path class="ow-hills" d="M0 370 Q120 340 240 362 T520 356 T800 368 T1080 356 T1360 366 T1664 352 V392 H0 Z" fill="#6d4f3a" stroke="${INK}" stroke-width="4"/>
      <path class="ow-hills2" d="M0 380 Q200 364 400 382 T820 376 T1240 386 T1664 372 V${GROUND} H0 Z" fill="#7d5c40"/>
      <g class="ow-tufts" stroke="#8f8a3a" stroke-width="3" stroke-linecap="round" fill="none">${[90, 230, 470, 560, 960, 1180, 1470, 1600].map(x => `<path d="M${x} 390 l-4 -14 M${x + 6} 390 l2 -16 M${x + 12} 390 l6 -12"/>`).join('')}</g>`;
  }

  /* ---------- compound (left) ---------- */
  function fence() {
    const posts = []; for (let x = FL + 12; x <= FR - 8; x += 112) posts.push(x);
    const barbs = []; for (let x = FL + 6; x < FR; x += 14) barbs.push(`<circle cx="${x}" cy="${372 + (x % 28 ? 0 : 4)}" r="6"/>`);
    const barbs2 = []; for (let x = FL + 10; x < FR; x += 14) barbs2.push(`<circle cx="${x}" cy="${392}" r="5"/>`);
    const sandbags = []; for (let x = FL + 20; x < FR - 10; x += 36) sandbags.push(`<ellipse cx="${x}" cy="${GROUND - 2}" rx="20" ry="10"/>`);
    const barriers = []; for (let x = FL + 10; x < FR - 70; x += 82) barriers.push(`<use href="#ow-barrier" x="${x}" y="${GROUND - 48}" width="80" height="50"/>`);
    return `<g class="ow-fence">
      <rect x="${FL - 4}" y="380" width="${FR - FL + 8}" height="${GROUND - 380}" fill="url(#ow-chain)" opacity=".75"/><rect x="${FL - 4}" y="380" width="${FR - FL + 8}" height="${GROUND - 380}" fill="#2a1d2e" opacity=".18"/>
      <path d="M${FL - 4} 384 H${FR + 4} M${FL - 4} ${GROUND - 6} H${FR + 4}" stroke="${INK}" stroke-width="6" fill="none"/>
      <g class="ow-barbs" fill="none" stroke="${INK}" stroke-width="2.5">${barbs.join('')}</g><path d="M${FL - 4} 372 H${FR + 4}" stroke="#3b2a36" stroke-width="2"/>
      <g class="up up-fence-2"><g fill="none" stroke="${INK}" stroke-width="2.5">${barbs2.join('')}</g><path d="M${FL - 4} 392 H${FR + 4}" stroke="#3b2a36" stroke-width="2"/><g fill="url(#ow-sand)" stroke="${INK}" stroke-width="4">${sandbags.join('')}</g></g>
      <g class="up up-fence-3">${barriers.join('')}<g fill="none" stroke="#9a9aa8" stroke-width="2">${barbs.map(b => b.replace('cy="372"', 'cy="360"').replace('cy="376"', 'cy="364"')).join('')}</g></g>
      ${posts.map(x => `<use class="post-wood" href="#ow-post" x="${x - 12}" y="${GROUND - 150}" width="24" height="150"/>`).join('')}
      <g class="up up-fence-2">${posts.map(x => `<use href="#ow-steelpost" x="${x - 12}" y="${GROUND - 150}" width="24" height="150"/>`).join('')}</g>
    </g>`;
  }
  function towers() {
    const beam = (x, flip) => `<g class="ow-searchlight" style="transform-origin:${x + 75}px 240px"><path d="M${x + 75} 240 L${x + 75 + (flip ? -1 : 1) * 520} 60 L${x + 75 + (flip ? -1 : 1) * 620} 240 z" fill="url(#ow-beam)" opacity=".5"/></g>`;
    return `<use class="ow-tower ow-tower-l" href="#ow-tower" x="${TL}" y="184" width="150" height="310"/>
      <use class="ow-tower ow-tower-r" href="#ow-tower" x="${TR}" y="184" width="150" height="310"/>
      <g class="up up-towers-1" fill="url(#ow-sand)" stroke="${INK}" stroke-width="4">${[TL + 20, TL + 56, TL + 92, TL + 128, TR + 20, TR + 56, TR + 92, TR + 128].map(x => `<ellipse cx="${x}" cy="${GROUND - 2}" rx="20" ry="10"/>`).join('')}</g>
      <g class="up up-towers-2">${beam(TL, false)}${beam(TR, true)}<circle cx="${TL + 75}" cy="240" r="9" fill="#fff7c0" stroke="${INK}" stroke-width="3"/><circle cx="${TR + 75}" cy="240" r="9" fill="#fff7c0" stroke="${INK}" stroke-width="3"/></g>
      <g class="up up-lights-2"><g stroke="${INK}" stroke-width="4"><rect x="${TL + 68}" y="150" width="14" height="40" fill="#3a3f4a"/><rect x="${TL + 50}" y="140" width="50" height="14" rx="3" fill="#2f2d38"/><rect class="ow-lampbulb" x="${TL + 54}" y="152" width="42" height="4" fill="#fff7c0" stroke="none"/><rect x="${TR + 68}" y="150" width="14" height="40" fill="#3a3f4a"/><rect x="${TR + 50}" y="140" width="50" height="14" rx="3" fill="#2f2d38"/><rect class="ow-lampbulb" x="${TR + 54}" y="152" width="42" height="4" fill="#fff7c0" stroke="none"/></g>
        <path class="ow-floodcone" d="M${TL + 54} 156 L${TL - 60} ${GROUND} H${TL + 260} L${TL + 96} 156 z" fill="#fff7c0" opacity=".14"/><path class="ow-floodcone" d="M${TR + 54} 156 L${TR - 160} ${GROUND} H${TR + 200} L${TR + 96} 156 z" fill="#fff7c0" opacity=".14"/></g>`;
  }
  function sandbags(x, y, w) { let s = ''; const n = Math.round(w / 38); for (let i = 0; i < n; i++) s += `<ellipse cx="${x + i * 38 + 19}" cy="${y}" rx="22" ry="12"/>`; return s; }
  function bunker() {
    const { l, r, c, doorL, doorR } = BK;
    return `<g class="ow-bunker">
      <ellipse cx="${c}" cy="${GROUND + 8}" rx="280" ry="14" fill="#2a1a12" opacity=".45"/>
      <g class="ow-turret" stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
        <ellipse cx="${c - 15}" cy="342" rx="88" ry="20" fill="url(#ow-steel)"/><rect x="${c - 87}" y="300" width="144" height="42" rx="8" fill="url(#ow-steel)"/>
        <path d="M${c - 75} 300 H${c + 45} L${c + 35} 268 Q${c + 25} 250 ${c - 15} 248 Q${c - 55} 250 ${c - 65} 268 Z" fill="#5b5d66"/>
        <g class="ow-gun"><rect x="${c - 135}" y="246" width="128" height="24" rx="10" fill="#3f4149"/><rect x="${c - 151}" y="250" width="30" height="16" rx="6" fill="#2d2f36"/><rect x="${c - 113}" y="252" width="12" height="12" fill="#6e717b" stroke="none"/></g>
        <rect x="${c - 49}" y="256" width="60" height="40" rx="8" fill="#4b4d55"/><circle cx="${c - 19}" cy="276" r="7" fill="#ffd34a"/><path d="M${c - 65} 312 H${c + 35}" stroke="#767982" stroke-width="4"/>
        <rect x="${c - 27}" y="322" width="12" height="10" fill="#ffd34a" stroke="none"/><rect x="${c - 7}" y="322" width="12" height="10" fill="#ffd34a" stroke="none"/>
      </g>
      <g class="ow-sandbags" stroke="${INK}" stroke-width="4" stroke-linejoin="round" fill="url(#ow-sand)">${sandbags(l + 10, 372, 150)}${sandbags(r - 160, 372, 150)}${sandbags(l + 34, 356, 110)}${sandbags(r - 144, 356, 110)}</g>
      <g stroke="${INK}" stroke-width="5" stroke-linejoin="round">
        <path d="M${l} ${GROUND + 24} V386 Q${l} 360 ${l + 26} 358 H${r - 26} Q${r} 360 ${r} 386 V${GROUND + 24} Z" fill="url(#ow-concrete)"/>
        <path d="M${l} ${GROUND + 24} V386 Q${l} 360 ${l + 26} 358 H${r - 26} Q${r} 360 ${r} 386 V${GROUND + 24} Z" fill="url(#ow-blocks)"/>
        <rect x="${l + 80}" y="372" width="338" height="30" rx="6" fill="url(#ow-concrete2)"/>
        <path d="M${l + 30} 420 H${l + 74} M${r - 74} 420 H${r - 30} M${l + 30} 456 H${l + 74} M${r - 74} 456 H${r - 30}" stroke="#4d4a48" stroke-width="3"/>
        <rect x="${l + 18}" y="400" width="52" height="${GROUND + 24 - 400}" fill="#8d8a86"/><rect x="${r - 70}" y="400" width="52" height="${GROUND + 24 - 400}" fill="#8d8a86"/>
        <path d="M${doorL - 22} ${GROUND + 24} V428 Q${doorL - 22} 414 ${doorL - 8} 414 H${doorR + 8} Q${doorR + 22} 414 ${doorR + 22} 428 V${GROUND + 24} Z" fill="#2c2a2e"/>
        <rect x="${doorL - 30}" y="424" width="24" height="${GROUND + 24 - 424}" fill="url(#ow-hazard)"/><rect x="${doorR + 6}" y="424" width="24" height="${GROUND + 24 - 424}" fill="url(#ow-hazard)"/>
        <path d="M${doorL - 30} 424 H${doorL - 6} V${GROUND + 24} M${doorR + 6} 424 H${doorR + 30} V${GROUND + 24}" fill="none"/>
        <g class="ow-door"><rect x="${doorL}" y="430" width="100" height="${GROUND + 24 - 430}" fill="url(#ow-steel)"/><rect x="${doorR - 100}" y="430" width="100" height="${GROUND + 24 - 430}" fill="url(#ow-steel)"/>
          <path d="M${doorL} 452 H${doorL + 100} M${doorL} 480 H${doorL + 100} M${doorR - 100} 452 H${doorR} M${doorR - 100} 480 H${doorR}" stroke="#2d2f36" stroke-width="3"/><circle cx="${doorL + 88}" cy="468" r="6" fill="#d7d9de"/><circle cx="${doorR - 88}" cy="468" r="6" fill="#d7d9de"/></g>
        <rect class="ow-doorlamp" x="${c - 49}" y="398" width="98" height="12" rx="5" fill="url(#ow-lamp)"/>
        <rect x="${l + 82}" y="430" width="30" height="26" rx="3" fill="#ffb13a"/><rect x="${r - 112}" y="430" width="30" height="26" rx="3" fill="#ffb13a"/>
        <path d="M${l + 86} 438 H${l + 108} M${l + 86} 446 H${l + 108} M${r - 108} 438 H${r - 86} M${r - 108} 446 H${r - 86}" stroke="#6b3c10" stroke-width="2.5"/>
      </g>
      <path d="M${l + 30} 360 H${r - 30}" stroke="#ffe3b0" stroke-width="3" opacity=".55" stroke-linecap="round"/><path d="M${l + 84} 374 H${r - 84}" stroke="#fff4d0" stroke-width="2" opacity=".5"/>
      <ellipse class="ow-doorglow" cx="${c}" cy="424" rx="130" ry="40" fill="url(#ow-lampglow)"/><ellipse class="ow-doorglow" cx="${c}" cy="${GROUND + 6}" rx="120" ry="12" fill="#ffd36a" opacity=".22" filter="url(#ow-blur6)"/>
    </g>`;
  }
  function flag() {
    const x = r => BK.r - 20 + r;
    return `<g class="ow-flagwrap"><path d="M${x(0)} 340 V118" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M${x(0)} 340 V118" stroke="#8a8c94" stroke-width="3" stroke-linecap="round"/><circle cx="${x(0)}" cy="114" r="8" fill="#ffd34a" stroke="${INK}" stroke-width="4"/>
      <g class="ow-flag"><path d="M${x(4)} 126 L${x(96)} 142 L${x(90)} 198 L${x(4)} 206 Z" fill="#1f1b24" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <g fill="#f4f2ec" stroke="${INK}" stroke-width="2"><path d="M${x(50)} 146 a12 11 0 1 1 0 22 a12 11 0 1 1 0 -22 Z"/><rect x="${x(43)}" y="164" width="14" height="6" rx="2"/><path d="M${x(34)} 178 L${x(66)} 190 M${x(66)} 178 L${x(34)} 190" stroke="#f4f2ec" stroke-width="5" stroke-linecap="round"/></g>
        <g fill="${INK}"><circle cx="${x(45)}" cy="156" r="3"/><circle cx="${x(55)}" cy="156" r="3"/></g></g></g>`;
  }
  function compoundProps() {
    const crates = [[174, 442, '#3f5a44', 60], [214, 432, '#8a6a3a', 70], [712, 430, '#3f5a44', 80], [770, 440, '#8a6a3a', 70], [850, 428, '#3f5a44', 90]];
    const barrels = [[150, 436, '#3a4e9a', 34], [690, 440, '#2e8a7a', 36], [880, 436, '#3a4e9a', 40], [906, 444, '#2e8a7a', 32]];
    const lamps = [120, 500, 880];
    return `<g class="ow-props">${crates.map(([x, y, c, w]) => `<use href="#ow-crate" x="${x}" y="${y}" width="${w}" height="${w * 64 / 80}" style="color:${c}"/>`).join('')}
      ${barrels.map(([x, y, c, w]) => `<use href="#ow-barrel" x="${x}" y="${y}" width="${w}" height="${w * 70 / 52}" style="color:${c}"/>`).join('')}
      <g class="up up-lights-1">${lamps.map(x => `<use href="#ow-lamppost" x="${x}" y="${GROUND - 160}" width="40" height="160"/><ellipse cx="${x + 27}" cy="${GROUND + 4}" rx="60" ry="10" fill="#fff7c0" opacity=".2" filter="url(#ow-blur6)"/>`).join('')}</g></g>`;
  }

  /* ---------- wasteland (right) ---------- */
  function road() {
    const y = GROUND - 12;
    return `<g class="ow-road">
      <path class="ow-track" d="M${FR - 10} ${y - 8} Q1200 ${y - 22} ${W} ${y - 30} V${y + 26} Q1200 ${y + 26} ${FR - 10} ${y + 24} z" fill="#6d4f3a" opacity=".9"/>
      <path d="M${FR + 20} ${y + 4} Q1200 ${y - 10} ${W} ${y - 18} M${FR + 20} ${y + 14} Q1200 ${y + 2} ${W} ${y - 6}" fill="none" stroke="#4a3328" stroke-width="3" stroke-dasharray="18 10" opacity=".7"/>
      <g class="up up-road-1"><path d="M${FR - 10} ${y - 10} Q1200 ${y - 24} ${W} ${y - 32} V${y + 28} Q1200 ${y + 28} ${FR - 10} ${y + 26} z" fill="#9a8c7a" stroke="${INK}" stroke-width="3"/><path d="M${FR - 10} ${y - 10} Q1200 ${y - 24} ${W} ${y - 32} V${y + 28} Q1200 ${y + 28} ${FR - 10} ${y + 26} z" fill="url(#ow-gravel)"/></g>
      <g class="up up-road-2"><path d="M${FR - 10} ${y - 12} Q1200 ${y - 26} ${W} ${y - 34} V${y + 30} Q1200 ${y + 30} ${FR - 10} ${y + 28} z" fill="url(#ow-asphalt)" stroke="${INK}" stroke-width="3"/><path d="M${FR + 10} ${y + 8} Q1200 ${y - 4} ${W} ${y - 12}" fill="none" stroke="#ffd34a" stroke-width="3" stroke-dasharray="22 16"/>
        ${[1000, 1180, 1360, 1540].map(x => `<use href="#ow-barrier" x="${x}" y="${y - 44}" width="60" height="38"/>`).join('')}
        <g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><rect x="950" y="${y - 70}" width="48" height="58" rx="4" fill="#5a5f6a"/><rect x="958" y="${y - 62}" width="32" height="20" fill="url(#ow-glass)"/><rect x="942" y="${y - 78}" width="64" height="10" rx="3" fill="#2f2d38"/><rect x="998" y="${y - 46}" width="70" height="6" fill="url(#ow-hazard)" stroke="none"/><path d="M998 ${y - 46} h70" stroke="${INK}" stroke-width="2"/></g></g>
    </g>`;
  }
  function wasteland() {
    const rocks = [[1100, 436, 90], [1180, 458, 50], [1560, 418, 120], [1628, 456, 60], [960, 456, 46]];
    return `<g class="ow-wasteland">
      <use class="ow-deadtree" href="#ow-deadtree" x="1240" y="${GROUND - 150}" width="100" height="160"/>
      <use class="ow-deadtree" href="#ow-deadtree" x="1470" y="${GROUND - 120}" width="80" height="128"/>
      <use href="#ow-bus" x="1300" y="${GROUND - 78}" width="220" height="80" transform="rotate(-3 1410 ${GROUND})"/>
      <use href="#ow-car" x="1030" y="${GROUND - 56}" width="130" height="56" style="color:#4b2d46"/>
      <use href="#ow-car" x="1570" y="${GROUND - 50}" width="110" height="48" style="color:#6a5a2a" transform="rotate(6 1620 ${GROUND})"/>
      <use href="#ow-rubble" x="1120" y="${GROUND - 60}" width="160" height="70"/><use href="#ow-rubble" x="1440" y="${GROUND - 50}" width="120" height="52"/>
      ${rocks.map(([x, y, w]) => `<use href="#ow-rock" x="${x}" y="${y}" width="${w}" height="${w * 90 / 140}"/>`).join('')}
      <g stroke="${INK}" stroke-width="3" stroke-linecap="round"><path d="M980 ${GROUND - 70} l-6 -30 l12 -8" fill="none"/><rect x="968" y="${GROUND - 110}" width="34" height="22" rx="3" fill="#8a6a3a" transform="rotate(-8 985 ${GROUND - 100})"/><path d="M1210 ${GROUND - 2} l20 -40 l14 10 l-10 32" fill="#5a4a60"/></g>
      <g class="ow-weeds" stroke="#8f8a3a" stroke-width="3" stroke-linecap="round" fill="none">${[970, 1060, 1230, 1395, 1500, 1640].map(x => `<path d="M${x} ${GROUND + 2} l-5 -18 M${x + 7} ${GROUND + 2} l1 -22 M${x + 14} ${GROUND + 2} l6 -16"/>`).join('')}</g>
      <g class="ow-birds" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"><path class="ow-bird" style="--d:0s" d="M400 150 q8 -8 16 0 q8 -8 16 0"/><path class="ow-bird" style="--d:-7s" d="M460 120 q6 -6 12 0 q6 -6 12 0"/><path class="ow-bird" style="--d:-13s" d="M520 170 q6 -6 12 0 q6 -6 12 0"/></g>
    </g>`;
  }
  function trees() {
    const T = [[1000, 318, 100, 0], [1056, 340, 76, 1], [1584, 296, 112, 2], [1636, 334, 76, 3], [1520, 352, 56, 4]];
    return `<g class="ow-trees">${T.map(([x, y, w, i]) => `<g class="ow-tree" style="--d:${(i * .7).toFixed(1)}s"><use href="#ow-pine" x="${x}" y="${y}" width="${w}" height="${w * 220 / 120}"/></g>`).join('')}</g>`;
  }
  function ground() {
    const blades = []; for (let x = 6; x < W; x += 26) blades.push(`<path d="M${x} ${GROUND + 2} l-5 -13 M${x + 7} ${GROUND + 2} l1 -17 M${x + 14} ${GROUND + 2} l6 -12"/>`);
    return `<g class="ow-ground"><rect x="0" y="${GROUND - 2}" width="${W}" height="36" fill="url(#ow-grass)" stroke="${INK}" stroke-width="5"/>
      <g class="ow-blades" stroke="#a7b84a" stroke-width="3" stroke-linecap="round" fill="none">${blades.join('')}</g>
      <rect x="0" y="${GROUND - 2}" width="${W}" height="36" fill="url(#ow-grasslight)"/>
      <g class="ow-shadows" fill="#1c1020" opacity=".28"><path d="M${BK.l} ${GROUND + 2} H${BK.r} L${BK.r - 90} ${GROUND + 30} H${BK.l - 160} z"/><path d="M${TL + 20} ${GROUND + 2} h110 l-40 26 h-120 z"/><path d="M${TR + 20} ${GROUND + 2} h110 l-40 26 h-120 z"/></g>
      <rect x="0" y="${GROUND + 30}" width="${W}" height="${H - GROUND - 30}" fill="url(#ow-dirt)"/><rect x="0" y="${GROUND + 34}" width="${W}" height="${H - GROUND - 34}" fill="url(#ow-dirtpat)" opacity=".9"/>
      <rect x="0" y="${GROUND + 28}" width="${W}" height="6" fill="${INK}"/><rect x="0" y="${H - 6}" width="${W}" height="6" fill="#2a1a12"/></g>`;
  }
  function dust() {
    return `<g class="ow-dust" fill="#f7d9a0" opacity=".35">${[300, 700, 1100, 1450].map((x, i) => `<circle class="ow-mote" style="--d:${-i * 2.3}s" cx="${x}" cy="${GROUND - 40}" r="2.5"/>`).join('')}</g>`;
  }

  function svg() {
    return `<svg class="ow-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${defs()}${sky()}${clouds()}${farLandmarks()}${skyline()}${hills()}${trees()}${road()}${wasteland()}${fence()}${flag()}${towers()}${compoundProps()}${bunker()}${ground()}${dust()}
    </svg>`;
  }

  /** Percent positions of key points, for the HTML overlays. */
  const LAYOUT = { bunkerL: BK.l / W, bunkerR: BK.r / W, doorL: BK.doorL / W, doorR: BK.doorR / W, center: BK.c / W, fenceR: FR / W };
  return { svg, W, H, GROUND, LAYOUT };
})();
