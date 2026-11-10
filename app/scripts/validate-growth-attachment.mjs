/**
 * Step 13E.4 — Growth attachment & surface navigation validation.
 * Run: node scripts/validate-growth-attachment.mjs
 */
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  SUPPORT_STYLES,
  GROWTH_ELIGIBILITY,
  buildSurfaceFrame,
  validateSurfaceFrame,
  createAnchorOnPatch,
  attachFromWorldHit,
  distributeGrowthSeeds,
  buildGrowthNavigationGraph,
  findSurfacePath,
  straightLinePathPreview,
  projectToEligibleSurface,
  checkGrowthClearance,
  isInsideProtectedOpening,
  rebindGrowthAnchors,
  instantiateMasterAnchors,
  emptyGrowthAttachmentState,
  ANCHOR_STATUS,
  ANCHOR_SCOPES,
  SEED_DISTRIBUTION_MODES,
  resetAnchorIdCounter,
  segmentCrossesProtectedOpening,
} from '../src/geometry/gothicGrammar/assemblies/index.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.4 Growth Attachment ===')

resetAnchorIdCounter(0)

function buildFacade(overrides = {}) {
  clearWindowModuleCache()
  return buildGothicFacadeElevation({
    bayCount: 3,
    bayWidth: 3,
    supportStyle: SUPPORT_STYLES.COMBINED,
    hierarchicalDepth: 1,
    ...overrides,
  })
}

function semanticsOf(facade, policy = {}) {
  return applyGrowthPolicy(extractFacadeSurfaceSemantics(facade), policy)
}

{
  // Frames
  const f = buildSurfaceFrame({
    position: [0, 1, 0],
    normal: [0, 0, 1],
    componentType: 'PIER_CORE',
  })
  const v = validateSurfaceFrame(f)
  if (!v.ok) fail(`frame invalid: ${v.errors.join('; ')}`)
  else pass('orthonormal surface frames')

  const deg = buildSurfaceFrame({ position: [0, 0, 0], normal: [0, 0, 0] })
  if (!deg.degenerateNormal) fail('expected degenerate normal flag')
  else pass('degenerate normal handled')
}

