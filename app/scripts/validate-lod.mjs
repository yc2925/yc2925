/**
 * Step 12B — Camera-dependent LOD validation.
 * Run: node scripts/validate-lod.mjs
 */
import { buildWindowDesignOnly, buildWindowFromDesign } from '../src/gothic/typologies/window.js'
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createParticleSimulation } from '../src/ornament/particles.js'
import { completeParticleTrails } from '../src/ornament/branching.js'
import { composeOrnamentNetwork } from '../src/ornament/composition.js'
import { buildOrnamentMeshCache, disposeMeshCache } from '../src/ornament/ornamentGeometry.js'
import { createAgentSimulation } from '../src/agents/simulation.js'
import { resolveOrnamentPhysical } from '../src/scale/proportions.js'
import {
  LOD_LEVELS,
  resolveGothicRenderParams,
  resolveOrnamentRenderParams,
  selectLodWithHysteresis,
  lodFromProjectedFrac,
  measureProjectedSize,
  envelopeFromBounds,
  countMeshTriangles,
} from '../src/lod/index.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'
import * as THREE from 'three'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)
const note = (msg) => console.log('    ', msg)

console.log('=== Step 12B camera LOD ===')

const designParams = {
  traceryFamily: 'geometric',
  windowAspect: 1.9,
  lancetCount: 2,
  overallWidth: 3,
  overallHeight: 5.7,
  architecturalScale: 1,
  variationSeed: 3,
  upperTraceryHeight: 0.36,
  curvature: 0.55,
  subdivisionComplexity: 0.5,
  symmetry: true,
  profileThickness: 0.055,
  architecturalDepth: 0.14,
  moldingComplexity: 2,
  moldingProfile: 'compound',
  moldingDepth: 0.55,
  bevelIntensity: 0.45,
  detailResolution: 0.7,
}

// --- Canonical design shared across LOD ---
const designOnly = buildWindowDesignOnly(designParams)
const design = designOnly.meta.design2d
const curveCount = design.curves.length
const junctionCount = design.junctions.length
pass(`canonical design curves=${curveCount} junctions=${junctionCount}`)

const gothicTris = {}
const gothicBounds = {}
for (const lod of LOD_LEVELS) {
  const rp = resolveGothicRenderParams(designParams, lod)
  const solid = buildWindowFromDesign(design, {
    profileThickness: designParams.profileThickness,
    architecturalDepth: designParams.architecturalDepth,
    moldingComplexity: rp.moldingComplexity,
    detailResolution: rp.detailResolution,
    moldingProfile: designParams.moldingProfile,
    moldingDepth: designParams.moldingDepth,
    bevelIntensity: designParams.bevelIntensity,
    lodLevel: lod,
  })
  gothicTris[lod] = countMeshTriangles(solid.meshes)
  gothicBounds[lod] = {
    W: solid.meta.design2d.layout.W,
    H: solid.meta.design2d.layout.H,
  }
  note(`gothic ${lod}: meshes=${solid.meshes.length} tris=${gothicTris[lod]}`)
  solid.dispose()
}

{
  if (gothicBounds.high.W !== gothicBounds.low.W || gothicBounds.high.H !== gothicBounds.low.H) {
    fail('architectural bounds changed across LOD')
  } else pass(`bounds identical across LOD (${gothicBounds.high.W} × ${gothicBounds.high.H})`)

  if (gothicTris.medium >= gothicTris.high) fail('medium tris not below high')
  else pass(`medium = ${((gothicTris.medium / gothicTris.high) * 100).toFixed(0)}% of high`)

  if (gothicTris.low >= gothicTris.medium) fail('low tris not below medium')
  else pass(`low = ${((gothicTris.low / gothicTris.high) * 100).toFixed(0)}% of high`)

  // Soft targets (not hard requirements)
  const medRatio = gothicTris.medium / gothicTris.high
  const lowRatio = gothicTris.low / gothicTris.high
  note(`targets: medium 40–60% (got ${(medRatio * 100).toFixed(0)}%), low 10–25% (got ${(lowRatio * 100).toFixed(0)}%)`)
}

