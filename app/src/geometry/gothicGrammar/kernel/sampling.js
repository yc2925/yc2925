/**
 * Curve sampling for visualization / numerical checks.
 * Mathematical definitions remain parametric — sampling is derived.
 */

import { clamp } from './tolerances.js'
import { distance, lerp } from './vector2.js'
import { pointAt as arcPointAt, arcLength } from './arc2.js'
import { LINE_KIND, pointAtParameter } from './line2.js'

function dedupeEndpoints(points, eps = 1e-10) {
  if (points.length < 2) return points
  const out = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    const prev = out[out.length - 1]
    const p = points[i]
    if (Math.hypot(p.x - prev.x, p.y - prev.y) > eps) out.push(p)
  }
  return out
}

/**
 * Fixed segment count sampling for a segment (inclusive endpoints).
 */
export function sampleSegment(seg, segments = 8) {
  const n = Math.max(1, Math.round(segments))
  const pts = []
  for (let i = 0; i <= n; i += 1) {
    pts.push(pointAtParameter(seg, i / n))
  }
  return dedupeEndpoints(pts)
}

/**
 * Sample arc with fixed segments, max chord error, and/or max angular step.
 * Deterministic; includes endpoints once.
 */
export function sampleArc(arc, opts = {}) {
  const maxAngle = opts.maxAngularStep ?? Infinity
  const maxChord = opts.maxChordError ?? Infinity
  let segments = opts.segments ?? null

  if (segments == null) {
    const sweep = Math.abs(arc.sweepAngle)
    let nAngle = Number.isFinite(maxAngle) && maxAngle > 0 ? Math.ceil(sweep / maxAngle) : 1
    let nChord = 1
    if (Number.isFinite(maxChord) && maxChord > 0 && arc.radius > 0) {
      // chord = 2 r sin(Δθ/2) ≤ maxChord → Δθ ≤ 2 asin(min(1, maxChord/(2r)))
      const half = Math.min(1, maxChord / (2 * arc.radius))
      const dTheta = 2 * Math.asin(half)
      nChord = Math.max(1, Math.ceil(sweep / Math.max(1e-12, dTheta)))
    }
    segments = Math.max(nAngle, nChord, 4)
  }

  const n = Math.max(1, Math.round(segments))
  const pts = []
  for (let i = 0; i <= n; i += 1) {
    pts.push(arcPointAt(arc, i / n))
  }
  return dedupeEndpoints(pts)
}

export function sampleCircle(circle, segments = 48) {
  const n = Math.max(3, Math.round(segments))
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    pts.push({
      x: circle.center.x + Math.cos(a) * circle.radius,
      y: circle.center.y + Math.sin(a) * circle.radius,
    })
  }
  // closed loop: do not duplicate first at end (renderer may close)
  return pts
}

export function sampleEntity(entity, opts = {}) {
  if (entity.type === 'arc' || entity.sweepAngle != null) return sampleArc(entity, opts)
  if (entity.type === 'circle' || (entity.center && entity.radius != null && entity.sweepAngle == null)) {
    return sampleCircle(entity, opts.segments ?? 48)
  }
  if (entity.kind === LINE_KIND.SEGMENT) return sampleSegment(entity, opts.segments ?? 8)
  return []
}
