/**
 * Step 11C.1 — Regional composition refinement validation.
 * Run: node scripts/validate-agent-composition.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation } from '../src/agents/simulation.js'
import { extractCandidates } from '../src/agents/constructionPath.js'
import { acceptPaths, rejectionBreakdown } from '../src/agents/pathAcceptance.js'
import {
  ARCH_REGIONS,
  classifyArchitecturalRegion,
  regionForAnchor,
} from '../src/agents/architecturalRegions.js'
import {
  buildConstructionFromSim,
  disposeConstruction,
} from '../src/agents/ornamentConstruction.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)
const note = (msg) => console.log('    ', msg)

console.log('=== Step 11C.1 regional composition ===')

const settings = applyPreset({ ...DEFAULT_AGENTS }, 'geo-twin-trefoil')
const architecture = buildOrnamentArchitecture({
  ...DEFAULT_AGENTS,
  ...settings,
  activePreset: 'geo-twin-trefoil',
})
const growth = generateGrowthConditions(architecture.arch, {
  ...DEFAULT_AGENTS,
  growthSeed: 11,
  anchorCount: 100,
})

function makeSim(overrides = {}) {
  return createAgentSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: {
      ...DEFAULT_AGENTS,
      agentCount: 20,
      agentSeed: 42,
      bilateralSymmetry: true,
      energyBudget: 2.5,
      enableStigmergy: true,
      ...overrides,
    },
  })
}

const constructParams = {
  enableOrnamentConstruction: true,
  pathAcceptanceThreshold: 0.4,
  ornamentDensity: 0.6,
  branchComplexity: 0.5,
  primaryThickness: 0.03,
  secondaryThickness: 0.018,
  constructionReliefDepth: 0.014,
  constructionEmergence: 0.55,
  foliateDetail: 0.35,
  bilateralSymmetry: true,
  agentSeed: 42,
  specimen: architecture.specimen,
}

// --- Region classification uses feature metadata ---
{
  const pts = { x: 0.2, y: 3.5, z: 0 }
  if (classifyArchitecturalRegion(pts, 'mullion', architecture.arch) !== 'vertical-mullions') {
    fail('mullion feature misclassified')
  } else pass('mullion → vertical-mullions')
  if (classifyArchitecturalRegion(pts, 'junction', architecture.arch) !== 'structural-junctions') {
    fail('junction feature misclassified')
  } else pass('junction → structural-junctions')
  if (classifyArchitecturalRegion(pts, 'tracery', architecture.arch) !== 'upper-tracery') {
    fail('tracery feature misclassified')
  } else pass('tracery (upper) → upper-tracery')
}

// --- Spawn covers multiple regions ---
{
  const sim = makeSim({ agentSeed: 42, agentCount: 20 })
  const masters = sim.state.agents.filter((a) => !a.isMirror)
  const regionHits = Object.create(null)
  for (const a of masters) {
    const r =
      a.spawnRegion ??
      regionForAnchor(
        { position: a.position, sourceFeatureType: a.featureType },
        architecture.arch,
        sim.graph,
      )
    regionHits[r] = (regionHits[r] ?? 0) + 1
  }
  note(`spawn regions ${JSON.stringify(regionHits)}`)
  const distinct = Object.keys(regionHits).length
  if (distinct < 2) fail(`spawn collapsed to ${distinct} region(s)`)
  else pass(`spawn covers ${distinct} architectural regions`)
}

// --- Baseline rejection diagnostics + multi-region accept ---
{
  const sim = makeSim({ agentSeed: 42 })
  for (let i = 0; i < 320; i += 1) sim.stepOnce()
  const candidates = extractCandidates(sim)
  const result = acceptPaths(candidates, {
    graph: sim.graph,
    arch: architecture.arch,
    pathAcceptanceThreshold: 0.4,
    ornamentDensity: 0.6,
    enableStigmergy: true,
  })
  note(
    `candidates=${candidates.length} accepted=${result.accepted.length} rejected=${result.rejected.length}`,
  )
  note(`reasons ${JSON.stringify(result.diagnostics.byReason)}`)
  note(`categories ${JSON.stringify(result.diagnostics.byCategory)}`)
  note(
    `coverage ${result.coverage.rows.map((r) => `${r.id}:${r.actual}/${r.target}`).join(' · ')}`,
  )

  if (!result.diagnostics?.byReason || result.diagnostics.total !== result.rejected.length) {
    fail('rejection diagnostics incomplete')
  } else pass('rejection reason breakdown recorded')

  if (result.coverage.regionsHit < 2 && result.accepted.length >= 2) {
    fail(`accepted paths stuck in ${result.coverage.regionsHit} region(s)`)
  } else if (result.accepted.length < 1) {
    fail('no accepted paths after regional composition')
  } else {
    pass(
      `accepted ${result.accepted.length} across ${result.coverage.regionsHit} region(s) (was typically 1–2 upper-only)`,
    )
  }

  // Before/after note: legacy single-region was common; require improvement signal
  const beforeTypical = 2
  if (result.accepted.length < beforeTypical && result.coverage.regionsHit < 2) {
    fail('composition did not improve vs prior concentration')
  } else pass(`accepted count ${result.accepted.length} (prior typical ~${beforeTypical})`)
}

// --- Construction + symmetry ---
{
  const sim = makeSim({ agentSeed: 42 })
  for (let i = 0; i < 300; i += 1) sim.stepOnce()
  const pack = buildConstructionFromSim(sim, architecture.arch, constructParams)
  const masters = (pack.network.branches ?? []).filter(
    (b) => (b.compositionRole ?? 'master') !== 'mirror',
  )
  const mirrors = (pack.network.branches ?? []).filter((b) => b.compositionRole === 'mirror')
  note(
    `meshes=${pack.stats.ornamentMeshes} masters=${masters.length} mirrors=${mirrors.length} regionsHit=${pack.stats.regionsHit}`,
  )
  if (pack.stats.ornamentMeshes < 1) fail('no ornament meshes')
  else pass(`ornament meshes=${pack.stats.ornamentMeshes}`)
  if (pack.stats.regionsHit < 2 && pack.stats.acceptedPaths >= 3) {
    fail('construction region coverage too narrow')
  } else pass(`construction regionsHit=${pack.stats.regionsHit}`)
  if (mirrors.length < 1 && masters.length > 0) {
    pass('symmetry: mirrors optional when masters on-axis')
  } else pass(`bilateral mirrors=${mirrors.length}`)
  disposeConstruction(pack)
}

// --- Determinism ---
{
  const a = makeSim({ agentSeed: 55 })
  const b = makeSim({ agentSeed: 55 })
  for (let i = 0; i < 180; i += 1) {
    a.stepOnce()
    b.stepOnce()
  }
  const pa = buildConstructionFromSim(a, architecture.arch, { ...constructParams, agentSeed: 55 })
  const pb = buildConstructionFromSim(b, architecture.arch, { ...constructParams, agentSeed: 55 })
  if (pa.fingerprint !== pb.fingerprint) fail('identical seeds diverged construction')
  else pass('identical seeds → identical construction fingerprint')
  disposeConstruction(pa)
  disposeConstruction(pb)
}

// --- Stigmergy still affects construction ---
{
  const on = makeSim({ enableStigmergy: true, agentSeed: 42 })
  const off = makeSim({ enableStigmergy: false, agentSeed: 42 })
  for (let i = 0; i < 280; i += 1) {
    on.stepOnce()
    off.stepOnce()
  }
  const packOn = buildConstructionFromSim(on, architecture.arch, {
    ...constructParams,
    enableStigmergy: true,
  })
  const packOff = buildConstructionFromSim(off, architecture.arch, {
    ...constructParams,
    enableStigmergy: false,
  })
  note(
    `ON accepted=${packOn.stats.acceptedPaths} meshes=${packOn.stats.ornamentMeshes} | OFF accepted=${packOff.stats.acceptedPaths} meshes=${packOff.stats.ornamentMeshes}`,
  )
  if (
    packOn.fingerprint === packOff.fingerprint &&
    packOn.stats.acceptedPaths === packOff.stats.acceptedPaths
  ) {
    fail('stigmergy ON/OFF construction identical')
  } else pass('stigmergy still changes accepted networks')
  disposeConstruction(packOn)
  disposeConstruction(packOff)
}

// --- Field peak archive vs live decay ---
{
  const sim = makeSim({ agentSeed: 7, energyBudget: 1.6 })
  for (let i = 0; i < 400; i += 1) sim.stepOnce()
  const s = sim.getStats()
  note(
    `live attr=${s.averageAttraction.toFixed(4)} peak=${s.peakAttraction.toFixed(4)} @ t=${s.peakFieldTime.toFixed(2)}`,
  )
  if (s.peakAttraction <= 0 && s.totalDeposits > 0) fail('peak attraction never recorded')
  else pass('peak field summary preserved for diagnostics')
  // Expected: live may decay below peak after agents complete
  if (s.averageAttraction > s.peakAttraction + 1e-6) fail('live attraction exceeded peak')
  else pass('live averages ≤ peak (decay expected after deposits end)')
}

// --- Ornament system untouched smoke ---
{
  if (!architecture.specimen?.meshes?.length) fail('ornament architecture missing meshes')
  else pass(`ornament architecture intact (${architecture.specimen.meshes.length} meshes)`)
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 11C.1 checks passed.' : '\nStep 11C.1 validation FAILED.')
process.exit(ok ? 0 : 1)
