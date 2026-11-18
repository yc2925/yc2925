/**
 * Sandbox A — spatial curve editor (Step 47, feedback round 1).
 *
 * Views: TOP (ortho, +X right, −Z up; points move in X/Z at their height)
 *        FRONT (ortho elevation, +X right, +Y up; points move in X/height)
 *        SIDE  (ortho elevation, +Z right, +Y up; points move in Z/height).
 * Mouse → 3D is always ray ∩ an explicit plane: the ground (top view), the
 * vertical plane z = depth (front view) or x = depth (side view) — never a
 * guessed depth.
 *
 * DRAW mode
 *   - drag on empty space = freehand pen stroke; a lazy-string stabilizer
 *     (radius ∝ strength) smooths jitter; on release the stroke is simplified
 *     (Ramer–Douglas–Peucker, ≤ 24 points) into an editable spline;
 *   - drag from a control point and release on another = new connecting
 *     curve whose ends are LINKED to both points (snap highlight shown);
 *   - stroke ends released on a control point are linked too.
 * EDIT mode
 *   - drag a point to move it (Shift-drag in top view = change height);
 *   - click a curve to select it; double-click a curve to insert a point;
 *   - Delete / Backspace removes the selected point (or curve).
 * PAN mode: left-drag pans. Right-drag pans and wheel zooms in every mode.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useThree } from '@react-three/fiber'
import { Line, MapControls } from '@react-three/drei'
import { evaluateCurve } from '../curves/curve3.js'
import { fitStroke } from '../curves/strokeFit.js'

const SIGNAL = '#ff2020'
const CURVE = '#d8d8d8'
const DIM = '#6a6a6a'

/** Handle rings face the camera in every view. */
const ringRotation = (view) => (view === 'top' ? [-Math.PI / 2, 0, 0] : view === 'side' ? [0, -Math.PI / 2, 0] : [0, 0, 0])

function snap(v, grid) {
  return grid ? Math.round(v / grid) * grid : v
}

/** Screen-space distance in px between two world points for an ortho camera. */
function pxDist(a, b, view, zoom) {
  const dx = a.x - b.x
  if (view === 'side') return Math.hypot(a.z - b.z, a.y - b.y) * zoom
  const dv = view === 'top' ? a.z - b.z : a.y - b.y
  return Math.hypot(dx, dv) * zoom
}

function ViewRig({ view }) {
  const { camera, controls } = useThree()
  useEffect(() => {
    if (view === 'top') {
      camera.position.set(0, 400, 0)
      camera.up.set(0, 0, -1)
      controls?.target.set(0, 0, 0)
    } else if (view === 'side') {
      // Looking along +X: +Z to the right, +Y up.
      camera.position.set(-400, 25, 0)
      camera.up.set(0, 1, 0)
      controls?.target.set(0, 25, 0)
    } else {
      camera.position.set(0, 25, 400)
      camera.up.set(0, 1, 0)
      controls?.target.set(0, 25, 0)
    }
    camera.lookAt(controls?.target ?? new THREE.Vector3())
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld() // picking must use the new view even before the next frame
    controls?.update()
  }, [view, camera, controls])
  return null
}

