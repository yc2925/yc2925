/**
 * Step 14A.1.2.1 — Host frames rooted on shared growth anchors.
 * Authoritative origin = GrowthAttachment anchor (Assembly ↔ Foliate).
 */

import { COMPONENT_TYPES, GROWTH_ELIGIBILITY } from '../../surfaceSemanticsTypes.js'
import {
  HOST_KINDS,
  normalize3,
  add3,
  scale3,
  sub3,
  cross3,
  dot3,
  dist3,
} from './types.js'

const SPANDREL_TYPES = new Set([
  COMPONENT_TYPES.OUTER_ARCH,
  COMPONENT_TYPES.CAPITAL,
])

const SHOULDER_TYPES = new Set([
  COMPONENT_TYPES.OUTER_ARCH,
  COMPONENT_TYPES.SILL,
  COMPONENT_TYPES.CAPITAL,
])

const PIER_TYPES = new Set([
  COMPONENT_TYPES.PIER_CORE,
  COMPONENT_TYPES.PRIMARY_MULLION,
  COMPONENT_TYPES.BUTTRESS,
  COMPONENT_TYPES.BUTTRESS_STAGE,
])

const ORNAMENT_HOST_TYPES = new Set([
  ...SPANDREL_TYPES,
  ...SHOULDER_TYPES,
  ...PIER_TYPES,
])

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v))
}

function projectOntoPlane(v, n) {
  const nn = normalize3(n)
  return sub3(v, scale3(nn, dot3(v, nn)))
}

function orthonormal(n, hintU = [1, 0, 0]) {
  const normal = normalize3(n)
  let u = projectOntoPlane(hintU, normal)
  if (dot3(u, u) < 1e-10) u = projectOntoPlane([0, 1, 0], normal)
  if (dot3(u, u) < 1e-10) u = [1, 0, 0]
  u = normalize3(u)
  let v = normalize3(cross3(normal, u))
  if (v[1] < 0) {
    u = scale3(u, -1)
    v = scale3(v, -1)
  }
  u = normalize3(cross3(v, normal))
  return { normal, axisU: u, axisV: v }
}

function componentType(semantics, componentId) {
  return semantics?.components?.find((c) => c.id === componentId)?.componentType ?? null
}

function patchCenter(patch) {
  return patch?.worldTransform?.position ?? [0, 0, 0]
}

/**
 * Map component type → host kind for diagnostics / fit.
 */
export function hostKindForComponentType(ctype) {
  if (PIER_TYPES.has(ctype)) return HOST_KINDS.PIER_PANEL
  if (SHOULDER_TYPES.has(ctype) && !SPANDREL_TYPES.has(ctype)) return HOST_KINDS.ARCH_SHOULDER
  if (SPANDREL_TYPES.has(ctype)) return HOST_KINDS.SPANDREL
  if (SHOULDER_TYPES.has(ctype)) return HOST_KINDS.ARCH_SHOULDER
  return null
}

/**
 * Classify whether an anchor sits on an eligible ornamental host component.
 */
export function classifyAnchorHost(semantics, anchor) {
  const ctype = componentType(semantics, anchor?.componentId)
  const kind = hostKindForComponentType(ctype)
  const elig = anchor?.eligibility
  const prohibited = elig === GROWTH_ELIGIBILITY.PROHIBITED
  const validStatus = anchor?.status === 'VALID' || anchor?.status === 'REPROJECTED'
  if (!anchor) {
    return { ok: false, kind: null, componentType: null, reason: 'missing-anchor' }
  }
  if (!validStatus && anchor?.status === 'ORPHANED') {
    return { ok: false, kind, componentType: ctype, reason: 'orphaned-anchor' }
  }
  if (prohibited) {
    return { ok: false, kind, componentType: ctype, reason: 'prohibited-surface' }
  }
  if (!kind || !ORNAMENT_HOST_TYPES.has(ctype)) {
    return {
      ok: false,
      kind: null,
      componentType: ctype,
      reason: `invalid-host-component:${ctype ?? 'unknown'}`,
    }
  }
  return { ok: true, kind, componentType: ctype, reason: null }
}

