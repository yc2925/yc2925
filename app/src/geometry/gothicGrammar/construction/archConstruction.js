/**
 * Map pointed-arch results into Grammar-tab construction documents.
 * Visualization helpers only — does not alter arch mathematics.
 */

import { sampleCircle, sampleSegment } from '../kernel/sampling.js'
import { createConstructionResult, markInvalid } from '../kernel/result.js'
import { createSegment } from '../kernel/line2.js'
import { point } from '../kernel/vector2.js'
import {
  ARCH_FAMILIES,
  ARCH_FAMILY_META,
  DEFAULT_ARCH_PARAMS,
} from '../primitives/archFamilies.js'
import { buildPointedArch, ARCH_SEMANTICS } from '../primitives/pointedArch.js'

/** Side-by-side spacing multiplier (× span) to avoid circle overlap in construction view. */
const COMPARE_GAP_FACTOR = 1.55
const LABEL_OFFSET_Y = 0.55
const RATIO_OFFSET_Y = 0.78
const SPAN_DIM_OFFSET_Y = 0.28
const RISE_DIM_OFFSET_X = 0.22

/**
 * Single editable pointed arch → construction result for the scene.
 */
export function buildArchConstruction(params = {}, display = {}) {
  const arch = buildPointedArch({ ...DEFAULT_ARCH_PARAMS, ...params })
  return archToConstruction(arch, {
    ...display,
    mode: 'pointed-arch',
  })
}

/**
 * Side-by-side comparison of three families (same span, aligned springings).
 */
export function buildArchComparison(params = {}, display = {}) {
  const span = params.span ?? DEFAULT_ARCH_PARAMS.span
  const springingY = params.springingY ?? DEFAULT_ARCH_PARAMS.springingY
  const samplingQuality = params.samplingQuality ?? DEFAULT_ARCH_PARAMS.samplingQuality
  const gap = span * COMPARE_GAP_FACTOR

  const families = [
    {
      family: ARCH_FAMILIES.equilateral,
      offsetX: -gap,
      riseRatio: ARCH_FAMILY_META.equilateral.defaultRiseRatio,
    },
    {
      family: ARCH_FAMILIES.lancet,
      offsetX: 0,
      riseRatio: params.lancetRiseRatio ?? ARCH_FAMILY_META.lancet.defaultRiseRatio,
    },
    {
      family: ARCH_FAMILIES.depressed,
      offsetX: gap,
      riseRatio: params.depressedRiseRatio ?? ARCH_FAMILY_META.depressed.defaultRiseRatio,
    },
  ]

  const arches = families.map((f) =>
    buildPointedArch({
      family: f.family,
      span,
      riseRatio: f.riseRatio,
      springingY,
      samplingQuality,
      offsetX: f.offsetX,
    }),
  )

  const primitives = []
  const derivedPoints = []
  const curves = []
  const annotations = []
  const errors = []
  let allOk = true

  for (const arch of arches) {
    const part = archToConstructionParts(arch, display, {
      labelPrefix: arch.family,
      includeFamilyLabel: true,
    })
    primitives.push(...part.primitives)
    derivedPoints.push(...part.derivedPoints)
    curves.push(...part.curves)
    annotations.push(...part.annotations)
    if (!arch.validation?.ok) {
      allOk = false
      errors.push(...(arch.validation?.errors ?? [`${arch.family} invalid`]))
    }
  }

  const y0 = springingY
  const springLine = createSegment(
    point(-gap - span / 2 - 0.15, y0),
    point(gap + span / 2 + 0.15, y0),
  )
  if (display.showSpringing !== false) {
    curves.push({
      id: 'springing-line',
      role: 'guide',
      samples: sampleSegment(springLine, 1),
    })
  }

  let result = createConstructionResult({
    type: 'arch-comparison',
    parameters: { span, springingY, samplingQuality, mode: 'compare' },
    primitives,
    derivedPoints,
    constraints: arches.map((a) => ({
      type: 'pointed-arch',
      family: a.family,
      residuals: a.residuals,
      ok: a.validation?.ok,
    })),
    curves,
    validation: { ok: allOk, errors, warnings: [] },
    metadata: {
      title: 'Compare Arch Families',
      arches,
      annotations,
      references: ['REF-008', 'REF-007', 'REF-011'],
      framingPadY: RATIO_OFFSET_Y + 0.15,
    },
  })
  if (!allOk) result = markInvalid(result, errors[0] ?? 'comparison invalid')
  return result
}

