/**
 * Stone / tracery architectural presets (Step 13D.2).
 * BASELINE_13D preserves the validated 13D.1 composition.
 * RAYONNANT_REFINED applies slender bar-tracery proportions + spandrel openings.
 */

import {
  DEFAULT_PROPORTION_RATIOS,
  BASELINE_MEMBER_WIDTHS,
  resolveMemberWidths,
} from './memberHierarchy.js'
import { DEFAULT_COMPOSED_PARAMS } from './composedWindow.js'
import { DEFAULT_REGION_PARAMS } from './regionRoles.js'
import { DEFAULT_STONE_PARAMS } from '../solids/stoneAssembly.js'

export const ARCHITECTURE_PRESETS = Object.freeze({
  BASELINE_13D: 'baseline-13d',
  RAYONNANT_REFINED: 'rayonnant-refined',
  RAYONNANT_BAR_NETWORK: 'rayonnant-bar-network',
  RAYONNANT_ELABORATE: 'rayonnant-elaborate',
  RAYONNANT_SKELETON: 'rayonnant-skeleton',
  RAYONNANT_OCULUS_NETWORK: 'rayonnant-oculus-network',
  RAYONNANT_SECONDARY_TRACERY: 'rayonnant-secondary-tracery',
  RAYONNANT_OCULUS_REFINED: 'rayonnant-oculus-refined',
  RAYONNANT_HIERARCHICAL: 'rayonnant-hierarchical',
  /** Editable shared-module preset matching preferred Assembly window (13E.3.2). */
  RAYONNANT_FACADE_MODULE: 'rayonnant-facade-module',
})

export const ARCHITECTURE_PRESET_OPTIONS = [
  { id: ARCHITECTURE_PRESETS.BASELINE_13D, label: 'Baseline 13D' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_REFINED, label: 'Rayonnant Refined' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK, label: 'Rayonnant Bar Network' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE, label: 'Rayonnant Elaborate' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_SKELETON, label: 'Rayonnant Skeleton' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK, label: 'Rayonnant Oculus Network' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY, label: 'Rayonnant Secondary Tracery' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED, label: 'Rayonnant Oculus Refined' },
  { id: ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL, label: 'Rayonnant Hierarchical' },
  {
    id: ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
    label: 'Rayonnant Facade Module',
  },
]

/** Frozen Baseline 13D — must remain visually/topologically equivalent to pre-13D.2. */
export const PRESET_BASELINE_13D = Object.freeze({
  id: ARCHITECTURE_PRESETS.BASELINE_13D,
  label: 'Baseline 13D',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: false,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  enableOculusRefinement: false,
  enableHierarchicalTracery: false,
  useProportionRatios: false,
  proportions: { ...DEFAULT_PROPORTION_RATIOS },
  tracery: {
    outerFrameWidth: BASELINE_MEMBER_WIDTHS.outerFrameWidth,
    mullionWidth: BASELINE_MEMBER_WIDTHS.primaryMullionWidth,
    jambInset: BASELINE_MEMBER_WIDTHS.jambInset,
    minStoneWebWidth: DEFAULT_REGION_PARAMS.minStoneWebWidth,
    foilScale: DEFAULT_COMPOSED_PARAMS.foilScale,
    cuspDepth: DEFAULT_COMPOSED_PARAMS.cuspDepth,
    oculusClearance: DEFAULT_COMPOSED_PARAMS.oculusClearance,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
  },
  stone: {
    moldingHierarchy: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: DEFAULT_STONE_PARAMS.profileWidth,
    profileDepth: DEFAULT_STONE_PARAMS.profileDepth,
    chamferSize: DEFAULT_STONE_PARAMS.chamferSize,
    beadRadius: DEFAULT_STONE_PARAMS.beadRadius,
    recessDepth: DEFAULT_STONE_PARAMS.recessDepth,
  },
  references: ['REF-008', 'REF-011'],
  note: 'Pre-13D.2 composed window — panel with three voids, uniform molding profile.',
})

