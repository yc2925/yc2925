/**
 * Step 13B — Pointed arch grammar validation.
 * Run: node scripts/validate-pointed-arch.mjs
 */
import {
  buildPointedArch,
  ARCH_FAMILIES,
  EQUILATERAL_RISE_RATIO,
  ARCH_SEMANTICS,
  upperMinorSweep,
} from '../src/geometry/gothicGrammar/primitives/index.js'
import { distance, point, nearlyEqualPoints } from '../src/geometry/gothicGrammar/kernel/vector2.js'
import { startPoint, endPoint, pointAt as arcPointAt } from '../src/geometry/gothicGrammar/kernel/arc2.js'
import { buildArchComparison } from '../src/geometry/gothicGrammar/construction/archConstruction.js'
import { nearlyEqual } from '../src/geometry/gothicGrammar/kernel/tolerances.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13B pointed arch grammar ===')

const S = 3
const a = S / 2

// --- Equilateral rise relationship ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: S })
  if (!arch.validation.ok) fail(`equilateral invalid: ${arch.validation.errors.join('; ')}`)
  else pass('equilateral validates')
  const expectedH = EQUILATERAL_RISE_RATIO * S
  if (!nearlyEqual(arch.parameters.rise, expectedH, S)) fail('equilateral rise ≠ (√3/2)·S')
  else pass(`equilateral rise = ${(arch.parameters.rise).toFixed(4)} m`)
  const CA = arch.points[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const CB = arch.points[ARCH_SEMANTICS.RIGHT_ARC_CENTER]
  const A = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  if (!nearlyEqualPoints(CA, B, S)) fail('equilateral C_A ≠ B')
  else pass('equilateral: C_A coincides with right springing')
  if (!nearlyEqualPoints(CB, A, S)) fail('equilateral C_B ≠ A')
  else pass('equilateral: C_B coincides with left springing')
}

// --- Radius / residuals ---
{
  for (const family of Object.values(ARCH_FAMILIES)) {
    const riseRatio =
      family === ARCH_FAMILIES.equilateral
        ? EQUILATERAL_RISE_RATIO
        : family === ARCH_FAMILIES.lancet
          ? 1.1
          : 0.5
    const arch = buildPointedArch({ family, span: S, riseRatio })
    const R = arch.derived.radius
    const A = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
    const B = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
    const P = arch.points[ARCH_SEMANTICS.APEX]
    const CA = arch.points[ARCH_SEMANTICS.LEFT_ARC_CENTER]
    const CB = arch.points[ARCH_SEMANTICS.RIGHT_ARC_CENTER]
    const checks = [
      Math.abs(distance(CA, A) - R),
      Math.abs(distance(CA, P) - R),
      Math.abs(distance(CB, B) - R),
      Math.abs(distance(CB, P) - R),
    ]
    if (checks.some((r) => r > 1e-9)) fail(`${family} radius residuals ${checks}`)
    else pass(`${family} circle radius equality`)
    if (!nearlyEqualPoints(endPoint(arch.arcs[ARCH_SEMANTICS.LEFT_ARC]), P, S)) {
      fail(`${family} left arc apex`)
    } else if (!nearlyEqualPoints(startPoint(arch.arcs[ARCH_SEMANTICS.RIGHT_ARC]), P, S)) {
      fail(`${family} right arc apex`)
    } else pass(`${family} exact apex join`)
  }
}

// --- Reflection symmetry ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.lancet, span: S, riseRatio: 1.05 })
  const A = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = arch.points[ARCH_SEMANTICS.APEX]
  if (Math.abs(A.x + B.x) > 1e-12 || Math.abs(P.x) > 1e-12) fail('symmetry broken')
  else pass('reflection symmetry about x = 0')
}

// --- Minor upper sweeps / no major arc ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.depressed, span: S, riseRatio: 0.4 })
  const L = arch.arcs[ARCH_SEMANTICS.LEFT_ARC]
  const R = arch.arcs[ARCH_SEMANTICS.RIGHT_ARC]
  if (Math.abs(L.sweepAngle) > Math.PI || Math.abs(R.sweepAngle) > Math.PI) {
    fail('major arc selected')
  } else pass('minor arc sweeps')
  const midL = arcPointAt(L, 0.5)
  const midR = arcPointAt(R, 0.5)
  if (midL.y < arch.parameters.springingY || midR.y < arch.parameters.springingY) {
    fail('midpoint below springing')
  } else pass('upper arch midpoints')
}