/**
 * Build host UVN frame whose ORIGIN is the shared growth anchor.
 * Ornament area is derived from nearby same-component / same-bay patches.
 */
export function buildHostFrameFromAnchor(semantics, anchor, meta = {}) {
  if (!anchor?.worldPosition) return null

  const classification = classifyAnchorHost(semantics, anchor)
  const origin = [...anchor.worldPosition]
  // Prefer front-facing drafting (+Z). Flip back-face anchors so ornament grows on the visible facade.
  let normal = normalize3(anchor.worldNormal ?? [0, 0, 1])
  if (normal[2] < -0.05) normal = scale3(normal, -1)
  const hintU = anchor.tangentU ?? [1, 0, 0]
  const { axisU, axisV } = orthonormal(normal, hintU)
  // Prefer anchor tangentV when it aligns with constructed V
  let useV = axisV
  let useU = axisU
  if (anchor.tangentV) {
    const tv = normalize3(anchor.tangentV)
    if (dot3(tv, normal) > 0.25) {
      // ignore nearly-normal tangents
    } else if (dot3(tv, axisV) < 0) {
      useV = scale3(projectOntoPlane(tv, normal), -1)
      useV = normalize3(useV)
      useU = normalize3(cross3(useV, normal))
    } else if (Math.abs(dot3(tv, axisV)) > 0.55) {
      useV = normalize3(projectOntoPlane(tv, normal))
      useU = normalize3(cross3(useV, normal))
    }
  }

  const ctype = classification.componentType
  const kind = classification.kind ?? HOST_KINDS.SPANDREL

  // Collect nearby patches on same component / nearby bay for ornament area
  const patches = (semantics?.patches ?? []).filter((p) => {
    if (p.componentId === anchor.componentId) return true
    if (p.surfaceId === anchor.surfaceId) return true
    const c = patchCenter(p)
    const d = dist3(c, origin)
    if (d > 1.35) return false
    const pct = componentType(semantics, p.componentId)
    return ORNAMENT_HOST_TYPES.has(pct)
  })

  let uMin = -0.35
  let uMax = 0.35
  let vMin = -0.08
  let vMax = 0.75

  if (patches.length) {
    let puMin = Infinity
    let puMax = -Infinity
    let pvMin = Infinity
    let pvMax = -Infinity
    for (const p of patches) {
      const c = patchCenter(p)
      const half = p.localSize
        ? [p.localSize[0] * 0.5, p.localSize[1] * 0.5, (p.localSize[2] ?? 0.05) * 0.5]
        : [0.12, 0.12, 0.05]
      const corners = [
        [c[0] - half[0], c[1] - half[1], c[2]],
        [c[0] + half[0], c[1] - half[1], c[2]],
        [c[0] + half[0], c[1] + half[1], c[2]],
        [c[0] - half[0], c[1] + half[1], c[2]],
      ]
      for (const pt of corners) {
        const d = sub3(pt, origin)
        const u = dot3(d, useU)
        const v = dot3(d, useV)
        puMin = Math.min(puMin, u)
        puMax = Math.max(puMax, u)
        pvMin = Math.min(pvMin, v)
        pvMax = Math.max(pvMax, v)
      }
    }
    if (Number.isFinite(puMin)) {
      uMin = puMin
      uMax = puMax
      vMin = pvMin
      vMax = pvMax
    }
  }

  // Ensure the ornament field includes the anchor (0,0) and grows primarily +V
  const minW = kind === HOST_KINDS.PIER_PANEL ? 0.45 : 0.7
  const minH = kind === HOST_KINDS.PIER_PANEL ? 0.9 : 0.65
  uMin = Math.min(uMin, -minW * 0.5)
  uMax = Math.max(uMax, minW * 0.5)
  vMin = Math.min(vMin, -0.06)
  vMax = Math.max(vMax, minH * 0.85)

  // Keep anchor inside area with slight margin below for root clearance
  const clearance = Math.max(0.04, meta.clearance ?? 0.05)
  const area = {
    uMin: uMin + clearance * 0.35,
    uMax: uMax - clearance * 0.35,
    vMin: Math.min(-0.02, vMin + clearance * 0.2),
    vMax: vMax - clearance * 0.35,
  }

  const voids = []
  for (const o of semantics?.openings ?? []) {
    const p = o.worldPosition ?? o.center ?? null
    if (!p) continue
    const d = sub3(p, origin)
    if (Math.abs(dot3(d, normal)) > 0.45) continue
    const u = dot3(d, useU)
    const v = dot3(d, useV)
    if (u < area.uMin - 0.25 || u > area.uMax + 0.25 || v < area.vMin - 0.25 || v > area.vMax + 0.25) {
      continue
    }
    voids.push({
      u,
      v,
      radius: Math.max(0.08, o.radius ?? o.approxRadius ?? 0.15),
    })
  }

  const width = Math.max(0.2, area.uMax - area.uMin)
  const height = Math.max(0.2, area.vMax - area.vMin)
  const boundaryWorld = [
    localToWorld(origin, useU, useV, normal, area.uMin, area.vMin, 0.02),
    localToWorld(origin, useU, useV, normal, area.uMax, area.vMin, 0.02),
    localToWorld(origin, useU, useV, normal, area.uMax, area.vMax, 0.02),
    localToWorld(origin, useU, useV, normal, area.uMin, area.vMax, 0.02),
    localToWorld(origin, useU, useV, normal, area.uMin, area.vMin, 0.02),
  ]

  return {
    id: meta.id ?? `host-${anchor.anchorId}`,
    index: meta.index ?? 0,
    kind,
    regionKey: meta.regionKey ?? `${kind}|${anchor.componentId}|${anchor.anchorId}`,
    patchIds: patches.map((p) => p.patchId),
    componentIds: [...new Set([anchor.componentId, ...patches.map((p) => p.componentId)].filter(Boolean))],
    origin,
    normal,
    axisU: useU,
    axisV: useV,
    symmetryAxis: useV,
    symmetryOrigin: origin,
    width,
    height,
    area,
    voids,
    clearance,
    boundaryWorld,
    // Shared-anchor identity (14A.1.2.1)
    sourceAnchorId: anchor.anchorId,
    hostComponentId: anchor.componentId,
    hostSurfaceId: anchor.surfaceId,
    hostPatchId: anchor.patchId,
    anchorWorldPosition: [...anchor.worldPosition],
    anchorWorldNormal: [...normal],
    hostClassification: classification,
    geometrySignature: anchor.geometrySignature ?? semantics?.geometryVersion ?? '',
  }
}

