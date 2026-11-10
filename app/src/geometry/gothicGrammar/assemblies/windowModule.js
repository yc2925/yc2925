/**
 * GOTHIC_WINDOW_MODULE — authoritative shared generator (Step 13E.3.2).
 *
 * generateGothicWindowModule(params) is the single entry point for Stone / 3D
 * and Architectural Assembly. Both consume the same buildStoneAssembly path
 * (13A–13D.9). No second geometry engine.
 *
 * Local geometry is cached by stoneGeometryKey; world placement is a transform
 * applied by the facade without mutating the module mesh.
 */

import { buildStoneAssembly, stoneGeometryKey } from '../solids/index.js'
import { nextId } from '../kernel/result.js'
import {
  buildWindowTraceryParams,
  buildLegacyAssemblyWindowDesign,
  windowDesignSignature,
} from './windowDesignParams.js'
import { ARCHITECTURE_PRESETS } from '../tracery/presets.js'

/** In-memory cache of identical window assemblies (geometry reuse / instancing). */
const MODULE_CACHE = new Map()

export function clearWindowModuleCache() {
  MODULE_CACHE.clear()
}

export function windowModuleCacheSize() {
  return MODULE_CACHE.size
}

/**
 * Authoritative Gothic window module generator.
 *
 * @param {object} opts
 * @param {object} [opts.windowDesign] — { tracery, stone } shared design (preferred)
 * @param {object} [opts.tracery] — region/tracery params (merged into windowDesign)
 * @param {object} [opts.stone] — stone params
 * @param {number} [opts.span] — absolute span override (layout fit)
 * @param {number} [opts.windowScale] — multiplies span
 * @param {number} [opts.hierarchicalDepth]
 * @param {number} [opts.stoneDepth]
 * @param {boolean} [opts.useLegacyAssemblyDefaults] — force pre-sync Assembly snapshot
 * @param {boolean} [opts.useCache]
 */
export function generateGothicWindowModule(opts = {}) {
  const id = opts.id ?? nextId('window-module')
  const parentAssemblyId = opts.parentAssemblyId ?? null
  const windowScale = Number.isFinite(opts.windowScale) ? opts.windowScale : 1
  const useLegacy = opts.useLegacyAssemblyDefaults === true

  let traceryInput
  let stoneInput

  if (useLegacy && !opts.windowDesign && !opts.tracery) {
    const legacy = buildLegacyAssemblyWindowDesign({
      tracery: opts.tracery,
      stone: opts.stone,
    })
    traceryInput = legacy.tracery
    stoneInput = legacy.stone
  } else if (opts.windowDesign) {
    traceryInput = { ...(opts.windowDesign.tracery ?? {}), ...(opts.tracery ?? {}) }
    stoneInput = { ...(opts.windowDesign.stone ?? {}), ...(opts.stone ?? {}) }
  } else if (opts.tracery || opts.stone) {
    // Linked / explicit params — do NOT re-apply hierarchical preset.
    traceryInput = { ...(opts.tracery ?? {}) }
    stoneInput = { ...(opts.stone ?? {}) }
  } else {
    // Backward-compatible Assembly default = legacy preferred appearance.
    const legacy = buildLegacyAssemblyWindowDesign()
    traceryInput = legacy.tracery
    stoneInput = legacy.stone
  }

  if (opts.hierarchicalDepth != null) {
    traceryInput = { ...traceryInput, hierarchicalDepth: opts.hierarchicalDepth }
  }
  if (opts.stoneDepth != null) {
    stoneInput = { ...stoneInput, stoneDepth: opts.stoneDepth }
  }

  const { params: normalizedTracery } = buildWindowTraceryParams(traceryInput)
  const designSpan = Number.isFinite(opts.span)
    ? opts.span
    : (normalizedTracery.span ?? 3)
  const span = Math.max(0.8, designSpan * windowScale)

  const tracery = {
    ...normalizedTracery,
    span,
  }
  const stone = {
    ...stoneInput,
    stoneDepth: stoneInput.stoneDepth ?? opts.stoneDepth ?? 0.25,
  }

  const cacheKey = windowDesignSignature(tracery, stone)
  let assembly
  let fromCache = false
  if (opts.useCache !== false && MODULE_CACHE.has(cacheKey)) {
    assembly = MODULE_CACHE.get(cacheKey)
    fromCache = true
  } else {
    assembly = buildStoneAssembly({ regionParams: tracery, stone })
    const cacheable =
      assembly?.metrics?.watertight === true &&
      (assembly?.metrics?.nonManifoldEdgeCount ?? 0) === 0
    if (opts.useCache !== false && cacheable) {
      MODULE_CACHE.set(cacheKey, assembly)
    }
  }

  const metrics = assembly?.metrics ?? null
  const bbox = {
    min: metrics?.boundingMin ?? null,
    max: metrics?.boundingMax ?? null,
    size: metrics?.boundingSize ?? null,
  }

  const height =
    bbox.size?.[1] ??
    Math.max(
      0.1,
      (tracery.riseRatio ?? 0.866) * span +
        Math.abs((tracery.springingY ?? 0) - (tracery.windowBaseElevation ?? -0.35)),
    )

  const hierarchicalDepth = tracery.hierarchicalDepth ?? 1

  return {
    type: 'GOTHIC_WINDOW_MODULE',
    id,
    parentAssemblyId,
    span,
    height,
    springingElevation: tracery.springingY ?? 0,
    windowBaseElevation: tracery.windowBaseElevation ?? -0.35,
    hierarchicalDepth,
    stoneDepth: stone.stoneDepth,
    architecturalPreset:
      tracery.architecturePreset ?? ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
    linkMode: opts.linkMode ?? 'linked-to-master',
    /** Local→world; set by facade. */
    transform: {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    },
    boundingBox: bbox,
    geometryRef: cacheKey,
    fromCache,
    assembly,
    semantic: {
      memberCount: assembly?.solidVoid?.metrics?.memberCount ?? null,
      nodeCount: assembly?.solidVoid?.metrics?.nodeCount ?? null,
      grammarStage: assembly?.meta?.grammarStage ?? '13D.9',
      watertight: assembly?.metrics?.watertight === true,
      nonManifoldEdgeCount: assembly?.metrics?.nonManifoldEdgeCount ?? null,
      structuralVolume: assembly?.metrics?.structuralVolume ?? null,
    },
    parameters: { tracery, stone, windowScale, cacheKey },
    validation: {
      ok: assembly?.ok === true,
      errors: [...(assembly?.errors ?? [])],
      warnings: [...(assembly?.warnings ?? [])],
    },
  }
}

/**
 * @deprecated Prefer generateGothicWindowModule — kept as alias for 13E.1 callers.
 */
export function buildGothicWindowModule(opts = {}) {
  // Legacy callers without windowDesign keep Assembly preferred defaults.
  if (!opts.windowDesign && !opts.tracery && opts.useLegacyAssemblyDefaults !== false) {
    return generateGothicWindowModule({
      ...opts,
      useLegacyAssemblyDefaults: true,
    })
  }
  return generateGothicWindowModule(opts)
}

export { stoneGeometryKey }
