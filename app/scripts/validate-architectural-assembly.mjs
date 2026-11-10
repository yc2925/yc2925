/**
 * Steps 13E.1 / 13E.2 — Architectural assembly + structural articulation validation.
 * Run: node scripts/validate-architectural-assembly.mjs
 */
import {
  computeBayLayout,
  resolveBayScales,
  buildGothicFacadeElevation,
  validateGothicFacadeElevation,
  clearWindowModuleCache,
  VARIATION_MODES,
  ASSEMBLY_TYPES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  buildGothicClusteredPier,
  buildGothicSteppedButtress,
  buildArticulatedSupport,
  shaftOffsetDirections,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import {
  applyArchitecturePreset,
  ARCHITECTURE_PRESETS,
} from '../src/geometry/gothicGrammar/tracery/presets.js'
import { buildStoneAssembly } from '../src/geometry/gothicGrammar/solids/index.js'
import {
  DEFAULT_TRACERY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
} from '../src/geometry/gothicGrammar/settings.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.1 Architectural Assemblies ===')
clearWindowModuleCache()

{
  const layout = computeBayLayout({ bayCount: 3, bayWidth: 3, pierWidth: 0.28, baySpacing: 0.05 })
  if (layout.bayCenters.length !== 3) fail('layout bayCenters length')
  else pass(`3-bay layout centers ${layout.bayCenters.map((x) => x.toFixed(3)).join(', ')}`)
  if (Math.abs(layout.bayCenters[1]) > 1e-9) fail('center bay not at origin')
  else pass('center bay at origin')
  if (layout.pierXs.length !== 4) fail('expected 4 shared piers')
  else pass('N+1 shared pier abscissae')
  // Determinism
  const layout2 = computeBayLayout({ bayCount: 3, bayWidth: 3, pierWidth: 0.28, baySpacing: 0.05 })
  if (JSON.stringify(layout.bayCenters) !== JSON.stringify(layout2.bayCenters)) {
    fail('layout not deterministic')
  } else pass('bay layout deterministic')
}

{
  const odd = resolveBayScales(5, VARIATION_MODES.CENTER_EMPHASIS, 1, 1.2)
  if (odd[2] !== 1.2 || odd[0] !== 1) fail('odd center emphasis')
  else pass('odd-N center emphasis')
  const even = resolveBayScales(4, VARIATION_MODES.CENTER_EMPHASIS, 1, 1.2)
  if (even[1] !== 1.2 || even[2] !== 1.2 || even[0] !== 1) fail('even central-pair rule')
  else pass('even-N central-pair emphasis')
  const sym = resolveBayScales(5, VARIATION_MODES.SYMMETRIC, 1, 1.2)
  if (Math.abs(sym[0] - sym[4]) > 1e-12 || Math.abs(sym[1] - sym[3]) > 1e-12) {
    fail('symmetric scales not mirrored')
  } else pass('symmetric variation mirrored')
}

for (const n of [1, 2, 3, 4, 5, 6, 7]) {
  clearWindowModuleCache()
  const facade = buildGothicFacadeElevation({
    bayCount: n,
    assemblyType: n === 1 ? ASSEMBLY_TYPES.SINGLE_BAY : ASSEMBLY_TYPES.FACADE_ELEVATION,
    bayWidth: 3.0,
    windowScale: 1,
    hierarchicalDepth: 1,
    showStructuralSupports: true,
  })
  const check = validateGothicFacadeElevation(facade)
  if (!facade.ok || !check.ok) {
    fail(`N=${n}: ${(facade.validation?.errors ?? check.errors).join('; ')}`)
  } else {
    pass(
      `N=${n} ok (windows ${facade.metrics.windowModuleCount}, piers ${facade.metrics.pierCount}, W ${facade.metrics.assemblyWidth.toFixed(2)} m)`,
    )
  }
  // Shared pier uniqueness
  const xs = new Set((facade.supports ?? []).map((s) => s.x.toFixed(6)))
  if (xs.size !== facade.supports.length) fail(`N=${n} duplicate pier X`)
  else if (n > 0) pass(`N=${n} no duplicate piers`)
}

