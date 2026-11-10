/**
 * 2D points and vectors. Pure JS — no React / Three.js.
 */

import { nearlyZero, eps, clamp } from './tolerances.js'
import { assertFinitePoint, isFinitePoint, validateNonZeroVector } from './validation.js'

export function point(x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('point: coordinates must be finite')
  }
  return { x, y }
}

export function clone(p) {
  assertFinitePoint(p)
  return { x: p.x, y: p.y }
}

export function add(a, b) {
  assertFinitePoint(a, 'add.a')
  assertFinitePoint(b, 'add.b')
  return { x: a.x + b.x, y: a.y + b.y }
}

export function subtract(a, b) {
  assertFinitePoint(a, 'subtract.a')
  assertFinitePoint(b, 'subtract.b')
  return { x: a.x - b.x, y: a.y - b.y }
}

export function scale(v, scalar) {
  assertFinitePoint(v, 'scale.v')
  if (!Number.isFinite(scalar)) throw new Error('scale: scalar must be finite')
  return { x: v.x * scalar, y: v.y * scalar }
}

export function dot(a, b) {
  assertFinitePoint(a, 'dot.a')
  assertFinitePoint(b, 'dot.b')
  return a.x * b.x + a.y * b.y
}

/** 2D cross product (scalar z-component of a×b). */
export function cross2D(a, b) {
  assertFinitePoint(a, 'cross2D.a')
  assertFinitePoint(b, 'cross2D.b')
  return a.x * b.y - a.y * b.x
}

export function length(v) {
  assertFinitePoint(v, 'length')
  return Math.hypot(v.x, v.y)
}

export function distance(a, b) {
  return length(subtract(a, b))
}

/**
 * Normalize. Throws on zero-length unless { allowZero: true } → returns null.
 */
export function normalize(v, opts = {}) {
  assertFinitePoint(v, 'normalize')
  const len = length(v)
  const scaleHint = opts.scale ?? len
  if (nearlyZero(len, scaleHint) || len === 0) {
    if (opts.allowZero) return null
    throw new Error('normalize: zero-length vector')
  }
  return { x: v.x / len, y: v.y / len }
}

/** Left perpendicular (−y, x). Not normalized. */
export function perpendicular(v) {
  assertFinitePoint(v, 'perpendicular')
  return { x: -v.y, y: v.x }
}

export function lerp(a, b, t) {
  assertFinitePoint(a, 'lerp.a')
  assertFinitePoint(b, 'lerp.b')
  if (!Number.isFinite(t)) throw new Error('lerp: t must be finite')
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

export function nearlyEqualPoints(a, b, scale = 1) {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return false
  return distance(a, b) <= eps(scale)
}

export function mid(a, b) {
  return lerp(a, b, 0.5)
}

export function angleOf(v) {
  assertFinitePoint(v)
  const check = validateNonZeroVector(v)
  if (!check.ok) throw new Error(`angleOf: ${check.reason}`)
  return Math.atan2(v.y, v.x)
}

export function fromAngle(angle, radius = 1) {
  if (!Number.isFinite(angle) || !Number.isFinite(radius)) {
    throw new Error('fromAngle: finite angle and radius required')
  }
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
}

export function clamp01(t) {
  return clamp(t, 0, 1)
}
