/**
 * Connected oculus + upper tracery on the 13D.5 skeleton (Step 13D.6).
 *
 * Extends the validated centerline graph with:
 * - One circular oculus ring (exact circle → four arcs)
 * - Symmetric connectors: left lancet apex, right lancet apex, parent apex
 * - Optional quatrefoil foil bars (NONE | QUATREFOIL)
 *
 * Stone remains strip-union — never outer⊕holes panel fill of the upper field.
 */

import { point, distance, mid, subtract, add, scale, normalize } from '../../kernel/vector2.js'
import { createSegment } from '../../kernel/line2.js'
import { createArc } from '../../kernel/arc2.js'
import { createCircle } from '../../kernel/circle2.js'
import { ARCH_SEMANTICS } from '../../primitives/archFamilies.js'
import {
  maxOculusRadiusAtHeight,
  solveOculusCenterY,
} from '../oculus.js'
import { circleInsideArch } from '../archContainment.js'
import { buildQuatrefoil } from '../foils.js'
import {
  NETWORK_NODE_TYPES,
  NETWORK_MEMBER_TYPES,
  createNetworkNode,
  createNetworkMember,
} from '../barNetworkTypes.js'
import {
  buildSkeletonGraph,
  validateSkeletonGraph,
  sampleSkeletonPath,
  DEFAULT_SKELETON_PARAMS,
  SKELETON_WIDTH_DEFAULTS,
} from './skeletonGraph.js'

export const OCULUS_SUBDIVISION = Object.freeze({
  NONE: 'none',
  QUATREFOIL: 'quatrefoil',
})

export const DEFAULT_OCULUS_NETWORK_PARAMS = Object.freeze({
  ...DEFAULT_SKELETON_PARAMS,
  enableOculusNetwork: true,
  enableSkeleton: true,
  /** Fraction of max feasible radius at solved height. */
  oculusRadiusRatio: 0.78,
  /** 0 = just above lancet apices, 1 = toward parent apex. */
  oculusVerticalPosition: 0.55,
  /** Oculus ring width as fraction of master frame. */
  oculusRingWidthRatio: 0.42,
  /** Connector bar width as fraction of master frame. */
  connectorWidthRatio: 0.38,
  /** 0 = straight segment, 1 = strongly bowed circular arc. */
  upperConnectorCurvature: 0.45,
  oculusSubdivision: OCULUS_SUBDIVISION.NONE,
  oculusClearance: 0.04,
  /**
   * Minimum clear gap between oculus outer edge and parent apex (meters).
   * Used when enableOculusRefinement; legacy path keeps clearance*0.5 gate.
   */
  oculusApexClearance: 0.08,
  foilScale: 0.92,
  cuspDepth: 0.55,
  foilRotation: 0,
  foilOrientation: Math.PI / 4,
  /** Foil bar width ratio (of master frame). */
  foilBarWidthRatio: 0.28,
  /**
   * 'cusp-to-ring' = 13D.6/13D.7 legacy (radials from cusps — causes central knot).
   * 'tip-to-ring' = refined short stubs from lobe tips to ring.
   */
  foilRadialMode: 'cusp-to-ring',
  /**
   * Cap foil half-width as fraction of cusp radius from center.
   * Lower → more open central void. Used when enableOculusRefinement.
   */
  centralJunctionScale: 0.55,
  /** Foil-to-ring stub width as fraction of foil bar width. */
  foilToRingWidthRatio: 0.85,
  /** Step 13D.8 junction / oculus refinement (preserves 13D.7 when false). */
  enableOculusRefinement: false,
})

function linkNodeMember(nodes, nodeId, memberId) {
  const n = nodes[nodeId]
  if (!n) return
  if (!n.memberIds.includes(memberId)) n.memberIds.push(memberId)
}

/**
 * Circle through three non-colinear points; arc from a → c via b.
 */
