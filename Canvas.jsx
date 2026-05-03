// Canvas.jsx — the SVG map. Loaded as Babel JSX; exposes window.CityCanvas.
const { useRef, useState, useEffect, useMemo, useCallback } = React;

// SVG paper filter for "rough" look
function PaperDefs() {
  return (
    <defs>
      <filter id="rough" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3"/>
        <feDisplacementMap in="SourceGraphic" scale="1.4"/>
      </filter>
      <filter id="paper-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
        <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.82  0 0 0 0 0.74  0 0 0 0.04 0"/>
      </filter>
      <pattern id="grass" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#ffffff"/>
        <circle cx="4" cy="6" r="0.6" fill="#cfc6ad" opacity="0.45"/>
        <circle cx="14" cy="13" r="0.5" fill="#cfc6ad" opacity="0.45"/>
      </pattern>
      <filter id="bldg-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.6"/>
        <feOffset dx="1.4" dy="2.2" result="offsetblur"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.22"/></feComponentTransfer>
        <feMerge>
          <feMergeNode/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
      <pattern id="snap-grid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="0" cy="0" r="1.1" fill="#3b6fb5" opacity="0.32"/>
      </pattern>
    </defs>
  );
}

// ============ CLOUDS ============
// Soft hand-drawn clouds drift across the canvas in viewport space, so they
// always glide past regardless of pan/zoom. Pure SVG <animateTransform>.
function Clouds({ w, h, on }) {
  const clouds = useMemo(() => {
    if (!on) return [];
    return Array.from({ length: 6 }, (_, i) => ({
      y: 50 + (i * 73 + 23) % Math.max(1, Math.floor(h * 0.55)),
      scale: 0.7 + ((i * 17) % 9) / 12,
      dur: 70 + (i * 11) % 50,
      delay: -((i * 13) % 70),
      opacity: 0.18 + ((i * 7) % 12) / 80,
    }));
  }, [w, h, on]);
  if (!on) return null;
  return (
    <g pointerEvents="none">
      {clouds.map((c, i) => (
        <g key={i} opacity={c.opacity}>
          <animateTransform attributeName="transform" type="translate"
            from={`-280 ${c.y}`} to={`${w + 280} ${c.y}`}
            dur={`${c.dur}s`} begin={`${c.delay}s`} repeatCount="indefinite"/>
          <g transform={`scale(${c.scale})`}>
            <ellipse cx="0"   cy="0"   rx="46" ry="16" fill="#ffffff" stroke="#cdc4b0" strokeWidth="1.2"/>
            <ellipse cx="-28" cy="-6"  rx="22" ry="14" fill="#ffffff" stroke="#cdc4b0" strokeWidth="1.2"/>
            <ellipse cx="22"  cy="-4"  rx="26" ry="16" fill="#ffffff" stroke="#cdc4b0" strokeWidth="1.2"/>
            <ellipse cx="-8"  cy="-13" rx="20" ry="12" fill="#ffffff" stroke="#cdc4b0" strokeWidth="1.2"/>
            <ellipse cx="14"  cy="-12" rx="16" ry="10" fill="#ffffff" stroke="#cdc4b0" strokeWidth="1.2"/>
          </g>
        </g>
      ))}
    </g>
  );
}

// ============ WEATHER ============
// Renders falling rain or snow over the entire canvas. Pure SVG <animate>
// — declarative, no JS per frame.
function Weather({ kind, w, h }) {
  const particles = useMemo(() => {
    if (kind !== 'rain' && kind !== 'snow') return [];
    const count = kind === 'rain' ? 90 : 70;
    return Array.from({ length: count }, () => ({
      x: Math.random() * w,
      dur: kind === 'rain' ? 0.7 + Math.random() * 0.5 : 5 + Math.random() * 4,
      delay: Math.random() * (kind === 'rain' ? 1.2 : 8),
      drift: kind === 'snow' ? (Math.random() - 0.5) * 70 : 0,
      size: kind === 'snow' ? 1.5 + Math.random() * 1.4 : 1,
    }));
  }, [kind, w, h]);
  if (!particles.length) return null;
  const fall = h + 80;
  return (
    <g pointerEvents="none">
      {particles.map((p, i) => kind === 'rain' ? (
        <line key={i}
          x1={p.x} y1={-30} x2={p.x - 6} y2={-22}
          stroke="#6c8db5" strokeWidth="1.3" opacity="0.55">
          <animateTransform attributeName="transform" type="translate"
            from="0 0" to={`0 ${fall}`}
            dur={`${p.dur}s`} repeatCount="indefinite"
            begin={`-${p.delay}s`}/>
        </line>
      ) : (
        <circle key={i}
          cx={p.x} cy={-30} r={p.size}
          fill="#ffffff" stroke="rgba(120,120,140,0.35)" strokeWidth="0.4">
          <animateTransform attributeName="transform" type="translate"
            from="0 0" to={`${p.drift} ${fall}`}
            dur={`${p.dur}s`} repeatCount="indefinite"
            begin={`-${p.delay}s`}/>
        </circle>
      ))}
    </g>
  );
}

// Snap a world-space coord to the nearest 20 px grid point.
const SNAP_PX = 20;
function snapToGrid(x, y) {
  return {
    x: Math.round(x / SNAP_PX) * SNAP_PX,
    y: Math.round(y / SNAP_PX) * SNAP_PX,
  };
}

// Render the road network in layers, so crossings look like real roads:
// pass 1: thick dark borders (all streets)  → merges into a unified dark outline
// pass 2: lighter asphalt fill (all streets) → erases the borders at crossings
// pass 3: dashed centerlines, BUT broken at every intersection
// pass 4: invisible click-targets per street (so the user can still select)
function RoadNetwork({ streets, intersections, selectedId, multiSelected, onStreetClick, onStreetDouble, onStreetContextMenu, onEndpointMouseDown, hoverEndpoint }) {
  // For each street, find all intersection points and compute the "t" parameter
  // (0..1) along the segment so we know where to break the centerline.
  const breaks = useMemo(() => {
    const map = new Map(); // streetId -> array of t values (sorted)
    streets.forEach(s => map.set(s.id, []));
    intersections.forEach(it => {
      // recover t for streetA and streetB
      const sa = streets.find(s => s.id === it.streetA);
      const sb = streets.find(s => s.id === it.streetB);
      if (sa) {
        const len = Math.hypot(sa.x2 - sa.x1, sa.y2 - sa.y1);
        const t = len > 0
          ? Math.hypot(it.x - sa.x1, it.y - sa.y1) / len
          : 0;
        map.get(sa.id).push(t);
      }
      if (sb) {
        const len = Math.hypot(sb.x2 - sb.x1, sb.y2 - sb.y1);
        const t = len > 0
          ? Math.hypot(it.x - sb.x1, it.y - sb.y1) / len
          : 0;
        map.get(sb.id).push(t);
      }
    });
    map.forEach((arr, id) => arr.sort((a, b) => a - b));
    return map;
  }, [streets, intersections]);

  // Build dashed-centerline sub-segments for one street, skipping a small
  // gap (in pixels) around each intersection.
  function centerSubsegments(s) {
    const ts = breaks.get(s.id) || [];
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len === 0) return [];
    const GAP_PX = 22; // half-gap on each side of intersection
    const halfT = GAP_PX / len;
    // build kept intervals from [0,1], removing [t-half, t+half] for each break
    let intervals = [[0, 1]];
    ts.forEach(t => {
      const lo = Math.max(0, t - halfT);
      const hi = Math.min(1, t + halfT);
      const next = [];
      intervals.forEach(([a, b]) => {
        if (hi <= a || lo >= b) { next.push([a, b]); return; }
        if (lo > a) next.push([a, lo]);
        if (hi < b) next.push([hi, b]);
      });
      intervals = next;
    });
    return intervals
      .filter(([a, b]) => b - a > 0.01)
      .map(([a, b]) => ({
        x1: s.x1 + a * (s.x2 - s.x1),
        y1: s.y1 + a * (s.y2 - s.y1),
        x2: s.x1 + b * (s.x2 - s.x1),
        y2: s.y1 + b * (s.y2 - s.y1),
      }));
  }

  return (
    <g className="road-network">
      {/* PASS 1: dark borders (drawn under everything else) */}
      <g>
        {streets.map(s => (
          <line key={'b-'+s.id}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="#b8b8b8" strokeWidth="36" strokeLinecap="round"
            pointerEvents="none"/>
        ))}
      </g>
      {/* PASS 2: asphalt fill — covers borders at crossings, unifying network */}
      <g>
        {streets.map(s => (
          <line key={'f-'+s.id}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke="#ececec" strokeWidth="30" strokeLinecap="round"
            pointerEvents="none"/>
        ))}
      </g>
      {/* PASS 3: dashed centerlines, broken at intersections */}
      <g>
        {streets.flatMap(s => centerSubsegments(s).map((seg, i) => (
          <line key={`c-${s.id}-${i}`}
            x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
            stroke="#ffffff" strokeWidth="2.5" strokeDasharray="12 9"
            opacity="0.95" pointerEvents="none"/>
        )))}
      </g>
      {/* PASS 4: street name labels — placed at the midpoint of the LONGEST
          gap between intersections, so the label doesn't sit on top of a
          traffic light or the intersection itself. */}
      <g>
        {streets.map(s => {
          if (!s.name) return null;
          const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
          if (len < 80) return null;
          const ts = breaks.get(s.id) || [];
          const stops = [0, ...ts, 1];
          // Pick the gap whose midpoint is CLOSEST to t = 0.5 (the road's
          // visual center), not just the longest one. Falls back to the
          // longest gap if nothing's wide enough at the center.
          const minGap = 70 / len; // need this much room for the chip
          let bestStart = 0, bestEnd = 1, bestDist = Infinity;
          for (let i = 0; i < stops.length - 1; i++) {
            const a = stops[i], b = stops[i + 1];
            if (b - a < minGap) continue;
            const mid = (a + b) / 2;
            const dist = Math.abs(mid - 0.5);
            if (dist < bestDist) { bestDist = dist; bestStart = a; bestEnd = b; }
          }
          if (bestDist === Infinity) return null;
          const midT = (bestStart + bestEnd) / 2;
          const midX = s.x1 + midT * (s.x2 - s.x1);
          const midY = s.y1 + midT * (s.y2 - s.y1);
          const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1) * 180 / Math.PI;
          let textAngle = angle;
          if (textAngle > 90) textAngle -= 180;
          if (textAngle < -90) textAngle += 180;
          const labelW = Math.max(60, (s.name || '').length * 9 + 14);
          return (
            <g key={'lbl-'+s.id}
              transform={`translate(${midX},${midY}) rotate(${textAngle})`}
              pointerEvents="none">
              <rect x={-labelW/2} y={-12} width={labelW} height={20} rx={6}
                    className="street-name-bg"/>
              <text className="street-name" textAnchor="middle" dy="3">{s.name}</text>
            </g>
          );
        })}
      </g>
      {/* PASS 5: invisible hit-targets for selection / dbl-click rename */}
      <g>
        {streets.map(s => {
          const sel = (selectedId?.kind === 'street' && selectedId.id === s.id) ||
                      (multiSelected && multiSelected.has(`street:${s.id}`));
          return (
            <g key={'hit-'+s.id}>
              {sel && (
                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                      stroke="#3b6fb5" strokeWidth="44" strokeLinecap="round"
                      opacity="0.18" pointerEvents="none"/>
              )}
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke="transparent" strokeWidth="36" strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => onStreetClick(s, e)}
                    onDoubleClick={(e) => onStreetDouble(s, e)}
                    onContextMenu={(e) => onStreetContextMenu && onStreetContextMenu(s, e)}/>
              {sel && onEndpointMouseDown && (
                <g>
                  <circle cx={s.x1} cy={s.y1} r="9" fill="#fff" stroke="#3b6fb5" strokeWidth="2.5"
                          style={{ cursor: 'move' }}
                          onMouseDown={(e) => { e.stopPropagation(); onEndpointMouseDown(s.id, 1, e); }}/>
                  <circle cx={s.x2} cy={s.y2} r="9" fill="#fff" stroke="#3b6fb5" strokeWidth="2.5"
                          style={{ cursor: 'move' }}
                          onMouseDown={(e) => { e.stopPropagation(); onEndpointMouseDown(s.id, 2, e); }}/>
                </g>
              )}
            </g>
          );
        })}
      </g>
      {hoverEndpoint && (
        <g pointerEvents="none">
          <circle cx={hoverEndpoint.x} cy={hoverEndpoint.y} r="14"
                  fill="none" stroke="#d97757" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.9"/>
        </g>
      )}
    </g>
  );
}

