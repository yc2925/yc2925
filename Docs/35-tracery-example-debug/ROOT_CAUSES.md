# Root causes (pre-fix)

## Pipeline traced

```
Select (Tracery example)
  → onChange
  → React settings.tracery (+ stone)
  → normalize / resolveWindowDesignParams
  → buildStoneAssembly / generateGothicWindowModule
  → Stone mesh + Assembly windowModules (Linked to Master)
```

## Per-option (before fix)

| Option | What selection did | Why viewport looked unchanged |
| --- | --- | --- |
| A–E (all) | Wrote `exampleId` (label / 2D graph hint) | Stone path ignored `exampleId`; used architecture preset flags (`enableHierarchicalTracery`, skeleton, oculus network, …). If user was on Facade Module / Hierarchical, every example rebuilt the same hierarchical solid. |
| B Trefoil | Also set `foilType=trefoil` | Foil params never reached hierarchical strip-union path; foilOnly UI hid Parent Arch in Stone. |
| C Quatrefoil | Also set `foilType=quatrefoil` | Same as B. |
| D Oculus | Label-only for stone | Did not switch to Oculus Network preset / clear hierarchical. |
| E Composed | Label-only if already on Facade Module | Appeared to “work” only when already on the matching preset — coincidence, not example apply. |

## Secondary UX cause

`foilOnly` UI for B/C hid composed-window controls in Stone / 3D even when stone was generating a full window — looked like “dropdown does nothing” for editable parameters.

## After fix

`applyTraceryExample` clears advanced grammar flags (or sets the target preset’s flags), applies foil / oculus / path parameters, updates Architecture Preset control, regenerates shared module geometry, and keeps manual edits until the user selects another example or preset.
