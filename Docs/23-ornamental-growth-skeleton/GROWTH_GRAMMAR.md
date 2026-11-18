# Growth grammar (14A.1)

## Behaviors

| Behavior | Implementation |
|---|---|
| Primary extension | Walk from initiation along host surface tangent |
| Architectural attraction | Blend toward arch-shoulder / outer-arch hints |
| Curling | Rotate growth direction about surface normal (scroll) |
| Branching | Density-gated secondary bifurcations, depth-limited |
| Symmetry | Mirror growth across facade centerline X |
| Creature influence | Controlled angle/length noise + extra splits (REF-018) |
| Surface adherence | `projectToEligibleSurface` + opening rejection |
| Progress | Full skeleton cached; `revealOrnamentSkeleton(progress)` |

## Host preference

Initiation ranking prefers `OUTER_ARCH`, `CAPITAL`, `PRIMARY_MULLION`, `SILL` (spandrel / shoulder region). Falls back to any VALID eligible anchor.

## Termination

`LENGTH` · `DEPTH` · `SURFACE` · `OPENING` · `SEPARATION` · `BUDGET`

Invalid stubs retained when debug “Show Invalid Segments” is on.
