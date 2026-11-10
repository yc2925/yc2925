/**
 * Concentric / parallel offsets. Sign convention:
 * - Line offset: positive = left of direction (CCW normal)
 * - Circle/arc offset: positive = outward (larger radius)
 */

import { assertFinitePoint, assertPositiveRadius } from './validation.js'
import { add, scale, perpendicular, normalize } from './vector2.js'
import { createLine, createSegment, LINE_KIND } from './line2.js'
import { createCircle } from './circle2.js'
import { createArc } from './arc2.js'

export function offsetLine(line, distance) {
  if (!Number.isFinite(distance)) throw new Error('offsetLine: distance must be finite')
  const n = normalize(perpendicular(line.direction))
  const delta = scale(n, distance)
  if (line.kind === LINE_KIND.SEGMENT) {
    return createSegment(add(line.a, delta), add(line.b, delta))
  }
  return createLine(add(line.origin, delta), line.direction)
}

export function offsetCircle(circle, distance) {
  if (!Number.isFinite(distance)) throw new Error('offsetCircle: distance must be finite')
  assertPositiveRadius(circle.radius)
  const r = circle.radius + distance
  if (r <= 0) {
    return { ok: false, reason: 'nonpositive_radius', circle: null }
  }
  return { ok: true, circle: createCircle(circle.center, r) }
}

export function offsetArc(arc, distance) {
  if (!Number.isFinite(distance)) throw new Error('offsetArc: distance must be finite')
  assertPositiveRadius(arc.radius)
  const r = arc.radius + distance
  if (r <= 0) {
    return { ok: false, reason: 'nonpositive_radius', arc: null }
  }
  return {
    ok: true,
    arc: createArc(arc.center, r, arc.startAngle, arc.sweepAngle),
  }
}
