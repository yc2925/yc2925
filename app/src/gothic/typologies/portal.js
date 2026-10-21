import {
  V,
  addPiercedWall,
  createBuilder,
  frameAt,
  pointedArchHalf,
  pointedArchOutline,
  seededRandom,
} from '../primitives.js'
import {
  addLibraryMeshes,
  createArchivolt,
  createClusteredColumn,
  createHoodMould,
  createMullion,
  resolveDetail,
} from '../library.js'
import { absorbSpecimen, fitScale, makeTransform } from '../assemble.js'
import { buildWindow } from './window.js'
import { DESIGN_LAYER_COLORS } from './windowDesign2d.js'

/**
 * GOTHIC PORTAL — Step 6 architectural integration.
 *
 * buildPortalAssembly: recessed archivolts, per-layer clustered columns,
 * door recess, optional tympanum tracery (reuses Tracery Window).
 * buildPortal: wall envelope + assembly.
 */

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v))
}

/**
 * Core portal opening (no outer wall). Used by Portal typology and Facade.
 */
export function buildPortalAssembly(params = {}) {
  const builder = createBuilder()
  const detail = resolveDetail(params)
  const rand = seededRandom(params.variationSeed ?? 7, 11)
  const skeleton = []

  const cx = params.offsetX ?? 0
  const half = Math.max(0.55, params.half ?? 1.1)
  const sill = params.sill ?? 0.45
  const spring = params.spring ?? sill + half * 1.35
  const apex = params.apex ?? spring + half * 0.95
  const depthBase = params.depth ?? 1.1
  const depthScale = clamp(params.architecturalDepth ?? 0.55, 0.2, 1)
  const depth = depthBase * (0.75 + depthScale * 0.7)
  const structural = detail.structural
  const ornament = detail.tracery

  const archivoltCount = Math.max(2, Math.min(6, Math.round(2 + structural * 4)))
  const moldLayers = detail.moldLayers
  const colR = (0.065 + structural * 0.07) * (0.9 + rand() * 0.2)
  const shaftCount = Math.max(2, Math.min(5, Math.round(2 + structural * 3)))

  // Stepped recess planes — genuine depth between archivolts.
  for (let r = 0; r < archivoltCount; r += 1) {
    const t = archivoltCount <= 1 ? 0 : r / (archivoltCount - 1)
    const rHalf = half - 0.04 - r * (0.065 + structural * 0.03)
    if (rHalf < 0.22) break
    const z0 = -0.02 - t * depth
    const z1 = z0 - depth / archivoltCount * 0.85
    const rApex = apex - 0.04 - r * 0.07
    builder.addBox(
      `recess-step-${r}`,
      'recess',
      cx - rHalf,
      cx + rHalf,
      sill,
      rApex,
      Math.min(z0, z1),
      Math.max(z0, z1),
    )
  }

  // Door leaf plane at the back of the recess.
  const doorHalf = half * (0.42 + ornament * 0.08)
  const doorTop = sill + (spring - sill) * 0.72
  builder.addBox(
    'door-leaf',
    'recess',
    cx - doorHalf,
    cx + doorHalf,
    sill,
    doorTop,
    -depth - 0.04,
    -depth + 0.02,
  )
  builder.addFeature({
    id: 'door-opening',
    type: 'opening',
    label: 'Door opening',
    points: [
      V(cx - doorHalf, sill, -depth),
      V(cx + doorHalf, sill, -depth),
      V(cx + doorHalf, doorTop, -depth),
      V(cx - doorHalf, doorTop, -depth),
    ],
    localFrame: frameAt(V(cx, (sill + doorTop) / 2, -depth), V(0, 1, 0), V(0, 0, 1)),
    bounds: { min: V(cx - doorHalf, sill, -depth - 0.05), max: V(cx + doorHalf, doorTop, -depth + 0.05) },
    meta: { role: 'door' },
  })

  const opening = pointedArchOutline(half, sill, spring, apex, detail.archSteps).map(([x, y]) => [
    x + cx,
    y,
  ])
  builder.addFeature({
    id: 'portal-opening',
    type: 'opening',
    label: 'Portal opening',
    points: opening.map(([x, y]) => V(x, y, 0)),
    localFrame: frameAt(V(cx, apex, 0), V(0, 1, 0), V(0, 0, 1)),
    bounds: { min: V(cx - half, sill, -depth), max: V(cx + half, apex, 0.15) },
    meta: { half, spring, apex, depth },
  })

  const crown = [
    ...pointedArchHalf(half, spring, apex, detail.archSteps, -1).map(([x, y]) => V(x + cx, y, 0)),
    ...pointedArchHalf(half, spring, apex, detail.archSteps, 1)
      .map(([x, y]) => V(x + cx, y, 0))
      .reverse(),
  ]
  builder.addFeature({
    id: 'portal-arch',
    type: 'arch',
    label: 'Portal arch',
    points: crown,
    localFrame: frameAt(V(cx, apex, 0), V(1, 0, 0), V(0, 0, 1)),
    meta: { role: 'primary-arch' },
  })

  // Recessed archivolts + per-layer clustered columns aligned to each ring.
  for (let r = 0; r < archivoltCount; r += 1) {
    const t = archivoltCount <= 1 ? 0 : r / (archivoltCount - 1)
    const rHalf = half - 0.05 - r * (0.07 + structural * 0.032)
    if (rHalf < 0.2) break
    const z = -0.06 - t * (depth * 0.88)
    const rSpring = spring - r * 0.018
    const rApex = apex - 0.05 - r * 0.085
    const scale = 0.03 + (1 - t) * 0.022 + detail.res * 0.01
    const arch = createArchivolt({
      half: rHalf,
      foot: sill,
      spring: rSpring,
      apex: rApex,
      offsetX: cx,
      z,
      scale,
      detail,
      profile: r === 0 ? 'archivolt' : r % 2 === 0 ? 'roll' : 'archivolt',
    })
    builder.addMesh(`archivolt-${r}`, 'rib', arch.geometry)
    builder.addFeature({
      id: `archivolt-${r}`,
      type: 'rib',
      label: `Archivolt ${r + 1}`,
      points: arch.points,
      curve: arch.curve,
      localFrame: frameAt(arch.points[Math.floor(arch.points.length / 2)], V(1, 0, 0), V(0, 0, 1)),
      meta: { index: r, z, profile: 'swept' },
    })
    skeleton.push({
      id: `archivolt-${r}`,
      role: 'frame',
      layer: 'frame',
      color: DESIGN_LAYER_COLORS.frame,
      points: arch.points.map((p) => V(p.x, p.y, p.z + 0.015)),
    })

    // Columns sit on the same depth plane as this archivolt, under the spring.
    const colY1 = rSpring + (rApex - rSpring) * 0.08
    const layerR = colR * (1 - t * 0.22)
    for (const [side, sx] of [
      ['left', cx - rHalf - layerR * 0.35],
      ['right', cx + rHalf + layerR * 0.35],
    ]) {
      // Only full clusters on outer + mid layers to stay interactive.
      if (r > 0 && r < archivoltCount - 1 && r % 2 === 1 && structural < 0.55) continue
      const col = createClusteredColumn({
        x: sx,
        z: z - layerR * 0.15,
        y0: sill,
        y1: Math.max(sill + 0.4, colY1),
        radius: layerR * (r === 0 ? 1 : 0.78),
        shafts: r === 0 ? shaftCount : Math.max(2, shaftCount - 1),
        detail,
        side,
      })
      addLibraryMeshes(builder, `col-${r}-${side[0]}`, 'column', col.meshes)
      col.features.forEach((f) =>
        builder.addFeature({
          ...f,
          id: `col-${r}-${f.id}`,
          meta: { ...(f.meta ?? {}), archivolt: r, z },
        }),
      )
      skeleton.push({
        id: `col-${r}-${side}`,
        role: 'mullion',
        layer: 'mullion',
        color: DESIGN_LAYER_COLORS.mullion,
        points: [V(sx, sill, z), V(sx, colY1, z)],
      })
    }

    // Vertical jamb molding linking foot → spring (structural continuity).
    if (r === 0 || structural > 0.4) {
      for (const sign of [-1, 1]) {
        const jx = cx + sign * (rHalf + scale * 0.4)
        const mull = createMullion({
          a: V(jx, sill + 0.02, z),
          b: V(jx, rSpring, z),
          width: scale * 0.55,
          depth: scale * 0.9,
          detail,
        })
        builder.addMesh(`jamb-${r}-${sign < 0 ? 'L' : 'R'}`, 'mullion', mull.geometry)
        skeleton.push({
          id: `jamb-${r}-${sign < 0 ? 'L' : 'R'}`,
          role: 'mullion',
          layer: 'mullion',
          color: DESIGN_LAYER_COLORS.mullion,
          points: mull.points.map((p) => V(p.x, p.y, p.z + 0.01)),
        })
      }
    }
  }

  // Face hood moldings.
  for (let m = 0; m < moldLayers; m += 1) {
    const grow = 0.07 + m * 0.085
    const hood = createHoodMould({
      half: half + grow,
      spring: spring - m * 0.012,
      apex: apex + 0.09 + m * 0.065,
      offsetX: cx,
      z: 0.03 + m * 0.016,
      scale: 0.026 + detail.res * 0.012,
      detail,
    })
    builder.addMesh(`hood-${m}`, 'rib', hood.geometry)
    builder.addFeature({
      id: `hood-${m}`,
      type: 'rib',
      label: `Hood mould ${m + 1}`,
      points: hood.points,
      curve: hood.curve,
      localFrame: frameAt(V(cx, apex + 0.12, 0.04), V(1, 0, 0), V(0, 0, 1)),
      meta: { role: 'molding', layer: m },
    })
    skeleton.push({
      id: `hood-${m}`,
      role: 'secondary',
      layer: 'secondary',
      color: DESIGN_LAYER_COLORS.secondary,
      points: hood.points.map((p) => V(p.x, p.y, p.z + 0.01)),
    })
  }

  for (const sign of [-1, 1]) {
    const pt = V(cx + sign * half, spring, -0.05)
    builder.addFeature({
      id: `impost-${sign < 0 ? 'L' : 'R'}`,
      type: 'junction',
      label: 'Impost',
      points: [pt],
      localFrame: frameAt(pt, V(0, 1, 0), V(0, 0, 1)),
      meta: { role: 'impost' },
    })
  }

  // Optional tympanum tracery — reuse Tracery Window generator (not a second system).
  const includeTracery = params.includeTracery !== false && ornament > 0.28
  if (includeTracery) {
    const tymSill = doorTop + 0.08
    const tymApex = apex - half * 0.22
    const tymH = tymApex - tymSill
    const tymW = half * (1.05 + ornament * 0.15)
    if (tymH > 0.55 && tymW > 0.5) {
      const win = buildWindow({
        traceryFamily: params.traceryFamily ?? 'geometric',
        lancetCount: Math.max(2, Math.min(3, Math.round(params.lancetCount ?? 2))),
        windowAspect: clamp(params.windowAspect ?? tymH / tymW, 1.3, 2.4),
        upperTraceryHeight: params.upperTraceryHeight ?? 0.34,
        curvature: params.curvature ?? 0.55,
        subdivisionComplexity: params.subdivisionComplexity ?? params.cuspingComplexity ?? ornament,
        symmetry: params.symmetry !== false,
        variationSeed: params.variationSeed ?? 7,
        profileThickness: (params.profileThickness ?? 0.045) * 0.85,
        architecturalDepth: (params.profileArchitecturalDepth ?? 0.1) * 0.9,
        moldingComplexity: Math.max(1, Math.min(2, Math.round(params.moldingComplexity ?? 2))),
        moldingProfile: params.moldingProfile ?? 'compound',
        moldingDepth: params.moldingDepth ?? 0.45,
        bevelIntensity: params.bevelIntensity ?? 0.4,
        detailResolution: Math.min(0.55, (params.detailResolution ?? 0.5) * 0.85),
      })
      const layout = win.meta.design2d.layout
      const scale = fitScale(layout.W, layout.H, tymW * 2, tymH, 0.88)
      const zTymp = -depth * 0.22
      const matrix = makeTransform({
        position: [cx, tymSill, zTymp],
        scale: [scale, scale, scale * 0.75],
      })
      absorbSpecimen(
        builder,
        win,
        { idPrefix: 'tymp', matrix },
        { skeletonOut: skeleton, markEmbedded: true },
      )
      builder.addFeature({
        id: 'tympanum-zone',
        type: 'tracery',
        label: 'Tympanum tracery zone',
        points: [
          V(cx - tymW, tymSill, zTymp),
          V(cx + tymW, tymSill, zTymp),
          V(cx, tymApex, zTymp),
        ],
        localFrame: frameAt(V(cx, (tymSill + tymApex) / 2, zTymp), V(0, 1, 0), V(0, 0, 1)),
        meta: {
          role: 'tympanum',
          family: params.traceryFamily ?? 'geometric',
          embedded: 'window',
        },
      })
    }
  }

  return {
    meshes: builder.meshes,
    features: builder.features,
    skeleton,
    bounds: {
      min: V(cx - half - colR * 2.2, sill, -depth - 0.08),
      max: V(cx + half + colR * 2.2, apex + 0.25, 0.2),
      center: V(cx, (sill + apex) / 2, -depth * 0.35),
    },
    meta: {
      typology: 'portal-assembly',
      half,
      sill,
      spring,
      apex,
      depth,
      archivoltCount,
      detail,
      skeleton,
    },
    dispose: () => builder.dispose(),
  }
}

