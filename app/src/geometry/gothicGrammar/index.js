/**
 * Public entry for the independent Gothic Grammar geometry namespace.
 */

export { KERNEL_STATUS, KERNEL_VERSION, createEmptyKernelDocument } from './kernel/index.js'
export {
  PRIMITIVES_STATUS,
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  ARCH_SEMANTICS,
  DEFAULT_ARCH_PARAMS,
  EQUILATERAL_RISE_RATIO,
  buildPointedArch,
  buildArchFamily,
  validatePointedArch,
} from './primitives/index.js'
export { CONSTRAINTS_STATUS } from './constraints/index.js'
export {
  TRACERY_STATUS,
  WORKING_FAMILY,
  PRIMARY_REFERENCES,
  TRACERY_ROLES,
  TRACERY_EXAMPLES,
  FOIL_TYPES,
  buildTrefoil,
  buildQuatrefoil,
  buildLancetSubdivision,
  buildOculusPlacement,
  buildComposedWindow,
  buildTraceryConstruction,
  traceryFramingBounds,
  DEFAULT_COMPOSED_PARAMS,
  DEFAULT_SUBDIVISION_PARAMS,
  DEFAULT_OCULUS_PARAMS,
  DEFAULT_FOIL_PARAMS,
  REGION_TYPES,
  DEFAULT_REGION_PARAMS,
  buildSolidVoidModel,
  foilToVoidLoop,
} from './tracery/index.js'
export {
  CONSTRUCTION_STATUS,
  DEFAULT_CONSTRUCTION_EXTENT,
  DEFAULT_GRID,
  buildArchConstruction,
  buildArchComparison,
} from './construction/index.js'
export {
  CONSTRUCTION_MODES,
  PRIMITIVE_TOOLS,
  WORKSPACE_MODES,
  DEFAULT_GOTHIC_GRAMMAR,
  resetGothicGrammar,
  createGrammarSettings,
} from './settings.js'
export {
  EXAMPLE_IDS,
  DEFAULT_EXAMPLE_PARAMS,
  buildExample,
  constructionBounds,
} from './examples.js'
export {
  MESH_GROUPS,
  DEFAULT_STONE_PARAMS,
  DEPTH_ALIGNMENTS,
  TESSELLATION_QUALITY,
  PROFILE_TYPES,
  buildStoneAssembly,
  extrudeRegion,
  buildProfile,
  sweepProfile,
  validateMesh,
  stoneGeometryKey,
} from './solids/index.js'
export {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  DEFAULT_ASSEMBLY_PARAMS,
  computeBayLayout,
  resolveBayScales,
  buildGothicFacadeElevation,
  validateGothicFacadeElevation,
  generateGothicWindowModule,
  buildGothicWindowModule,
  clearWindowModuleCache,
  resolveWindowDesignParams,
  buildLegacyAssemblyWindowDesign,
  ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT,
  buildPierSupport,
  buildBaseCourse,
  buildGothicClusteredPier,
  buildGothicSteppedButtress,
  buildArticulatedSupport,
} from './assemblies/index.js'
