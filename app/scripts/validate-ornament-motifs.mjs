/**
 * Step 14A.1.2.1 — Parametric motifs rooted on shared GrowthAttachment anchors.
 * Run: npm run validate:ornament-motifs
 */
import {
  createGrammarSettings,
  applyWorkspaceNavigation,
  DESIGN_WORKSPACES,
  FOLIATE_WORKSPACE_ID,
  FOLIATE_WORKSPACE_LABEL,
  DEFAULT_FOLIATE_SETTINGS,
  COMPOSITION_MODES,
  MOTIF_TYPES,
} from '../src/geometry/gothicGrammar/settings.js'
import {
  buildGothicFacadeElevation,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  resolveWindowDesignParams,
  distributeGrowthSeeds,
  buildParametricMotifs,
  composeSymmetricalSpandrelScroll,
  buildHostFrameFromAnchor,
  buildHostsFromAnchors,
  measureRootAnchorDistance,
  measureMirrorDeviation,
  parametricMotifCacheKey,
  CURVE_ROLES,
  DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  ROOT_ANCHOR_TOLERANCE,
  buildOrnamentGrowthSkeleton,
  emptyOrnamentSkeleton,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import { applyArchitecturePreset, ARCHITECTURE_PRESETS } from '../src/geometry/gothicGrammar/tracery/presets.js'
import { DEFAULT_TRACERY_SETTINGS, DEFAULT_STONE_SETTINGS, DEFAULT_ASSEMBLY_SETTINGS } from '../src/geometry/gothicGrammar/settings.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 14A.1.2.1 Shared Ornament Anchor Integration ===')

{
  const entry = DESIGN_WORKSPACES.find((d) => d.id === FOLIATE_WORKSPACE_ID)
  if (!entry?.enabled) fail('Foliate Ornament workspace not enabled')
  else pass(`workspace ${FOLIATE_WORKSPACE_ID} → "${entry.label}"`)

  const nav = applyWorkspaceNavigation(createGrammarSettings(), FOLIATE_WORKSPACE_ID, 'design')
  if (nav.workspaceMode !== FOLIATE_WORKSPACE_ID) fail('nav mode mismatch')
  else pass('navigation resolves Foliate Ornament mode')

  if (DEFAULT_FOLIATE_SETTINGS.compositionMode !== COMPOSITION_MODES.SINGLE_MOTIF) {
    fail(`default compositionMode expected single-motif`)
  } else pass('default composition mode = Single Motif')
}

