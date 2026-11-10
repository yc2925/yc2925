/**
 * Gothic structural articulation (Step 13E.2 / 13E.2.1).
 *
 * GOTHIC_CLUSTERED_PIER — core + engaged shafts + base + capital collar
 * GOTHIC_STEPPED_BUTTRESS — setback projection stages aligned to pier
 *
 * Hierarchy:
 *   PRIMARY   — pier core / buttress mass
 *   SECONDARY — engaged shafts / setback stages
 *   TERTIARY  — bases / collars / capital transitions
 *
 * 13E.2.1: shaft projection / base / capital / setbacks use amplified
 * dimensional rules so UI parameter changes are visually distinguishable
 * at facade framing distances.
 */

import { nextId } from '../kernel/result.js'
import { buildBoxMesh } from './boxSolid.js'
import { buildCylinderMesh } from './cylinderSolid.js'
import { validateMesh } from '../solids/meshValidation.js'
import {
  SUPPORT_STYLES,
  SHAFT_ARRANGEMENTS,
  DEFAULT_ASSEMBLY_PARAMS,
} from './assemblyTypes.js'

export { SUPPORT_STYLES, SHAFT_ARRANGEMENTS }

export const DEFAULT_ARTICULATION_PARAMS = Object.freeze({
  supportStyle: DEFAULT_ASSEMBLY_PARAMS.supportStyle,
  shaftArrangement: DEFAULT_ASSEMBLY_PARAMS.shaftArrangement,
  shaftRadiusRatio: DEFAULT_ASSEMBLY_PARAMS.shaftRadiusRatio,
  shaftProjection: DEFAULT_ASSEMBLY_PARAMS.shaftProjection,
  baseHeight: DEFAULT_ASSEMBLY_PARAMS.baseHeight,
  capitalHeight: DEFAULT_ASSEMBLY_PARAMS.capitalHeight,
  buttressSetbackCount: DEFAULT_ASSEMBLY_PARAMS.buttressSetbackCount,
  buttressSetbackRatio: DEFAULT_ASSEMBLY_PARAMS.buttressSetbackRatio,
  showBases: DEFAULT_ASSEMBLY_PARAMS.showBases,
  showCapitalTransitions: DEFAULT_ASSEMBLY_PARAMS.showCapitalTransitions,
})

/**
 * Deterministic engaged-shaft offsets in the pier local XZ plane (unit dirs).
 */
export function shaftOffsetDirections(arrangement) {
  if (arrangement === SHAFT_ARRANGEMENTS.SIMPLE) {
    return [[0, 1]] // forward (+Z) only
  }
  if (arrangement === SHAFT_ARRANGEMENTS.FOUR_SHAFT) {
    return [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]
  }
  return [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7071, 0.7071],
    [-0.7071, 0.7071],
    [0.7071, -0.7071],
    [-0.7071, -0.7071],
  ]
}

/**
 * Radial distance from pier center to shaft center.
 * shaftProjection ∈ [0,1]: 0 ≈ flush to core face, 1 ≈ strongly proud.
 */
export function shaftCenterOffset(halfExtent, shaftRadius, shaftProjection) {
  const t = Math.max(0, Math.min(1, shaftProjection))
  // Clear the core face (halfExtent + radius), then add a strong outward lever
  // so facade-scale framing can distinguish low vs high projection.
  const proud = Math.max(halfExtent, 0.12) * 1.65 * t
  return halfExtent + shaftRadius + proud
}

function pushPart(parts, role, hierarchy, built, id, meta = {}) {
  parts.push({
    id,
    role,
    hierarchy,
    mesh: built.mesh,
    volume: built.volume,
    boundingMin: built.boundingMin,
    boundingMax: built.boundingMax,
    ...meta,
  })
}

function validateParts(parts) {
  const errors = []
  const warnings = []
  let volume = 0
  for (const p of parts) {
    volume += p.volume
    const v = validateMesh(p.mesh, { requireWatertight: true })
    if (!v.ok) errors.push(`${p.id}: ${v.errors.join('; ')}`)
    if (v.edges?.nonManifoldEdgeCount) {
      errors.push(`${p.id}: ${v.edges.nonManifoldEdgeCount} non-manifold edges`)
    }
  }
  return { volume, errors, warnings }
}

