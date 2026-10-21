/**
 * Step 9 branching validation (refined lengths / departure).
 * Run: node scripts/validate-ornament-branching.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation } from '../src/ornament/particles.js'
import {
  completeParticleTrails,
  generateOrnamentBranches,
} from '../src/ornament/branching.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

const PRESETS = ['geo-twin-trefoil', 'ray-rose-wheel', 'flam-ogee-head']

function distToPolyline(px, py, points) {
  let minD = Infinity
  for (const p of points) {
    const d = Math.hypot(p.x - px, p.y - py)
    if (d < minD) minD = d
  }
  return minD
}

function meanMaxDeparture(network, generation = 1) {
  const kids = network.branches.filter((b) => b.generation === generation)
  if (!kids.length) return 0
  let sum = 0
  for (const b of kids) {
    const parent = network.branches.find((p) => p.id === b.parentId)
    if (!parent) continue
    let maxD = 0
    for (const p of b.points) {
      maxD = Math.max(maxD, distToPolyline(p.x, p.y, parent.points))
    }
    sum += maxD
  }
  return sum / kids.length
}

function avgLen(network, generation) {
  const kids = network.branches.filter((b) => b.generation === generation)
  if (!kids.length) return 0
  return kids.reduce((s, b) => s + b.length, 0) / kids.length
}

function trailsFor(arch, seed) {
  const growth = generateGrowthConditions(arch, {
    anchorCount: 100,
    minAnchorSpacing: 0.12,
    growthSeed: seed,
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
    arch,
    anchors: growth.anchors,
    params: {
      ...DEFAULT_ORNAMENT,
      particleCount: 7,
      growthSeed: seed,
      simulationDuration: 12,
    },
  })
  return { trails: completeParticleTrails(sim), growth }
}

function runBranch(arch, trails, growth, seed, gens) {
  return generateOrnamentBranches({
    trails,
    arch,
    curveSamples: growth.curveSamples,
    params: {
      ...DEFAULT_ORNAMENT,
      branchGenerations: gens,
      growthSeed: seed,
    },
  })
}

let ok = true
console.log('=== Ornament branching refinement validation ===')

for (const presetId of PRESETS) {
  const settings = applyPreset({ ...DEFAULT_ORNAMENT }, presetId)
  const architecture = buildOrnamentArchitecture({
    ...DEFAULT_ORNAMENT,
    ...settings,
    activePreset: presetId,
  })

  for (const seed of [11, 23, 47]) {
    const { trails, growth } = trailsFor(architecture.arch, seed)
    const g0 = runBranch(architecture.arch, trails, growth, seed, 0)
    const g1 = runBranch(architecture.arch, trails, growth, seed, 1)
    const g2 = runBranch(architecture.arch, trails, growth, seed, 2)
    const g1b = runBranch(architecture.arch, trails, growth, seed, 1)

    const gen0Only =
      g0.stats.branchCount === (g0.stats.byGeneration[0] ?? 0) &&
      (g0.stats.byGeneration[1] ?? 0) === 0 &&
      g0.stats.branchCount > 0
    const gen1Has = (g1.stats.byGeneration[1] ?? 0) > 0
    const gen2More = g2.stats.branchCount >= g1.stats.branchCount
    const bounded = g2.stats.branchCount <= 220 && g2.stats.totalSegments <= 5000
    const det =
      g1.stats.branchCount === g1b.stats.branchCount &&
      g1.stats.totalSegments === g1b.stats.totalSegments

    const ids = new Set(g1.branches.map((b) => b.id))
    const parentsOk = g1.branches
      .filter((b) => b.generation >= 1)
      .every((b) => b.parentId && ids.has(b.parentId))

    let originsOnParent = true
    for (const b of g1.branches.filter((x) => x.generation === 1)) {
      const parent = g1.branches.find((p) => p.id === b.parentId)
      if (!parent || distToPolyline(b.origin.x, b.origin.y, parent.points) > 0.12) {
        originsOnParent = false
        break
      }
    }

    let tangentOk = true
    for (const b of g1.branches.filter((x) => x.generation === 1 && x.points.length >= 2)) {
      const dx = b.points[1].x - b.points[0].x
      const dy = b.points[1].y - b.points[0].y
      const len = Math.hypot(dx, dy) || 1
      const dot = (dx / len) * b.originTangent.x + (dy / len) * b.originTangent.y
      if (dot < 0.35) tangentOk = false
    }

    const len1 = avgLen(g1, 1)
    const dep1 = meanMaxDeparture(g1, 1)
    const len2 = avgLen(g2, 2)
    // Gen-1 should be clearly longer than scratches; gen-2 shorter on average when present
    const lengthOk = len1 >= 0.55
    const departureOk = dep1 >= 0.18
    const hierarchyOk = !len2 || len2 < len1 * 0.95

    console.log(
      `${presetId} seed=${seed} trails=${trails.length} g1=${g1.stats.branchCount} g2=${g2.stats.branchCount} len1=${len1.toFixed(2)} dep1=${dep1.toFixed(2)} ms=${g1.stats.elapsedMs.toFixed(1)}`,
    )
    console.log('  byGen', g1.stats.byGeneration, '→', g2.stats.byGeneration)

    if (
      !gen0Only ||
      !gen1Has ||
      !gen2More ||
      !bounded ||
      !det ||
      !parentsOk ||
      !originsOnParent ||
      !tangentOk ||
      !lengthOk ||
      !departureOk ||
      !hierarchyOk
    ) {
      ok = false
      console.log('  FAIL', {
        gen0Only,
        gen1Has,
        gen2More,
        bounded,
        det,
        parentsOk,
        originsOnParent,
        tangentOk,
        lengthOk,
        departureOk,
        hierarchyOk,
        len1,
        dep1,
        len2,
      })
    }
  }

  architecture.dispose()
}

if (!ok) process.exitCode = 1
else console.log('ALL CHECKS PASSED')
