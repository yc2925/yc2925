/**
 * Curve signature (Step 48): measurable qualities of a drawn curve that the
 * typology chooser (typology.js) reads. Pure geometry on the resampled
 * polyline (~0.5 m stations), no randomness — the same curve always gets the
 * same signature, so the same curve always becomes the same kind of building.
 *
 *  closed       ends meet (gap < max(1 m, 8 % of length))
 *  plane        best-fit plane (covariance / Jacobi eigen-decomposition):
 *               normal, in-plane axes, flatness = λmin / λmax
 *  upright      plane is vertical (|n·up| < 0.35) · horizontal: |n·up| > 0.8
 *  rise         arch test numbers: chord, half-span a, rise h, h/a, up-component
 *  inflections  sign changes of the in-plane curvature (with hysteresis)
 *  curvatureCV  std / mean of |curvature| (≈ 0 for a circle)
 *  turning      total turning angle in the plane (rad)
 *  corners      sharp turns (> 50° within ~1.5 m)
 *  symmetry     left/right height mismatch of an arch (0 = mirror symmetric)
 *  endDrop      height difference of the ends / chord
 *  verticality  |chord·up| / chord · straightness: chord / length
 *  helix        winds ≥ 1.4 turns around a vertical axis while rising
 *  roundness    std / mean of the distance to the centroid (closed curves)
 *  aspect       √(λ1 / λ2) of the in-plane spread (closed curves)
 */

import { UP, dist, dot, norm, sub, v3, add, scale, cross } from '../curves/curve3.js'

const GROUND = 0.35

/** Symmetric 3×3 eigen-decomposition (cyclic Jacobi). Returns values desc + vectors. */
export function eigen3(m) {
  const a = m.map((r) => r.slice())
  const V = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]
  for (let sweep = 0; sweep < 40; sweep += 1) {
    let off = 0
    for (let p = 0; p < 3; p += 1) for (let q = p + 1; q < 3; q += 1) off += a[p][q] * a[p][q]
    if (off < 1e-18) break
    for (let p = 0; p < 3; p += 1) {
      for (let q = p + 1; q < 3; q += 1) {
        if (Math.abs(a[p][q]) < 1e-14) continue
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q])
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1))
        const c = 1 / Math.sqrt(t * t + 1)
        const s = t * c
        for (let k = 0; k < 3; k += 1) {
          const akp = a[k][p]
          const akq = a[k][q]
          a[k][p] = c * akp - s * akq
          a[k][q] = s * akp + c * akq
        }
        for (let k = 0; k < 3; k += 1) {
          const apk = a[p][k]
          const aqk = a[q][k]
          a[p][k] = c * apk - s * aqk
          a[q][k] = s * apk + c * aqk
        }
        for (let k = 0; k < 3; k += 1) {
          const vkp = V[k][p]
          const vkq = V[k][q]
          V[k][p] = c * vkp - s * vkq
          V[k][q] = s * vkp + c * vkq
        }
      }
    }
  }
  const out = [0, 1, 2].map((i) => ({ value: a[i][i], vector: v3(V[0][i], V[1][i], V[2][i]) }))
  out.sort((x, y) => y.value - x.value)
  return out
}

/** Best-fit plane: centroid, normal, major / minor in-plane axes and spreads. */
export function fitPlane(points) {
  const n = points.length
  const c = points.reduce((s, p) => add(s, p), v3(0, 0, 0))
  const C = scale(c, 1 / n)
  const m = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  for (const p of points) {
    const d = [p.x - C.x, p.y - C.y, p.z - C.z]
    for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) m[i][j] += (d[i] * d[j]) / n
  }
  const e = eigen3(m)
  return { center: C, major: norm(e[0].vector), minor: norm(e[1].vector), normal: norm(e[2].vector), spread: e.map((x) => Math.max(0, x.value)) }
}

/** Frame of a plane whose "up" axis is world up projected into it (falls back to the major axis). */
export function planeFrame(plane) {
  const n = plane.normal
  let up = sub(UP, scale(n, dot(UP, n)))
  const l = Math.hypot(up.x, up.y, up.z)
  up = l > 0.3 ? scale(up, 1 / l) : plane.minor
  const side = norm(cross(up, n))
  return { origin: plane.center, u: side, v: up, n }
}

