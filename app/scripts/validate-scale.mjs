/**
 * Step 12A — Architectural scale & proportional geometry validation.
 * Run: node scripts/validate-scale.mjs
 */
import { buildWindow } from '../src/gothic/typologies/window.js'
import { buildOrnamentArchitecture } from '../src/ornament/source.js'
import { generateGrowthConditions } from '../src/ornament/conditions.js'
import { createAgentSimulation } from '../src/agents/simulation.js'
import {
  meters,
  centimeters,
  millimeters,
  WORLD_UNIT_METERS,
  toMillimeters,
} from '../src/scale/units.js'
import {
  resolveOrnamentPhysical,
  resolveAgentPhysical,
  resolveArchitecturalEnvelope,
} from '../src/scale/proportions.js'
import { ARCHITECTURAL_SCALE_PRESETS, PROPORTION_RATIOS } from '../src/scale/config.js'
import { DEFAULT_AGENTS } from '../src/agents/settings.js'
import { applyPreset } from '../src/gothic/typologies/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)
const note = (msg) => console.log('    ', msg)

console.log('=== Step 12A architectural scale ===')

// --- Unit conversion ---
{
  if (WORLD_UNIT_METERS !== 1) fail('world unit must be 1 meter')
  else pass('1 world unit = 1 meter')
  if (meters(1) !== 1 || centimeters(10) !== 0.1 || millimeters(25) !== 0.025) {
    fail('unit helpers incorrect')
  } else pass('meters / centimeters / millimeters helpers')
}

// --- Architectural envelope at 0.5× / 1× / 2× ---
const scales = [0.5, 1, 2]
const extents = {}
for (const s of scales) {
  const win = buildWindow({
    traceryFamily: 'geometric',
    windowAspect: 1.9,
    lancetCount: 2,
    overallWidth: 3.0,
    overallHeight: 5.7,
    architecturalScale: s,
    variationSeed: 3,
    profileThickness: 0.055,
    architecturalDepth: 0.14,
  })
  const W = win.meta.design2d.layout.W
  const H = win.meta.design2d.layout.H
  extents[s] = { W, H, profile: 0.055 * s }
  note(`scale ${s}× → ${W.toFixed(3)} × ${H.toFixed(3)} m`)
  win.dispose()
}

{
  const e1 = extents[1]
  if (Math.abs(e1.W - 3) > 1e-6) fail(`1× width expected 3, got ${e1.W}`)
  else pass(`1× window width = ${e1.W} m (reference)`)
  if (Math.abs(e1.H - 3 * 1.9) > 1e-6) fail(`1× height expected ${3 * 1.9}, got ${e1.H}`)
  else pass(`1× window height = ${e1.H.toFixed(2)} m (aspect-driven)`)

  if (Math.abs(extents[0.5].W - e1.W * 0.5) > 1e-6 || Math.abs(extents[2].W - e1.W * 2) > 1e-6) {
    fail('architectural scale did not multiply width linearly')
  } else pass('0.5× / 2× width scales linearly')

  if (Math.abs(extents[0.5].H - e1.H * 0.5) > 1e-6 || Math.abs(extents[2].H - e1.H * 2) > 1e-6) {
    fail('architectural scale did not multiply height linearly')
  } else pass('0.5× / 2× height scales linearly')
}

// --- Scale independent of procedural complexity ---
{
  const a = buildWindow({
    architecturalScale: 1,
    windowAspect: 1.9,
    variationSeed: 3,
    overallWidth: 3,
  })
  const b = buildWindow({
    architecturalScale: 2,
    windowAspect: 1.9,
    variationSeed: 3,
    overallWidth: 3,
  })
  const ca = a.meta.design2d.curves.length
  const cb = b.meta.design2d.curves.length
  if (ca !== cb) fail(`curve count changed with scale (${ca} vs ${cb})`)
  else pass(`procedural complexity unchanged with scale (curves=${ca})`)
  a.dispose()
  b.dispose()
}

// --- Ornament proportions ---
{
  const phys1 = resolveOrnamentPhysical(
    { ornamentThickness: 0.032, reliefDepth: 0.016, architecturalScale: 1 },
    { profileThickness: 0.055, architecturalDepth: 0.14, height: 5.7 },
  )
  const phys2 = resolveOrnamentPhysical(
    { ornamentThickness: 0.032, reliefDepth: 0.016, architecturalScale: 2 },
    { profileThickness: 0.055, architecturalDepth: 0.14, height: 5.7 },
  )
  note(
    `ornament 1× primary=${toMillimeters(phys1.primaryThickness).toFixed(0)} mm · 2×=${toMillimeters(phys2.primaryThickness).toFixed(0)} mm`,
  )
  if (phys1.primaryThickness > 0.055 * PROPORTION_RATIOS.primaryToMullion + 1e-6) {
    fail('primary exceeds mullion proportion')
  } else pass('primary thickness ≤ mullion × ratio')
  if (Math.abs(phys2.primaryThickness - phys1.primaryThickness * 2) > 1e-6) {
    fail('ornament thickness did not scale with architecturalScale')
  } else pass('ornament thickness scales with architecturalScale')
  if (phys1.reliefDepth > 0.14 * PROPORTION_RATIOS.reliefToArchDepth + 1e-6) {
    fail('relief exceeds architectural depth proportion')
  } else pass('relief depth ≤ arch depth × ratio')
}

