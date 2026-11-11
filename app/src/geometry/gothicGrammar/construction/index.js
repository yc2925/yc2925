/**
 * Construction display helpers for the Gothic Grammar scene (Steps 13A–13B).
 */

export const CONSTRUCTION_STATUS = 'ready'

/** Default construction plane extents in world units (meters when scale is unified). */
export const DEFAULT_CONSTRUCTION_EXTENT = 4

export const DEFAULT_GRID = {
  size: 8,
  divisions: 16,
  centerColor: '#3a3a3a',
  gridColor: '#1e1e1e',
}

export {
  buildArchConstruction,
  buildArchComparison,
  archToConstruction,
  archFramingBounds,
} from './archConstruction.js'

export {
  extractArchConstructionGeometry,
  extractTraceryConstructionGeometry,
  extractConstructionGeometryFromResult,
} from './constructionGeometry.js'
