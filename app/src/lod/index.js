/**
 * Step 12B — Camera-dependent LOD public API (Node-safe; no JSX).
 * React components: import from LodController.jsx / LodDebug.jsx / FpsProbe.jsx.
 */

export {
  LOD_LEVELS,
  LOD_LABELS,
  LOD_SCREEN_THRESHOLDS,
  LOD_HYSTERESIS,
  GOTHIC_LOD_SPEC,
  ORNAMENT_LOD_SPEC,
  AGENT_VIZ_LOD_SPEC,
  DEFAULT_LOD_SETTINGS,
  normalizeLodLevel,
} from './config.js'

export {
  envelopeFromBounds,
  measureProjectedSize,
  thresholdsWithBias,
  lodFromProjectedFrac,
  selectLodWithHysteresis,
  evaluateLod,
} from './screenSpace.js'

export {
  makeLodCacheKey,
  createLodGeometryCache,
  estimateGeometryBytes,
  countMeshTriangles,
} from './cache.js'

export {
  resolveGothicRenderParams,
  resolveOrnamentRenderParams,
  resolveAgentVizParams,
} from './resolve.js'
