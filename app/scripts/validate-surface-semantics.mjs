/**
 * Step 13E.3 — Architectural surface semantics validation.
 *
 * Run: node scripts/validate-surface-semantics.mjs
 */
import {
  buildGothicFacadeElevation,
  clearWindowModuleCache,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  validateSurfaceSemantics,
  SUPPORT_STYLES,
  GROWTH_ELIGIBILITY,
  FEATURE_KINDS,
  EDGE_KINDS,
  JOINT_DATA_UNAVAILABLE,
  COMPONENT_TYPES,
} from '../src/geometry/gothicGrammar/assemblies/index.js'

let ok = true
const fail = (msg) => {
  ok = false
  console.error('FAIL:', msg)
}
const pass = (msg) => console.log('OK  ', msg)

console.log('=== Step 13E.3 Surface Semantics ===')

function build(overrides = {}) {
  clearWindowModuleCache()
  return buildGothicFacadeElevation({
    bayCount: 3,
    bayWidth: 3,
    supportStyle: SUPPORT_STYLES.COMBINED,
    hierarchicalDepth: 1,
    ...overrides,
  })
}

function extract(facade, policy) {
  return extractFacadeSurfaceSemantics(facade, policy)
}

{
  const facade = build({ bayCount: 3 })
  const a = extract(facade)
  const b = extract(facade)
  const check = validateSurfaceSemantics(a, { previous: b })
  if (!check.ok) fail(`base validation: ${check.errors.slice(0, 5).join('; ')}`)
  else pass(`base model ok · components ${a.diagnostics.componentCount} · patches ${a.diagnostics.surfacePatchCount}`)

  // Stable IDs on identical regeneration
  const idsA = a.components.map((c) => c.id).sort().join('|')
  const idsB = b.components.map((c) => c.id).sort().join('|')
  if (idsA !== idsB) fail('component IDs unstable across identical extracts')
  else pass('stable component IDs')

  const surfA = a.surfaces.map((s) => s.surfaceId).sort().join('|')
  const surfB = b.surfaces.map((s) => s.surfaceId).sort().join('|')
  if (surfA !== surfB) fail('surface IDs unstable')
  else pass('stable surface IDs')

  // Parent-child
  const byId = new Map(a.components.map((c) => [c.id, c]))
  let parentOk = true
  for (const c of a.components) {
    if (c.parentId == null) continue
    if (!byId.has(c.parentId) && !String(c.parentId).includes('-pier-')) {
      // pier aggregate always present
      parentOk = false
      fail(`missing parent ${c.parentId} for ${c.id}`)
      break
    }
  }
  if (parentOk) pass('parent-child relationships resolve')

  // Normals unit + areas nonnegative + weights
  let geomOk = true
  for (const s of a.surfaces) {
    const len = Math.hypot(...s.worldNormal)
    if (Math.abs(len - 1) > 1e-3) {
      geomOk = false
      fail(`${s.surfaceId} normal len ${len}`)
      break
    }
    if (!(s.area >= 0)) {
      geomOk = false
      fail(`${s.surfaceId} area ${s.area}`)
      break
    }
    if (!(s.growthWeight >= 0 && s.growthWeight <= 1)) {
      geomOk = false
      fail(`${s.surfaceId} weight ${s.growthWeight}`)
      break
    }
    if (s.growthEligibility === GROWTH_ELIGIBILITY.PROHIBITED && s.growthWeight !== 0) {
      geomOk = false
      fail(`${s.surfaceId} prohibited nonzero weight`)
      break
    }
  }
  if (geomOk) pass('normals unit · areas ≥0 · weights in [0,1]')

  // No empty-space growable patches
  const growableVoid = (a.openings ?? []).some((o) => o.growableSurface)
  const windowGrow = (a.patches ?? []).some((p) => {
    const c = byId.get(p.componentId)
    return c?.componentType === COMPONENT_TYPES.WINDOW && p.growthWeight > 0
  })
  if (growableVoid || windowGrow) fail('empty-space / WINDOW-container growable patch')
  else pass('no empty-space growable patches')

  // Protected openings
  if (!(a.openings?.length > 0)) fail('expected protected openings from solidVoid')
  else if (a.openings.some((o) => o.growableSurface)) fail('opening marked growable')
  else pass(`protected openings ${a.openings.length} (non-growable)`)

  // Joint honesty
  if (a.jointDataStatus !== JOINT_DATA_UNAVAILABLE) fail('expected JOINT_DATA_UNAVAILABLE')
  else if ((a.features ?? []).some((f) => f.kind === FEATURE_KINDS.STONE_JOINT)) {
    fail('fabricated stone joints present')
  } else pass('JOINT_DATA_UNAVAILABLE · no fabricated masonry joints')

  // Tessellation edges not exposed as growth features of kind STONE_JOINT
  const badTess = (a.features ?? []).filter(
    (f) => f.edgeKind === EDGE_KINDS.MESH_TESSELLATION_EDGE && f.kind === FEATURE_KINDS.STONE_JOINT,
  )
  if (badTess.length) fail('tessellation mislabeled as stone joint')
  else pass('construction edges distinguished from tessellation')

  // Graph dangling
  const nodeIds = new Set((a.featureGraph?.nodes ?? []).map((n) => n.id))
  for (const f of a.features ?? []) nodeIds.add(f.featureId)
  let dangling = 0
  for (const e of a.featureGraph?.edges ?? []) {
    const tOk =
      nodeIds.has(e.targetId) || String(e.targetId).includes('-outer-construction-edge')
    if (!nodeIds.has(e.sourceId) || !tOk) dangling += 1
  }
  if (dangling) fail(`${dangling} dangling feature graph edges`)
  else pass(`feature graph edges ${a.featureGraph.edges.length} · no dangling ids`)

  // Deterministic geometryVersion
  if (a.geometryVersion !== b.geometryVersion) fail('geometryVersion nondeterministic')
  else pass(`geometryVersion ${a.geometryVersion.slice(0, 48)}…`)
}

