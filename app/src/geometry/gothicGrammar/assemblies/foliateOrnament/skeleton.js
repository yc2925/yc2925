/**
 * Step 14A.1.1 — Motif-based ornamental growth skeleton.
 * Smooth parametric scrolls on architectural hosts — not vegetation, not random walk.
 *
 * Refs: REF-017 geometric organization · REF-018 biomorphic variation ·
 *       REF-019 architectural integration · REF-020 symmetrical grotesque scrolls
 */

import { COMPONENT_TYPES, GROWTH_ELIGIBILITY } from '../surfaceSemanticsTypes.js'
import {
  projectToEligibleSurface,
  isInsideProtectedOpening,
  checkGrowthClearance,
} from '../growthAttachment/queries.js'
import { ANCHOR_STATUS } from '../growthAttachment/types.js'
import {
  DEFAULT_FOLIATE_SETTINGS,
  BRANCH_ROLES,
  MOTIF_KINDS,
  TERMINATION_REASONS,
  createGrowthNode,
  createGrowthBranch,
  createOrnamentMotif,
  emptyOrnamentSkeleton,
  mulberry32,
  normalize3,
  add3,
  scale3,
  sub3,
  cross3,
  dot3,
  dist3,
} from './types.js'

const SPANDREL_COMPONENTS = new Set([
  COMPONENT_TYPES.OUTER_ARCH,
  COMPONENT_TYPES.CAPITAL,
])

const PIER_COMPONENTS = new Set([
  COMPONENT_TYPES.PIER_CORE,
  COMPONENT_TYPES.PRIMARY_MULLION,
  COMPONENT_TYPES.BUTTRESS,
  COMPONENT_TYPES.BUTTRESS_STAGE,
])

const SHOULDER_COMPONENTS = new Set([
  COMPONENT_TYPES.OUTER_ARCH,
  COMPONENT_TYPES.SILL,
  COMPONENT_TYPES.CAPITAL,
])

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function projectOntoPlane(v, normal) {
  const n = normalize3(normal)
  const d = dot3(v, n)
  return sub3(v, scale3(n, d))
}

function orthonormalBasis(normal, hintU = [1, 0, 0]) {
  const n = normalize3(normal)
  let u = projectOntoPlane(hintU, n)
  if (dot3(u, u) < 1e-10) u = projectOntoPlane([0, 1, 0], n)
  if (dot3(u, u) < 1e-10) u = projectOntoPlane([1, 0, 0], n)
  u = normalize3(u)
  const v = normalize3(cross3(n, u))
  // Re-orthogonalize u
  u = normalize3(cross3(v, n))
  return { n, u, v }
}

function mirrorAcrossAxis(point, origin, axis) {
  const a = normalize3(axis)
  const d = sub3(point, origin)
  const along = scale3(a, dot3(d, a))
  const perp = sub3(d, along)
  return add3(origin, sub3(along, perp))
}

