/**
 * Agent Simulation — Steps 11A–11C settings.
 * Finite-state agents + stigmergy + comparison + ornament construction.
 */

export const AGENT_ROLES = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'builder', label: 'Builder' },
  { id: 'regulator', label: 'Regulator' },
]

export const AGENT_STATES = [
  { id: 'dormant', label: 'Dormant' },
  { id: 'exploring', label: 'Exploring' },
  { id: 'depositing', label: 'Depositing' },
  { id: 'building', label: 'Building' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'completed', label: 'Completed' },
]

/**
 * Always-on state colours — restrained, legible on dark stone
 * (signal-red family + cool/warm neutrals; not decorative pastels).
 */
export const AGENT_STATE_COLORS = {
  dormant: '#4a4a4a',
  exploring: '#c8d4e0',
  depositing: '#d4a84a',
  building: '#e8e0d4',
  blocked: '#a31318',
  completed: '#6e6e6e',
}

export const DEFAULT_AGENTS = {
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
  // Step 12A — physical scale (1 wu = 1 m)
  overallHeight: 5.7,
  overallWidth: 3.0,
  architecturalScale: 1,
  worldUnitMeters: 1,
  showScaleReference: false,
  showDimensions: false,
  showHumanReference: false,
  fitToObjectToken: 0,
  // Step 12B — camera LOD (render only)
  enableAutoLod: true,
  lodMode: 'auto',
  lodBias: 0,
  showLodDebug: false,
  sampleSpacing: 0.09,
  minTrailSpacing: 0.1,
  minPathLength: 0.085,
  profileThickness: 0.055,
  architecturalDepth: 0.14,
  moldingComplexity: 2,
  moldingProfile: 'compound',
  moldingDepth: 0.55,
  bevelIntensity: 0.45,
  detailResolution: 0.55,
  stoneColor: '#c4bfb4',
  stoneRoughness: 0.78,
  surfaceVariation: 0.25,
  anchorCount: 100,
  minAnchorSpacing: 0.12,
  growthSeed: 11,
  frameAttraction: 0.4,
  mullionAttraction: 0.65,
  traceryAttraction: 0.75,
  junctionAttraction: 0.9,
  heightPreference: 0.62,
  spawnThreshold: 0.45,
  // Agent system
  enableAgentSimulation: true,
  agentCount: 16,
  simulationSpeed: 1,
  sensingRadius: 0.28,
  movementSpeed: 0.55,
  energyBudget: 2.4,
  agentSeed: 42,
  bilateralSymmetry: true,
  showArchitecture: true,
  showAgentTrails: true,
  showDirectionIndicators: true,
  showStateDebug: true,
  showFullTrailHistory: false,
  trailMaxPoints: 64,
  fixedDt: 1 / 30,
  // Stigmergy — calibrated for visible collective difference
  enableStigmergy: true,
  attractionStrength: 0.72,
  inhibitionStrength: 0.68,
  depositionRate: 0.42,
  depositionRadius: 0.18,
  signalDecay: 0.1,
  signalDiffusion: 0.32,
  explorationBias: 0.4,
  fieldDisplayMode: 'agents',
  // Comparison
  comparisonMode: false,
  compareFieldMode: 'combined',
  // Step 11C — agent-driven ornament construction
  enableOrnamentConstruction: false,
  pathAcceptanceThreshold: 0.42,
  ornamentDensity: 0.55,
  branchComplexity: 0.45,
  primaryThickness: 0.03,
  secondaryThickness: 0.018,
  constructionReliefDepth: 0.014,
  constructionEmergence: 0.55,
  foliateDetail: 0.35,
  constructionDisplayMode: 'agents+ornament',
}

export const FIELD_DISPLAY_MODES = [
  { id: 'agents', label: 'Agents' },
  { id: 'attraction', label: 'Attraction Field' },
  { id: 'inhibition', label: 'Inhibition Field' },
  { id: 'occupancy', label: 'Occupancy Field' },
  { id: 'combined', label: 'Combined Field' },
]

export const CONSTRUCTION_DISPLAY_MODES = [
  { id: 'agents', label: 'Agents Only' },
  { id: 'accepted', label: 'Accepted Paths' },
  { id: 'rejected', label: 'Rejected Paths' },
  { id: 'ornament', label: 'Ornament Geometry' },
  { id: 'agents+ornament', label: 'Agents + Ornament' },
  { id: 'architecture+ornament', label: 'Architecture + Ornament' },
  { id: 'regional', label: 'Regional Composition' },
]

export function resetAgents() {
  return { ...DEFAULT_AGENTS }
}
