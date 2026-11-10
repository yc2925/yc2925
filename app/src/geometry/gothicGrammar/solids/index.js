/**
 * Gothic Grammar solids — Step 13D procedural 3D stone.
 */

export {
  extrudeRegion,
  depthRange,
  DEPTH_ALIGNMENTS,
  TESSELLATION_QUALITY,
  openRing,
  orientRing,
  cleanRing,
  cleanTriangles,
  triangulatePolygonWithHoles,
  triangulationBoundaryEdges,
  splitBoundaryPinches,
  ringIdAt,
  weldPlanarTriangulation,
} from './regionExtrusion.js'

export {
  PROFILE_TYPES,
  DEFAULT_PROFILE_PARAMS,
  buildProfile,
  validateProfileParams,
  listProfileTypes,
} from './profileLibrary.js'

export {
  sweepProfile,
  buildSweepFrames,
  sweepContinuityReport,
} from './profileSweep.js'

export {
  JUNCTION_MODES,
  classifyPathJunctions,
  junctionFallback,
  buildJunctionReport,
} from './stoneJunctions.js'

export {
  createMeshData,
  weldMesh,
  validateMesh,
  analyzeEdges,
  analyzeFaces,
  signedVolume,
  surfaceArea,
  boundingBox,
  triangleCount,
  vertexCount,
} from './meshValidation.js'

export {
  toHardEdgeMesh,
  assignExtrusionNormals,
  planarFaceNormalReport,
} from './hardEdgeNormals.js'

export {
  MESH_GROUPS,
  DEFAULT_STONE_PARAMS,
  buildStoneAssembly,
  stoneGeometryKey,
  validateStructuralOnly,
  sampleRegionRing,
} from './stoneAssembly.js'
