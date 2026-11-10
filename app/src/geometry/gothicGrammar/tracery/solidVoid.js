/**
 * Constructible solid / void region model for composed Gothic windows (Step 13C.1).
 *
 * Topology (no general boolean engine):
 *   STONE_REGION = OUTER_BOUNDARY with holes
 *     { LEFT_LANCET_VOID, RIGHT_LANCET_VOID, UPPER_FOIL_VOID }
 *
 * Oculus remains construction geometry only — not a second hole at the foil.
 *
 * Exact circular arcs are preserved on each loop; sampled polylines are derived
 * for area, containment, and SECTION mesh display.
 */

import { point } from '../kernel/vector2.js'
import { createSegment } from '../kernel/line2.js'
import { nextId } from '../kernel/result.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { buildComposedWindow, DEFAULT_COMPOSED_PARAMS, buildFoilExample } from './composedWindow.js'
import { REGION_TYPES, DEFAULT_REGION_PARAMS, structuralHoleKeys } from './regionRoles.js'
import {
  closedLoopFromArch,
  buildOuterBoundaryLoop,
  ensureCw,
  ensureCcw,
  sampleLoop,
  loopArea,
  regionFromLoops,
} from './openingLoops.js'
import {
  evaluateClearances,
  voidsOverlap,
  openingsInsideOuter,
  measuredMullionWidth,
} from './clearance.js'
import { buildUpperSpandrelOpenings } from './spandrelOpenings.js'
import { buildBarNetworkSolidVoid } from './barNetworkStone.js'
import { buildElaborateSolidVoid } from './elaborate/elaborateSolidVoid.js'
import { buildSkeletonSolidVoid } from './skeleton/skeletonStone.js'
import { validateClosure, windingOrientation } from '../kernel/planarRegions.js'

const SAMPLE_OPTS = { segments: 28 }

function makeRegionRecord(partial) {
  return {
    id: partial.id ?? nextId('region'),
    type: partial.type,
    semantic: partial.type,
    parentId: partial.parentId ?? null,
    childIds: [...(partial.childIds ?? [])],
    edges: [...(partial.edges ?? [])],
    samples: partial.samples ?? sampleLoop(partial.edges ?? [], SAMPLE_OPTS),
    area: partial.area ?? loopArea(partial.edges ?? [], SAMPLE_OPTS),
    orientation: partial.orientation ?? null,
    source: { ...(partial.source ?? {}) },
    parameters: { ...(partial.parameters ?? {}) },
    derived: { ...(partial.derived ?? {}) },
    validation: {
      ok: true,
      errors: [],
      warnings: [],
      ...(partial.validation ?? {}),
    },
  }
}

/**
 * Quatrefoil / trefoil as a single ordered void loop (exact arcs).
 * Rejects overlapping-circle-only representations.
 */
export function foilToVoidLoop(foil) {
  if (!foil?.validation?.ok) {
    return { ok: false, errors: foil?.validation?.errors ?? ['invalid foil'], edges: [] }
  }
  if (!foil.arcs?.length) {
    return { ok: false, errors: ['foil has no exact arcs'], edges: [] }
  }
  // Must be one ordered loop of arcs — not four independent circles as the opening.
  // Cusped foils already passed Step 13C validation (closure + non-adjacent arc checks).
  // Sampled polyline self-intersection is unreliable at intentional cusps — do not re-litigate it.
  const edges = [...foil.arcs]
  const scale = foil.parameters?.size ?? 1
  const closure = validateClosure(edges, scale)
  const oriented = ensureCw(edges, SAMPLE_OPTS)
  const errors = []
  if (!closure.ok) errors.push(`foil void not closed: ${closure.reason}`)
  if (!foil.validation.rotationalSymmetry?.ok && foil.lobeCount === 4) {
    errors.push('quatrefoil fourfold symmetry failed')
  }

  return {
    ok: errors.length === 0,
    errors,
    edges: oriented.edges,
    signedArea: oriented.signedArea,
    orientation: windingOrientation(oriented.edges, SAMPLE_OPTS),
    closure,
    foil,
  }
}

