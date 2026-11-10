# Camera lifecycle

## States (logical)

| State | Meaning |
| --- | --- |
| UNINITIALIZED | Canvas / controls not ready |
| WAITING_FOR_VIEWPORT | `size.width/height ≤ 1` |
| WAITING_FOR_GEOMETRY | Bounds / metrics missing |
| INITIAL_FIT_PENDING | Viewport + geometry ready; one fit allowed |
| READY | `hasFramedRef === true` |
| USER_CONTROLLED | Orbit / pan / zoom after READY |

Implemented via `hasFramedRef` + `frameKey` on existing `OrthoFraming` / `StoneFraming` (no second state machine).

## Case matrix

| Event | Behavior |
| --- | --- |
| A. Initial page load | Wait for nonzero size + bounds/metrics → one fit |
| B. Workspace mode switch | `frameKey` reset → mode default fit (ortho front framing; stone/assembly three-quarter) |
| C. Geometry parameter change | **Do not** auto-fit; preserve pose |
| D. Fit to Geometry / Reset View | Intentional reframes (`fitToken` / `resetViewToken`) |
| Resize | Ortho: keep world half-extent, refresh aspect only |
| Seed / weight edits | No camera change |

## Ortho ownership

```text
OrthoFraming.applyFrame → setOrthoFrustum(state)
                        → mutate camera left/right/top/bottom
OrthographicCamera manual left={…} right={…} top={…} bottom={…}
```

Never leave frustum as canvas pixel units.

## Perspective ownership

- Do **not** pass `position` on `PerspectiveCamera`.
- Do **not** pass `target` on `OrbitControls`.
- `StoneFraming` writes pose; `useFrame` retries until `camera.isPerspectiveCamera` and metrics exist.

## Defaults by mode

| Mode | Default |
| --- | --- |
| Pointed Arch / Compare / Tracery | Front orthographic fit to construction bounds |
| Stone / 3D | Three-quarter perspective |
| Architectural Assembly | Three-quarter perspective (`viewPreset` default) |

## Invalid saved poses

Reject NaN / Infinity, non-positive zoom, `near ≥ far`. Fall back to initial fit (contract tested in `validate:viewport-initialization`).