/** Kåsa algebraic circle fit of 2D points (exact least squares on x² + y² + Dx + Ey + F = 0). */
export function fitCircle2(pts) {
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  let sz = 0
  let sxz = 0
  let syz = 0
  for (const p of pts) {
    const z = p.x * p.x + p.y * p.y
    sx += p.x
    sy += p.y
    sxx += p.x * p.x
    syy += p.y * p.y
    sxy += p.x * p.y
    sz += z
    sxz += p.x * z
    syz += p.y * z
  }
  const n = pts.length
  // Normal equations for [D, E, F]: solve 3×3 by Cramer's rule.
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ]
  const b = [-sxz, -syz, -sz]
  const det3 = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0])
  const D0 = det3(A)
  if (Math.abs(D0) < 1e-12) return null
  const col = (k) => A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)))
  const D = det3(col(0)) / D0
  const E = det3(col(1)) / D0
  const F = det3(col(2)) / D0
  const cx = -D / 2
  const cy = -E / 2
  const r2 = cx * cx + cy * cy - F
  if (!(r2 > 0)) return null
  return { center: { x: cx, y: cy }, radius: Math.sqrt(r2) }
}

function pathLength(points) {
  let L = 0
  for (let i = 1; i < points.length; i += 1) L += dist(points[i - 1], points[i])
  return L
}

/** Signed curvature of a 2D polyline at interior stations (turn angle / mean segment). */
function curvature2(p2) {
  const k = []
  for (let i = 1; i < p2.length - 1; i += 1) {
    const a = { x: p2[i].x - p2[i - 1].x, y: p2[i].y - p2[i - 1].y }
    const b = { x: p2[i + 1].x - p2[i].x, y: p2[i + 1].y - p2[i].y }
    const la = Math.hypot(a.x, a.y)
    const lb = Math.hypot(b.x, b.y)
    if (la < 1e-9 || lb < 1e-9) {
      k.push(0)
      continue
    }
    const turn = Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y)
    k.push(turn / ((la + lb) / 2))
  }
  return k
}

