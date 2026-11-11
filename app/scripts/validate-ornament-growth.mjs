/**
 * Step 14A.1.1 — Ornamental growth motif grammar validation.
 * Run: npm run validate:ornament-growth
 */
import {
  createGrammarSettings,
  applyWorkspaceNavigation,
  DESIGN_WORKSPACES,
  FOLIATE_WORKSPACE_ID,
  FOLIATE_WORKSPACE_LABEL,
  DEFAULT_FOLIATE_SETTINGS,
} from '../src/geometry/gothicGrammar/settings.js'
import {
  buildGothicFacadeElevation,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  resolveWindowDesignParams,
  distributeGrowthSeeds,
  buildOrnamentGrowthSkeleton,
  revealOrnamentSkeleton,
  validateOrnamentSkeleton,
  ornamentGrowthCacheKey,
  groupAnchorsIntoMotifHosts,
  skeletonMeanCurvature,
  BRANCH_ROLES,
  MOTIF_KINDS,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import { applyArchitecturePreset, ARCHITECTURE_PRESETS } from '../src/geometry/gothicGrammar/tracery/presets.js'
import { DEFAULT_TRACERY_SETTINGS, DEFAULT_STONE_SETTINGS, DEFAULT_ASSEMBLY_SETTINGS } from '../src/geometry/gothicGrammar/settings.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 14A.1.1 Ornament Growth Motif Grammar ===')

{
  const entry = DESIGN_WORKSPACES.find((d) => d.id === FOLIATE_WORKSPACE_ID)
  if (!entry?.enabled) fail('Foliate Ornament workspace not enabled')
  else if (entry.label !== FOLIATE_WORKSPACE_LABEL) fail('label mismatch')
  else pass(`workspace ${FOLIATE_WORKSPACE_ID} → "${entry.label}"`)

  const nav = applyWorkspaceNavigation(createGrammarSettings(), FOLIATE_WORKSPACE_ID, 'design')
  if (nav.workspaceMode !== FOLIATE_WORKSPACE_ID) fail('nav mode mismatch')
  else pass('navigation resolves Foliate Ornament mode')
}

function buildHost(seedCount = 24) {
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
    { ...DEFAULT_TRACERY_SETTINGS },
    { ...DEFAULT_STONE_SETTINGS },
  )
  const settings = createGrammarSettings({
    tracery: applied.tracery,
    stone: applied.stone,
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS, bayCount: 3 },
    foliate: { ...DEFAULT_FOLIATE_SETTINGS },
  })
  const design = resolveWindowDesignParams(settings)
  const facade = buildGothicFacadeElevation({
    ...settings.assembly,
    id: 'facade-ornament-validate',
    windowDesign: { tracery: design.tracery, stone: design.stone },
    tracery: design.tracery,
    stone: design.stone,
    windowLinkMode: 'linked-to-master',
  })
  const base = extractFacadeSurfaceSemantics(facade, DEFAULT_GROWTH_POLICY)
  const semantics = applyGrowthPolicy(base, DEFAULT_GROWTH_POLICY)
  const seeds = distributeGrowthSeeds(semantics, {
    seedCount,
    randomSeed: 42,
    minSpacing: 0.16,
    distributionMode: 'FEATURE_BASED',
    allowRestricted: true,
    preferVertical: true,
    preferJunctions: true,
  })
  return { settings, facade, semantics, anchors: seeds.anchors }
}

const host = buildHost(24)
if (!host.semantics) fail('semantics missing')
else pass(`host semantics patches=${host.semantics.patches?.length ?? 0}`)
if (!host.anchors.length) fail('no initiation anchors distributed')
else pass(`initiation anchors=${host.anchors.length}`)

const params = {
  ...DEFAULT_FOLIATE_SETTINGS,
  growthProgress: 1,
  growthLength: 1.0,
  branchDensity: 0.6,
  curlStrength: 0.55,
  symmetryStrength: 0.8,
  creatureInfluence: 0.3,
  randomSeed: 42,
  maxBranchDepth: 3,
  maxMotifs: 10,
}

const grouped = groupAnchorsIntoMotifHosts(host.semantics, host.anchors, params)
{
  if (!grouped.hosts.length) fail('motif host grouping produced zero hosts')
  else {
    const kinds = Object.fromEntries(
      Object.values(MOTIF_KINDS).map((k) => [k, grouped.hosts.filter((h) => h.kind === k).length]),
    )
    pass(
      `motif hosts=${grouped.hosts.length} · rejected=${grouped.rejectedAnchors.length} · unused=${grouped.unusedAnchorIds.length} · kinds=${JSON.stringify(kinds)}`,
    )
  }
}

