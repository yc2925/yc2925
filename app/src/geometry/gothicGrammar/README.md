# Gothic Grammar geometry namespace

Independent procedural Gothic geometry environment (Steps 13A–13D).

**Does not import** generators from `app/src/gothic/`, `app/src/ornament/`, or `app/src/agents/`.

## Reference direction

Working geometry family: Rayonnant / geometric bar-tracery  
Primary refs: **REF-011**, **REF-006**, **REF-008**  
Pointed arches (13B): **REF-008**, **REF-007**, **REF-011**, **REF-009**  
Solid/void (13C.1) + stone 3D (13D): **REF-008**, **REF-011**, **REF-009**, **REF-012**  
Separate later: Flamboyant / curvilinear (**REF-005**, **REF-010**)

## Layout

| Folder | Role |
|---|---|
| `kernel/` | Mathematical primitives — **ready (13A.1)** |
| `primitives/` | Pointed arch families — **ready (13B)** |
| `examples.js` | Kernel demos A–G |
| `construction/` | Scene construction documents + arch overlays |
| `constraints/` | Future constraint layer (stub) |
| `tracery/` | Lancet / foil / oculus / solid-void — **ready (13C / 13C.1)** |
| `solids/` | Extrusion, profiles, sweeps, mesh validation — **ready (13D)** |

## Validate

```bash
cd app && npm run validate:geometry-kernel
cd app && npm run validate:pointed-arch
cd app && npm run validate:tracery
cd app && npm run validate:solid-void
cd app && npm run validate:stone-3d
```

Docs: `Docs/16-geometric-kernel/` … `Docs/20-procedural-3d-stone/`.