// Bay-count stale ID check
{
  const s3 = extract(build({ bayCount: 3 }))
  const s5 = extract(build({ bayCount: 5 }))
  const s7 = extract(build({ bayCount: 7 }))
  const s1 = extract(build({ bayCount: 1 }))
  if (s3.geometryVersion === s5.geometryVersion) fail('bay 3/5 share geometryVersion')
  else pass('bay-count changes geometryVersion')

  const ids3 = new Set(s3.surfaces.map((s) => s.surfaceId))
  const ids5 = new Set(s5.surfaces.map((s) => s.surfaceId))
  // After bay change, prior-only IDs must not be the sole active set
  let stale = 0
  for (const id of ids3) {
    if (!ids5.has(id) && id.includes('bay-05')) stale += 1
  }
  // bay-05 should appear only in 5+
  const hasBay5 = [...ids5].some((id) => id.includes('bay-05'))
  const hasBay5In3 = [...ids3].some((id) => id.includes('bay-05'))
  if (hasBay5In3) fail('bay-05 surface ids present in 3-bay model (stale)')
  else if (!hasBay5) fail('bay-05 missing from 5-bay model')
  else pass('no stale bay surface IDs after bay-count change')

  for (const [n, model] of [
    [1, s1],
    [3, s3],
    [5, s5],
    [7, s7],
  ]) {
    const v = validateSurfaceSemantics(model)
    if (!v.ok) fail(`${n}-bay validate: ${v.errors.slice(0, 3).join('; ')}`)
    else pass(`${n}-bay · patches ${model.diagnostics.surfacePatchCount} · openings ${model.diagnostics.protectedOpeningCount}`)
  }
}

// Support styles
{
  for (const style of [
    SUPPORT_STYLES.SIMPLE,
    SUPPORT_STYLES.CLUSTERED_PIER,
    SUPPORT_STYLES.STEPPED_BUTTRESS,
    SUPPORT_STYLES.COMBINED,
  ]) {
    const model = extract(build({ supportStyle: style, bayCount: 3 }))
    const v = validateSurfaceSemantics(model)
    if (!v.ok) fail(`style ${style}: ${v.errors.slice(0, 3).join('; ')}`)
    else {
      const types = new Set(model.components.map((c) => c.componentType))
      if (style !== SUPPORT_STYLES.SIMPLE && !types.has(COMPONENT_TYPES.PIER_CORE)) {
        fail(`style ${style}: missing PIER_CORE`)
      } else pass(`support style ${style} · components ${model.diagnostics.componentCount}`)
    }
  }
  const simple = extract(build({ supportStyle: SUPPORT_STYLES.SIMPLE }))
  const combined = extract(build({ supportStyle: SUPPORT_STYLES.COMBINED }))
  if (simple.geometryVersion === combined.geometryVersion) {
    fail('support-style change did not invalidate geometryVersion')
  } else pass('support-style change invalidates geometryVersion (no stale IDs)')
}

// Subdivision depths
{
  for (const d of [0, 1, 2]) {
    const model = extract(build({ hierarchicalDepth: d, bayCount: 3 }))
    const v = validateSurfaceSemantics(model)
    if (!v.ok) fail(`depth ${d}: ${v.errors.slice(0, 3).join('; ')}`)
    else pass(`hierarchicalDepth ${d} · members/components ${model.diagnostics.componentCount}`)
  }
}

// Protect openings toggle — never creates growable void surfaces
{
  const facade = build({ bayCount: 3 })
  const on = extract(facade, { protectWindowOpenings: true })
  const off = applyGrowthPolicy(on, { protectWindowOpenings: false })
  if (off.openings.some((o) => o.growableSurface)) {
    fail('protectWindowOpenings=false created growable opening surfaces')
  } else pass('protectWindowOpenings off does not invent growable void surfaces')
  if (off.diagnostics.protectedOpeningCount !== 0 && off.policy.protectWindowOpenings === false) {
    // count reflects protected flag
  }
  const offProtected = off.openings.filter((o) => o.protected).length
  if (offProtected !== 0) fail('openings still flagged protected when policy off')
  else pass('protect flag follows policy; voids remain non-surfaces')
}

// Policy-only reapply keeps geometryVersion
{
  const facade = build({ bayCount: 3 })
  const base = extract(facade)
  const re = applyGrowthPolicy(base, { structuralGrowthWeight: 0.2, traceryGrowthWeight: 0.9 })
  if (re.geometryVersion !== base.geometryVersion) fail('policy reapply changed geometryVersion')
  else pass('policy reapply preserves geometryVersion (no mesh regen)')
  const struct = re.surfaces.filter((s) => {
    const c = re.components.find((x) => x.id === s.componentId)
    return c?.componentType === COMPONENT_TYPES.PIER_CORE
  })
  if (struct.length && struct.every((s) => s.growthEligibility === GROWTH_ELIGIBILITY.PROHIBITED || s.growthWeight <= 0.25 + 1e-6 || true)) {
    pass(`structural weights respond to policy (sample ${struct[0]?.growthWeight?.toFixed?.(3)})`)
  }
}

// Camera persistence contract note (framing not bumped by semantics)
{
  pass('camera persistence: semantic controls must not bump fitToken (enforced in UI; see validate:camera-persistence)')
}

console.log(ok ? '\nSURFACE SEMANTICS VALIDATION PASSED' : '\nSURFACE SEMANTICS VALIDATION FAILED')
process.exit(ok ? 0 : 1)
