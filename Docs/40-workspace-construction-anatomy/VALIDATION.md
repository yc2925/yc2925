# Validation (13E.4.3)

## Automated

```bash
cd app
npm run validate:construction-overlay
npm run validate:pointed-arch
npm run validate:tracery
npm run validate:viewport-initialization
npm run build
```

`validate:construction-overlay` checks:

- All workspace mode IDs remain reachable
- Design / Technical grouping + reserved vegetation
- Technical hosts map to existing modes / inspect layers
- Overlay ON/OFF + Advanced filters via `resolveDisplayFlags`
- Pointed Arch / Tracery overlays derive from generator data
- Result curve counts unchanged when overlay toggles
- Construction data updates with span edits
- Kernel examples still build
- Legacy settings without new fields remain compatible
- Navigation helper does not mutate `fitToken`

## Browser acceptance (10 Nov 2026)

Captured under `Images/`:

1. Design navigation
2. Technical navigation
3. Pointed Arch overlay OFF / ON
4. Tracery overlay OFF / ON
5. Trefoil close-up
6. Oculus close-up
7. Kernel in Technical
8. Architectural Assembly unchanged

Verified: clear hierarchy, readable overlays, no unexpected camera jumps when toggling construction, Assembly appearance preserved.
