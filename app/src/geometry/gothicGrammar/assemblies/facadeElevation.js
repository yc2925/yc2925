/**
 * Gothic facade elevation — repeated bays + shared piers (Step 13E.1).
 *
 * Placement (N bays, origin-centered):
 *   pitch = bayWidth + pierWidth + baySpacing
 *   bayCenterX(i) = ((i - (N-1)/2) * pitch)
 *   pierX(j)     = bayCenterX(0) - bayWidth/2 - pierWidth/2 + j * pitch
 *                 for j = 0..N  (N+1 shared piers, no duplicates)
 *
 * Variation:
 *   uniform          — all bays share span/scale
 *   symmetric        — bay i mirrors bay N-1-i parameters
 *   center-emphasis  — central bay (odd N) or central pair (even N) scaled up
 */

import { nextId } from '../kernel/result.js'
import {
  generateGothicWindowModule,
  clearWindowModuleCache,
} from './windowModule.js'
import { buildPierSupport, buildBaseCourse } from './pierSupport.js'
import {
  buildArticulatedSupport,
  measureSupportSemantics,
} from './articulatedSupport.js'
import {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  DEFAULT_ASSEMBLY_PARAMS,
} from './assemblyTypes.js'

export {
  ASSEMBLY_TYPES,
  VARIATION_MODES,
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  DEFAULT_ASSEMBLY_PARAMS,
}

/**
 * Deterministic bay / pier abscissae centered on the assembly origin.
 */
export function computeBayLayout(params = {}) {
  const p = { ...DEFAULT_ASSEMBLY_PARAMS, ...params }
  const N = Math.max(1, Math.min(7, Math.round(p.bayCount)))
  const bayWidth = Math.max(0.8, p.bayWidth)
  const pierWidth = Math.max(0.08, p.pierWidth)
  const baySpacing = Math.max(0, p.baySpacing)
  const pitch = bayWidth + pierWidth + baySpacing
  const bayCenters = []
  for (let i = 0; i < N; i += 1) {
    bayCenters.push((i - (N - 1) / 2) * pitch)
  }
  const pierXs = []
  for (let j = 0; j <= N; j += 1) {
    // Pier j sits on the left boundary of bay j (and right of bay N-1 for j=N)
    const leftOfFirst = bayCenters[0] - bayWidth * 0.5 - pierWidth * 0.5
    pierXs.push(leftOfFirst + j * pitch)
  }
  const assemblyWidth = N * bayWidth + (N + 1) * pierWidth + (N - 1) * baySpacing
  return {
    bayCount: N,
    bayWidth,
    pierWidth,
    baySpacing,
    pitch,
    bayCenters,
    pierXs,
    assemblyWidth,
  }
}

/**
 * Resolve per-bay window scale under the active variation mode.
 * Even-N center emphasis: central pair (indices N/2-1 and N/2) share the boost.
 */
export function resolveBayScales(bayCount, variationMode, baseScale, centerEmphasisScale = 1.18) {
  const N = bayCount
  const scales = Array.from({ length: N }, () => baseScale)
  if (variationMode === VARIATION_MODES.CENTER_EMPHASIS) {
    const boost = baseScale * centerEmphasisScale
    if (N % 2 === 1) {
      scales[(N - 1) / 2] = boost
    } else {
      // Documented central-pair rule
      scales[N / 2 - 1] = boost
      scales[N / 2] = boost
    }
  } else if (variationMode === VARIATION_MODES.SYMMETRIC) {
    // Symmetric: outer bays slightly reduced, mirrored
    for (let i = 0; i < Math.floor(N / 2); i += 1) {
      const t = i / Math.max(1, Math.floor(N / 2) - 1 || 1)
      const s = baseScale * (0.92 + 0.08 * (1 - t))
      scales[i] = s
      scales[N - 1 - i] = s
    }
    if (N % 2 === 1) scales[(N - 1) / 2] = baseScale
  }
  return scales
}

function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  }
}

function expandBounds(b, min, max) {
  for (let i = 0; i < 3; i += 1) {
    if (min[i] < b.min[i]) b.min[i] = min[i]
    if (max[i] > b.max[i]) b.max[i] = max[i]
  }
}

/**
 * Build full facade / bay assembly graph.
 */
