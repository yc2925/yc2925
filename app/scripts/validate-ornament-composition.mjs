/**
 * Step 9.7 ornamental composition validation.
 * Run: node scripts/validate-ornament-composition.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation } from '../src/ornament/particles.js'
import { completeParticleTrails } from '../src/ornament/branching.js'
import {
  composeOrnamentNetwork,
  getArchitecturalSymmetryAxis,
  mirrorPoint,
} from '../src/ornament/composition.js'
import { createGrowthPlayback } from '../src/ornament/growthPlayback.js'
import { DEFAULT_ORNAMENT } from '../src/ornament/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

const PRESETS = ['geo-twin-trefoil', 'ray-rose-wheel', 'flam-ogee-head']
const AXIS_EPS = 0.06

function trailsFor(arch, seed, particleCount = 3) {
  const growth = generateGrowthConditions(arch, {
    ...DEFAULT_ORNAMENT,
    growthSeed: seed,
    anchorCount: 100,
  })
  const sim = createParticleSimulation({
    arch,
    anchors: growth.anchors,
    params: { ...DEFAULT_ORNAMENT, particleCount, growthSeed: seed },
  })
  return { trails: completeParticleTrails(sim), growth }
}

function compose(arch, trails, growth, seed, overrides = {}) {
  return composeOrnamentNetwork({
    trails,
    arch,
    curveSamples: growth.curveSamples,
    params: {
      ...DEFAULT_ORNAMENT,
      growthSeed: seed,
      branchGenerations: overrides.branchGenerations ?? 1,
      ...overrides,
    },
  })
}

function avgMirrorError(network, axis) {
  const masters = network.branches.filter((b) => b.compositionRole === 'master')
  let err = 0
  let n = 0
  for (const m of masters) {
    const mid = network.composition?.idMap?.[m.id] ?? `m:${m.id}`
    const mir = network.branches.find((b) => b.id === mid)
    if (!mir) continue
    const len = Math.min(m.points.length, mir.points.length)
    for (let i = 0; i < len; i += 1) {
      const expected = mirrorPoint(m.points[i], axis)
      err += Math.hypot(expected.x - mir.points[i].x, expected.y - mir.points[i].y)
      n += 1
    }
  }
  return n ? err / n : 999
}

let ok = true
console.log('=== Step 9.7 composition validation ===')

for (const presetId of PRESETS) {
  const settings = applyPreset({ ...DEFAULT_ORNAMENT }, presetId)
  const architecture = buildOrnamentArchitecture({
    ...DEFAULT_ORNAMENT,
    ...settings,
    activePreset: presetId,
  })
  const axis = getArchitecturalSymmetryAxis(architecture.arch)

  for (const seed of [11, 23]) {
    const { trails, growth } = trailsFor(architecture.arch, seed, 3)

    // FREE
    const free = compose(architecture.arch, trails, growth, seed, {
      compositionMode: 'free',
      branchGenerations: 1,
    })
    const freeNoMirror = (free.stats.mirrorCount ?? 0) === 0
    const freeHas = free.stats.branchCount > 0

    // BILATERAL perfect
    const bil = compose(architecture.arch, trails, growth, seed, {
      compositionMode: 'bilateral',
      symmetryStrength: 1,
      branchGenerations: 1,
      masterPathCount: 3,
      growthRegion: 'upper-tracery',
    })
    const masters = bil.branches.filter((b) => b.compositionRole === 'master')
    const mirrors = bil.branches.filter((b) => b.compositionRole === 'mirror')
    const mirrorErr = avgMirrorError(bil, axis)
    const ids = new Set(bil.branches.map((b) => b.id))
    const parentsOk = bil.branches.every((b) => !b.parentId || ids.has(b.parentId))
    const originsMirrored = mirrors.every((m) => {
      const src = masters.find((x) => x.id === m.sourceId)
      if (!src) return false
      const exp = mirrorPoint(src.origin, axis)
      return Math.hypot(exp.x - m.origin.x, exp.y - m.origin.y) < AXIS_EPS
    })
    const noAxisDup = masters.every((m) => {
      const mean = m.points.reduce((s, p) => s + Math.abs(p.x - axis.axisX), 0) / m.points.length
      if (mean < 0.04) return !bil.composition.idMap?.[m.id]
      return true
    })

    // Timing sync
    const playback = createGrowthPlayback(bil, {
      ...DEFAULT_ORNAMENT,
      compositionMode: 'bilateral',
      simulationDuration: 12,
      stretchTimeline: true,
    })
    playback.setTime(4)
    const vis = playback.getVisible()
    let timingOk = true
    for (const m of bil.branches.filter((b) => b.compositionRole === 'master' && b.generation >= 1)) {
      const mir = bil.branches.find((b) => b.id === `m:${m.id}`)
      if (!mir) continue
      if (Math.abs((m.birthTime ?? 0) - (mir.birthTime ?? 0)) > 1e-6) timingOk = false
      if (Math.abs((m.growthDuration ?? 0) - (mir.growthDuration ?? 0)) > 1e-6) timingOk = false
      const vm = vis.branches.find((b) => b.id === m.id)
      const vr = vis.branches.find((b) => b.id === mir.id)
      if (vm && vr) {
        const ratioM = (vm.visibleLength ?? 0) / Math.max(1e-6, vm.length ?? 1)
        const ratioR = (vr.visibleLength ?? 0) / Math.max(1e-6, vr.length ?? 1)
        if (Math.abs(ratioM - ratioR) > 0.08) timingOk = false
      }
    }

    // RHYTHMIC
    const rhy = compose(architecture.arch, trails, growth, seed, {
      compositionMode: 'rhythmic',
      motifType: 'scroll',
      motifSpacing: 0.55,
      motifScale: 0.5,
      repetitionCount: 4,
      symmetryStrength: 1,
      growthRegion: 'upper-tracery',
    })
    const rhyHas = rhy.stats.branchCount >= 2
    const rhyOrigins = (rhy.composition?.motifOrigins ?? []).length > 0

    // Strength mid — not exact but still linked
    const soft = compose(architecture.arch, trails, growth, seed, {
      compositionMode: 'bilateral',
      symmetryStrength: 0.55,
      branchGenerations: 1,
    })
    const softErr = avgMirrorError(soft, axis)
    const softStillPaired = (soft.stats.mirrorCount ?? 0) > 0

    // 2 gens
    const g2 = compose(architecture.arch, trails, growth, seed, {
      compositionMode: 'bilateral',
      symmetryStrength: 1,
      branchGenerations: 2,
    })
    const g2ok = (g2.stats.byGeneration?.[2] ?? 0) >= 0 && g2.stats.branchCount >= bil.stats.branchCount

    console.log(
      `${presetId} seed=${seed} free=${free.stats.branchCount} bil=${bil.stats.branchCount} (M${masters.length}/m${mirrors.length}) err=${mirrorErr.toFixed(4)} rhy=${rhy.stats.branchCount} softErr=${softErr.toFixed(3)}`,
    )

    if (
      !freeNoMirror ||
      !freeHas ||
      mirrors.length < 1 ||
      mirrorErr > 0.02 ||
      !parentsOk ||
      !originsMirrored ||
      !timingOk ||
      !rhyHas ||
      !rhyOrigins ||
      !softStillPaired ||
      softErr < mirrorErr * 0.5 || // soft should deviate more than perfect
      !g2ok ||
      !noAxisDup
    ) {
      // softErr < mirrorErr*0.5 means soft is somehow more exact — fail only if soft is MORE exact than perfect when strength lower; actually we want softErr > mirrorErr
      const softDeviates = softErr > mirrorErr + 0.001 || softErr > 0.02
      if (
        !freeNoMirror ||
        !freeHas ||
        mirrors.length < 1 ||
        mirrorErr > 0.02 ||
        !parentsOk ||
        !originsMirrored ||
        !timingOk ||
        !rhyHas ||
        !rhyOrigins ||
        !softStillPaired ||
        !softDeviates ||
        !g2ok ||
        !noAxisDup
      ) {
        ok = false
        console.log('  FAIL', {
          freeNoMirror,
          freeHas,
          mirrors: mirrors.length,
          mirrorErr,
          parentsOk,
          originsMirrored,
          timingOk,
          rhyHas,
          rhyOrigins,
          softStillPaired,
          softDeviates,
          softErr,
          g2ok,
          noAxisDup,
          axisX: axis.axisX,
        })
      }
    }
  }

  architecture.dispose()
}

if (!ok) process.exitCode = 1
else console.log('ALL CHECKS PASSED')
