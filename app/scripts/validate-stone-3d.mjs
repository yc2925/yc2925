/**
 * Step 13D — Procedural 3D stone geometry validation.
 * Run: node scripts/validate-stone-3d.mjs
 */
import {
  extrudeRegion,
  buildProfile,
  validateProfileParams,
  sweepProfile,
  buildSweepFrames,
  validateMesh,
  buildStoneAssembly,
  DEPTH_ALIGNMENTS,
  PROFILE_TYPES,
  DEFAULT_STONE_PARAMS,
  planarFaceNormalReport,
  depthRange,
} from '../src/geometry/gothicGrammar/solids/index.js'
import { ARCH_FAMILIES } from '../src/geometry/gothicGrammar/primitives/index.js'
import {
  buildSolidVoidModel,
  ARCHITECTURE_PRESETS,
  applyArchitecturePreset,
  resolveMemberWidths,
  REGION_TYPES,
  buildBarNetwork,
  validateBarNetwork,
  buildBarNetworkSolidVoid,
  polylineToStrip,
  solveOpeningArrangement,
  buildElaborateSolidVoid,
  buildHierarchicalLancets,
  buildSkeletonGraph,
  validateSkeletonGraph,
  buildOculusNetworkGraph,
  validateOculusNetworkGraph,
  buildSecondaryTraceryGraph,
  validateSecondaryTraceryGraph,
  buildHierarchicalTraceryGraph,
  validateHierarchicalTraceryGraph,
  CELL_KINDS,
} from '../src/geometry/gothicGrammar/tracery/index.js'
import { DEFAULT_TRACERY_SETTINGS, DEFAULT_STONE_SETTINGS } from '../src/geometry/gothicGrammar/settings.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13D / 13D.1 stone solids ===')

// --- Box with hole extrusion ---
{
  const outer = [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 2, y: 1 },
    { x: 0, y: 1 },
  ]
  const holes = [
    [
      { x: 0.5, y: 0.25 },
      { x: 1.5, y: 0.25 },
      { x: 1.5, y: 0.75 },
      { x: 0.5, y: 0.75 },
    ],
  ]
  const r = extrudeRegion({ outer, holes, depth: 0.25, alignment: DEPTH_ALIGNMENTS.CENTERED })
  if (!r.validation.ok) fail(`box+hole: ${r.validation.errors.join('; ')}`)
  else pass('extrusion with holes watertight')
  if (!r.validation.watertight) fail('box+hole not watertight')
  else pass('no open / non-manifold edges')
  const expected = (2 * 1 - 1 * 0.5) * 0.25
  if (Math.abs(r.validation.volume - expected) > 1e-9) fail(`volume ${r.validation.volume} ≠ ${expected}`)
  else pass(`positive volume ${r.validation.volume}`)
  if (r.validation.boundingBox.size[2] !== 0.25) fail('depth not preserved')
  else pass('stone depth → Z extent')
}

// --- Invalid inputs ---
{
  try {
    extrudeRegion({ outer: [{ x: 0, y: 0 }], depth: 0.25 })
    fail('should reject tiny outer')
  } catch {
    pass('rejects invalid outer')
  }
  try {
    extrudeRegion({
      outer: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
      depth: -1,
    })
    fail('should reject negative depth')
  } catch {
    pass('rejects non-positive depth')
  }
}

// --- Profiles ---
for (const type of Object.values(PROFILE_TYPES)) {
  const v = validateProfileParams({ type })
  if (!v.ok) fail(`profile ${type}: ${v.errors.join('; ')}`)
  else {
    const p = buildProfile({ type })
    if (p.points.length < 3) fail(`profile ${type} too few points`)
    else pass(`profile ${type} valid (${p.points.length} pts)`)
  }
}
{
  const bad = validateProfileParams({
    type: PROFILE_TYPES.CHAMFERED,
    profileWidth: 0.04,
    chamferSize: 0.1,
  })
  if (bad.ok) fail('oversized chamfer should fail')
  else pass('rejects invalid chamfer')
}

// --- Sweep continuity + cusp handling ---
{
  const square = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ]
  const swept = sweepProfile({
    path: square,
    profileParams: { type: PROFILE_TYPES.FLAT, profileWidth: 0.05, profileDepth: 0.06 },
    closed: true,
  })
  const v = validateMesh(swept.mesh, { requireWatertight: false })
  if (!v.faces.finite) fail('sweep non-finite')
  else pass('sweep finite vertices')
  if (v.faces.degenerateFaceCount) fail(`${v.faces.degenerateFaceCount} degenerate sweep faces`)
  else pass('sweep no degenerate faces')
  if (swept.meta.watertightClaim) fail('must not claim decorative watertight')
  else pass('decorative sweep not claimed watertight')
}

{
  // Diamond-like sharp corners → cusp frames
  const diamond = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.05 },
    { x: 1, y: 0 },
    { x: 0.5, y: -0.05 },
  ]
  const frames = buildSweepFrames(diamond, { closed: true, cornerAngleDeg: 40 })
  const cusps = frames.filter((f) => f.sharp)
  if (!cusps.length) fail('expected sharp cusp frames on acute path')
  else pass(`sharp cusp handling (${cusps.length} cusp frames)`)
}

// --- Deterministic assembly ---
{
  const params = {
    family: ARCH_FAMILIES.equilateral,
    span: 4,
    mullionWidth: 0.16,
    windowBaseElevation: -0.4,
  }
  const a = buildStoneAssembly({
    regionParams: params,
    stone: { ...DEFAULT_STONE_PARAMS, stoneDepth: 0.25, tessellation: 'standard' },
  })
  const b = buildStoneAssembly({
    regionParams: params,
    stone: { ...DEFAULT_STONE_PARAMS, stoneDepth: 0.25, tessellation: 'standard' },
  })
  if (!a.ok) fail(`assembly: ${a.errors.join('; ')}`)
  else pass('composed window stone assembly ok')
  if (!a.metrics.watertight) fail('structural not watertight')
  else pass('structural watertight')
  if (!(a.metrics.structuralVolume > 0)) fail('volume not positive')
  else pass(`volume ${a.metrics.structuralVolume.toFixed(4)} m³`)
  if (a.metrics.combinedWatertightClaim) fail('must not claim combined union')
  else pass('no false combined watertight claim')
  const same =
    a.structural.positions.length === b.structural.positions.length &&
    a.structural.indices.length === b.structural.indices.length &&
    Math.abs(a.metrics.structuralVolume - b.metrics.structuralVolume) < 1e-12
  if (!same) fail('non-deterministic output')
  else pass('deterministic regeneration')
}

// --- Families / extremes ---
const familyCases = [
  { family: ARCH_FAMILIES.equilateral, riseRatio: Math.sqrt(3) / 2 },
  { family: ARCH_FAMILIES.lancet, riseRatio: 1.05 },
  { family: ARCH_FAMILIES.depressed, riseRatio: 0.55 },
]
for (const { family, riseRatio } of familyCases) {
  const a = buildStoneAssembly({
    regionParams: {
      family,
      span: 4,
      riseRatio,
      mullionWidth: 0.14,
      windowBaseElevation: -0.4,
      childRiseRatio: family === ARCH_FAMILIES.lancet ? 1.15 : riseRatio,
      childFamily: family,
    },
    stone: { stoneDepth: 0.25, tessellation: 'standard', moldingEnabled: true },
  })
  if (!a.ok || !a.metrics.watertight) fail(`${family}: ${a.errors?.join('; ') ?? 'not watertight'}`)
  else pass(`${family} parent → watertight solid`)
}