function Intersection({ it, showAngles }) {
  if (!showAngles) return null;
  if (it.type === 'right') {
    return (
      <g pointerEvents="none">
        <circle cx={it.x} cy={it.y} r="2.5" fill="#3b6fb5"/>
        <g transform={`translate(${it.x + 12}, ${it.y - 12})`}>
          <rect x="-3" y="-11" width="34" height="15" rx="3"
                fill="rgba(255,255,255,0.95)" stroke="#3b6fb5" strokeWidth="1"/>
          <text x="3" y="0" className="angle-label" fill="#3b6fb5">⊥ 90°</text>
        </g>
      </g>
    );
  }
  // Non-right: show BOTH the acute and obtuse pair (they sum to 180°)
  const acuteDeg = Math.min(it.deg, 180 - it.deg);
  const obtuseDeg = 180 - acuteDeg;
  return (
    <g pointerEvents="none">
      <circle cx={it.x} cy={it.y} r="2.5" fill="#8a5fb0"/>
      <g transform={`translate(${it.x + 12}, ${it.y - 12})`}>
        <rect x="-3" y="-11" width="46" height="15" rx="3"
              fill="rgba(255,255,255,0.95)" stroke="#d94c3a" strokeWidth="1"/>
        <text x="3" y="0" className="angle-label" fill="#d94c3a">◁ {Math.round(acuteDeg)}°</text>
      </g>
      <g transform={`translate(${it.x + 12}, ${it.y + 8})`}>
        <rect x="-3" y="-11" width="46" height="15" rx="3"
              fill="rgba(255,255,255,0.95)" stroke="#8a5fb0" strokeWidth="1"/>
        <text x="3" y="0" className="angle-label" fill="#8a5fb0">◆ {Math.round(obtuseDeg)}°</text>
      </g>
    </g>
  );
}

// Building rendered via inline SVG markup
// Long-press helper for touch — fires onContextMenu after 600 ms if pointer
// hasn't moved >6 px or lifted. Mouse pointers are skipped (right-click
// already opens the menu).
function useLongPress(onLongPress) {
  const ref = useRef(null);
  function start(e) {
    if (e.pointerType === 'mouse' || !onLongPress) return;
    const sx = e.clientX, sy = e.clientY;
    ref.current = setTimeout(() => onLongPress(e, sx, sy), 600);
    e.currentTarget._lpsx = sx;
    e.currentTarget._lpsy = sy;
  }
  function move(e) {
    if (ref.current && (Math.abs(e.clientX - e.currentTarget._lpsx) > 6 ||
                        Math.abs(e.clientY - e.currentTarget._lpsy) > 6)) {
      clearTimeout(ref.current); ref.current = null;
    }
  }
  function end() { if (ref.current) { clearTimeout(ref.current); ref.current = null; } }
  return { onPointerDown: start, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
}

function Building({ b, def, selected, onMouseDown, onClick, onDoubleClick, onContextMenu }) {
  if (!def) return null;
  const inner = def.draw(b.variant || 0);
  const longPress = useLongPress((e, x, y) => onContextMenu && onContextMenu({
    preventDefault: () => {}, stopPropagation: () => {}, clientX: x, clientY: y,
  }));
  return (
    <g
      transform={`translate(${b.x},${b.y}) rotate(${b.rot || 0})`}
      onMouseDown={onMouseDown}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      {...longPress}
      style={{ cursor: 'grab' }}
    >
      {selected && (
        <rect x={-def.size/2 - 4} y={-def.size/2 - 4}
              width={def.size + 8} height={def.size + 8}
              fill="none" stroke="#3b6fb5" strokeWidth="2"
              strokeDasharray="4 3" rx="6"/>
      )}
      <g filter="url(#bldg-shadow)" dangerouslySetInnerHTML={{ __html: inner }}/>
      {b.label && def.size >= 30 && (
        <text className="building-label" y={def.size/2 + 13}>{b.label}</text>
      )}
    </g>
  );
}

// Protractor overlay — kept for completeness but no longer used.
function Protractor({ it }) {
  return null;
}

// ============ CITY LIFE: animated cars/buses ============
// Vehicles ride along the road network, traversing one segment at a time.
// On reaching an endpoint they pick a random connected segment (within 12 px)
// to continue on; if none exist, they reverse. Pauses fire ~5%/s for variety.
const VEHICLE_KINDS = new Set(['car', 'bus']);

const VehicleVisual = React.memo(function VehicleVisual({ kind, variant }) {
  const def = Buildings.getDef(kind);
  if (!def) return null;
  return <g dangerouslySetInnerHTML={{ __html: def.draw(variant || 0) }}/>;
});

function projectClosest(streets, x, y) {
  let best = null, bestD = Infinity;
  for (const s of streets) {
    const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
    const px = s.x1 + t * dx, py = s.y1 + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < bestD) { bestD = d; best = { street: s, t, dist: d }; }
  }
  return best;
}

// ============ SOUND ============
// Web Audio synthesis — no external files. Lazy AudioContext (browsers
// require it created/resumed in response to a user gesture).
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}
function playFireSiren() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(620, t0);
  osc.frequency.linearRampToValueAtTime(940, t0 + 0.45);
  osc.frequency.linearRampToValueAtTime(620, t0 + 0.9);
  osc.frequency.linearRampToValueAtTime(940, t0 + 1.35);
  osc.frequency.linearRampToValueAtTime(620, t0 + 1.8);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.025, t0 + 0.08);
  gain.gain.setValueAtTime(0.025, t0 + 1.7);
  gain.gain.linearRampToValueAtTime(0, t0 + 1.9);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + 2);
}
function playPoliceSiren() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  for (let i = 0; i < 6; i++) {
    osc.frequency.setValueAtTime(720, t0 + i * 0.3);
    osc.frequency.setValueAtTime(940, t0 + i * 0.3 + 0.15);
  }
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.022, t0 + 0.08);
  gain.gain.setValueAtTime(0.022, t0 + 1.7);
  gain.gain.linearRampToValueAtTime(0, t0 + 1.85);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + 1.9);
}
function playBusDing() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t0);
  osc.frequency.linearRampToValueAtTime(1320, t0 + 0.06);
  gain.gain.setValueAtTime(0.05, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0); osc.stop(t0 + 0.4);
}

// Light cycle: each right-angle intersection alternates which street is green.
// Phase 0 = streetA green / streetB red. Phase 1 = streetA red / streetB green.
const LIGHT_CYCLE_MS = 6500;
function currentLightPhase(now) { return Math.floor(now / LIGHT_CYCLE_MS) % 2; }

// Half-length (along travel) of each rendered vehicle, used to compute
// edge-to-edge gap so a car doesn't park on top of a longer bus's rear.
const HALF_LEN = { car: 11, bus: 21, firetruck: 13, policecar: 12 };
function halfLenForKind(kind) { return HALF_LEN[kind] || 11; }

// Snapshot of every road occupant for car-following / collision avoidance.
function buildOccupancy(motion, vehicles, fireTrucks, policeCars) {
  const out = [];
  const kindById = new Map(vehicles.map(v => [v.id, v.kind]));
  motion.forEach((m, id) => {
    out.push({ id, streetId: m.streetId, t: m.t, dir: m.dir, halfLen: halfLenForKind(kindById.get(id)) });
  });
  for (const t of fireTrucks)  out.push({ id: t.id, streetId: t.streetId, t: t.t, dir: t.dir, halfLen: HALF_LEN.firetruck });
  for (const t of policeCars)  out.push({ id: t.id, streetId: t.streetId, t: t.t, dir: t.dir, halfLen: HALF_LEN.policecar });
  return out;
}

// Returns the closest edge-to-edge gap to any occupant ahead of (selfId, m)
// on the same street going the same direction, in pixels. Infinity if clear.
function closestAheadGap(occupancy, selfId, m, len, selfHalfLen) {
  let best = Infinity;
  for (const o of occupancy) {
    if (o.id === selfId) continue;
    if (o.streetId !== m.streetId) continue;
    if (o.dir !== m.dir) continue;
    const ahead = m.dir > 0 ? o.t > m.t : o.t < m.t;
    if (!ahead) continue;
    const centerDist = Math.abs(o.t - m.t) * len;
    const gap = centerDist - o.halfLen - selfHalfLen;
    if (gap < best) best = gap;
  }
  return best;
}

const FOLLOW_STOP_GAP = 5;   // hold position when bumper gap < this
const FOLLOW_SLOW_GAP = 38;  // start slowing within this gap

function stepVehicles(motion, vehicles, streets, busStops, lightInfo, occupancy, sound, dt, now) {
  // prune motion entries for vehicles that no longer exist
  const valid = new Set(vehicles.map(v => v.id));
  for (const id of Array.from(motion.keys())) {
    if (!valid.has(id)) motion.delete(id);
  }
  for (const v of vehicles) {
    let m = motion.get(v.id);
    if (!m) {
      const near = projectClosest(streets, v.x, v.y);
      if (!near) continue;
      const isBus = v.kind === 'bus';
      m = {
        streetId: near.street.id,
        t: near.t,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: isBus ? 40 + Math.random() * 50 : 70 + Math.random() * 90,
        pauseUntil: 0,
        lastStopId: null,
        lastStopAt: 0,
      };
      motion.set(v.id, m);
    }
    const s = streets.find(st => st.id === m.streetId);
    if (!s) { motion.delete(v.id); continue; }
    if (m.pauseUntil > now) continue;

    // Bus stop check — buses pause briefly when within 30px of a stop.
    // Cooldown of 8s per stop so they don't get stuck repeatedly pausing
    // at the same one as they ease away.
    if (v.kind === 'bus' && busStops.length > 0) {
      const dx0 = s.x2 - s.x1, dy0 = s.y2 - s.y1;
      const px = s.x1 + m.t * dx0;
      const py = s.y1 + m.t * dy0;
      for (const bs of busStops) {
        if (Math.hypot(bs.x - px, bs.y - py) < 30) {
          if (m.lastStopId !== bs.id || now - m.lastStopAt > 8000) {
            m.pauseUntil = now + 1500 + Math.random() * 1500;
            m.lastStopId = bs.id;
            m.lastStopAt = now;
            if (sound) sound('bus');
            break;
          }
        }
      }
      if (m.pauseUntil > now) continue;
    }

    if (Math.random() < 0.05 * dt) {
      m.pauseUntil = now + 500 + Math.random() * 2000;
      continue;
    }
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len === 0) continue;

    // Red-light obedience: if there's a right-angle intersection ahead within
    // 6-28 px and the vehicle's street is currently red, hold position.
    if (lightInfo && lightInfo.byStreet) {
      const lights = lightInfo.byStreet.get(m.streetId);
      if (lights) {
        for (const l of lights) {
          const ahead = m.dir > 0 ? l.tInt > m.t : l.tInt < m.t;
          if (!ahead) continue;
          const dist = Math.abs(l.tInt - m.t) * len;
          // Stop zone pushed outward so cars halt clearly BEFORE the
          // traffic light box (which sits ~28 px past the intersection
          // center along the road).
          if (dist < 14 || dist > 40) continue;
          const greenForMe = l.isStreetA ? lightInfo.phase === 0 : lightInfo.phase === 1;
          if (!greenForMe) {
            m.pauseUntil = now + 220; // re-check ~5x/sec
            break;
          }
        }
        if (m.pauseUntil > now) continue;
      }
    }

    // Car-following: brake/stop if another vehicle occupies the road ahead.
    let speedScale = 1;
    if (occupancy) {
      const selfHalf = halfLenForKind(v.kind);
      const gap = closestAheadGap(occupancy, v.id, m, len, selfHalf);
      if (gap < FOLLOW_STOP_GAP) {
        m.pauseUntil = now + 180;
        continue;
      }
      if (gap < FOLLOW_SLOW_GAP) {
        speedScale = (gap - FOLLOW_STOP_GAP) / (FOLLOW_SLOW_GAP - FOLLOW_STOP_GAP);
        if (speedScale < 0.15) speedScale = 0.15;
      }
    }

    m.t += m.dir * (m.speed * speedScale * dt) / len;

    if (m.t > 1 || m.t < 0) {
      const reachedEnd = m.t > 1 ? 2 : 1;
      const cx = reachedEnd === 2 ? s.x2 : s.x1;
      const cy = reachedEnd === 2 ? s.y2 : s.y1;
      const conns = [];
      for (const o of streets) {
        if (o.id === s.id) continue;
        if (Math.hypot(o.x1 - cx, o.y1 - cy) < 14) conns.push({ street: o, end: 1 });
        if (Math.hypot(o.x2 - cx, o.y2 - cy) < 14) conns.push({ street: o, end: 2 });
      }
      if (conns.length > 0) {
        const next = conns[Math.floor(Math.random() * conns.length)];
        m.streetId = next.street.id;
        m.dir = next.end === 1 ? 1 : -1;
        m.t = next.end === 1 ? 0.001 : 0.999;
      } else {
        m.dir = -m.dir;
        m.t = m.t > 1 ? 1 : 0;
      }
    }
  }
}

