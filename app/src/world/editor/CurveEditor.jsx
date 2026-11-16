/**
 * Sandbox A — spatial curve editor (Step 47, Phase A3, slice scope).
 *
 * Top orthographic view of the shared world coordinate system (metres,
 * +X right, −Z up on screen). Mouse positions are mapped to 3D only by
 * ray ∩ the active construction plane (ground, y = elevation) — never by
 * guessing depth. Own camera; never touches the world viewport camera.
 *
 * Modes: Navigate (left-drag pans) · Draw (click adds points; Enter /
 * double-click finishes) · Edit (drag control points, click selects curve).
 * Right-drag pans and wheel zooms in every mode.
 */

import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, MapControls } from '@react-three/drei'
import { evaluateCurve } from '../curves/curve3.js'

const SIGNAL = '#ff2020'
const CURVE = '#d8d8d8'
const DIM = '#6a6a6a'

function snap(p, grid) {
  if (!grid) return p
  return { x: Math.round(p.x / grid) * grid, y: p.y, z: Math.round(p.z / grid) * grid }
}

function distXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function nearestOnPolyline(points, p) {
  let best = Infinity
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    const abx = b.x - a.x
    const abz = b.z - a.z
    const l2 = abx * abx + abz * abz || 1
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.z - a.z) * abz) / l2))
    best = Math.min(best, Math.hypot(a.x + abx * t - p.x, a.z + abz * t - p.z))
  }
  return best
}

