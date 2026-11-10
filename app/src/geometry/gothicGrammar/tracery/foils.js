/**
 * Trefoil / quatrefoil construction from intersecting circles (Step 13C / 13E.3.2.2).
 *
 * Computational design rule (informed by REF-006 foil plates, REF-011 trefoils):
 * - Place N equal lobe circles with centers on a regular N-gon about a local origin.
 * - Pairwise intersections: use the OUTER intersection (farther from foil center) as the
 *   cusp. Inner intersections lie inside neighboring lobes and produce a self-intersecting
 *   path if used as boundary joints (root cause of the broken trefoil topology).
 * - The closed opening boundary is the union silhouette: outer circular arcs between
 *   adjacent outer cusps through each lobe tip — cusps preserved, not faired.
 *
 * Tips lie on the enclosing circle of radius `size` (r = size − Rc).
 */

import { point, distance, nearlyEqualPoints } from '../kernel/vector2.js'
import { createCircle, intersectCircles } from '../kernel/circle2.js'
import { createArc, startPoint, endPoint } from '../kernel/arc2.js'
import { sampleArc } from '../kernel/sampling.js'
import {
  validateClosure,
  signedArea,
  windingOrientation,
  detectSelfIntersections,
} from '../kernel/planarRegions.js'
import { intersectArcs } from '../kernel/intersections.js'
import { nearlyEqual, eps } from '../kernel/tolerances.js'
import { rotatePoint } from '../kernel/transforms.js'
import { FOIL_TYPES } from './roles.js'

export const DEFAULT_FOIL_PARAMS = Object.freeze({
  size: 1.0,
  cuspDepth: 0.7,
  orientation: 0,
  rotation: 0,
  centerX: 0,
  centerY: 0,
  samplingQuality: 0.65,
})

/**
 * Max center radius so lobe circles tangent to enclosing circle of radius `size`
 * still pairwise-intersect.
 */
export function maxFoilCenterRadius(size, lobeCount) {
  const s = Math.sin(Math.PI / lobeCount)
  return (size / (1 + s)) * 0.98
}

/**
 * Map cuspDepth ∈ (0,1) → center radius for OUTER-cusp union silhouettes.
 * Higher depth → larger Rc → deeper perimeter indentations (clearer lobes).
 * Quatrefoils keep opposite circles from intersecting so the opening stays simple.
 */
export function foilCenterRadius(size, cuspDepth, lobeCount) {
  const maxRc = maxFoilCenterRadius(size, lobeCount)
  // Trefoil: keep Rc high enough for a recognizable three-lobed clover (not a near-disk).
  let minRc = size * 0.32
  if (lobeCount === 4) {
    // Opposite centers are 2·Rc apart; require 2·Rc ≥ 2·r with r = size − Rc → Rc ≥ size/2
    minRc = Math.min(size * 0.5, maxRc * 0.92)
  }
  const t = Math.min(0.95, Math.max(0.05, cuspDepth))
  return minRc + t * (maxRc - minRc)
}

/**
 * Build the unique arc from `from` → `to` that contains `through`.
 */
export function arcPreferringPoint(circle, from, to, through) {
  const start = Math.atan2(from.y - circle.center.y, from.x - circle.center.x)
  const end = Math.atan2(to.y - circle.center.y, to.x - circle.center.x)
  const via = Math.atan2(through.y - circle.center.y, through.x - circle.center.x)
  const twoPi = Math.PI * 2

  let ccw = end - start
  while (ccw <= 0) ccw += twoPi
  while (ccw > twoPi) ccw -= twoPi

  let m = via - start
  while (m < 0) m += twoPi
  while (m >= twoPi) m -= twoPi
  const onCcw = m <= ccw + 1e-10

  const sweep = onCcw ? ccw : ccw - twoPi
  if (nearlyEqual(sweep, 0, 1) || Math.abs(sweep) < 1e-12) {
    throw new Error('arcPreferringPoint: degenerate sweep')
  }
  return createArc(circle.center, circle.radius, start, sweep)
}