function facadeCenterX(semantics) {
  const patches = semantics?.patches ?? []
  if (!patches.length) return 0
  let minX = Infinity
  let maxX = -Infinity
  for (const p of patches) {
    const x = p.worldTransform?.position?.[0]
    if (Number.isFinite(x)) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return 0
  return (minX + maxX) * 0.5
}

function componentTypeForAnchor(semantics, anchor) {
  return semantics?.components?.find((c) => c.id === anchor.componentId)?.componentType ?? null
}

function motifKindForComponent(ctype) {
  if (PIER_COMPONENTS.has(ctype)) return MOTIF_KINDS.PIER_PANEL
  if (SPANDREL_COMPONENTS.has(ctype)) return MOTIF_KINDS.SPANDREL_SCROLL
  if (SHOULDER_COMPONENTS.has(ctype)) return MOTIF_KINDS.ARCH_SHOULDER
  return MOTIF_KINDS.SPANDREL_SCROLL
}

function regionKeyForAnchor(anchor, semantics, bayWidth = 3.2) {
  const ctype = componentTypeForAnchor(semantics, anchor)
  const kind = motifKindForComponent(ctype)
  const x = anchor.worldPosition?.[0] ?? 0
  const y = anchor.worldPosition?.[1] ?? 0
  const bay = Math.round(x / Math.max(0.5, bayWidth))
  const band = Math.round(y / 0.55)
  return `${kind}|b${bay}|y${band}`
}

/**
 * Prefer arch / spandrel / pier initiation; fall back to any VALID eligible anchor.
 */
export function selectOrnamentInitiationAnchors(semantics, anchors, options = {}) {
  const preferSpandrel = options.preferSpandrelHost !== false
  const allowRestricted = options.allowRestrictedHost !== false
  const valid = (anchors ?? []).filter((a) => {
    if (!a) return false
    if (a.status === ANCHOR_STATUS.ORPHANED || a.status === ANCHOR_STATUS.BLOCKED) return false
    if (a.eligibility === GROWTH_ELIGIBILITY.PROHIBITED) return false
    if (a.eligibility === GROWTH_ELIGIBILITY.RESTRICTED && !allowRestricted) return false
    return true
  })

  if (!preferSpandrel || !semantics) return valid

  const preferredSet = new Set([
    ...SPANDREL_COMPONENTS,
    ...PIER_COMPONENTS,
    ...SHOULDER_COMPONENTS,
  ])

  const ranked = [...valid].sort((a, b) => {
    const ca = componentTypeForAnchor(semantics, a)
    const cb = componentTypeForAnchor(semantics, b)
    const sa = preferredSet.has(ca) ? 0 : 1
    const sb = preferredSet.has(cb) ? 0 : 1
    if (sa !== sb) return sa - sb
    // Prefer camera-facing / front facade ( +Z normals )
    const fa = (a.worldNormal?.[2] ?? 0) >= 0 ? 0 : 1
    const fb = (b.worldNormal?.[2] ?? 0) >= 0 ? 0 : 1
    if (fa !== fb) return fa - fb
    return (b.worldPosition?.[1] ?? 0) - (a.worldPosition?.[1] ?? 0)
  })

  const preferred = ranked.filter((a) => preferredSet.has(componentTypeForAnchor(semantics, a)))
  return preferred.length ? preferred : ranked
}

/**
 * Group nearby anchors into architectural motif hosts.
 */
export function groupAnchorsIntoMotifHosts(semantics, anchors, options = {}) {
  const cfg = { ...DEFAULT_FOLIATE_SETTINGS, ...options }
  const selected = selectOrnamentInitiationAnchors(semantics, anchors, cfg)
  const rejected = (anchors ?? []).filter((a) => !selected.includes(a))
  const clusters = new Map()

  for (const a of selected) {
    const key = regionKeyForAnchor(a, semantics)
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key).push(a)
  }

  const hosts = []
  for (const [regionKey, group] of clusters) {
    const sorted = [...group].sort((a, b) => {
      const ya = a.worldPosition?.[1] ?? 0
      const yb = b.worldPosition?.[1] ?? 0
      if (Math.abs(yb - ya) > 1e-6) return yb - ya
      return (a.worldPosition?.[0] ?? 0) - (b.worldPosition?.[0] ?? 0)
    })
    const primary = sorted[0]
    const ctype = componentTypeForAnchor(semantics, primary)
    const kind = motifKindForComponent(ctype)
    hosts.push({
      regionKey,
      kind,
      primary,
      supports: sorted.slice(1),
      all: sorted,
    })
  }

  // Prefer spandrel/shoulder hosts, then pier; deterministic order
  hosts.sort((a, b) => {
    const order = {
      [MOTIF_KINDS.SPANDREL_SCROLL]: 0,
      [MOTIF_KINDS.ARCH_SHOULDER]: 1,
      [MOTIF_KINDS.PIER_PANEL]: 2,
    }
    const da = order[a.kind] ?? 9
    const db = order[b.kind] ?? 9
    if (da !== db) return da - db
    const fa = (a.primary.worldNormal?.[2] ?? 0) >= 0 ? 0 : 1
    const fb = (b.primary.worldNormal?.[2] ?? 0) >= 0 ? 0 : 1
    if (fa !== fb) return fa - fb
    return (b.primary.worldPosition?.[1] ?? 0) - (a.primary.worldPosition?.[1] ?? 0)
  })

  // Prefer front-facing hosts; fall back to any if none available
  const frontHosts = hosts.filter((h) => (h.primary.worldNormal?.[2] ?? 0) >= 0)
  const rankedHosts = frontHosts.length ? frontHosts : hosts

  const maxMotifs = Math.max(1, Math.floor(cfg.maxMotifs ?? 12))
  const used = rankedHosts.slice(0, maxMotifs)
  const unusedIds = []
  for (const h of rankedHosts.slice(maxMotifs)) {
    for (const a of h.all) unusedIds.push(a.anchorId)
  }
  for (const h of hosts) {
    if (!used.includes(h)) {
      for (const a of h.all) {
        if (!unusedIds.includes(a.anchorId) && !used.some((u) => u.all.includes(a))) {
          unusedIds.push(a.anchorId)
        }
      }
    }
  }
  for (const a of rejected) unusedIds.push(a.anchorId)

  return {
    hosts: used,
    rejectedAnchors: rejected,
    unusedAnchorIds: unusedIds,
    selectedCount: selected.length,
  }
}

export function ornamentGrowthCacheKey(geometrySignature, anchorIds, params) {
  const p = { ...DEFAULT_FOLIATE_SETTINGS, ...params }
  return JSON.stringify({
    g: geometrySignature ?? '',
    a: [...(anchorIds ?? [])].sort(),
    growthLength: p.growthLength,
    branchDensity: p.branchDensity,
    curlStrength: p.curlStrength,
    symmetryStrength: p.symmetryStrength,
    creatureInfluence: p.creatureInfluence,
    randomSeed: p.randomSeed,
    architecturalAttraction: p.architecturalAttraction,
    branchAngle: p.branchAngle,
    maxBranchDepth: p.maxBranchDepth,
    surfaceAdherence: p.surfaceAdherence,
    growthStepSize: p.growthStepSize,
    minBranchSeparation: p.minBranchSeparation,
    terminationThreshold: p.terminationThreshold,
    maxMotifs: p.maxMotifs,
    maxAttachmentDistance: p.maxAttachmentDistance,
    preferSpandrelHost: p.preferSpandrelHost,
    allowRestrictedHost: p.allowRestrictedHost,
    version: '14A.1.1',
  })
}

