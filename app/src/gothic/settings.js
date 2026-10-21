/**
 * Gothic Architecture — hierarchical typology grammar (settings).
 *
 * Implemented typologies appear in the UI.
 * Planned typologies are registered but hidden until built.
 *
 * Feature metadata is retained on specimens for future growth sims,
 * but FEATURES is not a user-facing display mode.
 */

/** Portal / Facade: Solid, Wireframe, Skeleton (centerlines when present). */
export const DISPLAY_MODES = [
  { id: 'solid', label: 'Solid' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'skeleton', label: 'Skeleton' },
]

/** Tracery Window: Solid, Wireframe, Skeleton (3D centerlines), 2D Design. */
export const WINDOW_DISPLAY_MODES = [
  { id: 'solid', label: 'Solid' },
  { id: 'wireframe', label: 'Wireframe' },
  { id: 'skeleton', label: 'Skeleton' },
  { id: 'design', label: '2D Design' },
]

export const FEATURE_TYPES = [
  { id: 'wall', label: 'Wall', color: '#8a8a85' },
  { id: 'arch', label: 'Arch', color: '#d9d4ca' },
  { id: 'column', label: 'Column', color: '#b0aea6' },
  { id: 'rib', label: 'Rib', color: '#c4bfb4' },
  { id: 'opening', label: 'Opening', color: '#5c5c5c' },
  { id: 'junction', label: 'Junction', color: '#ff2020' },
  { id: 'tracery', label: 'Tracery', color: '#9a968c' },
  { id: 'recess', label: 'Recess', color: '#6e6e68' },
  { id: 'buttress', label: 'Buttress', color: '#7a7870' },
  { id: 'pinnacle', label: 'Pinnacle', color: '#c8c2b6' },
  { id: 'mullion', label: 'Mullion', color: '#a8a49a' },
]

export const TYPOLOGIES = [
  {
    id: 'portal',
    label: 'Gothic Portal',
    implemented: true,
    note: 'Step 6: recessed archivolts, per-layer clustered columns, optional tympanum tracery from the Window generator.',
    camera: { position: [5.2, 3.6, 10.5], target: [0, 2.5, -0.4] },
  },
  {
    id: 'window',
    label: 'Tracery Window',
    implemented: true,
    note: 'Phase 4: Geometric / Rayonnant / Flamboyant families share one curve graph → stone sweep pipeline.',
    camera: { position: [3.6, 3.0, 7.2], target: [0, 2.85, 0] },
  },
  {
    id: 'facade',
    label: 'Cathedral Facade',
    implemented: true,
    note: 'Step 6: composes Portal assembly + Tracery Windows with buttresses, gallery, rose, and pinnacles.',
    camera: { position: [7.5, 5.5, 16], target: [0, 4.2, 0] },
  },
  {
    id: 'vault',
    label: 'Ribbed Vault',
    implemented: false,
    note: 'Planned: intersecting diagonal and transverse ribs over a rectangular bay.',
    camera: { position: [6, 4, 6], target: [0, 3, -2] },
  },
  {
    id: 'arcade',
    label: 'Gothic Arcade',
    implemented: false,
    note: 'Planned: repeating pointed arches on piers along a nave wall.',
    camera: { position: [8, 3.5, 10], target: [0, 2.5, 0] },
  },
  {
    id: 'buttress',
    label: 'Buttress & Pinnacle',
    implemented: false,
    note: 'Planned: flying / pier buttress with setbacks and crowning pinnacle.',
    camera: { position: [6, 5, 9], target: [0, 3.5, 0] },
  },
]

export const ACTIVE_TYPOLOGIES = TYPOLOGIES.filter((t) => t.implemented)

export function typologyById(id) {
  return TYPOLOGIES.find((t) => t.id === id) ?? ACTIVE_TYPOLOGIES[0]
}

export const DEFAULT_DESIGN_LAYERS = {
  frame: true,
  mullion: true,
  secondary: true,
  junction: true,
}

