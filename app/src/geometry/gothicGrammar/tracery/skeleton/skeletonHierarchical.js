/**
 * Hierarchical Rayonnant tracery subdivision (Step 13D.9).
 *
 * Extends validated 13D.8 oculus-refined secondary skeleton with:
 * - Recursive ARCHITECTURAL_CELL grammar (depth 0–2)
 * - Nested pointed arches in primary lancet bays (RULE A)
 * - Trefoil heads in eligible bay heads (RULE B)
 * - Optional secondary quatrefoils (RULE C)
 * - Clearance-gated terminal cells (RULE D)
 *
 * Stone remains strip-union — never outer⊕holes.
 */

import { point, distance } from '../../kernel/vector2.js'
import { createSegment } from '../../kernel/line2.js'
import { createCircle } from '../../kernel/circle2.js'
import { createArc } from '../../kernel/arc2.js'
import { ARCH_FAMILIES, ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import { circleInsideArch } from '../archContainment.js'
import { buildTrefoil, buildQuatrefoil, foilInsideCircle } from '../foils.js'
import { subdivideArchField } from '../elaborate/hierarchicalLancets.js'
import {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  createNetworkNode,
  createNetworkMember,
} from '../barNetworkTypes.js'
import { sampleSkeletonPath } from './skeletonGraph.js'
import {
  buildSecondaryTraceryGraph,
  validateSecondaryTraceryGraph,
  DEFAULT_SECONDARY_TRACERY_PARAMS,
} from './skeletonSecondary.js'
import {
  CELL_KINDS,
  SUBDIVISION_RULES,
  createArchitecturalCell,
  markCellAccepted,
  markCellTerminal,
} from './architecturalCell.js'

export const HIERARCHICAL_DEPTH = Object.freeze({
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
})

export const DEFAULT_HIERARCHICAL_PARAMS = Object.freeze({
  ...DEFAULT_SECONDARY_TRACERY_PARAMS,
  enableHierarchicalTracery: true,
  enableOculusRefinement: true,
  enableSecondaryTracery: true,
  enableOculusNetwork: true,
  enableSkeleton: true,
  /** 0 = 13D.8 only; 1 = nested secondary arches; 2 = tertiary where clearance allows */
  hierarchicalDepth: HIERARCHICAL_DEPTH.LEVEL_1,
  nestedArches: true,
  trefoilHeads: true,
  secondaryQuatrefoils: false,
  /** Child clear-span fraction of parent bay clear (after mullion/inset). */
  childArchSpanRatio: 0.5,
  childArchRiseRatio: 1.05,
  childArchFamily: ARCH_FAMILIES.lancet,
  /** Width ratios vs master frame. */
  secondaryArchWidthRatio: 0.4,
  tertiaryArchWidthRatio: 0.3,
  hierarchicalFoilWidthRatio: 0.18,
  hierarchicalMullionWidthRatio: 0.36,
  hierarchicalJambInsetRatio: 0.12,
  minOpeningClearance: 0.05,
  minChildSpan: 0.22,
  containmentMargin: 0.01,
  foilScale: 0.88,
  cuspDepth: 0.65,
  foilRadialMode: 'tip-to-ring',
})

function linkNodeMember(nodes, nodeId, memberId) {
  const n = nodes[nodeId]
  if (!n) return
  if (!n.memberIds.includes(memberId)) n.memberIds.push(memberId)
}

function resolveClearanceFloor(p) {
  return Math.max(
    0.02,
    Number(p.minOpeningClearance) || 0,
    Number(p.minWebClearance) || 0,
    Number(p.minStoneWebWidth) || 0,
  )
}

function resolveHierarchicalWidths(p, baseWidths = {}) {
  const outer = Math.max(0.04, p.masterFrameWidth ?? p.outerFrameWidth ?? 0.12)
  const secondary = Math.max(0.018, outer * (p.secondaryArchWidthRatio ?? 0.4))
  const tertiary = Math.max(0.015, outer * (p.tertiaryArchWidthRatio ?? 0.3))
  const foil = Math.max(0.012, outer * (p.hierarchicalFoilWidthRatio ?? 0.18))
  const mullion = Math.max(0.02, outer * (p.hierarchicalMullionWidthRatio ?? 0.36))
  const lancet = baseWidths.LANCET_ARCH ?? outer * 0.54
  return {
    ...baseWidths,
    SECONDARY_ARCH: Math.min(secondary, lancet * 0.95),
    TERTIARY_ARCH: Math.min(tertiary, secondary * 0.95),
    HIER_MULLION: Math.min(mullion, secondary * 0.95),
    HIER_FOIL: Math.min(foil, tertiary * 0.95),
  }
}

/**
 * Clearance gate for subdividing a field arch into two children.
 */
export function canSubdivideField(fieldArch, p, level) {
  const span = fieldArch?.parameters?.span
  if (!(span > 0)) return { ok: false, reason: 'missing field span' }
  const outer = Math.max(0.04, p.masterFrameWidth ?? p.outerFrameWidth ?? 0.12)
  const mullion = Math.max(0.02, outer * (p.hierarchicalMullionWidthRatio ?? 0.36))
  const jamb = Math.max(0.01, outer * (p.hierarchicalJambInsetRatio ?? 0.12))
  const minChild = Math.max(p.minChildSpan ?? 0.22, resolveClearanceFloor(p))
  const need = mullion + 2 * jamb + 2 * minChild
  if (!(span > need)) {
    return {
      ok: false,
      reason: `span ${span.toFixed(3)} m < required ${need.toFixed(3)} m for level ${level}`,
    }
  }
  if (fieldArch.parameters?.family === ARCH_FAMILIES.depressed && level >= 2) {
    return { ok: false, reason: 'depressed tertiary subdivision unsupported' }
  }
  return { ok: true, mullion, jamb, minChild }
}

function foilBarsFromConstruction(
  foil,
  prefix,
  Oc,
  Ro,
  width,
  nodes,
  addNode,
  addMember,
  link,
  opts = {},
) {
  if (!foil?.validation?.ok || !foil.arcs?.length) {
    return { ok: false, errors: foil?.validation?.errors ?? ['foil invalid'], memberIds: [] }
  }
  const memberIds = []
  foil.arcs.forEach((arc, i) => {
    const id = `${prefix}-foil-bar-${i}`
    addMember({
      id,
      type: NETWORK_MEMBER_TYPES.FOIL_BAR,
      memberClass: 'FOIL_BAR',
      startNodeId: null,
      endNodeId: null,
      path: [arc],
      width,
      metadata: { hierarchy: 'foil', foilIndex: i, parentPrefix: prefix },
    })
    memberIds.push(id)
  })
  // Tip stubs toward enclosing circle — require meaningful length to avoid degenerate faces
  const minStub = opts.minStubLength ?? 0.028
  const stubWidth = width * (opts.stubWidthRatio ?? 1.0)
  if (Ro != null && Oc && foil.lobeCenters?.length) {
    const lobeR = foil.derived?.lobeRadius
    const baseAngle =
      (foil.parameters?.orientation ?? Math.PI / 2) + (foil.parameters?.rotation ?? 0)
    const n = foil.lobeCenters.length
    foil.lobeCenters.forEach((lc, i) => {
      const tipAng = baseAngle + (i * 2 * Math.PI) / n
      const r = lobeR ?? distance(lc, Oc) * 0.85
      const tip = point(lc.x + Math.cos(tipAng) * r, lc.y + Math.sin(tipAng) * r)
      const tipR = distance(tip, Oc)
      if (!(tipR < Ro - minStub)) return
      const ang = Math.atan2(tip.y - Oc.y, tip.x - Oc.x)
      const onRing = point(Oc.x + Math.cos(ang) * Ro, Oc.y + Math.sin(ang) * Ro)
      if (!(distance(tip, onRing) >= minStub * 0.9)) return
      const tipId = `${prefix}-foil-tip-${i}`
      const ringId = `${prefix}-foil-ring-${i}`
      addNode({
        id: tipId,
        type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
        position: tip,
        parentConstructionId: prefix,
      })
      addNode({
        id: ringId,
        type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
        position: onRing,
        parentConstructionId: prefix,
      })
      const rid = `${prefix}-foil-radial-${i}`
      addMember({
        id: rid,
        type: NETWORK_MEMBER_TYPES.FOIL_BAR,
        memberClass: 'FOIL_BAR',
        startNodeId: tipId,
        endNodeId: ringId,
        path: [createSegment(tip, onRing)],
        width: stubWidth,
        metadata: {
          hierarchy: 'foil',
          role: 'foil-to-enclosing',
          parentPrefix: prefix,
        },
      })
      link(nodes, tipId, rid)
      link(nodes, ringId, rid)
      memberIds.push(rid)
    })
  }
  return { ok: true, errors: [], memberIds }
}

/**
 * Add nested child arches + mullion for one primary lancet field.
 */
function subdivideLancetBay(bayId, fieldArch, level, ctx) {
  const { p, widths, nodes, members, memberSamples, addNode, addMember, errors, warnings, cells } =
    ctx
  const gate = canSubdivideField(fieldArch, p, level)
  const parentCell = cells[bayId]
  if (!gate.ok) {
    cells[bayId] = markCellTerminal(parentCell, gate.reason)
    warnings.push(`${bayId}: ${gate.reason}`)
    return { ok: false, childIds: [], memberIds: [], reason: gate.reason }
  }

  const childFamily =
    fieldArch.parameters?.family === ARCH_FAMILIES.depressed
      ? ARCH_FAMILIES.lancet
      : p.childArchFamily ?? ARCH_FAMILIES.lancet

  const split = subdivideArchField(fieldArch, {
    mullionWidth: gate.mullion,
    jambInset: gate.jamb,
    childRiseRatio: p.childArchRiseRatio ?? 1.05,
    childFamily,
    minChildSpan: gate.minChild,
    samplingQuality: p.samplingQuality ?? 0.65,
    containmentMargin: p.containmentMargin ?? 0.01,
  })

  if (!split.ok) {
    const reason = (split.errors ?? ['subdivision failed']).join('; ')
    cells[bayId] = markCellTerminal(parentCell, reason)
    warnings.push(`${bayId}: ${reason}`)
    return { ok: false, childIds: [], memberIds: [], reason }
  }

  const archWidth =
    level >= 2 ? widths.TERTIARY_ARCH : widths.SECONDARY_ARCH
  const memberClass = level >= 2 ? 'SECONDARY_TRACERY' : 'SECONDARY_TRACERY'
  const memberType =
    level >= 2 ? NETWORK_MEMBER_TYPES.SECONDARY_TRACERY : NETWORK_MEMBER_TYPES.SECONDARY_TRACERY
  const kind = level >= 2 ? CELL_KINDS.TERTIARY_ARCH : CELL_KINDS.SECONDARY_ARCH
  const memberIds = []
  const childIds = []

  const sides = [
    { key: 'left', arch: split.leftChild },
    { key: 'right', arch: split.rightChild },
  ]

  for (const { key, arch } of sides) {
    const cellId = `${bayId}-${key}-L${level}`
    const ls = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
    const rs = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
    const ap = arch.points[ARCH_SEMANTICS.APEX]
    const nL = `${cellId}-spring-L`
    const nR = `${cellId}-spring-R`
    const nA = `${cellId}-apex`
    addNode({
      id: nL,
      type: NETWORK_NODE_TYPES.SPRINGING_POINT,
      position: ls,
      parentConstructionId: cellId,
      metadata: { hierarchyLevel: level },
    })
    addNode({
      id: nR,
      type: NETWORK_NODE_TYPES.SPRINGING_POINT,
      position: rs,
      parentConstructionId: cellId,
      metadata: { hierarchyLevel: level },
    })
    addNode({
      id: nA,
      type: NETWORK_NODE_TYPES.ARCH_APEX,
      position: ap,
      parentConstructionId: cellId,
      metadata: { hierarchyLevel: level },
    })
    const mid = `${cellId}-arch`
    addMember({
      id: mid,
      type: memberType,
      memberClass,
      startNodeId: nL,
      endNodeId: nR,
      path: [arch.arcs[ARCH_SEMANTICS.LEFT_ARC], arch.arcs[ARCH_SEMANTICS.RIGHT_ARC]],
      width: archWidth,
      metadata: {
        hierarchyLevel: level,
        role: 'nested-pointed-arch',
        bayId,
        side: key,
      },
    })
    linkNodeMember(nodes, nA, mid)
    memberIds.push(mid)

    // Vertical rails from window / bay base up to child springings (not zero-length)
    const springY = fieldArch.parameters.springingY
    const baseY = Math.min(springY, p.windowBaseElevation ?? springY)
    const baseL = point(ls.x, baseY)
    const baseR = point(rs.x, baseY)
    const railMembers = []
    if (Math.abs(springY - baseY) > 1e-4) {
      const bL = `${cellId}-base-L`
      const bR = `${cellId}-base-R`
      addNode({
        id: bL,
        type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
        position: baseL,
        parentConstructionId: cellId,
      })
      addNode({
        id: bR,
        type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
        position: baseR,
        parentConstructionId: cellId,
      })
      const railL = `${cellId}-rail-L`
      const railR = `${cellId}-rail-R`
      addMember({
        id: railL,
        type: memberType,
        memberClass,
        startNodeId: bL,
        endNodeId: nL,
        path: [createSegment(baseL, ls)],
        width: archWidth * 0.95,
        metadata: { hierarchyLevel: level, role: 'nested-rail' },
      })
      addMember({
        id: railR,
        type: memberType,
        memberClass,
        startNodeId: bR,
        endNodeId: nR,
        path: [createSegment(baseR, rs)],
        width: archWidth * 0.95,
        metadata: { hierarchyLevel: level, role: 'nested-rail' },
      })
      railMembers.push(railL, railR)
      memberIds.push(railL, railR)
    }

    cells[cellId] = markCellAccepted(
      createArchitecturalCell({
        id: cellId,
        kind,
        parentId: bayId,
        hierarchyLevel: level,
        fieldArch: arch,
        width: arch.parameters.span,
        height: arch.parameters.rise,
        localOrigin: point(arch.parameters.offsetX ?? 0, springY),
        allowedRules: [
          SUBDIVISION_RULES.POINTED_ARCH_SUBDIVISION,
          SUBDIVISION_RULES.TREFOIL_HEAD,
          SUBDIVISION_RULES.TERMINAL,
        ],
        memberIds: [mid, ...railMembers],
        memberClass,
        metadata: { side: key, bayId },
      }),
      SUBDIVISION_RULES.POINTED_ARCH_SUBDIVISION,
    )
    childIds.push(cellId)
  }

  // Shared child mullion: vertical from bay base to springing + short head bar between inners
  const mullionX = split.mullionX
  const springY = fieldArch.parameters.springingY
  const mBase = `${bayId}-mullion-base-L${level}`
  const mTop = `${bayId}-mullion-top-L${level}`
  const leftInner = split.leftChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rightInner = split.rightChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const leftCellSpringR = `${bayId}-left-L${level}-spring-R`
  const rightCellSpringL = `${bayId}-right-L${level}-spring-L`
  const startId = nodes[leftCellSpringR] ? leftCellSpringR : `${bayId}-inner-L-L${level}`
  const endId = nodes[rightCellSpringL] ? rightCellSpringL : `${bayId}-inner-R-L${level}`
  if (!nodes[startId]) {
    addNode({
      id: startId,
      type: NETWORK_NODE_TYPES.SPRINGING_POINT,
      position: leftInner,
      parentConstructionId: bayId,
    })
  }
  if (!nodes[endId]) {
    addNode({
      id: endId,
      type: NETWORK_NODE_TYPES.SPRINGING_POINT,
      position: rightInner,
      parentConstructionId: bayId,
    })
  }
  const mullionId = `${bayId}-mullion-L${level}`
  addMember({
    id: mullionId,
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: 'SECONDARY_TRACERY',
    startNodeId: startId,
    endNodeId: endId,
    path: [createSegment(nodes[startId].position, nodes[endId].position)],
    width: widths.HIER_MULLION,
    metadata: {
      hierarchyLevel: level,
      role: 'nested-mullion-head',
      bayId,
    },
  })
  const fieldBaseY = fieldArch.parameters.springingY
  const deepBaseY = Math.min(fieldBaseY, p.windowBaseElevation ?? fieldBaseY)
  const deepBase = point(mullionX, deepBaseY)
  const springMid = point(mullionX, springY)
  addNode({
    id: mBase,
    type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
    position: deepBase,
    parentConstructionId: bayId,
  })
  addNode({
    id: mTop,
    type: NETWORK_NODE_TYPES.MULLION_JUNCTION,
    position: springMid,
    parentConstructionId: bayId,
    metadata: { note: 'mullion stops at nested springing' },
  })
  const vertId = `${bayId}-mullion-vert-L${level}`
  addMember({
    id: vertId,
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: 'SECONDARY_TRACERY',
    startNodeId: mBase,
    endNodeId: mTop,
    path: [createSegment(deepBase, springMid)],
    width: widths.HIER_MULLION,
    metadata: { hierarchyLevel: level, role: 'nested-mullion', bayId },
  })
  linkNodeMember(nodes, mTop, vertId)
  linkNodeMember(nodes, mBase, vertId)
  memberIds.push(mullionId, vertId)

  cells[bayId] = markCellAccepted(
    {
      ...parentCell,
      childIds: [...(parentCell.childIds ?? []), ...childIds],
      memberIds: [...(parentCell.memberIds ?? []), ...memberIds],
    },
    SUBDIVISION_RULES.POINTED_ARCH_SUBDIVISION,
  )

  return {
    ok: true,
    childIds,
    memberIds,
    leftChild: split.leftChild,
    rightChild: split.rightChild,
    split,
  }
}

/**
 * Place trefoil (or quatrefoil) in the head space above two nested arches.
 */
function placeBayHeadFoil(bayId, fieldArch, leftChild, rightChild, kind, ctx) {
  const { p, widths, nodes, addNode, addMember, warnings, cells, errors } = ctx
  const fieldApex = fieldArch.points[ARCH_SEMANTICS.APEX]
  const leftApex = leftChild.points[ARCH_SEMANTICS.APEX]
  const rightApex = rightChild.points[ARCH_SEMANTICS.APEX]
  const clear = resolveClearanceFloor(p)
  const lowerY = Math.max(leftApex.y, rightApex.y) + clear * 0.5
  const upperY = fieldApex.y - clear
  if (!(upperY - lowerY > clear * 1.5)) {
    warnings.push(`${bayId}: insufficient head clearance for ${kind}`)
    return { ok: false, memberIds: [], reason: 'insufficient head clearance' }
  }
  const cy = (lowerY + upperY) * 0.5
  const cx = fieldArch.parameters.offsetX ?? 0
  // Radius limited by head band, lateral clearance, and absolute cap (large spans)
  const maxRByBand = (upperY - lowerY) * 0.38
  const maxRAbs = Math.min(0.42, (fieldArch.parameters.span ?? 1) * 0.22)
  let radius = Math.min(maxRByBand, maxRAbs)
  const trial = createCircle(point(cx, cy), radius)
  const contain = circleInsideArch(fieldArch, trial, clear * 0.8)
  if (!contain.ok) {
    radius *= 0.75
  }
  if (!(radius > clear * 0.8)) {
    warnings.push(`${bayId}: foil radius too small`)
    return { ok: false, memberIds: [], reason: 'foil radius too small' }
  }
  const Oc = point(cx, cy)
  const circle = createCircle(Oc, radius)
  const inside = circleInsideArch(fieldArch, circle, clear * 0.5)
  if (!inside.ok) {
    warnings.push(`${bayId}: foil circle escapes field arch`)
    return { ok: false, memberIds: [], reason: 'foil escapes field' }
  }

  // Keep foil well inside the ring so tip→ring stubs have real length
  const headFoilScale = Math.min(0.68, Math.max(0.52, (p.foilScale ?? 0.88) * 0.72))
  const foilParams = {
    size: radius * headFoilScale,
    cuspDepth: Math.min(0.6, p.cuspDepth ?? 0.65),
    rotation: 0,
    orientation: kind === 'quatrefoil' ? Math.PI / 4 : Math.PI / 2,
    centerX: Oc.x,
    centerY: Oc.y,
    samplingQuality: p.samplingQuality ?? 0.65,
  }
  const foil =
    kind === 'quatrefoil' ? buildQuatrefoil(foilParams) : buildTrefoil(foilParams)
  const foilIn = foilInsideCircle(foil, circle, radius * 0.02)
  if (!foil.validation?.ok || !foilIn.ok) {
    warnings.push(`${bayId}: ${kind} construction/containment failed`)
    return { ok: false, memberIds: [], reason: `${kind} invalid` }
  }

  // Enclosing ring so foil connects into a closed head module
  const ringId = `${bayId}-head-ring`
  const ringNode = `${bayId}-head-center`
  addNode({
    id: ringNode,
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: Oc,
    parentConstructionId: bayId,
  })
  const a0 = createArc(Oc, radius, 0, Math.PI)
  const a1 = createArc(Oc, radius, Math.PI, Math.PI)
  addMember({
    id: ringId,
    type: NETWORK_MEMBER_TYPES.OCULUS_RING,
    memberClass: 'OCULUS_RING',
    startNodeId: ringNode,
    endNodeId: ringNode,
    path: [a0, a1],
    closed: true,
    width: Math.max(widths.HIER_FOIL * 1.25, widths.SECONDARY_ARCH * 0.55),
    metadata: { hierarchyLevel: 'foil', role: 'bay-head-ring', bayId, kind },
  })
  linkNodeMember(nodes, ringNode, ringId)

  const foilResult = foilBarsFromConstruction(
    foil,
    `${bayId}-head`,
    Oc,
    radius,
    widths.HIER_FOIL,
    nodes,
    addNode,
    addMember,
    linkNodeMember,
    {
      minStubLength: Math.max(0.035, radius * 0.16),
      stubWidthRatio: 0.95,
    },
  )
  if (!foilResult.ok) {
    errors.push(...foilResult.errors)
    return { ok: false, memberIds: [], reason: foilResult.errors.join('; ') }
  }
  if (!foilResult.memberIds.some((id) => id.includes('foil-radial'))) {
    warnings.push(`${bayId}: foil radials skipped — ring/foil may float`)
  }

  const apexId = `${bayId}-head-apex-link`
  const angUp = Math.PI / 2
  const onRingUp = point(Oc.x + Math.cos(angUp) * radius, Oc.y + Math.sin(angUp) * radius)
  const upNode = `${bayId}-head-up`
  const apexNode = `${bayId}-field-apex-attach`
  addNode({
    id: upNode,
    type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
    position: onRingUp,
    parentConstructionId: bayId,
  })
  addNode({
    id: apexNode,
    type: NETWORK_NODE_TYPES.ARCH_APEX,
    position: fieldApex,
    parentConstructionId: bayId,
  })
  addMember({
    id: apexId,
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: 'SECONDARY_TRACERY',
    startNodeId: upNode,
    endNodeId: apexNode,
    path: [createSegment(onRingUp, fieldApex)],
    width: widths.HIER_FOIL * 1.05,
    metadata: { role: 'head-to-field-apex', bayId },
  })
  linkNodeMember(nodes, upNode, apexId)
  linkNodeMember(nodes, apexNode, apexId)
  linkNodeMember(nodes, upNode, ringId)

  const foilCellId = `${bayId}-foil-head`
  cells[foilCellId] = markCellAccepted(
    createArchitecturalCell({
      id: foilCellId,
      kind: CELL_KINDS.FOIL_HEAD,
      parentId: bayId,
      hierarchyLevel: parentLevelOf(bayId, cells),
      width: radius * 2,
      height: radius * 2,
      memberIds: [ringId, ...foilResult.memberIds, apexId],
      memberClass: 'FOIL_BAR',
      allowedRules: [SUBDIVISION_RULES.TERMINAL],
      metadata: { foilKind: kind, center: Oc, radius },
    }),
    kind === 'quatrefoil'
      ? SUBDIVISION_RULES.QUATREFOIL_HEAD
      : SUBDIVISION_RULES.TREFOIL_HEAD,
  )
  if (cells[bayId]) {
    cells[bayId].childIds = [...(cells[bayId].childIds ?? []), foilCellId]
  }

  return {
    ok: true,
    memberIds: [ringId, ...foilResult.memberIds, apexId],
    cellId: foilCellId,
  }
}

function parentLevelOf(bayId, cells) {
  return cells[bayId]?.hierarchyLevel ?? 1
}

/**
 * Build hierarchical tracery graph on top of 13D.8 refined secondary.
 */
export function buildHierarchicalTraceryGraph(params = {}) {
  const p = {
    ...DEFAULT_HIERARCHICAL_PARAMS,
    ...params,
    enableHierarchicalTracery: true,
    enableOculusRefinement: true,
    enableSecondaryTracery: true,
    enableOculusNetwork: true,
    enableSkeleton: true,
  }
  const depth = Math.max(0, Math.min(2, Math.round(p.hierarchicalDepth ?? 1)))

  const base = buildSecondaryTraceryGraph({
    ...p,
    enableOculusRefinement: true,
    secondaryTraceryLevel: Math.max(1, p.secondaryTraceryLevel ?? 1),
  })
  const baseCheck = validateSecondaryTraceryGraph(base)
  if (!base.ok || !baseCheck.ok) {
    return {
      ...base,
      type: 'hierarchicalTraceryGraph',
      ok: false,
      cells: {},
      hierarchy: { depth, accepted: 0, rejected: 0 },
      validation: {
        ok: false,
        errors: [...(base.validation?.errors ?? []), ...(baseCheck.errors ?? [])],
        warnings: base.validation?.warnings ?? [],
      },
      metadata: {
        title: 'Rayonnant Hierarchical (invalid base)',
        version: '13D.9',
        grammarStage: '13D.9',
      },
    }
  }

  const cells = {}
  const warnings = [...(base.validation?.warnings ?? []), ...(baseCheck.warnings ?? [])]
  const errors = []
  let accepted = 0
  let rejected = 0

  // Root + primary lancet cells (level 0)
  cells['cell-parent'] = markCellAccepted(
    createArchitecturalCell({
      id: 'cell-parent',
      kind: CELL_KINDS.PARENT_ARCH,
      hierarchyLevel: 0,
      fieldArch: base.parent,
      width: base.parent?.parameters?.span,
      height: base.parent?.parameters?.rise,
      allowedRules: [SUBDIVISION_RULES.TERMINAL],
      memberIds: Object.keys(base.members).filter((id) => id.startsWith('member-outer')),
    }),
    SUBDIVISION_RULES.TERMINAL,
  )
  cells['cell-bay-left'] = createArchitecturalCell({
    id: 'cell-bay-left',
    kind: CELL_KINDS.PRIMARY_LANCET,
    parentId: 'cell-parent',
    hierarchyLevel: 0,
    fieldArch: base.leftChild,
    width: base.leftChild?.parameters?.span,
    height: base.leftChild?.parameters?.rise,
    localOrigin: point(base.leftChild?.parameters?.offsetX ?? 0, base.leftChild?.parameters?.springingY),
    allowedRules: [
      SUBDIVISION_RULES.POINTED_ARCH_SUBDIVISION,
      SUBDIVISION_RULES.TREFOIL_HEAD,
      SUBDIVISION_RULES.QUATREFOIL_HEAD,
      SUBDIVISION_RULES.TERMINAL,
    ],
    memberIds: ['member-left-lancet'],
    memberClass: 'LANCET_ARCH',
  })
  cells['cell-bay-right'] = createArchitecturalCell({
    id: 'cell-bay-right',
    kind: CELL_KINDS.PRIMARY_LANCET,
    parentId: 'cell-parent',
    hierarchyLevel: 0,
    fieldArch: base.rightChild,
    width: base.rightChild?.parameters?.span,
    height: base.rightChild?.parameters?.rise,
    localOrigin: point(
      base.rightChild?.parameters?.offsetX ?? 0,
      base.rightChild?.parameters?.springingY,
    ),
    allowedRules: [
      SUBDIVISION_RULES.POINTED_ARCH_SUBDIVISION,
      SUBDIVISION_RULES.TREFOIL_HEAD,
      SUBDIVISION_RULES.QUATREFOIL_HEAD,
      SUBDIVISION_RULES.TERMINAL,
    ],
    memberIds: ['member-right-lancet'],
    memberClass: 'LANCET_ARCH',
  })
  cells['cell-parent'].childIds = ['cell-bay-left', 'cell-bay-right']

  if (depth === 0 || p.nestedArches === false) {
    cells['cell-bay-left'] = markCellTerminal(cells['cell-bay-left'], 'depth 0 / nested arches off')
    cells['cell-bay-right'] = markCellTerminal(cells['cell-bay-right'], 'depth 0 / nested arches off')
    rejected += 2
    return finalizeHierarchical(base, {
      cells,
      depth,
      accepted,
      rejected,
      warnings,
      errors,
      p,
      extraMembers: {},
      extraNodes: {},
      extraSamples: {},
    })
  }

  const nodes = { ...base.nodes }
  const members = { ...base.members }
  const memberSamples = { ...(base.memberSamples ?? {}) }
  const widths = resolveHierarchicalWidths(p, base.widths ?? {})

  const addNode = (partial) => {
    const n = createNetworkNode(partial)
    nodes[n.id] = n
    return n
  }
  const addMember = (partial) => {
    const m = createNetworkMember({
      ...partial,
      depth: partial.depth ?? p.stoneDepth,
    })
    if (!(m.width > 0) || !Number.isFinite(m.width)) {
      errors.push(`member ${m.id} non-positive width`)
    }
    if (!m.path?.length) errors.push(`member ${m.id} missing exact path`)
    members[m.id] = m
    if (m.startNodeId) linkNodeMember(nodes, m.startNodeId, m.id)
    if (m.endNodeId && m.endNodeId !== m.startNodeId) {
      linkNodeMember(nodes, m.endNodeId, m.id)
    }
    const segs = m.closed ? 36 : 22
    memberSamples[m.id] = sampleSkeletonPath(m.path, segs)
    return m
  }

  const ctx = {
    p,
    widths,
    nodes,
    members,
    memberSamples,
    addNode,
    addMember,
    errors,
    warnings,
    cells,
  }

  const bayResults = []
  for (const bayId of ['cell-bay-left', 'cell-bay-right']) {
    const field = cells[bayId].fieldArch
    const result = subdivideLancetBay(bayId, field, 1, ctx)
    if (result.ok) {
      accepted += 1
      bayResults.push({ bayId, ...result })

      // RULE B / C — one head foil per bay (trefoil preferred; optional quatrefoil when trefoils off)
      const headKind =
        p.trefoilHeads !== false
          ? 'trefoil'
          : p.secondaryQuatrefoils === true
            ? 'quatrefoil'
            : null
      if (headKind) {
        const foil = placeBayHeadFoil(
          bayId,
          field,
          result.leftChild,
          result.rightChild,
          headKind,
          ctx,
        )
        if (foil.ok) accepted += 1
        else rejected += 1
      } else if (p.secondaryQuatrefoils === true && p.trefoilHeads !== false) {
        warnings.push(
          `${bayId}: secondary quatrefoil deferred — trefoil occupies bay head (enable trefoils OFF to place quatrefoil)`,
        )
      }
    } else {
      rejected += 1
    }
  }

  // LEVEL 2 — tertiary pointed-arch subdivision only (RULE A).
  // Foil heads (RULE B/C) stay at primary-bay level: tertiary clearances rarely
  // admit tip→ring stubs without floating components or degenerate faces.
  if (depth >= 2) {
    const secondaryIds = Object.keys(cells).filter(
      (id) => cells[id].kind === CELL_KINDS.SECONDARY_ARCH && cells[id].constraintStatus === 'accepted',
    )
    for (const cellId of secondaryIds) {
      const field = cells[cellId].fieldArch
      const result = subdivideLancetBay(cellId, field, 2, ctx)
      if (result.ok) {
        accepted += 1
        warnings.push(
          `${cellId}: tertiary arches accepted; foil head deferred (insufficient reliable clearance)`,
        )
      } else {
        rejected += 1
      }
    }
  }

  // Depressed parent note
  if (base.parent?.parameters?.family === ARCH_FAMILIES.depressed) {
    warnings.push(
      'Parent family is depressed — nested children forced to lancet; tertiary may terminate early',
    )
  }

  return finalizeHierarchical(base, {
    cells,
    depth,
    accepted,
    rejected,
    warnings,
    errors,
    p,
    nodes,
    members,
    memberSamples,
    widths,
  })
}

function finalizeHierarchical(base, state) {
  const {
    cells,
    depth,
    accepted,
    rejected,
    warnings,
    errors,
    p,
    nodes,
    members,
    memberSamples,
    widths,
  } = state

  const useNodes = nodes ?? base.nodes
  const useMembers = members ?? base.members
  const useSamples = memberSamples ?? base.memberSamples
  const useWidths = widths ?? base.widths
  const ok = errors.length === 0 && (base.ok !== false)

  return {
    ok,
    type: 'hierarchicalTraceryGraph',
    id: base.id,
    nodes: useNodes,
    members: useMembers,
    memberSamples: useSamples,
    widths: useWidths,
    parameters: { ...p, hierarchicalDepth: depth },
    parent: base.parent,
    leftChild: base.leftChild,
    rightChild: base.rightChild,
    subdivision: base.subdivision,
    oculus: base.oculus,
    foil: base.foil,
    secondary: base.secondary,
    cells,
    hierarchy: {
      depth,
      cellCount: Object.keys(cells).length,
      accepted,
      rejected,
    },
    validation: { ok, errors, warnings },
    metadata: {
      title: `Rayonnant Hierarchical · Depth ${depth}`,
      version: '13D.9',
      references: ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-006'],
      note: 'Recursive pointed-arch cells + trefoil heads on 13D.8 refined skeleton; strip-union stone.',
      memberCount: Object.keys(useMembers).length,
      nodeCount: Object.keys(useNodes).length,
      hierarchicalDepth: depth,
      cellCount: Object.keys(cells).length,
      acceptedSubdivisions: accepted,
      rejectedSubdivisions: rejected,
      enableHierarchicalTracery: true,
      enableOculusRefinement: true,
      representation: 'strip-union-hierarchical',
      grammarStage: `13D.9-L${depth}`,
    },
  }
}

export function validateHierarchicalTraceryGraph(graph) {
  const base = validateSecondaryTraceryGraph({
    ...graph,
    type: 'secondaryTraceryGraph',
  })
  const errors = [...(base.errors ?? [])]
  const warnings = [...(base.warnings ?? [])]
  if (!graph?.ok) {
    return { ok: false, errors: [...errors, ...(graph.validation?.errors ?? [])], warnings }
  }
  const depth = graph.hierarchy?.depth ?? graph.parameters?.hierarchicalDepth ?? 0
  if (depth >= 1 && graph.parameters?.nestedArches !== false) {
    const secondary = Object.values(graph.cells ?? {}).filter(
      (c) => c.kind === CELL_KINDS.SECONDARY_ARCH && c.constraintStatus === 'accepted',
    )
    if (secondary.length < 2) {
      // May be clearance-rejected on both bays — warn, don't hard-fail if terminal reasons exist
      const rejectedBays = Object.values(graph.cells ?? {}).filter(
        (c) =>
          c.kind === CELL_KINDS.PRIMARY_LANCET && c.constraintStatus === 'rejected',
      )
      if (rejectedBays.length < 2) {
        warnings.push('hierarchical depth≥1 but fewer than 2 accepted secondary arches')
      }
    }
  }
  // All accepted cells must reference existing members when they claim memberIds
  for (const cell of Object.values(graph.cells ?? {})) {
    if (cell.constraintStatus !== 'accepted') continue
    for (const mid of cell.memberIds ?? []) {
      if (!graph.members?.[mid]) {
        // foil/radial ids may be present; missing is an error
        errors.push(`cell ${cell.id} references missing member ${mid}`)
      }
    }
  }
  const positive = Object.values(graph.members ?? {}).every(
    (m) => m.width > 0 && Number.isFinite(m.width),
  )
  if (!positive) errors.push('hierarchical member non-positive width')
  return { ok: errors.length === 0, errors, warnings }
}
