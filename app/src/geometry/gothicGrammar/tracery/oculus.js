/**
 * Upper oculus placement inside a pointed arch (Step 13C).
 *
 * Computational rule: center on the symmetry axis; solve vertical position and
 * radius with explicit circle-in-arch clearance checks (not fixed percentages alone).
 * Informed by REF-008 upper circle packing and REF-007 / REF-011 oculus modules.
 */

import { point } from '../kernel/vector2.js'
import { createCircle } from '../kernel/circle2.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { buildPointedArch } from '../primitives/pointedArch.js'
import { DEFAULT_ARCH_PARAMS } from '../primitives/archFamilies.js'
import {
  archHeightAtX,
  circleInsideArch,
  pointInsideArchOpening,
} from './archContainment.js'
import { buildTrefoil, buildQuatrefoil, foilInsideCircle } from './foils.js'
import {
  createTraceryElement,
  createTraceryGraph,
  addElement,
  finalizeGraph,
  markGraphInvalid,
} from './graph.js'
import { TRACERY_ROLES, TRACERY_ELEMENT_TYPES, FOIL_TYPES } from './roles.js'

export const DEFAULT_OCULUS_PARAMS = Object.freeze({
  family: DEFAULT_ARCH_PARAMS.family,
  span: DEFAULT_ARCH_PARAMS.span,
  riseRatio: DEFAULT_ARCH_PARAMS.riseRatio,
  springingY: DEFAULT_ARCH_PARAMS.springingY,
  samplingQuality: DEFAULT_ARCH_PARAMS.samplingQuality,
  /** 0 = just above lowerBound, 1 = just below parent apex (within solvable band). */
  heightRatio: 0.72,
  /** Fraction of maximum feasible radius at the chosen height. */
  radiusRatio: 0.85,
  clearance: 0.04,
  /** Optional absolute lower Y bound (e.g. above child apices). */
  lowerBoundY: null,
  foilType: FOIL_TYPES.quatrefoil,
  foilScale: 0.88,
  cuspDepth: 0.55,
  foilRotation: 0,
  foilOrientation: 0,
})

/**
 * Maximum circle radius centered at (0, cy) that stays inside the arch opening
 * with the given clearance. Optionally keep the circle above `lowerBoundY`.
 * Returns 0 if none.
 */
export function maxOculusRadiusAtHeight(arch, cy, clearance = 0, lowerBoundY = null) {
  if (!arch?.validation?.ok) return 0
  const ox = arch.parameters.offsetX ?? 0
  // Center must itself be inside
  if (!pointInsideArchOpening(arch, point(ox, cy), clearance)) return 0

  let lo = 0
  let hi = arch.parameters.span * 0.5
  if (lowerBoundY != null && Number.isFinite(lowerBoundY)) {
    hi = Math.min(hi, Math.max(0, cy - lowerBoundY))
  }
  if (!(hi > 0)) return 0
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2
    const circle = createCircle(point(ox, cy), mid)
    const check = circleInsideArch(arch, circle, clearance)
    const aboveFloor = lowerBoundY == null || circle.center.y - circle.radius >= lowerBoundY - 1e-9
    if (check.ok && aboveFloor) lo = mid
    else hi = mid
  }
  return lo
}

/**
 * Solve oculus center Y from heightRatio within [lowerBound, upperBound].
 *
 * @param {object} [opts]
 * @param {boolean} [opts.honorHeightRatio] When true (skeleton / hierarchical),
 *   place at the requested band position when radius stays useful. When false
 *   (composed / bar-network default), use legacy radius-weighted placement so
 *   foil packing stays manifold.
 */
