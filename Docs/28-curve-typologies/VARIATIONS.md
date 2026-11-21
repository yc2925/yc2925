# Gothic structure variations: curve quality → structure → construction

This is a reference for every structure the curve-driven world can build today. It reflects the code in `app/src/world/skeleton/` (`signature.js`, `typology.js`, `typologies.js`, `arches2d.js`, `tracery2d.js`, `grammar.js`).

With **Typology = Auto**, the qualities of the drawn curve choose the row. To force a row on any curve, use the Typology selector in the Gothic skeleton panel. **Classic** brings back the Step 47 grammar.

The **5 Sample** tab in the app builds every row below side by side.

**Notation.**

| Symbol | Meaning |
|---|---|
| a | Half-span (half the chord) |
| h | Rise (distance from the chord to the farthest point) |
| k | Two-centred arch sharpness: (h² − a²) / 2a² |
| R, r | Circle radii |
| δ | Moulding offset |

Every tangency is solved exactly, and the validator requires each residual to be below 1e-6.

---

## A. Arches (the curve rises; arch test h/a ≥ 0.35 and the rise points up)

| # | Structure | Curve qualities that select it | How it is built |
|---|---|---|---|
| A1 | **Pointed arch, lancet** + Y-tracery | k > 1.35, which means a tall, narrow rise | Classic Step 47 grammar. Two-centred arch: centres ±c on the springing line, R = a + c. Archivolts are concentric (R + j·δ). Mullions fork into branches concentric with the opposite arc. Gable with a tangent foil, crockets and a finial. Keystone; grotesque corbels |
| A2 | **Pointed arch, equilateral** + geometric tracery | 0.75 ≤ k ≤ 1 | Classic grammar. Lancets subdivide the arch. Each oculus is internally tangent to the parent arch and externally tangent to both lancets (bisection). An n-foil sits in each oculus, and the recursion is refined to the set depth. Lancet-head roundels; gable |
| A3 | **Pointed arch, drop** + intersecting tracery | k < 0.75, a low, broad two-centred arch | Classic grammar. The main-arch circles are repeated from every mullion foot and clipped to the opening |
| A4 | **Cusped arch** + gable | 1 < k ≤ 1.35, slightly sharper than equilateral | Two-centred arch and archivolts. Cusped intrados: on each side arc, 2–4 lobe circles are internally tangent at equal angles, \|O − C\| = R − r with r = kRs / (1 + ks). Cusps are where neighbouring lobes intersect, and a pendant cusp hangs under the apex. A head roundel with a trefoil sits above it. Gable, gable foil, crockets, finial |
| A5 | **Four-centred (Tudor) arch** + Perpendicular panel tracery | h/a < 0.8: a low, flat arch | Springing arcs (centre (−a + r₁, 0)) join haunch arcs C₂ = C₁ + t(cos φ, −sin φ), R₂ = r₁ + t, by internal tangency. t = (\|w\|² − r₁²) / 2(w·d + r₁) puts the apex exactly at h. Mullions run up to the arch, with 1–2 transoms. Panel heads are equilateral arches springing at y_t − √3·b, so the apex touches the transom, each with a trefoil. A square hood mould with label stops and spandrel roundels tangent to both the label and the haunch arc |
| A6 | **Ogee hood** + flamboyant window | 2–4 reverse bends (inflections) along a rising arch | Ogee: lower arcs R₁ = λa (convex); reversed upper arcs centred at (−R₂, h), with vertical tangent at the apex; external tangency gives R₂ = (p² + h² − R₁²) / 2a. Orders are rebuilt ogees (a ± δ, h ± 1.8δ). Crockets run up the extrados to a tall finial. Under the hood is a two-centred window: the widest, then sharpest, that clears the ogee. Inside it: ogee lights; soufflets on the mullion axes, which are vesicas with R = (A² + B²) / 2B; mirrored mouchettes, whose flanks are internally tangent to the head and pass through the tail, t = (r² − \|w\|²) / 2(w·u − r). Shapes are fitted by grid search and radius bisection (REF-005) |
| A7 | **Round / segmental arch** + plate tracery | Even curvature (CV < 0.22) and h/a ≤ 1.25 | One circle, R = (a² + h²) / 2h, plus an extra archivolt order. Two round-headed lights, and a roundel on the axis that is internally tangent to the arch circle and externally tangent to both lights (REF-001 A–C) |
| A8 | **Rampant arch** + curvilinear tracery | Springings at different heights (end drop > 0.2) or asymmetric (asymmetry > 0.18) | Each arc is centred on its own springing line (vertical tangent there) and passes through the drawn apex: cx₁ = (xp² + hp² − a²) / 2(xp + a), cx₂ = (a² − xp² − (hp − d)²) / 2(a − xp). Mullions rise from the sloping springing line and fork into branches concentric with the opposite arc. A mouchette sits in the head |
| A9 | **Stacked elevation** (arcade · triforium · clerestory) | A tall arch: h > 22 m and h/a > 1.2 | Inside a two-centred arch: rails at 0.45H and above. The arcade is n pointed arches on shafts with capitals. The triforium is 3n equilateral arches whose apexes touch the upper rail. In the clerestory, mullions run up to the arch, with a foiled roundel in the head. Pinnacles stand at both springings (REF-004) |