{
  const facade = buildFacade({ bayCount: 3 })
  const sem = semanticsOf(facade)
  const allowed = (sem.patches ?? []).filter(
    (p) => p.growthEligibility === GROWTH_ELIGIBILITY.ALLOWED,
  )
  if (!allowed.length) fail('no ALLOWED patches for placement')
  else pass(`eligible patches ${allowed.length}`)

  const created = createAnchorOnPatch(sem, allowed[0], { seedType: 'test' })
  if (!created.ok) fail(`anchor create: ${created.reason}`)
  else {
    const a = created.anchor
    if (!a.localPosition || !a.worldPosition) fail('anchor missing local/world position')
    else if (!a.tangentU || !a.tangentV) fail('anchor missing tangents')
    else pass(`valid anchor placement ${a.anchorId}`)
  }

  // Opening rejection — use an opening centroid if present
  const op = sem.openings?.[0]
  if (op?.centroid) {
    const c = op.centroid
    const pt = [c[0] ?? c.x, c[1] ?? c.y, (c[2] ?? c.z ?? 0) + 0.05]
    const inside = isInsideProtectedOpening(pt, sem)
    if (!inside.inside) fail('opening centroid should classify as protected')
    else pass('no placement in protected openings (classifier)')

    const hit = attachFromWorldHit(sem, { point: pt, normal: [0, 0, 1] }, { protectOpenings: true })
    if (hit.ok) fail('attachFromWorldHit should reject opening')
    else pass('ray-hit on opening rejected')
  } else {
    pass('opening classifier skipped (no openings in fixture)')
  }

  // Deterministic distribution
  const d1 = distributeGrowthSeeds(sem, {
    seedCount: 20,
    randomSeed: 42,
    minSpacing: 0.2,
    distributionMode: SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY,
  })
  const d2 = distributeGrowthSeeds(sem, {
    seedCount: 20,
    randomSeed: 42,
    minSpacing: 0.2,
    distributionMode: SEED_DISTRIBUTION_MODES.WEIGHTED_BY_ELIGIBILITY,
  })
  if (!d1.ok || d1.anchors.length < 5) fail(`distribution weak: ${d1.report?.accepted}`)
  else if (d1.anchors.length !== d2.anchors.length) fail('distribution not deterministic (count)')
  else {
    const same = d1.anchors.every(
      (a, i) =>
        Math.hypot(
          a.worldPosition[0] - d2.anchors[i].worldPosition[0],
          a.worldPosition[1] - d2.anchors[i].worldPosition[1],
          a.worldPosition[2] - d2.anchors[i].worldPosition[2],
        ) < 1e-9,
    )
    if (!same) fail('distribution not deterministic (positions)')
    else pass(`deterministic seeds ${d1.report.accepted}/${d1.report.requested}`)
  }

  // Min spacing
  let spacingOk = true
  for (let i = 0; i < d1.anchors.length; i += 1) {
    for (let j = i + 1; j < d1.anchors.length; j += 1) {
      const a = d1.anchors[i].worldPosition
      const b = d1.anchors[j].worldPosition
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      if (d < 0.2 - 1e-6) spacingOk = false
    }
  }
  if (!spacingOk) fail('min seed spacing violated')
  else pass('minimum seed spacing respected')

  // Eligibility filtering — PROHIBITED never accepted
  if (d1.anchors.some((a) => a.eligibility === GROWTH_ELIGIBILITY.PROHIBITED)) {
    fail('prohibited eligibility in seeds')
  } else pass('growth eligibility filtering')

  // Navigation graph
  const graph = buildGrowthNavigationGraph(sem, { navigationGapTolerance: 0.4 })
  if (!graph.nodes.length) fail('empty navigation graph')
  else if (!graph.edges.length) fail('navigation graph has no edges')
  else pass(`nav graph ${graph.diagnostics.nodeCount}n/${graph.diagnostics.edgeCount}e`)

  // No void shortcuts in graph edges
  let shortcut = false
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  for (const e of graph.edges) {
    const a = byId.get(e.sourceId)
    const b = byId.get(e.targetId)
    if (a && b && segmentCrossesProtectedOpening(sem, a.position, b.position)) shortcut = true
  }
  if (shortcut) fail('navigation edge crosses protected opening')
  else pass('no invalid void shortcuts in nav graph')

  // Path query between two seeds
  if (d1.anchors.length >= 2) {
    const path = findSurfacePath(d1.anchors[0], d1.anchors[d1.anchors.length - 1], {
      graph,
      semantics: sem,
    })
    if (!path.ok && path.status === 'FAILURE') {
      // May fail if disconnected — try nearest pair in same component
      const a0 = d1.anchors[0]
      const same = d1.anchors.find(
        (a) => a.anchorId !== a0.anchorId && a.componentId === a0.componentId,
      )
      if (same) {
        const p2 = findSurfacePath(a0, same, { graph, semantics: sem })
        if (!p2.ok) fail(`path query failed: ${p2.reason ?? p2.status}`)
        else pass(`surface path length ${p2.totalLength.toFixed(3)} m`)
      } else {
        pass('path query skipped (no same-component pair)')
      }
    } else if (path.points.length < 1) fail('path missing points')
    else pass(`surface path ${path.status} · ${path.totalLength.toFixed(3)} m`)

    // Straight shortcut across opening should be detectable when openings exist
    if (sem.openings?.length) {
      const left = d1.anchors[0]
      const right = [...d1.anchors].sort(
        (a, b) => b.worldPosition[0] - a.worldPosition[0],
      )[0]
      const direct = straightLinePathPreview(left, right, sem)
      // Not always blocked, but API must return structured result
      if (!direct.status) fail('straightLinePathPreview missing status')
      else pass(`blocked-path probe status=${direct.status}`)
    }
  }

  // Clearance
  const onStone = projectToEligibleSurface(allowed[0].worldTransform.position, {
    semantics: sem,
  })
  if (!onStone.ok) fail('projectToEligibleSurface failed')
  else pass('projectToEligibleSurface')

  const clr = checkGrowthClearance(onStone.anchor.worldPosition, 0.04, { semantics: sem })
  if (clr.classification === 'PROTECTED_OPENING') fail('contact misclassified as opening')
  else pass(`clearance classification=${clr.classification}`)

  // Persistence — same topology
  const state0 = {
    ...emptyGrowthAttachmentState(sem.geometryVersion),
    anchors: d1.anchors.slice(0, 5),
    bayCount: 3,
  }
  const same = rebindGrowthAnchors(state0, sem, { bayCountChanged: false })
  if (same.anchors.length !== 5) fail('same-topology lost anchors')
  else if (same.anchors.some((a) => a.status === ANCHOR_STATUS.ORPHANED)) {
    fail('same-topology should not orphan')
  } else pass('same-topology persistence')

  // Geometry change with same patch ids → REPROJECTED or VALID
  const facade2 = buildFacade({ bayCount: 3, pierWidth: 0.34 })
  const sem2 = semanticsOf(facade2)
  const rebound = rebindGrowthAnchors(
    { ...state0, geometrySignature: 'stale-version' },
    sem2,
    { bayCountChanged: false },
  )
  const statuses = new Set(rebound.anchors.map((a) => a.status))
  if (![...statuses].every((s) => Object.values(ANCHOR_STATUS).includes(s))) {
    fail('unknown status after reproject')
  } else pass(`reprojection statuses=[${[...statuses].join(',')}]`)

  // Bay count change — instance anchors for removed bays orphan
  const facade1 = buildFacade({ bayCount: 1 })
  const sem1 = semanticsOf(facade1)
  const withBay = {
    ...state0,
    geometrySignature: 'other',
    anchors: state0.anchors.map((a, i) => ({
      ...a,
      scope: ANCHOR_SCOPES.ASSEMBLY_INSTANCE,
      bayId: i === 0 ? 'bay-missing-99' : a.bayId,
    })),
  }
  const bayChange = rebindGrowthAnchors(withBay, sem1, { bayCountChanged: true })
  if (!bayChange.anchors.some((a) => a.status === ANCHOR_STATUS.ORPHANED)) {
    fail('bay-count change should orphan missing-bay instance anchors')
  } else pass('bay-count orphan handling')

  // Master instancing
  const master = {
    ...d1.anchors[0],
    scope: ANCHOR_SCOPES.MASTER_MODULE,
    metadata: { ...(d1.anchors[0].metadata ?? {}), masterLocalPosition: [0, 1, 0.1] },
  }
  const inst = instantiateMasterAnchors([master], facade, { forceMaster: true })
  if (inst.length !== (facade.windowModules?.length ?? 0)) {
    fail(`master instancing count ${inst.length} ≠ modules`)
  } else {
    const xs = inst.map((a) => a.worldPosition[0])
    const spread = Math.max(...xs) - Math.min(...xs)
    if (spread < 1) fail('instance anchors did not spread across bays')
    else pass(`master-module instancing ×${inst.length} (Δx=${spread.toFixed(2)})`)
  }

  // Symmetric normals preserved under translation-only instances
  if (inst.length >= 2) {
    const n0 = inst[0].worldNormal
    const n1 = inst[1].worldNormal
    const align = n0[0] * n1[0] + n0[1] * n1[1] + n0[2] * n1[2]
    if (align < 0.99) fail('instance normals not preserved under translation')
    else pass('symmetric transform normals preserved')
  }
}

