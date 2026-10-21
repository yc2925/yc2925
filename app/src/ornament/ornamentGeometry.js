/**
 * Steps 10A–10C — Tapered sweeps, sculptural profiles, architectural integration.
 *
 * 10A: parallel-transport tapered tubes from the composed curve network.
 * 10B: multi-profile cross-sections, relief, foliate morphing along paths.
 * 10C: surface attachment, root embedding, relief→sculpture transition.
 * Does not regenerate particle / L-system paths.
 */

import * as THREE from 'three'
import { clamp01 } from './extract.js'
import {
  attachOrnamentNetwork,
  buildAttachmentDebug,
  buildSurfaceIndex,
  conformPathToAttachment,
  disposeAttachmentDebug,
  integrationStateAt,
} from './architecturalAttachment.js'

export const ORNAMENT_MATERIAL_MODES = [
  { id: 'stone', label: 'Stone' },
  { id: 'clay', label: 'Clay' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'profile-debug', label: 'Profile Debug' },
]

export const ORNAMENT_PROFILE_TYPES = [
  { id: 'round', label: 'Round' },
  { id: 'fluted', label: 'Fluted' },
  { id: 'leaf', label: 'Leaf-like' },
  { id: 'relief', label: 'Carved Relief' },
]

export const SCULPTURE_MODES = [
  { id: 'surface', label: 'Surface Relief' },
  { id: 'free', label: 'Free Sculpture' },
]

const MIN_RADIUS = 0.0012
const WINDOW_RELIEF = new THREE.Vector3(0, 0, 1)

/**
 * Smooth base→tip radius multiplier along normalized arc length u ∈ [0,1].
 * Higher taperStrength → finer tips; never hard steps.
 */
export function taperProfile(u, taperStrength = 0.7) {
  const t = clamp01(u)
  const strength = clamp01(taperStrength)
  const s = t * t * (3 - 2 * t)
  const tip = 1 - strength * 0.9
  const power = 1.05 + strength * 0.85
  return Math.max(0.04, tip + (1 - tip) * (1 - s ** power))
}

/**
 * Hierarchical base radius by generation.
 * Children thinner than parents; decay applied per generation.
 */
export function baseRadiusForGeneration(generation, ornamentThickness, decay) {
  const g = Math.max(0, Math.round(generation ?? 0))
  const d = Math.max(0.35, Math.min(0.95, decay ?? 0.68))
  const base = Math.max(0.006, ornamentThickness ?? 0.028)
  return base * Math.pow(d, g)
}

/**
 * Parallel-transport frames along an ordered polyline.
 * Returns resampled centers + T/N/B and cumulative arc lengths.
 * @param {THREE.Vector3|null} initialBinormal preferred surface normal / relief axis
 */
