/**
 * Derive 2D stone region from a bar-tracery network (Step 13D.3).
 *
 * Strategy:
 * 1. Offset each member centerline by half-width → strip polygons (butt/miter caps)
 * 2. Union strips with polygon-clipping (Martinez) — established boolean engine
 * 3. Intersect with outer envelope
 * 4. Opening cells from the network remain the authoritative voids for extrusion
 *    (outer-with-holes), validated against the union for connectivity
 *
 * Exact construction geometry stays on the network; tessellation is derived only.
 */

import polygonClipping from 'polygon-clipping'
import { nextId } from '../kernel/result.js'
import {
  buildOuterBoundaryLoop,
  ensureCw,
  ensureCcw,
  sampleLoop,
  loopArea,
  regionFromLoops,
} from './openingLoops.js'
import { REGION_TYPES, structuralHoleKeys, DEFAULT_REGION_PARAMS } from './regionRoles.js'
import { openingsInsideOuter, voidsOverlap } from './clearance.js'
import { buildBarNetwork, validateBarNetwork } from './barNetwork.js'
import { sampleMemberPath } from './barNetwork.js'
import { NETWORK_MEMBER_TYPES } from './barNetworkTypes.js'

const SAMPLE_OPTS = { segments: 28 }

function ringFromPoints(pts, close = true) {
  if (!pts?.length) return null
  const ring = pts.map((p) => [p.x, p.y])
  if (close) {
    const a = ring[0]
    const b = ring[ring.length - 1]
    if (a[0] !== b[0] || a[1] !== b[1]) ring.push([a[0], a[1]])
  }
  return ring
}

/**
 * Offset a polyline to a strip polygon of total width `width`.
 * Uses averaged normals at joints (simple miter, clamped).
 */
export function polylineToStrip(points, width, { miterLimit = 4 } = {}) {
  if (!points || points.length < 2 || !(width > 0)) return null
  // Dedup
  const pts = []
  for (const p of points) {
    const prev = pts[pts.length - 1]
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 1e-10) pts.push({ x: p.x, y: p.y })
  }
  if (pts.length < 2) return null
  const half = width / 2
  const closed =
    Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < 1e-8
  const n = closed ? pts.length - 1 : pts.length

  const left = []
  const right = []
  for (let i = 0; i < n; i += 1) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    let tx
    let ty
    if (!closed && i === 0) {
      tx = next.x - cur.x
      ty = next.y - cur.y
    } else if (!closed && i === n - 1) {
      tx = cur.x - prev.x
      ty = cur.y - prev.y
    } else {
      const t0x = cur.x - prev.x
      const t0y = cur.y - prev.y
      const t1x = next.x - cur.x
      const t1y = next.y - cur.y
      const l0 = Math.hypot(t0x, t0y) || 1
      const l1 = Math.hypot(t1x, t1y) || 1
      tx = t0x / l0 + t1x / l1
      ty = t0y / l0 + t1y / l1
    }
    const len = Math.hypot(tx, ty) || 1
    let nx = -ty / len
    let ny = tx / len
    // Miter scale from turn
    if (closed || (i > 0 && i < n - 1)) {
      const t0x = cur.x - prev.x
      const t0y = cur.y - prev.y
      const t1x = next.x - cur.x
      const t1y = next.y - cur.y
      const l0 = Math.hypot(t0x, t0y) || 1
      const l1 = Math.hypot(t1x, t1y) || 1
      const n0x = -t0y / l0
      const n0y = t0x / l0
      const dot = Math.max(-1, Math.min(1, n0x * nx + n0y * ny))
      const miter = 1 / Math.max(0.2, dot)
      const scale = Math.min(miterLimit, miter)
      nx *= scale
      ny *= scale
    }
    left.push({ x: cur.x + nx * half, y: cur.y + ny * half })
    right.push({ x: cur.x - nx * half, y: cur.y - ny * half })
  }
  const poly = [...left, ...right.reverse()]
  if (poly.length < 3) return null
  return ringFromPoints(poly, true)
}

function sampleEdgesToRing(edges, segments = 28) {
  const samples = sampleLoop(edges, { segments })
  return ringFromPoints(samples, true)
}

/**
 * Union member strips, then clip to outer envelope.
 */