function closerTo(points, target) {
  if (!points?.length) return null
  let best = points[0]
  let bestD = distance(best, target)
  for (let i = 1; i < points.length; i += 1) {
    const d = distance(points[i], target)
    if (d < bestD) {
      best = points[i]
      bestD = d
    }
  }
  return best
}

/** Pick the intersection farther from the foil center (outer cusp on the union silhouette). */
function fartherFrom(points, target) {
  if (!points?.length) return null
  let best = points[0]
  let bestD = distance(best, target)
  for (let i = 1; i < points.length; i += 1) {
    const d = distance(points[i], target)
    if (d > bestD) {
      best = points[i]
      bestD = d
    }
  }
  return best
}

/**
 * N-foil cusped opening.
 * @param {object} params
 * @param {number} params.lobeCount 3 or 4
 */
export function buildNFoil(params = {}) {
  const lobeCount = params.lobeCount ?? 3
  const size = params.size ?? DEFAULT_FOIL_PARAMS.size
  const cuspDepth = params.cuspDepth ?? DEFAULT_FOIL_PARAMS.cuspDepth
  const orientation = params.orientation ?? DEFAULT_FOIL_PARAMS.orientation
  const rotation = params.rotation ?? DEFAULT_FOIL_PARAMS.rotation
  const cx = params.centerX ?? DEFAULT_FOIL_PARAMS.centerX
  const cy = params.centerY ?? DEFAULT_FOIL_PARAMS.centerY
  const samplingQuality = params.samplingQuality ?? DEFAULT_FOIL_PARAMS.samplingQuality
  const center = point(cx, cy)

  const errors = []
  if (!(size > 0) || !Number.isFinite(size)) errors.push('Foil size must be positive and finite')
  if (lobeCount !== 3 && lobeCount !== 4) errors.push('lobeCount must be 3 or 4')
  if (!(cuspDepth > 0 && cuspDepth < 1)) errors.push('cuspDepth must be in (0, 1)')
  if (errors.length) {
    return invalidFoil(lobeCount, params, errors)
  }

  const Rc = foilCenterRadius(size, cuspDepth, lobeCount)
  const r = size - Rc
  if (!(r > 0)) {
    return invalidFoil(lobeCount, params, ['Degenerate lobe radius'])
  }

  const baseAngle = orientation + rotation
  const lobeCenters = []
  for (let i = 0; i < lobeCount; i += 1) {
    const ang = baseAngle + (i * 2 * Math.PI) / lobeCount
    lobeCenters.push(point(cx + Rc * Math.cos(ang), cy + Rc * Math.sin(ang)))
  }

  const circles = lobeCenters.map((c) => createCircle(c, r))
  const enclosing = createCircle(center, size)

  // Pairwise adjacent intersections → OUTER cusps (union silhouette).
  // Inner intersections lie inside neighboring disks and must not joint the boundary.
  const cusps = []
  for (let i = 0; i < lobeCount; i += 1) {
    const j = (i + 1) % lobeCount
    const hit = intersectCircles(circles[i], circles[j])
    if (!hit.points?.length) {
      return invalidFoil(lobeCount, params, [
        `Lobes ${i} and ${j} do not intersect (increase cuspDepth or size)`,
      ])
    }
    const cusp = fartherFrom(hit.points, center)
    if (!cusp) {
      return invalidFoil(lobeCount, params, [`Missing cusp between lobes ${i}/${j}`])
    }
    cusps.push(cusp)
  }

  // Boundary: for lobe i, arc from cusp[i-1] to cusp[i] preferring outer tip
  const arcs = []
  for (let i = 0; i < lobeCount; i += 1) {
    const prevCusp = cusps[(i + lobeCount - 1) % lobeCount]
    const nextCusp = cusps[i]
    const tipAng = baseAngle + (i * 2 * Math.PI) / lobeCount
    const tip = point(
      lobeCenters[i].x + Math.cos(tipAng) * r,
      lobeCenters[i].y + Math.sin(tipAng) * r,
    )
    try {
      arcs.push(arcPreferringPoint(circles[i], prevCusp, nextCusp, tip))
    } catch (err) {
      return invalidFoil(lobeCount, params, [String(err.message ?? err)])
    }
  }

  // Endpoint matching at cusps
  const cuspResiduals = []
  for (let i = 0; i < lobeCount; i += 1) {
    const aEnd = endPoint(arcs[i])
    const bStart = startPoint(arcs[(i + 1) % lobeCount])
    cuspResiduals.push(distance(aEnd, bStart))
  }

  const closure = validateClosure(arcs, size)
  // Adjacent arcs meet at intentional cusps. Check non-adjacent exact arc pairs (N≥4).
  const unintended = nonAdjacentArcHits(arcs, cusps, size)
  // N=3 has no non-adjacent arc pairs — still require a simple sampled loop.
  const loopSelf = detectSelfIntersections(arcs, { segments: 36 })

  const quality = Math.min(1, Math.max(0, samplingQuality))
  const sampleOpts = {
    maxAngularStep: Math.PI / (10 + quality * 28),
    maxChordError: Math.max(0.006, size * (0.025 - quality * 0.015)),
  }
  const samples = []
  for (const arc of arcs) {
    const pts = sampleArc(arc, sampleOpts)
    for (let i = 0; i < pts.length; i += 1) {
      if (samples.length && i === 0) continue
      samples.push(pts[i])
    }
  }

  const area = signedArea(arcs, sampleOpts)
  const orientationWind = windingOrientation(arcs, sampleOpts)
  const cuspRadii = cusps.map((c) => distance(c, center))
  const minCuspRadius = Math.min(...cuspRadii)
  const indentRatio = size > 0 ? 1 - minCuspRadius / size : 0

  // Finite coordinates
  for (const p of [...cusps, ...lobeCenters, ...samples]) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      errors.push('Non-finite coordinate in foil')
      break
    }
  }

  const ok =
    closure.ok &&
    unintended.length === 0 &&
    !loopSelf.selfIntersecting &&
    cuspResiduals.every((d) => d < eps(size) * 40) &&
    errors.length === 0

  if (!ok) {
    if (!closure.ok) errors.push(`Foil not closed: ${closure.reason}`)
    if (unintended.length) errors.push('Unintended self-intersection in foil boundary')
    if (loopSelf.selfIntersecting) {
      errors.push('Foil boundary self-intersects (invalid cusped topology)')
    }
    if (cuspResiduals.some((d) => d >= eps(size) * 40)) {
      errors.push('Cusp endpoint mismatch')
    }
  }

  const foilType = lobeCount === 3 ? FOIL_TYPES.trefoil : FOIL_TYPES.quatrefoil

  return {
    type: 'foil',
    foilType,
    lobeCount,
    parameters: {
      size,
      cuspDepth,
      orientation,
      rotation,
      centerX: cx,
      centerY: cy,
      samplingQuality: quality,
      lobeCount,
    },
    derived: {
      centerRadius: Rc,
      lobeRadius: r,
      enclosingRadius: size,
      signedArea: area,
      winding: orientationWind,
      cuspResiduals,
      minCuspRadius,
      indentRatio,
      cuspConstruction: 'outer-intersection',
    },
    center,
    lobeCenters,
    circles,
    enclosing,
    cusps,
    arcs,
    samples,
    validation: {
      ok,
      errors,
      warnings: [],
      closure,
      selfIntersection: loopSelf,
      rotationalSymmetry: checkRotationalSymmetry(samples, center, lobeCount, size),
      lobeCount,
    },
    metadata: {
      title: lobeCount === 3 ? 'Trefoil' : 'Quatrefoil',
      references: ['REF-006', 'REF-011', 'REF-008'],
      note: 'Cusped foil from outer pairwise intersections of equal circles; simple union silhouette.',
    },
  }
}

