/**
 * Solid/void model for Rayonnant Elaborate (Step 13D.4).
 *
 * Constructive outer-with-holes from the opening-arrangement solver.
 * Member hierarchy is recorded for molding / inspection; extrusion reuses 13D.
 */

import { nextId } from '../../kernel/result.js'
import {
  buildOuterBoundaryLoop,
  ensureCw,
  sampleLoop,
  loopArea,
  regionFromLoops,
} from '../openingLoops.js'
import { openingsInsideOuter, voidsOverlap } from '../clearance.js'
import { REGION_TYPES } from '../regionRoles.js'
import { windingOrientation } from '../../kernel/planarRegions.js'
import {
  solveOpeningArrangement,
  DEFAULT_ELABORATE_PARAMS,
  porosityMetrics,
} from './openingArrangement.js'
import { NETWORK_MEMBER_TYPES } from '../barNetworkTypes.js'

const SAMPLE_OPTS = { segments: 28 }

/** Member width hierarchy for elaborate (relative to master frame). */
export const ELABORATE_MEMBER_RATIOS = Object.freeze({
  OUTER_FRAME: 1.0,
  PRIMARY_MULLION: 0.55,
  SECONDARY_MULLION: 0.38,
  PRIMARY_ARCH_BAR: 0.5,
  SECONDARY_ARCH_BAR: 0.32,
  OCULUS_RING: 0.36,
  FOIL_BAR: 0.22,
  SPANDREL_CONNECTOR: 0.3,
})

