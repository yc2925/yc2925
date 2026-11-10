# Known conditional behaviors

1. **2D Tracery workspace + B/C** — foil-only control strip remains for standalone foil demos. Stone / 3D and Assembly always show full-window controls for every example.
2. **Architecture Preset after Example** — selecting a different Architecture Preset after an example intentionally overrides path flags; the example label may stay until the user re-picks an example.
3. **A–C share Baseline solid/void** — visual distinction is foil type / orientation / oculus radius, not a separate generator family.
4. **D vs E** — D forces `oculusSubdivision=none` and disables hierarchical; E is hierarchical Facade Module with oculus refinement. Switching between them changes representation class (strip-union oculus network vs hierarchical).
5. **Custom Override Assembly** — still stubbed (legacy snapshot); Linked to Master is the supported sync path (Docs/34).
6. **Camera** — workspace switches Stone ↔ Assembly preserve pose (13E.2 fitToken policy); example selection does not force Fit to Geometry.
