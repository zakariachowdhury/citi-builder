// Geometry helpers for the city builder.
// Streets are stored as line SEGMENTS: {id, x1, y1, x2, y2, name, color}.
// Intersections are computed by checking every pair of segments.

window.Geom = (function() {

  function lineIntersect(s1, s2) {
    // Returns {x, y, t1, t2} if segments intersect (excluding endpoints), else null.
    const x1 = s1.x1, y1 = s1.y1, x2 = s1.x2, y2 = s1.y2;
    const x3 = s2.x1, y3 = s2.y1, x4 = s2.x2, y4 = s2.y2;
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return null; // parallel
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
    // include endpoints (>=0, <=1) but with tiny tolerance so coincident endpoints still register
    if (t < -0.001 || t > 1.001 || u < -0.001 || u > 1.001) return null;
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
      t1: t, t2: u,
    };
  }

  function segmentAngleDeg(s) {
    // Angle of segment (0..180) — treat as undirected line
    let a = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI;
    // normalize to (-90, 90] by collapsing direction
    while (a < 0) a += 180;
    while (a >= 180) a -= 180;
    return a;
  }

  function angleBetween(s1, s2) {
    // Smallest angle (0..90) between two undirected lines
    const a1 = segmentAngleDeg(s1);
    const a2 = segmentAngleDeg(s2);
    let diff = Math.abs(a1 - a2);
    if (diff > 90) diff = 180 - diff;
    return diff;
  }

  function classifyAngle(deg) {
    // The "angle of intersection" — the acute one between the two lines.
    // The four angles formed are: deg, 180-deg, deg, 180-deg.
    // We label the intersection by the SMALLER (acute) angle.
    if (Math.abs(deg - 90) < 3) return 'right';
    if (deg < 87) return 'acute';
    return 'obtuse'; // shouldn't happen since we collapse to <=90
  }

  function classifyIntersection(deg) {
    // For UI display - returns the type as the kid would describe it
    if (Math.abs(deg - 90) < 3) return { type: 'right', label: '90°' };
    if (deg < 87) return { type: 'acute', label: Math.round(deg) + '°' };
    return { type: 'obtuse', label: Math.round(180 - deg) + '°' };
  }

  function findIntersections(streets) {
    // Returns array of {x, y, streetA, streetB, deg, type}
    const out = [];
    for (let i = 0; i < streets.length; i++) {
      for (let j = i + 1; j < streets.length; j++) {
        const hit = lineIntersect(streets[i], streets[j]);
        if (!hit) continue;
        const deg = angleBetween(streets[i], streets[j]);
        const c = classifyIntersection(deg);
        out.push({
          x: hit.x, y: hit.y,
          streetA: streets[i].id,
          streetB: streets[j].id,
          deg, type: c.type, label: c.label,
          // 4 corners formed at this intersection: acute, obtuse, acute, obtuse
          // Useful for "right-angle corner", etc.
        });
      }
    }
    return out;
  }

  function findParallels(streets) {
    // Returns array of groups (each group is array of street ids that are parallel)
    const groups = [];
    const used = new Set();
    for (let i = 0; i < streets.length; i++) {
      if (used.has(streets[i].id)) continue;
      const a1 = segmentAngleDeg(streets[i]);
      const group = [streets[i].id];
      for (let j = i + 1; j < streets.length; j++) {
        if (used.has(streets[j].id)) continue;
        const a2 = segmentAngleDeg(streets[j]);
        let diff = Math.abs(a1 - a2);
        if (diff > 90) diff = 180 - diff;
        if (diff < 3) {
          group.push(streets[j].id);
          used.add(streets[j].id);
        }
      }
      if (group.length > 1) groups.push(group);
      used.add(streets[i].id);
    }
    return groups;
  }

  // Distance from point to segment (for proximity tests)
  function pointToSegment(px, py, s) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len2 = dx*dx + dy*dy;
    if (len2 < 0.001) return Math.hypot(px - s.x1, py - s.y1);
    let t = ((px - s.x1)*dx + (py - s.y1)*dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = s.x1 + t*dx, cy = s.y1 + t*dy;
    return Math.hypot(px - cx, py - cy);
  }

  // Check whether a building is "near a street" (on a street)
  function buildingOnStreet(b, s, threshold = 60) {
    return pointToSegment(b.x, b.y, s) < threshold;
  }

  // Find the closest intersection to a point
  function closestIntersection(x, y, intersections, maxDist = 80) {
    let best = null, bestD = maxDist;
    for (const it of intersections) {
      const d = Math.hypot(x - it.x, y - it.y);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  // Find the closest segment (street) to a point
  function closestStreet(x, y, streets, maxDist = 60) {
    let best = null, bestD = maxDist;
    for (const s of streets) {
      const d = pointToSegment(x, y, s);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  // ---- Rubric checks ----
  function checkRubric(streets, intersections, buildings) {
    const r = {};
    // 6 parallel streets — i.e., ANY single parallel group with >=6 members
    const pgroups = findParallels(streets);
    // Count any street that's in a parallel group of 2+ — both horizontal AND vertical parallels combine toward the total
    const parallelStreetIds = new Set();
    pgroups.forEach(g => g.forEach(id => parallelStreetIds.add(id)));
    const totalParallel = parallelStreetIds.size;
    r.parallel6 = totalParallel >= 6;
    r.parallelCount = totalParallel;

    // 2 transversal streets — a transversal crosses 2+ parallel streets.
    // We count streets that cross the largest parallel group at >=2 points.
    let bigGroup = pgroups.sort((a,b)=>b.length-a.length)[0] || [];
    let transversalCount = 0;
    if (bigGroup.length >= 2) {
      const bigSet = new Set(bigGroup);
      const counts = {};
      for (const it of intersections) {
        const aIn = bigSet.has(it.streetA), bIn = bigSet.has(it.streetB);
        if (aIn && !bIn) counts[it.streetB] = (counts[it.streetB]||0)+1;
        if (bIn && !aIn) counts[it.streetA] = (counts[it.streetA]||0)+1;
      }
      transversalCount = Object.values(counts).filter(c => c >= 2).length;
    }
    r.transversal2 = transversalCount >= 2;
    r.transversalCount = transversalCount;

    // Every non-perpendicular intersection forms BOTH an acute pair and an
    // obtuse pair of vertical angles. So acute count == obtuse count == # of
    // non-right intersections; right intersections count separately.
    const perp = intersections.filter(i => i.type === 'right');
    const nonPerp = intersections.filter(i => i.type !== 'right');
    r.perp2     = perp.length    >= 2; r.perpCount   = perp.length;
    r.obtuse2   = nonPerp.length >= 2; r.obtuseCount = nonPerp.length;
    r.acute2    = nonPerp.length >= 2; r.acuteCount  = nonPerp.length;

    // All streets named
    r.streetsNamed = streets.length > 0 && streets.every(s => s.name && s.name.trim() && !s.name.startsWith('Street '));
    r.streetCount = streets.length;
    r.namedStreetCount = streets.filter(s => s.name && s.name.trim() && !s.name.startsWith('Street ')).length;

    // Building checks
    const has = (kind) => buildings.some(b => b.kind === kind);
    r.hasLibrary = has('library');
    r.hasPark = buildings.some(b => b.kind === 'park');
    r.hasSchool = has('school');
    r.hasGrocery = has('grocery');
    r.hasMasjid = has('masjid');
    r.hasPolice = has('police');
    r.hasFire = has('fire');
    r.hasMovie = has('movie');
    r.hasRestaurant = has('restaurant');
    r.hasGas = has('gas');
    r.hasBank = has('bank');
    r.hasMall = has('mall');
    r.hasIcecream = has('icecream');
    r.hasArcade = has('arcade');
    r.hasPool = has('pool');
    r.homesCount = buildings.filter(b => b.kind === 'home').length;
    r.homes12 = r.homesCount >= 12;

    // For now, just check presence; spatial-relationship checks are advanced
    // and we'll mark them as "review manually" hints in the UI.

    return r;
  }

  return {
    lineIntersect, segmentAngleDeg, angleBetween,
    classifyAngle, classifyIntersection,
    findIntersections, findParallels,
    pointToSegment, buildingOnStreet,
    closestIntersection, closestStreet,
    checkRubric,
  };
})();