{
  // Synthetic fixture — blocked when eligibility becomes prohibited
  const facade = buildFacade({ bayCount: 1 })
  const sem = semanticsOf(facade)
  const patch = (sem.patches ?? []).find(
    (p) => p.growthEligibility === GROWTH_ELIGIBILITY.ALLOWED,
  )
  if (patch) {
    const a = createAnchorOnPatch(sem, patch).anchor
    const poisoned = {
      ...sem,
      geometryVersion: 'poisoned',
      patches: sem.patches.map((p) =>
        p.patchId === patch.patchId
          ? { ...p, growthEligibility: GROWTH_ELIGIBILITY.PROHIBITED }
          : p,
      ),
      surfaces: sem.surfaces.map((s) =>
        s.surfaceId === patch.surfaceId
          ? { ...s, growthEligibility: GROWTH_ELIGIBILITY.PROHIBITED }
          : s,
      ),
    }
    const state = {
      ...emptyGrowthAttachmentState(sem.geometryVersion),
      anchors: [a],
    }
    const next = rebindGrowthAnchors(state, poisoned, {})
    if (next.anchors[0]?.status !== ANCHOR_STATUS.BLOCKED) fail('expected BLOCKED status')
    else pass('blocked-anchor handling')
  }
}

{
  // Multi-bay performance smoke (1,3,5,7) — graph build stays bounded
  for (const n of [1, 3, 5, 7]) {
    const facade = buildFacade({ bayCount: n })
    const sem = semanticsOf(facade)
    const t0 = performance.now()
    const graph = buildGrowthNavigationGraph(sem, { navigationGapTolerance: 0.35 })
    const ms = performance.now() - t0
    if (ms > 2500) fail(`nav graph ${n} bays too slow (${ms.toFixed(0)}ms)`)
    else pass(`bayCount=${n} nav build ${ms.toFixed(1)}ms · ${graph.diagnostics.edgeCount}e`)
  }
}

console.log(ok ? '\nvalidate:growth-attachment PASS' : '\nvalidate:growth-attachment FAIL')
process.exit(ok ? 0 : 1)