function archToConstruction(arch, display = {}) {
  const parts = archToConstructionParts(arch, display, { includeFamilyLabel: false })
  let result = createConstructionResult({
    type: 'pointed-arch',
    parameters: arch.parameters,
    primitives: parts.primitives,
    derivedPoints: parts.derivedPoints,
    constraints: [{ type: 'pointed-arch', residuals: arch.residuals }],
    curves: parts.curves,
    validation: arch.validation,
    metadata: {
      ...arch.metadata,
      title: `Pointed Arch · ${arch.metadata?.title ?? arch.family}`,
      arch,
      mode: display.mode ?? 'pointed-arch',
      derived: arch.derived,
      annotations: parts.annotations,
      framingPadY: 0.35,
    },
  })
  if (!arch.validation?.ok) {
    result = markInvalid(result, arch.validation?.errors?.[0] ?? 'invalid arch')
  }
  return result
}

function formatRatio(r) {
  return Number(r).toFixed(3)
}

function formatMeters(m) {
  return `${Number(m).toFixed(2)} m`
}

function archToConstructionParts(arch, display = {}, opts = {}) {
  const prefix = opts.labelPrefix ? `${opts.labelPrefix}-` : ''
  const showConstruction = display.showConstruction === true
  const showCenters = display.showCenters === true
  const showPoints = display.showPoints === true
  const showAxis = display.showArchAxis === true
  const showResult = display.showResult !== false
  const showDimensions = display.showDimensions !== false

  const primitives = []
  const derivedPoints = []
  const curves = []
  const annotations = []

  const A = arch.points[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = arch.points[ARCH_SEMANTICS.APEX]
  const CA = arch.points[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const CB = arch.points[ARCH_SEMANTICS.RIGHT_ARC_CENTER]

  if (showPoints && A) {
    primitives.push({ id: `${prefix}A`, type: 'point', ...A, role: 'endpoint', label: A.label })
    primitives.push({ id: `${prefix}B`, type: 'point', ...B, role: 'endpoint', label: B.label })
    primitives.push({ id: `${prefix}P`, type: 'point', ...P, role: 'endpoint', label: P.label })
  }
  if (showCenters && CA) {
    primitives.push({ id: `${prefix}CA`, type: 'point', ...CA, role: 'center', label: CA.label })
    primitives.push({ id: `${prefix}CB`, type: 'point', ...CB, role: 'center', label: CB.label })
  }

  if (showResult) {
    curves.push({
      id: `${prefix}left`,
      role: 'result',
      samples: arch.samples.left,
      semantic: ARCH_SEMANTICS.LEFT_ARC,
      prominence: 'primary',
    })
    curves.push({
      id: `${prefix}right`,
      role: 'result',
      samples: arch.samples.right,
      semantic: ARCH_SEMANTICS.RIGHT_ARC,
      prominence: 'primary',
    })
  }

  if (showConstruction && arch.circles?.left) {
    curves.push({
      id: `${prefix}circL`,
      role: 'construction',
      closed: true,
      samples: sampleCircle(arch.circles.left, 72),
      prominence: 'secondary',
    })
    curves.push({
      id: `${prefix}circR`,
      role: 'construction',
      closed: true,
      samples: sampleCircle(arch.circles.right, 72),
      prominence: 'secondary',
    })
    if (A && CA) {
      curves.push({
        id: `${prefix}radLA`,
        role: 'construction',
        samples: sampleSegment(createSegment(CA, A), 1),
        prominence: 'secondary',
      })
      curves.push({
        id: `${prefix}radLP`,
        role: 'construction',
        samples: sampleSegment(createSegment(CA, P), 1),
        prominence: 'secondary',
      })
      curves.push({
        id: `${prefix}radRB`,
        role: 'construction',
        samples: sampleSegment(createSegment(CB, B), 1),
        prominence: 'secondary',
      })
      curves.push({
        id: `${prefix}radRP`,
        role: 'construction',
        samples: sampleSegment(createSegment(CB, P), 1),
        prominence: 'secondary',
      })
    }
  }

  if (showAxis && arch.symmetryAxis) {
    curves.push({
      id: `${prefix}axis`,
      role: 'construction',
      samples: sampleSegment(arch.symmetryAxis, 1),
      semantic: ARCH_SEMANTICS.SYMMETRY_AXIS,
      prominence: 'secondary',
    })
  }

  if (showDimensions && A && B && P) {
    const midX = (A.x + B.x) / 2
    const spanY = A.y - SPAN_DIM_OFFSET_Y
    curves.push({
      id: `${prefix}dim-span`,
      role: 'dimension',
      samples: [
        { x: A.x, y: spanY },
        { x: B.x, y: spanY },
      ],
      prominence: 'annotation',
    })
    // End ticks
    curves.push({
      id: `${prefix}dim-span-tick-a`,
      role: 'dimension',
      samples: [
        { x: A.x, y: spanY - 0.06 },
        { x: A.x, y: spanY + 0.06 },
      ],
      prominence: 'annotation',
    })
    curves.push({
      id: `${prefix}dim-span-tick-b`,
      role: 'dimension',
      samples: [
        { x: B.x, y: spanY - 0.06 },
        { x: B.x, y: spanY + 0.06 },
      ],
      prominence: 'annotation',
    })
    annotations.push({
      id: `${prefix}span-label`,
      kind: 'dimension',
      x: midX,
      y: spanY - 0.14,
      text: `SPAN  ${formatMeters(arch.parameters.span)}`,
    })

    const riseX = midX + RISE_DIM_OFFSET_X
    curves.push({
      id: `${prefix}dim-rise`,
      role: 'dimension',
      samples: [
        { x: riseX, y: A.y },
        { x: riseX, y: P.y },
      ],
      prominence: 'annotation',
    })
    annotations.push({
      id: `${prefix}rise-label`,
      kind: 'dimension',
      x: riseX + 0.12,
      y: (A.y + P.y) / 2,
      text: `RISE  ${formatMeters(arch.parameters.rise)}`,
      align: 'left',
    })
  }

  if (opts.includeFamilyLabel && A) {
    const ox = arch.parameters.offsetX ?? 0
    const y0 = arch.parameters.springingY
    const ratio = arch.parameters.riseRatio
    annotations.push({
      id: `${prefix}family-label`,
      kind: 'family-label',
      x: ox,
      y: y0 - LABEL_OFFSET_Y,
      text: ARCH_FAMILY_META[arch.family].label.toUpperCase(),
    })
    annotations.push({
      id: `${prefix}family-ratio`,
      kind: 'family-ratio',
      x: ox,
      y: y0 - RATIO_OFFSET_Y,
      text: `h/S  ${formatRatio(ratio)}`,
    })
  }

  return { primitives, derivedPoints, curves, annotations }
}

/**
 * Bounds for camera framing. By default excludes construction guides
 * so hidden circles do not pull the frame wide.
 */
export function archFramingBounds(result, opts = {}) {
  const includeConstruction = opts.includeConstruction === true
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  const consider = (p) => {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }

  for (const c of result.curves ?? []) {
    if (c.role === 'construction' && !includeConstruction) continue
    if (c.role === 'guide' && !includeConstruction) continue
    for (const p of c.samples ?? []) consider(p)
  }

  // Always include annotation anchors (labels sit below geometry)
  for (const a of result.metadata?.annotations ?? []) consider(a)

  if (includeConstruction) {
    for (const pr of result.primitives ?? []) {
      if (pr.type === 'point') consider(pr)
    }
  } else {
    // Springings / apex only — not centers
    for (const pr of result.primitives ?? []) {
      if (pr.type === 'point' && pr.role === 'endpoint') consider(pr)
    }
  }

  const padY = result.metadata?.framingPadY ?? 0.2
  if (Number.isFinite(minY)) minY -= padY

  if (!Number.isFinite(minX)) {
    return { min: { x: -2, y: -1 }, max: { x: 2, y: 3 }, width: 4, height: 4 }
  }
  return {
    min: { x: minX, y: minY },
    max: { x: maxX, y: maxY },
    width: maxX - minX,
    height: maxY - minY,
  }
}

export { archToConstruction }
