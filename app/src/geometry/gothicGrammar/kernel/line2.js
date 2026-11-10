/**
 * Infinite lines, rays, and finite segments.
 */

import { eps, nearlyZero, nearlyEqual } from './tolerances.js'
import { assertFinitePoint } from './validation.js'
import {
  point,
  subtract,
  add,
  scale,
  dot,
  cross2D,
  length,
  normalize,
  distance,
  lerp,
  nearlyEqualPoints,
} from './vector2.js'

export const LINE_KIND = {
  LINE: 'line',
  RAY: 'ray',
  SEGMENT: 'segment',
}

export function createLine(origin, direction) {
  assertFinitePoint(origin, 'line.origin')
  const dir = normalize(direction)
  return { kind: LINE_KIND.LINE, origin: { ...origin }, direction: dir }
}

export function createRay(origin, direction) {
  assertFinitePoint(origin, 'ray.origin')
  const dir = normalize(direction)
  return { kind: LINE_KIND.RAY, origin: { ...origin }, direction: dir }
}

export function createSegment(a, b) {
  assertFinitePoint(a, 'segment.a')
  assertFinitePoint(b, 'segment.b')
  const d = subtract(b, a)
  const len = length(d)
  if (nearlyZero(len, len || 1)) {
    return {
      kind: LINE_KIND.SEGMENT,
      a: { ...a },
      b: { ...b },
      direction: { x: 1, y: 0 },
      length: 0,
      degenerate: true,
    }
  }
  return {
    kind: LINE_KIND.SEGMENT,
    a: { ...a },
    b: { ...b },
    direction: { x: d.x / len, y: d.y / len },
    length: len,
    degenerate: false,
  }
}

export function lineFromPoints(a, b) {
  return createLine(a, subtract(b, a))
}

export function pointAtParameter(entity, t) {
  if (entity.kind === LINE_KIND.SEGMENT) {
    return lerp(entity.a, entity.b, t)
  }
  return add(entity.origin, scale(entity.direction, t))
}

export function directionOf(entity) {
  if (entity.kind === LINE_KIND.SEGMENT) return { ...entity.direction }
  return { ...entity.direction }
}

export function lengthOf(entity) {
  if (entity.kind === LINE_KIND.SEGMENT) return entity.length
  return Infinity
}

/**
 * Orthogonal projection of point p onto infinite line supporting the entity.
 * Returns { point, t, distance } where t is along direction from origin/a.
 */
export function projectPoint(entity, p) {
  assertFinitePoint(p)
  if (entity.kind === LINE_KIND.SEGMENT) {
    const ab = subtract(entity.b, entity.a)
    const lenSq = dot(ab, ab)
    if (nearlyZero(Math.sqrt(lenSq), entity.length || 1)) {
      return { point: { ...entity.a }, t: 0, distance: distance(p, entity.a), clamped: true }
    }
    let t = dot(subtract(p, entity.a), ab) / lenSq
    const clamped = t < 0 || t > 1
    t = Math.min(1, Math.max(0, t))
    const q = lerp(entity.a, entity.b, t)
    return { point: q, t, distance: distance(p, q), clamped }
  }
  const t = dot(subtract(p, entity.origin), entity.direction)
  const q = add(entity.origin, scale(entity.direction, t))
  return { point: q, t, distance: distance(p, q), clamped: false }
}

export function closestPoint(entity, p) {
  return projectPoint(entity, p).point
}

export function distanceToLine(entity, p) {
  return projectPoint(entity, p).distance
}

export const INTERSECT = {
  INTERSECTING: 'INTERSECTING',
  PARALLEL: 'PARALLEL',
  COINCIDENT: 'COINCIDENT',
  DEGENERATE: 'DEGENERATE',
  NONE: 'NONE',
}

/**
 * Infinite-line intersection supporting two entities (uses origin+direction or a→b).
 */
