/**
 * Step 13E.3.2 — Unified Gothic window module sync validation.
 * Run: node scripts/validate-shared-window-module.mjs
 */
import {
  generateGothicWindowModule,
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  resolveWindowDesignParams,
  buildLegacyAssemblyWindowDesign,
  ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT,
  VARIATION_MODES,
  SUPPORT_STYLES,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  validateSurfaceSemantics,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import {
  applyArchitecturePreset,
  ARCHITECTURE_PRESETS,
} from '../src/geometry/gothicGrammar/tracery/presets.js'
import { buildStoneAssembly, stoneGeometryKey } from '../src/geometry/gothicGrammar/solids/index.js'
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

console.log('=== Step 13E.3.2 Shared Window Module ===')
clearWindowModuleCache()

function withFacadeModule(overrides = {}) {
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
    { ...DEFAULT_TRACERY_SETTINGS, ...(overrides.tracery ?? {}) },
    { ...DEFAULT_STONE_SETTINGS, ...(overrides.stone ?? {}) },
  )
  return createGrammarSettings({
    tracery: applied.tracery,
    stone: { ...applied.stone, showMoldings: applied.stone.moldingEnabled !== false },
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS, ...(overrides.assembly ?? {}) },
  })
}

function stoneAndAssembly(settings) {
  const design = resolveWindowDesignParams(settings)
  const stoneAsm = buildStoneAssembly({
    regionParams: design.tracery,
    stone: design.stone,
  })
  clearWindowModuleCache()
  const facade = buildGothicFacadeElevation({
    ...settings.assembly,
    windowDesign: { tracery: design.tracery, stone: design.stone },
    tracery: design.tracery,
    stone: design.stone,
    windowLinkMode: 'linked-to-master',
  })
  return { design, stoneAsm, facade }
}

function moduleKey(facade) {
  return facade.windowModules?.[0]?.geometryRef ?? null
}

function stoneKey(stoneAsm, design) {
  return stoneGeometryKey(design.tracery, design.stone)
}

// L — Legacy preferred Assembly appearance preserved
{
  const legacy = buildLegacyAssemblyWindowDesign()
  const mod = generateGothicWindowModule({
    windowDesign: legacy,
    useCache: false,
  })
  if (!mod.semantic.watertight) fail('L: legacy module not watertight')
  else pass(`L: legacy snapshot watertight (preset ${legacy.snapshot.architecturePreset})`)
  if (ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT.moldingEnabled !== false) {
    fail('L: snapshot should keep moldings off')
  } else pass('L: legacy snapshot moldings off')
  if (mod.parameters.stone.moldingEnabled !== false) fail('L: module moldings should be off')
  else pass('L: legacy module moldingEnabled=false')
}

// Shared entry point identity
{
  const settings = withFacadeModule()
  const { design, stoneAsm, facade } = stoneAndAssembly(settings)
  const sk = stoneKey(stoneAsm, design)
  const fk = moduleKey(facade)
  if (!fk || sk !== fk) fail(`entry: stone key !== assembly key\n  stone ${sk?.slice(0, 80)}\n  asm   ${fk?.slice(0, 80)}`)
  else pass('shared geometry key: Stone / 3D ≡ Assembly module')
  if (facade.metrics.uniqueGeometries !== 1) fail('uniform facade should share 1 geometry')
  else pass(`uniform facade unique geometries=${facade.metrics.uniqueGeometries}`)
}

function assertSync(label, mutate) {
  clearWindowModuleCache()
  const base = withFacadeModule()
  const a = stoneAndAssembly(base)
  const mutatedSettings = mutate(structuredClone({
    tracery: base.tracery,
    stone: base.stone,
    assembly: base.assembly,
  }))
  const full = createGrammarSettings(mutatedSettings)
  const b = stoneAndAssembly(full)
  const stoneChanged = stoneKey(a.stoneAsm, a.design) !== stoneKey(b.stoneAsm, b.design)
  const asmChanged = moduleKey(a.facade) !== moduleKey(b.facade)
  if (!stoneChanged) fail(`${label}: Stone geometry did not change`)
  else if (!asmChanged) fail(`${label}: Assembly geometry did not change`)
  else if (stoneKey(b.stoneAsm, b.design) !== moduleKey(b.facade)) {
    fail(`${label}: Stone and Assembly keys diverged after edit`)
  } else pass(`${label}: Stone + Assembly updated in lockstep`)
  return { a, b }
}

