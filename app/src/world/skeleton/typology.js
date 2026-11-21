/**
 * Typology chooser (Step 48): curve signature → Gothic typology.
 *
 * Auto reads the drawn curve (signature.js) so different curves become
 * different buildings. "Classic" keeps the Step 47 grammar exactly as it was
 * (pointed arch with seeded tracery style, or a tracery band). Any other
 * option forces that typology for the selected curve.
 *
 * Every typology is a construction (circles, arcs, tangencies, symmetry) —
 * see arches2d.js, tracery2d.js and typologies.js.
 */

export const TYPOLOGIES = [
  // Arch families (rib role, arch test passed)
  { id: 'pointed', label: 'Pointed arch (lancet / equilateral / drop)', family: 'arch', help: 'Two-centred arch; tracery style follows the arch sharpness.' },
  { id: 'cusped', label: 'Cusped arch', family: 'arch', help: 'Pointed arch whose intrados is cut into foil lobes.' },
  { id: 'tudor', label: 'Four-centred (Tudor) arch + panel tracery', family: 'arch', help: 'Two small springing arcs tangent to two large flat arcs; Perpendicular panels.' },
  { id: 'ogee', label: 'Ogee arch + flamboyant tracery', family: 'arch', help: 'Reverse-curved arch; ogee lights, soufflets and mouchettes (REF-005).' },
  { id: 'round', label: 'Round / segmental arch + plate tracery', family: 'arch', help: 'One circle; two lights and a pierced roundel (REF-001 A–C).' },
  { id: 'rampant', label: 'Rampant arch + curvilinear tracery', family: 'arch', help: 'Springings at different heights; flowing branches (REF-010).' },
  { id: 'storeys', label: 'Stacked elevation (arcade · triforium · clerestory)', family: 'arch', help: 'A tall arch split into three storeys (REF-004).' },
  // Closed curves
  { id: 'rose', label: 'Rose window (Rayonnant)', family: 'closed', help: 'Circle divided into n sectors: spokes, radiating lancets, rim oculi, hub foil (REF-011).' },
  { id: 'wheel', label: 'Wheel window', family: 'closed', help: 'Spokes to a rim arcade of round arches.' },
  { id: 'vesica', label: 'Vesica window', family: 'closed', help: 'Two equal arcs (mandorla) with tangent roundels.' },
  { id: 'triangle', label: 'Spherical-triangle window', family: 'closed', help: 'Three arcs through three corners, inscribed trefoil.' },
  { id: 'vault', label: 'Ribbed vault (4- / 6-part)', family: 'plan', help: 'Closed plan on the ground → bays, piers, transverse, wall and diagonal ribs (REF-004).' },
  { id: 'chapterHouse', label: 'Chapter house (central column)', family: 'plan', help: 'Round plan → one column, ribs radiating like a fan to the wall piers.' },
  { id: 'canopy', label: 'Canopy / tabernacle', family: 'plan', help: 'Four shafts, gabled arches, corner pinnacles, inner vault (REF-007).' },
  { id: 'cloister', label: 'Cloister walk', family: 'plan', help: 'Long closed loop → arcade of traceried bays around a garth.' },
  // Open flat curves
  { id: 'band', label: 'Tracery band', family: 'flat', help: 'Rails, tangent circle chain with foils, spandrel circles (REF-013).' },
  { id: 'reticulated', label: 'Reticulated (net) tracery', family: 'flat', help: 'Wavy curve → net of ogee cells from reverse curves.' },
  { id: 'arcade', label: 'Blind arcade', family: 'flat', help: 'Straight ground curve → wall of cusped pointed arches.' },
  { id: 'interlaced', label: 'Interlaced arcade', family: 'flat', help: 'Curved ground curve → round arches spanning two bays, overlapping.' },
  { id: 'parapet', label: 'Parapet gallery', family: 'flat', help: 'High flat curve → rails, posts, quatrefoil panels and cresting (REF-012 Galerie).' },
  { id: 'apse', label: 'Apse with radiating chapels', family: 'plan', help: 'Half-circle on the ground → piers, bay arches, radial ribs, chapels.' },
  { id: 'panel', label: 'Perpendicular panel screen', family: 'flat', help: 'Straight vertical curve (tracery role) → mullions, transoms, cusped panel heads.' },
  // Vertical / 3D
  { id: 'spire', label: 'Spire (octagonal, openwork when tall)', family: 'vertical', help: 'Tall straight vertical curve → octagonal spire, rings, lucarnes, openwork panels (REF-012).' },
  { id: 'spiralStair', label: 'Spiral stair', family: 'vertical', help: 'Helix → newel, treads, balusters.' },
]

export const TYPOLOGY_OPTIONS = [
  { id: 'auto', label: 'Auto (from the curve)' },
  { id: 'classic', label: 'Classic (Step 47 grammar)' },
  ...TYPOLOGIES.map((t) => ({ id: t.id, label: t.label })),
]

const f = (v) => (Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2))

/**
 * Choose a typology. Returns { id, reason, family } where reason is the rule
 * that fired, written for the debug log. `classic: true` means: run the
 * Step 47 code unchanged.
 */