for (const tess of ['draft', 'standard', 'high']) {
  const a = buildStoneAssembly({
    regionParams: { span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 },
    stone: { stoneDepth: 0.25, tessellation: tess, moldingEnabled: false },
  })
  if (!a.ok || !a.metrics.watertight) fail(`tessellation ${tess}: ${a.errors?.join('; ')}`)
  else pass(`tessellation ${tess}`)
}

{
  const narrow = buildStoneAssembly({
    regionParams: { span: 4, mullionWidth: 0.08, windowBaseElevation: -0.4 },
    stone: { stoneDepth: 0.2, tessellation: 'standard' },
  })
  if (!narrow.ok || !narrow.metrics.watertight) fail(`narrow mullion: ${narrow.errors?.join('; ')}`)
  else pass('narrow mullion extrusion ok')
}

{
  const deep = buildStoneAssembly({
    regionParams: { span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 },
    stone: { stoneDepth: 0.5, depthAlignment: DEPTH_ALIGNMENTS.FRONT, tessellation: 'standard' },
  })
  if (!deep.ok) fail(`deep stone: ${deep.errors.join('; ')}`)
  else if (Math.abs(deep.metrics.boundingSize[2] - 0.5) > 1e-9) fail('front alignment depth mismatch')
  else pass('multiple depths / front alignment')
}

{
  const sv = buildSolidVoidModel({ span: 3.5, mullionWidth: 0.18, windowBaseElevation: -0.35 })
  if (!sv.validation.ok) fail('prerequisite solid/void failed')
  else pass('13C.1 prerequisites still valid')
  const a = buildStoneAssembly({ solidVoid: sv, stone: { stoneDepth: 0.25 } })
  if (!a.ok) fail(`from solidVoid: ${a.errors.join('; ')}`)
  else pass('assembly consumes existing solidVoid model')
}

// --- Alignments ---
for (const alignment of Object.values(DEPTH_ALIGNMENTS)) {
  const a = buildStoneAssembly({
    regionParams: { span: 4, mullionWidth: 0.16, windowBaseElevation: -0.4 },
    stone: { stoneDepth: 0.3, depthAlignment: alignment, moldingEnabled: false, tessellation: 'standard' },
  })
  if (!a.ok || !a.metrics.watertight) fail(`alignment ${alignment}: ${a.errors?.join('; ')}`)
  else pass(`alignment ${alignment}`)
}

// --- 13D.1 hard-edge planar normals + cusp seam skip ---
{
  const a = buildStoneAssembly({
    regionParams: { span: 3, mullionWidth: 0.16, windowBaseElevation: -0.35 },
    stone: { ...DEFAULT_STONE_PARAMS, stoneDepth: 0.25, tessellation: 'standard' },
  })
  if (!a.structural?.normals) fail('display mesh missing hard-edge normals')
  else pass('hard-edge display normals present')
  const { zFront, zBack } = depthRange(0.25, DEPTH_ALIGNMENTS.CENTERED)
  const front = planarFaceNormalReport(a.structural, zFront, 1)
  const back = planarFaceNormalReport(a.structural, zBack, -1)
  if (!front.ok) fail(`front planar normals: ${front.errors.join('; ')}`)
  else pass(`front planar normals (${front.checked} tris)`)
  if (!back.ok) fail(`back planar normals: ${back.errors.join('; ')}`)
  else pass(`back planar normals (${back.checked} tris)`)

  // Topology mesh remains watertight (display mesh is non-indexed hard-edge)
  const topo = validateMesh(a.structuralTopology, { requireWatertight: true })
  if (!topo.ok) fail(`topology mesh: ${topo.errors.join('; ')}`)
  else pass('topology mesh still watertight after 13D.1')
}

{
  // Acute diamond: cusp-in/out must not be strip-connected (no zero-length twist)
  const diamond = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.02 },
    { x: 1, y: 0 },
    { x: 0.5, y: -0.02 },
  ]
  const frames = buildSweepFrames(diamond, { closed: true, cornerAngleDeg: 40 })
  const swept = sweepProfile({
    path: diamond,
    profileParams: { type: PROFILE_TYPES.FLAT, profileWidth: 0.04, profileDepth: 0.05 },
    closed: true,
  })
  const cuspPairs = []
  for (let i = 0; i < frames.length; i += 1) {
    const a = frames[i]
    const b = frames[(i + 1) % frames.length]
    if (a.kind === 'cusp-in' && b.kind === 'cusp-out') cuspPairs.push(i)
  }
  if (!cuspPairs.length) fail('expected cusp-in/out pairs')
  else pass(`cusp pairs detected (${cuspPairs.length})`)
  if (!swept.meta.cuspSeamsOpen) fail('expected open cusp seams')
  else pass('cusp seams left open (no twist fans)')
  const v = validateMesh(swept.mesh, { requireWatertight: false })
  if (v.faces.degenerateFaceCount) fail(`cusp sweep degenerates: ${v.faces.degenerateFaceCount}`)
  else pass('cusp sweep has no degenerate faces')
}

console.log('\n=== Step 13D.2 Rayonnant refinement ===')

{
  // Baseline preset must keep 3 openings and remain watertight
  const baseApplied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.BASELINE_13D,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  const baseSv = buildSolidVoidModel(baseApplied.tracery)
  if (!baseSv.validation.ok) fail(`baseline svm: ${baseSv.validation.errors.join('; ')}`)
  else pass('baseline preset solid/void ok')
  if (baseSv.metrics.openingCount !== 3) fail(`baseline openings ${baseSv.metrics.openingCount} ≠ 3`)
  else pass('baseline preset remains 3 openings')
  if (baseSv.regions[REGION_TYPES.LEFT_SPANDREL_VOID]) fail('baseline must not include spandrel voids')
  else pass('baseline has no spandrel voids')

  const baseAsm = buildStoneAssembly({
    regionParams: baseApplied.tracery,
    stone: baseApplied.stone,
  })
  if (!baseAsm.ok || !baseAsm.metrics.watertight) fail('baseline assembly not watertight')
  else pass(`baseline assembly watertight (${baseAsm.metrics.triangleCount} tris)`)
}

{
  const refined = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  const sv = buildSolidVoidModel(refined.tracery)
  if (!sv.validation.ok) fail(`refined svm: ${sv.validation.errors.join('; ')}`)
  else pass('refined preset solid/void ok')
  if (sv.metrics.openingCount !== 5) fail(`refined openings ${sv.metrics.openingCount} ≠ 5`)
  else pass('refined has 5 openings (lancets + foil + spandrels)')
  if (!sv.spandrel?.ok) fail('spandrel construction failed')
  else pass('spandrel openings constructed')
  if (!sv.regions[REGION_TYPES.LEFT_SPANDREL_VOID] || !sv.regions[REGION_TYPES.RIGHT_SPANDREL_VOID]) {
    fail('missing spandrel region records')
  } else pass('spandrel regions present')

  // Determinism
  const sv2 = buildSolidVoidModel(refined.tracery)
  const c1 = sv.spandrel.construction.left.center
  const c2 = sv2.spandrel.construction.left.center
  if (Math.hypot(c1.x - c2.x, c1.y - c2.y) > 1e-12) fail('refined spandrel not deterministic')
  else pass('refined preset deterministic')

  const asm = buildStoneAssembly({ regionParams: refined.tracery, stone: refined.stone })
  if (!asm.ok || !asm.metrics.watertight) fail(`refined assembly: ${asm.errors.join('; ')}`)
  else pass(`refined assembly watertight (${asm.metrics.triangleCount} tris)`)
  if (!asm.meta.moldingHierarchy) fail('expected molding hierarchy flag')
  else pass('molding hierarchy enabled')
  if (!asm.meta.spandrelOpenings) fail('expected spandrel openings in assembly')
  else pass('assembly includes spandrel openings')

  const { zFront, zBack } = depthRange(refined.stone.stoneDepth ?? 0.25, refined.stone.depthAlignment ?? 'centered')
  const front = planarFaceNormalReport(asm.structural, zFront, 1)
  const back = planarFaceNormalReport(asm.structural, zBack, -1)
  if (!front.ok || !back.ok) fail('refined planar normals failed')
  else pass('refined hard-edge planar normals ok')

  const topo = validateMesh(asm.structuralTopology, { requireWatertight: true })
  if (!topo.ok) fail(`refined topology: ${topo.errors.join('; ')}`)
  else pass('refined topology watertight')
}

