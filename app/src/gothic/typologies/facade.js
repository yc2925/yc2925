import {
  V,
  addPiercedWall,
  createBuilder,
  frameAt,
  pointedArchOutline,
  seededRandom,
} from '../primitives.js'
import {
  addLibraryMeshes,
  createButtress,
  createHoodMould,
  createPinnacle,
  resolveDetail,
} from '../library.js'
import { absorbSpecimen, fitScale, makeTransform } from '../assemble.js'
import { buildPortalAssembly } from './portal.js'
import { buildWindow } from './window.js'
import { DESIGN_LAYER_COLORS } from './windowDesign2d.js'

/**
 * CATHEDRAL FACADE — Step 6.
 *
 * Hierarchical composition from reusable modules:
 *   PRIMARY   — bays, buttresses, vertical supports
 *   MIDDLE    — portal assembly + tracery windows (reused generators)
 *   UPPER     — gallery, rose (window), gable, pinnacles
 *
 * Does not recreate portal/window geometry independently.
 */

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v))
}

function embedWindow(builder, skeleton, {
  idPrefix,
  cx,
  sillY,
  targetW,
  targetH,
  z,
  params,
  family,
  seedSalt = 0,
}) {
  const win = buildWindow({
    traceryFamily: family ?? params.traceryFamily ?? 'geometric',
    lancetCount: Math.max(2, Math.min(3, Math.round(params.lancetCount ?? 2))),
    windowAspect: clamp(targetH / Math.max(0.4, targetW), 1.35, 2.5),
    upperTraceryHeight: params.upperTraceryHeight ?? 0.34,
    curvature: params.curvature ?? 0.55,
    subdivisionComplexity: params.subdivisionComplexity ?? params.cuspingComplexity ?? params.traceryComplexity ?? 0.5,
    symmetry: params.symmetry !== false,
    variationSeed: Math.round((params.variationSeed ?? 7) + seedSalt),
    profileThickness: (params.profileThickness ?? 0.045) * 0.8,
    architecturalDepth: (params.architecturalDepth ?? 0.12) * 0.7,
    moldingComplexity: Math.max(1, Math.min(2, Math.round(params.moldingComplexity ?? params.moldingLayers ?? 2))),
    moldingProfile: params.moldingProfile ?? 'compound',
    moldingDepth: params.moldingDepth ?? 0.45,
    bevelIntensity: params.bevelIntensity ?? 0.4,
    detailResolution: Math.min(0.5, (params.detailResolution ?? 0.5) * 0.75),
  })
  const layout = win.meta.design2d.layout
  const scale = fitScale(layout.W, layout.H, targetW, targetH, 0.9)
  const matrix = makeTransform({
    position: [cx, sillY, z],
    scale: [scale, scale, scale * 0.7],
  })
  absorbSpecimen(
    builder,
    win,
    { idPrefix, matrix },
    { skeletonOut: skeleton, markEmbedded: true },
  )
  builder.addFeature({
    id: `${idPrefix}-zone`,
    type: 'tracery',
    label: `Window zone ${idPrefix}`,
    points: [
      V(cx - targetW / 2, sillY, z),
      V(cx + targetW / 2, sillY, z),
      V(cx + targetW / 2, sillY + targetH, z),
      V(cx - targetW / 2, sillY + targetH, z),
    ],
    localFrame: frameAt(V(cx, sillY + targetH * 0.5, z), V(0, 1, 0), V(0, 0, 1)),
    meta: { role: 'window-slot', family: family ?? params.traceryFamily, embedded: 'window' },
  })
}

