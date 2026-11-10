/**
 * Shared constraints / zone helpers for Rayonnant Elaborate (Step 13D.4).
 */

import { archHeightAtX, pointInsideArchOpening, circleInsideArch } from '../archContainment.js'

export const ELABORATE_ZONES = Object.freeze({
  LOWER_LANCET_FIELD: 'ZONE_A_LOWER_LANCET_FIELD',
  UPPER_TRACERY_FIELD: 'ZONE_B_UPPER_TRACERY_FIELD',
  TRANSITION_FIELD: 'ZONE_C_TRANSITION_FIELD',
  OUTER_SPANDRELS: 'ZONE_D_OUTER_SPANDRELS',
})

export function archHalfWidthAtY(arch, y) {
  const a = arch.derived?.halfSpan ?? arch.parameters.span / 2
  const ox = arch.parameters.offsetX ?? 0
  const y0 = arch.parameters.springingY
  if (!(y > y0)) return 0
  let lo = 0
  let hi = a
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2
    const yh = archHeightAtX(arch, ox + mid)
    if (yh == null || yh < y) hi = mid
    else lo = mid
  }
  return lo
}

export function circleClearOfSamples(circle, samples, minGap) {
  for (const q of samples) {
    const d = Math.hypot(q.x - circle.center.x, q.y - circle.center.y)
    if (d < circle.radius + minGap - 1e-9) return false
  }
  return true
}

export function circleClearOfCircle(a, b, minGap) {
  const d = Math.hypot(a.center.x - b.center.x, a.center.y - b.center.y)
  return d >= a.radius + b.radius + minGap - 1e-9
}

export function validateCircleInArch(circle, parent, web, samplesLists = []) {
  const inside = circleInsideArch(parent, circle, web * 0.3)
  if (!inside.ok) return { ok: false, reason: 'escapes parent arch' }
  for (const samples of samplesLists) {
    if (samples?.length && !circleClearOfSamples(circle, samples, web * 0.4)) {
      return { ok: false, reason: 'intersects protected samples' }
    }
  }
  const { center, radius } = circle
  for (let i = 0; i < 16; i += 1) {
    const a = (i / 16) * Math.PI * 2
    const p = {
      x: center.x + Math.cos(a) * radius,
      y: center.y + Math.sin(a) * radius,
    }
    if (!pointInsideArchOpening(parent, p, web * 0.15)) {
      return { ok: false, reason: 'boundary outside parent opening' }
    }
  }
  return { ok: true }
}

/**
 * Opening/envelope porosity metrics from areas.
 */
export function porosityMetrics({ outerArea, openingArea, openingCount, solidArea }) {
  const envelope = outerArea > 0 ? outerArea : 0
  const openingRatio = envelope > 0 ? openingArea / envelope : 0
  return {
    outerArea: envelope,
    openingArea,
    solidArea: solidArea ?? Math.max(0, envelope - openingArea),
    openingCount,
    openingToEnvelopeRatio: openingRatio,
  }
}