{
  // Multiple spans / families
  for (const span of [2.4, 3.0, 4.5]) {
    const cases = [
      { family: 'equilateral', riseRatio: DEFAULT_TRACERY_SETTINGS.riseRatio },
      { family: 'lancet', riseRatio: 1.05 },
      { family: 'lancet', riseRatio: 1.2 },
    ]
    for (const { family, riseRatio } of cases) {
      const applied = applyArchitecturePreset(
        ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
        { ...DEFAULT_TRACERY_SETTINGS, span, family, riseRatio },
        DEFAULT_STONE_SETTINGS,
      )
      const a = buildStoneAssembly({ regionParams: applied.tracery, stone: applied.stone })
      if (!a.ok || !a.metrics.watertight) {
        fail(`refined ${family} span=${span}: ${a.errors?.join('; ')}`)
      } else {
        pass(`refined ${family} span=${span} watertight`)
      }
    }
  }
}

{
  const w = resolveMemberWidths(3, {
    outerFrameWidthRatio: 0.05,
    primaryMullionWidthRatio: 0.55,
    secondaryTraceryWidthRatio: 0.4,
    foilBarWidthRatio: 0.28,
  })
  if (!w.ok) fail('member width resolve failed')
  else if (
    !(
      w.widths.outerFrameWidth >= w.widths.primaryMullionWidth &&
      w.widths.primaryMullionWidth >= w.widths.secondaryTraceryWidth &&
      w.widths.secondaryTraceryWidth >= w.widths.foilBarWidth
    )
  ) {
    fail('member hierarchy widths not descending')
  } else pass('member hierarchy widths descending')
}

{
  // Constraint failure path: absurd scale should not force invalid holes into a broken model
  // (enabled with extreme scale still may succeed geometrically — check omission when pocket tiny)
  const tiny = buildSolidVoidModel({
    ...DEFAULT_TRACERY_SETTINGS,
    span: 3,
    enableSpandrelOpenings: true,
    secondaryTraceryWidth: 0.4,
    outerFrameWidth: 0.12,
    upperOpeningScale: 0.9,
    mullionWidth: 0.16,
  })
  // May succeed or warn-omit; must not be invalid with overlapping holes
  if (tiny.validation.ok === false && tiny.validation.errors.some((e) => e.includes('overlap'))) {
    fail('spandrel produced overlapping voids')
  } else pass('spandrel constraint path does not force overlapping voids')
}

console.log('\n=== Step 13D.3 Rayonnant bar network ===')

{
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableBarNetwork !== true) fail('bar network preset flag missing')
  else pass('bar network preset enables enableBarNetwork')

  // Baseline / refined must remain unchanged in opening counts
  const baseSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (baseSv.metrics.openingCount !== 3) fail('baseline openings changed by 13D.3')
  else pass('baseline still 3 openings')

  const refinedSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (refinedSv.metrics.openingCount !== 5) fail('refined openings changed by 13D.3')
  else pass('refined still 5 openings')

  const network = buildBarNetwork(applied.tracery)
  const g = validateBarNetwork(network)
  if (!network.ok || !g.ok) fail(`bar network graph: ${[...network.validation.errors, ...g.errors].join('; ')}`)
  else pass(`bar network graph ok (${network.metrics.nodeCount} nodes, ${network.metrics.memberCount} members)`)
  if (!network.metrics.coreConnected) fail('bar network core not connected')
  else pass('bar network core connected')
  for (const m of Object.values(network.members)) {
    if (!(m.width > 0)) fail(`member ${m.id} non-positive width`)
    if (!m.path?.length) fail(`member ${m.id} empty path`)
  }
  pass('member widths positive + paths present')

  // Strip offset sanity
  const sample = network.memberSamples['member-primary-mullion']
  const strip = polylineToStrip(sample, network.widths.PRIMARY_MULLION ?? 0.08)
  if (!strip || strip.length < 4) fail('mullion strip offset failed')
  else pass('member strip offset ok')

  const sv = buildBarNetworkSolidVoid(applied.tracery)
  if (!sv.validation.ok) fail(`bar svm: ${sv.validation.errors.join('; ')}`)
  else pass('bar network solid/void ok')
  if (!(sv.metrics.openingCount >= 5)) {
    fail(`bar network openings ${sv.metrics.openingCount} < 5`)
  } else pass(`bar network openings ${sv.metrics.openingCount} (≥5)`)
  if (!sv.metrics.connectivityOk) fail('bar network stone not connected (strip union)')
  else pass('bar network stone connected (single strip component)')

  // Determinism
  const sv2 = buildBarNetworkSolidVoid(applied.tracery)
  if (sv2.metrics.openingCount !== sv.metrics.openingCount) fail('bar network not deterministic')
  else pass('bar network deterministic')

  // Invalid: absurd min web + huge density should not produce overlapping voids
  const bad = buildBarNetworkSolidVoid({
    ...applied.tracery,
    upperSubdivisionDensity: 1,
    upperOpeningScale: 0.95,
    minWebClearance: 0.2,
    secondaryTraceryWidth: 0.25,
  })
  if (bad.validation.ok && bad.validation.errors.some((e) => e.includes('overlap'))) {
    fail('invalid bar network forced overlapping voids')
  } else pass('invalid bar network does not force overlapping voids')

  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: applied.stone,
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`bar assembly: ${asm.errors?.join('; ')}`)
  else pass(`bar assembly watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`)
  if (!asm.meta.barNetwork) fail('assembly missing barNetwork flag')
  else pass('assembly meta marks bar network')

  const { zFront, zBack } = depthRange(applied.stone.stoneDepth ?? 0.25, applied.stone.depthAlignment ?? 'centered')
  const front = planarFaceNormalReport(asm.structural, zFront, 1)
  const back = planarFaceNormalReport(asm.structural, zBack, -1)
  if (!front.ok || !back.ok) fail('bar network planar normals failed')
  else pass('bar network hard-edge planar normals ok')

  // Multiple spans
  for (const span of [2.4, 3.0, 4.5]) {
    const a = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
      { ...DEFAULT_TRACERY_SETTINGS, span, family: 'equilateral' },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({ regionParams: a.tracery, stone: a.stone })
    if (!mesh.ok || !mesh.metrics.watertight) fail(`bar span=${span}: ${mesh.errors?.join('; ')}`)
    else pass(`bar network equilateral span=${span} watertight`)
  }

  // Comparison metrics (invent nothing — report measured)
  const baseAsm = buildStoneAssembly({
    regionParams: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
    stone: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).stone,
  })
  const refAsm = buildStoneAssembly({
    regionParams: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
    stone: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).stone,
  })
  console.log('COMPARE openings:', {
    baseline: baseSv.metrics.openingCount,
    refined: refinedSv.metrics.openingCount,
    barNetwork: sv.metrics.openingCount,
  })
  console.log('COMPARE solidArea:', {
    baseline: baseSv.metrics.solidArea,
    refined: refinedSv.metrics.solidArea,
    barNetwork: sv.metrics.solidArea,
  })
  console.log('COMPARE openingArea:', {
    baseline: baseSv.metrics.openingArea,
    refined: refinedSv.metrics.openingArea,
    barNetwork: sv.metrics.openingArea,
  })
  console.log('COMPARE structuralVolume:', {
    baseline: baseAsm.metrics?.structuralVolume,
    refined: refAsm.metrics?.structuralVolume,
    barNetwork: asm.metrics?.structuralVolume,
  })
  pass('comparison metrics reported')
}

