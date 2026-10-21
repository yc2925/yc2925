/**
 * Step 10C — Architectural surface attachment for ornamental roots.
 *
 * Feature-first attachment using the extracted curve graph; mesh triangle
 * samples as fallback. Cached once per architecture / param change.
 */

import * as THREE from 'three'
import { clamp01 } from './extract.js'

const WINDOW_OUT = new THREE.Vector3(0, 0, 1)

/**
 * Feature-driven geometric biases (not world-coordinate hardcoding).
 */
export function featureInfluence(featureType) {
  switch (featureType) {
    case 'frame':
      return { conformBias: 1.18, emergeBias: 0.82, rootScale: 1.12, tipCurlBias: 0.9 }
    case 'mullion':
      return { conformBias: 1.28, emergeBias: 0.68, rootScale: 1.06, tipCurlBias: 0.75, verticalAlign: 0.45 }
    case 'tracery':
      return { conformBias: 0.88, emergeBias: 1.22, rootScale: 0.92, tipCurlBias: 1.2 }
    case 'junction':
      return { conformBias: 1.05, emergeBias: 1.05, rootScale: 1.38, tipCurlBias: 1.0 }
    default:
      return { conformBias: 1, emergeBias: 1, rootScale: 1, tipCurlBias: 1 }
  }
}

function samplePolyline(points, stepCount) {
  if (!points || points.length < 2) return []
  const cum = [0]
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0)))
  }
  const total = cum[cum.length - 1]
  if (total < 1e-6) return []
  const out = []
  const n = Math.max(2, stepCount)
  for (let i = 0; i <= n; i += 1) {
    const s = (i / n) * total
    let k = 1
    while (k < cum.length && cum[k] < s) k += 1
    const i0 = Math.max(0, k - 1)
    const i1 = Math.min(points.length - 1, k)
    const seg = cum[i1] - cum[i0] || 1e-6
    const u = clamp01((s - cum[i0]) / seg)
    const a = points[i0]
    const b = points[i1]
    const P = new THREE.Vector3(
      a.x + (b.x - a.x) * u,
      a.y + (b.y - a.y) * u,
      (a.z ?? 0) + ((b.z ?? 0) - (a.z ?? 0)) * u,
    )
    const T = new THREE.Vector3(b.x - a.x, b.y - a.y, (b.z ?? 0) - (a.z ?? 0))
    if (T.lengthSq() < 1e-12) T.set(0, 1, 0)
    else T.normalize()
    out.push({ P, T, s, u: i / n })
  }
  return out
}

function outwardNormal(tangent, orientation) {
  const T = tangent.clone().normalize()
  let B = (orientation?.clone?.() ?? WINDOW_OUT.clone()).normalize()
  // Prefer facing +Z for window stone face.
  if (B.dot(WINDOW_OUT) < 0) B.negate()
  let N = new THREE.Vector3().crossVectors(B, T)
  if (N.lengthSq() < 1e-8) N = new THREE.Vector3(0, 1, 0).cross(T)
  N.normalize()
  B = new THREE.Vector3().crossVectors(T, N).normalize()
  // B should be the relief / surface normal (out of stone).
  if (B.dot(WINDOW_OUT) < 0) {
    B.negate()
    N.negate()
  }
  return { normal: B, binormal: N, tangent: T }
}

/**
 * Collect sparse triangle samples from architectural solid meshes.
 */
