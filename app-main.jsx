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
};
function computePopulation(buildings) {
  if (!buildings || !buildings.length) return 0;
  let total = 0;
  for (const b of buildings) {
    total += POPULATION_WEIGHTS[b.kind] ?? 5;
  }
  return total;
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  // default = rubric starter
  const cx = 900, cy = 550;
  const streets = Patterns.list[0].fn(cx, cy).map(s => ({
    ...s, id: nextId('s'), name: s.suggestedName,
  }));
  return {
    cityName: 'My Awesome City',
    streets,
    buildings: [],
  };
}

function App() {
  const [state, setState] = useStateA(loadInitialState);
  const [tool, setTool] = useStateA(savedPref('tool', 'select')); // select | pan | eraser | draw
  const [drawStyle, setDrawStyle] = useStateA(savedPref('drawStyle', 'single'));
  const [showAngles, setShowAngles] = useStateA(savedPref('showAngles', false));
  const [showProtractor, setShowProtractor] = useStateA(true);
  const [liveMode, setLiveMode] = useStateA(savedPref('liveMode', true));
  const [soundOn, setSoundOn] = useStateA(savedPref('soundOn', true));
  const [selectedId, setSelectedId] = useStateA(null);
  const [toast, setToast] = useStateA(null);
  const [confirmDialog, setConfirmDialog] = useStateA(null); // { title, message, confirmLabel, danger, onConfirm }
  const [zoomTick, setZoomTick] = useStateA(0);
  const [fitTick, setFitTick] = useStateA(0);
  const undoStack = useRefA([]);
  const redoStack = useRefA([]);

  // Auto-save city
  useEffectA(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }, [state]);

  // Auto-save user prefs (toolbar toggles)
  useEffectA(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        tool, drawStyle, showAngles, liveMode, soundOn,
      }));
    } catch (e) {}
  }, [tool, drawStyle, showAngles, liveMode, soundOn]);

  // Toast helper
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

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
      location.reload();
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
          bumpHistory={bumpHistory}
          zoomTick={zoomTick}
          fitTick={fitTick}
          liveMode={liveMode}
          soundOn={soundOn}
        />

        {/* Title bar overlay */}
        <div className="title-bar" data-no-pan>
          <input
            className="city"
            value={state.cityName}
            onChange={(e) => setState(s => ({ ...s, cityName: e.target.value }))}
            placeholder="My City"
          />
          <span className="pop">Population:</span>
          <span className="pop-num pop-num-derived" title="Auto-counted from buildings you place">
            {computePopulation(state.buildings).toLocaleString()}
          </span>
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
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
