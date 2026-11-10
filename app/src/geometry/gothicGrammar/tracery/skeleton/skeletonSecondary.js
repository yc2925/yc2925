/**
 * Rayonnant secondary tracery + foil subdivision (Step 13D.7).
 *
 * Extends the validated 13D.6 oculus network with:
 * - Connected quatrefoil bars inside the oculus (LEVEL ≥ 1)
 * - Symmetric secondary curved members in upper side compartments
 * - Optional LEVEL 2 subdivision when clearance permits
 *
 * Stone remains strip-union — never outer⊕holes panel fill.
 */

import { point, distance, mid, subtract, add, scale, normalize } from '../../kernel/vector2.js'
import { createSegment } from '../../kernel/line2.js'
import { archHeightAtX } from '../archContainment.js'
import {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  createNetworkNode,
  createNetworkMember,
} from '../barNetworkTypes.js'
import {
  buildOculusNetworkGraph,
  validateOculusNetworkGraph,
  DEFAULT_OCULUS_NETWORK_PARAMS,
  OCULUS_SUBDIVISION,
  buildConnectorPath,
} from './skeletonOculus.js'
import { sampleSkeletonPath } from './skeletonGraph.js'

export const SECONDARY_TRACERY_LEVEL = Object.freeze({
  LEVEL_0: 0,
  LEVEL_1: 1,
  LEVEL_2: 2,
})

export const DEFAULT_SECONDARY_TRACERY_PARAMS = Object.freeze({
  ...DEFAULT_OCULUS_NETWORK_PARAMS,
  enableSecondaryTracery: true,
  enableOculusNetwork: true,
  enableSkeleton: true,
  /** 0 = 13D.6 oculus only; 1 = quatrefoil + side members; 2 = + clearance-gated extras */
  secondaryTraceryLevel: SECONDARY_TRACERY_LEVEL.LEVEL_1,
  /** Secondary side-bar width as fraction of master frame. */
  secondaryMemberWidthRatio: 0.32,
  /** Foil bar width as fraction of master frame. */
  foilBarWidthRatio: 0.28,
  foilScale: 0.88,
  cuspDepth: 0.55,
  foilRotation: 0,
  foilOrientation: Math.PI / 4,
  /** When true and level ≥ 2, attempt extra side subdivision. */
  sideCompartmentSubdivision: true,
  minWebClearance: 0.04,
  oculusSubdivision: OCULUS_SUBDIVISION.QUATREFOIL,
  oculusRingWidthRatio: 0.42,
  connectorWidthRatio: 0.36,
  /** Step 13D.8 — leave false so RAYONNANT SECONDARY TRACERY stays the 13D.7 baseline. */
  enableOculusRefinement: false,
  foilRadialMode: 'cusp-to-ring',
  oculusApexClearance: 0.08,
  centralJunctionScale: 0.55,
  foilToRingWidthRatio: 0.85,
})

function linkNodeMember(nodes, nodeId, memberId) {
  const n = nodes[nodeId]
  if (!n) return
  if (!n.memberIds.includes(memberId)) n.memberIds.push(memberId)
}

/**
 * Walk ray from oculus center at `angle` outward until it meets the parent arch.
 */
export function rayHitParentArch(parent, origin, angle, tMin, tMax) {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  let lo = Math.max(1e-6, tMin)
  let hi = Math.max(lo + 1e-3, tMax)
  let found = false
  for (let i = 0; i < 48; i += 1) {
    const midT = (lo + hi) * 0.5
    const x = origin.x + midT * c
    const y = origin.y + midT * s
    const yArch = archHeightAtX(parent, x)
    if (yArch == null) {
      hi = midT
      continue
    }
    found = true
    if (y < yArch) lo = midT
    else hi = midT
  }
  if (!found) return null
  const t = (lo + hi) * 0.5
  const hit = point(origin.x + t * c, origin.y + t * s)
  const yArch = archHeightAtX(parent, hit.x)
  if (yArch == null) return null
  // Snap to exact arch height at that x (true parent centerline)
  return point(hit.x, yArch)
}

function midAngleCCW(a0, a1) {
  let d = a1 - a0
  while (d < 0) d += Math.PI * 2
  while (d >= Math.PI * 2) d -= Math.PI * 2
  let m = a0 + d * 0.5
  while (m > Math.PI) m -= Math.PI * 2
  while (m <= -Math.PI) m += Math.PI * 2
  return m
}

