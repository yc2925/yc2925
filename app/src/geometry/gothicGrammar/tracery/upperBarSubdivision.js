/**
 * Upper Rayonnant bar-tracery subdivision (Step 13D.3).
 *
 * Derives additional negative-space cells from parent arch · lancet apexes ·
 * oculus using circular packing / tangency — not freehand holes.
 *
 * Inspired by REF-006 / REF-008 / REF-011 packing; not a silhouette copy.
 */

import { point } from '../kernel/vector2.js'
import { createCircle } from '../kernel/circle2.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { archHeightAtX, circleInsideArch, pointInsideArchOpening } from './archContainment.js'
import { circleToCwLoop } from './spandrelOpenings.js'
import { sampleLoop } from './openingLoops.js'
import { REGION_TYPES } from './regionRoles.js'

const SAMPLE_OPTS = { segments: 20 }

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

function circleClearOfPolyline(circle, samples, minGap) {
  for (const q of samples) {
    const d = Math.hypot(q.x - circle.center.x, q.y - circle.center.y)
    if (d < circle.radius + minGap - 1e-9) return false
  }
  return true
}

function circleClearOfCircle(a, b, minGap) {
  const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)
  return d >= a.radius + b.radius + minGap - 1e-9
}

function validateCircleOpening(circle, parent, web, foilSamples, lancetSamples, others) {
  const inside = circleInsideArch(parent, circle, web * 0.35)
  if (!inside.ok) return { ok: false, reason: 'escapes parent arch' }
  if (foilSamples?.length && !circleClearOfPolyline(circle, foilSamples, web * 0.45)) {
    return { ok: false, reason: 'intersects foil' }
  }
  if (lancetSamples?.length && !circleClearOfPolyline(circle, lancetSamples, web * 0.45)) {
    return { ok: false, reason: 'intersects lancet' }
  }
  for (const o of others ?? []) {
    if (!circleClearOfCircle(circle, o, web * 0.45)) {
      return { ok: false, reason: 'intersects sibling cell' }
    }
  }
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2
    const p = point(
      circle.center.x + Math.cos(a) * circle.radius,
      circle.center.y + Math.sin(a) * circle.radius,
    )
    if (!pointInsideArchOpening(parent, p, web * 0.2)) {
      return { ok: false, reason: 'boundary outside parent opening' }
    }
  }
  return { ok: true }
}

/**
 * Side cells flanking the oculus (improved spandrel packing).
 * Centers sit in the horizontal pocket at oculus height; radius fills
 * available clearance under density control.
 */
function solveSideCell({
  side,
  parent,
  oculus,
  foilSamples,
  lancetSamples,
  web,
  scale,
  minWeb,
  others,
}) {
  const Oc = oculus.center
  const Ro = oculus.radius
  const y = Oc.y
  const halfAtY = archHalfWidthAtY(parent, y)
  const ox = parent.parameters.offsetX ?? 0
  const innerX = Oc.x + side * (Ro + web)
  const outerLimit = ox + side * Math.max(0, halfAtY - web)
  const pocket = side > 0 ? outerLimit - innerX : innerX - outerLimit
  if (!(pocket > minWeb * 2.2)) {
    return { ok: false, reason: 'side pocket too narrow' }
  }
  const s = Math.min(1, Math.max(0.25, scale))
  let r = (pocket * s) / 2
  r = Math.min(r, pocket * 0.46)
  if (!(r > minWeb * 0.4)) return { ok: false, reason: 'side radius too small' }

  // Balanced pocket placement (not flush to oculus) — clearer aperture.
  const cx = (innerX + outerLimit) / 2
  const center = point(cx, y)
  const circle = createCircle(center, r)
  const v = validateCircleOpening(circle, parent, web, foilSamples, lancetSamples, [
    createCircle(Oc, Ro),
    ...(others ?? []),
  ])
  if (!v.ok) return { ok: false, reason: `side ${side > 0 ? 'right' : 'left'}: ${v.reason}` }
  return { ok: true, circle, center, radius: r, side: side > 0 ? 'right' : 'left' }
}

/**
 * Apex cell between oculus crown and parent apex (REF-008 upper packing).
 */