function attachSample(point, prevNormal, semantics, params, allowRestricted) {
  const opening = isInsideProtectedOpening(point, semantics, { radius: 0.05 })
  if (opening.inside) {
    return { ok: false, reason: TERMINATION_REASONS.OPENING, candidate: point }
  }

  const tol = lerp(0.18, 0.06, clamp01(params.surfaceAdherence))
  const maxDist = Math.max(tol, params.maxAttachmentDistance ?? 0.12)

  // Prefer front facade (+Z). Retry from a forward-biased probe if the nearest hit is a back face.
  const probes = [
    point,
    [point[0], point[1], point[2] + 0.08],
    [point[0], point[1], point[2] + 0.2],
  ]
  let proj = null
  for (const probe of probes) {
    const attempt = projectToEligibleSurface(probe, {
      semantics,
      allowRestricted,
      projectionTolerance: maxDist,
    })
    if (!attempt.ok || !attempt.anchor) continue
    const nTry = normalize3(attempt.anchor.worldNormal ?? [0, 0, 1])
    // Accept first front-facing hit; otherwise keep as fallback
    if (nTry[2] >= -0.05) {
      proj = attempt
      break
    }
    if (!proj) proj = attempt
  }
  if (!proj?.ok || !proj.anchor) {
    return { ok: false, reason: TERMINATION_REASONS.SURFACE, candidate: point }
  }

  const dist = proj.distance ?? dist3(point, proj.anchor.worldPosition)
  if (dist > maxDist) {
    return {
      ok: false,
      reason: TERMINATION_REASONS.SURFACE,
      candidate: proj.anchor.worldPosition,
      distance: dist,
    }
  }

  const n = normalize3(proj.anchor.worldNormal ?? [0, 0, 1])
  if (prevNormal) {
    const align = dot3(normalize3(prevNormal), n)
    // Only reject hard flips (back-face / opposite shell). Soft patch seams are OK.
    if (align < -0.25) {
      return {
        ok: false,
        reason: TERMINATION_REASONS.NORMAL,
        candidate: proj.anchor.worldPosition,
      }
    }
  }

  const clearance = checkGrowthClearance(proj.anchor.worldPosition, 0.015, {
    semantics,
    allowRestricted,
  })
  if (clearance.classification === 'PROTECTED_OPENING') {
    return { ok: false, reason: TERMINATION_REASONS.OPENING, candidate: proj.anchor.worldPosition }
  }

  return {
    ok: true,
    position: proj.anchor.worldPosition,
    normal: n,
    tangentU: proj.anchor.tangentU,
    tangentV: proj.anchor.tangentV,
    distance: dist,
    surfaceAttachment: {
      patchId: proj.anchor.patchId,
      surfaceId: proj.anchor.surfaceId,
      componentId: proj.anchor.componentId,
      distance: dist,
    },
  }
}

/**
 * Build a smooth parametric scroll polyline in the local tangent frame, then attach.
 * Archimedean-style spiral / C-scroll — curlStrength controls winding.
 */
function sampleScrollCurve({
  origin,
  normal,
  axisU,
  axisV,
  extent,
  curl,
  creature,
  samples,
  windSign = 1,
  startAngle = 0,
  taper = 0.22,
  kind = MOTIF_KINDS.SPANDREL_SCROLL,
}) {
  const pts = []
  const wind = lerp(0.35, 1.55, clamp01(curl)) * windSign
  const creatureWarp = creature * 0.18

  for (let i = 0; i < samples; i += 1) {
    const t = samples <= 1 ? 0 : i / (samples - 1)
    let local
    if (kind === MOTIF_KINDS.PIER_PANEL) {
      // Vertical crocket spine with gentle single-wave S undulation (no high-frequency zigzag)
      const up = axisV
      const side = axisU
      const undulate = Math.sin(t * Math.PI) * extent * 0.1 * (0.25 + curl * 0.55)
      const creep = Math.sin(t * Math.PI + creatureWarp) * extent * creatureWarp * 0.35
      local = add3(
        scale3(up, t * extent),
        scale3(side, undulate + creep),
      )
    } else {
      // Lead-in along architectural axis, then spiral (avoids jumping into voids)
      const lead = Math.min(1, t / 0.22)
      const spiralT = Math.max(0, (t - 0.18) / 0.82)
      const theta = startAngle + wind * spiralT * Math.PI
      const radius = extent * (0.02 + (1 - taper * spiralT) * spiralT * 0.92)
      const warp = 1 + creatureWarp * Math.sin(theta * 2.1)
      const along = scale3(axisV, t * extent * lerp(0.55, 0.2, clamp01(curl)))
      const scroll = add3(
        scale3(axisU, Math.cos(theta) * radius * warp * lead),
        scale3(axisV, Math.sin(theta) * radius * warp * 0.85 * lead),
      )
      local = add3(along, scroll)
      if (kind === MOTIF_KINDS.ARCH_SHOULDER) {
        local = add3(local, scale3(axisV, t * extent * 0.12 * (0.4 + curl)))
      }
    }
    // Offset along +front when normal faces camera; otherwise push toward +Z
    const frontPush = normal[2] >= 0 ? scale3(normal, 0.02) : [0, 0, 0.06]
    const world = add3(add3(origin, local), frontPush)
    pts.push({ t, world, local })
  }
  return pts
}

function sampleSecondaryScroll({
  origin,
  normal,
  tangent,
  extent,
  curl,
  creature,
  samples,
  sideSign,
  branchAngle,
}) {
  const basis = orthonormalBasis(normal, tangent)
  // Side direction: rotate tangent toward ±bitangent
  const side = normalize3(
    add3(scale3(basis.u, Math.cos(branchAngle) * sideSign), scale3(basis.v, Math.sin(branchAngle))),
  )
  const tipAxis = normalize3(add3(scale3(tangent, 0.25), side))
  const { u, v } = orthonormalBasis(normal, tipAxis)
  return sampleScrollCurve({
    origin,
    normal,
    axisU: u,
    axisV: v,
    extent,
    curl: Math.min(1, curl * 1.15),
    creature,
    samples,
    windSign: sideSign,
    startAngle: sideSign > 0 ? -0.2 : Math.PI + 0.2,
    taper: 0.35,
    kind: MOTIF_KINDS.SPANDREL_SCROLL,
  })
}

/**
 * Attach a parametric polyline; only accepted samples become branch nodes.
 */
