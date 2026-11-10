# Performance

## Before (13E.4 lifecycle debt)

| Path | Observation |
| --- | --- |
| Manual Place Seed ON | ~1300 picker meshes + handlers → UI freeze |
| Auto distribute 45 | Seeds created VALID then immediately rebound → 0 VALID / 45 REPROJECTED |
| Select seed | Large Html text; possible graph/state churn |
| Ortho load | Frustum ~canvas pixels → geometry invisible |

## After (13E.4.1 / 13E.4.2)

| Path | Measurement / result |
| --- | --- |
| Place Seed mode | Zero per-patch pickers; one canvas pointer pair |
| Auto distribute 24 | Browser ~630 ms; statuses **24 VALID / 0 REPROJECTED** |
| Auto distribute 45 | Node validator: 45 VALID; identical rebuild → 0 reprojection |
| Nav graph | Memoized by geometryVersion + nav options; no setState if graph ref unchanged |
| Ortho frustum | World-scale (`right ≈ 2.7` for span-3, not ~480) |

## Caching

- `growthNavigationGraph` — `useMemo` on version + gap/restricted options.
- Growth effect — if `geomKey` unchanged, sync graph only when reference differs; else return previous state.
- Architecture / surface semantics — unchanged policy: regenerate only on facade geometry inputs.

## Remaining costs

- Full nav graph for dense facades remains O(patches²) adjacency (existing 13E.4 cost).
- Eligibility debug markers capped at 120 to avoid another mesh flood.