// ============ PEDESTRIANS ============
const SKIN_COLORS = ['#f4d4b6','#e3b896','#c9956b','#9a6e4a','#7a4f30','#dab28e'];
const SHIRT_COLORS = ['#3b6fb5','#d94c3a','#4f8b4a','#e7b94a','#8a5fb0','#de8348','#d97ba0','#5a8aa0'];

// Sidewalk offset (perpendicular distance from road centerline) where
// pedestrians walk. The road's full painted width is ~36 px so 23 keeps
// peds clearly OFF the asphalt and onto the curb.
const SIDEWALK_OFFSET = 23;

// True if any point along the segment (a)-(b) sits within `clearance` px of
// any road centerline. Used to confine "visiting" peds to one block.
function lineCrossesAnyRoad(ax, ay, bx, by, streets, clearance = 18) {
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + t * (bx - ax);
    const y = ay + t * (by - ay);
    for (const seg of streets) {
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let tt = ((x - seg.x1) * dx + (y - seg.y1) * dy) / len2;
      if (tt < 0) tt = 0; else if (tt > 1) tt = 1;
      const px = seg.x1 + tt * dx, py = seg.y1 + tt * dy;
      if (Math.hypot(x - px, y - py) < clearance) return true;
    }
  }
  return false;
}

// Building kinds that pedestrians might pop into. Excludes tiny decor and
// anything that moves on its own.
function isVisitableBuilding(b) {
  return b.kind !== 'tree' && b.kind !== 'flower' && b.kind !== 'bench'
      && b.kind !== 'mailbox' && b.kind !== 'streetlight'
      && b.kind !== 'busStop' && b.kind !== 'fountain'
      && b.kind !== 'car' && b.kind !== 'bus';
}

// Try to pick two visit-eligible buildings within 60-220 px of each other
// where a straight line between them doesn't cross a road. Falls back to
// null after `tries` attempts so the caller can spawn a sidewalk ped instead.
function findVisitPair(buildings, streets, anchorX, anchorY, tries = 6) {
  const visitables = buildings.filter(isVisitableBuilding);
  if (visitables.length < 2) return null;
  for (let n = 0; n < tries; n++) {
    let a;
    if (anchorX != null) {
      // Bias the first pick toward `anchor` so peds stay local.
      const nearby = visitables.filter(b => Math.hypot(b.x - anchorX, b.y - anchorY) < 260);
      a = (nearby.length ? nearby : visitables)[Math.floor(Math.random() * (nearby.length || visitables.length))];
    } else {
      a = visitables[Math.floor(Math.random() * visitables.length)];
    }
    const cand = visitables.filter(b => {
      if (b === a) return false;
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      return d > 50 && d < 220;
    });
    if (!cand.length) continue;
    const b = cand[Math.floor(Math.random() * cand.length)];
    if (!lineCrossesAnyRoad(a.x, a.y, b.x, b.y, streets)) return { a, b };
  }
  return null;
}

function stepPedestrians(peds, streets, lightInfo, buildings, pedTarget, dt, now) {
  if (!streets.length) { peds.length = 0; return; }
  const TARGET = Math.max(0, Math.min(40, pedTarget != null ? pedTarget : 8));
  if (TARGET === 0) { peds.length = 0; return; }

  // Spawn mix: when buildings are available, ~45% of peds visit between
  // nearby places in the same block. Rest stay on sidewalks.
  while (peds.length < TARGET) {
    const wantVisit = buildings && buildings.length >= 2 && Math.random() < 0.45;
    let p = null;
    if (wantVisit) {
      const pair = findVisitPair(buildings, streets);
      if (pair) {
        const jx = () => (Math.random() - 0.5) * 26;
        p = {
          id: `p-${now.toFixed(0)}-${peds.length}-${Math.random().toString(36).slice(2,5)}`,
          mode: 'visiting',
          fromX: pair.a.x + jx(), fromY: pair.a.y + jx(),
          toX:   pair.b.x + jx(), toY:   pair.b.y + jx(),
          x: pair.a.x, y: pair.a.y,
          goingTo: 'to',
          tripsLeft: 4 + Math.floor(Math.random() * 4),
          speed: 16 + Math.random() * 12,
          skin: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
          shirt: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
          stride: 0, strideAt: now, pauseUntil: 0,
        };
      }
    }
    if (!p) {
      const street = streets[Math.floor(Math.random() * streets.length)];
      p = {
        id: `p-${now.toFixed(0)}-${peds.length}-${Math.random().toString(36).slice(2,5)}`,
        mode: 'sidewalk',
        streetId: street.id,
        t: Math.random(),
        dir: Math.random() < 0.5 ? 1 : -1,
        side: Math.random() < 0.5 ? 1 : -1,
        speed: 16 + Math.random() * 12,
        skin: SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)],
        shirt: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
        stride: 0, strideAt: now, pauseUntil: 0,
        crossFrom: 0, crossTo: 0, crossT: 0,
        x: 0, y: 0,
      };
    }
    peds.push(p);
  }
  if (peds.length > TARGET) peds.length = TARGET;

  for (const p of peds) {
    // ---- Visiting peds: walk between two nearby buildings ----
    if (p.mode === 'visiting') {
      if (p.pauseUntil <= now) {
        const tgtX = p.goingTo === 'to' ? p.toX : p.fromX;
        const tgtY = p.goingTo === 'to' ? p.toY : p.fromY;
        const dx = tgtX - p.x, dy = tgtY - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          // Arrived — pause and swap target.
          p.pauseUntil = now + 1200 + Math.random() * 2200;
          p.goingTo = p.goingTo === 'to' ? 'from' : 'to';
          p.tripsLeft--;
          if (p.tripsLeft <= 0 && buildings && buildings.length >= 2) {
            const pair = findVisitPair(buildings, streets, p.x, p.y);
            if (pair) {
              const jx = () => (Math.random() - 0.5) * 26;
              p.fromX = pair.a.x + jx(); p.fromY = pair.a.y + jx();
              p.toX   = pair.b.x + jx(); p.toY   = pair.b.y + jx();
              p.tripsLeft = 4 + Math.floor(Math.random() * 4);
              p.goingTo = 'to';
            } else {
              p.tripsLeft = 4;
            }
          }
        } else {
          if (Math.random() < 0.025 * dt) {
            p.pauseUntil = now + 600 + Math.random() * 1400;
          } else {
            const step = Math.min(p.speed * dt, dist);
            p.x += (dx / dist) * step;
            p.y += (dy / dist) * step;
          }
        }
      }
      if (p.pauseUntil <= now && now - p.strideAt > 320) {
        p.stride = p.stride ? 0 : 1;
        p.strideAt = now;
      }
      continue;
    }

    // ---- Sidewalk peds (existing behavior) ----
    // Animate active road-cross
    if (p.crossT > 0) {
      p.crossT -= dt / 1.4; // ~1.4s to cross
      if (p.crossT <= 0) {
        p.crossT = 0;
        p.side = p.crossTo;
      }
    }

    if (p.pauseUntil > now) { /* still update render position below */ }
    else {
      // Occasional standing pause (chatting, looking around)
      if (Math.random() < 0.04 * dt) {
        p.pauseUntil = now + 800 + Math.random() * 2000;
      } else {
        const street = streets.find(s => s.id === p.streetId);
        if (!street) {
          p.streetId = streets[Math.floor(Math.random() * streets.length)].id;
          p.t = Math.random();
          continue;
        }
        const dx = street.x2 - street.x1, dy = street.y2 - street.y1;
        const len = Math.hypot(dx, dy) || 1;
        p.t += p.dir * (p.speed * dt) / len;

        if (p.t > 1 || p.t < 0) {
          // Reached an endpoint — choose: continue onto a connected street,
          // reverse, or cross (only if the light is red for this street).
          const reachedEnd = p.t > 1 ? 2 : 1;
          const cx = reachedEnd === 2 ? street.x2 : street.x1;
          const cy = reachedEnd === 2 ? street.y2 : street.y1;
          const conns = [];
          for (const o of streets) {
            if (o.id === street.id) continue;
            if (Math.hypot(o.x1 - cx, o.y1 - cy) < 14) conns.push({ street: o, end: 1 });
            if (Math.hypot(o.x2 - cx, o.y2 - cy) < 14) conns.push({ street: o, end: 2 });
          }
          // Is it safe to cross our current street here? Only at a
          // right-angle intersection AND only when our street has a red
          // light (cars stopped).
          let canCross = false;
          if (lightInfo && lightInfo.byStreet && p.crossT === 0) {
            const lights = lightInfo.byStreet.get(p.streetId) || [];
            for (const l of lights) {
              if (Math.abs(l.tInt - p.t) < 0.06) {
                const greenForCars = l.isStreetA ? lightInfo.phase === 0 : lightInfo.phase === 1;
                if (!greenForCars) { canCross = true; break; }
              }
            }
          }

          const roll = Math.random();
          if (canCross && roll < 0.35) {
            // Start an animated cross to the other sidewalk
            p.crossFrom = p.side;
            p.crossTo = -p.side;
            p.crossT = 1;
            p.t = p.t > 1 ? 1 : 0;
            p.dir = -p.dir;
          } else if (conns.length && roll < 0.7) {
            const next = conns[Math.floor(Math.random() * conns.length)];
            p.streetId = next.street.id;
            p.dir = next.end === 1 ? 1 : -1;
            p.t = next.end === 1 ? 0.001 : 0.999;
            // Maybe try the inside corner sidewalk
            if (Math.random() < 0.4) p.side = -p.side;
          } else {
            p.dir = -p.dir;
            p.t = p.t > 1 ? 1 : 0;
          }
        }
      }
    }

    // Render position: along current street at t, offset perpendicular
    // by SIDEWALK_OFFSET on `side`. While crossing, side is interpolated.
    const street = streets.find(s => s.id === p.streetId);
    if (!street) continue;
    const dx2 = street.x2 - street.x1, dy2 = street.y2 - street.y1;
    const len2 = Math.hypot(dx2, dy2) || 1;
    const ux = dx2 / len2, uy = dy2 / len2;
    const renderSide = p.crossT > 0
      ? p.crossFrom * p.crossT + p.crossTo * (1 - p.crossT)
      : p.side;
    const perpX = -uy * renderSide;
    const perpY =  ux * renderSide;
    p.x = street.x1 + p.t * dx2 + perpX * SIDEWALK_OFFSET;
    p.y = street.y1 + p.t * dy2 + perpY * SIDEWALK_OFFSET;

    if (p.pauseUntil <= now && now - p.strideAt > (p.crossT > 0 ? 220 : 320)) {
      p.stride = p.stride ? 0 : 1;
      p.strideAt = now;
    }
  }
}

function Person({ p }) {
  const off = p.stride ? 0.6 : -0.6;
  return (
    <g transform={`translate(${p.x},${p.y})`}>
      <circle cx="0" cy="-4" r="2.2" fill={p.skin} stroke="#2a2418" strokeWidth="0.4"/>
      <rect x="-2" y="-2" width="4" height="5" rx="1" fill={p.shirt} stroke="#2a2418" strokeWidth="0.4"/>
      <line x1="-1" y1="3" x2={-1 + off} y2="6" stroke="#2a2418" strokeWidth="0.9"/>
      <line x1="1"  y1="3" x2={1 - off}  y2="6" stroke="#2a2418" strokeWidth="0.9"/>
    </g>
  );
}