/**
 * Legacy patch-cluster discovery — retained for diagnostics only.
 * Motif composition must use buildHostFrameFromAnchor / buildHostsFromAnchors.
 */
export function discoverOrnamentHosts(semantics, options = {}) {
  const prefer = options.hostKind ?? HOST_KINDS.SPANDREL
  const patches = semantics?.patches ?? []
  if (!patches.length) return []

  const typeSet =
    prefer === HOST_KINDS.PIER_PANEL
      ? PIER_TYPES
      : prefer === HOST_KINDS.ARCH_SHOULDER
        ? SHOULDER_TYPES
        : SPANDREL_TYPES

  const eligible = patches.filter((p) => {
    const ctype = componentType(semantics, p.componentId)
    if (!typeSet.has(ctype)) return false
    const n = normalize3(p.representativeNormal ?? [0, 0, 1])
    return n[2] >= -0.15
  })

  if (!eligible.length) return []

  const yBand = prefer === HOST_KINDS.PIER_PANEL ? 0.9 : 1.4
  const clusters = new Map()
  for (const p of eligible) {
    const c = patchCenter(p)
    const bay = Math.round(c[0] / 3.2)
    const band = Math.round(c[1] / yBand)
    const side = c[0] >= 0 ? 'R' : 'L'
    const key =
      prefer === HOST_KINDS.SPANDREL
        ? `${prefer}|b${bay}|y${band}|${side}`
        : `${prefer}|b${bay}|y${band}`
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key).push(p)
  }

  const hosts = []
  let idx = 0
  for (const [regionKey, group] of clusters) {
    const frame = buildHostFrameFromPatches(semantics, group, {
      id: `host-${idx}`,
      kind: prefer,
      regionKey,
    })
    if (frame) {
      hosts.push(frame)
      idx += 1
    }
  }

  return hosts.map((h, i) => ({ ...h, id: `host-${i}`, index: i }))
}