// --- Agent physical + stigmergy spacing ---
{
  const env = resolveArchitecturalEnvelope(
    { overallWidth: 3, overallHeight: 5.7, architecturalScale: 2, windowAspect: 1.9 },
    'window',
  )
  if (Math.abs(env.width - 6) > 1e-6) fail(`envelope width ${env.width}`)
  else pass(`envelope at 2× = ${env.width} × ${env.height.toFixed(2)} m`)

  const agent = resolveAgentPhysical(
    { sensingRadius: 0.28, movementSpeed: 0.55, sampleSpacing: 0.09, architecturalScale: 2 },
    { width: 3 },
  )
  note(
    `agent 2× sensing=${agent.sensingRadius.toFixed(3)} m speed=${agent.movementSpeed.toFixed(3)} m/s sample=${agent.sampleSpacing.toFixed(3)} m`,
  )
  if (agent.sampleSpacing <= 0 || !Number.isFinite(agent.sampleSpacing)) fail('bad sample spacing')
  else pass('stigmergy sample spacing scales in meters')
  if (agent.sensingRadius > 3 * PROPORTION_RATIOS.sensingToArchWidth + 1e-6) {
    fail('sensing radius exceeded width proportion')
  } else pass('sensing radius capped vs arch width')
}

// --- Live sim: coherent at 0.5 / 1 / 2, no NaN, symmetry ---
for (const s of scales) {
  const settings = applyPreset({ ...DEFAULT_AGENTS }, 'geo-twin-trefoil')
  const architecture = buildOrnamentArchitecture({
    ...DEFAULT_AGENTS,
    ...settings,
    architecturalScale: s,
    overallWidth: 3,
    overallHeight: 5.7,
    activePreset: 'geo-twin-trefoil',
  })
  const growth = generateGrowthConditions(architecture.arch, {
    ...DEFAULT_AGENTS,
    growthSeed: 11,
    anchorCount: 80,
    architecturalScale: s,
  })
  const sim = createAgentSimulation({
    arch: architecture.arch,
    anchors: growth.anchors,
    params: {
      ...DEFAULT_AGENTS,
      agentCount: 12,
      agentSeed: 42,
      bilateralSymmetry: true,
      architecturalScale: s,
      enableStigmergy: true,
      energyBudget: 1.8,
    },
  })
  for (let i = 0; i < 120; i += 1) sim.stepOnce()
  const stats = sim.getStats()
  const agents = sim.state.agents
  let nan = false
  for (const a of agents) {
    if (!Number.isFinite(a.position.x) || !Number.isFinite(a.position.y)) nan = true
  }
  if (nan) fail(`NaN agent positions at scale ${s}`)
  else pass(`agents coherent at ${s}× (t=${stats.time.toFixed(1)}s)`)

  const masters = agents.filter((a) => !a.isMirror)
  const mirrors = agents.filter((a) => a.isMirror)
  if (mirrors.length && masters.length) {
    const m0 = masters[0]
    const mir = agents.find((a) => a.mirrorOf === m0.id)
    if (mir && Math.abs(mir.position.x + m0.position.x) > 0.05 * s) {
      fail(`symmetry broken at scale ${s}`)
    } else pass(`bilateral symmetry holds at ${s}×`)
  }

  // Field sample spacing follows scale
  const spacing = sim.state.params.sampleSpacing
  if (Math.abs(spacing - 0.09 * s) > 1e-6) fail(`sampleSpacing ${spacing} at scale ${s}`)
  else pass(`field sampleSpacing=${spacing.toFixed(3)} m at ${s}×`)

  architecture.dispose?.()
}

// --- Presets still build ---
{
  const preset = buildOrnamentArchitecture({
    ...DEFAULT_AGENTS,
    activePreset: 'geo-twin-trefoil',
    architecturalScale: 1,
  })
  if (!preset.specimen?.meshes?.length) fail('preset window missing meshes')
  else pass(`preset intact (${preset.specimen.meshes.length} meshes)`)
  preset.dispose?.()
}

// --- Future typology presets documented ---
{
  if (!ARCHITECTURAL_SCALE_PRESETS.portal || !ARCHITECTURAL_SCALE_PRESETS.facade) {
    fail('portal/facade scale presets missing')
  } else {
    pass(
      `scale presets: window ${ARCHITECTURAL_SCALE_PRESETS.window.width}×${ARCHITECTURAL_SCALE_PRESETS.window.height} · portal · façade`,
    )
  }
}

console.log(ok ? '\nAll Step 12A checks passed.' : '\nStep 12A validation FAILED.')
process.exit(ok ? 0 : 1)
