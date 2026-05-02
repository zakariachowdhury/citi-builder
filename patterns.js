// Preset street patterns. Each returns either:
//   array of streets:    {x1, y1, x2, y2, suggestedName}
//   OR full preset:      { streets:[...], buildings:[...] }
// Coordinates assume a 1800x1100 canvas; functions are called with (cx, cy) center.
window.Patterns = (function() {

  const NAMES_PARALLEL = [
    "Maple Ave","Oak St","Pine St","Birch Rd","Cedar Way","Willow Ln",
    "Aspen Ave","Elm St","Cherry Way","Walnut Rd"
  ];
  const NAMES_CROSS = [
    "1st Ave","2nd Ave","3rd Ave","Sunset Blvd","Sunrise Dr","Park Way",
    "Riverside","Hilltop Rd"
  ];
  const NAMES_DIAG = [
    "Diagonal Dr","Crooked Ln","Crossover Way","Slanted St","Zigzag Rd","Cutaway Ave"
  ];

  // Helper: build a street object
  function S(x1, y1, x2, y2, name) {
    return { x1, y1, x2, y2, suggestedName: name };
  }
  function B(kind, x, y, opts = {}) {
    return { kind, x, y, rot: opts.rot || 0, variant: opts.variant || 0, label: opts.label };
  }

  // ─── STREET PATTERNS (no buildings) ────────────────────────────────────

  // CITY GRID — 4 horizontal parallel + 2 vertical parallel = 6 parallels total
  function gridPattern(cx, cy) {
    const W = 1200, H = 700;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const out = [];
    for (let i = 0; i < 4; i++) {
      const y = top + (H/3) * i;
      out.push(S(left, y, right, y, NAMES_PARALLEL[i]));
    }
    for (let i = 0; i < 2; i++) {
      const x = left + W * (i === 0 ? 0.25 : 0.75);
      out.push(S(x, top, x, bottom, NAMES_CROSS[i]));
    }
    return out;
  }

  // PARALLEL TOWN — 4 parallels + 2 cross (= 6 total) + 2 diagonals
  function parallelTownPattern(cx, cy) {
    const W = 1200, H = 720;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const out = [];
    for (let i = 0; i < 4; i++) {
      const y = top + (H/3) * i;
      out.push(S(left, y, right, y, NAMES_PARALLEL[i]));
    }
    out.push(S(cx - 200, top, cx - 200, bottom, NAMES_CROSS[0]));
    out.push(S(cx + 200, top, cx + 200, bottom, NAMES_CROSS[1]));
    out.push(S(left + 80, bottom - 40, cx + 100, top + 40, NAMES_DIAG[0]));
    out.push(S(cx - 100, top + 40, right - 80, bottom - 40, NAMES_DIAG[1]));
    return out;
  }

  // RUBRIC STARTER — meets every street rule cleanly:
  //   • 4 parallel horizontals + 2 parallel verticals = 6 parallels total
  //   • 2 perpendicular verticals (≥2 right angles)
  //   • 1 acute diagonal (≥2 acute intersections with parallels)
  //   • 1 obtuse-leaning diagonal (≥2 obtuse intersections with parallels)
  function rubricStarterPattern(cx, cy) {
    const W = 1300, H = 780;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const out = [];
    // 4 parallel horizontals (evenly spaced)
    for (let i = 0; i < 4; i++) {
      const y = top + (H/3) * i;
      out.push(S(left, y, right, y, NAMES_PARALLEL[i]));
    }
    // 2 perpendicular verticals — extend past the parallels for clean ends
    out.push(S(cx - 280, top - 30, cx - 280, bottom + 30, NAMES_CROSS[0]));
    out.push(S(cx + 280, top - 30, cx + 280, bottom + 30, NAMES_CROSS[1]));
    // 1 shallow diagonal ⇒ acute angles where it crosses verticals (~25°)
    out.push(S(left + 80, bottom - 60, right - 80, top + 60, NAMES_DIAG[0]));
    // 1 steep diagonal ⇒ obtuse-side angle where it crosses horizontals (~70°)
    out.push(S(cx - 60, top - 30, cx + 220, bottom + 30, NAMES_DIAG[1]));
    return out;
  }

  // BLANK
  function emptyPattern() { return []; }

  // ─── PROCEDURAL: random coherent town ───────────────────────────────────
  // Lays down a perimeter rectangle, 1-2 internal H/V streets, optionally
  // one diagonal, then distributes REQUIRED civic buildings + homes + decor
  // across the resulting cells. Items snap to a sub-grid inside each cell
  // and a collision check keeps them from stacking on top of each other.
  function randomCity(cx, cy) {
    const rng = Math.random;
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];
    const namesP = NAMES_PARALLEL.slice().sort(() => 0.5 - rng());
    const namesC = NAMES_CROSS.slice().sort(() => 0.5 - rng());
    const namesD = NAMES_DIAG.slice().sort(() => 0.5 - rng());
    let pIdx = 0, cIdx = 0;

    const W = 1000 + Math.floor(rng() * 250);
    const H = 620  + Math.floor(rng() * 180);
    const left  = cx - W / 2, right  = cx + W / 2;
    const top   = cy - H / 2, bottom = cy + H / 2;

    const streets = [];
    streets.push(S(left,  top,    right, top,    namesP[pIdx++]));
    streets.push(S(left,  bottom, right, bottom, namesP[pIdx++]));
    streets.push(S(left,  top,    left,  bottom, namesC[cIdx++]));
    streets.push(S(right, top,    right, bottom, namesC[cIdx++]));

    const hCount = 1 + Math.floor(rng() * 2);
    const hYs = [];
    for (let i = 0; i < hCount; i++) {
      const y = top + (H / (hCount + 1)) * (i + 1);
      hYs.push(y);
      streets.push(S(left, y, right, y, namesP[pIdx++ % namesP.length]));
    }
    const vCount = 1 + Math.floor(rng() * 2);
    const vXs = [];
    for (let i = 0; i < vCount; i++) {
      const x = left + (W / (vCount + 1)) * (i + 1);
      vXs.push(x);
      streets.push(S(x, top, x, bottom, namesC[cIdx++ % namesC.length]));
    }
    if (rng() < 0.55) {
      const x1 = left + W * (0.18 + rng() * 0.18);
      const x2 = right - W * (0.18 + rng() * 0.18);
      streets.push(S(x1, top, x2, bottom, namesD[0]));
    }

    const xs = [left, ...vXs.slice().sort((a,b) => a-b), right];
    const ys = [top,  ...hYs.slice().sort((a,b) => a-b), bottom];
    const cells = [];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        cells.push({
          mx: (xs[i] + xs[i+1]) / 2,
          my: (ys[j] + ys[j+1]) / 2,
          w: xs[i+1] - xs[i],
          h: ys[j+1] - ys[j],
        });
      }
    }

    // ---- Sub-grid slots per cell, kept clear of road centerlines ----
    const ROAD_HALF = 24; // keep buildings this far from road centerline
    function makeSlots(cell, padding, spacing) {
      const lf = cell.mx - cell.w/2 + padding;
      const rt = cell.mx + cell.w/2 - padding;
      const tp = cell.my - cell.h/2 + padding;
      const bt = cell.my + cell.h/2 - padding;
      const out = [];
      for (let y = tp; y <= bt + 0.1; y += spacing) {
        for (let x = lf; x <= rt + 0.1; x += spacing) out.push({ x, y });
      }
      return out;
    }
    const placed = []; // { x, y, half }
    function fits(x, y, half) {
      // collision against other placed items
      for (const p of placed) {
        if (Math.hypot(x - p.x, y - p.y) < half + p.half + 6) return false;
      }
      // keep off the road centerlines
      for (const xv of xs) if (Math.abs(x - xv) < ROAD_HALF + half) return false;
      for (const yv of ys) if (Math.abs(y - yv) < ROAD_HALF + half) return false;
      return true;
    }
    function tryPlaceInCell(cell, kind, half, padding, spacing, label) {
      const slots = makeSlots(cell, padding, spacing).sort(() => 0.5 - rng());
      for (const slot of slots) {
        // small jitter for an organic-but-aligned look
        const jx = slot.x + (rng() - 0.5) * 6;
        const jy = slot.y + (rng() - 0.5) * 6;
        if (fits(jx, jy, half)) {
          placed.push({ x: jx, y: jy, half });
          return { x: jx, y: jy };
        }
      }
      return null;
    }
    function tryPlaceAnywhere(kind, half, padding, spacing, label) {
      const order = cells.slice().sort(() => 0.5 - rng());
      for (const c of order) {
        const pos = tryPlaceInCell(c, kind, half, padding, spacing, label);
        if (pos) return pos;
      }
      return null;
    }
    function nicely(s) {
      return s.replace(/^./, c => c.toUpperCase()).replace(/([a-z])([A-Z])/g, '$1 $2');
    }

    const buildings = [];
    function add(kind, x, y, opts = {}) {
      buildings.push(B(kind, x, y, opts));
    }

    // 1) Required buildings: largest first, distributed cell-by-cell
    const required = ['library','park','school','grocery','masjid','police','fire',
                      'movie','restaurant','gas','bank','mall','icecream','arcade','pool'];
    const reqOrder = required.slice().sort(() => 0.5 - rng());
    let r = 0;
    const cellsShuffled = cells.slice().sort(() => 0.5 - rng());
    for (const cell of cellsShuffled) {
      // 1-2 required per cell based on size
      const want = Math.min(2, Math.max(1, Math.floor(cell.w * cell.h / 80000)));
      for (let i = 0; i < want && r < reqOrder.length; i++) {
        const kind = reqOrder[r++];
        const pos = tryPlaceInCell(cell, kind, 30, 50, 80, nicely(kind));
        if (pos) add(kind, pos.x, pos.y, { label: nicely(kind) });
      }
    }
    // Any required leftover goes wherever it fits
    while (r < reqOrder.length) {
      const kind = reqOrder[r++];
      const pos = tryPlaceAnywhere(kind, 30, 50, 80, nicely(kind));
      if (pos) add(kind, pos.x, pos.y, { label: nicely(kind) });
    }

    // 2) Homes: 12-18 random color variants
    const homes = 12 + Math.floor(rng() * 7);
    for (let i = 0; i < homes; i++) {
      const pos = tryPlaceAnywhere('home', 18, 40, 45);
      if (pos) add('home', pos.x, pos.y, { variant: Math.floor(rng() * 9) });
    }

    // 3) Decor: trees, flowers, benches, mailboxes — random designs
    const decorCount = 12 + Math.floor(rng() * 8);
    for (let i = 0; i < decorCount; i++) {
      const roll = rng();
      const kind = roll < 0.45 ? 'tree' : roll < 0.80 ? 'flower' : roll < 0.93 ? 'bench' : 'mailbox';
      const half = kind === 'tree' ? 12 : kind === 'flower' ? 9 : 12;
      const pos = tryPlaceAnywhere(kind, half, 30, 35);
      if (pos) add(kind, pos.x, pos.y, { variant: Math.floor(rng() * 9) });
    }

    // 4) Bus stops on the perimeter
    const stops = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < stops; i++) {
      const along = 0.25 + rng() * 0.5;
      add('busStop', left + W * along, top - 22);
    }

    // 5) Cars + buses ON the streets (roughly placed; CityLife will animate
    // them along the road network when liveMode is on).
    function placeVehicleOn(seg, kind) {
      const t = 0.2 + rng() * 0.6;
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const px = -uy, py = ux; // perpendicular pointing right of travel
      const offset = kind === 'bus' ? 11 : 9;
      let rot = Math.atan2(uy, ux) * 180 / Math.PI;
      if (rot > 90) rot -= 180; else if (rot < -90) rot += 180;
      add(kind, seg.x1 + t * dx + px * offset, seg.y1 + t * dy + py * offset, {
        rot,
        variant: Math.floor(rng() * 9),
      });
    }
    // ~50% of streets get a car
    for (const s of streets) {
      if (rng() < 0.5) placeVehicleOn(s, 'car');
    }
    // 1-2 buses on the longest streets
    const byLen = streets.slice().sort((a,b) =>
      Math.hypot(b.x2-b.x1, b.y2-b.y1) - Math.hypot(a.x2-a.x1, a.y2-a.y1));
    const busCount = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < Math.min(busCount, byLen.length); i++) placeVehicleOn(byLen[i], 'bus');

    return { streets, buildings };
  }

  // ─── FINAL-PROJECT PRESETS — streets + buildings, fully placed ─────────
  // Helper to build a base grid frame used by several presets.
  function classicGrid(cx, cy) {
    const W = 1300, H = 760;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const ys = [];
    for (let i = 0; i < 4; i++) ys.push(top + (H/3) * i);
    const streets = [];
    ys.forEach((y, i) => streets.push(S(left, y, right, y, NAMES_PARALLEL[i])));
    streets.push(S(cx - 280, top - 30, cx - 280, bottom + 30, NAMES_CROSS[0]));
    streets.push(S(cx + 280, top - 30, cx + 280, bottom + 30, NAMES_CROSS[1]));
    return { streets, ys, left, right, top, bottom };
  }

  // PRESET 1: Classic Town — clean horizontal grid, two diagonals, all rubric items satisfied.
  function classicTown(cx, cy) {
    const g = classicGrid(cx, cy);
    const streets = [...g.streets];
    // acute diagonal (~25°)
    streets.push(S(g.left + 80, g.bottom - 60, g.right - 80, g.top + 60, NAMES_DIAG[0]));
    // steep diagonal (~70°) — obtuse-leaning
    streets.push(S(cx - 80, g.top - 30, cx + 240, g.bottom + 30, NAMES_DIAG[1]));

    // Building placements (rubric-satisfying):
    const buildings = [
      // Library + Park: vertical angles → opposite corners of an intersection
      B('library', cx - 280 - 70, g.ys[1] - 70, { label: 'Library' }),
      B('park',    cx - 280 + 70, g.ys[1] + 70, { label: 'Park' }),
      // School: right-angle corner with Park (adjacent corner of same intersection)
      B('school',  cx - 280 + 70, g.ys[1] - 70, { label: 'School' }),
      // Mall on right-angle corner of right vertical
      B('mall',    cx + 280 + 90, g.ys[0] + 70, { label: 'Mall' }),
      // Grocery — at obtuse-side of the steep diagonal crossing a horizontal
      B('grocery', cx + 130, g.ys[1] + 80, { label: 'Grocery' }),
      // Masjid — at acute-side of the shallow diagonal
      B('masjid',  cx - 380, g.ys[2] + 50, { label: 'Masjid' }),
      // Police + Fire — alternate interior between ys[1] and ys[2]
      B('police',  cx - 130, g.ys[1] + 70, { label: 'Police' }),
      B('fire',    cx + 130, g.ys[2] - 70, { label: 'Fire' }),
      // Movie + Restaurant — supplementary angles (between ys[2] and ys[3], same transversal side)
      B('movie',      cx + 60, g.ys[2] + 70, { label: 'Movie' }),
      B('restaurant', cx + 60, g.ys[3] - 70, { label: 'Restaurant' }),
      // Gas + Bank — alternate exterior (above ys[0] and below ys[3])
      B('gas',  cx - 200, g.ys[0] - 80, { label: 'Gas' }),
      B('bank', cx + 200, g.ys[3] + 80, { label: 'Bank' }),
      // Ice cream + Arcade — consecutive interior (between ys[1] and ys[2], same side of transversal)
      B('icecream', cx + 340, g.ys[1] + 60, { label: 'Ice Cream' }),
      B('arcade',   cx + 340, g.ys[2] - 60, { label: 'Arcade' }),
      // Pool — near ice cream/arcade
      B('pool',     cx + 410, g.ys[2] + 80, { label: 'Pool' }),
    ];
    // 12 homes — neighborhood top-left in the corner block (between ys[0] and ys[1], left of vertical)
    const homeBlock = { x: cx - 540, y: g.ys[0] + 30 };
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        buildings.push(B('home', homeBlock.x + c * 50, homeBlock.y + r * 50));
      }
    }
    // Decor — playground + sports field + civic accents (tasteful spread)
    buildings.push(B('playground', cx - 380, g.ys[3] + 80));
    buildings.push(B('soccer',     cx + 410, g.ys[3] + 100));
    buildings.push(B('parkingLot', cx + 280 + 90, g.ys[0] - 80));    // by the mall
    buildings.push(B('gazebo',     cx - 280, g.ys[0] - 90));
    buildings.push(B('fountain',   cx, g.ys[1] - 60));
    buildings.push(B('pond',       cx - 120, g.ys[3] + 80));
    // Trees & flowers (sparse — let geometry breathe)
    buildings.push(B('tree', cx - 460, g.ys[2] - 40));
    buildings.push(B('tree', cx + 460, g.ys[1] - 60));
    buildings.push(B('tree', cx - 60,  g.ys[3] + 110));
    buildings.push(B('tree', cx + 60,  g.ys[0] - 100));
    buildings.push(B('flower', cx - 200, g.ys[1] + 40));
    buildings.push(B('flower', cx + 220, g.ys[2] - 40));
    // Vehicles + bus + bus stop (street life)
    buildings.push(B('car', cx - 150, g.ys[0]));
    buildings.push(B('car', cx + 60,  g.ys[2]));
    buildings.push(B('bus', cx + 200, g.ys[1]));
    buildings.push(B('busStop', cx - 280, g.ys[2] + 30));
    // Streetlights along main vertical
    buildings.push(B('streetlight', cx - 280 - 30, g.ys[0] + 80));
    buildings.push(B('streetlight', cx - 280 - 30, g.ys[2] - 60));
    buildings.push(B('streetlight', cx + 280 + 30, g.ys[1] + 80));
    // Bench + mailbox by the park
    buildings.push(B('bench',   cx - 280 + 130, g.ys[1] + 30));
    buildings.push(B('mailbox', cx - 280 - 110, g.ys[1] + 110));

    return { streets, buildings };
  }

  // PRESET 2: Riverside Plaza — central plaza, mall + pond near center, sports + playground.
  function riversidePlaza(cx, cy) {
    const W = 1400, H = 780;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const ys = [];
    for (let i = 0; i < 4; i++) ys.push(top + (H/3) * i);
    const streets = [];
    ys.forEach((y, i) => streets.push(S(left, y, right, y, NAMES_PARALLEL[i])));
    // Only 2 verticals (= 6 parallels total). Center diagonal anchors plaza visually instead of a third vertical.
    streets.push(S(cx - 320, top - 30, cx - 320, bottom + 30, NAMES_CROSS[0]));
    streets.push(S(cx + 320, top - 30, cx + 320, bottom + 30, NAMES_CROSS[1]));
    // Two diagonals creating acute + obtuse
    streets.push(S(left + 60, bottom - 80, right - 60, top + 80, NAMES_DIAG[0])); // shallow → acutes
    streets.push(S(cx + 100, top - 30, cx + 380, bottom + 30, NAMES_DIAG[1]));    // steep → obtuses

    const buildings = [
      // Plaza buildings around (cx, ys[1..2])
      B('mall',     cx - 90, ys[1] + 80, { label: 'Plaza Mall' }),
      B('library',  cx - 320 - 60, ys[1] - 60, { label: 'Library' }),
      B('park',     cx - 320 + 60, ys[1] + 60, { label: 'Central Park' }),
      B('school',   cx - 320 + 60, ys[1] - 60, { label: 'School' }),
      B('grocery',  cx + 230, ys[1] + 80, { label: 'Grocery' }),
      B('masjid',   cx - 430, ys[2] + 30, { label: 'Masjid' }),
      B('police',   cx - 160, ys[1] + 70, { label: 'Police' }),
      B('fire',     cx + 160, ys[2] - 70, { label: 'Fire' }),
      B('movie',      cx + 50, ys[2] + 70, { label: 'Theater' }),
      B('restaurant', cx + 50, ys[3] - 70, { label: 'Bistro' }),
      B('gas',  cx - 200, ys[0] - 80, { label: 'Gas' }),
      B('bank', cx + 200, ys[3] + 80, { label: 'Bank' }),
      B('icecream', cx + 320 + 80, ys[1] + 60, { label: 'Ice Cream' }),
      B('arcade',   cx + 320 + 80, ys[2] - 60, { label: 'Arcade' }),
      B('pool',     cx + 320 + 150, ys[2] + 90, { label: 'Pool' }),
    ];
    // 14 homes — neighborhood top-left
    const homeBlock = { x: cx - 540, y: ys[0] + 30 };
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c >= 4) continue;
        buildings.push(B('home', homeBlock.x + c * 48, homeBlock.y + r * 50));
      }
    }
    // Decor — riverside theme (water + park amenities)
    buildings.push(B('pond',       cx + 130, ys[2] + 60));
    buildings.push(B('fountain',   cx + 30,  ys[1] - 60));
    buildings.push(B('gazebo',     cx - 320, ys[0] - 80));
    buildings.push(B('playground', cx - 200, ys[3] + 80));
    buildings.push(B('tennis',     cx + 380, ys[3] + 80));
    buildings.push(B('basketball', cx - 380, ys[3] + 100));
    buildings.push(B('parkingLot', cx + 90,  ys[3] + 100));
    // Trees + flowers (sparse)
    [['tree', -460, -40],['tree', 420, 60],['tree', -240, 30],['tree', 280, -90],['tree', 0, 130]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    [['flower', -160, -90],['flower', 220, -80],['flower', -60, 110]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    // Vehicles + transit
    buildings.push(B('car',     cx - 80,  ys[2] - 10));
    buildings.push(B('car',     cx + 140, ys[3] + 10));
    buildings.push(B('bus',     cx - 220, ys[1]));
    buildings.push(B('busStop', cx - 280, ys[2] + 40));
    // Streetlights + benches + mailbox
    buildings.push(B('streetlight', cx - 320 - 30, ys[0] + 60));
    buildings.push(B('streetlight', cx + 320 + 30, ys[1] + 60));
    buildings.push(B('bench',       cx - 320 + 130, ys[1] + 90));
    buildings.push(B('bench',       cx + 320 - 130, ys[2] - 90));
    buildings.push(B('mailbox',     cx - 380, ys[0] + 80));

    return { streets, buildings };
  }

  // PRESET 3: Hillside Village — 4 parallels + 2 perp + 3 diagonals.
  function hillsideVillage(cx, cy) {
    const W = 1300, H = 760;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const ys = [];
    for (let i = 0; i < 4; i++) ys.push(top + (H/3) * i);
    const streets = [];
    ys.forEach((y, i) => streets.push(S(left, y, right, y, NAMES_PARALLEL[i])));
    // 2 perp verticals offset
    streets.push(S(cx - 220, top - 30, cx - 220, bottom + 30, NAMES_CROSS[0]));
    streets.push(S(cx + 220, top - 30, cx + 220, bottom + 30, NAMES_CROSS[1]));
    // 3 diagonals creating angle variety (NOT parallel to each other so they don't bump parallel count)
    streets.push(S(left + 80,  bottom - 60, right - 80,  top + 60,    NAMES_DIAG[0])); // shallow ↗
    streets.push(S(left + 220, top + 80,    right - 80,  bottom - 80, NAMES_DIAG[1])); // medium ↘
    streets.push(S(cx - 40,    top - 30,    cx + 200,    bottom + 30,  NAMES_DIAG[2])); // steep → obtuse

    const buildings = [
      B('library',  cx - 220 - 70, ys[1] - 70, { label: 'Library' }),
      B('park',     cx - 220 + 70, ys[1] + 70, { label: 'Park' }),
      B('school',   cx - 220 + 70, ys[1] - 70, { label: 'School' }),
      B('mall',     cx + 220 + 90, ys[2] - 80, { label: 'Mall' }),
      B('grocery',  cx + 130, ys[1] + 80, { label: 'Grocery' }),
      B('masjid',   cx - 360, ys[2] + 50, { label: 'Masjid' }),
      B('police',   cx - 110, ys[1] + 70, { label: 'Police' }),
      B('fire',     cx + 110, ys[2] - 70, { label: 'Fire' }),
      B('movie',      cx + 60,  ys[2] + 70, { label: 'Cinema' }),
      B('restaurant', cx + 60,  ys[3] - 70, { label: 'Diner' }),
      B('gas',  cx - 180, ys[0] - 80, { label: 'Gas' }),
      B('bank', cx + 180, ys[3] + 80, { label: 'Bank' }),
      B('icecream', cx + 320, ys[1] + 60, { label: 'Ice Cream' }),
      B('arcade',   cx + 320, ys[2] - 60, { label: 'Arcade' }),
      B('pool',     cx + 380, ys[2] + 80, { label: 'Pool' }),
    ];
    // 12 homes — bottom-left
    const homeBlock = { x: cx - 480, y: ys[3] + 30 };
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        buildings.push(B('home', homeBlock.x + c * 48, homeBlock.y + r * 50));
      }
    }
    // Decor — hillside village (rustic + sport mix)
    buildings.push(B('pond',       cx + 400, ys[3] + 80));
    buildings.push(B('volleyball', cx - 380, ys[0] + 90));
    buildings.push(B('basketball', cx + 400, ys[0] + 70));
    buildings.push(B('playground', cx - 180, ys[3] + 100));
    buildings.push(B('gazebo',     cx,       ys[0] - 80));
    buildings.push(B('fountain',   cx,       ys[1] - 70));
    buildings.push(B('parkingLot', cx + 220 + 90, ys[2] + 90));
    // Trees + flowers
    [['tree', -440, -70],['tree', 380, -80],['tree', -260, 60],['tree', 260, 110],['tree', 60, 130]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    [['flower', -140, -90],['flower', 240, -80],['flower', -60, 80]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    buildings.push(B('car',         cx - 100, ys[2]));
    buildings.push(B('car',         cx + 80,  ys[3]));
    buildings.push(B('bus',         cx - 200, ys[2]));
    buildings.push(B('busStop',     cx - 280, ys[3] - 40));
    buildings.push(B('streetlight', cx - 220 - 30, ys[0] + 60));
    buildings.push(B('streetlight', cx + 220 + 30, ys[2] + 60));
    buildings.push(B('bench',       cx - 220 + 130, ys[1] + 90));
    buildings.push(B('mailbox',     cx + 280, ys[0] - 60));

    return { streets, buildings };
  }

  // PRESET 4: Sunset Heights — symmetric "X" diagonals.
  function sunsetHeights(cx, cy) {
    const W = 1300, H = 760;
    const left = cx - W/2, right = cx + W/2;
    const top = cy - H/2, bottom = cy + H/2;
    const ys = [];
    for (let i = 0; i < 4; i++) ys.push(top + (H/3) * i);
    const streets = [];
    ys.forEach((y, i) => streets.push(S(left, y, right, y, NAMES_PARALLEL[i])));
    streets.push(S(cx - 260, top - 30, cx - 260, bottom + 30, NAMES_CROSS[0]));
    streets.push(S(cx + 260, top - 30, cx + 260, bottom + 30, NAMES_CROSS[1]));
    // Symmetric X — two diagonals at opposite slopes (NOT parallel)
    streets.push(S(left + 80, top + 80, right - 80, bottom - 80, NAMES_DIAG[0]));
    streets.push(S(left + 80, bottom - 80, right - 80, top + 80, NAMES_DIAG[1]));
    // One steep for obtuse coverage
    streets.push(S(cx - 80, top - 30, cx + 180, bottom + 30, NAMES_DIAG[2]));

    const buildings = [
      B('library',  cx - 260 - 70, ys[1] - 70, { label: 'Library' }),
      B('park',     cx - 260 + 70, ys[1] + 70, { label: 'Park' }),
      B('school',   cx - 260 + 70, ys[1] - 70, { label: 'School' }),
      B('mall',     cx + 260 + 90, ys[1] - 80, { label: 'Sunset Mall' }),
      B('grocery',  cx + 110, ys[1] + 80, { label: 'Grocery' }),
      B('masjid',   cx - 400, ys[2] + 50, { label: 'Masjid' }),
      B('police',   cx - 130, ys[1] + 70, { label: 'Police' }),
      B('fire',     cx + 130, ys[2] - 70, { label: 'Fire' }),
      B('movie',      cx + 50,  ys[2] + 70, { label: 'Movie' }),
      B('restaurant', cx + 50,  ys[3] - 70, { label: 'Restaurant' }),
      B('gas',  cx - 180, ys[0] - 80, { label: 'Gas' }),
      B('bank', cx + 180, ys[3] + 80, { label: 'Bank' }),
      B('icecream', cx + 340, ys[1] + 60, { label: 'Ice Cream' }),
      B('arcade',   cx + 340, ys[2] - 60, { label: 'Arcade' }),
      B('pool',     cx + 410, ys[2] + 80, { label: 'Pool' }),
    ];
    // 12 homes — top-right block
    const homeBlock = { x: cx + 320, y: ys[0] + 30 };
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 6; c++) {
        buildings.push(B('home', homeBlock.x + c * 48, homeBlock.y + r * 50));
      }
    }
    // Decor — symmetric sunset feel (sports + plaza)
    buildings.push(B('soccer',     cx - 380, ys[3] + 80));
    buildings.push(B('tennis',     cx + 410, ys[0] + 90));
    buildings.push(B('playground', cx - 180, ys[3] + 100));
    buildings.push(B('gazebo',     cx,       ys[0] - 90));
    buildings.push(B('fountain',   cx,       ys[1] - 70));
    buildings.push(B('pond',       cx - 380, ys[1] + 100));
    buildings.push(B('parkingLot', cx + 260 + 90, ys[1] + 80));
    [['tree', -460, -50],['tree', 440, -60],['tree', -220, 70],['tree', 100, 100],['tree', -60, 130],['tree', 280, -100]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    [['flower', -160, -90],['flower', 240, -80],['flower', 0, -50]]
      .forEach(([k,dx,dy]) => buildings.push(B(k, cx+dx, cy+dy)));
    buildings.push(B('car',         cx - 110, ys[2]));
    buildings.push(B('car',         cx + 90,  ys[3]));
    buildings.push(B('bus',         cx + 30,  ys[1]));
    buildings.push(B('busStop',     cx - 300, ys[2] + 40));
    buildings.push(B('streetlight', cx - 260 - 30, ys[0] + 60));
    buildings.push(B('streetlight', cx + 260 + 30, ys[2] + 60));
    buildings.push(B('bench',       cx - 260 + 130, ys[1] + 90));
    buildings.push(B('bench',       cx + 260 - 130, ys[2] - 90));
    buildings.push(B('mailbox',     cx - 320, ys[0] + 60));

    return { streets, buildings };
  }

  // ─── PREVIEW SVGs ──────────────────────────────────────────────────────
  function previewBuilding(svgX, svgY, color) {
    return `<rect x="${svgX-2}" y="${svgY-2}" width="4" height="4" fill="${color}"/>`;
  }

  const previews = {
    grid: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.5"/>`).join('')}
      ${[26,54].map(x=>`<line x1="${x}" y1="4" x2="${x}" y2="52" stroke="#8a6a4a" stroke-width="1.5"/>`).join('')}
    </svg>`,
    parallelTown: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.2"/>`).join('')}
      <line x1="28" y1="4" x2="28" y2="52" stroke="#8a6a4a" stroke-width="1.2"/>
      <line x1="52" y1="4" x2="52" y2="52" stroke="#8a6a4a" stroke-width="1.2"/>
      <line x1="10" y1="50" x2="60" y2="6" stroke="#d94c3a" stroke-width="1.2"/>
      <line x1="22" y1="6" x2="70" y2="50" stroke="#d94c3a" stroke-width="1.2"/>
    </svg>`,
    rubricStarter: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.2"/>`).join('')}
      <line x1="26" y1="6" x2="26" y2="54" stroke="#8a6a4a" stroke-width="1.2"/>
      <line x1="54" y1="6" x2="54" y2="54" stroke="#8a6a4a" stroke-width="1.2"/>
      <line x1="8" y1="52" x2="72" y2="8" stroke="#d94c3a" stroke-width="1.2"/>
      <line x1="38" y1="6" x2="62" y2="50" stroke="#3b6fb5" stroke-width="1.2"/>
    </svg>`,
    empty: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      <text x="40" y="32" text-anchor="middle" font-family="Patrick Hand" font-size="11" fill="#8a6a4a">blank</text>
    </svg>`,
    // Final-project previews — show streets + colored building dots
    classicTown: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.1"/>`).join('')}
      <line x1="26" y1="6" x2="26" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="54" y1="6" x2="54" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="8" y1="52" x2="72" y2="8" stroke="#d94c3a" stroke-width="1"/>
      <line x1="36" y1="6" x2="62" y2="54" stroke="#3b6fb5" stroke-width="1"/>
      <circle cx="22" cy="16" r="2" fill="#cbe6a8"/><circle cx="30" cy="16" r="2" fill="#bfdbfe"/>
      <circle cx="64" cy="16" r="2.5" fill="#f0c0d0"/>
      <circle cx="44" cy="32" r="2" fill="#f4d35e"/>
      <circle cx="14" cy="36" r="2" fill="#e6c98a"/>
      <g fill="#d4a574">${[8,12,16,20,8,12,16,20,8,12,16,20].map((x,i)=>`<rect x="${x}" y="${10+Math.floor(i/4)*3}" width="2.5" height="2.5"/>`).join('')}</g>
    </svg>`,
    riversidePlaza: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="4" y1="${y}" x2="76" y2="${y}" stroke="#8a6a4a" stroke-width="1.1"/>`).join('')}
      <line x1="22" y1="6" x2="22" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="58" y1="6" x2="58" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="6" y1="50" x2="74" y2="10" stroke="#d94c3a" stroke-width="1"/>
      <line x1="46" y1="6" x2="64" y2="54" stroke="#3b6fb5" stroke-width="1"/>
      <circle cx="36" cy="28" r="2.5" fill="#f0c0d0"/>
      <circle cx="14" cy="16" r="2" fill="#cbe6a8"/><circle cx="20" cy="16" r="2" fill="#bfdbfe"/>
      <ellipse cx="62" cy="44" rx="4" ry="2.5" fill="#7ec0d8"/>
      <g fill="#d4a574">${[6,10,14,18,6,10,14,18,6,10,14,18].map((x,i)=>`<rect x="${x}" y="${42+(i>3?(i>7?6:3):0)}" width="2.5" height="2.5"/>`).join('')}</g>
    </svg>`,
    hillsideVillage: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.1"/>`).join('')}
      <line x1="28" y1="6" x2="28" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="56" y1="6" x2="56" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="8" y1="50" x2="72" y2="10" stroke="#d94c3a" stroke-width="1"/>
      <line x1="14" y1="14" x2="68" y2="46" stroke="#d94c3a" stroke-width="1"/>
      <line x1="38" y1="6" x2="58" y2="54" stroke="#3b6fb5" stroke-width="1"/>
      <circle cx="24" cy="16" r="2" fill="#cbe6a8"/><circle cx="32" cy="16" r="2" fill="#bfdbfe"/>
      <circle cx="64" cy="32" r="2.5" fill="#f0c0d0"/>
      <ellipse cx="68" cy="46" rx="4" ry="2" fill="#7ec0d8"/>
      <g fill="#d4a574">${[10,14,18,22,10,14,18,22].map((x,i)=>`<rect x="${x}" y="${42+(i>3?4:0)}" width="3" height="3"/>`).join('')}</g>
    </svg>`,
    sunsetHeights: `<svg viewBox="0 0 80 56" width="60" height="42">
      <rect width="80" height="56" fill="#fff" rx="4"/>
      ${[12,24,36,48].map(y=>`<line x1="6" y1="${y}" x2="74" y2="${y}" stroke="#8a6a4a" stroke-width="1.1"/>`).join('')}
      <line x1="26" y1="6" x2="26" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="54" y1="6" x2="54" y2="54" stroke="#8a6a4a" stroke-width="1.1"/>
      <line x1="8" y1="14" x2="72" y2="46" stroke="#d94c3a" stroke-width="1"/>
      <line x1="8" y1="46" x2="72" y2="14" stroke="#d94c3a" stroke-width="1"/>
      <line x1="34" y1="6" x2="56" y2="54" stroke="#3b6fb5" stroke-width="1"/>
      <circle cx="22" cy="16" r="2" fill="#cbe6a8"/><circle cx="30" cy="16" r="2" fill="#bfdbfe"/>
      <circle cx="64" cy="22" r="2.5" fill="#f0c0d0"/>
      <g fill="#d4a574">${Array.from({length:12}).map((_,i)=>`<rect x="${60+(i%6)*2.5}" y="${10+Math.floor(i/6)*4}" width="2.2" height="2.5"/>`).join('')}</g>
    </svg>`,
  };

  return {
    // Street-only patterns (the existing palette)
    list: [
      { id: 'rubricStarter', label: 'Rubric Starter ⭐', desc: 'Meets all street rules', fn: rubricStarterPattern, preview: previews.rubricStarter },
      { id: 'grid',          label: 'City Grid',         desc: '4 parallel + 2 cross',     fn: gridPattern,          preview: previews.grid },
      { id: 'parallelTown',  label: 'Parallel Town',     desc: '4 parallels + diagonals', fn: parallelTownPattern,  preview: previews.parallelTown },
      { id: 'empty',         label: 'Blank Slate',       desc: 'Start from scratch',       fn: emptyPattern,         preview: previews.empty },
    ],
    // Full final-project presets (streets + buildings + decor)
    finalProjects: [
      { id: 'classicTown',     label: 'Classic Town',      desc: 'Clean grid · all rubric items', fn: classicTown,     preview: previews.classicTown },
      { id: 'riversidePlaza',  label: 'Riverside Plaza',   desc: 'Central plaza · pond + mall',   fn: riversidePlaza,  preview: previews.riversidePlaza },
      { id: 'hillsideVillage', label: 'Hillside Village',  desc: 'Diagonal-rich neighborhood',    fn: hillsideVillage, preview: previews.hillsideVillage },
      { id: 'sunsetHeights',   label: 'Sunset Heights',    desc: 'Symmetric X · 12-home block',   fn: sunsetHeights,   preview: previews.sunsetHeights },
    ],
    NAMES_PARALLEL, NAMES_CROSS, NAMES_DIAG,
    randomCity,
  };
})();
