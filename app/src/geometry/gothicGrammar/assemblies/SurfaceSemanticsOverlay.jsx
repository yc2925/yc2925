/**
 * Surface semantics debug overlay (Step 13E.3).
 * Sibling to stone meshes — does not modify default architectural materials.
 */

import { useMemo, useEffect } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  SEMANTIC_VIEW_MODES,
  COMPONENT_TYPE_COLORS,
  SURFACE_TYPE_COLORS,
  ELIGIBILITY_COLORS,
  ZONE_COLORS,
  GROWTH_ZONES,
} from './surfaceSemanticsTypes.js'

function weightColor(w) {
  const t = Math.max(0, Math.min(1, w ?? 0))
  // green (allowed) → amber → red (none)
  const r = Math.round(40 + t * 40 + (1 - t) * 160)
  const g = Math.round(40 + t * 160)
  const b = Math.round(40 + (1 - t) * 40)
  return `rgb(${r},${g},${b})`
}

function colorForPatch(patch, surface, component, view, zonesBySurface) {
  if (view === SEMANTIC_VIEW_MODES.COMPONENT_TYPE) {
    return COMPONENT_TYPE_COLORS[component?.componentType] ?? '#888888'
  }
  if (view === SEMANTIC_VIEW_MODES.SURFACE_ORIENTATION) {
    return SURFACE_TYPE_COLORS[surface?.surfaceType] ?? '#888888'
  }
  if (view === SEMANTIC_VIEW_MODES.GROWTH_ELIGIBILITY) {
    return ELIGIBILITY_COLORS[patch.growthEligibility] ?? '#888888'
  }
  if (view === SEMANTIC_VIEW_MODES.GROWTH_WEIGHT) {
    return weightColor(patch.growthWeight)
  }
  if (view === SEMANTIC_VIEW_MODES.GROWTH_ZONES) {
    const zs = zonesBySurface.get(patch.surfaceId) ?? patch.activeZones ?? []
    if (zs.includes(GROWTH_ZONES.PROTECTED_OPENING)) return ZONE_COLORS.PROTECTED_OPENING
    if (zs.includes(GROWTH_ZONES.SACRED_FACADE)) return ZONE_COLORS.SACRED_FACADE
    if (zs.includes(GROWTH_ZONES.TRACERY_ORNAMENT)) return ZONE_COLORS.TRACERY_ORNAMENT
    if (zs.includes(GROWTH_ZONES.RECESSED_GROWTH)) return ZONE_COLORS.RECESSED_GROWTH
    if (zs.includes(GROWTH_ZONES.ARCH_FOLLOWING)) return ZONE_COLORS.ARCH_FOLLOWING
    if (zs.includes(GROWTH_ZONES.STRUCTURAL_COLONIZATION)) {
      return ZONE_COLORS.STRUCTURAL_COLONIZATION
    }
    return '#555555'
  }
  return '#6ea8d8'
}

