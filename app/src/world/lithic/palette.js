/**
 * Stone material palette (Step 47, round 2) — exactly the ten requested
 * colours, grouped by material. Colours are only ever chosen from this list
 * (with a ±4 % tone variation per stone).
 */

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]

export const PALETTE_HEX = Object.freeze(['#525050', '#928e8a', '#b7b2ad', '#a8a4a0', '#372e20', '#5b513f', '#6f5d3f', '#8f867a', '#7a7772', '#363331'])
export const PALETTE = Object.freeze(PALETTE_HEX.map(hex))

// Ordered light → dark within each material.
const LIMESTONE = ['#b7b2ad', '#a8a4a0', '#928e8a', '#8f867a', '#7a7772']
const SANDSTONE = ['#8f867a', '#6f5d3f', '#5b513f', '#372e20']
const WEATHERED = ['#525050', '#363331']
const idx = (list) => list.map((h) => PALETTE_HEX.indexOf(h))
export const MATERIALS = Object.freeze({ limestone: idx(LIMESTONE), sandstone: idx(SANDSTONE), weathered: idx(WEATHERED) })

function hashKey(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return ((h >>> 0) % 100003) / 100003
}

/**
 * Pick a palette colour for one stone. Material is coherent per member
 * (materialKey), tone per course (courseKey), so masonry reads as quarried
 * batches rather than a checkerboard; individual stones only rarely step
 * one tone up or down.
 *  - stoneMix: share of members built in sandstone (else limestone)
 *  - weathering: darker toward the ground (grime / damp) into the dark greys
 *  - carved: carved pieces are fine pale limestone
 *  - light: tracery follows the material but keeps its lightest tones
 */
export function stoneColor(rand, { stoneMix, weathering, y, yTop, carved = false, light = false, materialKey = '', courseKey = '', seed = 0 }) {
  const low = 1 - Math.min(1, Math.max(0, y / Math.max(1, yTop)))
  const list = !carved && hashKey(`${seed}|m|${materialKey}`) < stoneMix ? MATERIALS.sandstone : MATERIALS.limestone
  // Base tones: the three lightest of the material; darker ones come from weathering.
  // Carved pieces and tracery (light) use the two lightest tones of their material.
  const span = carved || light ? 1.4 : Math.min(3, list.length) - 0.6
  let shift = hashKey(`${seed}|c|${courseKey}`) * span
  const r = rand()
  if (r < 0.07) shift += 1
  else if (r > 0.96) shift -= 1
  shift += weathering * low * low * (carved ? 1.4 : 2.6)
  const i = Math.floor(Math.max(0, shift))
  const pi = i < list.length ? list[i] : MATERIALS.weathered[Math.min(MATERIALS.weathered.length - 1, i - list.length)]
  const base = PALETTE[pi]
  const tone = 0.97 + rand() * 0.06
  return { color: [base[0] * tone, base[1] * tone, base[2] * tone], paletteIndex: pi }
}