/**
 * Non-adjacent arcs must not intersect except at shared cusps (N=3 has no such pairs).
 */
function nonAdjacentArcHits(arcs, cusps, scale) {
  const hits = []
  const n = arcs.length
  const cuspTol = Math.max(eps(scale) * 80, scale * 0.06)
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1)
      if (adjacent) continue
      const raw = intersectArcs(arcs[i], arcs[j])
      for (const p of raw.points ?? []) {
        if (!cusps.some((c) => distance(c, p) < cuspTol)) hits.push(p)
      }
    }
  }
  return hits
}

/**
 * Rotational symmetry via polar radius periodicity (robust to sample phase).
 */
function checkRotationalSymmetry(samples, center, n, scale) {
  if (!samples?.length) return { ok: false, maxError: Infinity }
  const bins = 72
  const radii = new Array(bins).fill(0)
  const counts = new Array(bins).fill(0)
  for (const p of samples) {
    let ang = Math.atan2(p.y - center.y, p.x - center.x)
    if (ang < 0) ang += Math.PI * 2
    const bin = Math.min(bins - 1, Math.floor((ang / (Math.PI * 2)) * bins))
    radii[bin] = Math.max(radii[bin], distance(p, center))
    counts[bin] += 1
  }
  const shift = Math.round(bins / n)
  let maxError = 0
  let compared = 0
  for (let i = 0; i < bins; i += 1) {
    if (!counts[i]) continue
    const j = (i + shift) % bins
    if (!counts[j]) continue
    maxError = Math.max(maxError, Math.abs(radii[i] - radii[j]))
    compared += 1
  }
  const tol = Math.max(eps(scale) * 100, scale * 0.06)
  return { ok: compared > 0 && maxError <= tol, maxError, tolerance: tol, compared }
}