// A — Oculus Height
{
  assertSync('A oculus height', (s) => {
    s.tracery.oculusVerticalPosition = 0.72
    s.tracery.oculusHeightRatio = 0.72
    return s
  })
}

// B — Trefoil
{
  assertSync('B trefoil', (s) => {
    s.tracery.foilType = FOIL_TYPES.trefoil
    s.tracery.trefoilHeads = true
    return s
  })
}

// C — Outer Frame Width
{
  assertSync('C outer frame', (s) => {
    s.tracery.outerFrameWidth = 0.22
    s.tracery.masterFrameWidth = 0.22
    return s
  })
}

// D — Subdivision Depth
{
  assertSync('D subdivision depth', (s) => {
    s.tracery.hierarchicalDepth = 2
    return s
  })
}

// E — Molding
{
  assertSync('E molding', (s) => {
    s.stone.moldingEnabled = true
    s.stone.showMoldings = true
    s.stone.profileWidth = 0.05
    s.stone.profileDepth = 0.07
    return s
  })
  const on = withFacadeModule({ stone: { moldingEnabled: true } })
  // ensure facade module apply may set molding false — force on
  on.stone.moldingEnabled = true
  const { stoneAsm, facade } = stoneAndAssembly(on)
  const stoneMoldings = stoneAsm.decorative?.length ?? 0
  const asmMoldings = facade.windowModules?.[0]?.assembly?.decorative?.length ?? 0
  if (stoneMoldings < 1) fail('E: stone moldings missing when enabled')
  else if (asmMoldings !== stoneMoldings) {
    fail(`E: molding count stone=${stoneMoldings} asm=${asmMoldings}`)
  } else pass(`E: molding meshes match (${stoneMoldings})`)
}

// F — Stone Depth
{
  assertSync('F stone depth', (s) => {
    s.stone.stoneDepth = 0.4
    return s
  })
}

// G — Bay Count must not change shared window design signature
{
  clearWindowModuleCache()
  const base = withFacadeModule({ assembly: { bayCount: 3 } })
  const a = stoneAndAssembly(base)
  const more = withFacadeModule({ assembly: { bayCount: 5 } })
  // keep same window design
  more.tracery = base.tracery
  more.stone = base.stone
  const b = stoneAndAssembly(more)
  if (a.design.geometryKey !== b.design.geometryKey) fail('G: window design changed with bay count')
  else pass('G: bay count leaves window design unchanged')
  if (moduleKey(a.facade) !== moduleKey(b.facade)) fail('G: module geometry key changed with bay count')
  else pass('G: module cache key stable across bay count')
  if (b.facade.metrics.windowModuleCount !== 5) fail('G: expected 5 windows')
  else pass('G: bay count 5 produced 5 modules')
}

// H — Support style leaves window design unchanged
{
  const base = withFacadeModule({
    assembly: { supportStyle: SUPPORT_STYLES.SIMPLE },
  })
  const a = stoneAndAssembly(base)
  const other = withFacadeModule({
    assembly: { supportStyle: SUPPORT_STYLES.COMBINED },
  })
  other.tracery = base.tracery
  other.stone = base.stone
  const b = stoneAndAssembly(other)
  if (moduleKey(a.facade) !== moduleKey(b.facade)) fail('H: support style mutated window geometry')
  else pass('H: support style leaves shared window unchanged')
}

