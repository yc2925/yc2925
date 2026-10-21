/**
 * Ornament System — Steps 7–10C settings.
 * Growth conditions, trails, branching, composition, tapered geometry, integration.
 */

import {
  COMPOSITION_MODES,
  GROWTH_REGIONS,
  MOTIF_TYPES,
} from './composition.js'
import {
  ORNAMENT_MATERIAL_MODES,
  ORNAMENT_PROFILE_TYPES,
  SCULPTURE_MODES,
} from './ornamentGeometry.js'

export {
  COMPOSITION_MODES,
  GROWTH_REGIONS,
  MOTIF_TYPES,
  ORNAMENT_MATERIAL_MODES,
  ORNAMENT_PROFILE_TYPES,
  SCULPTURE_MODES,
}

export const ORNAMENT_DISPLAY_MODES = [
  { id: 'architecture', label: 'Architecture' },
  { id: 'anchors', label: 'Anchors' },
  { id: 'suitability', label: 'Suitability' },
  { id: 'direction', label: 'Direction Field' },
  { id: 'trails', label: 'Particle Trails' },
  { id: 'branching', label: 'Branching' },
  { id: 'geometry', label: 'Ornament Geometry' },
]

export const GROWTH_MODES = [
  { id: 'constrained', label: 'Constrained' },
  { id: 'hybrid', label: 'Hybrid' },
]

export const ARCH_SOURCES = [
  {
    id: 'window',
    label: 'Tracery Window',
    note: 'Uses the Gothic Architecture window generator. Portal / Façade later.',
  },
]

export const VIEW_ISOLATION_MODES = [
  { id: 'combined', label: 'Combined' },
  { id: 'architecture', label: 'Architecture Only' },
  { id: 'ornament', label: 'Ornament Only' },
]

export const DEFAULT_ORNAMENT = {
  // Architectural source (independent of growth seed)
  archSource: 'window',
  traceryFamily: 'geometric',
  activePreset: 'geo-twin-trefoil',
  variationSeed: 3,
  windowAspect: 1.95,
  lancetCount: 2,
  upperTraceryHeight: 0.34,
  curvature: 0.48,
  subdivisionComplexity: 0.35,
  symmetry: true,
  // Stone (match Gothic defaults; not editable heavily here)
  profileThickness: 0.055,
  architecturalDepth: 0.14,
  moldingComplexity: 2,
  moldingProfile: 'compound',
  moldingDepth: 0.55,
  bevelIntensity: 0.45,
  detailResolution: 0.55,
  // Growth distribution
  anchorCount: 120,
  minAnchorSpacing: 0.12,
  growthSeed: 11,
  // Suitability weights — bias ornamental zones
  frameAttraction: 0.4,
  mullionAttraction: 0.65,
  traceryAttraction: 0.75,
  junctionAttraction: 0.9,
  heightPreference: 0.62,
  // Direction blend (Step 7 diagnostics)
  architecturalFollowing: 0.9,
  upwardBias: 0.35,
  junctionPull: 0.55,
  outwardBias: 0.18,
  // Particle simulation — curated default: few master paths for composition
  growthMode: 'hybrid',
  particleCount: 3,
  spawnThreshold: 0.55,
  growthSpeed: 1,
  simulationDuration: 12,
  gravity: 0.25,
  curlStrength: 0.2,
  organicDeviation: 0.15,
  explorationBias: 0.45,
  architecturalProximity: 0.82,
  growthEnvelope: 0.32,
  maximumPathLength: 0, // 0 = auto from window scale
  trailSpacing: 0.14,
  maxArchDistance: 0, // 0 = auto from window scale
  showParticleHeads: true,
  distinguishGrowthSegments: true,
  showPrimarySecondary: true,
  showGrowthEnvelope: false,
  showOccupancy: false,
  trailOpacity: 0.85,
  trailThickness: 1.5,
  simRunning: false,
  // Step 9 — L-system branching (post-process on primary trails)
  branchGenerations: 1,
  branchDensity: 0.4,
  branchAngle: 34,
  lengthDecay: 0.48,
  architecturalAttraction: 0.55,
  curlInfluence: 0.42,
  symmetryBias: 0.55,
  // Step 9.5 — animated hierarchical growth
  branchGrowthSpeed: 1,
  branchDelay: 0.35,
  // Particle primaries often finish in ~2s; stretch maps the sequence onto simulationDuration
  stretchTimeline: true,
  showGrowingTips: true,
  showGrowthOrigins: false,
  showBranchPrimary: true,
  showBranchSecondary: true,
  showBranchArchitecture: true,
  // Step 9.7 — ornamental composition
  compositionMode: 'bilateral',
  symmetryStrength: 1,
  growthRegion: 'upper-tracery',
  motifType: 'scroll',
  motifSpacing: 0.55,
  motifScale: 0.55,
  repetitionCount: 4,
  masterPathCount: 3,
  showSymmetryAxis: false,
  showMasterPaths: true,
  showMirroredPaths: true,
  showMotifOrigins: false,
  // Step 10A — tapered ornamental geometry
  ornamentThickness: 0.032,
  taperStrength: 0.72,
  branchThicknessDecay: 0.68,
  radialResolution: 12,
  curveResolution: 0.55,
  ornamentMaterialMode: 'stone',
  showCurveSkeleton: false,
  showOrnamentArchitecture: true,
  // Step 10B — sculptural profiles + relief
  profileType: 'leaf',
  profileWidth: 1.4,
  profileDepth: 0.58,
  flutingStrength: 0.48,
  profileTransition: 0.58,
  reliefDepth: 0.016,
  sculptureMode: 'surface',
  tipCurl: 0.55,
  // Step 10C — architectural integration
  attachmentStrength: 0.88,
  surfaceConformity: 0.72,
  rootEmbedding: 0.014,
  reliefProjection: 0.018,
  sculpturalEmergence: 0.52,
  transitionLength: 0.55,
  viewIsolation: 'combined',
  showAttachmentPoints: false,
  showSurfaceNormals: false,
  showAttachmentFrames: false,
  showReliefTransitions: false,
  // Visualization — curated default opens on branching composition
  displayMode: 'branching',
  showArchitecture: true,
  diagnosticDensity: 0.7,
  suitabilityThreshold: 0,
  stoneColor: '#c4bfb4',
  stoneRoughness: 0.78,
  surfaceVariation: 0.25,
}

export function resetOrnament() {
  return { ...DEFAULT_ORNAMENT }
}
