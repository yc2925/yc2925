/**
 * Curve-driven Gothic world — authoritative project document (Step 47).
 *
 * Source data only (curves, links, parameters, seeds). Skeletons and stones
 * are derived and cached by signature.
 *
 * Feedback round 1:
 *  - Control points carry stable ids (`id`) so links survive insert/delete.
 *  - Curves can be connected: `links.start` / `links.end` = { curveId, pointId }.
 *    A linked endpoint has no position of its own — it resolves to the target
 *    point, so moving either point moves every connected curve.
 *  - `curveRole`: rib | column | buttress | tracery (how the member behaves).
 */

import { DEFAULT_SKELETON_PARAMS } from '../skeleton/params.js'
import { DEFAULT_LITHIC_PARAMS } from '../lithic/params.js'
import { DEFAULT_TERRAIN_PARAMS, DEFAULT_PRESENTATION } from '../compose/worldParams.js'

export const SCHEMA_VERSION = 2
/**
 * Bumped when parameter meanings change. Round 2 (tracery grammar) changed
 * the member taper and boss size, so those saved values reset to the new
 * defaults on load; stone settings are kept.
 */
export const PARAMS_REVISION = 2
const RESET_ON_REVISION = {
  skeleton: ['taper', 'jointSize'],
  // Stone controls keep their saved values (the user's settings carry over).
  lithic: [],
}

export const CURVE_TYPES = Object.freeze(['catmullRom', 'polyline'])
export const CURVE_ROLES = Object.freeze(['rib', 'column', 'buttress', 'tracery'])

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
      paramsRevision: PARAMS_REVISION,
      fieldSize: 200,
      skeleton: { ...DEFAULT_SKELETON_PARAMS },
      lithic: { ...DEFAULT_LITHIC_PARAMS },
      terrain: { ...DEFAULT_TERRAIN_PARAMS },
      presentation: { ...DEFAULT_PRESENTATION },
    },
    curves: {},
    structures: {},
    order: [],
    counters: { curve: 0, point: 0 },
  }
}

const round = (v) => Math.round(v * 1000) / 1000