// ============ ROUTE PLANNING (BFS over road-segment adjacency) ============
// Two segments are connected if they share an endpoint within 14 px (same
// tolerance the random-walk vehicles use). Returns array of step objects:
//   [{ id, enterEnd, exitEnd }, ...]   — null if no route.
function buildSegmentAdjacency(streets) {
  const adj = new Map();
  for (const s of streets) adj.set(s.id, []);
  for (let i = 0; i < streets.length; i++) {
    for (let j = i + 1; j < streets.length; j++) {
      const a = streets[i], b = streets[j];
      const tries = [
        [a.x1, a.y1, 1, b.x1, b.y1, 1],
        [a.x1, a.y1, 1, b.x2, b.y2, 2],
        [a.x2, a.y2, 2, b.x1, b.y1, 1],
        [a.x2, a.y2, 2, b.x2, b.y2, 2],
      ];
      for (const [ax, ay, aend, bx, by, bend] of tries) {
        if (Math.hypot(ax - bx, ay - by) < 14) {
          adj.get(a.id).push({ otherId: b.id, myEnd: aend, otherEnd: bend });
          adj.get(b.id).push({ otherId: a.id, myEnd: bend, otherEnd: aend });
          break;
        }
      }
    }
  }
  return adj;
}
function findRoutePath(streets, startSegId, endSegId) {
  if (startSegId === endSegId) return [{ id: startSegId, enterEnd: null, exitEnd: null }];
  const adj = buildSegmentAdjacency(streets);
  const prev = new Map(); // segId -> { fromId, enterEnd (this side), exitEnd (from-side) }
  prev.set(startSegId, null);
  const queue = [startSegId];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === endSegId) break;
    for (const conn of adj.get(cur) || []) {
      if (prev.has(conn.otherId)) continue;
      prev.set(conn.otherId, { fromId: cur, enterEnd: conn.otherEnd, exitEndOfFrom: conn.myEnd });
      queue.push(conn.otherId);
    }
  }
  if (!prev.has(endSegId)) return null;
  // Reconstruct path
  const reverse = [{ id: endSegId, enterEnd: prev.get(endSegId)?.enterEnd ?? null, exitEnd: null }];
  let cur = endSegId;
  while (prev.get(cur)) {
    const step = prev.get(cur);
    const fromInfo = prev.get(step.fromId);
    reverse.push({
      id: step.fromId,
      enterEnd: fromInfo ? fromInfo.enterEnd : null,
      exitEnd: step.exitEndOfFrom,
    });
    cur = step.fromId;
  }
  return reverse.reverse();
}
// Expose for app-main.jsx (which doesn't share module scope here).
window.RoutePlanner = {
  findRoutePath: (...a) => findRoutePath(...a),
  precomputeRouteSegments: (...a) => precomputeRouteSegments(...a),
  projectClosest: (...a) => projectClosest(...a),
};
function precomputeRouteSegments(path, startT, endT) {
  // Returns [{ streetId, fromT, toT, dir }] ready to drive along.
  return path.map((p, i) => {
    const isFirst = i === 0, isLast = i === path.length - 1;
    const fromT = isFirst ? startT : (p.enterEnd === 1 ? 0 : 1);
    const toT   = isLast  ? endT   : (p.exitEnd  === 1 ? 0 : 1);
    return { streetId: p.id, fromT, toT, dir: toT >= fromT ? 1 : -1 };
  });
}

// ============ EMERGENCY DISPATCH (fire trucks, police cars) ============
const FIRE_CFG = {
  kind: 'firetruck', cap: 1,
  speedMin: 110, speedMax: 160,
  lifetimeMin: 12000, lifetimeMax: 20000,
  cooldownMin: 70, cooldownMax: 150,
};
const POLICE_CFG = {
  kind: 'policecar', cap: 1,
  speedMin: 100, speedMax: 150,
  lifetimeMin: 15000, lifetimeMax: 25000,
  cooldownMin: 55, cooldownMax: 130,
};

function stepDispatchedFleet(items, cooldownRef, stations, streets, occupancy, sound, dt, now, cfg) {
  cooldownRef.current -= dt;

  if (cooldownRef.current <= 0 && stations.length > 0 && streets.length > 0 && items.length < cfg.cap) {
    const station = stations[Math.floor(Math.random() * stations.length)];
    const near = projectClosest(streets, station.x, station.y);
    if (near && near.dist < 200) {
      items.push({
        id: `${cfg.kind}-${now.toFixed(0)}-${Math.random().toString(36).slice(2,5)}`,
        kind: cfg.kind,
        streetId: near.street.id,
        t: near.t,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
        despawnAt: now + cfg.lifetimeMin + Math.random() * (cfg.lifetimeMax - cfg.lifetimeMin),
        x: station.x, y: station.y,
        rot: 0, flipX: false,
        blink: true, blinkAt: now,
      });
      if (sound) sound(cfg.kind === 'firetruck' ? 'fire' : 'police');
    }
    cooldownRef.current = cfg.cooldownMin + Math.random() * (cfg.cooldownMax - cfg.cooldownMin);
  }

  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (now > it.despawnAt) { items.splice(i, 1); continue; }
    if (now - it.blinkAt > 240) { it.blink = !it.blink; it.blinkAt = now; }

    const s = streets.find(st => st.id === it.streetId);
    if (!s) { items.splice(i, 1); continue; }
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len === 0) continue;

    // Don't ram civilians — slow / stop when something's on the road ahead.
    let speedScale = 1;
    if (occupancy) {
      const selfHalf = halfLenForKind(it.kind);
      const gap = closestAheadGap(occupancy, it.id, it, len, selfHalf);
      if (gap < FOLLOW_STOP_GAP) continue;
      if (gap < FOLLOW_SLOW_GAP) {
        speedScale = (gap - FOLLOW_STOP_GAP) / (FOLLOW_SLOW_GAP - FOLLOW_STOP_GAP);
        if (speedScale < 0.2) speedScale = 0.2;
      }
    }

    it.t += it.dir * (it.speed * speedScale * dt) / len;

    if (it.t > 1 || it.t < 0) {
      const reachedEnd = it.t > 1 ? 2 : 1;
      const cx = reachedEnd === 2 ? s.x2 : s.x1;
      const cy = reachedEnd === 2 ? s.y2 : s.y1;
      const conns = [];
      for (const o of streets) {
        if (o.id === s.id) continue;
        if (Math.hypot(o.x1 - cx, o.y1 - cy) < 14) conns.push({ street: o, end: 1 });
        if (Math.hypot(o.x2 - cx, o.y2 - cy) < 14) conns.push({ street: o, end: 2 });
      }
      if (conns.length > 0) {
        const next = conns[Math.floor(Math.random() * conns.length)];
        it.streetId = next.street.id;
        it.dir = next.end === 1 ? 1 : -1;
        it.t = next.end === 1 ? 0.001 : 0.999;
      } else {
        it.dir = -it.dir;
        it.t = it.t > 1 ? 1 : 0;
      }
    }

    const sNow = streets.find(st => st.id === it.streetId);
    if (!sNow) continue;
    const dx = sNow.x2 - sNow.x1, dy = sNow.y2 - sNow.y1;
    const ll = Math.hypot(dx, dy) || 1;
    const dirX = (it.dir > 0 ? dx : -dx) / ll;
    const dirY = (it.dir > 0 ? dy : -dy) / ll;
    const rx = -dirY, ry = dirX;
    it.x = sNow.x1 + it.t * dx + rx * 9;
    it.y = sNow.y1 + it.t * dy + ry * 9;
    let rot = Math.atan2(dirY, dirX) * 180 / Math.PI;
    let flipX = false;
    if (rot > 90) { rot -= 180; flipX = true; }
    else if (rot < -90) { rot += 180; flipX = true; }
    it.rot = rot; it.flipX = flipX;
  }
}

function FireTruckGfx({ blink }) {
  return (
    <g>
      {blink && <circle cx="0" cy="-7" r="9" fill="#ff3030" opacity="0.22"/>}
      <rect x="-13" y="-5" width="26" height="10" rx="2" fill="#d94c3a" stroke="#2a2418" strokeWidth="1.5"/>
      <rect x="-13" y="-5" width="7" height="10" fill="#fff" stroke="#2a2418" strokeWidth="1"/>
      <rect x="-4" y="-3.5" width="6" height="3.5" fill="#a8d8e8" stroke="#2a2418" strokeWidth="0.5"/>
      <line x1="-13" y1="0" x2="13" y2="0" stroke="#2a2418" strokeWidth="0.5" opacity="0.4"/>
      <circle cx="-8" cy="6" r="2.2" fill="#2a2418" stroke="#2a2418" strokeWidth="0.4"/>
      <circle cx="-8" cy="6" r="0.9" fill="#7a7060"/>
      <circle cx="8"  cy="6" r="2.2" fill="#2a2418" stroke="#2a2418" strokeWidth="0.4"/>
      <circle cx="8"  cy="6" r="0.9" fill="#7a7060"/>
      <rect x="-2" y="-7" width="4" height="2" fill={blink ? '#ff3030' : '#660000'} stroke="#2a2418" strokeWidth="0.4"/>
    </g>
  );
}

function PoliceCarGfx({ blink }) {
  return (
    <g>
      {/* alternating red/blue siren glow */}
      <circle cx="0" cy="-7" r="9" fill={blink ? '#3060ff' : '#ff3030'} opacity="0.22"/>
      <rect x="-12" y="-5" width="24" height="10" rx="2.5" fill="#fff" stroke="#2a2418" strokeWidth="1.5"/>
      {/* black band along middle */}
      <rect x="-12" y="-1" width="24" height="3" fill="#1a1a2a" stroke="#2a2418" strokeWidth="0.4"/>
      <rect x="-7" y="-3.5" width="6" height="3" fill="#a8d8e8" stroke="#2a2418" strokeWidth="0.4"/>
      <rect x="1"  y="-3.5" width="6" height="3" fill="#a8d8e8" stroke="#2a2418" strokeWidth="0.4"/>
      <circle cx="-7" cy="6" r="2.1" fill="#2a2418" stroke="#2a2418" strokeWidth="0.4"/>
      <circle cx="-7" cy="6" r="0.8" fill="#7a7060"/>
      <circle cx="7"  cy="6" r="2.1" fill="#2a2418" stroke="#2a2418" strokeWidth="0.4"/>
      <circle cx="7"  cy="6" r="0.8" fill="#7a7060"/>
      {/* roof bar with two lights */}
      <rect x="-3.5" y="-7" width="3" height="2" fill={blink ? '#3060ff' : '#660000'} stroke="#2a2418" strokeWidth="0.3"/>
      <rect x="0.5"  y="-7" width="3" height="2" fill={blink ? '#660000' : '#ff3030'} stroke="#2a2418" strokeWidth="0.3"/>
    </g>
  );
}

function DispatchedVehicle({ d }) {
  const transform = `translate(${d.x},${d.y}) rotate(${d.rot})${d.flipX ? ' scale(-1,1)' : ''}`;
  return (
    <g transform={transform}>
      {d.kind === 'policecar' ? <PoliceCarGfx blink={d.blink}/> : <FireTruckGfx blink={d.blink}/>}
    </g>
  );
}

// ============ CROSSWALKS ============
// Painted-stripe crosswalks across each road approach at a right-angle
// intersection. Drawn on top of asphalt fill but under centerlines.
// One thin "stop line" stripe across the road approach. Cleaner than a
// full zebra pattern when there are many intersections in view.
function CrosswalkBars({ s, ix, iy, side }) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const pX = -uy, pY = ux;
  const baseX = ix + ux * side * 14;
  const baseY = iy + uy * side * 14;
  const angle = Math.atan2(pY, pX) * 180 / Math.PI;
  return (
    <g transform={`translate(${baseX},${baseY}) rotate(${angle})`}>
      <rect x="-13" y="-1.6" width="26" height="3.2" fill="#ffffff" opacity="0.85"/>
    </g>
  );
}
function Crosswalks({ items, streets }) {
  return (
    <g pointerEvents="none">
      {items.map((it, idx) => {
        const sA = streets.find(s => s.id === it.streetA);
        const sB = streets.find(s => s.id === it.streetB);
        if (!sA || !sB) return null;
        return (
          <g key={`cw-${idx}`}>
            <CrosswalkBars s={sA} ix={it.x} iy={it.y} side={-1}/>
            <CrosswalkBars s={sA} ix={it.x} iy={it.y} side={+1}/>
            <CrosswalkBars s={sB} ix={it.x} iy={it.y} side={-1}/>
            <CrosswalkBars s={sB} ix={it.x} iy={it.y} side={+1}/>
          </g>
        );
      })}
    </g>
  );
}

// ============ TRAFFIC LIGHTS ============
// Drawn at right-angle intersections; cycle in sync with currentLightPhase().
// A horizontal stoplight box (red on left end, green on right end). When
// rotated by the road angle it becomes parallel to that road — so the
// horizontal road's signal looks horizontal and the vertical road's signal
// looks vertical, making the association unmistakable.
function TLBox({ x, y, green, angle }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <rect x="-9" y="-3.5" width="18" height="7" rx="1.6"
            fill="#1a1a1a" stroke="#2a2418" strokeWidth="0.5"/>
      <circle cx="-4.5" cy="0" r="2.2" fill={green ? '#440000' : '#ff3838'}/>
      <circle cx="4.5"  cy="0" r="2.2" fill={green ? '#3aff3a' : '#003a00'}/>
    </g>
  );
}
// Each light is placed ALONG its road (just past the intersection) and
// oriented along that road, so both visual cues point at the same road.
// Adds a small perpendicular offset to keep the box clear of the asphalt.
function TrafficLight({ ix, iy, sA, sB, phase }) {
  const dxA = sA.x2 - sA.x1, dyA = sA.y2 - sA.y1;
  const lenA = Math.hypot(dxA, dyA) || 1;
  const dxB = sB.x2 - sB.x1, dyB = sB.y2 - sB.y1;
  const lenB = Math.hypot(dxB, dyB) || 1;
  const ax = dxA / lenA, ay = dyA / lenA;       // unit along A
  const bx = dxB / lenB, by = dyB / lenB;       // unit along B
  const pAx = ay, pAy = -ax;                    // perpendicular to A (CCW)
  const pBx = by, pBy = -bx;                    // perpendicular to B (CCW)
  const R = 28;          // distance along the road past intersection center
  const OFF = 14;        // perpendicular lift so box doesn't sit on asphalt
  const angleA = Math.atan2(dyA, dxA) * 180 / Math.PI;
  const angleB = Math.atan2(dyB, dxB) * 180 / Math.PI;
  return (
    <g pointerEvents="none">
      {/* Light A — along road A, lifted perpendicularly */}
      <TLBox
        x={ix + ax * R + pAx * OFF}
        y={iy + ay * R + pAy * OFF}
        green={phase === 0} angle={angleA}/>
      {/* Light B — along road B, opposite-side perpendicular lift so the
          two lights sit in distinct quadrants */}
      <TLBox
        x={ix + bx * R - pBx * OFF}
        y={iy + by * R - pBy * OFF}
        green={phase === 1} angle={angleB}/>
    </g>
  );
}

