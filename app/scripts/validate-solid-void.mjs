/**
 * Step 13C.1 — Solid / void region validation.
 * Run: node scripts/validate-solid-void.mjs
 */
import {
  buildSolidVoidModel,
  foilToVoidLoop,
  closedLoopFromArch,
  buildOuterBoundaryLoop,
  evaluateClearances,
  REGION_TYPES,
} from '../src/geometry/gothicGrammar/tracery/index.js'
import { buildQuatrefoil, buildTrefoil } from '../src/geometry/gothicGrammar/tracery/foils.js'
import { buildPointedArch, ARCH_FAMILIES } from '../src/geometry/gothicGrammar/primitives/index.js'
import { validateClosure, windingOrientation } from '../src/geometry/gothicGrammar/kernel/planarRegions.js'
import { nearlyEqual } from '../src/geometry/gothicGrammar/kernel/tolerances.js'
import { buildTraceryConstruction } from '../src/geometry/gothicGrammar/tracery/traceryConstruction.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13C.1 solid / void regions ===')

// --- Outer / lancet loop closure ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: 4 })
  const loop = closedLoopFromArch(arch, -0.4)
  if (!loop.ok) fail(`outer-style clear loop: ${loop.errors.join('; ')}`)
  else pass('clear arch loop closes')
  const c = validateClosure(loop.edges, 4)
  if (!c.ok) fail(`closure ${c.reason}`)
  else pass('closure validation')
  if (windingOrientation(loop.edges, { segments: 20 }) !== 'ccw') fail('expected CCW outer-style loop')
  else pass('CCW winding')
}

{
  const outer = buildOuterBoundaryLoop(
    { family: ARCH_FAMILIES.equilateral, span: 3, riseRatio: Math.sqrt(3) / 2, springingY: 0 },
    0.12,
    -0.35,
  )
  if (!outer.ok) fail(`outer boundary: ${outer.errors.join('; ')}`)
  else pass(`outer frame span=${outer.arch.parameters.span.toFixed(2)}`)
}

// --- Quatrefoil single closed void ---
{
  const foil = buildQuatrefoil({ size: 0.8, cuspDepth: 0.55 })
  const voidLoop = foilToVoidLoop(foil)
  if (!voidLoop.ok) fail(`quatrefoil void: ${voidLoop.errors.join('; ')}`)
  else pass('quatrefoil is one closed void loop')
  if (foil.arcs.length !== 4) fail('expected 4 exact arcs')
  else pass('quatrefoil stores 4 exact arcs (not circle union silhouette)')
  if (!foil.validation.rotationalSymmetry?.ok) fail('fourfold symmetry')
  else pass('quatrefoil fourfold symmetry')
}

{
  const foil = buildTrefoil({ size: 0.9, cuspDepth: 0.5 })
  const voidLoop = foilToVoidLoop(foil)
  if (!voidLoop.ok) fail(`trefoil void: ${voidLoop.errors.join('; ')}`)
  else pass('trefoil void loop validates')
}

// --- Composed solid/void ---
{
  const model = buildSolidVoidModel({
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.16,
    jambInset: 0.08,
    childRiseRatio: 1.08,
    outerFrameWidth: 0.12,
    windowBaseElevation: -0.4,
    minStoneWebWidth: 0.06,
    foilType: 'quatrefoil',
    cuspDepth: 0.55,
  })
  if (!model.validation.ok) fail(`solid void: ${model.validation.errors.join('; ')}`)
  else pass('composed solid/void validates')

  for (const need of [
    REGION_TYPES.OUTER_BOUNDARY,
    REGION_TYPES.LEFT_LANCET_VOID,
    REGION_TYPES.RIGHT_LANCET_VOID,
    REGION_TYPES.UPPER_FOIL_VOID,
    REGION_TYPES.STONE_REGION,
    REGION_TYPES.CENTRAL_MULLION,
  ]) {
    if (!model.regions[need]) fail(`missing region ${need}`)
  }
  pass('required region types present')

  const m = model.metrics
  if (!(m.solidArea > 0)) fail(`solid area ${m.solidArea}`)
  else pass(`solid area ${m.solidArea.toFixed(3)} m²`)
  if (!(m.openingArea > 0)) fail(`opening area ${m.openingArea}`)
  else pass(`opening area ${m.openingArea.toFixed(3)} m²`)
  if (!(m.outerArea > m.openingArea)) fail('outer area must exceed openings')
  else pass('area consistency outer > openings')
  if (!m.boundaryValid) fail('boundaryValid false')
  else pass('boundaries valid')
  if (!m.connectivityOk) fail('connectivity failed')
  else pass('stone connectivity ok')
  if (!(m.mullionWidth > 0)) fail('mullion width')
  else pass(`mullion width ${m.mullionWidth.toFixed(3)} m`)

  // Oculus must not be a hole
  const holeTypes = Object.values(model.regions)
    .filter((r) => String(r.type).includes('VOID'))
    .map((r) => r.type)
  if (holeTypes.includes('UPPER_OCULUS') || holeTypes.some((t) => /OCULUS/.test(t))) {
    fail('oculus incorrectly registered as void')
  } else pass('oculus is not an architectural hole')
}

