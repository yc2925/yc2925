/**
 * Composite-arc arch kernel (Step 48). Source: gothic_tracery_mathematics_analysis.md
 * §2–§5; REF-001 (arch families), REF-005 (ogee), REF-010 (curvilinear).
 *
 * An arch is a chain of circular arcs: `left` runs springing → apex, `right`
 * apex → springing. Each segment { c, r, t0, t1, s } sweeps angle t0 → t1 on
 * circle (c, r); s = +1 when the centre lies on the opening side (offsetting
 * outward grows r), −1 for reversed arcs (ogee). Joints between segments are
 * tangent (centres collinear with the joint), so a concentric offset keeps
 * every joint angle; only the apex is re-solved (circle ∩ circle).
 *
 * Arch coordinates: x across the span (0 = axis), y up from the springing line.
 */

import { circleCircle, twoCentredArch } from './construct2d.js'

const TAU = Math.PI * 2
const pt = (x, y) => ({ x, y })
const d2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const at = (seg, t, r = seg.r) => pt(seg.c.x + r * Math.cos(t), seg.c.y + r * Math.sin(t))

/** Mirror a left chain about x = 0 into a right chain (apex → springing). */
function mirrorChain(left) {
  return left
    .slice()
    .reverse()
    .map((s) => ({ c: pt(-s.c.x, s.c.y), r: s.r, t0: Math.PI - s.t1, t1: Math.PI - s.t0, s: s.s }))
}

function finish(kind, left, right, extra = {}) {
  const apex = at(left[left.length - 1], left[left.length - 1].t1)
  const feet = [at(left[0], left[0].t0), at(right[right.length - 1], right[right.length - 1].t1)]
  return { kind, left, right, apex, feet, a: (feet[1].x - feet[0].x) / 2, h: apex.y, residuals: [], ...extra }
}

export function sampleSeg(seg, n = 16) {
  const out = []
  for (let i = 0; i <= n; i += 1) out.push(at(seg, seg.t0 + ((seg.t1 - seg.t0) * i) / n))
  return out
}

/** Outline springing → apex → springing (an open apex adds the finial stub). */
export function sampleCArch(arch, n = 14) {
  const out = []
  for (const s of arch.left) out.push(...sampleSeg(s, n).slice(out.length ? 1 : 0))
  if (arch.openApex) out.push(...arch.openApex)
  for (const s of arch.right) {
    const pts = sampleSeg(s, n)
    out.push(...(arch.openApex ? pts : pts.slice(1)))
  }
  return out
}

/** Every circle of the construction (for the debug layer). */
export function archCircles(arch) {
  return [...arch.left, ...arch.right].map((s) => ({ c: s.c, r: s.r }))
}

// ------------------------------------------------------------ constructors

/** Wrap the Step 47 two-centred arch (one arc per side). */
export function fromTwoCentred(tc) {
  const left = [{ c: tc.left.center, r: tc.R, t0: Math.PI, t1: Math.atan2(tc.apex.y - tc.left.center.y, tc.apex.x - tc.left.center.x), s: 1 }]
  const right = [{ c: tc.right.center, r: tc.R, t0: Math.atan2(tc.apex.y - tc.right.center.y, tc.apex.x - tc.right.center.x), t1: 0, s: 1 }]
  return finish('pointed', left, right, { tc, k: tc.k })
}

/**
 * Round (h = a) or segmental (h < a) or stilted (h > a) arch: one circle
 * through both springings and the apex. R = (a² + h²) / 2h, centre (0, h − R).
 */
export function roundArch(a, h) {
  const R = (a * a + h * h) / (2 * h)
  const c = pt(0, h - R)
  let t0 = Math.atan2(-c.y, -a)
  if (t0 < Math.PI / 2) t0 += TAU
  const left = [{ c, r: R, t0, t1: Math.PI / 2, s: 1 }]
  const arch = finish('round', left, mirrorChain(left), { R, c })
  arch.residuals = [Math.abs(d2(c, pt(-a, 0)) - R), Math.abs(d2(c, pt(0, h)) - R)]
  return arch
}

/**
 * Four-centred (Tudor) arch, rise h < half-span a.
 * Springing arc: centre C1 = (−a + r1, 0), radius r1, from the springing up to
 * angle π − φ. Haunch arc: centre C2 = C1 + t·d, d = (cos φ, −sin φ), radius
 * R2 = r1 + t (internal tangency, so the joint is smooth), through the apex
 * (0, h): t = (|w|² − r1²) / 2(w·d + r1) with w = apex − C1. The smallest φ
 * that puts C2 right of the axis gives a pointed apex.
 */
