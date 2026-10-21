import { typologyById } from './settings.js'
import { buildPortal } from './typologies/portal.js'
import { buildWindow } from './typologies/window.js'
import { buildFacade } from './typologies/facade.js'

/**
 * Architectural grammar orchestrator.
 *
 * Pipeline:
 *   typology definition → layout (inside each builder) →
 *   structure + ornament primitives → meshes + feature catalog
 *
 * Planned typologies (vault, arcade, buttress) are registered in settings
 * but have no builder yet; generateArchitecture refuses them.
 */

const BUILDERS = {
  portal: buildPortal,
  window: buildWindow,
  facade: buildFacade,
}

/**
 * @param {object} params — composition params from settings.DEFAULT_GOTHIC
 * @returns {{ meshes, features, bounds, meta, dispose, typology }}
 */
export function generateArchitecture(params) {
  const typology = typologyById(params.typology)
  if (!typology.implemented) {
    throw new Error(`Typology "${typology.id}" is planned but not implemented yet.`)
  }
  const build = BUILDERS[typology.id]
  if (!build) throw new Error(`No builder for typology "${typology.id}".`)

  const specimen = build(params)
  return {
    ...specimen,
    typology,
  }
}

/** Feature counts by type — for the status panel. */
export function countFeatures(features) {
  const counts = {}
  for (const f of features) counts[f.type] = (counts[f.type] ?? 0) + 1
  return counts
}

/**
 * Compatibility shim for anything still calling createGothicBay.
 * Maps legacy arch-* params into composition params when present.
 */
export function createGothicBay(params = {}) {
  if (params.typology || params.overallHeight != null) {
    return generateArchitecture({ typology: 'portal', ...params })
  }
  return generateArchitecture({
    typology: 'portal',
    bayCount: 1,
    overallHeight: (params.archHeight ?? 3.4) + 1.6,
    overallWidth: (params.archWidth ?? 1.9) * 2.2,
    verticalProportion: params.archPointedness ?? 0.72,
    structuralDensity: Math.min(1, (params.ribCount ?? 3) / 6),
    ornamentDensity: params.traceryDensity ?? 0.55,
    symmetry: params.symmetry ?? true,
    variationSeed: 7,
  })
}