// ============ PLANES ============
// Top-down airplane shapes. variant chooses size + color so the sky shows
// a mix of small props, jets, and large airliners.
const PLANE_BODY_COLORS = ['#fff', '#bfdbfe', '#f8d4e0', '#cbe6a8', '#f4d35e', '#a8d8e8'];
function planeSvg(variant) {
  const c = PLANE_BODY_COLORS[variant % PLANE_BODY_COLORS.length];
  const size = (variant >> 2) % 3; // 0 small, 1 medium, 2 large
  if (size === 2) {
    // Airliner — long body, swept wings
    return `
      <ellipse cx="2" cy="3" rx="14" ry="3" fill="rgba(0,0,0,0.18)"/>
      <rect x="-2" y="-16" width="4" height="28" rx="2" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="0,-19 -2,-16 2,-16" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="-14,2 -2,-3 -2,3 -14,5" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="14,2 2,-3 2,3 14,5" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="-6,11 -2,9 -2,13 -6,14" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
      <polygon points="6,11 2,9 2,13 6,14" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
      <ellipse cx="0" cy="-12" rx="1.2" ry="1.6" fill="#a8d8e8" stroke="#2a2418" stroke-width="0.4"/>
    `;
  }
  if (size === 1) {
    // Mid-size jet
    return `
      <ellipse cx="2" cy="3" rx="11" ry="3" fill="rgba(0,0,0,0.16)"/>
      <rect x="-1.5" y="-12" width="3" height="22" rx="1.5" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="0,-14 -1.5,-12 1.5,-12" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="-11,0 -2,-3 -2,3 -11,4" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="11,0 2,-3 2,3 11,4" fill="${c}" stroke="#2a2418" stroke-width="0.7"/>
      <polygon points="-5,9 -2,7 -2,11 -5,12" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
      <polygon points="5,9 2,7 2,11 5,12" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
      <ellipse cx="0" cy="-8" rx="1" ry="1.4" fill="#a8d8e8" stroke="#2a2418" stroke-width="0.4"/>
    `;
  }
  // Small prop plane
  return `
    <ellipse cx="1" cy="3" rx="8" ry="2.5" fill="rgba(0,0,0,0.14)"/>
    <rect x="-1.2" y="-9" width="2.4" height="17" rx="1.2" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
    <polygon points="0,-11 -1.2,-9 1.2,-9" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
    <rect x="-8" y="-2" width="16" height="3" rx="1" fill="${c}" stroke="#2a2418" stroke-width="0.6"/>
    <rect x="-4" y="6" width="8" height="2" rx="0.6" fill="${c}" stroke="#2a2418" stroke-width="0.5"/>
    <line x1="-3" y1="-11" x2="3" y2="-11" stroke="#2a2418" stroke-width="1.4"/>
    <ellipse cx="0" cy="-5" rx="0.8" ry="1.2" fill="#a8d8e8" stroke="#2a2418" stroke-width="0.4"/>
  `;
}
const PlaneVisual = React.memo(function PlaneVisual({ variant }) {
  return <g dangerouslySetInnerHTML={{ __html: planeSvg(variant || 0) }}/>;
});

function randomEdgePoint(W, H, PAD = 80) {
  const edge = Math.floor(Math.random() * 4);
  if (edge === 0) return { x: Math.random() * W, y: -PAD };
  if (edge === 1) return { x: W + PAD, y: Math.random() * H };
  if (edge === 2) return { x: Math.random() * W, y: H + PAD };
  return { x: -PAD, y: Math.random() * H };
}
function spawnFlybyPlane(now, W, H) {
  const a = randomEdgePoint(W, H);
  const b = randomEdgePoint(W, H);
  return {
    id: `pl-${now.toFixed(0)}-${Math.random().toString(36).slice(2,5)}`,
    purpose: 'flyby',
    fromX: a.x, fromY: a.y, toX: b.x, toY: b.y, t: 0,
    speed: 50 + Math.random() * 70,
    variant: Math.floor(Math.random() * (PLANE_BODY_COLORS.length * 3)),
    lastAngle: 0,
  };
}
function spawnAirportPlane(airports, now, W, H) {
  if (!airports.length) return null;
  const a = airports[Math.floor(Math.random() * airports.length)];
  const start = randomEdgePoint(W, H);
  return {
    id: `pl-${now.toFixed(0)}-${Math.random().toString(36).slice(2,5)}`,
    purpose: 'airport',
    stage: 0,           // 0 = approach, 1 = on runway, 2 = depart
    airportX: a.x, airportY: a.y,
    fromX: start.x, fromY: start.y, toX: a.x, toY: a.y, t: 0,
    speed: 70 + Math.random() * 40,
    variant: Math.floor(Math.random() * (PLANE_BODY_COLORS.length * 3)),
    pauseUntil: 0,
    lastAngle: 0,
  };
}
function stepPlanes(planes, target, airports, dt, now, W, H) {
  const T = Math.max(0, Math.min(20, target != null ? target : 3));
  if (T === 0) { planes.length = 0; return; }

  // If there's at least one airport in the city, keep one airport-bound
  // plane in the rotation at all times (lands → pauses → takes off).
  if (airports.length > 0 && !planes.some(p => p.purpose === 'airport')) {
    const ap = spawnAirportPlane(airports, now, W, H);
    if (ap) planes.push(ap);
  }
  // Fill remaining slots with regular flyby planes.
  while (planes.length < T) planes.push(spawnFlybyPlane(now, W, H));
  if (planes.length > T) planes.length = T;

  for (let i = planes.length - 1; i >= 0; i--) {
    const p = planes[i];
    if (p.pauseUntil > now) continue;
    const dx = p.toX - p.fromX, dy = p.toY - p.fromY;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 0.5) p.lastAngle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    p.t += (p.speed * dt) / dist;
    if (p.t < 1) continue;

    if (p.purpose !== 'airport') { planes.splice(i, 1); continue; }
    if (p.stage === 0) {
      // Just landed — stop on the runway and rest.
      p.stage = 1;
      p.fromX = p.airportX; p.fromY = p.airportY;
      p.toX = p.airportX; p.toY = p.airportY;
      p.t = 0;
      p.pauseUntil = now + 4000 + Math.random() * 3000;
    } else if (p.stage === 1) {
      // Pause done — take off toward a random map edge.
      const exit = randomEdgePoint(W, H);
      p.fromX = p.airportX; p.fromY = p.airportY;
      p.toX = exit.x; p.toY = exit.y;
      p.t = 0;
      p.stage = 2;
      p.speed = 80 + Math.random() * 50;
    } else {
      // Departed off-map.
      planes.splice(i, 1);
    }
  }
}

// ============ DIRECTED CARS (click-to-dispatch) ============
function stepDirectedCars(cars, streets, occupancy, dt, now, onArrived) {
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.idx >= c.path.length) {
      // Off-road approach: drive from the road exit point onto the
      // driveway toward the building's park spot.
      if (c.approachTarget && !c.approachDone) {
        const dx = c.approachTarget.x - c.x;
        const dy = c.approachTarget.y - c.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 3) {
          c.approachDone = true;
          c.holdUntil = now + 1500;
        } else {
          const step = Math.min(c.speed * 0.6 * dt, dist);
          c.x += (dx / dist) * step;
          c.y += (dy / dist) * step;
          // Update rotation so the car points where it's going.
          const ux = dx / dist, uy = dy / dist;
          let rot = Math.atan2(uy, ux) * 180 / Math.PI;
          let flipX = false;
          if (rot > 90) { rot -= 180; flipX = true; }
          else if (rot < -90) { rot += 180; flipX = true; }
          c.approachRot = rot; c.approachFlipX = flipX;
        }
        continue;
      }
      if (now > c.holdUntil) { onArrived && onArrived(c.id); cars.splice(i, 1); }
      continue;
    }
    const seg = c.path[c.idx];
    const s = streets.find(st => st.id === seg.streetId);
    if (!s) { onArrived && onArrived(c.id); cars.splice(i, 1); continue; }
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    if (len === 0) { c.idx++; continue; }

    // Car-following: edge-to-edge gap on this segment in this direction.
    let speedScale = 1;
    if (occupancy) {
      const gap = closestAheadGap(occupancy, c.id, { streetId: seg.streetId, t: c.t, dir: seg.dir }, len, 11);
      if (gap < FOLLOW_STOP_GAP) continue;
      if (gap < FOLLOW_SLOW_GAP) {
        speedScale = (gap - FOLLOW_STOP_GAP) / (FOLLOW_SLOW_GAP - FOLLOW_STOP_GAP);
        if (speedScale < 0.2) speedScale = 0.2;
      }
    }

    c.t += seg.dir * (c.speed * speedScale * dt) / len;

    // Reached this segment's exit?
    const reached = seg.dir > 0 ? c.t >= seg.toT : c.t <= seg.toT;
    if (reached) {
      c.idx++;
      if (c.idx < c.path.length) {
        c.t = c.path[c.idx].fromT;
      } else {
        c.t = seg.toT;
        c.holdUntil = now + 1500; // brief pause at destination before despawn
      }
    }
  }
}

