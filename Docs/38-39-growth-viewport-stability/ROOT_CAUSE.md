# Root causes

## Bug A — Seed placement freeze / REPROJECTED flood

### Cause 1 (status): volatile `geometryVersion`

`extractFacadeSurfaceSemantics` included `facade.id` from `nextId('facade')` in `geometryVersion`. Every rebuild (remount, HMR, memo churn) produced `facade-N|…` with a new N.

`rebindGrowthAnchors` then treated topology as changed → every anchor became **REPROJECTED**, including brand-new seeds and automatic distributions (the “45 / 0 valid / 45 reprojected” report).

### Cause 2 (freeze): per-patch PlacementPickers

Enabling Manual placement mounted **one transparent sphere mesh per semantic patch** (~1300 meshes) with pointer handlers. Combined with navigation-graph rebuilds that always called `setGrowthAttachment`, the main thread blocked on placement / select.

### Cause 3 (inspector): unbounded Html dump

Selected-seed `Html` used `whiteSpace: 'pre'` and full component/surface IDs, flooding the viewport with large monospace text.

### Fixes

- Stable geometry version (strip / omit volatile facade counter; stable facade id from view).
- `stableGeometrySignature` for same-topology comparisons.
- Raycast `PlacementController` (click vs drag) instead of picker flood.
- Graph memoized; identical state writes skipped.
- Compact inspector with collapsible Debug.

## Bug B — Incorrect initial viewport

### Cause 1 (ortho): drei pixel frustum overwrite

`@react-three/drei` `OrthographicCamera` defaults `left/right/top/bottom` to **canvas pixel halves** every commit. Arch geometry is ~3 m → appears as a speck; Html dim labels remain near center.

`OrthoFraming` corrected once, then `hasFramedRef` blocked re-apply while drei kept overwriting.

### Cause 2 (perspective): React prop fight

`PerspectiveCamera position={[4,2.5,5]}` and `OrbitControls target={[…]}` were re-applied every commit, undoing `StoneFraming` imperative poses (Fit / initial frame appeared broken).

### Fixes

- `OrthographicCamera manual` + controlled world-unit frustum props from `OrthoFraming`.
- Remove camera `position` / controls `target` props; framing owns pose.
- `useFrame` retry until perspective camera + metrics ready after mode switch.
- Mode `frameKey` resets initial-fit permission when entering a mode.

## Shared causes?

**Partially.** Both were aggravated by unstable React commit / remount behavior, but:

- Bug A’s REPROJECTED flood is a **geometry signature** bug.
- Bug A’s freeze is a **placement mesh scale** bug.
- Bug B is a **camera ownership vs library defaults** bug.

Repairs are modular and separately testable.
