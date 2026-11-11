# Rooting Validation

## Root coincidence

`measureRootAnchorDistance(host, spine)`:

1. Expected root = `localToWorld(origin, U, V, N, 0, 0, nOff)`
2. Actual root = primary spine `points[0]`
3. Require `distance ≤ ROOT_ANCHOR_TOLERANCE` (1e-3 m)

Failed roots mark the spine invalid (`ROOT_ANCHOR_DISTANCE`) and are not accepted ornament.

## Host classification

`classifyAnchorHost`:

- Eligible component types: outer arch / capital / sill / pier / buttress families
- Reject prohibited / orphaned / non-ornamental components with an explicit reason
- Do **not** silently relocate to another component

## Hierarchy

Secondary curls attach to the primary spine (`parentId`). Mirrors use motif-local bilateral symmetry about the host V axis through the **anchor origin**.

## Debug overlay

**Anchor Link Debug** draws:

- Source anchor marker
- Motif root marker
- Anchor↔root segment + distance label
- Host boundary / local axes / hierarchy labels
