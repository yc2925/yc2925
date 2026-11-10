/**
 * Tracery Example dropdown → complete shared-generator configurations (13E.3.2.1).
 *
 * Selecting an example applies a full, valid window-design patch via the same
 * buildStoneAssembly / generateGothicWindowModule path used by Stone / 3D and
 * Architectural Assembly. No separate example-only geometry engine.
 *
 * Root cause addressed: previously only `exampleId` (+ foilType for B/C) was
 * written, while hierarchical / skeleton flags from the active architecture
 * preset continued to drive stone — so A–E looked identical in Stone / 3D.
 */

import { FOIL_TYPES, TRACERY_EXAMPLES } from './roles.js'
import {
  applyArchitecturePreset,
  ARCHITECTURE_PRESETS,
} from './presets.js'
import { DEFAULT_COMPOSED_PARAMS } from './composedWindow.js'
import { DEFAULT_REGION_PARAMS } from './regionRoles.js'

export { TRACERY_EXAMPLES }

/** Clear skeleton / hierarchical / bar / elaborate path flags. */
export function clearAdvancedGrammarFlags(tracery = {}) {
  return {
    ...tracery,
    enableSpandrelOpenings: false,
    enableBarNetwork: false,
    enableElaborate: false,
    enableSkeleton: false,
    enableOculusNetwork: false,
    enableSecondaryTracery: false,
    enableOculusRefinement: false,
    enableHierarchicalTracery: false,
  }
}

/**
 * Metadata for UI + validation: intended geometry and applicable modes.
 */
export const TRACERY_EXAMPLE_META = Object.freeze({
  'lancet-subdivision': {
    id: 'lancet-subdivision',
    label: 'A. Lancet Subdivision',
    intended:
      'Parent pointed arch + central mullion + two child lancets (composed solid/void with lancet emphasis).',
    representationModes: ['tracery', 'stone-3d', 'architectural-assembly'],
    references: ['REF-008', 'REF-001'],
  },
  trefoil: {
    id: 'trefoil',
    label: 'B. Trefoil',
    intended: 'Composed window with threefold cusped upper foil (REF-006 / REF-011).',
    representationModes: ['tracery', 'stone-3d', 'architectural-assembly'],
    references: ['REF-006', 'REF-011'],
  },
  quatrefoil: {
    id: 'quatrefoil',
    label: 'C. Quatrefoil',
    intended: 'Composed window with fourfold cusped upper foil, diagonal orientation.',
    representationModes: ['tracery', 'stone-3d', 'architectural-assembly'],
    references: ['REF-006', 'REF-011'],
  },
  'oculus-placement': {
    id: 'oculus-placement',
    label: 'D. Oculus Placement',
    intended:
      'Skeleton + connected oculus ring (no quatrefoil subdivision) — dominant circular oculus.',
    representationModes: ['tracery', 'stone-3d', 'architectural-assembly'],
    references: ['REF-008', 'REF-011', 'REF-009'],
  },
  'composed-window': {
    id: 'composed-window',
    label: 'E. Composed Window',
    intended:
      'Full Rayonnant Facade Module (hierarchical 13D.9) — preferred shared Assembly window.',
    representationModes: ['tracery', 'stone-3d', 'architectural-assembly'],
    references: ['REF-008', 'REF-011', 'REF-007'],
  },
})

/**
 * Apply a Tracery Example as a complete procedural configuration.
 *
 * @returns {{ tracery: object, stone: object, exampleId: string, meta: object }}
 */
