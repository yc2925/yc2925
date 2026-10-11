import * as THREE from 'three'
import { mulberry32 } from '../growth/distribution.js'

/**
 * L-system: string rewriting + 3D turtle.
 *
 * Alphabet (turtle):
 *   F       move forward and draw a segment
 *   f       move forward without drawing
 *   + -     yaw   (turn left / right around the turtle's up axis)
 *   & ^     pitch (down / up around the left axis)
 *   \ /     roll  (around the heading); roll uses the golden angle 137.5°
 *   |       turn around
 *   [ ]     push / pop state; a pushed branch is shorter and thinner (decays)
 *   K       knot: a terminal ornament point (boss, bud, foil)
 * Any other symbol only takes part in rewriting.
 *
 * Placement modes:
 *   free     turtle in space, pushed out of the architecture when it runs into it
 *   conform  every step snaps to the wall surface; turns happen around the surface normal
 *   project  turtle draws in a flat plane, the drawing is then raycast onto the wall
 */

const MAX_SYMBOLS = 250000
const GOLDEN = (137.5 * Math.PI) / 180
const CLEARANCE = 0.04
const SURFACE_OFFSET = 0.018
const PROJECT_PIECE = 0.12

/** Rewrites the axiom n times. Rules: { A: [{ p, s }, …] } with probabilities p. */
export function rewrite(axiom, rules, iterations, seed) {
  const rand = mulberry32(seed * 7907 + 13)
  let current = axiom
  let completed = 0
  for (let n = 0; n < iterations; n += 1) {
    let next = ''
    for (const symbol of current) {
      const options = rules[symbol]
      if (!options) {
        next += symbol
        continue
      }
      if (options.length === 1) {
        next += options[0].s
        continue
      }
      let r = rand()
      let chosen = options[options.length - 1].s
      for (const option of options) {
        if (r < option.p) {
          chosen = option.s
          break
        }
        r -= option.p
      }
      next += chosen
    }
    if (next.length > MAX_SYMBOLS) break
    current = next
    completed += 1
  }
  return { string: current, completed }
}

function rotate(v, axis, angle) {
  return v.applyAxisAngle(axis, angle)
}

function tangentOf(v, n) {
  return v.clone().addScaledVector(n, -v.dot(n))
}

/**
 * Interprets the string from one start site.
 * Returns segments { a, b, radius, dist, depth, chain } and knots { p, n, size, dist, depth },
 * where dist is the path length from the root (used for the growth slider), depth is the
 * branch generation (bracket nesting, 0 = trunk) and chain identifies the unbroken stroke
 * a segment belongs to.
 */
