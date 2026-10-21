/**
 * Step 9.5 animated growth validation (+ timeline stretch).
 * Run: node scripts/validate-ornament-growth-playback.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation } from '../src/ornament/particles.js'
import { completeParticleTrails, generateOrnamentBranches } from '../src/ornament/branching.js'
import {
  createGrowthPlayback,
  revealBranchAtTime,
  scheduleBranchTiming,
} from '../src/ornament/growthPlayback.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'

const architecture = buildOrnamentArchitecture(DEFAULT_ORNAMENT)
const growth = generateGrowthConditions(architecture.arch, {
  ...DEFAULT_ORNAMENT,
  growthSeed: 11,
  anchorCount: 80,
})

function buildNetwork(seed, gens) {
  const sim = createParticleSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: { ...DEFAULT_ORNAMENT, particleCount: 7, growthSeed: seed },
  })
  const trails = completeParticleTrails(sim)
  return generateOrnamentBranches({
    trails,
    arch: architecture.arch,
    curveSamples: growth.curveSamples,
    params: {
      ...DEFAULT_ORNAMENT,
      branchGenerations: gens,
      growthSeed: seed,
    },
  })
}

let ok = true
console.log('=== Ornament growth playback validation ===')

for (const gens of [1, 2]) {
  const network = buildNetwork(11, gens)
  const playback = createGrowthPlayback(network, {
    ...DEFAULT_ORNAMENT,
    branchGenerations: gens,
    growthSeed: 11,
    simulationDuration: 12,
    stretchTimeline: true,
  })

  const at0 = playback.getVisible()
  const segs0 = at0.branches.reduce((n, b) => n + Math.max(0, b.points.length - 1), 0)

  playback.setTime(0.5)
  const early = playback.getVisible()
  const earlySecondary = early.branches.filter((b) => b.generation >= 1)

  const child = network.branches.find((b) => b.generation === 1)
  let childWaits = true
  if (child) {
    const before = revealBranchAtTime(child, Math.max(0, child.birthTime - 0.05))
    const after = revealBranchAtTime(child, child.birthTime + child.growthDuration * 0.4)
    childWaits = before.points.length < 2 && after.points.length >= 2
  }

  playback.setTime(playback.state.duration)
  const done = playback.getVisible()
  const fullSegs = done.branches.reduce((n, b) => n + Math.max(0, b.points.length - 1), 0)

  playback.setTime(2.5)
  const a = JSON.stringify(playback.getVisible().branches.map((b) => b.points.length))
  playback.setTime(1.0)
  playback.setTime(2.5)
  const b = JSON.stringify(playback.getVisible().branches.map((b) => b.points.length))

  playback.setTime(1.2)
  playback.start()
  playback.pause()
  const tPause = playback.state.time
  playback.advance(0.5)
  const pausedOk = Math.abs(playback.state.time - tPause) < 1e-9

  playback.reset()
  const resetOk =
    playback.state.time === 0 &&
    playback.getVisible().branches.every((br) => br.points.length < 2)

  playback.setTime(0.15)
  const mid = playback.getVisible()
  const anyFullTooEarly = mid.branches.some(
    (br) => br.generation >= 1 && br.visibleLength >= (br.length ?? 1) - 1e-6,
  )

  // With stretch, mid-timeline should still have growing work
  playback.setTime(6)
  const midStats = playback.getStats()
  const stretchKeepsGoing =
    midStats.stretchTimeline !== false &&
    !midStats.finished &&
    midStats.stretch > 1.5

  console.log(
    `gens=${gens} segs0=${segs0} earlySec=${earlySecondary.length} fullSegs=${fullSegs} childWaits=${childWaits} scrub=${a === b} pause=${pausedOk} reset=${resetOk} stretch=${(midStats.stretch ?? 1).toFixed(2)}`,
  )

  if (
    segs0 !== 0 ||
    !childWaits ||
    a !== b ||
    !pausedOk ||
    !resetOk ||
    anyFullTooEarly ||
    fullSegs < 5 ||
    !stretchKeepsGoing
  ) {
    ok = false
    console.log('  FAIL', {
      segs0,
      childWaits,
      scrub: a === b,
      pausedOk,
      resetOk,
      anyFullTooEarly,
      fullSegs,
      stretchKeepsGoing,
      stretch: midStats.stretch,
      finishedAt6: midStats.finished,
    })
  }
}

// Natural (no stretch) may finish early; stretch fills duration
{
  const network = buildNetwork(23, 1)
  const natural = scheduleBranchTiming(
    { ...network, branches: network.branches.map((b) => ({ ...b, pointTimes: b.pointTimes ? [...b.pointTimes] : undefined, points: b.points.map((p) => ({ ...p })) })) },
    { ...DEFAULT_ORNAMENT, stretchTimeline: false, simulationDuration: 12 },
  )
  const stretched = scheduleBranchTiming(
    { ...network, branches: network.branches.map((b) => ({ ...b, pointTimes: b.pointTimes ? [...b.pointTimes] : undefined, points: b.points.map((p) => ({ ...p })) })) },
    { ...DEFAULT_ORNAMENT, stretchTimeline: true, simulationDuration: 12 },
  )
  const naturalEnd = natural.timing.naturalEnd
  const stretchEnd = stretched.timing.endTime
  // Primaries often finish well before duration; longer gen-1 gestures push this higher
  const earlyNatural = naturalEnd < 10 && naturalEnd < 12 * 0.9
  const stretchFills = stretchEnd >= 11.5 && stretched.timing.stretch > 1.05

  const pbNat = createGrowthPlayback(
    generateOrnamentBranches({
      trails: completeParticleTrails(
        createParticleSimulation({
          arch: architecture.arch,
          anchors: growth.anchors,
          params: { ...DEFAULT_ORNAMENT, particleCount: 7, growthSeed: 23 },
        }),
      ),
      arch: architecture.arch,
      curveSamples: growth.curveSamples,
      params: { ...DEFAULT_ORNAMENT, branchGenerations: 1, growthSeed: 23 },
    }),
    { ...DEFAULT_ORNAMENT, stretchTimeline: false, simulationDuration: 12 },
  )
  pbNat.setTime(Math.min(3.5, pbNat.state.duration))
  pbNat.start()
  // Advance past natural completion but before duration
  pbNat.setTime(Math.max(pbNat.network.timing.naturalEnd + 0.05, 3))
  const finishedEarly = pbNat.state.finished === true

  const pbStretch = createGrowthPlayback(
    generateOrnamentBranches({
      trails: completeParticleTrails(
        createParticleSimulation({
          arch: architecture.arch,
          anchors: growth.anchors,
          params: { ...DEFAULT_ORNAMENT, particleCount: 7, growthSeed: 23 },
        }),
      ),
      arch: architecture.arch,
      curveSamples: growth.curveSamples,
      params: { ...DEFAULT_ORNAMENT, branchGenerations: 1, growthSeed: 23 },
    }),
    { ...DEFAULT_ORNAMENT, stretchTimeline: true, simulationDuration: 12 },
  )
  pbStretch.setTime(3)
  const notFinishedAt3 = pbStretch.state.finished === false
  pbStretch.setTime(12)
  const finishedAt12 = pbStretch.state.finished === true

  console.log(
    `timeline naturalEnd=${naturalEnd.toFixed(2)} earlyNatural=${earlyNatural} stretchFills=${stretchFills} finishedEarly=${finishedEarly} notFinishedAt3=${notFinishedAt3} finishedAt12=${finishedAt12}`,
  )
  if (!earlyNatural || !stretchFills || !finishedEarly || !notFinishedAt3 || !finishedAt12) {
    ok = false
    console.log('  FAIL timeline semantics', {
      earlyNatural,
      stretchFills,
      finishedEarly,
      notFinishedAt3,
      finishedAt12,
      naturalEnd,
      stretch: stretched.timing.stretch,
    })
  }
}

const n = buildNetwork(23, 1)
const avgLen =
  n.branches.filter((b) => b.generation === 1).reduce((s, b) => s + b.length, 0) /
  Math.max(1, n.branches.filter((b) => b.generation === 1).length)
console.log('avg gen1 length', avgLen.toFixed(3))
if (avgLen < 0.55) {
  ok = false
  console.log('  FAIL: branches still too short')
}

architecture.dispose()
if (!ok) process.exitCode = 1
else console.log('ALL CHECKS PASSED')