/** Rayonnant refined — slender members, spandrel openings, molding hierarchy. */
export const PRESET_RAYONNANT_REFINED = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
  label: 'Rayonnant Refined',
  enableSpandrelOpenings: true,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: false,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  useProportionRatios: true,
  proportions: {
    outerFrameWidthRatio: 0.052,
    primaryMullionWidthRatio: 0.58,
    secondaryTraceryWidthRatio: 0.38,
    oculusFrameWidthRatio: 0.4,
    foilBarWidthRatio: 0.26,
    upperOpeningScale: 0.68,
  },
  tracery: {
    // Absolute fields filled by applyArchitecturePreset from span
    foilScale: 0.8,
    cuspDepth: 0.5,
    oculusClearance: 0.05,
    oculusRadiusRatio: 0.88,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
  },
  stone: {
    moldingHierarchy: true,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.055,
    profileDepth: 0.075,
    chamferSize: 0.018,
    beadRadius: 0.01,
    recessDepth: 0.016,
  },
  references: ['REF-011', 'REF-007', 'REF-012', 'REF-009'],
  note: 'Bar-tracery proportions + symmetric upper spandrel openings + member molding hierarchy.',
})

/**
 * Rayonnant bar network — connected member graph + upper cell subdivision.
 * Does not mutate Baseline / Refined geometries; separate generative path.
 */
export const PRESET_RAYONNANT_BAR_NETWORK = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
  label: 'Rayonnant Bar Network',
  enableSpandrelOpenings: false,
  enableBarNetwork: true,
  enableElaborate: false,
  enableSkeleton: false,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  useProportionRatios: true,
  proportions: {
    outerFrameWidthRatio: 0.048,
    primaryMullionWidthRatio: 0.6,
    lancetArchWidthRatio: 0.55,
    secondaryTraceryWidthRatio: 0.35,
    oculusFrameWidthRatio: 0.4,
    foilBarWidthRatio: 0.25,
    upperOpeningScale: 0.72,
    upperSubdivisionDensity: 0.78,
  },
  tracery: {
    foilScale: 0.78,
    cuspDepth: 0.5,
    oculusClearance: 0.045,
    oculusRadiusRatio: 0.86,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    minWebClearance: 0.04,
  },
  stone: {
    moldingHierarchy: true,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.05,
    profileDepth: 0.07,
    chamferSize: 0.016,
    beadRadius: 0.009,
    recessDepth: 0.014,
  },
  references: ['REF-006', 'REF-008', 'REF-011', 'REF-007', 'REF-009'],
  note: 'Connected bar-network graph; stone derived from members + upper cell voids.',
})

/**
 * Rayonnant Elaborate — hierarchical zones, nested lancets, dominant oculus,
 * large curved spandrels. Does not overwrite prior presets.
 */
export const PRESET_RAYONNANT_ELABORATE = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE,
  label: 'Rayonnant Elaborate',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: true,
  enableSkeleton: false,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  useProportionRatios: true,
  proportions: {
    outerFrameWidthRatio: 0.042,
    primaryMullionWidthRatio: 0.55,
    lancetArchWidthRatio: 0.5,
    secondaryTraceryWidthRatio: 0.32,
    oculusFrameWidthRatio: 0.36,
    foilBarWidthRatio: 0.22,
    upperOpeningScale: 0.88,
    upperSubdivisionDensity: 0.88,
  },
  tracery: {
    nestingDepth: 2,
    secondaryMullionWidth: 0.045,
    secondaryJambInset: 0.018,
    secondaryLancetRatio: 1.1,
    oculusHeightRatio: 0.84,
    oculusScale: 0.94,
    oculusClearance: 0.032,
    foilScale: 0.9,
    cuspDepth: 0.5,
    foilCount: 4,
    upperSubdivisionComplexity: 0.88,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    minWebClearance: 0.035,
    childRiseRatio: 1.12,
    jambInset: 0.035,
  },
  stone: {
    moldingHierarchy: true,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.042,
    profileDepth: 0.06,
    chamferSize: 0.014,
    beadRadius: 0.008,
    recessDepth: 0.012,
  },
  references: ['REF-004', 'REF-007', 'REF-008', 'REF-009', 'REF-011', 'REF-016'],
  note: 'Nested four-light lancet field + dominant oculus foil + large curved spandrels.',
})

/**
 * Rayonnant Skeleton — centerline strips unioned into stone (Step 13D.5).
 * Extrusion uses strip union, not outer⊕holes panel.
 */