export function buildTrefoil(params = {}) {
  return buildNFoil({ ...params, lobeCount: 3, orientation: params.orientation ?? Math.PI / 2 })
}

/**
 * Quatrefoil. orientation=0 → orthogonal (cardinal lobes);
 * orientation=π/4 → diagonal (rotated).
 */
export function buildQuatrefoil(params = {}) {
  return buildNFoil({
    ...params,
    lobeCount: 4,
    orientation: params.orientation ?? 0,
  })
}

function invalidFoil(lobeCount, params, errors) {
  return {
    type: 'foil',
    foilType: lobeCount === 3 ? FOIL_TYPES.trefoil : FOIL_TYPES.quatrefoil,
    lobeCount,
    parameters: { ...params, lobeCount },
    derived: {},
    center: point(params.centerX ?? 0, params.centerY ?? 0),
    lobeCenters: [],
    circles: [],
    enclosing: null,
    cusps: [],
    arcs: [],
    samples: [],
    validation: { ok: false, errors, warnings: [] },
    metadata: { title: 'Invalid foil', references: ['REF-006'] },
  }
}

/** Foil samples lie inside a circle (oculus). */
export function foilInsideCircle(foil, circle, margin = 0) {
  if (!foil.validation?.ok) return { ok: false, reason: 'invalid_foil', violations: [] }
  const violations = []
  const rMax = circle.radius - margin
  for (const p of foil.samples) {
    if (distance(p, circle.center) > rMax + eps(circle.radius)) {
      violations.push(p)
      if (violations.length > 8) break
    }
  }
  for (const c of foil.cusps) {
    if (distance(c, circle.center) > rMax + eps(circle.radius)) violations.push(c)
  }
  return {
    ok: violations.length === 0,
    reason: violations.length ? 'foil_outside_oculus' : null,
    violations,
  }
}

export { nearlyEqualPoints, nearlyEqual }
