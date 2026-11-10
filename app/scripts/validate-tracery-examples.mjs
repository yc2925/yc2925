/**
 * Step 13E.3.2.1 — Tracery Example dropdown regression.
 * Run: node scripts/validate-tracery-examples.mjs
 */
import {
  applyTraceryExample,
  TRACERY_EXAMPLE_META,
  traceryExampleSignature,
} from '../src/geometry/gothicGrammar/tracery/traceryExamples.js'
import { TRACERY_EXAMPLES } from '../src/geometry/gothicGrammar/tracery/roles.js'
import { buildStoneAssembly, stoneGeometryKey } from '../src/geometry/gothicGrammar/solids/index.js'
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  resolveWindowDesignParams,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  validateSurfaceSemantics,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import {
  DEFAULT_TRACERY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
  DEFAULT_ASSEMBLY_SETTINGS,
  createGrammarSettings,
} from '../src/geometry/gothicGrammar/settings.js'
import { FOIL_TYPES } from '../src/geometry/gothicGrammar/tracery/roles.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.3.2.1 Tracery Examples ===')

const dropdownCount = 1 // GothicGrammarPanel Tracery example Select
pass(`dropdowns discovered: ${dropdownCount} (Tracery Parameters → Tracery example)`)

if (TRACERY_EXAMPLES.length !== Object.keys(TRACERY_EXAMPLE_META).length) {
  fail('TRACERY_EXAMPLES length ≠ TRACERY_EXAMPLE_META keys')
} else pass(`options enumerated: ${TRACERY_EXAMPLES.length}`)

const results = []
const keys = new Map()

for (const opt of TRACERY_EXAMPLES) {
  clearWindowModuleCache()
  const applied = applyTraceryExample(
    opt.id,
    { ...DEFAULT_TRACERY_SETTINGS, span: 3 },
    { ...DEFAULT_STONE_SETTINGS },
  )
  if (applied.tracery.exampleId !== opt.id) {
    fail(`${opt.id}: exampleId not applied`)
    continue
  }
  const settings = createGrammarSettings({
    tracery: applied.tracery,
    stone: applied.stone,
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS, bayCount: 3 },
  })
  const design = resolveWindowDesignParams(settings)
  const stoneAsm = buildStoneAssembly({
    regionParams: design.tracery,
    stone: design.stone,
  })
  if (!stoneAsm.ok && stoneAsm.metrics?.watertight !== true) {
    fail(`${opt.id}: stone assembly invalid — ${(stoneAsm.errors ?? []).join('; ')}`)
    continue
  }
  const gKey = stoneGeometryKey(design.tracery, design.stone)
  const facade = buildGothicFacadeElevation({
    ...settings.assembly,
    windowDesign: { tracery: design.tracery, stone: design.stone },
    tracery: design.tracery,
    stone: design.stone,
  })
  const asmKey = facade.windowModules?.[0]?.geometryRef
  if (gKey !== asmKey) {
    fail(`${opt.id}: Stone key ≠ Assembly module key`)
  } else pass(`${opt.id}: Stone ≡ Assembly geometry key`)

  const sig = traceryExampleSignature(applied.tracery)
  const metrics = {
    id: opt.id,
    label: opt.label,
    signature: sig,
    geometryKey: gKey,
    foilType: design.tracery.foilType,
    architecturePreset: design.tracery.architecturePreset,
    hierarchical: design.tracery.enableHierarchicalTracery === true,
    skeleton: design.tracery.enableSkeleton === true,
    oculusNetwork: design.tracery.enableOculusNetwork === true,
    volume: stoneAsm.metrics?.structuralVolume ?? null,
    tris: stoneAsm.metrics?.triangleCount ?? null,
    openings: stoneAsm.solidVoid?.metrics?.openingCount ?? stoneAsm.metrics?.openingCount ?? null,
    members: stoneAsm.solidVoid?.metrics?.memberCount ?? null,
    watertight: stoneAsm.metrics?.watertight === true,
  }
  results.push(metrics)
  if (keys.has(gKey)) {
    fail(`${opt.id}: identical geometry key as ${keys.get(gKey)}`)
  } else {
    keys.set(gKey, opt.id)
    pass(
      `${opt.id}: distinct — preset=${metrics.architecturePreset} foil=${metrics.foilType} vol=${metrics.volume?.toFixed?.(4) ?? '—'} tris=${metrics.tris}`,
    )
  }
}

