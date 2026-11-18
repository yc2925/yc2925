/**
 * Curve-member skeleton + Gothic shape-grammar parameters (Step 47, round 2).
 * Every drawn curve is one member that follows its exact path; variation comes
 * from compass-and-straightedge construction rules (see grammar.js), never
 * from branching growth.
 *
 * `roles` lists the curve roles a parameter acts on (the panel shows only
 * those for the selected curve).
 */

export const DEFAULT_SKELETON_PARAMS = Object.freeze({
  thickness: 0.6, // member radius at its base (m)
  taper: 0.25, // radius reduction from base to tip
  style: 0, // 0 auto (seeded) · 1 geometric · 2 Y-tracery · 3 intersecting
  subdivision: 2, // lancets under an arch
  refine: 1, // recursive refinement levels of geometric tracery
  archivolts: 1, // concentric orders around an arch
  foilLobes: 4, // lobes of the principal foils (trefoil … octofoil)
  cuspDepth: 0.55, // how deep the cusps between lobes cut in
  lancetFoil: 0.6, // cusped foil in each lancet head (0 = none)
  screen: 0.35, // how far mullions drop from the springing toward the ground
  gable: 0.45, // gable over the arch (0 = none)
  crockets: 0.6, // crocket density on gables
  bandHeight: 2.6, // height of tracery bands (m)
  bandSpacing: 0.15, // gap between band circles (0 = tangent chain)
  shafts: 4, // shafts around a column (compound pier)
  springers: 0, // vault ribs springing from a column capital
  pierHeight: 0.75, // buttress pier height / strut height
  setbacks: 2, // stepped setbacks of a buttress pier
  pinnacles: 0.7, // pinnacle height on piers and free column tops (0 = none)
  grotesques: 0.6, // chance of grotesque / gargoyle pairs
  jointSize: 1.4, // boss size where connected curves meet (× thickness)
})

const ALL = ['rib', 'column', 'buttress', 'tracery']

