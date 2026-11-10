# Visual comparison — unified module

References: REF-008, REF-011, REF-004.

## Shots

![Original Assembly front (Docs/29 legacy capture)](Images/original-assembly-front.png)

*Pre-sync preferred Assembly front elevation (Docs/29).*

![Rayonnant Facade Module — Stone / 3D front](Images/facade-module-stone-front.png)

*Stone / 3D · Rayonnant Facade Module · Front · hierarchical L1 · moldings off.*

![Linked Assembly front](Images/linked-assembly-front.png)

*Architectural Assembly · WINDOW SOURCE linked · Front · cache 1 unique / 3 hits.*

![Linked Assembly three-quarter](Images/linked-assembly-three-quarter.png)

*Same linked design · Three-Quarter · Combined supports.*

![Stone after Subdivision Depth 2](Images/stone-depth2.png)

*Stone / 3D · depth 2 · 13D.9-L2 · 9576 tris · vol 0.5726.*

![Linked Assembly after Depth 2](Images/linked-assembly-depth2.png)

*Assembly subdivision depth mirrors Stone (2) · components 344 · vol 5.505 · still linked.*

## Notes

- Linked Assembly windows match the Facade Module silhouette (quatrefoil oculus + nested heads).
- Geometry cache shows one unique module instanced across uniform bays.
- Full oculus / trefoil / molding browser pairs are covered by `validate:shared-window-module` lockstep key tests; depth-2 pair shown above for live sync.