/**
 * Semantic measurements for reactivity tests / UI diagnostics.
 */
export function measureSupportSemantics(support) {
  if (!support?.parts?.length) {
    return {
      shaftCount: 0,
      shaftOffsets: [],
      meanShaftOffset: 0,
      baseHeight: 0,
      capitalHeight: 0,
      buttressStageCount: 0,
      buttressStageProjections: [],
      buttressStageWidths: [],
    }
  }
  const x0 = support.x ?? 0
  const shafts = support.parts.filter((p) => p.role === 'ENGAGED_SHAFT')
  const shaftOffsets = shafts.map((s) => {
    const cx = (s.boundingMin[0] + s.boundingMax[0]) * 0.5
    const cz = (s.boundingMin[2] + s.boundingMax[2]) * 0.5
    return Math.hypot(cx - x0, cz)
  })
  const baseParts = support.parts.filter(
    (p) => p.role === 'PIER_PLINTH' || p.role === 'PIER_BASE_STEP',
  )
  const capParts = support.parts.filter(
    (p) => p.role === 'CAPITAL_COLLAR' || p.role === 'CAPITAL_TRANSITION',
  )
  const stages = support.parts.filter(
    (p) => p.role === 'BUTTRESS_MASS' || p.role === 'BUTTRESS_SETBACK',
  )
  const extentY = (parts) => {
    if (!parts.length) return 0
    const minY = Math.min(...parts.map((p) => p.boundingMin[1]))
    const maxY = Math.max(...parts.map((p) => p.boundingMax[1]))
    return maxY - minY
  }
  return {
    shaftCount: shafts.length,
    shaftOffsets,
    meanShaftOffset:
      shaftOffsets.length === 0
        ? 0
        : shaftOffsets.reduce((a, b) => a + b, 0) / shaftOffsets.length,
    baseHeight: extentY(baseParts),
    capitalHeight: extentY(capParts),
    buttressStageCount: stages.length,
    buttressStageProjections: stages.map((p) => p.boundingMax[2] - p.boundingMin[2]),
    buttressStageWidths: stages.map((p) => p.boundingMax[0] - p.boundingMin[0]),
  }
}

/**
 * Build GOTHIC_CLUSTERED_PIER at world X.
 */
