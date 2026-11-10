/**
 * Skeleton-first stone region (Step 13D.5).
 *
 * CRITICAL: Extrusion uses the unioned member strips as the stone solid —
 * NOT an outer envelope with independently punched holes (the 13D.3 failure mode).
 *
 * Pipeline:
 * 1. Offset each skeleton centerline → strip polygon
 * 2. Union strips (polygon-clipping)
 * 3. Clip to a soft parent envelope (prevent strip bleed beyond frame)
 * 4. Convert multipolygon → outer ring(s) + holes for extrusion / section
 */

import polygonClipping from 'polygon-clipping'
import { nextId } from '../../kernel/result.js'
import { REGION_TYPES } from '../regionRoles.js'
import { polylineToStrip } from '../barNetworkStone.js'
import {
  buildSkeletonGraph,
  validateSkeletonGraph,
  DEFAULT_SKELETON_PARAMS,
  sampleSkeletonPath,
} from './skeletonGraph.js'
import {
  buildOculusNetworkGraph,
  validateOculusNetworkGraph,
  DEFAULT_OCULUS_NETWORK_PARAMS,
} from './skeletonOculus.js'
import {
  buildSecondaryTraceryGraph,
  validateSecondaryTraceryGraph,
  DEFAULT_SECONDARY_TRACERY_PARAMS,
} from './skeletonSecondary.js'
import {
  buildHierarchicalTraceryGraph,
  validateHierarchicalTraceryGraph,
  DEFAULT_HIERARCHICAL_PARAMS,
} from './skeletonHierarchical.js'
import { archHeightAtX } from '../archContainment.js'

const SAMPLE_OPTS = { segments: 24 }

function ringToPoints(ring) {
  if (!ring?.length) return []
  const pts = ring.map(([x, y]) => ({ x, y }))
  // Drop closing duplicate
  if (
    pts.length > 2 &&
    Math.abs(pts[0].x - pts[pts.length - 1].x) < 1e-12 &&
    Math.abs(pts[0].y - pts[pts.length - 1].y) < 1e-12
  ) {
    pts.pop()
  }
  return pts
}

function ringArea(ring) {
  let a = 0
  const n = ring.length
  for (let i = 0; i < n - 1; i += 1) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return a * 0.5
}

function ensureCcwRing(ring) {
  if (ringArea(ring) < 0) return [...ring].reverse()
  return ring
}

function ensureCwRing(ring) {
  if (ringArea(ring) > 0) return [...ring].reverse()
  return ring
}

/**
 * Soft rectangular+arch envelope slightly outside the parent for clip only.
 * Does NOT become the extruded outer — only prevents strip bleed.
 */
function buildClipEnvelope(parent, baseY, pad) {
  const half = parent.parameters.span / 2
  const ox = parent.parameters.offsetX ?? 0
  const springY = parent.parameters.springingY
  const apexY = archHeightAtX(parent, ox)
  if (apexY == null) return null
  const pts = []
  const steps = 36
  // Bottom and jambs with pad
  pts.push([ox - half - pad, baseY - pad])
  pts.push([ox + half + pad, baseY - pad])
  pts.push([ox + half + pad, springY])
  // Outer arch samples (outside parent by pad along radial-ish outward)
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    // Parametrize x from +half to -half across the arch crown
    const x = ox + half - 2 * half * t
    const y = archHeightAtX(parent, x)
    if (y == null) continue
    // Push slightly outward (up/out)
    const outward = pad * 1.1
    pts.push([x, y + outward])
  }
  pts.push([ox - half - pad, springY])
  pts.push([ox - half - pad, baseY - pad])
  return pts
}

/**
 * Union skeleton member strips into a connected stone multipolygon.
 */
