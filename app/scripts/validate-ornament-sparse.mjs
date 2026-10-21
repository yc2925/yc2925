/**
 * Sparse ornamental path validation (post–8.5 refinement).
 * Run: node scripts/validate-ornament-sparse.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation, FIXED_DT } from '../src/ornament/particles.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'

const architecture = buildOrnamentArchitecture(DEFAULT_ORNAMENT)

function run(growthSeed, growthMode = 'hybrid') {
  const growth = generateGrowthConditions(architecture.arch, {
    anchorCount: 100,
    minAnchorSpacing: 0.12,
    growthSeed,
    frameAttraction: DEFAULT_ORNAMENT.frameAttraction,
    mullionAttraction: DEFAULT_ORNAMENT.mullionAttraction,
    traceryAttraction: DEFAULT_ORNAMENT.traceryAttraction,
    junctionAttraction: DEFAULT_ORNAMENT.junctionAttraction,
    heightPreference: DEFAULT_ORNAMENT.heightPreference,
    architecturalFollowing: DEFAULT_ORNAMENT.architecturalFollowing,
    upwardBias: DEFAULT_ORNAMENT.upwardBias,
    junctionPull: DEFAULT_ORNAMENT.junctionPull,
    outwardBias: DEFAULT_ORNAMENT.outwardBias,
  })
  const sim = createParticleSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: {
      growthMode,
      particleCount: 8,
      spawnThreshold: 0.55,
      growthSpeed: 1,
      simulationDuration: 12,
      growthSeed,
      architecturalFollowing: 0.9,
      upwardBias: 0.35,
      gravity: 0.25,
      curlStrength: 0.2,
      organicDeviation: 0.15,
      junctionAttraction: 0.55,
      explorationBias: 0.45,
      architecturalProximity: 0.82,
      growthEnvelope: 0.28,
      maximumPathLength: 0,
      trailSpacing: 0.14,
      maxArchDistance: 0,
    },
  })
  sim.start()
  const maxSteps = Math.ceil(12 / FIXED_DT) + 5
  for (let i = 0; i < maxSteps && !sim.state.finished; i += 1) sim.tick()
  return sim
}

const seeds = [11, 23, 47, 61]
let ok = true
console.log('=== Sparse ornament validation ===')

for (const seed of seeds) {
  const sim = run(seed, 'hybrid')
  const s = sim.getStats()
  const a = run(seed, 'hybrid').getStats()
  const det =
    Math.abs(s.totalTrailLength - a.totalTrailLength) < 1e-9 &&
    s.totalPoints === a.totalPoints

  const primaryLonger = s.avgPrimaryLength >= s.avgSecondaryLength * 0.85
  const sparse = s.totalTrailLength < 80 && s.averageTrailLength < 14
  const substantial = s.averageTrailLength >= 1.2 && s.totalTrailLength >= 10
  const nearArch = s.averageArchDistance < 0.28
  const notSpaghetti = (s.freePoints ?? 0) < 2500

  console.log(
    `seed=${seed} t=${s.time.toFixed(2)} totalLen=${s.totalTrailLength.toFixed(1)} avg=${s.averageTrailLength.toFixed(2)} P/S=${s.avgPrimaryLength.toFixed(2)}/${s.avgSecondaryLength.toFixed(2)} archDist=${s.averageArchDistance.toFixed(3)} free=${s.freePoints} occEnds=${s.occupancyTerminations} rejected=${s.rejectedGrowth}`,
  )
  console.log('  reasons:', s.terminationByReason, 'det:', det)

  if (!det || !sparse || !substantial || !nearArch || !primaryLonger || !notSpaghetti) {
    ok = false
    console.log('  FAIL', { det, sparse, substantial, nearArch, primaryLonger, notSpaghetti })
  }
}

// Constrained smoke
const c = run(11, 'constrained').getStats()
console.log(
  `constrained seed=11 totalLen=${c.totalTrailLength.toFixed(1)} avg=${c.averageTrailLength.toFixed(2)} P/S=${c.avgPrimaryLength.toFixed(2)}/${c.avgSecondaryLength.toFixed(2)}`,
)

architecture.dispose()
if (!ok) process.exitCode = 1
else console.log('ALL CHECKS PASSED')