export function buildGothicClusteredPier(opts = {}) {
  const id = opts.id ?? nextId('clustered-pier')
  const parentAssemblyId = opts.parentAssemblyId ?? null
  const pierWidth = Math.max(0.1, opts.pierWidth ?? 0.28)
  const pierDepth = Math.max(0.14, opts.pierDepth ?? 0.45)
  const pierHeight = Math.max(0.8, opts.pierHeight ?? 3.2)
  const groundY = opts.groundY ?? -0.35
  const x = opts.x ?? 0
  const arrangement = opts.shaftArrangement ?? SHAFT_ARRANGEMENTS.FOUR_SHAFT
  const shaftRadiusRatio = Math.max(0.1, Math.min(0.42, opts.shaftRadiusRatio ?? 0.28))
  const shaftProjection = Math.max(0, Math.min(1, opts.shaftProjection ?? 0.55))
  const baseHeight = Math.max(0.06, opts.baseHeight ?? 0.22)
  const capitalHeight = Math.max(0.05, opts.capitalHeight ?? 0.14)
  const showBases = opts.showBases !== false
  const showCapital = opts.showCapitalTransitions !== false

  const parts = []
  const shaftR = Math.min(pierWidth, pierDepth) * 0.5 * shaftRadiusRatio
  const reservedBase = showBases ? baseHeight : 0
  const reservedCap = showCapital ? capitalHeight : 0
  const coreH = Math.max(0.4, pierHeight - reservedBase - reservedCap)
  const coreBottom = groundY + reservedBase
  const coreCy = coreBottom + coreH * 0.5

  const core = buildBoxMesh({
    cx: x,
    cy: coreCy,
    cz: 0,
    sx: pierWidth,
    sy: coreH,
    sz: pierDepth,
    id: `${id}-core`,
  })
  pushPart(parts, 'PIER_CORE', 'PRIMARY', core, `${id}-core`)

  const dirs = shaftOffsetDirections(arrangement)
  const hx = pierWidth * 0.5
  const hz = pierDepth * 0.5
  const shaftH = coreH * 0.94
  const shaftCy = coreBottom + shaftH * 0.5 + coreH * 0.03
  dirs.forEach((dir, i) => {
    const [dx, dz] = dir
    const half = Math.abs(dx) >= Math.abs(dz) ? hx : hz
    const offset = shaftCenterOffset(half, shaftR, shaftProjection)
    const ox = dx * offset
    const oz = dz * offset
    const shaft = buildCylinderMesh({
      cx: x + ox,
      cy: shaftCy,
      cz: oz,
      radius: shaftR,
      height: shaftH,
      segments: 12,
      id: `${id}-shaft-${i}`,
    })
    pushPart(parts, 'ENGAGED_SHAFT', 'SECONDARY', shaft, `${id}-shaft-${i}`, {
      shaftIndex: i,
      shaftOffset: offset,
    })
  })

  if (showBases) {
    // Footprint grows with baseHeight so taller bases read clearly in elevation.
    const foot = 1.35 + baseHeight * 1.8
    const plinth = buildBoxMesh({
      cx: x,
      cy: groundY + baseHeight * 0.32,
      cz: 0,
      sx: pierWidth * foot,
      sy: baseHeight * 0.64,
      sz: pierDepth * (foot * 0.92),
      id: `${id}-plinth`,
    })
    pushPart(parts, 'PIER_PLINTH', 'TERTIARY', plinth, `${id}-plinth`)
    const step = buildBoxMesh({
      cx: x,
      cy: groundY + baseHeight * 0.78,
      cz: 0,
      sx: pierWidth * (foot * 0.78),
      sy: baseHeight * 0.36,
      sz: pierDepth * (foot * 0.72),
      id: `${id}-base-step`,
    })
    pushPart(parts, 'PIER_BASE_STEP', 'TERTIARY', step, `${id}-base-step`)
  }

  if (showCapital) {
    const collarY = coreBottom + coreH
    const overshoot = 1.15 + capitalHeight * 2.2
    const collar = buildBoxMesh({
      cx: x,
      cy: collarY + capitalHeight * 0.32,
      cz: 0,
      sx: pierWidth * overshoot,
      sy: capitalHeight * 0.55,
      sz: pierDepth * (overshoot * 0.9),
      id: `${id}-collar`,
    })
    pushPart(parts, 'CAPITAL_COLLAR', 'TERTIARY', collar, `${id}-collar`)
    const cap = buildBoxMesh({
      cx: x,
      cy: collarY + capitalHeight * 0.78,
      cz: 0,
      sx: pierWidth * (overshoot * 0.82),
      sy: capitalHeight * 0.4,
      sz: pierDepth * (overshoot * 0.78),
      id: `${id}-capital`,
    })
    pushPart(parts, 'CAPITAL_TRANSITION', 'TERTIARY', cap, `${id}-capital`)
  }

  const { volume, errors, warnings } = validateParts(parts)
  const semantics = measureSupportSemantics({
    x,
    parts,
  })
  return {
    type: 'GOTHIC_CLUSTERED_PIER',
    id,
    parentAssemblyId,
    role: 'STRUCTURAL_SUPPORT',
    x,
    pierWidth,
    pierDepth,
    pierHeight,
    shaftArrangement: arrangement,
    shaftCount: dirs.length,
    shaftProjection,
    shaftRadiusRatio,
    baseHeight: showBases ? baseHeight : 0,
    capitalHeight: showCapital ? capitalHeight : 0,
    groundY,
    parts,
    volume,
    transform: { position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    validation: { ok: errors.length === 0, errors, warnings },
    semantic: {
      primaryCount: parts.filter((p) => p.hierarchy === 'PRIMARY').length,
      secondaryCount: parts.filter((p) => p.hierarchy === 'SECONDARY').length,
      tertiaryCount: parts.filter((p) => p.hierarchy === 'TERTIARY').length,
      ...semantics,
    },
  }
}

/**
 * Build GOTHIC_STEPPED_BUTTRESS projecting +Z from pier face.
 * Stages reduce projection AND width by setbackRatio each level.
 */
export function buildGothicSteppedButtress(opts = {}) {
  const id = opts.id ?? nextId('stepped-buttress')
  const parentAssemblyId = opts.parentAssemblyId ?? null
  const x = opts.x ?? 0
  const groundY = opts.groundY ?? -0.35
  const pierDepth = Math.max(0.12, opts.pierDepth ?? 0.45)
  const pierWidth = Math.max(0.1, opts.pierWidth ?? 0.28)
  const pierHeight = Math.max(0.8, opts.pierHeight ?? 3.2)
  const buttressWidth = Math.max(0.08, opts.buttressWidth ?? pierWidth * 1.05)
  // Amplify projection so setbacks read in three-quarter / side views.
  const buttressProjection = Math.max(0.12, opts.buttressProjection ?? 0.35)
  const buttressHeight = Math.max(0.5, opts.buttressHeight ?? pierHeight * 0.9)
  const setbackCount = Math.max(1, Math.min(5, Math.round(opts.buttressSetbackCount ?? 3)))
  const setbackRatio = Math.max(0.45, Math.min(0.92, opts.buttressSetbackRatio ?? 0.72))

  const parts = []
  let remainingH = buttressHeight
  let stageBottom = groundY
  let projection = buttressProjection
  let width = buttressWidth

  for (let s = 0; s < setbackCount; s += 1) {
    const isLast = s === setbackCount - 1
    // Equal-ish stage heights so count changes are obvious.
    const stageH = isLast
      ? remainingH
      : Math.max(0.14, remainingH / (setbackCount - s))
    const stageHClamped = Math.min(remainingH, stageH)
    const cz = pierDepth * 0.5 + projection * 0.5
    const stage = buildBoxMesh({
      cx: x,
      cy: stageBottom + stageHClamped * 0.5,
      cz,
      sx: width,
      sy: stageHClamped,
      sz: projection,
      id: `${id}-stage-${s}`,
    })
    pushPart(
      parts,
      s === 0 ? 'BUTTRESS_MASS' : 'BUTTRESS_SETBACK',
      s === 0 ? 'PRIMARY' : 'SECONDARY',
      stage,
      `${id}-stage-${s}`,
      { stageIndex: s, stageProjection: projection, stageWidth: width },
    )
    if (!isLast) {
      const tableH = Math.min(0.08, Math.max(0.035, stageHClamped * 0.1))
      const table = buildBoxMesh({
        cx: x,
        cy: stageBottom + stageHClamped + tableH * 0.5,
        cz: pierDepth * 0.5 + projection * 0.58,
        sx: width * 1.12,
        sy: tableH,
        sz: projection * 1.08,
        id: `${id}-table-${s}`,
      })
      pushPart(parts, 'BUTTRESS_TABLE', 'TERTIARY', table, `${id}-table-${s}`)
      stageBottom += stageHClamped + tableH
      remainingH -= stageHClamped + tableH
    } else {
      stageBottom += stageHClamped
      remainingH -= stageHClamped
    }
    // Strong dimensional response: both depth and elevation-visible width shrink.
    projection *= setbackRatio
    width *= setbackRatio
  }

  const { volume, errors, warnings } = validateParts(parts)
  const semantics = measureSupportSemantics({ x, parts })
  return {
    type: 'GOTHIC_STEPPED_BUTTRESS',
    id,
    parentAssemblyId,
    role: 'STRUCTURAL_SUPPORT',
    x,
    setbackCount,
    setbackRatio,
    buttressProjection,
    buttressHeight,
    groundY,
    parts,
    volume,
    transform: { position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    validation: { ok: errors.length === 0, errors, warnings },
    semantic: semantics,
  }
}

/**
 * Dispatch articulated support by style.
 */
export function buildArticulatedSupport(opts = {}) {
  const style = opts.supportStyle ?? SUPPORT_STYLES.SIMPLE
  const id = opts.id ?? nextId('support')
  const parentAssemblyId = opts.parentAssemblyId ?? null
  const x = opts.x ?? 0
  const groundY = opts.groundY ?? -0.35
  const pierWidth = opts.pierWidth ?? 0.28
  const pierDepth = opts.pierDepth ?? 0.45
  const pierHeight = opts.pierHeight ?? 3.2
  const buttressProjection = Math.max(0.12, opts.buttressProjection ?? 0.35)

  if (style === SUPPORT_STYLES.SIMPLE) {
    return null
  }

  const parts = []
  const errors = []
  const warnings = []
  let volume = 0
  let pier = null
  let buttress = null

  const wantPier =
    style === SUPPORT_STYLES.CLUSTERED_PIER || style === SUPPORT_STYLES.COMBINED
  const wantButtress =
    (style === SUPPORT_STYLES.STEPPED_BUTTRESS || style === SUPPORT_STYLES.COMBINED) &&
    buttressProjection > 1e-6

  if (wantPier) {
    pier = buildGothicClusteredPier({
      ...opts,
      id: `${id}-pier`,
      parentAssemblyId,
    })
    parts.push(...pier.parts)
    volume += pier.volume
    errors.push(...(pier.validation?.errors ?? []))
    warnings.push(...(pier.validation?.warnings ?? []))
  } else if (style === SUPPORT_STYLES.STEPPED_BUTTRESS) {
    const core = buildBoxMesh({
      cx: x,
      cy: groundY + pierHeight * 0.5,
      cz: 0,
      sx: pierWidth,
      sy: pierHeight,
      sz: pierDepth,
      id: `${id}-core`,
    })
    pushPart(parts, 'PIER_CORE', 'PRIMARY', core, `${id}-core`)
    volume += core.volume
    const v = validateMesh(core.mesh, { requireWatertight: true })
    if (!v.ok) errors.push(`${id}-core: ${v.errors.join('; ')}`)
  }

  if (wantButtress) {
    buttress = buildGothicSteppedButtress({
      ...opts,
      id: `${id}-buttress`,
      parentAssemblyId,
      buttressWidth: pierWidth * 1.05,
      buttressHeight: pierHeight * 0.9,
      buttressProjection,
    })
    parts.push(...buttress.parts)
    volume += buttress.volume
    errors.push(...(buttress.validation?.errors ?? []))
    warnings.push(...(buttress.validation?.warnings ?? []))
  }

  const semantics = measureSupportSemantics({ x, parts })
  return {
    type: 'ARTICULATED_SUPPORT',
    id,
    parentAssemblyId,
    role: 'STRUCTURAL_SUPPORT',
    supportStyle: style,
    x,
    pierWidth,
    pierDepth,
    pierHeight,
    buttressProjection,
    groundY,
    parts,
    volume,
    pier,
    buttress,
    transform: { position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    validation: { ok: errors.length === 0, errors, warnings },
    semantic: {
      primaryCount: parts.filter((p) => p.hierarchy === 'PRIMARY').length,
      secondaryCount: parts.filter((p) => p.hierarchy === 'SECONDARY').length,
      tertiaryCount: parts.filter((p) => p.hierarchy === 'TERTIARY').length,
      ...semantics,
    },
  }
}

export function supportStyleUsesShafts(style) {
  return (
    style === SUPPORT_STYLES.CLUSTERED_PIER || style === SUPPORT_STYLES.COMBINED
  )
}

export function supportStyleUsesButtress(style) {
  return (
    style === SUPPORT_STYLES.STEPPED_BUTTRESS || style === SUPPORT_STYLES.COMBINED
  )
}

export function supportStyleUsesBaseCapital(style) {
  return supportStyleUsesShafts(style)
}
