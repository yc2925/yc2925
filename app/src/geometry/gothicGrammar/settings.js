/**
 * Gothic Grammar construction workspace settings.
 * Isolated from legacy gothic Architecture settings.
 */

import { EXAMPLE_IDS, DEFAULT_EXAMPLE_PARAMS } from './examples.js'
import {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
} from './primitives/archFamilies.js'
import {
  TRACERY_EXAMPLES,
  DEFAULT_COMPOSED_PARAMS,
  FOIL_TYPES,
} from './tracery/index.js'
import { DEFAULT_REGION_PARAMS } from './tracery/regionRoles.js'
import { DEFAULT_PROPORTION_RATIOS, BASELINE_MEMBER_WIDTHS } from './tracery/memberHierarchy.js'
import {
  ARCHITECTURE_PRESETS,
  ARCHITECTURE_PRESET_OPTIONS,
  applyArchitecturePreset,
  getArchitecturePreset,
} from './tracery/presets.js'
import {
  DEFAULT_STONE_PARAMS,
  DEPTH_ALIGNMENTS,
  TESSELLATION_QUALITY,
  PROFILE_TYPES,
} from './solids/index.js'
import {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  WINDOW_LINK_MODES,
  DEFAULT_ASSEMBLY_PARAMS,
} from './assemblies/assemblyTypes.js'
import { DEFAULT_SURFACE_SEMANTICS_SETTINGS } from './assemblies/surfaceSemanticsTypes.js'
import { DEFAULT_GROWTH_ATTACHMENT_SETTINGS } from './assemblies/growthAttachment/types.js'

export {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  WINDOW_LINK_MODES,
  DEFAULT_ASSEMBLY_PARAMS,
}

export {
  ARCHITECTURE_PRESETS,
  ARCHITECTURE_PRESET_OPTIONS,
  applyArchitecturePreset,
  getArchitecturePreset,
}

export const WORKSPACE_MODES = [
  { id: 'pointed-arch', label: 'Pointed Arch', enabled: true },
  { id: 'compare-arches', label: 'Compare Arch Families', enabled: true },
  { id: 'tracery', label: 'Tracery', enabled: true },
  { id: 'stone-3d', label: 'Stone / 3D', enabled: true },
  { id: 'architectural-assembly', label: 'Architectural Assembly', enabled: true },
  { id: 'kernel-examples', label: 'Kernel Examples', enabled: true },
]

export const ASSEMBLY_VIEW_PRESETS = [
  { id: 'front', label: 'Front Elevation' },
  { id: 'three-quarter', label: 'Three-Quarter' },
  { id: 'side', label: 'Side' },
  { id: 'top', label: 'Top' },
]

export const ASSEMBLY_INSPECT_LAYERS = [
  { id: 'combined', label: 'Combined 3D' },
  { id: 'structural', label: 'Structural 3D' },
  { id: 'assembly-graph', label: 'Assembly Graph' },
  { id: 'surface-semantics', label: 'Surface Semantics' },
]

export const SEMANTIC_VIEW_OPTIONS = [
  { id: 'COMPONENT_TYPE', label: 'Component Type' },
  { id: 'SURFACE_ORIENTATION', label: 'Surface Orientation' },
  { id: 'GROWTH_ELIGIBILITY', label: 'Eligibility' },
  { id: 'GROWTH_WEIGHT', label: 'Growth Weight' },
  { id: 'FEATURE_GRAPH', label: 'Feature Graph' },
  { id: 'GROWTH_ZONES', label: 'Growth Zones' },
]

export const STONE_DISPLAY_MODES = [
  { id: 'solid', label: 'Solid' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'solid+edges', label: 'Solid + Edges' },
]

/** Step 13D.1 / 13D.3 mesh diagnostics — isolate structural vs moldings vs network. */
/** Step 13D.5 skeleton inspection aliases (map onto existing layers). */
export const SKELETON_INSPECT_HINTS = Object.freeze({
  'network-graph': 'SKELETON GRAPH',
  section: 'STONE SECTION',
  structural: 'STRUCTURAL 3D',
})

