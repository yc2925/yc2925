/**
 * Simple axis-aligned box solid for pier / base-course placeholders (Step 13E.1).
 * Shared-vertex topology so validateMesh sees a closed manifold.
 */

import { createMeshData } from '../solids/meshValidation.js'

/**
 * Box centered at (cx, cy, cz) with size (sx, sy, sz).
 * Front face is +Z; elevation lies in XY (Grammar convention).
 */
export function buildBoxMesh({
  cx = 0,
  cy = 0,
  cz = 0,
  sx = 1,
  sy = 1,
  sz = 1,
  id = 'box',
} = {}) {
  const hx = sx * 0.5
  const hy = sy * 0.5
  const hz = sz * 0.5
  const positions = [
    cx - hx, cy - hy, cz - hz, // 0
    cx + hx, cy - hy, cz - hz, // 1
    cx + hx, cy + hy, cz - hz, // 2
    cx - hx, cy + hy, cz - hz, // 3
    cx - hx, cy - hy, cz + hz, // 4
    cx + hx, cy - hy, cz + hz, // 5
    cx + hx, cy + hy, cz + hz, // 6
    cx - hx, cy + hy, cz + hz, // 7
  ]
  // CCW outward when viewed from outside
  const indices = [
    // -Z
    0, 3, 2, 0, 2, 1,
    // +Z
    4, 5, 6, 4, 6, 7,
    // -Y
    0, 1, 5, 0, 5, 4,
    // +Y
    3, 7, 6, 3, 6, 2,
    // -X
    0, 4, 7, 0, 7, 3,
    // +X
    1, 2, 6, 1, 6, 5,
  ]
  const mesh = createMeshData(positions, indices, {
    id,
    kind: 'box-solid',
    volume: sx * sy * sz,
  })
  // Hard-edge display normals optional — StoneMeshes will compute if missing
  return {
    ok: true,
    mesh,
    volume: sx * sy * sz,
    boundingMin: [cx - hx, cy - hy, cz - hz],
    boundingMax: [cx + hx, cy + hy, cz + hz],
    boundingSize: [sx, sy, sz],
  }
}