function solveApexCell({ parent, oculus, foilSamples, lancetSamples, web, scale, minWeb, others }) {
  const Oc = oculus.center
  const Ro = oculus.radius
  const ox = parent.parameters.offsetX ?? 0
  const apexY = archHeightAtX(parent, ox)
  if (apexY == null) return { ok: false, reason: 'no parent apex' }
  const innerY = Oc.y + Ro + web
  const outerY = apexY - web
  const pocket = outerY - innerY
  if (!(pocket > minWeb * 2)) return { ok: false, reason: 'apex pocket too narrow' }

  const s = Math.min(1, Math.max(0.25, scale)) * 0.85
  let r = (pocket * s) / 2
  r = Math.min(r, pocket * 0.4)
  if (!(r > minWeb * 0.35)) return { ok: false, reason: 'apex radius too small' }

  const cy = (innerY + outerY) / 2
  const center = point(ox, cy)
  // Also limited by parent half-width at cy — keep extra clearance for Earcut stability
  const half = archHalfWidthAtY(parent, cy)
  r = Math.min(r, Math.max(0, half - web * 1.25))
  if (!(r > minWeb * 0.35)) return { ok: false, reason: 'apex clipped by parent width' }

  const circle = createCircle(center, r)
  const v = validateCircleOpening(circle, parent, web, foilSamples, lancetSamples, [
    createCircle(Oc, Ro),
    ...(others ?? []),
  ])
  if (!v.ok) return { ok: false, reason: `apex: ${v.reason}` }
  return { ok: true, circle, center, radius: r }
}

/**
 * Shoulder cells between a lancet apex and the oculus underside.
 */
function solveShoulderCell({
  side,
  parent,
  leftChild,
  rightChild,
  oculus,
  foilSamples,
  lancetSamples,
  web,
  scale,
  minWeb,
  others,
}) {
  const child = side < 0 ? leftChild : rightChild
  const apex = child?.points?.[ARCH_SEMANTICS.APEX]
  if (!apex) return { ok: false, reason: 'missing lancet apex' }
  const Oc = oculus.center
  const Ro = oculus.radius
  const ox = parent.parameters.offsetX ?? 0

  const yLow = apex.y + web
  const yHigh = Oc.y - Ro - web
  if (!(yHigh > yLow + minWeb)) return { ok: false, reason: 'shoulder vertical pocket too small' }

  const cy = (yLow + yHigh) / 2
  const halfAtY = archHalfWidthAtY(parent, cy)
  // Horizontal pocket: outside child apex x toward parent wall, clear of oculus column
  const oculusX = Oc.x + side * Math.sqrt(Math.max(0, Ro * Ro - (cy - Oc.y) ** 2))
  const innerX = side < 0
    ? Math.min(apex.x - web * 0.5, oculusX - web)
    : Math.max(apex.x + web * 0.5, oculusX + web)
  const outerX = ox + side * Math.max(0, halfAtY - web)
  const pocket = side > 0 ? outerX - innerX : innerX - outerX
  if (!(pocket > minWeb * 2)) return { ok: false, reason: 'shoulder horizontal pocket too small' }

  const s = Math.min(1, Math.max(0.2, scale))
  let r = Math.min((pocket * s) / 2, (yHigh - yLow) * s * 0.45)
  r = Math.min(r, pocket * 0.45)
  if (!(r > minWeb * 0.35)) return { ok: false, reason: 'shoulder radius too small' }

  const cx = (innerX + outerX) / 2
  const center = point(cx, cy)
  const circle = createCircle(center, r)
  const v = validateCircleOpening(circle, parent, web, foilSamples, lancetSamples, [
    createCircle(Oc, Ro),
    ...(others ?? []),
  ])
  if (!v.ok) return { ok: false, reason: `shoulder ${side > 0 ? 'right' : 'left'}: ${v.reason}` }
  return { ok: true, circle, center, radius: r, side: side > 0 ? 'right' : 'left' }
}

function openingRecord(id, type, solved, memberClass = 'SECONDARY_TRACERY') {
  const loop = circleToCwLoop(solved.center, solved.radius)
  return {
    id,
    type,
    edges: loop.edges,
    center: solved.center,
    radius: solved.radius,
    circle: solved.circle,
    memberClass,
    source: 'upper-bar-subdivision',
  }
}

/**
 * Build upper bar-network cells (side + apex + optional shoulders).
 *
 * @param {object} opts
 * @param {number} [opts.upperSubdivisionDensity=0.75] — 0..1 packing aggressiveness
 * @param {boolean} [opts.includeShoulders=true]
 * @param {boolean} [opts.includeApex=true]
 */
