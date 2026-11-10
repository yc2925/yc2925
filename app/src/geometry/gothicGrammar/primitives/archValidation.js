/**
 * Validation for two-centered pointed arches.
 */

import { distance, nearlyEqualPoints } from '../kernel/vector2.js'
import { startPoint, endPoint, pointAt as arcPointAt } from '../kernel/arc2.js'
import { eps, nearlyEqual, nearlyZero } from '../kernel/tolerances.js'
import { EQUILATERAL_RISE_RATIO, ARCH_FAMILIES, ARCH_SEMANTICS } from './archFamilies.js'

/**
 * @param {object} arch — result from buildPointedArch (without requiring prior validation)
 */
export function validatePointedArch(arch) {
  const errors = []
  const warnings = []
  const p = arch.parameters
  const d = arch.derived
  const pts = arch.points
  const arcs = arch.arcs
  const scale = Math.max(1, p?.span ?? 1, d?.radius ?? 1)
  const tol = eps(scale) * 20

  if (!(p?.span > 0)) errors.push('span must be positive')
  if (!(p?.rise > 0)) errors.push('rise must be positive')
  if (!(d?.radius > 0)) errors.push('radius must be positive')

  const A = pts?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = pts?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = pts?.[ARCH_SEMANTICS.APEX]
  const CA = pts?.[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const CB = pts?.[ARCH_SEMANTICS.RIGHT_ARC_CENTER]
  const left = arcs?.[ARCH_SEMANTICS.LEFT_ARC]
  const right = arcs?.[ARCH_SEMANTICS.RIGHT_ARC]

  if (!A || !B || !P || !CA || !CB || !left || !right) {
    errors.push('missing semantic geometry')
    return { ok: false, errors, warnings }
  }

  // Radius equality to endpoints
  if (Math.abs(distance(CA, A) - d.radius) > tol) errors.push('LEFT: C_A–A ≠ R')
  if (Math.abs(distance(CA, P) - d.radius) > tol) errors.push('LEFT: C_A–P ≠ R')
  if (Math.abs(distance(CB, B) - d.radius) > tol) errors.push('RIGHT: C_B–B ≠ R')
  if (Math.abs(distance(CB, P) - d.radius) > tol) errors.push('RIGHT: C_B–P ≠ R')

  // Exact springing / apex endpoints of arcs
  if (!nearlyEqualPoints(startPoint(left), A, scale)) errors.push('left arc does not start at A')
  if (!nearlyEqualPoints(endPoint(left), P, scale)) errors.push('left arc does not end at P')
  if (!nearlyEqualPoints(startPoint(right), P, scale)) errors.push('right arc does not start at P')
  if (!nearlyEqualPoints(endPoint(right), B, scale)) errors.push('right arc does not end at B')

  // Join at apex
  if (distance(endPoint(left), startPoint(right)) > tol) errors.push('arcs do not meet at apex')

  // Mirror symmetry across x = offset
  const ox = p.offsetX ?? 0
  if (Math.abs(A.x + B.x - 2 * ox) > tol) errors.push('springings not symmetric')
  if (Math.abs(CA.x + CB.x - 2 * ox) > tol) errors.push('centers not symmetric')
  if (Math.abs(P.x - ox) > tol) errors.push('apex not on symmetry axis')

  // Minor sweeps (not major arcs)
  if (Math.abs(left.sweepAngle) > Math.PI + 1e-9) errors.push('left arc is major (unexpected)')
  if (Math.abs(right.sweepAngle) > Math.PI + 1e-9) errors.push('right arc is major (unexpected)')

  // Upper arch: midpoints above springing
  const midL = arcPointAt(left, 0.5)
  const midR = arcPointAt(right, 0.5)
  if (midL.y < p.springingY - tol) errors.push('left arc midpoint below springing')
  if (midR.y < p.springingY - tol) errors.push('right arc midpoint below springing')

  // Samples on defining circles
  for (const s of arch.samples?.left ?? []) {
    if (Math.abs(distance(s, CA) - d.radius) > tol * 5) {
      errors.push('left sample off circle')
      break
    }
    if (s.y < p.springingY - tol * 5) {
      errors.push('left sample below springing')
      break
    }
  }
  for (const s of arch.samples?.right ?? []) {
    if (Math.abs(distance(s, CB) - d.radius) > tol * 5) {
      errors.push('right sample off circle')
      break
    }
  }

  // Equilateral lock
  if (p.family === ARCH_FAMILIES.equilateral) {
    if (!nearlyEqual(p.riseRatio, EQUILATERAL_RISE_RATIO, 1)) {
      errors.push('equilateral rise ratio not √3/2')
    }
    // Centers at opposite springings
    if (!nearlyEqualPoints(CA, B, scale)) errors.push('equilateral: C_A should coincide with B')
    if (!nearlyEqualPoints(CB, A, scale)) errors.push('equilateral: C_B should coincide with A')
  }

  // Family rise ordering vs equilateral
  if (p.family === ARCH_FAMILIES.lancet && !(p.riseRatio > EQUILATERAL_RISE_RATIO)) {
    errors.push('lancet rise must exceed equilateral')
  }
  if (p.family === ARCH_FAMILIES.depressed && !(p.riseRatio < EQUILATERAL_RISE_RATIO)) {
    errors.push('depressed rise must be below equilateral')
  }

  // Finite coordinates
  const finitePts = [A, B, P, CA, CB, midL, midR]
  if (finitePts.some((q) => !Number.isFinite(q.x) || !Number.isFinite(q.y))) {
    errors.push('non-finite coordinates')
  }

  // Apex cusp: tangents need not match — warn only if accidentally smooth (rare)
  // Deliberate cusp: for equilateral/lancet, inward normals differ — no error required.

  if (nearlyZero(Math.abs(left.sweepAngle) - Math.abs(right.sweepAngle), 1)) {
    // expected for symmetric construction
  } else {
    warnings.push('left/right sweep magnitudes differ (unexpected for symmetric arch)')
  }

  return { ok: errors.length === 0, errors, warnings }
}

/**
 * Residual report for UI / tests.
 */
export function archConstraintResiduals(arch) {
  return { ...(arch.residuals ?? {}) }
}