function commitAttachedCurve({
  samples,
  rootNode,
  branchId,
  motifId,
  depth,
  role,
  rootAnchorId,
  params,
  semantics,
  allowRestricted,
  nodes,
  occupied,
  rejectedSegments,
  rejectionCounts,
  mirrorOf = null,
  separationScale = 1,
}) {
  const nodeIds = rootNode ? [rootNode.id] : []
  let prev = rootNode
  let length = 0
  let curvatureAccum = 0
  let termination = TERMINATION_REASONS.LENGTH
  let failStreak = 0
  const minSep = Math.max(0.015, (params.minBranchSeparation ?? 0.045) * separationScale)
  const maxFail = 4

  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i]
    // Soft local retries: nudge along previous normal / tangent / back toward prev
    let attached = null
    const retries = [
      sample.world,
      prev ? add3(sample.world, scale3(prev.surfaceNormal, 0.025)) : sample.world,
      prev ? add3(sample.world, scale3(prev.surfaceNormal, -0.01)) : sample.world,
      prev ? add3(sample.world, scale3(prev.growthDirection, -0.03)) : sample.world,
      prev
        ? add3(prev.position, scale3(normalize3(sub3(sample.world, prev.position)), dist3(sample.world, prev.position) * 0.55))
        : sample.world,
    ]
    for (const candidate of retries) {
      attached = attachSample(candidate, prev?.surfaceNormal, semantics, params, allowRestricted)
      if (attached.ok) break
    }

    if (!attached?.ok) {
      failStreak += 1
      const reason = attached?.reason ?? TERMINATION_REASONS.SURFACE
      rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1
      rejectedSegments.push({
        id: `${branchId}-rej-${i}`,
        motifId,
        branchId,
        from: prev?.position ?? sample.world,
        to: attached?.candidate ?? sample.world,
        reason,
      })
      // Skip OPENING/NORMAL samples when possible; only abort after streak
      if (failStreak >= maxFail) {
        termination = reason
        break
      }
      continue
    }
    failStreak = 0

    // Separation only against other motifs / distant branches — allow tight scroll packing
    let tooClose = false
    if (i > 1) {
      for (const p of occupied) {
        const d = dist3(p, attached.position)
        if (d < minSep && (!prev || dist3(p, prev.position) > minSep * 0.5)) {
          // Ignore points that are our own recent trail
          const onTrail =
            prev && dist3(p, prev.position) < minSep * 1.2
          if (!onTrail) {
            tooClose = true
            break
          }
        }
      }
    }
    if (tooClose) {
      termination = TERMINATION_REASONS.SEPARATION
      rejectionCounts.SEPARATION = (rejectionCounts.SEPARATION ?? 0) + 1
      // Soft: skip sample rather than kill whole branch early on first hit
      if (length > (params.growthLength ?? 1) * 0.35) break
      continue
    }

    if (prev) {
      let pos = attached.position
      let normal = attached.normal
      let surfaceAttachment = attached.surfaceAttachment
      let tangentU = attached.tangentU
      let dir = normalize3(sub3(pos, prev.position))
      let stepLen = dist3(prev.position, pos)
      if (stepLen < 1e-5) continue

      // Continuity: re-project a blended step when the turn is sharp
      if (prev.growthDirection && i > 0) {
        let turn = Math.acos(
          Math.max(-1, Math.min(1, dot3(normalize3(prev.growthDirection), dir))),
        )
        if (turn > 0.55) {
          const blend = normalize3(
            add3(scale3(prev.growthDirection, 0.72), scale3(dir, 0.28)),
          )
          const target = add3(prev.position, scale3(blend, Math.min(stepLen, params.growthStepSize ?? 0.055) * 1.15))
          const smoothed = attachSample(
            add3(target, scale3(prev.surfaceNormal, 0.015)),
            prev.surfaceNormal,
            semantics,
            params,
            allowRestricted,
          )
          if (smoothed.ok) {
            pos = smoothed.position
            normal = smoothed.normal
            surfaceAttachment = smoothed.surfaceAttachment
            tangentU = smoothed.tangentU
            dir = normalize3(sub3(pos, prev.position))
            stepLen = dist3(prev.position, pos)
            turn = Math.acos(
              Math.max(-1, Math.min(1, dot3(normalize3(prev.growthDirection), dir))),
            )
          }
        }
        curvatureAccum += turn
      }

      if (stepLen < 1e-5) continue

      const nodeId = `${branchId}-n${nodeIds.length}`
      const node = createGrowthNode({
        id: nodeId,
        parentId: prev.id,
        branchId,
        motifId,
        position: pos,
        surfaceAttachment,
        localTangent: normalize3(tangentU ?? dir),
        surfaceNormal: normal,
        growthDirection: dir,
        generation: depth,
        distanceFromRoot: prev.distanceFromRoot + stepLen,
        role,
        valid: true,
        accepted: true,
        mirrorOf,
      })
      nodes.push(node)
      nodeIds.push(nodeId)
      occupied.push(pos)
      length += stepLen
      prev = node
    }
  }

  if (nodeIds.length <= 1) {
    termination =
      termination === TERMINATION_REASONS.LENGTH ? TERMINATION_REASONS.SURFACE : termination
  }

  return {
    nodeIds,
    length,
    curvature: nodeIds.length > 2 ? curvatureAccum / Math.max(1, nodeIds.length - 2) : 0,
    termination,
    tip: prev,
  }
}