export function buildTransportFrames(points, tubularSegments, initialBinormal = null) {
  const raw = (points ?? [])
    .map((p) => new THREE.Vector3(p.x, p.y, p.z ?? 0))
    .filter((p, i, arr) => i === 0 || p.distanceToSquared(arr[i - 1]) > 1e-12)
  if (raw.length < 2) return null

  const cum = [0]
  for (let i = 1; i < raw.length; i += 1) {
    cum.push(cum[i - 1] + raw[i].distanceTo(raw[i - 1]))
  }
  const totalLen = cum[cum.length - 1]
  if (totalLen < 1e-5) return null

  const segs = Math.max(4, Math.round(tubularSegments))
  const centers = []
  const tangents = []
  const normals = []
  const binormals = []
  const arc = []

  const sampleAt = (s) => {
    const d = Math.min(totalLen, Math.max(0, s))
    let i = 1
    while (i < cum.length && cum[i] < d) i += 1
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(raw.length - 1, i)
    const seg = cum[i1] - cum[i0] || 1e-6
    const u = clamp01((d - cum[i0]) / seg)
    const P = raw[i0].clone().lerp(raw[i1], u)
    const T = raw[i1].clone().sub(raw[i0])
    if (T.lengthSq() < 1e-12) T.set(0, 1, 0)
    else T.normalize()
    return { P, T }
  }

  let prevT = new THREE.Vector3()
  let N = new THREE.Vector3()
  let B = new THREE.Vector3()

  for (let i = 0; i <= segs; i += 1) {
    const s = (i / segs) * totalLen
    const { P, T } = sampleAt(s)
    if (i === 0) {
      // Prefer attachment surface normal, else window-plane +Z.
      if (initialBinormal && initialBinormal.lengthSq() > 1e-10) {
        B.copy(initialBinormal).normalize()
      } else {
        B.copy(WINDOW_RELIEF)
      }
      N.crossVectors(B, T)
      if (N.lengthSq() < 1e-8) {
        N.set(0, 1, 0).cross(T)
      }
      N.normalize()
      B.crossVectors(T, N).normalize()
      // Keep B pointing roughly outward (+Z / attachment).
      const prefer = initialBinormal ?? WINDOW_RELIEF
      if (B.dot(prefer) < 0) {
        B.negate()
        N.negate()
      }
    } else {
      const axis = new THREE.Vector3().crossVectors(prevT, T)
      const sin = axis.length()
      if (sin > 1e-8) {
        axis.multiplyScalar(1 / sin)
        const cos = THREE.MathUtils.clamp(prevT.dot(T), -1, 1)
        const q = new THREE.Quaternion().setFromAxisAngle(axis, Math.acos(cos))
        N.applyQuaternion(q)
        B.applyQuaternion(q)
      }
      B.crossVectors(T, N).normalize()
      N.crossVectors(B, T).normalize()
    }
    centers.push(P)
    tangents.push(T.clone())
    normals.push(N.clone())
    binormals.push(B.clone())
    arc.push(s)
    prevT.copy(T)
  }

  return { centers, tangents, normals, binormals, arc, length: totalLen, segs }
}

/**
 * Blend weight from stem (0) → sculptural target (1) along path.
 * Controlled by profileTransition (higher → morph earlier).
 */
export function profileBlendAt(u, profileTransition = 0.55) {
  const t = clamp01(u)
  const tr = clamp01(profileTransition)
  const stemEnd = 0.1 + (1 - tr) * 0.32
  const tipStart = 0.48 + tr * 0.28
  if (t <= stemEnd) return 0
  if (t >= tipStart) return 1
  const x = (t - stemEnd) / Math.max(1e-6, tipStart - stemEnd)
  return x * x * (3 - 2 * x)
}

/**
 * Foliate tip curl amount near the end of a path (0–1).
 */
export function tipCurlAmount(u, strength = 0.55) {
  const t = clamp01(u)
  const s = clamp01(strength)
  if (t < 0.62) return 0
  const x = (t - 0.62) / 0.38
  return s * (x * x * (3 - 2 * x))
}

/**
 * Sample a 2D cross-section in the (N, B) plane.
 * n = along normal (leaf width), b = along binormal (relief / thickness).
 */
export function sampleProfile2D(type, theta, opts = {}) {
  const halfW = Math.max(MIN_RADIUS, opts.halfWidth ?? 0.02)
  const halfD = Math.max(MIN_RADIUS, opts.halfDepth ?? 0.02)
  const fluting = clamp01(opts.flutingStrength ?? 0.45)
  const ridge = clamp01(opts.ridgeStrength ?? 0.55)
  const c = Math.cos(theta)
  const s = Math.sin(theta)

  if (type === 'round') {
    return { n: c * halfW, b: s * halfD }
  }

  if (type === 'fluted') {
    const grooves = 6
    const groove = 0.5 + 0.5 * Math.cos(theta * grooves)
    const r = 1 - fluting * 0.28 * groove
    return { n: c * halfW * r, b: s * halfD * r }
  }

  if (type === 'leaf') {
    // Flattened blade: wide in N, thin in B, central ridge on +B face.
    const blade = Math.pow(Math.abs(c) + 1e-4, 0.55)
    const n = c * halfW * (0.75 + 0.35 * blade)
    const body = s * halfD * (0.38 + 0.22 * Math.abs(c))
    const ridgeBump = ridge * halfD * 0.55 * Math.exp(-6.5 * s * s) * Math.max(0, Math.abs(c))
    const b = body + Math.sign(s || 1) * ridgeBump * (s >= 0 ? 1 : 0.35)
    return { n, b }
  }

  // carved relief — raised half-profile sitting against a wall (−B flattened)
  const front = Math.max(s, -0.12)
  const n = c * halfW * (0.9 + 0.1 * Math.abs(c))
  const raised = (front + 0.12) / 1.12
  const b = -halfD * 0.12 + raised * halfD * (0.95 + fluting * 0.08 * Math.cos(theta * 5))
  return { n, b }
}