export const PRESET_RAYONNANT_SKELETON = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_SKELETON,
  label: 'Rayonnant Skeleton',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: true,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  useProportionRatios: false,
  tracery: {
    masterFrameWidth: 0.12,
    outerFrameWidth: 0.12,
    primaryArchWidthRatio: 1.0,
    mullionWidthRatio: 0.67,
    childArchWidthRatio: 0.54,
    mullionWidth: 0.08,
    jambInset: 0.055,
    childRiseRatio: 1.08,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
  },
  stone: {
    moldingHierarchy: false,
    moldingEnabled: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.04,
    profileDepth: 0.055,
    chamferSize: 0.012,
    beadRadius: 0.007,
    recessDepth: 0.01,
  },
  references: ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
  note: 'Skeleton-first: parent + two lancets + mullion; stone = strip union.',
})

/**
 * Rayonnant Oculus Network — skeleton + connected oculus (Step 13D.6).
 * Strip-union stone; upper negative space remains open.
 */
export const PRESET_RAYONNANT_OCULUS_NETWORK = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
  label: 'Rayonnant Oculus Network',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: true,
  enableOculusNetwork: true,
  enableSecondaryTracery: false,
  useProportionRatios: false,
  tracery: {
    masterFrameWidth: 0.12,
    outerFrameWidth: 0.12,
    primaryArchWidthRatio: 1.0,
    mullionWidthRatio: 0.67,
    childArchWidthRatio: 0.54,
    mullionWidth: 0.08,
    jambInset: 0.055,
    childRiseRatio: 1.08,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    oculusRadiusRatio: 0.78,
    oculusVerticalPosition: 0.55,
    oculusRingWidthRatio: 0.42,
    connectorWidthRatio: 0.38,
    upperConnectorCurvature: 0.45,
    oculusSubdivision: 'none',
    oculusClearance: 0.04,
    foilScale: 0.92,
    cuspDepth: 0.55,
  },
  stone: {
    moldingHierarchy: false,
    moldingEnabled: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.04,
    profileDepth: 0.055,
    chamferSize: 0.012,
    beadRadius: 0.007,
    recessDepth: 0.01,
  },
  references: ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
  note: 'Skeleton + connected oculus ring + upper connectors; strip-union stone.',
})

/**
 * Rayonnant Secondary Tracery — oculus + quatrefoil + side secondaries (Step 13D.7).
 * Strip-union stone; hierarchical foil / secondary widths.
 */
export const PRESET_RAYONNANT_SECONDARY_TRACERY = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY,
  label: 'Rayonnant Secondary Tracery',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: true,
  enableOculusNetwork: true,
  enableSecondaryTracery: true,
  useProportionRatios: false,
  tracery: {
    masterFrameWidth: 0.12,
    outerFrameWidth: 0.12,
    primaryArchWidthRatio: 1.0,
    mullionWidthRatio: 0.67,
    childArchWidthRatio: 0.54,
    mullionWidth: 0.08,
    jambInset: 0.055,
    childRiseRatio: 1.08,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    oculusRadiusRatio: 0.76,
    oculusVerticalPosition: 0.55,
    oculusRingWidthRatio: 0.42,
    connectorWidthRatio: 0.36,
    upperConnectorCurvature: 0.45,
    oculusSubdivision: 'quatrefoil',
    oculusClearance: 0.04,
    secondaryTraceryLevel: 1,
    secondaryMemberWidthRatio: 0.32,
    foilBarWidthRatio: 0.28,
    foilScale: 0.88,
    cuspDepth: 0.55,
    foilRotation: 0,
    sideCompartmentSubdivision: true,
    minWebClearance: 0.04,
    foilRadialMode: 'cusp-to-ring',
    enableOculusRefinement: false,
  },
  stone: {
    moldingHierarchy: false,
    moldingEnabled: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.04,
    profileDepth: 0.055,
    chamferSize: 0.012,
    beadRadius: 0.007,
    recessDepth: 0.01,
  },
  enableOculusRefinement: false,
  references: ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-004'],
  note: 'Oculus + connected quatrefoil + symmetric side secondary members; strip-union stone.',
})

