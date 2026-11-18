/**
 * Exact 2D Gothic construction kernel for the curve world (Step 47, round 2).
 * Source: gothic_tracery_mathematics_analysis.md §2–§7; REF-006, REF-008, REF-011, REF-013.
 *
 * Only circles, lines and circular arcs. Every solved tangency returns its
 * residual so the validator can prove the construction (not just the look).
 *
 * Arch coordinates: x across the span (0 = arch axis), y up from the springing line.
 */

const TAU = Math.PI * 2

export const pt = (x, y) => ({ x, y })
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// ------------------------------------------------------------- arches (§3)

/**
 * Two-centred pointed arch. a = half-span, k = c/a (1 = equilateral, <1 drop,
 * >1 lancet), m = axis x, y0 = springing height.
 * Left arc: centre (m + c, y0), right arc: centre (m − c, y0), R = a + c.
 */
export function twoCentredArch(m, a, k, y0 = 0) {
  const c = k * a
  const R = a + c
  const h = Math.sqrt(Math.max(0, R * R - c * c))
  return {
    m,
    a,
    k,
    c,
    R,
    h,
    y0,
    left: { center: pt(m + c, y0), radius: R, from: pt(m - a, y0), to: pt(m, y0 + h) },
    right: { center: pt(m - c, y0), radius: R, from: pt(m, y0 + h), to: pt(m + a, y0) },
    apex: pt(m, y0 + h),
  }
}

/** Fit arch parameters to a chord half-length a and measured rise h. */
export function archFromRise(a, h) {
  const c = (h * h - a * a) / (2 * a)
  return { k: c / a, c, R: a + c }
}

/** Concentric offset of an arch (archivolt / inset): same centres, R ± δ. */
export function offsetArch(arch, delta) {
  return twoCentredArch(arch.m, arch.a + delta, (arch.c) / (arch.a + delta), arch.y0)
}

/** Sample an arc from point `from` to `to` on circle (centre, radius), short way through `via` side. */
export function sampleArcBetween(center, radius, from, to, n = 24, ccw = null) {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x)
  let a1 = Math.atan2(to.y - center.y, to.x - center.x)
  let sweep = a1 - a0
  if (ccw === true) while (sweep <= 0) sweep += TAU
  else if (ccw === false) while (sweep >= 0) sweep -= TAU
  else {
    while (sweep > Math.PI) sweep -= TAU
    while (sweep < -Math.PI) sweep += TAU
  }
  const out = []
  for (let i = 0; i <= n; i += 1) {
    const a = a0 + (sweep * i) / n
    out.push(pt(center.x + radius * Math.cos(a), center.y + radius * Math.sin(a)))
  }
  return out
}

/** Full arch outline (left springing → apex → right springing). */
export function sampleArch(arch, n = 20) {
  const L = sampleArcBetween(arch.left.center, arch.R, arch.left.from, arch.apex, n)
  const Rr = sampleArcBetween(arch.right.center, arch.R, arch.apex, arch.right.to, n)
  return L.concat(Rr.slice(1))
}

/** Point inside the arch region (above springing, inside both generating discs). */
export function insideArch(arch, p, margin = 0) {
  if (p.y < arch.y0 - 1e-9) return false
  return d2(p, arch.left.center) <= arch.R - margin + 1e-9 && d2(p, arch.right.center) <= arch.R - margin + 1e-9
}

// ------------------------------------------------------------- circle–circle

export function circleCircle(c1, r1, c2, r2) {
  const d = d2(c1, c2)
  if (d < 1e-12 || d > r1 + r2 + 1e-12 || d < Math.abs(r1 - r2) - 1e-12) return []
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a))
  const ux = (c2.x - c1.x) / d
  const uy = (c2.y - c1.y) / d
  const px = c1.x + ux * a
  const py = c1.y + uy * a
  return [pt(px - uy * h, py + ux * h), pt(px + uy * h, py - ux * h)]
}

function bisect(f, lo, hi, iters = 80) {
  let flo = f(lo)
  if (flo > 0) return null
  if (f(hi) < 0) return null
  for (let i = 0; i < iters; i += 1) {
    const mid = (lo + hi) / 2
    const fm = f(mid)
    if (fm > 0) hi = mid
    else {
      lo = mid
      flo = fm
    }
  }
  return (lo + hi) / 2
}

// ------------------------------------------------------------- subdivision (§4, §8)

/** n equal lancets under a parent arch (same springing line), sharpness k. */
export function subdivideArch(parent, n, k) {
  const b = parent.a / n
  const out = []
  for (let i = 0; i < n; i += 1) out.push(twoCentredArch(parent.m - parent.a + b * (2 * i + 1), b, k, parent.y0))
  return out
}