export function resolveElaborateWidths(masterFrameWidth, ratios = {}) {
  const r = { ...ELABORATE_MEMBER_RATIOS, ...ratios }
  const outer = Math.max(0.04, masterFrameWidth)
  const widths = {}
  for (const [k, ratio] of Object.entries(r)) {
    widths[k] = Math.max(0.02, outer * ratio)
  }
  // Enforce descending feel
  widths.PRIMARY_MULLION = Math.min(widths.PRIMARY_MULLION, widths.OUTER_FRAME * 0.95)
  widths.SECONDARY_MULLION = Math.min(widths.SECONDARY_MULLION, widths.PRIMARY_MULLION * 0.85)
  widths.FOIL_BAR = Math.min(widths.FOIL_BAR, widths.SECONDARY_ARCH_BAR * 0.9)
  return widths
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
 * Build elaborate solid/void model.
 */
export function buildElaborateSolidVoid(params = {}) {
  const p = { ...DEFAULT_ELABORATE_PARAMS, ...params, enableElaborate: true }
  const arrangement = solveOpeningArrangement(p)

  if (!arrangement.ok) {
    return {
      type: 'solidVoidModel',
      id: nextId('svm'),
      parameters: p,
      regions: {},
      holes: [],
      metrics: {
        solidRegionCount: 0,
        openingCount: 0,
        solidArea: null,
        openingArea: null,
        elaborate: true,
        boundaryValid: false,
        connectivityOk: false,
      },
      arrangement,
      validation: {
        ok: false,
        errors: arrangement.validation?.errors ?? ['arrangement failed'],
        warnings: arrangement.validation?.warnings ?? [],
      },
      metadata: {
        title: 'Rayonnant Elaborate (invalid)',
        version: '13D.4',
        references: ['REF-008', 'REF-011'],
      },
    }
  }

  const parent = arrangement.parent
  const baseY = p.windowBaseElevation
  const outerFrameWidth = p.outerFrameWidth ?? 0.1
  const widths = resolveElaborateWidths(outerFrameWidth)

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
      parameters: p,
      regions: {},
      holes: [],
      arrangement,
      metrics: { openingCount: 0, elaborate: true },
      validation: { ok: false, errors: outer.errors ?? ['outer failed'], warnings: [] },
      metadata: { title: 'Rayonnant Elaborate (invalid)', version: '13D.4' },
    }
  }

  const voidLoops = []
  const regions = {
    [REGION_TYPES.OUTER_BOUNDARY]: makeRegionRecord({
      id: 'outer-boundary',
      type: REGION_TYPES.OUTER_BOUNDARY,
      edges: outer.edges,
      area: loopArea(outer.edges, SAMPLE_OPTS),
      orientation: outer.orientation,
      source: { kind: 'outer-frame-arch', elaborate: true },
      parameters: { outerFrameWidth, windowBaseElevation: baseY },
    }),
  }

  for (const opening of arrangement.openings) {
    const oriented = ensureCw(opening.edges, SAMPLE_OPTS)
    voidLoops.push({ id: opening.id, edges: oriented.edges })
    regions[opening.id] = makeRegionRecord({
      id: opening.id.toLowerCase().replace(/_/g, '-'),
      type: opening.id,
      edges: oriented.edges,
      area: loopArea(oriented.edges, SAMPLE_OPTS),
      orientation: windingOrientation(oriented.edges, SAMPLE_OPTS),
      source: {
        kind: 'elaborate-opening',
        zone: opening.zone,
        level: opening.level,
        memberClass: opening.memberClass,
        center: opening.center,
        radius: opening.radius,
      },
      parentId: 'stone-region',
    })
  }

  // Also alias classic keys when present for tooling compatibility
  const leftPrimary = regions.LEFT_PRIMARY_LANCET
  const rightPrimary = regions.RIGHT_PRIMARY_LANCET
  if (leftPrimary) regions[REGION_TYPES.LEFT_LANCET_VOID] = { ...leftPrimary, type: REGION_TYPES.LEFT_LANCET_VOID }
  if (rightPrimary) {
    regions[REGION_TYPES.RIGHT_LANCET_VOID] = { ...rightPrimary, type: REGION_TYPES.RIGHT_LANCET_VOID }
  }
  if (regions.UPPER_OCULUS_FOIL) {
    regions[REGION_TYPES.UPPER_FOIL_VOID] = {
      ...regions.UPPER_OCULUS_FOIL,
      type: REGION_TYPES.UPPER_FOIL_VOID,
    }
  }

  const inside = openingsInsideOuter(outer.edges, voidLoops)
  const overlap = voidsOverlap(voidLoops)
  const stoneBuild = regionFromLoops(
    outer.edges,
    voidLoops.map((v) => v.edges),
    SAMPLE_OPTS,
  )

  const outerArea = loopArea(outer.edges, SAMPLE_OPTS)
  const openingAreas = voidLoops.map((v) => loopArea(v.edges, SAMPLE_OPTS))
  const openingArea = openingAreas.reduce((a, b) => a + b, 0)
  const solidArea = Math.max(0, outerArea - openingArea)
  const porosity = porosityMetrics({
    outerArea,
    openingArea,
    openingCount: voidLoops.length,
    solidArea,
  })

  const errors = []
  const warnings = [...(arrangement.validation?.warnings ?? [])]
  if (!inside.ok) errors.push('opening escapes outer boundary')
  if (!overlap.ok) errors.push('opening regions overlap')
  if (!stoneBuild.ok) errors.push(`stone region invalid: ${stoneBuild.reason}`)

  // Min web between circular cells
  const circular = arrangement.openings.filter((o) => o.center && o.radius > 0)
  const minWeb = p.minWebClearance ?? p.minStoneWebWidth ?? 0.035
  for (let i = 0; i < circular.length; i += 1) {
    for (let j = i + 1; j < circular.length; j += 1) {
      const a = circular[i]
      const b = circular[j]
      const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)
      const gap = d - a.radius - b.radius
      if (gap < minWeb - 1e-6) {
        warnings.push(`web ${gap.toFixed(4)} < min between ${a.id} and ${b.id}`)
      }
    }
  }

  const holeIds = voidLoops.map((v) => v.id)
  regions[REGION_TYPES.STONE_REGION] = makeRegionRecord({
    id: 'stone-region',
    type: REGION_TYPES.STONE_REGION,
    edges: outer.edges,
    area: solidArea,
    source: {
      representation: 'outer-with-holes-elaborate',
      holes: holeIds,
      booleanEngine: 'none — constructive topology',
    },
    childIds: holeIds.map((id) => id.toLowerCase().replace(/_/g, '-')),
    derived: { ...porosity, widths },
    validation: { ok: stoneBuild.ok && errors.length === 0 },
  })

  regions[REGION_TYPES.TRACERY_WEB] = makeRegionRecord({
    id: 'tracery-web',
    type: REGION_TYPES.TRACERY_WEB,
    edges: [],
    samples: [],
    area: null,
    source: {
      note: 'Elaborate hierarchical web — nested lancets + dominant oculus + curved spandrels',
    },
    derived: {
      nestingDepth: arrangement.lancets?.nestingDepth,
      oculus: arrangement.oculus?.construction,
      spandrels: arrangement.spandrels?.construction,
    },
    parentId: 'stone-region',
  })

  for (const r of Object.values(regions)) {
    if (r.edges?.length && (!r.samples || !r.samples.length)) {
      r.samples = sampleLoop(r.edges, SAMPLE_OPTS)
    }
  }

  // Semantic members for inspection (exact paths where available)
  const members = buildElaborateMembers(arrangement, widths, outerFrameWidth)

  const ok = errors.length === 0
  return {
    type: 'solidVoidModel',
    id: nextId('svm'),
    parameters: { ...p, enableElaborate: true, outerFrameWidth },
    regions,
    holes: holeIds,
    metrics: {
      solidRegionCount: 1,
      openingCount: voidLoops.length,
      solidArea,
      openingArea,
      outerArea,
      ...porosity,
      boundaryValid: outer.ok,
      connectivityOk: stoneBuild.ok && ok,
      elaborate: true,
      nestingDepth: arrangement.lancets?.nestingDepth,
      memberCount: Object.keys(members).length,
      minWebClearance: minWeb,
    },
    arrangement,
    members,
    widths,
    composed: arrangement.lancets?.primary ?? null,
    validation: { ok, errors, warnings },
    metadata: {
      title: 'Solid / Void · Rayonnant Elaborate',
      references: ['REF-004', 'REF-007', 'REF-008', 'REF-009', 'REF-011', 'REF-016'],
      note:
        'Hierarchical zones A–D. Nested secondary lancets divide primary voids. Dominant oculus foil. Large curved spandrel cells.',
      kernelVersion: '13A.1',
      units: 'meters',
      version: '13D.4',
      junctionStrategy: 'Constructive outer-with-holes; member widths for molding hierarchy',
    },
  }
}

