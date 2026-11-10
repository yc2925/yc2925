/**
 * Connected Rayonnant bar-tracery network graph (Step 13D.3).
 *
 * Derived from existing pointed-arch + lancet + oculus + foil constructions.
 * Exact arcs/segments are preserved on members; polylines are derived only
 * for display / offset tessellation.
 */

import { point } from '../kernel/vector2.js'
import { createSegment } from '../kernel/line2.js'
import { createArc, startPoint, endPoint } from '../kernel/arc2.js'
import { nextId } from '../kernel/result.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { buildComposedWindow, DEFAULT_COMPOSED_PARAMS } from './composedWindow.js'
import { closedLoopFromArch, sampleLoop, ensureCw } from './openingLoops.js'
import { buildUpperBarSubdivision } from './upperBarSubdivision.js'
import { validateClosure } from '../kernel/planarRegions.js'
import {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  BAR_NETWORK_WIDTH_RATIOS,
  createNetworkNode,
  createNetworkMember,
} from './barNetworkTypes.js'
import { MEMBER_CLASSES } from './memberHierarchy.js'
import { DEFAULT_REGION_PARAMS } from './regionRoles.js'

const SAMPLE_OPTS = { segments: 24 }

/** Local foil→void (avoid circular import with solidVoid). */
function foilArcsToVoidLoop(foil) {
  if (!foil?.validation?.ok || !foil.arcs?.length) {
    return { ok: false, errors: foil?.validation?.errors ?? ['invalid foil'], edges: [] }
  }
  const edges = [...foil.arcs]
  const scale = foil.parameters?.size ?? 1
  const closure = validateClosure(edges, scale)
  const oriented = ensureCw(edges, SAMPLE_OPTS)
  const errors = []
  if (!closure.ok) errors.push(`foil void not closed: ${closure.reason}`)
  return { ok: errors.length === 0, errors, edges: oriented.edges }
}

function resolveWidths(masterFrameWidth, ratios = {}) {
  const r = { ...BAR_NETWORK_WIDTH_RATIOS, ...ratios }
  const outer = Math.max(0.02, masterFrameWidth)
  const widths = {
    [NETWORK_MEMBER_TYPES.OUTER_FRAME]: outer * r.OUTER_FRAME,
    [NETWORK_MEMBER_TYPES.PRIMARY_MULLION]: outer * r.PRIMARY_MULLION,
    [NETWORK_MEMBER_TYPES.LANCET_ARCH]: outer * r.LANCET_ARCH,
    [NETWORK_MEMBER_TYPES.SECONDARY_TRACERY]: outer * r.SECONDARY_TRACERY,
    [NETWORK_MEMBER_TYPES.OCULUS_RING]: outer * r.OCULUS_RING,
    [NETWORK_MEMBER_TYPES.FOIL_BAR]: outer * r.FOIL_BAR,
  }
  // Hierarchy clamp
  widths[NETWORK_MEMBER_TYPES.PRIMARY_MULLION] = Math.min(
    widths[NETWORK_MEMBER_TYPES.PRIMARY_MULLION],
    widths[NETWORK_MEMBER_TYPES.OUTER_FRAME] * 0.95,
  )
  widths[NETWORK_MEMBER_TYPES.LANCET_ARCH] = Math.min(
    widths[NETWORK_MEMBER_TYPES.LANCET_ARCH],
    widths[NETWORK_MEMBER_TYPES.PRIMARY_MULLION],
  )
  widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY] = Math.min(
    widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
    widths[NETWORK_MEMBER_TYPES.LANCET_ARCH],
  )
  widths[NETWORK_MEMBER_TYPES.OCULUS_RING] = Math.min(
    widths[NETWORK_MEMBER_TYPES.OCULUS_RING],
    widths[NETWORK_MEMBER_TYPES.PRIMARY_MULLION],
  )
  widths[NETWORK_MEMBER_TYPES.FOIL_BAR] = Math.min(
    widths[NETWORK_MEMBER_TYPES.FOIL_BAR],
    widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
  )
  return widths
}