export function buildGothicFacadeElevation(params = {}) {
  const p = { ...DEFAULT_ASSEMBLY_PARAMS, ...params }
  // Single-bay forces N=1; repeated/facade use bayCount
  if (p.assemblyType === ASSEMBLY_TYPES.SINGLE_BAY) p.bayCount = 1

  const layout = computeBayLayout(p)
  const N = layout.bayCount
  const scales = resolveBayScales(
    N,
    p.variationMode,
    p.windowScale,
    p.centerEmphasisScale,
  )
  const assemblyId = params.id ?? nextId('facade')
  const groundY = p.groundElevation

  const bays = []
  const windowModules = []
  const supports = []
  const errors = []
  const warnings = []
  let estimatedVolume = 0
  const bounds = emptyBounds()

  // Shared window design (13E.3.2): when windowDesign / tracery+stone provided,
  // modules consume them without re-applying local hierarchical defaults.
  const hasSharedDesign = Boolean(
    p.windowDesign ||
      (p.tracery && Object.keys(p.tracery).length > 0) ||
      (p.stone && Object.keys(p.stone).length > 0),
  )
  const designSpan =
    p.windowDesign?.tracery?.span ??
    p.tracery?.span ??
    null
  // Fit shared module into bay clear width while preserving design proportions.
  const bayFit =
    designSpan && designSpan > 0 ? p.bayWidth / designSpan : 1

  // Window modules (geometry reuse via cache key)
  for (let i = 0; i < N; i += 1) {
    const bayId = `${assemblyId}-bay-${String(i + 1).padStart(2, '0')}`
    const cx = layout.bayCenters[i]
    const module = generateGothicWindowModule({
      id: `${bayId}-window`,
      parentAssemblyId: bayId,
      windowDesign: p.windowDesign,
      // Absolute layout span when no shared design (legacy Assembly path).
      span: hasSharedDesign ? undefined : p.bayWidth,
      windowScale: hasSharedDesign ? scales[i] * bayFit : scales[i],
      hierarchicalDepth: hasSharedDesign
        ? (p.windowDesign?.tracery?.hierarchicalDepth ??
          p.tracery?.hierarchicalDepth ??
          p.hierarchicalDepth)
        : p.hierarchicalDepth,
      stoneDepth: hasSharedDesign
        ? (p.windowDesign?.stone?.stoneDepth ?? p.stone?.stoneDepth ?? p.stoneDepth)
        : p.stoneDepth,
      tracery: p.windowDesign ? undefined : p.tracery,
      stone: p.windowDesign ? undefined : p.stone,
      useLegacyAssemblyDefaults: !hasSharedDesign,
      linkMode: p.windowLinkMode ?? 'linked-to-master',
      useCache: true,
    })
    module.transform.position = [cx, 0, 0]
    // Module structural watertightness is authoritative; known 13D strip-union
    // may report sparse degenerate faces while remaining watertight/manifold.
    if (!module.semantic.watertight) {
      errors.push(`bay ${i}: window module not watertight`)
    }
    if ((module.semantic.nonManifoldEdgeCount ?? 0) !== 0) {
      errors.push(`bay ${i}: window module non-manifold`)
    }
    if (!module.validation.ok) {
      const soft = (module.validation.errors ?? []).filter((e) =>
        /degenerate triangles/i.test(e),
      )
      const hard = (module.validation.errors ?? []).filter(
        (e) => !/degenerate triangles/i.test(e),
      )
      if (soft.length) {
        warnings.push(`bay ${i}: ${soft.join('; ')} (watertight module; noted)`)
      }
      if (hard.length) errors.push(`bay ${i}: ${hard.join('; ')}`)
    }
    if (module.semantic.structuralVolume) {
      estimatedVolume += module.semantic.structuralVolume
    }
    const size = module.boundingBox.size ?? [module.span, module.height, p.stoneDepth]
    const min = [cx - size[0] * 0.5, groundY, -size[2] * 0.5]
    const max = [cx + size[0] * 0.5, groundY + size[1], size[2] * 0.5]
    if (module.boundingBox.min && module.boundingBox.max) {
      expandBounds(bounds, [
        module.boundingBox.min[0] + cx,
        module.boundingBox.min[1],
        module.boundingBox.min[2],
      ], [
        module.boundingBox.max[0] + cx,
        module.boundingBox.max[1],
        module.boundingBox.max[2],
      ])
    } else {
      expandBounds(bounds, min, max)
    }

    const bay = {
      type: 'ARCHITECTURAL_BAY',
      id: bayId,
      parentAssemblyId: assemblyId,
      bayIndex: i,
      bayWidth: layout.bayWidth,
      bayHeight: module.height,
      localOrigin: [cx, 0, 0],
      leftBoundaryX: cx - layout.bayWidth * 0.5,
      rightBoundaryX: cx + layout.bayWidth * 0.5,
      sillElevation: module.windowBaseElevation,
      springingElevation: module.springingElevation,
      windowModuleId: module.id,
      leftPierId: `${assemblyId}-pier-${String(i).padStart(2, '0')}`,
      rightPierId: `${assemblyId}-pier-${String(i + 1).padStart(2, '0')}`,
      windowScale: scales[i],
    }
    bays.push(bay)
    windowModules.push(module)
  }

  // Shared piers (N+1) — skip when supports hidden
  const pierHeight =
    p.pierHeight ??
    Math.max(
      ...windowModules.map((m) => m.height || 3),
      2.5,
    )
  if (p.showStructuralSupports !== false) {
    const style = p.supportStyle ?? SUPPORT_STYLES.SIMPLE
    for (let j = 0; j < layout.pierXs.length; j += 1) {
      const pierId = `${assemblyId}-pier-${String(j).padStart(2, '0')}`
      const common = {
        id: pierId,
        parentAssemblyId: assemblyId,
        x: layout.pierXs[j],
        pierWidth: layout.pierWidth,
        pierDepth: p.pierDepth,
        pierHeight,
        buttressProjection: p.buttressProjection,
        groundY,
        supportStyle: style,
        shaftArrangement: p.shaftArrangement,
        shaftRadiusRatio: p.shaftRadiusRatio,
        shaftProjection: p.shaftProjection,
        baseHeight: p.baseHeight,
        capitalHeight: p.capitalHeight,
        buttressSetbackCount: p.buttressSetbackCount,
        buttressSetbackRatio: p.buttressSetbackRatio,
        showBases: p.showBases,
        showCapitalTransitions: p.showCapitalTransitions,
      }
      const pier =
        style === SUPPORT_STYLES.SIMPLE
          ? buildPierSupport(common)
          : buildArticulatedSupport(common)
      if (!pier?.validation?.ok) {
        errors.push(...(pier?.validation?.errors ?? [`${pierId}: support build failed`]))
      }
      estimatedVolume += pier?.volume ?? 0
      for (const part of pier?.parts ?? []) {
        expandBounds(bounds, part.boundingMin, part.boundingMax)
      }
      supports.push(pier)
    }
  }

  const base = buildBaseCourse({
    id: `${assemblyId}-base`,
    parentAssemblyId: assemblyId,
    width: layout.assemblyWidth + layout.pierWidth * 0.5,
    height: 0.18,
    depth: Math.max(p.pierDepth, p.stoneDepth) + p.buttressProjection * 0.5,
    groundY,
  })
  if (!base.validation.ok) errors.push(...base.validation.errors)
  estimatedVolume += base.volume
  for (const part of base.parts) {
    expandBounds(bounds, part.boundingMin, part.boundingMax)
  }

  // Non-intersection: pier centers must lie outside window clear spans
  for (let i = 0; i < N; i += 1) {
    const bay = bays[i]
    const clearHalf = (windowModules[i].span * 0.92) * 0.5
    for (const pier of supports) {
      if (Math.abs(pier.x - layout.bayCenters[i]) < clearHalf - layout.pierWidth * 0.45) {
        warnings.push(
          `${pier.id} may encroach bay ${bay.id} clear opening (check pierWidth / bayWidth)`,
        )
      }
    }
  }

  const assemblyHeight = bounds.max[1] - bounds.min[1]
  const assemblyWidth = bounds.max[0] - bounds.min[0]
  const assemblyDepth = bounds.max[2] - bounds.min[2]

  const graph = {
    id: assemblyId,
    type: 'FACADE',
    children: [
      ...bays.map((b) => ({
        id: b.id,
        type: 'BAY',
        children: [
          { id: b.windowModuleId, type: 'WINDOW_MODULE' },
          { id: b.leftPierId, type: 'LEFT_BOUNDARY' },
          { id: b.rightPierId, type: 'RIGHT_BOUNDARY' },
        ],
      })),
      {
        id: `${assemblyId}-supports`,
        type: 'STRUCTURAL_SUPPORTS',
        children: supports.map((s) => ({ id: s.id, type: 'PIER_SUPPORT' })),
      },
      { id: base.id, type: 'BASE_COURSE' },
    ],
  }

  return {
    ok: errors.length === 0,
    type: 'GOTHIC_FACADE_ELEVATION',
    id: assemblyId,
    parameters: { ...p, bayCount: N },
    layout,
    variationScales: scales,
    bays,
    windowModules,
    supports,
    baseCourse: base,
    graph,
    metrics: {
      bayCount: N,
      windowModuleCount: windowModules.length,
      structuralSupportCount: supports.length,
      pierCount: supports.length,
      assemblyWidth,
      assemblyHeight,
      assemblyDepth,
      estimatedStoneVolume: estimatedVolume,
      cacheHits: windowModules.filter((m) => m.fromCache).length,
      uniqueGeometries: new Set(windowModules.map((m) => m.geometryRef)).size,
      boundingMin: bounds.min,
      boundingMax: bounds.max,
      boundingSize: [assemblyWidth, assemblyHeight, assemblyDepth],
      // Live articulation diagnostics (first shared pier) — UI reactivity feedback
      articulation: measureSupportSemantics(supports[0]),
      supportStyle: p.supportStyle ?? SUPPORT_STYLES.SIMPLE,
    },
    validation: { ok: errors.length === 0, errors, warnings },
    metadata: {
      title: `Gothic Facade · ${N} bay${N === 1 ? '' : 's'}`,
      version: '13E.1',
      grammarStage: '13E.1',
      references: ['REF-004', 'REF-008', 'REF-011', 'REF-016', 'REF-007'],
      note: 'Repeated 13D.9 window modules + shared pier placeholders; multi-object assembly.',
      representation: 'multi-object-assembly',
    },
  }
}