function walk(string, site, preset, params, surface, rand, ids) {
  const segments = []
  const knots = []
  const angle = (params.angle * Math.PI) / 180
  const jitter = params.randomness
  const up = new THREE.Vector3(0, 1, 0)
  const conform = preset.placement === 'conform'
  const free = preset.placement === 'free'

  let state = {
    p: site.position.clone(),
    H: site.heading.clone().normalize(),
    U: site.up.clone().normalize(),
    L: new THREE.Vector3(),
    length: params.step,
    width: params.width,
    dist: 0,
    depth: 0,
    chain: ids.next++,
  }
  state.L.crossVectors(state.U, state.H).normalize()
  const stack = []
  const turn = (sign) => sign * angle * (1 + jitter * (rand() - 0.5) * 2)

  for (const symbol of string) {
    switch (symbol) {
      case 'F':
      case 'f': {
        const len = state.length * (1 + jitter * (rand() - 0.5) * 0.6)
        let end = state.p.clone().addScaledVector(state.H, len)

        if (conform) {
          const hit = surface.project(end)
          if (!hit || hit.distance > len * 3) break
          end = hit.point.addScaledVector(hit.normal, SURFACE_OFFSET)
          state.U.copy(hit.normal)
          const travel = tangentOf(end.clone().sub(state.p), state.U)
          if (travel.lengthSq() > 1e-10) state.H.copy(travel.normalize())
        } else if (free) {
          const hit = surface.project(end)
          if (hit) {
            const outward = end.clone().sub(hit.point).dot(hit.normal)
            if (outward < CLEARANCE) {
              end = hit.point.addScaledVector(hit.normal, CLEARANCE)
              state.H.addScaledVector(hit.normal, 0.6).normalize()
            }
          }
        }

        // Tropism: bend the heading towards world up, more where it is far from up.
        if (params.tropism > 0 && preset.placement !== 'project') {
          const target = conform ? tangentOf(up, state.U) : up
          if (target.lengthSq() > 1e-6) {
            const axis = new THREE.Vector3().crossVectors(state.H, target.normalize())
            const s = axis.length()
            if (s > 1e-6) rotate(state.H, axis.normalize(), params.tropism * s * 0.35)
          }
        }
        if (conform) state.H.copy(tangentOf(state.H, state.U).normalize())
        state.L.crossVectors(state.U, state.H).normalize()
        if (!conform) state.U.crossVectors(state.H, state.L).normalize()

        if (symbol === 'F') {
          segments.push({ a: state.p, b: end.clone(), radius: state.width, dist: state.dist, depth: state.depth, chain: state.chain })
        } else {
          ids.parent[ids.next] = state.chain
          state.chain = ids.next++
        }
        state.dist += len
        state.p = end
        break
      }
      case '+':
        rotate(state.H, state.U, turn(1))
        state.L.crossVectors(state.U, state.H).normalize()
        break
      case '-':
        rotate(state.H, state.U, turn(-1))
        state.L.crossVectors(state.U, state.H).normalize()
        break
      case '&':
      case '^': {
        if (conform || preset.placement === 'project') break
        const a = turn(symbol === '&' ? 1 : -1)
        rotate(state.H, state.L, a)
        rotate(state.U, state.L, a)
        break
      }
      case '\\':
      case '/': {
        const a = (symbol === '/' ? 1 : -1) * GOLDEN * (1 + jitter * (rand() - 0.5) * 0.4)
        rotate(state.L, state.H, a)
        rotate(state.U, state.H, a)
        break
      }
      case '|':
        rotate(state.H, state.U, Math.PI)
        state.L.crossVectors(state.U, state.H).normalize()
        break
      case '[':
        stack.push({
          p: state.p.clone(),
          H: state.H.clone(),
          U: state.U.clone(),
          L: state.L.clone(),
          length: state.length,
          width: state.width,
          dist: state.dist,
          depth: state.depth,
          chain: state.chain,
        })
        state.length *= params.lengthDecay
        state.width *= params.widthDecay
        state.depth += 1
        ids.parent[ids.next] = state.chain
        state.chain = ids.next++
        break
      case ']':
        if (stack.length) state = stack.pop()
        break
      case 'K':
        knots.push({
          p: state.p.clone(),
          n: state.U.clone(),
          size: state.width * 1.6 + state.length * preset.knotLength,
          dist: state.dist,
          depth: state.depth,
        })
        break
      default:
        break
    }
  }

  return { segments, knots }
}

/** Flat drawing → wall: split into short pieces, raycast every vertex along the plane normal. */
function projectDrawing(drawing, surface, direction) {
  const segments = []
  const knots = []
  const cache = new Map()
  const land = (p) => {
    const key = `${p.x.toFixed(4)},${p.y.toFixed(4)}`
    if (cache.has(key)) return cache.get(key)
    const hit = surface.raycast(p, direction)
    const value = hit ? { p: hit.point.addScaledVector(hit.normal, SURFACE_OFFSET), n: hit.normal } : null
    cache.set(key, value)
    return value
  }

  for (const seg of drawing.segments) {
    const pieces = Math.max(1, Math.ceil(seg.a.distanceTo(seg.b) / PROJECT_PIECE))
    let previous = land(seg.a)
    for (let i = 1; i <= pieces; i += 1) {
      const current = land(seg.a.clone().lerp(seg.b, i / pieces))
      if (previous && current) {
        segments.push({
          a: previous.p,
          b: current.p,
          radius: seg.radius,
          dist: seg.dist + ((i - 1) / pieces) * seg.a.distanceTo(seg.b),
          depth: seg.depth,
          chain: seg.chain,
        })
      }
      previous = current
    }
  }
  for (const knot of drawing.knots) {
    const hit = land(knot.p)
    if (hit) knots.push({ ...knot, p: hit.p, n: hit.n })
  }
  return { segments, knots }
}

