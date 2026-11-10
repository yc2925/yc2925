/**
 * Minimal Rayonnant skeleton centerline graph (Step 13D.5).
 *
 * Members only:
 * A. Parent pointed arch (left/right arcs)
 * B. Two child lancet arches
 * C. Central vertical mullion
 * D. Bottom sill + side jambs (required connections)
 *
 * No oculus, foils, spandrels, or nested secondary lights.
 */

import { point } from '../../kernel/vector2.js'
import { createSegment } from '../../kernel/line2.js'
import { ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import { buildLancetSubdivision, DEFAULT_SUBDIVISION_PARAMS } from '../lancetSubdivision.js'
import {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  createNetworkNode,
  createNetworkMember,
} from '../barNetworkTypes.js'
import { nextId } from '../../kernel/result.js'

export const SKELETON_WIDTH_DEFAULTS = Object.freeze({
  masterFrameWidth: 0.12,
  primaryArchWidthRatio: 1.0,
  mullionWidthRatio: 0.67,
  childArchWidthRatio: 0.54,
})

export const DEFAULT_SKELETON_PARAMS = Object.freeze({
  family: DEFAULT_SUBDIVISION_PARAMS.family,
  span: DEFAULT_SUBDIVISION_PARAMS.span,
  riseRatio: DEFAULT_SUBDIVISION_PARAMS.riseRatio,
  springingY: DEFAULT_SUBDIVISION_PARAMS.springingY,
  samplingQuality: DEFAULT_SUBDIVISION_PARAMS.samplingQuality,
  subdivisionRatio: 0.5,
  symmetric: true,
  childRiseRatio: 1.08,
  childFamily: DEFAULT_SUBDIVISION_PARAMS.childFamily,
  containmentMargin: 0.012,
  windowBaseElevation: -0.35,
  stoneDepth: 0.25,
  ...SKELETON_WIDTH_DEFAULTS,
  /** Jamb inset ≈ half outer frame so child springings meet inner jamb face. */
  jambInset: null,
  mullionWidth: null,
})

function resolveWidths(p) {
  const outer = Math.max(0.04, p.masterFrameWidth ?? p.outerFrameWidth ?? 0.12)
  const primary = Math.max(0.02, outer * (p.primaryArchWidthRatio ?? 1))
  const mullion = Math.max(0.02, outer * (p.mullionWidthRatio ?? 0.67))
  const child = Math.max(0.02, outer * (p.childArchWidthRatio ?? 0.54))
  return {
    OUTER_FRAME: primary,
    PRIMARY_MULLION: Math.min(mullion, primary * 0.95),
    LANCET_ARCH: Math.min(child, mullion * 0.95),
  }
}

function linkNodeMember(nodes, nodeId, memberId) {
  const n = nodes[nodeId]
  if (!n) return
  if (!n.memberIds.includes(memberId)) n.memberIds.push(memberId)
}

function samplePath(path, segments = 20) {
  const pts = []
  for (const e of path) {
    if (e.type === 'arc' || e.sweepAngle != null) {
      const n = Math.max(6, segments)
      for (let i = 0; i <= n; i += 1) {
        const t = i / n
        const ang = e.startAngle + e.sweepAngle * t
        pts.push({
          x: e.center.x + Math.cos(ang) * e.radius,
          y: e.center.y + Math.sin(ang) * e.radius,
        })
      }
    } else if (e.a && e.b) {
      pts.push({ x: e.a.x, y: e.a.y }, { x: e.b.x, y: e.b.y })
    }
  }
  const out = []
  for (const p of pts) {
    const prev = out[out.length - 1]
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 1e-9) out.push(p)
  }
  return out
}

/**
 * Build skeleton centerline graph from parent + two lancets.
 */