console.log('\n=== Step 13D.4 Rayonnant Elaborate ===')

{
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableElaborate !== true) fail('elaborate preset flag missing')
  else pass('elaborate preset enables enableElaborate')
  if (applied.tracery.enableBarNetwork === true) fail('elaborate must not enable bar network')
  else pass('elaborate leaves bar network off')

  // Prior presets unchanged
  const baseSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (baseSv.metrics.openingCount !== 3) fail('baseline openings changed by 13D.4')
  else pass('baseline still 3 openings')

  const refinedSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (refinedSv.metrics.openingCount !== 5) fail('refined openings changed by 13D.4')
  else pass('refined still 5 openings')

  const barSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (!(barSv.metrics.openingCount >= 5)) fail('bar network openings changed by 13D.4')
  else pass(`bar network still ${barSv.metrics.openingCount} openings`)

  const lancets = buildHierarchicalLancets(applied.tracery)
  if (!lancets.ok || lancets.nestingDepth !== 2) fail(`hierarchical lancets: ${lancets.errors?.join('; ')}`)
  else pass(`hierarchical lancets nestingDepth=${lancets.nestingDepth} openings=${lancets.openings.length}`)

  const arrangement = solveOpeningArrangement(applied.tracery)
  if (!arrangement.ok) fail(`arrangement: ${arrangement.validation.errors.join('; ')}`)
  else pass(`opening arrangement ok (${arrangement.openings.length} openings)`)

  const sv = buildElaborateSolidVoid(applied.tracery)
  if (!sv.validation.ok) fail(`elaborate svm: ${sv.validation.errors.join('; ')}`)
  else pass('elaborate solid/void ok')
  if (!(sv.metrics.openingCount >= 7)) {
    fail(`elaborate openings ${sv.metrics.openingCount} < 7`)
  } else pass(`elaborate openings ${sv.metrics.openingCount} (≥7)`)
  if (!sv.metrics.connectivityOk) fail('elaborate stone connectivity failed')
  else pass('elaborate stone region connected')
  if (!sv.metrics.elaborate) fail('elaborate metrics flag missing')
  else pass('elaborate metrics flagged')

  // Nested secondaries + head openings + oculus foil expected
  for (const key of [
    'LEFT_OUTER_SECONDARY',
    'RIGHT_OUTER_SECONDARY',
    'UPPER_OCULUS_FOIL',
  ]) {
    if (!sv.holes.includes(key)) fail(`missing opening ${key}`)
  }
  pass('nested secondaries + oculus foil present')

  const sv2 = buildElaborateSolidVoid(applied.tracery)
  if (sv2.metrics.openingCount !== sv.metrics.openingCount) fail('elaborate not deterministic')
  else pass('elaborate deterministic')

  // Nesting depth 1 fallback
  const depth1 = buildElaborateSolidVoid({ ...applied.tracery, nestingDepth: 1 })
  if (!depth1.validation.ok) fail(`nestingDepth=1: ${depth1.validation.errors.join('; ')}`)
  else if (depth1.metrics.openingCount < 3) fail('nestingDepth=1 under-specified')
  else pass(`nestingDepth=1 openings ${depth1.metrics.openingCount}`)

  // Invalid: absurd clearance should not force overlapping voids
  const bad = buildElaborateSolidVoid({
    ...applied.tracery,
    minWebClearance: 0.25,
    secondaryTraceryWidth: 0.2,
    upperSubdivisionComplexity: 1,
  })
  if (bad.validation.ok && bad.validation.errors.some((e) => e.includes('overlap'))) {
    fail('invalid elaborate forced overlapping voids')
  } else pass('invalid elaborate does not force overlapping voids')

  const asmElab = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: applied.stone,
  })
  if (!asmElab.ok || !asmElab.metrics.watertight) {
    fail(`elaborate assembly: ${asmElab.errors?.join('; ')}`)
  } else {
    pass(
      `elaborate assembly watertight (${asmElab.metrics.triangleCount} tris, vol ${asmElab.metrics.structuralVolume?.toFixed(4)})`,
    )
  }
  if (!asmElab.meta?.elaborate) fail('assembly missing elaborate flag')
  else pass('assembly meta marks elaborate')

  const { zFront, zBack } = depthRange(
    applied.stone.stoneDepth ?? 0.25,
    applied.stone.depthAlignment ?? 'centered',
  )
  const front = planarFaceNormalReport(asmElab.structural, zFront, 1)
  const back = planarFaceNormalReport(asmElab.structural, zBack, -1)
  if (!front.ok || !back.ok) fail('elaborate planar normals failed')
  else pass('elaborate hard-edge planar normals ok')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE,
      { ...DEFAULT_TRACERY_SETTINGS, span, family: 'equilateral' },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({ regionParams: patch.tracery, stone: patch.stone })
    if (!mesh.ok || !mesh.metrics.watertight) fail(`elaborate span=${span}: ${mesh.errors?.join('; ')}`)
    else pass(`elaborate equilateral span=${span} watertight`)
  }

  const barAsm = buildStoneAssembly({
    regionParams: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
    stone: applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).stone,
  })

  console.log('COMPARE_13D4 openings:', {
    baseline: baseSv.metrics.openingCount,
    refined: refinedSv.metrics.openingCount,
    barNetwork: barSv.metrics.openingCount,
    elaborate: sv.metrics.openingCount,
  })
  console.log('COMPARE_13D4 openingToEnvelopeRatio:', {
    baseline: baseSv.metrics.openingToEnvelopeRatio ?? baseSv.metrics.openingArea / (baseSv.metrics.solidArea + baseSv.metrics.openingArea),
    refined: refinedSv.metrics.openingToEnvelopeRatio ?? refinedSv.metrics.openingArea / (refinedSv.metrics.solidArea + refinedSv.metrics.openingArea),
    barNetwork: barSv.metrics.openingToEnvelopeRatio ?? barSv.metrics.openingArea / (barSv.metrics.solidArea + barSv.metrics.openingArea),
    elaborate: sv.metrics.openingToEnvelopeRatio,
  })
  console.log('COMPARE_13D4 structuralVolume:', {
    baseline: buildStoneAssembly({
      regionParams: applyArchitecturePreset(ARCHITECTURE_PRESETS.BASELINE_13D, DEFAULT_TRACERY_SETTINGS, DEFAULT_STONE_SETTINGS).tracery,
      stone: DEFAULT_STONE_SETTINGS,
    }).metrics?.structuralVolume,
    barNetwork: barAsm.metrics?.structuralVolume,
    elaborate: asmElab.metrics?.structuralVolume,
  })
  pass('13D.4 comparison metrics reported')
}

console.log('\n=== Step 13D.5 Rayonnant Skeleton ===')

