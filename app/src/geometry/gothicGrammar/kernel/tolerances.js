/**
 * Scale-aware numerical tolerances for the Gothic Grammar kernel.
 * 1 world unit = 1 meter (Step 12A). Absolute floors protect near-origin work;
 * relative terms scale with feature size.
 */

export const ABS_EPS = 1e-9
export const REL_EPS = 1e-9
export const ANGLE_EPS = 1e-10

/** Absolute + relative hybrid: ε = abs + rel · scale */
export function eps(scale = 1) {
  const s = Math.abs(scale)
  return ABS_EPS + REL_EPS * (s > 1 ? s : 1)
}

export function nearlyEqual(a, b, scale = 1) {
  return Math.abs(a - b) <= eps(scale)
}

export function nearlyZero(v, scale = 1) {
  return Math.abs(v) <= eps(scale)
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

/** Normalize angle to (-π, π]. */
export function normalizeAngle(a) {
  let x = a
  const twoPi = Math.PI * 2
  x = ((x % twoPi) + twoPi) % twoPi
  if (x > Math.PI) x -= twoPi
  return x
}

/** Normalize angle to [0, 2π). */
export function normalizeAngle0(a) {
  const twoPi = Math.PI * 2
  return ((a % twoPi) + twoPi) % twoPi
}