export const DEFAULT_GOTHIC = {
  typology: 'portal',
  bayCount: 1,
  overallHeight: 5.2,
  overallWidth: 4.2,
  verticalProportion: 0.55,
  structuralComplexity: 0.65,
  traceryComplexity: 0.55,
  moldingLayers: 2,
  detailResolution: 0.55,
  // Window 2D topology (Phase 4)
  traceryFamily: 'geometric',
  windowAspect: 1.9,
  lancetCount: 2,
  upperTraceryHeight: 0.36,
  curvature: 0.55,
  subdivisionComplexity: 0.5,
  cuspingComplexity: 0.5, // alias of subdivisionComplexity
  activePreset: 'geo-twin-trefoil',
  designLayers: { ...DEFAULT_DESIGN_LAYERS },
  // Window 3D representation
  profileThickness: 0.055,
  architecturalDepth: 0.14,
  moldingComplexity: 2,
  moldingProfile: 'compound',
  moldingDepth: 0.55,
  bevelIntensity: 0.45,
  // Shared stone material
  stoneColor: '#c4bfb4',
  stoneRoughness: 0.78,
  surfaceVariation: 0.25,
  // Legacy mirrors
  structuralDensity: 0.65,
  ornamentDensity: 0.55,
  symmetry: true,
  variationSeed: 7,
  displayMode: 'solid',
}

export function displayModesForTypology(id) {
  if (id === 'window') return WINDOW_DISPLAY_MODES
  // Portal / Facade share Solid / Wireframe / Skeleton (no 2D Design).
  return DISPLAY_MODES
}

/** Coerce stored displayMode if FEATURES or unsupported mode is selected. */
export function coerceDisplayMode(typologyId, mode) {
  const allowed = displayModesForTypology(typologyId).map((m) => m.id)
  if (mode === 'features') return 'solid'
  if (!allowed.includes(mode)) return 'solid'
  return mode
}

export function defaultForTypology(id) {
  const base = { ...DEFAULT_GOTHIC, typology: id, designLayers: { ...DEFAULT_DESIGN_LAYERS } }
  if (id === 'window') {
    return {
      ...base,
      bayCount: 2,
      lancetCount: 2,
      traceryFamily: 'geometric',
      windowAspect: 1.9,
      upperTraceryHeight: 0.36,
      curvature: 0.55,
      subdivisionComplexity: 0.5,
      cuspingComplexity: 0.5,
      symmetry: true,
      variationSeed: 3,
      activePreset: 'geo-twin-trefoil',
      overallHeight: 5.7,
      overallWidth: 3.0,
      displayMode: 'solid',
      profileThickness: 0.055,
      architecturalDepth: 0.14,
      moldingComplexity: 2,
      moldingProfile: 'compound',
      moldingDepth: 0.55,
      bevelIntensity: 0.45,
      detailResolution: 0.7,
      structuralComplexity: 0.5,
      traceryComplexity: 0.55,
      moldingLayers: 2,
      structuralDensity: 0.5,
      ornamentDensity: 0.55,
    }
  }
  if (id === 'facade') {
    return {
      ...base,
      bayCount: 3,
      overallHeight: 8.5,
      overallWidth: 9.5,
      verticalProportion: 0.48,
      structuralComplexity: 0.62,
      traceryComplexity: 0.55,
      moldingLayers: 2,
      detailResolution: 0.45,
      architecturalDepth: 0.55,
      traceryFamily: 'geometric',
      structuralDensity: 0.62,
      ornamentDensity: 0.55,
      displayMode: 'solid',
    }
  }
  // Portal
  return {
    ...base,
    bayCount: 1,
    overallHeight: 5.2,
    overallWidth: 4.2,
    verticalProportion: 0.55,
    structuralComplexity: 0.65,
    traceryComplexity: 0.55,
    moldingLayers: 3,
    detailResolution: 0.55,
    architecturalDepth: 0.6,
    traceryFamily: 'geometric',
    structuralDensity: 0.65,
    ornamentDensity: 0.55,
    displayMode: 'solid',
  }
}

export function resetGothic(typology = DEFAULT_GOTHIC.typology) {
  return defaultForTypology(typology)
}