/**
 * Smoothly blend two profile samples.
 */
export function blendProfile2D(a, b, w) {
  const t = clamp01(w)
  return {
    n: a.n * (1 - t) + b.n * t,
    b: a.b * (1 - t) + b.b * t,
  }
}

/**
 * Cross-section half-extents from thickness + width/depth knobs + taper.
 */
export function sectionExtents(u, opts = {}) {
  const taper = taperProfile(u, opts.taperStrength ?? 0.7)
  const base = Math.max(MIN_RADIUS * 4, opts.baseRadius ?? 0.028)
  const widthMul = Math.max(0.35, opts.profileWidth ?? 1.15)
  const depthMul = Math.max(0.25, opts.profileDepth ?? 0.75)
  const r = Math.max(MIN_RADIUS, base * taper)
  // Leaf / relief read wider; round keeps equal axes via caller.
  return {
    halfWidth: r * widthMul,
    halfDepth: r * depthMul,
    radius: r,
  }
}

/**
 * Root flare: children slightly thicker at attachment, then ease to target.
 * Primary roots also flare when embedding into stone (wider, flatter base).
 */
export function junctionScale(u, isChild, flare = 0.22) {
  const t = clamp01(u)
  if (t > 0.28) return 1
  const x = 1 - t / 0.28
  const s = x * x * (3 - 2 * x)
  const amount = isChild ? flare : flare * 0.85
  return 1 + amount * s
}

/**
 * Inset child root into parent along the child tangent so joins don't float.
 */
export function refineJunctionPoints(points, baseRadius, isChild) {
  if (!isChild || !points || points.length < 2) return points
  const inset = Math.min(baseRadius * 0.85, 0.04)
  const out = points.map((p) => ({ x: p.x, y: p.y, z: p.z ?? 0 }))
  const a = out[0]
  const b = out[1]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const dz = (b.z ?? 0) - (a.z ?? 0)
  const len = Math.hypot(dx, dy, dz) || 1
  a.x -= (dx / len) * inset
  a.y -= (dy / len) * inset
  a.z -= (dz / len) * inset
  return out
}

/**
 * General sculptural sweep. Round profile with equal axes matches 10A tubes.
 * When `attachment` is provided, frames orient to the surface and cross-sections
 * transition embedded relief → raised relief → free sculpture along arc length.
 */