/**
 * Rayonnant Oculus Refined — 13D.8 junction / foil / apex refinement on secondary skeleton.
 * Preserves RAYONNANT_SECONDARY_TRACERY (13D.7) as unchanged comparison preset.
 */
export const PRESET_RAYONNANT_OCULUS_REFINED = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED,
  label: 'Rayonnant Oculus Refined',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: true,
  enableOculusNetwork: true,
  enableSecondaryTracery: true,
  enableOculusRefinement: true,
  useProportionRatios: false,
  tracery: {
    masterFrameWidth: 0.12,
    outerFrameWidth: 0.12,
    primaryArchWidthRatio: 1.0,
    mullionWidthRatio: 0.67,
    childArchWidthRatio: 0.54,
    mullionWidth: 0.08,
    jambInset: 0.055,
    childRiseRatio: 1.08,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    oculusRadiusRatio: 0.7,
    oculusVerticalPosition: 0.48,
    oculusRingWidthRatio: 0.4,
    connectorWidthRatio: 0.34,
    upperConnectorCurvature: 0.45,
    oculusSubdivision: 'quatrefoil',
    oculusClearance: 0.045,
    oculusApexClearance: 0.09,
    secondaryTraceryLevel: 1,
    secondaryMemberWidthRatio: 0.28,
    foilBarWidthRatio: 0.2,
    foilScale: 0.88,
    cuspDepth: 0.65,
    foilRotation: 0,
    foilOrientation: Math.PI / 4,
    foilRadialMode: 'tip-to-ring',
    centralJunctionScale: 0.55,
    foilToRingWidthRatio: 0.82,
    sideCompartmentSubdivision: true,
    minWebClearance: 0.045,
  },
  stone: {
    moldingHierarchy: false,
    moldingEnabled: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.036,
    profileDepth: 0.05,
    chamferSize: 0.01,
    beadRadius: 0.006,
    recessDepth: 0.009,
  },
  references: ['REF-006', 'REF-011', 'REF-009', 'REF-013', 'REF-007'],
  note: '13D.8 tip-to-ring foils, central junction scale, apex clearance; strip-union stone.',
})

/**
 * Rayonnant Hierarchical — 13D.9 recursive pointed-arch cells + trefoil heads on 13D.8.
 * Preserves RAYONNANT_OCULUS_REFINED as unchanged comparison preset.
 */
export const PRESET_RAYONNANT_HIERARCHICAL = Object.freeze({
  id: ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
  label: 'Rayonnant Hierarchical',
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: true,
  enableOculusNetwork: true,
  enableSecondaryTracery: true,
  enableOculusRefinement: true,
  enableHierarchicalTracery: true,
  useProportionRatios: false,
  tracery: {
    masterFrameWidth: 0.12,
    outerFrameWidth: 0.12,
    primaryArchWidthRatio: 1.0,
    mullionWidthRatio: 0.67,
    childArchWidthRatio: 0.54,
    mullionWidth: 0.08,
    jambInset: 0.055,
    childRiseRatio: 1.08,
    windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
    oculusRadiusRatio: 0.7,
    oculusVerticalPosition: 0.48,
    oculusRingWidthRatio: 0.4,
    connectorWidthRatio: 0.34,
    upperConnectorCurvature: 0.45,
    oculusSubdivision: 'quatrefoil',
    oculusClearance: 0.045,
    oculusApexClearance: 0.09,
    secondaryTraceryLevel: 1,
    secondaryMemberWidthRatio: 0.28,
    foilBarWidthRatio: 0.2,
    foilScale: 0.88,
    cuspDepth: 0.65,
    foilRotation: 0,
    foilOrientation: Math.PI / 4,
    foilRadialMode: 'tip-to-ring',
    centralJunctionScale: 0.55,
    foilToRingWidthRatio: 0.82,
    sideCompartmentSubdivision: true,
    minWebClearance: 0.045,
    hierarchicalDepth: 1,
    nestedArches: true,
    trefoilHeads: true,
    secondaryQuatrefoils: false,
    childArchSpanRatio: 0.5,
    childArchRiseRatio: 1.05,
    secondaryArchWidthRatio: 0.4,
    tertiaryArchWidthRatio: 0.3,
    hierarchicalFoilWidthRatio: 0.18,
    hierarchicalMullionWidthRatio: 0.36,
    hierarchicalJambInsetRatio: 0.12,
    minOpeningClearance: 0.05,
    symmetric: true,
  },
  stone: {
    moldingHierarchy: false,
    moldingEnabled: false,
    profileType: DEFAULT_STONE_PARAMS.profileType,
    profileWidth: 0.036,
    profileDepth: 0.05,
    chamferSize: 0.01,
    beadRadius: 0.006,
    recessDepth: 0.009,
  },
  references: ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-006'],
  note: '13D.9 nested pointed arches + trefoil heads; recursive cells on 13D.8 strip-union.',
})