function CityLife({ vehicles, streets, busStops, fireDepts, policeStations, lightInfo, trafficLights, soundOn, dispatches, onDispatchDone, allBuildings, pedTarget, planeTarget }) {
  const motionRef = useRef(new Map());
  const pedRef = useRef([]);
  const fireTrucksRef = useRef([]);
  const policeCarsRef = useRef([]);
  const directedRef = useRef([]);
  const planesRef = useRef([]);
  const seenDispatchIdsRef = useRef(new Set());
  const fireCooldownRef = useRef(45);   // first fire dispatch after 45s
  const policeCooldownRef = useRef(35); // first police patrol after 35s
  // Keep latest props accessible from the RAF loop without re-subscribing.
  const propsRef = useRef({});
  propsRef.current = { vehicles, streets, busStops, fireDepts, policeStations, lightInfo, soundOn, dispatches, onDispatchDone, allBuildings, pedTarget, planeTarget };
  const [, setTick] = useState(0);

  useEffect(() => {
    let raf;
    let lastT = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      const p = propsRef.current;
      const phase = currentLightPhase(now);
      const lInfo = p.lightInfo ? { ...p.lightInfo, phase } : null;
      // Snapshot road occupants BEFORE stepping so collision checks see a
      // consistent view this frame (same-side-same-direction following).
      // Pull in any new dispatch requests that arrived since last frame.
      if (p.dispatches && p.dispatches.length) {
        for (const d of p.dispatches) {
          if (!seenDispatchIdsRef.current.has(d.id)) {
            seenDispatchIdsRef.current.add(d.id);
            directedRef.current.push({
              id: d.id,
              path: d.path,
              t: d.path[0].fromT,
              idx: 0,
              speed: 100 + Math.random() * 50,
              variant: d.variant,
              destX: d.destX, destY: d.destY,
              approachTarget: d.approachTarget || null,
              approachDone: false,
              x: 0, y: 0,
              holdUntil: 0,
            });
          }
        }
      }
      const occ = buildOccupancy(motionRef.current, p.vehicles, fireTrucksRef.current, policeCarsRef.current);
      // Treat directed cars as occupants too so others queue behind them.
      for (const c of directedRef.current) {
        if (c.idx < c.path.length) {
          const seg = c.path[c.idx];
          occ.push({ id: c.id, streetId: seg.streetId, t: c.t, dir: seg.dir, halfLen: 11 });
        }
      }
      const sound = p.soundOn ? (kind => {
        if (kind === 'fire') playFireSiren();
        else if (kind === 'police') playPoliceSiren();
        else if (kind === 'bus') playBusDing();
      }) : null;
      stepVehicles(motionRef.current, p.vehicles, p.streets, p.busStops, lInfo, occ, sound, dt, now);
      stepPedestrians(pedRef.current, p.streets, lInfo, p.allBuildings, p.pedTarget, dt, now);
      stepDispatchedFleet(fireTrucksRef.current, fireCooldownRef, p.fireDepts, p.streets, occ, sound, dt, now, FIRE_CFG);
      stepDispatchedFleet(policeCarsRef.current, policeCooldownRef, p.policeStations, p.streets, occ, sound, dt, now, POLICE_CFG);
      stepDirectedCars(directedRef.current, p.streets, occ, dt, now, p.onDispatchDone);
      const airportsList = (p.allBuildings || []).filter(b => b.kind === 'airport');
      stepPlanes(planesRef.current, p.planeTarget, airportsList, dt, now, 1800, 1100);
      setTick(t => (t + 1) & 0xFFFF);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      motionRef.current.clear();
      pedRef.current = [];
      fireTrucksRef.current = [];
      policeCarsRef.current = [];
      directedRef.current = [];
      planesRef.current = [];
      seenDispatchIdsRef.current = new Set();
    };
  }, []);

  const phase = currentLightPhase(performance.now());

  return (
    <g pointerEvents="none">
      {/* pedestrians (under vehicles so trucks don't disappear behind them) */}
      {pedRef.current.map(p => <Person key={p.id} p={p}/>)}
      {/* user-placed cars and buses */}
      {vehicles.map(v => {
        const m = motionRef.current.get(v.id);
        if (!m) return null;
        const s = streets.find(st => st.id === m.streetId);
        if (!s) return null;
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const dirX = (m.dir > 0 ? dx : -dx) / len;
        const dirY = (m.dir > 0 ? dy : -dy) / len;
        const rx = -dirY, ry = dirX;
        const offset = v.kind === 'bus' ? 11 : 9;
        const x = s.x1 + m.t * dx + rx * offset;
        const y = s.y1 + m.t * dy + ry * offset;
        let rot = Math.atan2(dirY, dirX) * 180 / Math.PI;
        let flipX = false;
        if (rot > 90) { rot -= 180; flipX = true; }
        else if (rot < -90) { rot += 180; flipX = true; }
        const transform = `translate(${x},${y}) rotate(${rot})${flipX ? ' scale(-1,1)' : ''}`;
        return (
          <g key={v.id} transform={transform}>
            <VehicleVisual kind={v.kind} variant={v.variant}/>
          </g>
        );
      })}
      {/* dispatched fire trucks + police cars */}
      {fireTrucksRef.current.map(t => <DispatchedVehicle key={t.id} d={t}/>)}
      {policeCarsRef.current.map(t => <DispatchedVehicle key={t.id} d={t}/>)}
      {/* directed (click-dispatched) cars + their destination pins */}
      {directedRef.current.map(c => {
        // Past path → approach phase or parked
        if (c.idx >= c.path.length) {
          if (c.approachTarget && !c.approachDone) {
            const rot = c.approachRot ?? 0;
            const flipX = c.approachFlipX ?? false;
            const transform = `translate(${c.x},${c.y}) rotate(${rot})${flipX ? ' scale(-1,1)' : ''}`;
            return (
              <g key={c.id} transform={transform}>
                <VehicleVisual kind="car" variant={c.variant}/>
              </g>
            );
          }
          // Parked at the building — render at last known position
          return (
            <g key={c.id} transform={`translate(${c.x},${c.y}) rotate(${c.approachRot ?? 0})${c.approachFlipX ? ' scale(-1,1)' : ''}`}>
              <VehicleVisual kind="car" variant={c.variant}/>
            </g>
          );
        }
        const seg = c.path[c.idx];
        const s = streets.find(st => st.id === seg.streetId);
        if (!s) return null;
        const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
        const len = Math.hypot(dx, dy) || 1;
        const dirX = (seg.dir > 0 ? dx : -dx) / len;
        const dirY = (seg.dir > 0 ? dy : -dy) / len;
        const rx = -dirY, ry = dirX;
        const x = s.x1 + c.t * dx + rx * 9;
        const y = s.y1 + c.t * dy + ry * 9;
        let rot = Math.atan2(dirY, dirX) * 180 / Math.PI;
        let flipX = false;
        if (rot > 90) { rot -= 180; flipX = true; }
        else if (rot < -90) { rot += 180; flipX = true; }
        // Cache last on-road position so the approach phase has a starting point.
        c.x = x; c.y = y;
        const transform = `translate(${x},${y}) rotate(${rot})${flipX ? ' scale(-1,1)' : ''}`;
        return (
          <g key={c.id} transform={transform}>
            <VehicleVisual kind="car" variant={c.variant}/>
          </g>
        );
      })}
      {directedRef.current.map(c => (
        <g key={`pin-${c.id}`} transform={`translate(${c.destX},${c.destY - 28})`} pointerEvents="none">
          <path d="M 0 0 q 9 -10 0 -22 q -9 12 0 22 z" fill="#d94c3a" stroke="#2a2418" strokeWidth="1.2"/>
          <circle cx="0" cy="-14" r="3" fill="#fff" stroke="#2a2418" strokeWidth="1"/>
        </g>
      ))}
      {/* traffic lights at right-angle intersections */}
      {trafficLights && trafficLights.map((t, i) => (
        <TrafficLight key={`tl-${i}`} ix={t.x} iy={t.y} sA={t.sA} sB={t.sB} phase={phase}/>
      ))}
      {/* planes — drawn on top of everything (sky) */}
      {planesRef.current.map(p => {
        const x = p.fromX + p.t * (p.toX - p.fromX);
        const y = p.fromY + p.t * (p.toY - p.fromY);
        // Use lastAngle so a parked airport plane keeps its approach
        // orientation instead of snapping to 0° while stationary.
        const dx = p.toX - p.fromX, dy = p.toY - p.fromY;
        const angle = Math.hypot(dx, dy) > 0.5
          ? Math.atan2(dy, dx) * 180 / Math.PI + 90
          : (p.lastAngle ?? 0);
        return (
          <g key={p.id} transform={`translate(${x},${y}) rotate(${angle})`}>
            <PlaneVisual variant={p.variant}/>
          </g>
        );
      })}
    </g>
  );
}