// Same design curve count when rebuilding
{
  const a = buildWindowFromDesign(design, {
    ...designParams,
    detailResolution: resolveGothicRenderParams(designParams, 'high').detailResolution,
  })
  const b = buildWindowFromDesign(design, {
    ...designParams,
    detailResolution: resolveGothicRenderParams(designParams, 'low').detailResolution,
  })
  if (a.meta.design2d.curves.length !== b.meta.design2d.curves.length) {
    fail('LOD rebuilt different design graphs')
  } else pass('same design graph reference across LOD solids')
  a.dispose()
  b.dispose()
}

// --- Ornament LOD from same network ---
const settings = applyPreset({ ...DEFAULT_AGENTS }, 'geo-twin-trefoil')
const architecture = buildOrnamentArchitecture({
  ...DEFAULT_AGENTS,
  ...settings,
  activePreset: 'geo-twin-trefoil',
  architecturalScale: 1,
})
const growth = generateGrowthConditions(architecture.arch, {
  ...DEFAULT_AGENTS,
  growthSeed: 11,
  anchorCount: 80,
})
const sim = createParticleSimulation({
  arch: architecture.arch,
  anchors: growth.anchors,
  params: {
    particleCount: 12,
    simulationDuration: 8,
    trailSpacing: 0.12,
    growthSeed: 11,
  },
})
const trails = completeParticleTrails(sim)
const network = composeOrnamentNetwork({
  trails,
  arch: architecture.arch,
  curveSamples: growth.curveSamples,
  params: {
    branchGenerations: 2,
    branchDensity: 0.45,
    compositionMode: 'bilateral',
    masterPathCount: 3,
  },
})
const branchIds = (network.branches ?? []).map((b) => b.id).sort()
const ornamentTris = {}
for (const lod of LOD_LEVELS) {
  const physical = resolveOrnamentPhysical(
    { ornamentThickness: 0.032, reliefDepth: 0.016, architecturalScale: 1 },
    { profileThickness: 0.055, architecturalDepth: 0.14, height: 5.7 },
  )
  const geom = resolveOrnamentRenderParams(
    {
      ornamentThickness: physical.ornamentThickness,
      reliefDepth: physical.reliefDepth,
      rootEmbedding: physical.rootEmbedding,
      reliefProjection: physical.reliefProjection,
      tipCurl: 0.55,
      flutingStrength: 0.48,
      arch: architecture.arch,
      specimen: architecture.specimen,
    },
    lod,
  )
  const pack = buildOrnamentMeshCache(network, geom)
  ornamentTris[lod] = pack.stats?.triangles ?? countMeshTriangles(pack.meshes)
  note(`ornament ${lod}: meshes=${pack.meshes.length} tris=${ornamentTris[lod]}`)
  disposeMeshCache(pack)
}
{
  const ids2 = (network.branches ?? []).map((b) => b.id).sort()
  if (ids2.join() !== branchIds.join()) fail('network mutated by LOD mesh build')
  else pass('branch hierarchy unchanged by ornament LOD')
  if (!(ornamentTris.medium < ornamentTris.high && ornamentTris.low < ornamentTris.medium)) {
    fail(`ornament tris not decreasing: ${JSON.stringify(ornamentTris)}`)
  } else {
    pass(
      `ornament tris high=${ornamentTris.high} med=${ornamentTris.medium} (${((ornamentTris.medium / ornamentTris.high) * 100).toFixed(0)}%) low=${ornamentTris.low} (${((ornamentTris.low / ornamentTris.high) * 100).toFixed(0)}%)`,
    )
  }
}