/** Full portal typology: wall + plinth + one or more assemblies. */
export function buildPortal(params) {
  const builder = createBuilder()
  const detail = resolveDetail(params)
  const rand = seededRandom(params.variationSeed, 13)
  const skeleton = []

  const halfScale = 0.92 + rand() * 0.16
  const apexBias = 0.52 + rand() * 0.16
  const riseScale = 0.7 + rand() * 0.4
  const depthBias = 0.92 + rand() * 0.2

  const W = Math.max(2.4, params.overallWidth)
  const H = Math.max(3.2, params.overallHeight)
  const prop = clamp(params.verticalProportion ?? 0.55, 0.25, 0.85)
  const bays = Math.max(1, Math.min(3, Math.round(params.bayCount ?? 1)))
  const depth = (0.65 + detail.structural * 1.05) * depthBias
  const sill = 0.45
  const wallTop = H * 0.92
  const gablePeak = H

  const gap = 0.18
  const usable = W - gap * (bays + 1)
  const bayW = usable / bays
  let cursor = -W / 2 + gap

  const portals = []
  for (let i = 0; i < bays; i += 1) {
    const jitter = params.symmetry ? 0 : (rand() - 0.5) * bayW * 0.08
    const cx = cursor + bayW / 2 + jitter
    const half = bayW * (0.3 + prop * 0.12) * halfScale
    const apex = sill + (wallTop - sill) * (apexBias + prop * 0.22)
    const rise = half * riseScale
    const spring = Math.max(sill + 0.35, apex - rise)
    portals.push({ i, cx, half, sill, spring, apex })
    cursor += bayW + gap
  }

  builder.addBox('portal-plinth', 'wall', -W / 2 - 0.15, W / 2 + 0.15, 0, sill, -depth - 0.12, 0.38)

  for (let i = 0; i < portals.length; i += 1) {
    const p = portals[i]
    const leftBound = i === 0 ? -W / 2 : (portals[i - 1].cx + portals[i - 1].half + p.cx - p.half) / 2
    const rightBound =
      i === portals.length - 1 ? W / 2 : (p.cx + p.half + portals[i + 1].cx - portals[i + 1].half) / 2

    if (i === 0) builder.addBox(`pier-L-${i}`, 'wall', -W / 2, p.cx - p.half - 0.08, sill, wallTop, -depth * 0.4, 0.08)
    if (i === portals.length - 1)
      builder.addBox(`pier-R-${i}`, 'wall', p.cx + p.half + 0.08, W / 2, sill, wallTop, -depth * 0.4, 0.08)
    if (i < portals.length - 1) {
      const midL = p.cx + p.half + 0.08
      const midR = portals[i + 1].cx - portals[i + 1].half - 0.08
      if (midR > midL) builder.addBox(`pier-M-${i}`, 'wall', midL, midR, sill, wallTop, -depth * 0.4, 0.08)
    }

    const opening = pointedArchOutline(p.half, p.sill, p.spring, p.apex, detail.archSteps).map(([x, y]) => [
      x + p.cx,
      y,
    ])
    addPiercedWall(builder, {
      id: `portal-face-${i}`,
      x0: Math.min(leftBound, p.cx - p.half - 0.4),
      x1: Math.max(rightBound, p.cx + p.half + 0.4),
      y0: sill,
      y1: wallTop,
      zBack: -depth * 0.22,
      depth: depth * 0.22,
      opening,
      gablePeak: bays === 1 ? gablePeak : null,
    })

    const assembly = buildPortalAssembly({
      ...params,
      offsetX: p.cx,
      half: p.half,
      sill: p.sill,
      spring: p.spring,
      apex: p.apex,
      depth,
      architecturalDepth: params.architecturalDepth ?? 0.55,
      includeTracery: (params.traceryComplexity ?? params.ornamentDensity ?? 0.5) > 0.28,
      traceryFamily: params.traceryFamily ?? 'geometric',
    })
    const matrix = makeTransform({ position: [0, 0, 0], scale: 1 })
    absorbSpecimen(builder, assembly, { idPrefix: `bay${i}`, matrix }, { skeletonOut: skeleton })
  }

  builder.addFeature({
    id: 'wall-front',
    type: 'wall',
    label: 'Portal wall',
    points: [V(-W / 2, sill, 0), V(W / 2, sill, 0), V(W / 2, wallTop, 0), V(-W / 2, wallTop, 0)],
    localFrame: frameAt(V(0, H * 0.45, 0), V(1, 0, 0), V(0, 0, 1)),
    bounds: { min: V(-W / 2, 0, -depth), max: V(W / 2, H, 0.45) },
    meta: { typology: 'portal', bays, step: 6 },
  })

  return {
    meshes: builder.meshes,
    features: builder.features,
    bounds: {
      min: V(-W / 2 - 0.25, 0, -depth - 0.15),
      max: V(W / 2 + 0.25, H, 0.45),
      center: V(0, H * 0.4, -depth * 0.35),
    },
    meta: {
      typology: 'portal',
      phase: 6,
      bays,
      depth,
      detail,
      skeleton,
    },
    dispose: () => builder.dispose(),
  }
}