export function sweepSculpturalTube(points, opts = {}) {
  const radial = Math.max(6, Math.min(18, Math.round(opts.radialResolution ?? 10)))
  const tubular = Math.max(4, Math.round(opts.curveResolution ?? 24))
  const baseR = Math.max(MIN_RADIUS * 4, opts.baseRadius ?? 0.028)
  const taperStrength = opts.taperStrength ?? 0.7
  const flipWinding = !!opts.flipWinding
  const mirrorProfile = !!opts.mirrorProfile || flipWinding
  const profileType = opts.profileType ?? 'round'
  const profileWidth = opts.profileWidth ?? 1.15
  const profileDepth = opts.profileDepth ?? 0.75
  const flutingStrength = opts.flutingStrength ?? 0.45
  const profileTransition = opts.profileTransition ?? 0.55
  const sculptureMode = opts.sculptureMode ?? 'surface'
  const reliefDepth = Math.max(0, opts.reliefDepth ?? 0.012)
  const reliefProjection = Math.max(0, opts.reliefProjection ?? reliefDepth)
  const isChild = !!opts.isChild
  const tipCurl = opts.tipCurl ?? 0.55
  const attachment = opts.attachment ?? null
  const influence = attachment?.influence ?? null
  const integration = {
    surfaceConformity: opts.surfaceConformity ?? 0.7,
    rootEmbedding: opts.rootEmbedding ?? 0.012,
    reliefProjection,
    sculpturalEmergence: opts.sculpturalEmergence ?? 0.55,
    transitionLength: opts.transitionLength ?? 0.55,
  }

  const initialB = attachment?.valid ? attachment.normal : null
  const frames = buildTransportFrames(points, tubular, initialB)
  if (!frames) return null

  const { centers, tangents, normals, binormals, segs } = frames
  const ringCount = segs + 1
  const positions = new Float32Array(ringCount * radial * 3)
  const norms = new Float32Array(ringCount * radial * 3)
  const uvs = new Float32Array(ringCount * radial * 2)
  const colors = new Float32Array(ringCount * radial * 3)

  // Surface relief hugs stone; free sculpture projects more (legacy mode still applies).
  const reliefScale = sculptureMode === 'free' ? 1.2 : 1
  const modeFreeBias = sculptureMode === 'free' ? 0.25 : 0

  for (let i = 0; i < ringCount; i += 1) {
    const u = i / segs
    const state = integrationStateAt(u, integration, influence)
    const blend = profileType === 'round' ? 0 : profileBlendAt(u, profileTransition)
    // Root: wider + flatter; morph toward sculptural profile as relief rises.
    const rootFlat = state.embedded * 0.55 + state.raised * 0.2
    const widthMul =
      (profileType === 'round' ? 1 : profileWidth) * (1 + rootFlat * 0.55 * (influence?.rootScale ?? 1))
    const depthMul =
      (profileType === 'round' ? 1 : profileDepth) * (1 - rootFlat * 0.45 + state.free * 0.12)
    const extents = sectionExtents(u, {
      baseRadius: baseR * (1 + state.embedded * 0.15 * (influence?.rootScale ?? 1)),
      taperStrength,
      profileWidth: widthMul,
      profileDepth: Math.max(0.22, depthMul),
    })
    const jScale = junctionScale(u, isChild, isChild ? 0.22 : 0.32 * (influence?.rootScale ?? 1))
    const halfW = extents.halfWidth * jScale
    const halfD = extents.halfDepth * jScale

    // Foliate tip curl gated by free-sculpture emergence.
    const curlStrength =
      tipCurl * (state.tipCurlBias ?? 1) * (0.25 + 0.75 * (state.free + modeFreeBias))
    const curl =
      tipCurlAmount(u, curlStrength) *
      (profileType === 'leaf' || profileType === 'fluted' ? 1 : 0.35)
    const tipWiden = 1 + curl * 0.35 * (profileType === 'leaf' ? 1.1 : 0.4)

    const P = centers[i].clone()
    const T = tangents[i]
    let Nf = normals[i].clone()
    let Bf = binormals[i].clone()

    // Keep binormal blended toward surface normal while conforming.
    if (attachment?.valid && attachment.normal && state.conform > 0.05) {
      const sn = attachment.normal
      const targetB = sn.clone()
      if (targetB.dot(Bf) < 0) targetB.negate()
      Bf.lerp(targetB, clamp01(state.conform * 0.85)).normalize()
      Nf.crossVectors(Bf, T)
      if (Nf.lengthSq() < 1e-8) Nf.copy(normals[i])
      else Nf.normalize()
      Bf.crossVectors(T, Nf).normalize()
    }

    // Curl tip: rotate N/B around T and pull slightly toward −N (hook).
    if (curl > 1e-4) {
      const ang = curl * 0.85 * (mirrorProfile ? -1 : 1)
      const q = new THREE.Quaternion().setFromAxisAngle(T, ang)
      Nf.applyQuaternion(q)
      Bf.applyQuaternion(q)
      P.addScaledVector(Nf, -curl * halfW * 0.55 * state.free)
    }

    // Extra micro-lift for raised / free states (path already conformed + embedded).
    const prefer = attachment?.normal ?? WINDOW_RELIEF
    const outward = Bf.dot(prefer) >= 0 ? Bf : Bf.clone().negate()
    const lift =
      reliefProjection *
      reliefScale *
      (state.embedded * 0.12 + state.raised * 0.75 + state.free * 0.35) *
      (0.55 + 0.45 * blend)
    P.addScaledVector(outward, lift)

    // Flatten against stone while embedded / raised; open up as free sculpture.
    const flattenBack = state.free < 0.55 && profileType !== 'round'

    const stemOpts = {
      halfWidth: halfW * tipWiden,
      halfDepth: halfD * (0.55 + 0.45 * (1 - state.embedded)),
      flutingStrength: flutingStrength * 0.35,
      ridgeStrength: 0.2,
    }
    const targetOpts = {
      halfWidth: halfW * tipWiden,
      halfDepth: halfD * (profileType === 'leaf' ? 0.9 : 1),
      flutingStrength,
      ridgeStrength: 0.55 + blend * 0.25,
    }

    // Delay full sculptural profile until raised/free.
    const profileW = blend * (0.25 + 0.75 * (state.raised * 0.55 + state.free))

    for (let j = 0; j < radial; j += 1) {
      const a = (j / radial) * Math.PI * 2
      const stem = sampleProfile2D('round', a, stemOpts)
      const target = sampleProfile2D(profileType, a, targetOpts)
      let pr = blendProfile2D(stem, target, profileW)

      if (flattenBack && pr.b < 0) {
        const flatAmt = 0.2 + 0.55 * state.embedded + 0.25 * state.raised
        pr = { n: pr.n, b: pr.b * (1 - flatAmt) }
      }
      if (mirrorProfile) pr = { n: -pr.n, b: pr.b }

      const ox = Nf.x * pr.n + Bf.x * pr.b
      const oy = Nf.y * pr.n + Bf.y * pr.b
      const oz = Nf.z * pr.n + Bf.z * pr.b
      const vi = (i * radial + j) * 3
      positions[vi] = P.x + ox
      positions[vi + 1] = P.y + oy
      positions[vi + 2] = P.z + oz
      const nl = Math.hypot(ox, oy, oz) || 1
      norms[vi] = ox / nl
      norms[vi + 1] = oy / nl
      norms[vi + 2] = oz / nl
      const ui = (i * radial + j) * 2
      uvs[ui] = j / radial
      uvs[ui + 1] = u
      // Profile debug: encode integration state in colour
      colors[vi] = 0.25 + 0.55 * state.embedded + 0.2 * Math.abs(Math.cos(a))
      colors[vi + 1] = 0.2 + 0.55 * state.raised + 0.2 * Math.abs(Math.sin(a))
      colors[vi + 2] = 0.15 + 0.7 * state.free + 0.15 * blend
    }
  }

  const indices = []
  for (let i = 0; i < segs; i += 1) {
    for (let j = 0; j < radial; j += 1) {
      const j2 = (j + 1) % radial
      const a = i * radial + j
      const b = i * radial + j2
      const c = (i + 1) * radial + j
      const d = (i + 1) * radial + j2
      if (flipWinding) indices.push(a, b, c, b, d, c)
      else indices.push(a, c, b, b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(norms, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.userData = {
    tubularSegments: segs,
    radialSegments: radial,
    length: frames.length,
    baseRadius: baseR,
    triangleCount: indices.length / 3,
    profileType,
    frames,
  }
  return geo
}

/**
 * 10A-compatible circular tapered tube (delegates to sculptural sweep).
 */
export function sweepTaperedTube(points, opts = {}) {
  return sweepSculpturalTube(points, {
    ...opts,
    profileType: 'round',
    profileWidth: 1,
    profileDepth: 1,
    profileTransition: 0,
    tipCurl: 0,
    reliefDepth: opts.reliefDepth ?? 0,
    sculptureMode: opts.sculptureMode ?? 'free',
  })
}

/**
 * Adaptive tubular segment count from path length + point density.
 */
export function adaptiveCurveResolution(branch, curveResolution = 0.55) {
  const res = clamp01(curveResolution)
  const pts = branch.points?.length ?? 2
  const len = branch.length || 0.5
  const fromLen = Math.ceil(len * (10 + res * 22))
  const fromPts = Math.max(6, pts - 1)
  return Math.max(8, Math.min(64, Math.round(Math.max(fromLen, fromPts * (0.7 + res)))))
}

/**
 * Parent radius at a child's attachment arc-length (before child can exceed it).
 */
export function parentRadiusAtAttachment(parentBranch, parentBaseRadius, taperStrength, attachS) {
  const len = Math.max(1e-6, parentBranch?.length || 1)
  const u = clamp01((attachS ?? 0) / len)
  return Math.max(MIN_RADIUS, parentBaseRadius * taperProfile(u, taperStrength))
}

/**
 * Build frame-debug line geometry for PROFILE DEBUG mode.
 */
export function buildProfileDebugLines(frames, step = 4) {
  if (!frames?.centers?.length) return null
  const pos = []
  const col = []
  const axisLen = 0.04
  for (let i = 0; i < frames.centers.length; i += Math.max(1, step)) {
    const P = frames.centers[i]
    const N = frames.normals[i]
    const B = frames.binormals[i]
    const T = frames.tangents[i]
    // T cyan, N red, B green
    pos.push(P.x, P.y, P.z, P.x + T.x * axisLen, P.y + T.y * axisLen, P.z + T.z * axisLen)
    col.push(0.3, 0.85, 0.9, 0.3, 0.85, 0.9)
    pos.push(P.x, P.y, P.z, P.x + N.x * axisLen, P.y + N.y * axisLen, P.z + N.z * axisLen)
    col.push(0.95, 0.25, 0.2, 0.95, 0.25, 0.2)
    pos.push(P.x, P.y, P.z, P.x + B.x * axisLen, P.y + B.y * axisLen, P.z + B.z * axisLen)
    col.push(0.25, 0.9, 0.35, 0.25, 0.9, 0.35)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return geo
}

/**
 * Build cached full meshes for every branch in the composed network.
 * Resolves architectural attachments once (cached with the mesh pack).
 */
export function buildOrnamentMeshCache(network, params = {}) {
  const thickness = Math.max(0.008, params.ornamentThickness ?? 0.028)
  const taperStrength = clamp01(params.taperStrength ?? 0.72)
  const decay = Math.max(0.35, Math.min(0.95, params.branchThicknessDecay ?? 0.68))
  const radial = Math.max(6, Math.min(18, Math.round(params.radialResolution ?? 10)))
  const curveRes = params.curveResolution ?? 0.55
  const profileType = params.profileType ?? 'leaf'
  const profileWidth = params.profileWidth ?? 1.35
  const profileDepth = params.profileDepth ?? 0.62
  const flutingStrength = params.flutingStrength ?? 0.45
  const profileTransition = params.profileTransition ?? 0.58
  const reliefDepth = params.reliefDepth ?? 0.014
  const reliefProjection = params.reliefProjection ?? reliefDepth
  const sculptureMode = params.sculptureMode ?? 'surface'
  const tipCurl = params.tipCurl ?? 0.55
  const attachmentStrength = clamp01(params.attachmentStrength ?? 0.85)
  const surfaceConformity = clamp01(params.surfaceConformity ?? 0.7)
  const rootEmbedding = Math.max(0, params.rootEmbedding ?? 0.012)
  const sculpturalEmergence = clamp01(params.sculpturalEmergence ?? 0.55)
  const transitionLength = Math.max(0.12, Math.min(0.95, params.transitionLength ?? 0.55))

  const byId = new Map()
  for (const b of network?.branches ?? []) byId.set(b.id, b)

  // Surface index: reuse caller cache or build from arch / specimen.
  let surfaceIndex = params.surfaceIndex ?? null
  if (!surfaceIndex && (params.arch || params.specimen)) {
    surfaceIndex = buildSurfaceIndex(params.arch, params.specimen)
  }

  let attachResult = { attachments: new Map(), stats: { validAttachments: 0, invalidAttachments: 0 } }
  if (surfaceIndex) {
    attachResult = attachOrnamentNetwork(network, surfaceIndex, {
      attachmentStrength,
      maxAttachDistance: params.maxAttachDistance ?? 0.5,
    })
  }

  const radiusById = new Map()
  const meshes = []
  const debugGeometries = []
  let totalTriangles = 0
  let primaryCount = 0
  let secondaryCount = 0

  const conformParams = {
    surfaceConformity,
    rootEmbedding,
    reliefProjection,
    reliefDepth,
    sculpturalEmergence,
    transitionLength,
  }

  const ordered = [...(network?.branches ?? [])].sort(
    (a, b) => (a.generation ?? 0) - (b.generation ?? 0),
  )

  for (const branch of ordered) {
    const pts0 = branch.points
    if (!pts0 || pts0.length < 2) continue
    const gen = branch.generation ?? 0
    const isChild = gen >= 1 || branch.parentId != null
    const attachment = attachResult.attachments.get(branch.id) ?? branch.attachment ?? null
    let baseRadius = baseRadiusForGeneration(gen, thickness, decay)
    if (attachment?.influence?.rootScale) {
      baseRadius *= isChild ? 1 : Math.min(1.35, attachment.influence.rootScale)
    }
    if (branch.parentId != null && radiusById.has(branch.parentId)) {
      const parent = byId.get(branch.parentId)
      const parentR = radiusById.get(branch.parentId)
      const attachR = parentRadiusAtAttachment(
        parent,
        parentR,
        taperStrength,
        branch.parentAttachmentS ?? 0,
      )
      // Controlled overlap: child slightly under parent radius at join.
      baseRadius = Math.min(baseRadius, attachR * 0.92)
    }
    radiusById.set(branch.id, baseRadius)

    let pts = refineJunctionPoints(pts0, baseRadius, isChild)
    // Primary roots: full surface conformity + embedding.
    // Parent-junction children: light conformity (keep join continuous, don't re-glue to stone).
    if (attachment?.valid) {
      const childConform = attachment.fromParent
        ? {
            ...conformParams,
            surfaceConformity: (conformParams.surfaceConformity ?? 0.7) * 0.35,
            rootEmbedding: Math.min(conformParams.rootEmbedding ?? 0.012, baseRadius * 0.55),
            sculpturalEmergence: Math.min(1, (conformParams.sculpturalEmergence ?? 0.55) + 0.15),
            transitionLength: Math.min(0.4, (conformParams.transitionLength ?? 0.55) * 0.55),
          }
        : conformParams
      pts = conformPathToAttachment(pts, attachment, childConform)
    }
    const tubular = adaptiveCurveResolution(branch, curveRes)
    const flipWinding = (branch.compositionRole ?? 'master') === 'mirror'
    const geometry = sweepSculpturalTube(pts, {
      baseRadius,
      taperStrength,
      radialResolution: radial,
      curveResolution: tubular,
      flipWinding,
      mirrorProfile: flipWinding,
      profileType,
      profileWidth,
      profileDepth,
      flutingStrength,
      profileTransition,
      reliefDepth,
      reliefProjection,
      sculptureMode,
      tipCurl,
      isChild,
      attachment,
      surfaceConformity,
      rootEmbedding,
      sculpturalEmergence,
      transitionLength,
    })
    if (!geometry) continue

    totalTriangles += geometry.userData.triangleCount ?? 0
    if (gen === 0) primaryCount += 1
    else secondaryCount += 1

    const dbg = buildProfileDebugLines(geometry.userData.frames, 5)
    if (dbg) debugGeometries.push({ id: branch.id, geometry: dbg })

    // Drop heavy frame refs from userData to avoid retaining vectors after dispose.
    geometry.userData.frames = undefined
    geometry.userData.attachment = {
      valid: !!attachment?.valid,
      featureType: attachment?.featureType ?? null,
      featureId: attachment?.featureId ?? null,
      distance: attachment?.distance ?? null,
    }

    meshes.push({
      id: branch.id,
      generation: gen,
      role: branch.role,
      compositionRole: branch.compositionRole ?? 'master',
      length: branch.length || geometry.userData.length || 0,
      geometry,
      tubularSegments: geometry.userData.tubularSegments,
      radialSegments: geometry.userData.radialSegments,
      triangleCount: geometry.userData.triangleCount,
      baseRadius,
      profileType,
      attachment: geometry.userData.attachment,
    })
  }

  const attachmentDebug = buildAttachmentDebug(attachResult.attachments, {
    showAttachmentPoints: true,
    showSurfaceNormals: true,
    showAttachmentFrames: true,
    showReliefTransitions: true,
  })

  return {
    meshes,
    debugGeometries,
    attachmentDebug,
    attachments: attachResult.attachments,
    surfaceIndex,
    stats: {
      ornamentMeshes: meshes.length,
      ornamentTriangles: totalTriangles,
      primaryMeshCount: primaryCount,
      secondaryMeshCount: secondaryCount,
      profileType,
      sculptureMode,
      validAttachments: attachResult.stats.validAttachments,
      invalidAttachments: attachResult.stats.invalidAttachments,
      attachmentCount: attachResult.stats.attachmentCount ?? attachResult.attachments.size,
    },
    params: {
      ornamentThickness: thickness,
      taperStrength,
      branchThicknessDecay: decay,
      radialResolution: radial,
      curveResolution: curveRes,
      profileType,
      profileWidth,
      profileDepth,
      flutingStrength,
      profileTransition,
      reliefDepth,
      reliefProjection,
      sculptureMode,
      attachmentStrength,
      surfaceConformity,
      rootEmbedding,
      sculpturalEmergence,
      transitionLength,
    },
  }
}

/**
 * Set indexed draw range so only the grown prefix of a tube is visible.
 * u = visibleLength / length ∈ [0,1]
 */
export function applyGrowthDrawRange(geometry, visibleFraction) {
  if (!geometry?.index) return 0
  const segs = geometry.userData?.tubularSegments ?? 1
  const radial = geometry.userData?.radialSegments ?? 8
  const u = clamp01(visibleFraction)
  if (u <= 1e-4) {
    geometry.setDrawRange(0, 0)
    return 0
  }
  const visibleSegs = Math.max(1, Math.min(segs, Math.ceil(u * segs)))
  const indexCount = visibleSegs * radial * 6
  geometry.setDrawRange(0, indexCount)
  return visibleSegs / segs
}

export function createOrnamentMaterial(mode = 'stone', opts = {}) {
  if (mode === 'profile-debug') {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      metalness: 0,
      flatShading: true,
      wireframe: false,
    })
  }
  if (mode === 'clay') {
    return new THREE.MeshStandardMaterial({
      color: opts.clayColor ?? '#c8b8a4',
      roughness: 0.92,
      metalness: 0,
      flatShading: false,
      wireframe: false,
    })
  }
  if (mode === 'wireframe') {
    return new THREE.MeshStandardMaterial({
      color: opts.wireColor ?? '#a89888',
      roughness: 0.85,
      metalness: 0,
      wireframe: true,
    })
  }
  return new THREE.MeshStandardMaterial({
    color: opts.stoneColor ?? '#c4bfb4',
    roughness: opts.stoneRoughness ?? 0.82,
    metalness: 0.02,
    flatShading: false,
    wireframe: false,
  })
}

export function disposeMeshCache(cache) {
  if (!cache) return
  for (const m of cache.meshes ?? []) {
    m.geometry?.dispose()
  }
  for (const d of cache.debugGeometries ?? []) {
    d.geometry?.dispose()
  }
  disposeAttachmentDebug(cache.attachmentDebug)
  if (cache.meshes) cache.meshes.length = 0
  if (cache.debugGeometries) cache.debugGeometries.length = 0
  cache.attachmentDebug = null
}
