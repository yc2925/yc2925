/**
 * Curve-Driven Gothic World (Step 47 vertical slice).
 *
 * One project document drives every stage:
 *   curves (left dock editor) → Gothic skeleton → lithic formation → world.
 * Docs: Docs/47-curve-driven-gothic-world/.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import CurveEditor from '../world/editor/CurveEditor.jsx'
import WorldViewport from '../world/compose/WorldViewport.jsx'
import { Outliner, ParamPanel } from '../world/ui/WorldPanels.jsx'
import { useWorldProject } from '../world/ui/useWorldProject.js'
import { useStructureGeneration } from '../world/ui/useStructureGeneration.js'

const STAGES = [
  { id: 'curves', label: 'Curves' },
  { id: 'skeleton', label: 'Gothic Skeleton' },
  { id: 'lithic', label: 'Lithic Formation' },
  { id: 'world', label: 'World' },
]

const MODES = [
  { id: 'draw', label: 'Draw', key: 'D' },
  { id: 'edit', label: 'Edit', key: 'V' },
  { id: 'navigate', label: 'Pan', key: 'H' },
]

export default function WorldView({ labNoise = null }) {
  const store = useWorldProject()
  const { project, dispatch, endGesture, undo, redo, canUndo, canRedo } = store
  const structures = useStructureGeneration(project)
  const [stage, setStage] = useState('curves')
  const [mode, setMode] = useState('draw')
  const [grid, setGrid] = useState(1)
  const [curveType, setCurveType] = useState('catmullRom')
  const [xray, setXray] = useState(false)
  // Debug layer (curve → skeleton): UI state only, never saved in the project.
  const [debug, setDebug] = useState({ on: false, construction: true, members: true, labels: true, focus: null, stoneColor: 'kind', conflicts: true, build: null, playing: false, inspect: null })
  // Build timelapse: advance the placement fraction while playing.
  useEffect(() => {
    if (!debug.playing) return undefined
    const id = setInterval(() => {
      setDebug((d) => {
        const next = Math.min(1, (d.build ?? 0) + 0.012)
        return { ...d, build: next, playing: next < 1 }
      })
    }, 40)
    return () => clearInterval(id)
  }, [debug.playing])
  const inspectStone = useCallback((curveId, index) => {
    setDebug((d) => ({ ...d, inspect: { curveId, index } }))
    setUi((u) => ({ ...u, selectedCurveId: curveId, selectedPoint: null }))
  }, [])
  const [pointCloud, setPointCloud] = useState(false)
  // Point cloud and X-ray are World-stage view modes, mutually exclusive.
  const togglePointCloud = () => {
    setXray(false)
    setPointCloud((p) => !p)
  }
  const toggleXray = () => {
    setPointCloud(false)
    setXray((x) => !x)
  }
  const inWorld = stage === 'world'
  // Effective stage for the viewport / panel: the point cloud renders as its own view.
  const viewStage = inWorld && pointCloud ? 'pointcloud' : stage
  const viewXray = inWorld && xray
  const [view, setView] = useState('top')
  const [stabilizer, setStabilizer] = useState(0.45)
  const [dockWide, setDockWide] = useState(false)
  const [rawUi, setUi] = useState({ selectedCurveId: null, selectedPoint: null, hover: null })
  // A curve or point removed by undo / delete can no longer be selected.
  const selCurve = rawUi.selectedCurveId ? project.curves[rawUi.selectedCurveId] : null
  const ui = {
    ...rawUi,
    selectedCurveId: selCurve ? rawUi.selectedCurveId : null,
    selectedPoint: selCurve && rawUi.selectedPoint != null && rawUi.selectedPoint < selCurve.controlPoints.length ? rawUi.selectedPoint : null,
  }
  const viewportRef = useRef(null)

  const selected = structures.find((s) => s.curveId === ui.selectedCurveId) ?? null

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'd' || e.key === 'D') setMode('draw')
      if (e.key === 'v' || e.key === 'V') setMode('edit')
      if (e.key === 'f' || e.key === 'F') setView((v) => (v === 'top' ? 'front' : v === 'front' ? 'side' : 'top'))
      if (e.key === 'h' || e.key === 'H') setMode('navigate')
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedCurveId) {
        e.preventDefault()
        if (ui.selectedPoint != null) {
          dispatch({ type: 'deletePoint', curveId: ui.selectedCurveId, index: ui.selectedPoint })
          setUi((u) => ({ ...u, selectedPoint: null }))
        } else {
          dispatch({ type: 'deleteCurve', curveId: ui.selectedCurveId })
          setUi({ selectedCurveId: null, selectedPoint: null, hover: null })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, dispatch, ui.selectedCurveId, ui.selectedPoint])

  const fit = useCallback((s) => {
    if (s?.skeleton?.bounds && Number.isFinite(s.skeleton.bounds.min.x)) viewportRef.current?.fit(s.skeleton.bounds)
  }, [])
  const fitAll = useCallback(() => {
    const boxes = structures.map((s) => s.skeleton.bounds).filter(Boolean)
    if (!boxes.length) return
    const min = { x: Math.min(...boxes.map((b) => b.min.x)), y: Math.min(...boxes.map((b) => b.min.y)), z: Math.min(...boxes.map((b) => b.min.z)) }
    const max = { x: Math.max(...boxes.map((b) => b.max.x)), y: Math.max(...boxes.map((b) => b.max.y)), z: Math.max(...boxes.map((b) => b.max.z)) }
    viewportRef.current?.fit({ min, max })
  }, [structures])

  return (
    <div className={`world-app${dockWide ? ' is-dock-wide' : ''}`}>
      <nav className="world-stages" aria-label="Generation stages">
        {STAGES.map((s, i) => (
          <button key={s.id} type="button" className={stage === s.id ? 'is-active' : undefined} onClick={() => setStage(s.id)}>
            <span className="world-stage-index">{i + 1}</span>
            {s.label}
          </button>
        ))}
        <span className="world-stages-spacer" />
        {inWorld ? (
          <>
        <button
          type="button"
          className={project.world.presentation.terrainGrid !== false ? 'is-active' : undefined}
          onClick={() => dispatch({ type: 'setWorldParam', group: 'presentation', key: 'terrainGrid', value: project.world.presentation.terrainGrid === false })}
          title="Show or hide the wire grid on the terrain (World view and X-ray)"
        >
          Grid
        </button>
        <button type="button" className={pointCloud ? 'is-active' : undefined} onClick={togglePointCloud} title="Point cloud: the built world as a photogrammetry survey scan on black, with survey stations (REF-031)">
          Point cloud
        </button>
        <button type="button" className={xray ? 'is-active' : undefined} onClick={toggleXray} title="X-ray: wire-mesh scrim on black — see through stones to the skeleton inside (REF-026)">
          X-ray
        </button>
          </>
        ) : null}
        <button type="button" className={debug.on ? 'is-active' : undefined} onClick={() => setDebug((d) => ({ ...d, on: !d.on, focus: null }))} title="Debug: show the rules and construction geometry that turn each curve into its Gothic skeleton (rule log in the right panel)">
          Debug
        </button>
        <button type="button" title="Frame the selected structure — or the whole world when nothing is selected" onClick={() => (selected ? fit(selected) : fitAll())} disabled={!structures.length}>
          {selected ? 'Fit selected' : 'Fit world'}
        </button>
      </nav>

      <section className="world-dock" aria-label="Curve editor">
        <div className="world-dock-toolbar">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mode === m.id ? 'is-active' : undefined}
              title={`${m.label} (${m.key})`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          <select value={view} onChange={(e) => setView(e.target.value)} aria-label="Editor view" title="Top: plan (X/Z). Front: elevation (X/height). Side: elevation (Z/height). Draw or drag points in every view; F cycles the views">
            <option value="top">Top</option>
            <option value="front">Front</option>
            <option value="side">Side</option>
          </select>
          <select value={curveType} onChange={(e) => setCurveType(e.target.value)} aria-label="New curve type" title="Type given to newly drawn curves">
            <option value="catmullRom">Spline</option>
            <option value="polyline">Polyline</option>
          </select>
          <select value={grid} onChange={(e) => setGrid(Number(e.target.value))} aria-label="Grid snap" title="Snap control points to a grid">
            <option value={0}>Snap off</option>
            <option value={0.5}>Snap 0.5 m</option>
            <option value={1}>Snap 1 m</option>
            <option value={5}>Snap 5 m</option>
          </select>
          <button type="button" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!canRedo} title="Redo (⇧⌘Z)">
            ↷
          </button>
          <button type="button" onClick={() => setDockWide((w) => !w)} title="Expand / shrink editor">
            {dockWide ? '◧' : '◨'}
          </button>
          <label className={`world-stabilizer${mode === 'draw' ? '' : ' is-disabled'}`} title="Line stabilizer (Draw mode): the pen trails the cursor on a string of this length, smoothing hand jitter (0 = off)">
            <span>Stabilizer</span>
            <input type="range" min={0} max={1} step={0.05} value={stabilizer} disabled={mode !== 'draw'} onChange={(e) => setStabilizer(Number(e.target.value))} />
            <span className="world-param-value">{stabilizer === 0 ? 'off' : stabilizer < 0.35 ? 'light' : stabilizer < 0.7 ? 'medium' : 'strong'}</span>
          </label>
        </div>
        <div className="world-dock-field">
          <CurveEditor
            project={project}
            structures={structures}
            mode={mode}
            view={view}
            stabilizer={stabilizer}
            grid={grid}
            ui={ui}
            setUi={setUi}
            dispatch={dispatch}
            endGesture={endGesture}
            curveType={curveType}
          />
          <p className="world-dock-hint">
            {mode === 'draw'
              ? 'Drag to draw · drag point → point to connect'
              : mode === 'edit'
                ? view === 'top'
                  ? 'Drag point · ⇧drag = height · dbl-click curve = add point · Del'
                  : 'Drag point in X / height · dbl-click curve = add point'
                : 'Drag to pan · wheel to zoom'}
          </p>
        </div>
        <Outliner structures={structures} ui={ui} setUi={setUi} dispatch={dispatch} />
      </section>

      <section className="world-viewport" aria-label="3D world">
        <WorldViewport
          ref={viewportRef}
          structures={structures}
          stage={viewStage}
          xray={viewXray}
          presentation={project.world.presentation}
          terrain={project.world.terrain}
          selectedCurveId={ui.selectedCurveId}
          debug={debug}
          onInspect={debug.on ? inspectStone : null}
          onSelect={(curveId) => setUi((u) => ({ ...u, selectedCurveId: curveId, selectedPoint: null }))}
        />
      </section>

      <ParamPanel
        stage={viewStage}
        project={project}
        structure={selected}
        ui={ui}
        setUi={setUi}
        dispatch={dispatch}
        onFit={fit}
        labNoise={labNoise}
        debug={debug}
        setDebug={setDebug}
        structures={structures}
      />
    </div>
  )
}