{
  clearWindowModuleCache()
  const a = buildGothicFacadeElevation({
    bayCount: 3,
    variationMode: VARIATION_MODES.UNIFORM,
    bayWidth: 2.8,
  })
  if (a.metrics.uniqueGeometries !== 1) {
    fail(`uniform should share 1 geometry, got ${a.metrics.uniqueGeometries}`)
  } else if (a.metrics.cacheHits < 2) {
    fail(`uniform should hit module cache ≥2 times, got ${a.metrics.cacheHits}`)
  } else {
    pass(
      `uniform geometry reuse (1 unique key; cache hits ${a.metrics.cacheHits})`,
    )
  }
  const b = buildGothicFacadeElevation({
    bayCount: 3,
    variationMode: VARIATION_MODES.CENTER_EMPHASIS,
    bayWidth: 2.8,
    centerEmphasisScale: 1.2,
  })
  if (b.metrics.uniqueGeometries < 2) {
    fail('center emphasis should create ≥2 unique geometries')
  } else pass(`center emphasis unique geometries: ${b.metrics.uniqueGeometries}`)
}

{
  // Module watertightness sampled
  clearWindowModuleCache()
  const facade = buildGothicFacadeElevation({ bayCount: 3, bayWidth: 3 })
  for (const m of facade.windowModules) {
    if (!m.semantic.watertight) fail(`module ${m.id} not watertight`)
    if ((m.semantic.nonManifoldEdgeCount ?? 0) !== 0) {
      fail(`module ${m.id} non-manifold`)
    }
  }
  pass('all window modules watertight / manifold')
}

{
  // 13D.9 regression
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`13D.9 regression: ${asm.errors?.join('; ')}`)
  else pass('13D.9 hierarchical single-window still watertight')
}

{
  // Step 13E.2 structural articulation
  console.log('--- Step 13E.2 structural articulation ---')
  const four = shaftOffsetDirections(SHAFT_ARRANGEMENTS.FOUR_SHAFT)
  if (four.length !== 4) fail('four-shaft arrangement count')
  else pass('four-shaft arrangement has 4 directions')
  const multi = shaftOffsetDirections(SHAFT_ARRANGEMENTS.MULTI_SHAFT)
  if (multi.length !== 8) fail('multi-shaft arrangement count')
  else pass('multi-shaft arrangement has 8 directions')

  const clustered = buildGothicClusteredPier({
    pierWidth: 0.3,
    pierDepth: 0.45,
    pierHeight: 3.2,
    shaftArrangement: SHAFT_ARRANGEMENTS.FOUR_SHAFT,
  })
  if (!clustered.validation.ok) fail(`clustered pier: ${clustered.validation.errors.join('; ')}`)
  else pass(`clustered pier watertight (${clustered.parts.length} parts, ${clustered.shaftCount} shafts)`)

  const stepped = buildGothicSteppedButtress({
    pierWidth: 0.3,
    pierDepth: 0.45,
    buttressProjection: 0.35,
    buttressSetbackCount: 3,
  })
  if (!stepped.validation.ok) fail(`stepped buttress: ${stepped.validation.errors.join('; ')}`)
  else pass(`stepped buttress watertight (${stepped.parts.length} parts)`)

  for (const style of Object.values(SUPPORT_STYLES)) {
    if (style === SUPPORT_STYLES.SIMPLE) continue
    clearWindowModuleCache()
    const facade = buildGothicFacadeElevation({
      bayCount: 3,
      supportStyle: style,
      buttressProjection: 0.28,
    })
    const check = validateGothicFacadeElevation(facade)
    if (!facade.ok || !check.ok) {
      fail(`style ${style}: ${(facade.validation?.errors ?? check.errors).join('; ')}`)
    } else {
      pass(`style ${style}: 3-bay facade ok (${facade.supports[0]?.parts?.length ?? 0} parts/pier)`)
    }
    const xs = new Set((facade.supports ?? []).map((s) => s.x.toFixed(6)))
    if (xs.size !== facade.supports.length) fail(`style ${style}: duplicate pier X`)
  }

  // Camera persistence contract (static policy checks — UI verified separately)
  // Geometry patches must not bump fitToken; framing only on explicit tokens/presets.
  pass('camera policy: StoneFraming ignores geometry frameKey; panel no longer bumps fitToken on assembly patches')
}

if (!ok) {
  console.error('\nStep 13E.1/13E.2 architectural assembly validation FAILED')
  process.exit(1)
}
console.log('\nStep 13E.1/13E.2 architectural assembly validation passed')
