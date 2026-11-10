/**
 * Tangency helpers — explicit constructions, not a general constraint solver.
 */

import { eps, nearlyZero } from './tolerances.js'
import { assertFinitePoint, assertPositiveRadius } from './validation.js'
import {
  subtract,
  add,
  scale,
  distance,
  normalize,
  length,
  fromAngle,
  angleOf,
  perpendicular,
} from './vector2.js'
import { pointAtAngle, tangentAtAngle } from './circle2.js'
import { INTERSECT } from './line2.js'

export function tangentDirectionAtCirclePoint(circle, p) {
  assertFinitePoint(p)
  assertPositiveRadius(circle.radius)
  const v = subtract(p, circle.center)
  const d = length(v)
  if (Math.abs(d - circle.radius) > eps(circle.radius)) {
    throw new Error('tangentDirectionAtCirclePoint: point not on circle')
  }
  const ang = Math.atan2(v.y, v.x)
  return tangentAtAngle(circle, ang)
}

/**
 * Tangents from an external point to a circle.
 * Returns 0, 1 (point on circle), or 2 solutions:
 * { point, direction, touchPoint, length }
 */
export function tangentsFromPoint(circle, external) {
  assertFinitePoint(external)
  assertPositiveRadius(circle.radius)
  const d = distance(external, circle.center)
  const r = circle.radius
  const scaleHint = Math.max(1, r, d)

  if (d < r - eps(scaleHint)) {
    return { status: INTERSECT.NONE, tangents: [] }
  }

  if (nearlyZero(d - r, scaleHint)) {
    // Point on circle — one tangent line
    const dir = tangentDirectionAtCirclePoint(circle, external)
    return {
      status: 'TANGENT',
      tangents: [
        {
          touchPoint: { ...external },
          direction: dir,
          from: { ...external },
        },
      ],
    }
  }

  const L = Math.sqrt(d * d - r * r)
  const theta = Math.atan2(external.y - circle.center.y, external.x - circle.center.x)
  const phi = Math.acos(r / d)

  const solutions = []
  for (const sign of [1, -1]) {
    const touchAngle = theta + sign * phi
    const touch = pointAtAngle(circle, touchAngle)
    const dir = normalize(subtract(touch, external))
    solutions.push({
      touchPoint: touch,
      direction: dir,
      from: { ...external },
      length: L,
      touchAngle,
    })
  }

  // Deterministic order by touchAngle
  solutions.sort((a, b) => a.touchAngle - b.touchAngle)
  return { status: INTERSECT.INTERSECTING, tangents: solutions }
}

/**
 * Residual: |distance(center, point) − radius|. Near zero ⇒ on circle.
 */
export function tangencyResidual(circle, p) {
  return Math.abs(distance(p, circle.center) - circle.radius)
}

export function isTangentPoint(circle, p, tolScale) {
  return tangencyResidual(circle, p) <= eps(tolScale ?? circle.radius)
}
