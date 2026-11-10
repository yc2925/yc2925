# Bug fixes (13E.3.1)

## A. Trefoil

**Symptom:** Foil type / Trefoil appeared to do nothing on Rayonnant Hierarchical.

**Root cause:** Hierarchical bay heads read `trefoilHeads`, not `foilType`. Foil Geometry’s select only wrote `foilType`. Depth 0 has no bay cells, so heads cannot appear.

**Fix:**
- Panel syncs `foilType` ↔ `trefoilHeads` / `secondaryQuatrefoils`
- `normalizeTraceryParams` bridges the keys
- UI hint when depth &lt; 1

**Measured:** depth1 trefoil head bars **6**; off **0**; quatrefoil heads **8**; depth0 **0**.

## B. Oculus height

**Symptom:** Oculus height slider did not move the oculus on skeleton / hierarchical stone.

**Root cause:**
1. UI wrote `oculusHeightRatio`; skeleton reads `oculusVerticalPosition`
2. `solveOculusCenterY` maximized radius and ignored heightRatio (composed path)

**Fix:**
- Sync both keys in panel + normalize
- Skeleton calls `solveOculusCenterY(..., { honorHeightRatio: true })`
- Composed / bar-network keep legacy radius-weighted placement (manifold packing)

**Measured (hierarchical):** center Y **1.767 → 2.334 m** (Δ **0.567 m**).

**Conditional:** On composed / bar-network, heightRatio remains largely radius-weighted by design (legacy). Use skeleton / hierarchical for authoritative vertical motion.

## C. Outer frame width

**Symptom:** Outer frame width did not thicken hierarchical stone.

**Root cause:** Skeleton uses `masterFrameWidth`; Solid/Void slider only set `outerFrameWidth`.

**Fix:** Both sliders write both keys; normalize unifies to outer as canonical.

**Measured:** volume **0.266 → 1.022 m³** for frame 0.06 → 0.28 m.

## D. Min stone web

**Symptom:** Slider seemed inert.

**Root cause:** It is a **clearance floor**, not a continuous reshape. Hierarchical ignored `minStoneWebWidth`.

**Fix:** `normalizeTraceryParams` raises `minWebClearance` / `minOpeningClearance` to the floor. Tips/docs state constraint semantics.

**Measured:** inactive floor 0.05 ok; active floor 0.22 rejects secondary clearance (constraint path).

## E. Molding

**Symptom:** Enable moldings appeared broken after hierarchical preset.

**Root cause:** Preset sets `moldingEnabled: false`. Toggle value used `!== false` (confusing). Show moldings could stay off.

**Fix:** Enable sets `moldingEnabled`, forces `showMoldings`, and bumps tiny profiles to readable defaults.

**Measured:** decorative meshes **0 → 20** (46650 tris) when enabled.
