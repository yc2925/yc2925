/**
 * Growth navigation graph over semantic patches (13E.4).
 * Nodes = patch centers (+ optional feature points). Edges = geometric adjacency.
 */

import { GROWTH_ELIGIBILITY, RELATIONSHIP_TYPES } from '../surfaceSemanticsTypes.js'
import { NAV_TRANSITION_TYPES, dist3, normalize3, dot3 } from './types.js'

/**
 * Build a crawlable navigation graph from surface semantics.
 * Does NOT connect merely because AABBs overlap — requires proximity of
 * patch centroids and compatible normals, or a validated feature-graph relation.
 */
export function buildGrowthNavigationGraph(semantics, options = {}) {
  const gapTol = options.navigationGapTolerance ?? 0.35
  const allowRestricted = options.allowRestricted === true
  const patches = (semantics?.patches ?? []).filter((p) => {
    if (p.growthEligibility === GROWTH_ELIGIBILITY.PROHIBITED) return false
    if (p.growthEligibility === GROWTH_ELIGIBILITY.RESTRICTED && !allowRestricted) return false
    return (p.area ?? 0) > 1e-6
  })

  const nodes = patches.map((p) => {
    const pos = p.worldTransform?.position ?? [0, 0, 0]
    return {
      id: p.patchId,
      kind: 'patch',
      patchId: p.patchId,
      surfaceId: p.surfaceId,
      componentId: p.componentId,
      position: pos,
      normal: normalize3(p.representativeNormal ?? [0, 0, 1]),
      eligibility: p.growthEligibility,
      growthWeight: p.growthWeight ?? 0,
      area: p.area ?? 0,
    }
  })

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const byComponent = new Map()
  for (const n of nodes) {
    if (!byComponent.has(n.componentId)) byComponent.set(n.componentId, [])
    byComponent.get(n.componentId).push(n)
  }

  const edges = []
  const edgeKey = new Set()

  const pushEdge = (sourceId, targetId, transitionType, extra = {}) => {
    if (sourceId === targetId) return
    const a = byId.get(sourceId)
    const b = byId.get(targetId)
    if (!a || !b) return
    const key = sourceId < targetId ? `${sourceId}|${targetId}` : `${targetId}|${sourceId}`
    if (edgeKey.has(key)) return
    edgeKey.add(key)
    const distance = dist3(a.position, b.position)
    const growthCost =
      distance /
      Math.max(0.05, 0.25 + 0.75 * Math.min(a.growthWeight, b.growthWeight))
    edges.push({
      id: `e-${edges.length}`,
      sourceId,
      targetId,
      distance,
      transitionType,
      growthCost,
      eligibility:
        a.eligibility === GROWTH_ELIGIBILITY.ALLOWED &&
        b.eligibility === GROWTH_ELIGIBILITY.ALLOWED
          ? GROWTH_ELIGIBILITY.ALLOWED
          : GROWTH_ELIGIBILITY.RESTRICTED,
      clearance: extra.clearance ?? null,
      featureReference: extra.featureReference ?? null,
    })
  }

  // Same-surface / same-component adjacency by proximity
  for (const [, group] of byComponent) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]
        const b = group[j]
        const d = dist3(a.position, b.position)
        const ra = Math.sqrt(Math.max(a.area, 1e-6) / Math.PI)
        const rb = Math.sqrt(Math.max(b.area, 1e-6) / Math.PI)
        const linkDist = ra + rb + gapTol
        if (d > linkDist) continue
        // Avoid connecting opposite faces through the solid (normals opposing + far along N)
        const nDot = dot3(a.normal, b.normal)
        if (nDot < -0.35 && d > Math.min(ra, rb) * 0.5) continue
        const sameSurf = a.surfaceId === b.surfaceId
        pushEdge(
          a.id,
          b.id,
          sameSurf ? NAV_TRANSITION_TYPES.SAME_SURFACE : NAV_TRANSITION_TYPES.ADJACENT_SURFACE,
        )
      }
    }
  }

  // Cross-component links from semantic feature graph (validated relationships only)
  const allowedRels = new Set([
    RELATIONSHIP_TYPES.ADJACENT_COMPONENT,
    RELATIONSHIP_TYPES.ADJACENT_SURFACE,
    RELATIONSHIP_TYPES.STRUCTURAL_JUNCTION,
    RELATIONSHIP_TYPES.PIER_TO_BUTTRESS,
    RELATIONSHIP_TYPES.ARCH_BOUNDARY,
    RELATIONSHIP_TYPES.BAY_TO_PIER,
    RELATIONSHIP_TYPES.TRACERY_INTERSECTION,
  ])

  const componentPatches = byComponent
  for (const edge of semantics?.featureGraph?.edges ?? []) {
    if (!allowedRels.has(edge.relationshipType)) continue
    // feature graph nodes are often component ids
    const srcGroup = componentPatches.get(edge.sourceId) ?? []
    const tgtGroup = componentPatches.get(edge.targetId) ?? []
    if (!srcGroup.length || !tgtGroup.length) continue

    // Connect nearest patch pair across the two components if within gap
    let best = null
    for (const a of srcGroup) {
      for (const b of tgtGroup) {
        const d = dist3(a.position, b.position)
        if (d > gapTol * 2.5) continue
        if (!best || d < best.d) best = { a, b, d }
      }
    }
    if (!best) continue
    const junction =
      edge.relationshipType === RELATIONSHIP_TYPES.STRUCTURAL_JUNCTION ||
      edge.relationshipType === RELATIONSHIP_TYPES.PIER_TO_BUTTRESS
    pushEdge(
      best.a.id,
      best.b.id,
      junction
        ? NAV_TRANSITION_TYPES.STRUCTURAL_JUNCTION
        : NAV_TRANSITION_TYPES.ARCHITECTURAL_EDGE,
      { featureReference: edge.relationshipType, clearance: best.d },
    )
  }

  // Explicitly refuse edges that would cross protected openings (centroid between nodes)
  const filtered = edges.filter((e) => {
    const a = byId.get(e.sourceId)
    const b = byId.get(e.targetId)
    if (!a || !b) return false
    return !segmentCrossesProtectedOpening(semantics, a.position, b.position)
  })

  return {
    type: 'GROWTH_NAVIGATION_GRAPH',
    geometrySignature: semantics?.geometryVersion ?? '',
    nodes,
    edges: filtered,
    diagnostics: {
      nodeCount: nodes.length,
      edgeCount: filtered.length,
      discardedOpeningShortcuts: edges.length - filtered.length,
      gapTolerance: gapTol,
    },
  }
}

/**
 * Heuristic: if the midpoint of a segment lies near a protected opening centroid
 * while endpoints are far from that opening, treat as an invalid void shortcut.
 */
export function segmentCrossesProtectedOpening(semantics, a, b) {
  const mid = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5]
  for (const op of semantics?.openings ?? []) {
    if (op.growableSurface === true) continue
    const c = op.centroid
    if (!c) continue
    const cx = c[0] ?? c.x ?? 0
    const cy = c[1] ?? c.y ?? 0
    const r = Math.max(0.12, Math.sqrt(Math.max(0, op.area ?? 0) / Math.PI) * 0.4)
    const dMid = Math.hypot(mid[0] - cx, mid[1] - cy)
    const dA = Math.hypot(a[0] - cx, a[1] - cy)
    const dB = Math.hypot(b[0] - cx, b[1] - cy)
    if (dMid < r && dA > r * 0.85 && dB > r * 0.85) return true
  }
  return false
}
