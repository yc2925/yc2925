/**
 * Surface-following path queries (Dijkstra) over the growth navigation graph.
 */

import { dist3, add3, scale3, normalize3 } from './types.js'
import { segmentCrossesProtectedOpening } from './navigationGraph.js'
import { findNearestPatch } from './anchors.js'

/**
 * findSurfacePath(startAnchor, endAnchor, options)
 */
export function findSurfacePath(startAnchor, endAnchor, options = {}) {
  const graph = options.graph
  const semantics = options.semantics
  if (!graph?.nodes?.length) {
    return failPath('missing navigation graph')
  }
  if (!startAnchor || !endAnchor) {
    return failPath('missing start or end anchor')
  }

  const startId = resolveNodeId(graph, startAnchor)
  const endId = resolveNodeId(graph, endAnchor)
  if (!startId || !endId) {
    return failPath('anchors do not map to navigation nodes')
  }
  if (startId === endId) {
    const p = startAnchor.worldPosition
    return {
      ok: true,
      status: 'SUCCESS',
      points: [p.slice()],
      surfaces: [startAnchor.surfaceId],
      nodeIds: [startId],
      totalLength: 0,
      growthCost: 0,
      constraintViolations: [],
    }
  }

  const adj = new Map()
  for (const n of graph.nodes) adj.set(n.id, [])
  for (const e of graph.edges ?? []) {
    adj.get(e.sourceId)?.push({ to: e.targetId, edge: e })
    adj.get(e.targetId)?.push({ to: e.sourceId, edge: e })
  }

  const dist = new Map()
  const prev = new Map()
  const prevEdge = new Map()
  for (const n of graph.nodes) dist.set(n.id, Infinity)
  dist.set(startId, 0)

  // Binary-heap substitute: linear scan (graph sizes are modest)
  const open = new Set([startId])
  const closed = new Set()

  while (open.size) {
    let u = null
    let best = Infinity
    for (const id of open) {
      const d = dist.get(id)
      if (d < best) {
        best = d
        u = id
      }
    }
    if (u == null) break
    open.delete(u)
    if (u === endId) break
    closed.add(u)
    for (const { to, edge } of adj.get(u) ?? []) {
      if (closed.has(to)) continue
      if (options.maxGapDistance != null && edge.distance > options.maxGapDistance) continue
      const cost = options.useGrowthCost === false ? edge.distance : edge.growthCost
      const alt = dist.get(u) + cost
      if (alt < dist.get(to)) {
        dist.set(to, alt)
        prev.set(to, u)
        prevEdge.set(to, edge)
        open.add(to)
      }
    }
  }

  if (!(dist.get(endId) < Infinity)) {
    return failPath('no surface path — disconnected or blocked by openings')
  }

  // Reconstruct
  const nodeIds = []
  let cur = endId
  while (cur) {
    nodeIds.push(cur)
    cur = prev.get(cur)
  }
  nodeIds.reverse()

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const rawPoints = nodeIds.map((id) => byId.get(id).position.slice())
  // Include exact start/end anchor positions
  rawPoints[0] = startAnchor.worldPosition.slice()
  rawPoints[rawPoints.length - 1] = endAnchor.worldPosition.slice()

  const violations = []
  for (let i = 0; i < rawPoints.length - 1; i += 1) {
    if (semantics && segmentCrossesProtectedOpening(semantics, rawPoints[i], rawPoints[i + 1])) {
      violations.push({
        type: 'PROTECTED_OPENING',
        segment: [i, i + 1],
      })
    }
  }

  const projected = projectPathOntoSurfaces(rawPoints, semantics, options)

  let totalLength = 0
  for (let i = 0; i < projected.length - 1; i += 1) {
    totalLength += dist3(projected[i], projected[i + 1])
  }

  const surfaces = []
  for (const id of nodeIds) {
    const sid = byId.get(id)?.surfaceId
    if (sid && surfaces[surfaces.length - 1] !== sid) surfaces.push(sid)
  }

  return {
    ok: violations.length === 0,
    status: violations.length ? 'CONSTRAINT_VIOLATIONS' : 'SUCCESS',
    points: projected,
    surfaces,
    nodeIds,
    totalLength,
    growthCost: dist.get(endId),
    constraintViolations: violations,
  }
}

function resolveNodeId(graph, anchor) {
  if (!anchor) return null
  if (anchor.patchId && graph.nodes.some((n) => n.id === anchor.patchId)) return anchor.patchId
  // nearest node to world position
  let best = null
  let bestD = Infinity
  for (const n of graph.nodes) {
    const d = dist3(n.position, anchor.worldPosition)
    if (d < bestD) {
      bestD = d
      best = n.id
    }
  }
  return best
}

/**
 * Project intermediate path points back onto nearest eligible patches.
 */
export function projectPathOntoSurfaces(points, semantics, options = {}) {
  if (!semantics?.patches?.length) return points.map((p) => p.slice())
  const out = []
  for (const p of points) {
    const nearest = findNearestPatch(semantics, p, {
      allowRestricted: options.allowRestricted,
    })
    if (!nearest.patch) {
      out.push(p.slice())
      continue
    }
    const n = normalize3(nearest.patch.representativeNormal ?? [0, 0, 1])
    const c = nearest.patch.worldTransform?.position ?? p
    const toP = [p[0] - c[0], p[1] - c[1], p[2] - c[2]]
    const signed = toP[0] * n[0] + toP[1] * n[1] + toP[2] * n[2]
    out.push([p[0] - n[0] * signed, p[1] - n[1] * signed, p[2] - n[2] * signed])
  }
  return out
}

/**
 * Attempt a direct straight path — used only for negative tests (should fail across openings).
 */
export function straightLinePathPreview(start, end, semantics) {
  const a = start.worldPosition
  const b = end.worldPosition
  const crosses = segmentCrossesProtectedOpening(semantics, a, b)
  const mid = add3(scale3(a, 0.5), scale3(b, 0.5))
  return {
    ok: !crosses,
    status: crosses ? 'BLOCKED_OPENING' : 'DIRECT',
    points: [a.slice(), mid, b.slice()],
    totalLength: dist3(a, b),
    constraintViolations: crosses
      ? [{ type: 'PROTECTED_OPENING', note: 'straight shortcut through void' }]
      : [],
  }
}

function failPath(reason) {
  return {
    ok: false,
    status: 'FAILURE',
    points: [],
    surfaces: [],
    nodeIds: [],
    totalLength: 0,
    growthCost: Infinity,
    constraintViolations: [{ type: 'NO_PATH', reason }],
    reason,
  }
}