const skA = buildOrnamentGrowthSkeleton({
  semantics: host.semantics,
  anchors: host.anchors,
  params,
})
const skB = buildOrnamentGrowthSkeleton({
  semantics: host.semantics,
  anchors: host.anchors,
  params,
})

{
  const v = validateOrnamentSkeleton(skA)
  if (!v.ok) fail(`skeleton invalid: ${v.errors.join('; ')}`)
  else {
    pass(
      `skeleton valid · motifs=${skA.motifs?.length ?? 0} · nodes=${skA.nodes.length} · branches=${skA.branches.length} · meanTurn=${(v.meanTurn ?? 0).toFixed(3)}`,
    )
  }
  if ((skA.motifs?.length ?? 0) < 1) fail('expected at least one motif')
  else pass(`motif generation count=${skA.motifs.length}`)
}

{
  const idsA = skA.nodes.map((n) => n.id).join('|')
  const idsB = skB.nodes.map((n) => n.id).join('|')
  if (idsA !== idsB) fail('non-deterministic node ids')
  else pass('deterministic output for fixed seed')

  const posA = skA.nodes.map((n) => n.position.join(',')).join(';')
  const posB = skB.nodes.map((n) => n.position.join(',')).join(';')
  if (posA !== posB) fail('non-deterministic positions')
  else pass('stable positions')
}

{
  const parentOk = skA.nodes.every((n) => !n.parentId || skA.nodes.some((p) => p.id === n.parentId))
  if (!parentOk) fail('broken parent relationships')
  else pass('parent relationships valid')
}

{
  const r0 = revealOrnamentSkeleton(skA, 0)
  const r25 = revealOrnamentSkeleton(skA, 0.25)
  const r50 = revealOrnamentSkeleton(skA, 0.5)
  const r100 = revealOrnamentSkeleton(skA, 1)
  if (r0.nodes.length < 1) fail('0% should keep initiation')
  if (!(r25.nodes.length <= r50.nodes.length && r50.nodes.length <= r100.nodes.length)) {
    fail('progress reveal not monotonic')
  } else {
    pass(
      `progress reveal 0/25/50/100 = ${r0.nodes.length}/${r25.nodes.length}/${r50.nodes.length}/${r100.nodes.length}`,
    )
  }
  const key1 = ornamentGrowthCacheKey(
    host.semantics.geometryVersion,
    host.anchors.map((a) => a.anchorId),
    params,
  )
  const key2 = ornamentGrowthCacheKey(
    host.semantics.geometryVersion,
    host.anchors.map((a) => a.anchorId),
    { ...params, growthProgress: 0.2 },
  )
  if (key1 !== key2) fail('cache key must ignore growthProgress')
  else pass('cache key ignores growth progress')
}

{
  const sym = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, symmetryStrength: 1, randomSeed: 7 },
  })
  const asym = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, symmetryStrength: 0, randomSeed: 7 },
  })
  const mSym = sym.branches.filter((b) => b.role === BRANCH_ROLES.MIRROR).length
  const mAsym = asym.branches.filter((b) => b.role === BRANCH_ROLES.MIRROR).length
  if (mAsym !== 0) fail(`symmetry 0% should have 0 mirrors, got ${mAsym}`)
  if (mSym < 1) fail('symmetry 100% should produce motif mirrors')
  else pass(`local symmetry mirrors: 100%=${mSym} · 0%=${mAsym}`)
}

{
  const lowCurl = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, curlStrength: 0.05, symmetryStrength: 0, randomSeed: 11 },
  })
  const highCurl = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, curlStrength: 0.95, symmetryStrength: 0, randomSeed: 11 },
  })
  const cLow = skeletonMeanCurvature(lowCurl)
  const cHigh = skeletonMeanCurvature(highCurl)
  if (!(cHigh > cLow * 1.05 || cHigh > cLow + 0.02)) {
    fail(`curl strength not visible in curvature (${cLow.toFixed(4)} → ${cHigh.toFixed(4)})`)
  } else pass(`visible curl strength effect (${cLow.toFixed(4)} → ${cHigh.toFixed(4)})`)
}