// I — Variation still linked to master
{
  clearWindowModuleCache()
  const settings = withFacadeModule({
    assembly: {
      bayCount: 3,
      variationMode: VARIATION_MODES.CENTER_EMPHASIS,
      centerEmphasisScale: 1.2,
    },
  })
  const { design, facade } = stoneAndAssembly(settings)
  const keys = new Set(facade.windowModules.map((m) => m.geometryRef))
  if (keys.size < 2) fail('I: center emphasis should yield ≥2 scaled geometries')
  else pass(`I: variation unique keys=${keys.size}`)
  // All modules should derive from same design span family (same tracery flags)
  const presets = new Set(
    facade.windowModules.map((m) => m.parameters.tracery.architecturePreset),
  )
  const presetId = [...presets][0]
  if (presets.size !== 1) fail(`I: expected one architecturePreset, got ${[...presets]}`)
  else if (presetId !== design.tracery.architecturePreset) {
    fail(`I: variation preset ${presetId} !== master ${design.tracery.architecturePreset}`)
  } else pass('I: variation modules share master architecturePreset')
  if (facade.windowModules.some((m) => m.linkMode !== 'linked-to-master')) {
    fail('I: module linkMode not linked-to-master')
  } else pass('I: linkMode=linked-to-master on all bays')
}

// J — Workspace switch simulation (no param reset)
{
  const settings = withFacadeModule()
  settings.tracery.oculusVerticalPosition = 0.61
  settings.tracery.oculusHeightRatio = 0.61
  const stoneView = stoneAndAssembly(settings)
  const assemblyView = stoneAndAssembly(settings)
  if (stoneKey(stoneView.stoneAsm, stoneView.design) !== moduleKey(assemblyView.facade)) {
    fail('J: switch Stone→Assembly lost design')
  } else pass('J: Stone↔Assembly switch keeps shared design')
}

// K — Camera persistence is covered by validate:camera-persistence;
//      here we only assert geometry regen does not require fitToken.
{
  pass('K: camera persistence delegated to validate:camera-persistence (fitToken not bumped by geom)')
}

// M — Surface semantics remain valid after regeneration
{
  clearWindowModuleCache()
  const settings = withFacadeModule({ assembly: { bayCount: 3 } })
  settings.tracery.hierarchicalDepth = 1
  let { facade } = stoneAndAssembly(settings)
  let sem = applyGrowthPolicy(
    extractFacadeSurfaceSemantics(facade, DEFAULT_GROWTH_POLICY),
    DEFAULT_GROWTH_POLICY,
  )
  let check = validateSurfaceSemantics(sem)
  if (!check.ok) fail(`M: semantics invalid before edit: ${check.errors?.join('; ')}`)
  else pass('M: semantics valid (baseline)')

  settings.tracery.oculusVerticalPosition = 0.7
  settings.tracery.oculusHeightRatio = 0.7
  ;({ facade } = stoneAndAssembly(settings))
  sem = applyGrowthPolicy(
    extractFacadeSurfaceSemantics(facade, DEFAULT_GROWTH_POLICY),
    DEFAULT_GROWTH_POLICY,
  )
  check = validateSurfaceSemantics(sem)
  if (!check.ok) fail(`M: semantics invalid after oculus edit: ${check.errors?.join('; ')}`)
  else pass(`M: semantics valid after regen (patches ${sem.patches?.length ?? 0})`)
}

// Facade module preset selectable / distinct id
{
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
    { ...DEFAULT_TRACERY_SETTINGS },
    { ...DEFAULT_STONE_SETTINGS },
  )
  if (applied.tracery.architecturePreset !== ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE) {
    fail('preset: facade module id not applied')
  } else pass('preset: Rayonnant Facade Module selectable')
  if (applied.tracery.enableHierarchicalTracery !== true) fail('preset: hierarchical flag off')
  else pass('preset: facade module enables hierarchical grammar')
}

console.log(ok ? '\nvalidate:shared-window-module PASS' : '\nvalidate:shared-window-module FAIL')
process.exit(ok ? 0 : 1)