function Interaction({ project, structures, mode, grid, ui, setUi, dispatch, endGesture, curveType }) {
  const { camera } = useThree()
  const drag = useRef(null)
  const pxToWorld = (px) => px / camera.zoom
  const elevation = 0

  const toGround = (e) => snap({ x: e.point.x, y: elevation, z: e.point.z }, grid)

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    const p = toGround(e)
    if (mode === 'draw') {
      e.stopPropagation()
      if (ui.drawingCurveId && project.curves[ui.drawingCurveId]) {
        const curve = project.curves[ui.drawingCurveId]
        const last = curve.controlPoints[curve.controlPoints.length - 1]
        if (last && distXZ(last, p) < pxToWorld(4)) return // double-click lands on the same spot
        dispatch({ type: 'appendPoint', curveId: ui.drawingCurveId, point: p })
      } else {
        const curveId = `crv_${Math.random().toString(36).slice(2, 9)}`
        dispatch({ type: 'addCurve', curveId, curveType, points: [p] })
        setUi((u) => ({ ...u, drawingCurveId: curveId, selectedCurveId: curveId, selectedPoint: null }))
      }
      return
    }
    if (mode !== 'edit') return
    e.stopPropagation()
    const pickR = pxToWorld(9)
    // 1. control point of any visible, unlocked curve (selected curve first)
    const ids = [ui.selectedCurveId, ...project.order.filter((id) => id !== ui.selectedCurveId)].filter(Boolean)
    for (const id of ids) {
      const c = project.curves[id]
      if (!c || !c.visibility) continue
      const idx = c.controlPoints.findIndex((q) => distXZ(q, e.point) < pickR)
      if (idx >= 0) {
        setUi((u) => ({ ...u, selectedCurveId: id, selectedPoint: idx }))
        if (!c.locked) {
          drag.current = { curveId: id, index: idx, key: `drag-${id}-${idx}-${e.timeStamp}` }
          e.target.setPointerCapture?.(e.pointerId)
        }
        return
      }
    }
    // 2. curve body
    for (const s of structures) {
      if (!s.curve.visibility) continue
      if (nearestOnPolyline(s.skeleton.sourcePolyline, e.point) < pxToWorld(7)) {
        setUi((u) => ({ ...u, selectedCurveId: s.curveId, selectedPoint: null }))
        return
      }
    }
    setUi((u) => ({ ...u, selectedCurveId: null, selectedPoint: null }))
  }

  const onPointerMove = (e) => {
    if (!drag.current) return
    const p = toGround(e)
    dispatch({ type: 'movePoint', curveId: drag.current.curveId, index: drag.current.index, point: p }, { coalesce: drag.current.key })
  }

  const onPointerUp = (e) => {
    if (drag.current) {
      e.target.releasePointerCapture?.(e.pointerId)
      drag.current = null
      endGesture()
    }
  }

  const onDoubleClick = () => {
    if (mode === 'draw' && ui.drawingCurveId) setUi((u) => ({ ...u, drawingCurveId: null }))
  }

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position-y={elevation}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <planeGeometry args={[6000, 6000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

function FieldGuides({ size }) {
  const half = size / 2
  const lines = useMemo(() => {
    const out = []
    const step = 10
    for (let v = -half; v <= half + 1e-6; v += step) {
      const major = Math.abs(v) < 1e-6
      out.push({ key: `x${v}`, pts: [[v, 0, -half], [v, 0, half]], major })
      out.push({ key: `z${v}`, pts: [[-half, 0, v], [half, 0, v]], major })
    }
    return out
  }, [half])
  return (
    <group position-y={-0.01}>
      {lines.map((l) => (
        <Line key={l.key} points={l.pts} color={l.major ? '#5a5a5a' : '#262626'} lineWidth={1} />
      ))}
      <Line
        points={[[-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], [-half, 0, -half]]}
        color="#6a6a6a"
        lineWidth={1}
      />
    </group>
  )
}

function CurveGraphics({ structure, selected, selectedPoint, showFootprint }) {
  const { curve, skeleton } = structure
  const poly = skeleton.sourcePolyline.length >= 2 ? skeleton.sourcePolyline : evaluateCurve(curve).points
  const color = selected ? SIGNAL : CURVE
  const footprint = useMemo(() => {
    if (!showFootprint) return []
    return skeleton.members
      .filter((m) => m.kind === 'pier' || m.kind === 'buttressPier')
      .map((m) => m.points[0])
  }, [skeleton, showFootprint])
  const cps = curve.controlPoints
  const cpGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(cps.flatMap((p) => [p.x, 0.05, p.z]), 3))
    return g
  }, [cps])
  const fpGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(footprint.flatMap((p) => [p.x, 0.02, p.z]), 3))
    return g
  }, [footprint])
  if (!curve.visibility) return null
  return (
    <group>
      {footprint.length ? (
        <points geometry={fpGeom}>
          <pointsMaterial color={DIM} size={3} sizeAttenuation={false} />
        </points>
      ) : null}
      {poly.length >= 2 ? <Line points={poly.map((p) => [p.x, 0.04, p.z])} color={color} lineWidth={selected ? 2 : 1.25} /> : null}
      {cps.length >= 2 && curve.curveType !== 'polyline' && selected ? (
        <Line points={cps.map((p) => [p.x, 0.03, p.z])} color={DIM} lineWidth={1} dashed dashSize={1} gapSize={1} />
      ) : null}
      <points geometry={cpGeom}>
        <pointsMaterial color={color} size={selected ? 8 : 6} sizeAttenuation={false} />
      </points>
      {selected && selectedPoint != null && cps[selectedPoint] ? (
        <mesh position={[cps[selectedPoint].x, 0.06, cps[selectedPoint].z]}>
          <ringGeometry args={[0.9, 1.3, 24]} />
          <meshBasicMaterial color={SIGNAL} side={THREE.DoubleSide} />
        </mesh>
      ) : null}
    </group>
  )
}

export default function CurveEditor({
  project,
  structures,
  mode,
  grid,
  ui,
  setUi,
  dispatch,
  endGesture,
  curveType,
}) {
  const size = project.world.fieldSize
  const mouseButtons = useMemo(
    () => ({
      LEFT: mode === 'navigate' ? THREE.MOUSE.PAN : null,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    }),
    [mode],
  )
  return (
    <Canvas
      className={`world-editor-canvas is-${mode}`}
      orthographic
      camera={{ position: [0, 400, 0], up: [0, 0, -1], zoom: 1.3, near: 0.1, far: 2000 }}
      onContextMenu={(e) => e.preventDefault()}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <MapControls makeDefault enableRotate={false} screenSpacePanning={false} mouseButtons={mouseButtons} minZoom={0.3} maxZoom={40} />
      <FieldGuides size={size} />
      {structures.map((s) => (
        <CurveGraphics
          key={s.structureId}
          structure={s}
          selected={s.curveId === ui.selectedCurveId}
          selectedPoint={ui.selectedPoint}
          showFootprint
        />
      ))}
      <Interaction
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
    </Canvas>
  )
}
