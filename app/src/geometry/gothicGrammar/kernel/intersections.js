/**
 * Structured intersection helpers composing line/circle/arc ops.
 * Core intersect* functions live in line2.js / circle2.js (exported via kernel index).
 */

import { intersectCircles, intersectLineCircle } from './circle2.js'
import { INTERSECT } from './line2.js'
import { pointOnArc } from './arc2.js'
import { isFinitePoint } from './validation.js'

/**
 * Filter circle–circle hits that also lie on both arcs.
 */
export function intersectArcs(arcA, arcB) {
  const raw = intersectCircles(arcA, arcB)
  if (!raw.points?.length) return raw
  const points = raw.points.filter(
    (p) => isFinitePoint(p) && pointOnArc(arcA, p) && pointOnArc(arcB, p),
  )
  if (!points.length) return { status: INTERSECT.NONE, points: [] }
  if (points.length === 1 && raw.status === 'TANGENT') {
    return { status: 'TANGENT', points }
  }
  return { status: INTERSECT.INTERSECTING, points }
}

export function classifyIntersection(result) {
  return result?.status ?? INTERSECT.NONE
}

export function lineCircleIntersection(line, circle) {
  return intersectLineCircle(line, circle)
}

export function circleCircleIntersection(c1, c2) {
  return intersectCircles(c1, c2)
}
