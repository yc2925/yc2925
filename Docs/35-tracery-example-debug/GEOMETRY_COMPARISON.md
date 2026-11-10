# Geometry comparison & sync tests

Camera: Stone / 3D · Front · span 3.00 m · depth 0.25 m.

## Signatures (`validate:tracery-examples`)

| ID | architecturePreset | foil | hier | skeleton | oculusNet | vol m³ | tris |
| --- | --- | --- | --- | --- | --- | --- | --- |
| lancet-subdivision | baseline-13d | quatrefoil | false | false | false | 0.9580 | 1012 |
| trefoil | baseline-13d | trefoil | false | false | false | 0.9219 | 928 |
| quatrefoil | baseline-13d | quatrefoil | false | false | false | 0.9090 | 1012 |
| oculus-placement | rayonnant-oculus-network | quatrefoil | false | true | true | 0.3635 | 2616 |
| composed-window | rayonnant-facade-module | trefoil | true | true | (module) | 0.5011 | 7224 |

All five `stoneGeometryKey` values are unique. For each option, Assembly `windowModules[0].geometryRef` equals the Stone key.

## Browser matrix

| Option | Label updates | Params update | Stone visual | Assembly sync |
| --- | --- | --- | --- | --- |
| A | yes | Baseline + lancet emphasis | Images/example-a-lancet.png | key match |
| B | yes | Trefoil foil | Images/example-b-trefoil.png | key match |
| C | yes | Diagonal quatrefoil | Images/example-c-quatrefoil.png | key match |
| D | yes | Oculus Network | Images/example-d-oculus.png | key match |
| E | yes | Facade Module | Images/example-e-composed.png | Images/assembly-sync-e-composed.png |

## Edit persistence (browser)

1. Select E → Oculus height 0.48 → edit to **0.62**.
2. Switch Architectural Assembly (Linked) → facade vol 5.291 → **5.266** (window modules updated).
3. Edit Window Module → Stone again → Oculus height still **0.62**; structural vol **0.4928** (was 0.5011).

## Regressions checked

- trefoilHeads / foilType regenerate geometry
- outerFrameWidth regenerates geometry
- hierarchicalDepth regenerates Facade Module
- moldingEnabled produces decorative meshes
- surface semantics validate after composed-window example