/**
 * Oculus between adjacent lancets L (left) and Rt (right) under `parent` (§5, §7):
 *   |O − C_parent| = R_parent − r   (internal tangency)
 *   |O − C_child|  = R_child + r    (external tangency, both children by symmetry)
 * O = (xo, y) on the shared mullion axis; summing eliminates r → bisection in y.
 */
export function oculusBetween(parent, L, Rt) {
  const xo = (L.m + Rt.m) / 2
  const Cp = xo >= parent.m ? parent.right.center : parent.left.center
  const Cs = L.right.center // left child's right arc faces the oculus
  const Cs2 = Rt.left.center
  const S = parent.R + L.R
  const f = (y) => Math.hypot(xo - Cp.x, y - Cp.y) + Math.hypot(xo - Cs.x, y - Cs.y) - S
  const y = bisect(f, parent.y0, parent.y0 + parent.R + L.R)
  if (y == null) return null
  const O = pt(xo, y)
  const r = parent.R - d2(O, Cp)
  if (!(r > 1e-6)) return null
  const residuals = [Math.abs(d2(O, Cp) - (parent.R - r)), Math.abs(d2(O, Cs) - (L.R + r)), Math.abs(d2(O, Cs2) - (Rt.R + r))]
  // Tangent points must lie on the arcs actually built (upper portions).
  const tChild = pt(Cs.x + ((O.x - Cs.x) * L.R) / d2(O, Cs), Cs.y + ((O.y - Cs.y) * L.R) / d2(O, Cs))
  if (tChild.x < L.m - 1e-9 || tChild.y < L.y0) return null
  return { center: O, radius: r, residuals, kind: 'oculus' }
}

/**
 * Oculus on the axis of a (middle) child arch: internally tangent to the
 * parent, externally tangent to both arcs of the child (odd lancet counts).
 */
export function oculusAbove(parent, child) {
  const xo = child.m
  const Cp = xo >= parent.m ? parent.right.center : parent.left.center
  const Cs = child.left.center
  const S = parent.R + child.R
  const f = (y) => Math.hypot(xo - Cp.x, y - Cp.y) + Math.hypot(xo - Cs.x, y - Cs.y) - S
  const y = bisect(f, child.y0 + child.h, parent.y0 + parent.R + child.R)
  if (y == null) return null
  const O = pt(xo, y)
  const r = parent.R - d2(O, Cp)
  if (!(r > 1e-6)) return null
  return { center: O, radius: r, residuals: [Math.abs(d2(O, Cp) - (parent.R - r)), Math.abs(d2(O, Cs) - (child.R + r)), Math.abs(d2(O, child.right.center) - (child.R + r))], kind: 'oculus' }
}

/** Circle in an arch head resting on a transom at height yt (exact). */
export function inscribedInHead(arch, yt) {
  const ty = yt - arch.y0
  const r = (arch.R * arch.R - arch.c * arch.c - ty * ty) / (2 * (arch.R + ty))
  if (!(r > 1e-6)) return null
  const O = pt(arch.m, yt + r)
  const residual = Math.abs(d2(O, arch.left.center) - (arch.R - r))
  return { center: O, radius: r, residuals: [residual, Math.abs(O.y - yt - r)], kind: 'headFoil' }
}

// ------------------------------------------------------------- foils (§4, §6)

/** Lower bound of the lobe ratio λ where neighbouring lobes just touch. */
export function minLobeRatio(L) {
  const s = Math.sin(Math.PI / L)
  return s / (1 + s)
}

/**
 * N-foil inside a circle (O, r): L lobes, cusp depth q ∈ [0, 1], rotation φ0.
 * Returns lobe arcs (cusp → tip → cusp) and tangency residuals.
 */
export function buildFoil(O, r, L, q, phi0, n = 12) {
  const lmin = minLobeRatio(L) * 1.015
  const lmax = Math.min(0.5, lmin + 0.22)
  const lam = lmin + (lmax - lmin) * Math.max(0, Math.min(1, 1 - q))
  const rl = lam * r
  const rho = r - rl
  const centers = []
  for (let i = 0; i < L; i += 1) {
    const a = phi0 + (TAU * i) / L
    centers.push(pt(O.x + rho * Math.cos(a), O.y + rho * Math.sin(a)))
  }
  const cusps = []
  const residuals = []
  for (let i = 0; i < L; i += 1) {
    const j = (i + 1) % L
    const hits = circleCircle(centers[i], rl, centers[j], rl)
    if (hits.length < 2) return null
    const outer = d2(hits[0], O) > d2(hits[1], O) ? hits[0] : hits[1]
    cusps.push(outer)
    residuals.push(Math.abs(d2(outer, centers[i]) - rl), Math.abs(d2(outer, centers[j]) - rl))
  }
  const arcs = []
  for (let i = 0; i < L; i += 1) {
    const from = cusps[(i - 1 + L) % L]
    const to = cusps[i]
    // Through the tip: the long way round the lobe (CCW for CCW-ordered lobes).
    arcs.push(sampleArcBetween(centers[i], rl, from, to, n, true))
    // Tip touches the enclosing circle: internal tangency ρ + rl = r.
    residuals.push(Math.abs(rho + rl - r))
  }
  return { center: O, radius: r, lobes: L, lobeRadius: rl, lobeCenters: centers, cusps, arcs, residuals }
}