/**
 * Measurable central mullion polygon between child openings.
 */
export function buildMullionRegion(leftChild, rightChild, baseY, topY) {
  const lB = leftChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rA = rightChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  if (!lB || !rA) return { ok: false, errors: ['missing child springings'], edges: [] }
  const width = rA.x - lB.x
  if (!(width > 0)) return { ok: false, errors: ['non-positive mullion width'], edges: [] }
  const yTop = Math.min(
    topY ?? Math.min(
      leftChild.points[ARCH_SEMANTICS.APEX]?.y ?? lB.y + 1,
      rightChild.points[ARCH_SEMANTICS.APEX]?.y ?? rA.y + 1,
    ),
    Math.min(
      leftChild.points[ARCH_SEMANTICS.APEX]?.y ?? Infinity,
      rightChild.points[ARCH_SEMANTICS.APEX]?.y ?? Infinity,
    ),
  )
  if (!(yTop > baseY)) {
    return { ok: false, errors: ['mullion vertical extent invalid'], edges: [] }
  }
  const bl = point(lB.x, baseY)
  const br = point(rA.x, baseY)
  const tr = point(rA.x, yTop)
  const tl = point(lB.x, yTop)
  // CCW
  const edges = [
    createSegment(bl, br),
    createSegment(br, tr),
    createSegment(tr, tl),
    createSegment(tl, bl),
  ]
  const oriented = ensureCcw(edges, SAMPLE_OPTS)
  return {
    ok: true,
    errors: [],
    edges: oriented.edges,
    width,
    yTop,
    baseY,
    corners: { bl, br, tr, tl },
  }
}

/**
 * Build solid/void model from a composed-window (or subdivision) tracery graph.
 * When `enableBarNetwork` is true, delegates to the Step 13D.3 bar-network path.
 */
