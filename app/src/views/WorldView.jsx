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

export default function WorldView() {
  const store = useWorldProject()
  const { project, dispatch, endGesture, undo, redo, canUndo, canRedo } = store
  const { structures, lithic, refine, regenerate, statusOf } = useStructureGeneration(project)
  const [stage, setStage] = useState('curves')
  const [mode, setMode] = useState('draw')
  const [grid, setGrid] = useState(1)
  const [curveType, setCurveType] = useState('catmullRom')
  const [xray, setXray] = useState(false)
  const [dockWide, setDockWide] = useState(false)
  const [rawUi, setUi] = useState({ selectedCurveId: null, selectedPoint: null, drawingCurveId: null })
  // A curve removed by undo / delete can no longer be drawn or selected.
  const ui = {
    ...rawUi,
    drawingCurveId: rawUi.drawingCurveId && project.curves[rawUi.drawingCurveId] ? rawUi.drawingCurveId : null,
    selectedCurveId: rawUi.selectedCurveId && project.curves[rawUi.selectedCurveId] ? rawUi.selectedCurveId : null,
  }
  const viewportRef = useRef(null)

  const selected = structures.find((s) => s.curveId === ui.selectedCurveId) ?? null

  const finishDrawing = useCallback(() => setUi((u) => ({ ...u, drawingCurveId: null })), [])

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
      if (e.key === 'Enter' || e.key === 'Escape') finishDrawing()
      if (e.key === 'd' || e.key === 'D') setMode('draw')
      if (e.key === 'v' || e.key === 'V') {
        finishDrawing()
        setMode('edit')
      }
      if (e.key === 'h' || e.key === 'H') setMode('navigate')
      if ((e.key === 'Delete' || e.key === 'Backspace') && ui.selectedCurveId) {
        e.preventDefault()
        if (ui.selectedPoint != null) {
          dispatch({ type: 'deletePoint', curveId: ui.selectedCurveId, index: ui.selectedPoint })
          setUi((u) => ({ ...u, selectedPoint: null }))
        } else {
          dispatch({ type: 'deleteCurve', curveId: ui.selectedCurveId })
          setUi({ selectedCurveId: null, selectedPoint: null, drawingCurveId: null })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, dispatch, ui.selectedCurveId, ui.selectedPoint, finishDrawing])

  const fit = useCallback((s) => {
    if (s?.skeleton?.bounds && Number.isFinite(s.skeleton.bounds.min.x)) viewportRef.current?.fit(s.skeleton.bounds)
  }, [])

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
        <button type="button" className={xray ? 'is-active' : undefined} onClick={() => setXray((x) => !x)} title="Show the skeleton through translucent stone (REF-021)">
          X-ray
        </button>
        <button type="button" onClick={() => fit(selected ?? structures[structures.length - 1])} disabled={!structures.length}>
          Fit selected
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
              onClick={() => {
                if (m.id !== 'draw') finishDrawing()
                setMode(m.id)
              }}
            >
              {m.label}
            </button>
          ))}
          <select value={curveType} onChange={(e) => setCurveType(e.target.value)} aria-label="New curve type">
            <option value="catmullRom">Spline</option>
            <option value="polyline">Polyline</option>
          </select>
          <select value={grid} onChange={(e) => setGrid(Number(e.target.value))} aria-label="Grid snap">
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
        </div>
        <div className="world-dock-field">
          <CurveEditor
            project={project}
            structures={structures}
            mode={mode}
            grid={grid}
            ui={ui}
            setUi={setUi}
            dispatch={dispatch}
            endGesture={endGesture}
            curveType={curveType}
          />
          <p className="world-dock-hint">
            {mode === 'draw'
              ? ui.drawingCurveId
                ? 'Click to add points · Enter / double-click to finish'
                : 'Click on the ground to start a curve'
              : mode === 'edit'
                ? 'Drag points · click a curve to select · Delete removes point/curve'
                : 'Drag to pan · wheel to zoom'}
          </p>
        </div>
        <Outliner structures={structures} statusOf={statusOf} ui={ui} setUi={setUi} dispatch={dispatch} />
      </section>

      <section className="world-viewport" aria-label="3D world">
        <WorldViewport
          ref={viewportRef}
          structures={structures}
          lithic={lithic}
          stage={stage}
          xray={xray}
          selectedCurveId={ui.selectedCurveId}
          onSelect={(curveId) => setUi((u) => ({ ...u, selectedCurveId: curveId, selectedPoint: null }))}
        />
      </section>

      <ParamPanel
        stage={stage}
        project={project}
        structure={selected}
        lithicState={selected ? lithic[selected.structureId] : null}
        statusOf={statusOf}
        dispatch={dispatch}
        refine={refine}
        regenerate={regenerate}
        onFit={fit}
      />
    </div>
  )
}