function PatchMarker({ patch, color, selected, onSelect }) {
  const pos = patch.worldTransform?.position ?? [0, 0, 0]
  const n = patch.representativeNormal ?? [0, 0, 1]
  // Offset along normal to avoid z-fighting with stone
  const offset = 0.012 + Math.min(0.04, Math.sqrt(patch.area || 0.01) * 0.02)
  const p = [
    pos[0] + n[0] * offset,
    pos[1] + n[1] * offset,
    pos[2] + n[2] * offset,
  ]
  const scale = Math.max(0.03, Math.min(0.18, Math.sqrt(patch.area || 0.01) * 0.35))
  return (
    <mesh
      position={p}
      onClick={(e) => {
        e.stopPropagation()
        onSelect?.(patch)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        onSelect?.(patch)
      }}
    >
      <sphereGeometry args={[scale, 8, 8]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={selected ? 0.95 : 0.72}
        depthWrite={false}
      />
    </mesh>
  )
}

function FeatureGraphLines({ semantics }) {
  const geo = useMemo(() => {
    const positions = []
    const byId = new Map()
    for (const c of semantics.components ?? []) {
      const p = c.worldTransform?.position ?? [0, 0, 0]
      byId.set(c.id, p)
    }
    for (const s of semantics.surfaces ?? []) {
      byId.set(s.surfaceId, s.centroid)
    }
    for (const e of semantics.featureGraph?.edges ?? []) {
      if (
        e.relationshipType !== 'TRACERY_INTERSECTION' &&
        e.relationshipType !== 'PIER_TO_BUTTRESS' &&
        e.relationshipType !== 'STRUCTURAL_JUNCTION' &&
        e.relationshipType !== 'BAY_TO_PIER' &&
        e.relationshipType !== 'ADJACENT_SURFACE'
      ) {
        continue
      }
      const a = byId.get(e.sourceId)
      const b = byId.get(e.targetId)
      if (!a || !b) continue
      // Limit adjacent-surface lines for readability
      if (e.relationshipType === 'ADJACENT_SURFACE' && positions.length > 2400) continue
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return g
  }, [semantics])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    <lineSegments geometry={geo}>
      <lineBasicMaterial color="#6ea8d8" transparent opacity={0.55} depthWrite={false} />
    </lineSegments>
  )
}

function OpeningMarkers({ openings }) {
  return (openings ?? []).map((o) => (
    <mesh key={o.openingId} position={o.centroid}>
      <ringGeometry args={[0.08, 0.14, 16]} />
      <meshBasicMaterial
        color={ZONE_COLORS.PROTECTED_OPENING}
        transparent
        opacity={0.85}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  ))
}

/**
 * @param {{
 *   semantics: object,
 *   viewMode?: string,
 *   selectedPatchId?: string|null,
 *   onSelectPatch?: function,
 *   showLegend?: boolean
 * }} props
 */
export default function SurfaceSemanticsOverlay({
  semantics,
  viewMode = SEMANTIC_VIEW_MODES.COMPONENT_TYPE,
  selectedPatchId = null,
  onSelectPatch,
  showLegend = true,
}) {
  const componentById = useMemo(() => {
    const m = new Map()
    for (const c of semantics?.components ?? []) m.set(c.id, c)
    return m
  }, [semantics])

  const surfaceById = useMemo(() => {
    const m = new Map()
    for (const s of semantics?.surfaces ?? []) m.set(s.surfaceId, s)
    return m
  }, [semantics])

  const zonesBySurface = useMemo(() => {
    const m = new Map()
    for (const z of semantics?.zones ?? []) {
      for (const sid of z.surfaceIds ?? []) {
        if (!m.has(sid)) m.set(sid, [])
        m.get(sid).push(z.zoneType)
      }
    }
    return m
  }, [semantics])

  const selected = useMemo(() => {
    if (!selectedPatchId) return null
    return (semantics?.patches ?? []).find((p) => p.patchId === selectedPatchId) ?? null
  }, [semantics, selectedPatchId])

  if (!semantics?.patches?.length && viewMode !== SEMANTIC_VIEW_MODES.FEATURE_GRAPH) {
    return null
  }

  const selectedSurface = selected ? surfaceById.get(selected.surfaceId) : null
  const selectedComponent = selected ? componentById.get(selected.componentId) : null

  return (
    <group name="surface-semantics-overlay">
      {viewMode === SEMANTIC_VIEW_MODES.FEATURE_GRAPH ? (
        <>
          <FeatureGraphLines semantics={semantics} />
          {(semantics.patches ?? []).slice(0, 400).map((patch) => (
            <PatchMarker
              key={patch.patchId}
              patch={patch}
              color="#6ea8d8"
              selected={patch.patchId === selectedPatchId}
              onSelect={onSelectPatch}
            />
          ))}
        </>
      ) : (
        (semantics.patches ?? []).map((patch) => {
          const surface = surfaceById.get(patch.surfaceId)
          const component = componentById.get(patch.componentId)
          const color = colorForPatch(patch, surface, component, viewMode, zonesBySurface)
          return (
            <PatchMarker
              key={patch.patchId}
              patch={patch}
              color={color}
              selected={patch.patchId === selectedPatchId}
              onSelect={onSelectPatch}
            />
          )
        })
      )}

      {(viewMode === SEMANTIC_VIEW_MODES.GROWTH_ZONES ||
        viewMode === SEMANTIC_VIEW_MODES.GROWTH_ELIGIBILITY) && (
        <OpeningMarkers openings={semantics.openings} />
      )}

      {selected && selectedSurface ? (
        <Html position={selected.worldTransform?.position ?? [0, 0, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(12,12,14,0.86)',
              color: '#e8e4dc',
              padding: '6px 8px',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              border: '1px solid #3a3a40',
              borderRadius: 4,
              whiteSpace: 'pre',
              transform: 'translate(12px, -12px)',
            }}
          >
            {`id  ${selectedComponent?.id ?? '—'}
type ${selectedComponent?.componentType ?? '—'}
surf ${selectedSurface.surfaceType} (${selectedSurface.surfaceId})
area ${selectedSurface.area.toFixed(4)} m²
n    [${selectedSurface.worldNormal.map((v) => v.toFixed(2)).join(', ')}]
elig ${selected.growthEligibility}
w    ${selected.growthWeight.toFixed(3)}
zones ${(selected.activeZones ?? zonesBySurface.get(selected.surfaceId) ?? []).join(', ') || '—'}`}
          </div>
        </Html>
      ) : null}

      {showLegend ? (
        <Html fullscreen style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              background: 'rgba(12,12,14,0.78)',
              color: '#ddd',
              padding: '8px 10px',
              fontSize: 11,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              border: '1px solid #333',
              borderRadius: 4,
              maxWidth: 280,
            }}
          >
            <div style={{ marginBottom: 4, color: '#aaa' }}>SURFACE SEMANTICS · {viewMode}</div>
            {viewMode === SEMANTIC_VIEW_MODES.GROWTH_ELIGIBILITY
              ? Object.entries(ELIGIBILITY_COLORS).map(([k, c]) => (
                  <div key={k}>
                    <span style={{ color: c }}>■</span> {k}
                  </div>
                ))
              : null}
            {viewMode === SEMANTIC_VIEW_MODES.GROWTH_ZONES
              ? Object.entries(ZONE_COLORS).map(([k, c]) => (
                  <div key={k}>
                    <span style={{ color: c }}>■</span> {k}
                  </div>
                ))
              : null}
            {viewMode === SEMANTIC_VIEW_MODES.SURFACE_ORIENTATION
              ? Object.entries(SURFACE_TYPE_COLORS).map(([k, c]) => (
                  <div key={k}>
                    <span style={{ color: c }}>■</span> {k}
                  </div>
                ))
              : null}
            {viewMode === SEMANTIC_VIEW_MODES.COMPONENT_TYPE ? (
              <div>Colored by architectural component type</div>
            ) : null}
            {viewMode === SEMANTIC_VIEW_MODES.GROWTH_WEIGHT ? (
              <div>Weight 0 → red · 1 → green</div>
            ) : null}
            {viewMode === SEMANTIC_VIEW_MODES.FEATURE_GRAPH ? (
              <div>Construction adjacency / junctions (not tessellation)</div>
            ) : null}
          </div>
        </Html>
      ) : null}
    </group>
  )
}

export { colorForPatch, weightColor }
