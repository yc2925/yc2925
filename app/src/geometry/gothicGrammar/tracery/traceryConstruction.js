/**
 * Map tracery graphs → Grammar-tab construction documents (visualization).
 * Does not alter underlying geometric construction.
 */

import { sampleCircle, sampleSegment } from '../kernel/sampling.js'
import { createConstructionResult, markInvalid } from '../kernel/result.js'
import { ARCH_SEMANTICS } from '../primitives/archFamilies.js'
import { FOIL_TYPES } from './roles.js'
import { buildLancetSubdivision } from './lancetSubdivision.js'
import { buildOculusPlacement } from './oculus.js'
import { buildComposedWindow, buildFoilExample } from './composedWindow.js'
import { archFramingBounds } from '../construction/archConstruction.js'
import { extractTraceryConstructionGeometry } from '../construction/constructionGeometry.js'
import { buildSolidVoidModel, buildFoilSolidVoid, REGION_TYPES } from './solidVoid.js'
import { DEFAULT_REGION_PARAMS } from './regionRoles.js'

/**
 * Build construction document for a tracery example id.
 */
export function buildTraceryConstruction(exampleId, params = {}, display = {}) {
  let graph
  let solidVoid = null
  switch (exampleId) {
    case 'lancet-subdivision':
      graph = buildLancetSubdivision(params)
      break
    case 'trefoil':
      graph = buildFoilExample(FOIL_TYPES.trefoil, params)
      solidVoid = buildFoilSolidVoid(FOIL_TYPES.trefoil, params)
      break
    case 'quatrefoil':
      graph = buildFoilExample(FOIL_TYPES.quatrefoil, params)
      solidVoid = buildFoilSolidVoid(FOIL_TYPES.quatrefoil, params)
      break
    case 'oculus-placement':
      graph = buildOculusPlacement(params)
      break
    case 'composed-window':
      graph = buildComposedWindow(params)
      solidVoid = buildSolidVoidModel(params)
      break
    default:
      graph = buildComposedWindow(params)
      solidVoid = buildSolidVoidModel(params)
  }
  const result = graphToConstruction(graph, display, solidVoid)
  return result
}

