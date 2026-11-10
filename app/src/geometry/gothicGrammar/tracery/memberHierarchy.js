/**
 * Semantic stone member classes + proportional widths (Step 13D.2).
 *
 * Ratios are exploratory design defaults relative to parent span / frame width —
 * not surveyed historical dimensions (REF-011 / REF-007 / REF-012 hierarchy cues).
 */

export const MEMBER_CLASSES = Object.freeze({
  OUTER_FRAME: 'OUTER_FRAME',
  PRIMARY_MULLION: 'PRIMARY_MULLION',
  LANCET_ARCH: 'LANCET_ARCH',
  SECONDARY_TRACERY: 'SECONDARY_TRACERY',
  OCULUS_FRAME: 'OCULUS_FRAME',
  OCULUS_RING: 'OCULUS_RING',
  FOIL_BAR: 'FOIL_BAR',
})

/**
 * Default ratios for Rayonnant refined proportions.
 * Outer frame = fraction of parent clear span.
 * Other members = fraction of outer frame width.
 */
export const DEFAULT_PROPORTION_RATIOS = Object.freeze({
  outerFrameWidthRatio: 0.05,
  primaryMullionWidthRatio: 0.55,
  lancetArchWidthRatio: 0.55,
  secondaryTraceryWidthRatio: 0.4,
  oculusFrameWidthRatio: 0.42,
  foilBarWidthRatio: 0.28,
  /** Relative size of upper spandrel openings in available clearance pocket. */
  upperOpeningScale: 0.7,
  /** Step 13D.3 bar-network packing density. */
  upperSubdivisionDensity: 0.75,
})

/** Absolute Baseline 13D member widths (meters) — preserve prior composed defaults. */
export const BASELINE_MEMBER_WIDTHS = Object.freeze({
  outerFrameWidth: 0.12,
  primaryMullionWidth: 0.16,
  secondaryTraceryWidth: 0.08,
  oculusFrameWidth: 0.06,
  foilBarWidth: 0.045,
  jambInset: 0.08,
})

/**
 * Resolve absolute member widths from span + ratios.
 * Clamps to positive values and enforces hierarchy:
 *   outer ≥ primary ≥ secondary ≥ foil
 */
export function resolveMemberWidths(span, ratios = {}, minWeb = 0.04) {
  const r = { ...DEFAULT_PROPORTION_RATIOS, ...ratios }
  const S = Math.max(0.5, Number(span) || 3)
  let outer = Math.max(minWeb, r.outerFrameWidthRatio * S)
  let primary = Math.max(minWeb * 0.75, r.primaryMullionWidthRatio * outer)
  let secondary = Math.max(minWeb * 0.5, r.secondaryTraceryWidthRatio * outer)
  let oculus = Math.max(minWeb * 0.4, r.oculusFrameWidthRatio * outer)
  let foil = Math.max(minWeb * 0.35, r.foilBarWidthRatio * outer)

  // Enforce descending hierarchy without silent zeroing.
  if (primary > outer) primary = outer * 0.95
  if (secondary > primary) secondary = primary * 0.9
  if (oculus > primary) oculus = primary * 0.85
  if (foil > secondary) foil = secondary * 0.85

  const jambInset = Math.max(minWeb, (outer + secondary) * 0.5)

  return {
    ok: outer > 0 && primary > 0 && secondary > 0 && foil > 0,
    span: S,
    ratios: r,
    widths: {
      [MEMBER_CLASSES.OUTER_FRAME]: outer,
      [MEMBER_CLASSES.PRIMARY_MULLION]: primary,
      [MEMBER_CLASSES.SECONDARY_TRACERY]: secondary,
      [MEMBER_CLASSES.OCULUS_FRAME]: oculus,
      [MEMBER_CLASSES.FOIL_BAR]: foil,
      outerFrameWidth: outer,
      primaryMullionWidth: primary,
      secondaryTraceryWidth: secondary,
      oculusFrameWidth: oculus,
      foilBarWidth: foil,
      jambInset,
      mullionWidth: primary,
      minStoneWebWidth: Math.min(secondary, minWeb > 0 ? minWeb : secondary),
    },
  }
}

