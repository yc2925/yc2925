/**
 * Rayonnant geometric bar-tracery grammar (Step 13C).
 * Separate from Flamboyant / curvilinear flowing families (REF-005, REF-010).
 */

export const TRACERY_STATUS = 'ready'
export const WORKING_FAMILY = 'rayonnant-geometric'
export const PRIMARY_REFERENCES = ['REF-011', 'REF-006', 'REF-008', 'REF-007', 'REF-009']

export {
  TRACERY_ROLES,
  TRACERY_ELEMENT_TYPES,
  FOIL_TYPES,
  TRACERY_EXAMPLES,
} from './roles.js'

export {
  createTraceryElement,
  createTraceryGraph,
  addElement,
  linkChild,
  finalizeGraph,
  markGraphInvalid,
  collectGraphErrors,
} from './graph.js'

export {
  archHeightAtX,
  pointInsideArchOpening,
  archOutlineInsideParent,
  circleInsideArch,
  sampleArchOutline,
  mullionClearance,
} from './archContainment.js'

export {
  DEFAULT_FOIL_PARAMS,
  buildNFoil,
  buildTrefoil,
  buildQuatrefoil,
  foilInsideCircle,
  foilCenterRadius,
  maxFoilCenterRadius,
  arcPreferringPoint,
} from './foils.js'

export {
  DEFAULT_SUBDIVISION_PARAMS,
  buildLancetSubdivision,
} from './lancetSubdivision.js'

export {
  DEFAULT_OCULUS_PARAMS,
  buildOculusPlacement,
  solveOculusCenterY,
  maxOculusRadiusAtHeight,
} from './oculus.js'

export {
  DEFAULT_COMPOSED_PARAMS,
  buildComposedWindow,
  buildFoilExample,
} from './composedWindow.js'

export {
  buildTraceryConstruction,
  graphToConstruction,
  traceryFramingBounds,
} from './traceryConstruction.js'

export {
  REGION_TYPES,
  DEFAULT_REGION_PARAMS,
  structuralHoleKeys,
} from './regionRoles.js'

export {
  MEMBER_CLASSES,
  DEFAULT_PROPORTION_RATIOS,
  BASELINE_MEMBER_WIDTHS,
  MEMBER_PROFILE_SCALES,
  resolveMemberWidths,
  memberClassForRole,
  scaleProfileParams,
} from './memberHierarchy.js'

export {
  buildUpperSpandrelOpenings,
  circleToCwLoop,
} from './spandrelOpenings.js'

export {
  ARCHITECTURE_PRESETS,
  ARCHITECTURE_PRESET_OPTIONS,
  PRESET_BASELINE_13D,
  PRESET_RAYONNANT_REFINED,
  PRESET_RAYONNANT_BAR_NETWORK,
  PRESET_RAYONNANT_ELABORATE,
  PRESET_RAYONNANT_SKELETON,
  PRESET_RAYONNANT_OCULUS_NETWORK,
  PRESET_RAYONNANT_SECONDARY_TRACERY,
  PRESET_RAYONNANT_OCULUS_REFINED,
  PRESET_RAYONNANT_HIERARCHICAL,
  PRESET_RAYONNANT_FACADE_MODULE,
  getArchitecturePreset,
  applyArchitecturePreset,
} from './presets.js'

export {
  applyTraceryExample,
  clearAdvancedGrammarFlags,
  TRACERY_EXAMPLE_META,
  traceryExampleSignature,
} from './traceryExamples.js'

export {
  buildSkeletonGraph,
  validateSkeletonGraph,
  DEFAULT_SKELETON_PARAMS,
  SKELETON_WIDTH_DEFAULTS,
  buildOculusNetworkGraph,
  validateOculusNetworkGraph,
  DEFAULT_OCULUS_NETWORK_PARAMS,
  OCULUS_SUBDIVISION,
  buildSecondaryTraceryGraph,
  validateSecondaryTraceryGraph,
  DEFAULT_SECONDARY_TRACERY_PARAMS,
  SECONDARY_TRACERY_LEVEL,
  buildHierarchicalTraceryGraph,
  validateHierarchicalTraceryGraph,
  DEFAULT_HIERARCHICAL_PARAMS,
  HIERARCHICAL_DEPTH,
  CELL_KINDS,
  SUBDIVISION_RULES,
  buildSkeletonSolidVoid,
  unionSkeletonStrips,
  skeletonHoleKeys,
} from './skeleton/index.js'

export {
  ELABORATE_ZONES,
  porosityMetrics,
  DEFAULT_ELABORATE_PARAMS,
  buildHierarchicalLancets,
  subdivideArchField,
  buildOculusComposition,
  buildCurvedSpandrels,
  solveOpeningArrangement,
  buildElaborateSolidVoid,
  resolveElaborateWidths,
  ELABORATE_MEMBER_RATIOS,
  elaborateHoleKeys,
} from './elaborate/index.js'

export {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  BAR_NETWORK_WIDTH_RATIOS,
  NETWORK_MEMBER_COLORS,
  createNetworkNode,
  createNetworkMember,
} from './barNetworkTypes.js'

export {
  buildBarNetwork,
  validateBarNetwork,
  sampleMemberPath,
} from './barNetwork.js'

export {
  buildUpperBarSubdivision,
} from './upperBarSubdivision.js'

export {
  buildBarNetworkSolidVoid,
  unionMemberStrips,
  polylineToStrip,
  barNetworkHoleKeys,
} from './barNetworkStone.js'

export {
  closedLoopFromArch,
  buildOuterBoundaryLoop,
  ensureCcw,
  ensureCw,
  loopArea,
  sampleLoop,
} from './openingLoops.js'

export {
  buildSolidVoidModel,
  buildFoilSolidVoid,
  foilToVoidLoop,
  buildMullionRegion,
} from './solidVoid.js'

export {
  evaluateClearances,
  measuredMullionWidth,
  voidsOverlap,
  openingsInsideOuter,
} from './clearance.js'