export function buildUpperBarSubdivision({
  parent,
  leftChild,
  rightChild,
  oculus,
  foil,
  leftLancetEdges,
  rightLancetEdges,
  secondaryWeb,
  minWeb = 0.05,
  upperSubdivisionDensity = 0.75,
  upperOpeningScale = 0.72,
  includeShoulders = true,
  includeApex = true,
  enabled = true,
} = {}) {
  if (!enabled) {
    return { ok: true, openings: [], errors: [], warnings: [], skipped: true }
  }
  if (!parent?.derived || !oculus?.center || !(oculus.radius > 0)) {
    return {
      ok: false,
      openings: [],
      errors: ['upper bar subdivision requires parent + oculus'],
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
  const density = Math.min(1, Math.max(0.35, upperSubdivisionDensity))
  const scale = upperOpeningScale * (0.85 + 0.3 * density)

  const errors = []
  const warnings = []
  const accepted = []
  const circles = []

  const left = solveSideCell({
    side: -1,
    parent,
    oculus,
    foilSamples,
    lancetSamples,
    web,
    scale,
    minWeb,
    others: circles,
  })
  const right = solveSideCell({
    side: 1,
    parent,
    oculus,
    foilSamples,
    lancetSamples,
    web,
    scale,
    minWeb,
    others: circles,
  })

  // Symmetric pair required for side cells
  if (left.ok && right.ok) {
    accepted.push(
      openingRecord(REGION_TYPES.LEFT_SIDE_CELL_VOID, REGION_TYPES.LEFT_SIDE_CELL_VOID, left),
      openingRecord(REGION_TYPES.RIGHT_SIDE_CELL_VOID, REGION_TYPES.RIGHT_SIDE_CELL_VOID, right),
    )
    circles.push(left.circle, right.circle)
  } else {
    if (!left.ok) errors.push(left.reason)
    if (!right.ok) errors.push(right.reason)
    warnings.push('Side cells omitted — constraint failure (not forced).')
  }

  if (includeApex) {
    const apex = solveApexCell({
      parent,
      oculus,
      foilSamples,
      lancetSamples,
      web,
      scale: scale * 0.9,
      minWeb,
      others: circles,
    })
    if (apex.ok) {
      accepted.push(
        openingRecord(REGION_TYPES.APEX_CELL_VOID, REGION_TYPES.APEX_CELL_VOID, apex),
      )
      circles.push(apex.circle)
    } else {
      warnings.push(`Apex cell omitted: ${apex.reason}`)
    }
  }

  if (includeShoulders && density >= 0.45) {
    const lShoulder = solveShoulderCell({
      side: -1,
      parent,
      leftChild,
      rightChild,
      oculus,
      foilSamples,
      lancetSamples,
      web,
      scale: scale * 0.85,
      minWeb,
      others: circles,
    })
    const rShoulder = solveShoulderCell({
      side: 1,
      parent,
      leftChild,
      rightChild,
      oculus,
      foilSamples,
      lancetSamples,
      web,
      scale: scale * 0.85,
      minWeb,
      others: circles,
    })
    if (lShoulder.ok && rShoulder.ok) {
      accepted.push(
        openingRecord(
          REGION_TYPES.LEFT_SHOULDER_VOID,
          REGION_TYPES.LEFT_SHOULDER_VOID,
          lShoulder,
        ),
        openingRecord(
          REGION_TYPES.RIGHT_SHOULDER_VOID,
          REGION_TYPES.RIGHT_SHOULDER_VOID,
          rShoulder,
        ),
      )
      circles.push(lShoulder.circle, rShoulder.circle)
    } else {
      warnings.push(
        `Shoulder cells omitted: ${[!lShoulder.ok && lShoulder.reason, !rShoulder.ok && rShoulder.reason]
          .filter(Boolean)
          .join('; ')}`,
      )
    }
  }

  // Need at least the side pair OR apex to claim a richer upper network than foil-only.
  const ok = accepted.length > 0
  return {
    ok,
    openings: accepted,
    errors: ok ? [] : errors,
    warnings,
    construction: {
      secondaryWeb: web,
      upperSubdivisionDensity: density,
      upperOpeningScale,
      cellCount: accepted.length,
      rule:
        'Symmetric side cells at oculus height (balanced pocket); optional apex cell; optional shoulder cells between lancet apexes and oculus; all from tangency/clearance constraints.',
    },
  }
}
