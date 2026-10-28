/**
 * Step 11A — Agent FSM + simulation validation.
 * Run: node scripts/validate-agent-fsm.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation, FIXED_DT } from '../src/agents/simulation.js'
import { transition } from '../src/agents/fsm.js'
import { STATE, ROLE } from '../src/agents/agentModel.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 11A agent FSM validation ===')

// --- Unit: FSM transitions are condition-driven ---
{
  const base = {
    state: STATE.DORMANT,
    role: ROLE.EXPLORER,
    exploreSteps: 0,
    depositSteps: 0,
    blockedTicks: 0,
  }
  if (transition(base, { activated: false }) !== STATE.DORMANT) fail('dormant stays without activation')
  else pass('DORMANT holds until activated')

  if (transition(base, { activated: true }) !== STATE.EXPLORING) fail('dormant→exploring')
  else pass('DORMANT → EXPLORING on activation')

  const exploringEarly = { ...base, state: STATE.EXPLORING, exploreSteps: 5 }
  if (
    transition(exploringEarly, {
      activated: true,
      hasValidDirection: true,
      noValidPath: false,
      trailAccepted: false,
      budgetExhausted: false,
    }) !== STATE.EXPLORING
  ) {
    fail('exploring should hold before scout quota')
  } else pass('EXPLORING holds until scout steps met')

  const exploring = { ...base, state: STATE.EXPLORING, exploreSteps: 20 }
  if (
    transition(exploring, {
      activated: true,
      hasValidDirection: true,
      noValidPath: false,
      trailAccepted: false,
      budgetExhausted: false,
    }) !== STATE.DEPOSITING
  ) {
    fail('exploring→depositing')
  } else pass('EXPLORING → DEPOSITING after valid direction + steps')

  if (
    transition(exploring, {
      activated: true,
      hasValidDirection: false,
      noValidPath: true,
      budgetExhausted: false,
    }) !== STATE.BLOCKED
  ) {
    fail('exploring→blocked')
  } else pass('EXPLORING → BLOCKED when no path')

  const buildingWork = { ...base, state: STATE.BUILDING, buildSteps: 10 }
  if (
    transition(buildingWork, {
      activated: true,
      budgetExhausted: false,
      noValidPath: false,
      buildComplete: false,
      reexplore: true,
    }) !== STATE.EXPLORING
  ) {
    fail('building→exploring on reexplore')
  } else pass('BUILDING → EXPLORING when local field demands re-scout')

  if (
    transition(buildingWork, {
      activated: true,
      budgetExhausted: false,
      noValidPath: false,
      buildComplete: true,
      reexplore: false,
    }) !== STATE.COMPLETED
  ) {
    fail('building→completed on quota')
  } else pass('BUILDING → COMPLETED after build quota (not timer)')

  const blocked = { ...base, state: STATE.BLOCKED, blockedTicks: 2 }
  if (
    transition(blocked, {
      activated: true,
      redirectSucceeded: true,
      stillBlocked: false,
      budgetExhausted: false,
    }) !== STATE.EXPLORING
  ) {
    fail('blocked→exploring')
  } else pass('BLOCKED → EXPLORING after redirect')

  const depositing = { ...base, state: STATE.DEPOSITING }
  if (
    transition(depositing, {
      activated: true,
      trailAccepted: true,
      budgetExhausted: false,
      noValidPath: false,
    }) !== STATE.BUILDING
  ) {
    fail('depositing→building')
  } else pass('DEPOSITING → BUILDING when trail accepted')

  const building = { ...base, state: STATE.BUILDING }
  if (
    transition(building, {
      activated: true,
      budgetExhausted: true,
      noValidPath: false,
    }) !== STATE.COMPLETED
  ) {
    fail('building→completed')
  } else pass('BUILDING → COMPLETED when budget exhausted')
}

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
      agentCount: 16,
      agentSeed: 42,
      bilateralSymmetry: true,
      energyBudget: 1.4,
      movementSpeed: 0.7,
      ...overrides,
    },
  })
}

// --- Spawn ---
{
  const sim = makeSim()
  const n = sim.state.agents.length
  if (n < 10) fail(`expected ≥10 agents, got ${n}`)
  else pass(`spawned ${n} agents`)
  const mirrors = sim.state.agents.filter((a) => a.isMirror)
  if (mirrors.length < 1) fail('no mirror agents with bilateral on')
  else pass(`bilateral pairs: ${mirrors.length} mirrors`)
}

// --- Agents move over time ---
{
  const sim = makeSim()
  const before = sim.fingerprint().agents
  sim.start()
  for (let i = 0; i < 90; i += 1) sim.advance(FIXED_DT)
  const after = sim.fingerprint().agents
  let moved = 0
  for (let i = 0; i < before.length; i += 1) {
    const d = Math.hypot(after[i].x - before[i].x, after[i].y - before[i].y, after[i].z - before[i].z)
    if (d > 0.01) moved += 1
  }
  if (moved < 10) fail(`only ${moved} agents moved`)
  else pass(`${moved} agents visibly displaced after ~3s`)

  const stats = sim.getStats()
  const midActive = stats.exploring + stats.depositing + stats.building + stats.blocked
  if (midActive < 1 && stats.completed < 1) fail('no state progression')
  else pass(`state mix exploring=${stats.exploring} depositing=${stats.depositing} building=${stats.building} blocked=${stats.blocked} completed=${stats.completed}`)
}

// --- Pause freezes ---
{
  const sim = makeSim()
  sim.start()
  for (let i = 0; i < 30; i += 1) sim.advance(FIXED_DT)
  sim.pause()
  const t0 = sim.state.time
  const fp0 = JSON.stringify(sim.fingerprint())
  sim.advance(0.5)
  if (Math.abs(sim.state.time - t0) > 1e-9) fail('pause advanced time')
  else if (JSON.stringify(sim.fingerprint()) !== fp0) fail('pause moved agents')
  else pass('pause freezes movement and clock')
}

// --- Step one frame ---
{
  const sim = makeSim()
  const t0 = sim.state.time
  const steps0 = sim.state.stepCount
  sim.stepOnce()
  if (Math.abs(sim.state.time - (t0 + FIXED_DT)) > 1e-9) fail(`stepOnce time ${sim.state.time}`)
  else if (sim.state.stepCount !== steps0 + 1) fail('stepCount')
  else pass(`stepOnce advances exactly one fixed dt (${FIXED_DT.toFixed(4)}s)`)
}

// --- Reset restores ---
{
  const sim = makeSim()
  const fp0 = JSON.stringify(sim.fingerprint())
  sim.start()
  for (let i = 0; i < 60; i += 1) sim.advance(FIXED_DT)
  sim.reset()
  const fp1 = JSON.stringify(sim.fingerprint())
  if (sim.state.time !== 0 || sim.state.stepCount !== 0) fail('reset clock')
  else if (fp0 !== fp1) fail('reset agents differ from initial')
  else pass('reset restores initial agent state')
}

// --- Identical seeds → identical outcomes ---
{
  const a = makeSim({ agentSeed: 77 })
  const b = makeSim({ agentSeed: 77 })
  a.start()
  b.start()
  for (let i = 0; i < 120; i += 1) {
    a.advance(FIXED_DT)
    b.advance(FIXED_DT)
  }
  const fa = JSON.stringify(a.fingerprint())
  const fb = JSON.stringify(b.fingerprint())
  if (fa !== fb) fail('same seed diverged')
  else pass('identical seeds produce identical outcomes')

  const c = makeSim({ agentSeed: 78 })
  c.start()
  for (let i = 0; i < 120; i += 1) c.advance(FIXED_DT)
  if (JSON.stringify(c.fingerprint()) === fa) fail('different seed matched (suspicious)')
  else pass('different seed diverges')
}

// --- Symmetry geometric check ---
{
  const sim = makeSim({ bilateralSymmetry: true, agentCount: 16 })
  sim.start()
  for (let i = 0; i < 90; i += 1) sim.advance(FIXED_DT)
  const byId = new Map(sim.state.agents.map((a) => [a.id, a]))
  let bad = 0
  let checked = 0
  for (const a of sim.state.agents) {
    if (!a.isMirror || !a.mirrorOf) continue
    const m = byId.get(a.mirrorOf)
    if (!m) continue
    checked += 1
    const expectX = -m.position.x
    if (Math.abs(a.position.x - expectX) > 0.08) bad += 1
    if (Math.abs(a.position.y - m.position.y) > 0.08) bad += 1
    if (a.state !== m.state) bad += 1
  }
  if (checked < 1) fail('no mirror pairs to check')
  else if (bad > 0) fail(`symmetry mismatches ${bad}/${checked}`)
  else pass(`bilateral symmetry geometrically ok (${checked} pairs)`)
}

// --- State counts change ---
{
  const sim = makeSim({ energyBudget: 0.9 })
  const s0 = { ...sim.getStats() }
  sim.start()
  for (let i = 0; i < 200; i += 1) sim.advance(FIXED_DT)
  const s1 = sim.getStats()
  const changed =
    s0.exploring !== s1.exploring ||
    s0.depositing !== s1.depositing ||
    s0.building !== s1.building ||
    s0.blocked !== s1.blocked ||
    s0.completed !== s1.completed ||
    s0.dormant !== s1.dormant
  if (!changed) fail('state counts never changed')
  else pass('agent state counts change during simulation')
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 11A checks passed.' : '\nStep 11A validation FAILED.')
process.exit(ok ? 0 : 1)