function resolveSecondaryWidths(p, oculusWidths) {
  const outer = Math.max(0.04, p.masterFrameWidth ?? p.outerFrameWidth ?? 0.12)
  const secondary = Math.max(0.018, outer * (p.secondaryMemberWidthRatio ?? 0.32))
  const foil = Math.max(0.015, outer * (p.foilBarWidthRatio ?? 0.28))
  return {
    ...oculusWidths,
    SECONDARY_TRACERY: Math.min(secondary, (oculusWidths.OCULUS_RING ?? outer * 0.42) * 0.95),
    FOIL_BAR: Math.min(foil, (oculusWidths.OCULUS_RING ?? outer * 0.42) * 0.75),
  }
}

/**
 * Clearance probe: chord length and mid-gap vs min web.
 */
function sideClearanceOk(from, to, existingPoints, minClear, halfWidth) {
  const chord = distance(from, to)
  if (!(chord > minClear * 2 + halfWidth * 2)) return false
  const m = mid(from, to)
  for (const q of existingPoints) {
    if (distance(m, q) < minClear + halfWidth) return false
  }
  return true
}

/**
 * Build one side secondary member connecting parent arch ↔ oculus ring.
 */
function buildSideSecondary(side, ctx) {
  const {
    parent,
    Oc,
    Ro,
    attachLeftAng,
    attachRightAng,
    attachParentAng,
    curvature,
    width,
    minClear,
    nodes,
    addNode,
    addMember,
    errors,
    warnings,
  } = ctx

  const isLeft = side === 'left'
  // Parent≈π/2, left≈π → mid ≈ 3π/4 (NW). Right≈0 → mid ≈ π/4 (NE).
  const attachAng = isLeft
    ? midAngleCCW(attachParentAng, attachLeftAng)
    : midAngleCCW(attachRightAng, attachParentAng)

  const ringPt = point(Oc.x + Math.cos(attachAng) * Ro, Oc.y + Math.sin(attachAng) * Ro)
  const tMin = Ro + minClear + width * 0.5
  const tMax = Ro + Math.max(0.35, Ro * 1.8)
  const parentPt = rayHitParentArch(parent, Oc, attachAng, tMin, tMax)
  if (!parentPt) {
    errors.push(`secondary ${side}: parent-arch ray miss (constraint failure)`)
    return null
  }

  const gap = distance(parentPt, ringPt)
  if (!(gap > minClear + width)) {
    errors.push(`secondary ${side}: insufficient compartment clearance (constraint failure)`)
    return null
  }

  // Bulge toward compartment exterior (away from oculus center along ray)
  const exteriorGuide = add(mid(parentPt, ringPt), scale(normalize(subtract(parentPt, Oc)), gap * 0.22))
  const pathBuild = buildConnectorPath(parentPt, ringPt, curvature, exteriorGuide)
  if (!pathBuild.ok) {
    errors.push(`secondary ${side}: ${pathBuild.reason}`)
    return null
  }

  const parentNodeId = `node-secondary-parent-${side}`
  const ringNodeId = `node-secondary-ring-${side}`
  addNode({
    id: parentNodeId,
    type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
    position: parentPt,
    parentConstructionId: 'parent-arch',
    constraints: { role: `secondary-${side}-parent` },
  })
  addNode({
    id: ringNodeId,
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: ringPt,
    parentConstructionId: 'oculus',
    constraints: { angle: attachAng, role: `secondary-${side}-ring` },
  })
  linkNodeMember(nodes, ringNodeId, 'member-oculus-ring')
  // Parent arch member linkage (best-effort semantic)
  const parentMemberId = Object.keys(nodes).includes('node-parent-apex')
    ? Object.values(nodes).find((n) => n.id === 'node-parent-apex')?.memberIds?.[0]
    : null
  if (parentMemberId) linkNodeMember(nodes, parentNodeId, parentMemberId)

  const memberId = `member-secondary-${side}`
  addMember({
    id: memberId,
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: 'SECONDARY_TRACERY',
    startNodeId: parentNodeId,
    endNodeId: ringNodeId,
    path: pathBuild.path,
    width,
    parentId: 'member-oculus-ring',
    metadata: {
      role: `side-compartment-${side}`,
      curved: pathBuild.curved,
      attachAngle: attachAng,
      level: 1,
    },
  })
  linkNodeMember(nodes, parentNodeId, memberId)
  linkNodeMember(nodes, ringNodeId, memberId)

  return {
    side,
    parentPt,
    ringPt,
    attachAng,
    memberId,
    parentNodeId,
    ringNodeId,
    midPt: mid(parentPt, ringPt),
  }
}

