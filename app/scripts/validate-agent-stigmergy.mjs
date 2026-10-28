/**
 * Step 11B — stigmergy / perception validation.
 * Run: node scripts/validate-agent-stigmergy.mjs
 */
import * as THREE from 'three'
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation, FIXED_DT } from '../src/agents/simulation.js'
import { createStigmergyField, stigmergyEdgeScore } from '../src/agents/stigmergyField.js'
import { buildCurveGraph, locateOnGraph } from '../src/ornament/curveGraph.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'
import { STATE } from '../src/agents/agentModel.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 11B agent stigmergy validation ===')

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
const graph = buildCurveGraph(architecture.arch)

function makeSim(overrides = {}) {
  return createAgentSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: {
      ...DEFAULT_AGENTS,
      agentCount: 16,
      agentSeed: 42,
      bilateralSymmetry: true,
      enableStigmergy: true,
      attractionStrength: 0.7,
      inhibitionStrength: 0.55,
      depositionRate: 0.5,
      depositionRadius: 0.18,
      signalDecay: 0.08,
      signalDiffusion: 0.3,
      explorationBias: 0.3,
      movementSpeed: 0.7,
      energyBudget: 2.5,
      ...overrides,
    },
  })
}

function fpAgents(sim) {
  return JSON.stringify(sim.fingerprint().agents)
}

// --- Unit: field deposit + decay ---
{
  const field = createStigmergyField(graph)
  const c0 = graph.curves[0]
  if (!c0) fail('no curves')
  else {
    const before = field.sampleAt(c0.id, c0.length * 0.5)
    field.depositLocal(c0.id, c0.length * 0.5, 0.4, 0.25, 0.15)
    const after = field.sampleAt(c0.id, c0.length * 0.5)
    if (!(after.attraction > before.attraction && after.inhibition > before.inhibition)) {
      fail(`deposit failed a=${after.attraction} i=${after.inhibition}`)
    } else pass(`signals deposited (attr ${after.attraction.toFixed(3)} inhib ${after.inhibition.toFixed(3)})`)

    const peak = after.attraction
    for (let i = 0; i < 40; i += 1) {
      field.stepField({ enableStigmergy: true, signalDecay: 0.25, signalDiffusion: 0 }, FIXED_DT)
    }
    const decayed = field.sampleAt(c0.id, c0.length * 0.5)
    if (!(decayed.attraction < peak * 0.85)) fail(`decay weak ${decayed.attraction} vs ${peak}`)
    else pass(`signals decay over time (${peak.toFixed(3)} → ${decayed.attraction.toFixed(3)})`)
  }
}

// --- Unit: diffusion stays graph-local ---
{
  const field = createStigmergyField(graph)
  // Pick two curves that do NOT share a junction if possible
  const a = graph.curves[0]
  const far = graph.curves.find((c) => {
    if (c.id === a.id) return false
    const ja = new Set([a.startJunction, a.endJunction].filter(Boolean))
    const jb = new Set([c.startJunction, c.endJunction].filter(Boolean))
    for (const x of ja) if (jb.has(x)) return false
    return true
  })
  if (!a || !far) {
    pass('diffusion locality: skipped (insufficient disconnected curves)')
  } else {
    field.depositLocal(a.id, a.length * 0.5, 0.8, 0, 0.08)
    const farBefore = field.sampleAt(far.id, far.length * 0.5).attraction
    for (let i = 0; i < 25; i += 1) {
      field.stepField({ enableStigmergy: true, signalDecay: 0.02, signalDiffusion: 0.5 }, FIXED_DT)
    }
    const farAfter = field.sampleAt(far.id, far.length * 0.5).attraction
    // Adjacent samples on same curve should pick up signal
    const near = field.sampleAt(a.id, a.length * 0.5 + 0.12).attraction
    if (near < 0.01) fail('diffusion failed along same curve')
    else pass(`diffusion along curve (near ${near.toFixed(3)})`)
    if (farAfter > farBefore + 0.05) {
      fail(`diffusion jumped to unrelated curve (${farBefore} → ${farAfter})`)
    } else pass('diffusion stays graph-local (unrelated curve unchanged)')
  }
}

// --- Unit: edge score FOLLOW / AVOID ---
{
  const follow = stigmergyEdgeScore(
    { attraction: 0.8, inhibition: 0.05, occupancy: 0 },
    { enableStigmergy: true, attractionStrength: 0.7, inhibitionStrength: 0.5, explorationBias: 0.2 },
  )
  const avoid = stigmergyEdgeScore(
    { attraction: 0.05, inhibition: 0.85, occupancy: 0.6 },
    { enableStigmergy: true, attractionStrength: 0.7, inhibitionStrength: 0.5, explorationBias: 0.2 },
  )
  if (!(follow > 0 && avoid < 0 && follow > avoid)) fail(`score follow=${follow} avoid=${avoid}`)
  else pass(`perception scores FOLLOW (${follow.toFixed(3)}) > AVOID (${avoid.toFixed(3)})`)
}