export function buildFacade(params) {
  const builder = createBuilder()
  const detail = resolveDetail(params)
  const rand = seededRandom(params.variationSeed, 5)
  const skeleton = []

  const W = Math.max(5.5, params.overallWidth)
  const H = Math.max(5.5, params.overallHeight)
  const prop = clamp(params.verticalProportion ?? 0.48, 0.28, 0.8)
  let bayCount = Math.max(3, Math.min(5, Math.round(params.bayCount ?? 3)))
  if (bayCount % 2 === 0) bayCount += 1

  const storey1Bias = 0.34 + rand() * 0.1
  const storey2Bias = 0.56 + rand() * 0.12
  const centreScale = 1.08 + rand() * 0.28
  const sideScale = 0.88 + rand() * 0.2
  const depthBias = 0.9 + rand() * 0.22
  const buttressBias = 0.88 + rand() * 0.28
  const depthScale = clamp(params.architecturalDepth ?? 0.55, 0.25, 1)

  const depth = (0.75 + detail.structural * 0.55) * depthBias * (0.8 + depthScale * 0.55)

  const sill = 0.5
  const storey1 = H * (storey1Bias + prop * 0.08)
  const storey2 = H * Math.min(0.82, Math.max(storey1 / H + 0.12, storey2Bias + prop * 0.06))
  const wallTop = H * 0.88
  const gablePeak = H

  const buttressW = (0.28 + detail.structural * 0.15) * buttressBias
  const bayClear = (W - buttressW * (bayCount + 1)) / bayCount
  const centre = Math.floor(bayCount / 2)

  const weights = []
  for (let i = 0; i < bayCount; i += 1) {
    if (i === centre) weights.push(centreScale)
    else if (params.symmetry && i > centre) weights.push(weights[bayCount - 1 - i])
    else if (params.symmetry) weights.push(sideScale)
    else weights.push(sideScale * (0.9 + rand() * 0.25))
  }
  const weightSum = weights.reduce((a, b) => a + b, 0)

  const bays = []
  let x = -W / 2 + buttressW
  for (let i = 0; i < bayCount; i += 1) {
    const w = (bayClear * bayCount * weights[i]) / weightSum
    const cx = x + w / 2
    bays.push({ i, x0: x, x1: x + w, cx, w, isCenter: i === centre })
    x += w + buttressW
  }

  // ── PRIMARY: plinth + buttresses + bay walls ──
  builder.addBox('facade-plinth', 'wall', -W / 2 - 0.2, W / 2 + 0.2, 0, sill, -depth - 0.12, 0.42)

  const buttressSlots = [{ x0: -W / 2, x1: bays[0].x0 }]
  for (let i = 0; i < bays.length - 1; i += 1) buttressSlots.push({ x0: bays[i].x1, x1: bays[i + 1].x0 })
  buttressSlots.push({ x0: bays[bays.length - 1].x1, x1: W / 2 })

  const buttressSteps = Math.max(2, Math.min(5, Math.round(2 + detail.structural * 3)))
  buttressSlots.forEach((slot, b) => {
    const x0 = slot.x0
    const x1 = Math.max(slot.x0 + 0.12, slot.x1)
    const mid = (x0 + x1) / 2
    const bH = wallTop + (b === 0 || b === buttressSlots.length - 1 ? 0.28 : 0.1)
    const butt = createButtress({
      x0,
      x1,
      y0: sill,
      y1: bH,
      zBack: -depth * 0.38,
      zFront: 0.45 + detail.structural * 0.18,
      steps: buttressSteps,
      detail,
    })
    addLibraryMeshes(builder, `buttress-${b}`, 'buttress', butt.meshes)
    builder.addFeature({ ...butt.feature, id: `buttress-${b}`, label: `Buttress ${b + 1}` })
    skeleton.push({
      id: `buttress-${b}`,
      role: 'frame',
      layer: 'frame',
      color: DESIGN_LAYER_COLORS.frame,
      points: [V(mid, sill, 0.35), V(mid, bH, 0.35)],
    })

    if (detail.tracery > 0.28 || (params.ornamentDensity ?? 0) > 0.3) {
      const pin = createPinnacle({
        x: mid,
        y0: bH + 0.04,
        z: 0.34,
        height: 0.55 + detail.tracery * 0.55,
        base: 0.11 + detail.structural * 0.04,
        crockets: detail.tracery > 0.45,
        detail,
      })
      addLibraryMeshes(builder, `pinnacle-${b}`, 'pinnacle', pin.meshes)
      builder.addFeature({ ...pin.feature, id: `pinnacle-${b}` })
    }
  })

  // String courses — horizontal organization.
  for (const [y, id] of [
    [storey1, 'course-1'],
    [storey2, 'course-2'],
  ]) {
    builder.addBox(id, 'wall', -W / 2, W / 2, y - 0.045, y + 0.045, -0.06, 0.18)
    skeleton.push({
      id,
      role: 'secondary',
      layer: 'secondary',
      color: DESIGN_LAYER_COLORS.secondary,
      points: [V(-W / 2, y, 0.1), V(W / 2, y, 0.1)],
    })
  }

  // ── MIDDLE + UPPER per bay ──
  for (const bay of bays) {
    if (bay.isCenter) {
      // Central portal — reuse portal assembly (not a reimplementation).
      const half = bay.w * 0.4
      const apex = storey1 * 0.92
      const spring = sill + (apex - sill) * (0.52 + prop * 0.18)
      const opening = pointedArchOutline(half, sill, spring, apex, detail.archSteps).map(([xx, yy]) => [
        xx + bay.cx,
        yy,
      ])

      addPiercedWall(builder, {
        id: `bay-wall-${bay.i}`,
        x0: bay.x0,
        x1: bay.x1,
        y0: sill,
        y1: storey1,
        zBack: -depth * 0.32,
        depth: depth * 0.32,
        opening,
      })

      const assembly = buildPortalAssembly({
        ...params,
        offsetX: bay.cx,
        half,
        sill,
        spring,
        apex,
        depth: depth * 0.95,
        architecturalDepth: params.architecturalDepth ?? 0.55,
        includeTracery: detail.tracery > 0.32,
        traceryFamily: params.traceryFamily ?? 'geometric',
        detailResolution: Math.min(0.55, (params.detailResolution ?? 0.5) * 0.9),
      })
      absorbSpecimen(
        builder,
        assembly,
        { idPrefix: 'portal', matrix: makeTransform() },
        { skeletonOut: skeleton, markEmbedded: true },
      )

      builder.addFeature({
        id: `opening-${bay.i}`,
        type: 'opening',
        label: 'Central portal',
        points: opening.map(([xx, yy]) => V(xx, yy, 0)),
        localFrame: frameAt(V(bay.cx, apex, 0), V(0, 1, 0), V(0, 0, 1)),
        meta: { bay: bay.i, center: true, module: 'portal-assembly' },
      })

      // Gallery window above central portal.
      if (storey2 - storey1 > 0.7) {
        const gW = bay.w * 0.55
        const gH = (storey2 - storey1) * 0.72
        const gSill = storey1 + (storey2 - storey1) * 0.12
        const gHalf = gW * 0.48
        const gApex = gSill + gH
        const gSpring = gSill + gH * 0.55
        const gOpen = pointedArchOutline(gHalf, gSill, gSpring, gApex, Math.max(10, Math.floor(detail.archSteps / 2))).map(
          ([xx, yy]) => [xx + bay.cx, yy],
        )
        addPiercedWall(builder, {
          id: `gallery-c`,
          x0: bay.x0 + 0.06,
          x1: bay.x1 - 0.06,
          y0: storey1,
          y1: storey2,
          zBack: -depth * 0.18,
          depth: depth * 0.18,
          opening: gOpen,
        })
        embedWindow(builder, skeleton, {
          idPrefix: 'gallery-c',
          cx: bay.cx,
          sillY: gSill,
          targetW: gW,
          targetH: gH,
          z: -depth * 0.08,
          params,
          family: params.traceryFamily ?? 'rayonnant',
          seedSalt: 11,
        })
      }
    } else {
      // Side bays — tracery windows at ground storey (reuse window generator).
      const half = bay.w * 0.32
      const apex = storey1 * 0.78
      const spring = sill + (apex - sill) * (0.5 + prop * 0.2)
      const opening = pointedArchOutline(half, sill, spring, apex, detail.archSteps).map(([xx, yy]) => [
        xx + bay.cx,
        yy,
      ])

      addPiercedWall(builder, {
        id: `bay-wall-${bay.i}`,
        x0: bay.x0,
        x1: bay.x1,
        y0: sill,
        y1: storey2,
        zBack: -depth * 0.28,
        depth: depth * 0.28,
        opening,
      })

      builder.addBox(
        `recess-${bay.i}`,
        'recess',
        bay.cx - half * 0.95,
        bay.cx + half * 0.95,
        sill,
        apex,
        -depth * 0.55,
        -depth * 0.28 + 0.02,
      )

      const hood = createHoodMould({
        half: half + 0.05,
        spring,
        apex: apex + 0.07,
        offsetX: bay.cx,
        z: 0.035,
        scale: 0.024,
        detail,
      })
      builder.addMesh(`hood-${bay.i}`, 'rib', hood.geometry)

      const winH = apex - sill
      const winW = half * 1.85
      embedWindow(builder, skeleton, {
        idPrefix: `win-${bay.i}`,
        cx: bay.cx,
        sillY: sill + 0.06,
        targetW: winW,
        targetH: winH * 0.92,
        z: -depth * 0.12,
        params,
        family: params.traceryFamily ?? 'geometric',
        seedSalt: bay.i * 3,
      })

      builder.addFeature({
        id: `opening-${bay.i}`,
        type: 'opening',
        label: `Side opening ${bay.i + 1}`,
        points: opening.map(([xx, yy]) => V(xx, yy, 0)),
        localFrame: frameAt(V(bay.cx, apex, 0), V(0, 1, 0), V(0, 0, 1)),
        meta: { bay: bay.i, center: false, module: 'window' },
      })

      // Gallery opening on side bays — hood only at moderate density; full window when ornament is high.
      if (detail.structural > 0.22 && storey2 - storey1 > 0.55) {
        const gHalf = bay.w * 0.2
        const gSill = storey1 + 0.12
        const gApex = storey2 - 0.18
        const gSpring = gSill + (gApex - gSill) * 0.55
        if (gApex > gSill + 0.4) {
          const gOpen = pointedArchOutline(gHalf, gSill, gSpring, gApex, Math.max(10, Math.floor(detail.archSteps / 2))).map(
            ([xx, yy]) => [xx + bay.cx, yy],
          )
          addPiercedWall(builder, {
            id: `gallery-${bay.i}`,
            x0: bay.x0 + 0.05,
            x1: bay.x1 - 0.05,
            y0: storey1,
            y1: storey2,
            zBack: -depth * 0.16,
            depth: depth * 0.16,
            opening: gOpen,
          })
          if (detail.tracery > 0.55) {
            embedWindow(builder, skeleton, {
              idPrefix: `gal-${bay.i}`,
              cx: bay.cx,
              sillY: gSill,
              targetW: gHalf * 1.7,
              targetH: gApex - gSill,
              z: -depth * 0.06,
              params: { ...params, detailResolution: Math.min(0.35, params.detailResolution ?? 0.4) },
              family: 'rayonnant',
              seedSalt: 20 + bay.i,
            })
          } else {
            const gHood = createHoodMould({
              half: gHalf + 0.04,
              spring: gSpring,
              apex: gApex + 0.05,
              offsetX: bay.cx,
              z: 0.03,
              scale: 0.02,
              detail,
            })
            builder.addMesh(`gal-hood-${bay.i}`, 'rib', gHood.geometry)
          }
        }
      }
    }
  }

  // ── UPPER: gable wall + rose (window generator, Rayonnant when ornament high) ──
  addPiercedWall(builder, {
    id: 'gable-wall',
    x0: -W / 2 + buttressW,
    x1: W / 2 - buttressW,
    y0: storey2,
    y1: wallTop,
    zBack: -depth * 0.22,
    depth: depth * 0.22,
    opening: null,
    gablePeak,
  })

  if (detail.tracery > 0.3) {
    const roseH = (wallTop - storey2) * 0.72
    const roseW = Math.min(W * 0.28, roseH * 1.05)
    const roseSill = storey2 + (wallTop - storey2) * 0.12
    embedWindow(builder, skeleton, {
      idPrefix: 'rose',
      cx: 0,
      sillY: roseSill,
      targetW: roseW,
      targetH: roseH,
      z: -depth * 0.05,
      params: { ...params, lancetCount: 2, upperTraceryHeight: 0.42 },
      family: detail.tracery > 0.55 ? 'rayonnant' : params.traceryFamily ?? 'geometric',
      seedSalt: 40,
    })
  }

  builder.addFeature({
    id: 'wall-facade',
    type: 'wall',
    label: 'Cathedral facade',
    points: [
      V(-W / 2, sill, 0),
      V(W / 2, sill, 0),
      V(W / 2, wallTop, 0),
      V(0, gablePeak, 0),
      V(-W / 2, wallTop, 0),
    ],
    localFrame: frameAt(V(0, H * 0.45, 0), V(1, 0, 0), V(0, 0, 1)),
    bounds: { min: V(-W / 2, 0, -depth), max: V(W / 2, H, 0.7) },
    meta: {
      typology: 'facade',
      bayCount,
      step: 6,
      modules: ['buttress', 'portal-assembly', 'window', 'pinnacle'],
    },
  })

  return {
    meshes: builder.meshes,
    features: builder.features,
    bounds: {
      min: V(-W / 2 - 0.35, 0, -depth - 0.12),
      max: V(W / 2 + 0.35, H + 1.3, 0.75),
      center: V(0, H * 0.42, -depth * 0.22),
    },
    meta: {
      typology: 'facade',
      phase: 6,
      bayCount,
      depth,
      detail,
      skeleton,
      storeys: { sill, storey1, storey2, wallTop, gablePeak },
    },
    dispose: () => builder.dispose(),
  }
}