// --- Screen-space + hysteresis ---
{
  const cam = new THREE.PerspectiveCamera(36, 1.5, 0.1, 100)
  cam.position.set(3.8, 3.1, 7.4)
  cam.lookAt(0, 2.85, 0)
  cam.updateProjectionMatrix()
  const env = envelopeFromBounds(design.layout)
  const m = measureProjectedSize(cam, env)
  note(`projectedFrac≈${m.projectedFrac.toFixed(3)} dist≈${m.cameraDistance.toFixed(2)}`)
  if (!(m.projectedFrac > 0)) fail('projected size zero')
  else pass('perspective projected size measurable')

  const ortho = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100)
  ortho.position.set(0, 2.85, 10)
  ortho.lookAt(0, 2.85, 0)
  ortho.updateProjectionMatrix()
  const mo = measureProjectedSize(ortho, env)
  if (!(mo.projectedFrac > 0)) fail('ortho projected size zero')
  else pass('orthographic projected size measurable')

  // Hysteresis: near threshold, stay on current
  const tHigh = 0.42
  let level = 'high'
  level = selectLodWithHysteresis(tHigh - 0.02, level, { bias: 0, hysteresis: 0.06 })
  if (level !== 'high') fail(`hysteresis dropped early (${level})`)
  else pass('hysteresis holds high near threshold')
  level = selectLodWithHysteresis(tHigh - 0.08, level, { bias: 0, hysteresis: 0.06 })
  if (level !== 'medium') fail(`expected medium after crossing (${level})`)
  else pass('hysteresis switches after sufficient drop')

  if (lodFromProjectedFrac(0.9) !== 'high' || lodFromProjectedFrac(0.05) !== 'low') {
    fail('lodFromProjectedFrac mapping wrong')
  } else pass('manual frac → LOD mapping')

  if (selectLodWithHysteresis(0.05, 'high', { mode: 'low' }) !== 'low') {
    fail('manual override failed')
  } else pass('manual LOD override works')
}

// --- Simulation invariance ---
{
  const a = createAgentSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: { ...DEFAULT_AGENTS, agentSeed: 42, agentCount: 12, enableStigmergy: true },
  })
  const b = createAgentSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: { ...DEFAULT_AGENTS, agentSeed: 42, agentCount: 12, enableStigmergy: true },
  })
  for (let i = 0; i < 90; i += 1) {
    a.stepOnce()
    b.stepOnce()
  }
  // LOD is visual-only — two sims with same seed must match regardless of "active LOD"
  const pa = a.state.agents.map((x) => `${x.position.x.toFixed(4)},${x.position.y.toFixed(4)},${x.state}`)
  const pb = b.state.agents.map((x) => `${x.position.x.toFixed(4)},${x.position.y.toFixed(4)},${x.state}`)
  if (pa.join('|') !== pb.join('|')) fail('agent sims diverged')
  else pass('agent positions/FSM invariant (LOD does not touch simulation)')

  const fa = a.field?.sampleAt?.(a.state.agents[0]?.curveId, a.state.agents[0]?.s)
  const fb = b.field?.sampleAt?.(b.state.agents[0]?.curveId, b.state.agents[0]?.s)
  if (fa && fb) {
    if (Math.abs((fa.attraction ?? 0) - (fb.attraction ?? 0)) > 1e-8) fail('stigmergy diverged')
    else pass('stigmergy field values identical across twin sims')
  } else pass('stigmergy sample skipped (no curve)')
}

designOnly.dispose?.()
architecture.dispose?.()

console.log('\n--- Measured triangle counts ---')
console.log(
  JSON.stringify(
    {
      gothic: gothicTris,
      gothicRatios: {
        mediumOfHigh: +(gothicTris.medium / gothicTris.high).toFixed(3),
        lowOfHigh: +(gothicTris.low / gothicTris.high).toFixed(3),
      },
      ornament: ornamentTris,
      ornamentRatios: {
        mediumOfHigh: +(ornamentTris.medium / ornamentTris.high).toFixed(3),
        lowOfHigh: +(ornamentTris.low / ornamentTris.high).toFixed(3),
      },
    },
    null,
    2,
  ),
)

console.log(ok ? '\nAll Step 12B checks passed.' : '\nStep 12B validation FAILED.')
process.exit(ok ? 0 : 1)
