# CONSTRUCTION_GEOMETRY contract

Source: `app/src/geometry/gothicGrammar/construction/constructionGeometry.js`

Attached on generator results as `metadata.constructionGeometry`. The overlay renderer reads the same construction **curves / primitives** already produced by `archToConstructionParts` / `graphToConstruction` when display flags are on — it does **not** re-run arch or foil mathematics.

## Fields

| Field | Contents |
|---|---|
| `constructionPoints` | Springings, apex, arc centers, foil lobe centers, cusps |
| `constructionLines` | Radii, mullion centerline, guides |
| `constructionCircles` | Two-centered arch circles, oculus, foil lobe circles |
| `constructionArcs` | Exact left/right defining arcs (semantic keys) |
| `intersectionPoints` | Apex / cusp intersections |
| `symmetryAxes` | Vertical symmetry segment from the arch generator |
| `constraintGuides` | Springing line and similar constraints |
| `sourceComponentIds` | e.g. `pointed-arch`, `parent-arch`, `oculus`, `foil` |
| `limitations` | Omitted elements (reported in Debug density) |

## Sources

| Mode | Extractor |
|---|---|
| Pointed Arch | `extractArchConstructionGeometry(arch)` from `buildPointedArch` |
| Compare | Merged per-family extracts |
| Tracery | `extractTraceryConstructionGeometry(graph)` from composed / foil / oculus metadata |

## Reactivity

Any parameter change that rebuilds the arch / tracery document also rebuilds `constructionGeometry`. Overlay OFF simply stops emitting construction/guide curves and center marks — result curve counts stay stable.
