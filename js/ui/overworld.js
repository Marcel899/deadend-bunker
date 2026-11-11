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
      <linearGradient id="ow-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93b043"/><stop offset=".5" stop-color="#6f8a2e"/><stop offset="1" stop-color="#4c6020"/></linearGradient><linearGradient id="ow-grassblade" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4c6020"/><stop offset=".6" stop-color="#7f9c36"/><stop offset="1" stop-color="#b9cf62"/></linearGradient><linearGradient id="ow-hillfar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a6a62"/><stop offset="1" stop-color="#7e5a4e"/></linearGradient><linearGradient id="ow-hillnear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a7a46"/><stop offset="1" stop-color="#6a5a34"/></linearGradient><linearGradient id="ow-snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c8d6ee"/></linearGradient><linearGradient id="ow-path" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a7a56"/><stop offset="1" stop-color="#6e523a"/></linearGradient>
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
      <linearGradient id="ow-cloudbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9d6" stop-opacity=".92"/><stop offset=".55" stop-color="#f6b3a4" stop-opacity=".78"/><stop offset="1" stop-color="#c8628a" stop-opacity=".55"/></linearGradient>
      <filter id="ow-cloudsoft" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="2.4"/></filter>
      <filter id="ow-sunblur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      <linearGradient id="ow-mtn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9a4a7e"/><stop offset="1" stop-color="#c76a6e"/></linearGradient>
      <linearGradient id="ow-mtn2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a3a6c"/><stop offset="1" stop-color="#a2546a"/></linearGradient>
      <linearGradient id="ow-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa64a"/><stop offset=".6" stop-color="#5d7a34"/><stop offset="1" stop-color="#3e5428"/></linearGradient>
      <linearGradient id="ow-leafdry" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b0a050"/><stop offset="1" stop-color="#6e6a2e"/></linearGradient>
      <linearGradient id="ow-topsoil" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a5236"/><stop offset="1" stop-color="#5a3a26"/></linearGradient>
      <pattern id="ow-mesh" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 0 H14 M0 0 V14" stroke="#8a8e98" stroke-width="2" fill="none"/><path d="M0 1 H14" stroke="#c9ccd4" stroke-width=".8" opacity=".6"/></pattern>
      <pattern id="ow-plate" width="60" height="44" patternUnits="userSpaceOnUse"><rect width="60" height="44" fill="#6a6e78"/><path d="M0 0 H60 V44" fill="none" stroke="#2d2f36" stroke-width="3"/><circle cx="6" cy="6" r="2.2" fill="#b8bcc6"/><circle cx="54" cy="6" r="2.2" fill="#b8bcc6"/><circle cx="6" cy="38" r="2.2" fill="#b8bcc6"/><circle cx="54" cy="38" r="2.2" fill="#b8bcc6"/><path d="M4 3 H56" stroke="#9a9ea8" stroke-width="2"/></pattern>
      <filter id="ow-haze" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>
      ${symbols()}
    </defs>`;
  }
  function symbols() {
    return `<symbol id="ow-cloudsym" viewBox="0 0 300 140" overflow="visible">
        <g filter="url(#ow-cloudsoft)">
          <g fill="url(#ow-cloudbody)"><circle cx="70" cy="80" r="38"/><circle cx="118" cy="58" r="50"/><circle cx="172" cy="62" r="46"/><circle cx="226" cy="80" r="36"/><circle cx="150" cy="90" r="30"/><ellipse cx="150" cy="104" rx="132" ry="20"/></g>
          <g fill="#6a2a66" opacity=".22"><ellipse cx="70" cy="101" rx="36" ry="16"/><ellipse cx="118" cy="86" rx="48" ry="21"/><ellipse cx="172" cy="87" rx="44" ry="19"/><ellipse cx="226" cy="100" rx="34" ry="15"/><ellipse cx="150" cy="106" rx="28" ry="13"/><ellipse cx="150" cy="110" rx="128" ry="12"/></g>
          <g fill="#fff4e2" opacity=".55"><circle cx="78" cy="68" r="21"/><circle cx="129" cy="42" r="28"/><circle cx="182" cy="47" r="25"/><circle cx="234" cy="68" r="20"/><circle cx="157" cy="80" r="16"/></g>
          <g fill="#ffb877" opacity=".35"><ellipse cx="150" cy="106" rx="120" ry="8"/></g>
        </g>
      </symbol>
      <symbol id="ow-cloudsym2" viewBox="0 0 300 140" overflow="visible">
        <g filter="url(#ow-cloudsoft)">
          <g fill="url(#ow-cloudbody)"><circle cx="60" cy="92" r="32"/><circle cx="102" cy="66" r="44"/><circle cx="150" cy="52" r="52"/><circle cx="204" cy="66" r="42"/><circle cx="246" cy="90" r="30"/><ellipse cx="150" cy="110" rx="132" ry="20"/></g>
          <g fill="#6a2a66" opacity=".22"><ellipse cx="60" cy="110" rx="30" ry="13"/><ellipse cx="102" cy="90" rx="42" ry="18"/><ellipse cx="150" cy="81" rx="49" ry="22"/><ellipse cx="204" cy="89" rx="40" ry="18"/><ellipse cx="246" cy="106" rx="28" ry="13"/><ellipse cx="150" cy="116" rx="128" ry="12"/></g>
          <g fill="#fff4e2" opacity=".55"><circle cx="67" cy="82" r="18"/><circle cx="112" cy="52" r="24"/><circle cx="161" cy="35" r="29"/><circle cx="213" cy="53" r="23"/><circle cx="253" cy="80" r="16"/></g>
          <g fill="#ffb877" opacity=".35"><ellipse cx="150" cy="112" rx="120" ry="8"/></g>
        </g>
      </symbol>
      <symbol id="ow-cloudsym3" viewBox="0 0 300 140" overflow="visible">
        <g filter="url(#ow-cloudsoft)">
          <g fill="url(#ow-cloudbody)"><circle cx="90" cy="90" r="24"/><circle cx="130" cy="76" r="32"/><circle cx="176" cy="80" r="28"/><circle cx="214" cy="92" r="20"/><ellipse cx="150" cy="100" rx="132" ry="20"/></g>
          <g fill="#6a2a66" opacity=".22"><ellipse cx="90" cy="103" rx="23" ry="10"/><ellipse cx="130" cy="94" rx="30" ry="13"/><ellipse cx="176" cy="95" rx="27" ry="12"/><ellipse cx="214" cy="103" rx="19" ry="8"/><ellipse cx="150" cy="106" rx="128" ry="12"/></g>
          <g fill="#fff4e2" opacity=".55"><circle cx="95" cy="82" r="13"/><circle cx="137" cy="66" r="18"/><circle cx="182" cy="71" r="15"/><circle cx="218" cy="86" r="11"/></g>
          <g fill="#ffb877" opacity=".35"><ellipse cx="150" cy="102" rx="120" ry="8"/></g>
        </g>
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
      <symbol id="ow-bush" viewBox="0 0 100 56" overflow="visible"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M6 54 q-6 -22 14 -26 q2 -20 24 -18 q12 -14 28 0 q20 -2 20 18 q14 6 6 26 z" fill="url(#ow-leaf)"/></g><g fill="#a9c15e" opacity=".55"><circle cx="34" cy="20" r="7"/><circle cx="58" cy="14" r="6"/><circle cx="78" cy="28" r="5"/></g><g fill="#2f4222" opacity=".35"><path d="M12 52 q30 -10 76 0 z"/></g></symbol>
      <symbol id="ow-oak" viewBox="0 0 160 220" overflow="visible"><g stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="M70 218 q4 -50 -4 -90 l-22 -26 M74 160 l26 -34 M70 128 l4 -30" fill="none" stroke-width="16"/><path d="M70 218 q4 -50 -4 -90 l-22 -26 M74 160 l26 -34 M70 128 l4 -30" fill="none" stroke="#5a3a26" stroke-width="9"/>
        <path d="M20 112 q-24 -30 4 -54 q0 -36 40 -40 q20 -22 52 -4 q34 0 34 34 q22 22 0 50 q-6 30 -44 26 q-20 18 -50 4 q-30 8 -36 -16 z" fill="url(#ow-leaf)"/></g>
        <g fill="#b4cc6a" opacity=".5"><circle cx="64" cy="40" r="14"/><circle cx="104" cy="34" r="11"/><circle cx="40" cy="70" r="10"/><circle cx="124" cy="62" r="9"/></g><g fill="#2f4222" opacity=".3"><path d="M24 110 q50 20 120 -10 q-6 30 -44 26 q-20 18 -50 4 q-30 8 -26 -20 z"/></g></symbol>
      <symbol id="ow-hedgehog" viewBox="0 0 70 60" overflow="visible"><g stroke="${INK}" stroke-width="4" stroke-linecap="round"><path d="M8 58 L62 8 M62 58 L8 8 M35 60 V4" stroke-width="11"/><path d="M8 58 L62 8 M62 58 L8 8 M35 60 V4" stroke="#6a6e78" stroke-width="5"/></g><path d="M12 52 L58 12" stroke="#a8acb6" stroke-width="1.5"/></symbol>
      <symbol id="ow-tyre" viewBox="0 0 40 24" overflow="visible"><ellipse cx="20" cy="14" rx="18" ry="9" fill="#241626" stroke="${INK}" stroke-width="3"/><ellipse cx="20" cy="12" rx="7" ry="3" fill="#4a3a48"/></symbol>
      <symbol id="ow-cone" viewBox="0 0 24 34" overflow="visible"><path d="M12 2 L22 30 H2 Z" fill="#f08a2a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 14 h8 M6 21 h12" stroke="#f6f4ee" stroke-width="3"/><rect x="0" y="29" width="24" height="5" rx="1" fill="#3a2a2a" stroke="${INK}" stroke-width="2"/></symbol>
      <symbol id="ow-barrier" viewBox="0 0 80 50"><path d="M4 48 V20 q0 -8 8 -8 h56 q8 0 8 8 V48 z" fill="#b8b5ae" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M4 30 h72" stroke="#8a8780" stroke-width="3"/><rect x="10" y="34" width="60" height="8" fill="url(#ow-hazard)"/></symbol>`;
  }

  /* ---------- background ---------- */
  function sky() {
    return `<rect class="ow-skyfill" x="0" y="0" width="${W}" height="${GROUND + 10}" fill="url(#ow-sky)"/>
      <ellipse class="ow-horizonhaze" cx="1000" cy="330" rx="900" ry="110" fill="#ffb460" opacity=".35" filter="url(#ow-haze)"/>
      <g class="ow-stars" fill="#fff6d8">${stars()}</g><g class="dc-moon" style="opacity:0"><circle r="34" fill="#eef2ff" stroke="#c9d2f0" stroke-width="3"/><circle cx="-10" cy="-6" r="7" fill="#d4dcf2"/><circle cx="12" cy="10" r="5" fill="#d4dcf2"/><circle cx="6" cy="-14" r="3.5" fill="#d4dcf2"/></g>
      <g class="ow-sunwrap"><circle class="ow-sunglow" cx="1120" cy="265" r="230" fill="url(#ow-sunglow)"/>
      <g class="ow-godrays" opacity=".55">${[0, 25, 55, 95, 130, 160, 200, 235, 275, 300, 330].map(a => `<path d="M1120 265 L${(1120 + Math.cos(a * Math.PI / 180) * 700).toFixed(0)} ${(265 + Math.sin(a * Math.PI / 180) * 700 - 40).toFixed(0)} L${(1120 + Math.cos((a + 9) * Math.PI / 180) * 700).toFixed(0)} ${(265 + Math.sin((a + 9) * Math.PI / 180) * 700 + 40).toFixed(0)} z" fill="url(#ow-ray)"/>`).join('')}</g>
      <circle cx="1120" cy="265" r="96" fill="#ffe08a" opacity=".22" filter="url(#ow-haze)"/><circle class="ow-sun" cx="1120" cy="265" r="66" fill="url(#ow-sun)" filter="url(#ow-sunblur)"/><circle cx="1120" cy="265" r="62" fill="url(#ow-sun)"/><ellipse cx="1102" cy="246" rx="26" ry="18" fill="#fffdf0" opacity=".55"/>
      <g class="ow-flare" opacity=".5">${[[0.2, 14, '#ffd27a'], [0.42, 8, '#ff9a6a'], [0.62, 20, '#ffe8a0'], [0.8, 6, '#ffb3b0']].map(([t, r, c]) => `<circle cx="${(1120 + (520 - 1120) * t).toFixed(0)}" cy="${(265 + (470 - 265) * t).toFixed(0)}" r="${r}" fill="${c}" opacity=".35"/>`).join('')}</g></g>`;
  }
  function stars() {
    let s = ''; let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 46; i++) { const x = (rnd() * W).toFixed(0), y = (rnd() * 150).toFixed(0), r = (0.8 + rnd() * 1.6).toFixed(1); s += `<circle class="ow-star" style="--d:${(-rnd() * 5).toFixed(1)}s" cx="${x}" cy="${y}" r="${r}" opacity="${(0.25 + (1 - y / 150) * 0.55).toFixed(2)}"/>`; }
    return s;
  }
  function clouds() {
    // [x, y, width, drift seconds, delay, shape, opacity] — far clouds are smaller, slower and fainter
    const C = [[60, 40, 300, 210, 0, 0, .9], [460, 96, 220, 260, -40, 2, .7], [760, 20, 360, 230, -90, 1, .85], [1060, 74, 250, 280, -20, 0, .65],
      [1300, 118, 300, 250, -70, 1, .75], [1500, 18, 280, 240, -110, 2, .8], [240, 160, 180, 320, -30, 2, .55], [1180, 168, 200, 340, -120, 0, .5]];
    return C.map(([x, y, w, sp, d, k, o]) => `<g class="ow-cloud" style="--spd:${sp}s;--d:${d}s;opacity:${o}"><use href="#ow-cloudsym${k === 1 ? '2' : k === 2 ? '3' : ''}" x="${x}" y="${y}" width="${w}" height="${w * 140 / 300}"/></g>`).join('');
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
  /* Three mountain ranges with aerial perspective: further = paler, bluer, softer. */
  function mountains() {
    const range = (base, amp, step, seed) => { let r = seed, d = `M0 ${base}`; for (let x = 0; x <= W + step; x += step) { r = (r * 9301 + 49297) % 233280; const k = r / 233280; d += ` L${x} ${(base - amp * (.35 + .65 * k)).toFixed(0)}`; } return d + ` V${GROUND} H0 Z`; };
    return `<g class="ow-mtns"><path d="${range(330, 120, 90, 3)}" fill="#b07a9a" opacity=".55"/><path d="${range(345, 95, 70, 17)}" fill="#9a6488" opacity=".7"/>
      <path d="${range(360, 70, 55, 41)}" fill="#7e5274" opacity=".85"/></g>
      <rect x="0" y="240" width="${W}" height="130" fill="url(#ow-atmo)" opacity=".9"/>`;
  }

  /* Rolling hills: a far band and a nearer grassy band, each with rim light on the crest. */
  function hills() {
    const shrubs = [[40, 372, 50], [300, 376, 40], [610, 370, 56], [900, 378, 38], [1130, 372, 48], [1350, 376, 44], [1590, 370, 52]];
    const far = `M0 368 Q120 338 240 360 T520 354 T800 366 T1080 352 T1360 364 T1664 350`, near = `M0 386 Q200 364 400 384 T820 376 T1240 388 T1664 372`;
    return `<path class="ow-hills" d="${far} V400 H0 Z" fill="url(#ow-hillfar)" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
      <path d="${far}" fill="none" stroke="#e8b48a" stroke-width="2.5" opacity=".45"/>
      <g opacity=".75">${shrubs.map(([x, y, w]) => `<use href="#ow-bush" x="${x}" y="${y - w * .56}" width="${w}" height="${w * .56}" style="filter:saturate(.6) brightness(.8)"/>`).join('')}</g>
      <path class="ow-hills2" d="${near} V${GROUND} H0 Z" fill="url(#ow-hillnear)"/>
      <path d="${near}" fill="none" stroke="${INK}" stroke-width="3"/><path d="${near}" fill="none" stroke="#c9c47a" stroke-width="2" opacity=".5" transform="translate(0 3)"/>
      <path class="season-winter" d="${far} V376 Q800 368 0 380 Z" fill="url(#ow-snow)" opacity=".9"/><path class="season-winter" d="${near} V396 Q800 388 0 398 Z" fill="url(#ow-snow)" opacity=".9"/>`;
  }

  function foliage() {
    const bushes = [[-10, 64], [118, 48], [884, 58], [1210, 46], [1420, 60], [1600, 70]];
    const clumps = [60, 150, 760, 820, 1000, 1080, 1270, 1340, 1530, 1640];
    return `<g class="ow-foliage">
      ${bushes.map(([x, w]) => `<use class="ow-bushfg" href="#ow-bush" x="${x}" y="${GROUND - w * .56 + 6}" width="${w}" height="${w * .56}"/>`).join('')}
      <g stroke="${INK}" stroke-width="2.5" stroke-linecap="round" fill="none">${clumps.map(x => `<path d="M${x} ${GROUND + 4} q-3 -12 -9 -18 M${x + 4} ${GROUND + 4} q1 -16 -2 -24 M${x + 8} ${GROUND + 4} q3 -12 10 -16"/>`).join('')}</g>
      <g stroke="#b3c25a" stroke-width="1.3" stroke-linecap="round" fill="none">${clumps.map(x => `<path d="M${x} ${GROUND + 4} q-3 -12 -9 -18 M${x + 4} ${GROUND + 4} q1 -16 -2 -24 M${x + 8} ${GROUND + 4} q3 -12 10 -16"/>`).join('')}</g>
      <g fill="#ffd34a">${[156, 834, 1088, 1352].map(x => `<circle cx="${x}" cy="${GROUND - 14}" r="3" stroke="${INK}" stroke-width="1.5"/>`).join('')}</g>
    </g>`;
  }

  /* ---------- compound (left) ---------- */
  /* Perimeter fence by level: 0 scavenged planks (gappy, leaning) · 1 steel posts + iron mesh ·
   * 2 mesh + jersey barriers + razor wire · 3 poured fortress wall with firing slits. */
  function fence() {
    const posts = []; for (let x = FL + 12; x <= FR - 8; x += 112) posts.push(x);
    let planks = '';
    for (let x = FL; x < FR; x += 19) {
      const i = (x / 19) | 0; if (i % 11 === 5) continue;
      const h = 64 + ((i * 37) % 22), lean = i % 13 === 7 ? 9 : ((i * 7) % 5) - 2;
      planks += `<path d="M${x} ${GROUND} l${lean} ${-h} l14 ${(i % 3) - 3} l${-lean + 1} ${h + 3 - (i % 3)} z" fill="${i % 4 ? '#8d5b36' : '#7a4c2c'}"/>`;
    }
    const plank0 = `<g class="lv eq-fence-0"><g stroke="${INK}" stroke-width="3" stroke-linejoin="round">${planks}</g>
      <g stroke="${INK}" stroke-width="3">${posts.map(x => `<rect x="${x - 6}" y="${GROUND - 92}" width="12" height="92" fill="#5a3a26"/>`).join('')}<rect x="${FL}" y="${GROUND - 70}" width="${FR - FL}" height="8" fill="#6b4228"/><rect x="${FL}" y="${GROUND - 34}" width="${FR - FL}" height="8" fill="#6b4228"/></g>
      <g fill="#c9ccd4">${posts.map(x => `<circle cx="${x}" cy="${GROUND - 66}" r="2"/><circle cx="${x}" cy="${GROUND - 30}" r="2"/>`).join('')}</g>
      <path d="M${FL + 214} ${GROUND} l46 -10 l2 8 l-46 10 z" fill="#7a4c2c" stroke="${INK}" stroke-width="3"/></g>`;
    const mesh = `<g class="lv rng-fence-1-2">
      <rect x="${FL - 4}" y="386" width="${FR - FL + 8}" height="${GROUND - 386}" fill="url(#ow-mesh)" opacity=".9"/><rect x="${FL - 4}" y="386" width="${FR - FL + 8}" height="${GROUND - 386}" fill="#2a1d2e" opacity=".12"/>
      <path d="M${FL - 4} 388 H${FR + 4} M${FL - 4} ${GROUND - 6} H${FR + 4}" stroke="${INK}" stroke-width="7" fill="none"/><path d="M${FL - 4} 388 H${FR + 4}" stroke="#8a8e98" stroke-width="3"/>
      ${posts.map(x => `<use href="#ow-steelpost" x="${x - 12}" y="${GROUND - 112}" width="24" height="112"/>`).join('')}</g>`;
    const barriers = []; for (let x = FL + 10; x < FR - 70; x += 82) barriers.push(`<use href="#ow-barrier" x="${x}" y="${GROUND - 48}" width="80" height="50"/>`);
    const coils = []; for (let x = FL + 6; x < FR; x += 14) coils.push(`<circle cx="${x}" cy="376" r="7"/>`);
    const razor = `<g class="lv eq-fence-2">${barriers.join('')}<g fill="none" stroke="${INK}" stroke-width="3">${coils.join('')}</g><g fill="none" stroke="#c9ccd4" stroke-width="1.2">${coils.join('')}</g></g>`;
    const panels = []; for (let x = FL; x < FR; x += 76) panels.push(`<rect x="${x}" y="372" width="76" height="${GROUND - 372}" fill="url(#ow-concrete)"/><rect x="${x + 28}" y="392" width="20" height="8" rx="2" fill="#1c1020"/>`);
    const fort = `<g class="lv eq-fence-3"><g stroke="${INK}" stroke-width="4" stroke-linejoin="round">${panels.join('')}</g><rect x="${FL}" y="${GROUND - 26}" width="${FR - FL}" height="10" fill="url(#ow-hazard)" opacity=".85"/>
      <rect x="${FL - 4}" y="364" width="${FR - FL + 8}" height="12" rx="3" fill="#b8b5ae" stroke="${INK}" stroke-width="4"/>
      <g fill="none" stroke="${INK}" stroke-width="3">${coils.map(c => c.replace('cy="376"', 'cy="356"')).join('')}</g><g fill="none" stroke="#c9ccd4" stroke-width="1.2">${coils.map(c => c.replace('cy="376"', 'cy="356"')).join('')}</g></g>`;
    return `<g class="ow-fence">${plank0}${mesh}${razor}${fort}</g>`;
  }
  /* Sandbag nests (barricades 1) and steel hedgehogs + timber barricades in the approach (2). */
  function barricades() {
    const nest = (x, n, rows) => { let s = ''; for (let r = 0; r < rows; r++) for (let i = 0; i < n - r; i++) s += `<ellipse cx="${x + i * 34 + r * 17}" cy="${GROUND - 8 - r * 15}" rx="19" ry="10"/>`; return s; };
    return `<g class="lv ge-barricades-1"><g fill="url(#ow-sand)" stroke="${INK}" stroke-width="3.5">${nest(96, 3, 2)}${nest(742, 4, 3)}${nest(30, 2, 1)}</g>
        <g stroke="#7a5a32" stroke-width="2" opacity=".6">${[96, 130, 776, 810, 844].map(x => `<path d="M${x - 8} ${GROUND - 8} h16"/>`).join('')}</g></g>
      <g class="lv ge-barricades-2">${[972, 1046, 1122].map((x, i) => `<use href="#ow-hedgehog" x="${x}" y="${GROUND - 52 + i * 2}" width="58" height="50"/>`).join('')}
        <g stroke="${INK}" stroke-width="4" stroke-linejoin="round"><path d="M936 ${GROUND} L980 ${GROUND - 64} M984 ${GROUND} L940 ${GROUND - 64}" stroke-width="12"/><path d="M936 ${GROUND} L980 ${GROUND - 64} M984 ${GROUND} L940 ${GROUND - 64}" stroke="#8d5b36" stroke-width="6"/><rect x="928" y="${GROUND - 46}" width="64" height="10" rx="2" fill="#7a4c2c"/></g></g>`;
  }
  function towers() {
    const beam = (x, flip) => `<g class="ow-searchlight" style="transform-origin:${x + 75}px 240px"><path d="M${x + 75} 240 L${x + 75 + (flip ? -1 : 1) * 520} 60 L${x + 75 + (flip ? -1 : 1) * 620} 240 z" fill="url(#ow-beam)" opacity=".5"/></g>`;
    return `<g class="lv ge-lights-2" stroke="${INK}" stroke-width="4"><rect x="${TL + 70}" y="150" width="10" height="${GROUND - 150}" fill="url(#ow-steel)"/><rect x="${TR + 70}" y="150" width="10" height="${GROUND - 150}" fill="url(#ow-steel)"/></g>
      <g class="lv ge-towers-1"><use class="ow-tower ow-tower-l" href="#ow-tower" x="${TL}" y="184" width="150" height="310"/>
      <use class="ow-tower ow-tower-r" href="#ow-tower" x="${TR}" y="184" width="150" height="310"/>
      <g fill="url(#ow-sand)" stroke="${INK}" stroke-width="4">${[TL + 20, TL + 56, TL + 92, TL + 128, TR + 20, TR + 56, TR + 92, TR + 128].map(x => `<ellipse cx="${x}" cy="${GROUND - 2}" rx="20" ry="10"/>`).join('')}</g></g>
      <g class="lv ge-towers-2">${beam(TL, false)}${beam(TR, true)}<circle cx="${TL + 75}" cy="240" r="9" fill="#fff7c0" stroke="${INK}" stroke-width="3"/><circle cx="${TR + 75}" cy="240" r="9" fill="#fff7c0" stroke="${INK}" stroke-width="3"/></g>
      <g class="lv ge-lights-2"><g stroke="${INK}" stroke-width="4"><rect x="${TL + 68}" y="150" width="14" height="40" fill="#3a3f4a"/><rect x="${TL + 50}" y="140" width="50" height="14" rx="3" fill="#2f2d38"/><rect class="ow-lampbulb" x="${TL + 54}" y="152" width="42" height="4" fill="#fff7c0" stroke="none"/><rect x="${TR + 68}" y="150" width="14" height="40" fill="#3a3f4a"/><rect x="${TR + 50}" y="140" width="50" height="14" rx="3" fill="#2f2d38"/><rect class="ow-lampbulb" x="${TR + 54}" y="152" width="42" height="4" fill="#fff7c0" stroke="none"/></g>
        <path class="ow-floodcone" d="M${TL + 54} 156 L${TL - 60} ${GROUND} H${TL + 260} L${TL + 96} 156 z" fill="#fff7c0" opacity=".14"/><path class="ow-floodcone" d="M${TR + 54} 156 L${TR - 160} ${GROUND} H${TR + 200} L${TR + 96} 156 z" fill="#fff7c0" opacity=".14"/></g>`;
  }
  function bunker() {
    const { l, r, c, doorL, doorR } = BK;
    return `<g class="ow-bunker">
      <ellipse cx="${c}" cy="${GROUND + 8}" rx="280" ry="14" fill="#2a1a12" opacity=".45"/>
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
      ${wallTiers()}
      <path d="M${l + 30} 360 H${r - 30}" stroke="#ffe3b0" stroke-width="3" opacity=".55" stroke-linecap="round"/><path d="M${l + 84} 374 H${r - 84}" stroke="#fff4d0" stroke-width="2" opacity=".5"/>
      <ellipse class="ow-doorglow" cx="${c}" cy="424" rx="130" ry="40" fill="url(#ow-lampglow)"/><ellipse class="ow-doorglow" cx="${c}" cy="${GROUND + 6}" rx="120" ry="12" fill="#ffd36a" opacity=".22" filter="url(#ow-blur6)"/>
    </g>`;
  }
  /* The bunker shell changes with the wall level: cracked and patched at the start (tier 0),
   * bolted steel plates (tier 1), full armour with buttresses and a parapet (tier 2). */
  function wallTiers() {
    const { l, r, doorL, doorR } = BK;
    const crack = (x, y) => `<path d="M${x} ${y} l8 12 l-6 10 l10 14 l-4 12" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `<g class="lv eq-walltier-0">${crack(l + 40, 372)}${crack(r - 60, 380)}${crack(l + 150, 410)}${crack(r - 170, 404)}
        <g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="${l + 96}" y="414" width="58" height="40" fill="#a07a4a" transform="rotate(-4 ${l + 125} 434)"/><rect x="${r - 150}" y="420" width="46" height="34" fill="#8d6a40" transform="rotate(5 ${r - 127} 437)"/></g>
        <path d="M${l + 104} 424 h40 M${l + 104} 440 h40 M${r - 144} 430 h34" stroke="#6b4c2a" stroke-width="2"/><g fill="#3a2a22">${[[l + 100, 418], [l + 146, 416], [r - 146, 424], [r - 110, 426]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4"/>`).join('')}</g>
        <path d="M${l + 60} ${GROUND + 24} l10 -26 M${l + 66} ${GROUND + 24} l12 -20 M${r - 64} ${GROUND + 24} l-8 -24" stroke="#5a4a40" stroke-width="3" stroke-linecap="round"/></g>
      <g class="lv eq-walltier-1" stroke="${INK}" stroke-width="4"><rect x="${l + 6}" y="404" width="${doorL - 30 - l - 10}" height="${GROUND + 20 - 404}" fill="url(#ow-plate)"/><rect x="${doorR + 34}" y="404" width="${r - doorR - 40}" height="${GROUND + 20 - 404}" fill="url(#ow-plate)"/></g>
      <g class="lv ge-walltier-2" stroke="${INK}" stroke-width="4" stroke-linejoin="round"><rect x="${l - 6}" y="380" width="${doorL - 24 - l + 6}" height="${GROUND + 24 - 380}" fill="url(#ow-plate)"/><rect x="${doorR + 30}" y="380" width="${r + 6 - doorR - 30}" height="${GROUND + 24 - 380}" fill="url(#ow-plate)"/>
        <path d="M${l - 22} ${GROUND + 24} L${l - 6} 392 H${l + 8} V${GROUND + 24} Z M${r + 22} ${GROUND + 24} L${r + 6} 392 H${r - 8} V${GROUND + 24} Z" fill="url(#ow-concrete)"/>
        <rect x="${l + 10}" y="346" width="${r - l - 20}" height="16" rx="3" fill="url(#ow-concrete2)"/><g fill="#1c1020">${[0.2, 0.4, 0.6, 0.8].map(f => `<rect x="${l + (r - l) * f - 10}" y="350" width="20" height="6" rx="2" stroke="none"/>`).join('')}</g></g>
      <g class="lv ge-missile-1" stroke="${INK}" stroke-width="4"><rect x="${BK.c - 70}" y="346" width="140" height="14" rx="4" fill="#5a5f6a"/><rect x="${BK.c - 64}" y="350" width="128" height="6" fill="url(#ow-hazard)" stroke="none"/></g>`;
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
      <g class="lv ge-lights-1">${lamps.map(x => `<use href="#ow-lamppost" x="${x}" y="${GROUND - 160}" width="40" height="160"/><ellipse cx="${x + 27}" cy="${GROUND + 4}" rx="60" ry="10" fill="#fff7c0" opacity=".2" filter="url(#ow-blur6)"/>`).join('')}</g></g>`;
  }

  /* ---------- wasteland (right) ---------- */
  function road() {
    const y = GROUND - 12;
    return `<g class="ow-road">
      <path class="ow-track" d="M${FR - 10} ${y - 8} Q1200 ${y - 22} ${W} ${y - 30} V${y + 26} Q1200 ${y + 26} ${FR - 10} ${y + 24} z" fill="#6d4f3a" opacity=".9"/>
      <path d="M${FR + 20} ${y + 4} Q1200 ${y - 10} ${W} ${y - 18} M${FR + 20} ${y + 14} Q1200 ${y + 2} ${W} ${y - 6}" fill="none" stroke="#4a3328" stroke-width="3" stroke-dasharray="18 10" opacity=".7"/>
      <g class="lv eq-road-1"><path d="M${FR - 10} ${y - 10} Q1200 ${y - 24} ${W} ${y - 32} V${y + 28} Q1200 ${y + 28} ${FR - 10} ${y + 26} z" fill="#9a8c7a" stroke="${INK}" stroke-width="3"/><path d="M${FR - 10} ${y - 10} Q1200 ${y - 24} ${W} ${y - 32} V${y + 28} Q1200 ${y + 28} ${FR - 10} ${y + 26} z" fill="url(#ow-gravel)"/></g>
      <g class="lv ge-road-2"><path d="M${FR - 10} ${y - 12} Q1200 ${y - 26} ${W} ${y - 34} V${y + 30} Q1200 ${y + 30} ${FR - 10} ${y + 28} z" fill="url(#ow-asphalt)" stroke="${INK}" stroke-width="3"/><path d="M${FR + 10} ${y + 8} Q1200 ${y - 4} ${W} ${y - 12}" fill="none" stroke="#ffd34a" stroke-width="3" stroke-dasharray="22 16"/>
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
      <use href="#ow-tyre" x="1196" y="${GROUND - 20}" width="40" height="24"/><use href="#ow-tyre" x="1212" y="${GROUND - 34}" width="36" height="22"/>
      <use href="#ow-cone" x="1010" y="${GROUND - 32}" width="22" height="32"/><use href="#ow-cone" x="1282" y="${GROUND - 28}" width="20" height="28" transform="rotate(70 1292 ${GROUND - 10})"/>
      <use href="#ow-oak" x="1600" y="${GROUND - 210}" width="140" height="192"/>
      <g class="ow-weeds" stroke="#8f8a3a" stroke-width="3" stroke-linecap="round" fill="none">${[970, 1060, 1230, 1395, 1500, 1640].map(x => `<path d="M${x} ${GROUND + 2} l-5 -18 M${x + 7} ${GROUND + 2} l1 -22 M${x + 14} ${GROUND + 2} l6 -16"/>`).join('')}</g>
      <g class="ow-birds" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"><path class="ow-bird" style="--d:0s" d="M400 150 q8 -8 16 0 q8 -8 16 0"/><path class="ow-bird" style="--d:-7s" d="M460 120 q6 -6 12 0 q6 -6 12 0"/><path class="ow-bird" style="--d:-13s" d="M520 170 q6 -6 12 0 q6 -6 12 0"/></g>
    </g>`;
  }
  function trees() {
    const T = [[1000, 318, 100, 0], [1056, 340, 76, 1], [1584, 296, 112, 2], [1636, 334, 76, 3], [1520, 352, 56, 4]];
    return `<g class="ow-trees">${T.map(([x, y, w, i]) => `<g class="ow-tree" style="--d:${(i * .7).toFixed(1)}s"><use href="#ow-pine" x="${x}" y="${y}" width="${w}" height="${w * 220 / 120}"/></g>`).join('')}</g>`;
  }
  /* Ground: a slightly undulating turf band with a dense, static hand-drawn grass fringe (no
   * whole-strip skewing), a worn dirt path from the bunker door to the road, pebbles, a cut
   * earth edge and topsoil below. Units stand on GROUND. */
  function ground() {
    let seed = 5; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    let top = `M0 ${GROUND}`; for (let x = 0; x <= W; x += 40) top += ` Q${x + 20} ${(GROUND - 3 + rnd() * 6).toFixed(1)} ${x + 40} ${GROUND}`;
    // fringe of individual blades in three tones, drawn once
    let dark = '', mid = '', lite = '';
    for (let x = 0; x < W; x += 5) {
      const h = 7 + rnd() * 13, lean = (rnd() - .5) * 8, b = `M${x} ${GROUND + 3} q${(lean * .3).toFixed(1)} ${(-h * .6).toFixed(1)} ${lean.toFixed(1)} ${(-h).toFixed(1)}`;
      const k = rnd(); if (k < .3) dark += b; else if (k < .8) mid += b; else lite += b;
    }
    let lip = `M0 ${GROUND + 20}`; for (let x = 0; x <= W; x += 32) lip += ` q8 ${10 + (x % 3) * 3} 16 0 q8 ${8 + (x % 5) * 2} 16 0`;
    const pebbles = Array.from({ length: 26 }, () => { const x = rnd() * W, y = GROUND + 6 + rnd() * 12, r = 1.6 + rnd() * 2.6; return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${r.toFixed(1)}" ry="${(r * .7).toFixed(1)}"/>`; }).join('');
    const door = BK.c, road = FR + 30;
    return `<g class="ow-ground">
      <path d="${top} V${GROUND + 28} H0 Z" fill="url(#ow-grass)" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M${door - 70} ${GROUND + 1} Q${door} ${GROUND - 3} ${door + 90} ${GROUND + 4} T${road} ${GROUND + 2} L${road + 40} ${GROUND + 12} Q${door + 60} ${GROUND + 20} ${door - 90} ${GROUND + 14} Z" fill="url(#ow-path)" opacity=".9"/>
      <g fill="#5a4630" opacity=".55">${pebbles}</g>
      <g class="ow-shadows" fill="#1c1020" opacity=".3"><path d="M${BK.l} ${GROUND + 2} H${BK.r} L${BK.r - 60} ${GROUND + 18} H${BK.l - 120} z"/></g>
      <g class="ow-blades" fill="none" stroke-linecap="round"><path d="${dark}" stroke="#3f521c" stroke-width="2.4"/><path d="${mid}" stroke="#6f8c2c" stroke-width="2.2"/><path d="${lite}" stroke="#b5cc5c" stroke-width="1.8"/></g>
      <path class="season-winter" d="${top} V${GROUND + 10} H0 Z" fill="url(#ow-snow)" stroke="#9aaccc" stroke-width="2"/>
      <rect x="0" y="${GROUND + 24}" width="${W}" height="${H - GROUND - 24}" fill="url(#ow-topsoil)"/><rect x="0" y="${GROUND + 30}" width="${W}" height="${H - GROUND - 30}" fill="url(#ow-dirtpat)" opacity=".5"/>
      <path d="${lip} V${GROUND + 18} H0 Z" fill="#4c6020" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path class="season-winter" d="${lip} V${GROUND + 18} H0 Z" fill="#e8eef8" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <g fill="#2a1a12" opacity=".5">${[120, 410, 690, 980, 1260, 1530].map((x, i) => `<path d="M${x} ${GROUND + 46 + (i % 2) * 18} l14 -6 l10 8 l-4 10 l-16 2 z"/>`).join('')}</g></g>`;
  }

  /* Season dressing: snow on the bunker roof and towers, leaf litter in autumn, flowers in spring. */
  function seasonal() {
    const { l, r } = BK;
    let seed = 9; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const leaves = Array.from({ length: 60 }, () => { const x = rnd() * W, y = GROUND + 2 + rnd() * 10; return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="3.4" ry="1.8" transform="rotate(${(rnd() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})" fill="${['#d0702a', '#e0a030', '#a8401e', '#c88a2a'][(rnd() * 4) | 0]}"/>`; }).join('');
    const flowers = Array.from({ length: 40 }, () => { const x = rnd() * W, y = GROUND - 2 - rnd() * 8; return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.6" fill="${['#ffd34a', '#ff8ab0', '#ffffff', '#b08aff'][(rnd() * 4) | 0]}" stroke="${INK}" stroke-width="1"/>`; }).join('');
    return `<g class="season-winter"><path d="M${l + 4} 368 Q${l + 8} 352 ${l + 30} 350 H${r - 30} Q${r - 8} 352 ${r - 4} 368 Q${(l + r) / 2} 360 ${l + 4} 368 Z" fill="url(#ow-snow)" stroke="${INK}" stroke-width="3"/>
        <g class="lv ge-towers-1">${[TL, TR].map(x => `<path d="M${x + 12} 200 h126 q-6 -12 -63 -14 q-57 2 -63 14 z" fill="url(#ow-snow)" stroke="${INK}" stroke-width="3"/>`).join('')}</g></g>
      <g class="season-autumn">${leaves}</g><g class="season-spring">${flowers}</g>`;
  }
  function dust() {
    return `<g class="ow-dust" fill="#f7d9a0" opacity=".35">${[300, 700, 1100, 1450].map((x, i) => `<circle class="ow-mote" style="--d:${-i * 2.3}s" cx="${x}" cy="${GROUND - 40}" r="2.5"/>`).join('')}</g>`;
  }

  function svg() {
    return `<svg class="ow-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${defs()}${sky()}${mountains()}${clouds()}${farLandmarks()}${skyline()}${hills()}${trees()}${road()}${wasteland()}${fence()}${flag()}${towers()}${compoundProps()}${bunker()}${barricades()}${ground()}${foliage()}${seasonal()}${dust()}
    </svg>`;
  }

  /** Percent positions of key points, for the HTML overlays. */
  const LAYOUT = { roofY: 358, fenceX: FR, bunkerC: BK.c, doorX: BK.c, towerL: TL + 75, towerR: TR + 75,
    bunkerL: BK.l / W, bunkerR: BK.r / W, doorL: BK.doorL / W, doorR: BK.doorR / W, center: BK.c / W, fenceR: FR / W };
  return { svg, W, H, GROUND, LAYOUT };
})();
