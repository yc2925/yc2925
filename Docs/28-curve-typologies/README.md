# 28 — Curve typologies: the curve decides the building

Before this step, every curve that rose became the same kind of building: a two-centred pointed arch, with a gable, a quatrefoil and a tracery style picked at random. Every flat curve became the same tracery band. As a result the city looked like one building at different scales.

Now each curve is **measured**, and those measurements choose one of **24 Gothic typologies**. The Step 47 grammar is still there. Set **Typology → Classic** to get it back exactly as it was.

Source: `gothic_tracery_mathematics_analysis.md` §2–§8 (circles, arcs, subdivision, tangency, symmetry, shape grammar).

## References used

| Ref | What it informs |
|---|---|
| REF-001 | Families of window: plate tracery (A–C), geometric, curvilinear (J, M), Perpendicular / rectilinear panels (N, O), flamboyant (P) |
| REF-004 | Ribbed vault: transverse, wall and diagonal ribs; compound piers; stacked elevation |
| REF-005 | Flamboyant tracery: ogee lights, soufflets and mouchettes inside a pointed opening |
| REF-007 | Canopy / tabernacle: four shafts, gabled arches with a foil in each gable, corner pinnacles, inner vault |
| REF-011 | Rayonnant circle geometry: rings, foils, radiating lancets |
| REF-012 | Octagonal spire with rings and crockets; gallery of quatrefoils (parapet); gable tracery |

None of the generated buildings claims to reconstruct any of these monuments.

## 1. Curve signature (`app/src/world/skeleton/signature.js`)

Everything is measured on the resampled curve, which has a point every ~0.5 m. No randomness is involved, so the same curve always gets the same building.

| Quality | How it is measured |
|---|---|
| closed | The ends meet: gap < max(1 m, 8 % of the length) |
| plane | Best-fit plane from the covariance matrix (Jacobi eigen-decomposition), giving a normal, two in-plane axes and a flatness value. *upright*: \|n·up\| < 0.35. *horizontal*: \|n·up\| > 0.8 |
| rise | Chord, half-span a, rise h (the farthest point from the chord), h / a, and how much the rise points up |
| inflections | Sign changes of the in-plane curvature (smoothed, with hysteresis). The threshold is 0.35 × the **median** curvature, so one sharp apex cannot hide gentle S-bends |
| curvature CV | std / mean of \|curvature\|; ≈ 0 for a circle |
| corners | Turns > 50° within ~1.5 m |
| symmetry | Left/right height mismatch of the arch profile |
| end drop | Height difference of the ends / chord |
| verticality, straightness | \|chord·up\| / chord, and chord / length |
| helix | Winds ≥ 1.4 turns around a vertical axis while rising more than 2 m |
| roundness, aspect | Spread of radius from the centroid; √(λ₁/λ₂) of the spread within the plane |

## 2. Typology rules (`typology.js`)

The rules are checked in order. Every rule that fires writes its reason, with numbers, into the debug rule log as a `typology` step.

| Curve | Typology |
|---|---|
| Closed, flat on the ground, perimeter < 28 m | Canopy |
| Closed, on the ground, perimeter > 90 m | Cloister walk |
| Closed, on the ground, round (radius spread < 0.14) | Chapter house |
| Closed, on the ground, otherwise | Ribbed vault (4-part, or 6-part when the bay count is even) |
| Closed, upright, 3 corners | Spherical-triangle window |
| Closed, upright, aspect > 1.45 | Vesica window |
| Closed, upright, radius < 5.5 m | Wheel window |
| Closed, upright, otherwise | Rose window |
| Helix | Spiral stair |
| Straight and vertical, ≥ 12 m tall | Spire (openwork when ≥ 22 m) |
| Straight and vertical, shorter | Canopy around it |
| Arch with 2–4 reverse bends | Ogee arch + flamboyant tracery |
| Arch whose springings differ, or asymmetric | Rampant arch + curvilinear tracery |
| Arch with rise / half-span < 0.8 | Four-centred (Tudor) arch + panel tracery |
| Arch with even curvature and h / a ≤ 1.25 | Round / segmental arch + plate tracery |
| Arch with rise > 22 m and h / a > 1.2 | Stacked elevation: arcade, triforium, clerestory |
| Pointed arch, 1 < k ≤ 1.35 | Cusped arch + gable |
| Pointed arch, otherwise | Classic grammar, with the style chosen by the curve: lancet → Y, equilateral → geometric, drop → intersecting |
| Flat ground curve turning 130–250° | Apse with radiating chapels |
| Flat curve more than 4 m above the ground | Parapet gallery |
| Flat curve with ≥ 2 inflections | Reticulated net |
| Long ground curve | Blind arcade if straight, interlaced arcade if curved |
| Anything else that is flat | Tracery band (classic) |
| Tracery role, straight and vertical | Perpendicular panel screen |
| Column | Classic compound pier |
| Buttress | Classic flying buttress; a second flyer when the strut top is above 14 m |

