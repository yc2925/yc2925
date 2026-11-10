/**
 * Upper spandrel secondary openings (Step 13D.2).
 *
 * Symmetric circular voids flanking the oculus, derived from:
 *   parent pointed arch · oculus circle · clearance / tangency constraints
 *
 * Inspired by REF-007 / REF-012 spandrel circles beside the upper oculus —
 * not a silhouette copy. If constraints fail, report failure (no forced holes).
 */

import { point } from '../kernel/vector2.js'
import { createArc } from '../kernel/arc2.js'
import { createCircle } from '../kernel/circle2.js'
import { circleInsideArch, archHeightAtX, pointInsideArchOpening } from './archContainment.js'
import { ensureCw, sampleLoop } from './openingLoops.js'
import { REGION_TYPES } from './regionRoles.js'

const SAMPLE_OPTS = { segments: 20 }

/**
 * Full circle as four clockwise quarter-arcs (hole winding).
 */
export function circleToCwLoop(center, radius) {
  const arcs = [0, 1, 2, 3].map((i) =>
    createArc(center, radius, (i * Math.PI) / 2, -Math.PI / 2),
  )
  return ensureCw(arcs, SAMPLE_OPTS)
}

function circleClearOfPolyline(circle, samples, minGap) {
  // Conservative: every sample must be outside circle by minGap
  // AND circle center must be outside the polyline's "interior" enough that
  // radius + minGap does not reach foil/lancet samples.
  for (const q of samples) {
    const d = Math.hypot(q.x - circle.center.x, q.y - circle.center.y)
    if (d < circle.radius + minGap - 1e-9) return false
  }
  return true
}

/**
 * Horizontal parent-arch half-width at a given Y (approximate via inverse of archHeightAtX).
 * Binary-search |x| such that archHeightAtX ≈ y.
 */
function archHalfWidthAtY(arch, y) {
  const a = arch.derived?.halfSpan ?? arch.parameters.span / 2
  const ox = arch.parameters.offsetX ?? 0
  const y0 = arch.parameters.springingY
  if (!(y > y0)) return 0
  let lo = 0
  let hi = a
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2
    const yh = archHeightAtX(arch, ox + mid)
    if (yh == null || yh < y) hi = mid
    else lo = mid
  }
  return lo
}

/**
 * Build one side's spandrel circle.
 *
 * Construction:
 * 1. Work at oculus center height (REF-007 flanking circles).
 * 2. Clear oculus by secondaryWeb (stone between oculus ring and opening).
 * 3. Fit radius into remaining pocket to the parent arch side wall.
 * 4. Scale by upperOpeningScale; validate containment + clearances.
 */
function solveSideOpening({
  side, // -1 left, +1 right
  parent,
  oculus,
  foilSamples,
  lancetSamples,
  secondaryWeb,
  upperOpeningScale,
  minWeb,
}) {
  const Oc = oculus.center
  const Ro = oculus.radius
  const y = Oc.y
  const halfAtY = archHalfWidthAtY(parent, y)
  const ox = parent.parameters.offsetX ?? 0

  // Inner edge of pocket: outside oculus by secondaryWeb
  const innerX = Oc.x + side * (Ro + secondaryWeb)
  // Outer limit: inside parent arch by secondaryWeb
  const outerLimit = ox + side * Math.max(0, halfAtY - secondaryWeb)
  const pocket = side > 0 ? outerLimit - innerX : innerX - outerLimit

  if (!(pocket > minWeb * 2)) {
    return {
      ok: false,
      reason: `spandrel pocket too narrow on ${side > 0 ? 'right' : 'left'} (${pocket.toFixed(4)} m)`,
    }
  }

  const scale = Math.min(1, Math.max(0.15, upperOpeningScale))
  let r = (pocket * scale) / 2
  r = Math.min(r, pocket * 0.48)
  if (!(r > minWeb * 0.35)) {
    return {
      ok: false,
      reason: `spandrel radius too small on ${side > 0 ? 'right' : 'left'}`,
    }
  }

  // Center midway in the pocket (geometric placement, not freehand)
  const cx = innerX + side * r
  const center = point(cx, y)
  const circle = createCircle(center, r)

  // Must sit under parent arch with clearance
  const inside = circleInsideArch(parent, circle, secondaryWeb * 0.5)
  if (!inside.ok) {
    return { ok: false, reason: `spandrel circle escapes parent arch (${side > 0 ? 'right' : 'left'})` }
  }

  // Clear oculus
  const dOculus = Math.hypot(center.x - Oc.x, center.y - Oc.y)
  if (dOculus < Ro + r + secondaryWeb - 1e-6) {
    return { ok: false, reason: 'spandrel intersects oculus clearance' }
  }

  if (foilSamples?.length && !circleClearOfPolyline(circle, foilSamples, minWeb * 0.5)) {
    return { ok: false, reason: 'spandrel intersects foil void' }
  }
  if (lancetSamples?.length && !circleClearOfPolyline(circle, lancetSamples, minWeb * 0.5)) {
    return { ok: false, reason: 'spandrel intersects lancet void' }
  }

  // Extra: sample ring points must be inside parent opening
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2
    const p = point(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r)
    if (!pointInsideArchOpening(parent, p, secondaryWeb * 0.25)) {
      return { ok: false, reason: 'spandrel boundary not inside parent opening' }
    }
  }

  const loop = circleToCwLoop(center, r)
  return {
    ok: true,
    circle,
    center,
    radius: r,
    edges: loop.edges,
    side: side > 0 ? 'right' : 'left',
  }
}