export function arcThroughThreePoints(a, b, c) {
  const D = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))
  if (!Number.isFinite(D) || Math.abs(D) < 1e-12) return null
  const a2 = a.x * a.x + a.y * a.y
  const b2 = b.x * b.x + b.y * b.y
  const c2 = c.x * c.x + c.y * c.y
  const ux = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / D
  const uy = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / D
  const center = point(ux, uy)
  const radius = distance(center, a)
  if (!(radius > 1e-9)) return null
  const angA = Math.atan2(a.y - center.y, a.x - center.x)
  const angB = Math.atan2(b.y - center.y, b.x - center.x)
  const angC = Math.atan2(c.y - center.y, c.x - center.x)
  const twoPi = Math.PI * 2
  let sweepCcw = angC - angA
  while (sweepCcw <= 0) sweepCcw += twoPi
  while (sweepCcw > twoPi) sweepCcw -= twoPi
  let m = angB - angA
  while (m < 0) m += twoPi
  while (m >= twoPi) m -= twoPi
  const onCcw = m <= sweepCcw + 1e-9
  const sweep = onCcw ? sweepCcw : sweepCcw - twoPi
  if (Math.abs(sweep) < 1e-12) return null
  return createArc(center, radius, angA, sweep)
}

/**
 * Connector path from A → B with optional circular bulge.
 * sideSign chooses which side of the chord the bulge leans toward.
 */
export function buildConnectorPath(from, to, curvature, bulgeToward) {
  const chord = distance(from, to)
  if (!(chord > 1e-9)) return { ok: false, path: [], reason: 'degenerate connector' }
  const t = Math.min(1, Math.max(0, curvature ?? 0))
  if (t < 0.04) {
    return { ok: true, path: [createSegment(from, to)], curved: false }
  }
  const m = mid(from, to)
  const dir = normalize(subtract(to, from))
  const perp = point(-dir.y, dir.x)
  // Prefer bulge toward an exterior guide point when provided
  let sign = 1
  if (bulgeToward) {
    const toGuide = subtract(bulgeToward, m)
    const dot = toGuide.x * perp.x + toGuide.y * perp.y
    sign = dot >= 0 ? 1 : -1
  }
  const bulge = t * chord * 0.38 * sign
  const through = add(m, scale(perp, bulge))
  const arc = arcThroughThreePoints(from, through, to)
  if (!arc) {
    return { ok: true, path: [createSegment(from, to)], curved: false, reason: 'colinear fallback' }
  }
  return { ok: true, path: [arc], curved: true }
}

function resolveOculusWidths(p) {
  const outer = Math.max(
    0.04,
    p.masterFrameWidth ?? p.outerFrameWidth ?? SKELETON_WIDTH_DEFAULTS.masterFrameWidth,
  )
  const ring = Math.max(0.02, outer * (p.oculusRingWidthRatio ?? 0.42))
  const connector = Math.max(0.02, outer * (p.connectorWidthRatio ?? 0.38))
  const foilRatio = p.foilBarWidthRatio ?? 0.28
  const foil = Math.max(0.015, Math.min(ring * 0.75, outer * foilRatio))
  return {
    OCULUS_RING: Math.min(ring, outer * 0.9),
    CONNECTOR: Math.min(connector, ring * 0.95),
    FOIL_BAR: foil,
  }
}

/**
 * Minimum apex clearance (meters) from oculus outer edge to parent apex.
 */
export function resolveOculusApexClearance(params) {
  const clearance = Math.max(0.02, params.oculusClearance ?? 0.04)
  const outer = Math.max(
    0.04,
    params.masterFrameWidth ??
      params.outerFrameWidth ??
      SKELETON_WIDTH_DEFAULTS.masterFrameWidth,
  )
  const ringHalf = 0.5 * outer * (params.oculusRingWidthRatio ?? 0.42)
  const requested = params.oculusApexClearance
  if (params.enableOculusRefinement === true) {
    return Math.max(
      clearance,
      ringHalf + clearance * 0.5,
      requested != null && Number.isFinite(requested) ? requested : 0.08,
    )
  }
  // Legacy 13D.6/13D.7 gate used clearance * 0.5 at the outer edge check.
  return clearance * 0.5
}

/**
 * Place oculus above lancet apices inside the actual parent arch geometry.
 * With enableOculusRefinement, apex clearance may shrink radius (documented fallback)
 * rather than silently distorting the parent arch.
 */