export function graphToConstruction(graph, display = {}, solidVoid = null) {
  const sectionMode = display.displayState === 'section' || display.showSection === true
  const showConstruction = !sectionMode && display.showConstruction === true
  const showCenters = !sectionMode && display.showCenters === true
  const showPoints = !sectionMode && display.showPoints === true
  const showResult = !sectionMode && display.showResult !== false
  const showDimensions = !sectionMode && display.showDimensions !== false
  const showArchAxis = !sectionMode && display.showArchAxis === true
  const showFamilyLabels = !sectionMode && display.showFamilyLabels !== false
  const showMullionCenterlines =
    !sectionMode && display.showMullionCenterlines !== false
  const showFoilConstruction =
    !sectionMode && display.showFoilConstruction !== false

  const primitives = []
  const derivedPoints = []
  const curves = []
  const annotations = []

  const parent = graph.metadata?.parent
  const leftChild = graph.metadata?.leftChild
  const rightChild = graph.metadata?.rightChild
  const mullion = graph.metadata?.mullion
  const oculus = graph.metadata?.oculus
  const foil = graph.metadata?.foil

  if (sectionMode && solidVoid?.regions) {
    appendSectionCurves(solidVoid, curves)
  }

  // Standalone foil example
  if (!sectionMode && !parent && foil) {
    appendFoil(foil, 'foil', {
      primitives,
      curves,
      annotations,
      showConstruction: showConstruction && showFoilConstruction,
      showCenters: showCenters && showFoilConstruction,
      showPoints: showPoints && showFoilConstruction,
      showResult,
    })
    if (showDimensions && foil.parameters?.size) {
      annotations.push({
        id: 'foil-size',
        kind: 'dimension',
        x: foil.center.x,
        y: foil.center.y - foil.parameters.size - 0.28,
        text: `SIZE  ${foil.parameters.size.toFixed(2)} m`,
      })
    }
  }

  if (!sectionMode && parent) {
    appendArch(parent, 'parent', {
      primitives,
      curves,
      showConstruction,
      showCenters,
      showPoints,
      showResult,
      showArchAxis,
      prominence: 'primary',
    })
    if (showDimensions) {
      appendArchDimensions(parent, 'parent', { curves, annotations })
    }
  }

  if (!sectionMode && leftChild) {
    appendArch(leftChild, 'left', {
      primitives,
      curves,
      showConstruction,
      showCenters,
      showPoints,
      showResult,
      showArchAxis: false,
      prominence: 'primary',
    })
  }
  if (!sectionMode && rightChild) {
    appendArch(rightChild, 'right', {
      primitives,
      curves,
      showConstruction,
      showCenters,
      showPoints,
      showResult,
      showArchAxis: false,
      prominence: 'primary',
    })
  }

  if (!sectionMode && mullion?.segment) {
    // Final mullion stays a result curve; overlay adds a separate guide (no topology change).
    if (showResult) {
      curves.push({
        id: 'mullion',
        role: 'result',
        samples: sampleSegment(mullion.segment, 1),
        prominence: 'primary',
      })
    }
    if (showConstruction && showMullionCenterlines) {
      curves.push({
        id: 'mullion-guide',
        role: 'guide',
        samples: sampleSegment(mullion.segment, 1),
        prominence: 'secondary',
      })
    }
    if (showPoints && showMullionCenterlines) {
      primitives.push({
        id: 'mullion-base',
        type: 'point',
        ...mullion.segment.a,
        role: 'endpoint',
        label: 'M₀',
      })
      primitives.push({
        id: 'mullion-top',
        type: 'point',
        ...mullion.segment.b,
        role: 'endpoint',
        label: 'M₁',
      })
    }
  }

  if (!sectionMode && oculus?.circle) {
    // Oculus is construction geometry — never an architectural hole in solid/void.
    if (showResult && !solidVoid) {
      curves.push({
        id: 'oculus',
        role: 'result',
        closed: true,
        samples: sampleCircle(oculus.circle, 72),
        prominence: 'primary',
      })
    }
    if (showConstruction) {
      curves.push({
        id: 'oculus-guide',
        role: 'construction',
        closed: true,
        samples: sampleCircle(oculus.circle, 72),
        prominence: 'secondary',
      })
    }
    if (showCenters && oculus.center) {
      primitives.push({
        id: 'oculus-center',
        type: 'point',
        ...oculus.center,
        role: 'center',
        label: 'O',
      })
    }
  }

  if (!sectionMode && foil && parent) {
    appendFoil(foil, 'upper-foil', {
      primitives,
      curves,
      annotations,
      showConstruction: showConstruction && showFoilConstruction,
      showCenters: showCenters && showFoilConstruction,
      showPoints: showPoints && showFoilConstruction,
      showResult,
    })
  }

  // Labels (presentation: minimal) — never in SECTION
  const mode = graph.metadata?.mode
  if (showFamilyLabels && (mode === 'composed-window' || mode === 'lancet-subdivision')) {
    annotations.push({
      id: 'mode-label',
      kind: 'family-label',
      x: 0,
      y: (parent?.parameters?.springingY ?? 0) - 0.45,
      text: (graph.metadata?.title ?? 'TRACERY').toUpperCase(),
    })
  }
  if (showFamilyLabels && (mode === 'trefoil' || mode === 'quatrefoil')) {
    annotations.push({
      id: 'foil-label',
      kind: 'family-label',
      x: foil?.center?.x ?? 0,
      y: (foil?.center?.y ?? 0) - (foil?.parameters?.size ?? 1) - 0.45,
      text: (foil?.metadata?.title ?? mode).toUpperCase(),
    })
  }

  const validation = mergeValidation(graph.validation, solidVoid?.validation)

  const constructionGeometry = extractTraceryConstructionGeometry(graph)

  let result = createConstructionResult({
    type: 'tracery',
    parameters: { ...graph.parameters, ...DEFAULT_REGION_PARAMS, ...(solidVoid?.parameters ?? {}) },
    primitives,
    derivedPoints,
    constraints: graph.constraints ?? [],
    curves,
    validation,
    metadata: {
      title: sectionMode
        ? `Section · ${graph.metadata?.title ?? 'Tracery'}`
        : graph.metadata?.title ?? 'Tracery',
      references: graph.metadata?.references ?? solidVoid?.metadata?.references ?? [],
      graph,
      solidVoid,
      annotations: sectionMode ? [] : annotations,
      constructionGeometry,
      framingPadY: 0.5,
      mode: graph.metadata?.mode,
      displayState: display.displayState ?? 'presentation',
      regionMetrics: solidVoid?.metrics ?? null,
    },
  })

  if (!validation?.ok) {
    result = markInvalid(result, validation?.errors?.[0] ?? 'tracery invalid')
  }
  return result
}

