/**
 * Lithic formation parameters (Step 47, Phase C1). Units: metres.
 * References: REF-023 / 027 / 028 (accretion on a frame, protected openings,
 * edge + gravity bias), REF-025 (strata), REF-022 (porosity gradient),
 * REF-021 (skeleton inside the mass).
 */

export const DEFAULT_LITHIC_PARAMS = Object.freeze({
  formationThickness: 1.7, // skeleton capsule radius multiplier
  rockDensity: 0.6, // accretion lobes per metre of member (× hierarchy)
  rockSize: 1.3, // mean lobe radius
  sizeVariation: 0.5,
  elongation: 1.7, // lobe stretch along its member
  adherence: 0.7, // 1 = lobes centred on members, 0 = loose
  cohesion: 0.9, // smooth-union blend radius (fusion of lobes into mass)
  gravity: 0.45, // downward drip / underside bias (REF-028)
  roughness: 0.22,
  erosion: 0.2,
  layering: 0, // strata strength (REF-025)
  layerHeight: 1.4,
  porosity: 0, // upward porosity gradient (REF-022)
  negativeSpace: 1, // 1 = protected openings fully preserved
})

export const LITHIC_PARAM_SPECS = Object.freeze([
  { key: 'formationThickness', label: 'Formation thickness', min: 0.6, max: 4, step: 0.05, tier: 'essential' },
  { key: 'rockDensity', label: 'Rock density', min: 0, max: 2, step: 0.05, tier: 'essential' },
  { key: 'rockSize', label: 'Rock size', min: 0.4, max: 4, step: 0.05, unit: 'm', tier: 'essential' },
  { key: 'cohesion', label: 'Material cohesion', min: 0.05, max: 3, step: 0.05, unit: 'm', tier: 'essential' },
  { key: 'gravity', label: 'Gravity / drip', min: 0, max: 1, step: 0.01, tier: 'essential' },
  { key: 'layering', label: 'Geological layering', min: 0, max: 1, step: 0.01, tier: 'essential' },
  { key: 'erosion', label: 'Erosion', min: 0, max: 1, step: 0.01, tier: 'essential' },
  { key: 'porosity', label: 'Porosity', min: 0, max: 1, step: 0.01, tier: 'essential' },
  { key: 'sizeVariation', label: 'Size variation', min: 0, max: 1, step: 0.01, tier: 'advanced' },
  { key: 'elongation', label: 'Elongation', min: 1, max: 4, step: 0.05, tier: 'advanced' },
  { key: 'adherence', label: 'Skeleton adherence', min: 0, max: 1, step: 0.01, tier: 'advanced' },
  { key: 'roughness', label: 'Surface roughness', min: 0, max: 1, step: 0.01, tier: 'advanced' },
  { key: 'layerHeight', label: 'Layer height', min: 0.4, max: 5, step: 0.05, unit: 'm', tier: 'advanced' },
  { key: 'negativeSpace', label: 'Negative-space preservation', min: 0, max: 1, step: 0.01, tier: 'advanced' },
])

export const LITHIC_QUALITY = Object.freeze({
  preview: { cellSize: 0.6, maxCells: 2.5e6 },
  final: { cellSize: 0.28, maxCells: 1.6e7 },
})
