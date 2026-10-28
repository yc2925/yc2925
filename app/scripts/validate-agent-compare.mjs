/**
 * Step 11B.5 — Visual stigmergy / comparison validation.
 * Run: node scripts/validate-agent-compare.mjs
 */
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation } from '../src/agents/simulation.js'
import { createStigmergyField } from '../src/agents/stigmergyField.js'
import { buildCurveGraph } from '../src/ornament/curveGraph.js'
import { compareSnapshots } from '../src/agents/compareMetrics.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'
import { STATE } from '../src/agents/agentModel.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)
const note = (msg) => console.log('    ', msg)

console.log('=== Step 11B.5 stigmergy legibility / comparison ===')

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
      agentCount: 24,
      agentSeed: 42,
      bilateralSymmetry: true,
      energyBudget: 2.4,
      movementSpeed: 0.55,
      showFullTrailHistory: true,
      ...overrides,
    },
  })
}

// --- Heatmap segments match real field samples ---
{
  const field = createStigmergyField(graph)
  const c0 = graph.curves[0]
  field.depositLocal(c0.id, c0.length * 0.4, 0.9, 0.2, 0.2)
  field.depositLocal(c0.id, c0.length * 0.4, 0, 0.7, 0.15)
  const viz = field.buildVizSegments('attraction')
  if (!viz.positions.length || !viz.colors.length) fail('attraction viz empty')
  else pass(`attraction heatmap verts=${viz.positions.length / 3}`)

  const inhib = field.buildVizSegments('inhibition')
  const occ = field.buildVizSegments('occupancy')
  const comb = field.buildVizSegments('combined')
  if (!inhib.positions.length || !occ.positions.length || !comb.positions.length) {
    fail('field mode viz missing segments')
  } else pass('inhibition / occupancy / combined heatmaps non-empty')

  // Intensity at deposit site should exceed far site on same curve after deposit
  const mid = field.sampleAt(c0.id, c0.length * 0.4)
  const far = field.sampleAt(c0.id, Math.min(c0.length * 0.95, c0.length - 0.01))
  if (!(mid.attraction > far.attraction + 0.05)) {
    fail(`heatmap not driven by field (mid ${mid.attraction} far ${far.attraction})`)
  } else pass('heatmap intensity tracks real attraction samples')
}

// --- Identical start, then divergence with stigmergy ---
{
  const off = makeSim({ enableStigmergy: false, agentSeed: 42 })
  const on = makeSim({ enableStigmergy: true, agentSeed: 42 })

  const fp0Off = JSON.stringify(off.fingerprint().agents)
  const fp0On = JSON.stringify(on.fingerprint().agents)
  if (fp0Off !== fp0On) fail('initial agent fingerprints differ')
  else pass('identical seed → identical initial agents')

  // Early steps: may still match until deposits accumulate
  for (let i = 0; i < 40; i += 1) {
    off.stepOnce()
    on.stepOnce()
  }
  const earlySame =
    JSON.stringify(off.fingerprint().agents) === JSON.stringify(on.fingerprint().agents)

  for (let i = 0; i < 260; i += 1) {
    off.stepOnce()
    on.stepOnce()
  }

  const snapOff = off.getCompareSnapshot()
  const snapOn = on.getCompareSnapshot()
  const delta = compareSnapshots(snapOff, snapOn)

  note(
    `OFF coverage=${snapOff.uniqueCoverage} repeated=${snapOff.repeatedOccupancy} sep=${snapOff.meanSeparation.toFixed(3)} redirected=${snapOff.redirected} completed=${snapOff.completed} deposits=${snapOff.totalDeposits}`,
  )
  note(
    `ON  coverage=${snapOn.uniqueCoverage} repeated=${snapOn.repeatedOccupancy} sep=${snapOn.meanSeparation.toFixed(3)} redirected=${snapOn.redirected} completed=${snapOn.completed} deposits=${snapOn.totalDeposits}`,
  )
  note(
    `Δ coverage=${delta.uniqueCoverage} repeated=${delta.repeatedOccupancy} sep=${delta.meanSeparation.toFixed(3)} redirected=${delta.redirected}`,
  )

  if (snapOff.totalDeposits !== 0) fail('OFF deposited with stigmergy disabled')
  else pass('OFF deposits = 0')

  if (snapOn.totalDeposits < 10) fail(`ON deposits too low (${snapOn.totalDeposits})`)
  else pass(`ON deposits = ${snapOn.totalDeposits}`)

  const pathsDiffer =
    JSON.stringify(off.fingerprint().agents) !== JSON.stringify(on.fingerprint().agents)
  if (!pathsDiffer && snapOn.redirected === snapOff.redirected) {
    fail('ON/OFF paths identical after field interactions')
  } else pass(`paths diverge (earlySame=${earlySame}, redirected ${snapOff.redirected}→${snapOn.redirected})`)

  // Meaningful collective difference: redirects and/or coverage/separation shift
  const meaningful =
    Math.abs(delta.redirected) >= 5 ||
    Math.abs(delta.uniqueCoverage) >= 3 ||
    Math.abs(delta.meanSeparation) >= 0.05 ||
    Math.abs(delta.repeatedOccupancy) >= 3
  if (!meaningful) fail('measured ON/OFF difference too small to call significant')
  else pass('measurable behavioral difference (coverage / separation / redirects)')
}

