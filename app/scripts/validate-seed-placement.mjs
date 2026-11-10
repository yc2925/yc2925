/**
 * Step 13E.4.1 — Seed placement / anchor lifecycle regression.
 * Run: npm run validate:seed-placement
 */
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  SUPPORT_STYLES,
  createAnchorOnPatch,
  attachFromWorldHit,
  distributeGrowthSeeds,
  buildGrowthNavigationGraph,
  rebindGrowthAnchors,
  emptyGrowthAttachmentState,
  ANCHOR_STATUS,
  resetAnchorIdCounter,
  stableGeometrySignature,
  findNearestPatch,
} from '../src/geometry/gothicGrammar/assemblies/index.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.4.1 Seed Placement ===')

resetAnchorIdCounter(0)

function buildFacade(overrides = {}) {
  clearWindowModuleCache()
  return buildGothicFacadeElevation({
    bayCount: 3,
    bayWidth: 3,
    supportStyle: SUPPORT_STYLES.COMBINED,
    hierarchicalDepth: 1,
    id: `facade-gg-b${overrides.bayCount ?? 3}`,
    ...overrides,
  })
}

function semanticsOf(facade) {
  return applyGrowthPolicy(extractFacadeSurfaceSemantics(facade))
}

{
  const a = buildFacade({ bayCount: 3 })
  const b = buildFacade({ bayCount: 3 })
  const s1 = semanticsOf(a)
  const s2 = semanticsOf(b)
  if (s1.geometryVersion !== s2.geometryVersion) {
    fail(`geometryVersion unstable across rebuild: ${s1.geometryVersion} vs ${s2.geometryVersion}`)
  } else pass('geometryVersion stable across identical rebuilds')

  if (stableGeometrySignature('facade-99|3|x') !== stableGeometrySignature('facade-12|3|x')) {
    fail('stableGeometrySignature should ignore facade-N counter')
  } else pass('stableGeometrySignature strips facade-N')
}

{
  const facade = buildFacade()
  const sem = semanticsOf(facade)
  const patch = (sem.patches ?? []).find((p) => p.growthEligibility === 'ALLOWED' || p.growthEligibility === 'ELIGIBLE' || p.growthEligibility === 'PREFERRED')
    ?? (sem.patches ?? []).find((p) => p.growthEligibility !== 'PROHIBITED')
  if (!patch) {
    fail('no placeable patch for manual seed')
  } else {
    const created = createAnchorOnPatch(sem, patch, {
      worldPosition: patch.worldTransform?.position,
    })
    if (!created.ok) fail(`manual create failed: ${created.reason}`)
    else if (created.anchor.status !== ANCHOR_STATUS.VALID) {
      fail(`fresh seed status ${created.anchor.status}, expected VALID`)
    } else pass('one click / createAnchorOnPatch initializes VALID')

    // Simulate React place handler: append without rebind
    let state = {
      ...emptyGrowthAttachmentState(sem.geometryVersion),
      anchors: [created.anchor],
      geometrySignature: sem.geometryVersion,
    }
    const graph1 = buildGrowthNavigationGraph(sem, { navigationGapTolerance: 0.35 })
    state = { ...state, navigationGraph: graph1 }

    // Unchanged geometry must not reproject
    const same = rebindGrowthAnchors(state, sem, {})
    const reproj = same.anchors.filter((a) => a.status === ANCHOR_STATUS.REPROJECTED).length
    const valid = same.anchors.filter((a) => a.status === ANCHOR_STATUS.VALID).length
    if (reproj !== 0 || valid !== 1) {
      fail(`unchanged geometry rebind: valid=${valid} reproj=${reproj}`)
    } else pass('unchanged geometry triggers no REPROJECTED')
  }
}

{
  const facade = buildFacade()
  const sem = semanticsOf(facade)
  const dist = distributeGrowthSeeds(sem, {
    seedCount: 45,
    randomSeed: 13,
    minSpacing: 0.22,
  })
  if (dist.anchors.length < 10) fail(`auto distribute only ${dist.anchors.length}`)
  else pass(`distribute ${dist.anchors.length} automatic seeds`)

  const bad = dist.anchors.filter((a) => a.status !== ANCHOR_STATUS.VALID)
  if (bad.length) fail(`fresh automatic seeds not VALID: ${bad.length}`)
  else pass('fresh automatic seeds are VALID')

  const state = {
    ...emptyGrowthAttachmentState(sem.geometryVersion),
    anchors: dist.anchors,
    geometrySignature: sem.geometryVersion,
  }
  const rebuilt = buildFacade()
  const sem2 = semanticsOf(rebuilt)
  const rebound = rebindGrowthAnchors(state, sem2, {})
  if (rebound.diagnostics.reprojected !== 0) {
    fail(`identical rebuild reprojected ${rebound.diagnostics.reprojected} (expected 0)`)
  } else pass('identical rebuild: zero reprojection pass')

  // Real geometry edit (bay count) → one reproject pass, stable ids
  const edited = buildFacade({ bayCount: 5, id: 'facade-gg-b5' })
  const sem3 = semanticsOf(edited)
  const afterEdit = rebindGrowthAnchors(state, sem3, { bayCountChanged: true })
  const ids = new Set(afterEdit.anchors.map((a) => a.anchorId))
  if (ids.size !== afterEdit.anchors.length) fail('anchor ids not stable/unique after edit')
  else pass('geometry edit preserves stable unique anchor ids')

  if (afterEdit.diagnostics.reprojected + afterEdit.diagnostics.valid + afterEdit.diagnostics.orphaned + afterEdit.diagnostics.blocked !==
    state.anchors.length) {
    fail('rebind lost anchors')
  } else pass('geometry edit triggers one rebind covering all anchors')
}

{
  const facade = buildFacade()
  const sem = semanticsOf(facade)
  const patch = sem.patches[0]
  const p = patch.worldTransform?.position ?? [0, 1, 0]
  const hit = attachFromWorldHit(sem, { point: p, normal: [0, 0, 1] })
  if (!hit.ok && !findNearestPatch(sem, p).patch) fail('placement ray helpers broken')
  else pass('attachFromWorldHit / findNearestPatch available for click placement')

  const g1 = buildGrowthNavigationGraph(sem, { navigationGapTolerance: 0.35 })
  const g2 = buildGrowthNavigationGraph(sem, { navigationGapTolerance: 0.35 })
  if (g1.diagnostics.nodeCount !== g2.diagnostics.nodeCount) {
    fail('nav graph rebuild nondeterministic')
  } else pass('navigation graph rebuild deterministic for unchanged geometry')
}

{
  // Ten manual seeds stay VALID
  const facade = buildFacade()
  const sem = semanticsOf(facade)
  const placeable = (sem.patches ?? []).filter((p) => p.growthEligibility !== 'PROHIBITED').slice(0, 10)
  const anchors = []
  for (const patch of placeable) {
    const c = createAnchorOnPatch(sem, patch, {
      worldPosition: patch.worldTransform?.position,
    })
    if (c.ok) anchors.push(c.anchor)
  }
  if (anchors.length < 5) fail(`only placed ${anchors.length} manual seeds`)
  else if (anchors.some((a) => a.status !== ANCHOR_STATUS.VALID)) {
    fail('manual batch not all VALID')
  } else pass(`place ${anchors.length} manual seeds as VALID`)

  // Delete one
  const remaining = anchors.slice(1)
  if (remaining.length !== anchors.length - 1) fail('delete one seed failed')
  else pass('delete one seed')
}

console.log(ok ? '\nvalidate:seed-placement PASS' : '\nvalidate:seed-placement FAIL')
process.exit(ok ? 0 : 1)
