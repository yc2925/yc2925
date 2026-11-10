/**
 * Gothic Grammar — orthographic construction + Stone/3D workspace (Steps 13A–13D).
 *
 * References: REF-008, REF-007, REF-011, REF-009, REF-012.
 * Does not import app/src/gothic, ornament, or agents geometry generators.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import GothicGrammarPanel from '../ui/GothicGrammarPanel.jsx'
import GothicGrammarScene from '../geometry/gothicGrammar/GothicGrammarScene.jsx'
import StoneMeshes from '../geometry/gothicGrammar/solids/StoneMeshes.jsx'
import AssemblyMeshes from '../geometry/gothicGrammar/assemblies/AssemblyMeshes.jsx'
import {
  buildGothicFacadeElevation,
  validateGothicFacadeElevation,
  extractFacadeSurfaceSemantics,
  applyGrowthPolicy,
  DEFAULT_GROWTH_POLICY,
  buildWindowTraceryParams,
  resolveWindowDesignParams,
  emptyGrowthAttachmentState,
  rebindGrowthAnchors,
  buildGrowthNavigationGraph,
  distributeGrowthSeeds,
  createAnchorOnPatch,
  findSurfacePath,
  attachFromWorldHit,
} from '../geometry/gothicGrammar/assemblies/index.js'
import SurfaceSemanticsOverlay from '../geometry/gothicGrammar/assemblies/SurfaceSemanticsOverlay.jsx'
import GrowthAttachmentOverlay from '../geometry/gothicGrammar/assemblies/GrowthAttachmentOverlay.jsx'
import {
  DEFAULT_GOTHIC_GRAMMAR,
  DEFAULT_TRACERY_SETTINGS,
  DEFAULT_STONE_SETTINGS,
  DEFAULT_ASSEMBLY_SETTINGS,
  resolveDisplayFlags,
} from '../geometry/gothicGrammar/settings.js'
import { KERNEL_STATUS, KERNEL_VERSION } from '../geometry/gothicGrammar/kernel/index.js'
import { buildExample, constructionBounds } from '../geometry/gothicGrammar/examples.js'
import {
  buildArchConstruction,
  buildArchComparison,
  archFramingBounds,
} from '../geometry/gothicGrammar/construction/archConstruction.js'
import {
  buildTraceryConstruction,
  traceryFramingBounds,
} from '../geometry/gothicGrammar/tracery/index.js'
import {
  buildStoneAssembly,
  stoneGeometryKey,
} from '../geometry/gothicGrammar/solids/index.js'
import { DEFAULT_CONSTRUCTION_EXTENT } from '../geometry/gothicGrammar/construction/index.js'
import {
  ARCHITECTURE_PRESETS,
  applyArchitecturePreset,
} from '../geometry/gothicGrammar/tracery/presets.js'
import * as THREE from 'three'

function Row({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

/**
 * Ortho framing owns world-unit frustum planes. drei's OrthographicCamera
 * otherwise resets left/right/top/bottom to canvas pixels every render,
 * collapsing ~3 m arches into a speck (13E.4.2).
 *
 * Lifecycle: WAITING_FOR_VIEWPORT → WAITING_FOR_GEOMETRY → INITIAL_FIT → READY.
 * Geometry churn after READY does not reframe; Fit/Reset/mode key do.
 */
function OrthoFraming({
  bounds,
  resetToken = 0,
  fitToken = 0,
  controlsRef,
  frameKey = 'ortho',
  onFrustumChange = null,
}) {
  const { camera, size } = useThree()
  const boundsRef = useRef(bounds)
  boundsRef.current = bounds
  const hasFramedRef = useRef(false)
  const halfExtentRef = useRef(null)
  const centerRef = useRef({ x: 0, y: 0 })
  const frameKeyRef = useRef(frameKey)
  const sizeOk = size.width > 1 && size.height > 1

  const publishFrustum = useCallback(
    (half, aspect, cx, cy) => {
      const next = {
        left: -half * aspect,
        right: half * aspect,
        top: half,
        bottom: -half,
      }
      onFrustumChange?.(next)
      if (camera.isOrthographicCamera) {
        camera.left = next.left
        camera.right = next.right
        camera.top = next.top
        camera.bottom = next.bottom
        camera.zoom = 1
        camera.near = 0.1
        camera.far = 100
        camera.position.set(cx, cy, 10)
        camera.up.set(0, 1, 0)
        camera.lookAt(cx, cy, 0)
        camera.updateProjectionMatrix()
      }
      const controls = controlsRef.current
      if (controls) {
        controls.target.set(cx, cy, 0)
        controls.enableRotate = false
        controls.update()
      }
    },
    [camera, controlsRef, onFrustumChange],
  )

  const applyFrame = useCallback(
    (pad = 1.18) => {
      if (!(size.width > 1 && size.height > 1)) return false
      const b = boundsRef.current
      if (!b) return false
      const aspect = size.width / Math.max(1, size.height)
      const width = Math.max(0.5, b.width ?? DEFAULT_CONSTRUCTION_EXTENT * 2)
      const height = Math.max(0.5, b.height ?? DEFAULT_CONSTRUCTION_EXTENT * 2)
      const cx = (b.min.x + b.max.x) / 2
      const cy = (b.min.y + b.max.y) / 2
      const half = Math.max(width, height) * 0.5 * pad
      halfExtentRef.current = half
      centerRef.current = { x: cx, y: cy }
      publishFrustum(half, aspect, cx, cy)
      return true
    },
    [size.width, size.height, publishFrustum],
  )

  // Workspace mode / projection remount key → allow one fresh initial fit.
  useEffect(() => {
    if (frameKeyRef.current === frameKey) return
    frameKeyRef.current = frameKey
    hasFramedRef.current = false
    halfExtentRef.current = null
  }, [frameKey])

  // Initial frame once viewport + bounds are valid.
  useEffect(() => {
    if (hasFramedRef.current) return
    if (!sizeOk) return
    if (!boundsRef.current) return
    if (applyFrame(1.2)) hasFramedRef.current = true
  }, [applyFrame, bounds, sizeOk, frameKey])

  // Resize: keep world half-extent, refresh aspect only (user composition).
  useEffect(() => {
    if (!hasFramedRef.current) return
    if (!sizeOk) return
    const half = halfExtentRef.current
    if (!(half > 0)) return
    const aspect = size.width / Math.max(1, size.height)
    const { x: cx, y: cy } = centerRef.current
    publishFrustum(half, aspect, cx, cy)
  }, [size.width, size.height, sizeOk, publishFrustum])

  useEffect(() => {
    if (!resetToken) return
    if (applyFrame(1.2)) hasFramedRef.current = true
  }, [resetToken, applyFrame])

  useEffect(() => {
    if (!fitToken) return
    if (applyFrame(1.1)) hasFramedRef.current = true
  }, [fitToken, applyFrame])

  return null
}

