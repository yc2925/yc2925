/**
 * Procedural Gothic architectural assemblies (Steps 13E.1 / 13E.2 / 13E.3).
 */

export {
  generateGothicWindowModule,
  buildGothicWindowModule,
  clearWindowModuleCache,
  windowModuleCacheSize,
} from './windowModule.js'

export {
  ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT,
  buildWindowTraceryParams,
  resolveWindowDesignParams,
  buildLegacyAssemblyWindowDesign,
  applyRayonnantFacadeModulePreset,
  windowDesignSignature,
} from './windowDesignParams.js'

export {
  buildPierSupport,
  buildBaseCourse,
  DEFAULT_PIER_PARAMS,
} from './pierSupport.js'

export {
  buildGothicClusteredPier,
  buildGothicSteppedButtress,
  buildArticulatedSupport,
  shaftOffsetDirections,
  shaftCenterOffset,
  measureSupportSemantics,
  supportStyleUsesShafts,
  supportStyleUsesButtress,
  supportStyleUsesBaseCapital,
  DEFAULT_ARTICULATION_PARAMS,
} from './articulatedSupport.js'

export {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  WINDOW_LINK_MODES,
  DEFAULT_ASSEMBLY_PARAMS,
} from './assemblyTypes.js'

export {
  computeBayLayout,
  resolveBayScales,
  buildGothicFacadeElevation,
  validateGothicFacadeElevation,
} from './facadeElevation.js'

export { buildBoxMesh } from './boxSolid.js'
export { buildCylinderMesh } from './cylinderSolid.js'

export {
  extractFacadeSurfaceSemantics,
  attachSurfaceSemantics,
  applyGrowthPolicy,
  validateSurfaceSemantics,
  componentTypeFromPartRole,
  componentTypeFromMemberType,
} from './surfaceSemantics.js'

export {
  COMPONENT_TYPES,
  SURFACE_TYPES,
  GROWTH_ELIGIBILITY,
  CLASSIFICATION_CONFIDENCE,
  FEATURE_KINDS,
  EDGE_KINDS,
  RELATIONSHIP_TYPES,
  GROWTH_ZONES,
  ZONE_PRECEDENCE,
  SEMANTIC_VIEW_MODES,
  DEFAULT_GROWTH_POLICY,
  DEFAULT_SURFACE_SEMANTICS_SETTINGS,
  JOINT_DATA_UNAVAILABLE,
  COMPONENT_TYPE_COLORS,
  SURFACE_TYPE_COLORS,
  ELIGIBILITY_COLORS,
  ZONE_COLORS,
} from './surfaceSemanticsTypes.js'

export {
  ANCHOR_STATUS,
  ATTACHMENT_METHODS,
  SEED_DISTRIBUTION_MODES,
  NAV_TRANSITION_TYPES,
  ANCHOR_SCOPES,
  GROWTH_ATTACHMENT_TYPE,
  DEFAULT_GROWTH_ATTACHMENT_SETTINGS,
  createGrowthAnchor,
  emptyGrowthAttachmentState,
  buildSurfaceFrame,
  validateSurfaceFrame,
  preferredTangentHint,
  createAnchorOnPatch,
  attachFromWorldHit,
  findNearestPatch,
  isNearProtectedOpening,
  isPatchPlaceable,
  distributeGrowthSeeds,
  buildGrowthNavigationGraph,
  segmentCrossesProtectedOpening,
  findSurfacePath,
  straightLinePathPreview,
  getSurfaceFrame,
  projectToEligibleSurface,
  findNearestValidAnchor,
  isInsideProtectedOpening,
  checkGrowthClearance,
  rebindGrowthAnchors,
  instantiateMasterAnchors,
  stableSemanticKey,
  stableGeometrySignature,
  buildGrowthAttachmentContext,
  resetAnchorIdCounter,
  listAnchorsByStatus,
} from './growthAttachment/index.js'

export {
  FOLIATE_WORKSPACE_ID,
  FOLIATE_WORKSPACE_LABEL,
  BRANCH_ROLES,
  MOTIF_KINDS,
  TERMINATION_REASONS,
  COMPOSITION_MODES,
  DEFAULT_FOLIATE_SETTINGS,
  createGrowthNode,
  createGrowthBranch,
  createOrnamentMotif,
  emptyOrnamentSkeleton,
  selectOrnamentInitiationAnchors,
  groupAnchorsIntoMotifHosts,
  ornamentGrowthCacheKey,
  buildOrnamentGrowthSkeleton,
  revealOrnamentSkeleton,
  validateOrnamentSkeleton,
  skeletonMeanCurvature,
  MOTIF_TYPES,
  HOST_KINDS,
  CURVE_ROLES,
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  discoverOrnamentHosts,
  buildHostFrameFromAnchor,
  buildHostsFromAnchors,
  classifyAnchorHost,
  selectHost,
  selectHostByAnchorId,
  buildGothicVolute,
  buildRibbedSpine,
  buildSecondaryCurl,
  mirrorCurveLocal,
  validateCurveContinuity,
  composeSymmetricalSpandrelScroll,
  buildParametricMotifs,
  parametricMotifCacheKey,
  measureMirrorDeviation,
  measureRootAnchorDistance,
  ROOT_ANCHOR_TOLERANCE,
  emptyParametricMotif,
} from './foliateOrnament/index.js'
// FoliateOrnamentOverlay.jsx / ParametricMotifOverlay.jsx imported by view (Node validate cannot load JSX).
