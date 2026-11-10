# Validation — Growth Attachment (13E.4)

## Command

```bash
cd app && npm run validate:growth-attachment
```

Script: `app/scripts/validate-growth-attachment.mjs`

## Coverage

| Area | Result |
| --- | --- |
| Orthonormal frames / degenerate normals | PASS |
| Valid anchor placement | PASS |
| Opening rejection | PASS |
| Deterministic distribution + spacing | PASS |
| Eligibility filtering | PASS |
| Nav graph connectivity / no void shortcuts | PASS |
| Surface path query | PASS |
| Clearance classification | PASS |
| Same-topology persistence | PASS |
| Reprojection after geometry edit | PASS (`REPROJECTED`) |
| Bay-count orphan handling | PASS |
| Master-module instancing + normals | PASS |
| Blocked-anchor handling | PASS |
| Bay counts 1/3/5/7 graph build | PASS (&lt;100ms @7) |

Also green: `validate:surface-semantics`, `validate:camera-persistence`, `npm run build`.

## Browser probes

```js
window.__ggGrowthAttachment()
window.__ggDistributeGrowthSeeds()
window.__ggClearGrowthSeeds()
```

## Note

Watertight mesh checks are insufficient for vegetation readiness. This suite asserts **surface identity, eligibility, navigation honesty, and persistence statuses**.