/**
 * LEVEL 2: connector mid → secondary mid, if clearance allows.
 */
function buildLevel2Bridge(side, primary, ctx) {
  const {
    nodes,
    members,
    addNode,
    addMember,
    width,
    minClear,
    warnings,
  } = ctx

  const connectorId =
    side === 'left' ? 'member-oculus-connector-left' : 'member-oculus-connector-right'
  const connector = members?.[connectorId]
  const start = nodes[connector?.startNodeId]?.position
  const end = nodes[connector?.endNodeId]?.position
  if (!start || !end || !primary?.midPt) {
    warnings.push(`level2 ${side}: missing connector endpoints — skipped`)
    return null
  }
  const connMid = mid(start, end)
  const halfW = width * 0.5
  if (!sideClearanceOk(connMid, primary.midPt, [primary.parentPt, primary.ringPt], minClear, halfW)) {
    warnings.push(`level2 ${side}: clearance insufficient — not generated`)
    return null
  }

  const aId = `node-level2-conn-${side}`
  const bId = `node-level2-sec-${side}`
  addNode({
    id: aId,
    type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
    position: connMid,
    parentConstructionId: connectorId,
    constraints: { role: `level2-${side}-connector` },
  })
  addNode({
    id: bId,
    type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
    position: primary.midPt,
    parentConstructionId: primary.memberId,
    constraints: { role: `level2-${side}-secondary` },
  })
  linkNodeMember(nodes, aId, connectorId)
  linkNodeMember(nodes, bId, primary.memberId)

  const memberId = `member-secondary-level2-${side}`
  const pathBuild = buildConnectorPath(connMid, primary.midPt, 0.25, null)
  addMember({
    id: memberId,
    type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
    memberClass: 'SECONDARY_TRACERY',
    startNodeId: aId,
    endNodeId: bId,
    path: pathBuild.path,
    width: width * 0.9,
    parentId: primary.memberId,
    metadata: { role: `side-level2-${side}`, level: 2 },
  })
  return memberId
}

/**
 * Build skeleton + oculus + secondary tracery / foil graph.
 */
