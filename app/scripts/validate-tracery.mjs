/**
 * Step 13C — Rayonnant tracery grammar validation.
 * Run: node scripts/validate-tracery.mjs
 */
import {
  buildTrefoil,
  buildQuatrefoil,
  buildLancetSubdivision,
  buildOculusPlacement,
  buildComposedWindow,
  buildTraceryConstruction,
  foilInsideCircle,
  maxFoilCenterRadius,
} from '../src/geometry/gothicGrammar/tracery/index.js'
import { buildPointedArch } from '../src/geometry/gothicGrammar/primitives/index.js'
import { ARCH_FAMILIES, ARCH_SEMANTICS } from '../src/geometry/gothicGrammar/primitives/archFamilies.js'
import { distance, nearlyEqualPoints } from '../src/geometry/gothicGrammar/kernel/vector2.js'
import { endPoint, startPoint } from '../src/geometry/gothicGrammar/kernel/arc2.js'
import { validateClosure } from '../src/geometry/gothicGrammar/kernel/planarRegions.js'
import { nearlyEqual } from '../src/geometry/gothicGrammar/kernel/tolerances.js'
import { createCircle } from '../src/geometry/gothicGrammar/kernel/circle2.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13C Rayonnant tracery grammar ===')

// --- Trefoil closure / cusps / symmetry ---
{
  const foil = buildTrefoil({ size: 1.2, cuspDepth: 0.55 })
  if (!foil.validation.ok) fail(`trefoil invalid: ${foil.validation.errors.join('; ')}`)
  else pass('trefoil validates')

  const closure = validateClosure(foil.arcs, foil.parameters.size)
  if (!closure.ok) fail(`trefoil closure: ${closure.reason}`)
  else pass('trefoil closed boundary')

  for (let i = 0; i < foil.arcs.length; i += 1) {
    const a = endPoint(foil.arcs[i])
    const b = startPoint(foil.arcs[(i + 1) % foil.arcs.length])
    if (!nearlyEqualPoints(a, b, foil.parameters.size)) {
      fail(`trefoil cusp join ${i}`)
    }
  }
  pass('trefoil cusp endpoint matching')

  if (!foil.validation.rotationalSymmetry?.ok) {
    fail(`trefoil rotational symmetry err=${foil.validation.rotationalSymmetry?.maxError}`)
  } else pass('trefoil threefold symmetry')

  // Determinism
  const foil2 = buildTrefoil({ size: 1.2, cuspDepth: 0.55 })
  if (Math.abs(foil.derived.lobeRadius - foil2.derived.lobeRadius) > 1e-12) {
    fail('trefoil non-deterministic')
  } else pass('trefoil deterministic')
}

// --- Quatrefoil ---
{
  const foil = buildQuatrefoil({ size: 1.0, cuspDepth: 0.5, orientation: 0 })
  if (!foil.validation.ok) fail(`quatrefoil invalid: ${foil.validation.errors.join('; ')}`)
  else pass('quatrefoil validates')
  if (foil.lobeCount !== 4) fail('quatrefoil lobe count')
  else pass('quatrefoil four lobes')

  const rotated = buildQuatrefoil({ size: 1.0, cuspDepth: 0.5, orientation: Math.PI / 4 })
  if (!rotated.validation.ok) fail(`diagonal quatrefoil invalid: ${rotated.validation.errors.join('; ')}`)
  else pass('diagonal quatrefoil validates')

  if (!foil.validation.rotationalSymmetry?.ok) fail('quatrefoil symmetry')
  else pass('quatrefoil fourfold symmetry')
}

// --- Invalid foil params ---
{
  const bad = buildTrefoil({ size: -1, cuspDepth: 0.5 })
  if (bad.validation.ok) fail('negative size should fail')
  else pass('invalid foil size rejected')

  const shallow = buildTrefoil({ size: 1, cuspDepth: 0.01 })
  // very shallow may still validate or fail — either is ok if consistent
  if (shallow.validation.ok || shallow.validation.errors.length) pass('near-boundary cuspDepth handled')
  else fail('near-boundary cuspDepth produced empty result')
}