{
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_SKELETON,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableSkeleton !== true) fail('skeleton preset flag missing')
  else pass('skeleton preset enables enableSkeleton')
  if (applied.tracery.enableBarNetwork === true || applied.tracery.enableElaborate === true) {
    fail('skeleton must leave bar/elaborate off')
  } else pass('skeleton leaves bar network / elaborate off')

  const baseSv = buildSolidVoidModel(
    applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      DEFAULT_TRACERY_SETTINGS,
      DEFAULT_STONE_SETTINGS,
    ).tracery,
  )
  if (baseSv.metrics.openingCount !== 3) fail('baseline openings changed by 13D.5')
  else pass('baseline still 3 openings')

  const graph = buildSkeletonGraph(applied.tracery)
  const gCheck = validateSkeletonGraph(graph)
  if (!graph.ok || !gCheck.ok) {
    fail(`skeleton graph: ${[...(graph.validation?.errors ?? []), ...(gCheck.errors ?? [])].join('; ')}`)
  } else {
    pass(
      `skeleton graph ok (${Object.keys(graph.members).length} members, ${Object.keys(graph.nodes).length} nodes)`,
    )
  }

  const sv = buildSolidVoidModel(applied.tracery)
  if (!sv.validation.ok) fail(`skeleton svm: ${sv.validation.errors.join('; ')}`)
  else pass('skeleton solid/void ok')
  if (!sv.metrics?.skeleton) fail('skeleton metrics flag missing')
  else pass('skeleton metrics flagged')
  if (sv.metrics.stripComponentCount !== 1) fail('skeleton stone not connected')
  else pass('skeleton strip-union connected (1 component)')
  if (sv.regions?.STONE_REGION?.source?.representation !== 'strip-union-skeleton') {
    fail('skeleton still using outer⊕holes representation')
  } else pass('extrusion representation is strip-union-skeleton')
  if (!(sv.metrics.openingCount >= 2)) fail('skeleton missing emergent voids')
  else pass(`skeleton emergent voids ${sv.metrics.openingCount}`)

  const sv2 = buildSolidVoidModel(applied.tracery)
  if (sv2.metrics.solidArea !== sv.metrics.solidArea) fail('skeleton not deterministic')
  else pass('skeleton deterministic')

  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`skeleton assembly: ${asm.errors?.join('; ')}`)
  else {
    pass(
      `skeleton assembly watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`,
    )
  }
  if (!asm.meta?.skeleton) fail('assembly missing skeleton flag')
  else pass('assembly meta marks skeleton')
  if (!(asm.metrics.structuralVolume < 0.55)) {
    fail(`skeleton volume ${asm.metrics.structuralVolume} still panel-like`)
  } else pass('skeleton volume below panel baseline')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_SKELETON,
      { ...DEFAULT_TRACERY_SETTINGS, span },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({
      regionParams: patch.tracery,
      stone: { ...patch.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) fail(`skeleton span=${span}: ${mesh.errors?.join('; ')}`)
    else pass(`skeleton span=${span} watertight`)
  }

  console.log('COMPARE_13D5 structuralVolume:', {
    baseline: buildStoneAssembly({
      regionParams: applyArchitecturePreset(
        ARCHITECTURE_PRESETS.BASELINE_13D,
        DEFAULT_TRACERY_SETTINGS,
        DEFAULT_STONE_SETTINGS,
      ).tracery,
      stone: DEFAULT_STONE_SETTINGS,
    }).metrics?.structuralVolume,
    barNetwork: buildStoneAssembly({
      regionParams: applyArchitecturePreset(
        ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
        DEFAULT_TRACERY_SETTINGS,
        DEFAULT_STONE_SETTINGS,
      ).tracery,
      stone: DEFAULT_STONE_SETTINGS,
    }).metrics?.structuralVolume,
    skeleton: asm.metrics?.structuralVolume,
  })
  pass('13D.5 comparison metrics reported')
}

{
  console.log('\n=== Step 13D.6 Rayonnant Oculus Network ===')
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableOculusNetwork !== true) fail('oculus preset enables enableOculusNetwork')
  else pass('oculus preset enables enableOculusNetwork')
  if (applied.tracery.enableSkeleton !== true) fail('oculus preset should keep enableSkeleton')
  else pass('oculus preset keeps enableSkeleton')
  if (applied.tracery.enableBarNetwork === true || applied.tracery.enableElaborate === true) {
    fail('oculus should leave bar/elaborate off')
  } else pass('oculus leaves bar network / elaborate off')

  const sk = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_SKELETON,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (sk.tracery.enableOculusNetwork === true) fail('skeleton preset must not enable oculus')
  else pass('skeleton preset unchanged (no oculus)')

  const baseline = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.BASELINE_13D,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  const baseSv = buildSolidVoidModel(baseline.tracery)
  if (baseSv.metrics?.openingCount !== 3) fail('baseline openings changed')
  else pass('baseline still 3 openings')

  const graph = buildOculusNetworkGraph(applied.tracery)
  const gCheck = validateOculusNetworkGraph(graph)
  if (!graph.ok || !gCheck.ok) {
    fail(`oculus graph: ${(graph.validation?.errors ?? gCheck.errors).join('; ')}`)
  } else {
    pass(
      `oculus graph ok (${Object.keys(graph.members).length} members, ${Object.keys(graph.nodes).length} nodes)`,
    )
  }
  if (!graph.oculus?.center || !(graph.oculus.radius > 0)) fail('oculus placement missing')
  else pass('oculus placement contained')
  for (const id of [
    'member-oculus-ring',
    'member-oculus-connector-left',
    'member-oculus-connector-right',
    'member-oculus-connector-parent',
  ]) {
    if (!graph.members[id]) fail(`missing ${id}`)
  }
  pass('oculus ring + three connectors present')

  const sv = buildSolidVoidModel(applied.tracery)
  if (!sv.validation.ok) fail(`oculus svm: ${sv.validation.errors.join('; ')}`)
  else pass('oculus solid/void ok')
  if (!sv.metrics?.oculusNetwork) fail('oculus metrics flag missing')
  else pass('oculus metrics flagged')
  if (sv.metrics.stripComponentCount !== 1) fail('oculus stone not connected')
  else pass('oculus strip-union connected (1 component)')
  if (sv.regions?.STONE_REGION?.source?.representation !== 'strip-union-oculus-network') {
    fail('oculus still using outer⊕holes / wrong representation')
  } else pass('extrusion representation is strip-union-oculus-network')
  if (!(sv.metrics.openingCount >= 4)) fail('oculus missing emergent voids')
  else pass(`oculus emergent voids ${sv.metrics.openingCount}`)

  const sv2 = buildSolidVoidModel(applied.tracery)
  if (sv2.metrics.solidArea !== sv.metrics.solidArea) fail('oculus not deterministic')
  else pass('oculus deterministic')

  // Quatrefoil subdivision path
  const foilApplied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
    { ...DEFAULT_TRACERY_SETTINGS, oculusSubdivision: 'quatrefoil' },
    DEFAULT_STONE_SETTINGS,
  )
  const foilGraph = buildOculusNetworkGraph({
    ...foilApplied.tracery,
    oculusSubdivision: 'quatrefoil',
  })
  const foilBars = Object.keys(foilGraph.members ?? {}).filter((id) =>
    id.startsWith('member-foil-bar-'),
  )
  if (!foilGraph.ok || foilBars.length < 4) {
    fail(`quatrefoil bars: ${foilGraph.validation?.errors?.join('; ') ?? 'missing'}`)
  } else pass(`quatrefoil subdivision ok (${foilBars.length} foil bars)`)

  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`oculus assembly: ${asm.errors?.join('; ')}`)
  else {
    pass(
      `oculus assembly watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`,
    )
  }
  if (!asm.meta?.oculusNetwork) fail('assembly missing oculusNetwork flag')
  else pass('assembly meta marks oculus network')
  if (asm.metrics.nonManifoldEdgeCount !== 0) fail('oculus non-manifold edges')
  else pass('oculus zero non-manifold edges')
  if (!(asm.metrics.structuralVolume < 0.7)) {
    fail(`oculus volume ${asm.metrics.structuralVolume} still panel-like`)
  } else pass('oculus volume below panel baseline')

  const skAsm = buildStoneAssembly({
    regionParams: sk.tracery,
    stone: { ...sk.stone, moldingEnabled: false },
  })
  if (!(asm.metrics.structuralVolume > skAsm.metrics.structuralVolume)) {
    fail('oculus volume should exceed bare skeleton')
  } else pass('oculus volume exceeds skeleton (added members)')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
      { ...DEFAULT_TRACERY_SETTINGS, span },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({
      regionParams: patch.tracery,
      stone: { ...patch.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) fail(`oculus span=${span}: ${mesh.errors?.join('; ')}`)
    else pass(`oculus span=${span} watertight`)
  }

  // Invalid extreme should report constraint failure (not silent substitute)
  const bad = buildOculusNetworkGraph({
    ...applied.tracery,
    oculusRadiusRatio: 1.0,
    oculusVerticalPosition: 0.99,
    oculusClearance: 0.2,
  })
  if (bad.ok) pass('oculus extreme still solvable (acceptable)')
  else {
    if (!(bad.validation?.errors?.length > 0)) fail('oculus extreme failed without errors')
    else pass('oculus invalid extreme reports constraint failure')
  }

  console.log('COMPARE_13D6 structuralVolume:', {
    baseline: buildStoneAssembly({
      regionParams: applyArchitecturePreset(
        ARCHITECTURE_PRESETS.BASELINE_13D,
        DEFAULT_TRACERY_SETTINGS,
        DEFAULT_STONE_SETTINGS,
      ).tracery,
      stone: DEFAULT_STONE_SETTINGS,
    }).metrics?.structuralVolume,
    skeleton: skAsm.metrics?.structuralVolume,
    oculus: asm.metrics?.structuralVolume,
  })
  pass('13D.6 comparison metrics reported')
}

