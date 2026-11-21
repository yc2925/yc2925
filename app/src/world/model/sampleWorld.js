/**
 * Sample world (Step 48): one curve for every structure variation, laid out
 * in rows by family so the whole Gothic vocabulary can be seen side by side
 * (Docs/28-curve-typologies/VARIATIONS.md).
 *
 * Every curve is generated from the same exact constructions the grammar
 * uses (two-centred, Tudor, ogee, rampant arches; circles, lenses, helices…),
 * and every curve is left on Typology = Auto, so the curve's own qualities
 * pick its structure. Nothing is hand-placed geometry.
 */

import { applyCommand, createEmptyProject } from './project.js'
import { sampleArch, twoCentredArch } from '../skeleton/construct2d.js'
import { ogeeArch, rampantArch, sampleCArch, tudorArch } from '../skeleton/arches2d.js'

export const SAMPLE_KEY = 'yc2925.world.sample.v2'

const TAU = Math.PI * 2

/** 2D arch outline (x across, y up) → points in the vertical plane z = z0, centred at x0. */
const archAt = (pts, x0, z0) => pts.map((p) => ({ x: x0 + p.x, y: p.y, z: z0 }))
const circleV = (x0, y0, z0, r, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + r * Math.cos((TAU * i) / n), y: y0 + r * Math.sin((TAU * i) / n), z: z0 }))
const circleH = (x0, z0, r, n = 40) => Array.from({ length: n + 1 }, (_, i) => ({ x: x0 + r * Math.cos((TAU * i) / n), y: 0, z: z0 + r * Math.sin((TAU * i) / n) }))
const loop = (corners, per) => {
  const out = []
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % corners.length]
    for (let j = 0; j < per; j += 1) out.push({ x: a.x + ((b.x - a.x) * j) / per, y: a.y + ((b.y - a.y) * j) / per, z: a.z + ((b.z - a.z) * j) / per })
  })
  out.push({ ...corners[0] })
  return out
}
const rect = (x0, z0, hx, hz, y = 0) => [
  { x: x0 - hx, y, z: z0 - hz },
  { x: x0 + hx, y, z: z0 - hz },
  { x: x0 + hx, y, z: z0 + hz },
  { x: x0 - hx, y, z: z0 + hz },
]

/**
 * The sample: [expected typology, display name, role, points]. The expected
 * typology is what Auto must read from the curve (checked by validate:world).
 */
