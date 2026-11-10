/**
 * Step 13E.3.2.2 — Trefoil topology regression.
 * Run: node scripts/validate-trefoil-topology.mjs
 */
import {
  buildTrefoil,
  buildQuatrefoil,
  foilCenterRadius,
} from '../src/geometry/gothicGrammar/tracery/foils.js'
import { foilToVoidLoop } from '../src/geometry/gothicGrammar/tracery/solidVoid.js'
import { detectSelfIntersections, signedArea } from '../src/geometry/gothicGrammar/kernel/planarRegions.js'
import { applyTraceryExample } from '../src/geometry/gothicGrammar/tracery/traceryExamples.js'
import {
  DEFAULT_TRACERY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
  createGrammarSettings,
} from '../src/geometry/gothicGrammar/settings.js'
import { resolveWindowDesignParams } from '../src/geometry/gothicGrammar/assemblies/windowDesignParams.js'
import { buildSolidVoidModel } from '../src/geometry/gothicGrammar/tracery/solidVoid.js'
import { buildStoneAssembly, stoneGeometryKey } from '../src/geometry/gothicGrammar/solids/index.js'
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  validateSurfaceSemantics,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import { FOIL_TYPES } from '../src/geometry/gothicGrammar/tracery/roles.js'
import { distance } from '../src/geometry/gothicGrammar/kernel/vector2.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.3.2.2 Trefoil Topology ===')

const depths = [0.35, 0.55, 0.7, 0.85]
const sizes = [0.6, 1.0, 1.4]

for (const size of sizes) {
  for (const cuspDepth of depths) {
    const foil = buildTrefoil({
      size,
      cuspDepth,
      orientation: Math.PI / 2,
      centerX: 0.1,
      centerY: -0.2,
    })
    if (!foil.validation?.ok) {
      fail(`trefoil size=${size} depth=${cuspDepth}: ${foil.validation?.errors?.join('; ')}`)
      continue
    }
    if (foil.lobeCount !== 3) fail(`trefoil lobeCount≠3 at size=${size}`)
    if (foil.cusps?.length !== 3) fail(`trefoil cusps≠3 at size=${size}`)
    if (foil.arcs?.length !== 3) fail(`trefoil arcs≠3 at size=${size}`)
    if (foil.validation.selfIntersection?.selfIntersecting) {
      fail(`trefoil self-intersects size=${size} depth=${cuspDepth}`)
      continue
    }
    const loopSelf = detectSelfIntersections(foil.arcs, { segments: 48 })
    if (loopSelf.selfIntersecting) {
      fail(`trefoil loop self-intersects size=${size} depth=${cuspDepth}`)
      continue
    }
    if (foil.derived?.cuspConstruction !== 'outer-intersection') {
      fail('expected outer-intersection cusp construction')
    }
    // Three distinct lobe tips at ~120°
    const tipAngles = []
    for (let i = 0; i < 3; i += 1) {
      const ang = foil.parameters.orientation + foil.parameters.rotation + (i * 2 * Math.PI) / 3
      tipAngles.push(ang)
      const tip = {
        x: foil.lobeCenters[i].x + Math.cos(ang) * foil.derived.lobeRadius,
        y: foil.lobeCenters[i].y + Math.sin(ang) * foil.derived.lobeRadius,
      }
      const tipR = distance(tip, foil.center)
      if (Math.abs(tipR - size) > size * 0.02) {
        fail(`tip not on enclosing circle size=${size} i=${i}`)
      }
    }
    // Recognizable indent: cusp radius meaningfully inside tip radius
    if (!(foil.derived.indentRatio > 0.2)) {
      fail(`trefoil indent too shallow (${foil.derived.indentRatio}) size=${size} depth=${cuspDepth}`)
    }
    const voidLoop = foilToVoidLoop(foil)
    if (!voidLoop.ok) fail(`foilToVoidLoop failed: ${voidLoop.errors?.join('; ')}`)
    const area = Math.abs(signedArea(voidLoop.edges, { segments: 32 }))
    if (!(area > 0.05 * size * size)) fail(`foil void area too small size=${size}`)
  }
}
pass(`trefoil matrix ${sizes.length}×${depths.length}: 3 lobes, closed, no self-intersection`)

// Quatrefoil must also stay simple under outer-cusp rule
{
  const q = buildQuatrefoil({ size: 1, cuspDepth: 0.55, orientation: Math.PI / 4 })
  if (!q.validation?.ok || q.validation.selfIntersection?.selfIntersecting) {
    fail(`quatrefoil broken: ${q.validation?.errors?.join('; ')}`)
  } else if (q.lobeCount !== 4) fail('quatrefoil lobeCount≠4')
  else pass('quatrefoil outer-cusp topology valid')
}

