# 42 — Gothic Foliate Ornament (Step 14.0)

Design direction and reference integration only. **No generator implementation yet.**

## Artistic objective

Build a **procedural Gothic stone ornamentation system**.

Biological growth is a computational strategy, not the material or visual outcome. Final geometry must read as carved / perforated / relief **stone** — foliate, grotesque, biomorphic, even creature-like — while remaining architecturally integrated.

**Not:** ivy, vines, leaves, plant colonization, or generic vegetation scatter.

## New references (inspected)

| ID | Letter | File | Intent |
|---|---|---|---|
| REF-017 | A | `references/gothic-foliate-ornament/REF-017-gothic-geometric-patterns.jpg` | Geometric patterns, symmetry, tracery, cusps, interlacing |
| REF-018 | B | `…/REF-018-biomorphic-creature-sculpture.jpg` | Biomorphic / skeletal / antler complexity |
| REF-019 | C | `…/REF-019-gothic-stone-foliate-carving.jpg` | Integrated architectural stone foliate carving |
| REF-020 | D | `…/REF-020-symmetrical-grotesque-ornament.jpg` | Mirrored grotesque recursion and scroll density |

Use **together**. Do not copy individual sculptures literally.

## Pipeline (proposed)

```
Architectural Host
→ Ornament Initiation Points   (reinterpreted growth anchors)
→ Growth Skeleton              (graphs / polylines / fields)
→ Gothic Ornamental Grammar    (symmetry, cusps, scrolls, hierarchy)
→ Sculptural Stone Geometry    (profiles, sweeps, relief, perforations)
→ Architectural Integration    (host normals, seams, depth rules)
```

## Docs in this folder

| File | Contents |
|---|---|
| [VISUAL_ANALYSIS.md](VISUAL_ANALYSIS.md) | What each new reference contributes |
| [GENERATIVE_GRAMMAR.md](GENERATIVE_GRAMMAR.md) | Proposed ornament growth grammar |
| [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | Reuse plan and staged 14A+ work |

Canonical direction also lives in `references/VISUAL_DIRECTION.md` and a concise note in `AGENTS.md`.

## STOP

Step 14.0 ends here. Do **not** start 14A.1 implementation from this document set alone.
