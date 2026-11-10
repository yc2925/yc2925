/**
 * Circular arcs — true circle geometry (not Bézier approximations).
 *
 * Representation: { center, radius, startAngle, sweepAngle }
 * Positive sweep = CCW, negative = CW.
 */

import { eps, nearlyZero, normalizeAngle, normalizeAngle0, clamp } from './tolerances.js'
import { assertFinitePoint, assertPositiveRadius } from './validation.js'
import { add, fromAngle, distance } from './vector2.js'
import { pointAtAngle, tangentAtAngle, createCircle } from './circle2.js'

export function createArc(center, radius, startAngle, sweepAngle) {
  assertFinitePoint(center, 'arc.center')
  assertPositiveRadius(radius, 'arc.radius')
  if (!Number.isFinite(startAngle) || !Number.isFinite(sweepAngle)) {
    throw new Error('arc: angles must be finite')
  }
  if (nearlyZero(sweepAngle, 1)) {
    throw new Error('arc: sweepAngle must be non-zero')
  }
  return {
    type: 'arc',
    center: { x: center.x, y: center.y },
    radius,
    startAngle,
    sweepAngle,
  }
}

export function arcFromCircle(circle, startAngle, sweepAngle) {
  return createArc(circle.center, circle.radius, startAngle, sweepAngle)
}

/** Point at parameter t ∈ [0, 1] along the sweep. */
export function pointAt(arc, t) {
  const tt = clamp(t, 0, 1)
  const ang = arc.startAngle + arc.sweepAngle * tt
  return pointAtAngle(arc, ang)
}

export function tangentAt(arc, t) {
  const tt = clamp(t, 0, 1)
  const ang = arc.startAngle + arc.sweepAngle * tt
  const tang = tangentAtAngle(arc, ang)
  // CW sweep flips tangent sense along the path
  if (arc.sweepAngle < 0) return { x: -tang.x, y: -tang.y }
  return tang
}

export function arcLength(arc) {
  return Math.abs(arc.sweepAngle) * arc.radius
}

export function reverseArc(arc) {
  const end = arc.startAngle + arc.sweepAngle
  return createArc(arc.center, arc.radius, end, -arc.sweepAngle)
}

export function startPoint(arc) {
  return pointAt(arc, 0)
}

export function endPoint(arc) {
  return pointAt(arc, 1)
}

/**
 * Test whether angle (absolute) lies on the arc sweep, handling wraparound.
 */
export function angleOnArc(arc, absoluteAngle) {
  const sweep = arc.sweepAngle
  const start = normalizeAngle0(arc.startAngle)
  let a = normalizeAngle0(absoluteAngle)
  let delta = a - start
  if (sweep >= 0) {
    if (delta < 0) delta += Math.PI * 2
    return delta <= Math.abs(sweep) + eps(1)
  }
  // negative sweep: travel CW
  if (delta > 0) delta -= Math.PI * 2
  return delta >= -Math.abs(sweep) - eps(1)
}

export function pointOnArc(arc, p, scale = arc.radius) {
  const d = distance(p, arc.center)
  if (Math.abs(d - arc.radius) > eps(scale)) return false
  const ang = Math.atan2(p.y - arc.center.y, p.x - arc.center.x)
  return angleOnArc(arc, ang)
}

/**
 * Axis-aligned bounding box of the arc (exact: include endpoints + extrema at k·π/2 if in sweep).
 */
export function arcBoundingBox(arc) {
  const pts = [pointAt(arc, 0), pointAt(arc, 1)]
  for (let k = 0; k < 4; k += 1) {
    const cand = (k * Math.PI) / 2
    if (angleOnArc(arc, cand)) pts.push(pointAtAngle(arc, cand))
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { min: { x: minX, y: minY }, max: { x: maxX, y: maxY } }
}

export function toCircle(arc) {
  return createCircle(arc.center, arc.radius)
}