function buildMotifFrame(host, params) {
  const primary = host.primary
  const support = host.supports[0]
  const origin = primary.worldPosition
  const normal = normalize3(primary.worldNormal ?? [0, 0, 1])

  let hintU = primary.tangentU ?? [1, 0, 0]
  if (support) {
    hintU = sub3(support.worldPosition, origin)
  }
  if (host.kind === MOTIF_KINDS.PIER_PANEL) {
    hintU = projectOntoPlane([1, 0, 0], normal)
  } else {
    // Prefer horizontal-ish for scroll plane U, vertical for V
    hintU = projectOntoPlane([1, 0, 0], normal)
  }
  const { n, u, v } = orthonormalBasis(normal, hintU)
  // Ensure V points generally upward on facade
  if (v[1] < 0) {
    return { origin, normal: n, axisU: scale3(u, -1), axisV: scale3(v, -1) }
  }
  return { origin, normal: n, axisU: u, axisV: v }
}

function generateMotif({
  host,
  motifIndex,
  params,
  semantics,
  rand,
  nodes,
  branches,
  motifs,
  occupied,
  rejectedSegments,
  rejectionCounts,
  terminationCounts,
  allowRestricted,
  initiationPointIds,
}) {
  const cfg = params
  const curl = clamp01(cfg.curlStrength ?? 0.55)
  const density = clamp01(cfg.branchDensity ?? 0.55)
  const creature = clamp01(cfg.creatureInfluence ?? 0.3)
  const symmetry = clamp01(cfg.symmetryStrength ?? 0.8)
  const attract = clamp01(cfg.architecturalAttraction ?? 0.65)
  const extent = Math.max(0.25, cfg.growthLength ?? 1.15) * lerp(0.85, 1.05, attract)
  const step = Math.max(0.03, cfg.growthStepSize ?? 0.055)
  const samples = Math.max(10, Math.ceil(extent / step) + 4)
  const maxDepth = Math.max(0, Math.floor(cfg.maxBranchDepth ?? 3))
  const branchAngle = lerp(0.35, 1.05, clamp01(cfg.branchAngle ?? 0.55))

  const frame = buildMotifFrame(host, cfg)
  // Architectural attraction: blend axisV toward up / arch tangent
  const archUp = normalize3(
    add3(scale3(frame.axisV, 1 - attract * 0.25), scale3([0, 1, 0], attract * 0.25)),
  )
  const basis = orthonormalBasis(frame.normal, frame.axisU)
  const axisV = archUp[1] >= 0 ? normalize3(projectOntoPlane(archUp, frame.normal)) : basis.v
  const axisU = normalize3(cross3(axisV, frame.normal))
  const axisVFinal = normalize3(cross3(frame.normal, axisU))

  const motifId = `motif-${motifIndex}-${host.kind}`
  const primary = host.primary

  const rootId = `init-${primary.anchorId}`
  initiationPointIds.push(rootId)
  const root = createGrowthNode({
    id: rootId,
    parentId: null,
    branchId: `root-${primary.anchorId}`,
    motifId,
    position: primary.worldPosition,
    surfaceAttachment: {
      patchId: primary.patchId,
      surfaceId: primary.surfaceId,
      componentId: primary.componentId,
      distance: 0,
      anchorId: primary.anchorId,
    },
    localTangent: axisU,
    surfaceNormal: frame.normal,
    growthDirection: axisVFinal,
    generation: 0,
    distanceFromRoot: 0,
    role: BRANCH_ROLES.INITIATION,
    valid: true,
    accepted: true,
  })
  nodes.push(root)
  occupied.push(root.position)

  // Creature: slight start-angle / wind sign jitter
  const windSign = rand() < 0.5 ? 1 : -1
  const startAngle =
    host.kind === MOTIF_KINDS.PIER_PANEL
      ? 0
      : (rand() - 0.5) * creature * 0.8 + (host.kind === MOTIF_KINDS.ARCH_SHOULDER ? -0.4 : 0.15)

  const spineSamples = sampleScrollCurve({
    origin: frame.origin,
    normal: frame.normal,
    axisU,
    axisV: axisVFinal,
    extent,
    curl,
    creature,
    samples,
    windSign,
    startAngle,
    taper: host.kind === MOTIF_KINDS.PIER_PANEL ? 0.08 : 0.2,
    kind: host.kind,
  })

  const spineBranchId = `${motifId}-spine`
  let spine = commitAttachedCurve({
    samples: spineSamples.slice(1), // root already placed
    rootNode: root,
    branchId: spineBranchId,
    motifId,
    depth: 0,
    role: BRANCH_ROLES.PRIMARY,
    rootAnchorId: primary.anchorId,
    params: cfg,
    semantics,
    allowRestricted,
    nodes,
    occupied,
    rejectedSegments,
    rejectionCounts,
    separationScale: 0.55,
  })

  // Fallback: short architectural lead spine if scroll could not attach
  if (spine.nodeIds.length <= 1) {
    const fallback = []
    for (let i = 1; i <= 12; i += 1) {
      const t = i / 12
      const local = add3(
        scale3(axisVFinal, t * extent * 0.65),
        scale3(axisU, Math.sin(t * Math.PI) * extent * 0.12 * (0.35 + curl)),
      )
      fallback.push({
        t,
        world: add3(add3(frame.origin, local), scale3(frame.normal, 0.012)),
        local,
      })
    }
    spine = commitAttachedCurve({
      samples: fallback,
      rootNode: root,
      branchId: spineBranchId,
      motifId,
      depth: 0,
      role: BRANCH_ROLES.PRIMARY,
      rootAnchorId: primary.anchorId,
      params: cfg,
      semantics,
      allowRestricted,
      nodes,
      occupied,
      rejectedSegments,
      rejectionCounts,
      separationScale: 0.4,
    })
  }

  const spineBranch = createGrowthBranch({
    id: spineBranchId,
    parentBranchId: null,
    motifId,
    nodeIds: spine.nodeIds,
    depth: 0,
    length: spine.length,
    curvature: spine.curvature,
    terminationReason: spine.termination,
    role: BRANCH_ROLES.PRIMARY,
    rootAnchorId: primary.anchorId,
  })
  branches.push(spineBranch)
  terminationCounts[spine.termination] = (terminationCounts[spine.termination] ?? 0) + 1

  const motifBranchIds = [spineBranchId]
  const spineNodes = spine.nodeIds
    .map((id) => nodes.find((n) => n.id === id))
    .filter(Boolean)

  // Secondary scrolls along the primary spine
  const secondaryCount = Math.round(lerp(1, 6, density) + creature * 1.5)
  const depthLimit = maxDepth
  if (depthLimit >= 1 && spineNodes.length >= 4) {
    for (let s = 0; s < secondaryCount; s += 1) {
      const t = lerp(0.22, 0.88, (s + 0.5) / secondaryCount)
      const idx = Math.min(spineNodes.length - 1, Math.max(1, Math.floor(t * (spineNodes.length - 1))))
      const join = spineNodes[idx]
      if (!join?.valid) continue

      const sideSign = s % 2 === 0 ? 1 : -1
      const secExtent =
        extent *
        lerp(0.28, 0.52, density) *
        lerp(1, 0.72, s / Math.max(1, secondaryCount - 1)) *
        (1 - creature * 0.08 * rand())

      const secSamples = sampleSecondaryScroll({
        origin: join.position,
        normal: join.surfaceNormal,
        tangent: join.growthDirection,
        extent: secExtent,
        curl,
        creature,
        samples: Math.max(8, Math.ceil(secExtent / step) + 2),
        sideSign,
        branchAngle: branchAngle * (0.85 + rand() * creature * 0.3),
      })

      const secId = `${motifId}-sec-${s}`
      const sec = commitAttachedCurve({
        samples: secSamples.slice(1),
        rootNode: join,
        branchId: secId,
        motifId,
        depth: 1,
        role: BRANCH_ROLES.SECONDARY,
        rootAnchorId: primary.anchorId,
        params: cfg,
        semantics,
        allowRestricted,
        nodes,
        occupied,
        rejectedSegments,
        rejectionCounts,
        separationScale: 0.7,
      })
      if (sec.nodeIds.length < 3) continue

      const secBranch = createGrowthBranch({
        id: secId,
        parentBranchId: spineBranchId,
        motifId,
        nodeIds: sec.nodeIds,
        depth: 1,
        length: sec.length,
        curvature: sec.curvature,
        terminationReason: sec.termination,
        role: BRANCH_ROLES.SECONDARY,
        rootAnchorId: primary.anchorId,
      })
      branches.push(secBranch)
      motifBranchIds.push(secId)
      terminationCounts[sec.termination] = (terminationCounts[sec.termination] ?? 0) + 1

      // Tertiary tip curls (depth 2)
      if (depthLimit >= 2 && density > 0.35 && sec.tip && rand() < density * 0.75) {
        const tip = sec.tip
        const tertExtent = secExtent * lerp(0.35, 0.55, curl)
        const tertSamples = sampleSecondaryScroll({
          origin: tip.position,
          normal: tip.surfaceNormal,
          tangent: tip.growthDirection,
          extent: tertExtent,
          curl: Math.min(1, curl * 1.2),
          creature,
          samples: Math.max(6, Math.ceil(tertExtent / step) + 1),
          sideSign: -sideSign,
          branchAngle: branchAngle * 0.7,
        })
        const tertId = `${secId}-t`
        const tert = commitAttachedCurve({
          samples: tertSamples.slice(1),
          rootNode: tip,
          branchId: tertId,
          motifId,
          depth: 2,
          role: BRANCH_ROLES.SECONDARY,
          rootAnchorId: primary.anchorId,
          params: cfg,
          semantics,
          allowRestricted,
          nodes,
          occupied,
          rejectedSegments,
          rejectionCounts,
          separationScale: 0.85,
        })
        if (tert.nodeIds.length >= 3) {
          branches.push(
            createGrowthBranch({
              id: tertId,
              parentBranchId: secId,
              motifId,
              nodeIds: tert.nodeIds,
              depth: 2,
              length: tert.length,
              curvature: tert.curvature,
              terminationReason: tert.termination,
              role: BRANCH_ROLES.SECONDARY,
              rootAnchorId: primary.anchorId,
            }),
          )
          motifBranchIds.push(tertId)
          terminationCounts[tert.termination] = (terminationCounts[tert.termination] ?? 0) + 1
        }
      }

      // Motif-level bilateral symmetry: mirror secondary across local V axis
      const shouldMirror = symmetry >= 0.99 || (symmetry > 0.08 && rand() < symmetry)
      if (shouldMirror && sec.nodeIds.length >= 3) {
        const mirrorSamples = []
        const mapNode = new Map(nodes.map((n) => [n.id, n]))
        for (const id of sec.nodeIds) {
          if (id === join.id) continue
          const src = mapNode.get(id)
          if (!src?.valid) continue
          const mp = mirrorAcrossAxis(src.position, frame.origin, axisVFinal)
          mirrorSamples.push({
            t: src.growthProgress,
            world: add3(mp, scale3(frame.normal, 0.012)),
            local: null,
          })
        }
        const mirId = `${secId}-m`
        const mir = commitAttachedCurve({
          samples: mirrorSamples,
          rootNode: join,
          branchId: mirId,
          motifId,
          depth: 1,
          role: BRANCH_ROLES.MIRROR,
          rootAnchorId: primary.anchorId,
          params: {
            ...cfg,
            creatureInfluence: creature * (1 - symmetry * 0.55),
          },
          semantics,
          allowRestricted,
          nodes,
          occupied,
          rejectedSegments,
          rejectionCounts,
          mirrorOf: secId,
          separationScale: 0.7,
        })
        if (mir.nodeIds.length >= 3) {
          branches.push(
            createGrowthBranch({
              id: mirId,
              parentBranchId: spineBranchId,
              motifId,
              nodeIds: mir.nodeIds,
              depth: 1,
              length: mir.length,
              curvature: mir.curvature,
              terminationReason: mir.termination,
              role: BRANCH_ROLES.MIRROR,
              rootAnchorId: primary.anchorId,
              mirrorOf: secId,
            }),
          )
          motifBranchIds.push(mirId)
          terminationCounts[mir.termination] = (terminationCounts[mir.termination] ?? 0) + 1
        }
      }
    }
  }

  // Bounds from accepted nodes
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const b of branches.filter((x) => x.motifId === motifId)) {
    for (const id of b.nodeIds) {
      const n = nodes.find((x) => x.id === id)
      if (!n) continue
      minX = Math.min(minX, n.position[0])
      maxX = Math.max(maxX, n.position[0])
      minY = Math.min(minY, n.position[1])
      maxY = Math.max(maxY, n.position[1])
    }
  }

  const motif = createOrnamentMotif({
    id: motifId,
    kind: host.kind,
    primaryAnchorId: primary.anchorId,
    supportAnchorIds: host.supports.map((a) => a.anchorId),
    unusedAnchorIds: [],
    origin: frame.origin,
    normal: frame.normal,
    axisU,
    axisV: axisVFinal,
    localSymmetryAxis: axisVFinal,
    localSymmetryOrigin: frame.origin,
    bounds:
      Number.isFinite(minX) && Number.isFinite(maxX)
        ? {
            min: [minX, minY, frame.origin[2] - 0.05],
            max: [maxX, maxY, frame.origin[2] + 0.05],
          }
        : null,
    branchIds: motifBranchIds,
    regionKey: host.regionKey,
  })
  motifs.push(motif)

  return {
    motif,
    zeroGrowth: spine.nodeIds.length <= 1,
  }
}