export function curveSignature(points) {
  const n = points.length
  const L = pathLength(points)
  const A = points[0]
  const B = points[n - 1]
  const gap = dist(A, B)
  const closed = n > 6 && gap < Math.max(1, 0.08 * L)
  const ys = points.map((p) => p.y)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const plane = fitPlane(points)
  const flatness = plane.spread[0] > 1e-9 ? plane.spread[2] / plane.spread[0] : 0
  const nUp = Math.abs(plane.normal.y)
  const frame = planeFrame(plane)
  const p2 = points.map((p) => {
    const d = sub(p, frame.origin)
    return { x: dot(d, frame.u), y: dot(d, frame.v) }
  })

  // Curvature analysis: smooth over ±2 stations, then hysteresis sign changes.
  const kRaw = curvature2(p2)
  const k = kRaw.map((_, i) => {
    let s = 0
    let c = 0
    for (let j = Math.max(0, i - 2); j <= Math.min(kRaw.length - 1, i + 2); j += 1) {
      s += kRaw[j]
      c += 1
    }
    return s / c
  })
  const absK = k.map(Math.abs)
  const meanK = absK.reduce((s, v) => s + v, 0) / Math.max(1, absK.length)
  const sdK = Math.sqrt(absK.reduce((s, v) => s + (v - meanK) ** 2, 0) / Math.max(1, absK.length))
  const curvatureCV = meanK > 1e-6 ? sdK / meanK : 0
  // Median, not mean: one sharp apex (a spike) must not hide gentle reverse bends.
  const sortedK = absK.slice().sort((x, y) => x - y)
  const medianK = sortedK.length ? sortedK[Math.floor(sortedK.length / 2)] : 0
  const thresh = Math.max(0.02, medianK * 0.35)
  let sign = 0
  const flips = []
  k.forEach((v, i) => {
    if (Math.abs(v) < thresh) return
    const s = Math.sign(v)
    if (sign !== 0 && s !== sign) flips.push(i + 1)
    sign = s
  })
  const turning = kRaw.reduce((s, v, i) => s + v * ((dist(points[i], points[i + 1]) + dist(points[i + 1], points[i + 2])) / 2), 0)
  const turningAbs = kRaw.reduce((s, v, i) => s + Math.abs(v) * ((dist(points[i], points[i + 1]) + dist(points[i + 1], points[i + 2])) / 2), 0)

  // Corners: turn > 50° within a ~1.5 m window (3 stations either side).
  let corners = 0
  const w = 3
  for (let i = w; i < n - w; i += 1) {
    const a = norm(sub(points[i], points[i - w]))
    const b = norm(sub(points[i + w], points[i]))
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
    if (ang > (50 * Math.PI) / 180) {
      corners += 1
      i += 2 * w
    }
  }
  if (closed) {
    const a = norm(sub(points[0], points[n - 1 - w]))
    const b = norm(sub(points[w], points[0]))
    if (Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) > (50 * Math.PI) / 180) corners += 1
  }

  // Arch numbers (same construction as the classic arch test).
  const chord = sub(B, A)
  const Lc = Math.hypot(chord.x, chord.y, chord.z)
  let h = 0
  let perpBest = null
  let apexIndex = 0
  if (Lc > 1e-6) {
    const e1 = scale(chord, 1 / Lc)
    points.forEach((p, i) => {
      const wv = sub(p, A)
      const perp = sub(wv, scale(e1, dot(wv, e1)))
      const l = Math.hypot(perp.x, perp.y, perp.z)
      if (l > h) {
        h = l
        perpBest = perp
        apexIndex = i
      }
    })
  }
  const a = Lc / 2
  const riseRatio = a > 1e-6 ? h / a : 0
  const riseUp = perpBest && h > 1e-6 ? perpBest.y / h : 0
  // Symmetry: compare heights at mirrored chord fractions (0 = mirror symmetric).
  let symmetry = 0
  if (Lc > 1e-6 && h > 1e-6) {
    const e1 = scale(chord, 1 / Lc)
    const prof = points.map((p) => {
      const wv = sub(p, A)
      const t = dot(wv, e1) / Lc
      const perp = sub(wv, scale(e1, dot(wv, e1)))
      return { t, h: Math.hypot(perp.x, perp.y, perp.z) / h }
    })
    const at = (t) => {
      let best = prof[0]
      for (const q of prof) if (Math.abs(q.t - t) < Math.abs(best.t - t)) best = q
      return best.h
    }
    let s = 0
    for (let i = 1; i < 10; i += 1) s += Math.abs(at(i / 20) - at(1 - i / 20))
    symmetry = s / 9
  }
  // Inflections near the apex on both sides → ogee.
  const apexFrac = apexIndex / Math.max(1, n - 1)
  const nearApex = flips.filter((i) => Math.abs(i / (n - 1) - apexFrac) < 0.3).length

  // Helix: winding of the plan projection around its centroid while rising.
  const cx = points.reduce((s, p) => s + p.x, 0) / n
  const cz = points.reduce((s, p) => s + p.z, 0) / n
  let wind = 0
  for (let i = 1; i < n; i += 1) {
    const a0 = Math.atan2(points[i - 1].z - cz, points[i - 1].x - cx)
    const a1 = Math.atan2(points[i].z - cz, points[i].x - cx)
    let d = a1 - a0
    while (d > Math.PI) d -= 2 * Math.PI
    while (d < -Math.PI) d += 2 * Math.PI
    wind += d
  }
  const rise = Math.abs(B.y - A.y)
  const helix = !closed && Math.abs(wind) > 1.4 * 2 * Math.PI && rise > 2 && flatness > 0.04

  // Closed-curve shape: roundness (radius spread) and aspect.
  const rs = p2.map((p) => Math.hypot(p.x, p.y))
  const meanR = rs.reduce((s, v) => s + v, 0) / n
  const roundness = meanR > 1e-6 ? Math.sqrt(rs.reduce((s, v) => s + (v - meanR) ** 2, 0) / n) / meanR : 1
  const aspect = plane.spread[1] > 1e-9 ? Math.sqrt(plane.spread[0] / plane.spread[1]) : 99

  return {
    length: L,
    closed,
    gap,
    minY,
    maxY,
    onGround: minY <= GROUND,
    endsGrounded: A.y <= GROUND && B.y <= GROUND,
    plane,
    frame,
    flatness,
    upright: nUp < 0.35,
    horizontal: nUp > 0.8,
    chord: Lc,
    a,
    h,
    riseRatio,
    riseUp,
    apexFrac,
    inflections: flips.length,
    apexInflections: nearApex,
    curvatureCV,
    meanCurvature: meanK,
    turning,
    turningAbs,
    corners,
    symmetry,
    endDrop: Lc > 1e-6 ? Math.abs(A.y - B.y) / Lc : 0,
    verticality: Lc > 1e-6 ? Math.abs(chord.y) / Lc : 0,
    straightness: L > 1e-6 ? Lc / L : 0,
    wind,
    rise,
    helix,
    roundness,
    meanRadius: meanR,
    aspect,
    controlPoints: 0,
  }
}