/**
 * Molding profile scale per member class (relative to base stone profile).
 * Heavier members get deeper/wider profiles — not a uniform scale-up.
 */
export const MEMBER_PROFILE_SCALES = Object.freeze({
  [MEMBER_CLASSES.OUTER_FRAME]: { width: 1.05, depth: 1.2, chamfer: 1.1, bead: 1.05, recess: 1.15 },
  [MEMBER_CLASSES.PRIMARY_MULLION]: { width: 0.9, depth: 1.0, chamfer: 1.0, bead: 1.0, recess: 1.0 },
  [MEMBER_CLASSES.LANCET_ARCH]: { width: 0.85, depth: 0.95, chamfer: 0.95, bead: 0.95, recess: 0.95 },
  [MEMBER_CLASSES.SECONDARY_TRACERY]: { width: 0.55, depth: 0.72, chamfer: 0.75, bead: 0.7, recess: 0.7 },
  [MEMBER_CLASSES.OCULUS_FRAME]: { width: 0.7, depth: 0.85, chamfer: 0.85, bead: 0.8, recess: 0.8 },
  [MEMBER_CLASSES.OCULUS_RING]: { width: 0.7, depth: 0.85, chamfer: 0.85, bead: 0.8, recess: 0.8 },
  [MEMBER_CLASSES.FOIL_BAR]: { width: 0.42, depth: 0.58, chamfer: 0.6, bead: 0.55, recess: 0.55 },
})

/** Map solid/void / sweep role → member class for profile hierarchy. */
export function memberClassForRole(role) {
  if (role === 'outer-frame' || role === 'OUTER_BOUNDARY') return MEMBER_CLASSES.OUTER_FRAME
  if (
    role === 'LEFT_LANCET_VOID' ||
    role === 'RIGHT_LANCET_VOID' ||
    role === 'LEFT_PRIMARY_LANCET' ||
    role === 'RIGHT_PRIMARY_LANCET'
  ) {
    return MEMBER_CLASSES.LANCET_ARCH
  }
  if (
    role === 'LEFT_OUTER_SECONDARY' ||
    role === 'LEFT_INNER_SECONDARY' ||
    role === 'RIGHT_INNER_SECONDARY' ||
    role === 'RIGHT_OUTER_SECONDARY' ||
    role === 'LEFT_PRIMARY_HEAD' ||
    role === 'RIGHT_PRIMARY_HEAD'
  ) {
    return MEMBER_CLASSES.SECONDARY_TRACERY
  }
  if (role === 'UPPER_FOIL_VOID' || role === 'UPPER_OCULUS_FOIL') return MEMBER_CLASSES.FOIL_BAR
  if (
    role === 'LEFT_SPANDREL_VOID' ||
    role === 'RIGHT_SPANDREL_VOID' ||
    role === 'LEFT_SIDE_CELL_VOID' ||
    role === 'RIGHT_SIDE_CELL_VOID' ||
    role === 'APEX_CELL_VOID' ||
    role === 'LEFT_SHOULDER_VOID' ||
    role === 'RIGHT_SHOULDER_VOID' ||
    role === 'LEFT_OUTER_SPANDREL' ||
    role === 'RIGHT_OUTER_SPANDREL' ||
    role === 'LEFT_TRANSITION' ||
    role === 'RIGHT_TRANSITION' ||
    role === 'APEX_SPANDREL' ||
    role === 'SECONDARY_TRACERY'
  ) {
    return MEMBER_CLASSES.SECONDARY_TRACERY
  }
  if (role === 'OCULUS_FRAME' || role === 'OCULUS_RING') return MEMBER_CLASSES.OCULUS_RING
  return MEMBER_CLASSES.PRIMARY_MULLION
}

export function scaleProfileParams(base, memberClass) {
  const s = MEMBER_PROFILE_SCALES[memberClass] ?? MEMBER_PROFILE_SCALES[MEMBER_CLASSES.PRIMARY_MULLION]
  return {
    ...base,
    profileWidth: base.profileWidth * s.width,
    profileDepth: base.profileDepth * s.depth,
    chamferSize: base.chamferSize * s.chamfer,
    beadRadius: base.beadRadius * s.bead,
    recessDepth: base.recessDepth * s.recess,
  }
}