export function solveSkeletonOculus(parent, leftApex, rightApex, params) {
  const clearance = Math.max(0.02, params.oculusClearance ?? 0.04)
  const lowerBoundY = Math.max(leftApex.y, rightApex.y) + clearance + 0.02
  const heightRatio = Math.min(
    1,
    Math.max(0, params.oculusVerticalPosition ?? params.oculusHeightRatio ?? 0.55),
  )
  const radiusRatio = Math.min(1, Math.max(0.15, params.oculusRadiusRatio ?? 0.78))
  const refine = params.enableOculusRefinement === true
  const apexClear = resolveOculusApexClearance(params)
  const warnings = []

  const solved = solveOculusCenterY(parent, heightRatio, clearance, lowerBoundY, {
    honorHeightRatio: true,
  })
  if (!solved.ok) {
    return {
      ok: false,
      errors: [
        solved.reason === 'no_feasible_radius'
          ? 'Oculus: no valid radius above lancet apices (constraint failure)'
          : 'Oculus: empty vertical band between lancet apices and parent (constraint failure)',
      ],
    }
  }

  const maxR = maxOculusRadiusAtHeight(parent, solved.y, clearance, lowerBoundY)
  let radius = maxR * radiusRatio
  if (!(radius > clearance * 0.8)) {
    return { ok: false, errors: ['Oculus: resolved radius too small (constraint failure)'] }
  }

  const center = point(solved.offsetX ?? 0, solved.y)
  const apexY = parent.points[ARCH_SEMANTICS.APEX]?.y
  let apexFallback = false
  if (apexY != null && center.y + radius > apexY - apexClear) {
    const maxByApex = apexY - apexClear - center.y
    if (refine && maxByApex > clearance * 0.8) {
      radius = Math.min(radius, maxByApex)
      apexFallback = true
      warnings.push(
        `Oculus: radius reduced to satisfy apex clearance ${apexClear.toFixed(3)} m (documented fallback)`,
      )
    } else {
      return {
        ok: false,
        errors: [
          `Oculus: intersects parent apex clearance ${apexClear.toFixed(3)} m (constraint failure)`,
        ],
      }
    }
  }

  const circle = createCircle(center, radius)
  const containment = circleInsideArch(parent, circle, clearance)
  if (!containment.ok) {
    return { ok: false, errors: ['Oculus: fails parent-arch containment (constraint failure)'] }
  }

  return {
    ok: true,
    center,
    radius,
    circle,
    lowerBoundY,
    maxRadius: maxR,
    heightRatio,
    radiusRatio,
    clearance,
    apexClearance: apexClear,
    apexFallback,
    warnings,
  }
}

/**
 * Build skeleton + connected oculus network graph.
 */