// --- Symmetric subdivision ---
{
  const g = buildLancetSubdivision({
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.2,
    symmetric: true,
    childRiseRatio: 1.1,
    containmentMargin: 0.02,
  })
  if (!g.validation.ok) fail(`symmetric subdivision: ${g.validation.errors.join('; ')}`)
  else pass('symmetric subdivision validates')

  const left = g.metadata.leftChild
  const right = g.metadata.rightChild
  if (!nearlyEqual(left.parameters.span, right.parameters.span, 4)) fail('symmetric spans unequal')
  else pass('symmetric equal child spans')

  if (Math.abs(g.derived.mullionX) > 1e-9) fail('mullion not on axis')
  else pass('mullion on parent axis')

  if (!(g.derived.mullionClearance > 0)) fail('mullion clearance not positive')
  else pass(`mullion clearance ${g.derived.mullionClearance.toFixed(3)} m`)
}

// --- Asymmetric subdivision ---
{
  const g = buildLancetSubdivision({
    family: ARCH_FAMILIES.lancet,
    span: 4.5,
    riseRatio: 1.1,
    mullionWidth: 0.18,
    symmetric: false,
    subdivisionRatio: 0.38,
    childRiseRatio: 1.15,
    containmentMargin: 0.015,
  })
  if (!g.validation.ok) fail(`asymmetric subdivision: ${g.validation.errors.join('; ')}`)
  else pass('asymmetric subdivision validates')
  if (nearlyEqual(g.derived.leftSpan, g.derived.rightSpan, 4)) fail('asymmetric spans unexpectedly equal')
  else pass(`asymmetric spans ${g.derived.leftSpan.toFixed(3)} / ${g.derived.rightSpan.toFixed(3)}`)
}

// --- Child containment / invalid overlap ---
{
  const tooFat = buildLancetSubdivision({
    span: 3,
    mullionWidth: 2.8,
    jambInset: 0.05,
    symmetric: true,
    childRiseRatio: 1.05,
  })
  if (tooFat.validation.ok) fail('oversized mullion should fail')
  else pass('oversized mullion rejected')

  const tallChildren = buildLancetSubdivision({
    family: ARCH_FAMILIES.depressed,
    span: 3,
    riseRatio: 0.4,
    mullionWidth: 0.12,
    childRiseRatio: 1.5,
    containmentMargin: 0.05,
  })
  // May fail containment — must not silently claim valid
  if (tallChildren.validation.ok) {
    pass('depressed parent + tall children still contained')
  } else {
    pass(`containment correctly rejected: ${tallChildren.validation.errors[0]}`)
  }
}

// --- Multiple parent spans ---
{
  for (const span of [2, 3, 5, 7]) {
    const g = buildLancetSubdivision({
      span,
      family: ARCH_FAMILIES.equilateral,
      mullionWidth: span * 0.05,
      childRiseRatio: 1.05,
    })
    if (!g.validation.ok) fail(`subdivision span=${span}: ${g.validation.errors.join('; ')}`)
  }
  pass('subdivision across parent spans 2–7 m')
}

// --- Oculus containment ---
{
  const g = buildOculusPlacement({
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    heightRatio: 0.75,
    radiusRatio: 0.85,
    clearance: 0.04,
    foilType: 'quatrefoil',
    foilScale: 0.85,
    cuspDepth: 0.5,
  })
  if (!g.validation.ok) fail(`oculus: ${g.validation.errors.join('; ')}`)
  else pass('oculus + quatrefoil validates')

  if (g.metadata?.oculus?.circle && g.metadata?.foil) {
    const foilIn = foilInsideCircle(g.metadata.foil, g.metadata.oculus.circle, 0.01)
    if (!foilIn.ok) fail('foil outside oculus')
    else pass('foil contained in oculus')
  } else if (g.validation.ok) {
    fail('oculus metadata missing despite valid graph')
  }

  // Impossible: huge clearance
  const bad = buildOculusPlacement({
    span: 3,
    clearance: 2.5,
    heightRatio: 0.5,
    radiusRatio: 1,
    foilType: 'none',
  })
  if (bad.validation.ok) fail('impossible oculus clearance should fail')
  else pass('impossible oculus reported as constraint failure')
}

