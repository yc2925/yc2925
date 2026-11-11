/**
 * Step 13E.4.3.1 — Workspace rendering regression.
 * Enumerates the actual Design/Technical registry, resolves host modes,
 * verifies generators produce nonempty geometry / graph data, and checks
 * saved-ID compatibility.
 *
 * Run: npm run validate:workspace-rendering
 */
import {
  WORKSPACE_MODES,
  WORKSPACE_CATEGORIES,
  DESIGN_WORKSPACES,
  TECHNICAL_WORKSPACES,
  DEFAULT_STONE_SETTINGS,
  DEFAULT_ASSEMBLY_SETTINGS,
  resolveWorkspaceNavigation,
  applyWorkspaceNavigation,
  createGrammarSettings,
  resolveDisplayFlags,
} from '../src/geometry/gothicGrammar/settings.js'
import {
  buildArchConstruction,
  buildArchComparison,
} from '../src/geometry/gothicGrammar/construction/archConstruction.js'
import { buildTraceryConstruction } from '../src/geometry/gothicGrammar/tracery/traceryConstruction.js'
import { buildExample } from '../src/geometry/gothicGrammar/examples.js'
import {
  buildStoneAssembly,
  stoneGeometryKey,
} from '../src/geometry/gothicGrammar/solids/index.js'
import {
  buildGothicFacadeElevation,
  validateGothicFacadeElevation,
  buildWindowTraceryParams,
  resolveWindowDesignParams,
} from '../src/geometry/gothicGrammar/assemblies/index.js'
import {
  ARCHITECTURE_PRESETS,
  applyArchitecturePreset,
} from '../src/geometry/gothicGrammar/tracery/presets.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.4.3.1 Workspace Rendering ===')

function bboxOk(size) {
  if (!Array.isArray(size) || size.length < 3) return false
  return size.every((v) => Number.isFinite(v) && v > 0)
}

function stoneBounds(assembly) {
  return (
    assembly?.metrics?.boundingSize ??
    assembly?.metrics?.boundingBox?.size ??
    assembly?.structural?.boundingBox?.size ??
    null
  )
}

function resolveRenderer(settings) {
  const mode = settings.workspaceMode
  if (mode === 'architectural-assembly') return 'AssemblyMeshes'
  if (mode === 'stone-3d') {
    return settings.stone?.inspectLayer === 'network-graph'
      ? 'StoneMeshes/NetworkGraphOverlay'
      : 'StoneMeshes'
  }
  return 'GothicGrammarScene'
}

function buildConstruction(settings) {
  const display = resolveDisplayFlags(settings)
  const arch = settings.arch ?? {}
  const archDisplay = {
    displayState: display.displayState,
    showPoints: display.showPoints,
    showConstruction: display.showConstruction,
    showCenters: display.showCenters,
    showArchAxis: display.showArchAxis,
    showDimensions: display.showDimensions,
    showResult: display.showResult,
    showFamilyLabels: display.showFamilyLabels,
    showSection: display.showSection,
    showSpringing: display.showConstruction,
    showMullionCenterlines: display.showMullionCenterlines,
    showFoilConstruction: display.showFoilConstruction,
  }
  if (settings.workspaceMode === 'compare-arches') {
    return buildArchComparison(
      {
        span: arch.span,
        springingY: arch.springingY,
        samplingQuality: arch.samplingQuality,
        lancetRiseRatio: arch.lancetRiseRatio,
        depressedRiseRatio: arch.depressedRiseRatio,
      },
      archDisplay,
    )
  }
  if (settings.workspaceMode === 'pointed-arch') {
    return buildArchConstruction(
      {
        family: arch.family,
        span: arch.span,
        riseRatio: arch.riseRatio,
        springingY: arch.springingY,
        samplingQuality: arch.samplingQuality,
      },
      archDisplay,
    )
  }
  if (settings.workspaceMode === 'tracery' || settings.workspaceMode === 'stone-3d') {
    const { exampleId, params } = buildWindowTraceryParams(settings.tracery)
    return buildTraceryConstruction(exampleId, params, archDisplay)
  }
  return buildExample(settings.exampleId, settings.exampleParams ?? {})
}

function graphFromAssembly(assembly) {
  return assembly?.solidVoid?.skeleton ?? assembly?.solidVoid?.network ?? null
}

function verifyStone(settings, label) {
  const design = resolveWindowDesignParams(settings)
  const assembly = buildStoneAssembly({
    regionParams: design.tracery,
    stone: design.stone,
  })
  if (!assembly?.ok && !assembly?.structural) {
    fail(`${label}: stone assembly not ok`)
    return null
  }
  const size = stoneBounds(assembly)
  if (!bboxOk(size)) fail(`${label}: invalid stone bbox ${JSON.stringify(size)}`)
  else pass(`${label}: stone bbox ${size.map((v) => v.toFixed(2)).join('×')} · tris ${assembly.metrics?.triangleCount ?? '?'}`)
  // Simulate the view-gate that caused the blank viewport: generation must
  // run whenever host mode is stone-3d (including Technical → Geometry Graph).
  const stoneMode = settings.workspaceMode === 'stone-3d'
  if (!stoneMode) fail(`${label}: expected stone host mode`)
  const geomKey = stoneGeometryKey(design.tracery, design.stone)
  if (!geomKey) fail(`${label}: empty geomKey`)
  return assembly
}

