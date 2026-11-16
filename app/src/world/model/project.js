/**
 * Curve-driven Gothic world — authoritative project document (Step 47, Phase A1).
 *
 * The document holds only source data (curves, parameters, seeds, ids).
 * Skeletons and lithic meshes are derived and cached by signature; they are
 * never stored here, so undo/redo and save/load stay small and deterministic.
 *
 * All mutations go through `applyCommand(project, command)` which returns a
 * new project (structural sharing, no in-place mutation).
 */

import { DEFAULT_SKELETON_PARAMS } from '../skeleton/params.js'
import { DEFAULT_LITHIC_PARAMS } from '../lithic/params.js'

export const SCHEMA_VERSION = 1

export const CURVE_TYPES = Object.freeze(['catmullRom', 'polyline'])
export const CURVE_ROLES = Object.freeze(['spine']) // footprint etc. arrive in Phase B2

let idCounter = 0
export function newId(prefix) {
  idCounter = (idCounter + 1) % 1296
  const rand = Math.floor(Math.random() * 36 ** 5).toString(36).padStart(5, '0')
  return `${prefix}_${rand}${idCounter.toString(36).padStart(2, '0')}`
}

export function createEmptyProject() {
  return {
    schemaVersion: SCHEMA_VERSION,
    world: {
      seed: 2925,
      units: 'm',
      fieldSize: 200,
      skeleton: { ...DEFAULT_SKELETON_PARAMS },
      lithic: { ...DEFAULT_LITHIC_PARAMS },
    },
    curves: {},
    structures: {},
    order: [],
    counters: { curve: 0 },
  }
}

const round = (v) => Math.round(v * 1000) / 1000
const cleanPoint = (p) => ({ x: round(p.x), y: round(p.y ?? 0), z: round(p.z) })

/** Resolved parameters for a structure: world globals ← per-curve overrides. */
export function resolveStructureParams(project, curveId) {
  const curve = project.curves[curveId]
  return {
    skeleton: { ...project.world.skeleton, ...(curve?.architecturalParameters ?? {}) },
    lithic: { ...project.world.lithic, ...(curve?.lithicParameters ?? {}) },
    seed: curve?.randomSeed ?? project.world.seed,
  }
}

// Fields that stay editable on a locked curve (lock only freezes geometry + params).
const LOCK_EXEMPT = new Set(['locked', 'visibility', 'name'])

function withCurve(project, curveId, fn, field = null) {
  const curve = project.curves[curveId]
  if (!curve || (curve.locked && !LOCK_EXEMPT.has(field))) return project
  return { ...project, curves: { ...project.curves, [curveId]: fn(curve) } }
}

export function applyCommand(project, cmd) {
  switch (cmd.type) {
    case 'addCurve': {
      const n = project.counters.curve + 1
      const curveId = cmd.curveId ?? newId('crv')
      const structureId = cmd.structureId ?? newId('str')
      const label = String(n).padStart(3, '0')
      const curve = {
        curveId,
        name: `Curve ${label}`,
        curveType: cmd.curveType ?? 'catmullRom',
        controlPoints: (cmd.points ?? []).map(cleanPoint),
        closed: false,
        constructionPlane: { kind: 'ground', elevation: 0 },
        curveRole: 'spine',
        architecturalParameters: {},
        lithicParameters: {},
        randomSeed: cmd.seed ?? (project.world.seed * 31 + n * 7919) % 100000,
        visibility: true,
        locked: false,
        generatedStructureIds: [structureId],
      }
      const structure = {
        structureId,
        name: `Structure ${label}`,
        source: { kind: 'curve', id: curveId },
        visibility: true,
        locked: false,
      }
      return {
        ...project,
        counters: { ...project.counters, curve: n },
        curves: { ...project.curves, [curveId]: curve },
        structures: { ...project.structures, [structureId]: structure },
        order: [...project.order, curveId],
      }
    }
    case 'appendPoint':
      return withCurve(project, cmd.curveId, (c) => ({
        ...c,
        controlPoints: [...c.controlPoints, cleanPoint(cmd.point)],
      }))
    case 'movePoint':
      return withCurve(project, cmd.curveId, (c) => ({
        ...c,
        controlPoints: c.controlPoints.map((p, i) => (i === cmd.index ? cleanPoint(cmd.point) : p)),
      }))
    case 'deletePoint':
      return withCurve(project, cmd.curveId, (c) => ({
        ...c,
        controlPoints: c.controlPoints.filter((_, i) => i !== cmd.index),
      }))
    case 'setCurveField':
      return withCurve(project, cmd.curveId, (c) => ({ ...c, [cmd.field]: cmd.value }), cmd.field)
    case 'setCurveParam': {
      const group = cmd.group === 'lithic' ? 'lithicParameters' : 'architecturalParameters'
      return withCurve(project, cmd.curveId, (c) => ({
        ...c,
        [group]: { ...c[group], [cmd.key]: cmd.value },
      }))
    }
    case 'deleteCurve': {
      const curve = project.curves[cmd.curveId]
      if (!curve) return project
      const curves = { ...project.curves }
      delete curves[cmd.curveId]
      const structures = { ...project.structures }
      for (const id of curve.generatedStructureIds) delete structures[id]
      return { ...project, curves, structures, order: project.order.filter((id) => id !== cmd.curveId) }
    }
    case 'setWorldParam': {
      const group = cmd.group === 'lithic' ? 'lithic' : 'skeleton'
      return {
        ...project,
        world: { ...project.world, [group]: { ...project.world[group], [cmd.key]: cmd.value } },
      }
    }
    default:
      throw new Error(`applyCommand: unknown command ${cmd.type}`)
  }
}

/** Serialise to plain JSON (no derived geometry). */
export function serializeProject(project) {
  return JSON.stringify(project)
}

/** Parse + migrate. Unknown or missing fields fall back to defaults. */
export function deserializeProject(json) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json
  if (!raw || typeof raw !== 'object') throw new Error('deserializeProject: not an object')
  const base = createEmptyProject()
  return {
    ...base,
    ...raw,
    schemaVersion: SCHEMA_VERSION,
    world: {
      ...base.world,
      ...(raw.world ?? {}),
      skeleton: { ...base.world.skeleton, ...(raw.world?.skeleton ?? {}) },
      lithic: { ...base.world.lithic, ...(raw.world?.lithic ?? {}) },
    },
    curves: raw.curves ?? {},
    structures: raw.structures ?? {},
    order: raw.order ?? Object.keys(raw.curves ?? {}),
    counters: { ...base.counters, ...(raw.counters ?? {}) },
  }
}
