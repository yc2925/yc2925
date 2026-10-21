/**
 * Curated Tracery Window presets (Phase 4).
 * Two compositions per family — six total.
 * Each stores family + composition params + seed.
 */

export const TRACERY_PRESETS = [
  {
    id: 'geo-twin-trefoil',
    label: 'Geometric · Twin Trefoil',
    family: 'geometric',
    note: 'Two lights, circular head with trefoil cusps, straight connectors.',
    params: {
      traceryFamily: 'geometric',
      windowAspect: 1.95,
      lancetCount: 2,
      upperTraceryHeight: 0.34,
      curvature: 0.48,
      subdivisionComplexity: 0.35,
      cuspingComplexity: 0.35,
      symmetry: true,
      variationSeed: 3, // strategy 0 — trefoil
    },
  },
  {
    id: 'geo-triple-sexfoil',
    label: 'Geometric · Triple Sexfoil',
    family: 'geometric',
    note: 'Three lights, denser sexfoil head with inner ring and spokes.',
    params: {
      traceryFamily: 'geometric',
      windowAspect: 1.75,
      lancetCount: 3,
      upperTraceryHeight: 0.4,
      curvature: 0.62,
      subdivisionComplexity: 0.78,
      cuspingComplexity: 0.78,
      symmetry: true,
      variationSeed: 5, // strategy 2 — sexfoil
    },
  },
  {
    id: 'ray-rose-wheel',
    label: 'Rayonnant · Rose Wheel',
    family: 'rayonnant',
    note: 'Eight-spoke rose above twin lancets; clear radial hierarchy.',
    params: {
      traceryFamily: 'rayonnant',
      windowAspect: 1.85,
      lancetCount: 2,
      upperTraceryHeight: 0.38,
      curvature: 0.5,
      subdivisionComplexity: 0.45,
      cuspingComplexity: 0.45,
      symmetry: true,
      variationSeed: 3, // strategy 0 — 8-spoke
    },
  },
  {
    id: 'ray-double-ring',
    label: 'Rayonnant · Double Ring',
    family: 'rayonnant',
    note: 'Four lights, dense spokes, concentric rings and rim foils.',
    params: {
      traceryFamily: 'rayonnant',
      windowAspect: 1.65,
      lancetCount: 4,
      upperTraceryHeight: 0.42,
      curvature: 0.58,
      subdivisionComplexity: 0.72,
      cuspingComplexity: 0.72,
      symmetry: true,
      variationSeed: 5, // strategy 2 — double ring
    },
  },
  {
    id: 'flam-ogee-head',
    label: 'Flamboyant · Ogee Head',
    family: 'flamboyant',
    note: 'S-curve connectors into a cusped head; classic flame character.',
    params: {
      traceryFamily: 'flamboyant',
      windowAspect: 2.0,
      lancetCount: 2,
      upperTraceryHeight: 0.36,
      curvature: 0.7,
      subdivisionComplexity: 0.42,
      cuspingComplexity: 0.42,
      symmetry: true,
      variationSeed: 3, // strategy 0 — classic ogee
    },
  },
  {
    id: 'flam-mouchette',
    label: 'Flamboyant · Mouchette Mesh',
    family: 'flamboyant',
    note: 'Three lights with mouchettes and interlocking ogee mesh.',
    params: {
      traceryFamily: 'flamboyant',
      windowAspect: 1.8,
      lancetCount: 3,
      upperTraceryHeight: 0.4,
      curvature: 0.78,
      subdivisionComplexity: 0.82,
      cuspingComplexity: 0.82,
      symmetry: true,
      variationSeed: 5, // strategy 2 — ogee mesh
    },
  },
]

export function presetById(id) {
  return TRACERY_PRESETS.find((p) => p.id === id) ?? TRACERY_PRESETS[0]
}

export function presetsForFamily(family) {
  return TRACERY_PRESETS.filter((p) => p.family === family)
}

/** Apply a preset onto current settings (keeps 3D/material prefs). */
export function applyPreset(settings, presetId) {
  const preset = presetById(presetId)
  return {
    ...settings,
    ...preset.params,
    bayCount: preset.params.lancetCount,
    activePreset: preset.id,
    typology: 'window',
  }
}

/** Bump seed for a new valid variation; keep family and composition knobs. */
export function regenerateSeed(settings) {
  const current = Math.round(settings.variationSeed ?? 7)
  const next = current >= 99 ? 1 : current + 1
  return {
    ...settings,
    variationSeed: next,
    // Keep activePreset id so "Reset to Preset" still restores the curated set.
  }
}