{
  const lowDen = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, branchDensity: 0.05, symmetryStrength: 0, randomSeed: 11 },
  })
  const highDen = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, branchDensity: 0.95, symmetryStrength: 0, randomSeed: 11 },
  })
  const secLow = lowDen.branches.filter((b) => b.role === BRANCH_ROLES.SECONDARY).length
  const secHigh = highDen.branches.filter((b) => b.role === BRANCH_ROLES.SECONDARY).length
  if (!(secHigh > secLow)) {
    fail(`branch density not visible (${secLow} → ${secHigh} secondary)`)
  } else pass(`visible branch density effect (${secLow} → ${secHigh} secondary)`)
}

{
  const low = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, creatureInfluence: 0, randomSeed: 99, symmetryStrength: 0 },
  })
  const high = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, creatureInfluence: 0.9, randomSeed: 99, symmetryStrength: 0 },
  })
  const curvLow = low.branches.reduce((s, b) => s + (b.curvature ?? 0), 0)
  const curvHigh = high.branches.reduce((s, b) => s + (b.curvature ?? 0), 0)
  if (low.nodes.length === high.nodes.length && Math.abs(curvLow - curvHigh) < 1e-9) {
    fail('creature influence produced identical skeleton')
  } else pass(`creature influence varies structure (${low.nodes.length}→${high.nodes.length} nodes)`)
}

{
  const seedA = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, randomSeed: 1, symmetryStrength: 0 },
  })
  const seedB = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params: { ...params, randomSeed: 2, symmetryStrength: 0 },
  })
  const pa = seedA.nodes.map((n) => n.position.join(',')).join(';')
  const pb = seedB.nodes.map((n) => n.position.join(',')).join(';')
  if (pa === pb && seedA.nodes.length > host.anchors.length + 2) {
    fail('different seeds should vary grown skeleton')
  } else pass('random seed changes variation')
}

{
  const empty = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: [],
    params,
  })
  if (!empty.diagnostics?.emptyReason) fail('empty anchors should report emptyReason')
  else pass('graceful empty initiation state')
}

{
  const grown = skA.nodes.filter((n) => n.valid && n.accepted !== false && n.role !== BRANCH_ROLES.INITIATION)
  const attached = grown.filter((n) => n.surfaceAttachment?.patchId)
  if (grown.length && attached.length < grown.length) {
    fail(`unattached accepted nodes (${attached.length}/${grown.length})`)
  } else pass(`surface attachment on grown nodes (${attached.length}/${grown.length || 0})`)

  if ((skA.diagnostics?.acceptedInvalidCount ?? 0) !== 0) {
    fail(`accepted invalid segments=${skA.diagnostics.acceptedInvalidCount}`)
  } else pass('no invalid accepted segments')

  const floating = grown.filter((n) => (n.surfaceAttachment?.distance ?? 0) > 0.15)
  if (floating.length) fail(`floating segments distance>${floating.length}`)
  else pass('no floating accepted segments (>0.15m)')

  pass(
    `rejected(debug)=${skA.rejectedSegments?.length ?? 0} · terminations=${JSON.stringify(skA.diagnostics?.terminationCounts ?? {})}`,
  )
  pass(
    `anchors accepted=${skA.diagnostics?.anchorsAccepted} rejected=${skA.diagnostics?.anchorsRejected} unused=${skA.diagnostics?.anchorsUnused} zeroGrowth=${skA.diagnostics?.anchorsZeroGrowth}`,
  )
}

{
  // Recursive branching present
  const depths = new Set((skA.branches ?? []).map((b) => b.depth))
  if (![...depths].some((d) => d >= 1)) fail('expected recursive secondary branching')
  else pass(`recursive branching depths=[${[...depths].sort().join(',')}]`)
}

{
  const ids = new Set(host.anchors.map((a) => a.anchorId))
  if (ids.size !== host.anchors.length) fail('duplicate anchors')
  else pass('no duplicate anchors')
}

{
  // Headless parity probe: same inputs → identical cache key + node count
  const again = buildOrnamentGrowthSkeleton({
    semantics: host.semantics,
    anchors: host.anchors,
    params,
  })
  if (again.diagnostics.cacheKey !== skA.diagnostics.cacheKey) fail('cache key parity mismatch')
  if (again.nodes.length !== skA.nodes.length) fail('headless rebuild node parity mismatch')
  else pass(`headless parity nodes=${again.nodes.length} key-stable`)
}

if (!ok) {
  console.error('\nvalidate:ornament-growth FAILED')
  process.exit(1)
}
console.log('\nvalidate:ornament-growth PASSED')
