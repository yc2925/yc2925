/**
 * Headless Step 8.5 validation: constrained / hybrid, multiple seeds.
 * Run: node scripts/validate-ornament-85.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation, FIXED_DT } from '../src/ornament/particles.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'

function runSim(arch, anchors, params) {
  const sim = createParticleSimulation({ arch, anchors, params })
  sim.start()
  const maxSteps = Math.ceil((params.simulationDuration ?? 12) / FIXED_DT) + 5
  for (let i = 0; i < maxSteps && !sim.state.finished; i += 1) {
    sim.tick()
  }
  return sim.getStats()
}

function teleportCheck(sim) {
  const trails = sim.getTrails()
  let jumps = 0
  for (const t of trails) {
    const pts = t.positions
    for (let i = 1; i < pts.length; i += 1) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const dz = pts[i].z - pts[i - 1].z
      const d = Math.hypot(dx, dy, dz)
      if (d > 0.35) jumps += 1
    }
  }
  return jumps
}

function determinismCheck(arch, anchors, params) {
  const a = runSim(arch, anchors, params)
  const b = runSim(arch, anchors, params)
  return (
    Math.abs(a.totalTrailLength - b.totalTrailLength) < 1e-9 &&
    a.totalPoints === b.totalPoints &&
    JSON.stringify(a.terminationByReason) === JSON.stringify(b.terminationByReason)
  )
}

const architecture = buildOrnamentArchitecture({
  ...DEFAULT_ORNAMENT,
  activePreset: 'geo-twin-trefoil',
})
const growth = generateGrowthConditions(architecture.arch, {
  anchorCount: 80,
  minAnchorSpacing: 0.12,
  growthSeed: 11,
  frameAttraction: 0.55,
  mullionAttraction: 0.7,
  traceryAttraction: 0.65,
  junctionAttraction: 0.8,
  heightPreference: 0.45,
  architecturalFollowing: 0.75,
  upwardBias: 0.35,
  junctionPull: 0.4,
  outwardBias: 0.25,
})

const seeds = [11, 23, 47]
const modes = ['constrained', 'hybrid']
const rows = []

for (const growthMode of modes) {
  for (const growthSeed of seeds) {
    const params = {
      growthMode,
      particleCount: 16,
      spawnThreshold: 0.4,
      growthSpeed: 1,
      simulationDuration: 12,
      growthSeed,
      architecturalFollowing: 0.75,
      upwardBias: 0.35,
      gravity: 0.25,
      curlStrength: 0.45,
      organicDeviation: 0.4,
      junctionAttraction: 0.45,
      explorationBias: growthMode === 'constrained' ? 0.75 : 0.45,
      architecturalProximity: growthMode === 'hybrid' ? 0.7 : 0.5,
      growthEnvelope: 0.35,
    }
    const g = generateGrowthConditions(architecture.arch, {
      ...growth,
      growthSeed,
      anchorCount: 80,
      minAnchorSpacing: 0.12,
      frameAttraction: 0.55,
      mullionAttraction: 0.7,
      traceryAttraction: 0.65,
      junctionAttraction: 0.8,
      heightPreference: 0.45,
      architecturalFollowing: 0.75,
      upwardBias: 0.35,
      junctionPull: 0.4,
      outwardBias: 0.25,
    })
    const sim = createParticleSimulation({
      arch: architecture.arch,
      anchors: g.anchors,
      params,
    })
    sim.start()
    const maxSteps = Math.ceil(12 / FIXED_DT) + 5
    for (let i = 0; i < maxSteps && !sim.state.finished; i += 1) sim.tick()
    const stats = sim.getStats()
    const jumps = teleportCheck(sim)
    const ages = sim.state.particles.map((p) => p.age)
    const maxAge = Math.max(...ages)
    const meanAge = ages.reduce((n, v) => n + v, 0) / ages.length
    rows.push({
      growthMode,
      growthSeed,
      finished: stats.finished,
      time: stats.time.toFixed(2),
      avgLen: stats.averageTrailLength.toFixed(2),
      maxAge: maxAge.toFixed(2),
      meanAge: meanAge.toFixed(2),
      pathBudget: stats.maxPathLength.toFixed(2),
      jumps,
      reasons: stats.terminationByReason,
      freePts: stats.freePoints,
      constrainedPts: stats.constrainedPoints,
    })
  }
}

// Exploration bias: higher bias should flatten travel share across curves
function visitSpread(explorationBias) {
  const sim = createParticleSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: {
      growthMode: 'constrained',
      simulationDuration: 12,
      particleCount: 28,
      growthSeed: 11,
      explorationBias,
      growthSpeed: 1,
      spawnThreshold: 0.35,
      architecturalFollowing: 0.75,
      upwardBias: 0.35,
      gravity: 0.25,
      curlStrength: 0.4,
      organicDeviation: 0.35,
      junctionAttraction: 0.4,
      architecturalProximity: 0.5,
      growthEnvelope: 0.35,
    },
  })
  sim.start()
  while (!sim.state.finished) sim.tick()
  const counts = [...sim.state.visitCounts.values()]
  if (!counts.length) return { unique: 0, maxShare: 1, entropy: 0 }
  const total = counts.reduce((n, v) => n + v, 0) || 1
  const shares = counts.map((v) => v / total)
  const maxShare = Math.max(...shares)
  const entropy = -shares.reduce((n, s) => n + (s > 0 ? s * Math.log(s) : 0), 0)
  return { unique: counts.length, maxShare, entropy, total: total.toFixed(1) }
}

const lowExplore = visitSpread(0.08)
const highExplore = visitSpread(0.92)

const det = determinismCheck(architecture.arch, growth.anchors, {
  growthMode: 'hybrid',
  particleCount: 12,
  spawnThreshold: 0.4,
  growthSpeed: 1,
  simulationDuration: 8,
  growthSeed: 19,
  architecturalFollowing: 0.75,
  upwardBias: 0.35,
  gravity: 0.25,
  curlStrength: 0.5,
  organicDeviation: 0.4,
  junctionAttraction: 0.4,
  explorationBias: 0.55,
  architecturalProximity: 0.65,
  growthEnvelope: 0.35,
})

console.log('=== Step 8.5 validation ===')
for (const r of rows) {
  console.log(
    `${r.growthMode.padEnd(12)} seed=${r.growthSeed} t=${r.time}s meanAge=${r.meanAge} maxAge=${r.maxAge} avgLen=${r.avgLen} budget=${r.pathBudget} jumps=${r.jumps} c/f=${r.constrainedPts}/${r.freePts}`,
  )
  console.log('  reasons:', r.reasons)
}

const constrainedOk = rows
  .filter((r) => r.growthMode === 'constrained')
  .every((r) => Number(r.meanAge) >= 6 && Number(r.maxAge) >= 10)
const hybridOk = rows
  .filter((r) => r.growthMode === 'hybrid')
  .every((r) => Number(r.meanAge) >= 5 && Number(r.time) >= 6)
const noTeleports = rows.every((r) => r.jumps === 0)
const exploreImproves =
  highExplore.unique >= lowExplore.unique &&
  (highExplore.entropy + 1e-6 >= lowExplore.entropy || highExplore.maxShare <= lowExplore.maxShare + 0.02)

console.log('determinism:', det)
console.log('exploration low:', lowExplore)
console.log('exploration high:', highExplore)
console.log('checks:', {
  constrainedLongevity: constrainedOk,
  hybridLongevity: hybridOk,
  noTeleports,
  exploreImproves,
})

architecture.dispose()

if (!det || !constrainedOk || !hybridOk || !noTeleports) {
  process.exitCode = 1
}