/**
 * Build full ornament growth skeleton (progress-independent).
 */
export function buildOrnamentGrowthSkeleton({ semantics, anchors = [], params = {} } = {}) {
  const cfg = { ...DEFAULT_FOLIATE_SETTINGS, ...params }
  const geometrySignature = semantics?.geometryVersion ?? ''

  if (!semantics) {
    return emptyOrnamentSkeleton({
      emptyReason: 'Surface semantics unavailable for host.',
      geometrySignature,
      parameters: cfg,
    })
  }

  const grouped = groupAnchorsIntoMotifHosts(semantics, anchors, cfg)
  if (!grouped.hosts.length) {
    return emptyOrnamentSkeleton({
      emptyReason:
        'No valid ornament initiation points. Place or distribute anchors on eligible stone (spandrel / arch shoulder / pier preferred).',
      geometrySignature,
      parameters: cfg,
    })
  }

  const rand = mulberry32((cfg.randomSeed ?? 42) >>> 0)
  const allowRestricted = cfg.allowRestrictedHost !== false
  const nodes = []
  const branches = []
  const motifs = []
  const occupied = []
  const rejectedSegments = []
  const initiationPointIds = []
  const rejectionCounts = {}
  const terminationCounts = {}
  let anchorsZeroGrowth = 0

  for (let i = 0; i < grouped.hosts.length; i += 1) {
    const result = generateMotif({
      host: grouped.hosts[i],
      motifIndex: i,
      params: cfg,
      semantics,
      rand,
      nodes,
      branches,
      motifs,
      occupied,
      rejectedSegments,
      rejectionCounts,
      terminationCounts,
      allowRestricted,
      initiationPointIds,
    })
    if (result.zeroGrowth) anchorsZeroGrowth += 1
  }

  let maxDist = 0
  for (const n of nodes) {
    if (n.valid && n.accepted) maxDist = Math.max(maxDist, n.distanceFromRoot ?? 0)
  }
  for (const n of nodes) {
    n.growthProgress = maxDist > 1e-9 ? clamp01((n.distanceFromRoot ?? 0) / maxDist) : 0
  }

  // Accepted nodes must be valid — strip accidental accepted-invalid
  let acceptedInvalidCount = 0
  for (const n of nodes) {
    if (n.accepted && !n.valid) {
      acceptedInvalidCount += 1
      n.accepted = false
    }
  }

  const invalidSegmentCount = rejectedSegments.length
  const mirroredBranchCount = branches.filter((b) => b.role === BRANCH_ROLES.MIRROR).length
  const primaryIds = grouped.hosts.map((h) => h.primary.anchorId)

  return {
    type: 'ORNAMENT_GROWTH_SKELETON',
    version: '14A.1.1',
    nodes,
    branches,
    motifs,
    rejectedSegments,
    initiationPointIds,
    diagnostics: {
      anchorCount: anchors.length,
      anchorsAccepted: grouped.selectedCount,
      anchorsRejected: grouped.rejectedAnchors.length,
      anchorsUnused: grouped.unusedAnchorIds.length,
      anchorsZeroGrowth,
      motifCount: motifs.length,
      nodeCount: nodes.length,
      branchCount: branches.length,
      invalidSegmentCount,
      acceptedInvalidCount,
      mirroredBranchCount,
      maxDistanceFromRoot: maxDist,
      terminationCounts: { ...terminationCounts },
      rejectionCounts: { ...rejectionCounts },
      unusedAnchorIds: grouped.unusedAnchorIds,
      cacheKey: ornamentGrowthCacheKey(geometrySignature, primaryIds, cfg),
      emptyReason: null,
      symmetryPlaneX: facadeCenterX(semantics),
    },
    parameters: cfg,
    geometrySignature,
    label: 'ORNAMENT GROWTH SKELETON — CONSTRUCTION PREVIEW',
  }
}