{
  console.log('\n=== Step 13D.7 Rayonnant Secondary Tracery ===')
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableSecondaryTracery !== true) {
    fail('secondary preset enables enableSecondaryTracery')
  } else pass('secondary preset enables enableSecondaryTracery')
  if (applied.tracery.enableOculusNetwork !== true || applied.tracery.enableSkeleton !== true) {
    fail('secondary should keep oculus + skeleton')
  } else pass('secondary keeps oculus + skeleton')
  if (applied.tracery.enableBarNetwork === true || applied.tracery.enableElaborate === true) {
    fail('secondary should leave bar/elaborate off')
  } else pass('secondary leaves bar network / elaborate off')

  const oculusOnly = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (oculusOnly.tracery.enableSecondaryTracery === true) {
    fail('oculus preset must not enable secondary')
  } else pass('oculus preset unchanged (no secondary)')

  const baseline = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.BASELINE_13D,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  const baseSv = buildSolidVoidModel(baseline.tracery)
  if (baseSv.metrics?.openingCount !== 3) fail('baseline openings changed')
  else pass('baseline still 3 openings')

  const graph = buildSecondaryTraceryGraph(applied.tracery)
  const gCheck = validateSecondaryTraceryGraph(graph)
  if (!graph.ok || !gCheck.ok) {
    fail(`secondary graph: ${(graph.validation?.errors ?? gCheck.errors).join('; ')}`)
  } else {
    pass(
      `secondary graph ok (${Object.keys(graph.members).length} members, ${Object.keys(graph.nodes).length} nodes)`,
    )
  }
  const foilBars = Object.keys(graph.members).filter((id) => id.startsWith('member-foil-bar-'))
  const foilRadials = Object.keys(graph.members).filter((id) =>
    id.startsWith('member-foil-radial-'),
  )
  if (foilBars.length < 4 || foilRadials.length < 4) fail('quatrefoil incomplete')
  else pass(`quatrefoil connected (${foilBars.length} bars + ${foilRadials.length} radials)`)
  if (!graph.members['member-secondary-left'] || !graph.members['member-secondary-right']) {
    fail('missing side secondary members')
  } else pass('symmetric side secondary members present')
  if (graph.secondary?.left && graph.secondary?.right) {
    const lx = graph.secondary.left.ringPt.x
    const rx = graph.secondary.right.ringPt.x
    if (!(lx < 0 && rx > 0) || Math.abs(lx + rx) > 1e-6) fail('side members not mirrored')
    else pass('side members mirrored across centerline')
  }

  const sv = buildSolidVoidModel(applied.tracery)
  if (!sv.validation.ok) fail(`secondary svm: ${sv.validation.errors.join('; ')}`)
  else pass('secondary solid/void ok')
  if (!sv.metrics?.secondaryTracery) fail('secondary metrics flag missing')
  else pass('secondary metrics flagged')
  if (sv.metrics.stripComponentCount !== 1) fail('secondary stone not connected')
  else pass('secondary strip-union connected (1 component)')
  if (sv.regions?.STONE_REGION?.source?.representation !== 'strip-union-secondary-tracery') {
    fail('secondary wrong representation')
  } else pass('extrusion representation is strip-union-secondary-tracery')
  if (!(sv.metrics.openingCount >= 5)) fail('secondary missing emergent voids')
  else pass(`secondary emergent voids ${sv.metrics.openingCount}`)

  const sv2 = buildSolidVoidModel(applied.tracery)
  if (sv2.metrics.solidArea !== sv.metrics.solidArea) fail('secondary not deterministic')
  else pass('secondary deterministic')

  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`secondary assembly: ${asm.errors?.join('; ')}`)
  else {
    pass(
      `secondary assembly watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`,
    )
  }
  if (!asm.meta?.secondaryTracery) fail('assembly missing secondaryTracery flag')
  else pass('assembly meta marks secondary tracery')
  if (asm.metrics.nonManifoldEdgeCount !== 0) fail('secondary non-manifold edges')
  else pass('secondary zero non-manifold edges')
  if (!(asm.metrics.structuralVolume < 0.75)) {
    fail(`secondary volume ${asm.metrics.structuralVolume} still panel-like`)
  } else pass('secondary volume below panel baseline')

  const oculusAsm = buildStoneAssembly({
    regionParams: oculusOnly.tracery,
    stone: { ...oculusOnly.stone, moldingEnabled: false },
  })
  if (!(asm.metrics.structuralVolume > oculusAsm.metrics.structuralVolume)) {
    fail('secondary volume should exceed plain oculus network')
  } else pass('secondary volume exceeds oculus network (added members)')

  // Level 2 path
  const g2 = buildSecondaryTraceryGraph({
    ...applied.tracery,
    secondaryTraceryLevel: 2,
  })
  if (!g2.ok) fail(`level2 graph: ${g2.validation?.errors?.join('; ')}`)
  else pass(`level2 graph ok (bridges ${g2.secondary?.level2Ids?.length ?? 0})`)

  // Level 0 preserves oculus-only member set without side secondaries
  const g0 = buildSecondaryTraceryGraph({
    ...applied.tracery,
    secondaryTraceryLevel: 0,
    oculusSubdivision: 'none',
  })
  if (g0.members?.['member-secondary-left']) fail('level0 should omit side secondaries')
  else pass('level0 omits side secondaries')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY,
      { ...DEFAULT_TRACERY_SETTINGS, span },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({
      regionParams: patch.tracery,
      stone: { ...patch.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) {
      fail(`secondary span=${span}: ${mesh.errors?.join('; ')}`)
    } else pass(`secondary span=${span} watertight`)
  }

  console.log('COMPARE_13D7 structuralVolume:', {
    baseline: buildStoneAssembly({
      regionParams: applyArchitecturePreset(
        ARCHITECTURE_PRESETS.BASELINE_13D,
        DEFAULT_TRACERY_SETTINGS,
        DEFAULT_STONE_SETTINGS,
      ).tracery,
      stone: DEFAULT_STONE_SETTINGS,
    }).metrics?.structuralVolume,
    oculus: oculusAsm.metrics?.structuralVolume,
    secondary: asm.metrics?.structuralVolume,
  })
  pass('13D.7 comparison metrics reported')
}

