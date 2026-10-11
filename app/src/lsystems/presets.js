import * as THREE from 'three'

/**
 * Three growth presets of the same L-system engine.
 * Each preset: axiom, rules, terminal replacement, placement mode, start sites,
 * and default turtle parameters.
 */

function onSurface(surface, x, y, z) {
  const hit = surface.project(new THREE.Vector3(x, y, z))
  const up = new THREE.Vector3(0, 1, 0)
  let heading = up.clone().addScaledVector(hit.normal, -up.dot(hit.normal))
  if (heading.lengthSq() < 1e-4) heading = new THREE.Vector3(0, 0, -1)
  heading.normalize()
  return { position: hit.point.addScaledVector(hit.normal, 0.018), heading, up: hit.normal.clone() }
}

export const PRESETS = [
  {
    id: 'branching',
    index: '01',
    label: 'Branching',
    placement: 'free',
    note: 'Classic 3D branching: every A becomes a segment and three rotated, pitched sub-branches (golden-angle roll). Grows in space from the plinth and is pushed off the wall where it touches it.',
    axiom: 'A',
    rules: {
      A: [
        { p: 0.7, s: 'F[&FA]/[&FA]/[&FA]' },
        { p: 0.3, s: 'F[&FA]/[&FA]' },
      ],
    },
    terminal: { A: 'K' },
    knotLength: 0.1,
    maxIterations: 7,
    defaults: {
      iterations: 5,
      angle: 28,
      step: 0.42,
      lengthDecay: 0.82,
      widthDecay: 0.72,
      width: 0.045,
      randomness: 0.25,
      tropism: 0.35,
    },
    sites: () => [
      { position: new THREE.Vector3(-1.75, 0.5, 0.3), heading: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, 1) },
      { position: new THREE.Vector3(1.75, 0.5, 0.3), heading: new THREE.Vector3(0, 1, 0), up: new THREE.Vector3(0, 0, 1) },
    ],
  },
  {
    id: 'ivy',
    index: '02',
    label: 'Climbing Ivy',
    placement: 'conform',
    note: 'A climbing stem that keeps rewriting its tip (A) and drops alternating side shoots (B). Every step snaps to the wall; turns happen around the surface normal, so the plant hugs pilasters, columns and the door.',
    axiom: 'A',
    rules: {
      A: [
        { p: 0.5, s: 'FF[+B]FF[-B]A' },
        { p: 0.5, s: 'FF[-B]FF[+B]A' },
      ],
      B: [
        { p: 0.65, s: 'F[-C]F[+C]FB' },
        { p: 0.35, s: 'FFK' },
      ],
      C: [{ p: 1, s: 'FK' }],
    },
    terminal: { A: 'K', B: 'K', C: 'K' },
    knotLength: 0.25,
    maxIterations: 10,
    defaults: {
      iterations: 7,
      angle: 42,
      step: 0.11,
      lengthDecay: 0.86,
      widthDecay: 0.7,
      width: 0.024,
      randomness: 0.3,
      tropism: 0.45,
    },
    sites: (surface) => [
      onSurface(surface, -2.2, 0.85, 0.38),
      onSurface(surface, -1.42, 0.85, 0.2),
      onSurface(surface, -0.45, 0.9, -0.8),
      onSurface(surface, 1.42, 0.85, 0.2),
    ],
  },
  {
    id: 'tracery',
    index: '03',
    label: 'Gothic Tracery',
    placement: 'project',
    note: 'Y-tracery: each bar splits into two shorter, thinner bars (A → F[+A][-A]); the tips become foils. Drawn flat in a plane in front of the portal, then raycast onto the door and jambs.',
    axiom: 'A',
    rules: { A: [{ p: 1, s: 'F[+A][-A]' }] },
    terminal: { A: 'K' },
    knotLength: 0.45,
    maxIterations: 7,
    defaults: {
      iterations: 5,
      angle: 20,
      step: 1.2,
      lengthDecay: 0.6,
      widthDecay: 0.82,
      width: 0.04,
      randomness: 0,
      tropism: 0,
    },
    sites: () => [
      {
        position: new THREE.Vector3(0, 0.62, 0.7),
        heading: new THREE.Vector3(0, 1, 0),
        up: new THREE.Vector3(0, 0, 1),
        projectDirection: new THREE.Vector3(0, 0, -1),
      },
    ],
  },
]

export function presetById(id) {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0]
}

export function defaultSettings(id = PRESETS[0].id) {
  return {
    preset: id,
    seed: 7,
    growth: 1,
    showArchitecture: true,
    showKnots: true,
    lodMode: 'auto',
    wireframe: false,
    ...presetById(id).defaults,
  }
}

/** Human-readable rules for the status panel. */
export function formatRules(preset) {
  return Object.entries(preset.rules).flatMap(([symbol, options]) =>
    options.map((option) => (options.length > 1 ? `${symbol} → ${option.s}   (${option.p})` : `${symbol} → ${option.s}`)),
  )
}
