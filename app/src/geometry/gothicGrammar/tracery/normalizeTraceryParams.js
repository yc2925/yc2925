/**
 * Bridge parallel / legacy UI keys onto the generators that actually consume them
 * (Step 13E.3.1). Does not invent geometry — only aliases and clearance floors.
 *
 * Parallel pairs:
 *   outerFrameWidth  ↔ masterFrameWidth   (skeleton / hierarchical)
 *   oculusHeightRatio ↔ oculusVerticalPosition
 *   foilType / trefoilHeads              (composed vs hierarchical bay heads)
 *   minStoneWebWidth → clearance floors  (constraint, not continuous reshape)
 */

import { FOIL_TYPES } from './roles.js'

/**
 * @param {object} input
 * @returns {object} normalized params (shallow copy + bridged fields)
 */
export function normalizeTraceryParams(input = {}) {
  const p = { ...input }

  // --- Frame thickness: one world-space outer stone width ---
  // Canonical UI control is Outer frame width; Master frame width is the
  // skeleton alias. Panel onChange keeps them equal; if they disagree
  // (legacy state), prefer outerFrameWidth.
  const frame = Math.max(
    0.04,
    p.outerFrameWidth != null
      ? p.outerFrameWidth
      : (p.masterFrameWidth ?? 0.12),
  )
  p.masterFrameWidth = frame
  p.outerFrameWidth = frame

  // --- Oculus vertical placement ---
  // Skeleton path reads oculusVerticalPosition; composed path reads oculusHeightRatio.
  if (p.oculusVerticalPosition == null && p.oculusHeightRatio != null) {
    p.oculusVerticalPosition = p.oculusHeightRatio
  }
  if (p.oculusHeightRatio == null && p.oculusVerticalPosition != null) {
    p.oculusHeightRatio = p.oculusVerticalPosition
  }

  // --- Foil / trefoil bay heads ---
  // Hierarchical uses trefoilHeads; composed oculus uses foilType.
  if (p.trefoilHeads == null && p.foilType != null) {
    p.trefoilHeads = p.foilType === FOIL_TYPES.trefoil
  }
  if (p.foilType == null && p.trefoilHeads != null) {
    p.foilType = p.trefoilHeads !== false ? FOIL_TYPES.trefoil : FOIL_TYPES.quatrefoil
  }
  // Keep oculus subdivision select coherent when user picks trefoil foil type
  // on a skeleton path that only implements quatrefoil oculus interiors.
  if (
    p.enableHierarchicalTracery === true ||
    p.enableSecondaryTracery === true ||
    p.enableOculusNetwork === true
  ) {
    if (p.foilType === FOIL_TYPES.trefoil && p.trefoilHeads === false) {
      p.trefoilHeads = true
    }
  }

  // --- Clearance floor: min stone web is a constraint threshold ---
  const webFloor = Math.max(
    0,
    Number(p.minStoneWebWidth) || 0,
    Number(p.minWebClearance) || 0,
  )
  if (webFloor > 0) {
    p.minWebClearance = Math.max(Number(p.minWebClearance) || 0, webFloor)
    p.minOpeningClearance = Math.max(Number(p.minOpeningClearance) || 0, webFloor)
  }

  p._paramBridge = {
    frameWidth: p.masterFrameWidth,
    oculusVertical: p.oculusVerticalPosition ?? p.oculusHeightRatio ?? null,
    trefoilHeads: p.trefoilHeads !== false,
    foilType: p.foilType ?? null,
    clearanceFloor: Math.max(
      Number(p.minOpeningClearance) || 0,
      Number(p.minWebClearance) || 0,
      Number(p.minStoneWebWidth) || 0,
    ),
  }

  return p
}

/**
 * Human-readable constraint note for UI when a threshold param is inactive.
 */
export function describeClearanceConstraint(params, metrics = {}) {
  const floor =
    params?._paramBridge?.clearanceFloor ??
    Math.max(
      Number(params?.minStoneWebWidth) || 0,
      Number(params?.minWebClearance) || 0,
      Number(params?.minOpeningClearance) || 0,
    )
  const measured =
    metrics.minStoneWeb ??
    metrics.minimumWebWidth ??
    metrics.minWeb ??
    null
  const rejected = metrics.rejectedSubdivisions ?? metrics.rejected ?? null
  if (measured == null) {
    return {
      active: false,
      floor,
      measured: null,
      message: `Min stone web floor ${floor.toFixed(3)} m — measured web unavailable for this path`,
    }
  }
  const active = measured + 1e-9 < floor
  return {
    active,
    floor,
    measured,
    rejected,
    message: active
      ? `Constraint ACTIVE: measured web ${measured.toFixed(3)} m < floor ${floor.toFixed(3)} m${
          rejected != null ? ` · rejected ${rejected}` : ''
        }`
      : `Constraint inactive: measured web ${measured.toFixed(3)} m ≥ floor ${floor.toFixed(3)} m`,
  }
}