export function buildSecondaryTraceryGraph(params = {}) {
  const p = {
    ...DEFAULT_SECONDARY_TRACERY_PARAMS,
    ...params,
    enableSecondaryTracery: true,
    enableOculusNetwork: true,
    enableSkeleton: true,
  }
  const level = Math.max(0, Math.min(2, Math.round(p.secondaryTraceryLevel ?? 1)))

  // LEVEL ≥ 1 forces quatrefoil subdivision inside the oculus
  const refine = p.enableOculusRefinement === true
  const oculusParams = {
    ...p,
    oculusSubdivision:
      level >= 1 ? OCULUS_SUBDIVISION.QUATREFOIL : p.oculusSubdivision ?? OCULUS_SUBDIVISION.NONE,
    foilScale: p.foilScale,
    cuspDepth: p.cuspDepth,
    foilRotation: p.foilRotation,
    foilOrientation: p.foilOrientation ?? Math.PI / 4,
    enableOculusRefinement: refine,
    foilRadialMode: p.foilRadialMode ?? (refine ? 'tip-to-ring' : 'cusp-to-ring'),
    oculusApexClearance: p.oculusApexClearance,
    centralJunctionScale: p.centralJunctionScale,
    foilToRingWidthRatio: p.foilToRingWidthRatio,
  }

  const base = buildOculusNetworkGraph(oculusParams)
  const baseCheck = validateOculusNetworkGraph(base)
  if (!base.ok || !baseCheck.ok) {
    return {
      ...base,
      type: 'secondaryTraceryGraph',
      ok: false,
      validation: {
        ok: false,
        errors: [...(base.validation?.errors ?? []), ...(baseCheck.errors ?? [])],
        warnings: base.validation?.warnings ?? [],
      },
      metadata: {
        title: 'Rayonnant Secondary Tracery (invalid base)',
        version: '13D.7',
        secondaryTraceryLevel: level,
      },
    }
  }

  if (level === 0) {
    return {
      ...base,
      type: 'secondaryTraceryGraph',
      parameters: { ...base.parameters, ...p, secondaryTraceryLevel: 0 },
      metadata: {
        ...base.metadata,
        title: 'Rayonnant Secondary Tracery · Level 0 (oculus)',
        version: '13D.7',
        secondaryTraceryLevel: 0,
        representation: 'strip-union-secondary-tracery',
        grammarStage: '13D.7-L0',
      },
    }
  }

  const errors = []
  const warnings = [...(base.validation?.warnings ?? []), ...(baseCheck.warnings ?? [])]
  const nodes = { ...base.nodes }
  const members = { ...base.members }
  const memberSamples = { ...(base.memberSamples ?? {}) }
  const widths = resolveSecondaryWidths(p, base.widths ?? {})

  // Retarget foil bar widths to hierarchy ratio (respect 13D.8 central-junction clamp).
  const junctionScale = Math.min(0.85, Math.max(0.25, p.centralJunctionScale ?? 0.55))
  const cuspRadii = (base.foil?.cusps ?? []).map((c) =>
    distance(c, base.oculus?.center ?? point(0, 0)),
  )
  const minCuspR = cuspRadii.length ? Math.min(...cuspRadii) : null
  let foilTarget = widths.FOIL_BAR
  if (refine && minCuspR != null) {
    foilTarget = Math.min(foilTarget, 2 * minCuspR * junctionScale)
  }
  const radialRatio = Math.min(
    1,
    Math.max(0.5, p.foilToRingWidthRatio ?? (refine ? 0.85 : 0.9)),
  )
  for (const m of Object.values(members)) {
    if (m.memberClass === 'FOIL_BAR' || m.id?.startsWith('member-foil')) {
      m.width = foilTarget * (m.id?.startsWith('member-foil-radial') ? radialRatio : 1)
    }
  }

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

  const Oc = base.oculus.center
  const Ro = base.oculus.radius
  const attachLeftAng = nodes['node-oculus-attach-left']?.constraints?.angle
  const attachRightAng = nodes['node-oculus-attach-right']?.constraints?.angle
  const attachParentAng = nodes['node-oculus-attach-parent']?.constraints?.angle
  if (
    attachLeftAng == null ||
    attachRightAng == null ||
    attachParentAng == null
  ) {
    // Derive from positions if constraint angles missing
  }
  const angOf = (id, fallback) => {
    const n = nodes[id]
    if (n?.constraints?.angle != null) return n.constraints.angle
    if (!n?.position) return fallback
    return Math.atan2(n.position.y - Oc.y, n.position.x - Oc.x)
  }
  const leftAng = angOf('node-oculus-attach-left', Math.PI)
  const rightAng = angOf('node-oculus-attach-right', 0)
  const parentAng = angOf('node-oculus-attach-parent', Math.PI / 2)

  const minClear = Math.max(0.02, p.minWebClearance ?? p.oculusClearance ?? 0.04)
  const secWidth = widths.SECONDARY_TRACERY
  const curvature = Math.min(1, Math.max(0.15, (p.upperConnectorCurvature ?? 0.45) * 0.85))

  const ctx = {
    parent: base.parent,
    Oc,
    Ro,
    attachLeftAng: leftAng,
    attachRightAng: rightAng,
    attachParentAng: parentAng,
    curvature,
    width: secWidth,
    minClear,
    nodes,
    members,
    addNode,
    addMember,
    errors,
    warnings,
  }

  const left = buildSideSecondary('left', ctx)
  const right = buildSideSecondary('right', ctx)

  // Symmetry check
  if (left && right) {
    if (Math.abs(left.ringPt.y - right.ringPt.y) > 1e-5 || Math.abs(left.ringPt.x + right.ringPt.x) > 1e-5) {
      warnings.push('secondary left/right ring attachments not perfectly symmetric')
    }
  }

  // Quatrefoil must be present at LEVEL ≥ 1
  const foilBars = Object.keys(members).filter((id) => id.startsWith('member-foil-bar-'))
  const foilRadials = Object.keys(members).filter((id) => id.startsWith('member-foil-radial-'))
  if (foilBars.length < 4) {
    errors.push('quatrefoil foil bars missing (constraint failure)')
  }
  if (foilRadials.length < 4) {
    errors.push('quatrefoil-to-ring radials missing (constraint failure)')
  }

  let level2Ids = []
  if (level >= 2 && p.sideCompartmentSubdivision !== false) {
    if (left) {
      const id = buildLevel2Bridge('left', left, ctx)
      if (id) level2Ids.push(id)
    }
    if (right) {
      const id = buildLevel2Bridge('right', right, ctx)
      if (id) level2Ids.push(id)
    }
    if (level2Ids.length === 0) {
      warnings.push('level 2 requested but no side subdivision cleared min web — kept level 1 members')
    }
  }

  // Junction refinement: ensure secondary ring nodes share the oculus ring member
  for (const side of ['left', 'right']) {
    const ringNode = nodes[`node-secondary-ring-${side}`]
    if (ringNode) linkNodeMember(nodes, ringNode.id, 'member-oculus-ring')
  }

  const ok = errors.length === 0 && Boolean(left) && Boolean(right)
  return {
    ok,
    type: 'secondaryTraceryGraph',
    id: base.id,
    nodes,
    members,
    memberSamples,
    widths,
    parameters: { ...p, secondaryTraceryLevel: level, oculusSubdivision: OCULUS_SUBDIVISION.QUATREFOIL },
    parent: base.parent,
    leftChild: base.leftChild,
    rightChild: base.rightChild,
    subdivision: base.subdivision,
    oculus: base.oculus,
    foil: base.foil,
    secondary: {
      level,
      left,
      right,
      level2Ids,
    },
    validation: { ok, errors, warnings },
    metadata: {
      title: refine
        ? `Rayonnant Oculus Refined · Level ${level}`
        : `Rayonnant Secondary Tracery · Level ${level}`,
      version: refine ? '13D.8' : '13D.7',
      references: refine
        ? ['REF-006', 'REF-011', 'REF-009', 'REF-013', 'REF-007']
        : ['REF-008', 'REF-011', 'REF-007', 'REF-009', 'REF-004'],
      note: refine
        ? '13D.8 refined quatrefoil junctions + apex clearance on secondary skeleton.'
        : 'Oculus + quatrefoil + symmetric side secondary members; strip-union stone.',
      memberCount: Object.keys(members).length,
      nodeCount: Object.keys(nodes).length,
      secondaryTraceryLevel: level,
      oculusSubdivision: OCULUS_SUBDIVISION.QUATREFOIL,
      enableOculusRefinement: refine,
      foilRadialMode: oculusParams.foilRadialMode,
      representation: refine
        ? 'strip-union-oculus-refined'
        : 'strip-union-secondary-tracery',
      grammarStage: refine ? `13D.8-L${level}` : `13D.7-L${level}`,
    },
  }
}