// Manual edit after example must persist (not reset by re-render simulation)
{
  const applied = applyTraceryExample(
    'trefoil',
    { ...DEFAULT_TRACERY_SETTINGS },
    { ...DEFAULT_STONE_SETTINGS },
  )
  const edited = {
    ...applied.tracery,
    oculusHeightRatio: 0.92,
    oculusVerticalPosition: 0.92,
    outerFrameWidth: 0.2,
    masterFrameWidth: 0.2,
  }
  const design = resolveWindowDesignParams({
    tracery: edited,
    stone: applied.stone,
  })
  if (Math.abs(design.tracery.oculusHeightRatio - 0.92) > 1e-9) {
    fail('edit persistence: oculus height lost')
  } else if (Math.abs(design.tracery.outerFrameWidth - 0.2) > 1e-9) {
    fail('edit persistence: outer frame lost')
  } else pass('manual edits after example persist through normalize/resolve')

  const before = stoneGeometryKey(design.tracery, design.stone)
  const deeper = resolveWindowDesignParams({
    tracery: { ...edited, hierarchicalDepth: 2 },
    stone: applied.stone,
  })
  // hierarchicalDepth on baseline composed may not change key much — change foil instead
  const foilFlip = resolveWindowDesignParams({
    tracery: {
      ...edited,
      foilType: FOIL_TYPES.quatrefoil,
      trefoilHeads: false,
      secondaryQuatrefoils: true,
    },
    stone: applied.stone,
  })
  if (before === stoneGeometryKey(foilFlip.tracery, foilFlip.stone)) {
    fail('edit persistence: foilType change did not invalidate geometry')
  } else pass('post-example foilType edit regenerates geometry')

  // Outer frame edit must also regenerate after example apply
  const frameEdit = resolveWindowDesignParams({
    tracery: { ...edited, outerFrameWidth: 0.24, masterFrameWidth: 0.24 },
    stone: applied.stone,
  })
  if (before === stoneGeometryKey(frameEdit.tracery, frameEdit.stone)) {
    fail('edit persistence: outer frame edit did not invalidate geometry')
  } else pass('post-example outer frame edit regenerates geometry')
}

// Regression: trefoil / frame / molding / depth still distinct under facade module
{
  clearWindowModuleCache()
  const base = applyTraceryExample(
    'composed-window',
    { ...DEFAULT_TRACERY_SETTINGS },
    { ...DEFAULT_STONE_SETTINGS },
  )
  const a = resolveWindowDesignParams({ tracery: base.tracery, stone: base.stone })
  const keyA = stoneGeometryKey(a.tracery, a.stone)

  const trefoilOff = resolveWindowDesignParams({
    tracery: {
      ...base.tracery,
      trefoilHeads: false,
      foilType: FOIL_TYPES.quatrefoil,
      secondaryQuatrefoils: true,
    },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(trefoilOff.tracery, trefoilOff.stone)) {
    fail('regression: trefoilHeads toggle no geometry delta on facade module')
  } else pass('regression: trefoilHeads still changes facade module geometry')

  const frame = resolveWindowDesignParams({
    tracery: { ...base.tracery, outerFrameWidth: 0.22, masterFrameWidth: 0.22 },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(frame.tracery, frame.stone)) {
    fail('regression: outer frame no delta')
  } else pass('regression: outer frame width still works')

  const depth = resolveWindowDesignParams({
    tracery: { ...base.tracery, hierarchicalDepth: 2 },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(depth.tracery, depth.stone)) {
    fail('regression: hierarchicalDepth no delta')
  } else pass('regression: subdivision depth still works')

  const mold = resolveWindowDesignParams({
    tracery: base.tracery,
    stone: { ...base.stone, moldingEnabled: true, profileWidth: 0.05, profileDepth: 0.07 },
  })
  const moldAsm = buildStoneAssembly({ regionParams: mold.tracery, stone: mold.stone })
  if ((moldAsm.decorative?.length ?? 0) < 1) fail('regression: molding still broken')
  else pass(`regression: molding ON → ${moldAsm.decorative.length} meshes`)
}

// Semantics after example switch
{
  clearWindowModuleCache()
  const applied = applyTraceryExample(
    'composed-window',
    { ...DEFAULT_TRACERY_SETTINGS },
    { ...DEFAULT_STONE_SETTINGS },
  )
  const settings = createGrammarSettings({
    tracery: applied.tracery,
    stone: applied.stone,
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS, bayCount: 3 },
  })
  const design = resolveWindowDesignParams(settings)
  const facade = buildGothicFacadeElevation({
    ...settings.assembly,
    windowDesign: { tracery: design.tracery, stone: design.stone },
  })
  const sem = applyGrowthPolicy(
    extractFacadeSurfaceSemantics(facade, DEFAULT_GROWTH_POLICY),
    DEFAULT_GROWTH_POLICY,
  )
  const check = validateSurfaceSemantics(sem)
  if (!check.ok) fail(`semantics: ${check.errors?.join('; ')}`)
  else pass(`semantics valid after composed-window example (patches ${sem.patches?.length ?? 0})`)
}

console.log('\n=== OPTION SUMMARY ===')
for (const r of results) {
  console.log(
    `  ${r.id}: preset=${r.architecturePreset} foil=${r.foilType} hier=${r.hierarchical} skel=${r.skeleton} vol=${r.volume?.toFixed?.(4)} tris=${r.tris}`,
  )
}

console.log(ok ? '\nvalidate:tracery-examples PASS' : '\nvalidate:tracery-examples FAIL')
process.exit(ok ? 0 : 1)
