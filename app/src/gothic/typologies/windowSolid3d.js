import * as THREE from 'three'
import { V, normalizeGeometry, frameAt, makeFeature, featureColor } from '../primitives.js'
import { curveThrough, sweepProfile } from '../library.js'
import { sampleCurve, DESIGN_LAYER_COLORS } from './windowDesign2d.js'
import { buildRoleProfile, buildFrameLayerProfile } from '../profiles.js'

/**
 * Phase 2/3 — sweep stone profiles along the Phase-1 2D curve network.
 * Topology unchanged. Profiles / depth / bevel affect 3D representation only.
 */

const TAU = Math.PI * 2
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t

export function curveRole(curve) {
  if (curve.layer === 'frame') return 'frame'
  if (curve.layer === 'mullion') return 'mullion'
  if (curve.id?.includes('foil-cusp') || curve.id?.includes('apex-rib')) return 'tertiary'
  return 'secondary'
}

function isClosedCurve(curve) {
  if (curve.id === 'head-circle') return true
  if (curve.kind === 'arc' && Math.abs(Math.abs(curve.a1 - curve.a0) - TAU) < 0.05) return true
  return false
}

function sampleSteps(curve, res) {
  if (curve.kind === 'line') {
    const len = Math.hypot(curve.b[0] - curve.a[0], curve.b[1] - curve.a[1])
    return Math.max(2, Math.round(len / lerp(0.22, 0.08, res)))
  }
  if (curve.kind === 'arc') {
    const span = Math.abs(curve.a1 - curve.a0)
    const arcLen = curve.r * span
    return Math.max(12, Math.round((arcLen / lerp(0.12, 0.045, res)) * (span > Math.PI ? 1.2 : 1)))
  }
  if (curve.kind === 'bezier') return Math.max(16, Math.round(lerp(18, 40, res)))
  return Math.round(lerp(16, 48, res))
}

function densifyLine(a, b, steps) {
  const pts = []
  const n = Math.max(1, steps)
  for (let i = 0; i <= n; i += 1) {
    const t = i / n
    pts.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)])
  }
  return pts
}

/** Sample 2D curve → world XYZ on a constant-z plane (exact solid centerline). */
export function sampleCenterline3d(curve, res, z = 0) {
  let pts2
  if (curve.kind === 'line') {
    pts2 = densifyLine(curve.a, curve.b, sampleSteps(curve, res))
  } else {
    pts2 = sampleCurve(curve, sampleSteps(curve, res))
  }
  return pts2.map(([x, y]) => V(x, y, z))
}

function sweepSegs(curve, res, closed) {
  const steps = sampleSteps(curve, res)
  return Math.max(closed ? 24 : 8, Math.round(steps * lerp(1.2, 2.2, res)))
}

/** Z plane of the centerline — deeper roles sit further back. */
export function centerlineZ(role, depth, moldingDepth = 0.5) {
  const md = 0.6 + moldingDepth * 0.8
  if (role === 'frame') return -depth * 0.18 * md
  if (role === 'mullion') return -depth * 0.06 * md
  if (role === 'tertiary') return depth * 0.025
  return 0
}

function featureTypeForRole(role) {
  if (role === 'frame') return 'arch'
  if (role === 'mullion') return 'mullion'
  return 'tracery'
}

function skeletonColor(role) {
  if (role === 'frame') return DESIGN_LAYER_COLORS.frame
  if (role === 'mullion') return DESIGN_LAYER_COLORS.mullion
  if (role === 'tertiary') return '#e8c37a'
  return DESIGN_LAYER_COLORS.secondary
}

/**
 * Slightly extend open polylines at ends so neighbouring sweeps overlap cleanly at junctions.
 */
function extendEnds(pts, closed, amount = 0.012) {
  if (closed || pts.length < 2 || amount <= 0) return pts
  const out = pts.map((p) => p.clone())
  const d0 = out[1].clone().sub(out[0])
  if (d0.lengthSq() > 1e-10) {
    d0.normalize().multiplyScalar(amount)
    out[0].sub(d0)
  }
  const last = out.length - 1
  const d1 = out[last].clone().sub(out[last - 1])
  if (d1.lengthSq() > 1e-10) {
    d1.normalize().multiplyScalar(amount)
    out[last].add(d1)
  }
  return out
}

/**
 * @param {object} design — from buildWindowDesign2d (unchanged)
 * @param {object} params — 3D representation params only
 */
