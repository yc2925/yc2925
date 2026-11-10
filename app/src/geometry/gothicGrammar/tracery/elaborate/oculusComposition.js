/**
 * Dominant upper oculus composition (Step 13D.4 · Zone B).
 *
 * A. CENTRAL QUATREFOIL OCULUS (implemented first)
 * B. RADIAL MULTIFOIL — constrained radial lobes when foilCount > 4
 *
 * The oculus is a major organizing element — large, not a tiny ornament.
 * The foil void is the architectural hole; the oculus circle is the ring frame.
 */

import { point } from '../../kernel/vector2.js'
import { createCircle } from '../../kernel/circle2.js'
import { ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import { solveOculusCenterY } from '../oculus.js'
import { circleInsideArch } from '../archContainment.js'
import { buildQuatrefoil, buildTrefoil, buildNFoil, foilInsideCircle } from '../foils.js'
import { ensureCw } from '../openingLoops.js'
import { validateClosure } from '../../kernel/planarRegions.js'
import { FOIL_TYPES } from '../roles.js'

const SAMPLE_OPTS = { segments: 28 }

function foilToVoid(foil) {
  if (!foil?.validation?.ok || !foil.arcs?.length) {
    return { ok: false, errors: foil?.validation?.errors ?? ['invalid foil'], edges: [] }
  }
  const closure = validateClosure(foil.arcs, foil.parameters?.size ?? 1)
  const oriented = ensureCw(foil.arcs, SAMPLE_OPTS)
  const errors = []
  if (!closure.ok) errors.push(`foil not closed: ${closure.reason}`)
  return { ok: errors.length === 0, errors, edges: oriented.edges, foil }
}

/**
 * Solve a large upper oculus above the lancet field and build foil void.
 */
export function buildOculusComposition({
  parent,
  leftPrimary,
  rightPrimary,
  oculusHeightRatio = 0.82,
  oculusScale = 0.92,
  oculusClearance = 0.035,
  foilType = FOIL_TYPES.quatrefoil,
  foilScale = 0.88,
  cuspDepth = 0.52,
  foilRotation = 0,
  foilCount = 4,
  radialRotation = 0,
  samplingQuality = 0.65,
} = {}) {
  if (!parent?.derived) {
    return { ok: false, errors: ['oculus requires parent arch'], openings: [] }
  }

  const leftApex = leftPrimary?.points?.[ARCH_SEMANTICS.APEX]
  const rightApex = rightPrimary?.points?.[ARCH_SEMANTICS.APEX]
  const lowerBoundY =
    Math.max(leftApex?.y ?? 0, rightApex?.y ?? 0) + oculusClearance * 1.2

  const solved = solveOculusCenterY(parent, oculusHeightRatio, oculusClearance, lowerBoundY)
  if (!solved.ok) {
    return {
      ok: false,
      errors: [`oculus placement failed: ${solved.reason ?? 'empty band'}`],
      openings: [],
    }
  }

  const center = point(solved.offsetX ?? 0, solved.y)
  // Dominant oculus, but reserve a transition band above lancet apexes (Zone C).
  // Computational interpretation of REF-008 / REF-011: oculus is major, not maximal.
  const roomAbove = center.y - lowerBoundY
  const reservedBand = Math.max(oculusClearance * 1.8, roomAbove * 0.14)
  const radius = Math.min(
    solved.maxRadius * Math.min(0.96, Math.max(0.35, oculusScale)),
    Math.max(0, roomAbove - reservedBand),
  )
  if (!(radius > oculusClearance * 1.5)) {
    return { ok: false, errors: ['oculus radius too small for elaborate composition'], openings: [] }
  }

  const circle = createCircle(center, radius)
  const containment = circleInsideArch(parent, circle, oculusClearance)
  if (!containment.ok) {
    return { ok: false, errors: ['oculus escapes parent arch'], openings: [] }
  }
  if (center.y - radius < lowerBoundY - 1e-6) {
    return { ok: false, errors: ['oculus intersects lancet field'], openings: [] }
  }

  const foilSize = radius * Math.min(1, Math.max(0.35, foilScale))
  const foilParams = {
    size: foilSize,
    cuspDepth,
    rotation: foilRotation + radialRotation,
    orientation: 0,
    centerX: center.x,
    centerY: center.y,
    samplingQuality,
  }

  let foil
  const count = Math.round(foilCount)
  if (count === 3 || foilType === FOIL_TYPES.trefoil) {
    foil = buildTrefoil({ ...foilParams, orientation: Math.PI / 2 })
  } else if (count === 4 || foilType === FOIL_TYPES.quatrefoil) {
    foil = buildQuatrefoil(foilParams)
  } else if (count >= 5 && count <= 8) {
    // Radial multifoil (composition B) — constrained N-foil
    foil = buildNFoil({ ...foilParams, lobeCount: count })
  } else {
    foil = buildQuatrefoil(foilParams)
  }

  if (!foil.validation?.ok) {
    return {
      ok: false,
      errors: foil.validation?.errors ?? ['foil invalid'],
      openings: [],
      oculus: { circle, center, radius },
    }
  }

  const foilIn = foilInsideCircle(foil, circle, oculusClearance * 0.15)
  if (!foilIn.ok) {
    return {
      ok: false,
      errors: ['foil does not fit inside oculus ring'],
      openings: [],
      oculus: { circle, center, radius },
      foil,
    }
  }

  const voidLoop = foilToVoid(foil)
  if (!voidLoop.ok) {
    return {
      ok: false,
      errors: voidLoop.errors,
      openings: [],
      oculus: { circle, center, radius },
      foil,
    }
  }

  return {
    ok: true,
    errors: [],
    warnings: [],
    oculus: { circle, center, radius, maxRadius: solved.maxRadius, lowerBoundY },
    foil,
    openings: [
      {
        id: 'UPPER_OCULUS_FOIL',
        type: 'UPPER_OCULUS_FOIL',
        zone: 'ZONE_B_UPPER_TRACERY_FIELD',
        level: 1,
        edges: voidLoop.edges,
        foil,
        oculus: { center, radius },
        memberClass: 'FOIL_BAR',
      },
    ],
    construction: {
      mode: count > 4 ? 'radial-multifoil' : 'central-foil-oculus',
      oculusHeightRatio,
      oculusScale,
      foilScale,
      foilCount: count,
      rule:
        'Dominant oculus solved above lancet apexes; foil is the sole hole inside the ring (no overlapping circle+foil holes).',
    },
  }
}
