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
  const archScale = Math.max(0.05, params.architecturalScale ?? 1)
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
    overallWidth: params.overallWidth,
    overallHeight: params.overallHeight,
    architecturalScale: archScale,
  })

  const designValidation = validateDesign2d(design)
  const solid = buildWindowSolid3d(design, {
    // Profile dims scale with architecture so stone stays proportional
    profileThickness: (params.profileThickness ?? 0.055) * archScale,
    architecturalDepth: (params.architecturalDepth ?? 0.14) * archScale,
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

/**
 * Step 12B — Rebuild stone meshes from an existing 2D design (canonical topology).
 * LOD may change tessellation params only; design curves/junctions stay identical.
 * Pass profileThickness / architecturalDepth already in world meters (scaled).
 */
export function buildWindowFromDesign(design, solidParams = {}) {
  if (!design) throw new Error('buildWindowFromDesign requires a design2d graph')
  const designValidation = validateDesign2d(design)
  const solid = buildWindowSolid3d(design, {
    profileThickness: solidParams.profileThickness ?? 0.055,
    architecturalDepth: solidParams.architecturalDepth ?? 0.14,
    moldingComplexity: solidParams.moldingComplexity ?? solidParams.moldingLayers ?? 2,
    detailResolution: solidParams.detailResolution,
    moldingProfile: solidParams.moldingProfile,
    moldingDepth: solidParams.moldingDepth,
    bevelIntensity: solidParams.bevelIntensity,
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
      lodLevel: solidParams.lodLevel ?? null,
    },
    dispose: () => solid.dispose(),
  }
}