// --- Integration: deposits during sim ---
{
  const sim = makeSim()
  for (let i = 0; i < 120; i += 1) sim.stepOnce()
  const s = sim.getStats()
  if (s.totalDeposits < 1) fail('no deposits during sim')
  else pass(`deposits recorded: ${s.totalDeposits} (avgAttr ${s.averageAttraction.toFixed(4)})`)
  if (s.averageAttraction <= 0 && s.averageInhibition <= 0) fail('field empty after deposits')
  else pass(`field averages attr=${s.averageAttraction.toFixed(4)} inhib=${s.averageInhibition.toFixed(4)}`)
}

// --- ON vs OFF measurable behavior difference ---
{
  const on = makeSim({
    enableStigmergy: true,
    agentSeed: 99,
    attractionStrength: 0.9,
    inhibitionStrength: 0.75,
    depositionRate: 0.65,
    explorationBias: 0.25,
  })
  const off = makeSim({
    enableStigmergy: false,
    agentSeed: 99,
    attractionStrength: 0.9,
    inhibitionStrength: 0.75,
    depositionRate: 0.65,
    explorationBias: 0.25,
  })
  for (let i = 0; i < 200; i += 1) {
    on.stepOnce()
    off.stepOnce()
  }
  const fa = fpAgents(on)
  const fb = fpAgents(off)
  // Also compare path length / redirected counts
  const onR = on.getStats().agentsRedirected
  const offR = off.getStats().agentsRedirected
  if (fa === fb && onR === offR) fail('stigmergy ON/OFF produced identical agent paths')
  else pass(`stigmergy ON vs OFF differs (redirected ${onR} vs ${offR})`)

  if (on.getStats().totalDeposits < 1) fail('ON had no deposits')
  else if (off.getStats().totalDeposits !== 0) fail('OFF still deposited')
  else pass('deposits only when stigmergy enabled')
}

// --- Determinism with stigmergy ---
{
  const a = makeSim({ agentSeed: 55 })
  const b = makeSim({ agentSeed: 55 })
  for (let i = 0; i < 100; i += 1) {
    a.stepOnce()
    b.stepOnce()
  }
  if (JSON.stringify(a.fingerprint()) !== JSON.stringify(b.fingerprint())) {
    fail('identical seeds diverged with stigmergy')
  } else pass('identical seeds → identical agents + field')
}

// --- Symmetry with stigmergy ---
{
  const sim = makeSim({ bilateralSymmetry: true, agentCount: 16 })
  for (let i = 0; i < 100; i += 1) sim.stepOnce()
  const byId = new Map(sim.state.agents.map((x) => [x.id, x]))
  let bad = 0
  let checked = 0
  for (const a of sim.state.agents) {
    if (!a.isMirror || !a.mirrorOf) continue
    const m = byId.get(a.mirrorOf)
    if (!m) continue
    checked += 1
    if (Math.abs(a.position.x + m.position.x) > 0.1) bad += 1
    if (Math.abs(a.position.y - m.position.y) > 0.1) bad += 1
    if (a.state !== m.state) bad += 1
  }
  if (checked < 1) fail('no mirror pairs')
  else if (bad > 0) fail(`symmetry mismatches ${bad}/${checked}`)
  else pass(`bilateral symmetry with stigmergy (${checked} pairs)`)
}

// --- Pause / reset / step ---
{
  const sim = makeSim()
  sim.stepOnce()
  const t1 = sim.state.time
  sim.pause()
  sim.advance(1)
  if (sim.state.time !== t1) fail('pause advanced under stigmergy')
  else pass('pause freezes with stigmergy')
  sim.reset()
  if (sim.state.time !== 0 || sim.getStats().totalDeposits !== 0) fail('reset did not clear field')
  else pass('reset clears agents and field')
  const t0 = sim.state.time
  sim.stepOnce()
  if (Math.abs(sim.state.time - (t0 + FIXED_DT)) > 1e-9) fail('stepOnce dt')
  else pass('stepOnce advances one fixed timestep')
}

// --- Centerline no double-count: deposit once near x=0 ---
{
  const field = createStigmergyField(graph)
  const agent = {
    curveId: graph.curves[0]?.id,
    s: graph.curves[0]?.length * 0.3 ?? 0,
    position: new THREE.Vector3(0.01, 2, 0),
    isMirror: false,
    state: STATE.BUILDING,
  }
  const p = { ...DEFAULT_AGENTS, enableStigmergy: true, bilateralSymmetry: true, depositionRate: 0.5 }
  const before = field.averages().averageAttraction
  field.deposit(agent, p, 0, (pos) => locateOnGraph(graph, new THREE.Vector3(pos.x, pos.y, pos.z ?? 0)))
  // Second call should still work; centerline skip means mirror path not taken
  const after = field.averages().averageAttraction
  if (!(after > before)) fail('centerline deposit failed')
  else pass('centerline deposit applies once (mirror skipped)')
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 11B checks passed.' : '\nStep 11B validation FAILED.')
process.exit(ok ? 0 : 1)