export function intersectInfinite(lineA, lineB) {
  const o1 = lineA.kind === LINE_KIND.SEGMENT ? lineA.a : lineA.origin
  const d1 = lineA.kind === LINE_KIND.SEGMENT ? lineA.direction : lineA.direction
  const o2 = lineB.kind === LINE_KIND.SEGMENT ? lineB.a : lineB.origin
  const d2 = lineB.kind === LINE_KIND.SEGMENT ? lineB.direction : lineB.direction

  if (lineA.degenerate || lineB.degenerate) {
    return { status: INTERSECT.DEGENERATE, point: null, t1: null, t2: null }
  }

  const denom = cross2D(d1, d2)
  const scaleHint = Math.max(1, length(d1), length(d2), distance(o1, o2))
  if (nearlyZero(denom, scaleHint)) {
    // Parallel — check coincident
    const w = subtract(o2, o1)
    if (nearlyZero(cross2D(w, d1), scaleHint)) {
      return { status: INTERSECT.COINCIDENT, point: null, t1: null, t2: null }
    }
    return { status: INTERSECT.PARALLEL, point: null, t1: null, t2: null }
  }

  const w = subtract(o2, o1)
  const t1 = cross2D(w, d2) / denom
  const t2 = cross2D(w, d1) / denom
  const p = add(o1, scale(d1, t1))
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    return { status: INTERSECT.DEGENERATE, point: null, t1: null, t2: null }
  }
  return { status: INTERSECT.INTERSECTING, point: p, t1, t2 }
}

function parameterInBounds(entity, t, absoluteParam) {
  if (entity.kind === LINE_KIND.LINE) return true
  if (entity.kind === LINE_KIND.RAY) return absoluteParam >= -eps(1)
  // segment: t in [0,1] along segment length parameterization for intersectSegments
  return t >= -eps(entity.length || 1) && t <= 1 + eps(entity.length || 1)
}

/**
 * Segment–segment intersection. Does not treat infinite-line hits as valid
 * unless both parameters lie within segment bounds.
 */
export function intersectSegments(segA, segB) {
  if (segA.kind !== LINE_KIND.SEGMENT || segB.kind !== LINE_KIND.SEGMENT) {
    throw new Error('intersectSegments: both arguments must be segments')
  }
  if (segA.degenerate || segB.degenerate) {
    return { status: INTERSECT.DEGENERATE, point: null, t1: null, t2: null, onBoth: false }
  }

  const a = segA.a
  const ab = subtract(segA.b, segA.a)
  const c = segB.a
  const cd = subtract(segB.b, segB.a)
  const denom = cross2D(ab, cd)
  const scaleHint = Math.max(1, segA.length, segB.length)

  if (nearlyZero(denom, scaleHint)) {
    const w = subtract(c, a)
    if (nearlyZero(cross2D(w, ab), scaleHint)) {
      return { status: INTERSECT.COINCIDENT, point: null, t1: null, t2: null, onBoth: false }
    }
    return { status: INTERSECT.PARALLEL, point: null, t1: null, t2: null, onBoth: false }
  }

  const ac = subtract(c, a)
  const t1 = cross2D(ac, cd) / denom
  const t2 = cross2D(ac, ab) / denom
  const onBoth =
    t1 >= -eps(scaleHint) && t1 <= 1 + eps(scaleHint) && t2 >= -eps(scaleHint) && t2 <= 1 + eps(scaleHint)

  if (!onBoth) {
    return {
      status: INTERSECT.NONE,
      point: null,
      t1,
      t2,
      onBoth: false,
      infiniteStatus: INTERSECT.INTERSECTING,
    }
  }

  const p = lerp(a, segA.b, t1)
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    return { status: INTERSECT.DEGENERATE, point: null, t1, t2, onBoth: false }
  }
  return { status: INTERSECT.INTERSECTING, point: p, t1, t2, onBoth: true }
}

export function lineLineIntersection(a, b) {
  return intersectInfinite(a, b)
}