/**
 * Reveal skeleton by growth progress without regenerating.
 */
export function revealOrnamentSkeleton(skeleton, progress = 1) {
  if (!skeleton?.nodes) {
    return emptyOrnamentSkeleton({ emptyReason: 'No skeleton' })
  }
  const p = clamp01(progress)
  if (p <= 0) {
    const init = new Set(skeleton.initiationPointIds ?? [])
    const nodes = skeleton.nodes.filter(
      (n) => (init.has(n.id) || n.role === BRANCH_ROLES.INITIATION) && n.accepted !== false,
    )
    const nodeIds = new Set(nodes.map((n) => n.id))
    return {
      ...skeleton,
      nodes,
      branches: (skeleton.branches ?? []).filter((b) => b.nodeIds?.some((id) => nodeIds.has(id))),
      rejectedSegments: [],
      diagnostics: {
        ...(skeleton.diagnostics ?? {}),
        revealProgress: 0,
        revealedNodeCount: nodes.length,
      },
    }
  }

  const nodes = skeleton.nodes.filter((n) => {
    if (n.accepted === false || n.valid === false) return false
    if (n.role === BRANCH_ROLES.INITIATION) return true
    return (n.growthProgress ?? 0) <= p + 1e-6
  })
  const nodeIds = new Set(nodes.map((n) => n.id))
  const branches = (skeleton.branches ?? [])
    .map((b) => ({
      ...b,
      nodeIds: (b.nodeIds ?? []).filter((id) => nodeIds.has(id)),
    }))
    .filter((b) => b.nodeIds.length > 0)

  const rejected =
    p >= 0.999
      ? skeleton.rejectedSegments ?? []
      : (skeleton.rejectedSegments ?? []).filter((seg) => {
          // Show rejections only when their from-node is revealed
          return nodes.some((n) => dist3(n.position, seg.from) < 1e-4)
        })

  return {
    ...skeleton,
    nodes,
    branches,
    rejectedSegments: rejected,
    diagnostics: {
      ...(skeleton.diagnostics ?? {}),
      revealProgress: p,
      revealedNodeCount: nodes.length,
      revealedBranchCount: branches.length,
    },
  }
}

