/**
 * 3D curve math for user-drawn spatial curves (Step 47, Phase A2).
 *
 * - vec3 helpers (plain {x,y,z}, no Three dependency → usable in workers / node)
 * - Centripetal Catmull-Rom (α = 0.5: no cusps or self-loops between controls)
 * - Polyline
 * - Arc-length resampling
 * - Rotation-minimising frames by double reflection (Wang et al. 2008):
 *   no flips on space curves; initial side vector = up × tangent.
 * - Signed horizontal curvature κ(s) (turning rate in XZ, + = left turn).
 */

export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z })
export const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z)
export const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z)
export const scale = (a, s) => v3(a.x * s, a.y * s, a.z * s)
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z
export const cross = (a, b) => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x)
export const len = (a) => Math.hypot(a.x, a.y, a.z)
export const dist = (a, b) => len(sub(a, b))
export const lerp3 = (a, b, t) => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
export function norm(a, fallback = v3(1, 0, 0)) {
  const l = len(a)
  return l > 1e-12 ? scale(a, 1 / l) : { ...fallback }
}
export const UP = Object.freeze(v3(0, 1, 0))

/** Remove consecutive duplicate control points (zero-length segments). */
export function dedupe(points, eps = 1e-6) {
  const out = []
  for (const p of points) if (!out.length || dist(out[out.length - 1], p) > eps) out.push(p)
  return out
}

function catmullRomSegment(p0, p1, p2, p3, steps, out) {
  // Centripetal parameterisation (Barry–Goldman pyramidal formulation).
  const alpha = 0.5
  const tj = (ti, a, b) => ti + Math.max(dist(a, b), 1e-6) ** alpha
  const t0 = 0
  const t1 = tj(t0, p0, p1)
  const t2 = tj(t1, p1, p2)
  const t3 = tj(t2, p2, p3)
  for (let i = 0; i < steps; i += 1) {
    const t = t1 + ((t2 - t1) * i) / steps
    const a1 = lerp3(p0, p1, (t - t0) / (t1 - t0))
    const a2 = lerp3(p1, p2, (t - t1) / (t2 - t1))
    const a3 = lerp3(p2, p3, (t - t2) / (t3 - t2))
    const b1 = lerp3(a1, a2, (t - t0) / (t2 - t0))
    const b2 = lerp3(a2, a3, (t - t1) / (t3 - t1))
    out.push(lerp3(b1, b2, (t - t1) / (t2 - t1)))
  }
}

/**
 * Dense polyline through/along the control points.
 * @returns {{points: Array, length: number}}
 */
export function evaluateCurve(curve, stepsPerSegment = 16) {
  const cps = dedupe(curve.controlPoints ?? [])
  if (cps.length < 2) return { points: cps.slice(), length: 0 }
  const closed = Boolean(curve.closed) && cps.length >= 3
  let points
  if (curve.curveType === 'polyline') {
    points = closed ? [...cps, cps[0]] : cps.slice()
  } else {
    points = []
    const n = cps.length
    const at = (i) => {
      if (closed) return cps[((i % n) + n) % n]
      if (i < 0) return sub(scale(cps[0], 2), cps[1]) // reflected phantom
      if (i >= n) return sub(scale(cps[n - 1], 2), cps[n - 2])
      return cps[i]
    }
    const segs = closed ? n : n - 1
    for (let i = 0; i < segs; i += 1) catmullRomSegment(at(i - 1), at(i), at(i + 1), at(i + 2), stepsPerSegment, points)
    points.push(closed ? cps[0] : cps[n - 1])
  }
  let length = 0
  for (let i = 1; i < points.length; i += 1) length += dist(points[i - 1], points[i])
  return { points, length }
}

/** Cumulative arc length table. */
export function arcLengths(points) {
  const s = [0]
  for (let i = 1; i < points.length; i += 1) s.push(s[i - 1] + dist(points[i - 1], points[i]))
  return s
}

/** Point at arc length `target` on a polyline with precomputed table. */
export function pointAtLength(points, table, target) {
  const total = table[table.length - 1]
  const s = Math.min(Math.max(target, 0), total)
  let lo = 0
  let hi = table.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (table[mid] <= s) lo = mid
    else hi = mid
  }
  const span = table[hi] - table[lo]
  return lerp3(points[lo], points[hi], span > 0 ? (s - table[lo]) / span : 0)
}

/** Resample to `count` points equally spaced in arc length (count ≥ 2). */
export function resampleByCount(points, count) {
  const table = arcLengths(points)
  const total = table[table.length - 1]
  const out = []
  for (let i = 0; i < count; i += 1) out.push(pointAtLength(points, table, (total * i) / (count - 1)))
  return out
}

/**
 * Rotation-minimising frames by double reflection.
 * Each frame: { p, t (tangent), side (horizontal-ish normal, + = left), up }.
 */
export function rotationMinimisingFrames(points) {
  const n = points.length
  if (n < 2) return []
  const tangents = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)]
    const b = points[Math.min(n - 1, i + 1)]
    return norm(sub(b, a))
  })
  // Initial side: up × t (left of travel when seen from above). Vertical start → +X fallback.
  let side = norm(cross(UP, tangents[0]), v3(1, 0, 0))
  const frames = [{ p: points[0], t: tangents[0], side, up: norm(cross(tangents[0], side)) }]
  for (let i = 0; i < n - 1; i += 1) {
    const v1 = sub(points[i + 1], points[i])
    const c1 = dot(v1, v1)
    if (c1 < 1e-18) {
      frames.push({ ...frames[i], p: points[i + 1] })
      continue
    }
    const rL = sub(side, scale(v1, (2 / c1) * dot(v1, side)))
    const tL = sub(tangents[i], scale(v1, (2 / c1) * dot(v1, tangents[i])))
    const v2 = sub(tangents[i + 1], tL)
    const c2 = dot(v2, v2)
    side = c2 < 1e-18 ? rL : sub(rL, scale(v2, (2 / c2) * dot(v2, rL)))
    side = norm(side)
    const t = tangents[i + 1]
    frames.push({ p: points[i + 1], t, side, up: norm(cross(t, side)) })
  }
  return frames
}

/**
 * Signed curvature per frame (1/m): κ = (dT/ds) · side.
 * Positive = turning toward `side` (left of travel seen from above).
 */
export function signedCurvature(frames) {
  const n = frames.length
  const k = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i += 1) {
    const ds = dist(frames[i - 1].p, frames[i + 1].p)
    if (ds < 1e-9) continue
    k[i] = dot(sub(frames[i + 1].t, frames[i - 1].t), frames[i].side) / ds
  }
  if (n > 2) {
    k[0] = k[1]
    k[n - 1] = k[n - 2]
  }
  return k
}
