/**
 * Tracery shapes for the Step 48 typologies. Source:
 * gothic_tracery_mathematics_analysis.md §2, §5, §7; REF-005 (flamboyant
 * mouchettes / soufflets), REF-011 (rose geometry), REF-012 (gallery).
 *
 * Every shape is circles and arcs with explicit tangency; each solver returns
 * residuals so the validator proves the construction.
 */

import { sampleArcBetween } from './construct2d.js'

const TAU = Math.PI * 2
const pt = (x, y) => ({ x, y })
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

export function circlePoints2(c, r, n = 36) {
  const out = []
  for (let i = 0; i <= n; i += 1) out.push(pt(c.x + r * Math.cos((TAU * i) / n), c.y + r * Math.sin((TAU * i) / n)))
  return out
}

/** Bisection root of f on [lo, hi] (f changes sign), or null. */
export function bisectRoot(f, lo, hi, iters = 70) {
  let flo = f(lo)
  const fhi = f(hi)
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) return null
  for (let i = 0; i < iters; i += 1) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (fm * flo > 0) {
      lo = mid
      flo = fm
    } else hi = mid
  }
  return (lo + hi) / 2
}

/**
 * Vesica / soufflet: a lens of two equal arcs through the tips (0, ±A) along
 * its axis, half-width B. R = (A² + B²) / 2B, centres (±(R − B), 0).
 * `rot` turns the axis from vertical; returns outline + arc data.
 */
export function vesica(center, A, B, rot = 0, n = 14) {
  const R = (A * A + B * B) / (2 * B)
  const c = R - B
  const cr = Math.cos(rot)
  const sr = Math.sin(rot)
  const T = (p) => pt(center.x + p.x * cr - p.y * sr, center.y + p.x * sr + p.y * cr)
  const right = sampleArcBetween(pt(-c, 0), R, pt(0, -A), pt(0, A), n).map(T)
  const left = sampleArcBetween(pt(c, 0), R, pt(0, A), pt(0, -A), n).map(T)
  return {
    outline: right.concat(left.slice(1)),
    arcs: [right, left],
    R,
    centres: [T(pt(-c, 0)), T(pt(c, 0))],
    tips: [T(pt(0, -A)), T(pt(0, A))],
    residuals: [Math.abs(Math.hypot(c, A) - R), Math.abs(R - c - B)],
  }
}

/**
 * Mouchette (curved dagger, REF-005): head circle (O, r) and tail point T.
 * Each flank is a circle internally tangent to the head at O + r·u and passing
 * through T: centre Q = O − t·u, radius r + t,
 *   t = (r² − |w|²) / 2(w·u − r),   w = T − O.
 * The two flank directions u straddle the head–tail axis; `curl` rotates
 * both, so one flank lengthens and the dagger curves (a mouchette).
 */
export function mouchette(O, r, T, curl = 0.35, n = 12) {
  const w = pt(T.x - O.x, T.y - O.y)
  const ax = Math.atan2(-w.y, -w.x) // from the tail through the head
  const flanks = []
  const residuals = []
  // Flank directions open 0.5 rad back from the perpendicular; |curl| < 0.45 keeps
  // both flank directions turned away from the tail (w·u < r), so t > 0 always.
  const cu = Math.max(-0.42, Math.min(0.42, curl))
  for (const side of [1, -1]) {
    const ang = ax + side * (Math.PI / 2 - 0.5) + cu
    const u = pt(Math.cos(ang), Math.sin(ang))
    const t = (r * r - (w.x * w.x + w.y * w.y)) / (2 * (w.x * u.x + w.y * u.y - r))
    if (!(t > 0)) return null
    const Q = pt(O.x - t * u.x, O.y - t * u.y)
    const tp = pt(O.x + r * u.x, O.y + r * u.y)
    flanks.push({ Q, R: r + t, tp, u })
    residuals.push(Math.abs(d2(Q, O) - t), Math.abs(d2(Q, T) - (r + t)))
  }
  // Outline: tail → flank 1 → its tangent point → head arc (the far side) → flank 2 tangent point → tail.
  const f1 = sampleArcBetween(flanks[0].Q, flanks[0].R, T, flanks[0].tp, n)
  const a0 = Math.atan2(flanks[0].tp.y - O.y, flanks[0].tp.x - O.x)
  const a1 = Math.atan2(flanks[1].tp.y - O.y, flanks[1].tp.x - O.x)
  // Head arc: the side away from the tail.
  let s = a1 - a0
  while (s <= 0) s += TAU
  const mid = a0 + s / 2
  if (Math.cos(mid - Math.atan2(-w.y, -w.x)) < 0) s -= TAU
  const head = []
  for (let i = 0; i <= n; i += 1) head.push(pt(O.x + r * Math.cos(a0 + (s * i) / n), O.y + r * Math.sin(a0 + (s * i) / n)))
  const f2 = sampleArcBetween(flanks[1].Q, flanks[1].R, flanks[1].tp, T, n)
  return { outline: f1.concat(head.slice(1), f2.slice(1)), head: { O, r }, tail: T, flanks, residuals }
}