function Interaction({ project, structures, mode, view, grid, stabilizer, setUi, dispatch, endGesture, curveType, setLive, drawDepth }) {
  const { camera } = useThree()
  const drag = useRef(null)
  const shiftHeld = useRef(false)
  const zoom = () => camera.zoom

  // Track Shift from the keyboard too (some input paths drop modifier flags).
  useEffect(() => {
    const down = (e) => {
      if (e.key === 'Shift') shiftHeld.current = true
    }
    const up = (e) => {
      if (e.key === 'Shift') shiftHeld.current = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', up)
    }
  }, [])

  // All control points (resolved positions) for picking.
  const handles = useMemo(() => {
    const out = []
    for (const s of structures) {
      if (!s.curve.visibility) continue
      s.resolved.forEach((p, index) => out.push({ curveId: s.curveId, index, pointId: s.curve.controlPoints[index].id, p }))
    }
    return out
  }, [structures])

  const pick = (world, exclude = null) => {
    let best = null
    let bestD = 10
    for (const h of handles) {
      if (exclude && h.curveId === exclude.curveId && h.index === exclude.index) continue
      const d = pxDist(h.p, world, view, zoom())
      if (d < bestD) {
        bestD = d
        best = h
      }
    }
    return best
  }

  const planeHit = (e, opts = {}) => {
    const plane =
      view === 'top'
        ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -(opts.height ?? 0))
        : view === 'side'
          ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -(opts.depth ?? drawDepth))
          : new THREE.Plane(new THREE.Vector3(0, 0, 1), -(opts.depth ?? drawDepth))
    const hit = new THREE.Vector3()
    if (!e.ray.intersectPlane(plane, hit)) return null
    return { x: hit.x, y: Math.max(0, hit.y), z: hit.z }
  }

  const snapped = (p) => ({
    x: view === 'side' ? p.x : snap(p.x, grid),
    y: view === 'top' ? p.y : Math.max(0, snap(p.y, grid)),
    z: view === 'front' ? p.z : snap(p.z, grid),
  })

  const onPointerDown = (e) => {
    if (e.button !== 0 || mode === 'navigate') return
    e.stopPropagation()
    const hit = planeHit(e)
    if (!hit) return
    const handle = pick(hit)
    e.target.setPointerCapture?.(e.pointerId)

    if (mode === 'draw') {
      if (handle) {
        drag.current = { kind: 'connect', from: handle }
        setLive({ kind: 'connect', from: handle.p, to: handle.p, target: null })
      } else {
        const p0 = snapped(hit)
        drag.current = { kind: 'stroke', brush: p0, points: [p0], start: null }
        setLive({ kind: 'stroke', points: [p0], brush: p0, cursor: p0 })
      }
      return
    }

    // EDIT
    if (handle) {
      setUi((u) => ({ ...u, selectedCurveId: handle.curveId, selectedPoint: handle.index }))
      const curve = project.curves[handle.curveId]
      if (curve && !curve.locked) {
        drag.current = {
          kind: 'move',
          curveId: handle.curveId,
          index: handle.index,
          origin: { ...handle.p },
          startY: e.clientY,
          shift: (e.shiftKey || e.nativeEvent?.shiftKey || shiftHeld.current) && view === 'top',
          key: `drag-${handle.curveId}-${handle.index}-${e.timeStamp}`,
        }
      }
      return
    }
    // curve body
    for (const s of structures) {
      if (!s.curve.visibility) continue
      const near = s.skeleton.sourcePolyline.some((q) => pxDist(q, hit, view, zoom()) < 7)
      if (near) {
        setUi((u) => ({ ...u, selectedCurveId: s.curveId, selectedPoint: null }))
        return
      }
    }
    setUi((u) => ({ ...u, selectedCurveId: null, selectedPoint: null }))
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) {
      if (mode === 'draw' || mode === 'edit') {
        const hit = planeHit(e)
        const h = hit ? pick(hit) : null
        setUi((u) => (u.hover?.pointId === h?.pointId && u.hover?.curveId === h?.curveId ? u : { ...u, hover: h ? { curveId: h.curveId, pointId: h.pointId } : null }))
      }
      return
    }
    if (d.kind === 'move') {
      let p
      if (d.shift) {
        const dy = (d.startY - e.clientY) / zoom()
        p = { x: d.origin.x, y: Math.max(0, snap(d.origin.y + dy, grid)), z: d.origin.z }
      } else if (view === 'top') {
        const hit = planeHit(e, { height: d.origin.y })
        if (!hit) return
        p = { x: snap(hit.x, grid), y: d.origin.y, z: snap(hit.z, grid) }
      } else if (view === 'side') {
        const hit = planeHit(e, { depth: d.origin.x })
        if (!hit) return
        p = { x: d.origin.x, y: Math.max(0, snap(hit.y, grid)), z: snap(hit.z, grid) }
      } else {
        const hit = planeHit(e, { depth: d.origin.z })
        if (!hit) return
        p = { x: snap(hit.x, grid), y: Math.max(0, snap(hit.y, grid)), z: d.origin.z }
      }
      dispatch({ type: 'movePoint', curveId: d.curveId, index: d.index, point: p }, { coalesce: d.key })
      return
    }
    const hit = planeHit(e)
    if (!hit) return
    if (d.kind === 'connect') {
      const target = pick(hit, d.from)
      setLive({ kind: 'connect', from: d.from.p, to: target ? target.p : hit, target: target?.p ?? null })
      d.target = target
      return
    }
    if (d.kind === 'stroke') {
      // Lazy-string stabilizer: the brush only moves when the cursor pulls the string taut.
      const radiusPx = stabilizer * 70
      const distPx = pxDist(hit, d.brush, view, zoom())
      if (distPx > radiusPx) {
        const k = radiusPx > 0 ? (distPx - radiusPx) / distPx : 1
        d.brush = {
          x: d.brush.x + (hit.x - d.brush.x) * k,
          y: Math.max(0, d.brush.y + (hit.y - d.brush.y) * k),
          z: d.brush.z + (hit.z - d.brush.z) * k,
        }
        const last = d.points[d.points.length - 1]
        if (pxDist(last, d.brush, view, zoom()) > 3) d.points.push(d.brush)
      }
      d.cursor = hit
      setLive({ kind: 'stroke', points: d.points.slice(), brush: d.brush, cursor: hit, radius: radiusPx / zoom() })
    }
  }

  const onPointerUp = (e) => {
    const d = drag.current
    drag.current = null
    e.target.releasePointerCapture?.(e.pointerId)
    setLive(null)
    if (!d) return
    if (d.kind === 'move') {
      endGesture()
      return
    }
    if (d.kind === 'connect') {
      if (d.target) {
        const curveId = `crv_${Math.random().toString(36).slice(2, 9)}`
        dispatch({
          type: 'addCurve',
          curveId,
          curveType: 'catmullRom',
          points: [d.from.p, d.target.p],
          links: { start: { curveId: d.from.curveId, pointId: d.from.pointId }, end: { curveId: d.target.curveId, pointId: d.target.pointId } },
        })
        setUi((u) => ({ ...u, selectedCurveId: curveId, selectedPoint: null }))
      }
      return
    }
    if (d.kind === 'stroke') {
      // The stabilized brush lags the cursor: finish the line at the release point.
      const pts = d.points
      if (d.cursor && pxDist(pts[pts.length - 1], d.cursor, view, zoom()) > 3) pts.push(d.cursor)
      let length = 0
      for (let i = 1; i < pts.length; i += 1) length += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z)
      if (length < 1) return
      const fitted = fitStroke(pts, Math.max(0.25, 2.5 / zoom())).map(snapped)
      // Link stroke ends that were released on existing points.
      const startH = pick(fitted[0])
      const endH = pick(fitted[fitted.length - 1])
      if (startH) fitted[0] = { ...startH.p }
      if (endH) fitted[fitted.length - 1] = { ...endH.p }
      const curveId = `crv_${Math.random().toString(36).slice(2, 9)}`
      dispatch({
        type: 'addCurve',
        curveId,
        curveType,
        points: fitted,
        links: {
          start: startH ? { curveId: startH.curveId, pointId: startH.pointId } : null,
          end: endH ? { curveId: endH.curveId, pointId: endH.pointId } : null,
        },
      })
      setUi((u) => ({ ...u, selectedCurveId: curveId, selectedPoint: null }))
    }
  }

  const onDoubleClick = (e) => {
    if (mode !== 'edit') return
    const hit = planeHit(e)
    if (!hit) return
    // Insert a control point on the nearest visible curve.
    let best = null
    for (const s of structures) {
      if (!s.curve.visibility || s.curve.locked || s.resolved.length < 2) continue
      const dense = evaluateCurve({ ...s.curve, controlPoints: s.resolved }, 16).points
      dense.forEach((q, i) => {
        const dpx = pxDist(q, hit, view, zoom())
        if (dpx < 8 && (!best || dpx < best.d)) best = { s, i, q, d: dpx }
      })
    }
    if (!best) return
    const segs = best.s.curve.curveType === 'polyline' ? null : 16
    let index
    if (segs) index = Math.min(best.s.resolved.length - 1, Math.floor(best.i / segs) + 1)
    else {
      // polyline: nearest segment
      let bi = 1
      let bd = Infinity
      for (let i = 1; i < best.s.resolved.length; i += 1) {
        const a = best.s.resolved[i - 1]
        const b = best.s.resolved[i]
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }
        const dd = pxDist(mid, best.q, view, zoom())
        if (dd < bd) {
          bd = dd
          bi = i
        }
      }
      index = bi
    }
    dispatch({ type: 'insertPoint', curveId: best.s.curveId, index, point: best.q })
    setUi((u) => ({ ...u, selectedCurveId: best.s.curveId, selectedPoint: index }))
  }

  const rotation = view === 'top' ? [-Math.PI / 2, 0, 0] : view === 'side' ? [0, Math.PI / 2, 0] : [0, 0, 0]
  const position = view === 'top' ? [0, 0, 0] : view === 'side' ? [drawDepth, 0, 0] : [0, 0, drawDepth]
  return (
    <mesh rotation={rotation} position={position} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick}>
      <planeGeometry args={[8000, 8000]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function FieldGuides({ size, view }) {
  const half = size / 2
  const lines = useMemo(() => {
    const out = []
    const step = 10
    if (view === 'top') {
      for (let v = -half; v <= half + 1e-6; v += step) {
        const major = Math.abs(v) < 1e-6
        out.push({ key: `x${v}`, pts: [[v, 0, -half], [v, 0, half]], major })
        out.push({ key: `z${v}`, pts: [[-half, 0, v], [half, 0, v]], major })
      }
    } else if (view === 'side') {
      for (let v = -half; v <= half + 1e-6; v += step) out.push({ key: `z${v}`, pts: [[0, 0, v], [0, 80, v]], major: Math.abs(v) < 1e-6 })
      for (let h = 0; h <= 80; h += 5) out.push({ key: `h${h}`, pts: [[0, h, -half], [0, h, half]], major: h === 0 })
    } else {
      for (let v = -half; v <= half + 1e-6; v += step) out.push({ key: `x${v}`, pts: [[v, 0, 0], [v, 80, 0]], major: Math.abs(v) < 1e-6 })
      for (let h = 0; h <= 80; h += 5) out.push({ key: `h${h}`, pts: [[-half, h, 0], [half, h, 0]], major: h === 0 })
    }
    return out
  }, [half, view])
  return (
    <group position-y={view === 'top' ? -0.01 : 0} position-z={view === 'front' ? -300 : 0} position-x={view === 'side' ? 300 : 0}>
      {lines.map((l) => (
        <Line key={l.key} points={l.pts} color={l.major ? '#6a6a6a' : '#2a2a2a'} lineWidth={l.major ? 1.5 : 1} />
      ))}
      {view === 'top' ? <Line points={[[-half, 0, -half], [half, 0, -half], [half, 0, half], [-half, 0, half], [-half, 0, -half]]} color="#6a6a6a" lineWidth={1} /> : null}
    </group>
  )
}

function CurveGraphics({ structure, selected, selectedPoint, hover, view }) {
  const { curve, skeleton, resolved } = structure
  const poly = skeleton.sourcePolyline.length >= 2 ? skeleton.sourcePolyline : resolved
  const color = selected ? SIGNAL : CURVE
  // In top view lift graphics by height so higher points draw on top; colour encodes height.
  const proj = (p) => (view === 'top' ? [p.x, 0.04 + p.y * 0.001, p.z] : view === 'side' ? [0, p.y, p.z] : [p.x, p.y, 0])
  const cpGeom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(resolved.flatMap((p) => proj(p)), 3))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, view])
  const branchGeom = useMemo(() => {
    const pos = []
    for (const m of skeleton.members) {
      if (m.kind === 'main') continue // grammar members (tracery, shafts, springers…)
      for (let i = 1; i < m.points.length; i += 1) pos.push(...proj(m.points[i - 1]), ...proj(m.points[i]))
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skeleton, view])
  if (!curve.visibility) return null
  const linkedIdx = [curve.links?.start ? 0 : -1, curve.links?.end ? resolved.length - 1 : -1]
  return (
    <group>
      <lineSegments geometry={branchGeom}>
        <lineBasicMaterial color={DIM} transparent opacity={0.6} />
      </lineSegments>
      {poly.length >= 2 ? <Line points={poly.map(proj)} color={color} lineWidth={selected ? 2.2 : 1.4} /> : null}
      <points geometry={cpGeom}>
        <pointsMaterial color={color} size={selected ? 8 : 6} sizeAttenuation={false} />
      </points>
      {resolved.map((p, i) => {
        const isSel = selected && selectedPoint === i
        const isHover = hover && hover.curveId === curve.curveId && hover.pointId === curve.controlPoints[i].id
        const linked = linkedIdx.includes(i)
        if (!isSel && !isHover && !linked) return null
        return (
          <mesh key={i} position={proj(p)} rotation={ringRotation(view)}>
            <ringGeometry args={[isHover ? 1.5 : 1.0, isHover ? 2.1 : 1.4, 24]} />
            <meshBasicMaterial color={isSel || isHover ? SIGNAL : '#bbbbbb'} side={THREE.DoubleSide} />
          </mesh>
        )
      })}
    </group>
  )
}

