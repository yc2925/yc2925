# Generative grammar — Gothic foliate ornament

## Premise

Growth = **algorithm**. Output = **stone ornament**.

A “branch” is a centerline in an ornament skeleton that later becomes a carved profile, crocket cluster, rib, or perforated bar — never a green vine.

## Pipeline stages

### 1. Architectural host

Inputs from existing Gothic Grammar:
- Facade / bay / pier / window module solids
- Surface semantics (component type, orientation, eligibility, normals)
- Molding edges, arch axes, cusp loci, tracery member graphs

Host defines allowable regions, depth budgets, and symmetry planes.

### 2. Ornament initiation points

Reinterpret existing **growth anchors / seeds** as:

> Points (with frames) where carved ornament originates on the host.

Reuse:
- Manual and automatic seed placement
- Eligibility / weight policies
- Orthonormal frames (normal, tangent, bitangent)
- Navigation graph along surfaces

Add semantics later: motif class (crocket edge, capital burst, spandrel fill, grotesque boss), density tier, symmetry group id.

### 3. Growth skeleton

Directed graph / polyline forest grown from initiation frames:

| Operator | Purpose |
|---|---|
| Advance | Step along directional field (edge follow, normal-offset, attractor) |
| Bifurcate | Recursive split with angle / length decay |
| Curl / spiral | Clothoid or circular scroll toward local attractors |
| Mirror | Bilateral / radial instances across host symmetry plane |
| Attract / avoid | Pull toward edges, bosses, voids; avoid openings and thin webs |
| Stochastic warp | Controlled noise on angles / lengths (seeded) |

Skeleton stores member class tags: `PRIMARY_RIB`, `SECONDARY_SCROLL`, `CROCKET_AXIS`, `STRUT`, `GROTESQUE_LIMB`, etc.

### 4. Gothic ornamental grammar

Map skeleton members to Gothic motifs (REF-017 / 020 / 019):

- Cusps and foils as void-cutting operators on planar cells
- Crockets as periodic terminal solids along outer edges
- Diaper / mesh as optional fill in bounded panels
- Quatrefoil / trefoil inserts where skeleton encloses cells
- Hierarchy: primary ribs thicker / deeper than secondary scrolls

Symmetry and hierarchy constraints beat unstructured organic noise.

### 5. Sculptural stone geometry

Promote skeleton → solids with geometric methods only:

- Profile curves (chamfer / bead / leaf section) swept along frames
- Variable-radius tubes thickened into stone bars (minimum web enforced)
- Relief extrusions along host normals (depth budget)
- Boolean / region perforations for lace (REF-019 style)
- Optional undercut offsets for layered relief
- Creature intensity morphs as parametric profile / tip variation (REF-018), still stone

### 6. Architectural integration

- Clamp to host surface / offset shell
- Seam blends at initiation patches
- Respect openings and structural stone clearances
- Share host material / lighting presentation (monochrome stone, dark voids)
- LOD: skeleton → simplified bars → full crocket / grotesque detail

## Parameter families (proposed)

| Family | Examples |
|---|---|
| Initiation | seed count, eligibility weights, motif class |
| Skeleton | recursion depth, bifurcate angle, curl rate, edge-follow bias |
| Gothic | cusp depth, foil count, crocket spacing, diaper density |
| Biomorphic | creatureIntensity, cavityRatio, antlerCurl |
| Stone | profile type, reliefDepth, perforationRatio, minWeb |
| Control | symmetryMode (mirror / radial / free), stochasticSeed, densityCap |

## Negative grammar (hard rejects)

Reject or clamp outputs that:
- Cover the host like a plant canopy
- Use leaf / vine materials or colors as final look
- Detach from host frames beyond allowed relief offset
- Collapse architectural silhouette into unstructured blob
- Produce only thin tubes without stone profile / thickness

## Motif vocabulary (non-literal)

Inspired by refs, not copied meshes:

- Edge crocket chain (REF-017, REF-019)
- Capital / boss burst (REF-019 initiation zone)
- Spandrel lace panel (REF-017 mesh + REF-019 perforation)
- Antler / rib grotesque wing (REF-018)
- Scroll medallion / X-interlace (REF-020)
