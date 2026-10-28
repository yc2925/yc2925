/**
 * Step 12B — Map LOD level → render-only parameters.
 * Never mutates canonical design / agent / stigmergy simulation params.
 */

import {
  GOTHIC_LOD_SPEC,
  ORNAMENT_LOD_SPEC,
  AGENT_VIZ_LOD_SPEC,
  normalizeLodLevel,
} from './config.js'

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

/**
 * Gothic solid params derived from design-time settings + LOD.
 */
export function resolveGothicRenderParams(designParams = {}, lodLevel = 'high') {
  const lod = normalizeLodLevel(lodLevel)
  const spec = GOTHIC_LOD_SPEC[lod]
  const baseRes = designParams.detailResolution ?? 0.55
  const baseMold = Math.round(designParams.moldingComplexity ?? designParams.moldingLayers ?? 2)

  return {
    ...designParams,
    detailResolution: clamp(baseRes * spec.detailResolutionScale, 0.12, 1),
    moldingComplexity: clamp(baseMold + spec.moldingComplexityDelta, 1, 4),
    // Physical sizes unchanged — scale system owns them
    profileThickness: designParams.profileThickness,
    architecturalDepth: designParams.architecturalDepth,
    lodLevel: lod,
    lodSpec: spec,
  }
}

/**
 * Ornament sweep params — overlays LOD tessellation onto physical/profile settings.
 */
export function resolveOrnamentRenderParams(geomParams = {}, lodLevel = 'high') {
  const lod = normalizeLodLevel(lodLevel)
  const spec = ORNAMENT_LOD_SPEC[lod]
  const tipCurl = (geomParams.tipCurl ?? 0.55) * spec.tipCurlScale
  const fluting = (geomParams.flutingStrength ?? 0.48) * spec.flutingScale

  return {
    ...geomParams,
    radialResolution: spec.radialResolution,
    curveResolution: spec.curveResolution,
    tipCurl,
    flutingStrength: fluting,
    lodMaxGeneration: spec.maxGeneration,
    lodMinBranchLength: spec.minBranchLength,
    lodLevel: lod,
    lodSpec: spec,
  }
}

/**
 * Agent visualization-only knobs.
 */
export function resolveAgentVizParams(lodLevel = 'high') {
  const lod = normalizeLodLevel(lodLevel)
  return { ...AGENT_VIZ_LOD_SPEC[lod], lodLevel: lod }
}