export function buildWindowSolid3d(design, params = {}) {
  const thickness = clamp(params.profileThickness ?? 0.055, 0.025, 0.12)
  const depth = clamp(params.architecturalDepth ?? 0.14, 0.06, 0.35)
  const moldComplexity = clamp(Math.round(params.moldingComplexity ?? 2), 1, 4)
  const res = clamp(params.detailResolution ?? 0.65, 0.15, 1)
  const profileType = params.moldingProfile ?? 'compound'
  const moldingDepth = clamp(params.moldingDepth ?? 0.55, 0, 1)
  const bevel = clamp(params.bevelIntensity ?? 0.45, 0, 1)

  // Effective depth for profiles
  const depthEff = depth * (0.7 + moldingDepth * 0.6)

  const meshes = []
  const features = []
  const geometries = []
  const skeleton = [] // exact centerlines used for sweeps (for SKELETON mode)

  const addMesh = (id, type, geometry) => {
    const g = normalizeGeometry(geometry)
    geometries.push(g)
    meshes.push({ id, type, geometry: g, color: featureColor(type) })
  }

  for (const curve of design.curves) {
    const role = curveRole(curve)
    const closed = isClosedCurve(curve)
    const z0 = centerlineZ(role, depth, moldingDepth)
    let pts = sampleCenterline3d(curve, res, z0)
    if (pts.length < 2) continue
    pts = extendEnds(pts, closed, thickness * (role === 'frame' ? 0.35 : 0.45))

    // Skeleton record — same XY as solid, slight +Z for visibility over solids if ever composited.
    skeleton.push({
      id: curve.id,
      role,
      layer: curve.layer,
      color: skeletonColor(role),
      points: pts.map((p) => V(p.x, p.y, p.z + 0.02)),
    })

    const segs = sweepSegs(curve, res, closed)

    if (role === 'frame') {
      for (let m = 0; m < moldComplexity; m += 1) {
        const z = z0 - m * depthEff * 0.08
        const layerPts = pts.map((p) => V(p.x, p.y, z))
        const layerCurve = curveThrough(layerPts, closed)
        const prof = buildFrameLayerProfile(profileType, thickness, depthEff, bevel, m)
        const geo = sweepProfile(layerCurve, prof, segs, closed)
        addMesh(`${curve.id}-mold-${m}`, 'arch', geo)
      }
    } else {
      const curve3 = curveThrough(pts, closed)
      const prof = buildRoleProfile(profileType, role, thickness, depthEff, bevel)
      const geo = sweepProfile(curve3, prof, segs, closed)
      addMesh(curve.id, featureTypeForRole(role), geo)
    }

    const mid = Math.floor(pts.length / 2)
    const next = Math.min(pts.length - 1, mid + 1)
    const tangent = pts[next].clone().sub(pts[mid])
    if (tangent.lengthSq() < 1e-10) tangent.set(0, 1, 0)
    features.push(
      makeFeature({
        id: curve.id,
        type: featureTypeForRole(role),
        label: curve.id,
        points: pts,
        localFrame: frameAt(pts[mid], tangent, V(0, 0, 1)),
        meta: { role, layer: curve.layer, phase: 3 },
      }),
    )
  }

  // Junction bosses — sized to the thinner adjacent member for cleaner merges.
  for (const j of design.junctions ?? []) {
    let role = 'secondary'
    if (
      j.id.includes('sill') ||
      j.id.includes('spring') ||
      (j.id.includes('apex') && !j.id.includes('lancet') && !j.id.includes('foil') && !j.id.includes('rib'))
    ) {
      role = 'frame'
    } else if (j.id.includes('mullion') || j.id.includes('impost') || j.id.includes('lancet')) {
      role = 'mullion'
    } else if (j.id.includes('foil') || j.id.includes('apex-rib') || j.id.includes('connector')) {
      role = 'tertiary'
    }
    const scale = role === 'frame' ? 0.72 : role === 'mullion' ? 0.48 : role === 'tertiary' ? 0.26 : 0.34
    const r = thickness * scale
    const z = centerlineZ(role, depth, moldingDepth)
    const radial = Math.max(8, Math.round(lerp(8, 12, res)))
    const sphere = new THREE.SphereGeometry(r, radial, Math.max(6, radial - 2))
    sphere.translate(j.x, j.y, z)
    addMesh(`boss-${j.id}`, 'junction', sphere)
    features.push(
      makeFeature({
        id: `junction-${j.id}`,
        type: 'junction',
        label: 'Junction',
        points: [V(j.x, j.y, z)],
        localFrame: frameAt(V(j.x, j.y, z), V(0, 1, 0), V(0, 0, 1)),
        meta: { role, phase: 3 },
      }),
    )
  }

  const { layout } = design
  return {
    meshes,
    features,
    skeleton,
    bounds: {
      min: V(-layout.half - thickness * 2, layout.sill - thickness, -depthEff * 0.7),
      max: V(layout.half + thickness * 2, layout.apex + thickness, depthEff * 0.45),
      center: V(0, layout.H * 0.5, -depthEff * 0.1),
    },
    meta: {
      phase: 3,
      profileThickness: thickness,
      architecturalDepth: depth,
      moldingComplexity: moldComplexity,
      moldingProfile: profileType,
      moldingDepth,
      bevelIntensity: bevel,
      detailResolution: res,
      meshCount: meshes.length,
    },
    dispose: () => {
      for (const g of geometries) g.dispose()
    },
  }
}

export function validateSolidMatchesDesign(design, solid) {
  const issues = []
  for (const c of design.curves) {
    const hit = solid.meshes.some((m) => m.id === c.id || m.id.startsWith(`${c.id}-mold-`))
    if (!hit) issues.push(`missing solid for ${c.id}`)
  }
  if (solid.skeleton?.length !== design.curves.length) {
    issues.push(`skeleton count ${solid.skeleton?.length} != curves ${design.curves.length}`)
  }
  if (solid.meshes.length === 0) issues.push('no meshes')
  return { ok: issues.length === 0, issues, curves: design.curves.length, skeleton: solid.skeleton?.length ?? 0 }
}