function stoneLookTarget(metrics) {
  const min = metrics?.boundingMin ?? [-2, 0, -0.125]
  const max = metrics?.boundingMax ?? [2, 4, 0.125]
  return new THREE.Vector3(
    (min[0] + max[0]) / 2,
    (min[1] + max[1]) / 2,
    (min[2] + max[2]) / 2,
  )
}

function stoneRadius(metrics) {
  const size = metrics?.boundingSize ?? [4, 4, 0.25]
  // Facade elevations are wide: fit horizontal span (FOV-aware), not max-edge alone.
  const w = size[0] ?? 4
  const h = size[1] ?? 4
  const d = size[2] ?? 0.25
  const fov = 42 * (Math.PI / 180)
  const fitW = (w * 0.55) / Math.tan(fov * 0.5)
  const fitH = (h * 0.55) / Math.tan(fov * 0.5)
  return Math.max(fitW, fitH, d * 1.2, w * 0.7, h * 0.9, 1)
}

function presetOffset(preset, radius) {
  const r = radius * 1.15
  switch (preset) {
    case 'front':
      return new THREE.Vector3(0, 0, r)
    case 'back':
      return new THREE.Vector3(0, 0, -r)
    case 'side':
      return new THREE.Vector3(r, 0, 0)
    case 'top':
      return new THREE.Vector3(0, r * 1.35, 0.01)
    case 'three-quarter':
    default:
      return new THREE.Vector3(r * 0.72, r * 0.28, r * 0.85)
  }
}

/**
 * Camera framing for stone / assembly modes (Step 13E.2 persistence).
 *
 * Geometry regeneration must NOT re-apply camera. Framing runs only on:
 * - first available metrics (initial mount)
 * - explicit viewPreset change (Front / Side / Top / Three-Quarter)
 * - explicit fitToken (Fit to Assembly / Fit to Geometry)
 * - explicit resetToken (Reset View)
 */
function StoneFraming({
  metrics,
  resetToken = 0,
  fitToken = 0,
  viewPreset = 'three-quarter',
  controlsRef,
  frameKey = 'stone',
}) {
  const { camera, size } = useThree()
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics
  const hasFramedRef = useRef(false)
  const lastPresetRef = useRef(null)
  const viewPresetRef = useRef(viewPreset)
  viewPresetRef.current = viewPreset
  const frameKeyRef = useRef(frameKey)
  const sizeOk = size.width > 1 && size.height > 1

  const applyPreset = useCallback(
    (preset) => {
      const m = metricsRef.current
      if (!m?.boundingSize && !m?.boundingMin) return false
      if (!(size.width > 1 && size.height > 1)) return false
      // Wait until the perspective camera is the active default (mode-switch race).
      if (!camera?.isPerspectiveCamera) return false
      const controls = controlsRef.current
      const target = stoneLookTarget(m)
      const radius = stoneRadius(m)
      const offset = presetOffset(preset, radius)
      camera.position.copy(target).add(offset)
      camera.up.set(0, 1, 0)
      camera.near = 0.05
      camera.far = Math.max(80, radius * 20)
      camera.aspect = size.width / Math.max(1, size.height)
      camera.updateProjectionMatrix()
      if (controls) {
        controls.object = camera
        controls.target.copy(target)
        controls.enableRotate = true
        controls.minDistance = radius * 0.35
        controls.maxDistance = radius * 12
        controls.update()
      }
      return true
    },
    [camera, controlsRef, size.width, size.height],
  )

  useEffect(() => {
    if (frameKeyRef.current === frameKey) return
    frameKeyRef.current = frameKey
    hasFramedRef.current = false
    lastPresetRef.current = null
  }, [frameKey])

  // Per-frame initial fit until READY — survives camera/controls remount races.
  useFrame(() => {
    if (hasFramedRef.current) return
    if (!(size.width > 1 && size.height > 1)) return
    if (applyPreset(viewPresetRef.current)) {
      hasFramedRef.current = true
      lastPresetRef.current = viewPresetRef.current
    }
  })

  // Explicit camera preset selection only (not geometry param churn).
  useEffect(() => {
    if (!hasFramedRef.current) return
    if (lastPresetRef.current === viewPreset) return
    lastPresetRef.current = viewPreset
    applyPreset(viewPreset)
  }, [viewPreset, applyPreset])

  useEffect(() => {
    if (!resetToken) return
    if (applyPreset(viewPresetRef.current)) {
      hasFramedRef.current = true
      lastPresetRef.current = viewPresetRef.current
    }
  }, [resetToken, applyPreset])

  useEffect(() => {
    if (!fitToken) return
    if (applyPreset(viewPresetRef.current)) {
      hasFramedRef.current = true
      lastPresetRef.current = viewPresetRef.current
    }
  }, [fitToken, applyPreset])

  return null
}

/** Shared with Architectural Assembly (13E.3.2). */
function buildTraceryParams(tracery) {
  return buildWindowTraceryParams(tracery)
}

function buildWorkspaceConstruction(settings, display) {
  const arch = settings.arch ?? {}
  const archDisplay = {
    displayState: display.displayState,
    showPoints: display.showPoints,
    showConstruction: display.showConstruction,
    showCenters: display.showCenters,
    showArchAxis: display.showArchAxis,
    showDimensions: display.showDimensions,
    showResult: display.showResult,
    showFamilyLabels: display.showFamilyLabels,
    showSection: display.showSection,
    showSpringing: display.showConstruction,
  }

  if (settings.workspaceMode === 'compare-arches') {
    return buildArchComparison(
      {
        span: arch.span,
        springingY: arch.springingY,
        samplingQuality: arch.samplingQuality,
        lancetRiseRatio: arch.lancetRiseRatio,
        depressedRiseRatio: arch.depressedRiseRatio,
      },
      archDisplay,
    )
  }

  if (settings.workspaceMode === 'pointed-arch') {
    return buildArchConstruction(
      {
        family: arch.family,
        span: arch.span,
        riseRatio: arch.riseRatio,
        springingY: arch.springingY,
        samplingQuality: arch.samplingQuality,
      },
      archDisplay,
    )
  }

  if (settings.workspaceMode === 'tracery' || settings.workspaceMode === 'stone-3d') {
    const { exampleId, params } = buildTraceryParams(settings.tracery)
    return buildTraceryConstruction(exampleId, params, archDisplay)
  }

  return buildExample(settings.exampleId, settings.exampleParams ?? {})
}