export function unionMemberStrips(network, outerRing) {
  const polys = []
  for (const m of Object.values(network.members ?? {})) {
    // Skip foil bars for structural union — foil defines the void edge, not a fill bar strip
    // that would erase the foil opening. Oculus ring + secondary + lancet + mullion + frame.
    if (m.type === NETWORK_MEMBER_TYPES.FOIL_BAR) continue
    const samples =
      network.memberSamples?.[m.id] ?? sampleMemberPath(m.path, SAMPLE_OPTS.segments)
    const strip = polylineToStrip(samples, m.width)
    if (strip && strip.length >= 4) polys.push([strip])
  }
  if (!polys.length) {
    return { ok: false, reason: 'no member strips', multipolygon: [] }
  }
  let united
  try {
    united = polys.length === 1 ? polys[0] : polygonClipping.union(...polys)
  } catch (err) {
    return { ok: false, reason: `union failed: ${err.message}`, multipolygon: [] }
  }
  if (!united?.length) {
    return { ok: false, reason: 'empty union', multipolygon: [] }
  }
  let clipped = united
  if (outerRing) {
    try {
      clipped = polygonClipping.intersection(united, [[outerRing]])
    } catch (err) {
      return { ok: false, reason: `envelope clip failed: ${err.message}`, multipolygon: united }
    }
  }
  const components = clipped?.length ?? 0
  return {
    ok: components >= 1,
    multipolygon: clipped ?? [],
    componentCount: components,
    reason: components === 0 ? 'empty after clip' : components > 1 ? 'multiple stone components' : null,
  }
}

