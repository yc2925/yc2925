/**
 * Containment / clearance helpers for pointed arches (Step 13C).
 * Uses exact circle equations from the Step 13B arch result — no visual guessing.
 */

import { eps } from '../kernel/tolerances.js'
import { distance } from '../kernel/vector2.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'

/**
 * Upper arch boundary y at world x, or null if outside the span.
 */
export function archHeightAtX(arch, x) {
  if (!arch?.derived || !arch.parameters) return null
  const a = arch.derived.halfSpan ?? arch.parameters.span / 2
  const ox = arch.parameters.offsetX ?? 0
  const y0 = arch.parameters.springingY
  const R = arch.derived.radius
  const c = arch.derived.centerOffset
  const lx = x - ox
  const tol = eps(Math.max(1, a, R))
  if (lx < -a - tol || lx > a + tol) return null

  // Left half uses C_A = (c + ox, y0); right half uses C_B = (−c + ox, y0)
  const cx = lx <= 0 ? c + ox : -c + ox
  const dx = x - cx
  const under = R * R - dx * dx
  if (under < -tol) return null
  return y0 + Math.sqrt(Math.max(0, under))
}

/**
 * Point inside the arch *opening* (on/above springing, below arcs, within span).
 * `margin` is applied only to the upper arch boundary (clearance under the arcs).
 * Points may lie on the springing line and jambs (shared with parent openings).
 */
export function pointInsideArchOpening(arch, p, margin = 0) {
  if (!arch?.validation?.ok && !arch?.derived?.radius) return false
  const y0 = arch.parameters.springingY
  const a = arch.derived.halfSpan ?? arch.parameters.span / 2
  const ox = arch.parameters.offsetX ?? 0
  const m = Math.max(0, margin)
  const tol = eps(Math.max(1, a, arch.derived.radius ?? 1))
  if (!(p.y >= y0 - tol)) return false
  if (Math.abs(p.x - ox) > a + tol) return false
  const yArch = archHeightAtX(arch, p.x)
  if (yArch == null) return false
  return p.y <= yArch - m + tol
}

/** Sample dense points along both arch result curves. */
export function sampleArchOutline(arch, count = 48) {
  const left = arch.samples?.left ?? []
  const right = arch.samples?.right ?? []
  if (left.length && right.length) {
    return [...left, ...right.slice(1)]
  }
  return []
}

/**
 * True if every sample of `inner` lies inside `outer` opening with margin.
 * Springing endpoints shared with the parent jamb are allowed on the boundary.
 */
export function archOutlineInsideParent(inner, outer, margin = 0, sampleCount = 64) {
  const pts = sampleArchOutline(inner)
  if (!pts.length) return { ok: false, reason: 'no_inner_samples', violations: [] }
  const violations = []
  const y0 = outer.parameters.springingY
  const tol = eps(Math.max(1, outer.parameters.span ?? 1))
  const step = Math.max(1, Math.floor(pts.length / sampleCount))
  for (let i = 0; i < pts.length; i += step) {
    const p = pts[i]
    // On the sill: only require horizontal inclusion
    if (p.y <= y0 + tol) {
      const a = outer.derived.halfSpan ?? outer.parameters.span / 2
      const ox = outer.parameters.offsetX ?? 0
      if (Math.abs(p.x - ox) > a + tol) {
        violations.push(p)
      }
      continue
    }
    if (!pointInsideArchOpening(outer, p, margin)) {
      violations.push(p)
      if (violations.length > 8) break
    }
  }
  // Always check apex
  const apex = inner.points?.[ARCH_SEMANTICS.APEX]
  if (apex && !pointInsideArchOpening(outer, apex, margin)) {
    violations.push(apex)
  }
  return {
    ok: violations.length === 0,
    reason: violations.length ? 'containment' : null,
    violations,
  }
}

/**
 * Circle fully inside arch opening (boundary samples + cardinal extrema).
 */
export function circleInsideArch(arch, circle, margin = 0, samples = 48) {
  const violations = []
  for (let i = 0; i < samples; i += 1) {
    const ang = (i / samples) * Math.PI * 2
    const p = {
      x: circle.center.x + Math.cos(ang) * circle.radius,
      y: circle.center.y + Math.sin(ang) * circle.radius,
    }
    if (!pointInsideArchOpening(arch, p, margin)) {
      violations.push(p)
      if (violations.length > 8) break
    }
  }
  return {
    ok: violations.length === 0,
    reason: violations.length ? 'oculus_outside_parent' : null,
    violations,
    clearanceHint: minBoundaryClearance(arch, circle),
  }
}

function minBoundaryClearance(arch, circle) {
  let min = Infinity
  const n = 36
  for (let i = 0; i < n; i += 1) {
    const ang = (i / n) * Math.PI * 2
    const p = {
      x: circle.center.x + Math.cos(ang) * circle.radius,
      y: circle.center.y + Math.sin(ang) * circle.radius,
    }
    const yArch = archHeightAtX(arch, p.x)
    if (yArch == null) return 0
    min = Math.min(min, yArch - p.y)
  }
  const a = arch.derived.halfSpan
  const ox = arch.parameters.offsetX ?? 0
  const leftClear = circle.center.x - circle.radius - (ox - a)
  const rightClear = ox + a - (circle.center.x + circle.radius)
  const bottomClear = circle.center.y - circle.radius - arch.parameters.springingY
  return Math.min(min, leftClear, rightClear, bottomClear)
}

/**
 * Horizontal clearance between two non-overlapping child spans separated by mullion.
 */
export function mullionClearance(leftSpanEnd, rightSpanStart) {
  return rightSpanStart - leftSpanEnd
}

export function distancePointToArchApex(arch, p) {
  const apex = arch.points?.[ARCH_SEMANTICS.APEX]
  if (!apex) return Infinity
  return distance(apex, p)
}