export const STONE_INSPECT_LAYERS = [
  { id: 'combined', label: 'Combined 3D' },
  { id: 'structural', label: 'Structural 3D' },
  { id: 'moldings', label: 'Moldings Only' },
  { id: 'network-graph', label: 'Network Graph' },
  { id: 'section', label: 'Stone / Void Section' },
  { id: 'normals', label: 'Normals Debug' },
  { id: 'wireframe-debug', label: 'Wireframe Debug' },
]

export const STONE_VIEW_PRESETS = [
  { id: 'front', label: 'Front' },
  { id: 'three-quarter', label: 'Three-Quarter' },
  { id: 'side', label: 'Side' },
  { id: 'back', label: 'Back' },
]

export const DEPTH_ALIGNMENT_OPTIONS = [
  { id: DEPTH_ALIGNMENTS.FRONT, label: 'Front' },
  { id: DEPTH_ALIGNMENTS.CENTERED, label: 'Centered' },
  { id: DEPTH_ALIGNMENTS.BACK, label: 'Back' },
]

export const TESSELLATION_OPTIONS = Object.entries(TESSELLATION_QUALITY).map(([id, v]) => ({
  id,
  label: v.label,
}))

export const PROFILE_TYPE_OPTIONS = Object.values(PROFILE_TYPES).map((id) => ({
  id,
  label: id
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' '),
}))

/** Visualization states — do not change underlying geometry. */
export const DISPLAY_STATES = [
  {
    id: 'presentation',
    label: 'Presentation',
    tip: 'Final arches, labels, and key dimensions only.',
  },
  {
    id: 'construction',
    label: 'Construction',
    tip: 'Final arches plus circles, centers, springings, apex, and axis.',
  },
  {
    id: 'section',
    label: 'Section',
    tip: 'Solid stone (light) and openings (dark). Validated planar regions only.',
  },
]

export const CONSTRUCTION_MODES = [
  { id: 'inspect', label: 'Inspect', enabled: true },
  { id: 'construct', label: 'Construct', enabled: true },
  { id: 'constraints', label: 'Constraints', enabled: false },
  { id: 'tracery', label: 'Tracery', enabled: true },
]

export const PRIMITIVE_TOOLS = [
  { id: 'point', label: 'Point', enabled: true },
  { id: 'line', label: 'Line / Segment', enabled: true },
  { id: 'circle', label: 'Circle', enabled: true },
  { id: 'arc', label: 'Circular Arc', enabled: true },
  { id: 'intersection', label: 'Intersection', enabled: true },
  { id: 'tangent', label: 'Tangency', enabled: true },
  { id: 'offset', label: 'Offset', enabled: true },
  { id: 'region', label: 'Closed Region', enabled: true },
  { id: 'pointed-arch', label: 'Pointed Arch', enabled: true },
]

export const DEFAULT_ARCH_SETTINGS = Object.freeze({
  family: DEFAULT_ARCH_PARAMS.family,
  span: DEFAULT_ARCH_PARAMS.span,
  riseRatio: DEFAULT_ARCH_PARAMS.riseRatio,
  springingY: DEFAULT_ARCH_PARAMS.springingY,
  samplingQuality: DEFAULT_ARCH_PARAMS.samplingQuality,
  lancetRiseRatio: ARCH_FAMILY_META.lancet.defaultRiseRatio,
  depressedRiseRatio: ARCH_FAMILY_META.depressed.defaultRiseRatio,
})