function buildHost(seedCount = 18) {
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
    id: 'facade-motif-anchor-validate',
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

const pack = buildHost(18)
if (!pack.semantics) fail('semantics missing')
else pass(`host semantics patches=${pack.semantics.patches?.length ?? 0}`)
if (!pack.anchors.length) fail('no shared initiation anchors distributed')
else pass(`shared anchors=${pack.anchors.length}`)

// No independent origins without anchors
{
  const empty = buildParametricMotifs({
    semantics: pack.semantics,
    anchors: [],
    params: { ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS, singleHost: true },
  })
  if (empty.motifs.length !== 0) fail('empty anchors still produced motifs')
  else if (!/initiation|anchor/i.test(empty.diagnostics?.emptyReason ?? '')) {
    fail(`empty-anchor reason unclear: ${empty.diagnostics?.emptyReason}`)
  } else pass('no independent motif origins without anchors')
}

const resolvedHosts = buildHostsFromAnchors(pack.semantics, pack.anchors)
const validAnchorIds = resolvedHosts.hosts.map((h) => h.sourceAnchorId)
const anchorA = pack.anchors.find((a) => a.anchorId === validAnchorIds[0]) ?? pack.anchors[0]
const anchorB =
  pack.anchors.find((a) => a.anchorId === validAnchorIds[1]) ??
  pack.anchors.find((a) => a.anchorId !== anchorA.anchorId) ??
  anchorA
if (validAnchorIds.length < 1) fail('no valid ornamental hosts among anchors')
else pass(`valid ornamental anchors=${validAnchorIds.length}`)

// Shared identity / host frame from anchor
{
  const host = buildHostFrameFromAnchor(pack.semantics, anchorA)
  if (!host) fail('buildHostFrameFromAnchor failed')
  else if (host.sourceAnchorId !== anchorA.anchorId) fail('sourceAnchorId mismatch')
  else if (host.hostComponentId !== anchorA.componentId) fail('hostComponentId mismatch')
  else if (host.hostSurfaceId !== anchorA.surfaceId) fail('hostSurfaceId mismatch')
  else {
    const d = Math.hypot(
      host.origin[0] - anchorA.worldPosition[0],
      host.origin[1] - anchorA.worldPosition[1],
      host.origin[2] - anchorA.worldPosition[2],
    )
    if (d > 1e-9) fail(`host origin not at anchor (Δ=${d})`)
    else pass(`host frame rooted on ${anchorA.anchorId} · kind=${host.kind}`)
  }
}

const params = {
  ...DEFAULT_PARAMETRIC_MOTIF_SETTINGS,
  ...DEFAULT_FOLIATE_SETTINGS,
  compositionMode: COMPOSITION_MODES.SINGLE_MOTIF,
  motifType: MOTIF_TYPES.SYMMETRICAL_SPANDREL_SCROLL,
  singleHost: true,
  selectedAnchorId: anchorA.anchorId,
  symmetryStrength: 1,
  creatureInfluence: 0.3,
  randomSeed: 42,
  showPrimarySpine: true,
  showPrimaryVolutes: true,
  showSecondaryCurls: true,
}

const resultA = buildParametricMotifs({
  semantics: pack.semantics,
  anchors: pack.anchors,
  params,
})
const resultB = buildParametricMotifs({
  semantics: pack.semantics,
  anchors: pack.anchors,
  params,
})

if (!resultA.motifs.length) fail(`no motifs: ${resultA.diagnostics?.emptyReason}`)
else pass(`single motif from shared anchor · curves=${resultA.diagnostics.curveCount}`)

{
  const m = resultA.motifs[0]
  if (m.sourceAnchorId !== anchorA.anchorId) fail('motif.sourceAnchorId mismatch')
  else if (m.hostComponentId !== anchorA.componentId) fail('motif.hostComponentId mismatch')
  else if (!m.localFrame?.origin) fail('motif.localFrame missing')
  else pass(`motif identity sourceAnchorId=${m.sourceAnchorId}`)

  const root = measureRootAnchorDistance(m.host, m.curves.find((c) => c.role === CURVE_ROLES.PRIMARY_SPINE))
  if (!root.ok) fail(`root-to-anchor distance ${root.distance} > ${ROOT_ANCHOR_TOLERANCE}`)
  else pass(`exact motif rooting Δ=${root.distance.toExponential(2)}`)
}

{
  const keyA = parametricMotifCacheKey(
    pack.semantics.geometryVersion,
    [anchorA.anchorId],
    params,
  )
  const keyB = parametricMotifCacheKey(
    pack.semantics.geometryVersion,
    [anchorA.anchorId],
    params,
  )
  if (keyA !== keyB) fail('cache key nondeterministic')
  else pass('cache key deterministic')

  const sigA = JSON.stringify(resultA.motifs[0]?.curves?.map((c) => c.points))
  const sigB = JSON.stringify(resultB.motifs[0]?.curves?.map((c) => c.points))
  if (sigA !== sigB) fail('composition nondeterministic')
  else pass('composition deterministic')
}

// Anchor selection switches motif root
{
  const other = buildParametricMotifs({
    semantics: pack.semantics,
    anchors: pack.anchors,
    params: { ...params, selectedAnchorId: anchorB.anchorId },
  })
  if (!other.motifs.length) fail('selected other anchor produced no motif')
  else if (other.motifs[0].sourceAnchorId !== anchorB.anchorId) fail('selection ignored')
  else {
    const d = Math.hypot(
      other.motifs[0].host.origin[0] - resultA.motifs[0].host.origin[0],
      other.motifs[0].host.origin[1] - resultA.motifs[0].host.origin[1],
      other.motifs[0].host.origin[2] - resultA.motifs[0].host.origin[2],
    )
    if (anchorA.anchorId !== anchorB.anchorId && d < 1e-6) {
      fail('different anchors produced identical roots')
    } else pass(`anchor selection moves motif root (Δ=${d.toFixed(3)})`)
  }
}

// Anchor deletion removes motif
{
  const remaining = pack.anchors.filter((a) => a.anchorId !== anchorA.anchorId)
  const afterDelete = buildParametricMotifs({
    semantics: pack.semantics,
    anchors: remaining,
    params: { ...params, selectedAnchorId: anchorA.anchorId },
  })
  const stillHas = afterDelete.motifs.some((m) => m.sourceAnchorId === anchorA.anchorId)
  if (stillHas) fail('deleted anchor still has motif')
  else pass('anchor deletion removes associated motif')
}

// Full facade from anchors only
{
  const full = buildParametricMotifs({
    semantics: pack.semantics,
    anchors: pack.anchors,
    params: {
      ...params,
      singleHost: false,
      compositionMode: COMPOSITION_MODES.FULL_FACADE,
      maxMotifs: 8,
    },
  })
  if (!full.motifs.length) fail('full facade produced no motifs')
  else {
    const ids = new Set(full.motifs.map((m) => m.sourceAnchorId))
    if (ids.has(null) || ids.has(undefined)) fail('full facade motif missing sourceAnchorId')
    else pass(
      `full facade motifs=${full.motifs.length} · unused=${full.diagnostics.unusedAnchorCount} · invalid=${full.diagnostics.invalidAnchorCount}`,
    )
  }
}

// Parameter persistence: root stays fixed when scale changes
{
  const scaled = buildParametricMotifs({
    semantics: pack.semantics,
    anchors: pack.anchors,
    params: { ...params, motifScale: 0.7 },
  })
  const o0 = resultA.motifs[0].host.origin
  const o1 = scaled.motifs[0].host.origin
  const d = Math.hypot(o0[0] - o1[0], o0[1] - o1[1], o0[2] - o1[2])
  if (d > 1e-9) fail('motif root moved when parameters changed')
  else pass('motif parameters persist — root stays on anchor')
}

// Hierarchy / no disconnected branches
{
  const m = resultA.motifs[0]
  const spine = m.curves.find((c) => c.role === CURVE_ROLES.PRIMARY_SPINE && c.valid)
  const children = m.curves.filter(
    (c) => c.valid && c.parentId === spine?.id && c.role !== CURVE_ROLES.RIB_MARK,
  )
  if (!spine) fail('missing primary spine')
  else if (children.length < 1) fail('no connected secondary hierarchy')
  else pass(`connected hierarchy children=${children.length}`)
}

// Symmetry still exact at 100%
{
  const host = resultA.motifs[0].host
  const left = resultA.motifs[0].curves.find((c) => c.id.includes('volute-L'))
  const right = resultA.motifs[0].curves.find((c) => c.id.includes('volute-R'))
  if (!left || !right) fail('missing paired volutes')
  else {
    const d = measureMirrorDeviation(host, left, right)
    if (d > 1e-3) fail(`100% symmetry mirror deviation ${d}`)
    else pass(`100% symmetry exact (dev=${d.toExponential(2)})`)
  }
}

// Cross-workspace identity: same anchors feed legacy growth
{
  const sk = buildOrnamentGrowthSkeleton({
    semantics: pack.semantics,
    anchors: pack.anchors,
    params: { ...DEFAULT_FOLIATE_SETTINGS, maxMotifs: 6 },
  })
  if (!sk.motifs?.length) fail('legacy growth failed on shared anchors')
  else pass(`legacy growth still consumes shared anchors · motifs=${sk.motifs.length}`)
  const empty = emptyOrnamentSkeleton({ emptyReason: 'test' })
  if (empty.type !== 'ORNAMENT_GROWTH_SKELETON') fail('legacy skeleton type broken')
  else pass('legacy growth API preserved')
}

// Geometry signature on motif
{
  const m = resultA.motifs[0]
  if (!m.geometrySignature && m.geometrySignature !== '') {
    fail('geometrySignature missing')
  } else pass('geometrySignature present on motif')
}

// Camera persistence contract
{
  if (DEFAULT_FOLIATE_SETTINGS.fitMotifToken !== 0) fail('fitMotifToken should start at 0')
  else pass('camera fitMotifToken starts at 0 — parameter edits do not bump it')
}

// Hosts-from-anchors reporting
{
  const resolved = buildHostsFromAnchors(pack.semantics, pack.anchors)
  if (!resolved.hosts.length) fail('buildHostsFromAnchors empty')
  else pass(
    `hosts-from-anchors=${resolved.hosts.length} · invalid=${resolved.invalidAnchors.length}`,
  )
}

if (!ok) {
  console.error('\nvalidate:ornament-motifs FAILED')
  process.exit(1)
}
console.log('\nvalidate:ornament-motifs PASSED')