function buildElaborateMembers(arrangement, widths, outerFrameWidth) {
  const members = {}
  const parent = arrangement.parent
  if (parent?.arcs) {
    members.outer_left = {
      id: 'member-outer-left',
      type: 'OUTER_FRAME',
      width: widths.OUTER_FRAME ?? outerFrameWidth,
      path: [parent.arcs.LEFT_ARC ?? parent.arcs[Object.keys(parent.arcs)[0]]],
    }
  }
  members.primary_mullion = {
    id: 'member-primary-mullion',
    type: 'PRIMARY_MULLION',
    width: widths.PRIMARY_MULLION,
    path: [],
    note: 'central mullion between primary fields',
  }
  if (arrangement.oculus?.oculus) {
    const { center, radius } = arrangement.oculus.oculus
    members.oculus_ring = {
      id: 'member-oculus-ring',
      type: 'OCULUS_RING',
      width: widths.OCULUS_RING,
      center,
      radius,
    }
  }
  for (const o of arrangement.openings ?? []) {
    if (o.memberClass) {
      members[`opening-${o.id}`] = {
        id: `member-${o.id.toLowerCase()}`,
        type: o.memberClass,
        width: widths[o.memberClass] ?? widths.SPANDREL_CONNECTOR,
        openingId: o.id,
      }
    }
  }
  return members
}

export function elaborateHoleKeys(solidVoid) {
  if (solidVoid?.holes?.length) {
    return solidVoid.holes.filter((k) => solidVoid.regions?.[k]?.edges?.length)
  }
  return []
}

export { DEFAULT_ELABORATE_PARAMS, NETWORK_MEMBER_TYPES }
