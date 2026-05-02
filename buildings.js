// Building catalog. Each building has:
// - kind: id
// - label: display name (default; user can rename)
// - required: must be placed per assignment rubric
// - rubricHint: short description of WHERE it should go
// - color: crayon fill color
// - draw(g, sel): draws SVG markup at origin, oriented top-down
// - size: bounding box (w, h)
//
// Icons are intentionally rough/sketchy — strokes wobble, fills imperfect.

window.Buildings = (function() {

  // Common sketchy stroke filter (defined once in defs by App)
  const STROKE = '#2a2418';
  const SW = 2.2;

  // Each draw fn returns SVG string (positioned around 0,0).
  // We'll render via dangerouslySetInnerHTML inside a <g transform>.

  function lib() {
    return `
      <rect x="-26" y="-18" width="52" height="34" fill="#bfdbfe" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-26" y="-18" width="52" height="8" fill="#3b6fb5" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-18" y="-4" width="14" height="18" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.5"/>
      <rect x="4" y="-4" width="14" height="18" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.5"/>
      <text x="0" y="-12" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#fff">📚 LIB</text>
    `;
  }
  function park() {
    return `
      <ellipse cx="0" cy="0" rx="28" ry="20" fill="#cbe6a8" stroke="${STROKE}" stroke-width="${SW}"/>
      <circle cx="-14" cy="-6" r="6" fill="#4f8b4a" stroke="${STROKE}" stroke-width="1.5"/>
      <circle cx="10" cy="4" r="7" fill="#4f8b4a" stroke="${STROKE}" stroke-width="1.5"/>
      <circle cx="14" cy="-10" r="4" fill="#a3c674" stroke="${STROKE}" stroke-width="1.5"/>
      <path d="M -8 8 q 4 -3 8 0" stroke="${STROKE}" stroke-width="1" fill="none"/>
    `;
  }
  function school() {
    return `
      <rect x="-28" y="-16" width="56" height="32" fill="#f7d28a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <polygon points="-28,-16 0,-26 28,-16" fill="#d97e5a" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-6" y="0" width="12" height="16" fill="#7a5230" stroke="${STROKE}" stroke-width="1.5"/>
      <rect x="-22" y="-8" width="8" height="8" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="14" y="-8" width="8" height="8" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <text x="0" y="-18" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="${STROKE}">ABC</text>
    `;
  }
  function grocery() {
    return `
      <rect x="-26" y="-16" width="52" height="32" fill="#f4d35e" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-26" y="-16" width="52" height="8" fill="#e07a3c" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-22" y="-4" width="44" height="16" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.5"/>
      <text x="0" y="6" text-anchor="middle" font-size="9" font-family="Patrick Hand" fill="${STROKE}">🥕🍎</text>
      <text x="0" y="-10" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">FOOD</text>
    `;
  }
  function masjid() {
    // Mosque with dome and minaret
    return `
      <rect x="-24" y="-10" width="48" height="26" fill="#e6c98a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <path d="M -16 -10 Q 0 -30 16 -10 Z" fill="#8aa860" stroke="${STROKE}" stroke-width="${SW}"/>
      <line x1="0" y1="-30" x2="0" y2="-36" stroke="${STROKE}" stroke-width="1.5"/>
      <path d="M 0 -36 q 3 -1 0 -3 q -3 1 0 3" fill="${STROKE}"/>
      <rect x="20" y="-22" width="6" height="38" fill="#e6c98a" stroke="${STROKE}" stroke-width="${SW}"/>
      <path d="M 20 -22 q 3 -2 6 0" stroke="${STROKE}" stroke-width="1.5" fill="none"/>
      <rect x="-4" y="2" width="8" height="14" fill="#7a5230" stroke="${STROKE}" stroke-width="1.5"/>
      <path d="M -14 0 a 4 4 0 0 1 8 0 v 8 h -8 z" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <path d="M 6 0 a 4 4 0 0 1 8 0 v 8 h -8 z" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
    `;
  }
  function police() {
    return `
      <rect x="-22" y="-16" width="44" height="32" fill="#9aa8c8" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-16" width="44" height="8" fill="#3b6fb5" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-9" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#fff">POLICE</text>
      <polygon points="0,-2 4,4 -2,4 4,8 -4,12 -8,4 -4,4 0,-2 4,-2 -4,-2"
               fill="#e7b94a" stroke="${STROKE}" stroke-width="1.2" transform="translate(0,2) scale(0.8)"/>
      <circle cx="0" cy="6" r="6" fill="#e7b94a" stroke="${STROKE}" stroke-width="1.2"/>
      <text x="0" y="9" text-anchor="middle" font-size="9" font-family="Patrick Hand" fill="${STROKE}">★</text>
    `;
  }
  function fire() {
    return `
      <rect x="-26" y="-16" width="52" height="32" fill="#d94c3a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-26" y="-16" width="52" height="8" fill="#7a1d10" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-9" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">FIRE DEPT</text>
      <rect x="-20" y="-4" width="14" height="20" fill="#3a3225" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-2" y="-4" width="20" height="20" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <text x="8" y="10" text-anchor="middle" font-size="11" font-family="Patrick Hand" fill="${STROKE}">🚒</text>
    `;
  }
  function movie() {
    return `
      <rect x="-26" y="-16" width="52" height="32" fill="#8a5fb0" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-26" y="-16" width="52" height="9" fill="#3a2050" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-9" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#fff">CINEMA</text>
      <text x="0" y="8" text-anchor="middle" font-size="14" font-family="Patrick Hand" fill="#fff">🎬</text>
      <circle cx="-18" cy="14" r="2" fill="#fff8e0"/>
      <circle cx="-12" cy="14" r="2" fill="#fff8e0"/>
      <circle cx="12" cy="14" r="2" fill="#fff8e0"/>
      <circle cx="18" cy="14" r="2" fill="#fff8e0"/>
    `;
  }
  function restaurant() {
    return `
      <rect x="-24" y="-16" width="48" height="32" fill="#f0a978" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-24" y="-16" width="48" height="8" fill="#a0492a" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-9" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#fff">DINER</text>
      <text x="0" y="8" text-anchor="middle" font-size="14">🍽️</text>
    `;
  }
  function gas() {
    return `
      <rect x="-22" y="-14" width="44" height="28" fill="#d94c3a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-18" y="-2" width="36" height="8" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.5"/>
      <text x="0" y="-5" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#fff">GAS</text>
      <text x="0" y="4" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="${STROKE}">$3.49</text>
      <rect x="20" y="-8" width="6" height="14" fill="#3a3225" stroke="${STROKE}" stroke-width="1.2"/>
    `;
  }
  function bank() {
    return `
      <rect x="-26" y="-12" width="52" height="28" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <polygon points="-28,-12 0,-22 28,-12" fill="#a89060" stroke="${STROKE}" stroke-width="${SW}"/>
      <line x1="-18" y1="-12" x2="-18" y2="14" stroke="${STROKE}" stroke-width="1.5"/>
      <line x1="-6" y1="-12" x2="-6" y2="14" stroke="${STROKE}" stroke-width="1.5"/>
      <line x1="6" y1="-12" x2="6" y2="14" stroke="${STROKE}" stroke-width="1.5"/>
      <line x1="18" y1="-12" x2="18" y2="14" stroke="${STROKE}" stroke-width="1.5"/>
      <text x="0" y="-14" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="${STROKE}">$ BANK</text>
    `;
  }
  function mall() {
    return `
      <rect x="-32" y="-14" width="64" height="30" fill="#f0c0d0" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-32" y="-14" width="64" height="8" fill="#b85580" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-7" text-anchor="middle" font-size="8" font-family="Patrick Hand" fill="#fff">MALL</text>
      <rect x="-26" y="-2" width="10" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-12" y="-2" width="10" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="2" y="-2" width="10" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="16" y="-2" width="10" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
    `;
  }
  function icecream() {
    return `
      <rect x="-22" y="-14" width="44" height="28" fill="#f8d4e0" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-14" width="44" height="8" fill="#d97ba0" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-7" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">ICE CREAM</text>
      <text x="0" y="9" text-anchor="middle" font-size="14">🍦</text>
    `;
  }
  function arcade() {
    return `
      <rect x="-22" y="-16" width="44" height="32" fill="#3b6fb5" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-16" width="44" height="8" fill="#1c3a70" stroke="${STROKE}" stroke-width="${SW}"/>
      <text x="0" y="-9" text-anchor="middle" font-size="7" font-family="Patrick Hand" fill="#e7b94a">ARCADE</text>
      <text x="0" y="8" text-anchor="middle" font-size="13">🎮</text>
    `;
  }
  function pool() {
    return `
      <ellipse cx="0" cy="0" rx="32" ry="18" fill="#7ec0d8" stroke="${STROKE}" stroke-width="${SW}"/>
      <ellipse cx="0" cy="0" rx="28" ry="14" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1.2" stroke-dasharray="3 2"/>
      <path d="M -18 -2 q 4 -4 8 0 q 4 4 8 0 q 4 -4 8 0" stroke="${STROKE}" stroke-width="1.5" fill="none"/>
      <path d="M -16 6 q 4 -4 8 0 q 4 4 8 0" stroke="${STROKE}" stroke-width="1.5" fill="none"/>
      <text x="0" y="-22" text-anchor="middle" font-size="8" font-family="Patrick Hand" fill="${STROKE}">🏊 POOL</text>
    `;
  }

  // Homes — small variations
  function home(variant = 0) {
    const colors = ['#d4a574', '#bfa087', '#d8b8a0', '#a89880', '#e0c4a4'];
    const roofs = ['#7a4530', '#8a5230', '#5a3520', '#9a6240'];
    const fc = colors[variant % colors.length];
    const rc = roofs[variant % roofs.length];
    return `
      <rect x="-14" y="-6" width="28" height="20" fill="${fc}" stroke="${STROKE}" stroke-width="${SW}" rx="1"/>
      <polygon points="-16,-6 0,-18 16,-6" fill="${rc}" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-3" y="2" width="6" height="12" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-11" y="-2" width="5" height="5" fill="#fff8e0" stroke="${STROKE}" stroke-width="1"/>
      <rect x="6" y="-2" width="5" height="5" fill="#fff8e0" stroke="${STROKE}" stroke-width="1"/>
    `;
  }

  // Decorations
  function tree(variant = 0) {
    const v = variant % 4;
    if (v === 1) {
      // Triangular pine
      return `
        <polygon points="0,-14 -8,-2 -2,-2 -8,4 -2,4 -2,8 2,8 2,4 8,4 2,-2 8,-2"
          fill="#3a6b3f" stroke="${STROKE}" stroke-width="${SW}"/>
        <rect x="-1.5" y="8" width="3" height="5" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      `;
    }
    if (v === 2) {
      // Bushy multi-puff
      return `
        <circle cx="0"  cy="-2" r="9"  fill="#5fa050" stroke="${STROKE}" stroke-width="${SW}"/>
        <circle cx="-5" cy="-7" r="5"  fill="#7ab26e" stroke="${STROKE}" stroke-width="1.2"/>
        <circle cx="5"  cy="-6" r="4.5" fill="#7ab26e" stroke="${STROKE}" stroke-width="1.2"/>
        <rect x="-1.5" y="6" width="3" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      `;
    }
    if (v === 3) {
      // Slim oval
      return `
        <ellipse cx="0" cy="-3" rx="6" ry="11" fill="#4f8b4a" stroke="${STROKE}" stroke-width="${SW}"/>
        <ellipse cx="-2" cy="-7" rx="3" ry="4" fill="#6ba85f" stroke="${STROKE}" stroke-width="1"/>
        <rect x="-1.5" y="7" width="3" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      `;
    }
    // 0: original round bushy
    return `
      <circle cx="0"  cy="-2" r="10" fill="#4f8b4a" stroke="${STROKE}" stroke-width="${SW}"/>
      <circle cx="-4" cy="-6" r="5"  fill="#6ba85f" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-1.5" y="6" width="3" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
    `;
  }
  function flower(variant = 0) {
    const palettes = [
      { center: '#e7b94a', petal: '#d94c3a' }, // yellow + red
      { center: '#d94c3a', petal: '#f8d4e0' }, // red + pink
      { center: '#fff8e0', petal: '#8a5fb0' }, // white + purple
      { center: '#3b6fb5', petal: '#a8d8e8' }, // blue + light blue
      { center: '#e7b94a', petal: '#fff8e0' }, // daisy
      { center: '#de8348', petal: '#f4d35e' }, // orange + yellow
    ];
    const p = palettes[variant % palettes.length];
    return `
      <circle cx="-4" cy="-5" r="2.5" fill="${p.petal}" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="4"  cy="-5" r="2.5" fill="${p.petal}" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="-4" cy="-1" r="2.5" fill="${p.petal}" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="4"  cy="-1" r="2.5" fill="${p.petal}" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="0"  cy="-3" r="3"   fill="${p.center}" stroke="${STROKE}" stroke-width="1.2"/>
      <circle cx="0"  cy="-3" r="1.4" fill="#fff8e0"/>
      <line x1="0" y1="-1" x2="0" y2="6" stroke="#4f8b4a" stroke-width="1.5"/>
    `;
  }
  function car(variant = 0) {
    // 9 colors x 4 shapes (sedan / SUV / pickup / van) — variants cluster
    // by shape, so each shape gets every color before the next shape starts.
    const colors = ['#3b6fb5','#d94c3a','#4f8b4a','#e7b94a','#8a5fb0','#de8348','#d97ba0','#2a2418','#f0ead2'];
    const c = colors[variant % colors.length];
    const shape = Math.floor(variant / colors.length) % 4;

    if (shape === 1) {
      // SUV — taller and boxier
      return `
        <rect x="-10" y="-5" width="20" height="10" rx="2" fill="${c}" stroke="${STROKE}" stroke-width="1.5"/>
        <rect x="-8" y="-4" width="14" height="6" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.8"/>
        <line x1="-1" y1="-4" x2="-1" y2="2" stroke="${STROKE}" stroke-width="0.5"/>
        <circle cx="-6" cy="5" r="2.2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="6"  cy="5" r="2.2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
      `;
    }
    if (shape === 2) {
      // Pickup — short cab + open bed
      return `
        <rect x="-1" y="-4" width="12" height="8" fill="${c}" stroke="${STROKE}" stroke-width="1.4"/>
        <rect x="0"  y="-3" width="10" height="6" fill="#5a4030" stroke="${STROKE}" stroke-width="0.4"/>
        <rect x="-11" y="-4" width="11" height="8" rx="1.5" fill="${c}" stroke="${STROKE}" stroke-width="1.5"/>
        <rect x="-9"  y="-3" width="7"  height="5" rx="0.8" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.7"/>
        <circle cx="-7" cy="4" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="7"  cy="4" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
      `;
    }
    if (shape === 3) {
      // Van / lorry — longer, boxier, multiple side windows
      return `
        <rect x="-11" y="-4" width="22" height="9" rx="1.5" fill="${c}" stroke="${STROKE}" stroke-width="1.5"/>
        <rect x="-9" y="-3" width="5" height="5" rx="0.6" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.6"/>
        <rect x="-2" y="-3" width="4" height="4" rx="0.4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
        <rect x="4"  y="-3" width="4" height="4" rx="0.4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
        <line x1="9" y1="-4" x2="9" y2="5" stroke="${STROKE}" stroke-width="0.5"/>
        <circle cx="-7" cy="5" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="8"  cy="5" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
      `;
    }
    // 0: classic sedan
    return `
      <rect x="-10" y="-4" width="20" height="8" rx="3" fill="${c}" stroke="${STROKE}" stroke-width="1.5"/>
      <rect x="-7" y="-3" width="6" height="5" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <rect x="1"  y="-3" width="6" height="5" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="-6" cy="4" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="6"  cy="4" r="2" fill="#2a2418" stroke="${STROKE}" stroke-width="0.8"/>
    `;
  }
  function pond() {
    return `
      <ellipse cx="0" cy="0" rx="22" ry="14" fill="#7ec0d8" stroke="${STROKE}" stroke-width="${SW}"/>
      <g>
        <animate attributeName="opacity" values="0.35;0.95;0.35" dur="4.5s" repeatCount="indefinite"/>
        <path d="M -10 -2 q 3 -2 6 0" stroke="${STROKE}" stroke-width="1" fill="none"/>
        <path d="M 4 4 q 3 -2 6 0" stroke="${STROKE}" stroke-width="1" fill="none"/>
      </g>
    `;
  }
  function shop(variant = 0) {
    const palettes = [
      { wall: '#e8d4a8', roof: '#a0492a', win: '#fff8e0' }, // tan + brown
      { wall: '#a8d8e8', roof: '#3b6fb5', win: '#fff8e0' }, // light blue
      { wall: '#cbe6a8', roof: '#4f8b4a', win: '#fff8e0' }, // green
      { wall: '#f8d4e0', roof: '#8a5fb0', win: '#fff8e0' }, // pink + purple
      { wall: '#f4d35e', roof: '#de8348', win: '#fff8e0' }, // yellow + orange
    ];
    const p = palettes[variant % palettes.length];
    return `
      <rect x="-18" y="-12" width="36" height="24" fill="${p.wall}" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-18" y="-12" width="36" height="6"  fill="${p.roof}" stroke="${STROKE}" stroke-width="1.5"/>
      <rect x="-12" y="-2"  width="9"  height="10" fill="${p.win}"  stroke="${STROKE}" stroke-width="1"/>
      <rect x="3"   y="-2"  width="9"  height="10" fill="${p.win}"  stroke="${STROKE}" stroke-width="1"/>
    `;
  }
  function fountain() {
    return `
      <circle cx="0" cy="0" r="14" fill="#7ec0d8" stroke="${STROKE}" stroke-width="${SW}"/>
      <circle cx="0" cy="0" r="9" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1.2"/>
      <circle cx="0" cy="0" r="4" fill="#cdb992" stroke="${STROKE}" stroke-width="1.2"/>
      <!-- pulsing water spout -->
      <g>
        <animateTransform attributeName="transform" type="scale"
          values="1 0.7;1 1.15;1 0.7" dur="2.4s" repeatCount="indefinite"/>
        <line x1="0" y1="-4" x2="0" y2="-9" stroke="#a8d8e8" stroke-width="2"/>
        <path d="M -3 -7 q 3 -3 6 0" stroke="#a8d8e8" stroke-width="1.5" fill="none"/>
      </g>
    `;
  }
  function bench() {
    return `
      <rect x="-10" y="-2" width="20" height="3" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-10" y="-6" width="20" height="3" fill="#7a5230" stroke="${STROKE}" stroke-width="1.2"/>
      <rect x="-9" y="1" width="2" height="5" fill="#3a3225"/>
      <rect x="7" y="1" width="2" height="5" fill="#3a3225"/>
    `;
  }
  function busStop() {
    return `
      <rect x="-10" y="-12" width="20" height="14" fill="#d94c3a" stroke="${STROKE}" stroke-width="1.5"/>
      <text x="0" y="-2" text-anchor="middle" font-size="8" font-family="Patrick Hand" fill="#fff">BUS</text>
      <line x1="0" y1="2" x2="0" y2="10" stroke="${STROKE}" stroke-width="1.5"/>
    `;
  }
  function bus() {
    // Yellow school bus, side view
    return `
      <rect x="-22" y="-9" width="40" height="18" rx="3" fill="#f4c430" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="14" y="-7" width="6" height="10" rx="1.5" fill="#f4c430" stroke="${STROKE}" stroke-width="1.4"/>
      <rect x="-19" y="-6" width="6" height="6" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <rect x="-11" y="-6" width="6" height="6" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <rect x="-3"  y="-6" width="6" height="6" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <rect x="5"   y="-6" width="6" height="6" rx="1" fill="#a8d8e8" stroke="${STROKE}" stroke-width="1"/>
      <line x1="-22" y1="3" x2="18" y2="3" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="-13" cy="9" r="3.5" fill="#2a2418" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="-13" cy="9" r="1.4" fill="#7a7060"/>
      <circle cx="11"  cy="9" r="3.5" fill="#2a2418" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="11"  cy="9" r="1.4" fill="#7a7060"/>
    `;
  }
  function soccerField() {
    // Top-down soccer pitch
    return `
      <rect x="-30" y="-20" width="60" height="40" fill="#7fb86b" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-28" y="-18" width="56" height="36" fill="none" stroke="#fff8e0" stroke-width="1.4"/>
      <line x1="0" y1="-18" x2="0" y2="18" stroke="#fff8e0" stroke-width="1.4"/>
      <circle cx="0" cy="0" r="6" fill="none" stroke="#fff8e0" stroke-width="1.4"/>
      <circle cx="0" cy="0" r="1.2" fill="#fff8e0"/>
      <rect x="-28" y="-8" width="6" height="16" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <rect x="22"  y="-8" width="6" height="16" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <rect x="-30" y="-4" width="2" height="8" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.8"/>
      <rect x="28"  y="-4" width="2" height="8" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.8"/>
    `;
  }
  function tennisCourt() {
    // Top-down tennis court
    return `
      <rect x="-26" y="-14" width="52" height="28" fill="#3b8a8f" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-24" y="-12" width="48" height="24" fill="none" stroke="#fff8e0" stroke-width="1.4"/>
      <line x1="0" y1="-12" x2="0" y2="12" stroke="#fff8e0" stroke-width="1.6" stroke-dasharray="2 2"/>
      <line x1="-16" y1="-12" x2="-16" y2="12" stroke="#fff8e0" stroke-width="1.2"/>
      <line x1="16"  y1="-12" x2="16"  y2="12" stroke="#fff8e0" stroke-width="1.2"/>
      <line x1="-16" y1="0" x2="16" y2="0" stroke="#fff8e0" stroke-width="1.2"/>
      <line x1="-24" y1="-6" x2="24" y2="-6" stroke="#fff8e0" stroke-width="0.8" opacity="0.5"/>
      <line x1="-24" y1="6"  x2="24" y2="6"  stroke="#fff8e0" stroke-width="0.8" opacity="0.5"/>
    `;
  }
  function volleyballCourt() {
    // Sandy volleyball
    return `
      <rect x="-26" y="-14" width="52" height="28" fill="#e8d49a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-10" width="44" height="20" fill="none" stroke="${STROKE}" stroke-width="1.2"/>
      <line x1="0" y1="-12" x2="0" y2="12" stroke="${STROKE}" stroke-width="1.5"/>
      <line x1="-1" y1="-12" x2="-1" y2="12" stroke="#fff8e0" stroke-width="2.2" stroke-dasharray="1.5 1.5"/>
      <circle cx="-12" cy="0" r="2" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.8"/>
      <path d="M -13 -1 a 2 2 0 0 1 2 0 M -13 1 a 2 2 0 0 0 2 0" stroke="${STROKE}" stroke-width="0.5" fill="none"/>
    `;
  }
  function basketballCourt() {
    return `
      <rect x="-26" y="-16" width="52" height="32" fill="#c97a4a" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-24" y="-14" width="48" height="28" fill="none" stroke="#fff8e0" stroke-width="1.4"/>
      <line x1="0" y1="-14" x2="0" y2="14" stroke="#fff8e0" stroke-width="1.2"/>
      <circle cx="0" cy="0" r="5" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <rect x="-24" y="-6" width="8" height="12" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <rect x="16"  y="-6" width="8" height="12" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <path d="M -16 -4 a 4 4 0 0 1 0 8" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <path d="M 16 -4 a 4 4 0 0 0 0 8" fill="none" stroke="#fff8e0" stroke-width="1.2"/>
      <circle cx="-22" cy="0" r="1.5" fill="#fff8e0"/>
      <circle cx="22"  cy="0" r="1.5" fill="#fff8e0"/>
    `;
  }
  function golfCourse() {
    // Mini golf green with flag
    return `
      <ellipse cx="0" cy="2" rx="30" ry="18" fill="#7fb86b" stroke="${STROKE}" stroke-width="${SW}"/>
      <ellipse cx="-8" cy="-2" rx="10" ry="6" fill="#a3d97f" stroke="${STROKE}" stroke-width="1"/>
      <ellipse cx="12" cy="6"  rx="9" ry="5" fill="#a3d97f" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="-22" cy="-4" r="3" fill="#e8d49a" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="-22" cy="-4" r="1" fill="#2a2418"/>
      <circle cx="14" cy="-2" r="1.4" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.8"/>
      <line x1="14" y1="-2" x2="14" y2="-14" stroke="${STROKE}" stroke-width="1.5"/>
      <path d="M 14 -14 L 22 -12 L 14 -10 Z" fill="#d94c3a" stroke="${STROKE}" stroke-width="1"/>
    `;
  }
  function playground() {
    // Slide + swing set
    return `
      <rect x="-22" y="-14" width="44" height="28" fill="#f0d9a8" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <line x1="-16" y1="-10" x2="-16" y2="8" stroke="#7a5230" stroke-width="1.6"/>
      <line x1="-4"  y1="-10" x2="-4"  y2="8" stroke="#7a5230" stroke-width="1.6"/>
      <line x1="-16" y1="-10" x2="-4" y2="-10" stroke="#7a5230" stroke-width="1.6"/>
      <line x1="-13" y1="-10" x2="-13" y2="3" stroke="${STROKE}" stroke-width="0.8"/>
      <line x1="-7"  y1="-10" x2="-7"  y2="3" stroke="${STROKE}" stroke-width="0.8"/>
      <rect x="-15" y="3" width="4" height="2" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.8"/>
      <rect x="-9"  y="3" width="4" height="2" fill="#3b6fb5" stroke="${STROKE}" stroke-width="0.8"/>
      <path d="M 6 -8 L 18 8 L 6 8 Z" fill="#f4a460" stroke="${STROKE}" stroke-width="1.4"/>
      <line x1="6" y1="-8" x2="6" y2="8" stroke="${STROKE}" stroke-width="1.4"/>
    `;
  }
  function parkingLot() {
    return `
      <rect x="-22" y="-14" width="44" height="28" fill="#9a9a8a" stroke="${STROKE}" stroke-width="${SW}" rx="1"/>
      <line x1="-15" y1="-12" x2="-15" y2="12" stroke="#fff8e0" stroke-width="1"/>
      <line x1="-7"  y1="-12" x2="-7"  y2="12" stroke="#fff8e0" stroke-width="1"/>
      <line x1="1"   y1="-12" x2="1"   y2="12" stroke="#fff8e0" stroke-width="1"/>
      <line x1="9"   y1="-12" x2="9"   y2="12" stroke="#fff8e0" stroke-width="1"/>
      <line x1="17"  y1="-12" x2="17"  y2="12" stroke="#fff8e0" stroke-width="1"/>
      <line x1="-22" y1="0" x2="22" y2="0" stroke="#fff8e0" stroke-width="1.2"/>
      <rect x="-13" y="-9" width="6" height="6" rx="1" fill="#3b6fb5" stroke="${STROKE}" stroke-width="0.8"/>
      <rect x="3"   y="3"  width="6" height="6" rx="1" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.8"/>
    `;
  }
  function gazebo() {
    // Hexagonal gazebo
    return `
      <polygon points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}"/>
      <polygon points="0,-18 14,-9 14,7 0,16 -14,7 -14,-9" fill="#a0492a" stroke="${STROKE}" stroke-width="1.5" opacity="0.85"/>
      <polygon points="0,-14 12,-7 12,7 0,14 -12,7 -12,-7" fill="none" stroke="${STROKE}" stroke-width="1.4"/>
      <line x1="-9" y1="-5" x2="-9" y2="9" stroke="${STROKE}" stroke-width="1"/>
      <line x1="9"  y1="-5" x2="9"  y2="9" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="0" cy="-18" r="1.6" fill="#e7b94a" stroke="${STROKE}" stroke-width="0.8"/>
    `;
  }
  function streetlight() {
    return `
      <line x1="0" y1="-14" x2="0" y2="10" stroke="${STROKE}" stroke-width="1.6"/>
      <ellipse cx="0" cy="-14" rx="6" ry="3" fill="#f4c430" stroke="${STROKE}" stroke-width="1.2"/>
      <circle cx="0" cy="10" r="2" fill="#7a5230" stroke="${STROKE}" stroke-width="1"/>
      <line x1="-4" y1="-15" x2="-9" y2="-12" stroke="#f4c430" stroke-width="0.8" opacity="0.6"/>
      <line x1="4"  y1="-15" x2="9"  y2="-12" stroke="#f4c430" stroke-width="0.8" opacity="0.6"/>
    `;
  }
  function mailbox() {
    return `
      <rect x="-7" y="-8" width="14" height="9" rx="4" fill="#3b6fb5" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-1" y="3" width="2" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="0.8"/>
      <rect x="3" y="-5" width="2" height="3" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.6"/>
      <line x1="-5" y1="-5" x2="-2" y2="-5" stroke="#fff8e0" stroke-width="1"/>
    `;
  }

  function donutShop() {
    return `
      <rect x="-22" y="-12" width="44" height="24" fill="#f8d4e0" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-12" width="44" height="6" fill="#a0492a" stroke="${STROKE}" stroke-width="1.4"/>
      <text x="0" y="-7" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">DONUTS</text>
      <!-- big donut -->
      <circle cx="-11" cy="3" r="6" fill="#e8b89a" stroke="${STROKE}" stroke-width="1.2"/>
      <circle cx="-11" cy="3" r="2.4" fill="#f8d4e0" stroke="${STROKE}" stroke-width="0.7"/>
      <line x1="-13" y1="0"  x2="-12" y2="1"  stroke="#d94c3a" stroke-width="0.9"/>
      <line x1="-9"  y1="0"  x2="-10" y2="1"  stroke="#3b6fb5" stroke-width="0.9"/>
      <line x1="-12" y1="6"  x2="-13" y2="7"  stroke="#4f8b4a" stroke-width="0.9"/>
      <line x1="-10" y1="6"  x2="-9"  y2="7"  stroke="#e7b94a" stroke-width="0.9"/>
      <!-- door + window -->
      <rect x="6" y="-2" width="8" height="14" fill="#a0492a" stroke="${STROKE}" stroke-width="0.9"/>
      <circle cx="12" cy="5" r="0.7" fill="${STROKE}"/>
      <rect x="-2" y="-2" width="6" height="6" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.6"/>
    `;
  }

  function hospital() {
    return `
      <rect x="-22" y="-14" width="44" height="28" fill="#f5f5f5" stroke="${STROKE}" stroke-width="${SW}" rx="2"/>
      <rect x="-22" y="-14" width="44" height="6" fill="#d94c3a" stroke="${STROKE}" stroke-width="1.4"/>
      <text x="0" y="-9.5" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">HOSPITAL</text>
      <!-- big red cross -->
      <rect x="-3" y="-4" width="6" height="14" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.6"/>
      <rect x="-7" y="0"  width="14" height="6" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.6"/>
      <!-- windows -->
      <rect x="-19" y="-3" width="4" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-19" y="4"  width="4" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="15"  y="-3" width="4" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="15"  y="4"  width="4" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <!-- door -->
      <rect x="-4" y="9" width="8" height="5" fill="#3a2a18" stroke="${STROKE}" stroke-width="0.6"/>
    `;
  }

  function amusementPark() {
    // Ferris wheel — the spokes/rim/carriages rotate as one group; the
    // pedestal and center hub stay put. SVG <animateTransform> runs
    // independently of React, so it costs nothing per frame.
    return `
      <!-- pedestal (static) -->
      <rect x="-2.5" y="10" width="5" height="10" fill="#7a5230" stroke="${STROKE}" stroke-width="${SW}"/>
      <line x1="-9" y1="20" x2="9" y2="20" stroke="${STROKE}" stroke-width="1.5"/>

      <!-- rotating wheel -->
      <g>
        <animateTransform attributeName="transform" type="rotate"
          from="0 0 6" to="360 0 6" dur="22s" repeatCount="indefinite"/>
        <!-- spokes -->
        <line x1="0" y1="6" x2="-18" y2="6"  stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="18"  y2="6"  stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="0"   y2="-12" stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="-13" y2="-7"  stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="13"  y2="-7"  stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="-13" y2="19"  stroke="${STROKE}" stroke-width="1"/>
        <line x1="0" y1="6" x2="13"  y2="19"  stroke="${STROKE}" stroke-width="1"/>
        <!-- rim -->
        <circle cx="0" cy="6" r="18" fill="none" stroke="${STROKE}" stroke-width="1.5"/>
        <!-- carriages -->
        <circle cx="-18" cy="6"  r="3" fill="#d94c3a" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="18"  cy="6"  r="3" fill="#3b6fb5" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="0"   cy="-12" r="3" fill="#e7b94a" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="-13" cy="-7"  r="3" fill="#4f8b4a" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="13"  cy="-7"  r="3" fill="#8a5fb0" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="-13" cy="19"  r="3" fill="#de8348" stroke="${STROKE}" stroke-width="0.8"/>
        <circle cx="13"  cy="19"  r="3" fill="#d97ba0" stroke="${STROKE}" stroke-width="0.8"/>
      </g>

      <!-- center hub (static, sits on top of axle) -->
      <circle cx="0" cy="6" r="2.6" fill="#cdb992" stroke="${STROKE}" stroke-width="0.9"/>
    `;
  }

  function hotel() {
    return `
      <!-- main building -->
      <rect x="-18" y="-22" width="36" height="44" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}" rx="1.5"/>
      <!-- top sign band -->
      <rect x="-18" y="-22" width="36" height="6" fill="#3b6fb5" stroke="${STROKE}" stroke-width="1.2"/>
      <text x="0" y="-17.5" text-anchor="middle" font-size="6" font-family="Patrick Hand" fill="#fff">HOTEL</text>
      <!-- 3 floors of 3 windows -->
      <rect x="-14" y="-12" width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-3"  y="-12" width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="8"   y="-12" width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-14" y="-5"  width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-3"  y="-5"  width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="8"   y="-5"  width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-14" y="2"   width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="-3"  y="2"   width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="8"   y="2"   width="6" height="4" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <!-- ground floor entrance -->
      <rect x="-4" y="9" width="8" height="13" fill="#3b6fb5" stroke="${STROKE}" stroke-width="0.8"/>
      <circle cx="2.5" cy="16" r="0.7" fill="${STROKE}"/>
      <!-- side ground windows -->
      <rect x="-14" y="11" width="5" height="6" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <rect x="9"   y="11" width="5" height="6" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <!-- canopy -->
      <line x1="-8" y1="9" x2="8" y2="9" stroke="${STROKE}" stroke-width="1.6"/>
    `;
  }

  function church() {
    return `
      <!-- main hall -->
      <rect x="-16" y="-6" width="32" height="22" fill="#f0e8d8" stroke="${STROKE}" stroke-width="${SW}" rx="1"/>
      <!-- gabled roof -->
      <polygon points="-18,-6 0,-18 18,-6" fill="#a0492a" stroke="${STROKE}" stroke-width="${SW}"/>
      <!-- steeple base -->
      <rect x="-3.5" y="-13" width="7" height="6" fill="#d4a574" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- spire -->
      <polygon points="-4,-13 0,-22 4,-13" fill="#a0492a" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- cross on top -->
      <line x1="0" y1="-22" x2="0" y2="-28" stroke="${STROKE}" stroke-width="1.4"/>
      <line x1="-2" y1="-26" x2="2" y2="-26" stroke="${STROKE}" stroke-width="1.4"/>
      <!-- arched windows -->
      <path d="M -10 0 a 3 3 0 0 1 6 0 v 6 h -6 z" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.9"/>
      <path d="M 4 0 a 3 3 0 0 1 6 0 v 6 h -6 z" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- arched front door -->
      <path d="M -3 16 v -6 a 3 3 0 0 1 6 0 v 6 z" fill="#7a5230" stroke="${STROKE}" stroke-width="1"/>
    `;
  }

  function statue() {
    return `
      <!-- pedestal -->
      <rect x="-7" y="6" width="14" height="6" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-9" y="11" width="18" height="3" fill="#a8a09a" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- figure -->
      <circle cx="0" cy="-8" r="3.5" fill="#a8a09a" stroke="${STROKE}" stroke-width="0.9"/>
      <path d="M -4 -4 q 4 -2 8 0 v 10 h -8 z" fill="#a8a09a" stroke="${STROKE}" stroke-width="1"/>
      <!-- raised arm -->
      <line x1="3" y1="-2" x2="6" y2="-7" stroke="${STROKE}" stroke-width="2"/>
      <circle cx="6" cy="-7" r="1" fill="#a8a09a" stroke="${STROKE}" stroke-width="0.5"/>
    `;
  }

  function windmill() {
    return `
      <!-- ground shadow -->
      <ellipse cx="0" cy="16" rx="9" ry="2" fill="rgba(42,36,24,0.15)" stroke="none"/>
      <!-- tapered tower -->
      <polygon points="-5,16 5,16 3,-7 -3,-7" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}"/>
      <!-- door at base -->
      <rect x="-2" y="10" width="4" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="0.6"/>
      <!-- small window -->
      <rect x="-2" y="0" width="4" height="3" fill="#a8d8e8" stroke="${STROKE}" stroke-width="0.5"/>
      <!-- top dome / cap -->
      <ellipse cx="0" cy="-7" rx="5" ry="2.5" fill="#a0492a" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- rotating blades -->
      <g>
        <animateTransform attributeName="transform" type="rotate"
          from="0 0 -7" to="360 0 -7" dur="5s" repeatCount="indefinite"/>
        <rect x="-1" y="-21" width="2" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.6"/>
        <rect x="-1" y="-7"  width="2" height="14" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.6"/>
        <rect x="-7" y="-8"  width="14" height="2" fill="#fff8e0" stroke="${STROKE}" stroke-width="0.6"/>
        <circle cx="0" cy="-7" r="1.4" fill="${STROKE}"/>
      </g>
    `;
  }

  function clockTower() {
    return `
      <!-- tower -->
      <rect x="-7" y="-12" width="14" height="28" fill="#cdb992" stroke="${STROKE}" stroke-width="${SW}"/>
      <rect x="-9" y="-14" width="18" height="3" fill="#a0492a" stroke="${STROKE}" stroke-width="0.9"/>
      <!-- pyramidal roof -->
      <polygon points="-9,-14 0,-22 9,-14" fill="#a0492a" stroke="${STROKE}" stroke-width="${SW}"/>
      <!-- finial -->
      <line x1="0" y1="-22" x2="0" y2="-26" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="0" cy="-26" r="1" fill="#e7b94a" stroke="${STROKE}" stroke-width="0.5"/>
      <!-- clock face -->
      <circle cx="0" cy="-3" r="5" fill="#fff8e0" stroke="${STROKE}" stroke-width="1.2"/>
      <line x1="0" y1="-3" x2="0" y2="-7" stroke="${STROKE}" stroke-width="1"/>
      <line x1="0" y1="-3" x2="3" y2="-3" stroke="${STROKE}" stroke-width="1"/>
      <circle cx="0" cy="-3" r="0.6" fill="${STROKE}"/>
      <!-- small markers at 12/3/6/9 -->
      <circle cx="0" cy="-7.5" r="0.3" fill="${STROKE}"/>
      <circle cx="3.5" cy="-3" r="0.3" fill="${STROKE}"/>
      <circle cx="0" cy="1.5" r="0.3" fill="${STROKE}"/>
      <circle cx="-3.5" cy="-3" r="0.3" fill="${STROKE}"/>
      <!-- door -->
      <rect x="-2" y="10" width="4" height="6" fill="#7a5230" stroke="${STROKE}" stroke-width="0.6"/>
    `;
  }

  function museum() {
    return `
      <!-- triangular pediment -->
      <path d="M -22 -8 L 0 -22 L 22 -8 Z" fill="#f0e8d8" stroke="${STROKE}" stroke-width="${SW}"/>
      <!-- decorative dot in pediment -->
      <circle cx="0" cy="-12" r="1.4" fill="${STROKE}"/>
      <!-- horizontal architrave -->
      <rect x="-22" y="-9" width="44" height="3" fill="#cdb992" stroke="${STROKE}" stroke-width="1"/>
      <!-- main hall -->
      <rect x="-20" y="-6" width="40" height="22" fill="#f0e8d8" stroke="${STROKE}" stroke-width="${SW}"/>
      <!-- columns -->
      <rect x="-17" y="-6" width="3" height="20" fill="#fff" stroke="${STROKE}" stroke-width="0.6"/>
      <rect x="-9"  y="-6" width="3" height="20" fill="#fff" stroke="${STROKE}" stroke-width="0.6"/>
      <rect x="-1"  y="-6" width="3" height="20" fill="#fff" stroke="${STROKE}" stroke-width="0.6"/>
      <rect x="6"   y="-6" width="3" height="20" fill="#fff" stroke="${STROKE}" stroke-width="0.6"/>
      <rect x="14"  y="-6" width="3" height="20" fill="#fff" stroke="${STROKE}" stroke-width="0.6"/>
      <!-- entrance steps -->
      <rect x="-22" y="14" width="44" height="3" fill="#cdb992" stroke="${STROKE}" stroke-width="0.8"/>
      <!-- doorway -->
      <rect x="-3" y="5" width="6" height="9" fill="#3a2a18" stroke="${STROKE}" stroke-width="0.5"/>
    `;
  }

  const REQUIRED = [
    { kind: 'library',    label: 'Library',       required: true,  color: '#bfdbfe', size: 56, draw: lib,        hint: 'Vertical angles with a Park' },
    { kind: 'park',       label: 'Park',          required: true,  color: '#cbe6a8', size: 60, draw: park,       hint: 'Right-angle corner with the School; vertical angles with the Library' },
    { kind: 'school',     label: 'School',        required: true,  color: '#f7d28a', size: 60, draw: school,     hint: 'Right-angle corner with the Park' },
    { kind: 'grocery',    label: 'Grocery Store', required: true,  color: '#f4d35e', size: 56, draw: grocery,    hint: 'On an obtuse-angle intersection' },
    { kind: 'masjid',     label: 'Masjid',        required: true,  color: '#e6c98a', size: 60, draw: masjid,     hint: 'On an acute-angle intersection' },
    { kind: 'police',     label: 'Police Station',required: true,  color: '#9aa8c8', size: 50, draw: police,     hint: 'Alternate interior angles with Fire Dept' },
    { kind: 'fire',       label: 'Fire Dept',     required: true,  color: '#d94c3a', size: 56, draw: fire,       hint: 'Alternate interior angles with Police' },
    { kind: 'movie',      label: 'Movie Theater', required: true,  color: '#8a5fb0', size: 56, draw: movie,      hint: 'Supplementary angles with the Restaurant' },
    { kind: 'restaurant', label: 'Restaurant',    required: true,  color: '#f0a978', size: 52, draw: restaurant, hint: 'On a transversal; supplementary with Movie Theater' },
    { kind: 'gas',        label: 'Gas Station',   required: true,  color: '#d94c3a', size: 50, draw: gas,        hint: 'Alternate exterior angles with the Bank' },
    { kind: 'bank',       label: 'Bank',          required: true,  color: '#cdb992', size: 56, draw: bank,       hint: 'Alternate exterior angles with the Gas Station' },
    { kind: 'mall',       label: 'Mall',          required: true,  color: '#f0c0d0', size: 70, draw: mall,       hint: 'Right-angle corner' },
    { kind: 'icecream',   label: 'Ice Cream',     required: true,  color: '#f8d4e0', size: 50, draw: icecream,   hint: 'Consecutive interior angles with Arcade' },
    { kind: 'arcade',     label: 'Arcade',        required: true,  color: '#3b6fb5', size: 50, draw: arcade,     hint: 'Consecutive interior angles with Ice Cream' },
    { kind: 'pool',       label: 'Pool',          required: true,  color: '#7ec0d8', size: 70, draw: pool,       hint: 'Oval pool — near Ice Cream & Arcade' },
    { kind: 'home',       label: 'Home',          required: true,  color: '#d4a574', size: 36, draw: home,       hint: 'Place at least 12 in a neighborhood', stackable: true },
  ];

  const DECOR = [
    { kind: 'tree',     label: 'Tree',     size: 24, draw: tree,     stackable: true },
    { kind: 'flower',   label: 'Flower',   size: 16, draw: flower,   stackable: true },
    { kind: 'car',      label: 'Car',      size: 22, draw: car,      stackable: true },
    { kind: 'bus',      label: 'Bus',      size: 44, draw: bus,      stackable: true },
    { kind: 'busStop',  label: 'Bus Stop', size: 24, draw: busStop,  stackable: true },
    { kind: 'pond',     label: 'Pond',     size: 50, draw: pond,     stackable: true },
    { kind: 'shop',     label: 'Shop',     size: 44, draw: shop,     stackable: true },
    { kind: 'fountain', label: 'Fountain', size: 34, draw: fountain, stackable: true },
    { kind: 'bench',    label: 'Bench',    size: 24, draw: bench,    stackable: true },
    { kind: 'gazebo',       label: 'Gazebo',       size: 36, draw: gazebo,          stackable: true },
    { kind: 'playground',   label: 'Playground',   size: 48, draw: playground,      stackable: true },
    { kind: 'parkingLot',   label: 'Parking Lot',  size: 48, draw: parkingLot,      stackable: true },
    { kind: 'soccer',       label: 'Soccer Field', size: 64, draw: soccerField,     stackable: true },
    { kind: 'tennis',       label: 'Tennis Court', size: 56, draw: tennisCourt,     stackable: true },
    { kind: 'volleyball',   label: 'Volleyball',   size: 56, draw: volleyballCourt, stackable: true },
    { kind: 'basketball',   label: 'Basketball',   size: 56, draw: basketballCourt, stackable: true },
    { kind: 'golf',         label: 'Golf Course',  size: 64, draw: golfCourse,      stackable: true },
    { kind: 'streetlight',  label: 'Streetlight',  size: 26, draw: streetlight,     stackable: true },
    { kind: 'mailbox',      label: 'Mailbox',      size: 18, draw: mailbox,         stackable: true },
    { kind: 'donut',        label: 'Donut Shop',   size: 50, draw: donutShop,       stackable: true },
    { kind: 'hospital',     label: 'Hospital',     size: 56, draw: hospital,        stackable: true },
    { kind: 'amusement',    label: 'Amusement Park', size: 64, draw: amusementPark, stackable: true },
    { kind: 'hotel',        label: 'Hotel',        size: 60, draw: hotel,           stackable: true },
    { kind: 'museum',       label: 'Museum',       size: 60, draw: museum,          stackable: true },
    { kind: 'church',       label: 'Church',       size: 56, draw: church,          stackable: true },
    { kind: 'clockTower',   label: 'Clock Tower',  size: 50, draw: clockTower,      stackable: true },
    { kind: 'windmill',     label: 'Windmill',     size: 44, draw: windmill,        stackable: true },
    { kind: 'statue',       label: 'Statue',       size: 30, draw: statue,          stackable: true },
  ];

  const ALL = [...REQUIRED, ...DECOR];
  const BY_KIND = Object.fromEntries(ALL.map(b => [b.kind, b]));

  function getDef(kind) { return BY_KIND[kind]; }

  return { REQUIRED, DECOR, ALL, getDef };
})();
