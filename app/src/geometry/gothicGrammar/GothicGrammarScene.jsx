/**
 * Independent construction scene for Gothic Grammar.
 * Renders kernel / arch / solid-void construction results (visualization only).
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { Html, Line } from '@react-three/drei'
import { DEFAULT_GRID } from './construction/index.js'

const COLORS = {
  construction: '#3d3d3d',
  guide: '#4a4a4a',
  dimension: '#8a7340',
  result: '#f2ebe0',
  resultGlow: '#c4b8a4',
  point: '#c8a84a',
  center: '#a31318',
  intersection: '#6ecf8e',
  invalid: '#a31318',
  stone: '#c8c2b8',
  stoneEdge: '#e8e2d6',
  void: '#0a0a0a',
}

function AxesHelper({ length = 1.2 }) {
  const geo = useMemo(() => {
    const positions = new Float32Array([
      0, 0, 0, length, 0, 0, 0, 0, 0, 0, length, 0, 0, 0, 0, 0, 0, length * 0.35,
    ])
    const colors = new Float32Array([
      0.75, 0.22, 0.2, 0.75, 0.22, 0.2, 0.35, 0.7, 0.4, 0.35, 0.7, 0.4, 0.35, 0.5, 0.85, 0.35, 0.5,
      0.85,
    ])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [length])
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial vertexColors depthTest={false} />
    </lineSegments>
  )
}

function toLinePoints(samples, z = 0.01, closed = false) {
  if (!samples?.length) return null
  const pts = closed && samples.length > 2 ? [...samples, samples[0]] : samples
  return pts.map((p) => [p.x, p.y, z])
}

function CurveLines({ curves, showConstruction, showResult, showDimensions, sectionMode }) {
  const items = useMemo(() => {
    const out = []
    for (const c of curves ?? []) {
      const role = c.role ?? 'result'
      if (role === 'region-fill') continue
      if (role === 'construction' && !showConstruction) continue
      if (role === 'guide' && !showConstruction) continue
      if (role === 'result' && !showResult) continue
      if (role === 'dimension' && !showDimensions) continue

      const z = role === 'result' ? 0.03 : role === 'dimension' ? 0.025 : 0.012
      const points = toLinePoints(c.samples, z, c.closed === true)
      if (!points || points.length < 2) continue

      let color = COLORS.construction
      let lineWidth = 1
      let opacity = 0.45
      if (role === 'result') {
        color = sectionMode ? COLORS.stoneEdge : COLORS.result
        lineWidth = sectionMode ? 2 : 3
        opacity = 1
      } else if (role === 'dimension') {
        color = COLORS.dimension
        lineWidth = 1.25
        opacity = 0.85
      } else if (role === 'guide') {
        color = COLORS.guide
        lineWidth = 1
        opacity = 0.55
      }

      const dashed = role === 'construction' || role === 'guide'
      out.push({ id: c.id, points, color, lineWidth, opacity, role, dashed })
    }
    return out
  }, [curves, showConstruction, showResult, showDimensions, sectionMode])

  // Construction overlays are visual-only — never enter raycast / attachment layers.
  return (
    <group raycast={() => null}>
      {items.map((it) => (
        <group key={it.id} raycast={() => null}>
          {it.role === 'result' && !sectionMode ? (
            <Line
              points={it.points}
              color={COLORS.resultGlow}
              lineWidth={it.lineWidth + 1.5}
              transparent
              opacity={0.22}
              depthTest={false}
              raycast={() => null}
            />
          ) : null}
          <Line
            points={it.points}
            color={it.color}
            lineWidth={it.lineWidth}
            transparent
            opacity={it.opacity}
            depthTest={false}
            dashed={it.dashed}
            dashSize={it.dashed ? 0.08 : undefined}
            gapSize={it.dashed ? 0.06 : undefined}
            raycast={() => null}
          />
        </group>
      ))}
    </group>
  )
}

/** SECTION fill: light stone with dark holes from validated region samples. */
function SectionRegions({ curves }) {
  const meshes = useMemo(() => {
    const fills = (curves ?? []).filter((c) => c.role === 'region-fill')
    return fills
      .map((fill) => {
        const outer = fill.outerSamples ?? []
        if (outer.length < 3) return null
        const shape = new THREE.Shape()
        shape.moveTo(outer[0].x, outer[0].y)
        for (let i = 1; i < outer.length; i += 1) shape.lineTo(outer[i].x, outer[i].y)
        shape.closePath()
        for (const hole of fill.holeSamples ?? []) {
          if (!hole?.length) continue
          const path = new THREE.Path()
          path.moveTo(hole[0].x, hole[0].y)
          for (let i = 1; i < hole.length; i += 1) path.lineTo(hole[i].x, hole[i].y)
          path.closePath()
          shape.holes.push(path)
        }
        const geo = new THREE.ShapeGeometry(shape)
        return { id: fill.id, geometry: geo }
      })
      .filter(Boolean)
  }, [curves])

  return (
    <group name="SectionRegions">
      {meshes.map((m) => (
        <mesh key={m.id} geometry={m.geometry} position={[0, 0, 0.005]}>
          <meshBasicMaterial color={COLORS.stone} side={THREE.DoubleSide} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

function PointMarks({ primitives, showPoints, showCenters, showLabels }) {
  const marks = useMemo(() => {
    const list = []
    for (const pr of primitives ?? []) {
      if (pr.type !== 'point') continue
      if (pr.role === 'center' && !showCenters) continue
      if (pr.role !== 'center' && !showPoints) continue
      list.push(pr)
    }
    return list
  }, [primitives, showPoints, showCenters])

  return (
    <group raycast={() => null}>
      {marks.map((m) => {
        const color = m.role === 'center' ? COLORS.center : COLORS.point
        const r = m.role === 'center' ? 0.04 : 0.032
        return (
          <group key={m.id} position={[m.x, m.y, 0.05]} raycast={() => null}>
            <mesh raycast={() => null}>
              <circleGeometry args={[r, 12]} />
              <meshBasicMaterial color={color} depthTest={false} />
            </mesh>
            {showLabels && m.label ? (
              <Html sprite center style={{ pointerEvents: 'none' }}>
                <span className="grammar-point-label">{m.label}</span>
              </Html>
            ) : null}
          </group>
        )
      })}
    </group>
  )
}

function AnnotationLabels({ annotations, showDimensions, showFamilyLabels }) {
  const items = useMemo(() => {
    const list = []
    for (const a of annotations ?? []) {
      if (a.kind === 'dimension' && !showDimensions) continue
      if ((a.kind === 'family-label' || a.kind === 'family-ratio') && !showFamilyLabels) continue
      list.push(a)
    }
    return list
  }, [annotations, showDimensions, showFamilyLabels])

  return (
    <group>
      {items.map((a) => (
        <Html
          key={a.id}
          position={[a.x, a.y, 0.06]}
          center={a.align !== 'left'}
          style={{ pointerEvents: 'none' }}
          zIndexRange={[40, 0]}
        >
          <span
            className={
              a.kind === 'family-label'
                ? 'grammar-family-label'
                : a.kind === 'family-ratio'
                  ? 'grammar-family-ratio'
                  : 'grammar-dim-label'
            }
          >
            {a.text}
          </span>
        </Html>
      ))}
    </group>
  )
}

export default function GothicGrammarScene({
  showGrid = true,
  showAxes = false,
  showOrigin = false,
  showPoints = false,
  showConstruction = false,
  showCenters = false,
  showLabels = false,
  showDimensions = true,
  showFamilyLabels = true,
  showResult = true,
  sectionMode = false,
  construction = null,
}) {
  const invalid = construction && construction.validation && construction.validation.ok === false
  const errors = construction?.validation?.errors ?? []
  const annotations = construction?.metadata?.annotations ?? []
  const warnings = construction?.validation?.warnings ?? []

  return (
    <group name="GothicGrammarScene">
      {showGrid && !sectionMode ? (
        <gridHelper
          args={[
            DEFAULT_GRID.size,
            DEFAULT_GRID.divisions,
            DEFAULT_GRID.centerColor,
            DEFAULT_GRID.gridColor,
          ]}
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0, -0.02]}
        />
      ) : null}
      {showAxes ? <AxesHelper /> : null}
      {showOrigin ? (
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.035, 16]} />
          <meshBasicMaterial color="#c8a84a" transparent opacity={0.7} depthTest={false} />
        </mesh>
      ) : null}

      {construction ? (
        <>
          {sectionMode ? <SectionRegions curves={construction.curves} /> : null}
          <CurveLines
            curves={construction.curves}
            showConstruction={showConstruction}
            showResult={showResult}
            showDimensions={showDimensions}
            sectionMode={sectionMode}
          />
          {!sectionMode ? (
            <PointMarks
              primitives={construction.primitives}
              showPoints={showPoints}
              showCenters={showCenters}
              showLabels={showLabels}
            />
          ) : null}
          {!sectionMode ? (
            <AnnotationLabels
              annotations={annotations}
              showDimensions={showDimensions}
              showFamilyLabels={showFamilyLabels}
            />
          ) : null}
        </>
      ) : null}

      {!invalid && warnings.length ? (
        <Html position={[0, -0.55, 0.08]} center style={{ pointerEvents: 'none' }}>
          <div className="grammar-warning-banner">{warnings[0]}</div>
        </Html>
      ) : null}

      {invalid ? (
        <Html position={[0, -0.4, 0.08]} center style={{ pointerEvents: 'none' }}>
          <div className="grammar-invalid-banner">
            Invalid geometry
            {errors[0] ? `: ${errors[0]}` : ''}
          </div>
        </Html>
      ) : null}
    </group>
  )
}
