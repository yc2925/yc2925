import * as THREE from 'three'

/**
 * Reusable Gothic stone molding cross-sections.
 * Profile local space: x = bar half-width, y = wall half-depth (sweep binormal / normal).
 */

export const MOLDING_PROFILE_OPTIONS = [
  { id: 'chamfer', label: 'Plain Chamfer' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'ogee', label: 'Ogee' },
  { id: 'compound', label: 'Compound Gothic' },
]

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/** Role scale factors — hierarchy of mass. */
export const ROLE_SCALE = {
  frame: { w: 1.15, d: 1.2 },
  mullion: { w: 0.62, d: 0.85 },
  secondary: { w: 0.42, d: 0.55 },
  tertiary: { w: 0.3, d: 0.38 },
}

/** A. Plain chamfer — beveled rectangle. */
export function profileChamfer(w, d, bevel = 0.35) {
  const b = Math.min(w, d) * clamp(bevel, 0.05, 0.7)
  return [
    new THREE.Vector2(-w, -d + b),
    new THREE.Vector2(-w + b, -d),
    new THREE.Vector2(w - b, -d),
    new THREE.Vector2(w, -d + b),
    new THREE.Vector2(w, d - b),
    new THREE.Vector2(w - b, d),
    new THREE.Vector2(-w + b, d),
    new THREE.Vector2(-w, d - b),
  ]
}

/** B. Rounded molding — convex roll / torus section. */
export function profileRounded(w, d, bevel = 0.35) {
  const pts = []
  const n = 12
  const rx = w
  const ry = d * (0.85 + bevel * 0.15)
  for (let i = 0; i <= n; i += 1) {
    const a = (i / n) * Math.PI * 2
    pts.push(new THREE.Vector2(Math.cos(a) * rx, Math.sin(a) * ry))
  }
  return pts
}

/** C. Ogee — S-curve molding (cyma). */
export function profileOgee(w, d, bevel = 0.4) {
  const k = 0.35 + bevel * 0.35
  return [
    new THREE.Vector2(-w, -d * 0.15),
    new THREE.Vector2(-w * 0.75, -d * k),
    new THREE.Vector2(-w * 0.25, -d),
    new THREE.Vector2(w * 0.15, -d * 0.55),
    new THREE.Vector2(w * 0.55, -d * 0.1),
    new THREE.Vector2(w, d * 0.35),
    new THREE.Vector2(w * 0.55, d * 0.85),
    new THREE.Vector2(0, d),
    new THREE.Vector2(-w * 0.45, d * 0.7),
    new THREE.Vector2(-w * 0.85, d * 0.25),
    new THREE.Vector2(-w, -d * 0.15),
  ]
}

/**
 * D. Compound Gothic — layered fillet / scotia / roll.
 * bevel deepens the recessed channel between convex beads.
 */
export function profileCompound(w, d, bevel = 0.45) {
  const ch = d * (0.2 + bevel * 0.25) // channel depth
  return [
    new THREE.Vector2(-w, -d * 0.1),
    new THREE.Vector2(-w * 0.95, -d * 0.55),
    new THREE.Vector2(-w * 0.55, -d),
    new THREE.Vector2(-w * 0.2, -d * 0.55),
    new THREE.Vector2(0, -ch), // recessed channel
    new THREE.Vector2(w * 0.2, -d * 0.55),
    new THREE.Vector2(w * 0.55, -d),
    new THREE.Vector2(w * 0.95, -d * 0.55),
    new THREE.Vector2(w, -d * 0.1),
    new THREE.Vector2(w * 0.9, d * 0.45),
    new THREE.Vector2(w * 0.4, d * 0.95),
    new THREE.Vector2(0, d),
    new THREE.Vector2(-w * 0.4, d * 0.95),
    new THREE.Vector2(-w * 0.9, d * 0.45),
  ]
}

/**
 * Build a closed profile for a structural role.
 * @param {'chamfer'|'rounded'|'ogee'|'compound'} type
 * @param {'frame'|'mullion'|'secondary'|'tertiary'} role
 */
export function buildRoleProfile(type, role, thickness, depth, bevelIntensity = 0.45) {
  const scale = ROLE_SCALE[role] ?? ROLE_SCALE.secondary
  const w = thickness * scale.w
  const d = depth * scale.d * 0.5
  const bevel = clamp(bevelIntensity, 0, 1)

  // Tertiary stays delicate — prefer rounded/chamfer even if compound selected.
  let kind = type
  if (role === 'tertiary' && (type === 'compound' || type === 'ogee')) kind = 'rounded'
  if (role === 'secondary' && type === 'compound') kind = 'ogee'

  if (kind === 'rounded') return profileRounded(w, d, bevel)
  if (kind === 'ogee') return profileOgee(w, d, bevel)
  if (kind === 'compound') return profileCompound(w, d, bevel)
  return profileChamfer(w, d, bevel)
}

/** Extra outer frame molding layers (same centerline, scaled). */
export function buildFrameLayerProfile(type, thickness, depth, bevel, layerIndex) {
  const shrink = 1 - layerIndex * 0.14
  const roleScale = layerIndex === 0 ? 1.15 : layerIndex === 1 ? 0.95 : 0.72
  const w = thickness * roleScale * shrink
  const d = depth * 0.55 * shrink
  if (layerIndex === 0) return buildRoleProfile(type, 'frame', thickness * shrink, depth, bevel)
  if (layerIndex === 1) return profileOgee(w, d, bevel)
  return profileRounded(w * 0.85, d * 0.75, bevel)
}