export function sampleCurves() {
  // Rows from front (nearest the default camera, +z) to back.
  const A = 78 // row A: arch families (vertical plane z = A)
  const B = 38 // row B: windows + vertical structures
  const C = -4 // row C: plans on the ground
  const D = -44 // row D: flat curves + classic roles
  const E = -82 // row E: cloister walk
  const vesica = (x0, y0, z0, A2, B2) => [
    ...Array.from({ length: 21 }, (_, i) => {
      const t = -Math.PI / 2 + (Math.PI * i) / 20
      return { x: x0 + B2 * Math.cos(t), y: y0 + A2 * Math.sin(t), z: z0 }
    }),
    ...Array.from({ length: 20 }, (_, i) => {
      const t = Math.PI / 2 + (Math.PI * (i + 1)) / 20
      return { x: x0 + B2 * Math.cos(t), y: y0 + A2 * Math.sin(t), z: z0 }
    }),
  ]
  return [
    // A · arches
    ['pointed', 'Pointed lancet · Y-tracery', 'rib', archAt(sampleArch(twoCentredArch(0, 5, 1.8, 0), 8), -84, A)],
    ['pointed', 'Pointed equilateral · geometric', 'rib', archAt(sampleArch(twoCentredArch(0, 6, 0.95, 0), 8), -64, A)],
    ['pointed', 'Pointed drop · intersecting', 'rib', archAt(sampleArch(twoCentredArch(0, 7, 0.5, 0), 8), -42, A)],
    ['cusped', 'Cusped arch + gable', 'rib', archAt(sampleArch(twoCentredArch(0, 6, 1.2, 0), 8), -21, A)],
    ['tudor', 'Tudor arch · panel tracery', 'rib', archAt(sampleCArch(tudorArch(8, 4.5), 6), 2, A)],
    ['ogee', 'Ogee hood · flamboyant window', 'rib', archAt(sampleCArch(ogeeArch(7, 13), 8), 26, A)],
    ['round', 'Round arch · plate tracery', 'rib', archAt(sampleArch(twoCentredArch(0, 6, 0, 0), 10), 47, A)],
    ['rampant', 'Rampant arch · curvilinear', 'rib', archAt(sampleCArch(rampantArch(6, 5, 1, 9), 8), 66, A)],
    ['storeys', 'Stacked elevation', 'rib', archAt(sampleArch(twoCentredArch(0, 10, 2, 0), 10), 88, A - 6)],
    // B · windows and vertical structures
    ['rose', 'Rose window', 'rib', circleV(-80, 12, B, 9, 48)],
    ['wheel', 'Wheel window', 'rib', circleV(-60, 8, B, 4.5, 40)],
    ['vesica', 'Vesica window', 'rib', vesica(-46, 10, B, 8, 3.5)],
    ['triangle', 'Spherical-triangle window', 'rib', loop([{ x: -38, y: 4, z: B }, { x: -24, y: 4, z: B }, { x: -31, y: 16, z: B }], 10)],
    ['spire', 'Spire (openwork)', 'rib', [{ x: -6, y: 0, z: B }, { x: -6, y: 16, z: B }, { x: -6, y: 32, z: B }]],
    ['canopy', 'Canopy around a short shaft', 'rib', [{ x: 12, y: 0, z: B }, { x: 12, y: 4, z: B }, { x: 12, y: 8, z: B }]],
    ['spiralStair', 'Spiral stair', 'rib', Array.from({ length: 61 }, (_, i) => ({ x: 30 + 3 * Math.cos((3 * TAU * i) / 60), y: (12 * i) / 60, z: B + 3 * Math.sin((3 * TAU * i) / 60) }))],
    ['panel', 'Perpendicular panel screen', 'tracery', [{ x: 46, y: 0, z: B }, { x: 46, y: 5, z: B }, { x: 46, y: 10, z: B }]],
    // C · plans on the ground
    ['canopy', 'Canopy / tabernacle', 'rib', loop(rect(-80, C, 3, 3), 6)],
    ['vault', 'Ribbed vault (sexpartite)', 'rib', loop(rect(-46, C, 12, 6), 10)],
    ['chapterHouse', 'Chapter house', 'rib', circleH(-6, C, 9, 48)],
    ['apse', 'Apse + radiating chapels', 'rib', Array.from({ length: 25 }, (_, i) => ({ x: 26 + 11 * Math.cos((Math.PI * i) / 24), y: 0, z: C - 6 + 11 * Math.sin((Math.PI * i) / 24) }))],
    ['vault', 'Ribbed vault (quadripartite)', 'rib', loop(rect(70, C, 8.5, 6), 10)],
    // D · flat curves and classic roles
    ['arcade', 'Blind arcade', 'rib', Array.from({ length: 11 }, (_, i) => ({ x: -95 + 3 * i, y: 0, z: D }))],
    ['interlaced', 'Interlaced arcade', 'rib', Array.from({ length: 21 }, (_, i) => {
      const t = ((100 * Math.PI) / 180) * (i / 20 - 0.5)
      return { x: -48 + 18 * Math.sin(t), y: 0, z: D - 12 + 18 * Math.cos(t) }
    })],
    ['reticulated', 'Reticulated net', 'rib', Array.from({ length: 41 }, (_, i) => ({ x: -22 + i * 0.9, y: 0, z: D + 2.5 * Math.sin((i / 40) * 2 * TAU) }))],
    ['parapet', 'Parapet gallery', 'rib', Array.from({ length: 11 }, (_, i) => ({ x: 20 + 2.4 * i, y: 10, z: D }))],
    ['band', 'Tracery band (classic)', 'rib', Array.from({ length: 6 }, (_, i) => ({ x: 52 + 2 * i, y: 0, z: D }))],
    ['classic', 'Compound pier (column)', 'column', [{ x: 72, y: 0, z: D }, { x: 72, y: 14, z: D }]],
    ['classic', 'Two-tier flying buttress', 'buttress', [{ x: 78, y: 0, z: D }, { x: 82, y: 12, z: D }, { x: 89, y: 18, z: D }, { x: 94, y: 20, z: D }]],
    // E · cloister walk
    ['cloister', 'Cloister walk', 'rib', loop(rect(0, E, 34, 10), 12)],
  ]
}

export function createSampleProject() {
  let p = createEmptyProject()
  sampleCurves().forEach(([, name, role, pts], i) => {
    const curveId = `sample_${String(i).padStart(2, '0')}`
    p = applyCommand(p, { type: 'addCurve', curveId, curveType: 'polyline', points: pts })
    p = applyCommand(p, { type: 'setCurveField', curveId, field: 'name', value: name })
    if (role !== 'rib') p = applyCommand(p, { type: 'setCurveField', curveId, field: 'curveRole', value: role })
  })
  return p
}