/**
 * Radial extent of a foil outline along direction θ (used for carved bosses):
 * the farthest point of any lobe circle along the ray.
 */
export function foilRadiusAt(theta, L, lam, phi0 = 0) {
  const rho = 1 - lam
  let best = 0
  for (let i = 0; i < L; i += 1) {
    const a = phi0 + (TAU * i) / L
    // Ray from origin: |t·u − c|² = λ² → t = u·c + √((u·c)² − |c|² + λ²)
    const b = rho * Math.cos(theta - a)
    const disc = b * b - rho * rho + lam * lam
    if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc))
  }
  return best
}

// ------------------------------------------------------------- band (REF-013)

/** Spandrel circle tangent to a rail and two band circles of radius ρ, half-spacing d. */
export function spandrelRadius(rho, d) {
  return (d * d) / (4 * rho)
}

// ------------------------------------------------------------- gable

/**
 * Circle on the arch axis inside a gable (two lines from the gable feet to its
 * apex), tangent to both lines and externally tangent to the arch extrados.
 */
export function gableFoil(arch, ext, gableApexY, gableHalf) {
  // Gable line through (m − gableHalf, y0) and (m, gableApexY); distance from (m, y) to it.
  const ax = -gableHalf
  const ay = 0
  const bx = 0
  const by = gableApexY - arch.y0
  const len = Math.hypot(bx - ax, by - ay)
  const distLine = (y) => Math.abs((bx - ax) * (ay - (y - arch.y0)) - (ax - 0) * (by - ay)) / len
  // r(y) = distance to gable line; need |O − C| − (ext + r) = 0 for the right-arc centre.
  const C = arch.right.center
  const g = (y) => Math.hypot(arch.m - C.x, y - C.y) - (ext + distLine(y))
  const yLo = arch.y0 + Math.sqrt(Math.max(0, ext * ext - (arch.m - C.x) ** 2))
  const y = bisect(g, yLo, gableApexY)
  if (y == null) return null
  const r = distLine(y)
  if (!(r > 1e-6) || y + r > gableApexY) return null
  const O = pt(arch.m, y)
  return { center: O, radius: r, residuals: [Math.abs(d2(O, C) - (ext + r)), Math.abs(distLine(y) - r)], kind: 'gableFoil' }
}

// ------------------------------------------------------------- Y / intersecting

/** Y-tracery: from mullion top (x, ys) an arc concentric with the opposite main arc, to the main arch. */
export function yBranch(arch, x, ys, toLeft) {
  const C = toLeft ? arch.right.center : arch.left.center
  const target = toLeft ? arch.left.center : arch.right.center
  const rad = Math.hypot(x - C.x, ys - C.y)
  const hits = circleCircle(C, rad, target, arch.R).filter((p) => p.y > ys && insideArch(arch, p, -1e-6))
  if (!hits.length) return null
  const end = hits.reduce((a, b) => (b.y > a.y ? b : a))
  const pts = sampleArcBetween(C, rad, pt(x, ys), end, 16)
  return { points: pts, residual: Math.abs(d2(end, target) - arch.R) }
}

/** Intersecting tracery: main-arch circles translated to each mullion foot, clipped to the arch. */
export function intersectingArcs(arch, n, margin) {
  const out = []
  const R = arch.R
  for (let j = 0; j <= n; j += 1) {
    const x = arch.m - arch.a + (2 * arch.a * j) / n
    for (const side of ['rise-right', 'rise-left']) {
      if ((j === 0 && side === 'rise-right') || (j === n && side === 'rise-left')) continue
      // A left-type arc (centre a+c to the right of its foot) rises to the right.
      const C = side === 'rise-right' ? pt(x + arch.a + arch.c, arch.y0) : pt(x - arch.a - arch.c, arch.y0)
      const a0 = Math.atan2(0, x - C.x)
      const sweep = side === 'rise-right' ? -Math.PI / 2 : Math.PI / 2
      let run = []
      for (let i = 0; i <= 48; i += 1) {
        const a = a0 + (sweep * i) / 48
        const p = pt(C.x + R * Math.cos(a), C.y + R * Math.sin(a))
        if (insideArch(arch, p, margin)) run.push(p)
        else if (run.length) {
          if (run.length > 2) out.push(run)
          run = []
        }
      }
      if (run.length > 2) out.push(run)
    }
  }
  return out
}