/**
 * Rayonnant Facade Module — editable Stone / 3D preset that recreates the
 * preferred Architectural Assembly window through the shared generator (13E.3.2).
 * Procedural twin of ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT; not a static mesh.
 */
export const PRESET_RAYONNANT_FACADE_MODULE = Object.freeze({
  ...PRESET_RAYONNANT_HIERARCHICAL,
  id: ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
  label: 'Rayonnant Facade Module',
  note:
    'Shared editable facade window (13E.3.2). Same grammar as Rayonnant Hierarchical / legacy Assembly snapshot; Stone / 3D and Assembly stay linked.',
})

export function getArchitecturePreset(id) {
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE) {
    return PRESET_RAYONNANT_FACADE_MODULE
  }
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL) {
    return PRESET_RAYONNANT_HIERARCHICAL
  }
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED) {
    return PRESET_RAYONNANT_OCULUS_REFINED
  }
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY) {
    return PRESET_RAYONNANT_SECONDARY_TRACERY
  }
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK) return PRESET_RAYONNANT_OCULUS_NETWORK
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_SKELETON) return PRESET_RAYONNANT_SKELETON
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE) return PRESET_RAYONNANT_ELABORATE
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK) return PRESET_RAYONNANT_BAR_NETWORK
  if (id === ARCHITECTURE_PRESETS.RAYONNANT_REFINED) return PRESET_RAYONNANT_REFINED
  return PRESET_BASELINE_13D
}

/**
 * Merge preset into tracery + stone setting patches (does not replace unrelated UI fields).
 */
