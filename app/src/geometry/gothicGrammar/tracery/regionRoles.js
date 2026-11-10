/**
 * Semantic 2D architectural region roles (Step 13C.1 / 13D.2).
 * Solid / void vocabulary for SECTION display and stone extrusion.
 */

export const REGION_TYPES = Object.freeze({
  OUTER_BOUNDARY: 'OUTER_BOUNDARY',
  LEFT_LANCET_VOID: 'LEFT_LANCET_VOID',
  RIGHT_LANCET_VOID: 'RIGHT_LANCET_VOID',
  UPPER_FOIL_VOID: 'UPPER_FOIL_VOID',
  /** Step 13D.2 — symmetric secondary openings flanking the oculus. */
  LEFT_SPANDREL_VOID: 'LEFT_SPANDREL_VOID',
  RIGHT_SPANDREL_VOID: 'RIGHT_SPANDREL_VOID',
  /** Step 13D.3 — bar-network upper cells (connected negative space). */
  LEFT_SIDE_CELL_VOID: 'LEFT_SIDE_CELL_VOID',
  RIGHT_SIDE_CELL_VOID: 'RIGHT_SIDE_CELL_VOID',
  APEX_CELL_VOID: 'APEX_CELL_VOID',
  LEFT_SHOULDER_VOID: 'LEFT_SHOULDER_VOID',
  RIGHT_SHOULDER_VOID: 'RIGHT_SHOULDER_VOID',
  STONE_REGION: 'STONE_REGION',
  CENTRAL_MULLION: 'CENTRAL_MULLION',
  TRACERY_WEB: 'TRACERY_WEB',
})

/** Ordered hole keys for extrusion / molding sweeps. */
export function structuralHoleKeys(options = {}) {
  const includeSpandrels = typeof options === 'boolean' ? options : Boolean(options.includeSpandrels)
  const includeBarNetwork = typeof options === 'boolean' ? false : Boolean(options.includeBarNetwork)
  const extraKeys = typeof options === 'object' && options !== null ? options.extraKeys : null

  const keys = [
    REGION_TYPES.LEFT_LANCET_VOID,
    REGION_TYPES.RIGHT_LANCET_VOID,
    REGION_TYPES.UPPER_FOIL_VOID,
  ]
  if (includeSpandrels) {
    keys.push(REGION_TYPES.LEFT_SPANDREL_VOID, REGION_TYPES.RIGHT_SPANDREL_VOID)
  }
  if (includeBarNetwork) {
    keys.push(
      REGION_TYPES.LEFT_SIDE_CELL_VOID,
      REGION_TYPES.RIGHT_SIDE_CELL_VOID,
      REGION_TYPES.APEX_CELL_VOID,
      REGION_TYPES.LEFT_SHOULDER_VOID,
      REGION_TYPES.RIGHT_SHOULDER_VOID,
    )
  }
  if (Array.isArray(extraKeys)) {
    for (const k of extraKeys) {
      if (k && !keys.includes(k)) keys.push(k)
    }
  }
  return keys
}

export const DEFAULT_REGION_PARAMS = Object.freeze({
  /** Outward thickness of outer stone frame beyond parent clear span (m). */
  outerFrameWidth: 0.12,
  /** Absolute Y of window sill / base closure (m). */
  windowBaseElevation: -0.35,
  /** Minimum stone web / jamb / mullion clearance (m). Warning if violated. */
  minStoneWebWidth: 0.08,
  /** Step 13D.2 — enable upper spandrel secondary openings. */
  enableSpandrelOpenings: false,
  /** Fraction of available spandrel pocket used for opening radius. */
  upperOpeningScale: 0.7,
  /** Secondary tracery / spandrel web width (m). */
  secondaryTraceryWidth: 0.08,
  /** Step 13D.3 — derive stone from bar-network graph. */
  enableBarNetwork: false,
  /** Upper subdivision packing density 0..1. */
  upperSubdivisionDensity: 0.75,
  /** Minimum clearance between bar webs (m). */
  minWebClearance: 0.04,
})