export function collectMeshSurfaceSamples(meshes, stride = 9) {
  const samples = []
  for (const m of meshes ?? []) {
    const geo = m.geometry
    if (!geo?.getAttribute) continue
    const pos = geo.getAttribute('position')
    const idx = geo.index
    if (!pos) continue
    const type = m.type ?? m.featureType ?? 'stone'
    const step = Math.max(1, Math.round(stride))
    if (idx) {
      for (let i = 0; i < idx.count; i += 3 * step) {
        const ia = idx.getX(i)
        const ib = idx.getX(i + 1)
        const ic = idx.getX(i + 2)
        const a = new THREE.Vector3().fromBufferAttribute(pos, ia)
        const b = new THREE.Vector3().fromBufferAttribute(pos, ib)
        const c = new THREE.Vector3().fromBufferAttribute(pos, ic)
        const P = a.clone().add(b).add(c).multiplyScalar(1 / 3)
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
        if (n.lengthSq() < 1e-12) continue
        n.normalize()
        if (n.dot(WINDOW_OUT) < 0) n.negate()
        samples.push({ P, normal: n, featureType: type, source: 'mesh', featureId: m.id ?? null })
      }
    } else {
      for (let i = 0; i + 2 < pos.count; i += 3 * step) {
        const a = new THREE.Vector3().fromBufferAttribute(pos, i)
        const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1)
        const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2)
        const P = a.clone().add(b).add(c).multiplyScalar(1 / 3)
        const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a))
        if (n.lengthSq() < 1e-12) continue
        n.normalize()
        if (n.dot(WINDOW_OUT) < 0) n.negate()
        samples.push({ P, normal: n, featureType: type, source: 'mesh', featureId: m.id ?? null })
      }
    }
  }
  return samples
}

/**
 * Build a reusable surface index from arch features (+ optional solid meshes).
 */
export function buildSurfaceIndex(arch, specimen = null) {
  const featureSamples = []
  const byCurveId = new Map()

  for (const curve of arch?.curves ?? []) {
    const samples = samplePolyline(curve.points, Math.max(6, Math.ceil((curve.length || 1) * 8)))
    const list = []
    for (const s of samples) {
      const frame = outwardNormal(s.T, curve.orientation)
      const entry = {
        P: s.P,
        tangent: frame.tangent,
        normal: frame.normal,
        side: frame.binormal,
        featureType: curve.featureType,
        featureId: curve.id,
        source: 'feature',
        s: s.s,
      }
      featureSamples.push(entry)
      list.push(entry)
    }
    byCurveId.set(curve.id, list)
  }

  for (const j of arch?.junctions ?? []) {
    const P = j.position?.clone?.() ?? new THREE.Vector3(j.position?.x, j.position?.y, j.position?.z ?? 0)
    const T = new THREE.Vector3(0, 1, 0)
    const frame = outwardNormal(T, WINDOW_OUT)
    featureSamples.push({
      P,
      tangent: frame.tangent,
      normal: frame.normal,
      side: frame.binormal,
      featureType: 'junction',
      featureId: j.id,
      source: 'junction',
      s: 0,
    })
  }

  const meshSamples = collectMeshSurfaceSamples(specimen?.meshes, 10)

  return {
    featureSamples,
    meshSamples,
    byCurveId,
    bounds: arch?.bounds ?? null,
  }
}

