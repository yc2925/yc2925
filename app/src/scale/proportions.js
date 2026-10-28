/**
 * Step 12A — Proportional constraints between architecture and ornament.
 * Absolute sizes come from settings; ratios clamp disproportion when scale changes.
 */

import { ORNAMENT_PHYSICAL, PROPORTION_RATIOS } from './config.js'
import { millimeters } from './units.js'

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Resolve ornament thicknesses / relief from settings + architectural support sizes.
 * Does not change procedural complexity (branch count, density).
 */
export function resolveOrnamentPhysical(params = {}, archSupport = {}) {
  const ratios = PROPORTION_RATIOS
  const ranges = ORNAMENT_PHYSICAL

  const mullionT = Math.max(millimeters(20), archSupport.profileThickness ?? millimeters(55))
  const archDepth = Math.max(millimeters(40), archSupport.architecturalDepth ?? millimeters(140))
  const archHeight = Math.max(metersSafe(archSupport.height), metersSafe(5.7))
  const scale = Math.max(0.05, params.architecturalScale ?? 1)

  // Raw settings (already in world units / meters)
  let primary = params.ornamentThickness ?? params.primaryThickness ?? ranges.primaryThickness.default
  let secondary =
    params.secondaryThickness ?? primary * (params.branchThicknessDecay ?? 0.68)
  let relief = params.reliefDepth ?? params.constructionReliefDepth ?? ranges.reliefDepth.default
  let embed = params.rootEmbedding ?? ranges.rootEmbedding.default
  let projection = params.reliefProjection ?? relief * 1.1
  const emergence = clamp(params.sculpturalEmergence ?? params.constructionEmergence ?? 0.52, 0, 1)

  // Foliate detail: UI knob 0–1 → physical size in range, then ratio-capped
  const foliateKnob = clamp(params.foliateDetail ?? 0.35, 0, 1)
  let foliate = lerp(ranges.foliateDetail.min, ranges.foliateDetail.max, foliateKnob)

  // Absolute range clamps
  primary = clamp(primary, ranges.primaryThickness.min, ranges.primaryThickness.max)
  secondary = clamp(secondary, ranges.secondaryThickness.min, ranges.secondaryThickness.max)
  relief = clamp(relief, ranges.reliefDepth.min, ranges.reliefDepth.max)
  embed = clamp(embed, ranges.rootEmbedding.min, ranges.rootEmbedding.max)
  projection = clamp(projection, ranges.reliefProjection.min, ranges.reliefProjection.max)

  // Proportional caps vs architecture (scale-invariant ratios)
  primary = Math.min(primary, mullionT * ratios.primaryToMullion)
  secondary = Math.min(secondary, primary * ratios.secondaryToPrimary)
  relief = Math.min(relief, archDepth * ratios.reliefToArchDepth)
  embed = Math.min(embed, archDepth * ratios.embedToArchDepth)
  projection = Math.min(projection, archDepth * 0.4)
  foliate = Math.min(foliate, primary * ratios.foliateToPrimary)
  foliate = clamp(foliate, ranges.foliateDetail.min, ranges.foliateDetail.max)

  let minBranch = ranges.minBranchLength.default * scale
  let maxBranch = Math.min(
    ranges.maxBranchLength.default * scale,
    archHeight * ratios.branchToArchHeight,
  )
  minBranch = Math.min(minBranch, maxBranch * 0.4)

  return {
    primaryThickness: primary * scale,
    secondaryThickness: secondary * scale,
    ornamentThickness: primary * scale,
    reliefDepth: relief * scale,
    rootEmbedding: embed * scale,
    reliefProjection: projection * scale,
    sculpturalEmergence: emergence,
    foliateDetailMeters: foliate * scale,
    foliateDetail: foliateKnob,
    minBranchLength: minBranch,
    maxBranchLength: maxBranch,
    mullionThickness: mullionT * scale,
    architecturalDepth: archDepth * scale,
    scale,
  }
}

function metersSafe(v) {
  return Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * Resolve agent physical parameters; keep timestep / FSM untouched.
 */
export function resolveAgentPhysical(params = {}, archSupport = {}) {
  const archWidth = Math.max(metersSafe(archSupport.width), metersSafe(3))
  const scale = Math.max(0.05, params.architecturalScale ?? 1)

  let sensing = params.sensingRadius ?? 0.28
  let speed = params.movementSpeed ?? 0.55
  let depR = params.depositionRadius ?? 0.18
  let trail = params.minTrailSpacing ?? params.trailSpacing ?? 0.1
  let pathMin = params.minPathLength ?? 0.085
  let sample = params.sampleSpacing ?? 0.09
  let anchor = params.minAnchorSpacing ?? 0.12

  sensing = Math.min(sensing * scale, archWidth * PROPORTION_RATIOS.sensingToArchWidth)
  speed *= scale
  depR *= scale
  trail *= scale
  pathMin *= scale
  sample *= scale
  anchor *= scale

  return {
    sensingRadius: sensing,
    movementSpeed: speed,
    depositionRadius: depR,
    minTrailSpacing: trail,
    minPathLength: pathMin,
    sampleSpacing: sample,
    minAnchorSpacing: anchor,
    scale,
  }
}

/**
 * Architectural envelope after applying overall dims + architecturalScale.
 * Window: overallWidth/Height are design meters; scale multiplies both.
 */
export function resolveArchitecturalEnvelope(params = {}, typology = 'window') {
  const scale = Math.max(0.05, params.architecturalScale ?? 1)
  const aspect = clamp(params.windowAspect ?? params.aspectRatio ?? 1.9, 1.2, 2.8)

  let width = params.overallWidth
  let height = params.overallHeight

  if (typology === 'window' || typology === 'tracery' || !typology) {
    width = width ?? 3.0
    // Prefer explicit height; else width × aspect (legacy designShared behaviour)
    height = height ?? width * aspect
  } else if (typology === 'portal') {
    width = Math.max(2.4, width ?? 4.2)
    height = Math.max(3.2, height ?? 5.2)
  } else if (typology === 'facade') {
    width = Math.max(5.5, width ?? 9.5)
    height = Math.max(5.5, height ?? 8.5)
  } else {
    width = width ?? 3.0
    height = height ?? 5.7
  }

  return {
    width: width * scale,
    height: height * scale,
    aspect: height / Math.max(1e-6, width),
    designWidth: width,
    designHeight: height,
    architecturalScale: scale,
    typology,
  }
}