// CONTENT BOUNDS — for fit-to-view
function getContentBounds(state) {
  const xs = [], ys = [];
  state.streets.forEach(s => { xs.push(s.x1, s.x2); ys.push(s.y1, s.y2); });
  state.buildings.forEach(b => { xs.push(b.x - 30, b.x + 30); ys.push(b.y - 30, b.y + 30); });
  if (!xs.length) return { x: 100, y: 100, w: 1600, h: 900 };
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

window.CityCanvas = function CityCanvas({
  state, setState, tool, setTool,
  showAngles, showProtractor,
  onPaletteDrop, eraserMode,
  selectedId, setSelectedId,
  multiSelected, setMultiSelected,
  bumpHistory,
  drawStyle, // string id from DRAW_STYLES
  zoomTick, fitTick, // counters: when these change, run zoom in/out / fit
  liveMode, // when true, cars/buses animate along the road network
  soundOn,  // when true, dispatch sirens + bus stop ding play
  weather,  // 'clear' | 'rain' | 'snow'
  dispatches,        // active click-dispatched cars
  onDispatch,        // (building) => create a dispatch entry
  onDispatchDone,    // (id) => remove the dispatch entry once arrived
  armedKind,         // touch-friendly tap-to-arm: kind to place on next bg tap
  onArmedConsumed,
  pedTarget,         // requested pedestrian count (null/undefined = default 8)
  planeTarget,       // requested plane count (null/undefined = 0)
}) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, scale: 0.7 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef(null);
  const [hoverIntersection, setHoverIntersection] = useState(null);
  const [editName, setEditName] = useState(null);
  const dragRef = useRef(null);
  const endpointDragRef = useRef(null); // { streetId, end: 1|2 }
  const [drawPreview, setDrawPreview] = useState(null);
  const [isEditing, setIsEditing] = useState(false); // shows snap-grid dots while dragging/drawing
  const [marquee, setMarquee] = useState(null); // {x1,y1,x2,y2} in world coords
  const [contextMenu, setContextMenu] = useState(null); // {x, y, target: {kind, id}}

  const intersections = useMemo(() => Geom.findIntersections(state.streets), [state.streets]);

  // Traffic-light geometry: per intersection (any angle), the parametric
  // position on each crossing street so vehicles can detect "intersection
  // ahead within X px" cheaply. Recomputed only when streets change.
  const lightData = useMemo(() => {
    const byStreet = new Map();
    const lights = [];
    for (const it of intersections) {
      const sA = state.streets.find(s => s.id === it.streetA);
      const sB = state.streets.find(s => s.id === it.streetB);
      if (!sA || !sB) continue;
      const lenA2 = (sA.x2 - sA.x1) ** 2 + (sA.y2 - sA.y1) ** 2;
      const lenB2 = (sB.x2 - sB.x1) ** 2 + (sB.y2 - sB.y1) ** 2;
      if (lenA2 === 0 || lenB2 === 0) continue;
      const tA = ((it.x - sA.x1) * (sA.x2 - sA.x1) + (it.y - sA.y1) * (sA.y2 - sA.y1)) / lenA2;
      const tB = ((it.x - sB.x1) * (sB.x2 - sB.x1) + (it.y - sB.y1) * (sB.y2 - sB.y1)) / lenB2;
      if (!byStreet.has(it.streetA)) byStreet.set(it.streetA, []);
      if (!byStreet.has(it.streetB)) byStreet.set(it.streetB, []);
      byStreet.get(it.streetA).push({ tInt: tA, isStreetA: true });
      byStreet.get(it.streetB).push({ tInt: tB, isStreetA: false });
      lights.push({ x: it.x, y: it.y, sA, sB });
    }
    return { byStreet, lights };
  }, [intersections, state.streets]);

  // Find the closest street endpoint to a world-space point. Returns
  // { x, y, streetId, end: 1|2 } if within `radius` px in world coords, else null.
  function closestEndpoint(wx, wy, radius = 26, ignoreId = null) {
    let best = null, bestD = radius;
    state.streets.forEach(s => {
      if (s.id === ignoreId) return;
      [{ end: 1, x: s.x1, y: s.y1 }, { end: 2, x: s.x2, y: s.y2 }].forEach(p => {
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < bestD) { bestD = d; best = { x: p.x, y: p.y, streetId: s.id, end: p.end }; }
      });
    });
    return best;
  }

  const [hoverEndpoint, setHoverEndpoint] = useState(null); // {x,y} for snap indicator
  const [angleHud, setAngleHud] = useState(null); // {x,y,tx,ty,deg,snapped}

  // Auto-fit on initial mount and whenever the canvas resizes — keeps the
  // starter pattern nicely centered no matter the viewport.
  useEffect(() => {
    let didFirstFit = false;
    function fit() {
      const svg = svgRef.current;
      if (!svg) return;
      // Use the SVG's actual rendered drawing area (in viewBox coords this is W×H)
      const W = 1800, H = 1100;
      const padding = 80;
      const b = getContentBounds(state);
      const sx = (W - padding * 2) / (b.w + 80);
      const sy = (H - padding * 2) / (b.h + 80);
      const ns = Math.max(0.4, Math.min(2, Math.min(sx, sy)));
      setView({
        scale: ns,
        x: padding + (W - padding*2 - b.w * ns) / 2 - b.x * ns,
        y: padding + (H - padding*2 - b.h * ns) / 2 - b.y * ns,
      });
      didFirstFit = true;
    }
    const t1 = setTimeout(fit, 80);
    const t2 = setTimeout(() => { if (!didFirstFit) fit(); }, 400);
    const ro = new ResizeObserver(() => { if (!didFirstFit) fit(); });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => { clearTimeout(t1); clearTimeout(t2); ro.disconnect(); };
    // eslint-disable-next-line
  }, []);

  // Convert client coords to SVG coords (in world space — accounting for view)
  function toWorld(clientX, clientY) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const inv = ctm.inverse();
    const p = pt.matrixTransform(inv);
    // p is in viewBox space; convert to world by undoing view transform
    return {
      x: (p.x - view.x) / view.scale,
      y: (p.y - view.y) / view.scale,
    };
  }

  // ZOOM BUTTONS
  // Zoom in/out is driven by an integer ticker that changes per click. The
  // earlier version checked sign of the absolute counter, which broke the
  // moment the user toggled directions (e.g. + + - - - left them at 0 with
  // no zoom or the wrong direction). We now compare against the previous
  // value and use the delta so the direction always matches the click.
  const lastZoomTickRef = useRef(zoomTick || 0);
  useEffect(() => {
    if (zoomTick === undefined) return;
    const delta = zoomTick - lastZoomTickRef.current;
    lastZoomTickRef.current = zoomTick;
    if (delta === 0) return;
    const factor = Math.pow(1.2, delta);
    setView(v => {
      const ns = Math.max(0.2, Math.min(3, v.scale * factor));
      const W = 1800, H = 1100;
      const cx = W / 2, cy = H / 2;
      const wx = (cx - v.x) / v.scale;
      const wy = (cy - v.y) / v.scale;
      return {
        scale: ns,
        x: cx - wx * ns,
        y: cy - wy * ns,
      };
    });
  }, [zoomTick]);

  // FIT TO VIEW
  useEffect(() => {
    if (!fitTick) return;
    const W = 1800, H = 1100;
    const padding = 80;
    const b = getContentBounds(state);
    const sx = (W - padding * 2) / (b.w + 80);
    const sy = (H - padding * 2) / (b.h + 80);
    const ns = Math.max(0.4, Math.min(2, Math.min(sx, sy)));
    setView({
      scale: ns,
      x: padding + (W - padding*2 - b.w * ns) / 2 - b.x * ns,
      y: padding + (H - padding*2 - b.h * ns) / 2 - b.y * ns,
    });
  }, [fitTick]);

  // Pan with middle/right mouse OR with pan tool
  function onMouseDown(e) {
    if (e.target.closest('[data-no-pan]')) return;
    // Endpoint dragging in select mode (only the bg svg gets here; endpoints
    // have their own onMouseDown that calls beginEndpointDrag()).
    // Draw tool: start a road
    if (tool === 'draw' && e.button === 0) {
      const p = toWorld(e.clientX, e.clientY);
      // snap start to existing endpoint if close, otherwise to grid
      const snap = closestEndpoint(p.x, p.y, 30);
      const sp = snap || snapToGrid(p.x, p.y);
      setDrawPreview({ x1: sp.x, y1: sp.y, x2: sp.x, y2: sp.y, snapStart: !!snap });
      setIsEditing(true);
      return;
    }
    // Middle-click pans regardless of tool. Right-click is reserved for the
    // context menu now; if pan is desired with no middle button, use the
    // pan tool.
    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      e.preventDefault();
      return;
    }
    // Select mode + empty-canvas click → start a marquee selection.
    if (tool === 'select' && e.button === 0) {
      const p = toWorld(e.clientX, e.clientY);
      setMarquee({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    }
  }
  function onMouseMove(e) {
    if (marquee) {
      const p = toWorld(e.clientX, e.clientY);
      setMarquee({ ...marquee, x2: p.x, y2: p.y });
    }
    if (isPanning && panStart.current) {
      setView(v => ({ ...v,
        x: panStart.current.vx + (e.clientX - panStart.current.x),
        y: panStart.current.vy + (e.clientY - panStart.current.y),
      }));
    }
    if (drawPreview) {
      const p = toWorld(e.clientX, e.clientY);
      // Snap end to existing endpoint, then 15° angle (shift), else grid.
      let snapEnd = closestEndpoint(p.x, p.y, 30);
      let { x1, y1 } = drawPreview;
      let x2, y2;
      if (snapEnd) {
        x2 = snapEnd.x; y2 = snapEnd.y;
      } else if (e.shiftKey) {
        const dx = p.x - x1, dy = p.y - y1;
        const ang = Math.atan2(dy, dx);
        const snap = Math.round(ang / (Math.PI/12)) * (Math.PI/12);
        const len = Math.hypot(dx, dy);
        x2 = x1 + Math.cos(snap) * len;
        y2 = y1 + Math.sin(snap) * len;
      } else {
        const g = snapToGrid(p.x, p.y);
        x2 = g.x; y2 = g.y;
      }
      setHoverEndpoint(snapEnd ? { x: snapEnd.x, y: snapEnd.y } : null);
      setDrawPreview({ ...drawPreview, x2, y2, snapEnd: !!snapEnd });
    }
    // Endpoint dragging in select mode
    if (endpointDragRef.current) {
      const p = toWorld(e.clientX, e.clientY);
      const { streetId, end } = endpointDragRef.current;
      const street = state.streets.find(st => st.id === streetId);
      // Anchor = the OTHER endpoint of this street (the one we're not dragging)
      const anchor = end === 1 ? { x: street.x2, y: street.y2 } : { x: street.x1, y: street.y1 };
      // Snap priority: existing endpoint > 15° angle (shift) > grid.
      const epSnap = closestEndpoint(p.x, p.y, 30, streetId);
      let tx, ty;
      let snappedAngle = null;
      if (epSnap) {
        tx = epSnap.x; ty = epSnap.y;
      } else if (e.shiftKey) {
        const dx = p.x - anchor.x, dy = p.y - anchor.y;
        const len = Math.hypot(dx, dy) || 1;
        let deg = Math.atan2(dy, dx) * 180 / Math.PI;
        const snap15 = Math.round(deg / 15) * 15;
        const rad = snap15 * Math.PI / 180;
        tx = anchor.x + Math.cos(rad) * len;
        ty = anchor.y + Math.sin(rad) * len;
        snappedAngle = ((snap15 % 360) + 360) % 360;
      } else {
        const g = snapToGrid(p.x, p.y);
        tx = g.x; ty = g.y;
      }
      setHoverEndpoint(epSnap ? { x: epSnap.x, y: epSnap.y } : null);
      // Live angle indicator (from anchor toward dragged end)
      {
        const dxA = tx - anchor.x, dyA = ty - anchor.y;
        let degA = Math.atan2(dyA, dxA) * 180 / Math.PI;
        if (degA < 0) degA += 360;
        setAngleHud({ x: anchor.x, y: anchor.y, tx, ty,
          deg: Math.round(degA), snapped: snappedAngle != null });
      }
      setState(s => ({
        ...s,
        streets: s.streets.map(st => st.id === streetId
          ? (end === 1 ? { ...st, x1: tx, y1: ty } : { ...st, x2: tx, y2: ty })
          : st)
      }));
    }
    if (dragRef.current) {
      const p = toWorld(e.clientX, e.clientY);
      const dx = p.x - dragRef.current.startSvg.x;
      const dy = p.y - dragRef.current.startSvg.y;
      const id = dragRef.current.id;
      const snapped = snapToGrid(dragRef.current.origX + dx, dragRef.current.origY + dy);
      setState(s => ({
        ...s,
        buildings: s.buildings.map(b => b.id === id
          ? { ...b, x: snapped.x, y: snapped.y }
          : b)
      }));
    }
  }
  function onMouseUp(e) {
    setIsPanning(false);
    panStart.current = null;
    if (dragRef.current) dragRef.current = null;
    if (endpointDragRef.current) { endpointDragRef.current = null; setHoverEndpoint(null); setAngleHud(null); }
    setIsEditing(false);
    if (marquee) {
      const dx = Math.abs(marquee.x2 - marquee.x1);
      const dy = Math.abs(marquee.y2 - marquee.y1);
      if (dx > 6 && dy > 6) {
        const minX = Math.min(marquee.x1, marquee.x2);
        const maxX = Math.max(marquee.x1, marquee.x2);
        const minY = Math.min(marquee.y1, marquee.y2);
        const maxY = Math.max(marquee.y1, marquee.y2);
        const sel = new Set();
        for (const b of state.buildings) {
          if (b.x >= minX && b.x <= maxX && b.y >= minY && b.y <= maxY) {
            sel.add(`building:${b.id}`);
          }
        }
        for (const sg of state.streets) {
          // Street included if BOTH endpoints fall inside the marquee.
          if (sg.x1 >= minX && sg.x1 <= maxX && sg.y1 >= minY && sg.y1 <= maxY &&
              sg.x2 >= minX && sg.x2 <= maxX && sg.y2 >= minY && sg.y2 <= maxY) {
            sel.add(`street:${sg.id}`);
          }
        }
        setMultiSelected && setMultiSelected(sel);
        setSelectedId(null);
      }
      setMarquee(null);
    }
    if (drawPreview) {
      const len = Math.hypot(drawPreview.x2 - drawPreview.x1, drawPreview.y2 - drawPreview.y1);
      if (len > 30) {
        bumpHistory();
        const style = window.DRAW_STYLES?.find(d => d.id === drawStyle) || {};
        const segs = style.expand
          ? style.expand(drawPreview)
          : [{x1:drawPreview.x1,y1:drawPreview.y1,x2:drawPreview.x2,y2:drawPreview.y2}];
        setState(s => ({
          ...s,
          streets: [
            ...s.streets,
            ...segs.map((seg, i) => ({
              ...seg,
              id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${i}`,
              name: '',
            }))
          ]
        }));
      }
      setDrawPreview(null);
    }
  }
  function onContextMenu(e) { e.preventDefault(); }

  function onDrop(e) {
    e.preventDefault();
    const kind = e.dataTransfer.getData('text/building');
    if (!kind) return;
    const p = toWorld(e.clientX, e.clientY);
    onPaletteDrop(kind, p.x, p.y);
  }
  function onDragOver(e) { e.preventDefault(); }

  function onSvgMove(e) {
    // protractor-on-hover removed — intersections show their angle as a static label.
  }

  function handleStreetClick(s, e) {
    e.stopPropagation();
    if (eraserMode) {
      bumpHistory();
      setState(st => ({ ...st, streets: st.streets.filter(x => x.id !== s.id) }));
      return;
    }
    setSelectedId({ kind: 'street', id: s.id });
    if (setMultiSelected) setMultiSelected(new Set());
  }
  function handleStreetDouble(s, e) {
    e.stopPropagation();
    setEditName({ kind: 'street', id: s.id, value: s.name || '',
      x: e.clientX, y: e.clientY });
  }
  function handleBuildingMouseDown(b, e) {
    e.stopPropagation();
    if (eraserMode) {
      bumpHistory();
      setState(st => ({ ...st, buildings: st.buildings.filter(x => x.id !== b.id) }));
      return;
    }
    if (tool === 'dispatch' && onDispatch) {
      onDispatch(b);
      return;
    }
    if (tool !== 'pan' && tool !== 'draw') {
      bumpHistory();
      const p = toWorld(e.clientX, e.clientY);
      dragRef.current = { id: b.id, startSvg: p, origX: b.x, origY: b.y };
      setSelectedId({ kind: 'building', id: b.id });
      if (setMultiSelected) setMultiSelected(new Set());
      setIsEditing(true);
    }
  }
  function handleBuildingDouble(b, e) {
    e.stopPropagation();
    if (b.kind === 'home' || Buildings.DECOR.find(d => d.kind === b.kind)) return;
    setEditName({ kind: 'building', id: b.id, value: b.label || '',
      x: e.clientX, y: e.clientY });
  }

  function handleBgClick(e) {
    // Don't clear when a marquee selection just finished (it ran inside
    // onMouseUp before the click event fired).
    if (marquee) return;
    // Tap-to-place: if a palette item is armed, drop it where the user tapped.
    if (armedKind && onPaletteDrop && e && typeof e.clientX === 'number') {
      const p = toWorld(e.clientX, e.clientY);
      onPaletteDrop(armedKind, p.x, p.y);
      onArmedConsumed && onArmedConsumed();
      return;
    }
    setSelectedId(null);
    setEditName(null);
    setContextMenu(null);
    if (setMultiSelected && multiSelected && multiSelected.size > 0) setMultiSelected(new Set());
  }

  // ---- Right-click context menu ----
  function openContextMenu(e, target) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  }
  function ctxRename() {
    if (!contextMenu) return;
    const { kind, id } = contextMenu.target;
    if (kind === 'building') {
      const b = state.buildings.find(x => x.id === id);
      if (b) setEditName({ kind: 'building', id, value: b.label || '', x: contextMenu.x, y: contextMenu.y });
    } else if (kind === 'street') {
      const s = state.streets.find(x => x.id === id);
      if (s) setEditName({ kind: 'street', id, value: s.name || '', x: contextMenu.x, y: contextMenu.y });
    }
    setContextMenu(null);
  }
  function ctxRotate() {
    if (!contextMenu || contextMenu.target.kind !== 'building') return;
    const id = contextMenu.target.id;
    bumpHistory();
    setState(s => ({
      ...s,
      buildings: s.buildings.map(b => b.id === id ? { ...b, rot: ((b.rot || 0) + 90) % 360 } : b),
    }));
    setContextMenu(null);
  }
  function ctxDuplicate() {
    if (!contextMenu) return;
    const { kind, id } = contextMenu.target;
    bumpHistory();
    if (kind === 'building') {
      const b = state.buildings.find(x => x.id === id);
      if (!b) return;
      const nb = { ...b, id: `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
                   x: b.x + 30, y: b.y + 30 };
      setState(s => ({ ...s, buildings: [...s.buildings, nb] }));
      setSelectedId({ kind: 'building', id: nb.id });
    } else if (kind === 'street') {
      const st = state.streets.find(x => x.id === id);
      if (!st) return;
      const ns = { ...st, id: `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,5)}`,
                   x1: st.x1 + 30, y1: st.y1 + 30, x2: st.x2 + 30, y2: st.y2 + 30 };
      setState(s => ({ ...s, streets: [...s.streets, ns] }));
      setSelectedId({ kind: 'street', id: ns.id });
    }
    setContextMenu(null);
  }
  function ctxDelete() {
    if (!contextMenu) return;
    const { kind, id } = contextMenu.target;
    bumpHistory();
    if (kind === 'building') {
      setState(s => ({ ...s, buildings: s.buildings.filter(x => x.id !== id) }));
    } else if (kind === 'street') {
      setState(s => ({ ...s, streets: s.streets.filter(x => x.id !== id) }));
    }
    if (selectedId && selectedId.id === id) setSelectedId(null);
    setContextMenu(null);
  }
  // Close on outside click / Esc.
  useEffect(() => {
    if (!contextMenu) return;
    function onDoc(e) {
      if (!e.target.closest || !e.target.closest('.ctx-menu')) setContextMenu(null);
    }
    function onKey(e) { if (e.key === 'Escape') setContextMenu(null); }
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [contextMenu]);

  function commitName() {
    if (!editName) return;
    bumpHistory();
    if (editName.kind === 'street') {
      setState(s => ({ ...s,
        streets: s.streets.map(st => st.id === editName.id ? { ...st, name: editName.value } : st)
      }));
    } else {
      setState(s => ({ ...s,
        buildings: s.buildings.map(b => b.id === editName.id ? { ...b, label: editName.value } : b)
      }));
    }
    setEditName(null);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Multi-selection takes precedence — delete every member.
        if (multiSelected && multiSelected.size > 0) {
          bumpHistory();
          const dropB = new Set(), dropS = new Set();
          for (const k of multiSelected) {
            const [kind, id] = k.split(':');
            if (kind === 'building') dropB.add(id);
            else if (kind === 'street') dropS.add(id);
          }
          setState(s => ({
            ...s,
            streets: s.streets.filter(x => !dropS.has(x.id)),
            buildings: s.buildings.filter(x => !dropB.has(x.id)),
          }));
          if (setMultiSelected) setMultiSelected(new Set());
          return;
        }
        if (!selectedId) return;
        bumpHistory();
        setState(s => selectedId.kind === 'street'
          ? { ...s, streets: s.streets.filter(x => x.id !== selectedId.id) }
          : { ...s, buildings: s.buildings.filter(x => x.id !== selectedId.id) }
        );
        setSelectedId(null);
      }
      if (e.key === 'Escape') {
        setSelectedId(null);
        setEditName(null);
        setDrawPreview(null);
        if (setMultiSelected) setMultiSelected(new Set());
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, multiSelected, bumpHistory, setState, setSelectedId, setMultiSelected]);

  const W = 1800, H = 1100;
  const viewTransform = `translate(${view.x},${view.y}) scale(${view.scale})`;

  // Cursor for draw tool
  const cursor = armedKind ? 'copy'
              : tool === 'draw' ? 'crosshair'
              : tool === 'pan' ? (isPanning ? 'grabbing' : 'grab')
              : tool === 'dispatch' ? 'crosshair'
              : 'default';

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap ${eraserMode ? 'eraser-mode' : ''} ${isPanning ? 'dragging' : ''}`}
      style={{ flex: 1, cursor }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onContextMenu={onContextMenu}
    >
      <svg
        ref={svgRef}
        className="city-svg"
        width="100%" height="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onMouseDown}
        onMouseMove={(e) => { onMouseMove(e); onSvgMove(e); }}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onClick={handleBgClick}
      >
        <PaperDefs/>
        <rect x="0" y="0" width={W} height={H} fill="url(#grass)"/>
        <rect x="0" y="0" width={W} height={H} fill="url(#paper-grain)" opacity="0.6"/>

        {/* Drifting clouds in viewport space — always glide past, regardless of pan/zoom */}
        <Clouds w={W} h={H} on={liveMode}/>

        <g transform={viewTransform}>
          {/* Snap grid (only while drawing or dragging) */}
          {isEditing && (
            <rect x="-3000" y="-3000" width="9000" height="9000"
                  fill="url(#snap-grid)" pointerEvents="none"/>
          )}
          {/* Road network — layered for clean crossings */}
          <RoadNetwork
            streets={state.streets}
            intersections={intersections}
            selectedId={selectedId}
            multiSelected={multiSelected}
            onStreetClick={handleStreetClick}
            onStreetDouble={handleStreetDouble}
            onStreetContextMenu={(s, e) => openContextMenu(e, { kind: 'street', id: s.id })}
            onEndpointMouseDown={(streetId, end, e) => {
              endpointDragRef.current = { streetId, end };
              bumpHistory();
              setIsEditing(true);
            }}
            hoverEndpoint={hoverEndpoint}
          />
          {/* crosswalks at right-angle intersections */}
          <Crosswalks
            items={intersections.filter(it => it.type === 'right')}
            streets={state.streets}/>
          {/* intersection labels */}
          {intersections.map((it, i) => (
            <Intersection key={i} it={it} showAngles={showAngles}/>
          ))}
          {/* live angle indicator while dragging an endpoint */}
          {angleHud && (
            <g pointerEvents="none">
              {/* arc from horizontal axis to current direction */}
              {(() => {
                const r = 36;
                const dx = angleHud.tx - angleHud.x, dy = angleHud.ty - angleHud.y;
                const len = Math.hypot(dx, dy);
                if (len < 4) return null;
                let deg = angleHud.deg;
                // draw an arc from 0° (right) sweeping to deg
                const rad = deg * Math.PI / 180;
                const ax = angleHud.x + r, ay = angleHud.y;
                const bx = angleHud.x + Math.cos(rad) * r;
                const by = angleHud.y + Math.sin(rad) * r;
                const large = deg > 180 ? 1 : 0;
                const sweep = 1; // CCW in screen space (deg increases clockwise visually)
                return (
                  <g>
                    {/* horizontal reference */}
                    <line x1={angleHud.x} y1={angleHud.y} x2={angleHud.x + r + 14} y2={angleHud.y}
                          stroke="#3b6fb5" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
                    {/* arc */}
                    <path d={`M ${ax} ${ay} A ${r} ${r} 0 ${large} ${sweep} ${bx} ${by}`}
                          fill="none" stroke={angleHud.snapped ? '#d97757' : '#3b6fb5'} strokeWidth="2.5"/>
                    {/* tick at the dragged direction */}
                    <line x1={angleHud.x} y1={angleHud.y} x2={bx} y2={by}
                          stroke={angleHud.snapped ? '#d97757' : '#3b6fb5'} strokeWidth="1.5" opacity="0.5"/>
                    {/* label */}
                    <g transform={`translate(${angleHud.x + Math.cos(rad/2)*54}, ${angleHud.y + Math.sin(rad/2)*54})`}>
                      <rect x="-26" y="-13" width="52" height="22" rx="4"
                            fill="#fff" stroke={angleHud.snapped ? '#d97757' : '#3b6fb5'} strokeWidth="1.5"/>
                      <text x="0" y="4" textAnchor="middle"
                            style={{ fontFamily: 'Patrick Hand, cursive', fontSize: 16, fontWeight: 600 }}
                            fill={angleHud.snapped ? '#d97757' : '#3b6fb5'}>
                        {deg}°{angleHud.snapped ? ' ⊕' : ''}
                      </text>
                    </g>
                  </g>
                );
              })()}
            </g>
          )}
          {/* buildings — vehicles are skipped here when liveMode is on
              and rendered by <CityLife> instead. */}
          {state.buildings.map(b => {
            if (liveMode && VEHICLE_KINDS.has(b.kind)) return null;
            const def = Buildings.getDef(b.kind);
            const isSel = (selectedId?.kind === 'building' && selectedId.id === b.id) ||
                          (multiSelected && multiSelected.has(`building:${b.id}`));
            return (
              <Building
                key={b.id} b={b} def={def}
                selected={isSel}
                onMouseDown={(e) => handleBuildingMouseDown(b, e)}
                onClick={(e) => { e.stopPropagation(); }}
                onDoubleClick={(e) => handleBuildingDouble(b, e)}
                onContextMenu={(e) => openContextMenu(e, { kind: 'building', id: b.id })}
              />
            );
          })}
          {/* Animated vehicles, pedestrians, dispatched emergency vehicles,
              and traffic lights at right-angle intersections. */}
          {liveMode && (
            <CityLife
              vehicles={state.buildings.filter(b => VEHICLE_KINDS.has(b.kind))}
              streets={state.streets}
              busStops={state.buildings.filter(b => b.kind === 'busStop')}
              fireDepts={state.buildings.filter(b => b.kind === 'fire')}
              policeStations={state.buildings.filter(b => b.kind === 'police')}
              lightInfo={{ byStreet: lightData.byStreet }}
              trafficLights={lightData.lights}
              soundOn={soundOn}
              dispatches={dispatches}
              onDispatchDone={onDispatchDone}
              allBuildings={state.buildings}
              pedTarget={pedTarget}
              planeTarget={planeTarget}
            />
          )}
          {/* protractor overlay */}
          <Protractor it={hoverIntersection}/>

          {/* marquee selection rectangle */}
          {marquee && (
            <rect
              x={Math.min(marquee.x1, marquee.x2)}
              y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)}
              height={Math.abs(marquee.y2 - marquee.y1)}
              fill="rgba(59,111,181,0.10)"
              stroke="#3b6fb5" strokeWidth="1.4" strokeDasharray="6 4"
              pointerEvents="none"/>
          )}
          {/* draw preview */}
          {drawPreview && (() => {
            const style = window.DRAW_STYLES?.find(d => d.id === drawStyle) || {};
            const segs = style.expand ? style.expand(drawPreview) : [drawPreview];
            const ang = Math.atan2(drawPreview.y2 - drawPreview.y1, drawPreview.x2 - drawPreview.x1) * 180 / Math.PI;
            const len = Math.hypot(drawPreview.x2 - drawPreview.x1, drawPreview.y2 - drawPreview.y1);
            return (
              <g pointerEvents="none">
                {segs.map((s, i) => (
                  <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke="#3b6fb5" strokeWidth="30" strokeLinecap="round"
                    opacity="0.35"/>
                ))}
                {segs.map((s, i) => (
                  <line key={'d'+i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
                    stroke="#3b6fb5" strokeWidth="2" strokeLinecap="round"
                    strokeDasharray="6 4" opacity="0.9"/>
                ))}
                <text x={(drawPreview.x1+drawPreview.x2)/2} y={(drawPreview.y1+drawPreview.y2)/2 - 28}
                  textAnchor="middle" className="angle-label" fill="#3b6fb5">
                  {Math.round(len)}px · {Math.round(((ang%180)+180)%180)}°
                </text>
              </g>
            );
          })()}
        </g>
        <Weather kind={weather} w={W} h={H}/>
      </svg>

      {editName && (
        <div className="name-edit" style={{ left: editName.x + 8, top: editName.y + 8 }}>
          <input
            autoFocus
            value={editName.value}
            onChange={(e) => setEditName({ ...editName, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName();
              if (e.key === 'Escape') setEditName(null);
            }}
            onBlur={commitName}
            placeholder={editName.kind === 'street' ? 'Street name...' : 'Building name...'}
          />
        </div>
      )}

      {contextMenu && (
        <div className="ctx-menu" style={{ left: contextMenu.x, top: contextMenu.y }}
             onContextMenu={(e) => e.preventDefault()}>
          <button onClick={ctxRename}>✏️ Rename</button>
          {contextMenu.target.kind === 'building' && (
            <button onClick={ctxRotate}>↻ Rotate 90°</button>
          )}
          <button onClick={ctxDuplicate}>📋 Duplicate</button>
          <button className="ctx-danger" onClick={ctxDelete}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
};

// ----- DRAW STYLES (shared with App.jsx) -----
// Each style takes a {x1,y1,x2,y2} stroke and returns one or more street segments
window.DRAW_STYLES = [
  {
    id: 'single',
    label: 'Single road',
    icon: '╱',
    hint: 'Click + drag',
    expand: (s) => [s],
  },
  {
    id: 'parallel',
    label: 'Parallel pair',
    icon: '∥',
    hint: 'Two parallel roads, 80px apart',
    expand: (s) => {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len; // perpendicular
      const off = 90;
      return [
        { x1: s.x1 + nx*off/2, y1: s.y1 + ny*off/2, x2: s.x2 + nx*off/2, y2: s.y2 + ny*off/2 },
        { x1: s.x1 - nx*off/2, y1: s.y1 - ny*off/2, x2: s.x2 - nx*off/2, y2: s.y2 - ny*off/2 },
      ];
    },
  },
  {
    id: 'perpendicular',
    label: 'Perpendicular cross',
    icon: '✚',
    hint: 'Adds a 90° crossing road',
    expand: (s) => {
      const mx = (s.x1+s.x2)/2, my = (s.y1+s.y2)/2;
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const half = len / 2;
      return [
        s,
        { x1: mx - nx*half, y1: my - ny*half, x2: mx + nx*half, y2: my + ny*half },
      ];
    },
  },
  {
    id: 'transversal',
    label: 'Diagonal',
    icon: '╲',
    hint: 'Free-angle road (good for transversals)',
    expand: (s) => [s],
  },
];