## B. Closed curves standing upright (windows)

| # | Structure | Curve qualities | How it is built |
|---|---|---|---|
| B1 | **Rose window** (Rayonnant) | Closed, upright plane, round, radius ≥ 5.5 m | Circle fit (Kåsa least squares). n = 6–24 sectors at θₖ = 2πk/n. Spokes run from a foiled hub. Each sector has a radiating lancet springing on its spokes at ρ = R/2; its sharpness is capped so it clears the rim. Head trefoils. Rim oculi lie on the spokes, internally tangent to the rim and externally tangent to the lancet arc (REF-011) |
| B2 | **Wheel window** | Closed, upright, round, radius < 5.5 m | Colonnette spokes. Round arches spring on the spokes. Roundels sit in the gaps, tangent to the rim and the arches. Foiled hub |
| B3 | **Vesica window** | Closed, upright, aspect > 1.45 (elongated) | Two equal arcs through the tips: R = (A² + B²) / 2B, centres ±(R − B). Inner order on the same centres. Central roundel r = R′ − c, tangent to both arcs. End roundels: r(y) = R′ − √(c² + y²), with y = B′ + r. Foils in all three |
| B4 | **Spherical-triangle window** | Closed, upright, exactly 3 sharp corners | Corners found by the farthest-point and maximum-area method. Each side is an arc of radius = side length, centred on the side's perpendicular bisector. Inner order. A roundel internally tangent to all three arcs (2×2 Newton) with a trefoil |

## C. Closed curves on the ground (plans)

| # | Structure | Curve qualities | How it is built |
|---|---|---|---|
| C1 | **Canopy / tabernacle** | Closed, flat on the ground, perimeter < 28 m (also any short straight vertical curve < 12 m) | Four corner shafts with bases and capitals. On each face, a pointed arch with a head trefoil and a gable; the gable foil is tangent to both gable lines and the arch. Crockets, finials, corner pinnacles. Diagonal vault ribs rise to the face-arch crown, with a boss (REF-007) |
| C2 | **Ribbed vault** (quadripartite or sexpartite) | Closed, on the ground, 28–90 m perimeter, not round | Plan rectangle from PCA, split into n = round(L / W) bays. Piers with capitals. Equilateral transverse and wall ribs. Diagonal ribs rise to the transverse crown; they are segmental when the crown is below the half-diagonal. The vault is sexpartite when n is even. Bosses at the crowns. With Lancets ≥ 3: a ridge rib and tiercerons, using an arc centred on the springing line through the ridge point (REF-004) |
| C3 | **Chapter house** | Closed, on the ground, round (radius spread < 0.14, aspect < 1.35) | Circle fit. A central column and n = 6–12 wall piers. Radial ribs are equilateral arches from column to wall, with vertical tangents at both ends. A lierne ring at R/2 joins the rib apexes; bosses there. Wall ribs along each chord |
| C4 | **Cloister walk** | Closed, on the ground, perimeter > 90 m | Bays every max(3.5 m, L/48) around the loop. Colonnettes with capitals. Each bay is an equilateral arch with two lancets and a tangent foiled oculus. A continuous rail runs above |

## D. Open flat curves