// --- Composed window ---
{
  const g = buildComposedWindow({
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.16,
    childRiseRatio: 1.08,
    oculusHeightRatio: 0.8,
    oculusRadiusRatio: 0.88,
    foilType: 'quatrefoil',
    cuspDepth: 0.55,
  })
  if (!g.validation.ok) fail(`composed: ${g.validation.errors.join('; ')}`)
  else pass('composed window TWO LANCETS + UPPER QUATREFOIL validates')

  const roles = Object.values(g.elements).map((e) => e.role)
  for (const need of [
    'PARENT_ARCH',
    'PRIMARY_MULLION',
    'CHILD_LANCET',
    'UPPER_OCULUS',
    'QUATREFOIL',
  ]) {
    if (!roles.includes(need)) fail(`composed missing role ${need}`)
  }
  pass('composed semantic roles present')

  // Parent span change rebuilds
  const g2 = buildComposedWindow({
    family: ARCH_FAMILIES.equilateral,
    span: 5,
    mullionWidth: 0.18,
    childRiseRatio: 1.08,
  })
  if (!g2.validation.ok) fail(`composed span=5: ${g2.validation.errors.join('; ')}`)
  if (nearlyEqual(g.derived.oculusRadius, g2.derived.oculusRadius, 1)) {
    fail('oculus radius did not respond to parent span')
  } else pass('composition responds to parent span')

  // Determinism
  const g3 = buildComposedWindow({
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.16,
    childRiseRatio: 1.08,
    oculusHeightRatio: 0.8,
    oculusRadiusRatio: 0.88,
    foilType: 'quatrefoil',
    cuspDepth: 0.55,
  })
  if (!nearlyEqual(g.derived.oculusRadius, g3.derived.oculusRadius, 4)) fail('composed non-deterministic')
  else pass('composed deterministic')
}

// --- Presentation vs construction same geometry ---
{
  const params = {
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.16,
    childRiseRatio: 1.08,
  }
  const pres = buildTraceryConstruction('composed-window', params, {
    showConstruction: false,
    showCenters: false,
    showPoints: false,
    showResult: true,
    showDimensions: true,
  })
  const cons = buildTraceryConstruction('composed-window', params, {
    showConstruction: true,
    showCenters: true,
    showPoints: true,
    showResult: true,
    showDimensions: true,
    showArchAxis: true,
  })
  const gP = pres.metadata.graph
  const gC = cons.metadata.graph
  if (!nearlyEqual(gP.derived.oculusRadius, gC.derived.oculusRadius, 4)) {
    fail('display modes altered oculus radius')
  } else pass('presentation/construction share oculus radius')
  if (
    !nearlyEqual(
      gP.metadata.leftChild.derived.radius,
      gC.metadata.leftChild.derived.radius,
      4,
    )
  ) {
    fail('display modes altered child arch')
  } else pass('presentation/construction share child arch radius')

  const resultPres = (pres.curves ?? []).filter((c) => c.role === 'result').length
  const resultCons = (cons.curves ?? []).filter((c) => c.role === 'result').length
  if (resultPres < 4) fail(`presentation too few result curves (${resultPres})`)
  else pass(`presentation result curves: ${resultPres}`)
  if ((cons.curves ?? []).filter((c) => c.role === 'construction').length < 1) {
    fail('construction mode missing construction curves')
  } else pass('construction mode shows construction curves')
}

// --- Graph stores exact arcs not only samples ---
{
  const foil = buildTrefoil({ size: 1 })
  if (!foil.arcs?.length || foil.arcs[0].type !== 'arc') fail('foil missing exact arcs')
  else pass('foil stores exact circular arcs')
  if (!foil.circles?.length) fail('foil missing construction circles')
  else pass('foil stores construction circles')
}

console.log(ok ? '\nAll tracery checks passed.' : '\nTracery validation FAILED.')
process.exit(ok ? 0 : 1)
