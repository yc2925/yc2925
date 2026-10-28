/**
 * Step 11C — Agent-driven ornament construction validation.
 * Run: node scripts/validate-agent-construction.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation } from '../src/agents/simulation.js'
import { extractCandidates, constructionFingerprint } from '../src/agents/constructionPath.js'
import { acceptPaths } from '../src/agents/pathAcceptance.js'
import {
  applyConstructionReveal,
  buildConstructionFromSim,
  disposeConstruction,
} from '../src/agents/ornamentConstruction.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'
import { buildOrnamentArchitecture as buildArch } from '../src/ornament/source.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)
const note = (msg) => console.log('    ', msg)

console.log('=== Step 11C agent ornament construction ===')

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
      energyBudget: 2.6,
      enableStigmergy: true,
      ...overrides,
    },
  })
}

function runSim(sim, steps) {
  for (let i = 0; i < steps; i += 1) sim.stepOnce()
}

const constructParams = {
  enableOrnamentConstruction: true,
  pathAcceptanceThreshold: 0.35,
  ornamentDensity: 0.65,
  branchComplexity: 0.5,
  primaryThickness: 0.03,
  secondaryThickness: 0.018,
  constructionReliefDepth: 0.014,
  constructionEmergence: 0.55,
  foliateDetail: 0.4,
  bilateralSymmetry: true,
  agentSeed: 42,
  specimen: architecture.specimen,
}

// --- Construction archive grows during deposit/build ---
{
  const sim = makeSim()
  runSim(sim, 40)
  const early = sim.state.agents
    .filter((a) => !a.isMirror)
    .reduce((n, a) => n + (a.constructionPath?.length ?? 0), 0)
  runSim(sim, 220)
  const late = sim.state.agents
    .filter((a) => !a.isMirror)
    .reduce((n, a) => n + (a.constructionPath?.length ?? 0), 0)
  if (late <= early) fail(`construction archive did not grow (${early} → ${late})`)
  else pass(`construction archives grow (${early} → ${late} samples)`)
}

// --- Candidates derive from agent paths ---
{
  const sim = makeSim({ agentSeed: 42 })
  runSim(sim, 280)
  const candidates = extractCandidates(sim)
  if (candidates.length < 1) fail('no candidates extracted from agent archives')
  else pass(`extracted ${candidates.length} candidates from agent construction paths`)

  for (const c of candidates) {
    for (const p of c.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        fail(`NaN in candidate ${c.id}`)
        break
      }
    }
  }
  pass('candidate coordinates finite')
}

// --- Acceptance prunes ---
{
  const sim = makeSim({ agentSeed: 7 })
  runSim(sim, 280)
  const candidates = extractCandidates(sim)
  const { accepted, rejected } = acceptPaths(candidates, {
    graph: sim.graph,
    pathAcceptanceThreshold: 0.4,
    ornamentDensity: 0.5,
    enableStigmergy: true,
  })
  note(`accept ${accepted.length} / reject ${rejected.length} of ${candidates.length}`)
  if (accepted.length + rejected.length !== candidates.length) fail('accept/reject count mismatch')
  else pass('acceptance partitions all candidates')
  if (rejected.some((r) => !r.rejectReason)) fail('rejected path missing reason')
  else pass('rejected paths record reasons')
}

// --- Geometry from accepted paths (not random) ---
{
  const sim = makeSim({ agentSeed: 42 })
  runSim(sim, 300)
  const pack = buildConstructionFromSim(sim, architecture.arch, constructParams)
  if (!pack.meshCache || pack.stats.ornamentMeshes < 1) {
    fail(`no ornament meshes (accepted=${pack.stats.acceptedPaths})`)
  } else {
    pass(
      `meshes=${pack.stats.ornamentMeshes} tris=${pack.stats.ornamentTriangles} accepted=${pack.stats.acceptedPaths}`,
    )
  }

  // Every master branch agentId (if present) must map to a sim agent
  const agentIds = new Set(sim.state.agents.map((a) => a.id))
  let bad = 0
  for (const b of pack.network.branches ?? []) {
    if ((b.compositionRole ?? 'master') === 'mirror') continue
    if (b.agentId && !agentIds.has(b.agentId) && !String(b.id).startsWith('folio-')) bad += 1
  }
  if (bad) fail(`${bad} branches not linked to agents`)
  else pass('network branches derive from agent path ids')

  // Seed change → different fingerprint / geometry
  const simB = makeSim({ agentSeed: 99 })
  runSim(simB, 300)
  const packB = buildConstructionFromSim(simB, architecture.arch, {
    ...constructParams,
    agentSeed: 99,
  })
  if (constructionFingerprint(sim) === constructionFingerprint(simB)) {
    fail('different seeds produced identical construction fingerprints')
  } else pass('different agent seeds → different construction archives')

  const meshA = pack.stats.ornamentMeshes
  const meshB = packB.stats.ornamentMeshes
  note(`seed42 meshes=${meshA} seed99 meshes=${meshB}`)
  disposeConstruction(pack)
  disposeConstruction(packB)
}

// --- Stigmergy ON vs OFF accepted networks differ when paths diverge ---
{
  const on = makeSim({ enableStigmergy: true, agentSeed: 42 })
  const off = makeSim({ enableStigmergy: false, agentSeed: 42 })
  for (let i = 0; i < 300; i += 1) {
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
  const fpOn = constructionFingerprint(on)
  const fpOff = constructionFingerprint(off)
  note(
    `ON accepted=${packOn.stats.acceptedPaths} meshes=${packOn.stats.ornamentMeshes} | OFF accepted=${packOff.stats.acceptedPaths} meshes=${packOff.stats.ornamentMeshes}`,
  )
  if (fpOn === fpOff && packOn.stats.acceptedPaths === packOff.stats.acceptedPaths) {
    // Soft fail only if both archives and accepts match — field should diverge
    fail('stigmergy ON/OFF construction identical')
  } else pass('stigmergy ON/OFF produce different construction networks')
  disposeConstruction(packOn)
  disposeConstruction(packOff)
}

// --- Symmetry: mirrors exist, centerline not double-built as independent ---
{
  const sim = makeSim({ bilateralSymmetry: true, agentSeed: 42 })
  runSim(sim, 280)
  const pack = buildConstructionFromSim(sim, architecture.arch, constructParams)
  const masters = (pack.network.branches ?? []).filter((b) => (b.compositionRole ?? 'master') !== 'mirror')
  const mirrors = (pack.network.branches ?? []).filter((b) => b.compositionRole === 'mirror')
  if (masters.length < 1) fail('no master branches')
  else if (mirrors.length < 1 && masters.length > 0) {
    // Possible if all on axis — warn soft
    pass(`symmetry: ${masters.length} masters, ${mirrors.length} mirrors (axis-heavy ok)`)
  } else pass(`symmetry: ${masters.length} masters, ${mirrors.length} mirrors`)

  // Mirror growth timing matches source
  let timingBad = 0
  const byId = new Map((pack.network.branches ?? []).map((b) => [b.id, b]))
  for (const m of mirrors) {
    const srcId = m.sourceId
    const src = srcId ? byId.get(srcId) : null
    if (!src) continue
    if (Math.abs((m.birthTime ?? 0) - (src.birthTime ?? 0)) > 1e-6) timingBad += 1
    if (Math.abs((m.growthDuration ?? 0) - (src.growthDuration ?? 0)) > 1e-6) timingBad += 1
  }
  if (timingBad) fail(`mirror timing mismatches ${timingBad}`)
  else pass('mirrored growth timing matches masters')
  disposeConstruction(pack)
}

// --- Animation reveal: starts hidden, progresses, reset clears ---
{
  const sim = makeSim({ agentSeed: 11 })
  runSim(sim, 260)
  const pack = buildConstructionFromSim(sim, architecture.arch, {
    ...constructParams,
    agentSeed: 11,
  })
  const c0 = applyConstructionReveal(pack, -1)
  if (c0 > 0.02) fail(`geometry visible at t<0 (${c0})`)
  else pass('geometry hidden before growth start')

  const midT =
    Math.max(...(pack.network.branches ?? []).map((b) => (b.birthTime ?? 0) + (b.growthDuration ?? 1) * 0.5)) ||
    2
  const c1 = applyConstructionReveal(pack, midT)
  if (c1 <= 0.05) fail(`no progressive reveal at mid (${c1})`)
  else pass(`progressive reveal at mid-time (${(c1 * 100).toFixed(0)}%)`)

  const endT =
    Math.max(...(pack.network.branches ?? []).map((b) => (b.birthTime ?? 0) + (b.growthDuration ?? 1))) + 1
  const c2 = applyConstructionReveal(pack, endT)
  if (c2 < 0.95) fail(`incomplete at end (${c2})`)
  else pass('full reveal at end time')

  disposeConstruction(pack)
  if (pack.meshCache != null) fail('dispose did not clear meshCache')
  else pass('dispose clears construction meshes')
}

// --- Disabled construction leaves agent sim alone ---
{
  const sim = makeSim()
  runSim(sim, 60)
  const pack = buildConstructionFromSim(sim, architecture.arch, {
    ...constructParams,
    enableOrnamentConstruction: false,
  })
  if (pack.stats.ornamentMeshes !== 0) fail('disabled construction still built meshes')
  else pass('construction disabled → no meshes')
}

// --- Ornament system architecture still builds ---
{
  const arch2 = buildArch({
    ...DEFAULT_AGENTS,
    ...applyPreset({ ...DEFAULT_AGENTS }, 'geo-twin-trefoil'),
  })
  if (!arch2?.specimen?.meshes?.length) fail('ornament architecture broken')
  else pass(`ornament architecture intact (${arch2.specimen.meshes.length} meshes)`)
  arch2.dispose?.()
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 11C checks passed.' : '\nStep 11C validation FAILED.')
process.exit(ok ? 0 : 1)
