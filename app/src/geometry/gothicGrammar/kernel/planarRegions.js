/**
 * Ordered curve loops / planar regions — not a full CAD boolean engine.
 */

import { eps, nearlyZero } from './tolerances.js'
import { isFinitePoint } from './validation.js'
import { distance, cross2D, subtract } from './vector2.js'
import { startPoint, endPoint, pointAt as arcPointAt } from './arc2.js'
import { LINE_KIND } from './line2.js'
import { sampleArc, sampleSegment } from './sampling.js'
import { intersectSegments } from './line2.js'

/**
 * Edge: either { kind:'segment', a, b } or arc object with type:'arc'.
 */
export function edgeEndpoint(edge, which) {
  if (edge.type === 'arc' || edge.sweepAngle != null) {
    return which === 'start' ? startPoint(edge) : endPoint(edge)
  }
  if (edge.kind === LINE_KIND.SEGMENT || (edge.a && edge.b)) {
    return which === 'start' ? edge.a : edge.b
  }
  throw new Error('edgeEndpoint: unknown edge type')
}

export function validateContinuity(edges, tolScale = 1) {
  if (!edges?.length) return { ok: false, reason: 'empty' }
  for (let i = 0; i < edges.length; i += 1) {
    const aEnd = edgeEndpoint(edges[i], 'end')
    const bStart = edgeEndpoint(edges[(i + 1) % edges.length], 'start')
    if (distance(aEnd, bStart) > eps(tolScale) * 10) {
      return { ok: false, reason: 'discontinuous', at: i }
    }
  }
  return { ok: true }
}

export function validateClosure(edges, tolScale = 1) {
  if (!edges?.length) return { ok: false, reason: 'empty' }
  const first = edgeEndpoint(edges[0], 'start')
  const last = edgeEndpoint(edges[edges.length - 1], 'end')
  if (distance(first, last) > eps(tolScale) * 10) {
    return { ok: false, reason: 'open' }
  }
  return validateContinuity(edges, tolScale)
}

/** Sample polyline for area / self-intersection checks (exact curves kept separately). */
export function loopPolyline(edges, sampleOpts = {}) {
  const pts = []
  for (const e of edges) {
    let samples
    if (e.type === 'arc' || e.sweepAngle != null) {
      samples = sampleArc(e, { segments: sampleOpts.segments ?? 24, ...sampleOpts })
    } else {
      samples = sampleSegment(
        e.kind === LINE_KIND.SEGMENT
          ? e
          : {
              kind: LINE_KIND.SEGMENT,
              a: e.a,
              b: e.b,
              direction: { x: 1, y: 0 },
              length: distance(e.a, e.b),
            },
        sampleOpts.segments ?? 4,
      )
    }
    for (let i = 0; i < samples.length; i += 1) {
      if (pts.length && i === 0) continue // skip duplicate shared endpoint
      pts.push(samples[i])
    }
  }
  // Drop closing duplicate so ring edges are unique vertices (n edges via wrap).
  if (pts.length > 1 && distance(pts[0], pts[pts.length - 1]) <= eps(1) * 10) {
    pts.pop()
  }
  return pts
}

/** Signed area via sampled polyline (shoelace). Positive = CCW. */
export function signedArea(edges, sampleOpts) {
  const pts = loopPolyline(edges, sampleOpts)
  if (pts.length < 3) return 0
  let a = 0
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return 0.5 * a
}

export function windingOrientation(edges, sampleOpts) {
  const a = signedArea(edges, sampleOpts)
  if (nearlyZero(a, 1)) return 'degenerate'
  return a > 0 ? 'ccw' : 'cw'
}

/**
 * Segment–segment self-intersection among sampled polyline edges (adjacent skipped).
 */
export function detectSelfIntersections(edges, sampleOpts) {
  const pts = loopPolyline(edges, { segments: sampleOpts?.segments ?? 16 })
  const hits = []
  const n = pts.length
  if (n < 4) return { selfIntersecting: false, hits }

  for (let i = 0; i < n; i += 1) {
    const a0 = pts[i]
    const a1 = pts[(i + 1) % n]
    const lenA = distance(a0, a1)
    if (lenA < 1e-12) continue
    for (let j = i + 1; j < n; j += 1) {
      // Skip adjacent edges on the closed ring (including wrap i↔n-1).
      if (j === i + 1) continue
      if (i === 0 && j === n - 1) continue
      const b0 = pts[j]
      const b1 = pts[(j + 1) % n]
      const lenB = distance(b0, b1)
      if (lenB < 1e-12) continue
      const segA = {
        kind: LINE_KIND.SEGMENT,
        a: a0,
        b: a1,
        direction: normalizeSafe(subtract(a1, a0)),
        length: lenA,
        degenerate: false,
      }
      const segB = {
        kind: LINE_KIND.SEGMENT,
        a: b0,
        b: b1,
        direction: normalizeSafe(subtract(b1, b0)),
        length: lenB,
        degenerate: false,
      }
      const r = intersectSegments(segA, segB)
      if (r.status === 'INTERSECTING' && r.point) {
        hits.push({ i, j, point: r.point })
      }
    }
  }
  return { selfIntersecting: hits.length > 0, hits }
}

function normalizeSafe(v) {
  const L = Math.hypot(v.x, v.y)
  if (L < 1e-15) return { x: 1, y: 0 }
  return { x: v.x / L, y: v.y / L }
}

/**
 * Ray-crossing point-in-polygon on sampled loop (even-odd).
 */
export function pointInLoop(edges, p, sampleOpts) {
  if (!isFinitePoint(p)) return false
  const pts = loopPolyline(edges, sampleOpts)
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const pi = pts[i]
    const pj = pts[j]
    const intersect =
      pi.y > p.y !== pj.y > p.y &&
      p.x < ((pj.x - pi.x) * (p.y - pi.y)) / (pj.y - pi.y + 0.0) + pi.x
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * Create a planar region. Rejects invalid closure / self-intersection when checked.
 */
export function createPlanarRegion(outerEdges, holes = [], opts = {}) {
  const closure = validateClosure(outerEdges, opts.tolScale ?? 1)
  if (!closure.ok) {
    return { ok: false, reason: closure.reason, region: null }
  }
  const self = detectSelfIntersections(outerEdges, opts)
  if (self.selfIntersecting && opts.allowSelfIntersection !== true) {
    return { ok: false, reason: 'self_intersection', hits: self.hits, region: null }
  }
  const area = signedArea(outerEdges, opts)
  const orientation = windingOrientation(outerEdges, opts)
  return {
    ok: true,
    region: {
      type: 'planarRegion',
      outer: outerEdges,
      holes: holes ?? [],
      signedArea: area,
      orientation,
      validation: { closure, selfIntersection: self },
    },
  }
}