## 3. Constructions (`arches2d.js`, `tracery2d.js`, `typologies.js`)

Every shape is built from circles, arcs and solved tangencies. Each solver returns its residuals, and the validator requires every residual to be below 1e-6.

### Arches

- **Composite arch.** An arch is a chain of arcs `{c, r, t0, t1, s}`. Arcs that join smoothly have centres collinear with the joint. A concentric offset (r ± δ) therefore keeps every joint angle exact, and only the apex has to be re-solved (circle ∩ circle).
- **Four-centred (Tudor) arch.**
  - Springing arc: centre C₁ = (−a + r₁, 0).
  - Haunch arc: centre C₂ = C₁ + t·(cos φ, −sin φ), radius R₂ = r₁ + t. This is internal tangency, so the joint is smooth.
  - The haunch arc passes through the apex: t = (\|w\|² − r₁²) / 2(w·d + r₁), with w = apex − C₁.
  - φ is the smallest angle that puts C₂ past the axis, which gives a pointed apex.
- **Ogee arch.**
  - Lower arcs R₁ = λa. Upper arcs are reversed, centred at (−R₂, h) so the tangent at the apex is vertical.
  - The two arcs are externally tangent: R₂ = (p² + h² − R₁²) / 2a, with p = −a + R₁.
  - Inward offsets of a vertical-tangent apex collapse, so each order of an ogee is rebuilt as a new ogee with span a ± δ and rise h ± 1.8δ.
- **Round / segmental arch.** One circle with R = (a² + h²) / 2h.
- **Rampant arch.**
  - Each arc is centred on its own springing line and passes through the apex P.
  - cx₁ = (xp² + hp² − a²) / 2(xp + a).
  - cx₂ = (a² − xp² − (hp − d)²) / 2(a − xp).
- **Cusped intrados.**
  - Lobe circles are internally tangent to the arch arc at equal angles: \|O − C\| = R − r.
  - Lobe radius r = kRs / (1 + ks), with s = sin(Δθ/2).
  - The cusps are the intersections of neighbouring lobes.

### Tracery

- **Panel (Perpendicular) tracery.** Mullions rise to the arch. Each panel head is an equilateral arch springing at y_t − √3·b, so its apex lies exactly on the transom.
- **Flamboyant tracery.**
  - The ogee is the hood. Under it is a two-centred window, the widest and then sharpest one that clears the ogee by one bar width.
  - Inside the window are ogee lights. Soufflets are vesicas, R = (A² + B²) / 2B, placed on the mullion axes.
  - Mouchettes have flanks internally tangent to the head and passing through the tail: t = (r² − \|w\|²) / 2(w·u − r).
  - Fitting searches over position, then bisects the radius. Mouchettes are mirror-symmetric.
- **Plate tracery.** Two round-headed lights. A roundel sits on the axis, internally tangent to the arch circle and externally tangent to both lights (bisection).
- **Rose window.**
  - Sector angles θₖ = 2πk/n. Radiating lancets spring on the spokes at ρ = R/2.
  - Rim oculi lie on the spokes, internally tangent to the rim and externally tangent to the lancet arcs.
- **Wheel window.** Colonnette spokes and round arches on the spokes, with roundels in the gaps.
- **Vesica window.**
  - Central roundel: r = R′ − c, tangent to both arcs.
  - End roundels: r(y) = R′ − √(c² + y²), with y = B′ + r.
- **Spherical-triangle window.** Each arc passes through two corners. One roundel is internally tangent to all three arcs, found with a 2×2 Newton solve.
- **Reticulated net.** Reverse curves made of two equal arcs, tangent at their midpoint: R = (Δx² + Δy²) / 2Δx.

### Plans and vertical structures

