/**
 * Lithic generation worker (Step 47, Phase C1).
 * Message in:  { jobId, skeleton, params, seed, quality }
 * Message out: { jobId, ok, positions, normals, indices, stats } | { jobId, ok:false, error }
 * A newer job id for the same structure supersedes older ones (checked between chunks).
 */

import { buildLithicField } from './field.js'
import { meshLithicField } from './mesh.js'

const latestByStructure = new Map()

self.onmessage = (event) => {
  const { jobId, structureId, skeleton, params, seed, quality } = event.data
  latestByStructure.set(structureId, jobId)
  try {
    const field = buildLithicField(skeleton, params, seed)
    const result = meshLithicField(field, {
      quality,
      isCancelled: () => latestByStructure.get(structureId) !== jobId,
    })
    if (!result) {
      self.postMessage({ jobId, structureId, ok: false, cancelled: true })
      return
    }
    result.stats.lobes = field.lobes.length
    result.stats.capsules = field.capsules.length
    self.postMessage(
      { jobId, structureId, ok: true, quality, positions: result.positions, normals: result.normals, indices: result.indices, stats: result.stats },
      [result.positions.buffer, result.normals.buffer, result.indices.buffer],
    )
  } catch (error) {
    self.postMessage({ jobId, structureId, ok: false, error: String(error?.message ?? error) })
  }
}