export function solveOculusCenterY(
  arch,
  heightRatio,
  clearance,
  lowerBoundY = null,
  opts = {},
) {
  const ox = arch.parameters.offsetX ?? 0
  const apex = arch.points[ARCH_SEMANTICS.APEX]
  const y0 = arch.parameters.springingY
  const lower = Math.max(y0 + clearance * 2, lowerBoundY ?? y0 + arch.parameters.rise * 0.35)
  const upper = (apex?.y ?? y0 + arch.parameters.rise) - clearance * 2
  if (!(upper > lower)) return { ok: false, y: null, lower, upper }

  const t = Math.min(1, Math.max(0, heightRatio))
  const requested = lower + t * (upper - lower)
  const honor = opts.honorHeightRatio === true

  if (!honor) {
    // Legacy composed / bar-network placement (radius-weighted).
    let bestY = requested
    let bestR = maxOculusRadiusAtHeight(arch, bestY, clearance, lowerBoundY)
    for (let k = 0; k < 12; k += 1) {
      const y = lower + (k / 11) * (upper - lower)
      const r = maxOculusRadiusAtHeight(arch, y, clearance, lowerBoundY)
      const score = r - 0.15 * Math.abs(y - requested)
      const bestScore = bestR - 0.15 * Math.abs(bestY - requested)
      if (score > bestScore) {
        bestY = y
        bestR = r
      }
    }
    const rReq = maxOculusRadiusAtHeight(arch, requested, clearance, lowerBoundY)
    if (rReq >= bestR * 0.85 && rReq > clearance) {
      bestY = requested
      bestR = rReq
    }
    if (!(bestR > clearance)) {
      return { ok: false, y: bestY, maxRadius: bestR, lower, upper, reason: 'no_feasible_radius' }
    }
    return {
      ok: true,
      y: bestY,
      maxRadius: bestR,
      lower,
      upper,
      offsetX: ox,
      placement: 'legacy-radius-weighted',
    }
  }

  // Skeleton / hierarchical — honor heightRatio with a modest radius floor.
  let peakR = 0
  const samples = []
  for (let k = 0; k <= 32; k += 1) {
    const y = lower + (k / 32) * (upper - lower)
    const r = maxOculusRadiusAtHeight(arch, y, clearance, lowerBoundY)
    samples.push({ y, r })
    if (r > peakR) peakR = r
  }
  const rReq = maxOculusRadiusAtHeight(arch, requested, clearance, lowerBoundY)
  const minUseful = Math.max(clearance * 2.5, peakR * 0.42)

  if (rReq >= minUseful) {
    return {
      ok: true,
      y: requested,
      maxRadius: rReq,
      lower,
      upper,
      offsetX: ox,
      placement: 'requested-height',
    }
  }

  let bestY = null
  let bestR = 0
  let bestDist = Infinity
  for (const { y, r } of samples) {
    if (!(r > clearance)) continue
    const useful = r >= minUseful
    if (!useful && bestR >= minUseful) continue
    const dist = Math.abs(y - requested)
    if (
      (useful && bestR < minUseful) ||
      dist < bestDist - 1e-9 ||
      (Math.abs(dist - bestDist) < 1e-9 && r > bestR)
    ) {
      bestY = y
      bestR = r
      bestDist = dist
    }
  }

  if (bestY == null || !(bestR > clearance)) {
    return {
      ok: false,
      y: requested,
      maxRadius: bestR,
      lower,
      upper,
      reason: 'no_feasible_radius',
    }
  }
  return {
    ok: true,
    y: bestY,
    maxRadius: bestR,
    lower,
    upper,
    offsetX: ox,
    placement: 'nearest-useful',
  }
}

/**
 * Build oculus (+ optional foil) inside a parent arch.
 */
