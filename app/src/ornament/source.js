/**
 * Architectural source for Ornament System.
 * Reuses the Gothic Architecture generators — no second window builder.
 */

import { buildWindow } from '../gothic/typologies/window.js'
import { presetById } from '../gothic/typologies/presets.js'
import { extractArchFeatures } from './extract.js'

/**
 * Build architecture + extracted features from Ornament settings.
 * Designed so Portal / Façade can plug in via archSource later.
 */
export function buildOrnamentArchitecture(params = {}) {
  const source = params.archSource ?? 'window'

  if (source !== 'window') {
    return {
      typology: source,
      specimen: {
        meshes: [],
        features: [],
        bounds: null,
        meta: {},
        dispose: () => {},
      },
      arch: extractArchFeatures({ meta: { typology: source } }),
      dispose: () => {},
    }
  }

  const preset = params.activePreset ? presetById(params.activePreset) : null
  const specimen = buildWindow({
    traceryFamily: params.traceryFamily ?? preset?.params?.traceryFamily ?? 'geometric',
    lancetCount: params.lancetCount ?? preset?.params?.lancetCount ?? 2,
    windowAspect: params.windowAspect ?? preset?.params?.windowAspect ?? 1.9,
    upperTraceryHeight: params.upperTraceryHeight ?? preset?.params?.upperTraceryHeight ?? 0.36,
    curvature: params.curvature ?? preset?.params?.curvature ?? 0.55,
    subdivisionComplexity:
      params.subdivisionComplexity ??
      params.cuspingComplexity ??
      preset?.params?.subdivisionComplexity ??
      0.5,
    symmetry: params.symmetry !== false,
    variationSeed: params.variationSeed ?? preset?.params?.variationSeed ?? 3,
    overallWidth: params.overallWidth ?? 3.0,
    overallHeight: params.overallHeight ?? 5.7,
    architecturalScale: params.architecturalScale ?? 1,
    profileThickness: params.profileThickness ?? 0.055,
    architecturalDepth: params.architecturalDepth ?? 0.14,
    moldingComplexity: params.moldingComplexity ?? 2,
    moldingProfile: params.moldingProfile ?? 'compound',
    moldingDepth: params.moldingDepth ?? 0.55,
    bevelIntensity: params.bevelIntensity ?? 0.45,
    detailResolution: params.detailResolution ?? 0.55,
  })

  const arch = extractArchFeatures(specimen)
  return {
    typology: 'window',
    specimen,
    arch,
    presetId: params.activePreset ?? null,
    dispose: () => specimen.dispose(),
  }
}