export const DEFAULT_TRACERY_SETTINGS = Object.freeze({
  exampleId: 'composed-window',
  family: DEFAULT_COMPOSED_PARAMS.family,
  span: DEFAULT_COMPOSED_PARAMS.span,
  riseRatio: DEFAULT_COMPOSED_PARAMS.riseRatio,
  springingY: DEFAULT_COMPOSED_PARAMS.springingY,
  samplingQuality: DEFAULT_COMPOSED_PARAMS.samplingQuality,
  subdivisionRatio: DEFAULT_COMPOSED_PARAMS.subdivisionRatio,
  mullionWidth: DEFAULT_COMPOSED_PARAMS.mullionWidth,
  jambInset: DEFAULT_COMPOSED_PARAMS.jambInset,
  childRiseRatio: DEFAULT_COMPOSED_PARAMS.childRiseRatio,
  childFamily: DEFAULT_COMPOSED_PARAMS.childFamily,
  symmetric: DEFAULT_COMPOSED_PARAMS.symmetric,
  containmentMargin: DEFAULT_COMPOSED_PARAMS.containmentMargin,
  oculusHeightRatio: DEFAULT_COMPOSED_PARAMS.oculusHeightRatio,
  oculusRadiusRatio: DEFAULT_COMPOSED_PARAMS.oculusRadiusRatio,
  oculusClearance: DEFAULT_COMPOSED_PARAMS.oculusClearance,
  foilType: DEFAULT_COMPOSED_PARAMS.foilType,
  foilScale: DEFAULT_COMPOSED_PARAMS.foilScale,
  cuspDepth: DEFAULT_COMPOSED_PARAMS.cuspDepth,
  foilRotation: DEFAULT_COMPOSED_PARAMS.foilRotation,
  foilOrientation: DEFAULT_COMPOSED_PARAMS.foilOrientation,
  foilSize: 1.2,
  outerFrameWidth: DEFAULT_REGION_PARAMS.outerFrameWidth,
  windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
  minStoneWebWidth: DEFAULT_REGION_PARAMS.minStoneWebWidth,
  /** Step 13D.2 architectural preset */
  architecturePreset: ARCHITECTURE_PRESETS.BASELINE_13D,
  enableSpandrelOpenings: false,
  enableBarNetwork: false,
  enableElaborate: false,
  enableSkeleton: false,
  enableOculusNetwork: false,
  enableSecondaryTracery: false,
  enableOculusRefinement: false,
  enableHierarchicalTracery: false,
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
  secondaryTraceryLevel: 1,
  secondaryMemberWidthRatio: 0.32,
  sideCompartmentSubdivision: true,
  oculusApexClearance: 0.08,
  centralJunctionScale: 0.55,
  foilToRingWidthRatio: 0.85,
  foilRadialMode: 'cusp-to-ring',
  masterFrameWidth: 0.12,
  primaryArchWidthRatio: 1.0,
  mullionWidthRatio: 0.67,
  childArchWidthRatio: 0.54,
  oculusVerticalPosition: 0.55,
  oculusRingWidthRatio: 0.42,
  connectorWidthRatio: 0.38,
  upperConnectorCurvature: 0.45,
  oculusSubdivision: 'none',
  nestingDepth: 2,
  secondaryMullionWidth: 0.045,
  secondaryJambInset: 0.018,
  secondaryLancetRatio: 1.1,
  oculusScale: 0.94,
  foilCount: 4,
  upperSubdivisionComplexity: 0.85,
  useProportionRatios: false,
  outerFrameWidthRatio: DEFAULT_PROPORTION_RATIOS.outerFrameWidthRatio,
  primaryMullionWidthRatio: DEFAULT_PROPORTION_RATIOS.primaryMullionWidthRatio,
  lancetArchWidthRatio: DEFAULT_PROPORTION_RATIOS.lancetArchWidthRatio,
  secondaryTraceryWidthRatio: DEFAULT_PROPORTION_RATIOS.secondaryTraceryWidthRatio,
  oculusFrameWidthRatio: DEFAULT_PROPORTION_RATIOS.oculusFrameWidthRatio,
  foilBarWidthRatio: DEFAULT_PROPORTION_RATIOS.foilBarWidthRatio,
  upperOpeningScale: DEFAULT_PROPORTION_RATIOS.upperOpeningScale,
  upperSubdivisionDensity: DEFAULT_PROPORTION_RATIOS.upperSubdivisionDensity,
  minWebClearance: 0.04,
  masterFrameWidth: BASELINE_MEMBER_WIDTHS.outerFrameWidth,
  secondaryTraceryWidth: BASELINE_MEMBER_WIDTHS.secondaryTraceryWidth,
  oculusFrameWidth: BASELINE_MEMBER_WIDTHS.oculusFrameWidth,
  foilBarWidth: BASELINE_MEMBER_WIDTHS.foilBarWidth,
})

