/**
 * Carved-stone masonry parameters (Step 47, round 2).
 * The twelve stone controls from round 1 keep their names, ranges and order;
 * the round-2 material / carving controls follow them.
 * References: REF-030 (voussoir coursing), REF-004 (drums, bosses, capitals),
 * REF-007 / REF-012 (pinnacles, crockets), REF-018 / REF-020 (grotesques).
 */

export const DEFAULT_LITHIC_PARAMS = Object.freeze({
  density: 1, // fraction of stone slots that receive a stone
  stoneSize: 0.85, // mean block face size (m)
  sizeGrading: 0.4, // bigger stones low, smaller high
  sizeVariation: 0.2,
  thickness: 0.6, // course height / face size
  irregularity: 0.25, // chipped arrises (render prototypes)
  gap: 0.02, // joint gap (m)
  courseRegularity: 0.8, // 1 = neat coursed ashlar, 0 = random rubble
  tiltJitter: 1, // degrees of hand-set tilt
  formationWidth: 1, // stone section / member radius
  wallDepth: 1, // stones through the wall
  gravel: 0.35, // loose stone at the base
  stoneMix: 0.35, // 0 limestone · 1 sandstone
  weathering: 0.5, // darkening toward the ground
  dressing: 0.75, // 0 rough-hewn, pitched faces · 1 finely dressed ashlar
  carvingScale: 1, // size of carved pieces (bosses, keystones, pinnacles, grotesques…)
})

export const LITHIC_PARAM_SPECS = Object.freeze([
  // Round-1 stone controls (same labels, ranges and order).
  { key: 'density', label: 'Stone density', min: 0.3, max: 1, step: 0.01, tier: 'essential', help: 'Fraction of stone positions that are filled — lower reads as ruined, gappy masonry.' },
  { key: 'stoneSize', label: 'Stone size', min: 0.2, max: 2, step: 0.02, unit: 'm', tier: 'essential', help: 'Mean face size of each stone (blocks, drums, voussoirs, tracery bar length).' },
  { key: 'sizeGrading', label: 'Size range (base → top)', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'How much larger stones are at the bottom than at the top of the structure.' },
  { key: 'sizeVariation', label: 'Size variation', min: 0, max: 0.8, step: 0.01, tier: 'essential', help: 'Random stone-to-stone size difference (block lengths within a course vary too).' },
  { key: 'thickness', label: 'Stone thickness', min: 0.2, max: 1, step: 0.01, tier: 'essential', help: 'Stone depth along the member: thin slabs / voussoirs (low) or chunky blocks (high). Also the course height.' },
  { key: 'irregularity', label: 'Irregularity', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'How chipped and jagged each stone’s edges and facets are.' },
  { key: 'gap', label: 'Joint gap', min: 0, max: 0.2, step: 0.005, unit: 'm', tier: 'essential', help: 'Open joint between neighbouring stones (no mortar).' },
  { key: 'courseRegularity', label: 'Course regularity', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Neat staggered courses (1) versus random rubble placement (0).' },
  { key: 'tiltJitter', label: 'Tilt jitter', min: 0, max: 20, step: 0.5, unit: '°', tier: 'essential', help: 'Random tilt of each stone so the work looks hand-built.' },
  { key: 'formationWidth', label: 'Formation width', min: 1, max: 5, step: 0.05, tier: 'essential', help: 'Width of the stone section around each structural member, relative to the member thickness (capitals, bases and keystones grow with it; tracery bars stay slender).' },
  { key: 'wallDepth', label: 'Wall thickness (stones)', min: 1, max: 5, step: 1, tier: 'essential', help: 'How many stones deep the masonry is.' },
  { key: 'gravel', label: 'Gravel', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Amount of loose gravel and fallen stones around the base.' },
  // Round-2 material and carving controls.
  { key: 'stoneMix', label: 'Limestone ↔ sandstone', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Share of structures built in warm sandstone (#8f867a, #6f5d3f, #5b513f, #372e20) instead of pale limestone (#b7b2ad, #a8a4a0, #928e8a, #7a7772).' },
  { key: 'weathering', label: 'Weathering', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Grime and damp: stones darken toward the ground into #525050 / #363331.' },
  { key: 'dressing', label: 'Dressing', min: 0, max: 1, step: 0.01, tier: 'essential', help: 'Tooling of the blocks: rough-hewn pitched faces (0) to finely dressed ashlar with crisp chamfers (1).' },
  { key: 'carvingScale', label: 'Carving scale', min: 0.4, max: 2, step: 0.01, tier: 'essential', help: 'Size of the carved pieces: keystones, bosses, capitals, pinnacles, crockets, finials, grotesques.' },
])
