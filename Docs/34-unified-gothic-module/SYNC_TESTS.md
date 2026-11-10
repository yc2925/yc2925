# Sync tests — `validate:shared-window-module`

Run: `npm run validate:shared-window-module` (from `app/`).

| ID | Assertion | Result |
| --- | --- | --- |
| A | Oculus height edit updates Stone + Assembly keys together | PASS |
| B | Trefoil / foil topology updates both | PASS |
| C | Outer frame width updates both | PASS |
| D | Subdivision depth updates both | PASS |
| E | Molding ON produces matching decorative mesh counts | PASS (20 meshes) |
| F | Stone depth updates both | PASS |
| G | Bay count leaves window design signature unchanged | PASS |
| H | Support style leaves window design unchanged | PASS |
| I | Center-emphasis variation stays `linked-to-master` | PASS |
| J | Stone↔Assembly switch keeps design | PASS |
| K | Camera / fitToken policy (see `validate:camera-persistence`) | PASS (delegated) |
| L | Legacy Assembly snapshot watertight, moldings off | PASS |
| M | Surface semantics valid before/after oculus regen | PASS |

Also green: architectural-assembly, camera-persistence, stone-3d, surface-semantics, structural-controls, parameter-audit, `npm run build`.
