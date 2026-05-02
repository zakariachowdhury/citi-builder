// App.jsx — top-level state, undo/redo, save/load, export
const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA, useCallback: useCallbackA, useRef: useRefA } = React;

const STORAGE_KEY = 'geometry-city-state-v1';
const PREFS_KEY = 'geometry-city-prefs-v1';

// Read user-toggle prefs once at module load. `savedPref(k, fallback)` returns
// the stored value if present, otherwise `fallback` — used to seed useState.
const _SAVED_PREFS = (() => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch (e) { return {}; }
})();
function savedPref(key, fallback) {
  return _SAVED_PREFS[key] !== undefined ? _SAVED_PREFS[key] : fallback;
}

let __idCounter = 1;
function nextId(prefix) { return `${prefix}-${Date.now().toString(36)}-${(__idCounter++).toString(36)}`; }

// Auto-computed population — each building type contributes a sensible amount.
// Tuned so a typical final-project city lands in a believable hundreds-to-low-thousands range.
const POPULATION_WEIGHTS = {
  home: 4,         // small family per house
  mall: 80,        // shoppers + staff
  school: 220,     // students + teachers
  library: 25,
  park: 30,        // visitors
  grocery: 20,
  masjid: 60,
  police: 15,
  fire: 12,
  movie: 50,
  restaurant: 35,
  gas: 6,
  bank: 18,
  icecream: 10,
  arcade: 25,
  pool: 30,
  shop: 15,
  // decor (small or zero contribution)
  pond: 0, fountain: 0, tree: 0, flower: 0, bench: 0, mailbox: 0,
  car: 2, bus: 18, busStop: 0, streetlight: 0,
  playground: 12, parkingLot: 0, gazebo: 0,
  soccer: 22, tennis: 4, volleyball: 6, basketball: 10, golf: 14,
  // larger civic & leisure buildings
  donut: 8, hospital: 140, amusement: 95, hotel: 70, museum: 40,
};
function computePopulation(buildings) {
  if (!buildings || !buildings.length) return 0;
  let total = 0;
  for (const b of buildings) {
    total += POPULATION_WEIGHTS[b.kind] ?? 5;
  }
  return total;
}

function defaultInitialState(name) {
  const cx = 900, cy = 550;
  const streets = Patterns.list[0].fn(cx, cy).map(s => ({
    ...s, id: nextId('s'), name: s.suggestedName,
  }));
  return {
    cityName: name || 'My Awesome City',
    streets,
    buildings: [],
  };
}

const PROJECTS_KEY = 'geometry-city-projects-v1';

// Load multi-project bundle. Migrates from legacy STORAGE_KEY on first run
// so a user with an existing single city doesn't lose their work.
function loadInitialBundle() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const b = JSON.parse(raw);
      if (b && Array.isArray(b.projects) && b.projects.length) return b;
    }
  } catch (e) {}
  let migrated;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) migrated = JSON.parse(raw);
  } catch (e) {}
  const state = migrated || defaultInitialState();
  const id = `p-${Date.now().toString(36)}`;
  return {
    activeId: id,
    projects: [{ id, name: state.cityName || 'My City', state, modifiedAt: Date.now() }],
  };
}

function loadInitialState() {
  // Kept for compatibility with any caller that imports it; reads the active
  // project from the bundle.
  const b = loadInitialBundle();
  const p = b.projects.find(p => p.id === b.activeId) || b.projects[0];
  return p.state;
}

