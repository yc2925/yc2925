/**
 * Shared window-design parameter ownership (Step 13E.3.2).
 *
 * windowDesignParams  — authoritative Gothic window module (Stone / 3D + Assembly)
 * assemblyLayoutParams — bay count, spacing, variation, pier layout
 * structuralSupportParams — support style / shafts / buttresses
 * surfaceSemanticParams — growth overlay weights (not geometry)
 *
 * Stone / 3D edits update settings.tracery + settings.stone.
 * Architectural Assembly must consume those objects; it must not
 * silently re-apply a local hierarchical default over user edits.
 */

import { normalizeTraceryParams } from '../tracery/normalizeTraceryParams.js'
import {
  applyArchitecturePreset,
  ARCHITECTURE_PRESETS,
  getArchitecturePreset,
} from '../tracery/presets.js'
import { FOIL_TYPES } from '../tracery/roles.js'
import { DEFAULT_COMPOSED_PARAMS } from '../tracery/composedWindow.js'
import { DEFAULT_REGION_PARAMS } from '../tracery/regionRoles.js'
import { DEFAULT_STONE_PARAMS, stoneGeometryKey } from '../solids/stoneAssembly.js'
import {
  DEFAULT_TRACERY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
} from '../settings.js'

/** Frozen parameter snapshot of the preferred pre-13E.3.2 Assembly look. */
export const ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT = Object.freeze({
  id: 'assembly-rayonnant-legacy-snapshot',
  label: 'Assembly Rayonnant — Legacy Snapshot',
  architecturePreset: ARCHITECTURE_PRESETS.RAYONNANT_HIERARCHICAL,
  hierarchicalDepth: 1,
  moldingEnabled: false,
  showMoldings: false,
  bayWidth: 3.0,
  windowScale: 1.0,
  stoneDepth: 0.25,
  note:
    'Exact generator settings used by Architectural Assembly before shared-module sync (forced Rayonnant Hierarchical, moldings off).',
})

/**
 * Build normalized region/tracery params identical to Stone / 3D.
 * Shared by GothicGrammarView and Assembly so both pipelines normalize once.
 */
export function buildWindowTraceryParams(tracery = {}) {
  const t = normalizeTraceryParams({ ...DEFAULT_TRACERY_SETTINGS, ...tracery })
  const exampleId = t.exampleId ?? 'composed-window'
  const base = {
    family: t.family,
    span: t.span,
    riseRatio: t.riseRatio,
    springingY: t.springingY,
    samplingQuality: t.samplingQuality,
    subdivisionRatio: t.subdivisionRatio,
    mullionWidth: t.mullionWidth,
    jambInset: t.jambInset,
    childRiseRatio: t.childRiseRatio,
    childFamily: t.childFamily,
    symmetric: t.symmetric,
    containmentMargin: t.containmentMargin,
    heightRatio: t.oculusHeightRatio,
    radiusRatio: t.oculusRadiusRatio,
    clearance: t.oculusClearance,
    oculusHeightRatio: t.oculusHeightRatio,
    oculusRadiusRatio: t.oculusRadiusRatio,
    oculusClearance: t.oculusClearance,
    foilType: t.foilType,
    foilScale: t.foilScale,
    cuspDepth: t.cuspDepth,
    foilRotation: t.foilRotation,
    foilOrientation: t.foilOrientation,
    size: t.foilSize,
    outerFrameWidth: t.outerFrameWidth,
    windowBaseElevation: t.windowBaseElevation,
    minStoneWebWidth: t.minStoneWebWidth,
    enableSpandrelOpenings: t.enableSpandrelOpenings === true,
    enableBarNetwork: t.enableBarNetwork === true,
    enableElaborate: t.enableElaborate === true,
    enableSkeleton: t.enableSkeleton === true,
    enableOculusNetwork:
      t.enableOculusNetwork === true ||
      t.enableSecondaryTracery === true ||
      t.enableOculusRefinement === true ||
      t.enableHierarchicalTracery === true,
    enableSecondaryTracery:
      t.enableSecondaryTracery === true || t.enableHierarchicalTracery === true,
    enableOculusRefinement:
      t.enableOculusRefinement === true || t.enableHierarchicalTracery === true,
    enableHierarchicalTracery: t.enableHierarchicalTracery === true,
    hierarchicalDepth: t.hierarchicalDepth,
    nestedArches: t.nestedArches,
    trefoilHeads: t.trefoilHeads,
    secondaryQuatrefoils: t.secondaryQuatrefoils,
    childArchSpanRatio: t.childArchSpanRatio,
    childArchRiseRatio: t.childArchRiseRatio,
    secondaryArchWidthRatio: t.secondaryArchWidthRatio,
    tertiaryArchWidthRatio: t.tertiaryArchWidthRatio,
    hierarchicalFoilWidthRatio: t.hierarchicalFoilWidthRatio,
    hierarchicalMullionWidthRatio: t.hierarchicalMullionWidthRatio,
    hierarchicalJambInsetRatio: t.hierarchicalJambInsetRatio,
    minOpeningClearance: t.minOpeningClearance,
    secondaryTraceryLevel: t.secondaryTraceryLevel,
    secondaryMemberWidthRatio: t.secondaryMemberWidthRatio,
    foilBarWidthRatio: t.foilBarWidthRatio,
    sideCompartmentSubdivision: t.sideCompartmentSubdivision,
    oculusApexClearance: t.oculusApexClearance,
    centralJunctionScale: t.centralJunctionScale,
    foilToRingWidthRatio: t.foilToRingWidthRatio,
    foilRadialMode: t.foilRadialMode,
    masterFrameWidth: t.masterFrameWidth ?? t.outerFrameWidth,
    oculusVerticalPosition: t.oculusVerticalPosition,
    oculusRingWidthRatio: t.oculusRingWidthRatio,
    connectorWidthRatio: t.connectorWidthRatio,
    upperConnectorCurvature: t.upperConnectorCurvature,
    oculusSubdivision: t.oculusSubdivision,
    primaryArchWidthRatio: t.primaryArchWidthRatio,
    mullionWidthRatio: t.mullionWidthRatio,
    childArchWidthRatio: t.childArchWidthRatio,
    nestingDepth: t.nestingDepth,
    secondaryMullionWidth: t.secondaryMullionWidth,
    secondaryJambInset: t.secondaryJambInset,
    secondaryLancetRatio: t.secondaryLancetRatio,
    oculusScale: t.oculusScale,
    foilCount: t.foilCount,
    upperSubdivisionComplexity: t.upperSubdivisionComplexity,
    upperOpeningScale: t.upperOpeningScale,
    upperSubdivisionDensity: t.upperSubdivisionDensity,
    secondaryTraceryWidth: t.secondaryTraceryWidth,
    primaryMullionRatio: t.primaryMullionWidthRatio,
    lancetArchRatio: t.lancetArchWidthRatio,
    secondaryTraceryRatio: t.secondaryTraceryWidthRatio,
    oculusRingRatio: t.oculusFrameWidthRatio,
    foilBarRatio: t.foilBarWidthRatio,
    minWebClearance: t.minWebClearance,
    architecturePreset: t.architecturePreset,
    /** Included so example selection invalidates stoneGeometryKey (13E.3.2.1). */
    exampleId,
  }
  if (exampleId === 'trefoil') {
    return { exampleId, params: { ...base, foilType: FOIL_TYPES.trefoil } }
  }
  if (exampleId === 'quatrefoil') {
    return { exampleId, params: { ...base, foilType: FOIL_TYPES.quatrefoil } }
  }
  return { exampleId, params: base }
}