export function buildSolidVoidModel(params = {}) {
  if (params.enableOculusNetwork === true || params.enableSkeleton === true) {
    return buildSkeletonSolidVoid(params)
  }
  if (params.enableElaborate === true) {
    return buildElaborateSolidVoid(params)
  }
  if (params.enableBarNetwork === true) {
    return buildBarNetworkSolidVoid(params)
  }

  const regionParams = {
    ...DEFAULT_REGION_PARAMS,
    outerFrameWidth: params.outerFrameWidth ?? DEFAULT_REGION_PARAMS.outerFrameWidth,
    windowBaseElevation: params.windowBaseElevation ?? DEFAULT_REGION_PARAMS.windowBaseElevation,
    minStoneWebWidth: params.minStoneWebWidth ?? DEFAULT_REGION_PARAMS.minStoneWebWidth,
    enableSpandrelOpenings:
      params.enableSpandrelOpenings ?? DEFAULT_REGION_PARAMS.enableSpandrelOpenings,
    upperOpeningScale: params.upperOpeningScale ?? DEFAULT_REGION_PARAMS.upperOpeningScale,
    secondaryTraceryWidth:
      params.secondaryTraceryWidth ?? DEFAULT_REGION_PARAMS.secondaryTraceryWidth,
  }

  const composed = buildComposedWindow({
    ...DEFAULT_COMPOSED_PARAMS,
    ...params,
  })

  if (!composed.validation?.ok) {
    return invalidModel(regionParams, composed, composed.validation?.errors ?? ['composition invalid'])
  }

  const parent = composed.metadata.parent
  const leftChild = composed.metadata.leftChild
  const rightChild = composed.metadata.rightChild
  const foil = composed.metadata.foil
  const baseY = regionParams.windowBaseElevation

  // --- Outer boundary (frame) ---
  const outer = buildOuterBoundaryLoop(
    {
      family: parent.parameters.family,
      span: parent.parameters.span,
      riseRatio: parent.parameters.riseRatio,
      springingY: parent.parameters.springingY,
      samplingQuality: parent.parameters.samplingQuality,
      offsetX: parent.parameters.offsetX ?? 0,
    },
    regionParams.outerFrameWidth,
    baseY,
  )
  if (!outer.ok) {
    return invalidModel(regionParams, composed, outer.errors)
  }

  // --- Lancet voids (child arches as clear opening edges) ---
  const leftLoop = closedLoopFromArch(leftChild, baseY)
  const rightLoop = closedLoopFromArch(rightChild, baseY)
  if (!leftLoop.ok || !rightLoop.ok) {
    return invalidModel(regionParams, composed, [
      ...(leftLoop.errors ?? []),
      ...(rightLoop.errors ?? []),
    ])
  }
  const leftVoid = { ...ensureCw(leftLoop.edges, SAMPLE_OPTS), id: 'left-lancet' }
  leftVoid.edges = leftVoid.edges
  const rightVoid = { ...ensureCw(rightLoop.edges, SAMPLE_OPTS), id: 'right-lancet' }
  rightVoid.edges = rightVoid.edges

  // --- Foil void (single cusped loop; oculus is NOT a hole) ---
  const foilLoop = foilToVoidLoop(foil)
  if (!foilLoop.ok) {
    return invalidModel(regionParams, composed, foilLoop.errors)
  }
  const foilVoid = { id: 'upper-foil', edges: foilLoop.edges }

  // --- Optional upper spandrel openings (Step 13D.2) ---
  const oculusMeta = composed.metadata?.oculus
  const spandrel = buildUpperSpandrelOpenings({
    parent,
    oculus: oculusMeta,
    foil,
    leftLancetEdges: leftVoid.edges,
    rightLancetEdges: rightVoid.edges,
    secondaryWeb: regionParams.secondaryTraceryWidth,
    upperOpeningScale: regionParams.upperOpeningScale,
    minWeb: regionParams.minStoneWebWidth,
    enabled: regionParams.enableSpandrelOpenings === true,
  })

  const spandrelWarnings = [...(spandrel.warnings ?? [])]
  // When enabled but construction fails: report, do not force invalid holes.
  if (regionParams.enableSpandrelOpenings && !spandrel.ok) {
    spandrelWarnings.push(...(spandrel.errors ?? ['spandrel openings failed']))
  }
  const spandrelOpenings = spandrel.ok ? spandrel.openings : []

  const voidLoops = [
    { id: REGION_TYPES.LEFT_LANCET_VOID, edges: leftVoid.edges },
    { id: REGION_TYPES.RIGHT_LANCET_VOID, edges: rightVoid.edges },
    { id: REGION_TYPES.UPPER_FOIL_VOID, edges: foilVoid.edges },
    ...spandrelOpenings.map((o) => ({ id: o.id, edges: o.edges })),
  ]

  // Containment / overlap
  const inside = openingsInsideOuter(outer.edges, voidLoops)
  const overlap = voidsOverlap(voidLoops)

  // Mullion measurable region
  const mullion = buildMullionRegion(leftChild, rightChild, baseY)

  // Stone region = outer with holes (constructive, not CSG boolean)
  const holeEdgeLists = voidLoops.map((v) => v.edges)
  const stoneBuild = regionFromLoops(outer.edges, holeEdgeLists, SAMPLE_OPTS)

  const clearances = evaluateClearances(
    { parentArch: parent, leftChild, rightChild, foil },
    regionParams.minStoneWebWidth,
  )

  const outerArea = loopArea(outer.edges, SAMPLE_OPTS)
  const leftArea = loopArea(leftVoid.edges, SAMPLE_OPTS)
  const rightArea = loopArea(rightVoid.edges, SAMPLE_OPTS)
  const foilArea = loopArea(foilVoid.edges, SAMPLE_OPTS)
  const spandrelAreas = spandrelOpenings.map((o) => loopArea(o.edges, SAMPLE_OPTS))
  const spandrelAreaSum = spandrelAreas.reduce((a, b) => a + b, 0)
  const openingArea = leftArea + rightArea + foilArea + spandrelAreaSum
  const solidArea = Math.max(0, outerArea - openingArea)
  // Area consistency: solid ≈ |outer| - sum(|holes|) for nested holes
  const areaResidual = Math.abs(solidArea - (outerArea - openingArea))

  const errors = []
  const warnings = [...clearances.warnings, ...spandrelWarnings]
  if (!inside.ok) errors.push('opening escapes outer boundary')
  if (!overlap.ok) errors.push('opening regions overlap')
  if (!stoneBuild.ok) errors.push(`stone region invalid: ${stoneBuild.reason}`)
  if (!mullion.ok) errors.push(...(mullion.errors ?? ['mullion invalid']))
  errors.push(...clearances.errors)

  // Connectivity: single stone region with holes — no islands by construction
  const connected = stoneBuild.ok && errors.filter((e) => e.includes('overlap') || e.includes('escapes')).length === 0

  const regions = {
    [REGION_TYPES.OUTER_BOUNDARY]: makeRegionRecord({
      id: 'outer-boundary',
      type: REGION_TYPES.OUTER_BOUNDARY,
      edges: outer.edges,
      area: outerArea,
      orientation: outer.orientation,
      source: { arch: outer.arch, kind: 'outer-frame-arch' },
      parameters: {
        outerFrameWidth: regionParams.outerFrameWidth,
        windowBaseElevation: baseY,
        clearSpan: parent.parameters.span,
      },
      validation: { ok: outer.ok, errors: outer.errors ?? [] },
    }),
    [REGION_TYPES.LEFT_LANCET_VOID]: makeRegionRecord({
      id: 'left-lancet-void',
      type: REGION_TYPES.LEFT_LANCET_VOID,
      edges: leftVoid.edges,
      area: leftArea,
      orientation: windingOrientation(leftVoid.edges, SAMPLE_OPTS),
      source: { arch: leftChild, interpretation: 'clear-opening-edge' },
      parentId: 'stone-region',
      validation: { ok: leftLoop.ok, errors: leftLoop.errors ?? [] },
    }),
    [REGION_TYPES.RIGHT_LANCET_VOID]: makeRegionRecord({
      id: 'right-lancet-void',
      type: REGION_TYPES.RIGHT_LANCET_VOID,
      edges: rightVoid.edges,
      area: rightArea,
      orientation: windingOrientation(rightVoid.edges, SAMPLE_OPTS),
      source: { arch: rightChild, interpretation: 'clear-opening-edge' },
      parentId: 'stone-region',
      validation: { ok: rightLoop.ok, errors: rightLoop.errors ?? [] },
    }),
    [REGION_TYPES.UPPER_FOIL_VOID]: makeRegionRecord({
      id: 'upper-foil-void',
      type: REGION_TYPES.UPPER_FOIL_VOID,
      edges: foilVoid.edges,
      area: foilArea,
      orientation: foilLoop.orientation,
      source: {
        foil,
        note: 'Single cusped loop; oculus is construction-only, not a hole',
      },
      parentId: 'stone-region',
      validation: { ok: foilLoop.ok, errors: foilLoop.errors ?? [] },
    }),
    [REGION_TYPES.CENTRAL_MULLION]: makeRegionRecord({
      id: 'central-mullion',
      type: REGION_TYPES.CENTRAL_MULLION,
      edges: mullion.edges ?? [],
      area: mullion.ok ? loopArea(mullion.edges, SAMPLE_OPTS) : 0,
      orientation: mullion.ok ? windingOrientation(mullion.edges, SAMPLE_OPTS) : null,
      source: { measuredWidth: mullion.width },
      parameters: { width: mullion.width },
      derived: { yTop: mullion.yTop, baseY },
      parentId: 'stone-region',
      validation: { ok: mullion.ok, errors: mullion.errors ?? [] },
    }),
  }

  // Spandrel void regions (optional)
  for (let i = 0; i < spandrelOpenings.length; i += 1) {
    const o = spandrelOpenings[i]
    regions[o.type] = makeRegionRecord({
      id: o.id.toLowerCase().replace(/_/g, '-'),
      type: o.type,
      edges: o.edges,
      area: spandrelAreas[i],
      orientation: windingOrientation(o.edges, SAMPLE_OPTS),
      source: {
        kind: 'upper-spandrel-circle',
        center: o.center,
        radius: o.radius,
        construction: spandrel.construction,
        memberClass: o.memberClass,
      },
      parentId: 'stone-region',
      validation: { ok: true, errors: [] },
    })
  }

  const holeIds = structuralHoleKeys(spandrelOpenings.length > 0)
  const childIds = [
    'left-lancet-void',
    'right-lancet-void',
    'upper-foil-void',
    ...spandrelOpenings.map((o) => o.id.toLowerCase().replace(/_/g, '-')),
    'central-mullion',
  ]

  regions[REGION_TYPES.STONE_REGION] = makeRegionRecord({
    id: 'stone-region',
    type: REGION_TYPES.STONE_REGION,
    edges: outer.edges,
    area: solidArea,
    orientation: outer.orientation,
    source: {
      representation: 'outer-with-holes',
      holes: holeIds,
      booleanEngine: 'none — constructive topology',
    },
    childIds,
    derived: {
      outerArea,
      openingArea,
      solidArea,
      areaResidual,
      spandrelOpeningCount: spandrelOpenings.length,
    },
    validation: {
      ok: stoneBuild.ok && connected,
      errors: stoneBuild.ok ? [] : [stoneBuild.reason],
    },
  })

  regions[REGION_TYPES.TRACERY_WEB] = makeRegionRecord({
    id: 'tracery-web',
    type: REGION_TYPES.TRACERY_WEB,
    edges: [],
    samples: [],
    area: null,
    orientation: null,
    source: {
      note:
        spandrelOpenings.length > 0
          ? 'Upper stone web with secondary spandrel openings (bar-tracery reading)'
          : 'Upper stone between lancet heads, foil, and outer frame — subset of STONE_REGION',
    },
    derived: {
      stoneAboveLancets: clearances.values.stoneAboveLancets,
      foilToParent: clearances.values.foilToParent,
      spandrel: spandrel.construction ?? null,
    },
    parentId: 'stone-region',
    validation: {
      ok: true,
      errors: [],
      warnings:
        clearances.values.stoneAboveLancets == null
          ? ['tracery web area not separately meshed; clearances reported']
          : [],
    },
  })

  // Fill samples for SECTION
  for (const r of Object.values(regions)) {
    if (r.edges?.length && (!r.samples || !r.samples.length)) {
      r.samples = sampleLoop(r.edges, SAMPLE_OPTS)
    }
  }

  const metrics = {
    solidRegionCount: 1,
    openingCount: voidLoops.length,
    solidArea,
    openingArea,
    outerArea,
    leftLancetArea: leftArea,
    rightLancetArea: rightArea,
    foilArea,
    spandrelArea: spandrelAreaSum,
    areaResidual,
    minDetectedClearance: clearances.minDetectedClearance,
    boundaryValid: outer.ok && leftLoop.ok && rightLoop.ok && foilLoop.ok,
    connectivityOk: connected,
    mullionWidth: measuredMullionWidth(leftChild, rightChild).width,
    clearances: clearances.values,
    enableSpandrelOpenings: regionParams.enableSpandrelOpenings,
    spandrelOk: spandrel.ok,
  }

  const ok = errors.length === 0

  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: { ...params, ...regionParams },
    regions,
    holes: voidLoops.map((v) => v.id),
    metrics,
    clearances,
    spandrel,
    composed,
    validation: {
      ok,
      errors,
      warnings,
    },
    metadata: {
      title: 'Solid / Void · Composed Window',
      references: ['REF-008', 'REF-009', 'REF-011', 'REF-007', 'REF-012', 'REF-006'],
      note:
        'Constructive outer-with-holes topology. Child arches = clear opening edges. Oculus not a hole. Optional 13D.2 spandrel openings.',
      kernelVersion: '13A.1',
      units: 'meters',
      version: '13D.2',
    },
  }
}

