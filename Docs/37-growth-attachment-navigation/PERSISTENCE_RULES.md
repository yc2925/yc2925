# Anchor Persistence Rules (13E.4)

Implemented by `rebindGrowthAnchors(previousState, semantics, options)`.

Seeds are **never silently deleted**.

## A — Same topology

`previous.geometrySignature === semantics.geometryVersion`

- Preserve component / surface / patch identity
- Recompute world pose from local attachment + patch frame
- Status → **VALID**

## B — Geometry changed, surface still exists

Signature mismatch, but patch (or stable-key match) found.

Facade rebuilds bump `facade-N` id prefixes. Matching uses `stableSemanticKey()` which replaces `/^facade-\d+/` with `facade-*` so compatible regenerations reproject instead of orphaning.

- Reproject within same patch / surface / component
- Status → **REPROJECTED**

## C — Original surface removed

No patch, surface, or component (including stable-key forms).

- Status → **ORPHANED**
- Keep last known world pose for inspection
- Do **not** snap to an unrelated surface

## D — Surface now prohibited

Eligibility became `PROHIBITED`.

- Status → **BLOCKED**

## Bay-count / instances

- **MASTER_MODULE** anchors may be instantiated across bays via `instantiateMasterAnchors` (translation-only today; normals preserved).
- **ASSEMBLY_INSTANCE** anchors store `bayId` / `instanceId`. When bay count drops and the bay disappears → **ORPHANED** (no jump to another bay).

## Camera

Geometry / seed / weight edits do **not** bump `fitToken`. Camera persistence from 13E.2 remains in force.
