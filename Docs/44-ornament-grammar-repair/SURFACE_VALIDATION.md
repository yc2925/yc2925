# Surface validation (14A.1.1)

## Per-sample checks

For every parametric sample:

1. Protected opening probe
2. `projectToEligibleSurface` with adherence tolerance
3. Max attachment distance (`maxAttachmentDistance`)
4. Front-face preference (+Z probe retries)
5. Soft normal consistency (reject only hard flips)
6. Clearance vs protected openings

## Acceptance rule

- **Accepted ornament nodes** must be `valid` + `accepted` + have `surfaceAttachment.patchId`
- Failed samples go to `rejectedSegments` with reason (`SURFACE` / `OPENING` / `NORMAL` / `SEPARATION`)
- Rejected segments are debug visualization only — never branch polylines

## Front facade bias

14A.1 often attached to back shells (`n.z = -1`). 14A.1.1:

- Ranks initiation anchors by `worldNormal.z >= 0`
- Prefers front-facing motif hosts
- Retries projection from `z+0.08` / `z+0.20` probes