export function tudorArch(a, h) {
  const r1 = Math.min(h * 0.8, a * (0.22 + 0.3 * (h / a)))
  const C1 = pt(-a + r1, 0)
  const w = pt(a - r1, h)
  for (let deg = 18; deg <= 80; deg += 1) {
    const phi = (deg * Math.PI) / 180
    const d = pt(Math.cos(phi), -Math.sin(phi))
    const t = (w.x * w.x + w.y * w.y - r1 * r1) / (2 * (w.x * d.x + w.y * d.y + r1))
    if (!(t > 0)) continue
    const C2 = pt(C1.x + t * d.x, C1.y + t * d.y)
    const R2 = r1 + t
    if (C2.x <= 0.03 * a) continue
    const tA = Math.atan2(h - C2.y, -C2.x)
    const tT = Math.PI - phi
    if (!(tA > Math.PI / 2 && tA < tT)) continue
    const left = [
      { c: C1, r: r1, t0: Math.PI, t1: tT, s: 1 },
      { c: C2, r: R2, t0: tT, t1: tA, s: 1 },
    ]
    const arch = finish('tudor', left, mirrorChain(left), { phi, r1, R2 })
    arch.residuals = [Math.abs(d2(C1, C2) - (R2 - r1)), Math.abs(d2(C2, pt(0, h)) - R2)]
    return arch
  }
  return null
}

/**
 * Ogee arch. Lower arc: centre C1 = (−a + R1, 0), R1 = λa (convex). Upper
 * reversed arc: centre C2 = (−R2, h) at apex height (vertical tangent at the
 * apex), externally tangent to the lower arc: |C2 − C1| = R1 + R2
 *   → R2 = (p² + h² − R1²) / 2a,  p = −a + R1.
 */
export function ogeeArch(a, h) {
  // λ = 0.55 first (low shoulders, long reverse curves), then the rest of the range.
  for (const lam of [0.55, 0.6, 0.5, 0.65, 0.45, 0.7, 0.4, 0.75, 0.8, 0.85, 0.9, 0.95]) {
    const R1 = lam * a
    const p = -a + R1
    const R2 = (p * p + h * h - R1 * R1) / (2 * a)
    if (!(R2 > 0.12 * a)) continue
    const C1 = pt(p, 0)
    const C2 = pt(-R2, h)
    const D = d2(C1, C2)
    const u = pt((C2.x - C1.x) / D, (C2.y - C1.y) / D)
    const tJ = Math.atan2(u.y, u.x)
    const T = pt(C1.x + R1 * u.x, C1.y + R1 * u.y)
    if (!(tJ > Math.PI / 2 && tJ < Math.PI) || T.y < 0.15 * h) continue
    const left = [
      { c: C1, r: R1, t0: Math.PI, t1: tJ, s: 1 },
      { c: C2, r: R2, t0: Math.atan2(-u.y, -u.x), t1: 0, s: -1 },
    ]
    const arch = finish('ogee', left, mirrorChain(left), { R1, R2 })
    arch.residuals = [Math.abs(D - (R1 + R2)), Math.abs(d2(C2, pt(0, h)) - R2)]
    return arch
  }
  return null
}

/**
 * Rampant arch: springings (−a, 0) and (a, d) at different heights, apex
 * P = (xp, hp). Each arc has its centre on its own springing line (vertical
 * tangent at the springing) and passes through P:
 *   left  centre (cx1, 0): cx1 = (xp² + hp² − a²) / 2(xp + a), R1 = cx1 + a
 *   right centre (cx2, d): cx2 = (a² − xp² − (hp − d)²) / 2(a − xp), R2 = a − cx2
 * xp is moved toward the axis until both arcs rise into P (cx2 ≤ xp ≤ cx1).
 */
export function rampantArch(a, d, xpWanted, hp) {
  // The drawn apex first, then every other position across the span, nearest first.
  const tries = [xpWanted]
  for (let i = 0; i <= 60; i += 1) tries.push(-0.9 * a + (1.8 * a * i) / 60)
  tries.sort((p, q) => Math.abs(p - xpWanted) - Math.abs(q - xpWanted))
  for (const xp of tries) {
    if (Math.abs(xp) >= a * 0.95) continue
    const cx1 = (xp * xp + hp * hp - a * a) / (2 * (xp + a))
    const cx2 = (a * a - xp * xp - (hp - d) * (hp - d)) / (2 * (a - xp))
    const R1 = cx1 + a
    const R2 = a - cx2
    if (!(R1 > 0 && R2 > 0) || xp > cx1 + 1e-9 || xp < cx2 - 1e-9) continue
    const P = pt(xp, hp)
    const left = [{ c: pt(cx1, 0), r: R1, t0: Math.PI, t1: Math.atan2(hp, xp - cx1), s: 1 }]
    const right = [{ c: pt(cx2, d), r: R2, t0: Math.atan2(hp - d, xp - cx2), t1: 0, s: 1 }]
    const arch = finish('rampant', left, right, { d, xp })
    arch.apex = P
    arch.residuals = [Math.abs(d2(left[0].c, P) - R1), Math.abs(d2(right[0].c, P) - R2)]
    return arch
  }
  return null
}