export function validateGothicFacadeElevation(assembly) {
  const errors = []
  const warnings = [...(assembly?.validation?.warnings ?? [])]
  if (!assembly?.ok) {
    return {
      ok: false,
      errors: [...(assembly?.validation?.errors ?? ['assembly invalid'])],
      warnings,
    }
  }
  const N = assembly.metrics?.bayCount
  if (!(N >= 1 && N <= 7)) errors.push(`bayCount ${N} out of range 1–7`)
  if (assembly.windowModules?.length !== N) {
    errors.push('window module count ≠ bay count')
  }
  if (assembly.parameters?.showStructuralSupports !== false) {
    if (assembly.supports?.length !== N + 1) {
      errors.push(`expected ${N + 1} shared piers, got ${assembly.supports?.length}`)
    }
    // Duplicate pier X check
    const xs = (assembly.supports ?? []).map((s) => s.x)
    const uniq = new Set(xs.map((x) => x.toFixed(6)))
    if (uniq.size !== xs.length) errors.push('duplicate pier abscissae')
  }
  // Deterministic layout recompute
  const layout = computeBayLayout(assembly.parameters)
  for (let i = 0; i < N; i += 1) {
    if (Math.abs(layout.bayCenters[i] - assembly.layout.bayCenters[i]) > 1e-9) {
      errors.push(`bay ${i} center mismatch`)
    }
  }
  for (const m of assembly.windowModules ?? []) {
    if (m.semantic?.watertight !== true) {
      errors.push(`module ${m.id} not watertight`)
    }
    if ((m.semantic?.nonManifoldEdgeCount ?? 0) !== 0) {
      errors.push(`module ${m.id} non-manifold`)
    }
    if (!m.validation?.ok) {
      const hard = (m.validation?.errors ?? []).filter(
        (e) => !/degenerate triangles/i.test(e),
      )
      if (hard.length) errors.push(`module ${m.id} invalid: ${hard.join('; ')}`)
    }
  }
  // Stable IDs
  const ids = new Set()
  for (const b of assembly.bays ?? []) {
    if (ids.has(b.id)) errors.push(`duplicate bay id ${b.id}`)
    ids.add(b.id)
  }
  for (const m of assembly.windowModules ?? []) {
    if (ids.has(m.id)) errors.push(`duplicate module id ${m.id}`)
    ids.add(m.id)
  }
  for (const s of assembly.supports ?? []) {
    if (ids.has(s.id)) errors.push(`duplicate support id ${s.id}`)
    ids.add(s.id)
  }
  return { ok: errors.length === 0, errors, warnings }
}

export { clearWindowModuleCache }