export function buildOculusNetworkGraph(params = {}) {
  const p = { ...DEFAULT_OCULUS_NETWORK_PARAMS, ...params, enableOculusNetwork: true }
  const base = buildSkeletonGraph(p)
  const baseCheck = validateSkeletonGraph(base)
  if (!base.ok || !baseCheck.ok) {
    return {
      ...base,
      type: 'oculusNetworkGraph',
      ok: false,
      validation: {
        ok: false,
        errors: [...(base.validation?.errors ?? []), ...(baseCheck.errors ?? [])],
        warnings: base.validation?.warnings ?? [],
      },
      metadata: {
        title: 'Rayonnant Oculus Network (invalid base)',
        version: '13D.6',
      },
    }
  }

  const errors = []
  const warnings = [...(base.validation?.warnings ?? [])]
  const nodes = { ...base.nodes }
  const members = { ...base.members }
  const memberSamples = { ...(base.memberSamples ?? {}) }
  const oculusWidths = resolveOculusWidths(p)

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
    memberSamples[m.id] = sampleSkeletonPath(m.path, m.closed ? 36 : 22)
    return m
  }

  const leftApex = nodes['node-left-lancet-apex']?.position
  const rightApex = nodes['node-right-lancet-apex']?.position
  const parentApex = nodes['node-parent-apex']?.position
  if (!leftApex || !rightApex || !parentApex) {
    return {
      ...base,
      type: 'oculusNetworkGraph',
      ok: false,
      validation: {
        ok: false,
        errors: ['missing lancet/parent apex nodes for oculus network'],
        warnings,
      },
    }
  }

  const placement = solveSkeletonOculus(base.parent, leftApex, rightApex, p)
  if (placement.warnings?.length) warnings.push(...placement.warnings)
  if (!placement.ok) {
    return {
      ...base,
      type: 'oculusNetworkGraph',
      ok: false,
      oculus: null,
      validation: { ok: false, errors: placement.errors, warnings },
      metadata: {
        title: 'Rayonnant Oculus Network (constraint failure)',
        version: '13D.6',
        references: ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
      },
    }
  }

  const { center: Oc, radius: Ro } = placement

  // Cardinal + attachment nodes on the ring
  const attachments = {
    north: Math.PI / 2,
    south: -Math.PI / 2,
    east: 0,
    west: Math.PI,
  }
  // Attachment angles toward lancet apices (from oculus center)
  const angLeft = Math.atan2(leftApex.y - Oc.y, leftApex.x - Oc.x)
  const angRight = Math.atan2(rightApex.y - Oc.y, rightApex.x - Oc.x)
  const angParent = Math.atan2(parentApex.y - Oc.y, parentApex.x - Oc.x)

  addNode({
    id: 'node-oculus-center',
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: Oc,
    parentConstructionId: 'oculus',
  })
  for (const [tag, ang] of Object.entries(attachments)) {
    addNode({
      id: `node-oculus-${tag}`,
      type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
      position: point(Oc.x + Math.cos(ang) * Ro, Oc.y + Math.sin(ang) * Ro),
      parentConstructionId: 'oculus',
      constraints: { angle: ang },
    })
  }
  addNode({
    id: 'node-oculus-attach-left',
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: point(Oc.x + Math.cos(angLeft) * Ro, Oc.y + Math.sin(angLeft) * Ro),
    parentConstructionId: 'oculus',
    constraints: { angle: angLeft, role: 'left-lancet-connector' },
  })
  addNode({
    id: 'node-oculus-attach-right',
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: point(Oc.x + Math.cos(angRight) * Ro, Oc.y + Math.sin(angRight) * Ro),
    parentConstructionId: 'oculus',
    constraints: { angle: angRight, role: 'right-lancet-connector' },
  })
  addNode({
    id: 'node-oculus-attach-parent',
    type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
    position: point(Oc.x + Math.cos(angParent) * Ro, Oc.y + Math.sin(angParent) * Ro),
    parentConstructionId: 'oculus',
    constraints: { angle: angParent, role: 'parent-apex-connector' },
  })

  // Oculus ring — four exact quarter arcs
  const ringArcs = [0, 1, 2, 3].map((i) =>
    createArc(Oc, Ro, (i * Math.PI) / 2, Math.PI / 2),
  )
  addMember({
    id: 'member-oculus-ring',
    type: NETWORK_MEMBER_TYPES.OCULUS_RING,
    memberClass: 'OCULUS_RING',
    startNodeId: 'node-oculus-east',
    endNodeId: 'node-oculus-east',
    closed: true,
    path: ringArcs,
    width: oculusWidths.OCULUS_RING,
    metadata: { placement },
  })
  for (const id of [
    'node-oculus-east',
    'node-oculus-north',
    'node-oculus-west',
    'node-oculus-south',
    'node-oculus-attach-left',
    'node-oculus-attach-right',
    'node-oculus-attach-parent',
    'node-oculus-center',
  ]) {
    linkNodeMember(nodes, id, 'member-oculus-ring')
  }

  const curvature = p.upperConnectorCurvature ?? 0.45

  // Left lancet apex → oculus (bulge toward exterior / left)
  const leftConn = buildConnectorPath(
    leftApex,
    nodes['node-oculus-attach-left'].position,
    curvature,
    point(leftApex.x - Ro, (leftApex.y + Oc.y) / 2),
  )
  if (!leftConn.ok) errors.push(leftConn.reason)
  else {
    addMember({
      id: 'member-oculus-connector-left',
      type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
      memberClass: 'SECONDARY_TRACERY',
      startNodeId: 'node-left-lancet-apex',
      endNodeId: 'node-oculus-attach-left',
      path: leftConn.path,
      width: oculusWidths.CONNECTOR,
      metadata: { curved: leftConn.curved, role: 'oculus-left-lancet' },
    })
  }

  // Right lancet apex → oculus (symmetric)
  const rightConn = buildConnectorPath(
    rightApex,
    nodes['node-oculus-attach-right'].position,
    curvature,
    point(rightApex.x + Ro, (rightApex.y + Oc.y) / 2),
  )
  if (!rightConn.ok) errors.push(rightConn.reason)
  else {
    addMember({
      id: 'member-oculus-connector-right',
      type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
      memberClass: 'SECONDARY_TRACERY',
      startNodeId: 'node-right-lancet-apex',
      endNodeId: 'node-oculus-attach-right',
      path: rightConn.path,
      width: oculusWidths.CONNECTOR,
      metadata: { curved: rightConn.curved, role: 'oculus-right-lancet' },
    })
  }

  // Parent apex → oculus (bulge upward / along axis)
  const parentConn = buildConnectorPath(
    parentApex,
    nodes['node-oculus-attach-parent'].position,
    Math.min(1, curvature * 0.85),
    point(Oc.x, parentApex.y),
  )
  if (!parentConn.ok) errors.push(parentConn.reason)
  else {
    addMember({
      id: 'member-oculus-connector-parent',
      type: NETWORK_MEMBER_TYPES.SECONDARY_TRACERY,
      memberClass: 'SECONDARY_TRACERY',
      startNodeId: 'node-parent-apex',
      endNodeId: 'node-oculus-attach-parent',
      path: parentConn.path,
      width: oculusWidths.CONNECTOR,
      metadata: { curved: parentConn.curved, role: 'oculus-parent-apex' },
    })
  }

  // Symmetry check on connector endpoints
  const attachL = nodes['node-oculus-attach-left'].position
  const attachR = nodes['node-oculus-attach-right'].position
  if (Math.abs(attachL.y - attachR.y) > 1e-6 || Math.abs(attachL.x + attachR.x) > 1e-6) {
    warnings.push('oculus left/right attachments not perfectly symmetric')
  }

  let foil = null
  const subdivision = p.oculusSubdivision ?? OCULUS_SUBDIVISION.NONE
  const refine = p.enableOculusRefinement === true
  const radialMode =
    p.foilRadialMode ?? (refine ? 'tip-to-ring' : 'cusp-to-ring')
  if (subdivision === OCULUS_SUBDIVISION.QUATREFOIL) {
    // Refined: tips closer to ring → short stubs; legacy keeps prior scale.
    const scaleMax = refine ? 0.96 : 0.98
    const scaleDefault = refine ? 0.94 : 0.92
    const foilSize = Ro * Math.min(scaleMax, Math.max(0.55, p.foilScale ?? scaleDefault))
    foil = buildQuatrefoil({
      size: foilSize,
      cuspDepth: p.cuspDepth ?? (refine ? 0.62 : 0.55),
      rotation: p.foilRotation ?? 0,
      orientation: p.foilOrientation ?? Math.PI / 4,
      centerX: Oc.x,
      centerY: Oc.y,
      samplingQuality: p.samplingQuality ?? 0.65,
    })
    if (!foil.validation?.ok) {
      errors.push(...(foil.validation?.errors ?? ['quatrefoil invalid']))
    } else {
      // Cap foil width so half-width leaves a readable central void at the cusp diamond.
      let foilWidth = oculusWidths.FOIL_BAR
      const cuspRadii = (foil.cusps ?? []).map((c) => distance(c, Oc))
      const minCuspR = cuspRadii.length ? Math.min(...cuspRadii) : foilSize * 0.12
      const junctionScale = Math.min(
        0.85,
        Math.max(0.25, p.centralJunctionScale ?? (refine ? 0.55 : 0.95)),
      )
      const maxFoilByJunction = 2 * minCuspR * junctionScale
      if (refine && foilWidth > maxFoilByJunction) {
        warnings.push(
          `Foil bar width ${foilWidth.toFixed(3)} m capped to ${maxFoilByJunction.toFixed(3)} m (central junction scale)`,
        )
        foilWidth = maxFoilByJunction
      }
      const radialWidthRatio = Math.min(
        1,
        Math.max(0.5, p.foilToRingWidthRatio ?? (refine ? 0.85 : 0.9)),
      )
      const radialWidth = foilWidth * radialWidthRatio

      foil.arcs.forEach((arc, i) => {
        addMember({
          id: `member-foil-bar-${i}`,
          type: NETWORK_MEMBER_TYPES.FOIL_BAR,
          memberClass: 'FOIL_BAR',
          startNodeId: 'node-oculus-center',
          endNodeId: 'node-oculus-center',
          path: [arc],
          width: foilWidth,
          parentId: 'member-oculus-ring',
          metadata: {
            lobeIndex: i,
            subdivision: 'quatrefoil',
            centralJunctionScale: junctionScale,
            minCuspRadius: minCuspR,
          },
        })
        linkNodeMember(nodes, 'node-oculus-center', `member-foil-bar-${i}`)
      })

      if (radialMode === 'tip-to-ring') {
        // Outer lobe tips → ring (REF-006 / REF-011). Always emit a stub of length ≥
        // member width so strip union stays non-degenerate; pull the start inward if needed.
        const lobeCenters = foil.lobeCenters ?? []
        const lobeR = foil.derived?.lobeRadius
        const minStub = Math.max(0.016, radialWidth * 0.9)
        const baseAngle =
          (foil.parameters?.orientation ?? Math.PI / 4) + (foil.parameters?.rotation ?? 0)
        lobeCenters.forEach((lc, i) => {
          const tipAng = baseAngle + (i * 2 * Math.PI) / lobeCenters.length
          const r = lobeR ?? distance(lc, Oc) * 0.85
          const geometricTip = point(
            lc.x + Math.cos(tipAng) * r,
            lc.y + Math.sin(tipAng) * r,
          )
          const ang = Math.atan2(geometricTip.y - Oc.y, geometricTip.x - Oc.x)
          const onRing = point(Oc.x + Math.cos(ang) * Ro, Oc.y + Math.sin(ang) * Ro)
          const tipR = Math.min(distance(geometricTip, Oc), Ro - 1e-4)
          // Stub start: near tip, but far enough from ring for a stable strip.
          const fromR = Math.min(tipR, Math.max(minCuspR * 1.8, Ro - minStub))
          const from = point(Oc.x + Math.cos(ang) * fromR, Oc.y + Math.sin(ang) * fromR)
          const tipId = `node-foil-tip-${i}`
          const ringStubId = `node-foil-ring-${i}`
          addNode({
            id: tipId,
            type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
            position: from,
            parentConstructionId: 'oculus-foil',
          })
          addNode({
            id: ringStubId,
            type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
            position: onRing,
            parentConstructionId: 'oculus',
          })
          addMember({
            id: `member-foil-radial-${i}`,
            type: NETWORK_MEMBER_TYPES.FOIL_BAR,
            memberClass: 'FOIL_BAR',
            startNodeId: tipId,
            endNodeId: ringStubId,
            path: [createSegment(from, onRing)],
            width: radialWidth,
            parentId: 'member-oculus-ring',
            metadata: {
              role: 'foil-to-ring',
              mode: 'tip-to-ring',
              tipIndex: i,
              stubLength: distance(from, onRing),
              geometricTip,
            },
          })
          linkNodeMember(nodes, tipId, `member-foil-bar-${i}`)
          linkNodeMember(nodes, tipId, `member-foil-radial-${i}`)
          linkNodeMember(nodes, ringStubId, `member-foil-radial-${i}`)
          linkNodeMember(nodes, ringStubId, 'member-oculus-ring')
        })
      } else {
        // Legacy 13D.6/13D.7: radials from cusps to ring (preserved for comparison).
        ;(foil.cusps ?? []).forEach((cusp, i) => {
          const ang = Math.atan2(cusp.y - Oc.y, cusp.x - Oc.x)
          const onRing = point(Oc.x + Math.cos(ang) * Ro, Oc.y + Math.sin(ang) * Ro)
          const stubId = `node-foil-cusp-${i}`
          addNode({
            id: stubId,
            type: NETWORK_NODE_TYPES.TRACERY_JUNCTION,
            position: cusp,
            parentConstructionId: 'oculus-foil',
          })
          const ringStubId = `node-foil-ring-${i}`
          addNode({
            id: ringStubId,
            type: NETWORK_NODE_TYPES.OCULUS_JUNCTION,
            position: onRing,
            parentConstructionId: 'oculus',
          })
          addMember({
            id: `member-foil-radial-${i}`,
            type: NETWORK_MEMBER_TYPES.FOIL_BAR,
            memberClass: 'FOIL_BAR',
            startNodeId: stubId,
            endNodeId: ringStubId,
            path: [createSegment(cusp, onRing)],
            width: radialWidth,
            parentId: 'member-oculus-ring',
            metadata: { role: 'foil-to-ring', mode: 'cusp-to-ring', cuspIndex: i },
          })
          linkNodeMember(nodes, stubId, `member-foil-radial-${i}`)
          linkNodeMember(nodes, ringStubId, `member-foil-radial-${i}`)
          linkNodeMember(nodes, ringStubId, 'member-oculus-ring')
        })
      }
    }
  }

  const required = [
    'member-oculus-ring',
    'member-oculus-connector-left',
    'member-oculus-connector-right',
    'member-oculus-connector-parent',
  ]
  for (const id of required) {
    if (!members[id]) errors.push(`missing ${id}`)
  }

  const ok = errors.length === 0
  return {
    ok,
    type: 'oculusNetworkGraph',
    id: base.id,
    nodes,
    members,
    memberSamples,
    widths: { ...base.widths, ...oculusWidths },
    parameters: p,
    parent: base.parent,
    leftChild: base.leftChild,
    rightChild: base.rightChild,
    subdivision: base.subdivision,
    oculus: placement,
    foil,
    validation: { ok, errors, warnings },
    metadata: {
      title: refine
        ? 'Rayonnant Oculus Refined · Centerline Graph'
        : 'Rayonnant Oculus Network · Centerline Graph',
      version: refine ? '13D.8' : '13D.6',
      references: refine
        ? ['REF-006', 'REF-011', 'REF-009', 'REF-013', 'REF-007']
        : ['REF-007', 'REF-008', 'REF-011', 'REF-009'],
      note: refine
        ? 'Oculus junction refinement: tip-to-ring foils, apex clearance, central junction scale.'
        : 'Skeleton + connected oculus ring + upper connectors; optional quatrefoil bars.',
      memberCount: Object.keys(members).length,
      nodeCount: Object.keys(nodes).length,
      oculusSubdivision: subdivision,
      foilRadialMode: radialMode,
      enableOculusRefinement: refine,
      representation: refine
        ? 'strip-union-oculus-refined'
        : 'strip-union-oculus-network',
      grammarStage: refine ? '13D.8' : '13D.6',
    },
  }
}

