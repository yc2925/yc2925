# Host Fitting

## Discovery

Hosts are clustered from surface-semantics patches (not a fabricated free plane):

| Host kind | Component types (preferred) |
|---|---|
| Spandrel (default) | `OUTER_ARCH`, `CAPITAL` |
| Arch shoulder | `OUTER_ARCH`, `SILL`, `CAPITAL` |
| Pier panel | `PIER_CORE`, `PRIMARY_MULLION`, `BUTTRESS*` |

Front-facing normals preferred (`n.z ≥ -0.15`).

## Local frame

For each host:

- **Origin** — patch-cluster centroid  
- **Normal / U / V** — orthonormal basis from representative normals  
- **Symmetry axis** — local V through origin (motif-local bilateral)  
- **Area** — UV AABB from patch extents, expanded to a minimum readable ornament field centered on the real cluster  
- **Voids** — nearby openings projected into UV with clearance radii  
- **Boundary** — world polyline of the ornament area  

## Fit policy

If samples leave the host area or enter voids:

- Prefer scale / composition adjustment (`fitScale`)  
- Mark curves invalid with reason (`BOUNDARY` / `SPARSE`)  
- Do **not** silently clip large portions of a motif  

## Camera

- **Fit to Motif** — frames the selected host (+ pad), bumps `fitToken` / `fitMotifToken`  
- **Fit to Facade** — restores full elevation framing  
- Parameter edits do **not** reframe the camera