export function chooseTypology(role, sig, P) {
  const forced = P.typology && P.typology !== 'auto' ? P.typology : null
  if (forced === 'classic') return { id: 'classic', classic: true, reason: 'Typology: Classic (Step 47 grammar, set on the curve)' }
  if (forced) return { id: forced, reason: `Typology: ${forced} (set on the curve)` }
  if (role === 'column') return { id: 'classic', classic: true, reason: 'Column: compound pier (classic grammar)' }
  if (role === 'buttress') return { id: 'classic', classic: true, reason: `Buttress: flying buttress${sig.maxY > 14 ? ' — strut top above 14 m → two flyers' : ''}`, tiers: sig.maxY > 14 ? 2 : 1 }

  const archOk = sig.riseRatio >= 0.35 && sig.riseUp >= 0.5 && sig.chord >= 2

  if (sig.closed) {
    if (sig.horizontal && sig.maxY < 4) {
      const per = sig.length
      if (per < 28) return { id: 'canopy', reason: `Closed plan on the ground, perimeter ${f(per)} m < 28 m → canopy` }
      if (per > 90) return { id: 'cloister', reason: `Closed plan on the ground, perimeter ${f(per)} m > 90 m → cloister walk` }
      if (sig.roundness < 0.14 && sig.aspect < 1.35) return { id: 'chapterHouse', reason: `Round closed plan (radius spread ${f(sig.roundness)} < 0.14, aspect ${f(sig.aspect)}) → chapter house` }
      return { id: 'vault', reason: `Closed plan on the ground, aspect ${f(sig.aspect)} → ribbed vault bays` }
    }
    if (sig.corners === 3) return { id: 'triangle', reason: 'Closed curve with 3 corners → spherical-triangle window' }
    if (sig.aspect > 1.45) return { id: 'vesica', reason: `Closed elongated curve (aspect ${f(sig.aspect)} > 1.45) → vesica window` }
    if (sig.meanRadius < 5.5) return { id: 'wheel', reason: `Small closed round curve (radius ${f(sig.meanRadius)} m < 5.5 m) → wheel window` }
    return { id: 'rose', reason: `Closed round curve (aspect ${f(sig.aspect)}) → rose window` }
  }
  if (sig.helix) return { id: 'spiralStair', reason: `Winds ${f(Math.abs(sig.wind) / (2 * Math.PI))} turns while rising ${f(sig.rise)} m → spiral stair` }
  if (role === 'tracery') {
    if (sig.verticality > 0.8 && sig.straightness > 0.85) return { id: 'panel', reason: 'Tracery role, straight vertical curve → Perpendicular panel screen' }
    if (sig.inflections >= 2) return { id: 'reticulated', reason: `Tracery role, ${sig.inflections} inflections → reticulated net` }
    return { id: 'band', classicBand: true, reason: 'Tracery role → tracery band (classic)' }
  }
  if (sig.verticality > 0.82 && sig.straightness > 0.85) {
    if (sig.rise >= 12) return { id: 'spire', reason: `Straight vertical curve, ${f(sig.rise)} m ≥ 12 m → spire` }
    return { id: 'canopy', reason: `Short straight vertical curve (${f(sig.rise)} m < 12 m) → canopy around it` }
  }
  if (archOk) {
    const reasonBase = `rise/half-span ${f(sig.riseRatio)}`
    if (sig.inflections >= 2 && sig.inflections <= 4) return { id: 'ogee', reason: `Arch with ${sig.inflections} reverse bends (S-curves) → ogee arch, flamboyant tracery` }
    if (sig.endDrop > 0.2 || sig.symmetry > 0.18) return { id: 'rampant', reason: `Arch springings differ (end drop ${f(sig.endDrop)}, asymmetry ${f(sig.symmetry)}) → rampant arch` }
    if (sig.riseRatio < 0.8) return { id: 'tudor', reason: `Low arch (${reasonBase} < 0.8) → four-centred Tudor arch, panel tracery` }
    if (sig.curvatureCV < 0.22 && sig.riseRatio <= 1.25) return { id: 'round', reason: `Even curvature (CV ${f(sig.curvatureCV)} < 0.22, ${reasonBase} ≤ 1.25) → round arch, plate tracery` }
    if (sig.h > 22 && sig.riseRatio > 1.2) return { id: 'storeys', reason: `Tall arch (rise ${f(sig.h)} m > 22 m) → arcade · triforium · clerestory` }
    const k = (sig.h * sig.h - sig.a * sig.a) / (2 * sig.a * sig.a)
    if (k > 1 && k <= 1.35) return { id: 'cusped', reason: `Pointed arch slightly sharper than equilateral (k = ${f(k)} in (1, 1.35]) → cusped intrados + gable` }
    const style = k > 1.35 ? 'y' : k < 0.75 ? 'intersecting' : 'geometric'
    const fam = k > 1.35 ? 'lancet' : k < 0.75 ? 'drop' : 'equilateral'
    return { id: 'pointed', style, reason: `Pointed ${fam} arch (k = ${f(k)}) → ${style === 'y' ? 'Y' : style} tracery` }
  }
  // Flat open curves.
  if (sig.onGround && sig.horizontal && sig.turningAbs > 2.3 && sig.turningAbs < 4.4 && sig.inflections === 0) return { id: 'apse', reason: `Ground curve turning ${f((sig.turningAbs * 180) / Math.PI)}° → apse with radiating chapels` }
  if (sig.minY > 4) return { id: 'parapet', reason: `Flat curve ${f(sig.minY)} m above ground → parapet gallery` }
  if (sig.inflections >= 2) return { id: 'reticulated', reason: `Flat curve with ${sig.inflections} inflections → reticulated net` }
  if (sig.onGround && sig.length > 14) {
    if (sig.straightness > 0.9) return { id: 'arcade', reason: `Straight ground curve (${f(sig.length)} m) → blind arcade` }
    return { id: 'interlaced', reason: `Curved ground curve (straightness ${f(sig.straightness)}) → interlaced arcade` }
  }
  return { id: 'band', classicBand: true, reason: 'Flat curve → tracery band (classic)' }
}