function mergeValidation(a, b) {
  if (!b) return a ?? { ok: true, errors: [], warnings: [] }
  if (!a) return b
  return {
    ok: a.ok !== false && b.ok !== false,
    errors: [...(a.errors ?? []), ...(b.errors ?? [])],
    warnings: [...(a.warnings ?? []), ...(b.warnings ?? [])],
  }
}

function appendSectionCurves(solidVoid, curves) {
  const stone = solidVoid.regions?.[REGION_TYPES.STONE_REGION]
  const outer = solidVoid.regions?.[REGION_TYPES.OUTER_BOUNDARY]
  const voids = [
    solidVoid.regions?.[REGION_TYPES.LEFT_LANCET_VOID],
    solidVoid.regions?.[REGION_TYPES.RIGHT_LANCET_VOID],
    solidVoid.regions?.[REGION_TYPES.UPPER_FOIL_VOID],
  ].filter(Boolean)

  if (outer?.samples?.length) {
    curves.push({
      id: 'section-outer',
      role: 'result',
      closed: true,
      samples: outer.samples,
      prominence: 'primary',
      regionRole: REGION_TYPES.OUTER_BOUNDARY,
    })
  }
  for (const v of voids) {
    if (!v.samples?.length) continue
    curves.push({
      id: `section-void-${v.id}`,
      role: 'result',
      closed: true,
      samples: v.samples,
      prominence: 'primary',
      regionRole: v.type,
    })
  }
  // Attach fill recipe for the scene (exact edges kept on solidVoid)
  if (stone) {
    curves.push({
      id: 'section-stone-fill',
      role: 'region-fill',
      regionRole: REGION_TYPES.STONE_REGION,
      outerSamples: outer?.samples ?? [],
      holeSamples: voids.map((v) => v.samples ?? []),
      solidVoidId: solidVoid.id,
    })
  }
}

function appendArch(arch, prefix, opts) {
  const {
    primitives,
    curves,
    showConstruction,
    showCenters,
    showPoints,
    showResult,
    showArchAxis,
  } = opts

  const A = arch.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = arch.points?.[ARCH_SEMANTICS.APEX]
  const CA = arch.points?.[ARCH_SEMANTICS.LEFT_ARC_CENTER]
  const CB = arch.points?.[ARCH_SEMANTICS.RIGHT_ARC_CENTER]

  if (showPoints && A) {
    primitives.push({ id: `${prefix}-A`, type: 'point', ...A, role: 'endpoint', label: A.label })
    primitives.push({ id: `${prefix}-B`, type: 'point', ...B, role: 'endpoint', label: B.label })
    primitives.push({ id: `${prefix}-P`, type: 'point', ...P, role: 'endpoint', label: P.label })
  }
  if (showCenters && CA) {
    primitives.push({ id: `${prefix}-CA`, type: 'point', ...CA, role: 'center', label: CA.label })
    primitives.push({ id: `${prefix}-CB`, type: 'point', ...CB, role: 'center', label: CB.label })
  }

  if (showResult) {
    curves.push({
      id: `${prefix}-left`,
      role: 'result',
      samples: arch.samples.left,
      prominence: 'primary',
    })
    curves.push({
      id: `${prefix}-right`,
      role: 'result',
      samples: arch.samples.right,
      prominence: 'primary',
    })
  }

  if (showConstruction && arch.circles?.left) {
    curves.push({
      id: `${prefix}-circL`,
      role: 'construction',
      closed: true,
      samples: sampleCircle(arch.circles.left, 64),
      prominence: 'secondary',
    })
    curves.push({
      id: `${prefix}-circR`,
      role: 'construction',
      closed: true,
      samples: sampleCircle(arch.circles.right, 64),
      prominence: 'secondary',
    })
  }

  if (showArchAxis && arch.symmetryAxis) {
    curves.push({
      id: `${prefix}-axis`,
      role: 'construction',
      samples: sampleSegment(arch.symmetryAxis, 1),
      prominence: 'secondary',
    })
  }
}

