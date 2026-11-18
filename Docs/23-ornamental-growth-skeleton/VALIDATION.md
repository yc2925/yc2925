# Validation (14A.1)

```bash
cd app
npm run validate:ornament-growth
npm run validate:growth-attachment
npm run validate:construction-overlay
npm run build
```

## Results (2026-11-10)

| Script | Result |
|---|---|
| `validate:ornament-growth` | PASSED |
| `validate:growth-attachment` | PASS |
| `validate:construction-overlay` | PASSED |
| `npm run build` | OK |

## `validate:ornament-growth` covers

- Workspace id/label + navigation
- Deterministic ids/positions
- Parent relationships / acyclic parents
- Progress reveal monotonicity
- Cache key ignores progress
- Symmetry vs asymmetry mirrors
- Creature influence variation
- Random seed variation
- Empty initiation message
- Surface attachment on grown nodes
- No duplicate anchors

## Browser acceptance

Empty host → Distribute initiation → Progress 0/25/50/100 → Symmetry 100/0 → Creature 90% → Debug normals → Assembly ↔ Foliate switch → Reload. Screenshots in `Images/`.

## Camera

Progress and ornament param edits must not bump `fitToken`. Stone ↔ Assembly ↔ Foliate share perspective framing policy.