function cleanPoint(p, project) {
  return {
    id: p.id ?? `p${(project.counters.point += 1).toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    x: round(p.x),
    y: round(Math.max(0, p.y ?? 0)),
    z: round(p.z),
  }
}

/** Shallow copy with fresh counters object (cleanPoint increments it). */
function draft(project) {
  return { ...project, counters: { ...project.counters } }
}

// ------------------------------------------------------------ resolution

function linkFor(curve, index) {
  if (!curve.links) return null
  if (index === 0 && curve.links.start) return curve.links.start
  if (index === curve.controlPoints.length - 1 && curve.links.end) return curve.links.end
  return null
}

/** World position of a point, following links (cycle-safe). */
export function resolvePoint(project, curveId, pointId, depth = 0) {
  const curve = project.curves[curveId]
  if (!curve) return null
  const index = curve.controlPoints.findIndex((p) => p.id === pointId)
  if (index < 0) return null
  const link = depth < 8 ? linkFor(curve, index) : null
  if (link) {
    const target = resolvePoint(project, link.curveId, link.pointId, depth + 1)
    if (target) return { ...curve.controlPoints[index], x: target.x, y: target.y, z: target.z }
  }
  return curve.controlPoints[index]
}

/** Control points with linked endpoints replaced by their targets. */
export function resolveCurvePoints(project, curve) {
  return curve.controlPoints.map((p) => resolvePoint(project, curve.curveId, p.id) ?? p)
}

/** Which (curveId, index) actually owns the position of a point. */
function ownerOf(project, curveId, index, depth = 0) {
  const curve = project.curves[curveId]
  const link = curve && depth < 8 ? linkFor(curve, index) : null
  if (link) {
    const target = project.curves[link.curveId]
    const ti = target ? target.controlPoints.findIndex((p) => p.id === link.pointId) : -1
    if (ti >= 0) return ownerOf(project, link.curveId, ti, depth + 1)
  }
  return { curveId, index }
}

/** Curves whose links point at (curveId, pointId) or at any point of curveId when pointId is null. */
function bakeLinksTo(project, curveId, pointId = null) {
  const curves = { ...project.curves }
  for (const [id, c] of Object.entries(curves)) {
    if (!c.links || id === curveId) continue
    let changed = false
    const links = { ...c.links }
    const cps = c.controlPoints.slice()
    for (const end of ['start', 'end']) {
      const l = links[end]
      if (!l || l.curveId !== curveId || (pointId && l.pointId !== pointId)) continue
      const idx = end === 'start' ? 0 : cps.length - 1
      const pos = resolvePoint(project, id, cps[idx].id)
      cps[idx] = { ...cps[idx], x: pos.x, y: pos.y, z: pos.z }
      links[end] = null
      changed = true
    }
    if (changed) curves[id] = { ...c, controlPoints: cps, links }
  }
  return { ...project, curves }
}

// ------------------------------------------------------------ params

export function resolveStructureParams(project, curveId) {
  const curve = project.curves[curveId]
  return {
    skeleton: { ...project.world.skeleton, ...(curve?.architecturalParameters ?? {}) },
    lithic: { ...project.world.lithic, ...(curve?.lithicParameters ?? {}) },
    seed: curve?.randomSeed ?? project.world.seed,
  }
}

// Fields that stay editable on a locked curve (lock freezes geometry + params).
const LOCK_EXEMPT = new Set(['locked', 'visibility', 'name'])

function withCurve(project, curveId, fn, field = null) {
  const curve = project.curves[curveId]
  if (!curve || (curve.locked && !LOCK_EXEMPT.has(field))) return project
  return { ...project, curves: { ...project.curves, [curveId]: fn(curve) } }
}

// ------------------------------------------------------------ commands

export function applyCommand(project, cmd) {
  switch (cmd.type) {
    case 'addCurve': {
      const next = draft(project)
      const n = next.counters.curve + 1
      next.counters.curve = n
      const curveId = cmd.curveId ?? newId('crv')
      const structureId = cmd.structureId ?? newId('str')
      const label = String(n).padStart(3, '0')
      const curve = {
        curveId,
        name: `Curve ${label}`,
        curveType: cmd.curveType ?? 'catmullRom',
        controlPoints: (cmd.points ?? []).map((p) => cleanPoint(p, next)),
        closed: false,
        constructionPlane: { kind: 'ground', elevation: 0 },
        curveRole: cmd.role ?? 'rib',
        links: { start: cmd.links?.start ?? null, end: cmd.links?.end ?? null },
        architecturalParameters: {},
        lithicParameters: {},
        randomSeed: cmd.seed ?? (project.world.seed * 31 + n * 7919) % 100000,
        visibility: true,
        locked: false,
        generatedStructureIds: [structureId],
      }
      next.curves = { ...project.curves, [curveId]: curve }
      next.structures = {
        ...project.structures,
        [structureId]: { structureId, name: `Structure ${label}`, source: { kind: 'curve', id: curveId }, visibility: true, locked: false },
      }
      next.order = [...project.order, curveId]
      return next
    }
    case 'appendPoint': {
      const next = draft(project)
      return withCurve(next, cmd.curveId, (c) => ({ ...c, controlPoints: [...c.controlPoints, cleanPoint(cmd.point, next)] }))
    }
    case 'insertPoint': {
      const next = draft(project)
      return withCurve(next, cmd.curveId, (c) => {
        const cps = c.controlPoints.slice()
        cps.splice(Math.max(0, Math.min(cmd.index, cps.length)), 0, cleanPoint(cmd.point, next))
        return { ...c, controlPoints: cps }
      })
    }
    case 'movePoint': {
      // A linked endpoint moves its target instead (so all connected curves follow).
      const owner = ownerOf(project, cmd.curveId, cmd.index)
      return withCurve(project, owner.curveId, (c) => ({
        ...c,
        controlPoints: c.controlPoints.map((p, i) =>
          i === owner.index ? { ...p, x: round(cmd.point.x), y: round(Math.max(0, cmd.point.y ?? p.y)), z: round(cmd.point.z) } : p,
        ),
      }))
    }
    case 'deletePoint': {
      const curve = project.curves[cmd.curveId]
      if (!curve || curve.locked) return project
      const removed = curve.controlPoints[cmd.index]
      if (!removed) return project
      let next = bakeLinksTo(project, cmd.curveId, removed.id)
      return withCurve(next, cmd.curveId, (c) => {
        const links = { ...(c.links ?? {}) }
        if (cmd.index === 0) links.start = null
        if (cmd.index === c.controlPoints.length - 1) links.end = null
        return { ...c, links, controlPoints: c.controlPoints.filter((_, i) => i !== cmd.index) }
      })
    }
    case 'setCurveField':
      return withCurve(project, cmd.curveId, (c) => ({ ...c, [cmd.field]: cmd.value }), cmd.field)
    case 'setCurvePoints': {
      // Bulk height/shape edit (e.g. "lift to pointed arch"); keeps ids. When
      // the count changes (arch lift densifies a 2-point curve), the end
      // points keep their ids (links stay valid) and inner points are new.
      const cur = project.curves[cmd.curveId]
      if (cur && cmd.points.length !== cur.controlPoints.length && cmd.points.length >= 2) {
        const next = draft(project)
        const n = cmd.points.length
        return withCurve(next, cmd.curveId, (c) => ({
          ...c,
          controlPoints: cmd.points.map((q, i) => {
            const keep = i === 0 ? c.controlPoints[0] : i === n - 1 ? c.controlPoints[c.controlPoints.length - 1] : null
            return keep ? { ...keep, x: round(q.x), y: round(Math.max(0, q.y)), z: round(q.z) } : cleanPoint({ x: q.x, y: q.y, z: q.z }, next)
          }),
        }))
      }
      return withCurve(project, cmd.curveId, (c) => ({
        ...c,
        controlPoints: c.controlPoints.map((p, i) => {
          const q = cmd.points[i]
          return q ? { ...p, x: round(q.x), y: round(Math.max(0, q.y)), z: round(q.z) } : p
        }),
      }))
    }
    case 'setCurveParam': {
      const group = cmd.group === 'lithic' ? 'lithicParameters' : 'architecturalParameters'
      return withCurve(project, cmd.curveId, (c) => ({ ...c, [group]: { ...c[group], [cmd.key]: cmd.value } }))
    }
    case 'clearCurveParam': {
      const group = cmd.group === 'lithic' ? 'lithicParameters' : 'architecturalParameters'
      return withCurve(project, cmd.curveId, (c) => {
        const g = { ...c[group] }
        delete g[cmd.key]
        return { ...c, [group]: g }
      })
    }
    case 'deleteCurve': {
      const curve = project.curves[cmd.curveId]
      if (!curve) return project
      const baked = bakeLinksTo(project, cmd.curveId)
      const curves = { ...baked.curves }
      delete curves[cmd.curveId]
      const structures = { ...baked.structures }
      for (const id of curve.generatedStructureIds) delete structures[id]
      return { ...baked, curves, structures, order: baked.order.filter((id) => id !== cmd.curveId) }
    }
    case 'setWorldParam': {
      const group = ['skeleton', 'lithic', 'terrain', 'presentation'].includes(cmd.group) ? cmd.group : 'skeleton'
      return { ...project, world: { ...project.world, [group]: { ...project.world[group], [cmd.key]: cmd.value } } }
    }
    default:
      throw new Error(`applyCommand: unknown command ${cmd.type}`)
  }
}

function keepKnown(overrides, defaults) {
  const out = {}
  for (const [k, v] of Object.entries(overrides ?? {})) if (k in defaults) out[k] = v
  return out
}

export function serializeProject(project) {
  return JSON.stringify(project)
}

/** Parse + migrate (v1 → v2: point ids, links, roles, terrain/presentation). */
export function deserializeProject(json) {
  const raw = typeof json === 'string' ? JSON.parse(json) : json
  if (!raw || typeof raw !== 'object') throw new Error('deserializeProject: not an object')
  const base = createEmptyProject()
  const stale = (raw.world?.paramsRevision ?? 1) < PARAMS_REVISION
  const fresh = (group, values) => {
    if (!stale || !values) return values
    const out = { ...values }
    for (const k of RESET_ON_REVISION[group]) delete out[k]
    return out
  }
  const counters = { ...base.counters, ...(raw.counters ?? {}) }
  const curves = {}
  for (const [id, c] of Object.entries(raw.curves ?? {})) {
    curves[id] = {
      ...c,
      curveRole: CURVE_ROLES.includes(c.curveRole) ? c.curveRole : 'rib',
      links: { start: c.links?.start ?? null, end: c.links?.end ?? null },
      architecturalParameters: keepKnown(fresh('skeleton', c.architecturalParameters), DEFAULT_SKELETON_PARAMS),
      lithicParameters: keepKnown(fresh('lithic', c.lithicParameters), DEFAULT_LITHIC_PARAMS),
      controlPoints: (c.controlPoints ?? []).map((p, i) => ({
        id: p.id ?? `p_${id}_${i}`,
        x: p.x,
        y: p.y ?? 0,
        z: p.z,
      })),
    }
  }
  const pick = (defaults, saved) => {
    // Keep only parameters that still exist (removed params are dropped).
    const out = { ...defaults }
    for (const key of Object.keys(defaults)) if (saved && key in saved) out[key] = saved[key]
    return out
  }
  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    world: {
      ...base.world,
      seed: raw.world?.seed ?? base.world.seed,
      fieldSize: raw.world?.fieldSize ?? base.world.fieldSize,
      skeleton: pick(base.world.skeleton, fresh('skeleton', raw.world?.skeleton)),
      lithic: pick(base.world.lithic, fresh('lithic', raw.world?.lithic)),
      terrain: pick(base.world.terrain, raw.world?.terrain),
      presentation: pick(base.world.presentation, raw.world?.presentation),
    },
    curves,
    structures: raw.structures ?? {},
    order: (raw.order ?? Object.keys(curves)).filter((id) => curves[id]),
    counters,
  }
}
