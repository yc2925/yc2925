/**
 * Step 12B — Screen-space projected size + hysteretic LOD selection.
 * Works for perspective and orthographic cameras.
 */

import * as THREE from 'three'
import {
  LOD_HYSTERESIS,
  LOD_SCREEN_THRESHOLDS,
  DEFAULT_LOD_BIAS,
  normalizeLodLevel,
} from './config.js'

const _box = new THREE.Box3()
const _sphere = new THREE.Sphere()
const _center = new THREE.Vector3()
const _size = new THREE.Vector3()
const _ndc = new THREE.Vector3()
const _proj = new THREE.Vector3()

/**
 * Axis-aligned bounds → { min, max } in world space.
 */
export function envelopeFromBounds(bounds) {
  if (!bounds) {
    return { min: new THREE.Vector3(-1.5, 0, -0.2), max: new THREE.Vector3(1.5, 5.7, 0.2) }
  }
  if (bounds.min && bounds.max) {
    const min = bounds.min.isVector3
      ? bounds.min.clone()
      : new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z ?? 0)
    const max = bounds.max.isVector3
      ? bounds.max.clone()
      : new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z ?? 0)
    return { min, max }
  }
  // Window design layout: W, H, half, sill, apex
  if (bounds.W != null && (bounds.H != null || bounds.apex != null)) {
    const half = bounds.half ?? bounds.W * 0.5
    const y0 = bounds.sill ?? 0
    const y1 = bounds.apex ?? bounds.H ?? 5.7
    return {
      min: new THREE.Vector3(-half, y0, -0.2),
      max: new THREE.Vector3(half, y1, 0.2),
    }
  }
  // arch.bounds style: x0,x1,y0,y1
  const x0 = bounds.x0 ?? -1.5
  const x1 = bounds.x1 ?? 1.5
  const y0 = bounds.y0 ?? 0
  const y1 = bounds.y1 ?? 5.7
  const z0 = bounds.z0 ?? -0.2
  const z1 = bounds.z1 ?? 0.2
  return {
    min: new THREE.Vector3(x0, y0, z0),
    max: new THREE.Vector3(x1, y1, z1),
  }
}

/**
 * Project object bounds to approximate screen-space height fraction (0–1+).
 * Uses vertical extent of the bounding sphere projected through the camera.
 */
export function measureProjectedSize(camera, envelope, viewportHeightPx = 800) {
  const { min, max } = envelope.min ? envelope : envelopeFromBounds(envelope)
  _box.set(min, max)
  _box.getBoundingSphere(_sphere)
  _box.getCenter(_center)
  _box.getSize(_size)

  const radius = Math.max(_sphere.radius, 1e-4)
  const dist = camera.position.distanceTo(_center)

  let projectedFrac
  if (camera.isOrthographicCamera) {
    const orthoH = Math.abs((camera.top ?? 1) - (camera.bottom ?? -1)) / Math.max(1e-6, camera.zoom || 1)
    projectedFrac = (radius * 2) / Math.max(1e-6, orthoH)
  } else {
    // Perspective: angular size → NDC height ≈ 2 * r / (d * tan(fov/2)) / 2 in clip = r/(d*tan)
    const fov = THREE.MathUtils.degToRad(camera.fov ?? 50)
    const worldHAtDist = 2 * Math.tan(fov * 0.5) * Math.max(dist, 1e-4)
    projectedFrac = (radius * 2) / Math.max(1e-6, worldHAtDist)
  }

  // Refine with top/bottom of AABB in NDC when possible
  _proj.set(_center.x, max.y, _center.z).project(camera)
  const topNdc = _proj.y
  _proj.set(_center.x, min.y, _center.z).project(camera)
  const botNdc = _proj.y
  if (Number.isFinite(topNdc) && Number.isFinite(botNdc)) {
    const ndcH = Math.abs(topNdc - botNdc) * 0.5 // NDC y span / 2 → fraction of half-height… use /2 for full
    const fracFromNdc = Math.abs(topNdc - botNdc) / 2
    if (fracFromNdc > 0.01) projectedFrac = Math.max(projectedFrac * 0.35, fracFromNdc)
  }

  return {
    projectedFrac: Math.max(0, projectedFrac),
    cameraDistance: dist,
    radius,
    center: _center.clone(),
    size: _size.clone(),
    viewportHeightPx,
  }
}

/**
 * Map projected fraction → LOD, applying bias to thresholds.
 * Bias > 0 raises detail (lower thresholds).
 */
export function thresholdsWithBias(bias = DEFAULT_LOD_BIAS) {
  const b = Math.max(-1, Math.min(1, bias ?? 0))
  // Shift thresholds down when preferring detail
  const shift = b * 0.12
  return {
    highMin: Math.max(0.08, LOD_SCREEN_THRESHOLDS.highMin - shift),
    mediumMin: Math.max(0.04, LOD_SCREEN_THRESHOLDS.mediumMin - shift),
  }
}

export function lodFromProjectedFrac(projectedFrac, bias = 0) {
  const t = thresholdsWithBias(bias)
  if (projectedFrac >= t.highMin) return 'high'
  if (projectedFrac >= t.mediumMin) return 'medium'
  return 'low'
}

/**
 * Hysteretic LOD update — keep current until past threshold ± hysteresis.
 */
export function selectLodWithHysteresis(projectedFrac, currentLevel, opts = {}) {
  const bias = opts.bias ?? 0
  const hyst = opts.hysteresis ?? LOD_HYSTERESIS
  const mode = opts.mode ?? 'auto'
  if (mode && mode !== 'auto') return normalizeLodLevel(mode)

  const desired = lodFromProjectedFrac(projectedFrac, bias)
  const cur = normalizeLodLevel(currentLevel ?? desired)
  if (desired === cur) return cur

  const t = thresholdsWithBias(bias)
  // Crossing high↔medium around highMin; medium↔low around mediumMin
  if (cur === 'high' && desired === 'medium') {
    return projectedFrac < t.highMin - hyst ? 'medium' : 'high'
  }
  if (cur === 'medium' && desired === 'high') {
    return projectedFrac > t.highMin + hyst ? 'high' : 'medium'
  }
  if (cur === 'medium' && desired === 'low') {
    return projectedFrac < t.mediumMin - hyst ? 'low' : 'medium'
  }
  if (cur === 'low' && desired === 'medium') {
    return projectedFrac > t.mediumMin + hyst ? 'medium' : 'low'
  }
  // Skip level (high↔low): require clear crossing
  if (cur === 'high' && desired === 'low') {
    return projectedFrac < t.mediumMin - hyst ? 'low' : 'high'
  }
  if (cur === 'low' && desired === 'high') {
    return projectedFrac > t.highMin + hyst ? 'high' : 'low'
  }
  return desired
}

/**
 * One-shot evaluation helper for controllers.
 */
export function evaluateLod(camera, bounds, state, opts = {}) {
  const envelope = envelopeFromBounds(bounds)
  const measure = measureProjectedSize(camera, envelope, opts.viewportHeightPx)
  const level = selectLodWithHysteresis(measure.projectedFrac, state?.level, {
    bias: opts.bias ?? 0,
    hysteresis: opts.hysteresis ?? LOD_HYSTERESIS,
    mode: opts.mode ?? 'auto',
  })
  return {
    level,
    ...measure,
    thresholds: thresholdsWithBias(opts.bias ?? 0),
    hysteresis: opts.hysteresis ?? LOD_HYSTERESIS,
  }
}

export { _ndc }