- **Ribbed vault.**
  - Equilateral transverse ribs and wall ribs.
  - Diagonal ribs rise to the same crown. They are segmental when the crown is lower than the half-diagonal.
  - With Lancets ≥ 3: a ridge rib and tiercerons.
- **Chapter house.** Radial ribs are equilateral arches from the column to the wall, with vertical tangents at both ends. A lierne ring at R/2 joins their apexes.
- **Apse.** Radial ribs use a circle centred on the springing line that passes through the keystone: cx = (R² − Δh²) / 2R.
- **Spire.**
  - 8 crocketed ribs rise from an octagon of radius 0.1·H.
  - Rings, plus foiled roundels in the faces when the spire is openwork.
  - Lucarnes and corner pinnacles at the foot.
- **Spiral stair.** A newel on the winding axis, treads with ~0.25 m risers, balusters and a handrail.

## 4. Parameters (Gothic skeleton panel)

| Parameter | Values | Effect |
|---|---|---|
| **Typology** | Auto (default) · Classic · any of the 24 | Auto reads the curve. Classic is the Step 47 grammar. Any other value forces that typology; if the curve can't support it, the build falls back to classic and the log says so |
| Crocket style | Leaf · Grotesque heads · Rolled | Carving along gables, spires and ogee extrados |
| Cusp ends | Plain · Pierced eyelets · Grotesque tips | How foil cusps terminate (all foils, classic included) |
| Ball-flower | 0–1 | Carved balls along archivolts and wall ribs |

All existing parameters still apply: Lancets, Archivolts, Foil lobes, Cusp depth, Gable, Crockets, Pinnacles, Grotesques, Band height and so on. Each typology reads the ones that make sense for it.

## 5. Files

| File | Status | Contents |
|---|---|---|
| `app/src/world/skeleton/signature.js` | new | Curve signature, plane fit, circle fit |
| `app/src/world/skeleton/typology.js` | new | Typology list and the Auto rules |
| `app/src/world/skeleton/arches2d.js` | new | Composite-arc arch families, offsets, cusping |
| `app/src/world/skeleton/tracery2d.js` | new | Vesica, mouchette, reverse curve, tangent-circle solvers |
| `app/src/world/skeleton/typologies.js` | new | The builders |
| `app/src/world/skeleton/grammar.js` | changed | Dispatch to the typology; style chosen by the curve; crocket style, cusp ends, ball-flower. The classic code paths are unchanged |
| `app/src/world/skeleton/params.js` | changed | The four new parameters |
| `app/src/world/skeleton/members.js` | changed | Passes the control-point count; records the typology |
| `app/src/world/compose/DebugLayer.jsx` | changed | Rule colours for the new rules |
| `app/scripts/validate-world.mjs` | changed | Step 47 checks pinned to Classic; new Step 48 suite |

## 6. Validation (`npm run validate:world`)

- 24 test curves, one per typology, each get the expected typology from Auto.
- Every typology builds a valid skeleton: finite, above the ground, and with every tangency residual below 1e-6.
- Builds are deterministic and take about 1 ms per curve.
- Forcing any typology onto an arch or a plan stays valid.
- Classic is unchanged: all Step 47 checks pass with `typology: 'classic'`.
- Kernel checks:
  - Tudor, ogee, rampant and segmental arches: exact incidence and tangency.
  - The composite offset reproduces the Step 47 archivolt.
  - Ogee orders are rebuilt ogees.
  - Cusped intrados.
  - Mouchette, reverse curve, vesica, and a roundel tangent to three arcs.
  - The ogee window holds soufflets and mouchettes.
  - The rose window has its rim oculi.

## 7. Limitations

- Auto uses thresholds, such as h / a < 0.8 for Tudor. A curve close to a threshold can flip type when it is edited slightly. Use the Typology selector to pin a type.
- Ogee, rampant and Tudor arches are built from the measured span and rise, not fitted to every point of the drawn curve. The drawn curve itself is still the main member, so the two can differ a little.
- Flamboyant tracery and mouchettes need room. In small ogee windows (half-span < ~3 m at the default thickness), only soufflets fit, and the log says so.
- Plan typologies (vault, chapter house, apse, cloister) choose their own heights from plan proportions. The curve gives only the plan.
- Crocket and cusp variants reuse the existing carved prototypes (crocket, grotesque, boss). No new carving geometry was added.
- The spiral stair, parapet and arcades are skeletal members. The lithic stage stacks stones along them like any other member; there are no dedicated tread or panel stones.
