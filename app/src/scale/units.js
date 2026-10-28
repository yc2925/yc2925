/**
 * Step 12A — Shared physical units.
 * Convention: 1 world unit = 1 meter.
 */

/** Meters per world unit (fixed). */
export const WORLD_UNIT_METERS = 1

/** @param {number} m */
export function meters(m) {
  return m / WORLD_UNIT_METERS
}

/** @param {number} cm */
export function centimeters(cm) {
  return meters(cm / 100)
}

/** @param {number} mm */
export function millimeters(mm) {
  return meters(mm / 1000)
}

/** World units → meters (identity under current convention). */
export function toMeters(world) {
  return world * WORLD_UNIT_METERS
}

/** World units → centimeters. */
export function toCentimeters(world) {
  return toMeters(world) * 100
}

/** World units → millimeters. */
export function toMillimeters(world) {
  return toMeters(world) * 1000
}

export function formatMeters(world, digits = 2) {
  return `${toMeters(world).toFixed(digits)} m`
}

export function formatMillimeters(world, digits = 0) {
  return `${toMillimeters(world).toFixed(digits)} mm`
}

export function formatCentimeters(world, digits = 1) {
  return `${toCentimeters(world).toFixed(digits)} cm`
}