function nearestInList(point, list, maxDist) {
  let best = null
  let bestD = maxDist * maxDist
  const q = point instanceof THREE.Vector3 ? point : new THREE.Vector3(point.x, point.y, point.z ?? 0)
  for (const s of list) {
    const d = q.distanceToSquared(s.P)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best ? { sample: best, distance: Math.sqrt(bestD) } : null
}

/**
 * Resolve a surface attachment for a query point / optional feature id.
 */
export function resolveAttachment(queryPoint, surfaceIndex, opts = {}) {
  const maxDist = opts.maxDistance ?? 0.45
  const strength = clamp01(opts.attachmentStrength ?? 0.85)
  const featureId = opts.featureId ?? null
  const q = queryPoint instanceof THREE.Vector3
    ? queryPoint
    : new THREE.Vector3(queryPoint.x, queryPoint.y, queryPoint.z ?? 0)

  let hit = null
  if (featureId && surfaceIndex?.byCurveId?.has(featureId)) {
    hit = nearestInList(q, surfaceIndex.byCurveId.get(featureId), maxDist * 1.4)
  }
  if (!hit) hit = nearestInList(q, surfaceIndex?.featureSamples ?? [], maxDist)
  if (!hit && (surfaceIndex?.meshSamples?.length ?? 0) > 0) {
    hit = nearestInList(q, surfaceIndex.meshSamples, maxDist * 1.2)
  }

  if (!hit) {
    return {
      valid: false,
      position: q.clone(),
      normal: WINDOW_OUT.clone(),
      tangent: new THREE.Vector3(0, 1, 0),
      side: new THREE.Vector3(1, 0, 0),
      distance: Infinity,
      featureType: null,
      featureId: null,
      source: 'none',
      strength: 0,
    }
  }

  const s = hit.sample
  const blend = strength
  const position = q.clone().lerp(s.P, blend)
  const normal = (s.normal?.clone?.() ?? WINDOW_OUT.clone()).normalize()
  const tangent = (s.tangent?.clone?.() ?? new THREE.Vector3(0, 1, 0)).normalize()
  let side = s.side?.clone?.()
  if (!side) side = new THREE.Vector3().crossVectors(normal, tangent).normalize()

  return {
    valid: hit.distance <= maxDist,
    position,
    normal,
    tangent,
    side,
    distance: hit.distance,
    featureType: s.featureType ?? null,
    featureId: s.featureId ?? null,
    source: s.source ?? 'feature',
    strength: blend,
    influence: featureInfluence(s.featureType),
  }
}

/**
 * Mirror an attachment across a vertical architectural axis (bilateral).
 */
export function mirrorAttachment(attachment, axisX = 0) {
  if (!attachment) return null
  const ax = axisX
  const position = attachment.position.clone()
  position.x = ax - (position.x - ax)
  const normal = attachment.normal.clone()
  normal.x *= -1
  const tangent = attachment.tangent.clone()
  // Keep vertical component; flip lateral
  tangent.x *= -1
  const side = attachment.side.clone()
  side.x *= -1
  return {
    ...attachment,
    position,
    normal: normal.normalize(),
    tangent: tangent.normalize(),
    side: side.normalize(),
    mirrored: true,
  }
}

/**
 * Cache attachments for every branch in a composed network.
 */
export function attachOrnamentNetwork(network, surfaceIndex, params = {}) {
  const strength = clamp01(params.attachmentStrength ?? 0.85)
  const maxDistance = params.maxAttachDistance ?? 0.5
  const axisX = network?.composition?.axis?.axisX ?? 0
  const byId = new Map()
  for (const b of network?.branches ?? []) byId.set(b.id, b)

  const attachments = new Map()
  let validCount = 0
  let invalidCount = 0

  const ordered = [...(network?.branches ?? [])].sort(
    (a, b) => (a.generation ?? 0) - (b.generation ?? 0),
  )

  for (const branch of ordered) {
    const role = branch.compositionRole ?? 'master'
    // Prefer solving master first; mirrors copy reflected frames.
    if (role === 'mirror' && branch.sourceId && attachments.has(branch.sourceId)) {
      const mirrored = mirrorAttachment(attachments.get(branch.sourceId), axisX)
      attachments.set(branch.id, mirrored)
      branch.attachment = mirrored
      if (mirrored?.valid) validCount += 1
      else invalidCount += 1
      continue
    }

    const origin = branch.origin ?? branch.points?.[0]
    if (!origin) {
      invalidCount += 1
      continue
    }

    let featureId = branch.architecturalFeatureId ?? null
    const parent = branch.parentId ? byId.get(branch.parentId) : null
    const parentAtt = parent ? attachments.get(parent.id) : null

    // Children: inherit parent surface frame at the junction (small overlap ok).
    // Do not re-snap mid-air secondary tips onto distant stone.
    if (parent && parentAtt?.valid) {
      const originV = origin instanceof THREE.Vector3
        ? origin.clone()
        : new THREE.Vector3(origin.x, origin.y, origin.z ?? 0)
      const childAtt = {
        valid: true,
        position: originV.clone(),
        normal: parentAtt.normal.clone(),
        tangent: parentAtt.tangent.clone(),
        side: parentAtt.side.clone(),
        distance: 0,
        featureType: parentAtt.featureType ?? 'junction',
        featureId: featureId ?? parentAtt.featureId,
        source: 'parent-junction',
        strength: strength * 0.65,
        influence: {
          ...featureInfluence(parentAtt.featureType ?? 'junction'),
          // Narrower secondary roots at junctions
          rootScale: Math.min(1.15, (parentAtt.influence?.rootScale ?? 1) * 0.85),
        },
        fromParent: true,
      }
      attachments.set(branch.id, childAtt)
      branch.attachment = childAtt
      validCount += 1
      continue
    }

    // Children inherit parent feature when available.
    if (!featureId && parent) {
      featureId = parent.architecturalFeatureId ?? null
    }

    const att = resolveAttachment(origin, surfaceIndex, {
      featureId,
      attachmentStrength: strength,
      maxDistance,
    })
    attachments.set(branch.id, att)
    branch.attachment = att
    if (att.valid) validCount += 1
    else invalidCount += 1
  }

  return {
    attachments,
    stats: {
      attachmentCount: attachments.size,
      validAttachments: validCount,
      invalidAttachments: invalidCount,
    },
  }
}

/**
 * Pull early path samples onto the architectural surface and embed the root.
 * Returns a new point list — does not mutate the branch curve store.
 */
export function conformPathToAttachment(points, attachment, params = {}) {
  if (!points || points.length < 2 || !attachment?.valid) {
    return points?.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 })) ?? []
  }

  const conformity = clamp01(params.surfaceConformity ?? 0.7) * (attachment.influence?.conformBias ?? 1)
  const embedding = Math.max(0, params.rootEmbedding ?? 0.012) * (attachment.influence?.rootScale ?? 1)
  const transitionLength = Math.max(0.12, Math.min(0.95, params.transitionLength ?? 0.55))
  const reliefProjection = Math.max(0, params.reliefProjection ?? params.reliefDepth ?? 0.016)
  const emergence = clamp01(params.sculpturalEmergence ?? 0.55) * (attachment.influence?.emergeBias ?? 1)

  // Arc-length table
  const pts = points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }))
  const cum = [0]
  for (let i = 1; i < pts.length; i += 1) {
    cum.push(
      cum[i - 1] +
        Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z),
    )
  }
  const total = cum[cum.length - 1] || 1

  const nrm = attachment.normal
  const rootPos = attachment.position.clone().addScaledVector(nrm, -embedding)

  const out = []
  for (let i = 0; i < pts.length; i += 1) {
    const u = cum[i] / total
    // Conform region fades across transitionLength
    const conformU = clamp01(u / Math.max(0.08, transitionLength * 0.55))
    const conformW = conformity * (1 - conformU * conformU * (3 - 2 * conformU))

    // Root blend: first samples lerp strongly to embedded root
    const rootW = Math.max(0, 1 - u / Math.max(0.06, transitionLength * 0.22))
    const rootEase = rootW * rootW * (3 - 2 * rootW)

    let x = pts[i].x
    let y = pts[i].y
    let z = pts[i].z

    // Snap toward surface foot along normal (preserve lateral path).
    const Q = new THREE.Vector3(x, y, z)
    const toSurf = attachment.position.clone().sub(Q)
    const alongN = toSurf.dot(nrm)
    const onSurf = Q.clone().addScaledVector(nrm, alongN * conformW)

    x = onSurf.x
    y = onSurf.y
    z = onSurf.z

    // Embed root
    x = x * (1 - rootEase) + rootPos.x * rootEase
    y = y * (1 - rootEase) + rootPos.y * rootEase
    z = z * (1 - rootEase) + rootPos.z * rootEase

    // Relief lift grows, then free emergence can leave the surface.
    const raise = smooth01(u / Math.max(0.1, transitionLength * 0.5))
    const free = smooth01((u - transitionLength * 0.45) / Math.max(0.08, transitionLength * 0.55))
    const lift = reliefProjection * (0.25 + 0.75 * raise) * (1 - free * emergence * 0.35)
    const freePull = free * emergence

    // Blend back toward original free path as sculpture emerges
    x = x * (1 - freePull) + pts[i].x * freePull
    y = y * (1 - freePull) + pts[i].y * freePull
    z = z * (1 - freePull) + pts[i].z * freePull
    x += nrm.x * lift
    y += nrm.y * lift
    z += nrm.z * lift

    out.push({ x, y, z })
  }

  // Ensure first point is the embedded root for continuous attachment.
  out[0] = { x: rootPos.x, y: rootPos.y, z: rootPos.z }
  return out
}

