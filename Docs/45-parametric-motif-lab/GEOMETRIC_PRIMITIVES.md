# Geometric Primitives

Construction polylines in host UV, projected to world along the host normal. Not stone solids.

## A. Gothic Volute

Smooth Archimedean-style scroll:

- Outer / inner radius  
- Turns  
- Tightness (spiral power)  
- Orientation (± wind)  
- Taper  
- Optional creature sine modulation (bounded)

## B. Ribbed Spine

Primary ornamental axis:

- Quadratic Bezier from base → tip  
- Curvature control point  
- Taper  
- Rib marks (short perpendicular ticks)  
- Attachment slots at t ≈ 0.35 / 0.55 / 0.75  

## C. Secondary Curl

Smaller volute branched from spine or volute:

- Attachment UV + parent tangent  
- Branch angle (tangent continuity entry)  
- Curl radius / turns / relative scale  
- Prepends the attachment point so the curve starts on the parent  

## Shared validation

- `validateCurveContinuity` — mean turning angle bound  
- `hostContainsUV` — area + void clearance  
- Invalid curves stay in diagnostics / debug overlay; they are not accepted as ornament