/**
 * Build a stable local UVN frame + boundary for a patch group (legacy helper).
 */
export function buildHostFrameFromPatches(semantics, patches, meta = {}) {
  if (!patches?.length) return null

  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  const nAcc = [0, 0, 0]

  for (const p of patches) {
    const c = patchCenter(p)
    const half = p.localSize
      ? [p.localSize[0] * 0.5, p.localSize[1] * 0.5, (p.localSize[2] ?? 0.05) * 0.5]
      : [0.12, 0.12, 0.05]
    minX = Math.min(minX, c[0] - half[0])
    maxX = Math.max(maxX, c[0] + half[0])
    minY = Math.min(minY, c[1] - half[1])
    maxY = Math.max(maxY, c[1] + half[1])
    minZ = Math.min(minZ, c[2] - half[2])
    maxZ = Math.max(maxZ, c[2] + half[2])
    const n = normalize3(p.representativeNormal ?? [0, 0, 1])
    nAcc[0] += n[0]
    nAcc[1] += n[1]
    nAcc[2] += n[2]
  }

  const origin = [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5]
  const { normal, axisU, axisV } = orthonormal(nAcc, [1, 0, 0])

  const corners = [
    [minX, minY, origin[2]],
    [maxX, minY, origin[2]],
    [maxX, maxY, origin[2]],
    [minX, maxY, origin[2]],
  ]
  let uMin = Infinity
  let uMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity
  for (const pt of corners) {
    const d = sub3(pt, origin)
    const u = dot3(d, axisU)
    const v = dot3(d, axisV)
    uMin = Math.min(uMin, u)
    uMax = Math.max(uMax, u)
    vMin = Math.min(vMin, v)
    vMax = Math.max(vMax, v)
  }

  const minW = meta.kind === HOST_KINDS.PIER_PANEL ? 0.55 : 0.95
  const minH = meta.kind === HOST_KINDS.PIER_PANEL ? 1.1 : 0.85
  const midU = (uMin + uMax) * 0.5
  const midV = (vMin + vMax) * 0.5
  const halfW = Math.max((uMax - uMin) * 0.5, minW * 0.5)
  const halfH = Math.max((vMax - vMin) * 0.5, minH * 0.5)
  uMin = midU - halfW
  uMax = midU + halfW
  vMin = midV - halfH
  vMax = midV + halfH

  const width = Math.max(0.2, uMax - uMin)
  const height = Math.max(0.2, vMax - vMin)
  const clearance = 0.05
  const area = {
    uMin: uMin + clearance,
    uMax: uMax - clearance,
    vMin: vMin + clearance,
    vMax: vMax - clearance,
  }

  const voids = []
  for (const o of semantics?.openings ?? []) {
    const p = o.worldPosition ?? o.center ?? null
    if (!p) continue
    const d = sub3(p, origin)
    if (Math.abs(dot3(d, normal)) > 0.45) continue
    const u = dot3(d, axisU)
    const v = dot3(d, axisV)
    if (u < uMin - 0.2 || u > uMax + 0.2 || v < vMin - 0.2 || v > vMax + 0.2) continue
    voids.push({
      u,
      v,
      radius: Math.max(0.08, o.radius ?? o.approxRadius ?? 0.15),
    })
  }

  const boundaryWorld = [
    localToWorld(origin, axisU, axisV, normal, area.uMin, area.vMin, 0.02),
    localToWorld(origin, axisU, axisV, normal, area.uMax, area.vMin, 0.02),
    localToWorld(origin, axisU, axisV, normal, area.uMax, area.vMax, 0.02),
    localToWorld(origin, axisU, axisV, normal, area.uMin, area.vMax, 0.02),
    localToWorld(origin, axisU, axisV, normal, area.uMin, area.vMin, 0.02),
  ]

  return {
    id: meta.id ?? 'host-0',
    index: meta.index ?? 0,
    kind: meta.kind ?? HOST_KINDS.SPANDREL,
    regionKey: meta.regionKey ?? null,
    patchIds: patches.map((p) => p.patchId),
    componentIds: [...new Set(patches.map((p) => p.componentId).filter(Boolean))],
    origin,
    normal,
    axisU,
    axisV,
    symmetryAxis: axisV,
    symmetryOrigin: origin,
    width,
    height,
    area,
    voids,
    clearance,
    boundaryWorld,
    sourceAnchorId: null,
    hostComponentId: null,
    hostSurfaceId: null,
  }
}