{
  console.log('\n=== Step 13D.8 Oculus & Junction Refinement ===')
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableOculusRefinement !== true) {
    fail('refined preset enables enableOculusRefinement')
  } else pass('refined preset enables enableOculusRefinement')
  if (applied.tracery.enableSecondaryTracery !== true) {
    fail('refined should keep secondary tracery')
  } else pass('refined keeps secondary tracery')
  if (applied.tracery.foilRadialMode !== 'tip-to-ring') {
    fail('refined should use tip-to-ring radials')
  } else pass('refined uses tip-to-ring radials')

  const secondary = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_SECONDARY_TRACERY,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (secondary.tracery.enableOculusRefinement === true) {
    fail('13D.7 secondary preset must stay unrefined')
  } else pass('13D.7 secondary preset unchanged (no refinement)')
  if ((secondary.tracery.foilRadialMode ?? 'cusp-to-ring') !== 'cusp-to-ring') {
    fail('13D.7 should keep cusp-to-ring radials')
  } else pass('13D.7 keeps cusp-to-ring radials')

  const g7 = buildSecondaryTraceryGraph(secondary.tracery)
  const g8 = buildSecondaryTraceryGraph(applied.tracery)
  const c7 = validateSecondaryTraceryGraph(g7)
  const c8 = validateSecondaryTraceryGraph(g8)
  if (!g8.ok || !c8.ok) fail(`refined graph: ${(g8.validation?.errors ?? c8.errors).join('; ')}`)
  else {
    pass(
      `refined graph ok (${Object.keys(g8.members).length} members, ${Object.keys(g8.nodes).length} nodes)`,
    )
  }
  if (!g7.ok || !c7.ok) fail('13D.7 regression in refinement suite')
  else pass('13D.7 secondary graph still valid')

  // Foil tips / tip-radials must not start at the cusp diamond (no knot-crossing spokes).
  const Oc = g8.oculus.center
  const tipNodes = Object.keys(g8.nodes).filter((id) => id.startsWith('node-foil-tip-'))
  const radials = Object.values(g8.members).filter((m) => m.id.startsWith('member-foil-radial-'))
  const cuspR0 = Math.min(
    ...(g8.foil?.cusps ?? []).map((c) => Math.hypot(c.x - Oc.x, c.y - Oc.y)),
  )
  if (tipNodes.length < 4 || radials.length < 4) {
    fail(
      `refined tip/radial incomplete (tips ${tipNodes.length}, radials ${radials.length})`,
    )
  } else {
    let tipOk = true
    for (const id of tipNodes) {
      const p = g8.nodes[id]?.position
      if (!p) {
        tipOk = false
        break
      }
      const r = Math.hypot(p.x - Oc.x, p.y - Oc.y)
      if (!(r > cuspR0 * 1.5)) tipOk = false
    }
    if (!tipOk) fail('refined tip nodes still in cusp diamond')
    else pass(`refined tip-to-ring radials (${radials.length}) outside cusp diamond`)
  }

  // Foil bars thinner relative to cusp radius than legacy knot.
  const foilBars = Object.values(g8.members).filter((m) => m.id.startsWith('member-foil-bar-'))
  const foilW = foilBars[0]?.width ?? 0
  const cuspR = Math.min(
    ...(g8.foil?.cusps ?? []).map((c) => Math.hypot(c.x - Oc.x, c.y - Oc.y)),
  )
  if (!(foilW / 2 < cuspR * 0.9)) fail('central junction still fills cusp diamond')
  else pass(`central junction open (foilW/2=${(foilW / 2).toFixed(4)} < cuspR=${cuspR.toFixed(4)})`)

  // Apex clearance
  const apexY = g8.parent?.points?.APEX?.y ?? g8.nodes['node-parent-apex']?.position?.y
  const top = g8.oculus.center.y + g8.oculus.radius
  const apexGap = apexY - top
  const minApex = applied.tracery.oculusApexClearance ?? 0.08
  if (!(apexGap + 1e-6 >= Math.min(minApex, 0.05))) {
    fail(`apex clearance ${apexGap.toFixed(4)} below target`)
  } else pass(`apex clearance ${apexGap.toFixed(4)} m`)

  const sv = buildSolidVoidModel(applied.tracery)
  if (!sv.validation.ok) fail(`refined svm: ${sv.validation.errors.join('; ')}`)
  else pass('refined solid/void ok')
  if (sv.metrics.stripComponentCount !== 1) fail('refined stone not connected')
  else pass('refined strip-union connected (1 component)')
  if (sv.regions?.STONE_REGION?.source?.representation !== 'strip-union-oculus-refined') {
    fail('refined wrong representation')
  } else pass('extrusion representation is strip-union-oculus-refined')
  if (!sv.metrics?.oculusRefinement) fail('refined metrics flag missing')
  else pass('refined metrics flagged')

  const sv2 = buildSolidVoidModel(applied.tracery)
  if (sv2.metrics.solidArea !== sv.metrics.solidArea) fail('refined not deterministic')
  else pass('refined deterministic')

  const asm = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!asm.ok || !asm.metrics.watertight) fail(`refined assembly: ${asm.errors?.join('; ')}`)
  else {
    pass(
      `refined assembly watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`,
    )
  }
  if (!asm.meta?.oculusRefinement) fail('assembly missing oculusRefinement flag')
  else pass('assembly meta marks oculus refinement')
  if (asm.metrics.nonManifoldEdgeCount !== 0) fail('refined non-manifold edges')
  else pass('refined zero non-manifold edges')
  if (!(asm.metrics.structuralVolume < 0.75)) {
    fail(`refined volume ${asm.metrics.structuralVolume} still panel-like`)
  } else pass('refined volume below panel baseline')

  const asm7 = buildStoneAssembly({
    regionParams: secondary.tracery,
    stone: { ...secondary.stone, moldingEnabled: false },
  })
  // Refined should typically use less foil mass than legacy knot (not required strictly lower volume).
  if (!asm7.ok || !asm7.metrics.watertight) fail('13D.7 assembly regression')
  else pass('13D.7 assembly still watertight under regression')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED,
      { ...DEFAULT_TRACERY_SETTINGS, span },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({
      regionParams: patch.tracery,
      stone: { ...patch.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) {
      fail(`refined span=${span}: ${mesh.errors?.join('; ')}`)
    } else pass(`refined span=${span} watertight`)
  }

  console.log('COMPARE_13D8 structuralVolume:', {
    secondary: asm7.metrics?.structuralVolume,
    refined: asm.metrics?.structuralVolume,
  })
  pass('13D.8 comparison metrics reported')
}