export default function GothicGrammarView() {
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_GOTHIC_GRAMMAR,
    exampleParams: { ...DEFAULT_GOTHIC_GRAMMAR.exampleParams },
    arch: { ...DEFAULT_GOTHIC_GRAMMAR.arch },
    tracery: { ...DEFAULT_GOTHIC_GRAMMAR.tracery },
    stone: { ...DEFAULT_STONE_SETTINGS },
    assembly: { ...DEFAULT_ASSEMBLY_SETTINGS },
  }))
  const controlsRef = useRef(null)
  const [selectedSemanticPatchId, setSelectedSemanticPatchId] = useState(null)
  const [growthAttachment, setGrowthAttachment] = useState(() => emptyGrowthAttachmentState())
  const [selectedGrowthAnchorId, setSelectedGrowthAnchorId] = useState(null)
  const [growthPathPreview, setGrowthPathPreview] = useState(null)
  const [growthPathPick, setGrowthPathPick] = useState([]) // up to 2 anchor ids
  // Controlled world-unit ortho frustum (prevents drei pixel-plane overwrite).
  const [orthoFrustum, setOrthoFrustum] = useState({
    left: -4,
    right: 4,
    top: 4,
    bottom: -4,
  })
  const display = useMemo(() => resolveDisplayFlags(settings), [settings])
  const stoneMode = settings.workspaceMode === 'stone-3d'
  const assemblyMode = settings.workspaceMode === 'architectural-assembly'
  const workspaceMode = settings.workspaceMode ?? 'pointed-arch'

  // Dev/browser probe for camera persistence acceptance (13E.2).
  useEffect(() => {
    window.__ggGetCameraPose = () => {
      const controls = controlsRef.current
      const cam = controls?.object
      if (!cam) return null
      return {
        position: cam.position.toArray(),
        quaternion: cam.quaternion.toArray(),
        target: controls.target.toArray(),
        zoom: cam.zoom,
        fov: cam.fov ?? null,
        near: cam.near,
        far: cam.far,
        left: cam.left ?? null,
        right: cam.right ?? null,
        top: cam.top ?? null,
        bottom: cam.bottom ?? null,
        isPerspective: Boolean(cam.isPerspectiveCamera),
        isOrthographic: Boolean(cam.isOrthographicCamera),
      }
    }
    window.__ggNudgeCamera = (dx = 1.2, dy = 0.35, dz = -0.7) => {
      const controls = controlsRef.current
      const cam = controls?.object
      if (!cam) return null
      cam.position.x += dx
      cam.position.y += dy
      cam.position.z += dz
      controls.target.x += dx * 0.15
      controls.update()
      return window.__ggGetCameraPose()
    }
    return () => {
      delete window.__ggGetCameraPose
      delete window.__ggNudgeCamera
    }
  }, [])
  const stone = { ...DEFAULT_STONE_SETTINGS, ...(settings.stone ?? {}) }
  const assemblySettings = { ...DEFAULT_ASSEMBLY_SETTINGS, ...(settings.assembly ?? {}) }

  const construction = useMemo(() => {
    try {
      return buildWorkspaceConstruction(settings, display)
    } catch (err) {
      return {
        id: 'error',
        type: 'error',
        parameters: {},
        primitives: [],
        derivedPoints: [],
        constraints: [],
        validation: { ok: false, errors: [String(err?.message ?? err)], warnings: [] },
        curves: [],
        metadata: { title: 'Error' },
      }
    }
  }, [settings, display])

  const { exampleId: _ex, params: traceryParams } = useMemo(
    () => buildTraceryParams(settings.tracery),
    [settings.tracery],
  )

  // Always compute — Assembly must invalidate when Stone / 3D design changes (13E.3.2).
  const geomKey = useMemo(
    () => stoneGeometryKey(traceryParams, stone),
    // display-only stone fields must not rebuild geometry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      traceryParams,
      stone.stoneDepth,
      stone.depthAlignment,
      stone.tessellation,
      stone.moldingEnabled,
      stone.profileType,
      stone.profileWidth,
      stone.profileDepth,
      stone.chamferSize,
      stone.beadRadius,
      stone.recessDepth,
      stone.moldingOnOuter,
      stone.moldingOnOpenings,
      stone.moldingHierarchy,
      settings.tracery?.enableSpandrelOpenings,
      settings.tracery?.enableBarNetwork,
      settings.tracery?.enableElaborate,
      settings.tracery?.enableSkeleton,
      settings.tracery?.enableOculusNetwork,
      settings.tracery?.enableSecondaryTracery,
      settings.tracery?.enableOculusRefinement,
      settings.tracery?.enableHierarchicalTracery,
      settings.tracery?.hierarchicalDepth,
      settings.tracery?.nestedArches,
      settings.tracery?.trefoilHeads,
      settings.tracery?.secondaryQuatrefoils,
      settings.tracery?.childArchSpanRatio,
      settings.tracery?.childArchRiseRatio,
      settings.tracery?.secondaryArchWidthRatio,
      settings.tracery?.minOpeningClearance,
      settings.tracery?.secondaryTraceryLevel,
      settings.tracery?.secondaryMemberWidthRatio,
      settings.tracery?.foilBarWidthRatio,
      settings.tracery?.oculusApexClearance,
      settings.tracery?.centralJunctionScale,
      settings.tracery?.foilToRingWidthRatio,
      settings.tracery?.foilRadialMode,
      settings.tracery?.masterFrameWidth,
      settings.tracery?.primaryArchWidthRatio,
      settings.tracery?.mullionWidthRatio,
      settings.tracery?.childArchWidthRatio,
      settings.tracery?.oculusVerticalPosition,
      settings.tracery?.oculusRingWidthRatio,
      settings.tracery?.connectorWidthRatio,
      settings.tracery?.upperConnectorCurvature,
      settings.tracery?.oculusSubdivision,
      settings.tracery?.oculusRadiusRatio,
      settings.tracery?.oculusClearance,
      settings.tracery?.nestingDepth,
      settings.tracery?.secondaryMullionWidth,
      settings.tracery?.secondaryJambInset,
      settings.tracery?.secondaryLancetRatio,
      settings.tracery?.oculusScale,
      settings.tracery?.foilCount,
      settings.tracery?.upperSubdivisionComplexity,
      settings.tracery?.upperOpeningScale,
      settings.tracery?.upperSubdivisionDensity,
      settings.tracery?.secondaryTraceryWidth,
      settings.tracery?.minWebClearance,
      settings.tracery?.architecturePreset,
      settings.tracery?.exampleId,
      settings.tracery?.foilType,
      settings.tracery?.oculusHeightRatio,
    ],
  )

  /** Shared window-design object consumed by Stone / 3D and Assembly (13E.3.2). */
  const windowDesign = useMemo(
    () => resolveWindowDesignParams(settings),
    // geomKey + settings.tracery/stone identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [geomKey, settings.tracery, settings.stone, stone],
  )

  const stoneAssembly = useMemo(() => {
    if (!stoneMode) return null
    try {
      return buildStoneAssembly({
        regionParams: traceryParams,
        stone,
      })
    } catch (err) {
      return {
        ok: false,
        errors: [String(err?.message ?? err)],
        metrics: null,
        structural: null,
        decorative: [],
      }
    }
    // geomKey captures geometry-affecting inputs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geomKey])

  const facadeAssembly = useMemo(() => {
    if (!assemblyMode) return null
    try {
      const linked = (assemblySettings.windowLinkMode ?? 'linked-to-master') !== 'custom-override'
      const facade = buildGothicFacadeElevation({
        ...assemblySettings,
        // Stable assembly id — nextId('facade') churn was poisoning geometryVersion.
        id: `facade-gg-b${assemblySettings.bayCount ?? 3}`,
        // Layout-only depth mirror; shared design owns hierarchicalDepth / stoneDepth.
        hierarchicalDepth:
          windowDesign.tracery.hierarchicalDepth ?? assemblySettings.hierarchicalDepth ?? 1,
        stoneDepth: windowDesign.stone.stoneDepth ?? stone.stoneDepth ?? 0.25,
        windowLinkMode: assemblySettings.windowLinkMode ?? 'linked-to-master',
        windowDesign: linked
          ? { tracery: windowDesign.tracery, stone: windowDesign.stone }
          : undefined,
        tracery: linked ? windowDesign.tracery : undefined,
        stone: linked ? windowDesign.stone : undefined,
      })
      const check = validateGothicFacadeElevation(facade)
      return {
        ...facade,
        validation: {
          ok: facade.ok && check.ok,
          errors: [...(facade.validation?.errors ?? []), ...(check.errors ?? [])],
          warnings: [...(facade.validation?.warnings ?? []), ...(check.warnings ?? [])],
        },
        windowSource: linked ? 'linked-to-stone-3d' : 'custom-override',
        windowGeometryKey: windowDesign.geometryKey,
      }
    } catch (err) {
      return {
        ok: false,
        validation: { ok: false, errors: [String(err?.message ?? err)], warnings: [] },
        metrics: null,
        windowModules: [],
        supports: [],
        bays: [],
      }
    }
  }, [
    assemblyMode,
    assemblySettings.assemblyType,
    assemblySettings.bayCount,
    assemblySettings.baySpacing,
    assemblySettings.bayWidth,
    assemblySettings.windowScale,
    assemblySettings.variationMode,
    assemblySettings.pierWidth,
    assemblySettings.pierDepth,
    assemblySettings.buttressProjection,
    assemblySettings.showStructuralSupports,
    assemblySettings.hierarchicalDepth,
    assemblySettings.centerEmphasisScale,
    assemblySettings.supportStyle,
    assemblySettings.shaftArrangement,
    assemblySettings.shaftRadiusRatio,
    assemblySettings.shaftProjection,
    assemblySettings.baseHeight,
    assemblySettings.capitalHeight,
    assemblySettings.buttressSetbackCount,
    assemblySettings.buttressSetbackRatio,
    assemblySettings.showBases,
    assemblySettings.showCapitalTransitions,
    assemblySettings.windowLinkMode,
    windowDesign.geometryKey,
    windowDesign.tracery,
    windowDesign.stone,
    stone.stoneDepth,
  ])

  // Semantic extraction keyed only on geometry identity — overlay weight edits
  // reapply policy without regenerating meshes (13E.3).
  const surfaceSemanticsBase = useMemo(() => {
    if (!facadeAssembly?.ok && !facadeAssembly?.windowModules?.length) return null
    return extractFacadeSurfaceSemantics(facadeAssembly, DEFAULT_GROWTH_POLICY)
  }, [facadeAssembly])

  useEffect(() => {
    setSelectedSemanticPatchId(null)
  }, [surfaceSemanticsBase?.geometryVersion])

  const surfaceSemantics = useMemo(() => {
    if (!surfaceSemanticsBase) return null
    return applyGrowthPolicy(surfaceSemanticsBase, {
      structuralGrowthWeight: assemblySettings.structuralGrowthWeight ?? 0.85,
      traceryGrowthWeight: assemblySettings.traceryGrowthWeight ?? 0.35,
      recessedGrowthWeight: assemblySettings.recessedGrowthWeight ?? 0.7,
      sacredFacadeEmphasis: assemblySettings.sacredFacadeEmphasis ?? 0.55,
      protectWindowOpenings: assemblySettings.protectWindowOpenings !== false,
    })
  }, [
    surfaceSemanticsBase,
    assemblySettings.structuralGrowthWeight,
    assemblySettings.traceryGrowthWeight,
    assemblySettings.recessedGrowthWeight,
    assemblySettings.sacredFacadeEmphasis,
    assemblySettings.protectWindowOpenings,
  ])

  // 13E.4.1 — rebind ONLY when geometry identity / bay count changes.
  // Navigation graph is memoized; identical writes must not touch React state.
  const growthGeomKeyRef = useRef('')
  const growthNavOptsKey = `${assemblySettings.growthNavigationGapTolerance ?? 0.35}|${
    assemblySettings.growthAllowRestricted === true ? 1 : 0
  }`
  const growthNavigationGraph = useMemo(() => {
    if (!surfaceSemantics) return null
    return buildGrowthNavigationGraph(surfaceSemantics, {
      navigationGapTolerance: assemblySettings.growthNavigationGapTolerance ?? 0.35,
      allowRestricted: assemblySettings.growthAllowRestricted === true,
    })
    // surfaceSemantics object identity may churn from policy weights; key on version.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surfaceSemantics?.geometryVersion, growthNavOptsKey, assemblySettings.bayCount])

  useEffect(() => {
    if (!surfaceSemantics) return
    const version = surfaceSemantics.geometryVersion ?? ''
    const bayCount = assemblySettings.bayCount ?? null
    const geomKey = `${version}::${bayCount ?? ''}`
    const graph = growthNavigationGraph

    // Geometry unchanged → sync cached graph only if reference actually differs.
    if (growthGeomKeyRef.current === geomKey) {
      setGrowthAttachment((prev) => {
        if (prev.navigationGraph === graph && prev.bayCount === bayCount) return prev
        return { ...prev, navigationGraph: graph, bayCount, geometrySignature: version }
      })
      return
    }

    const prevKey = growthGeomKeyRef.current
    growthGeomKeyRef.current = geomKey
    const bayCountChanged =
      Boolean(prevKey) && prevKey.split('::')[1] !== String(bayCount ?? '')

    setGrowthAttachment((prev) => {
      if (!(prev.anchors?.length > 0)) {
        return {
          ...emptyGrowthAttachmentState(version),
          navigationGraph: graph,
          bayCount,
          geometrySignature: version,
        }
      }
      // Remount / HMR: same stable signature → keep VALID statuses (no reproject).
      if (prev.geometrySignature === version && !bayCountChanged) {
        return {
          ...prev,
          navigationGraph: graph,
          bayCount,
          geometrySignature: version,
        }
      }
      const rebound = rebindGrowthAnchors(prev, surfaceSemantics, { bayCountChanged })
      return {
        ...rebound,
        navigationGraph: graph,
        bayCount,
        geometrySignature: version,
      }
    })
    setGrowthPathPreview(null)
    setGrowthPathPick([])
  }, [
    surfaceSemantics,
    surfaceSemantics?.geometryVersion,
    assemblySettings.bayCount,
    growthNavigationGraph,
  ])

  const handleGrowthPlaceOnPatch = useCallback(
    (patch, worldPoint, worldNormal) => {
      if (!surfaceSemantics || !patch) return
      const hit = attachFromWorldHit(
        surfaceSemantics,
        { point: worldPoint, normal: worldNormal },
        {
          allowRestricted: assemblySettings.growthAllowRestricted === true,
          projectionTolerance: assemblySettings.growthProjectionTolerance ?? 0.08,
          protectOpenings: assemblySettings.protectWindowOpenings !== false,
        },
      )
      const created =
        hit.ok
          ? hit
          : createAnchorOnPatch(surfaceSemantics, patch, {
              worldPosition: worldPoint,
              worldNormal: worldNormal ?? patch.representativeNormal,
              allowRestricted: assemblySettings.growthAllowRestricted === true,
            })
      if (!created.ok) {
        window.__ggGrowthPlacementError = created.reason
        return
      }
      window.__ggGrowthPlacementError = null
      const version = surfaceSemantics.geometryVersion ?? ''
      // Fresh placement is VALID — never mark REPROJECTED at creation time.
      const anchor = {
        ...created.anchor,
        status: 'VALID',
        geometrySignature: version,
      }
      setGrowthAttachment((prev) => {
        const anchors = [...(prev.anchors ?? []), anchor]
        return {
          ...prev,
          anchors,
          geometrySignature: version || prev.geometrySignature,
          diagnostics: {
            ...(prev.diagnostics ?? {}),
            acceptedSeeds: anchors.length,
            valid: anchors.filter((a) => a.status === 'VALID').length,
            reprojected: anchors.filter((a) => a.status === 'REPROJECTED').length,
          },
        }
      })
      setSelectedGrowthAnchorId(anchor.anchorId)
    },
    [surfaceSemantics, assemblySettings],
  )

  const handleGrowthSelectAnchor = useCallback(
    (anchor) => {
      if (!anchor) return
      setSelectedGrowthAnchorId(anchor.anchorId)
      if (assemblySettings.showGrowthNavPaths !== true) return
      setGrowthPathPick((prev) => {
        const next = [...prev.filter((id) => id !== anchor.anchorId), anchor.anchorId].slice(-2)
        if (next.length === 2 && growthAttachment?.navigationGraph) {
          const a = growthAttachment.anchors.find((x) => x.anchorId === next[0])
          const b = growthAttachment.anchors.find((x) => x.anchorId === next[1])
          if (a && b) {
            const path = findSurfacePath(a, b, {
              graph: growthAttachment.navigationGraph,
              semantics: surfaceSemantics,
              allowRestricted: assemblySettings.growthAllowRestricted === true,
            })
            setGrowthPathPreview(path)
          }
        }
        return next
      })
    },
    [
      assemblySettings.showGrowthNavPaths,
      assemblySettings.growthAllowRestricted,
      growthAttachment,
      surfaceSemantics,
    ],
  )

  const runAutomaticSeedDistribution = useCallback(() => {
    if (!surfaceSemantics) return
    const result = distributeGrowthSeeds(surfaceSemantics, {
      seedCount: assemblySettings.growthSeedCount ?? 24,
      randomSeed: assemblySettings.growthRandomSeed ?? 13,
      minSpacing: assemblySettings.growthMinSeedSpacing ?? 0.22,
      distributionMode: assemblySettings.growthDistributionMode ?? 'WEIGHTED_BY_ELIGIBILITY',
      allowRestricted: assemblySettings.growthAllowRestricted === true,
      preferVertical: assemblySettings.growthPreferVertical !== false,
      preferRecesses: assemblySettings.growthPreferRecesses === true,
      preferJunctions: assemblySettings.growthPreferJunctions !== false,
    })
    setGrowthAttachment((prev) => ({
      ...prev,
      anchors: result.anchors,
      distributionReport: result.report,
      geometrySignature: surfaceSemantics.geometryVersion ?? prev.geometrySignature,
      diagnostics: {
        valid: result.anchors.length,
        reprojected: 0,
        blocked: 0,
        orphaned: 0,
        acceptedSeeds: result.report.accepted,
        requestedSeeds: result.report.requested,
      },
    }))
    setGrowthPathPreview(null)
    setGrowthPathPick([])
    setSelectedGrowthAnchorId(null)
  }, [surfaceSemantics, assemblySettings])

  const clearGrowthSeeds = useCallback(() => {
    setGrowthAttachment((prev) => ({
      ...prev,
      anchors: [],
      distributionReport: null,
      lastPath: null,
      diagnostics: {
        ...(prev.diagnostics ?? {}),
        acceptedSeeds: 0,
        requestedSeeds: 0,
        orphaned: 0,
        blocked: 0,
        reprojected: 0,
      },
    }))
    setGrowthPathPreview(null)
    setGrowthPathPick([])
    setSelectedGrowthAnchorId(null)
  }, [])

  // Expose attachment probe for validation / screenshots (no camera side effects).
  useEffect(() => {
    window.__ggGrowthAttachment = () => ({
      anchors: growthAttachment?.anchors ?? [],
      diagnostics: growthAttachment?.diagnostics ?? null,
      distributionReport: growthAttachment?.distributionReport ?? null,
      graph: growthAttachment?.navigationGraph?.diagnostics ?? null,
      path: growthPathPreview,
      placementError: window.__ggGrowthPlacementError ?? null,
      geometrySignature: growthAttachment?.geometrySignature ?? null,
    })
    window.__ggDistributeGrowthSeeds = runAutomaticSeedDistribution
    window.__ggClearGrowthSeeds = clearGrowthSeeds
    return () => {
      delete window.__ggGrowthAttachment
      delete window.__ggDistributeGrowthSeeds
      delete window.__ggClearGrowthSeeds
    }
  }, [growthAttachment, growthPathPreview, runAutomaticSeedDistribution, clearGrowthSeeds])

  const compareAssemblies = useMemo(() => {
    const compareOn =
      stone.compareMode === 'side-by-side' ||
      stone.compareMode === 'all-three' ||
      stone.compareMode === 'all-four'
    if (!stoneMode || !compareOn) {
      return null
    }
    const span = settings.tracery?.span ?? 3
    const basePatch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.BASELINE_13D,
      { ...DEFAULT_TRACERY_SETTINGS, ...settings.tracery, span },
      { ...DEFAULT_STONE_SETTINGS, ...stone },
    )
    const refinedPatch = applyArchitecturePreset(
      ARCHITECTURE_PRESETS.RAYONNANT_REFINED,
      { ...DEFAULT_TRACERY_SETTINGS, ...settings.tracery, span },
      { ...DEFAULT_STONE_SETTINGS, ...stone },
    )
    const { params: baseParams } = buildTraceryParams(basePatch.tracery)
    const { params: refinedParams } = buildTraceryParams(refinedPatch.tracery)
    const offset = (span + (basePatch.tracery.outerFrameWidth ?? 0.12) * 2) * 0.65
    try {
      const result = {
        baseline: buildStoneAssembly({ regionParams: baseParams, stone: basePatch.stone }),
        refined: buildStoneAssembly({
          regionParams: refinedParams,
          stone: refinedPatch.stone,
        }),
        offset,
        mode: stone.compareMode,
      }
      if (stone.compareMode === 'all-three' || stone.compareMode === 'all-four') {
        const barPatch = applyArchitecturePreset(
          ARCHITECTURE_PRESETS.RAYONNANT_BAR_NETWORK,
          { ...DEFAULT_TRACERY_SETTINGS, ...settings.tracery, span },
          { ...DEFAULT_STONE_SETTINGS, ...stone },
        )
        const { params: barParams } = buildTraceryParams(barPatch.tracery)
        result.barNetwork = buildStoneAssembly({
          regionParams: barParams,
          stone: barPatch.stone,
        })
        result.offset = offset * 0.85
      }
      if (stone.compareMode === 'all-four') {
        const elabPatch = applyArchitecturePreset(
          ARCHITECTURE_PRESETS.RAYONNANT_ELABORATE,
          { ...DEFAULT_TRACERY_SETTINGS, ...settings.tracery, span },
          { ...DEFAULT_STONE_SETTINGS, ...stone },
        )
        const { params: elabParams } = buildTraceryParams(elabPatch.tracery)
        result.elaborate = buildStoneAssembly({
          regionParams: elabParams,
          stone: elabPatch.stone,
        })
        result.offset = offset * 0.72
      }
      return result
    } catch (err) {
      return { error: String(err?.message ?? err) }
    }
  }, [stoneMode, stone, settings.tracery, geomKey])

  const bounds = useMemo(() => {
    if (
      construction.type === 'pointed-arch' ||
      construction.type === 'arch-comparison'
    ) {
      return archFramingBounds(construction, {
        includeConstruction: display.includeConstructionInFrame,
      })
    }
    if (construction.type === 'tracery') {
      return traceryFramingBounds(construction, {
        includeConstruction: display.includeConstructionInFrame,
      })
    }
    return constructionBounds(construction)
  }, [construction, display.includeConstructionInFrame])

  const pointCount =
    (construction.primitives?.filter((p) => p.type === 'point').length ?? 0) +
    (construction.derivedPoints?.length ?? 0)
  const curveCount = construction.curves?.length ?? 0
  const archMeta = construction.metadata?.arch?.derived
  const resultCurveCount = (construction.curves ?? []).filter((c) => c.role === 'result').length
  const metrics = assemblyMode
    ? {
        boundingMin: facadeAssembly?.metrics?.boundingMin,
        boundingMax: facadeAssembly?.metrics?.boundingMax,
        boundingSize: facadeAssembly?.metrics?.boundingSize,
        structuralVolume: facadeAssembly?.metrics?.estimatedStoneVolume,
        structuralVolumeAvailable: true,
        watertight: facadeAssembly?.windowModules?.every((m) => m.semantic?.watertight),
        triangleCount: facadeAssembly?.windowModules?.reduce(
          (s, m) => s + (m.assembly?.metrics?.triangleCount ?? 0),
          0,
        ),
        nonManifoldEdgeCount: facadeAssembly?.windowModules?.reduce(
          (s, m) => s + (m.semantic?.nonManifoldEdgeCount ?? 0),
          0,
        ),
      }
    : stoneAssembly?.metrics

  const perspectiveMode = stoneMode || assemblyMode

  return (
    <section className="gothic-lab gothic-grammar-lab" aria-labelledby="gothic-grammar-title">
      <Canvas className="viewport" gl={{ antialias: true }} resize={{ debounce: 0 }}>
        {perspectiveMode ? (
          // Do not pass position — R3F would re-apply it every commit and fight StoneFraming.
          <PerspectiveCamera makeDefault fov={42} near={0.05} far={200} />
        ) : (
          <OrthographicCamera
            makeDefault
            manual
            left={orthoFrustum.left}
            right={orthoFrustum.right}
            top={orthoFrustum.top}
            bottom={orthoFrustum.bottom}
            // Position owned by OrthoFraming (avoid prop fight on every commit).
            near={0.1}
            far={100}
          />
        )}
        <color attach="background" args={[settings.background ?? '#070707']} />
        {assemblyMode ? (
          <>
            <ambientLight intensity={0.55} />
            <directionalLight position={[3.5, 5.5, 6]} intensity={0.65} castShadow={false} />
            <directionalLight position={[-4, 2.5, 2]} intensity={0.32} />
            <AssemblyMeshes
              facade={facadeAssembly}
              displayMode={stone.displayMode ?? 'solid'}
              showSupports={assemblySettings.showStructuralSupports !== false}
              inspectLayer={
                assemblySettings.inspectLayer === 'surface-semantics'
                  ? 'combined'
                  : (assemblySettings.inspectLayer ?? 'combined')
              }
              showGraphLabels={assemblySettings.showGraphLabels === true}
            />
            {(assemblySettings.showSemanticOverlay === true ||
              assemblySettings.inspectLayer === 'surface-semantics') &&
            surfaceSemantics ? (
              <SurfaceSemanticsOverlay
                semantics={surfaceSemantics}
                viewMode={assemblySettings.semanticView ?? 'COMPONENT_TYPE'}
                selectedPatchId={selectedSemanticPatchId}
                onSelectPatch={(patch) => setSelectedSemanticPatchId(patch?.patchId ?? null)}
              />
            ) : null}
            {assemblyMode &&
            surfaceSemantics &&
            (assemblySettings.showGrowthSeeds !== false ||
              assemblySettings.growthPlaceSeedActive === true ||
              assemblySettings.showGrowthNavGraph === true ||
              assemblySettings.showGrowthNavPaths === true ||
              assemblySettings.showGrowthNormals === true ||
              assemblySettings.showGrowthTangents === true ||
              assemblySettings.showGrowthCollisionDiagnostics === true) ? (
              <GrowthAttachmentOverlay
                semantics={surfaceSemantics}
                state={growthAttachment}
                settings={assemblySettings}
                selectedAnchorId={selectedGrowthAnchorId}
                onSelectAnchor={handleGrowthSelectAnchor}
                onPlaceOnPatch={handleGrowthPlaceOnPatch}
                pathPreview={growthPathPreview}
              />
            ) : null}
            {stone.showAxes !== false ? <axesHelper args={[1.5]} /> : null}
            <StoneFraming
              metrics={metrics}
              resetToken={settings.resetViewToken ?? 0}
              fitToken={settings.fitToken ?? 0}
              viewPreset={assemblySettings.viewPreset ?? 'three-quarter'}
              controlsRef={controlsRef}
              frameKey="architectural-assembly"
            />
          </>
        ) : stoneMode ? (
          <>
            <ambientLight intensity={0.55} />
            <directionalLight position={[3.5, 5.5, 6]} intensity={0.65} castShadow={false} />
            <directionalLight position={[-4, 2.5, 2]} intensity={0.32} />
            {compareAssemblies?.baseline && compareAssemblies?.refined ? (
              <>
                {(() => {
                  const o = compareAssemblies.offset
                  const four = Boolean(compareAssemblies.elaborate)
                  const three = Boolean(compareAssemblies.barNetwork) && !four
                  const xs = four
                    ? [-o * 3, -o, o, o * 3]
                    : three
                      ? [-o * 2, 0, o * 2]
                      : [-o, o]
                  const inspect = stone.presentationClean
                    ? 'combined'
                    : stone.inspectLayer ?? 'combined'
                  const common = {
                    displayMode: stone.displayMode,
                    showStructural: true,
                    showMoldings: stone.showMoldings !== false,
                    showNormals: false,
                    inspectLayer: inspect,
                  }
                  return (
                    <>
                      <group position={[xs[0], 0, 0]}>
                        <StoneMeshes assembly={compareAssemblies.baseline} {...common} />
                      </group>
                      <group position={[xs[1], 0, 0]}>
                        <StoneMeshes assembly={compareAssemblies.refined} {...common} />
                      </group>
                      {compareAssemblies.barNetwork ? (
                        <group position={[xs[2], 0, 0]}>
                          <StoneMeshes assembly={compareAssemblies.barNetwork} {...common} />
                        </group>
                      ) : null}
                      {compareAssemblies.elaborate ? (
                        <group position={[xs[3], 0, 0]}>
                          <StoneMeshes assembly={compareAssemblies.elaborate} {...common} />
                        </group>
                      ) : null}
                    </>
                  )
                })()}
              </>
            ) : (
              <StoneMeshes
                assembly={stoneAssembly}
                displayMode={stone.displayMode}
                showStructural={stone.showStructural !== false}
                showMoldings={stone.showMoldings !== false}
                showNormals={stone.showNormals === true && !stone.presentationClean}
                inspectLayer={
                  stone.presentationClean ? 'combined' : stone.inspectLayer ?? 'combined'
                }
                showNetworkIds={stone.showNetworkIds === true}
                showNetworkWidths={stone.showNetworkWidths !== false}
                hierarchyColoring={stone.hierarchyColoring === true}
              />
            )}
            {stone.showAxes && !stone.presentationClean && !compareAssemblies ? (
              <axesHelper args={[1.2]} />
            ) : null}
            <StoneFraming
              metrics={metrics}
              resetToken={settings.resetViewToken ?? 0}
              fitToken={settings.fitToken ?? 0}
              viewPreset={stone.viewPreset ?? 'three-quarter'}
              controlsRef={controlsRef}
              frameKey="stone-3d"
            />
          </>
        ) : (
          <>
            <ambientLight intensity={0.55} />
            <GothicGrammarScene
              showGrid={display.showGrid}
              showAxes={display.showAxes}
              showOrigin={display.showOrigin}
              showPoints={display.showPoints}
              showConstruction={display.showConstruction}
              showCenters={display.showCenters}
              showLabels={display.showLabels}
              showDimensions={display.showDimensions}
              showFamilyLabels={display.showFamilyLabels}
              showResult={display.showResult}
              sectionMode={display.displayState === 'section'}
              construction={construction}
            />
            <OrthoFraming
              bounds={bounds}
              resetToken={settings.resetViewToken ?? 0}
              fitToken={settings.fitToken ?? 0}
              controlsRef={controlsRef}
              frameKey={workspaceMode}
              onFrustumChange={setOrthoFrustum}
            />
          </>
        )}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableRotate={perspectiveMode}
          enablePan
          enableZoom
          // Do not pass target — framing components own orbit target (prop fight).
          minZoom={0.35}
          maxZoom={8}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>

      <h2 id="gothic-grammar-title" className="voxel-lab-title">
        Gothic Grammar
      </h2>

      <aside className="shader-status gothic-status" aria-label="Gothic grammar status">
        <p className="growth-pipeline">
          Kernel <span>→</span> Arch <span>→</span> Tracery <span>→</span> Solids
          {assemblyMode ? (
            <>
              {' '}
              <span>→</span> Assembly
            </>
          ) : null}
        </p>
        <p className="shader-brief">
          {assemblyMode
            ? 'Step 13E.2 structural articulation — clustered piers / stepped buttresses + camera persistence. Refs REF-004 · REF-007 · REF-008 · REF-011.'
            : stoneMode
              ? stoneAssembly?.meta?.oculusRefinement
                ? 'Step 13D.8 oculus refinement — tip-to-ring foils, apex clearance, junction scale. Refs REF-006 · REF-011 · REF-009 · REF-013.'
                : stoneAssembly?.meta?.secondaryTracery
                  ? 'Step 13D.7 secondary tracery — oculus + quatrefoil + side members. Refs REF-008 · REF-011 · REF-007 · REF-009.'
                  : stoneAssembly?.meta?.oculusNetwork
                    ? 'Step 13D.6 oculus network — skeleton + connected oculus strips. Refs REF-007 · REF-008 · REF-011 · REF-009.'
                    : stoneAssembly?.meta?.skeleton
                      ? 'Step 13D.5 skeleton-first — stone = unioned centerline strips. Refs REF-007 · REF-008 · REF-011 · REF-009.'
                      : stoneAssembly?.meta?.elaborate
                        ? 'Step 13D.4 elaborate grammar — hierarchical zones. Refs REF-008 · REF-011 · REF-009 · REF-007.'
                        : 'Step 13D stone extrusion + moldings. Structural watertight; decorative separate. Refs REF-008 · REF-011 · REF-009 · REF-012.'
              : 'Solid/void regions (13C.1). Refs REF-008 · REF-009 · REF-011 · REF-007. Section uses validated planar regions.'}
        </p>
        <Row label="Workspace" value={settings.workspaceMode ?? 'pointed-arch'} />
        {assemblyMode ? (
          <Row
            label="Window source"
            value={
              facadeAssembly?.windowSource === 'linked-to-stone-3d'
                ? 'Linked to Stone / 3D'
                : 'Custom override'
            }
          />
        ) : null}
        <Row
          label="Display"
          value={
            assemblyMode
              ? assemblySettings.viewPreset
              : stoneMode
                ? stone.displayMode
                : display.displayState
          }
        />
        {assemblyMode ? (
          <>
            <Row label="Grammar stage" value="13E.2" />
            <Row label="Bay count" value={String(facadeAssembly?.metrics?.bayCount ?? '—')} />
            <Row
              label="Window modules"
              value={String(facadeAssembly?.metrics?.windowModuleCount ?? '—')}
            />
            <Row
              label="Supports"
              value={String(facadeAssembly?.metrics?.structuralSupportCount ?? '—')}
            />
            <Row
              label="Assembly W×H"
              value={
                facadeAssembly?.metrics?.boundingSize
                  ? `${facadeAssembly.metrics.boundingSize[0].toFixed(2)} × ${facadeAssembly.metrics.boundingSize[1].toFixed(2)} m`
                  : '—'
              }
            />
            <Row
              label="Est. volume"
              value={
                facadeAssembly?.metrics?.estimatedStoneVolume != null
                  ? `${facadeAssembly.metrics.estimatedStoneVolume.toFixed(3)} m³`
                  : '—'
              }
            />
            <Row
              label="Geometry cache"
              value={`${facadeAssembly?.metrics?.uniqueGeometries ?? '—'} unique / ${facadeAssembly?.metrics?.cacheHits ?? 0} hits`}
            />
            <Row
              label="Valid"
              value={facadeAssembly?.validation?.ok === false ? 'no' : 'yes'}
            />
          </>
        ) : null}
        {stoneMode ? (
          <>
            <Row
              label="Preset"
              value={
                settings.tracery?.architecturePreset ??
                stoneAssembly?.meta?.architecturePreset ??
                '—'
              }
            />
            <Row
              label="Representation"
              value={stoneAssembly?.meta?.representation ?? '—'}
            />
            <Row
              label="Grammar stage"
              value={stoneAssembly?.meta?.grammarStage ?? stoneAssembly?.meta?.version ?? '—'}
            />
            <Row
              label="Graph nodes"
              value={
                stoneAssembly?.meta?.networkNodeCount != null
                  ? String(stoneAssembly.meta.networkNodeCount)
                  : '—'
              }
            />
            <Row
              label="Graph members"
              value={
                stoneAssembly?.meta?.networkMemberCount != null
                  ? String(stoneAssembly.meta.networkMemberCount)
                  : '—'
              }
            />
            <Row
              label="Stone components"
              value={
                stoneAssembly?.meta?.stoneComponentCount != null
                  ? String(stoneAssembly.meta.stoneComponentCount)
                  : '—'
              }
            />
          </>
        ) : null}
        <Row
          label="Title"
          value={
            stoneMode && stoneAssembly?.solidVoid?.metadata?.title
              ? stoneAssembly.solidVoid.metadata.title
              : stoneMode && stoneAssembly?.meta?.oculusRefinement
                ? 'Rayonnant Oculus Refined'
                : stoneMode && stoneAssembly?.meta?.secondaryTracery
                  ? 'Rayonnant Secondary Tracery'
                  : stoneMode && stoneAssembly?.meta?.oculusNetwork
                    ? 'Rayonnant Oculus Network'
                    : stoneMode && stoneAssembly?.meta?.skeleton
                      ? 'Rayonnant Skeleton'
                      : (construction.metadata?.title ?? '—')
          }
        />
        <Row label="Kernel" value={`${KERNEL_STATUS} · ${KERNEL_VERSION}`} />
        {archMeta ? (
          <>
            <Row label="Span" value={`${(construction.parameters?.span ?? 0).toFixed(2)} m`} />
            <Row label="Rise" value={`${(construction.parameters?.rise ?? 0).toFixed(2)} m`} />
            <Row label="h/S" value={(construction.parameters?.riseRatio ?? 0).toFixed(3)} />
            <Row label="Radius" value={`${(archMeta.radius ?? 0).toFixed(3)} m`} />
          </>
        ) : null}
        {construction.metadata?.regionMetrics && !stoneMode ? (
          <>
            <Row
              label="Solid area"
              value={
                Number.isFinite(construction.metadata.regionMetrics.solidArea)
                  ? `${construction.metadata.regionMetrics.solidArea.toFixed(3)} m²`
                  : 'n/a'
              }
            />
            <Row
              label="Openings"
              value={String(construction.metadata.regionMetrics.openingCount ?? '—')}
            />
            <Row
              label="Min clear"
              value={
                Number.isFinite(construction.metadata.regionMetrics.minDetectedClearance)
                  ? `${construction.metadata.regionMetrics.minDetectedClearance.toFixed(3)} m`
                  : 'n/a'
              }
            />
          </>
        ) : null}
        {stoneMode && metrics ? (
          <>
            <Row
              label="BBox"
              value={`${metrics.boundingSize.map((v) => v.toFixed(2)).join(' × ')} m`}
            />
            <Row
              label="Volume"
              value={
                metrics.structuralVolumeAvailable
                  ? `${metrics.structuralVolume.toFixed(4)} m³`
                  : 'unavailable'
              }
            />
            <Row
              label="Area"
              value={
                Number.isFinite(metrics.surfaceArea)
                  ? `${metrics.surfaceArea.toFixed(3)} m²`
                  : 'n/a'
              }
            />
            <Row label="Tris" value={String(metrics.triangleCount)} />
            <Row label="Watertight" value={metrics.watertight ? 'yes' : 'no'} />
            <Row label="Non-manifold" value={String(metrics.nonManifoldEdgeCount ?? '—')} />
            <Row label="Depth" value={`${(stone.stoneDepth ?? 0).toFixed(2)} m`} />
          </>
        ) : null}
        {!stoneMode ? (
          <>
            <Row label="Result curves" value={String(resultCurveCount)} />
            <Row label="Marks" value={String(pointCount)} />
            <Row label="All curves" value={String(curveCount)} />
          </>
        ) : null}
        <Row
          label="Valid"
          value={
            stoneMode
              ? stoneAssembly?.ok === false
                ? 'no'
                : 'yes'
              : construction.validation?.ok === false
                ? 'no'
                : 'yes'
          }
        />
        <Row
          label="Refs"
          value={
            stoneMode
              ? stoneAssembly?.meta?.oculusNetwork || stoneAssembly?.meta?.skeleton
                ? 'REF-007 · REF-008 · REF-011 · REF-009'
                : 'REF-008 · REF-011 · REF-009 · REF-012'
              : (construction.metadata?.references ?? []).join(' · ') || '—'
          }
        />
      </aside>

      <GothicGrammarPanel
        settings={settings}
        onChange={setSettings}
        construction={construction}
        stoneAssembly={stoneAssembly}
        facadeAssembly={facadeAssembly}
        surfaceSemantics={surfaceSemantics}
        growthAttachment={growthAttachment}
        onDistributeGrowthSeeds={runAutomaticSeedDistribution}
        onClearGrowthSeeds={clearGrowthSeeds}
        onDeleteSelectedGrowthAnchor={() => {
          if (!selectedGrowthAnchorId) return
          setGrowthAttachment((prev) => ({
            ...prev,
            anchors: (prev.anchors ?? []).filter((a) => a.anchorId !== selectedGrowthAnchorId),
          }))
          setSelectedGrowthAnchorId(null)
        }}
        selectedGrowthAnchorId={selectedGrowthAnchorId}
        growthPathPreview={growthPathPreview}
      />
    </section>
  )
}