| # | Structure | Curve qualities | How it is built |
|---|---|---|---|
| D1 | **Apse with radiating chapels** | On the ground, horizontal, turning 130°–250°, no reverse bends | Circle fit and angular range; n = 3–9 bays. Radial ribs run from each pier to the keystone, on a circle centred on the springing line: cx = (R² − Δh²) / 2R. Traceried bay arches. One chapel per bay: a half-circle plan, three piers, and ribs to a chapel boss |
| D2 | **Parapet gallery** | Flat curve more than 4 m above the ground | Developed band of height H. Posts with cresting finials. A quatrefoil in each square panel. Pinnacles at the ends (REF-012 Galerie) |
| D3 | **Reticulated (net) tracery** | ≥ 2 reverse bends (wavy) | Developed band. Each net bar is a reverse curve: two equal arcs tangent at the midpoint, R = (Δx² + Δy²) / 2Δx. Crossing bars form ogee cells, with a quatrefoil in each |
| D4 | **Blind arcade** | On the ground, > 14 m long, straight (straightness > 0.9) | Colonnettes at pitch p. Equilateral arches, each with an inscribed trefoil roundel. A top rail |
| D5 | **Interlaced arcade** | On the ground, > 14 m long, curved (straightness ≤ 0.9) | Round arches of radius p centred on every other colonnette, so each spans two bays. Their overlaps form pointed arches. A top rail |
| D6 | **Tracery band** | Any other flat curve | Classic grammar. Rails and posts, a chain of circles with n-foils, and spandrel circles r = d² / 4ρ tangent to both neighbours and the rail (REF-013) |

## E. Vertical and three-dimensional curves

| # | Structure | Curve qualities | How it is built |
|---|---|---|---|
| E1 | **Spire** (openwork when ≥ 22 m) | Straight and vertical (verticality > 0.82, straightness > 0.85), rise ≥ 12 m | Octagon of radius 0.1·H at the foot. 8 ribs to the tip, with crockets every ~2.4 m. Rings every ~3.2 m. When openwork, a foiled roundel in each face below 0.78·H. Four lucarnes (an arch with a gable) at the foot, corner pinnacles, a finial (REF-012) |
| E2 | **Canopy around a short vertical curve** | Straight and vertical, rise < 12 m | As C1, on a square footprint of half-size 0.22·H around the curve |
| E3 | **Spiral stair** | A helix: winds ≥ 1.4 turns around a vertical axis while rising > 2 m | A newel on the winding axis. Treads from the newel to the curve at ~0.25 m risers. Balusters on every third tread. A handrail 1 m above the curve |
| E4 | **Perpendicular panel screen** | **Tracery** role; straight and vertical | A rectangular frame. Lights about 0.9 m wide, with transoms every ~2.4 m. Under each transom, a cusped equilateral head with a trefoil |

## F. Other roles (classic)

| # | Structure | Curve qualities | How it is built |
|---|---|---|---|
| F1 | **Compound pier** | **Column** role | Classic grammar. n shafts around the core (360°/n), capital, moulded base, vault springers, pinnacle on a free top |
| F2 | **Flying buttress** (two flyers when tall) | **Buttress** role; a strut top above 14 m adds a second flyer | Classic grammar. Stepped pier with setbacks, pinnacle, gargoyle, and tracery band along the flyer. The second flyer repeats the strut at 0.6 × its height, with its own band |

---

## Carving options (apply to every row)

| Control | Values | Effect |
|---|---|---|
| Crocket style | Leaf · Grotesque heads · Rolled | Every crocket on gables, spires and ogee extrados becomes a leaf crocket, a small grotesque, or a rolled ball (boss) |
| Cusp ends | Plain · Pierced eyelets · Grotesque tips | Every foil cusp ends in a point, a pierced eyelet ring, or a tiny carved head |
| Ball-flower | 0–1 | Carved balls strung along the archivolts and wall ribs |

## Where the signature numbers come from

The full measurement table is in `README.md` §1.

| Quantity | What it measures |
|---|---|
| closed | The ends meet within max(1 m, 8 % of the length) |
| upright / horizontal | Normal of the best-fit plane (covariance eigenvectors): \|n·up\| < 0.35 / > 0.8 |
| k, h/a | From the chord and the farthest point from it |
| inflections | Curvature sign changes; threshold 0.35 × the median curvature |
| curvature CV | std / mean of \|curvature\| |
| end drop | Height difference of the ends / chord |
| asymmetry | Mismatch of mirrored height samples |
| verticality, straightness | Chord direction and chord / length |
| helix | Winding angle of the plan projection around its centroid |
| roundness, aspect | Radius spread and in-plane spread ratio |