export function buildOculusPlacement(params = {}) {
  const p = { ...DEFAULT_OCULUS_PARAMS, ...params }
  const parent = buildPointedArch({
    family: p.family,
    span: p.span,
    riseRatio: p.riseRatio,
    springingY: p.springingY,
    samplingQuality: p.samplingQuality,
  })

  if (!parent.validation?.ok) {
    return emptyOculus(p, parent.validation?.errors ?? ['Parent invalid'])
  }

  const solved = solveOculusCenterY(parent, p.heightRatio, p.clearance, p.lowerBoundY)
  if (!solved.ok) {
    return emptyOculus(p, [
      solved.reason === 'no_feasible_radius'
        ? 'No valid oculus radius at solvable heights (constraint failure)'
        : 'Oculus vertical band is empty (constraint failure)',
    ], parent)
  }

  const radius = solved.maxRadius * Math.min(1, Math.max(0.05, p.radiusRatio))
  if (!(radius > p.clearance)) {
    return emptyOculus(p, ['Resolved oculus radius too small'], parent)
  }

  const center = point(solved.offsetX ?? 0, solved.y)
  const circle = createCircle(center, radius)
  const containment = circleInsideArch(parent, circle, p.clearance)
  if (!containment.ok) {
    return emptyOculus(p, ['Oculus fails parent containment check'], parent)
  }

  let foil = null
  if (p.foilType === FOIL_TYPES.trefoil || p.foilType === FOIL_TYPES.quatrefoil) {
    const foilSize = radius * Math.min(1, Math.max(0.2, p.foilScale))
    const foilParams = {
      size: foilSize,
      cuspDepth: p.cuspDepth,
      rotation: p.foilRotation,
      orientation: p.foilOrientation,
      centerX: center.x,
      centerY: center.y,
      samplingQuality: p.samplingQuality,
    }
    foil =
      p.foilType === FOIL_TYPES.trefoil
        ? buildTrefoil(foilParams)
        : buildQuatrefoil({
            ...foilParams,
            orientation: p.foilOrientation ?? 0,
          })
    const foilIn = foilInsideCircle(foil, circle, p.clearance * 0.25)
    if (!foil.validation?.ok) {
      return emptyOculus(p, foil.validation?.errors ?? ['Foil invalid'], parent, { circle, center, radius, solved })
    }
    if (!foilIn.ok) {
      return emptyOculus(p, ['Foil does not fit inside oculus'], parent, {
        circle,
        center,
        radius,
        solved,
        foil,
      })
    }
  }

  let graph = createTraceryGraph({
    parameters: p,
    derived: {
      centerY: center.y,
      radius,
      maxRadius: solved.maxRadius,
      lowerBound: solved.lower,
      upperBound: solved.upper,
    },
    metadata: {
      title: 'Oculus Placement',
      mode: 'oculus-placement',
      references: ['REF-008', 'REF-011', 'REF-007'],
      parent,
      oculus: { circle, center, radius },
      foil,
    },
  })

  const parentEl = createTraceryElement({
    id: 'parent-arch',
    type: TRACERY_ELEMENT_TYPES.pointedArch,
    role: TRACERY_ROLES.PARENT_ARCH,
    geometry: {
      arch: parent,
      samples: [...(parent.samples?.left ?? []), ...(parent.samples?.right ?? [])],
      points: parent.points,
      arcs: Object.values(parent.arcs ?? {}),
      circles: Object.values(parent.circles ?? {}),
    },
    parameters: parent.parameters,
    derived: parent.derived,
    validation: parent.validation,
  })

  const oculusEl = createTraceryElement({
    id: 'upper-oculus',
    type: TRACERY_ELEMENT_TYPES.oculus,
    role: TRACERY_ROLES.UPPER_OCULUS,
    parentId: parentEl.id,
    geometry: {
      circles: [circle],
      samples: sampleCirclePoints(circle, 64),
      points: { center: { ...center, label: 'O' } },
    },
    parameters: {
      heightRatio: p.heightRatio,
      radiusRatio: p.radiusRatio,
      clearance: p.clearance,
    },
    derived: { radius, maxRadius: solved.maxRadius, centerY: center.y },
    constraints: [
      { type: 'oculus_containment', ok: containment.ok },
      { type: 'radius_positive', ok: radius > 0 },
    ],
    validation: { ok: containment.ok, errors: containment.ok ? [] : ['containment'] },
  })

  graph = addElement(graph, parentEl)
  graph = addElement(graph, oculusEl)

  if (foil) {
    const foilEl = createTraceryElement({
      id: 'oculus-foil',
      type: TRACERY_ELEMENT_TYPES.foil,
      role: foil.foilType === FOIL_TYPES.trefoil ? TRACERY_ROLES.TREFOIL : TRACERY_ROLES.QUATREFOIL,
      parentId: oculusEl.id,
      geometry: {
        arcs: foil.arcs,
        circles: foil.circles,
        samples: foil.samples,
        points: Object.fromEntries(foil.cusps.map((c, i) => [`cusp${i}`, { ...c, label: `K${i}` }])),
        cusps: foil.cusps,
        enclosing: foil.enclosing,
      },
      parameters: foil.parameters,
      derived: foil.derived,
      validation: foil.validation,
    })
    graph = addElement(graph, foilEl)
  }

  graph = { ...graph, rootId: parentEl.id }
  graph.constraints = [
    { type: 'oculus_containment', ok: containment.ok },
    { type: 'feasible_radius', ok: solved.maxRadius > p.clearance },
  ]
  return finalizeGraph(graph)
}

function sampleCirclePoints(circle, n = 64) {
  const pts = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    pts.push({
      x: circle.center.x + Math.cos(a) * circle.radius,
      y: circle.center.y + Math.sin(a) * circle.radius,
    })
  }
  return pts
}

function emptyOculus(params, errors, parent = null, extra = {}) {
  let graph = createTraceryGraph({
    parameters: params,
    metadata: {
      title: 'Oculus Placement (invalid)',
      mode: 'oculus-placement',
      parent,
      ...extra,
    },
  })
  if (parent) {
    graph = addElement(
      graph,
      createTraceryElement({
        id: 'parent-arch',
        type: TRACERY_ELEMENT_TYPES.pointedArch,
        role: TRACERY_ROLES.PARENT_ARCH,
        geometry: {
          arch: parent,
          samples: [...(parent.samples?.left ?? []), ...(parent.samples?.right ?? [])],
          points: parent.points,
        },
        parameters: parent.parameters,
        derived: parent.derived,
        validation: parent.validation,
      }),
    )
    graph = { ...graph, rootId: 'parent-arch' }
  }
  graph = markGraphInvalid(graph, errors[0] ?? 'oculus constraint failure')
  graph.validation.errors = errors
  return graph
}

export { archHeightAtX }