/**
 * Structural validation helpers for the growth graph.
 */
export function validateOrnamentSkeleton(skeleton) {
  const errors = []
  const warnings = []
  if (!skeleton || skeleton.type !== 'ORNAMENT_GROWTH_SKELETON') {
    return { ok: false, errors: ['missing skeleton'], warnings }
  }
  const nodeMap = new Map((skeleton.nodes ?? []).map((n) => [n.id, n]))
  const branchMap = new Map((skeleton.branches ?? []).map((b) => [b.id, b]))

  for (const n of skeleton.nodes ?? []) {
    if (!n.id) errors.push('node missing id')
    if (n.parentId && !nodeMap.has(n.parentId)) errors.push(`orphan parent ${n.parentId}`)
    if (n.accepted && !n.valid) errors.push(`accepted invalid node ${n.id}`)
    if (n.accepted && n.valid && n.role !== BRANCH_ROLES.INITIATION && !n.surfaceAttachment?.patchId) {
      errors.push(`accepted node missing attachment ${n.id}`)
    }
  }

  for (const n of skeleton.nodes ?? []) {
    const seen = new Set()
    let cur = n
    let guard = 0
    while (cur?.parentId) {
      if (seen.has(cur.id)) {
        errors.push(`cycle at ${cur.id}`)
        break
      }
      seen.add(cur.id)
      cur = nodeMap.get(cur.parentId)
      guard += 1
      if (guard > skeleton.nodes.length + 2) {
        errors.push(`cycle guard at ${n.id}`)
        break
      }
    }
  }

  for (const b of skeleton.branches ?? []) {
    if (b.parentBranchId && !branchMap.has(b.parentBranchId)) {
      errors.push(`branch ${b.id} bad parent`)
    }
    for (const id of b.nodeIds ?? []) {
      if (!nodeMap.has(id)) errors.push(`branch ${b.id} missing node ${id}`)
    }
  }

  // Continuity: mean turn should be moderate for accepted polylines
  let turnSum = 0
  let turnCount = 0
  for (const b of skeleton.branches ?? []) {
    for (let i = 2; i < (b.nodeIds?.length ?? 0); i += 1) {
      const a = nodeMap.get(b.nodeIds[i - 2])
      const c = nodeMap.get(b.nodeIds[i - 1])
      const d = nodeMap.get(b.nodeIds[i])
      if (!a?.valid || !c?.valid || !d?.valid) continue
      const v1 = sub3(c.position, a.position)
      const v2 = sub3(d.position, c.position)
      const n1 = Math.hypot(v1[0], v1[1], v1[2]) || 1
      const n2 = Math.hypot(v2[0], v2[1], v2[2]) || 1
      const ang = Math.acos(
        Math.max(-1, Math.min(1, (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / (n1 * n2))),
      )
      turnSum += ang
      turnCount += 1
    }
  }
  const meanTurn = turnCount ? turnSum / turnCount : 0
  if (turnCount > 8 && meanTurn > 0.85) {
    warnings.push(`high mean turn ${meanTurn.toFixed(3)} rad (possible zigzag)`)
  }

  return { ok: errors.length === 0, errors, warnings, meanTurn, turnCount }
}

/** Mean curvature proxy for curl-strength tests. */
export function skeletonMeanCurvature(skeleton) {
  const branches = skeleton?.branches ?? []
  if (!branches.length) return 0
  return branches.reduce((s, b) => s + (b.curvature ?? 0), 0) / branches.length
}
