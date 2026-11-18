# Overlay controls

Available in **Pointed Arch** and **Tracery** only.

## Essential

| Control | Setting | Effect |
|---|---|---|
| Show Construction Geometry | `showConstructionGeometry` | Master ON/OFF for anatomy overlays |

Legacy `displayState === 'construction'` still enables anatomy (backward compatible).

Toggling the Essential control does **not** bump `fitToken` / `resetViewToken`.

## Advanced (`uiControlTier` = advanced | debug)

Stored on `constructionOverlay`:

| Toggle | Flag | Maps to display flag |
|---|---|---|
| Construction Circles | `circles` | `showConstruction` |
| Arc Centers | `arcCenters` | `showCenters` |
| Intersections | `intersections` | `showPoints` |
| Symmetry Axes | `symmetryAxes` | `showArchAxis` |
| Dimension Guides | `dimensions` | `showDimensions` |
| Mullion Centerlines | `mullionCenterlines` | Tracery only |
| Foil Construction | `foilConstruction` | Tracery only |

## Visual language

- Result geometry: solid, primary
- Construction / guides: thin dashed muted lines (`Line` dashed)
- Centers / intersections: small markers
- Dimension labels: compact Html annotations
- Overlay groups set `raycast={() => null}` — no growth / pick interference

## Debug

When Control density = Debug, Geometry Information lists construction circle/point/axis counts and any `limitations[]` strings.