function linkNodeMember(nodes, nodeId, memberId) {
  const n = nodes[nodeId]
  if (!n) return
  if (!n.memberIds.includes(memberId)) n.memberIds.push(memberId)
}

function samplePath(path, segments = 16) {
  const pts = []
  for (const e of path) {
    if (e.type === 'arc' || e.sweepAngle != null) {
      const n = Math.max(4, segments)
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
  // Deduplicate consecutive
  const out = []
  for (const p of pts) {
    const prev = out[out.length - 1]
    if (!prev || Math.hypot(prev.x - p.x, prev.y - p.y) > 1e-9) out.push(p)
  }
  return out
}

/**
 * Build semantic bar network + upper cells from composed window geometry.
 */
export function buildBarNetwork(params = {}) {
  const p = {
    ...DEFAULT_COMPOSED_PARAMS,
    ...DEFAULT_REGION_PARAMS,
    masterFrameWidth: params.outerFrameWidth ?? DEFAULT_REGION_PARAMS.outerFrameWidth,
    primaryMullionRatio: BAR_NETWORK_WIDTH_RATIOS.PRIMARY_MULLION,
    lancetArchRatio: BAR_NETWORK_WIDTH_RATIOS.LANCET_ARCH,
    secondaryTraceryRatio: BAR_NETWORK_WIDTH_RATIOS.SECONDARY_TRACERY,
    oculusRingRatio: BAR_NETWORK_WIDTH_RATIOS.OCULUS_RING,
    foilBarRatio: BAR_NETWORK_WIDTH_RATIOS.FOIL_BAR,
    upperSubdivisionDensity: 0.75,
    minWebClearance: 0.04,
    stoneDepth: 0.25,
    ...params,
  }

  const composed = buildComposedWindow(p)
  if (!composed.validation?.ok) {
    return {
      ok: false,
      type: 'barNetwork',
      id: nextId('bn'),
      nodes: {},
      members: {},
      cells: [],
      composed,
      validation: {
        ok: false,
        errors: composed.validation?.errors ?? ['composed window invalid'],
        warnings: [],
      },
      parameters: p,
    }
  }

  const parent = composed.metadata.parent
  const leftChild = composed.metadata.leftChild
  const rightChild = composed.metadata.rightChild
  const oculus = composed.metadata.oculus
  const foil = composed.metadata.foil
  const baseY = p.windowBaseElevation ?? DEFAULT_REGION_PARAMS.windowBaseElevation

  const widths = resolveWidths(p.masterFrameWidth, {
    OUTER_FRAME: 1,
    PRIMARY_MULLION: p.primaryMullionRatio,
    LANCET_ARCH: p.lancetArchRatio,
    SECONDARY_TRACERY: p.secondaryTraceryRatio,
    OCULUS_RING: p.oculusRingRatio,
    FOIL_BAR: p.foilBarRatio,
  })

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
      width: partial.width ?? widths[partial.type],
      depth: partial.depth ?? p.stoneDepth,
    })
    if (!(m.width > 0) || !Number.isFinite(m.width)) {
      errors.push(`member ${m.id} non-positive width`)
    }
    if (!m.path?.length) {
      errors.push(`member ${m.id} missing exact path`)
    } else {
      for (const e of m.path) {
        if (e.type === 'arc' || e.sweepAngle != null) {
          if (!Number.isFinite(e.radius) || !(e.radius > 0)) {
            errors.push(`member ${m.id} nonfinite arc`)
          }
        } else if (e.a && e.b) {
          if (![e.a.x, e.a.y, e.b.x, e.b.y].every(Number.isFinite)) {
            errors.push(`member ${m.id} nonfinite segment`)
          }
        }
      }
    }
    members[m.id] = m
    if (m.startNodeId) linkNodeMember(nodes, m.startNodeId, m.id)
    if (m.endNodeId) linkNodeMember(nodes, m.endNodeId, m.id)
    return m
  }

  // --- Nodes from parent / children / oculus ---
  const pL = parent.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const pR = parent.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const pA = parent.points[ARCH_SEMANTICS.APEX]
  const lL = leftChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const lR = leftChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const lA = leftChild.points[ARCH_SEMANTICS.APEX]
  const rL = rightChild.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const rR = rightChild.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const rA = rightChild.points[ARCH_SEMANTICS.APEX]

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
    parentConstructionId: 'left-child',
  })
  addNode({
    id: 'node-right-lancet-apex',
    type: NETWORK_NODE_TYPES.ARCH_APEX,
    position: rA,
    parentConstructionId: 'right-child',
  })
  addNode({
    id: 'node-mullion-base',
    type: NETWORK_NODE_TYPES.BOUNDARY_CONNECTION,
    position: point((lR.x + rL.x) / 2, baseY),
    parentConstructionId: 'mullion',
  })
  addNode({
    id: 'node-mullion-junction',
    type: NETWORK_NODE_TYPES.MULLION_JUNCTION,
    position: point((lR.x + rL.x) / 2, Math.min(lA.y, rA.y)),
    parentConstructionId: 'mullion',
    constraints: { between: ['left-child', 'right-child'] },
  })
  addNode({
    id: 'node-oculus-center',
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: oculus.center,
    parentConstructionId: 'upper-oculus',
  })

  // Cardinal oculus junctions (for secondary connectors)
  for (const [tag, ang] of [
    ['east', 0],
    ['north', Math.PI / 2],
    ['west', Math.PI],
    ['south', -Math.PI / 2],
  ]) {
    addNode({
      id: `node-oculus-${tag}`,
      type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
      position: point(
        oculus.center.x + Math.cos(ang) * oculus.radius,
        oculus.center.y + Math.sin(ang) * oculus.radius,
      ),
      parentConstructionId: 'upper-oculus',
      constraints: { angle: ang },
    })
  }

  // --- Outer frame members (parent clear-opening arcs + sill) ---
  const parentLeftArc = parent.arcs[ARCH_SEMANTICS.LEFT_ARC]
  const parentRightArc = parent.arcs[ARCH_SEMANTICS.RIGHT_ARC]
  addMember({
    id: 'member-outer-left-arc',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: MEMBER_CLASSES.OUTER_FRAME,
    startNodeId: 'node-parent-left-spring',
    endNodeId: 'node-parent-apex',
    path: [parentLeftArc],
    parentId: null,
    width: widths[NETWORK_MEMBER_TYPES.OUTER_FRAME],
  })
  addMember({
    id: 'member-outer-right-arc',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: MEMBER_CLASSES.OUTER_FRAME,
    startNodeId: 'node-parent-apex',
    endNodeId: 'node-parent-right-spring',
    path: [parentRightArc],
    parentId: null,
    width: widths[NETWORK_MEMBER_TYPES.OUTER_FRAME],
  })
  addMember({
    id: 'member-outer-sill',
    type: NETWORK_MEMBER_TYPES.OUTER_FRAME,
    memberClass: MEMBER_CLASSES.OUTER_FRAME,
    startNodeId: 'node-parent-left-spring',
    endNodeId: 'node-parent-right-spring',
    path: [createSegment(point(pL.x, baseY), point(pR.x, baseY))],
    parentId: null,
    width: widths[NETWORK_MEMBER_TYPES.OUTER_FRAME],
  })

  // --- Lancet arches ---
  const leftLoop = closedLoopFromArch(leftChild, baseY)
  const rightLoop = closedLoopFromArch(rightChild, baseY)
  if (!leftLoop.ok || !rightLoop.ok) {
    errors.push(...(leftLoop.errors ?? []), ...(rightLoop.errors ?? []))
  }
  addMember({
    id: 'member-left-lancet',
    type: NETWORK_MEMBER_TYPES.LANCET_ARCH,
    memberClass: MEMBER_CLASSES.PRIMARY_MULLION,
    startNodeId: 'node-parent-left-spring',
    endNodeId: 'node-mullion-junction',
    path: [
      leftChild.arcs[ARCH_SEMANTICS.LEFT_ARC],
      leftChild.arcs[ARCH_SEMANTICS.RIGHT_ARC],
    ],
    parentId: 'member-outer-left-arc',
    width: widths[NETWORK_MEMBER_TYPES.LANCET_ARCH],
  })
  addMember({
    id: 'member-right-lancet',
    type: NETWORK_MEMBER_TYPES.LANCET_ARCH,
    memberClass: MEMBER_CLASSES.PRIMARY_MULLION,
    startNodeId: 'node-mullion-junction',
    endNodeId: 'node-parent-right-spring',
    path: [
      rightChild.arcs[ARCH_SEMANTICS.LEFT_ARC],
      rightChild.arcs[ARCH_SEMANTICS.RIGHT_ARC],
    ],
    parentId: 'member-outer-right-arc',
    width: widths[NETWORK_MEMBER_TYPES.LANCET_ARCH],
  })

  // --- Central mullion ---
  addMember({
    id: 'member-primary-mullion',
    type: NETWORK_MEMBER_TYPES.PRIMARY_MULLION,
    memberClass: MEMBER_CLASSES.PRIMARY_MULLION,
    startNodeId: 'node-mullion-base',
    endNodeId: 'node-mullion-junction',
    path: [
      createSegment(
        nodes['node-mullion-base'].position,
        nodes['node-mullion-junction'].position,
      ),
    ],
    parentId: 'member-outer-sill',
    width: widths[NETWORK_MEMBER_TYPES.PRIMARY_MULLION],
  })

  // --- Oculus ring (exact circle as four arcs) ---
  const Oc = oculus.center
  const Ro = oculus.radius
  const ringArcs = [0, 1, 2, 3].map((i) =>
    createArc(Oc, Ro, (i * Math.PI) / 2, Math.PI / 2),
  )
  addMember({
    id: 'member-oculus-ring',
    type: NETWORK_MEMBER_TYPES.OCULUS_RING,
    memberClass: MEMBER_CLASSES.OCULUS_FRAME,
    startNodeId: 'node-oculus-east',
    endNodeId: 'node-oculus-east',
    closed: true,
    path: ringArcs,
    parentId: 'member-primary-mullion',
    width: widths[NETWORK_MEMBER_TYPES.OCULUS_RING],
  })
  // Closed ring does not create start≠end adjacency — record cardinal cycle separately.
  const oculusRingEdges = [
    ['node-oculus-east', 'node-oculus-north'],
    ['node-oculus-north', 'node-oculus-west'],
    ['node-oculus-west', 'node-oculus-south'],
    ['node-oculus-south', 'node-oculus-east'],
  ]
  for (const id of [
    'node-oculus-east',
    'node-oculus-north',
    'node-oculus-west',
    'node-oculus-south',
  ]) {
    linkNodeMember(nodes, id, 'member-oculus-ring')
  }

  // --- Foil bars (exact foil arcs) ---
  if (foil?.arcs?.length) {
    foil.arcs.forEach((arc, i) => {
      addMember({
        id: `member-foil-bar-${i}`,
        type: NETWORK_MEMBER_TYPES.FOIL_BAR,
        memberClass: MEMBER_CLASSES.FOIL_BAR,
        startNodeId: 'node-oculus-center',
        endNodeId: 'node-oculus-center',
        path: [arc],
        parentId: 'member-oculus-ring',
        width: widths[NETWORK_MEMBER_TYPES.FOIL_BAR],
        metadata: { lobeIndex: i },
      })
    })
  } else {
    errors.push('foil arcs missing for FOIL_BAR members')
  }

  // --- Secondary connectors: lancet apex → oculus, oculus → parent apex ---
  addMember({
    id: 'member-secondary-left-to-oculus',
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: MEMBER_CLASSES.SECONDARY_TRACERY,
    startNodeId: 'node-left-lancet-apex',
    endNodeId: 'node-oculus-west',
    path: [createSegment(lA, nodes['node-oculus-west'].position)],
    parentId: 'member-left-lancet',
    width: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
  })
  addMember({
    id: 'member-secondary-right-to-oculus',
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: MEMBER_CLASSES.SECONDARY_TRACERY,
    startNodeId: 'node-right-lancet-apex',
    endNodeId: 'node-oculus-east',
    path: [createSegment(rA, nodes['node-oculus-east'].position)],
    parentId: 'member-right-lancet',
    width: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
  })
  addMember({
    id: 'member-secondary-apex-to-oculus',
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: MEMBER_CLASSES.SECONDARY_TRACERY,
    startNodeId: 'node-parent-apex',
    endNodeId: 'node-oculus-north',
    path: [createSegment(pA, nodes['node-oculus-north'].position)],
    parentId: 'member-oculus-ring',
    width: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
  })
  addMember({
    id: 'member-secondary-mullion-to-oculus',
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: MEMBER_CLASSES.SECONDARY_TRACERY,
    startNodeId: 'node-mullion-junction',
    endNodeId: 'node-oculus-south',
    path: [
      createSegment(nodes['node-mullion-junction'].position, nodes['node-oculus-south'].position),
    ],
    parentId: 'member-primary-mullion',
    width: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
  })

  // --- Opening cells ---
  const foilLoop = foilArcsToVoidLoop(foil)
  const cells = []

  if (leftLoop.ok) {
    cells.push({
      id: 'cell-left-lancet',
      type: 'LEFT_LANCET_VOID',
      edges: leftLoop.edges,
      memberIds: ['member-left-lancet', 'member-primary-mullion'],
    })
  }
  if (rightLoop.ok) {
    cells.push({
      id: 'cell-right-lancet',
      type: 'RIGHT_LANCET_VOID',
      edges: rightLoop.edges,
      memberIds: ['member-right-lancet', 'member-primary-mullion'],
    })
  }
  if (foilLoop.ok) {
    cells.push({
      id: 'cell-upper-foil',
      type: 'UPPER_FOIL_VOID',
      edges: foilLoop.edges,
      memberIds: Object.keys(members).filter((id) => id.startsWith('member-foil-bar')),
    })
  } else {
    errors.push(...(foilLoop.errors ?? ['foil void invalid']))
  }

  const upper = buildUpperBarSubdivision({
    parent,
    leftChild,
    rightChild,
    oculus,
    foil,
    leftLancetEdges: leftLoop.edges,
    rightLancetEdges: rightLoop.edges,
    secondaryWeb: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
    minWeb: Math.max(p.minWebClearance ?? 0.04, p.minStoneWebWidth ?? 0.04),
    upperSubdivisionDensity: p.upperSubdivisionDensity,
    upperOpeningScale: p.upperOpeningScale ?? 0.72,
    includeShoulders: true,
    includeApex: true,
    enabled: true,
  })

  if (upper.ok) {
    for (const o of upper.openings) {
      // Junction node at each cell center
      const jid = `node-cell-${o.id.toLowerCase()}`
      addNode({
        id: jid,
        type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
        position: o.center,
        parentConstructionId: o.id,
        constraints: { radius: o.radius },
      })
      // Secondary ring around cell as FOIL-like secondary (exact quarter arcs)
      const cellArcs = [0, 1, 2, 3].map((i) =>
        createArc(o.center, o.radius, (i * Math.PI) / 2, Math.PI / 2),
      )
      addMember({
        id: `member-secondary-ring-${o.id.toLowerCase()}`,
        type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
        memberClass: MEMBER_CLASSES.SECONDARY_TRACERY,
        startNodeId: jid,
        endNodeId: jid,
        closed: true,
        path: cellArcs,
        parentId: 'member-oculus-ring',
        width: widths[NETWORK_MEMBER_TYPES.SECONDARY_TRACERY],
      })
      cells.push({
        id: `cell-${o.id.toLowerCase()}`,
        type: o.type,
        edges: o.edges,
        center: o.center,
        radius: o.radius,
        memberIds: [`member-secondary-ring-${o.id.toLowerCase()}`],
      })
    }
  } else {
    warnings.push(...(upper.warnings ?? []), ...(upper.errors ?? []))
  }
  warnings.push(...(upper.warnings ?? []))

  // Connectivity: every member endpoint references a node; undirected adjacency
  const adjacency = {}
  for (const n of Object.values(nodes)) adjacency[n.id] = new Set()
  for (const m of Object.values(members)) {
    if (m.startNodeId && m.endNodeId && m.startNodeId !== m.endNodeId) {
      adjacency[m.startNodeId]?.add(m.endNodeId)
      adjacency[m.endNodeId]?.add(m.startNodeId)
    }
  }
  for (const [a, b] of oculusRingEdges) {
    adjacency[a]?.add(b)
    adjacency[b]?.add(a)
  }
  // BFS from parent apex through structural graph
  const start = 'node-parent-apex'
  const seen = new Set()
  const queue = [start]
  while (queue.length) {
    const id = queue.shift()
    if (seen.has(id)) continue
    seen.add(id)
    for (const nb of adjacency[id] ?? []) {
      if (!seen.has(nb)) queue.push(nb)
    }
  }
  // Cell junctions (closed secondary rings) and the oculus center hub are not
  // required on the open-path spanning tree; cardinals + springings + apexes are.
  const coreNodeIds = Object.values(nodes)
    .filter(
      (n) =>
        n.type !== NETWORK_NODE_TYPES.TRACERY_JUNCTION &&
        n.id !== 'node-oculus-center',
    )
    .map((n) => n.id)
  const coreConnected = coreNodeIds.every((id) => seen.has(id))

  // Sampled polylines for display
  const memberSamples = {}
  for (const m of Object.values(members)) {
    memberSamples[m.id] = samplePath(m.path, SAMPLE_OPTS.segments)
  }

  const ok = errors.length === 0 && cells.length >= 3
  return {
    ok,
    type: 'barNetwork',
    id: nextId('bn'),
    nodes,
    members,
    cells,
    widths,
    memberSamples,
    upper,
    composed,
    parameters: p,
    metrics: {
      nodeCount: Object.keys(nodes).length,
      memberCount: Object.keys(members).length,
      cellCount: cells.length,
      coreConnected,
      masterFrameWidth: widths[NETWORK_MEMBER_TYPES.OUTER_FRAME],
    },
    validation: {
      ok,
      errors,
      warnings,
      coreConnected,
    },
    metadata: {
      title: 'Rayonnant Bar Network',
      version: '13D.3',
      references: ['REF-006', 'REF-008', 'REF-011', 'REF-007', 'REF-009'],
      junctionStrategy: 'mitered strip union + constructive outer-with-holes cells',
      note: 'Exact arcs preserved on members; openings are network-derived cells.',
    },
  }
}

export function validateBarNetwork(network) {
  const errors = [...(network.validation?.errors ?? [])]
  const warnings = [...(network.validation?.warnings ?? [])]
  if (!network?.nodes || !network?.members) {
    return { ok: false, errors: ['missing graph'], warnings }
  }
  for (const n of Object.values(network.nodes)) {
    if (!Number.isFinite(n.position?.x) || !Number.isFinite(n.position?.y)) {
      errors.push(`node ${n.id} nonfinite position`)
    }
  }
  for (const m of Object.values(network.members)) {
    if (!(m.width > 0)) errors.push(`member ${m.width} non-positive`)
    if (!m.path?.length) errors.push(`member ${m.id} empty path`)
    if (m.startNodeId && !network.nodes[m.startNodeId]) {
      errors.push(`member ${m.id} missing start node`)
    }
    if (m.endNodeId && !network.nodes[m.endNodeId]) {
      errors.push(`member ${m.id} missing end node`)
    }
  }
  if (!network.metrics?.coreConnected) {
    warnings.push('core graph connectivity incomplete')
  }
  return { ok: errors.length === 0, errors, warnings }
}

export { samplePath as sampleMemberPath }