function LiveOverlay({ live, view }) {
  if (!live) return null
  const proj = (p) => (view === 'top' ? [p.x, 0.2, p.z] : view === 'side' ? [-1, p.y, p.z] : [p.x, p.y, 1])
  if (live.kind === 'connect') {
    return (
      <group>
        <Line points={[proj(live.from), proj(live.to)]} color={SIGNAL} lineWidth={1.5} dashed dashSize={1} gapSize={0.6} />
        {live.target ? (
          <mesh position={proj(live.target)} rotation={ringRotation(view)}>
            <ringGeometry args={[1.6, 2.4, 24]} />
            <meshBasicMaterial color={SIGNAL} side={THREE.DoubleSide} />
          </mesh>
        ) : null}
      </group>
    )
  }
  return (
    <group>
      {live.points.length >= 2 ? <Line points={live.points.map(proj)} color={SIGNAL} lineWidth={1.6} /> : null}
      {live.radius > 0.01 && live.cursor ? (
        <>
          <Line points={[proj(live.brush), proj(live.cursor)]} color="#8a8a8a" lineWidth={1} />
          <mesh position={proj(live.brush)} rotation={ringRotation(view)}>
            <ringGeometry args={[Math.max(0.01, live.radius - 0.15), live.radius, 40]} />
            <meshBasicMaterial color="#5a5a5a" side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>
        </>
      ) : null}
    </group>
  )
}