function smooth01(t) {
  const u = clamp01(t)
  return u * u * (3 - 2 * u)
}

/**
 * Integration state weights along normalized arc length.
 * A embedded relief → B raised relief → C free sculpture.
 */
export function integrationStateAt(u, params = {}, influence = null) {
  const transitionLength = Math.max(0.12, Math.min(0.95, params.transitionLength ?? 0.55))
  const emergence = clamp01(params.sculpturalEmergence ?? 0.55) * (influence?.emergeBias ?? 1)
  const conform = clamp01(params.surfaceConformity ?? 0.7) * (influence?.conformBias ?? 1)
  const t = clamp01(u)

  const aEnd = transitionLength * 0.28
  const bEnd = transitionLength * 0.72
  let embedded = 1 - smooth01(t / Math.max(1e-4, aEnd))
  let free = smooth01((t - bEnd * 0.85) / Math.max(1e-4, 1 - bEnd * 0.85)) * emergence
  let raised = clamp01(1 - embedded - free * 0.65)
  // Normalize roughly
  const sum = embedded + raised + free || 1
  embedded /= sum
  raised /= sum
  free /= sum

  return {
    embedded,
    raised,
    free,
    conform: conform * (embedded * 0.85 + raised * 0.45),
    tipCurlBias: influence?.tipCurlBias ?? 1,
    rootScale: influence?.rootScale ?? 1,
  }
}