function appendArchDimensions(arch, prefix, { curves, annotations }) {
  const A = arch.points?.[ARCH_SEMANTICS.LEFT_SPRINGING]
  const B = arch.points?.[ARCH_SEMANTICS.RIGHT_SPRINGING]
  const P = arch.points?.[ARCH_SEMANTICS.APEX]
  if (!A || !B || !P) return
  const midX = (A.x + B.x) / 2
  const spanY = A.y - 0.28
  curves.push({
    id: `${prefix}-dim-span`,
    role: 'dimension',
    samples: [
      { x: A.x, y: spanY },
      { x: B.x, y: spanY },
    ],
  })
  annotations.push({
    id: `${prefix}-span-label`,
    kind: 'dimension',
    x: midX,
    y: spanY - 0.14,
    text: `SPAN  ${Number(arch.parameters.span).toFixed(2)} m`,
  })
  const riseX = midX + 0.22
  curves.push({
    id: `${prefix}-dim-rise`,
    role: 'dimension',
    samples: [
      { x: riseX, y: A.y },
      { x: riseX, y: P.y },
    ],
  })
  annotations.push({
    id: `${prefix}-rise-label`,
    kind: 'dimension',
    x: riseX + 0.12,
    y: (A.y + P.y) / 2,
    text: `RISE  ${Number(arch.parameters.rise).toFixed(2)} m`,
    align: 'left',
  })
}

function appendFoil(foil, prefix, opts) {
  const {
    primitives,
    curves,
    showConstruction,
    showCenters,
    showPoints,
    showResult,
  } = opts

  if (showResult && foil.samples?.length) {
    curves.push({
      id: `${prefix}-boundary`,
      role: 'result',
      closed: true,
      samples: foil.samples,
      prominence: 'primary',
    })
  }

  if (showConstruction) {
    for (let i = 0; i < (foil.circles?.length ?? 0); i += 1) {
      curves.push({
        id: `${prefix}-circ-${i}`,
        role: 'construction',
        closed: true,
        samples: sampleCircle(foil.circles[i], 56),
        prominence: 'secondary',
      })
    }
    if (foil.enclosing) {
      curves.push({
        id: `${prefix}-enclosing`,
        role: 'guide',
        closed: true,
        samples: sampleCircle(foil.enclosing, 64),
        prominence: 'secondary',
      })
    }
  }

  if (showCenters) {
    for (let i = 0; i < (foil.lobeCenters?.length ?? 0); i += 1) {
      const c = foil.lobeCenters[i]
      primitives.push({
        id: `${prefix}-lobe-${i}`,
        type: 'point',
        ...c,
        role: 'center',
        label: `L${i}`,
      })
    }
    if (foil.center) {
      primitives.push({
        id: `${prefix}-center`,
        type: 'point',
        ...foil.center,
        role: 'center',
        label: 'C',
      })
    }
  }

  if (showPoints) {
    for (let i = 0; i < (foil.cusps?.length ?? 0); i += 1) {
      const c = foil.cusps[i]
      primitives.push({
        id: `${prefix}-cusp-${i}`,
        type: 'point',
        ...c,
        role: 'endpoint',
        label: `K${i}`,
      })
    }
  }
}

/** Framing for tracery constructions — reuse arch framing logic. */
export function traceryFramingBounds(result, opts = {}) {
  return archFramingBounds(result, opts)
}
