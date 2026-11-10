/**
 * Curved spandrel / transition openings (Step 13D.4 · Zones C & D).
 *
 * Builds architecturally meaningful cells from parent arch · lancet apexes ·
 * oculus using large clearance-driven packing — not tiny decorative slits.
 *
 * Construction (computational interpretation of REF-008 / REF-011):
 * - Transition cells (Zone C): lateral pockets between lancet heads and oculus
 * - Outer spandrels (Zone D): flanking oculus toward parent jambs
 * - Apex cell: between oculus crown and parent apex when clearance allows
 *
 * Circles are sized from pocket geometry then iteratively shrunk until they
 * satisfy parent-arch containment and clearance — never replaced with slits.
 */

import { point } from '../../kernel/vector2.js'
import { createCircle } from '../../kernel/circle2.js'
import { ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import { archHeightAtX } from '../archContainment.js'
import { circleToCwLoop } from '../spandrelOpenings.js'
import { sampleLoop } from '../openingLoops.js'
import {
  archHalfWidthAtY,
  validateCircleInArch,
  circleClearOfCircle,
} from './architecturalConstraints.js'

const SAMPLE_OPTS = { segments: 20 }

function openingFromCircle(id, type, zone, circle, memberClass = 'SPANDREL_CONNECTOR') {
  const loop = circleToCwLoop(circle.center, circle.radius)
  return {
    id,
    type,
    zone,
    level: 2,
    edges: loop.edges,
    center: circle.center,
    radius: circle.radius,
    circle,
    memberClass,
    source: 'curved-spandrel-packing',
  }
}

/**
 * Shrink a candidate circle until it validates (or fails).
 */
function fitCircle({
  center,
  maxRadius,
  minRadius,
  parent,
  web,
  foilSamples,
  lancetSamples,
  others,
  oculus,
  oculusGap,
}) {
  let r = maxRadius
  const steps = 18
  // Extra gap vs oculus / siblings keeps Earcut extrusion manifold
  const gapOculus = Math.max(oculusGap ?? web, web * 1.6, 0.09)
  const gapSibling = Math.max(web * 1.1, 0.055)
  for (let i = 0; i < steps; i += 1) {
    if (!(r >= minRadius)) break
    const circle = createCircle(center, r)
    const v = validateCircleInArch(circle, parent, web * 0.55, [foilSamples, lancetSamples])
    const clearOculus =
      !oculus ||
      circleClearOfCircle(circle, createCircle(oculus.center, oculus.radius), gapOculus)
    let clearSiblings = true
    for (const o of others ?? []) {
      if (!circleClearOfCircle(circle, o, gapSibling)) {
        clearSiblings = false
        break
      }
    }
    if (v.ok && clearOculus && clearSiblings) {
      return { ok: true, circle, center, radius: r }
    }
    r *= 0.86
  }
  return { ok: false, reason: 'no valid radius after shrink' }
}

/**
 * Zone D — outer spandrel flanking the oculus toward the jamb.
 * Placed slightly below oculus center where the parent arch is wider.
 */
function solveOuterSpandrel({
  side,
  parent,
  oculus,
  web,
  scale,
  minWeb,
  foilSamples,
  lancetSamples,
  others,
  primaryArch,
}) {
  const Oc = oculus.center
  const Ro = oculus.radius
  const ox = parent.parameters.offsetX ?? 0
  const apex = primaryArch?.points?.[ARCH_SEMANTICS.APEX]
  // Prefer a Y between lancet apex and oculus mid — wider arch, larger pocket
  const yWide = apex ? (apex.y + Oc.y) * 0.5 : Oc.y - Ro * 0.15
  const y = Math.min(Oc.y - Ro * 0.05, Math.max(yWide, Oc.y - Ro * 0.55))

  const halfAtY = archHalfWidthAtY(parent, y)
  const oculusHalf = Math.sqrt(Math.max(0, Ro * Ro - (y - Oc.y) ** 2))
  const innerX = Oc.x + side * (oculusHalf + web * 0.9)
  const outerLimit = ox + side * Math.max(0, halfAtY - web * 0.7)
  const pocket = side > 0 ? outerLimit - innerX : innerX - outerLimit
  if (!(pocket > minWeb * 1.8)) return { ok: false, reason: 'outer pocket too narrow' }

  const s = Math.min(0.98, Math.max(0.55, scale))
  const maxR = Math.min((pocket * s) / 2, pocket * 0.48)
  const cx = (innerX + outerLimit) / 2
  return fitCircle({
    center: point(cx, y),
    maxRadius: maxR,
    minRadius: minWeb * 0.55,
    parent,
    web,
    foilSamples,
    lancetSamples,
    others,
    oculus,
    oculusGap: Math.max(web * 1.8, minWeb * 2.0, 0.09),
  })
}

/**
 * Zone C — transition cell between primary lancet head and oculus flank.
 * Pocket sits between the oculus rim (inboard) and the primary apex / jamb (outboard).
 */
function solveTransition({
  side,
  parent,
  primaryArch,
  oculus,
  web,
  scale,
  minWeb,
  foilSamples,
  lancetSamples,
  others,
}) {
  const apex = primaryArch?.points?.[ARCH_SEMANTICS.APEX]
  if (!apex) return { ok: false, reason: 'missing primary apex' }
  const Oc = oculus.center
  const Ro = oculus.radius
  const ox = parent.parameters.offsetX ?? 0

  // Sit just above the primary apex, below oculus equator — REF-011 spandrel band
  const cy = apex.y + Math.max(web * 1.2, (Oc.y - Ro - apex.y) * 0.55 + web)
  const halfAtY = archHalfWidthAtY(parent, cy)
  if (!(halfAtY > minWeb * 2)) return { ok: false, reason: 'transition arch too narrow' }

  const oculusHalf = Math.sqrt(Math.max(0, Ro * Ro - (cy - Oc.y) ** 2))
  // Inboard limit: clear of oculus rim
  const inboard = Oc.x + side * (oculusHalf + web * 0.95)
  // Outboard limit: inside parent jamb, near primary apex
  const jamb = ox + side * Math.max(0, halfAtY - web * 0.7)
  const nearApex = apex.x + side * web * 0.35
  const outboard = side < 0 ? Math.max(jamb, nearApex) : Math.min(jamb, nearApex)

  const pocket = side > 0 ? outboard - inboard : inboard - outboard
  if (!(pocket > minWeb * 1.8)) return { ok: false, reason: 'transition pocket insufficient' }

  const s = Math.min(0.96, Math.max(0.5, scale))
  const vertRoom = Math.max(minWeb, Oc.y - Ro - apex.y + Ro * 0.35)
  const maxR = Math.min((pocket * s) / 2, vertRoom * 0.45, pocket * 0.47, Ro * 0.62)
  const cx = (inboard + outboard) / 2
  return fitCircle({
    center: point(cx, cy),
    maxRadius: maxR,
    minRadius: minWeb * 0.5,
    parent,
    web,
    foilSamples,
    lancetSamples,
    others,
    oculus,
    oculusGap: Math.max(web * 1.8, minWeb * 2.0, 0.09),
  })
}

function solveApex({ parent, oculus, web, scale, minWeb, foilSamples, lancetSamples, others }) {
  const Oc = oculus.center
  const Ro = oculus.radius
  const ox = parent.parameters.offsetX ?? 0
  const apexY = archHeightAtX(parent, ox)
  if (apexY == null) return { ok: false, reason: 'no parent apex' }
  const innerY = Oc.y + Ro + web * 0.85
  const outerY = apexY - web * 0.75
  const pocket = outerY - innerY
  if (!(pocket > minWeb * 1.6)) return { ok: false, reason: 'apex pocket too narrow' }

  const s = Math.min(0.94, Math.max(0.45, scale))
  let maxR = (pocket * s) / 2
  const cy = (innerY + outerY) / 2
  const half = archHalfWidthAtY(parent, cy)
  maxR = Math.min(maxR, pocket * 0.46, Math.max(0, half - web * 0.7))
  return fitCircle({
    center: point(ox, cy),
    maxRadius: maxR,
    minRadius: minWeb * 0.4,
    parent,
    web,
    foilSamples,
    lancetSamples,
    others,
    oculus,
    oculusGap: Math.max(web * 1.8, minWeb * 2.0, 0.09),
  })
}

/**
 * Build Zone C + Zone D openings around a validated oculus.
 */
export function buildCurvedSpandrels({
  parent,
  leftPrimary,
  rightPrimary,
  oculus,
  foil,
  lancetEdges = [],
  secondaryWeb = 0.045,
  minWeb = 0.035,
  upperSubdivisionComplexity = 0.85,
  enabled = true,
} = {}) {
  if (!enabled) {
    return { ok: true, openings: [], warnings: [], errors: [], skipped: true }
  }
  if (!parent?.derived || !oculus?.center || !(oculus.radius > 0)) {
    return {
      ok: false,
      openings: [],
      errors: ['curved spandrels require parent + oculus'],
      warnings: [],
    }
  }

  const foilSamples = foil?.samples?.length
    ? foil.samples
    : foil?.arcs
      ? sampleLoop(foil.arcs, SAMPLE_OPTS)
      : []
  let lancetPts = []
  if (Array.isArray(lancetEdges) && lancetEdges.length) {
    if (lancetEdges[0]?.x != null) lancetPts = lancetEdges
    else {
      for (const edges of lancetEdges) {
        if (edges?.length) lancetPts.push(...sampleLoop(edges, SAMPLE_OPTS))
      }
    }
  }

  const web = Math.max(minWeb * 0.85, secondaryWeb * 0.9)
  const complexity = Math.min(1, Math.max(0, upperSubdivisionComplexity))
  const scale = 0.78 + 0.2 * Math.max(0.45, complexity)

  const warnings = []
  const openings = []
  const circles = []

  // Zone D first — outer spandrels flanking oculus (REF-011). Deterministic
  // preference over Zone C when both would pinch the foil for Earcut extrusion.
  const leftOuter = solveOuterSpandrel({
    side: -1,
    parent,
    oculus,
    web,
    scale,
    minWeb,
    foilSamples,
    lancetSamples: [],
    others: circles,
    primaryArch: leftPrimary,
  })
  const rightOuter = solveOuterSpandrel({
    side: 1,
    parent,
    oculus,
    web,
    scale,
    minWeb,
    foilSamples,
    lancetSamples: [],
    others: circles,
    primaryArch: rightPrimary,
  })
  if (leftOuter.ok && rightOuter.ok) {
    openings.push(
      openingFromCircle(
        'LEFT_OUTER_SPANDREL',
        'LEFT_OUTER_SPANDREL',
        'ZONE_D_OUTER_SPANDRELS',
        leftOuter.circle,
      ),
      openingFromCircle(
        'RIGHT_OUTER_SPANDREL',
        'RIGHT_OUTER_SPANDREL',
        'ZONE_D_OUTER_SPANDRELS',
        rightOuter.circle,
      ),
    )
    circles.push(leftOuter.circle, rightOuter.circle)
  } else {
    warnings.push(
      `Outer spandrels omitted: ${[!leftOuter.ok && leftOuter.reason, !rightOuter.ok && rightOuter.reason]
        .filter(Boolean)
        .join('; ')}`,
    )
  }

  // Zone C — only when Zone D failed (fallback bridge cells)
  const hasOuters = openings.some((o) => o.zone === 'ZONE_D_OUTER_SPANDRELS')
  if (!hasOuters && complexity >= 0.45) {
    const leftT = solveTransition({
      side: -1,
      parent,
      primaryArch: leftPrimary,
      oculus,
      web,
      scale: scale * 0.95,
      minWeb,
      foilSamples,
      lancetSamples: [],
      others: circles,
    })
    const rightT = solveTransition({
      side: 1,
      parent,
      primaryArch: rightPrimary,
      oculus,
      web,
      scale: scale * 0.95,
      minWeb,
      foilSamples,
      lancetSamples: [],
      others: circles,
    })
    if (leftT.ok && rightT.ok) {
      openings.push(
        openingFromCircle(
          'LEFT_TRANSITION',
          'LEFT_TRANSITION',
          'ZONE_C_TRANSITION_FIELD',
          leftT.circle,
        ),
        openingFromCircle(
          'RIGHT_TRANSITION',
          'RIGHT_TRANSITION',
          'ZONE_C_TRANSITION_FIELD',
          rightT.circle,
        ),
      )
      circles.push(leftT.circle, rightT.circle)
    } else {
      warnings.push(
        `Transition cells omitted: ${[!leftT.ok && leftT.reason, !rightT.ok && rightT.reason]
          .filter(Boolean)
          .join('; ')}`,
      )
    }
  } else if (hasOuters) {
    warnings.push(
      'Zone C transitions deferred: Zone D outer spandrels preferred for manifold foil clearance',
    )
  }

  // Apex — only when radius stays meaningful (no decorative slits)
  if (complexity >= 0.7) {
    const apex = solveApex({
      parent,
      oculus,
      web,
      scale: scale * 0.85,
      minWeb,
      foilSamples,
      lancetSamples: [],
      others: circles,
    })
    if (apex.ok && apex.radius >= minWeb * 1.6) {
      openings.push(
        openingFromCircle('APEX_SPANDREL', 'APEX_SPANDREL', 'ZONE_D_OUTER_SPANDRELS', apex.circle),
      )
      circles.push(apex.circle)
    } else {
      warnings.push(
        `Apex cell omitted: ${apex.ok ? `radius ${apex.radius?.toFixed?.(3)} below meaningful threshold` : apex.reason}`,
      )
    }
  }

  return {
    ok: openings.length > 0,
    openings,
    warnings,
    errors: openings.length ? [] : ['no curved spandrel cells could be constructed'],
    construction: {
      secondaryWeb: web,
      upperSubdivisionComplexity: complexity,
      cellCount: openings.length,
      rule:
        'Large clearance-packed cells in Zones C/D from parent·lancet·oculus relationships; iterative shrink-to-fit; symmetric pairs required; invalid cells omitted (not replaced with slits).',
    },
  }
}
