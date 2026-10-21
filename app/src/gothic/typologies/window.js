import { V } from '../primitives.js'
import { buildWindowDesign2d, validateDesign2d } from './windowDesign2d.js'
import { buildWindowSolid3d, validateSolidMatchesDesign } from './windowSolid3d.js'

/**
 * TRACERY WINDOW — Phase 4
 *
 * Family → composition rules → 2D curve graph → profile assignment → 3D stone.
 * Display modes (Solid / Wireframe / Skeleton / 2D Design) share one graph.
 */

export function buildWindow(params) {
  const design = buildWindowDesign2d({
    traceryFamily: params.traceryFamily,
    windowAspect: params.windowAspect ?? params.aspectRatio,
    lancetCount: params.lancetCount ?? params.bayCount ?? 2,
    upperTraceryHeight: params.upperTraceryHeight,
    curvature: params.curvature,
    subdivisionComplexity: params.subdivisionComplexity ?? params.cuspingComplexity,
    cuspingComplexity: params.cuspingComplexity ?? params.subdivisionComplexity,
    symmetry: params.symmetry,
    variationSeed: params.variationSeed,
  })

  const designValidation = validateDesign2d(design)
  const solid = buildWindowSolid3d(design, {
    profileThickness: params.profileThickness,
    architecturalDepth: params.architecturalDepth,
    moldingComplexity: params.moldingComplexity ?? params.moldingLayers,
    detailResolution: params.detailResolution,
    moldingProfile: params.moldingProfile,
    moldingDepth: params.moldingDepth,
    bevelIntensity: params.bevelIntensity,
  })
  const solidValidation = validateSolidMatchesDesign(design, solid)
  const { layout } = design

  return {
    meshes: solid.meshes,
    features: solid.features,
    bounds: solid.bounds,
    meta: {
      typology: 'window',
      phase: 4,
      design2d: design,
      skeleton: solid.skeleton,
      validation: designValidation,
      solidValidation,
      lancetCount: layout.lancetCount,
      family: layout.family,
      strategy: layout.strategy,
      solid: solid.meta,
    },
    dispose: () => solid.dispose(),
  }
}

export function buildWindowDesignOnly(params) {
  const design = buildWindowDesign2d(params)
  return {
    meshes: [],
    features: [],
    bounds: {
      min: V(-design.layout.half, design.layout.sill, 0),
      max: V(design.layout.half, design.layout.apex, 0),
      center: V(0, design.layout.H * 0.5, 0),
    },
    meta: { typology: 'window', phase: 4, design2d: design },
    dispose: () => {},
  }
}
