/**
 * Deterministic opening-arrangement solver for Rayonnant Elaborate (Step 13D.4).
 *
 * Sequence:
 * 1. Parent envelope context
 * 2. Hierarchical lancet field (Zone A)
 * 3. Dominant oculus + foil (Zone B)
 * 4. Curved spandrels / transitions (Zones C–D)
 * 5. Validate containment / overlap / clearances
 */

import { DEFAULT_ARCH_PARAMS, ARCH_FAMILIES } from '../../primitives/archFamilies.js'
import { DEFAULT_COMPOSED_PARAMS } from '../composedWindow.js'
import { FOIL_TYPES } from '../roles.js'
import { buildHierarchicalLancets } from './hierarchicalLancets.js'
import { buildOculusComposition } from './oculusComposition.js'
import { buildCurvedSpandrels } from './curvedSpandrels.js'
import { porosityMetrics } from './architecturalConstraints.js'

export const DEFAULT_ELABORATE_PARAMS = Object.freeze({
  family: DEFAULT_ARCH_PARAMS.family,
  span: DEFAULT_COMPOSED_PARAMS.span,
  riseRatio: DEFAULT_COMPOSED_PARAMS.riseRatio,
  springingY: DEFAULT_COMPOSED_PARAMS.springingY,
  samplingQuality: DEFAULT_COMPOSED_PARAMS.samplingQuality,
  subdivisionRatio: 0.5,
  mullionWidth: 0.085,
  jambInset: 0.035,
  childRiseRatio: 1.12,
  childFamily: ARCH_FAMILIES.lancet,
  symmetric: true,
  containmentMargin: 0.01,
  nestingDepth: 2,
  secondaryMullionWidth: 0.045,
  secondaryJambInset: 0.018,
  secondaryLancetRatio: 1.1,
  oculusHeightRatio: 0.84,
  oculusScale: 0.94,
  oculusClearance: 0.032,
  foilType: FOIL_TYPES.quatrefoil,
  foilScale: 0.9,
  cuspDepth: 0.5,
  foilRotation: 0,
  foilCount: 4,
  radialRotation: 0,
  upperSubdivisionComplexity: 0.88,
  secondaryTraceryWidth: 0.042,
  minStoneWebWidth: 0.035,
  minWebClearance: 0.035,
  windowBaseElevation: -0.35,
  outerFrameWidth: 0.1,
})

/**
 * Solve the full elaborate opening hierarchy.
 */
export function solveOpeningArrangement(params = {}) {
  const p = { ...DEFAULT_ELABORATE_PARAMS, ...params }
  const warnings = []
  const errors = []

  // 1–2 Zone A
  const lancets = buildHierarchicalLancets(p)
  if (!lancets.ok) {
    return {
      ok: false,
      openings: [],
      zones: {},
      lancets,
      oculus: null,
      spandrels: null,
      validation: { ok: false, errors: lancets.errors, warnings: lancets.warnings },
      parameters: p,
    }
  }
  warnings.push(...(lancets.warnings ?? []))

  const parent = lancets.parent
  const leftPrimary = lancets.leftPrimary
  const rightPrimary = lancets.rightPrimary

  // 3 Zone B — dominant oculus
  const oculus = buildOculusComposition({
    parent,
    leftPrimary,
    rightPrimary,
    oculusHeightRatio: p.oculusHeightRatio,
    oculusScale: p.oculusScale,
    oculusClearance: p.oculusClearance,
    foilType: p.foilType,
    foilScale: p.foilScale,
    cuspDepth: p.cuspDepth,
    foilRotation: p.foilRotation,
    foilCount: p.foilCount,
    radialRotation: p.radialRotation,
    samplingQuality: p.samplingQuality,
  })
  if (!oculus.ok) {
    return {
      ok: false,
      openings: [...lancets.openings],
      zones: { A: lancets },
      lancets,
      oculus,
      spandrels: null,
      validation: {
        ok: false,
        errors: oculus.errors ?? ['oculus failed'],
        warnings,
      },
      parameters: p,
    }
  }

  // 4 Zones C–D
  const spandrels = buildCurvedSpandrels({
    parent,
    leftPrimary,
    rightPrimary,
    oculus: oculus.oculus,
    foil: oculus.foil,
    lancetEdges: lancets.openings.map((o) => o.edges),
    secondaryWeb: p.secondaryTraceryWidth,
    minWeb: Math.max(p.minWebClearance, p.minStoneWebWidth),
    upperSubdivisionComplexity: p.upperSubdivisionComplexity,
    enabled: true,
  })
  warnings.push(...(spandrels.warnings ?? []))
  if (!spandrels.ok) {
    // Soft-fail: keep lancets + oculus if spandrels cannot be built
    warnings.push(...(spandrels.errors ?? ['spandrels unavailable']))
  }

  const openings = [
    ...lancets.openings,
    ...oculus.openings,
    ...(spandrels.ok ? spandrels.openings : []),
  ]

  // Deterministic scoring note: prefer more Zone C/D cells when both valid —
  // the builder already emits all valid cells in fixed order.

  if (openings.length < 5) {
    errors.push(`elaborate composition under-specified (${openings.length} openings)`)
  }

  return {
    ok: errors.length === 0,
    openings,
    zones: {
      A: { openings: lancets.openings, nestingDepth: lancets.nestingDepth },
      B: { openings: oculus.openings, construction: oculus.construction },
      C: {
        openings: (spandrels.openings ?? []).filter((o) => o.zone?.includes('TRANSITION')),
      },
      D: {
        openings: (spandrels.openings ?? []).filter((o) => o.zone?.includes('OUTER') || o.type === 'APEX_SPANDREL'),
      },
    },
    lancets,
    oculus,
    spandrels,
    parent,
    leftPrimary,
    rightPrimary,
    validation: { ok: errors.length === 0, errors, warnings },
    parameters: p,
    metadata: {
      title: 'Rayonnant Elaborate · Opening Arrangement',
      version: '13D.4',
      references: ['REF-004', 'REF-007', 'REF-008', 'REF-009', 'REF-011', 'REF-016'],
      scoring:
        'Deterministic fixed construction order; all geometrically valid Zone C/D cells included; no random choice.',
    },
  }
}

export { porosityMetrics }