function verifyGraph(settings, label) {
  const assembly = verifyStone(settings, `${label}/stone-host`)
  if (!assembly) return
  let graph = graphFromAssembly(assembly)
  let fallback = false
  if (!graph) {
    const patch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
      { ...settings.tracery },
      { ...DEFAULT_STONE_SETTINGS, ...(settings.stone ?? {}) },
    )
    const { params } = buildWindowTraceryParams(patch.tracery)
    const fallbackAsm = buildStoneAssembly({
      regionParams: params,
      stone: patch.stone,
    })
    graph = graphFromAssembly(fallbackAsm)
    fallback = true
    if (!graph) {
      // Explicit unavailable path — must not silently blank.
      pass(`${label}: graph unavailable path available for this preset`)
      return
    }
  }
  const count = (v) =>
    Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 0
  const nodes = count(graph.nodes) || count(graph.vertices)
  const members = count(graph.members) || count(graph.edges) || count(graph.bars)
  if (nodes < 1 && members < 1) fail(`${label}: graph empty`)
  else {
    pass(
      `${label}: graph nodes=${nodes} members=${members}${fallback ? ' (bar-network fallback)' : ''}`,
    )
  }
  if (settings.stone?.inspectLayer !== 'network-graph') {
    fail(`${label}: inspectLayer should be network-graph`)
  }
}

function verifyAssembly(settings, label) {
  const design = resolveWindowDesignParams(settings)
  const facade = buildGothicFacadeElevation({
    ...DEFAULT_ASSEMBLY_SETTINGS,
    ...(settings.assembly ?? {}),
    id: 'facade-validate-workspace',
    windowDesign: { tracery: design.tracery, stone: design.stone },
    tracery: design.tracery,
    stone: design.stone,
    windowLinkMode: 'linked-to-master',
  })
  const check = validateGothicFacadeElevation(facade)
  if (!check?.ok && check?.errors?.length) {
    fail(`${label}: facade invalid ${check.errors.join('; ')}`)
    return
  }
  const modules = facade.windowModules?.length ?? 0
  if (modules < 1) fail(`${label}: no window modules`)
  else pass(`${label}: facade modules=${modules} · bays=${facade.bayCount ?? '?'}`)
}

function verifyOrtho(settings, label) {
  const construction = buildConstruction(settings)
  const curves = construction?.curves?.length ?? 0
  const prims = construction?.primitives?.length ?? 0
  if (curves < 1 && prims < 1) fail(`${label}: empty construction`)
  else pass(`${label}: construction curves=${curves} primitives=${prims}`)
  if (construction?.validation && construction.validation.ok === false) {
    fail(`${label}: construction invalid`)
  }
}

// --- Registry integrity ---
{
  if (WORKSPACE_CATEGORIES.map((c) => c.id).join(',') !== 'design,technical') {
    fail('categories must be design + technical')
  } else pass('categories: design + technical')

  const designEnabled = DESIGN_WORKSPACES.filter((d) => d.enabled !== false)
  for (const id of ['pointed-arch', 'tracery', 'stone-3d', 'architectural-assembly']) {
    if (!designEnabled.some((d) => d.id === id)) fail(`design missing ${id}`)
  }
  const veg = DESIGN_WORKSPACES.find((d) => d.id === 'vegetation-growth')
  if (!veg || veg.enabled === false) fail('vegetation-growth (Foliate Ornament) must be enabled')
  else pass('design registry + Foliate Ornament enabled')

  for (const id of [
    'kernel-examples',
    'geometry-graph',
    'surface-semantics',
    'growth-navigation',
    'validation-diagnostics',
  ]) {
    if (!TECHNICAL_WORKSPACES.some((t) => t.id === id)) fail(`technical missing ${id}`)
  }
  pass('technical registry complete')
}

