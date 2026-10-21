/**
 * Tracery Window — 2D design entry (Phase 4).
 *
 * Pipeline:
 *   TRACERY FAMILY → composition rules → 2D curve graph
 *   → (Phase 2/3) profile assignment → 3D stone geometry
 *
 * Families share createDesignBuilder (frame / mullions / lancets)
 * and emit the same curve graph format.
 */

import {
  DESIGN_LAYERS,
  DESIGN_LAYER_COLORS,
  createDesignBuilder,
  sampleCurve,
} from './designShared.js'
import { composeGeometric } from './families/geometric.js'
import { composeRayonnant } from './families/rayonnant.js'
import { composeFlamboyant } from './families/flamboyant.js'

export { DESIGN_LAYERS, DESIGN_LAYER_COLORS, sampleCurve }

export const TRACERY_FAMILIES = [
  {
    id: 'geometric',
    label: '01 Geometric',
    note: 'Lancets, circular head, trefoil/quatrefoil/sexfoil, straight connectors.',
  },
  {
    id: 'rayonnant',
    label: '02 Rayonnant',
    note: 'Concentric rose rings, radiating spokes, rim foils, radial hierarchy.',
  },
  {
    id: 'flamboyant',
    label: '03 Flamboyant',
    note: 'Ogee connectors, flame/mouchette forms, interlocking curvilinear cells.',
  },
]

const COMPOSERS = {
  geometric: composeGeometric,
  rayonnant: composeRayonnant,
  flamboyant: composeFlamboyant,
}

/**
 * Build a 2D tracery design for the selected family.
 * Falls back to Geometric if composition validates poorly.
 */
export function buildWindowDesign2d(params = {}) {
  const family = params.traceryFamily ?? 'geometric'
  const compose = COMPOSERS[family] ?? composeGeometric

  let design = compose(createDesignBuilder({ ...params, traceryFamily: family }))
  let validation = validateDesign2d(design)

  if (!validation.ok) {
    const originalIssues = validation.issues
    // Deterministic fallback: Geometric with same seed / dimensions.
    design = composeGeometric(
      createDesignBuilder({ ...params, traceryFamily: 'geometric' }),
    )
    validation = validateDesign2d(design)
    design.meta.fallback = true
    design.meta.fallbackFrom = family
    design.meta.fallbackIssues = originalIssues
  }

  design.meta.validation = validation
  return design
}

/** Validate connectivity / hierarchy heuristics. */
export function validateDesign2d(design) {
  const issues = []
  const { curves, junctions, layout } = design
  if (!curves?.length) issues.push('no curves')
  if (!junctions?.length) issues.push('no junctions')

  const byLayer = {}
  for (const c of curves ?? []) byLayer[c.layer] = (byLayer[c.layer] || 0) + 1
  if (!byLayer.frame) issues.push('missing frame')
  if (!byLayer.mullion) issues.push('missing mullions')
  if (!byLayer.secondary) issues.push('missing secondary tracery')

  // Primary upper motif: head-circle (all current families emit this id).
  if (!curves?.some((c) => c.id === 'head-circle')) issues.push('missing head circle')

  // Zero-length segments
  for (const c of curves ?? []) {
    if (c.kind === 'line') {
      const len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1])
      if (len < 1e-4) issues.push(`zero-length ${c.id}`)
    }
    if (c.kind === 'arc' && c.r < 1e-4) issues.push(`zero-radius ${c.id}`)
  }

  // Bounds: sample actual path extents (not full circle AABB for short foil arcs).
  const half = layout?.half ?? 1.5
  const apex = layout?.apex ?? 6
  for (const c of curves ?? []) {
    if (c.layer !== 'secondary') continue
    const pts = sampleCurve(c, c.kind === 'arc' ? 12 : 8)
    for (const p of pts) {
      if (Math.abs(p[0]) > half * 1.08) issues.push(`${c.id} outside frame X`)
      if (p[1] < -0.05 || p[1] > apex + 0.08) issues.push(`${c.id} outside frame Y`)
    }
  }

  // Connector endpoints near junctions
  const jpts = (junctions ?? []).map((j) => [j.x, j.y])
  const nearJ = (p, tol = 0.1) => jpts.some(([x, y]) => Math.hypot(x - p[0], y - p[1]) < tol)
  for (const c of curves ?? []) {
    if (c.id?.startsWith('connector')) {
      if (c.kind === 'bezier') {
        if (!nearJ(c.p0)) issues.push(`${c.id} start not at junction`)
        if (!nearJ(c.p3, 0.15)) issues.push(`${c.id} end not on junction`)
      }
      if (c.kind === 'line') {
        if (!nearJ(c.a)) issues.push(`${c.id} start not at junction`)
        if (!nearJ(c.b, 0.15)) issues.push(`${c.id} end not on junction`)
      }
    }
  }

  // Lancet proportions
  if (layout) {
    const lancetH = layout.impostY - layout.sill
    const lightW = (2 * layout.half) / layout.lancetCount
    if (lancetH / lightW < 1.35) issues.push('lancets not vertically proportioned')
  }

  // Cap runaway curve counts
  if ((curves?.length ?? 0) > 80) issues.push('too many curves')

  return {
    ok: issues.length === 0,
    issues,
    byLayer,
    curveCount: curves?.length ?? 0,
    junctionCount: junctions?.length ?? 0,
  }
}