function makeRegionRecord(partial) {
  return {
    id: partial.id ?? nextId('region'),
    type: partial.type,
    semantic: partial.type,
    parentId: partial.parentId ?? null,
    childIds: [...(partial.childIds ?? [])],
    edges: [...(partial.edges ?? [])],
    samples: partial.samples ?? (partial.edges?.length ? sampleLoop(partial.edges, SAMPLE_OPTS) : []),
    area: partial.area ?? (partial.edges?.length ? loopArea(partial.edges, SAMPLE_OPTS) : 0),
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
 * Build solid/void model from bar network.
 * Primary extrusion topology: constructive outer-with-holes from network cells.
 * Secondary validation: offset-union of member strips must be connected.
 */
export function buildBarNetworkSolidVoid(params = {}) {
  const network = buildBarNetwork(params)
  const graphCheck = validateBarNetwork(network)
  if (!network.ok || !graphCheck.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: params,
      regions: {},
      metrics: {
        solidRegionCount: 0,
        openingCount: 0,
        solidArea: null,
        openingArea: null,
        boundaryValid: false,
        connectivityOk: false,
        barNetwork: true,
      },
      network,
      validation: {
        ok: false,
        errors: [...(network.validation?.errors ?? []), ...(graphCheck.errors ?? [])],
        warnings: [...(network.validation?.warnings ?? []), ...(graphCheck.warnings ?? [])],
      },
      metadata: {
        title: 'Bar Network Solid/Void (invalid)',
        version: '13D.3',
        references: ['REF-006', 'REF-008', 'REF-011'],
      },
    }
  }

  const parent = network.composed.metadata.parent
  const baseY = params.windowBaseElevation ?? DEFAULT_REGION_PARAMS.windowBaseElevation
  const outerFrameWidth =
    network.widths?.[NETWORK_MEMBER_TYPES.OUTER_FRAME] ??
    params.outerFrameWidth ??
    DEFAULT_REGION_PARAMS.outerFrameWidth

  const outer = buildOuterBoundaryLoop(
    {
      family: parent.parameters.family,
      span: parent.parameters.span,
      riseRatio: parent.parameters.riseRatio,
      springingY: parent.parameters.springingY,
      samplingQuality: parent.parameters.samplingQuality,
      offsetX: parent.parameters.offsetX ?? 0,
    },
    outerFrameWidth,
    baseY,
  )
  if (!outer.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: params,
      regions: {},
      network,
      metrics: { openingCount: 0, solidArea: null, barNetwork: true },
      validation: { ok: false, errors: outer.errors ?? ['outer failed'], warnings: [] },
      metadata: { title: 'Bar Network Solid/Void (invalid)', version: '13D.3' },
    }
  }

  // Map cells → void loops (CW)
  const voidLoops = []
  const cellRegions = {}
  for (const cell of network.cells) {
    const oriented = ensureCw(cell.edges, SAMPLE_OPTS)
    voidLoops.push({ id: cell.type, edges: oriented.edges })
    cellRegions[cell.type] = makeRegionRecord({
      id: cell.id,
      type: cell.type,
      edges: oriented.edges,
      area: loopArea(oriented.edges, SAMPLE_OPTS),
      source: {
        kind: 'bar-network-cell',
        center: cell.center,
        radius: cell.radius,
        memberIds: cell.memberIds,
      },
      parentId: 'stone-region',
    })
  }

  const inside = openingsInsideOuter(outer.edges, voidLoops)
  const overlap = voidsOverlap(voidLoops)
  const holeEdgeLists = voidLoops.map((v) => v.edges)
  const stoneBuild = regionFromLoops(outer.edges, holeEdgeLists, SAMPLE_OPTS)

  const outerRing = sampleEdgesToRing(outer.edges, 36)
  const stripUnion = unionMemberStrips(network, outerRing)

  const outerArea = loopArea(outer.edges, SAMPLE_OPTS)
  const openingAreas = voidLoops.map((v) => loopArea(v.edges, SAMPLE_OPTS))
  const openingArea = openingAreas.reduce((a, b) => a + b, 0)
  const solidArea = Math.max(0, outerArea - openingArea)

  const errors = []
  const warnings = [...(network.validation?.warnings ?? [])]
  if (!inside.ok) errors.push('opening escapes outer boundary')
  if (!overlap.ok) errors.push('opening regions overlap')
  if (!stoneBuild.ok) errors.push(`stone region invalid: ${stoneBuild.reason}`)
  if (!stripUnion.ok) {
    warnings.push(`member-strip union: ${stripUnion.reason}`)
  } else if (stripUnion.componentCount > 1) {
    errors.push('stone from network has disconnected components (islands)')
  }

  // Min web clearance: pairwise cell centers must keep gap ≥ minWeb
  const minWeb = params.minWebClearance ?? params.minStoneWebWidth ?? 0.04
  const circularCells = network.cells.filter((c) => c.center && c.radius > 0)
  for (let i = 0; i < circularCells.length; i += 1) {
    for (let j = i + 1; j < circularCells.length; j += 1) {
      const a = circularCells[i]
      const b = circularCells[j]
      const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)
      const gap = d - a.radius - b.radius
      if (gap < minWeb - 1e-6) {
        warnings.push(
          `web clearance ${gap.toFixed(4)} m < min ${minWeb} between ${a.type} and ${b.type}`,
        )
      }
    }
  }

  const regions = {
    [REGION_TYPES.OUTER_BOUNDARY]: makeRegionRecord({
      id: 'outer-boundary',
      type: REGION_TYPES.OUTER_BOUNDARY,
      edges: outer.edges,
      area: outerArea,
      orientation: outer.orientation,
      source: { kind: 'outer-frame-arch', barNetwork: true },
      parameters: { outerFrameWidth, windowBaseElevation: baseY },
    }),
    ...cellRegions,
    [REGION_TYPES.STONE_REGION]: makeRegionRecord({
      id: 'stone-region',
      type: REGION_TYPES.STONE_REGION,
      edges: outer.edges,
      area: solidArea,
      source: {
        representation: 'outer-with-holes-from-bar-network',
        holes: voidLoops.map((v) => v.id),
        booleanEngine: 'polygon-clipping (member-strip union validation)',
        stripComponentCount: stripUnion.componentCount,
      },
      childIds: voidLoops.map((v) => v.id.toLowerCase().replace(/_/g, '-')),
      derived: { outerArea, openingArea, solidArea },
      validation: { ok: stoneBuild.ok && stripUnion.componentCount === 1 },
    }),
    [REGION_TYPES.TRACERY_WEB]: makeRegionRecord({
      id: 'tracery-web',
      type: REGION_TYPES.TRACERY_WEB,
      edges: [],
      samples: [],
      area: null,
      source: {
        note: 'Bar-network upper web — stone derived from connected members + cell voids',
      },
      derived: { upper: network.upper?.construction ?? null },
      parentId: 'stone-region',
    }),
  }

  // Ensure samples
  for (const r of Object.values(regions)) {
    if (r.edges?.length && (!r.samples || !r.samples.length)) {
      r.samples = sampleLoop(r.edges, SAMPLE_OPTS)
    }
  }

  const holeKeys = voidLoops.map((v) => v.id)
  const ok = errors.length === 0

  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: {
      ...params,
      enableBarNetwork: true,
      outerFrameWidth,
      windowBaseElevation: baseY,
    },
    regions,
    holes: holeKeys,
    metrics: {
      solidRegionCount: 1,
      openingCount: voidLoops.length,
      solidArea,
      openingArea,
      outerArea,
      areaResidual: 0,
      boundaryValid: outer.ok,
      connectivityOk: stripUnion.ok && stripUnion.componentCount === 1,
      barNetwork: true,
      stripComponentCount: stripUnion.componentCount,
      nodeCount: network.metrics.nodeCount,
      memberCount: network.metrics.memberCount,
      minWebClearance: minWeb,
    },
    network,
    stripUnion,
    composed: network.composed,
    validation: { ok, errors, warnings },
    metadata: {
      title: 'Solid / Void · Rayonnant Bar Network',
      references: ['REF-006', 'REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-016'],
      note:
        'Stone region = network cells as holes in outer envelope; member-strip union validates connected stone (no islands).',
      kernelVersion: '13A.1',
      units: 'meters',
      version: '13D.3',
      junctionStrategy:
        'Averaged-normal miter strips (clamped) unioned with polygon-clipping; extrusion uses constructive outer-with-holes.',
    },
  }
}

/**
 * Hole keys present on a bar-network solid/void model.
 */
export function barNetworkHoleKeys(solidVoid) {
  if (!solidVoid?.holes?.length) {
    return structuralHoleKeys({ includeBarNetwork: true })
  }
  return solidVoid.holes.filter((k) => solidVoid.regions?.[k]?.edges?.length)
}

export { ensureCcw, ensureCw }
