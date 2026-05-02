// Sidebar.jsx — left palette + right rubric
const { useState: useStateS } = React;

window.PaletteSidebar = function PaletteSidebar({ state, onPaletteDragStart, onPickPattern, onPickFinalProject, onClearAll, armedKind, onArmKind }) {
  const [tab, setTab] = useStateS('required');
  const placedKinds = new Set(state.buildings.map(b => b.kind));

  const items = tab === 'required' ? Buildings.REQUIRED
              : tab === 'decor'    ? Buildings.DECOR
              : [];

  return (
    <div className="panel" style={{ gridColumn: 1, gridRow: 1 }}>
      <h2>🏗️ City Builder</h2>
      <div className="brand-sub">Drag buildings onto the map →</div>

      <h3>Pick a street pattern</h3>
      <div className="pattern-grid">
        {Patterns.list.map(p => (
          <div key={p.id} className="pattern-item" onClick={() => onPickPattern(p.id)} title={p.desc}>
            <div dangerouslySetInnerHTML={{ __html: p.preview }}/>
            <div style={{ fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <h3>Final-project presets ✨</h3>
      <div className="brand-sub" style={{ marginTop: -4, marginBottom: 6, fontSize: 11 }}>
        Complete cities — streets, buildings, decor.
      </div>
      <div className="pattern-grid">
        {Patterns.finalProjects.map(p => (
          <div key={p.id} className="pattern-item final" onClick={() => onPickFinalProject(p.id)} title={p.desc}>
            <div dangerouslySetInnerHTML={{ __html: p.preview }}/>
            <div style={{ fontWeight: 600 }}>{p.label}</div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>{p.desc}</div>
          </div>
        ))}
      </div>

      <h3>Buildings &amp; decorations</h3>
      <div className="section-tabs">
        <button className={tab==='required' ? 'active' : ''} onClick={() => setTab('required')}>
          Required
        </button>
        <button className={tab==='decor' ? 'active' : ''} onClick={() => setTab('decor')}>
          Decor
        </button>
      </div>

      <div className="palette">
        {items.map(b => {
          const placed = placedKinds.has(b.kind) && !b.stackable;
          return (
            <div
              key={b.kind}
              className={`palette-item ${b.required ? 'required' : ''} ${placed ? 'placed' : ''} ${armedKind === b.kind ? 'armed' : ''}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/building', b.kind);
                e.dataTransfer.effectAllowed = 'copy';
                onPaletteDragStart && onPaletteDragStart(b.kind);
              }}
              onClick={(e) => { e.stopPropagation(); onArmKind && onArmKind(b.kind); }}
              title={(b.hint || b.label) + ' — drag onto map, or tap then tap the map'}
            >
              <svg className="ic" viewBox={`-${b.size/2 + 4} -${b.size/2 + 4} ${b.size + 8} ${b.size + 8}`}
                   width="46" height="46">
                <g dangerouslySetInnerHTML={{ __html: b.draw(0) }}/>
              </svg>
              <div className="lbl">{b.label}</div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onClearAll}
        style={{
          marginTop: 14, width: '100%', padding: '8px 12px',
          fontFamily: 'var(--hand)', fontSize: 14,
          border: '2px solid var(--ink)', borderRadius: 8,
          background: 'var(--paper)', cursor: 'pointer',
          boxShadow: '2px 2px 0 rgba(42,36,24,0.15)',
        }}
      >🗑️ Clear everything</button>
    </div>
  );
};

window.RubricSidebar = function RubricSidebar({ rubric, total, done }) {
  const items = [
    { key: 'streets-named',  label: 'All streets named', done: rubric.streetsNamed,
      sub: `${rubric.namedStreetCount}/${rubric.streetCount} named` },
    { key: 'parallel6',     label: '6 parallel streets', done: rubric.parallel6,
      sub: `${rubric.parallelCount} found` },
    { key: 'transversal2',  label: '2 transversal streets', done: rubric.transversal2,
      sub: `${rubric.transversalCount} found` },
    { key: 'perp2',         label: '2 perpendicular streets (right ⊥)', done: rubric.perp2,
      sub: `${rubric.perpCount || 0} right-angle intersections` },
    { key: 'obtuse2',       label: '2 streets — obtuse angle', done: rubric.obtuse2,
      sub: `${rubric.obtuseCount || 0} obtuse intersections` },
    { key: 'acute2',        label: '2 streets — acute angle', done: rubric.acute2,
      sub: `${rubric.acuteCount || 0} acute intersections` },
    { key: 'has-library',   label: 'Library + Park (vertical angles)', done: rubric.hasLibrary && rubric.hasPark, kid: 'review' },
    { key: 'has-school',    label: 'School + Park (right-angle corner)', done: rubric.hasSchool && rubric.hasPark, kid: 'review' },
    { key: 'has-grocery',   label: 'Grocery — obtuse intersection', done: rubric.hasGrocery, kid: 'review' },
    { key: 'has-masjid',    label: 'Masjid — acute intersection', done: rubric.hasMasjid, kid: 'review' },
    { key: 'has-police',    label: 'Police + Fire (alt interior)', done: rubric.hasPolice && rubric.hasFire, kid: 'review' },
    { key: 'has-movie',     label: 'Movie + Restaurant (supplementary)', done: rubric.hasMovie && rubric.hasRestaurant, kid: 'review' },
    { key: 'restaurant-tx', label: 'Restaurant on a transversal', done: rubric.hasRestaurant, kid: 'review' },
    { key: 'has-gas',       label: 'Gas + Bank (alt exterior)', done: rubric.hasGas && rubric.hasBank, kid: 'review' },
    { key: 'has-mall',      label: 'Mall on a right-angle corner', done: rubric.hasMall, kid: 'review' },
    { key: 'has-icecream',  label: 'Ice Cream + Arcade (consec interior)', done: rubric.hasIcecream && rubric.hasArcade, kid: 'review' },
    { key: 'has-pool',      label: 'Oval Pool near Ice Cream/Arcade', done: rubric.hasPool, kid: 'review' },
    { key: 'has-homes',     label: '12+ homes', done: rubric.homes12,
      sub: `${rubric.homesCount}/12 placed` },
  ];

  const completed = items.filter(i => i.done).length;
  const pct = (completed / items.length) * 100;

  return (
    <div className="panel" style={{ gridColumn: 3, gridRow: 1 }}>
      <h2>📋 Rubric Checklist</h2>
      <div className="brand-sub">Auto-checks as you build</div>

      <div className="rubric-progress">
        <div style={{ width: pct + '%' }}/>
      </div>
      <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 14 }}>
        {completed}/{items.length} complete
      </div>

      <h3>Streets</h3>
      {items.slice(0, 6).map(it => (
        <div key={it.key} className={`rubric-item ${it.done ? 'done' : ''}`}>
          <div className="rubric-check">{it.done ? '✓' : ''}</div>
          <div>
            <div>{it.label}</div>
            {it.sub && <div style={{ fontSize: 11, opacity: 0.7 }}>{it.sub}</div>}
          </div>
        </div>
      ))}

      <h3>Buildings (placement: review yourself)</h3>
      {items.slice(6).map(it => (
        <div key={it.key} className={`rubric-item ${it.done ? 'done' : ''}`}>
          <div className="rubric-check">{it.done ? '✓' : ''}</div>
          <div>
            <div>{it.label}</div>
            {it.sub && <div style={{ fontSize: 11, opacity: 0.7 }}>{it.sub}</div>}
            {it.kid === 'review' && it.done && (
              <div style={{ fontSize: 10, color: 'var(--crayon-orange)' }}>
                ⚠️ check placement matches the angle rule
              </div>
            )}
          </div>
        </div>
      ))}

      <div style={{ marginTop: 12, padding: 8, background: 'rgba(231,185,74,0.2)',
                    border: '1.5px dashed rgba(42,36,24,0.3)', borderRadius: 8,
                    fontSize: 12, color: 'var(--ink-soft)' }}>
        💡 <b>Tip:</b> Drag buildings onto the right corner so they match the angle rule.
        Hover over an intersection to see a protractor!
      </div>
    </div>
  );
};