export function applyTraceryExample(exampleId, currentTracery = {}, currentStone = {}) {
  const id = TRACERY_EXAMPLE_META[exampleId] ? exampleId : 'composed-window'
  const span = currentTracery.span ?? DEFAULT_COMPOSED_PARAMS.span
  const baseElevation =
    currentTracery.windowBaseElevation ?? DEFAULT_REGION_PARAMS.windowBaseElevation

  let applied

  if (id === 'lancet-subdivision') {
    applied = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      {
        ...clearAdvancedGrammarFlags(currentTracery),
        span,
        windowBaseElevation: baseElevation,
        mullionWidth: 0.14,
        jambInset: 0.05,
        oculusRadiusRatio: 0.55,
        oculusHeightRatio: 0.72,
        oculusVerticalPosition: 0.72,
        foilType: FOIL_TYPES.quatrefoil,
        foilScale: 0.72,
        cuspDepth: 0.45,
        foilOrientation: 0,
        subdivisionRatio: 0.5,
        symmetric: true,
      },
      currentStone,
    )
  } else if (id === 'trefoil') {
    applied = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      {
        ...clearAdvancedGrammarFlags(currentTracery),
        span,
        windowBaseElevation: baseElevation,
        foilType: FOIL_TYPES.trefoil,
        foilScale: 0.9,
        cuspDepth: 0.85,
        foilOrientation: Math.PI / 2,
        foilRotation: 0,
        oculusRadiusRatio: 0.9,
        oculusHeightRatio: 0.78,
        oculusVerticalPosition: 0.78,
        trefoilHeads: true,
        secondaryQuatrefoils: false,
      },
      currentStone,
    )
  } else if (id === 'quatrefoil') {
    applied = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      {
        ...clearAdvancedGrammarFlags(currentTracery),
        span,
        windowBaseElevation: baseElevation,
        foilType: FOIL_TYPES.quatrefoil,
        foilScale: 0.9,
        cuspDepth: 0.55,
        foilOrientation: Math.PI / 4,
        foilRotation: 0,
        oculusRadiusRatio: 0.9,
        oculusHeightRatio: 0.78,
        oculusVerticalPosition: 0.78,
        trefoilHeads: false,
        secondaryQuatrefoils: true,
      },
      currentStone,
    )
  } else if (id === 'oculus-placement') {
    applied = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_OCULUS_NETWORK,
      {
        ...currentTracery,
        span,
        windowBaseElevation: baseElevation,
        oculusSubdivision: 'none',
        oculusRadiusRatio: 0.86,
        oculusVerticalPosition: 0.55,
        oculusHeightRatio: 0.55,
        foilType: FOIL_TYPES.quatrefoil,
        enableHierarchicalTracery: false,
        enableSecondaryTracery: false,
        enableOculusRefinement: false,
      },
      currentStone,
    )
    // Oculus-network preset enables secondary flags via cascading; force focus mode.
    applied.tracery = {
      ...applied.tracery,
      enableHierarchicalTracery: false,
      enableSecondaryTracery: false,
      enableOculusRefinement: false,
      enableSkeleton: true,
      enableOculusNetwork: true,
      oculusSubdivision: 'none',
    }
  } else {
    // composed-window — full editable facade module (preferred Assembly look)
    applied = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
      {
        ...currentTracery,
        span,
        windowBaseElevation: baseElevation,
        foilType: FOIL_TYPES.trefoil,
        trefoilHeads: true,
        hierarchicalDepth: currentTracery.hierarchicalDepth ?? 1,
      },
      currentStone,
    )
  }

  // Preset merge overwrites foil fields — re-apply example-specific geometry knobs.
  const exampleFoilOverrides =
    id === 'lancet-subdivision'
      ? {
          foilType: FOIL_TYPES.quatrefoil,
          foilScale: 0.72,
          cuspDepth: 0.45,
          foilOrientation: 0,
          oculusRadiusRatio: 0.55,
          oculusHeightRatio: 0.72,
          oculusVerticalPosition: 0.72,
        }
      : id === 'trefoil'
        ? {
            foilType: FOIL_TYPES.trefoil,
            foilScale: 0.9,
            cuspDepth: 0.85,
            foilOrientation: Math.PI / 2,
            foilRotation: 0,
            oculusRadiusRatio: 0.9,
            oculusHeightRatio: 0.78,
            oculusVerticalPosition: 0.78,
            trefoilHeads: true,
            secondaryQuatrefoils: false,
          }
        : id === 'quatrefoil'
          ? {
              foilType: FOIL_TYPES.quatrefoil,
              foilScale: 0.9,
              cuspDepth: 0.55,
              foilOrientation: Math.PI / 4,
              foilRotation: 0,
              oculusRadiusRatio: 0.9,
              oculusHeightRatio: 0.78,
              oculusVerticalPosition: 0.78,
              trefoilHeads: false,
              secondaryQuatrefoils: true,
            }
          : id === 'oculus-placement'
            ? {
                oculusSubdivision: 'none',
                oculusRadiusRatio: 0.86,
                oculusVerticalPosition: 0.55,
                oculusHeightRatio: 0.55,
              }
            : {}

  const tracery = {
    ...applied.tracery,
    ...exampleFoilOverrides,
    exampleId: id,
  }
  const stone = {
    ...applied.stone,
  }

  return {
    exampleId: id,
    tracery,
    stone,
    meta: TRACERY_EXAMPLE_META[id],
    preset: applied.preset,
  }
}

/**
 * Stable signature fragment for tests / cache debugging.
 */
export function traceryExampleSignature(tracery = {}) {
  return JSON.stringify({
    exampleId: tracery.exampleId ?? 'composed-window',
    architecturePreset: tracery.architecturePreset ?? null,
    foilType: tracery.foilType ?? null,
    enableSkeleton: tracery.enableSkeleton === true,
    enableHierarchicalTracery: tracery.enableHierarchicalTracery === true,
    enableOculusNetwork: tracery.enableOculusNetwork === true,
    oculusSubdivision: tracery.oculusSubdivision ?? null,
    oculusRadiusRatio: tracery.oculusRadiusRatio ?? null,
    mullionWidth: tracery.mullionWidth ?? null,
    hierarchicalDepth: tracery.hierarchicalDepth ?? null,
  })
}