/**
 * Debug geometries for attachment visualization.
 */
export function buildAttachmentDebug(attachments, opts = {}) {
  const showPoints = opts.showAttachmentPoints !== false
  const showNormals = !!opts.showSurfaceNormals
  const showFrames = !!opts.showAttachmentFrames
  const showTransitions = !!opts.showReliefTransitions

  const pointPos = []
  const normalPos = []
  const normalCol = []
  const framePos = []
  const frameCol = []
  const transPos = []
  const transCol = []

  for (const att of attachments?.values?.() ?? []) {
    if (!att?.position) continue
    const P = att.position
    const valid = att.valid
    if (showPoints) {
      pointPos.push(P.x, P.y, P.z)
    }
    if (showNormals && att.normal) {
      const L = 0.08
      normalPos.push(P.x, P.y, P.z, P.x + att.normal.x * L, P.y + att.normal.y * L, P.z + att.normal.z * L)
      const c = valid ? [0.35, 0.75, 1] : [1, 0.35, 0.25]
      normalCol.push(...c, ...c)
    }
    if (showFrames && att.tangent && att.side && att.normal) {
      const L = 0.05
      // T cyan, side amber, N blue
      framePos.push(P.x, P.y, P.z, P.x + att.tangent.x * L, P.y + att.tangent.y * L, P.z + att.tangent.z * L)
      frameCol.push(0.3, 0.85, 0.9, 0.3, 0.85, 0.9)
      framePos.push(P.x, P.y, P.z, P.x + att.side.x * L, P.y + att.side.y * L, P.z + att.side.z * L)
      frameCol.push(0.95, 0.7, 0.25, 0.95, 0.7, 0.25)
      framePos.push(P.x, P.y, P.z, P.x + att.normal.x * L, P.y + att.normal.y * L, P.z + att.normal.z * L)
      frameCol.push(0.4, 0.55, 1, 0.4, 0.55, 1)
    }
    if (showTransitions && att.normal) {
      // Short segment showing embed → raise direction
      const embed = 0.02
      const raise = 0.05
      const a = P.clone().addScaledVector(att.normal, -embed)
      const b = P.clone().addScaledVector(att.normal, raise)
      transPos.push(a.x, a.y, a.z, b.x, b.y, b.z)
      transCol.push(0.85, 0.55, 0.3, 0.55, 0.85, 0.45)
    }
  }

  const geos = {}
  if (pointPos.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pointPos, 3))
    geos.points = g
  }
  if (normalPos.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(normalPos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(normalCol, 3))
    geos.normals = g
  }
  if (framePos.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(framePos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(frameCol, 3))
    geos.frames = g
  }
  if (transPos.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(transPos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(transCol, 3))
    geos.transitions = g
  }
  return geos
}

export function disposeAttachmentDebug(geos) {
  if (!geos) return
  for (const g of Object.values(geos)) g?.dispose?.()
}
