# Cross-Workspace Tests

## Script

```bash
cd app
npm run validate:ornament-motifs
npm run validate:ornament-growth
npm run build
```

Coverage includes:

- No motifs without shared anchors
- Host origin = anchor world position
- `sourceAnchorId` / component / surface identity
- Exact root-to-anchor distance
- Selection switches root
- Deletion removes motif
- Full facade only from anchors (+ unused reporting)
- Parameter edits preserve root
- Legacy growth still consumes the same anchors
- Camera token persistence

## Browser acceptance

1. Architectural Assembly → place one initiation point → note `anchorId`
2. Switch to Foliate Ornament → select same `anchorId`
3. Generate Single Motif → enable Anchor Link Debug
4. Confirm root and anchor coincide
5. Change motif parameters → root stays fixed
6. Change architectural geometry → anchors reproject; IDs preserved
7. Return to Assembly → same IDs present
8. Delete anchor → motif disappears
9. Repeat with multiple anchors on different components