// --- BUILDING lifecycle: not forever, not timer-only ---
{
  const sim = makeSim({ enableStigmergy: true, agentSeed: 7, agentCount: 20 })
  const hist = { exploring: 0, depositing: 0, building: 0, completed: 0, reexploreSeen: 0 }
  let sawBuilding = false
  let sawCompletedFromBuild = false
  const prevState = new Map()

  for (let i = 0; i < 400; i += 1) {
    sim.stepOnce()
    const s = sim.getStats()
    hist.exploring += s.exploring
    hist.depositing += s.depositing
    hist.building += s.building
    hist.completed += s.completed
    if (s.building > 0) sawBuilding = true
    for (const a of sim.state.agents) {
      const prev = prevState.get(a.id)
      if (prev === STATE.BUILDING && a.state === STATE.EXPLORING) hist.reexploreSeen += 1
      if (prev === STATE.BUILDING && a.state === STATE.COMPLETED) sawCompletedFromBuild = true
      prevState.set(a.id, a.state)
    }
  }

  const end = sim.getStats()
  note(
    `lifecycle end exploring=${end.exploring} depositing=${end.depositing} building=${end.building} completed=${end.completed} reexploreEvents=${hist.reexploreSeen}`,
  )
  if (!sawBuilding) fail('never entered BUILDING')
  else pass('agents enter BUILDING for real work')

  if (end.completed < 1 && !sawCompletedFromBuild) fail('no COMPLETED agents after long run')
  else pass(`COMPLETED reached (n=${end.completed})`)

  // Mid-run should still show exploring or depositing sometime (not instant BUILDING pile-up)
  if (hist.exploring < 50) fail('exploring phase too short in aggregate')
  else pass('EXPLORING remains a sustained phase (not elapsed-time skip)')
}

// --- Isolated comparison instances do not share field buffers ---
{
  const off = makeSim({ enableStigmergy: false, agentSeed: 11 })
  const on = makeSim({ enableStigmergy: true, agentSeed: 11 })
  for (let i = 0; i < 80; i += 1) {
    off.stepOnce()
    on.stepOnce()
  }
  if (off.field === on.field) fail('shared field object between sims')
  else pass('comparison sims use isolated field buffers')
  if (off.field.fingerprint() === on.field.fingerprint() && on.getStats().totalDeposits > 0) {
    // OFF field should stay empty; ON should not
    fail('ON field matched empty OFF field despite deposits')
  } else pass('ON field diverges from empty OFF field')
}

architecture.dispose?.()

console.log(ok ? '\nAll Step 11B.5 checks passed.' : '\nStep 11B.5 validation FAILED.')
process.exit(ok ? 0 : 1)
