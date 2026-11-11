
# YC2925 — Procedural World Building

## Project Context
This project is a procedural world-building application
built with React, Three.js, and Vite.

The current focus is developing a mathematically
controlled Gothic architectural grammar, beginning
with Rayonnant Gothic geometry.

## Mandatory Visual References

Before implementing or modifying any architectural
geometry, read:

1. references/README.md
2. references/VISUAL_DIRECTION.md
3. references/reference-index.json

Identify and inspect the relevant reference images.

If images cannot be accessed, explicitly report this.
Never claim to have inspected images that were not read.

## Procedural Geometry Principles

All Gothic architecture must be generated from
explicit mathematical and geometric rules.

Use:
- Points and vertices
- Lines and circular arcs
- Geometric intersections and tangencies
- Constraints and proportional relationships
- Recursive subdivisions
- Planar regions and profiles
- Sweeps, lofts, and extrusions

Do not hardcode a finished Gothic silhouette
or use AI-generated meshes as the foundation.

Every generated architectural element must expose
meaningful parameters and construction logic.

## Visual Direction

Prioritize:
- Rayonnant Gothic geometric organization
- Architectural hierarchy
- Precise tracery
- Slender proportions
- Coherent stone thickness
- Sculptural depth
- Controlled symmetry

Preserve negative space and structural clarity.

### Gothic foliate ornament (Step 14+)

Primary artistic goal for ornament work: **procedural Gothic stone
foliate / grotesque carving**, not vegetation.

- Growth algorithms = computational strategy only.
- Final material = carved / perforated / relief stone.
- May be biomorphic, skeletal, alien or creature-like.
- Must stay architecturally integrated and hierarchical.
- Do **not** produce ivy, vines, leaves, or plant colonization.

References: REF-017–REF-020 (see `references/VISUAL_DIRECTION.md`
and `Docs/42-gothic-foliate-ornament/`). Reuse existing surface
semantics and growth-attachment seeds as ornament initiation points.

## Implementation Requirements

Before writing code:
1. Identify the reference images used.
2. Explain the geometric construction.
3. Identify parameters and constraints.

After implementation:
1. List files modified.
2. Explain the generating rules.
3. Report validation results.
4. Identify visual limitations.

## Existing Systems

Preserve the existing:
- Gothic Architecture
- Ornament System
- Agent Simulation
- Scale system
- LOD system

Build new geometry infrastructure separately
until it is validated.

Do not overwrite existing procedural generators
without explicit approval.
