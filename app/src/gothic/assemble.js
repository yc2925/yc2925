/**
 * Shared assembly helpers — transform / absorb specimens into a parent builder.
 * Ensures meshes, features, and skeleton centerlines share one world frame
 * (needed when Portal / Facade embed Window or Portal assemblies).
 */

import * as THREE from 'three'
import { V, frameAt, makeFeature } from './primitives.js'

/**
 * Build a TRS matrix. Scale may be a number or [sx, sy, sz].
 */
export function makeTransform({
  position = [0, 0, 0],
  scale = 1,
  rotationY = 0,
} = {}) {
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY)
  const s = Array.isArray(scale)
    ? new THREE.Vector3(scale[0], scale[1], scale[2])
    : new THREE.Vector3(scale, scale, scale)
  m.compose(new THREE.Vector3(position[0], position[1], position[2]), q, s)
  return m
}

function transformPoint(p, matrix) {
  return p.clone().applyMatrix4(matrix)
}

function transformFeature(feature, matrix, idPrefix, markEmbedded) {
  const points = feature.points ? feature.points.map((p) => transformPoint(p, matrix)) : null
  let localFrame = null
  if (feature.localFrame?.origin) {
    const origin = transformPoint(feature.localFrame.origin, matrix)
    // Re-derive a stable frame at the transformed origin.
    const up = feature.localFrame.v?.clone() ?? V(0, 1, 0)
    const hint = feature.localFrame.n?.clone() ?? V(0, 0, 1)
    up.applyMatrix4(new THREE.Matrix4().extractRotation(matrix))
    hint.applyMatrix4(new THREE.Matrix4().extractRotation(matrix))
    localFrame = frameAt(origin, up.lengthSq() > 1e-8 ? up : V(0, 1, 0), hint)
  }
  let bounds = null
  if (feature.bounds?.min && feature.bounds?.max) {
    bounds = {
      min: transformPoint(feature.bounds.min, matrix),
      max: transformPoint(feature.bounds.max, matrix),
    }
  }
  return makeFeature({
    id: `${idPrefix}-${feature.id}`,
    type: feature.type,
    label: feature.label,
    points,
    curve: null, // curves are local; prefer transformed points for growth
    localFrame,
    bounds,
    meta: {
      ...(feature.meta ?? {}),
      sourceId: feature.id,
      assembly: idPrefix,
      ...(markEmbedded ? { embedded: true } : {}),
    },
  })
}

/**
 * Clone meshes/features/skeleton from a child specimen into a parent builder,
 * applying a world transform. Disposes the child afterward (geometries cloned).
 *
 * @returns {{ skeleton: array }} transformed skeleton edges
 */
export function absorbSpecimen(builder, specimen, { idPrefix, matrix }, options = {}) {
  const skeletonOut = options.skeletonOut ?? []
  const markEmbedded = options.markEmbedded === true

  for (const m of specimen.meshes ?? []) {
    const g = m.geometry.clone()
    g.applyMatrix4(matrix)
    g.computeVertexNormals()
    builder.addMesh(`${idPrefix}-${m.id}`, m.type, g)
  }

  for (const f of specimen.features ?? []) {
    builder.addFeature(transformFeature(f, matrix, idPrefix, markEmbedded))
  }

  const childSkeleton = specimen.meta?.skeleton ?? specimen.skeleton ?? []
  for (const edge of childSkeleton) {
    skeletonOut.push({
      id: `${idPrefix}-${edge.id}`,
      role: edge.role,
      layer: edge.layer,
      color: edge.color,
      points: (edge.points ?? []).map((p) => transformPoint(p, matrix)),
    })
  }

  specimen.dispose?.()
  return { skeleton: skeletonOut }
}

/** Fit a source width/height into a target box; returns uniform scale + placement Y offset from sill. */
export function fitScale(srcW, srcH, targetW, targetH, margin = 0.92) {
  const sx = (targetW * margin) / Math.max(1e-4, srcW)
  const sy = (targetH * margin) / Math.max(1e-4, srcH)
  return Math.min(sx, sy)
}