/**
 * Lightweight solid/void for foil-only examples (enclosing circle as outer, foil as void).
 */
export function buildFoilSolidVoid(foilType, params = {}) {
  const regionParams = { ...DEFAULT_REGION_PARAMS, ...params }
  const graph = buildFoilExample(foilType, params)
  const foil = graph.metadata?.foil
  const foilLoop = foilToVoidLoop(foil)
  if (!foilLoop.ok) {
    return {
      type: 'solidVoidModel',
      regions: {},
      metrics: emptyMetrics(),
      validation: { ok: false, errors: foilLoop.errors, warnings: [] },
      metadata: { title: 'Foil solid/void (invalid)', foil },
    }
  }
  // Outer = enclosing circle sampled as many short chords — keep exact circle in source
  const R = foil.parameters.size * 1.15
  const c = foil.center
  const n = 48
  const outerEdges = []
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    outerEdges.push(
      createSegment(
        point(c.x + Math.cos(a0) * R, c.y + Math.sin(a0) * R),
        point(c.x + Math.cos(a1) * R, c.y + Math.sin(a1) * R),
      ),
    )
  }
  const outer = ensureCcw(outerEdges, SAMPLE_OPTS)
  const outerArea = loopArea(outer.edges, SAMPLE_OPTS)
  const foilArea = loopArea(foilLoop.edges, SAMPLE_OPTS)
  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: regionParams,
    regions: {
      [REGION_TYPES.OUTER_BOUNDARY]: makeRegionRecord({
        id: 'outer-boundary',
        type: REGION_TYPES.OUTER_BOUNDARY,
        edges: outer.edges,
        area: outerArea,
        source: { kind: 'enclosing-disk', radius: R, exactCirclePreferred: true },
      }),
      [REGION_TYPES.UPPER_FOIL_VOID]: makeRegionRecord({
        id: 'upper-foil-void',
        type: REGION_TYPES.UPPER_FOIL_VOID,
        edges: foilLoop.edges,
        area: foilArea,
        source: { foil },
      }),
      [REGION_TYPES.STONE_REGION]: makeRegionRecord({
        id: 'stone-region',
        type: REGION_TYPES.STONE_REGION,
        edges: outer.edges,
        area: Math.max(0, outerArea - foilArea),
        source: { holes: [REGION_TYPES.UPPER_FOIL_VOID] },
      }),
    },
    metrics: {
      solidRegionCount: 1,
      openingCount: 1,
      solidArea: Math.max(0, outerArea - foilArea),
      openingArea: foilArea,
      outerArea,
      minDetectedClearance: null,
      boundaryValid: foilLoop.ok,
      connectivityOk: true,
      clearances: {},
    },
    validation: { ok: foilLoop.ok, errors: [], warnings: ['Foil demo: outer is a convenience disk'] },
    metadata: { title: `Solid / Void · ${foilType}`, foil, mode: foilType },
  }
}

function emptyMetrics() {
  return {
    solidRegionCount: 0,
    openingCount: 0,
    solidArea: null,
    openingArea: null,
    minDetectedClearance: null,
    boundaryValid: false,
    connectivityOk: false,
    clearances: {},
  }
}

function invalidModel(regionParams, composed, errors) {
  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: regionParams,
    regions: {},
    metrics: emptyMetrics(),
    composed,
    validation: { ok: false, errors: [...new Set(errors)], warnings: [] },
    metadata: {
      title: 'Solid / Void (invalid)',
      references: ['REF-008'],
    },
  }
}

export { DEFAULT_REGION_PARAMS, REGION_TYPES }