/**
 * Branch graph: joins consecutive segments of the same chain into polylines.
 * Each branch { points, radii, dists, depth } is one unbroken stroke; radii[k] and dists[k]
 * belong to the segment points[k] → points[k + 1]. A chain is split where it jumps
 * (a projected piece that missed the wall).
 */
function buildBranches(segments) {
  const open = new Map()
  const branches = []
  for (const seg of segments) {
    let branch = open.get(seg.chain)
    if (!branch || branch.points[branch.points.length - 1].distanceToSquared(seg.a) > 1e-10) {
      branch = { points: [seg.a], radii: [], dists: [], depth: seg.depth, chain: seg.chain }
      open.set(seg.chain, branch)
      branches.push(branch)
    }
    branch.points.push(seg.b)
    branch.radii.push(seg.radius)
    branch.dists.push(seg.dist)
  }
  return branches
}

/**
 * For every branch, the farthest point (by path length) of the branch and all its descendants.
 * Chain ids grow as the turtle reads the string, so children always have higher ids than parents.
 */
function attachSubtreeTips(branches, parent) {
  const byChain = new Map()
  for (const b of branches) {
    const last = b.points.length - 1
    b.tip = b.points[last]
    b.tipDist = b.dists[last - 1] + b.points[last - 1].distanceTo(b.points[last])
    if (!byChain.has(b.chain)) byChain.set(b.chain, b)
  }
  const ids = [...byChain.keys()].sort((a, b) => b - a)
  for (const id of ids) {
    const b = byChain.get(id)
    let up = parent[id]
    while (up !== undefined && !byChain.has(up)) up = parent[up]
    if (up === undefined) continue
    const p = byChain.get(up)
    if (b.tipDist > p.tipDist) {
      p.tip = b.tip
      p.tipDist = b.tipDist
    }
  }
}

export function generate(preset, params, surface) {
  const t0 = performance.now()
  const rewritten = rewrite(preset.axiom, preset.rules, params.iterations, params.seed)
  const { completed } = rewritten
  // Growth symbols still unexpanded after the last pass become knots.
  let string = rewritten.string
  for (const [symbol, replacement] of Object.entries(preset.terminal ?? {})) {
    string = string.split(symbol).join(replacement)
  }
  const rand = mulberry32(params.seed * 104729 + 7)
  const segments = []
  const knots = []
  const ids = { next: 0, parent: [] }

  for (const site of preset.sites(surface)) {
    let result = walk(string, site, preset, params, surface, rand, ids)
    if (preset.placement === 'project') result = projectDrawing(result, surface, site.projectDirection)
    segments.push(...result.segments)
    knots.push(...result.knots)
  }

  const branches = buildBranches(segments)
  attachSubtreeTips(branches, ids.parent)
  segments.sort((a, b) => a.dist - b.dist)
  knots.sort((a, b) => a.dist - b.dist)
  let maxDist = 1e-6
  for (const item of segments) maxDist = Math.max(maxDist, item.dist)
  for (const item of knots) maxDist = Math.max(maxDist, item.dist)
  const maxDepth = branches.reduce((m, b) => Math.max(m, b.depth), 0)
  return { string, completed, segments, knots, branches, maxDepth, maxDist, ms: performance.now() - t0 }
}