/**
 * Reverse curve (ogee S) from P0 to P1 with vertical tangents at both ends:
 * two arcs of equal radius tangent at the midpoint M (centres collinear with M):
 *   R = ((xm − x0)² + (ym − y0)²) / 2(xm − x0),  C1 = (x0 + R, y0), C2 = (x1 − R, y1).
 */
export function reverseCurve(P0, P1, n = 10) {
  const M = pt((P0.x + P1.x) / 2, (P0.y + P1.y) / 2)
  const dx = M.x - P0.x
  if (Math.abs(dx) < 1e-6) return { points: [P0, P1], residuals: [0] }
  const R = (dx * dx + (M.y - P0.y) ** 2) / (2 * dx)
  const C1 = pt(P0.x + R, P0.y)
  const C2 = pt(P1.x - R, P1.y)
  const a = sampleArcBetween(C1, Math.abs(R), P0, M, n)
  const b = sampleArcBetween(C2, Math.abs(R), M, P1, n)
  return { points: a.concat(b.slice(1)), residuals: [Math.abs(d2(C1, M) - Math.abs(R)), Math.abs(d2(C2, M) - Math.abs(R)), Math.abs(d2(C1, C2) - 2 * Math.abs(R))] }
}

/**
 * Circle on a ray from `origin` along unit `dir`, internally tangent to the
 * circle (Cout, Rout) and externally tangent to (Cin, Rin):
 *   r(D) = Rout − |P(D) − Cout|,   g(D) = |P(D) − Cin| − (Rin + r(D)) = 0.
 */
export function circleBetween(origin, dir, Cout, Rout, Cin, Rin, Dlo, Dhi) {
  const P = (D) => pt(origin.x + dir.x * D, origin.y + dir.y * D)
  const r = (D) => Rout - d2(P(D), Cout)
  const g = (D) => d2(P(D), Cin) - (Rin + r(D))
  const D = bisectRoot(g, Dlo, Dhi)
  if (D == null) return null
  const c = P(D)
  const rr = r(D)
  if (!(rr > 1e-4)) return null
  return { center: c, radius: rr, residuals: [Math.abs(d2(c, Cout) - (Rout - rr)), Math.abs(d2(c, Cin) - (Rin + rr))] }
}

/**
 * Circle internally tangent to three circles (C_i, R_i) (spherical-triangle
 * window): |O − C_i| + r = R_i for i = 1..3 → Newton on O (2 unknowns,
 * 2 independent differences), r from the first equation.
 */
export function circleInsideThree(circles, guess) {
  let O = { ...guess }
  const F = (p) => {
    const e = circles.map((c) => c.R - d2(p, c.c))
    return [e[0] - e[1], e[0] - e[2]]
  }
  for (let it = 0; it < 60; it += 1) {
    const f = F(O)
    if (Math.hypot(f[0], f[1]) < 1e-12) break
    const h = 1e-6
    const fx = F(pt(O.x + h, O.y))
    const fy = F(pt(O.x, O.y + h))
    const J = [
      [(fx[0] - f[0]) / h, (fy[0] - f[0]) / h],
      [(fx[1] - f[1]) / h, (fy[1] - f[1]) / h],
    ]
    const det = J[0][0] * J[1][1] - J[0][1] * J[1][0]
    if (Math.abs(det) < 1e-14) break
    O = pt(O.x - (J[1][1] * f[0] - J[0][1] * f[1]) / det, O.y - (-J[1][0] * f[0] + J[0][0] * f[1]) / det)
  }
  const r = circles[0].R - d2(O, circles[0].c)
  if (!(r > 1e-4)) return null
  return { center: O, radius: r, residuals: circles.map((c) => Math.abs(d2(O, c.c) + r - c.R)) }
}
