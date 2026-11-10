/**
 * Pier / buttress placeholder solids between architectural bays (Step 13E.1).
 * Simple extruded boxes — not pinnacles or flying buttresses.
 */

import { nextId } from '../kernel/result.js'
import { buildBoxMesh } from './boxSolid.js'
import { validateMesh } from '../solids/meshValidation.js'

export const DEFAULT_PIER_PARAMS = Object.freeze({
  pierWidth: 0.28,
  pierDepth: 0.45,
  pierHeight: null, // derived from assembly when null
  buttressProjection: 0.2,
  showSupports: true,
})

/**
 * Build a vertical pier at world X, sitting on groundY.
 * Optional buttress projects forward (+Z) as a second box sharing the pier id family.
 */
export function buildPierSupport(opts = {}) {
  const id = opts.id ?? nextId('pier')
  const parentAssemblyId = opts.parentAssemblyId ?? null
  const pierWidth = Math.max(0.08, opts.pierWidth ?? DEFAULT_PIER_PARAMS.pierWidth)
  const pierDepth = Math.max(0.12, opts.pierDepth ?? DEFAULT_PIER_PARAMS.pierDepth)
  const buttressProjection = Math.max(
    0,
    opts.buttressProjection ?? DEFAULT_PIER_PARAMS.buttressProjection,
  )
  const groundY = opts.groundY ?? -0.35
  const pierHeight = Math.max(0.5, opts.pierHeight ?? 3.2)
  const x = opts.x ?? 0
  const cy = groundY + pierHeight * 0.5
  // Pier centered on wall plane (z=0); depth extends ±pierDepth/2
  const pier = buildBoxMesh({
    cx: x,
    cy,
    cz: 0,
    sx: pierWidth,
    sy: pierHeight,
    sz: pierDepth,
    id: `${id}-shaft`,
  })
  const parts = [
    {
      id: `${id}-shaft`,
      role: 'PIER_SHAFT',
      hierarchy: 'PRIMARY',
      mesh: pier.mesh,
      volume: pier.volume,
      boundingMin: pier.boundingMin,
      boundingMax: pier.boundingMax,
    },
  ]
  if (buttressProjection > 1e-6) {
    const bz = pierDepth * 0.5 + buttressProjection * 0.5
    const buttressH = pierHeight * 0.85
    const buttress = buildBoxMesh({
      cx: x,
      cy: groundY + buttressH * 0.5,
      cz: bz,
      sx: pierWidth * 0.85,
      sy: buttressH,
      sz: buttressProjection,
      id: `${id}-buttress`,
    })
    parts.push({
      id: `${id}-buttress`,
      role: 'BUTTRESS_PROJECTION',
      hierarchy: 'PRIMARY',
      mesh: buttress.mesh,
      volume: buttress.volume,
      boundingMin: buttress.boundingMin,
      boundingMax: buttress.boundingMax,
    })
  }

  let volume = 0
  const errors = []
  const warnings = []
  for (const p of parts) {
    volume += p.volume
    const v = validateMesh(p.mesh, { requireWatertight: true })
    if (!v.ok) errors.push(`${p.id}: ${v.errors.join('; ')}`)
    if (v.edges?.nonManifoldEdgeCount) {
      errors.push(`${p.id}: ${v.edges.nonManifoldEdgeCount} non-manifold edges`)
    }
  }

  return {
    type: 'PIER_SUPPORT',
    id,
    parentAssemblyId,
    role: 'STRUCTURAL_SUPPORT',
    x,
    pierWidth,
    pierDepth,
    pierHeight,
    buttressProjection,
    groundY,
    parts,
    volume,
    transform: { position: [x, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    validation: { ok: errors.length === 0, errors, warnings },
  }
}

/**
 * Continuous base course under the facade elevation.
 */
export function buildBaseCourse(opts = {}) {
  const id = opts.id ?? nextId('base-course')
  const width = Math.max(0.5, opts.width ?? 3)
  const height = Math.max(0.08, opts.height ?? 0.18)
  const depth = Math.max(0.2, opts.depth ?? 0.55)
  const groundY = opts.groundY ?? -0.35
  const cy = groundY - height * 0.5
  const box = buildBoxMesh({
    cx: 0,
    cy,
    cz: 0,
    sx: width,
    sy: height,
    sz: depth,
    id,
  })
  const v = validateMesh(box.mesh, { requireWatertight: true })
  return {
    type: 'BASE_COURSE',
    id,
    parentAssemblyId: opts.parentAssemblyId ?? null,
    width,
    height,
    depth,
    groundY,
    parts: [
      {
        id,
        role: 'BASE_COURSE',
        mesh: box.mesh,
        volume: box.volume,
        boundingMin: box.boundingMin,
        boundingMax: box.boundingMax,
      },
    ],
    volume: box.volume,
    validation: {
      ok: v.ok,
      errors: v.ok ? [] : v.errors,
      warnings: [],
    },
  }
}
