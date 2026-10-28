/**
 * Step 12B — LOD geometry cache.
 * Keyed by canonical design id + render params fingerprint + LOD + scale.
 */

import { normalizeLodLevel } from './config.js'

/**
 * Stable string key for cache entries.
 */
export function makeLodCacheKey(parts = {}) {
  const {
    kind = 'geom',
    designId = 'default',
    lod = 'high',
    scale = 1,
    revision = 0,
    extras = '',
  } = parts
  return `${kind}|${designId}|${normalizeLodLevel(lod)}|s${Number(scale).toFixed(3)}|r${revision}|${extras}`
}

/**
 * LRU-ish Map cache with dispose hooks.
 */
export function createLodGeometryCache({ maxEntries = 24 } = {}) {
  const map = new Map()

  const disposeEntry = (entry) => {
    if (!entry) return
    try {
      entry.dispose?.()
    } catch {
      /* ignore */
    }
  }

  return {
    get(key) {
      if (!map.has(key)) return null
      const entry = map.get(key)
      // refresh LRU order
      map.delete(key)
      map.set(key, entry)
      return entry.value
    },
    set(key, value, dispose) {
      if (map.has(key)) {
        const prev = map.get(key)
        map.delete(key)
        if (prev?.value !== value) disposeEntry(prev)
      }
      map.set(key, { value, dispose })
      while (map.size > maxEntries) {
        const oldest = map.keys().next().value
        disposeEntry(map.get(oldest))
        map.delete(oldest)
      }
      return value
    },
    has(key) {
      return map.has(key)
    },
    delete(key) {
      if (!map.has(key)) return
      disposeEntry(map.get(key))
      map.delete(key)
    },
    clear() {
      for (const entry of map.values()) disposeEntry(entry)
      map.clear()
    },
    get size() {
      return map.size
    },
  }
}

/** Estimate geometry memory (rough bytes). */
export function estimateGeometryBytes(meshes = []) {
  let bytes = 0
  for (const m of meshes) {
    const g = m.geometry ?? m
    if (!g?.attributes) continue
    for (const attr of Object.values(g.attributes)) {
      bytes += attr.array?.byteLength ?? 0
    }
    if (g.index?.array) bytes += g.index.array.byteLength
  }
  return bytes
}

export function countMeshTriangles(meshes = []) {
  let n = 0
  for (const m of meshes) {
    const g = m.geometry ?? m
    if (!g) continue
    n += (g.index ? g.index.count : g.attributes?.position?.count ?? 0) / 3
  }
  return Math.round(n)
}