export const SKELETON_PARAM_SPECS = Object.freeze([
  { key: 'thickness', label: 'Member thickness', min: 0.15, max: 2.5, step: 0.05, unit: 'm', tier: 'essential', roles: ALL, help: 'Radius of the structural member along each curve; tracery bars, shafts and ornaments scale with it.' },
  { key: 'taper', label: 'Taper', min: 0, max: 0.9, step: 0.01, tier: 'advanced', roles: ALL, help: 'How much the main member thins: supports from base to top, arches and bands from both springings toward the crown.' },
  { key: 'style', label: 'Tracery style', min: 0, max: 3, step: 1, tier: 'essential', roles: ['rib'], help: 'Arch tracery system: 0 Auto (seed picks), 1 Geometric (lancets + tangent oculus + foil), 2 Y-tracery (branches concentric with the opposite arc), 3 Intersecting (main-arch circles repeated from each mullion).' },
  { key: 'subdivision', label: 'Lancets', min: 1, max: 4, step: 1, tier: 'essential', roles: ['rib'], help: 'Number of lancets the arch is divided into (equal spans on the springing line).' },
  { key: 'refine', label: 'Refinement depth', min: 0, max: 2, step: 1, tier: 'essential', roles: ['rib'], help: 'Geometric tracery: each lancet is subdivided again into two with its own oculus (shape-grammar recursion).' },
  { key: 'archivolts', label: 'Archivolts', min: 0, max: 3, step: 1, tier: 'essential', roles: ['rib'], help: 'Concentric orders around the arch (same centres, radius + offset).' },
  { key: 'foilLobes', label: 'Foil lobes', min: 3, max: 8, step: 1, tier: 'essential', roles: ['rib', 'tracery', 'buttress'], help: 'Lobes of the principal foils (3 trefoil, 4 quatrefoil … 8). Smaller motifs use fewer lobes, keeping the hierarchy.' },
  { key: 'cuspDepth', label: 'Cusp depth', min: 0, max: 1, step: 0.01, tier: 'essential', roles: ['rib', 'tracery', 'buttress'], help: 'How sharply the cusps between foil lobes cut inward (lobe-circle overlap).' },
  { key: 'lancetFoil', label: 'Lancet-head foil', min: 0, max: 1, step: 0.01, tier: 'advanced', roles: ['rib'], help: 'Size of the cusped trefoil inscribed in each lancet head (circle tangent to both arcs and a transom). 0 = none.' },
  { key: 'screen', label: 'Mullion drop', min: 0, max: 1, step: 0.01, tier: 'advanced', roles: ['rib'], help: 'How far the mullions continue down from the springing line toward the ground (1 = full traceried screen).' },
  { key: 'gable', label: 'Gable', min: 0, max: 1, step: 0.01, tier: 'essential', roles: ['rib'], help: 'Pointed gable over the arch with a foil tangent to both gable lines and the arch (0 = none).' },
  { key: 'crockets', label: 'Crockets', min: 0, max: 1, step: 0.01, tier: 'advanced', roles: ['rib'], help: 'Density of carved crockets along the gable edges; also adds the finial.' },
  { key: 'bandHeight', label: 'Band height', min: 0.8, max: 6, step: 0.05, unit: 'm', tier: 'essential', roles: ['rib', 'tracery', 'buttress'], help: 'Height of the tracery band along flat ribs, tracery curves and flyers (circle diameter).' },
  { key: 'bandSpacing', label: 'Band spacing', min: 0, max: 1, step: 0.01, tier: 'advanced', roles: ['rib', 'tracery', 'buttress'], help: 'Gap between band circles (0 = tangent chain); spandrel circles follow r = d²/4ρ.' },
  { key: 'shafts', label: 'Shafts', min: 0, max: 8, step: 1, tier: 'essential', roles: ['column'], help: 'Shafts clustered around the column core (compound pier, rotational symmetry).' },
  { key: 'springers', label: 'Vault springers', min: 0, max: 8, step: 1, tier: 'essential', roles: ['column'], help: 'Vault ribs springing from the capital as circular arcs (vertical tangent at the capital).' },
  { key: 'pierHeight', label: 'Pier height', min: 0, max: 1, step: 0.01, tier: 'essential', roles: ['buttress'], help: 'Height of the buttress pier at the ground end, as a fraction of the strut height (0 = no pier).' },
  { key: 'setbacks', label: 'Setbacks', min: 0, max: 3, step: 1, tier: 'advanced', roles: ['buttress'], help: 'Stepped reductions of the buttress pier as it rises.' },
  { key: 'pinnacles', label: 'Pinnacles', min: 0, max: 1, step: 0.01, tier: 'essential', roles: ['column', 'buttress', 'rib'], help: 'Height of the pinnacles crowning buttress piers and free column tops (0 = none).' },
  { key: 'grotesques', label: 'Grotesques', min: 0, max: 1, step: 0.01, tier: 'essential', roles: ['rib', 'buttress'], help: 'Chance of carved grotesques: corbel pairs at arch springings, gargoyles on buttress piers.' },
  { key: 'jointSize', label: 'Boss size', min: 0, max: 3, step: 0.05, tier: 'advanced', roles: ALL, help: 'Size of the carved boss where connected curves meet (× thickness, 0 = none).' },
])

/** How each curve role is read by the grammar. */
export const ROLE_RULES = Object.freeze({
  rib: { label: 'Rib / arch', radius: 1, help: 'An arching curve becomes a pointed arch with tracery, archivolts and gable; a flat one carries a tracery band.' },
  column: { label: 'Column', radius: 1.5, help: 'Compound pier: clustered shafts, capital, moulded base and vault springers.' },
  buttress: { label: 'Flying buttress', radius: 1.6, help: 'Strut with a stepped pier, pinnacle and gargoyle at its foot, tracery in the flyer.' },
  tracery: { label: 'Tracery', radius: 0.45, help: 'Tracery band: rails, tangent circles with foils, spandrel circles (REF-013).' },
})
