/**
 * Pointed-arch family definitions (Step 13B).
 *
 * Computational design domain — not a universal historical taxonomy.
 * Equilateral rise is geometrically locked; lancet / depressed vary h/S.
 */

/** Equilateral two-centered: centers at opposite springings → h = (√3/2)·S */
export const EQUILATERAL_RISE_RATIO = Math.sqrt(3) / 2

export const ARCH_FAMILIES = Object.freeze({
  equilateral: 'equilateral',
  lancet: 'lancet',
  depressed: 'depressed',
})

/** Semantic identifiers for future tracery / stone / assembly modules. */
export const ARCH_SEMANTICS = Object.freeze({
  LEFT_SPRINGING: 'LEFT_SPRINGING',
  RIGHT_SPRINGING: 'RIGHT_SPRINGING',
  APEX: 'APEX',
  LEFT_ARC: 'LEFT_ARC',
  RIGHT_ARC: 'RIGHT_ARC',
  LEFT_ARC_CENTER: 'LEFT_ARC_CENTER',
  RIGHT_ARC_CENTER: 'RIGHT_ARC_CENTER',
  SYMMETRY_AXIS: 'SYMMETRY_AXIS',
})

export const ARCH_FAMILY_META = Object.freeze({
  [ARCH_FAMILIES.equilateral]: {
    id: ARCH_FAMILIES.equilateral,
    label: 'Equilateral',
    riseLocked: true,
    defaultRiseRatio: EQUILATERAL_RISE_RATIO,
    // Not editable when family is equilateral
    minRiseRatio: EQUILATERAL_RISE_RATIO,
    maxRiseRatio: EQUILATERAL_RISE_RATIO,
  },
  [ARCH_FAMILIES.lancet]: {
    id: ARCH_FAMILIES.lancet,
    label: 'Lancet',
    riseLocked: false,
    defaultRiseRatio: 1.05,
    // Strictly taller than equilateral
    minRiseRatio: EQUILATERAL_RISE_RATIO + 1e-6,
    maxRiseRatio: 1.6,
  },
  [ARCH_FAMILIES.depressed]: {
    id: ARCH_FAMILIES.depressed,
    label: 'Depressed',
    riseLocked: false,
    defaultRiseRatio: 0.55,
    // Practical design domain from brief (not Tudor four-centered)
    minRiseRatio: 0.35,
    maxRiseRatio: EQUILATERAL_RISE_RATIO - 1e-6,
  },
})

export const DEFAULT_ARCH_PARAMS = Object.freeze({
  family: ARCH_FAMILIES.equilateral,
  span: 3.0,
  riseRatio: EQUILATERAL_RISE_RATIO,
  springingY: 0.0,
  samplingQuality: 0.65,
})

/**
 * Resolve rise (meters) from family + optional riseRatio.
 * Equilateral ignores caller riseRatio and locks h = (√3/2)·S.
 */
export function resolveRise(family, span, riseRatio) {
  if (!(span > 0) || !Number.isFinite(span)) {
    throw new Error('resolveRise: span must be positive and finite')
  }
  const meta = ARCH_FAMILY_META[family]
  if (!meta) throw new Error(`resolveRise: unknown family ${family}`)

  if (meta.riseLocked) {
    return { rise: EQUILATERAL_RISE_RATIO * span, riseRatio: EQUILATERAL_RISE_RATIO, locked: true }
  }

  const ratio = Number.isFinite(riseRatio) ? riseRatio : meta.defaultRiseRatio
  if (ratio <= 0) throw new Error('resolveRise: rise ratio must be positive')
  if (ratio < meta.minRiseRatio || ratio > meta.maxRiseRatio) {
    throw new Error(
      `resolveRise: rise ratio ${ratio} outside ${family} range [${meta.minRiseRatio}, ${meta.maxRiseRatio}]`,
    )
  }
  return { rise: ratio * span, riseRatio: ratio, locked: false }
}