export function applyArchitecturePreset(presetId, currentTracery = {}, currentStone = {}) {
  const preset = getArchitecturePreset(presetId)
  const span = currentTracery.span ?? DEFAULT_COMPOSED_PARAMS.span
  const minWeb =
    currentTracery.minStoneWebWidth ?? DEFAULT_REGION_PARAMS.minStoneWebWidth

  let widthFields
  if (preset.useProportionRatios) {
    const resolved = resolveMemberWidths(span, preset.proportions, minWeb)
    widthFields = {
      outerFrameWidth: resolved.widths.outerFrameWidth,
      masterFrameWidth: resolved.widths.outerFrameWidth,
      mullionWidth: resolved.widths.mullionWidth,
      jambInset: resolved.widths.jambInset,
      minStoneWebWidth: Math.min(minWeb, resolved.widths.secondaryTraceryWidth),
      secondaryTraceryWidth: resolved.widths.secondaryTraceryWidth,
      oculusFrameWidth: resolved.widths.oculusFrameWidth,
      foilBarWidth: resolved.widths.foilBarWidth,
      outerFrameWidthRatio: preset.proportions.outerFrameWidthRatio,
      primaryMullionWidthRatio: preset.proportions.primaryMullionWidthRatio,
      lancetArchWidthRatio:
        preset.proportions.lancetArchWidthRatio ?? DEFAULT_PROPORTION_RATIOS.lancetArchWidthRatio,
      secondaryTraceryWidthRatio: preset.proportions.secondaryTraceryWidthRatio,
      oculusFrameWidthRatio: preset.proportions.oculusFrameWidthRatio,
      foilBarWidthRatio: preset.proportions.foilBarWidthRatio,
      upperOpeningScale: preset.proportions.upperOpeningScale,
      upperSubdivisionDensity:
        preset.proportions.upperSubdivisionDensity ??
        DEFAULT_PROPORTION_RATIOS.upperSubdivisionDensity,
      upperSubdivisionComplexity:
        preset.proportions.upperSubdivisionDensity ??
        preset.tracery?.upperSubdivisionComplexity ??
        0.85,
      primaryMullionRatio: preset.proportions.primaryMullionWidthRatio,
      lancetArchRatio:
        preset.proportions.lancetArchWidthRatio ?? DEFAULT_PROPORTION_RATIOS.lancetArchWidthRatio,
      secondaryTraceryRatio: preset.proportions.secondaryTraceryWidthRatio,
      oculusRingRatio: preset.proportions.oculusFrameWidthRatio,
      foilBarRatio: preset.proportions.foilBarWidthRatio,
    }
  } else {
    widthFields = {
      ...preset.tracery,
      secondaryTraceryWidth: BASELINE_MEMBER_WIDTHS.secondaryTraceryWidth,
      oculusFrameWidth: BASELINE_MEMBER_WIDTHS.oculusFrameWidth,
      foilBarWidth: BASELINE_MEMBER_WIDTHS.foilBarWidth,
      masterFrameWidth: preset.tracery.outerFrameWidth ?? BASELINE_MEMBER_WIDTHS.outerFrameWidth,
      // Keep oculus height aliases aligned after preset apply (13E.3.1)
      ...(preset.tracery.oculusVerticalPosition != null
        ? { oculusHeightRatio: preset.tracery.oculusVerticalPosition }
        : preset.tracery.oculusHeightRatio != null
          ? { oculusVerticalPosition: preset.tracery.oculusHeightRatio }
          : {}),
      outerFrameWidthRatio: DEFAULT_PROPORTION_RATIOS.outerFrameWidthRatio,
      primaryMullionWidthRatio: DEFAULT_PROPORTION_RATIOS.primaryMullionWidthRatio,
      lancetArchWidthRatio: DEFAULT_PROPORTION_RATIOS.lancetArchWidthRatio,
      secondaryTraceryWidthRatio: DEFAULT_PROPORTION_RATIOS.secondaryTraceryWidthRatio,
      oculusFrameWidthRatio: DEFAULT_PROPORTION_RATIOS.oculusFrameWidthRatio,
      foilBarWidthRatio: DEFAULT_PROPORTION_RATIOS.foilBarWidthRatio,
      upperOpeningScale: DEFAULT_PROPORTION_RATIOS.upperOpeningScale,
      upperSubdivisionDensity: DEFAULT_PROPORTION_RATIOS.upperSubdivisionDensity,
    }
  }

  const tracery = {
    ...currentTracery,
    ...preset.tracery,
    ...widthFields,
    // Preserve secondary / foil ratios from the preset after generic width defaults.
    ...(preset.tracery?.foilBarWidthRatio != null
      ? { foilBarWidthRatio: preset.tracery.foilBarWidthRatio }
      : {}),
    ...(preset.tracery?.secondaryMemberWidthRatio != null
      ? { secondaryMemberWidthRatio: preset.tracery.secondaryMemberWidthRatio }
      : {}),
    ...(preset.tracery?.secondaryTraceryLevel != null
      ? { secondaryTraceryLevel: preset.tracery.secondaryTraceryLevel }
      : {}),
    architecturePreset: preset.id,
    enableSpandrelOpenings: preset.enableSpandrelOpenings === true,
    enableBarNetwork: preset.enableBarNetwork === true,
    enableElaborate: preset.enableElaborate === true,
    enableSkeleton: preset.enableSkeleton === true,
    enableOculusNetwork:
      preset.enableOculusNetwork === true ||
      preset.enableSecondaryTracery === true ||
      preset.enableOculusRefinement === true ||
      preset.enableHierarchicalTracery === true,
    enableSecondaryTracery:
      preset.enableSecondaryTracery === true || preset.enableHierarchicalTracery === true,
    enableOculusRefinement:
      preset.enableOculusRefinement === true || preset.enableHierarchicalTracery === true,
    enableHierarchicalTracery: preset.enableHierarchicalTracery === true,
    useProportionRatios: preset.useProportionRatios,
  }

  const stone = {
    ...currentStone,
    ...preset.stone,
    architecturePreset: preset.id,
    moldingHierarchy: preset.stone.moldingHierarchy,
  }

  return { tracery, stone, preset }
}
