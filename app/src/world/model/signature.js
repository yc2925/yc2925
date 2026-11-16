/**
 * Stable signatures for derived-geometry caching (Phase A1).
 * FNV-1a over a canonical JSON with numbers rounded to 1e-4.
 */

function canonical(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 1e4) / 1e4 : null
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key])
    return out
  }
  return value
}

export function stableHash(value) {
  const text = JSON.stringify(canonical(value))
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

/** Signature of everything that shapes a curve's skeleton. */
export function skeletonSignature(curve, skeletonParams, seed) {
  return stableHash({
    t: curve.curveType,
    c: curve.closed,
    p: curve.controlPoints,
    pl: curve.constructionPlane,
    r: curve.curveRole,
    s: skeletonParams,
    seed,
  })
}

export function lithicSignature(skelSig, lithicParams, seed, quality) {
  return stableHash({ skelSig, l: lithicParams, seed, q: quality })
}
