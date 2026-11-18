/**
 * Derived geometry per structure (Step 47, feedback round 1).
 *
 * Skeleton (curve member + Gothic grammar) and carved-stone layout are both fast
 * (~1–20 ms), so they run synchronously and are cached by signature:
 * only curves whose resolved points, role, parameters or seed changed are
 * rebuilt. Linked endpoints are resolved first, so moving a shared point
 * regenerates every curve connected to it — and nothing else.
 */

import { useMemo } from 'react'
import { resolveCurvePoints, resolveStructureParams } from '../model/project.js'
import { stableHash } from '../model/signature.js'
import { buildCurveSkeleton } from '../skeleton/members.js'
import { buildStones } from '../lithic/stones.js'

// Module-level caches (one world view at a time); entries not used by the
// current project are pruned after every rebuild.
const skelCache = new Map()
const stoneCache = new Map()

export function useStructureGeneration(project) {
  return useMemo(() => {
    const structures = []
    const usedSkel = new Set()
    // Incoming links: which end points of each curve other curves attach to
    // (a column whose top carries an arch is "linked" at its top too).
    const incoming = new Map()
    for (const id of project.order) {
      const c = project.curves[id]
      for (const l of [c?.links?.start, c?.links?.end]) if (l) incoming.set(`${l.curveId}|${l.pointId}`, true)
    }
    const usedStone = new Set()
    for (const curveId of project.order) {
      const curve = project.curves[curveId]
      if (!curve) continue
      const resolved = resolveCurvePoints(project, curve)
      const params = resolveStructureParams(project, curveId)
      const cps = curve.controlPoints
      const links = {
        start: curve.links?.start ?? (cps.length && incoming.has(`${curveId}|${cps[0].id}`) ? { incoming: true } : null),
        end: curve.links?.end ?? (cps.length && incoming.has(`${curveId}|${cps[cps.length - 1].id}`) ? { incoming: true } : null),
      }
      const skelSig = stableHash({
        p: resolved.map((q) => [q.x, q.y, q.z]),
        t: curve.curveType,
        c: curve.closed,
        r: curve.curveRole,
        l: [Boolean(links.start), Boolean(links.end), Boolean(links.start?.incoming), Boolean(links.end?.incoming)],
        s: params.skeleton,
        seed: params.seed,
      })
      let skeleton = skelCache.get(skelSig)
      if (!skeleton) {
        const t0 = performance.now()
        skeleton = buildCurveSkeleton(curve, resolved, params.skeleton, params.seed, links)
        skeleton.buildMs = performance.now() - t0
        skelCache.set(skelSig, skeleton)
      }
      usedSkel.add(skelSig)
      const stoneSig = stableHash({ skelSig, l: params.lithic, seed: params.seed })
      let lithic = stoneCache.get(stoneSig)
      if (!lithic) {
        const t0 = performance.now()
        lithic = buildStones(skeleton, params.lithic, params.seed)
        lithic.buildMs = performance.now() - t0
        stoneCache.set(stoneSig, lithic)
      }
      usedStone.add(stoneSig)
      structures.push({
        structureId: curve.generatedStructureIds[0],
        curveId,
        curve,
        resolved,
        params,
        skelSig,
        stoneSig,
        skeleton,
        lithic,
      })
    }
    for (const k of skelCache.keys()) if (!usedSkel.has(k)) skelCache.delete(k)
    for (const k of stoneCache.keys()) if (!usedStone.has(k)) stoneCache.delete(k)
    return structures
  }, [project])
}