export default function CurveEditor(props) {
  const { project, structures, mode, view, ui } = props
  const [live, setLive] = useState(null)
  const size = project.world.fieldSize
  const selected = structures.find((s) => s.curveId === ui.selectedCurveId)
  // Drawing plane depth: through the selected curve's first point (z in front view, x in side view).
  const drawDepth = selected?.resolved?.length ? (view === 'front' ? selected.resolved[0].z : view === 'side' ? selected.resolved[0].x : 0) : 0
  const mouseButtons = useMemo(
    () => ({ LEFT: mode === 'navigate' ? THREE.MOUSE.PAN : null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }),
    [mode],
  )
  return (
    <Canvas
      className={`world-editor-canvas is-${mode}`}
      orthographic
      camera={{ position: [0, 400, 0], up: [0, 0, -1], zoom: 1.3, near: 0.1, far: 4000 }}
      onContextMenu={(e) => e.preventDefault()}
      gl={{ antialias: true }}
    >
      <color attach="background" args={['#0a0a0a']} />
      <MapControls makeDefault enableRotate={false} screenSpacePanning={view !== 'top'} mouseButtons={mouseButtons} minZoom={0.3} maxZoom={40} />
      <ViewRig view={view} />
      <FieldGuides size={size} view={view} />
      {structures.map((s) => (
        <CurveGraphics key={s.structureId} structure={s} selected={s.curveId === ui.selectedCurveId} selectedPoint={ui.selectedPoint} hover={ui.hover} view={view} />
      ))}
      <LiveOverlay live={live} view={view} />
      <Interaction {...props} setLive={setLive} drawDepth={drawDepth} />
    </Canvas>
  )
}
