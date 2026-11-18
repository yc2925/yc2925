/**
 * Freehand stroke → editable spline control points (Step 47, feedback round 1).
 * Ramer–Douglas–Peucker simplification; the tolerance grows until the
 * result has at most MAX_FIT_POINTS points, so long strokes stay editable.
 */

import * as THREE from 'three'

export const MAX_FIT_POINTS = 24

/** Ramer–Douglas–Peucker on 3D points. */
export function rdp(points, eps) {
  if (points.length < 3) return points.slice()
  const a = points[0]
  const b = points[points.length - 1]
  const ab = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
  const l2 = ab.lengthSq() || 1e-9
  let maxD = -1
  let idx = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y + (p.z - a.z) * ab.z) / l2))
    const d = Math.hypot(p.x - (a.x + ab.x * t), p.y - (a.y + ab.y * t), p.z - (a.z + ab.z * t))
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= eps) return [a, b]
  return [...rdp(points.slice(0, idx + 1), eps).slice(0, -1), ...rdp(points.slice(idx), eps)]
}

export function fitStroke(stroke, minEps) {
  let eps = minEps
  let pts = rdp(stroke, eps)
  while (pts.length > MAX_FIT_POINTS) {
    eps *= 1.4
    pts = rdp(stroke, eps)
  }
  if (pts.length === 2) {
    // Keep a mid point so the result is a bendable spline.
    const m = stroke[Math.floor(stroke.length / 2)]
    pts = [pts[0], m, pts[1]]
  }
  return pts
}

