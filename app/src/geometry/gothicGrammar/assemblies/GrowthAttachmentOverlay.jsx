/**
 * Debug visualization for growth anchors, frames, navigation graph, paths (13E.4).
 * 13E.4.1 — compact inspector + raycast placement (no per-patch picker flood).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ANCHOR_STATUS } from './growthAttachment/types.js'
import { findNearestPatch } from './growthAttachment/anchors.js'

const STATUS_COLORS = {
  [ANCHOR_STATUS.VALID]: '#4caf70',
  [ANCHOR_STATUS.REPROJECTED]: '#e0a040',
  [ANCHOR_STATUS.BLOCKED]: '#c04040',
  [ANCHOR_STATUS.ORPHANED]: '#9a40c0',
}

function FrameLines({ normal, tangentU, tangentV, showNormal, showTangent, length = 0.14 }) {
  const geo = useMemo(() => {
    const positions = []
    if (showNormal && normal) {
      positions.push(0, 0, 0, normal[0] * length, normal[1] * length, normal[2] * length)
    }
    if (showTangent && tangentU) {
      positions.push(0, 0, 0, tangentU[0] * length, tangentU[1] * length, tangentU[2] * length)
    }
    if (showTangent && tangentV) {
      const s = length * 0.7
      positions.push(0, 0, 0, tangentV[0] * s, tangentV[1] * s, tangentV[2] * s)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [normal, tangentU, tangentV, showNormal, showTangent, length])

  useEffect(() => () => geo.dispose(), [geo])
  if (!showNormal && !showTangent) return null

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial
        color={showNormal && !showTangent ? '#66ccff' : '#ffcc66'}
        depthWrite={false}
      />
    </lineSegments>
  )
}

function shortId(id, keep = 18) {
  if (!id) return '—'
  const s = String(id)
  if (s.length <= keep) return s
  return `${s.slice(0, 8)}…${s.slice(-6)}`
}

function CompactSeedInspector({ anchor }) {
  const [debugOpen, setDebugOpen] = useState(false)
  if (!anchor) return null
  const zones = anchor.growthZoneIds?.length ?? 0
  return (
    <Html distanceFactor={10} style={{ pointerEvents: 'none' }} zIndexRange={[100, 0]}>
      <div
        className="gg-seed-inspector"
        style={{
          width: 220,
          maxWidth: 220,
          maxHeight: 200,
          overflow: 'auto',
          background: 'rgba(12, 14, 16, 0.92)',
          color: '#e8e8e8',
          padding: '6px 8px',
          fontSize: 11,
          lineHeight: 1.35,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          borderRadius: 4,
          border: '1px solid rgba(255,255,255,0.18)',
          transform: 'translate(10px, -10px)',
          whiteSpace: 'normal',
          wordBreak: 'break-word',
          boxSizing: 'border-box',
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          Seed {shortId(anchor.anchorId, 16)}
        </div>
        <div>
          Status <strong style={{ color: STATUS_COLORS[anchor.status] }}>{anchor.status}</strong>
        </div>
        <div>Eligibility {anchor.eligibility ?? '—'}</div>
        <div>
          Component{' '}
          {shortId(anchor.metadata?.componentType ?? anchor.componentType ?? anchor.componentId)}
        </div>
        <div>
          Surface {shortId(anchor.metadata?.surfaceType ?? anchor.surfaceType ?? anchor.surfaceId)}
        </div>
        <div>Growth zones {zones}</div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDebugOpen((v) => !v)
          }}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            marginTop: 4,
            fontSize: 10,
            padding: '2px 6px',
            background: 'rgba(255,255,255,0.08)',
            color: '#ccc',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 3,
            cursor: 'pointer',
            pointerEvents: 'auto',
          }}
        >
          {debugOpen ? 'Hide debug' : 'Debug…'}
        </button>
        {debugOpen ? (
          <div
            style={{
              marginTop: 4,
              maxHeight: 90,
              overflow: 'auto',
              fontSize: 9,
              color: '#aaa',
              whiteSpace: 'pre-wrap',
            }}
          >
            {`anchorId ${anchor.anchorId}
componentId ${anchor.componentId}
surfaceId ${anchor.surfaceId}
patchId ${anchor.patchId}
world ${anchor.worldPosition?.map?.((n) => Number(n).toFixed(3)).join(', ')}
clr ${anchor.clearance != null ? Number(anchor.clearance).toFixed(3) : '—'}`}
          </div>
        ) : null}
      </div>
    </Html>
  )
}

function AnchorMarker({
  anchor,
  selected,
  showNormal,
  showTangent,
  onSelect,
  showInvalid,
}) {
  if (!anchor) return null
  if (
    !showInvalid &&
    (anchor.status === ANCHOR_STATUS.ORPHANED || anchor.status === ANCHOR_STATUS.BLOCKED)
  ) {
    return null
  }
  const color = STATUS_COLORS[anchor.status] ?? '#888'
  const p = anchor.worldPosition
  const r = selected ? 0.07 : 0.05

  return (
    <group position={p}>
      <mesh
        onClick={(e) => {
          e.stopPropagation()
          onSelect?.(anchor)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <sphereGeometry args={[r, 10, 10]} />
        <meshBasicMaterial color={color} depthTest />
      </mesh>
      <FrameLines
        normal={anchor.worldNormal}
        tangentU={anchor.tangentU}
        tangentV={anchor.tangentV}
        showNormal={showNormal}
        showTangent={showTangent}
      />
      {selected ? <CompactSeedInspector anchor={anchor} /> : null}
    </group>
  )
}

function NavGraphLines({ graph }) {
  const geo = useMemo(() => {
    const positions = []
    const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]))
    for (const e of graph?.edges ?? []) {
      const a = byId.get(e.sourceId)
      const b = byId.get(e.targetId)
      if (!a || !b) continue
      positions.push(...a.position, ...b.position)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [graph])

  useEffect(() => () => geo.dispose(), [geo])
  if (!(graph?.edges?.length > 0)) return null
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#5a8fff" transparent opacity={0.35} depthWrite={false} />
    </lineSegments>
  )
}

function PathLine({ path }) {
  const geo = useMemo(() => {
    const pts = path?.waypoints ?? path?.points ?? []
    const positions = []
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [path])

  useEffect(() => () => geo.dispose(), [geo])
  if (!(path?.waypoints?.length > 1 || path?.points?.length > 1)) return null
  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#ff66aa" depthWrite={false} />
    </lineSegments>
  )
}

function EligibilityMarkers({ semantics, showEligible, showBlocked }) {
  const markers = useMemo(() => {
    const out = []
    for (const p of semantics?.patches ?? []) {
      const elig = p.growthEligibility
      if (elig === 'ELIGIBLE' && showEligible) {
        out.push({ id: p.patchId, pos: p.worldTransform?.position, color: '#4caf70' })
      } else if (
        (elig === 'PROHIBITED' || elig === 'RESTRICTED') &&
        showBlocked
      ) {
        out.push({
          id: p.patchId,
          pos: p.worldTransform?.position,
          color: elig === 'PROHIBITED' ? '#c04040' : '#e0a040',
        })
      }
    }
    // Cap markers — full patch flood freezes the main thread.
    return out.slice(0, 120)
  }, [semantics, showEligible, showBlocked])

  return (
    <group name="growth-eligibility-markers">
      {markers.map((m) =>
        m.pos ? (
          <mesh key={m.id} position={m.pos}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial
              color={m.color}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        ) : null,
      )}
    </group>
  )
}

/**
 * One click → one seed. Drag orbits (OrbitControls). No per-patch mesh flood.
 */