// ----- ACHIEVEMENTS -----
// Each milestone has an `id`, a `label`, an `emoji` for the toast, and a
// pure check(state, intersections, requiredKinds) predicate. Effects only
// fire on a false→true transition since the last frame, per project.
const ACHIEVEMENTS = [
  { id: 'first_road',     emoji: '🛣️', label: 'First Road!',
    check: (s) => s.streets.length >= 1 },
  { id: 'intersection',   emoji: '➕', label: 'First Intersection!',
    check: (_s, i) => i.length >= 1 },
  { id: 'right_angle',    emoji: '⊥',  label: 'Right-Angle Corner!',
    check: (_s, i) => i.some(it => it.type === 'right') },
  { id: 'parallel_pair',  emoji: '∥',  label: 'Parallel Streets!',
    check: (s) => Geom.findParallels(s.streets).length >= 1 },
  { id: 'first_building', emoji: '🏠', label: 'First Building Placed!',
    check: (s) => s.buildings.length >= 1 },
  { id: 'five_kinds',     emoji: '🏙️', label: '5 Different Kinds!',
    check: (s) => new Set(s.buildings.map(b => b.kind)).size >= 5 },
  { id: 'homes_12',       emoji: '🏘️', label: '12 Homes — a Neighborhood!',
    check: (s) => s.buildings.filter(b => b.kind === 'home').length >= 12 },
  { id: 'all_required',   emoji: '🎉', label: 'All Required Placed!',
    check: (s, _i, req) => req.every(k => s.buildings.some(b => b.kind === k)) },
];