// --- Samples on circles ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.lancet, span: 4, riseRatio: 1.2 })
  const CA = arch.points[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const R = arch.derived.radius
  const off = arch.samples.left.some((p) => Math.abs(distance(p, CA) - R) > 1e-6)
  if (off) fail('sample off left circle')
  else pass('samples lie on defining circles')
}

// --- Apex cusp (endpoints meet; tangents need not) ---
{
  const arch = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: S })
  const L = arch.arcs[ARCH_SEMANTICS.LEFT_ARC]
  const R = arch.arcs[ARCH_SEMANTICS.RIGHT_ARC]
  if (!nearlyEqualPoints(endPoint(L), startPoint(R), S)) fail('cusp join missing')
  else pass('apex cusp join (continuous endpoints)')
}

// --- Reject invalid ---
{
  const z = buildPointedArch({ family: ARCH_FAMILIES.lancet, span: S, riseRatio: 0 })
  if (z.validation.ok) fail('zero rise should reject')
  else pass('rejects non-positive rise ratio')
  const neg = buildPointedArch({ family: ARCH_FAMILIES.depressed, span: -1 })
  if (neg.validation.ok) fail('negative span should reject')
  else pass('rejects non-positive span')
  const badLancet = buildPointedArch({
    family: ARCH_FAMILIES.lancet,
    span: S,
    riseRatio: 0.5,
  })
  if (badLancet.validation.ok) fail('lancet below equilateral should reject')
  else pass('rejects lancet below equilateral rise')
}

// --- Extreme depressed / lancet ---
{
  const d = buildPointedArch({ family: ARCH_FAMILIES.depressed, span: S, riseRatio: 0.35 })
  const l = buildPointedArch({ family: ARCH_FAMILIES.lancet, span: S, riseRatio: 1.6 })
  if (!d.validation.ok || !l.validation.ok) fail('extreme ratios invalid')
  else pass('extreme rise ratios valid')
  const finite = [...d.samples.left, ...l.samples.right].every(
    (p) => Number.isFinite(p.x) && Number.isFinite(p.y),
  )
  if (!finite) fail('non-finite samples')
  else pass('finite coordinates at extremes')
}

// --- Determinism ---
{
  const a1 = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: 2.5 })
  const a2 = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: 2.5 })
  if (a1.samples.left.length !== a2.samples.left.length) fail('nondeterministic sample count')
  else if (!a1.samples.left.every((p, i) => nearlyEqualPoints(p, a2.samples.left[i], 2.5))) {
    fail('nondeterministic samples')
  } else pass('deterministic output')
}

// --- Dimension change recomputes (not fake scale) ---
{
  const small = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: 2 })
  const large = buildPointedArch({ family: ARCH_FAMILIES.equilateral, span: 4 })
  const rRatio = large.derived.radius / small.derived.radius
  if (Math.abs(rRatio - 2) > 1e-9) fail('radius did not scale with span in equilateral')
  else pass('recompute on span change (R ∝ S for equilateral)')
  if (nearlyEqualPoints(small.points.APEX, large.points.APEX, 1)) fail('apex unchanged — likely fake scale')
  else pass('apex moves with span (fresh construction)')
}

// --- upperMinorSweep helper ---
{
  const c = point(1.5, 0)
  const from = point(-1.5, 0)
  const to = point(0, (Math.sqrt(3) / 2) * 3)
  const sw = upperMinorSweep(c, from, to, 0)
  if (Math.abs(sw.sweepAngle) > Math.PI) fail('helper major sweep')
  else pass(`upperMinorSweep |sweep|=${Math.abs(sw.sweepAngle).toFixed(3)}`)
}

// --- Comparison mode ---
{
  const cmp = buildArchComparison({ span: 3 })
  if (!cmp.validation.ok) fail(`compare invalid: ${cmp.validation.errors?.join('; ')}`)
  else if ((cmp.metadata.arches?.length ?? 0) !== 3) fail('compare needs 3 arches')
  else if (!cmp.curves.some((c) => c.role === 'result')) fail('compare missing result curves')
  else pass(`compare mode: ${cmp.metadata.arches.length} families, ${cmp.curves.length} curves`)
}

console.log(ok ? '\nAll pointed-arch checks passed.' : '\nPointed-arch validation FAILED.')
process.exit(ok ? 0 : 1)