export function validateOculusNetworkGraph(graph) {
  const base = validateSkeletonGraph({
    ...graph,
    ok: graph?.ok,
    members: Object.fromEntries(
      Object.entries(graph?.members ?? {}).filter(
        ([id]) =>
          !id.startsWith('member-oculus') &&
          !id.startsWith('member-foil'),
      ),
    ),
    memberSamples: Object.fromEntries(
      Object.entries(graph?.memberSamples ?? {}).filter(
        ([id]) =>
          !id.startsWith('member-oculus') &&
          !id.startsWith('member-foil'),
      ),
    ),
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
  if (!graph.oculus?.ok && !graph.oculus?.center) {
    errors.push('oculus placement missing')
  }
  for (const id of [
    'member-oculus-ring',
    'member-oculus-connector-left',
    'member-oculus-connector-right',
    'member-oculus-connector-parent',
  ]) {
    if (!graph.members?.[id]) errors.push(`missing ${id}`)
  }
  // Connectivity: oculus ring must share junctions with connectors
  const ring = graph.members?.['member-oculus-ring']
  if (ring) {
    const ringNodes = Object.values(graph.nodes ?? {}).filter((n) =>
      n.memberIds?.includes('member-oculus-ring'),
    )
    const connectorTouch = ['member-oculus-connector-left', 'member-oculus-connector-right', 'member-oculus-connector-parent']
      .map((id) => graph.members?.[id])
      .filter(Boolean)
    for (const c of connectorTouch) {
      const endOnRing = ringNodes.some((n) => n.id === c.endNodeId || n.id === c.startNodeId)
      if (!endOnRing) errors.push(`${c.id} does not terminate on oculus ring`)
    }
  }
  if (graph.parameters?.oculusSubdivision === OCULUS_SUBDIVISION.QUATREFOIL) {
    const foilBars = Object.keys(graph.members ?? {}).filter((id) => id.startsWith('member-foil-bar-'))
    if (foilBars.length < 4) errors.push('quatrefoil subdivision missing foil bars')
  }
  return { ok: errors.length === 0, errors, warnings }
}