// ------------------------------------------------------------ offsets + queries

/** Travel from t0 to t in the sweep direction of a segment (≥ 0 when ahead). */
function travel(seg, t) {
  const dir = Math.sign(seg.t1 - seg.t0) || 1
  let d = (t - seg.t0) * dir
  while (d < -1e-9) d += TAU
  while (d > TAU) d -= TAU
  return d
}

/**
 * Concentric offset (archivolt / inset): r' = r + s·δ, joint angles kept,
 * apex re-solved as the first circle ∩ circle hit in the sweep direction.
 * Reversed arcs that no longer meet (outer ogee mouldings) end in a finial stub.
 */
export function offsetCArch(arch, delta) {
  const off = (s) => ({ ...s, r: s.r + s.s * delta })
  const left = arch.left.map(off)
  const right = arch.right.map(off)
  if ([...left, ...right].some((s) => !(s.r > 1e-3))) return null
  const L = left[left.length - 1]
  const R = right[0]
  let openApex = null
  if (d2(L.c, R.c) < 1e-9 && Math.abs(L.r - R.r) < 1e-9) {
    // Same circle (round arch): apex stays at its angle.
  } else {
    const hits = circleCircle(L.c, L.r, R.c, R.r)
    if (hits.length) {
      const best = hits.reduce((p, q) => (travel(L, Math.atan2(q.y - L.c.y, q.x - L.c.x)) < travel(L, Math.atan2(p.y - L.c.y, p.x - L.c.x)) ? q : p))
      L.t1 = Math.atan2(best.y - L.c.y, best.x - L.c.x)
      // Keep the left chain's sweep direction (no wrap through the far side).
      const dir = Math.sign(arch.left[arch.left.length - 1].t1 - arch.left[arch.left.length - 1].t0) || 1
      while ((L.t1 - L.t0) * dir < 0) L.t1 += dir * TAU
      while ((L.t1 - L.t0) * dir > TAU) L.t1 -= dir * TAU
      R.t0 = Math.atan2(best.y - R.c.y, best.x - R.c.x)
      const dirR = Math.sign(arch.right[0].t1 - arch.right[0].t0) || 1
      while ((R.t1 - R.t0) * dirR < 0) R.t0 -= dirR * TAU
      while ((R.t1 - R.t0) * dirR > TAU) R.t0 += dirR * TAU
    } else {
      const pl = at(L, L.t1)
      const pr = at(R, R.t0)
      openApex = [pt((pl.x + pr.x) / 2, Math.max(pl.y, pr.y) + Math.abs(delta) * 1.4)]
    }
  }
  // Carry construction data (tc, k, R1…) but never the old apex / feet / span / rise.
  const { apex: _a, feet: _f, a: _sa, h: _h, residuals: _r, ...carry } = arch
  const out = finish(arch.kind, left, right, { ...carry, left, right, openApex })
  if (openApex) out.apex = openApex[0]
  out.residuals = []
  return out
}

/** Highest y of the arch outline above x (exact per segment), or null outside the span. */
export function archYAt(arch, x) {
  let best = null
  for (const seg of [...arch.left, ...arch.right]) {
    const dx = x - seg.c.x
    if (Math.abs(dx) > seg.r) continue
    const dy = Math.sqrt(seg.r * seg.r - dx * dx)
    for (const y of [seg.c.y + dy, seg.c.y - dy]) {
      const t = Math.atan2(y - seg.c.y, dx)
      const sweep = Math.abs(seg.t1 - seg.t0)
      if (travel(seg, t) <= sweep + 1e-9 && (best == null || y > best)) best = y
    }
  }
  return best
}

/** Closed polygon of the opening (outline + springing line). */
export function archPolygon(arch, n = 14) {
  return sampleCArch(arch, n)
}

export function pointInPoly(p, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y + 1e-12) + a.x) inside = !inside
  }
  return inside
}