export const COMPARE_MODES = [
  { id: 'off', label: 'Single' },
  { id: 'side-by-side', label: 'Baseline ↔ Refined' },
  { id: 'all-three', label: 'Baseline · Refined · Bar Network' },
  { id: 'all-four', label: 'Baseline · Refined · Bar · Elaborate' },
]

export const DEFAULT_STONE_SETTINGS = Object.freeze({
  ...DEFAULT_STONE_PARAMS,
  displayMode: 'solid',
  inspectLayer: 'combined',
  viewPreset: 'three-quarter',
  showStructural: true,
  showMoldings: true,
  showNormals: false,
  showAxes: true,
  showNetworkIds: false,
  showNetworkWidths: true,
  hierarchyColoring: false,
  architecturePreset: ARCHITECTURE_PRESETS.BASELINE_13D,
  moldingHierarchy: false,
  compareMode: 'off',
  presentationClean: false,
})

/**
 * Resolve display toggles from presentation / construction state.
 * Optional manual overrides remain available for kernel-examples.
 */
export function resolveDisplayFlags(settings) {
  const displayState = settings.displayState ?? 'presentation'
  const isKernel = settings.workspaceMode === 'kernel-examples'
  const isArchOrTracery =
    settings.workspaceMode === 'pointed-arch' ||
    settings.workspaceMode === 'compare-arches' ||
    settings.workspaceMode === 'tracery'

  if (isKernel) {
    return {
      displayState,
      showGrid: settings.showGrid !== false,
      showAxes: settings.showAxes === true,
      showOrigin: settings.showOrigin === true,
      showPoints: settings.showPoints !== false,
      showConstruction: settings.showConstruction !== false,
      showCenters: settings.showCenters !== false,
      showLabels: settings.showLabels === true,
      showDimensions: settings.showDimensions === true,
      showFamilyLabels: false,
      showResult: settings.showResult !== false,
      showArchAxis: false,
      includeConstructionInFrame: settings.showConstruction !== false,
    }
  }

  if (displayState === 'section' && settings.workspaceMode === 'tracery') {
    return {
      displayState: 'section',
      showGrid: false,
      showAxes: false,
      showOrigin: false,
      showPoints: false,
      showConstruction: false,
      showCenters: false,
      showLabels: false,
      showDimensions: false,
      showFamilyLabels: false,
      showResult: true,
      showArchAxis: false,
      showSection: true,
      includeConstructionInFrame: false,
    }
  }

  if (displayState === 'construction' && isArchOrTracery) {
    return {
      displayState,
      showGrid: settings.showGrid !== false,
      showAxes: false,
      showOrigin: false,
      showPoints: true,
      showConstruction: true,
      showCenters: true,
      showLabels: settings.showLabels === true,
      showDimensions: true,
      showFamilyLabels:
        settings.workspaceMode === 'compare-arches' || settings.workspaceMode === 'tracery',
      showResult: true,
      showArchAxis: true,
      showSection: false,
      includeConstructionInFrame: false,
    }
  }

  // Presentation (default)
  return {
    displayState: 'presentation',
    showGrid: settings.showGrid !== false,
    showAxes: false,
    showOrigin: false,
    showPoints: false,
    showConstruction: false,
    showCenters: false,
    showLabels: false,
    showDimensions: true,
    showFamilyLabels:
      settings.workspaceMode === 'compare-arches' || settings.workspaceMode === 'tracery',
    showResult: true,
    showArchAxis: false,
    showSection: false,
    includeConstructionInFrame: false,
  }
}