export function buildSkeletonGraph(params = {}) {
  const widthsPreview = resolveWidths({ ...SKELETON_WIDTH_DEFAULTS, ...params })
  const p = {
    ...DEFAULT_SKELETON_PARAMS,
    ...params,
    mullionWidth: params.mullionWidth ?? widthsPreview.PRIMARY_MULLION,
    jambInset:
      params.jambInset ??
      Math.max(0.02, (params.masterFrameWidth ?? SKELETON_WIDTH_DEFAULTS.masterFrameWidth) * 0.45),
  }
  const widths = resolveWidths(p)
  // Keep subdivision mullion in sync with resolved primary mullion
  p.mullionWidth = widths.PRIMARY_MULLION

  const subdivision = buildLancetSubdivision({
    ...DEFAULT_SUBDIVISION_PARAMS,
    family: p.family,
    span: p.span,
    riseRatio: p.riseRatio,
    springingY: p.springingY,
    samplingQuality: p.samplingQuality,
    subdivisionRatio: p.subdivisionRatio,
    mullionWidth: p.mullionWidth,
    jambInset: p.jambInset,
    childRiseRatio: p.childRiseRatio,
    childFamily: p.childFamily,
    symmetric: p.symmetric !== false,
    containmentMargin: p.containmentMargin,
  })

  if (!subdivision.validation?.ok) {
    return {
      ok: false,
      type: 'skeletonGraph',
      id: nextId('sk'),
      nodes: {},
      members: {},
      validation: {
        ok: false,
        errors: subdivision.validation?.errors ?? ['subdivision failed'],
        warnings: [],
      },
      parameters: p,
      widths,
      subdivision,
    }
  }

  const parent = subdivision.metadata.parent
  const leftChild = subdivision.metadata.leftChild
  const rightChild = subdivision.metadata.rightChild
  const baseY = p.windowBaseElevation
  const springY = parent.parameters.springingY

  const nodes = {}
  const members = {}
  const errors = []
  const warnings = []

  const addNode = (partial) => {
    const n = createNetworkNode(partial)
    nodes[n.id] = n
    return n
  }
  const addMember = (partial) => {
    const m = createNetworkMember({
      ...partial,
      width: partial.width,
      depth: partial.depth ?? p.stoneDepth,
    })
    if (!(m.width > 0) || !Number.isFinite(m.width)) {
      errors.push(`member ${m.id} non-positive width`)
    }
    if (!m.path?.length) errors.push(`member ${m.id} missing exact path`)
    members[m.id] = m
    if (m.startNodeId) linkNodeMember(nodes, m.startNodeId, m.id)
    if (m.endNodeId) linkNodeMember(nodes, m.endNodeId, m.id)
    return m
  }

  const pL = parent.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const pR = parent.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const pA = parent.points[ARCH_SEMANTICS.APEX]
  const lL = leftChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const lR = leftChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const lA = leftChild.points[ARCH_SEMANTICS.APEX]
  const rL = rightChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const rR = rightChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rA = rightChild.points[ARCH_SEMANTICS.APEX]

  // --- Nodes ---
  addNode({
    id: 'node-sill-left',
    type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
    position: point(pL.x, baseY),
    parentConstructionId: 'outer-frame',
  })
  addNode({
    id: 'node-sill-right',
    type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
    position: point(pR.x, baseY),
    parentConstructionId: 'outer-frame',
  })
  addNode({
    id: 'node-parent-left-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: pL,
    parentConstructionId: 'parent-arch',
  })
  addNode({
    id: 'node-parent-right-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: pR,
    parentConstructionId: 'parent-arch',
  })
  addNode({
    id: 'node-parent-apex',
    type: NETWORK_NODE_TYPES.ARCH_APEX,
    position: pA,
    parentConstructionId: 'parent-arch',
  })
  addNode({
    id: 'node-left-lancet-apex',
    type: NETWORK_NODE_TYPES.ARCH_APEX,
    position: lA,
    parentConstructionId: 'left-lancet',
  })
  addNode({
    id: 'node-right-lancet-apex',
    type: NETWORK_NODE_TYPES.ARCH_APEX,
    position: rA,
    parentConstructionId: 'right-lancet',
  })
  addNode({
    id: 'node-mullion-base',
    type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
    position: point(0, baseY),
    parentConstructionId: 'mullion',
  })
  // Mullion terminates at child springing elevation (not apex)
  addNode({
    id: 'node-mullion-top',
    type: NETWORK_NODE_TYPES.MULLION_JUNCTION,
    position: point((lR.x + rL.x) / 2, springY),
    parentConstructionId: 'mullion',
  })
  addNode({
    id: 'node-left-child-left-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: lL,
    parentConstructionId: 'left-lancet',
  })
  addNode({
    id: 'node-left-child-right-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: lR,
    parentConstructionId: 'left-lancet',
  })
  addNode({
    id: 'node-right-child-left-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: rL,
    parentConstructionId: 'right-lancet',
  })
  addNode({
    id: 'node-right-child-right-spring',
    type: NETWORK_NODE_TYPES.SPRINGING_POINT,
    position: rR,
    parentConstructionId: 'right-lancet',
  })

  // --- A. Parent arch ---
  addMember({
    id: 'member-outer-left-arc',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-parent-left-spring',
    endNodeId: 'node-parent-apex',
    path: [parent.arcs[ARCH_SEMANTICS.LEFT_ARC]],
    width: widths.OUTER_FRAME,
  })
  addMember({
    id: 'member-outer-right-arc',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-parent-apex',
    endNodeId: 'node-parent-right-spring',
    path: [parent.arcs[ARCH_SEMANTICS.RIGHT_ARC]],
    width: widths.OUTER_FRAME,
  })

  // --- D. Jambs + sill ---
  addMember({
    id: 'member-outer-left-jamb',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-sill-left',
    endNodeId: 'node-parent-left-spring',
    path: [createSegment(point(pL.x, baseY), pL)],
    width: widths.OUTER_FRAME,
  })
  addMember({
    id: 'member-outer-right-jamb',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-sill-right',
    endNodeId: 'node-parent-right-spring',
    path: [createSegment(point(pR.x, baseY), pR)],
    width: widths.OUTER_FRAME,
  })
  addMember({
    id: 'member-outer-sill',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-sill-left',
    endNodeId: 'node-sill-right',
    path: [createSegment(point(pL.x, baseY), point(pR.x, baseY))],
    width: widths.OUTER_FRAME,
  })

  // --- C. Central mullion (sill → springing) ---
  addMember({
    id: 'member-primary-mullion',
    type: NETWORK_MEMBER_TYPES.PRIMARY_MULLION,
    memberClass: 'PRIMARY_MULLION',
    startNodeId: 'node-mullion-base',
    endNodeId: 'node-mullion-top',
    path: [
      createSegment(nodes['node-mullion-base'].position, nodes['node-mullion-top'].position),
    ],
    width: widths.PRIMARY_MULLION,
  })

  // --- B. Child lancet arches (exact arcs only) ---
  addMember({
    id: 'member-left-lancet',
    type: NETWORK_MEMBER_TYPES.LANCET_ARCH,
    memberClass: 'LANCET_ARCH',
    startNodeId: 'node-left-child-left-spring',
    endNodeId: 'node-left-child-right-spring',
    path: [
      leftChild.arcs[ARCH_SEMANTICS.LEFT_ARC],
      leftChild.arcs[ARCH_SEMANTICS.RIGHT_ARC],
    ],
    width: widths.LANCET_ARCH,
  })
  linkNodeMember(nodes, 'node-left-lancet-apex', 'member-left-lancet')
  addMember({
    id: 'member-right-lancet',
    type: NETWORK_MEMBER_TYPES.LANCET_ARCH,
    memberClass: 'LANCET_ARCH',
    startNodeId: 'node-right-child-left-spring',
    endNodeId: 'node-right-child-right-spring',
    path: [
      rightChild.arcs[ARCH_SEMANTICS.LEFT_ARC],
      rightChild.arcs[ARCH_SEMANTICS.RIGHT_ARC],
    ],
    width: widths.LANCET_ARCH,
  })
  linkNodeMember(nodes, 'node-right-lancet-apex', 'member-right-lancet')

  // --- D. Springing connections (child → jamb / mullion) ---
  addMember({
    id: 'member-left-outer-spring-rail',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-parent-left-spring',
    endNodeId: 'node-left-child-left-spring',
    path: [createSegment(pL, lL)],
    width: widths.OUTER_FRAME * 0.85,
  })
  addMember({
    id: 'member-left-inner-spring-rail',
    type: NETWORK_MEMBER_TYPES.PRIMARY_MULLION,
    memberClass: 'PRIMARY_MULLION',
    startNodeId: 'node-left-child-right-spring',
    endNodeId: 'node-mullion-top',
    path: [createSegment(lR, nodes['node-mullion-top'].position)],
    width: widths.PRIMARY_MULLION,
  })
  addMember({
    id: 'member-right-inner-spring-rail',
    type: NETWORK_MEMBER_TYPES.PRIMARY_MULLION,
    memberClass: 'PRIMARY_MULLION',
    startNodeId: 'node-mullion-top',
    endNodeId: 'node-right-child-left-spring',
    path: [createSegment(nodes['node-mullion-top'].position, rL)],
    width: widths.PRIMARY_MULLION,
  })
  addMember({
    id: 'member-right-outer-spring-rail',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: 'OUTER_FRAME',
    startNodeId: 'node-right-child-right-spring',
    endNodeId: 'node-parent-right-spring',
    path: [createSegment(rR, pR)],
    width: widths.OUTER_FRAME * 0.85,
  })

  // Samples for strips / overlays
  const memberSamples = {}
  for (const m of Object.values(members)) {
    memberSamples[m.id] = samplePath(m.path, 22)
  }

  // Connectivity: every node degree ≥ 1; members share junctions
  const orphanNodes = Object.values(nodes).filter((n) => !n.memberIds.length)
  if (orphanNodes.length) {
    warnings.push(`orphan nodes: ${orphanNodes.map((n) => n.id).join(', ')}`)
  }

  const ok = errors.length === 0 && Object.keys(members).length >= 8
  return {
    ok,
    type: 'skeletonGraph',
    id: nextId('sk'),
    nodes,
    members,
    memberSamples,
    widths,
    parameters: p,
    parent,
    leftChild,
    rightChild,
    subdivision,
    validation: { ok, errors, warnings },
    metadata: {
      title: 'Rayonnant Skeleton · Centerline Graph',
      version: '13D.5',
      references: ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
      note: 'Parent arch + two lancets + mullion + sill/jambs/springing rails. No oculus/foils.',
      memberCount: Object.keys(members).length,
      nodeCount: Object.keys(nodes).length,
    },
  }
}

export function validateSkeletonGraph(graph) {
  const errors = []
  const warnings = []
  if (!graph?.ok) {
    return { ok: false, errors: graph?.validation?.errors ?? ['graph invalid'], warnings }
  }
  const ids = new Set()
  for (const m of Object.values(graph.members)) {
    if (ids.has(m.id)) errors.push(`duplicate member id ${m.id}`)
    ids.add(m.id)
    if (!(m.width > 0)) errors.push(`${m.id} width`)
    if (!m.path?.length) errors.push(`${m.id} empty path`)
    const samples = graph.memberSamples?.[m.id]
    if (!samples || samples.length < 2) errors.push(`${m.id} samples`)
    else {
      for (const p of samples) {
        if (![p.x, p.y].every(Number.isFinite)) errors.push(`${m.id} nonfinite sample`)
      }
    }
  }
  // Core members required
  for (const id of [
    'member-outer-left-arc',
    'member-outer-right-arc',
    'member-primary-mullion',
    'member-left-lancet',
    'member-right-lancet',
    'member-outer-sill',
  ]) {
    if (!graph.members[id]) errors.push(`missing ${id}`)
  }
  return { ok: errors.length === 0, errors, warnings }
}

export { samplePath as sampleSkeletonPath }