/**
 * Symmetric pair of upper spandrel openings.
 *
 * @returns {{ ok, openings, errors, warnings, construction }}
 */
export function buildUpperSpandrelOpenings({
  parent,
  oculus,
  foil,
  leftLancetEdges,
  rightLancetEdges,
  secondaryWeb,
  upperOpeningScale = 0.7,
  minWeb = 0.05,
  enabled = true,
} = {}) {
  if (!enabled) {
    return { ok: true, openings: [], errors: [], warnings: [], skipped: true }
  }
  if (!parent?.derived || !oculus?.center || !(oculus.radius > 0)) {
    return {
      ok: false,
      openings: [],
      errors: ['spandrel construction requires parent arch + oculus'],
      warnings: [],
    }
  }

  const foilSamples = foil?.samples?.length
    ? foil.samples
    : foil?.arcs
      ? sampleLoop(foil.arcs, SAMPLE_OPTS)
      : []
  const leftSamples = leftLancetEdges?.length ? sampleLoop(leftLancetEdges, SAMPLE_OPTS) : []
  const rightSamples = rightLancetEdges?.length ? sampleLoop(rightLancetEdges, SAMPLE_OPTS) : []
  const lancetSamples = [...leftSamples, ...rightSamples]
  const web = Math.max(minWeb, secondaryWeb ?? minWeb)

  const left = solveSideOpening({
    side: -1,
    parent,
    oculus,
    foilSamples,
    lancetSamples,
    secondaryWeb: web,
    upperOpeningScale,
    minWeb,
  })
  const right = solveSideOpening({
    side: 1,
    parent,
    oculus,
    foilSamples,
    lancetSamples,
    secondaryWeb: web,
    upperOpeningScale,
    minWeb,
  })

  const errors = []
  if (!left.ok) errors.push(left.reason)
  if (!right.ok) errors.push(right.reason)

  // Require the symmetric pair — do not emit a single-sided hole.
  if (!left.ok || !right.ok) {
    return {
      ok: false,
      openings: [],
      errors,
      warnings: ['Upper spandrel openings omitted — constraint failure (not forced).'],
      construction: { left, right, secondaryWeb: web, upperOpeningScale },
    }
  }

  const openings = [
    {
      id: REGION_TYPES.LEFT_SPANDREL_VOID,
      type: REGION_TYPES.LEFT_SPANDREL_VOID,
      edges: left.edges,
      center: left.center,
      radius: left.radius,
      circle: left.circle,
      memberClass: 'SECONDARY_TRACERY',
    },
    {
      id: REGION_TYPES.RIGHT_SPANDREL_VOID,
      type: REGION_TYPES.RIGHT_SPANDREL_VOID,
      edges: right.edges,
      center: right.center,
      radius: right.radius,
      circle: right.circle,
      memberClass: 'SECONDARY_TRACERY',
    },
  ]

  return {
    ok: true,
    openings,
    errors: [],
    warnings: [],
    construction: {
      secondaryWeb: web,
      upperOpeningScale,
      left: { center: left.center, radius: left.radius },
      right: { center: right.center, radius: right.radius },
      rule:
        'Symmetric circles at oculus height; clear oculus by secondaryWeb; fit in parent-arch pocket; scale by upperOpeningScale.',
    },
  }
}