export function validateSecondaryTraceryGraph(graph) {
  const base = validateOculusNetworkGraph({
    ...graph,
    type: 'oculusNetworkGraph',
    parameters: {
      ...graph?.parameters,
      oculusSubdivision: graph?.parameters?.oculusSubdivision ?? OCULUS_SUBDIVISION.QUATREFOIL,
    },
  })
  const errors = [...(base.errors ?? [])]
  const warnings = [...(base.warnings ?? [])]
  if (!graph?.ok) {
    return {
      ok: false,
      errors: [...(graph?.validation?.errors ?? ['graph invalid']), ...errors],
      warnings,
    }
  }
  const level = graph.parameters?.secondaryTraceryLevel ?? graph.secondary?.level ?? 0
  if (level >= 1) {
    if (!graph.members?.['member-secondary-left']) errors.push('missing member-secondary-left')
    if (!graph.members?.['member-secondary-right']) errors.push('missing member-secondary-right')
    const foilBars = Object.keys(graph.members ?? {}).filter((id) => id.startsWith('member-foil-bar-'))
    if (foilBars.length < 4) errors.push('quatrefoil bars missing')
    // Side members must terminate on ring nodes linked to oculus ring
    for (const id of ['member-secondary-left', 'member-secondary-right']) {
      const m = graph.members?.[id]
      if (!m) continue
      const end = graph.nodes?.[m.endNodeId]
      if (!end?.memberIds?.includes('member-oculus-ring')) {
        errors.push(`${id} does not terminate on oculus ring`)
      }
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}
