/**
 * Surface-local orthonormal frames for growth anchors (13E.4).
 */

import { COMPONENT_TYPES, SURFACE_TYPES } from '../surfaceSemanticsTypes.js'
import { cross3, dot3, normalize3, scale3, sub3 } from './types.js'

/**
 * Choose a stable preferred "up" / primary tangent hint from component + surface.
 * @returns {[number,number,number]}
 */
export function preferredTangentHint(componentType, surfaceType, worldNormal) {
  const n = normalize3(worldNormal)
  // Vertical piers / shafts / buttresses → grow along +Y
  if (
    componentType === COMPONENT_TYPES.PIER_CORE ||
    componentType === COMPONENT_TYPES.ENGAGED_SHAFT ||
    componentType === COMPONENT_TYPES.BUTTRESS ||
    componentType === COMPONENT_TYPES.BUTTRESS_STAGE ||
    componentType === COMPONENT_TYPES.PIER_BASE
  ) {
    return [0, 1, 0]
  }
  // Capitals / sills → horizontal along facade (±X)
  if (
    componentType === COMPONENT_TYPES.CAPITAL ||
    componentType === COMPONENT_TYPES.SILL ||
    componentType === COMPONENT_TYPES.BASE_COURSE
  ) {
    return [1, 0, 0]
  }
  // Outer arch / intrados → follow arch curve (approximate with Y then X)
  if (
    componentType === COMPONENT_TYPES.OUTER_ARCH ||
    surfaceType === SURFACE_TYPES.INTRADOS ||
    surfaceType === SURFACE_TYPES.EXTRADOS
  ) {
    // Prefer tangent in the plane of the facade (XY), orthogonal to N
    const hint = Math.abs(n[1]) < 0.85 ? [0, 1, 0] : [1, 0, 0]
    return hint
  }
  // Tracery bars — along member (prefer Y for vertical mullions)
  if (
    componentType === COMPONENT_TYPES.PRIMARY_MULLION ||
    componentType === COMPONENT_TYPES.SECONDARY_TRACERY ||
    componentType === COMPONENT_TYPES.TERTIARY_TRACERY ||
    componentType === COMPONENT_TYPES.FOIL
  ) {
    return Math.abs(n[1]) < 0.7 ? [0, 1, 0] : [1, 0, 0]
  }
  // Fallback: projected world +Y, else +X
  return Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]
}

/**
 * Build orthonormal frame { P, N, T, B } with right-handed basis (T × B ≈ N).
 * Degenerate normals / hints are handled explicitly.
 *
 * @param {object} opts
 * @param {[number,number,number]} opts.position
 * @param {[number,number,number]} opts.normal
 * @param {string} [opts.componentType]
 * @param {string} [opts.surfaceType]
 * @param {[number,number,number]} [opts.tangentHint]
 */
export function buildSurfaceFrame(opts = {}) {
  const P = opts.position ?? [0, 0, 0]
  let N = normalize3(opts.normal ?? [0, 0, 1])
  const nLen = Math.hypot(...(opts.normal ?? [0, 0, 1]))
  const degenerateNormal = !(nLen > 1e-9)
  if (degenerateNormal) {
    N = [0, 0, 1]
  }

  const hint =
    opts.tangentHint ??
    preferredTangentHint(opts.componentType, opts.surfaceType, N)

  // Project hint onto tangent plane
  let T = sub3(hint, scale3(N, dot3(hint, N)))
  let tLen = Math.hypot(...T)
  if (!(tLen > 1e-8)) {
    // Fallback projected world axis
    const alt = Math.abs(N[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
    T = sub3(alt, scale3(N, dot3(alt, N)))
    tLen = Math.hypot(...T)
  }
  if (!(tLen > 1e-8)) {
    // Last resort: pick any orthonormal partner
    T = Math.abs(N[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    T = sub3(T, scale3(N, dot3(T, N)))
    tLen = Math.hypot(...T)
  }
  T = normalize3(T)
  let B = normalize3(cross3(N, T))
  // Enforce right-handed: T × B should align with N
  const check = cross3(T, B)
  if (dot3(check, N) < 0) {
    B = scale3(B, -1)
  }
  // Re-orthogonalize T from B × N for numerical stability
  T = normalize3(cross3(B, N))

  return {
    position: P,
    normal: N,
    tangentU: T,
    tangentV: B,
    handedness: 'right',
    ok: !degenerateNormal && Math.abs(dot3(T, N)) < 1e-4 && Math.abs(dot3(B, N)) < 1e-4,
    degenerateNormal,
  }
}

/**
 * Validate orthonormality of an existing frame.
 */
export function validateSurfaceFrame(frame, eps = 1e-3) {
  const errors = []
  if (!frame) return { ok: false, errors: ['missing frame'] }
  const { normal: N, tangentU: T, tangentV: B } = frame
  const nLen = Math.hypot(...N)
  const tLen = Math.hypot(...T)
  const bLen = Math.hypot(...B)
  if (Math.abs(nLen - 1) > eps) errors.push('normal not unit')
  if (Math.abs(tLen - 1) > eps) errors.push('tangentU not unit')
  if (Math.abs(bLen - 1) > eps) errors.push('tangentV not unit')
  if (Math.abs(dot3(N, T)) > eps) errors.push('N·T not orthogonal')
  if (Math.abs(dot3(N, B)) > eps) errors.push('N·B not orthogonal')
  if (Math.abs(dot3(T, B)) > eps) errors.push('T·B not orthogonal')
  const handed = dot3(cross3(T, B), N)
  if (handed < 0.5) errors.push('handedness not right-handed')
  return { ok: errors.length === 0, errors, handednessDot: handed }
}