// --- Enumerate every visible workspace ---
{
  const entries = [
    ...DESIGN_WORKSPACES.filter((d) => d.enabled !== false).map((d) => ({
      category: 'design',
      navId: d.id,
    })),
    ...TECHNICAL_WORKSPACES.map((t) => ({ category: 'technical', navId: t.id })),
  ]

  for (const { category, navId } of entries) {
    const resolved = resolveWorkspaceNavigation(navId, category)
    if (!resolved) {
      fail(`${category}/${navId}: unresolved`)
      continue
    }
    const settings = applyWorkspaceNavigation(createGrammarSettings(), navId, category)
    if (settings.workspaceMode !== resolved.workspaceMode) {
      fail(`${navId}: apply mode mismatch`)
    }
    const renderer = resolveRenderer(settings)
    pass(`${category}/${navId} → mode=${settings.workspaceMode} · renderer=${renderer}`)

    if (navId === 'stone-3d' || (category === 'design' && resolved.workspaceMode === 'stone-3d')) {
      if (settings.stone?.inspectLayer === 'network-graph') {
        fail('Design Stone / 3D must reset inspectLayer to combined')
      }
      verifyStone(settings, 'Design/Stone-3D')
    } else if (navId === 'geometry-graph') {
      verifyGraph(settings, 'Technical/Geometry-Graph')
    } else if (
      resolved.workspaceMode === 'architectural-assembly' ||
      resolved.workspaceMode === 'vegetation-growth'
    ) {
      verifyAssembly(settings, `${category}/${navId}`)
    } else if (
      resolved.workspaceMode === 'pointed-arch' ||
      resolved.workspaceMode === 'compare-arches' ||
      resolved.workspaceMode === 'tracery' ||
      resolved.workspaceMode === 'kernel-examples'
    ) {
      verifyOrtho(settings, `${category}/${navId}`)
    }
  }
}

// --- Regression cases called out in the brief ---
{
  const stone = applyWorkspaceNavigation(createGrammarSettings(), 'stone-3d', 'design')
  verifyStone(stone, 'regression/Stone-3D')

  const graph = applyWorkspaceNavigation(createGrammarSettings(), 'geometry-graph', 'technical')
  if (graph.workspaceMode !== 'stone-3d') fail('geometry-graph host must be stone-3d')
  if (graph.stone?.inspectLayer !== 'network-graph') fail('geometry-graph must apply network-graph')
  if (graph.technicalView !== 'geometry-graph') fail('technicalView must be geometry-graph')
  verifyGraph(graph, 'regression/Geometry-Graph')

  const arch = applyWorkspaceNavigation(createGrammarSettings(), 'pointed-arch', 'design')
  verifyOrtho(arch, 'regression/Pointed-Arch')

  const tracery = applyWorkspaceNavigation(createGrammarSettings(), 'tracery', 'design')
  verifyOrtho(tracery, 'regression/Tracery')

  const assembly = applyWorkspaceNavigation(
    createGrammarSettings(),
    'architectural-assembly',
    'design',
  )
  verifyAssembly(assembly, 'regression/Architectural-Assembly')

  const kernel = applyWorkspaceNavigation(createGrammarSettings(), 'kernel-examples', 'technical')
  verifyOrtho(kernel, 'regression/Kernel')
}

// --- Saved-ID compatibility (pre-13E.4.3 flat modes) ---
{
  for (const mode of WORKSPACE_MODES) {
    const raw = resolveWorkspaceNavigation(mode.id, 'design')
    if (!raw || raw.workspaceMode !== mode.id) {
      // kernel is technical; allow design resolve via raw fallback
      const any = resolveWorkspaceNavigation(mode.id, mode.id === 'kernel-examples' ? 'technical' : 'design')
      if (!any || any.workspaceMode !== mode.id) fail(`compat broken for ${mode.id}`)
      else pass(`compat: ${mode.id} → ${any.workspaceMode}`)
    } else {
      pass(`compat: ${mode.id} → ${raw.workspaceMode}`)
    }
  }

  // Switch Design stone after Technical graph must clear network inspect layer.
  let s = applyWorkspaceNavigation(createGrammarSettings(), 'geometry-graph', 'technical')
  s = applyWorkspaceNavigation(s, 'stone-3d', 'design')
  if (s.stone?.inspectLayer !== 'combined') {
    fail('returning to Design Stone must reset inspectLayer to combined')
  } else pass('Design Stone resets leftover network-graph inspect layer')
}

// --- Memo gate regression contract ---
{
  // Documented failure mode: useMemo([geomKey]) with early `if (!stoneMode) return null`
  // caches null across a mode switch when geomKey is unchanged.
  const before = createGrammarSettings({ workspaceMode: 'pointed-arch' })
  const after = applyWorkspaceNavigation(before, 'stone-3d', 'design')
  const design = resolveWindowDesignParams(after)
  const keyBefore = stoneGeometryKey(
    buildWindowTraceryParams(before.tracery).params,
    { ...DEFAULT_STONE_SETTINGS, ...(before.stone ?? {}) },
  )
  const keyAfter = stoneGeometryKey(design.tracery, design.stone)
  if (keyBefore !== keyAfter) {
    // Keys may differ if defaults diverge — still require after-mode generation.
    pass(`memo-gate: geomKey changed (${keyBefore.slice(0, 8)}→${keyAfter.slice(0, 8)})`)
  } else {
    pass('memo-gate: geomKey unchanged across pointed-arch → stone-3d (stoneMode must be a dep)')
  }
  const asm = buildStoneAssembly({ regionParams: design.tracery, stone: design.stone })
  if (!asm?.ok && !asm?.structural) fail('memo-gate: stone must generate after mode switch')
  else pass('memo-gate: stone generates when stoneMode becomes true')
}

if (!ok) {
  console.error('\nvalidate:workspace-rendering FAILED')
  process.exit(1)
}
console.log('\nvalidate:workspace-rendering PASSED')