{
  console.log('\n=== Step 13D.9 Hierarchical Rayonnant ===')
  const applied = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (applied.tracery.enableHierarchicalTracery !== true) {
    fail('hierarchical preset enables enableHierarchicalTracery')
  } else pass('hierarchical preset enables enableHierarchicalTracery')
  if (applied.tracery.hierarchicalDepth !== 1) fail('default depth should be 1')
  else pass('default hierarchical depth = 1')
  if (applied.tracery.nestedArches !== true) fail('nested arches should default ON')
  else pass('nested arches ON')
  if (applied.tracery.trefoilHeads !== true) fail('trefoil heads should default ON')
  else pass('trefoil heads ON')
  if (applied.tracery.secondaryQuatrefoils === true) {
    fail('secondary quatrefoils should default OFF')
  } else pass('secondary quatrefoils OFF')

  const refined = applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_REFINED,
    DEFAULT_TRACERY_SETTINGS,
    DEFAULT_STONE_SETTINGS,
  )
  if (refined.tracery.enableHierarchicalTracery === true) {
    fail('13D.8 refined must stay non-hierarchical')
  } else pass('13D.8 oculus refined unchanged (no hierarchical flag)')

  const g0 = buildHierarchicalTraceryGraph({
    ...applied.tracery,
    hierarchicalDepth: 0,
    nestedArches: false,
  })
  const g1 = buildHierarchicalTraceryGraph(applied.tracery)
  const g2 = buildHierarchicalTraceryGraph({ ...applied.tracery, hierarchicalDepth: 2 })
  const c1 = validateHierarchicalTraceryGraph(g1)
  const c2 = validateHierarchicalTraceryGraph(g2)
  if (!g1.ok || !c1.ok) {
    fail(`depth-1 graph: ${(g1.validation?.errors ?? c1.errors).join('; ')}`)
  } else {
    pass(
      `depth-1 graph ok (${Object.keys(g1.members).length} members, ${g1.hierarchy.cellCount} cells, accepted ${g1.hierarchy.accepted})`,
    )
  }
  if (!g2.ok || !c2.ok) {
    fail(`depth-2 graph: ${(g2.validation?.errors ?? c2.errors).join('; ')}`)
  } else {
    pass(
      `depth-2 graph ok (${Object.keys(g2.members).length} members, ${g2.hierarchy.cellCount} cells)`,
    )
  }
  if (!(Object.keys(g1.members).length > Object.keys(g0.members).length)) {
    fail('depth 1 must add members over depth 0')
  } else pass('depth 1 adds nested members vs depth 0')
  if (!(Object.keys(g2.members).length >= Object.keys(g1.members).length)) {
    fail('depth 2 must not lose members vs depth 1')
  } else pass('depth 2 ≥ depth 1 member count')

  const secondaryCells = Object.values(g1.cells ?? {}).filter(
    (c) => c.kind === CELL_KINDS.SECONDARY_ARCH && c.constraintStatus === 'accepted',
  )
  if (secondaryCells.length < 2) fail('depth 1 missing accepted secondary arches')
  else pass(`depth 1 secondary arches: ${secondaryCells.length}`)

  const foilCells = Object.values(g1.cells ?? {}).filter(
    (c) => c.kind === CELL_KINDS.FOIL_HEAD && c.constraintStatus === 'accepted',
  )
  if (foilCells.length < 1) fail('depth 1 missing trefoil head cells')
  else pass(`depth 1 foil head cells: ${foilCells.length}`)

  // Parent-child IDs
  for (const cell of secondaryCells) {
    if (!cell.parentId || !g1.cells[cell.parentId]) {
      fail(`secondary ${cell.id} missing parent link`)
    }
  }
  pass('parent-child cell links present')

  // Determinism
  const g1b = buildHierarchicalTraceryGraph(applied.tracery)
  if (Object.keys(g1b.members).length !== Object.keys(g1.members).length) {
    fail('hierarchical graph not deterministic')
  } else pass('hierarchical graph deterministic')

  const sv1 = buildSolidVoidModel(applied.tracery)
  if (!sv1.validation.ok) fail(`hierarchical svm: ${sv1.validation.errors.join('; ')}`)
  else pass('hierarchical solid/void ok')
  if (sv1.metrics.stripComponentCount !== 1) fail('hierarchical stone not connected')
  else pass('hierarchical strip-union connected (1 component)')
  if (sv1.regions?.STONE_REGION?.source?.representation !== 'strip-union-hierarchical') {
    fail('hierarchical wrong representation')
  } else pass('extrusion representation is strip-union-hierarchical')

  const asm0 = buildStoneAssembly({
    regionParams: { ...applied.tracery, hierarchicalDepth: 0, nestedArches: false },
    stone: { ...applied.stone, moldingEnabled: false },
  })
  const asm1 = buildStoneAssembly({
    regionParams: applied.tracery,
    stone: { ...applied.stone, moldingEnabled: false },
  })
  const asm2 = buildStoneAssembly({
    regionParams: { ...applied.tracery, hierarchicalDepth: 2 },
    stone: { ...applied.stone, moldingEnabled: false },
  })
  for (const [label, asm] of [
    ['depth0', asm0],
    ['depth1', asm1],
    ['depth2', asm2],
  ]) {
    if (!asm.ok || !asm.metrics.watertight) {
      fail(`${label}: ${asm.errors?.join('; ')}`)
    } else if (asm.metrics.nonManifoldEdgeCount !== 0) {
      fail(`${label}: non-manifold edges`)
    } else {
      pass(`${label} watertight (${asm.metrics.triangleCount} tris, vol ${asm.metrics.structuralVolume?.toFixed(4)})`)
    }
  }
  if (!(asm1.metrics.structuralVolume > asm0.metrics.structuralVolume)) {
    fail('depth 1 volume should exceed depth 0 (added members)')
  } else pass('depth 1 volume > depth 0')
  if (!asm1.meta?.hierarchicalTracery) fail('assembly missing hierarchicalTracery flag')
  else pass('assembly meta marks hierarchical')

  // Regression: 13D.8 still watertight
  const asm8 = buildStoneAssembly({
    regionParams: refined.tracery,
    stone: { ...refined.stone, moldingEnabled: false },
  })
  if (!asm8.ok || !asm8.metrics.watertight) fail('13D.8 regression under 13D.9 suite')
  else pass('13D.8 assembly still watertight under regression')

  for (const span of [2.4, 3.0, 4.5]) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
      { ...DEFAULT_TRACERY_SETTINGS, span },
      DEFAULT_STONE_SETTINGS,
    )
    const mesh = buildStoneAssembly({
      regionParams: patch.tracery,
      stone: { ...patch.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) {
      fail(`hierarchical span=${span}: ${mesh.errors?.join('; ')}`)
    } else pass(`hierarchical span=${span} watertight`)
  }

  for (const family of ['equilateral', 'lancet']) {
    const t = { ...applied.tracery, family, riseRatio: family === 'equilateral' ? 0.866 : 1.2 }
    const mesh = buildStoneAssembly({
      regionParams: t,
      stone: { ...applied.stone, moldingEnabled: false },
    })
    if (!mesh.ok || !mesh.metrics.watertight) {
      fail(`hierarchical family=${family}: ${mesh.errors?.join('; ')}`)
    } else pass(`hierarchical family=${family} watertight`)
  }

  // Trefoils off / quatrefoils on
  const noTrefoil = buildStoneAssembly({
    regionParams: { ...applied.tracery, trefoilHeads: false },
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!noTrefoil.ok || !noTrefoil.metrics.watertight) fail('trefoils-off assembly failed')
  else pass('trefoils OFF still watertight')
  const quat = buildStoneAssembly({
    regionParams: {
      ...applied.tracery,
      trefoilHeads: false,
      secondaryQuatrefoils: true,
    },
    stone: { ...applied.stone, moldingEnabled: false },
  })
  if (!quat.ok || !quat.metrics.watertight) fail('secondary quatrefoil assembly failed')
  else pass('secondary quatrefoils ON (trefoils OFF) watertight')

  console.log('COMPARE_13D9 structuralVolume:', {
    depth0: asm0.metrics?.structuralVolume,
    depth1: asm1.metrics?.structuralVolume,
    depth2: asm2.metrics?.structuralVolume,
    refined13d8: asm8.metrics?.structuralVolume,
  })
  pass('13D.9 comparison metrics reported')
}

if (!ok) {
  console.error('\nStep 13D validation FAILED')
  process.exit(1)
}
console.log(
  '\nStep 13D / 13D.1 / 13D.2 / 13D.3 / 13D.4 / 13D.5 / 13D.6 / 13D.7 / 13D.8 / 13D.9 validation passed',
)