/**
 * Resolve authoritative window-design params from grammar settings.
 */
export function resolveWindowDesignParams(settings = {}) {
  const tracerySettings = { ...DEFAULT_TRACERY_SETTINGS, ...(settings.tracery ?? {}) }
  const stoneSettings = { ...DEFAULT_STONE_SETTINGS, ...(settings.stone ?? {}) }
  const { params: tracery } = buildWindowTraceryParams(tracerySettings)
  const stone = {
    ...DEFAULT_STONE_PARAMS,
    stoneDepth: stoneSettings.stoneDepth,
    depthAlignment: stoneSettings.depthAlignment,
    tessellation: stoneSettings.tessellation,
    moldingEnabled: stoneSettings.moldingEnabled,
    profileType: stoneSettings.profileType,
    profileWidth: stoneSettings.profileWidth,
    profileDepth: stoneSettings.profileDepth,
    chamferSize: stoneSettings.chamferSize,
    beadRadius: stoneSettings.beadRadius,
    recessDepth: stoneSettings.recessDepth,
    moldingOnOuter: stoneSettings.moldingOnOuter,
    moldingOnOpenings: stoneSettings.moldingOnOpenings,
    moldingHierarchy: stoneSettings.moldingHierarchy,
    architecturePreset: stoneSettings.architecturePreset ?? tracery.architecturePreset,
  }
  return {
    tracery,
    stone,
    settingsTracery: tracerySettings,
    settingsStone: stoneSettings,
    geometryKey: stoneGeometryKey(tracery, stone),
    linkMode: settings.assembly?.windowLinkMode ?? 'linked-to-master',
  }
}

/**
 * Editable Stone / 3D preset that recreates the preferred Assembly window.
 * Procedural — not a static mesh snapshot.
 */
export function applyRayonnantFacadeModulePreset(currentTracery = {}, currentStone = {}) {
  return applyArchitecturePreset(
    ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE,
    currentTracery,
    currentStone,
  )
}

/**
 * Frozen legacy Assembly window design (for regression / visual comparison).
 */
export function buildLegacyAssemblyWindowDesign(overrides = {}) {
  const snap = ASSEMBLY_RAYONNANT_LEGACY_SNAPSHOT
  const applied = applyArchitecturePreset(
    snap.architecturePreset,
    {
      span: DEFAULT_COMPOSED_PARAMS.span,
      riseRatio: DEFAULT_COMPOSED_PARAMS.riseRatio,
      springingY: DEFAULT_COMPOSED_PARAMS.springingY,
      windowBaseElevation: DEFAULT_REGION_PARAMS.windowBaseElevation,
      hierarchicalDepth: snap.hierarchicalDepth,
      ...(overrides.tracery ?? {}),
    },
    {
      stoneDepth: snap.stoneDepth,
      moldingEnabled: snap.moldingEnabled,
      ...(overrides.stone ?? {}),
    },
  )
  const tracery = {
    ...applied.tracery,
    enableHierarchicalTracery: true,
    enableSkeleton: true,
    enableOculusNetwork: true,
    enableSecondaryTracery: true,
    enableOculusRefinement: true,
    hierarchicalDepth: snap.hierarchicalDepth,
    architecturePreset: snap.architecturePreset,
    ...(overrides.tracery ?? {}),
  }
  const stone = {
    ...applied.stone,
    moldingEnabled: snap.moldingEnabled,
    stoneDepth: snap.stoneDepth,
    ...(overrides.stone ?? {}),
  }
  return { tracery, stone, snapshot: snap }
}

export function windowDesignSignature(tracery, stone) {
  return stoneGeometryKey(tracery, stone)
}

export function getFacadeModulePresetMeta() {
  return getArchitecturePreset(ARCHITECTURE_PRESETS.RAYONNANT_FACADE_MODULE)
}
