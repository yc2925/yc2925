/**
 * Rigid / similarity transforms and reflection.
 */

import { assertFinitePoint } from './validation.js'
import {
  add,
  subtract,
  scale,
  point,
  fromAngle,
  normalize,
  dot,
} from './vector2.js'
import { createLine, createSegment, createRay, LINE_KIND } from './line2.js'
import { createCircle } from './circle2.js'
import { createArc } from './arc2.js'

export function translatePoint(p, delta) {
  assertFinitePoint(p)
  assertFinitePoint(delta)
  return add(p, delta)
}

export function rotatePoint(p, pivot, angle) {
  assertFinitePoint(p)
  assertFinitePoint(pivot)
  const v = subtract(p, pivot)
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return {
    x: pivot.x + v.x * c - v.y * s,
    y: pivot.y + v.x * s + v.y * c,
  }
}

export function scalePoint(p, pivot, factor) {
  assertFinitePoint(p)
  assertFinitePoint(pivot)
  if (!Number.isFinite(factor)) throw new Error('scalePoint: factor must be finite')
  return add(pivot, scale(subtract(p, pivot), factor))
}

/**
 * Reflect point across infinite line through origin with unit direction,
 * or segment/line entity.
 */
export function reflectPointAcrossLine(p, line) {
  assertFinitePoint(p)
  const o = line.kind === LINE_KIND.SEGMENT ? line.a : line.origin
  const d = line.direction
  const v = subtract(p, o)
  const t = dot(v, d)
  const proj = add(o, scale(d, t))
  return add(proj, scale(subtract(proj, p), 1)) // proj - (p - proj) = 2*proj - p
}

export function transformPoint(p, xf) {
  let q = { ...p }
  if (xf.translate) q = translatePoint(q, xf.translate)
  if (xf.rotate) q = rotatePoint(q, xf.rotate.pivot, xf.rotate.angle)
  if (xf.scale != null) q = scalePoint(q, xf.scale.pivot ?? { x: 0, y: 0 }, xf.scale.factor)
  if (xf.reflectLine) q = reflectPointAcrossLine(q, xf.reflectLine)
  return q
}

export function transformLine(line, xf) {
  if (line.kind === LINE_KIND.SEGMENT) {
    return createSegment(transformPoint(line.a, xf), transformPoint(line.b, xf))
  }
  const o = transformPoint(line.origin, xf)
  const tip = transformPoint(add(line.origin, line.direction), xf)
  const dir = normalize(subtract(tip, o))
  if (line.kind === LINE_KIND.RAY) return createRay(o, dir)
  return createLine(o, dir)
}

export function transformCircle(circle, xf) {
  const c = transformPoint(circle.center, xf)
  let r = circle.radius
  if (xf.scale?.factor != null) r *= Math.abs(xf.scale.factor)
  return createCircle(c, r)
}

/**
 * Transform an arc by mapping endpoints + center, then recovering angles.
 * Reflections / negative scales reverse sweep orientation.
 */
export function transformArc(arc, xf) {
  const c = transformPoint(arc.center, xf)
  let r = arc.radius
  if (xf.scale?.factor != null) r *= Math.abs(xf.scale.factor)

  const startPt = transformPoint(
    add(arc.center, fromAngle(arc.startAngle, arc.radius)),
    xf,
  )
  const endPt = transformPoint(
    add(arc.center, fromAngle(arc.startAngle + arc.sweepAngle, arc.radius)),
    xf,
  )
  const startAngle = Math.atan2(startPt.y - c.y, startPt.x - c.x)
  const endAngle = Math.atan2(endPt.y - c.y, endPt.x - c.x)
  const mag = Math.abs(arc.sweepAngle)
  const twoPi = Math.PI * 2

  // Orientation: reflection or negative scale flips winding
  let flip = false
  if (xf.reflectLine) flip = !flip
  if (xf.scale?.factor != null && xf.scale.factor < 0) flip = !flip

  let delta = endAngle - startAngle
  if (flip) {
    // Expect CW if original was CCW, etc.
    while (delta > 0) delta -= twoPi
    while (delta < -twoPi) delta += twoPi
    if (nearlyZeroSweep(delta)) delta = -mag
    else delta = -mag * Math.sign(Math.abs(delta) || 1)
    // Force exact magnitude with CW sign
    delta = -mag
  } else {
    while (delta < 0) delta += twoPi
    while (delta > twoPi) delta -= twoPi
    delta = Math.sign(arc.sweepAngle) * mag
  }

  return createArc(c, r, startAngle, delta)
}

function nearlyZeroSweep(v) {
  return Math.abs(v) < 1e-12
}

export function reflectionAcrossLine(line) {
  return { reflectLine: line }
}

export function translation(dx, dy) {
  return { translate: point(dx, dy) }
}

export function rotation(pivot, angle) {
  return { rotate: { pivot, angle } }
}

export function uniformScale(pivot, factor) {
  return { scale: { pivot, factor } }
}