function PlacementController({ semantics, active, allowRestricted, onPlace }) {
  const { camera, gl, scene } = useThree()
  const pointerRef = useRef(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndc = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => {
    if (!active) return undefined
    const el = gl.domElement
    const DRAG_PX = 6

    const onDown = (e) => {
      if (e.button !== 0) return
      pointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    }

    const onUp = (e) => {
      const down = pointerRef.current
      pointerRef.current = null
      if (!down || e.button !== 0) return
      const dx = e.clientX - down.x
      const dy = e.clientY - down.y
      if (dx * dx + dy * dy > DRAG_PX * DRAG_PX) return // orbit drag

      const rect = el.getBoundingClientRect()
      ndc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      ndc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(scene.children, true)
      const hit = hits.find((h) => {
        // Skip seed markers / helpers
        let o = h.object
        while (o) {
          if (o.name === 'growth-attachment-overlay') return false
          o = o.parent
        }
        return true
      })
      if (!hit) return

      const worldPoint = [hit.point.x, hit.point.y, hit.point.z]
      const worldNormal = hit.face?.normal
        ? (() => {
            const n = hit.face.normal.clone()
            n.transformDirection(hit.object.matrixWorld)
            return [n.x, n.y, n.z]
          })()
        : [0, 0, 1]

      const nearest = findNearestPatch(semantics, worldPoint, { allowRestricted })
      if (!nearest?.patch || nearest.distance > 1.25) {
        window.__ggGrowthPlacementError = nearest?.reason ?? 'no eligible patch near hit'
        return
      }
      onPlace?.(nearest.patch, worldPoint, worldNormal)
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointerup', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      pointerRef.current = null
    }
  }, [active, allowRestricted, camera, gl, scene, semantics, onPlace, raycaster, ndc])

  return null
}

export default function GrowthAttachmentOverlay({
  semantics = null,
  state = null,
  settings = {},
  selectedAnchorId = null,
  onSelectAnchor = null,
  onPlaceOnPatch = null,
  pathPreview = null,
}) {
  const showSeeds = settings.showGrowthSeeds !== false
  const showNormals = settings.showGrowthNormals === true
  const showTangents = settings.showGrowthTangents === true
  const showGraph = settings.showGrowthNavGraph === true
  const showPaths = settings.showGrowthNavPaths === true
  const showInvalid = settings.showInvalidGrowthAnchors !== false
  const placeActive = settings.growthPlaceSeedActive === true
  const showEligible = settings.showGrowthCollisionDiagnostics === true
  const showBlocked = settings.showGrowthCollisionDiagnostics === true

  return (
    <group name="growth-attachment-overlay">
      <PlacementController
        semantics={semantics}
        active={placeActive}
        allowRestricted={settings.growthAllowRestricted === true}
        onPlace={onPlaceOnPatch}
      />
      {showEligible || showBlocked ? (
        <EligibilityMarkers
          semantics={semantics}
          showEligible={showEligible}
          showBlocked={showBlocked}
        />
      ) : null}
      {showGraph && state?.navigationGraph ? (
        <NavGraphLines graph={state.navigationGraph} />
      ) : null}
      {showPaths && pathPreview ? <PathLine path={pathPreview} /> : null}
      {showSeeds
        ? (state?.anchors ?? []).map((a) => (
            <AnchorMarker
              key={a.anchorId}
              anchor={a}
              selected={a.anchorId === selectedAnchorId}
              showNormal={showNormals}
              showTangent={showTangents}
              showInvalid={showInvalid}
              onSelect={onSelectAnchor}
            />
          ))
        : null}
    </group>
  )
}
