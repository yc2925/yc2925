/**
 * Architectural prominence of each structure (X-ray subject selection).
 *
 * score = 0.5 · height / max height
 *       + 0.3 · plan extent / max plan extent
 *       + 0.2 · (tracery motifs + carved sites) / max
 * normalised so the most prominent structure scores 1. A structure is a
 * main subject when its score ≥ threshold (the top one always is).
 */

export function structureProminence(structures) {
  const rows = structures
    .filter((s) => s.skeleton?.bounds && Number.isFinite(s.skeleton.bounds.min.x))
    .map((s) => {
      const b = s.skeleton.bounds
      return {
        id: s.curveId,
        h: Math.max(0, b.max.y - Math.min(0, b.min.y)),
        d: Math.hypot(b.max.x - b.min.x, b.max.z - b.min.z),
        o: (s.skeleton.stats?.motifs ?? 0) + (s.skeleton.stats?.ornaments ?? 0),
      }
    })
  const mh = Math.max(1e-6, ...rows.map((r) => r.h))
  const md = Math.max(1e-6, ...rows.map((r) => r.d))
  const mo = Math.max(1, ...rows.map((r) => r.o))
  const raw = rows.map((r) => ({ id: r.id, v: (0.5 * r.h) / mh + (0.3 * r.d) / md + (0.2 * r.o) / mo }))
  const top = Math.max(1e-6, ...raw.map((r) => r.v))
  return new Map(raw.map((r) => [r.id, r.v / top]))
}

/** Curve ids of the main subjects at a threshold in [0, 1]. */
export function prominentSubjects(scores, threshold) {
  const out = new Set()
  for (const [id, v] of scores) if (v >= threshold - 1e-9) out.add(id)
  return out
}
