/**
 * Gothic skeleton parameters (Step 47, Phase B1). Units: metres.
 * References: REF-004 (bays, transverse/diagonal ribs, springing),
 * REF-011 / REF-008 (pointed arch construction), REF-012 / REF-025 (spire
 * hierarchy), REF-029 (bay rhythm along a spine), REF-023/027 (storey scale).
 */

export const DEFAULT_SKELETON_PARAMS = Object.freeze({
  height: 18, // vault apex target above the curve
  verticality: 1.0, // multiplies height
  width: 9, // nave span between pier lines
  spacing: 6.5, // target bay length along the curve
  archRise: 1.15, // transverse arch rise / span (lancet when > 0.866)
  ribDensity: 1, // 0 = transverse only, 1 = + diagonal ribs, 2 = + ridge rib
  thickness: 0.55, // pier / rib radius
  buttressDepth: 0.32, // flying-buttress reach as a fraction of height
  spireIntensity: 0.6, // 0 = no end towers
  curvatureResponse: 1.0, // bay compression + buttress growth on bends
})

export const SKELETON_PARAM_SPECS = Object.freeze([
  { key: 'height', label: 'Height', min: 6, max: 60, step: 0.5, unit: 'm', tier: 'essential' },
  { key: 'width', label: 'Nave span', min: 0, max: 30, step: 0.5, unit: 'm', tier: 'essential' },
  { key: 'spacing', label: 'Bay spacing', min: 2.5, max: 20, step: 0.25, unit: 'm', tier: 'essential' },
  { key: 'archRise', label: 'Arch rise', min: 0.4, max: 1.6, step: 0.01, tier: 'essential' },
  { key: 'thickness', label: 'Member thickness', min: 0.15, max: 2, step: 0.05, unit: 'm', tier: 'essential' },
  { key: 'spireIntensity', label: 'Spire intensity', min: 0, max: 2, step: 0.05, tier: 'essential' },
  { key: 'verticality', label: 'Verticality', min: 0.5, max: 2, step: 0.05, tier: 'advanced' },
  { key: 'ribDensity', label: 'Rib density', min: 0, max: 2, step: 1, tier: 'advanced' },
  { key: 'buttressDepth', label: 'Buttress reach', min: 0, max: 0.8, step: 0.01, tier: 'advanced' },
  { key: 'curvatureResponse', label: 'Curvature response', min: 0, max: 3, step: 0.05, tier: 'advanced' },
])