export const DEFAULT_ASSEMBLY_SETTINGS = Object.freeze({
  ...DEFAULT_ASSEMBLY_PARAMS,
  viewPreset: 'three-quarter',
  inspectLayer: 'combined',
  showGraphLabels: false,
  ...DEFAULT_SURFACE_SEMANTICS_SETTINGS,
  ...DEFAULT_GROWTH_ATTACHMENT_SETTINGS,
})

export const GROWTH_DISTRIBUTION_OPTIONS = [
  { id: 'MANUAL', label: 'Manual' },
  { id: 'UNIFORM_SURFACE', label: 'Uniform Surface' },
  { id: 'WEIGHTED_BY_ELIGIBILITY', label: 'Weighted by Eligibility' },
  { id: 'FEATURE_BASED', label: 'Feature-Based' },
  { id: 'SACRED_FACADE', label: 'Sacred Facade' },
]

export const GROWTH_PLACEMENT_MODE_OPTIONS = [
  { id: 'manual', label: 'Manual' },
  { id: 'automatic', label: 'Automatic' },
]

/** UI consolidation tiers (13E.3.1). */
export const UI_CONTROL_TIERS = [
  { id: 'essential', label: 'Essential' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'debug', label: 'Debug' },
]

export const DEFAULT_GOTHIC_GRAMMAR = Object.freeze({
  constructionMode: 'construct',
  workspaceMode: 'pointed-arch',
  displayState: 'presentation',
  uiControlTier: 'essential',
  exampleId: EXAMPLE_IDS[0].id,
  exampleParams: { ...DEFAULT_EXAMPLE_PARAMS[EXAMPLE_IDS[0].id] },
  arch: { ...DEFAULT_ARCH_SETTINGS },
  tracery: { ...DEFAULT_TRACERY_SETTINGS },
  stone: { ...DEFAULT_STONE_SETTINGS },
  assembly: { ...DEFAULT_ASSEMBLY_SETTINGS },
  // Display (presentation defaults; resolveDisplayFlags is source of truth for arch modes)
  showGrid: true,
  showAxes: false,
  showOrigin: false,
  showPoints: false,
  showConstruction: false,
  showCenters: false,
  showLabels: false,
  showDimensions: true,
  showResult: true,
  background: '#070707',
  resetViewToken: 0,
  fitToken: 0,
})

export function resetGothicGrammar() {
  return {
    ...DEFAULT_GOTHIC_GRAMMAR,
    exampleParams: { ...DEFAULT_EXAMPLE_PARAMS[DEFAULT_GOTHIC_GRAMMAR.exampleId] },
    arch: { ...DEFAULT_ARCH_SETTINGS },
    tracery: { ...DEFAULT_TRACERY_SETTINGS },
    stone: { ...DEFAULT_STONE_SETTINGS },
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS },
    resetViewToken: 0,
    fitToken: 0,
  }
}

export function createGrammarSettings(overrides = {}) {
  return {
    ...DEFAULT_GOTHIC_GRAMMAR,
    exampleParams: {
      ...DEFAULT_EXAMPLE_PARAMS[overrides.exampleId ?? DEFAULT_GOTHIC_GRAMMAR.exampleId],
      ...(overrides.exampleParams ?? {}),
    },
    arch: {
      ...DEFAULT_ARCH_SETTINGS,
      ...(overrides.arch ?? {}),
    },
    tracery: {
      ...DEFAULT_TRACERY_SETTINGS,
      ...(overrides.tracery ?? {}),
    },
    stone: {
      ...DEFAULT_STONE_SETTINGS,
      ...(overrides.stone ?? {}),
    },
    assembly: {
      ...DEFAULT_ASSEMBLY_SETTINGS,
      ...(overrides.assembly ?? {}),
    },
    ...overrides,
  }
}

export {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
  TRACERY_EXAMPLES,
  FOIL_TYPES,
  DEFAULT_STONE_PARAMS,
  DEPTH_ALIGNMENTS,
  PROFILE_TYPES,
}
