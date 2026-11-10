# Generator audit — Stone / 3D vs Architectural Assembly

References: REF-008, REF-011, REF-004, REF-007.

## Pipeline A — Stone / 3D (before 13E.3.2)

```
GothicGrammarPanel (tracery + stone)
  → settings.tracery / settings.stone
  → buildTraceryParams / buildStoneAssembly
  → StoneMeshes
```

Used the live UI parameter object. Architecture presets (Baseline … Hierarchical) applied only when the user selected them.

## Pipeline B — Architectural Assembly (before 13E.3.2)

```
GothicGrammarPanel (assembly.*)
  → settings.assembly
  → buildGothicFacadeElevation({
        ...assembly,
        tracery: { hierarchicalDepth: assembly.hierarchicalDepth }
     })
  → buildGothicWindowModule → hierarchicalParams()
       always applyArchitecturePreset(RAYONNANT_HIERARCHICAL)
       moldingEnabled forced false
  → AssemblyMeshes
```

## Exact divergence

| Issue | Effect |
| --- | --- |
| View passed only `hierarchicalDepth` into facade | Oculus, foil, frame, moldings, etc. ignored |
| `windowModule.hierarchicalParams` re-applied Hierarchical preset | Overwrote any partial overrides; ignored Stone preset |
| `moldingEnabled: false` hard-coded in module builder | Molding ON in Stone never reached Assembly |
| `assembly.hierarchicalDepth` separate from `tracery.hierarchicalDepth` | Two subdivision controls |
| Facade `useMemo` deps omitted `settings.tracery` | Editing Stone while on Assembly (or after switch) showed stale modules |
| Default Stone = Baseline 13D; Assembly = Hierarchical | Different silhouettes even with “default” settings |

## After 13E.3.2

Both workspaces call `generateGothicWindowModule` / `buildStoneAssembly` with the same `resolveWindowDesignParams(settings)` object (`tracery` + `stone`). Assembly layout (bays, piers, supports) stays separate.