export function distToPoly(p, poly) {
  let best = Infinity
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const l2 = vx * vx + vy * vy || 1e-12
    const u = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2))
    best = Math.min(best, Math.hypot(p.x - a.x - u * vx, p.y - a.y - u * vy))
  }
  return best
}

/** Every point of `pts` is inside `poly` by at least `margin`. */
export function fitsInside(pts, poly, margin = 0) {
  return pts.every((p) => pointInPoly(p, poly) && distToPoly(p, poly) >= margin)
}

/**
 * Cusped intrados (§4, §5): along each side arc (one circle, R), n lobe
 * circles internally tangent to it at equal angles: centre C + (R − rl)·e(θi),
 * rl = k·R·s / (1 + k·s), s = sin(Δθ / 2), k > 1 so neighbours overlap. Cusps
 * are the neighbour intersections on the opening side (nearer C); the last
 * lobes of both sides meet in a pendant cusp under the apex.
 */
export function cuspedIntrados(arch, perSide, depth) {
  if (arch.left.length !== 1 || arch.right.length !== 1) return null
  const k = 1.12 + 0.5 * Math.max(0, Math.min(1, depth))
  const sideLobes = (seg) => {
    const dt = (seg.t1 - seg.t0) / perSide
    const s = Math.sin(Math.abs(dt) / 2)
    const rl = (k * seg.r * s) / (1 + k * s)
    const lobes = []
    for (let i = 0; i < perSide; i += 1) {
      const th = seg.t0 + dt * (i + 0.5)
      lobes.push({ c: at(seg, th, seg.r - rl), r: rl, th })
    }
    return { lobes, rl }
  }
  const L = sideLobes(arch.left[0])
  const R = sideLobes(arch.right[0])
  const lobes = [...L.lobes, ...R.lobes]
  const residuals = []
  for (const lb of L.lobes) residuals.push(Math.abs(d2(lb.c, arch.left[0].c) - (arch.left[0].r - lb.r)))
  for (const lb of R.lobes) residuals.push(Math.abs(d2(lb.c, arch.right[0].c) - (arch.right[0].r - lb.r)))
  const cusps = []
  for (let i = 0; i < lobes.length - 1; i += 1) {
    const hits = circleCircle(lobes[i].c, lobes[i].r, lobes[i + 1].c, lobes[i + 1].r)
    if (hits.length < 2) return null
    // Opening side: the hit farther from the arch line, i.e. lower / more central.
    const inner = hits.reduce((p, q) => (Math.hypot(q.x, q.y - arch.h * 0.3) < Math.hypot(p.x, p.y - arch.h * 0.3) ? q : p))
    cusps.push(inner)
    residuals.push(Math.abs(d2(inner, lobes[i].c) - lobes[i].r), Math.abs(d2(inner, lobes[i + 1].c) - lobes[i + 1].r))
  }
  // Lobe arcs between cusps, through the side touching the arch.
  const arcs = []
  lobes.forEach((lb, i) => {
    // End lobes start / stop on their own circle in the springing direction.
    const a0 = i === 0 ? arch.left[0].t0 : Math.atan2(cusps[i - 1].y - lb.c.y, cusps[i - 1].x - lb.c.x)
    const a1 = i === lobes.length - 1 ? arch.right[0].t1 : Math.atan2(cusps[i].y - lb.c.y, cusps[i].x - lb.c.x)
    // Of the two ways round, take the one through the tangent point (direction th).
    let cw = a1 - a0
    while (cw > 0) cw -= TAU
    const ccw = cw + TAU
    const sweep = Math.cos(a0 + cw / 2 - lb.th) > Math.cos(a0 + ccw / 2 - lb.th) ? cw : ccw
    const pts = []
    for (let j = 0; j <= 12; j += 1) pts.push(pt(lb.c.x + lb.r * Math.cos(a0 + (sweep * j) / 12), lb.c.y + lb.r * Math.sin(a0 + (sweep * j) / 12)))
    arcs.push(pts)
  })
  return { lobes, cusps, arcs, residuals }
}

/**
 * Order of an arch family: concentric offset for arcs that stay tangent
 * (pointed, round, Tudor, rampant); an ogee is rebuilt with span a ± δ and
 * rise h ± 1.8δ, because the inward offsets of its vertical-tangent apex only
 * meet far below it.
 */
export function archOrder(arch, delta) {
  if (arch.kind === 'ogee') {
    const o = ogeeArch(arch.a + delta, arch.h + 1.8 * delta)
    if (o) return o
  }
  return offsetCArch(arch, delta)
}

export { twoCentredArch }