/**
 * Resolve hosts from shared growth anchors (single source of truth).
 */
export function buildHostsFromAnchors(semantics, anchors = [], options = {}) {
  const list = anchors ?? []
  const hosts = []
  const invalid = []
  const unused = []

  for (let i = 0; i < list.length; i += 1) {
    const anchor = list[i]
    const classification = classifyAnchorHost(semantics, anchor)
    if (!classification.ok) {
      invalid.push({
        anchorId: anchor?.anchorId ?? `unknown-${i}`,
        reason: classification.reason,
        componentType: classification.componentType,
      })
      unused.push({
        anchorId: anchor?.anchorId,
        reason: classification.reason,
      })
      continue
    }
    const host = buildHostFrameFromAnchor(semantics, anchor, {
      id: `host-${anchor.anchorId}`,
      index: hosts.length,
      kind: classification.kind,
    })
    if (!host) {
      invalid.push({ anchorId: anchor.anchorId, reason: 'frame-build-failed' })
      unused.push({ anchorId: anchor.anchorId, reason: 'frame-build-failed' })
      continue
    }
    hosts.push(host)
  }

  // Optional kind filter for lab focus (does not invent new origins)
  const prefer = options.hostKind ?? null
  let filtered = hosts
  if (prefer) {
    const matched = hosts.filter((h) => h.kind === prefer)
    if (matched.length) {
      for (const h of hosts) {
        if (!matched.includes(h)) {
          unused.push({
            anchorId: h.sourceAnchorId,
            reason: `host-kind-filter:${prefer}`,
          })
        }
      }
      filtered = matched
    }
  }

  return {
    hosts: filtered,
    allHosts: hosts,
    invalidAnchors: invalid,
    unusedAnchors: unused,
  }
}

export function selectHostByAnchorId(hosts, anchorId) {
  if (!hosts?.length) return null
  if (!anchorId) return hosts[0]
  return hosts.find((h) => h.sourceAnchorId === anchorId) ?? null
}

export function localToWorld(origin, axisU, axisV, normal, u, v, nOff = 0.02) {
  return add3(
    add3(add3(origin, scale3(axisU, u)), scale3(axisV, v)),
    scale3(normal, nOff),
  )
}

export function worldToLocal(host, point) {
  const d = sub3(point, host.origin)
  return {
    u: dot3(d, host.axisU),
    v: dot3(d, host.axisV),
    n: dot3(d, host.normal),
  }
}

export function hostContainsUV(host, u, v, margin = 0) {
  const a = host.area
  if (u < a.uMin + margin || u > a.uMax - margin) return false
  if (v < a.vMin + margin || v > a.vMax - margin) return false
  for (const vd of host.voids ?? []) {
    const du = u - vd.u
    const dv = v - vd.v
    if (du * du + dv * dv < (vd.radius + margin) ** 2) return false
  }
  return true
}

export function selectHost(hosts, index = 0) {
  if (!hosts?.length) return null
  const i = clamp(Math.floor(index), 0, hosts.length - 1)
  return hosts[i]
}

export { ORNAMENT_HOST_TYPES, SPANDREL_TYPES, SHOULDER_TYPES, PIER_TYPES }
