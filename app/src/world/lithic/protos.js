/**
 * Stone prototype registry (Step 47, round 2). Plain data so the layout
 * (stones.js) and the render geometry (compose/carving.js) agree on indices.
 * Every prototype is normalised to the unit box; a stone's `s` gives its size.
 */

const ORDER = [
  ['ashlar', 12], // dressed blocks (dressing / irregularity)
  ['rubble', 6], // rough hulls (gravel, rubble core)
  ['drum', 3], // column / shaft drums
  ['ribVoussoir', 2], // moulded rib section, extruded along the tangent (local Y)
  ['bar', 2], // hollow-chamfered tracery bar, extruded along local X
  ['keystone', 1],
  ['boss', 3], // 4-, 5-, 6-foil rosettes
  ['pinnacle', 1],
  ['capital', 1],
  ['base', 1],
  ['grotesque', 3],
  ['crocket', 1],
  ['finial', 1],
]

export const PROTO = {}
let start = 0
for (const [name, count] of ORDER) {
  PROTO[name] = { start, count }
  start += count
}
export const PROTOTYPE_COUNT = start
export const BOSS_LOBES = [4, 5, 6]

export function protoIndex(name, variant = 0) {
  const p = PROTO[name]
  return p.start + (((variant % p.count) + p.count) % p.count)
}

/** Carved (sculpted) prototype kinds — rendered from fine limestone. */
export const CARVED = new Set(['keystone', 'boss', 'pinnacle', 'capital', 'base', 'grotesque', 'crocket', 'finial'])