export function unionSkeletonStrips(graph, { clipEnvelope = true } = {}) {
  if (!graph?.ok) {
    return { ok: false, reason: 'invalid graph', multipolygon: [], strips: {} }
  }
  const strips = {}
  const polys = []
  for (const m of Object.values(graph.members)) {
    const samples =
      graph.memberSamples?.[m.id] ?? sampleSkeletonPath(m.path, SAMPLE_OPTS.segments)
    const strip = polylineToStrip(samples, m.width)
    if (!strip || strip.length < 4) {
      return { ok: false, reason: `strip failed for ${m.id}`, multipolygon: [], strips }
    }
    strips[m.id] = strip
    polys.push([strip])
  }
  if (!polys.length) return { ok: false, reason: 'no strips', multipolygon: [], strips }

  let united
  try {
    united = polys.length === 1 ? polys[0] : polygonClipping.union(...polys)
  } catch (err) {
    return { ok: false, reason: `union failed: ${err.message}`, multipolygon: [], strips }
  }
  if (!united?.length) {
    return { ok: false, reason: 'empty union', multipolygon: [], strips }
  }

  let result = united
  if (clipEnvelope && graph.parent) {
    const env = buildClipEnvelope(
      graph.parent,
      graph.parameters.windowBaseElevation,
      Math.max(0.02, graph.widths.OUTER_FRAME * 0.35),
    )
    if (env) {
      try {
        const clipped = polygonClipping.intersection(united, [[env]])
        if (clipped?.length) result = clipped
      } catch {
        // keep unclipped union
      }
    }
  }

  return {
    ok: true,
    multipolygon: result,
    componentCount: result.length,
    strips,
    reason: null,
  }
}

/**
 * Convert GeoJSON-style multipolygon to extrusion-ready outer + holes.
 * Prefers the largest-area polygon component.
 */
export function multipolygonToExtrusionRegions(multipolygon) {
  if (!multipolygon?.length) {
    return { ok: false, reason: 'empty multipolygon', outer: null, holes: [], components: 0 }
  }
  let best = null
  let bestAbs = 0
  for (const poly of multipolygon) {
    if (!poly?.[0] || poly[0].length < 4) continue
    const a = Math.abs(ringArea(poly[0]))
    if (a > bestAbs) {
      bestAbs = a
      best = poly
    }
  }
  if (!best) {
    return { ok: false, reason: 'no valid polygon', outer: null, holes: [], components: multipolygon.length }
  }
  const outerRing = ensureCcwRing(best[0])
  const outer = ringToPoints(outerRing)
  const holes = []
  const minHoleArea = Math.max(1e-8, bestAbs * 1e-8)
  for (let i = 1; i < best.length; i += 1) {
    const hr = ensureCwRing(best[i])
    const pts = ringToPoints(hr)
    if (pts.length < 3) continue
    const a = Math.abs(ringArea(hr))
    // Drop degenerate / sliver holes (e.g. coincident springing junctions)
    if (!(a > minHoleArea)) continue
    // Reject near-collinear triangles that cleanRing would collapse
    if (pts.length === 3) {
      const [p0, p1, p2] = pts
      const cross =
        (p1.x - p0.x) * (p2.y - p0.y) - (p1.y - p0.y) * (p2.x - p0.x)
      if (Math.abs(cross) < 1e-10) continue
    }
    holes.push(pts)
  }
  // Approximate solid = outer − holes (outer ring alone overstates strip-union mass)
  let holeAreaSum = 0
  for (const h of holes) {
    let a = 0
    for (let k = 0; k < h.length; k += 1) {
      const p0 = h[k]
      const p1 = h[(k + 1) % h.length]
      a += p0.x * p1.y - p1.x * p0.y
    }
    holeAreaSum += Math.abs(a * 0.5)
  }
  return {
    ok: outer.length >= 3,
    reason: outer.length >= 3 ? null : 'outer too small',
    outer,
    holes,
    components: multipolygon.length,
    solidArea: Math.max(0, bestAbs - holeAreaSum),
    holeCount: holes.length,
  }
}

