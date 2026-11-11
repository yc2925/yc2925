# Validation (14A.1.1)

```bash
cd app
npm run validate:ornament-growth
npm run validate:growth-attachment
npm run validate:construction-overlay
npm run build
```

## Added / extended checks

- Motif host grouping + motif generation
- Smooth continuity (mean turn warning)
- Front / attached accepted nodes only
- No accepted invalid segments
- No floating accepted segments (>0.15 m)
- Local symmetry mirrors at 100% / none at 0%
- Visible Curl Strength curvature effect
- Visible Branch Density secondary count effect
- Deterministic + headless rebuild parity
- Progress reveal monotonicity (cache ignores progress)

## Browser / headless parity

Identical `semantics` + `anchors` + params → identical `cacheKey` and node counts. Browser uses the same `buildOrnamentGrowthSkeleton` / `revealOrnamentSkeleton` path.
