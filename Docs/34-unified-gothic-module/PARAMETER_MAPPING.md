# Parameter mapping — shared window design

## Ownership

| Bucket | Source of truth | Consumed by |
| --- | --- | --- |
| `windowDesignParams` | `settings.tracery` + `settings.stone` | Stone / 3D + Assembly modules |
| `assemblyLayoutParams` | `settings.assembly` (bay*, variation, pier*) | Facade layout only |
| `structuralSupportParams` | `settings.assembly` (supportStyle, shafts, buttress*) | Piers / buttresses |
| `surfaceSemanticParams` | `settings.assembly` growth weights | Overlay policy (no mesh regen) |

## Mapping table

| Stone / 3D parameter | Assembly parameter | Previous source | Shared source | Override rule |
| --- | --- | --- | --- | --- |
| Architecture preset | (none) | Stone only | `settings.tracery` | Assembly linked → same preset |
| Span | Bay width (layout fit) | Independent | Design span; bayWidth scales fit | `windowScale * (bayWidth/span)` |
| Hierarchical depth | Window subdivision depth | Assembly-only into module | `settings.tracery.hierarchicalDepth` | Assembly slider patches tracery |
| Oculus height | — | Ignored by Assembly | `oculusHeightRatio` / `oculusVerticalPosition` | Linked |
| Foil / trefoil | — | Ignored | `foilType` / `trefoilHeads` | Linked |
| Outer frame width | — | Ignored | `outerFrameWidth` / `masterFrameWidth` | Linked |
| Min stone web | — | Ignored | `minStoneWebWidth` | Linked |
| Stone depth | `assembly.stoneDepth` mirror | Partial (stone only) | `settings.stone.stoneDepth` | Linked |
| Molding enable / profile | Forced OFF | Module hard-code | `settings.stone.molding*` | Linked |
| Bay count / spacing | Bay count / spacing | Assembly | Assembly | Must not mutate window design |
| Support style | Support style | Assembly | Assembly | Must not mutate window design |
| Variation mode | Variation mode | Assembly | Scales of shared module | Derived scales only |
| Window link mode | Linked / Custom | (new) | `assembly.windowLinkMode` | Default Linked to Master |

## Precedence

1. Linked to Master: `windowDesign` from Stone / 3D wins for all module geometry.
2. Custom Override: deferred — falls back to legacy Assembly snapshot for this iteration.
3. Variation scales multiply span; they do not replace the grammar.
4. Preset apply updates `settings.tracery` + `settings.stone` only (not bay layout).

## Preset migration

| Preset id | Role |
| --- | --- |
| `assembly-rayonnant-legacy-snapshot` | Frozen params of pre-sync Assembly look |
| `rayonnant-hierarchical` | Existing 13D.9 preset |
| `rayonnant-facade-module` | Editable Stone / 3D twin of the preferred Assembly window |