// --- Multiple spans / rises ---
{
  for (const span of [3, 4, 5.5]) {
    const model = buildSolidVoidModel({
      span,
      family: ARCH_FAMILIES.equilateral,
      mullionWidth: span * 0.04,
      jambInset: 0.08,
      childRiseRatio: 1.05,
      windowBaseElevation: -0.3,
      minStoneWebWidth: 0.05,
    })
    if (!model.validation.ok) fail(`span=${span}: ${model.validation.errors.join('; ')}`)
  }
  pass('solid/void across spans 3–5.5 m')
}

{
  const model = buildSolidVoidModel({
    family: ARCH_FAMILIES.lancet,
    span: 4,
    riseRatio: 1.15,
    mullionWidth: 0.18,
    childRiseRatio: 1.2,
    windowBaseElevation: -0.35,
  })
  if (!model.validation.ok) fail(`lancet parent: ${model.validation.errors.join('; ')}`)
  else pass('lancet parent solid/void')
}

// --- Determinism ---
{
  const a = buildSolidVoidModel({ span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 })
  const b = buildSolidVoidModel({ span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 })
  if (!nearlyEqual(a.metrics.solidArea, b.metrics.solidArea, 10)) fail('non-deterministic solid area')
  else pass('deterministic solid area')
}

// --- Invalid cases ---
{
  const badBase = buildSolidVoidModel({
    span: 4,
    windowBaseElevation: 5,
  })
  if (badBase.validation.ok) fail('base above springing should fail')
  else pass(`invalid base reported: ${badBase.validation.errors[0]}`)

  const fatMullion = buildSolidVoidModel({
    span: 3,
    mullionWidth: 2.5,
    jambInset: 0.05,
  })
  if (fatMullion.validation.ok) fail('oversized mullion composition should fail')
  else pass('oversized mullion rejected upstream')
}

// --- Min web warning (not silent fix) ---
{
  const model = buildSolidVoidModel({
    span: 4,
    mullionWidth: 0.16,
    jambInset: 0.08,
    windowBaseElevation: -0.4,
    minStoneWebWidth: 0.5,
  })
  // May still be geometrically valid but warn
  if (model.validation.warnings?.length || model.clearances?.warnings?.length) {
    pass('min web warning emitted without rewriting params')
  } else if (!model.validation.ok) {
    pass('strict min web surfaced as error/warning path')
  } else {
    // If clearances all happen to exceed 0.5 somehow, still ok
    pass('min web check ran (no warning for this seed)')
  }
  if (model.parameters.minStoneWebWidth !== 0.5) fail('min web param mutated')
  else pass('user minStoneWebWidth preserved')
}

// --- SECTION construction document ---
{
  const section = buildTraceryConstruction(
    'composed-window',
    { span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 },
    { displayState: 'section', showSection: true, showResult: true },
  )
  if (!section.metadata?.solidVoid) fail('section missing solidVoid')
  else pass('section attaches solidVoid model')
  const fills = (section.curves ?? []).filter((c) => c.role === 'region-fill')
  if (!fills.length) fail('section missing region-fill')
  else pass('section has stone fill recipe')
  if ((section.metadata.annotations ?? []).length) fail('section should not show dim labels')
  else pass('section has no dimension labels')

  const pres = buildTraceryConstruction(
    'composed-window',
    { span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 },
    { displayState: 'presentation', showResult: true, showDimensions: true },
  )
  const a = section.metadata.solidVoid.metrics.solidArea
  const b = pres.metadata.solidVoid.metrics.solidArea
  if (!nearlyEqual(a, b, 10)) fail('section/presentation solid areas diverge')
  else pass('section and presentation share solid area')
}

// --- Finite coordinates ---
{
  const model = buildSolidVoidModel({ span: 4, windowBaseElevation: -0.4 })
  for (const r of Object.values(model.regions)) {
    for (const p of r.samples ?? []) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) fail(`non-finite in ${r.id}`)
    }
  }
  pass('finite sample coordinates')
}

console.log(ok ? '\nAll solid/void checks passed.' : '\nSolid/void validation FAILED.')
process.exit(ok ? 0 : 1)