// Example B → Stone / Assembly
{
  clearWindowModuleCache()
  const applied = applyTraceryExample(
    'trefoil',
    { ...DEFAULT_TRACERY_SETTINGS, span: 3 },
    { ...DEFAULT_STONE_SETTINGS },
  )
  if (applied.tracery.foilType !== FOIL_TYPES.trefoil) fail('example B foilType')
  if (Math.abs((applied.tracery.cuspDepth ?? 0) - 0.85) > 1e-9) {
    fail(`example B cuspDepth expected 0.85 got ${applied.tracery.cuspDepth}`)
  } else pass('example B applies cuspDepth 0.85 after preset merge')

  const design = resolveWindowDesignParams({
    tracery: applied.tracery,
    stone: applied.stone,
  })
  const sv = buildSolidVoidModel(design.tracery)
  if (!sv.validation?.ok) fail(`solid/void: ${sv.validation?.errors?.join('; ')}`)
  const foil = sv.composed?.metadata?.foil
  if (!foil?.validation?.ok) fail('composed foil invalid')
  if (foil.validation.selfIntersection?.selfIntersecting) fail('composed foil self-intersects')
  if (foil.lobeCount !== 3) fail('composed foil not trefoil')
  pass(
    `outer-with-holes foil indent=${foil.derived.indentRatio.toFixed(3)} area=${sv.metrics?.foilArea?.toFixed?.(4)}`,
  )

  const stone = buildStoneAssembly({ regionParams: design.tracery, stone: design.stone })
  if (!stone.ok && stone.metrics?.watertight !== true) {
    fail(`stone assembly invalid`)
  } else if (stone.metrics?.nonManifoldEdgeCount > 0) {
    fail(`non-manifold edges: ${stone.metrics.nonManifoldEdgeCount}`)
  } else {
    pass(
      `stone watertight vol=${stone.metrics?.structuralVolume?.toFixed?.(4)} tris=${stone.metrics?.triangleCount} nm=0`,
    )
  }

  const settings = createGrammarSettings({
    tracery: design.tracery,
    stone: design.stone,
    assembly: { bayCount: 3 },
  })
  const facade = buildGothicFacadeElevation({
    ...settings.assembly,
    windowDesign: { tracery: design.tracery, stone: design.stone },
  })
  const gKey = stoneGeometryKey(design.tracery, design.stone)
  const asmKey = facade.windowModules?.[0]?.geometryRef
  if (gKey !== asmKey) fail('Assembly module key ≠ Stone key')
  else pass('Assembly synchronized with Stone trefoil module')

  const sem = applyGrowthPolicy(
    extractFacadeSurfaceSemantics(facade, DEFAULT_GROWTH_POLICY),
    DEFAULT_GROWTH_POLICY,
  )
  const check = validateSurfaceSemantics(sem)
  if (!check.ok) fail(`semantics: ${check.errors?.join('; ')}`)
  else pass('surface semantics valid after trefoil repair')
}

// Parameter reactivity: cuspDepth / foilScale / OFF change geometry
{
  const base = applyTraceryExample(
    'trefoil',
    { ...DEFAULT_TRACERY_SETTINGS, span: 3 },
    { ...DEFAULT_STONE_SETTINGS },
  )
  const a = resolveWindowDesignParams({ tracery: base.tracery, stone: base.stone })
  const keyA = stoneGeometryKey(a.tracery, a.stone)
  const deeper = resolveWindowDesignParams({
    tracery: { ...base.tracery, cuspDepth: 0.9 },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(deeper.tracery, deeper.stone)) {
    fail('cuspDepth edit did not change geometry')
  } else pass('cuspDepth edit regenerates geometry')

  const scaled = resolveWindowDesignParams({
    tracery: { ...base.tracery, foilScale: 0.7 },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(scaled.tracery, scaled.stone)) {
    fail('foilScale edit did not change geometry')
  } else pass('foilScale edit regenerates geometry')

  const off = resolveWindowDesignParams({
    tracery: {
      ...base.tracery,
      foilType: FOIL_TYPES.quatrefoil,
      trefoilHeads: false,
      secondaryQuatrefoils: true,
    },
    stone: base.stone,
  })
  if (keyA === stoneGeometryKey(off.tracery, off.stone)) {
    fail('foilType toggle did not change geometry')
  } else pass('foilType trefoil→quatrefoil regenerates geometry')
}

// foilCenterRadius monotonic with cuspDepth for trefoil (deeper → larger Rc)
{
  const r1 = foilCenterRadius(1, 0.3, 3)
  const r2 = foilCenterRadius(1, 0.8, 3)
  if (!(r2 > r1)) fail('foilCenterRadius not monotonic with cuspDepth')
  else pass(`foilCenterRadius monotonic ${r1.toFixed(3)} → ${r2.toFixed(3)}`)
}

console.log(ok ? '\nvalidate:trefoil-topology PASS' : '\nvalidate:trefoil-topology FAIL')
process.exit(ok ? 0 : 1)
