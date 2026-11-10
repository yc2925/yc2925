/**
 * Circles: center + positive radius.
 */

import { eps, nearlyZero, nearlyEqual } from './tolerances.js'
import { assertFinitePoint, assertPositiveRadius } from './validation.js'
import {
  point,
  add,
  subtract,
  scale,
  distance,
  length,
  normalize,
  fromAngle,
  perpendicular,
  mid,
} from './vector2.js'
import { INTERSECT, createLine, LINE_KIND } from './line2.js'

export function createCircle(center, radius) {
  assertFinitePoint(center, 'circle.center')
  assertPositiveRadius(radius, 'circle.radius')
  return { type: 'circle', center: { x: center.x, y: center.y }, radius }
}

export function pointAtAngle(circle, angle) {
  assertPositiveRadius(circle.radius)
  return add(circle.center, fromAngle(angle, circle.radius))
}

/** Unit tangent (counterclockwise) at angle. */
export function tangentAtAngle(circle, angle) {
  return fromAngle(angle + Math.PI / 2, 1)
}

export function circleBoundingBox(circle) {
  const { center: c, radius: r } = circle
  return {
    min: { x: c.x - r, y: c.y - r },
    max: { x: c.x + r, y: c.y + r },
  }
}

/**
 * Line–circle intersection. Line may be infinite, ray, or segment;
 * for segment/ray, filters by parameter bounds.
 */
export function intersectLineCircle(line, circle) {
  assertPositiveRadius(circle.radius)
  const o = line.kind === LINE_KIND.SEGMENT ? line.a : line.origin
  const d = line.direction
  const f = subtract(o, circle.center)
  const a = 1 // d is unit for createLine/createSegment
  const b = 2 * (f.x * d.x + f.y * d.y)
  const c = f.x * f.x + f.y * f.y - circle.radius * circle.radius
  const disc = b * b - 4 * a * c
  const scaleHint = Math.max(1, circle.radius, distance(o, circle.center))

  if (disc < -eps(scaleHint)) {
    return { status: INTERSECT.NONE, points: [], parameters: [] }
  }

  const sqrtDisc = Math.sqrt(Math.max(0, disc))
  const t0 = (-b - sqrtDisc) / (2 * a)
  const t1 = (-b + sqrtDisc) / (2 * a)

  const candidates = nearlyEqual(t0, t1, scaleHint) ? [t0] : [t0, t1].sort((u, v) => u - v)

  const points = []
  const parameters = []
  for (const t of candidates) {
    let ok = true
    if (line.kind === LINE_KIND.RAY) ok = t >= -eps(scaleHint)
    if (line.kind === LINE_KIND.SEGMENT) {
      const len = line.length || 0
      ok = t >= -eps(scaleHint) && t <= len + eps(scaleHint)
      // segment direction is unit; pointAt uses lerp for segments — use origin+ t*d for infinite/ray
    }
    if (!ok) continue
    const p =
      line.kind === LINE_KIND.SEGMENT
        ? add(line.a, scale(d, t))
        : add(o, scale(d, t))
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    points.push(p)
    parameters.push(t)
  }

  if (!points.length) return { status: INTERSECT.NONE, points: [], parameters: [] }
  if (points.length === 1) {
    return { status: 'TANGENT', points, parameters }
  }
  return { status: INTERSECT.INTERSECTING, points, parameters }
}

/**
 * Circle–circle intersection. Deterministic ordering: sort by angle from first center.
 */
export function intersectCircles(c1, c2) {
  assertPositiveRadius(c1.radius)
  assertPositiveRadius(c2.radius)
  const d = distance(c1.center, c2.center)
  const r1 = c1.radius
  const r2 = c2.radius
  const scaleHint = Math.max(1, r1, r2, d)

  if (nearlyZero(d, scaleHint) && nearlyEqual(r1, r2, scaleHint)) {
    return { status: 'COINCIDENT', points: [] }
  }
  if (nearlyZero(d, scaleHint) && !nearlyEqual(r1, r2, scaleHint)) {
    return { status: INTERSECT.NONE, points: [] }
  }

  if (d > r1 + r2 + eps(scaleHint) || d < Math.abs(r1 - r2) - eps(scaleHint)) {
    return { status: INTERSECT.NONE, points: [] }
  }

  // Distance from c1 to radical line
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const hSq = r1 * r1 - a * a
  const dir = normalize(subtract(c2.center, c1.center))
  const p0 = add(c1.center, scale(dir, a))

  if (hSq < -eps(scaleHint)) {
    return { status: INTERSECT.NONE, points: [] }
  }

  if (nearlyZero(Math.sqrt(Math.max(0, hSq)), scaleHint)) {
    // Tangent — single point
    return { status: 'TANGENT', points: [p0] }
  }

  const h = Math.sqrt(hSq)
  const perp = perpendicular(dir)
  const p1 = add(p0, scale(perp, h))
  const p2 = add(p0, scale(perp, -h))

  // Deterministic order: by angle around c1
  const ang = (p) => Math.atan2(p.y - c1.center.y, p.x - c1.center.x)
  const pts = [p1, p2].sort((u, v) => ang(u) - ang(v))
  return { status: INTERSECT.INTERSECTING, points: pts }
}

// Note: point / mid / createLine live in vector2.js / line2.js — do not re-export here.