function makeRegion(partial) {
  return {
    id: partial.id,
    type: partial.type,
    semantic: partial.type,
    parentId: partial.parentId ?? null,
    childIds: [...(partial.childIds ?? [])],
    edges: [],
    samples: partial.samples ?? [],
    area: partial.area ?? null,
    orientation: partial.orientation ?? null,
    source: { ...(partial.source ?? {}) },
    parameters: { ...(partial.parameters ?? {}) },
    derived: { ...(partial.derived ?? {}) },
    validation: { ok: true, errors: [], warnings: [], ...(partial.validation ?? {}) },
  }
}

/**
 * Build solid/void-compatible model whose STONE is the strip union.
 * Routes: hierarchical (13D.9) → secondary (13D.7/8) → oculus (13D.6) → skeleton (13D.5).
 */
export function buildSkeletonSolidVoid(params = {}) {
  const hierarchical = params.enableHierarchicalTracery === true
  const secondaryTracery = hierarchical || params.enableSecondaryTracery === true
  const oculusNetwork = secondaryTracery || params.enableOculusNetwork === true
  const p = hierarchical
    ? {
        ...DEFAULT_HIERARCHICAL_PARAMS,
        ...params,
        enableSkeleton: true,
        enableOculusNetwork: true,
        enableSecondaryTracery: true,
        enableOculusRefinement: true,
        enableHierarchicalTracery: true,
      }
    : secondaryTracery
      ? {
          ...DEFAULT_SECONDARY_TRACERY_PARAMS,
          ...params,
          enableSkeleton: true,
          enableOculusNetwork: true,
          enableSecondaryTracery: true,
        }
      : oculusNetwork
        ? {
            ...DEFAULT_OCULUS_NETWORK_PARAMS,
            ...params,
            enableSkeleton: true,
            enableOculusNetwork: true,
          }
        : { ...DEFAULT_SKELETON_PARAMS, ...params, enableSkeleton: true }
  const refine = !hierarchical && p.enableOculusRefinement === true
  const graph = hierarchical
    ? buildHierarchicalTraceryGraph(p)
    : secondaryTracery
      ? buildSecondaryTraceryGraph(p)
      : oculusNetwork
        ? buildOculusNetworkGraph(p)
        : buildSkeletonGraph(p)
  const gCheck = hierarchical
    ? validateHierarchicalTraceryGraph(graph)
    : secondaryTracery
      ? validateSecondaryTraceryGraph(graph)
      : oculusNetwork
        ? validateOculusNetworkGraph(graph)
        : validateSkeletonGraph(graph)
  const version = hierarchical
    ? '13D.9'
    : refine
      ? '13D.8'
      : secondaryTracery
        ? '13D.7'
        : oculusNetwork
          ? '13D.6'
          : '13D.5'
  const representation = hierarchical
    ? 'strip-union-hierarchical'
    : refine
      ? 'strip-union-oculus-refined'
      : secondaryTracery
        ? 'strip-union-secondary-tracery'
        : oculusNetwork
          ? 'strip-union-oculus-network'
          : 'strip-union-skeleton'
  const titleBase = hierarchical
    ? 'Hierarchical Tracery Solid/Void'
    : refine
      ? 'Oculus Refined Solid/Void'
      : secondaryTracery
        ? 'Secondary Tracery Solid/Void'
        : oculusNetwork
          ? 'Oculus Network Solid/Void'
          : 'Skeleton Solid/Void'
  const baseMetrics = {
    skeleton: true,
    oculusNetwork,
    secondaryTracery,
    oculusRefinement: refine || hierarchical,
    hierarchicalTracery: hierarchical,
    openingCount: 0,
  }

  if (!graph.ok || !gCheck.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: p,
      regions: {},
      holes: [],
      skeleton: graph,
      metrics: baseMetrics,
      validation: {
        ok: false,
        errors: [...(graph.validation?.errors ?? []), ...(gCheck.errors ?? [])],
        warnings: [],
      },
      metadata: {
        title: `${titleBase} (invalid)`,
        version,
      },
    }
  }

  const union = unionSkeletonStrips(graph)
  if (!union.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: p,
      regions: {},
      holes: [],
      skeleton: graph,
      metrics: baseMetrics,
      validation: { ok: false, errors: [union.reason], warnings: [] },
      metadata: {
        title: `${titleBase} (invalid)`,
        version,
      },
    }
  }

  const regions2d = multipolygonToExtrusionRegions(union.multipolygon)
  if (!regions2d.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: p,
      regions: {},
      holes: [],
      skeleton: graph,
      stripUnion: union,
      metrics: baseMetrics,
      validation: { ok: false, errors: [regions2d.reason], warnings: [] },
      metadata: {
        title: `${titleBase} (invalid)`,
        version,
      },
    }
  }

  const errors = []
  const warnings = [...(graph.validation?.warnings ?? [])]
  if (regions2d.components !== 1) {
    errors.push(`stone not connected (${regions2d.components} components)`)
  }
  // Architectural gate metric: solid must be much smaller than a filled parent panel
  const parentSpan = graph.parent.parameters.span
  const parentRise =
    (archHeightAtX(graph.parent, graph.parent.parameters.offsetX ?? 0) ?? 0) -
    (graph.parameters.windowBaseElevation ?? 0)
  const panelProxyArea = parentSpan * Math.max(0.1, parentRise)
  const solidRatio = panelProxyArea > 0 ? regions2d.solidArea / panelProxyArea : 1
  if (solidRatio > 0.72) {
    warnings.push(
      `solid/panel proxy ratio ${solidRatio.toFixed(3)} still high — check widths / topology`,
    )
  }

  const outerKind = hierarchical
    ? 'hierarchical-strip-union-outer'
    : secondaryTracery
      ? 'secondary-tracery-strip-union-outer'
      : oculusNetwork
        ? 'oculus-network-strip-union-outer'
        : 'skeleton-strip-union-outer'
  const voidKind = hierarchical
    ? 'hierarchical-emergent-void'
    : secondaryTracery
      ? 'secondary-tracery-emergent-void'
      : oculusNetwork
        ? 'oculus-network-emergent-void'
        : 'skeleton-emergent-void'

  const regions = {
    [REGION_TYPES.OUTER_BOUNDARY]: makeRegion({
      id: 'outer-boundary',
      type: REGION_TYPES.OUTER_BOUNDARY,
      samples: regions2d.outer,
      area: regions2d.solidArea,
      source: {
        kind: outerKind,
        skeleton: true,
        oculusNetwork,
        secondaryTracery,
        hierarchicalTracery: hierarchical,
        representation: 'strip-union',
      },
    }),
  }

  const holeIds = []
  regions2d.holes.forEach((holePts, i) => {
    const id = `SKELETON_VOID_${i}`
    holeIds.push(id)
    let a = 0
    for (let k = 0; k < holePts.length; k += 1) {
      const p0 = holePts[k]
      const p1 = holePts[(k + 1) % holePts.length]
      a += p0.x * p1.y - p1.x * p0.y
    }
    regions[id] = makeRegion({
      id: id.toLowerCase(),
      type: id,
      samples: holePts,
      area: Math.abs(a * 0.5),
      source: {
        kind: voidKind,
        skeleton: true,
        oculusNetwork,
        secondaryTracery,
        hierarchicalTracery: hierarchical,
      },
      parentId: 'stone-region',
    })
  })

  regions[REGION_TYPES.STONE_REGION] = makeRegion({
    id: 'stone-region',
    type: REGION_TYPES.STONE_REGION,
    samples: regions2d.outer,
    area: regions2d.solidArea,
    source: {
      representation,
      booleanEngine: 'polygon-clipping',
      holes: holeIds,
      note: hierarchical
        ? 'Stone IS hierarchical strip union (nested arches + foil heads). Not a punched plate.'
        : secondaryTracery
          ? 'Stone IS skeleton+oculus+foil+secondary strip union. Upper negatives remain open.'
          : oculusNetwork
            ? 'Stone IS the skeleton+oculus strip union. Upper negative spaces remain open.'
            : 'Stone IS the member-strip union. Upper tympanum is open exterior/void — not a filled panel.',
    },
    childIds: holeIds.map((h) => h.toLowerCase()),
    derived: {
      solidRatio,
      panelProxyArea,
      componentCount: regions2d.components,
      memberCount: Object.keys(graph.members).length,
      nodeCount: Object.keys(graph.nodes).length,
      secondaryTraceryLevel: graph.parameters?.secondaryTraceryLevel ?? null,
      hierarchicalDepth: graph.hierarchy?.depth ?? graph.parameters?.hierarchicalDepth ?? null,
      cellCount: graph.hierarchy?.cellCount ?? null,
      acceptedSubdivisions: graph.hierarchy?.accepted ?? null,
      rejectedSubdivisions: graph.hierarchy?.rejected ?? null,
    },
  })

  const ok = errors.length === 0
  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: {
      ...p,
      enableSkeleton: true,
      enableOculusNetwork: oculusNetwork,
      enableSecondaryTracery: secondaryTracery,
      enableHierarchicalTracery: hierarchical,
      enableOculusRefinement: refine || hierarchical || p.enableOculusRefinement === true,
    },
    regions,
    holes: holeIds,
    skeleton: graph,
    stripUnion: union,
    extrusion: {
      outer: regions2d.outer,
      holes: regions2d.holes,
    },
    metrics: {
      solidRegionCount: 1,
      openingCount: holeIds.length,
      solidArea: regions2d.solidArea,
      openingArea: holeIds.reduce((s, id) => s + (regions[id].area ?? 0), 0),
      solidRatio,
      boundaryValid: true,
      connectivityOk: regions2d.components === 1,
      skeleton: true,
      oculusNetwork,
      secondaryTracery,
      oculusRefinement: refine || hierarchical,
      hierarchicalTracery: hierarchical,
      secondaryTraceryLevel: graph.parameters?.secondaryTraceryLevel ?? null,
      hierarchicalDepth: graph.hierarchy?.depth ?? graph.parameters?.hierarchicalDepth ?? null,
      cellCount: graph.hierarchy?.cellCount ?? null,
      acceptedSubdivisions: graph.hierarchy?.accepted ?? null,
      rejectedSubdivisions: graph.hierarchy?.rejected ?? null,
      grammarStage: graph.metadata?.grammarStage ?? version,
      memberCount: Object.keys(graph.members).length,
      nodeCount: Object.keys(graph.nodes).length,
      stripComponentCount: regions2d.components,
      representation,
    },
    validation: { ok, errors, warnings },
    metadata: {
      title: hierarchical
        ? 'Solid / Void · Rayonnant Hierarchical'
        : refine
          ? 'Solid / Void · Rayonnant Oculus Refined'
          : secondaryTracery
            ? 'Solid / Void · Rayonnant Secondary Tracery'
            : oculusNetwork
              ? 'Solid / Void · Rayonnant Oculus Network'
              : 'Solid / Void · Rayonnant Skeleton',
      version,
      references: hierarchical
        ? ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-006']
        : refine
          ? ['REF-006', 'REF-011', 'REF-009', 'REF-013', 'REF-007']
          : secondaryTracery
            ? ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-004']
            : ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
      note: hierarchical
        ? '13D.9 recursive pointed-arch cells + trefoil heads on 13D.8 refined skeleton; strip-union stone.'
        : refine
          ? '13D.8 refined foil-to-ring + apex clearance; extruded stone = unioned strips.'
          : secondaryTracery
            ? 'Skeleton-first + oculus + quatrefoil + side secondary: extruded stone = unioned strips.'
            : oculusNetwork
              ? 'Skeleton-first + connected oculus: extruded stone = unioned centerline strips.'
              : 'Skeleton-first: extruded stone = unioned centerline strips. Not outer⊕holes panel.',
      junctionStrategy: 'Strip offset + polygon-clipping union; emergent voids',
      representation,
    },
  }
}

// Note: do not attach `network` alias — stoneAssembly treats that as 13D.3 bar-network.

export function skeletonHoleKeys(solidVoid) {
  return solidVoid?.holes?.length ? [...solidVoid.holes] : []
}