function App() {
  const [bundle, setBundle] = useStateA(loadInitialBundle);
  const activeProject = bundle.projects.find(p => p.id === bundle.activeId) || bundle.projects[0];
  const state = activeProject.state;
  // Wrap setState to write into the active project's slot. Functional and
  // value forms both work; lastModified bumps so the project list is sorted
  // sensibly elsewhere if needed.
  const setState = useCallbackA((updater) => {
    setBundle(prev => {
      const projects = prev.projects.map(p => {
        if (p.id !== prev.activeId) return p;
        const newState = typeof updater === 'function' ? updater(p.state) : updater;
        return { ...p, state: newState, modifiedAt: Date.now(), name: newState.cityName || p.name };
      });
      return { ...prev, projects };
    });
  }, []);

  const [tool, setTool] = useStateA(savedPref('tool', 'select')); // select | pan | eraser | draw
  const [drawStyle, setDrawStyle] = useStateA(savedPref('drawStyle', 'single'));
  const [showAngles, setShowAngles] = useStateA(savedPref('showAngles', false));
  const [showProtractor, setShowProtractor] = useStateA(true);
  const [liveMode, setLiveMode] = useStateA(savedPref('liveMode', true));
  const [soundOn, setSoundOn] = useStateA(savedPref('soundOn', true));
  const [weather, setWeather] = useStateA(savedPref('weather', 'clear'));
  const [selectedId, setSelectedId] = useStateA(null);
  const [multiSelected, setMultiSelected] = useStateA(new Set()); // Set of "kind:id" strings
  const [toast, setToast] = useStateA(null);
  const [confirmDialog, setConfirmDialog] = useStateA(null); // { title, message, confirmLabel, danger, onConfirm }
  const [zoomTick, setZoomTick] = useStateA(0);
  const [fitTick, setFitTick] = useStateA(0);
  const [helpOpen, setHelpOpen] = useStateA(false);
  const [projectsOpen, setProjectsOpen] = useStateA(false);
  const [dispatches, setDispatches] = useStateA([]);
  const undoStack = useRefA([]);
  const redoStack = useRefA([]);

  // Auto-save the entire project bundle.
  useEffectA(() => {
    try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(bundle)); } catch (e) {}
  }, [bundle]);

  // Auto-save user prefs (toolbar toggles)
  useEffectA(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        tool, drawStyle, showAngles, liveMode, soundOn, weather,
      }));
    } catch (e) {}
  }, [tool, drawStyle, showAngles, liveMode, soundOn, weather]);

  // Toast helper
  function showToast(msg, ms = 2200) {
    setToast(msg);
    setTimeout(() => setToast(null), ms);
  }

  // Achievement detector — diff currently-met against last-seen for this
  // project; toast each newly-met one. Resets silently when switching
  // projects so loading a finished city doesn't dump every badge.
  const lastAchRef = useRefA({ projectId: null, met: new Set() });
  useEffectA(() => {
    const intersections = Geom.findIntersections(state.streets);
    const reqKinds = Buildings.REQUIRED.map(r => r.kind);
    const met = new Set();
    for (const a of ACHIEVEMENTS) {
      try { if (a.check(state, intersections, reqKinds)) met.add(a.id); } catch (e) {}
    }
    if (lastAchRef.current.projectId !== bundle.activeId) {
      lastAchRef.current = { projectId: bundle.activeId, met };
      return;
    }
    for (const id of met) {
      if (!lastAchRef.current.met.has(id)) {
        const a = ACHIEVEMENTS.find(x => x.id === id);
        if (a) showToast(`${a.emoji} ${a.label}`, 3500);
      }
    }
    lastAchRef.current = { projectId: bundle.activeId, met };
    // eslint-disable-next-line
  }, [state, bundle.activeId]);

  // Confirm modal helper
  function askConfirm(opts, onConfirm) {
    setConfirmDialog({
      title: opts.title, message: opts.message,
      confirmLabel: opts.confirmLabel || 'OK',
      danger: !!opts.danger,
      onConfirm: () => { setConfirmDialog(null); onConfirm(); },
      onCancel: () => setConfirmDialog(null),
    });
  }

  // History
  const bumpHistory = useCallbackA(() => {
    undoStack.current.push(JSON.parse(JSON.stringify(state)));
    if (undoStack.current.length > 40) undoStack.current.shift();
    redoStack.current = [];
  }, [state]);

  function undo() {
    if (!undoStack.current.length) return;
    redoStack.current.push(JSON.parse(JSON.stringify(state)));
    const prev = undoStack.current.pop();
    setState(prev);
    showToast('↶ Undo');
  }
  function redo() {
    if (!redoStack.current.length) return;
    undoStack.current.push(JSON.parse(JSON.stringify(state)));
    const next = redoStack.current.pop();
    setState(next);
    showToast('↷ Redo');
  }

  // Pattern picker
  function pickPattern(id) {
    const p = Patterns.list.find(x => x.id === id);
    if (!p) return;
    const apply = () => {
      bumpHistory();
      const cx = 900, cy = 550;
      const streets = p.fn(cx, cy).map(s => ({
        ...s, id: nextId('s'), name: s.suggestedName,
      }));
      setState(s => ({ ...s, streets }));
      setTimeout(() => setFitTick(t => t + 1), 0);
      showToast('Pattern loaded — double-click streets to rename');
    };
    if (state.streets.length > 0) {
      askConfirm({
        title: 'Replace streets?',
        message: `Load the “${p.label}” pattern? This will replace your current streets (buildings stay put).`,
        confirmLabel: 'Replace streets', danger: true,
      }, apply);
    } else apply();
  }

  // Final-project preset picker — loads streets AND buildings
  function pickFinalProject(id) {
    const p = Patterns.finalProjects.find(x => x.id === id);
    if (!p) return;
    const apply = () => {
      bumpHistory();
      const cx = 900, cy = 550;
      const result = p.fn(cx, cy);
      const streets = (result.streets || []).map(s => ({
        ...s, id: nextId('s'), name: s.suggestedName,
      }));
      const buildings = (result.buildings || []).map(b => ({
        ...b, id: nextId('b'),
      }));
      setState(s => ({ ...s, streets, buildings }));
      setTimeout(() => setFitTick(t => t + 1), 0);
      showToast('🏙️ Final-project preset loaded — customize away!');
    };
    if (state.streets.length > 0 || state.buildings.length > 0) {
      askConfirm({
        title: 'Replace your city?',
        message: `Load the “${p.label}” preset? This will replace your current streets AND buildings.`,
        confirmLabel: 'Load preset', danger: true,
      }, apply);
    } else apply();
  }

  function generateRandomCity() {
    const apply = () => {
      bumpHistory();
      const result = Patterns.randomCity(900, 550);
      const streets = (result.streets || []).map(s => ({
        ...s, id: nextId('s'), name: s.suggestedName,
      }));
      const buildings = (result.buildings || []).map(b => ({
        ...b, id: nextId('b'),
      }));
      setState(s => ({ ...s, streets, buildings }));
      setTimeout(() => setFitTick(t => t + 1), 0);
      showToast('🎲 Random city generated');
    };
    if (state.streets.length > 0 || state.buildings.length > 0) {
      askConfirm({
        title: 'Replace your city with a random one?',
        message: 'A new procedurally-generated layout will replace your current streets and buildings.',
        confirmLabel: 'Generate', danger: true,
      }, apply);
    } else apply();
  }

  // Duplicate everything in the multi-selection 30 px down/right; the new
  // copies become the active multi-selection.
  function duplicateSelection() {
    if (!multiSelected || multiSelected.size === 0) return;
    bumpHistory();
    const offset = 30;
    const newBuildings = [], newStreets = [];
    const newSel = new Set();
    for (const key of multiSelected) {
      const [kind, id] = key.split(':');
      if (kind === 'building') {
        const b = state.buildings.find(x => x.id === id);
        if (b) {
          const nb = { ...b, id: nextId('b'), x: b.x + offset, y: b.y + offset };
          newBuildings.push(nb);
          newSel.add(`building:${nb.id}`);
        }
      } else if (kind === 'street') {
        const st = state.streets.find(x => x.id === id);
        if (st) {
          const ns = { ...st, id: nextId('s'),
            x1: st.x1 + offset, y1: st.y1 + offset,
            x2: st.x2 + offset, y2: st.y2 + offset };
          newStreets.push(ns);
          newSel.add(`street:${ns.id}`);
        }
      }
    }
    if (!newBuildings.length && !newStreets.length) return;
    setState(s => ({
      ...s,
      streets: [...s.streets, ...newStreets],
      buildings: [...s.buildings, ...newBuildings],
    }));
    setMultiSelected(newSel);
    showToast(`📋 Duplicated ${newBuildings.length + newStreets.length} item(s)`);
  }

  // Drop from palette
  function onPaletteDrop(kind, x, y) {
    const def = Buildings.getDef(kind);
    if (!def) return;
    bumpHistory();
    const placedSameKind = state.buildings.filter(b => b.kind === kind).length;
    let label = def.label;
    if (kind === 'home') label = ''; // homes don't need labels
    if (Buildings.DECOR.find(d => d.kind === kind)) label = '';
    let variant = placedSameKind;
    let rot = 0;
    // Cars: random color + align to nearest road; flip 180° on the opposite side
    // so cars on each side appear to drive in opposite directions.
    if (kind === 'car') {
      variant = Math.floor(Math.random() * 9);
      const near = nearestRoad(state.streets, x, y, 80);
      if (near) {
        const angle = Math.atan2(near.street.y2 - near.street.y1,
                                 near.street.x2 - near.street.x1) * 180 / Math.PI;
        rot = angle;
        // Keep wheels on the ground — clamp to [-90, 90]. (Cars are roughly
        // symmetric front-to-back, so we just align with the road.)
        if (rot > 90) rot -= 180;
        else if (rot < -90) rot += 180;
      }
    }
    setState(s => ({
      ...s,
      buildings: [...s.buildings, {
        id: nextId('b'),
        kind, x, y, rot, variant, label,
      }],
    }));
  }

  // Closest street segment to (x,y), within `maxDist` px. Returns
  // { street, side } where side = sign of cross product (which side of the
  // road centerline the point falls on). null if nothing in range.
  function nearestRoad(streets, x, y, maxDist) {
    let best = null, bestD = maxDist;
    for (const s of streets) {
      const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      const t = Math.max(0, Math.min(1, ((x - s.x1) * dx + (y - s.y1) * dy) / len2));
      const px = s.x1 + t * dx, py = s.y1 + t * dy;
      const d = Math.hypot(x - px, y - py);
      if (d < bestD) {
        const cross = (x - s.x1) * dy - (y - s.y1) * dx;
        bestD = d;
        best = { street: s, side: Math.sign(cross) || 1 };
      }
    }
    return best;
  }

  function clearAll() {
    askConfirm({
      title: 'Clear everything?',
      message: 'This removes every street and building. You can undo with Ctrl+Z.',
      confirmLabel: 'Clear all', danger: true,
    }, () => {
      bumpHistory();
      setState({ ...state, streets: [], buildings: [] });
    });
  }

  // Keyboard shortcuts: ctrl/cmd+z, ctrl/cmd+shift+z
  useEffectA(() => {
    function onKey(e) {
      if (e.key === 'Escape' && confirmDialog) {
        e.preventDefault(); confirmDialog.onCancel(); return;
      }
      if (e.target.tagName === 'INPUT') return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault(); redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault(); duplicateSelection();
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault(); setHelpOpen(o => !o);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const intersections = useMemoA(() => Geom.findIntersections(state.streets), [state.streets]);
  const rubric = useMemoA(() => Geom.checkRubric(state.streets, intersections, state.buildings),
    [state.streets, intersections, state.buildings]);

  // Export PNG
  async function exportPNG() {
    const svg = document.querySelector('svg.city-svg');
    if (!svg) return;
    // clone, freeze size
    const W = 1800, H = 1100;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', W);
    clone.setAttribute('height', H);
    // strip transform on inner g (export the whole world)
    const inner = clone.querySelector('g[transform]');
    if (inner) inner.setAttribute('transform', '');
    // Inject styles inline — the standalone SVG won't load styles.css when
    // rendered via <img>, so class-based fills/fonts default to black and
    // street name labels would render as black-on-black rects.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const styleEl = document.createElementNS(SVG_NS, 'style');
    styleEl.textContent = `
      .street-name { font-family: 'Patrick Hand','Caveat',cursive; font-size: 16px; fill: #2a2418; }
      .street-name-bg { fill: #ffffff; stroke: rgba(42,36,24,0.3); stroke-width: 1; }
      .building-label { font-family: 'Patrick Hand','Caveat',cursive; font-size: 13px; fill: #2a2418; text-anchor: middle; }
      .angle-label { font-family: 'Patrick Hand','Caveat',cursive; font-size: 11px; fill: #4a3f2c; }
    `;
    clone.insertBefore(styleEl, clone.firstChild);
    // serialize
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([
      `<?xml version="1.0" encoding="UTF-8"?>\n` + xml
    ], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f4ead5';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      // Title
      ctx.fillStyle = '#2a2418';
      ctx.font = 'bold 48px Gloria Hallelujah, Patrick Hand, cursive';
      ctx.textAlign = 'center';
      ctx.fillText(state.cityName, W/2, 60);
      ctx.font = '28px Patrick Hand, cursive';
      ctx.fillText(`Population: ${computePopulation(state.buildings)}`, W/2, 100);
      c.toBlob(b => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = `${state.cityName.replace(/[^a-z0-9]/gi, '_')}.png`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('🎨 Saved as image!');
      }, 'image/png');
    };
    img.onerror = () => showToast('Export failed — try Print instead');
    img.src = url;
  }

  function printMap() { window.print(); }

  // Click-to-dispatch: send a car driving from a random road to the building.
  function dispatchCarTo(building) {
    const RP = window.RoutePlanner;
    if (!RP || !state.streets.length) {
      showToast('Add some roads first');
      return;
    }
    const dest = RP.projectClosest(state.streets, building.x, building.y);
    if (!dest || dest.dist > 200) {
      showToast('No road near that building');
      return;
    }
    // Pick a random starting segment far enough away to feel like a journey.
    let startSeg = state.streets[Math.floor(Math.random() * state.streets.length)];
    for (let tries = 0; tries < 5; tries++) {
      const cand = state.streets[Math.floor(Math.random() * state.streets.length)];
      const cx = (cand.x1 + cand.x2) / 2, cy = (cand.y1 + cand.y2) / 2;
      if (Math.hypot(cx - building.x, cy - building.y) > 200) { startSeg = cand; break; }
    }
    const path = RP.findRoutePath(state.streets, startSeg.id, dest.street.id);
    if (!path) {
      showToast('No road route to that building');
      return;
    }
    const startT = Math.random();
    const segs = RP.precomputeRouteSegments(path, startT, dest.t);
    setDispatches(prev => [...prev, {
      id: `disp-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
      path: segs,
      destX: building.x, destY: building.y,
      variant: Math.floor(Math.random() * 9),
    }]);
    showToast(`🚕 Car heading to ${building.label || building.kind}`);
  }
  function clearDispatch(id) {
    setDispatches(prev => prev.filter(d => d.id !== id));
  }

  function exportJSON() {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      cityName: state.cityName,
      population: state.population,
      streets: state.streets,
      buildings: state.buildings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(state.cityName || 'city').replace(/[^a-z0-9]/gi, '_')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast('💾 City exported as JSON');
  }

  function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        let data;
        try { data = JSON.parse(ev.target.result); }
        catch { showToast('Could not parse — is that a JSON file?'); return; }
        if (!data || !Array.isArray(data.streets) || !Array.isArray(data.buildings)) {
          showToast('Not a Geometry City file — missing streets/buildings');
          return;
        }
        askConfirm({
          title: 'Replace your city?',
          message: `Load "${data.cityName || 'imported city'}"? This replaces your current streets and buildings.`,
          confirmLabel: 'Load', danger: true,
        }, () => {
          bumpHistory();
          setState(s => ({
            ...s,
            cityName: data.cityName || s.cityName,
            population: typeof data.population === 'number' ? data.population : s.population,
            streets: data.streets,
            buildings: data.buildings,
          }));
          showToast(`📂 Loaded "${data.cityName || 'city'}"`);
        });
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function resetSaved() {
    askConfirm({
      title: 'Start a brand-new city?',
      message: 'Your saved work will be erased and the page will reload.',
      confirmLabel: 'Start over', danger: true,
    }, () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PROJECTS_KEY);
      location.reload();
    });
  }

  // ----- Project (multiple-cities) actions -----
  function newProject() {
    const id = `p-${Date.now().toString(36)}`;
    const cnt = bundle.projects.length + 1;
    const state = defaultInitialState(`My City ${cnt}`);
    setBundle(prev => ({
      activeId: id,
      projects: [...prev.projects, { id, name: state.cityName, state, modifiedAt: Date.now() }],
    }));
    setSelectedId(null);
    showToast('🆕 Started a new city');
  }
  function duplicateProject() {
    const id = `p-${Date.now().toString(36)}`;
    const cur = activeProject;
    const newState = JSON.parse(JSON.stringify(cur.state));
    newState.cityName = `${cur.name} (copy)`;
    setBundle(prev => ({
      activeId: id,
      projects: [...prev.projects, { id, name: newState.cityName, state: newState, modifiedAt: Date.now() }],
    }));
    setSelectedId(null);
    showToast('📋 City duplicated');
  }
  function switchProject(id) {
    if (id === bundle.activeId) return;
    setBundle(prev => ({ ...prev, activeId: id }));
    setSelectedId(null);
  }
  function deleteProject(id) {
    if (bundle.projects.length <= 1) {
      showToast('Can\'t delete the only city — make a new one first');
      return;
    }
    const target = bundle.projects.find(p => p.id === id);
    askConfirm({
      title: `Delete "${target?.name || 'this city'}"?`,
      message: 'This city will be removed permanently. Other cities are unaffected.',
      confirmLabel: 'Delete', danger: true,
    }, () => {
      setBundle(prev => {
        const projects = prev.projects.filter(p => p.id !== id);
        const activeId = prev.activeId === id ? projects[0].id : prev.activeId;
        return { activeId, projects };
      });
    });
  }

  return (
    <div className="app paper-bg">
      <PaletteSidebar
        state={state}
        onPickPattern={pickPattern}
        onPickFinalProject={pickFinalProject}
        onClearAll={clearAll}
      />

      <div className="center-col">
        <CityCanvas
          state={state}
          setState={setState}
          tool={tool}
          setTool={setTool}
          drawStyle={drawStyle}
          showAngles={showAngles}
          showProtractor={showProtractor}
          onPaletteDrop={onPaletteDrop}
          eraserMode={tool === 'eraser'}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          multiSelected={multiSelected}
          setMultiSelected={setMultiSelected}
          bumpHistory={bumpHistory}
          zoomTick={zoomTick}
          fitTick={fitTick}
          liveMode={liveMode}
          soundOn={soundOn}
          weather={weather}
          dispatches={dispatches}
          onDispatch={dispatchCarTo}
          onDispatchDone={clearDispatch}
        />

        {/* Title bar overlay */}
        <div className="title-bar" data-no-pan>
          <input
            className="city"
            value={state.cityName}
            onChange={(e) => setState(s => ({ ...s, cityName: e.target.value }))}
            placeholder="My City"
          />
          <button
            className="city-switcher"
            title="Switch / manage saved cities"
            onClick={() => setProjectsOpen(o => !o)}>
            ▾
          </button>
          <span className="pop">Population:</span>
          <span className="pop-num pop-num-derived" title="Auto-counted from buildings you place">
            {computePopulation(state.buildings).toLocaleString()}
          </span>
          {projectsOpen && (
            <div className="project-menu" onMouseLeave={() => setProjectsOpen(false)}>
              <div className="project-menu-title">Saved cities</div>
              {bundle.projects.map(p => (
                <div key={p.id} className={`project-row ${p.id === bundle.activeId ? 'active' : ''}`}>
                  <button className="project-name" onClick={() => { switchProject(p.id); setProjectsOpen(false); }}>
                    {p.id === bundle.activeId ? '● ' : '  '}{p.name || '(untitled)'}
                  </button>
                  <button className="project-del"
                          title="Delete this city"
                          onClick={() => deleteProject(p.id)}>×</button>
                </div>
              ))}
              <div className="project-menu-actions">
                <button onClick={() => { newProject(); setProjectsOpen(false); }}>+ New blank</button>
                <button onClick={() => { duplicateProject(); setProjectsOpen(false); }}>📋 Duplicate</button>
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="toolbar" data-no-pan>
          <button className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
                  onClick={() => setTool('select')} title="Select / move">
            ✥
          </button>
          <button className={`tool-btn ${tool === 'pan' ? 'active' : ''}`}
                  onClick={() => setTool('pan')} title="Pan (drag map)">
            🖐️
          </button>
          <button className={`tool-btn ${tool === 'draw' ? 'active' : ''}`}
                  onClick={() => setTool('draw')} title="Draw a road">
            ✏️
          </button>
          <button className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
                  onClick={() => setTool(tool === 'eraser' ? 'select' : 'eraser')} title="Eraser">
            🧽
          </button>
          <button className={`tool-btn ${tool === 'dispatch' ? 'active' : ''}`}
                  onClick={() => setTool(tool === 'dispatch' ? 'select' : 'dispatch')}
                  title="Send a car: pick this tool, then click any building">
            🚕
          </button>
          <span className="tool-sep"/>
          <button className="tool-btn" onClick={undo} disabled={!undoStack.current.length} title="Undo (Ctrl+Z)">
            ↶
          </button>
          <button className="tool-btn" onClick={redo} disabled={!redoStack.current.length} title="Redo (Ctrl+Shift+Z)">
            ↷
          </button>
          <span className="tool-sep"/>
          <button className={`tool-btn ${showAngles ? 'active' : ''}`}
                  onClick={() => setShowAngles(!showAngles)} title="Show angle labels">
            📐
          </button>
          <button className={`tool-btn ${liveMode ? 'active' : ''}`}
                  onClick={() => setLiveMode(!liveMode)} title="Bring city to life — cars and buses move around">
            🚦
          </button>
          <button className={`tool-btn ${soundOn ? 'active' : ''}`}
                  onClick={() => setSoundOn(!soundOn)} title="Sound effects — sirens on dispatch, ding at bus stops">
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button className={`tool-btn ${weather !== 'clear' ? 'active' : ''}`}
                  onClick={() => setWeather(weather === 'clear' ? 'rain' : weather === 'rain' ? 'snow' : 'clear')}
                  title={`Weather: ${weather} — click to cycle`}>
            {weather === 'rain' ? '🌧️' : weather === 'snow' ? '❄️' : '☀️'}
          </button>
          <span className="tool-sep"/>
          <button className="tool-btn" onClick={() => setHelpOpen(true)} title="Keyboard shortcuts (?)">
            ?
          </button>
        </div>

        {/* City stats chip */}
        <div className="stats-chip" data-no-pan>
          <span title={`${state.streets.length} road segments`}>🛣 {state.streets.length}</span>
          <span title={`${state.buildings.length} buildings & decor`}>🏠 {state.buildings.length}</span>
          <span title={`${intersections.length} intersections`}>⊥ {intersections.length}</span>
        </div>

        {/* Zoom controls */}
        <div className="zoom-bar" data-no-pan>
          <button className="tool-btn" onClick={() => setZoomTick(t => t + 1)} title="Zoom in">+</button>
          <button className="tool-btn" onClick={() => setZoomTick(t => t - 1)} title="Zoom out">−</button>
          <button className="tool-btn" onClick={() => setFitTick(t => t + 1)} title="Fit to view" style={{ width: 'auto', padding: '0 10px' }}>⤢ Fit</button>
        </div>

        {/* Draw style picker — only when draw tool active */}
        {tool === 'draw' && (
          <div className="draw-style-bar" data-no-pan>
            <div className="draw-style-title">Road type</div>
            <div className="draw-style-list">
              {(window.DRAW_STYLES || []).map(d => (
                <button key={d.id}
                  className={`draw-style-btn ${drawStyle === d.id ? 'active' : ''}`}
                  onClick={() => setDrawStyle(d.id)}
                  title={d.hint}>
                  <span className="draw-style-icon">{d.icon}</span>
                  <span className="draw-style-label">{d.label}</span>
                </button>
              ))}
            </div>
            <div className="draw-style-hint">Click + drag on the map · hold <kbd>Shift</kbd> to snap to 15°</div>
          </div>
        )}

        {/* Bottom toolbar */}
        <div className="bottom-bar" data-no-pan>
          <button className="tool-btn" onClick={generateRandomCity} title="Generate a random city layout" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            🎲 Random
          </button>
          <button className="tool-btn" onClick={exportPNG} title="Save as image (PNG)" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            💾 Save Image
          </button>
          <button className="tool-btn" onClick={exportJSON} title="Export city as JSON file (for backup or sharing)" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            ⬇️ Export JSON
          </button>
          <button className="tool-btn" onClick={importJSON} title="Load a city from a JSON file" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            ⬆️ Import JSON
          </button>
          <button className="tool-btn" onClick={printMap} title="Print" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            🖨️ Print
          </button>
          <button className="tool-btn" onClick={resetSaved} title="New city" style={{ width: 'auto', padding: '0 14px', borderRadius: 12 }}>
            ✨ New
          </button>
        </div>

        {toast && <div className="toast">{toast}</div>}
      </div>

      <RubricSidebar rubric={rubric}/>

      {confirmDialog && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) confirmDialog.onCancel(); }}>
          <div className="modal-card" role="dialog" aria-modal="true">
            <h3 className="modal-title">{confirmDialog.title}</h3>
            <p className="modal-msg">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="modal-btn modal-cancel" onClick={confirmDialog.onCancel} autoFocus>
                Cancel
              </button>
              <button
                className={`modal-btn ${confirmDialog.danger ? 'modal-danger' : 'modal-confirm'}`}
                onClick={confirmDialog.onConfirm}>
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setHelpOpen(false); }}>
          <div className="modal-card" role="dialog" aria-modal="true" style={{ maxWidth: 460 }}>
            <h3 className="modal-title">Keyboard shortcuts</h3>
            <div className="shortcut-list">
              <div className="shortcut-row"><span><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Z</kbd></span><span>Undo</span></div>
              <div className="shortcut-row"><span><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></span><span>Redo</span></div>
              <div className="shortcut-row"><span><kbd>Ctrl</kbd> / <kbd>⌘</kbd> + <kbd>D</kbd></span><span>Duplicate marquee selection</span></div>
              <div className="shortcut-row"><span><kbd>Delete</kbd> · <kbd>Backspace</kbd></span><span>Delete selected</span></div>
              <div className="shortcut-row"><span><kbd>Esc</kbd></span><span>Deselect / cancel draw</span></div>
              <div className="shortcut-row"><span>Click + drag empty canvas (select tool)</span><span>Marquee multi-select</span></div>
              <div className="shortcut-row"><span><kbd>Shift</kbd> while drawing</span><span>Snap to 15° angle</span></div>
              <div className="shortcut-row"><span>Double-click a road or building</span><span>Rename it</span></div>
              <div className="shortcut-row"><span>Drag from the left palette</span><span>Place a building</span></div>
              <div className="shortcut-row"><span><kbd>?</kbd></span><span>Toggle this help</span></div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-confirm" onClick={() => setHelpOpen(false)} autoFocus>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
