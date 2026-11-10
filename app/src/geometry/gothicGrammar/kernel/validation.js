/**
 * Finite-coordinate and degeneracy checks.
 */

import { nearlyZero, eps } from './tolerances.js'

export function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

export function assertFinitePoint(p, label = 'point') {
  if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y)) {
    throw new Error(`${label}: non-finite coordinates`)
  }
  return true
}

export function isFinitePoint(p) {
  return !!(p && isFiniteNumber(p.x) && isFiniteNumber(p.y))
}

export function assertPositiveRadius(r, label = 'radius') {
  if (!isFiniteNumber(r) || r <= 0) {
    throw new Error(`${label}: must be a positive finite number`)
  }
  return true
}

export function rejectNaNPoint(p) {
  if (!isFinitePoint(p)) return null
  return { x: p.x, y: p.y }
}

export function validateNonZeroVector(v, scale = 1) {
  if (!isFinitePoint(v)) return { ok: false, reason: 'non_finite' }
  const lenSq = v.x * v.x + v.y * v.y
  if (nearlyZero(Math.sqrt(lenSq), scale) || lenSq <= eps(scale) * eps(scale)) {
    return { ok: false, reason: 'zero_length' }
  }
  return { ok: true, length: Math.sqrt(lenSq) }
}
