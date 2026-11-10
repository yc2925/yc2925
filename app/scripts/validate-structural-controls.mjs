/**
 * Step 13E.2.1 — Structural control reactivity regression.
 * Each control must change intended semantic geometry.
 *
 * Run: node scripts/validate-structural-controls.mjs
 */
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  measureSupportSemantics,
  shaftCenterOffset,
} from '../src/geometry/gothicGrammar/assemblies/index.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

const eps = 1e-6

function build(overrides = {}) {
  clearWindowModuleCache()
  return buildGothicFacadeElevation({
    bayCount: 3,
    supportStyle: SUPPORT_STYLES.COMBINED,
    bayWidth: 3,
    ...overrides,
  })
}

function firstSemantics(facade) {
  return measureSupportSemantics(facade.supports[0])
}

console.log('=== Step 13E.2.1 Structural Controls Reactivity ===')

{
  // Shaft Arrangement
  const four = firstSemantics(
    build({ shaftArrangement: SHAFT_ARRANGEMENTS.FOUR_SHAFT }),
  )
  const multi = firstSemantics(
    build({ shaftArrangement: SHAFT_ARRANGEMENTS.MULTI_SHAFT }),
  )
  const simple = firstSemantics(
    build({ shaftArrangement: SHAFT_ARRANGEMENTS.SIMPLE }),
  )
  if (four.shaftCount !== 4) fail(`four-shaft count ${four.shaftCount}`)
  else if (multi.shaftCount !== 8) fail(`multi-shaft count ${multi.shaftCount}`)
  else if (simple.shaftCount !== 1) fail(`simple-shaft count ${simple.shaftCount}`)
  else pass(`Shaft Arrangement: counts ${simple.shaftCount}/${four.shaftCount}/${multi.shaftCount}`)
}

{
  // Shaft Projection — mean radial offset must rise with projection
  const lo = firstSemantics(build({ shaftProjection: 0.1 }))
  const hi = firstSemantics(build({ shaftProjection: 0.9 }))
  if (!(hi.meanShaftOffset > lo.meanShaftOffset + 0.1)) {
    fail(
      `Shaft Projection: offset ${lo.meanShaftOffset.toFixed(4)} → ${hi.meanShaftOffset.toFixed(4)} (need +0.10m)`,
    )
  } else {
    pass(
      `Shaft Projection: mean offset ${lo.meanShaftOffset.toFixed(3)} → ${hi.meanShaftOffset.toFixed(3)} m`,
    )
  }
  // Formula unit check
  const f0 = shaftCenterOffset(0.14, 0.04, 0)
  const f1 = shaftCenterOffset(0.14, 0.04, 1)
  if (!(f1 > f0 + 0.15)) fail(`shaftCenterOffset lever too weak (${f0}→${f1})`)
  else pass(`shaftCenterOffset lever ${f0.toFixed(3)} → ${f1.toFixed(3)}`)
}

{
  // Base Height
  const lo = firstSemantics(build({ baseHeight: 0.1, showBases: true }))
  const hi = firstSemantics(build({ baseHeight: 0.4, showBases: true }))
  if (!(hi.baseHeight > lo.baseHeight + 0.15)) {
    fail(`Base Height: ${lo.baseHeight.toFixed(3)} → ${hi.baseHeight.toFixed(3)}`)
  } else pass(`Base Height: ${lo.baseHeight.toFixed(3)} → ${hi.baseHeight.toFixed(3)} m`)
}

{
  // Capital Height
  const lo = firstSemantics(build({ capitalHeight: 0.08, showCapitalTransitions: true }))
  const hi = firstSemantics(build({ capitalHeight: 0.32, showCapitalTransitions: true }))
  if (!(hi.capitalHeight > lo.capitalHeight + 0.12)) {
    fail(`Capital Height: ${lo.capitalHeight.toFixed(3)} → ${hi.capitalHeight.toFixed(3)}`)
  } else {
    pass(`Capital Height: ${lo.capitalHeight.toFixed(3)} → ${hi.capitalHeight.toFixed(3)} m`)
  }
}

{
  // Buttress Setback Count
  const a = firstSemantics(build({ buttressSetbackCount: 2 }))
  const b = firstSemantics(build({ buttressSetbackCount: 5 }))
  if (a.buttressStageCount !== 2) fail(`setback count 2 → ${a.buttressStageCount} stages`)
  else if (b.buttressStageCount !== 5) fail(`setback count 5 → ${b.buttressStageCount} stages`)
  else pass(`Buttress Setback Count: stages ${a.buttressStageCount} → ${b.buttressStageCount}`)
}

{
  // Buttress Setback Ratio — later-stage projection must respond
  const tight = firstSemantics(build({ buttressSetbackCount: 3, buttressSetbackRatio: 0.55 }))
  const loose = firstSemantics(build({ buttressSetbackCount: 3, buttressSetbackRatio: 0.88 }))
  if (tight.buttressStageProjections.length < 3 || loose.buttressStageProjections.length < 3) {
    fail('setback ratio: missing stages')
  } else {
    const t2 = tight.buttressStageProjections[2]
    const l2 = loose.buttressStageProjections[2]
    const tw = tight.buttressStageWidths[2]
    const lw = loose.buttressStageWidths[2]
    if (!(l2 > t2 + 0.02)) fail(`setback ratio projection stage2 ${t2} → ${l2}`)
    else if (!(lw > tw + 0.01)) fail(`setback ratio width stage2 ${tw} → ${lw}`)
    else {
      pass(
        `Buttress Setback Ratio: stage2 proj ${t2.toFixed(3)}→${l2.toFixed(3)}, width ${tw.toFixed(3)}→${lw.toFixed(3)}`,
      )
    }
  }
}

{
  // Unrelated: changing shaft arrangement must not change setback stage count
  const a = firstSemantics(build({ shaftArrangement: SHAFT_ARRANGEMENTS.FOUR_SHAFT, buttressSetbackCount: 3 }))
  const b = firstSemantics(build({ shaftArrangement: SHAFT_ARRANGEMENTS.MULTI_SHAFT, buttressSetbackCount: 3 }))
  if (a.buttressStageCount !== b.buttressStageCount) {
    fail('shaft arrangement unexpectedly changed buttress stage count')
  } else pass('Unrelated: shaft arrangement leaves buttress stage count stable')
}

{
  // Applicability: Simple style has no shafts / no stepped stages
  const simple = firstSemantics(
    build({ supportStyle: SUPPORT_STYLES.SIMPLE, shaftArrangement: SHAFT_ARRANGEMENTS.MULTI_SHAFT }),
  )
  if (simple.shaftCount !== 0) fail(`Simple style should have 0 shafts, got ${simple.shaftCount}`)
  else pass('Applicability: Simple support style has no engaged shafts')
}

if (!ok) {
  console.error('\nStructural controls reactivity FAILED')
  process.exit(1)
}
console.log('\nStep 13E.2.1 structural controls reactivity passed')

// silence unused
void eps
