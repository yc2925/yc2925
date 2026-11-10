/**
 * Gothic Grammar mathematical geometry kernel — Step 13A.1
 *
 * Pure JavaScript. No React / Three.js / legacy gothic imports.
 * Coordinate system: X horizontal, Y vertical. 1 wu = 1 m.
 *
 * References informing requirements: REF-006, REF-008, REF-011
 * (circle/foil construction plates + geometric bar-tracery).
 */

export const KERNEL_STATUS = 'ready'
export const KERNEL_VERSION = '13A.1'

export * from './tolerances.js'
export * from './validation.js'
export * from './vector2.js'
export * from './line2.js'
export * from './circle2.js'
export * from './arc2.js'
export * from './intersections.js'
export * from './tangency.js'
export * from './offsets.js'
export * from './transforms.js'
export * from './planarRegions.js'
export * from './sampling.js'
export * from './result.js'

import { createConstructionResult } from './result.js'

/** Empty document shell for the Grammar tab. */
export function createEmptyKernelDocument() {
  return {
    version: KERNEL_VERSION,
    status: KERNEL_STATUS,
    points: [],
    lines: [],
    circles: [],
    arcs: [],
    constraints: [],
    regions: [],
    meta: {
      references: ['REF-011', 'REF-006', 'REF-008'],
      family: 'rayonnant-geometric',
      note: 'Kernel ready — constructions via examples',
    },
  }
}

export { createConstructionResult }
