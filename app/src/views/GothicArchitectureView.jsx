import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei'
import GothicArchitecturePanel from '../ui/GothicArchitecturePanel.jsx'
import GothicScene from '../gothic/GothicScene.jsx'
import { countFeatures, generateArchitecture } from '../gothic/grammar.js'
import {
  ACTIVE_TYPOLOGIES,
  DEFAULT_GOTHIC,
  FEATURE_TYPES,
  coerceDisplayMode,
  defaultForTypology,
  displayModesForTypology,
  typologyById,
} from '../gothic/settings.js'
import { DESIGN_LAYERS } from '../gothic/typologies/windowDesign2d.js'
import { buildWindowDesignOnly, buildWindowFromDesign } from '../gothic/typologies/window.js'
import ScaleReference from '../scale/ScaleReference.jsx'
import FitCamera from '../scale/FitCamera.jsx'
import { formatMeters } from '../scale/units.js'
import {
  createLodGeometryCache,
  makeLodCacheKey,
  countMeshTriangles,
  estimateGeometryBytes,
  resolveGothicRenderParams,
  LOD_LABELS,
} from '../lod/index.js'
import LodController from '../lod/LodController.jsx'
import LodDebug from '../lod/LodDebug.jsx'
import FpsProbe from '../lod/FpsProbe.jsx'

function Row({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function CameraRig({ typologyId, designLayout, controlsRef, ortho, displayMode }) {
  const { camera, size } = useThree()

  useEffect(() => {
    const typ = typologyById(typologyId)
    const { position, target } = typ.camera

    if (ortho && designLayout) {
      const cy = designLayout.H * 0.5
      camera.position.set(0, cy, 10)
      camera.up.set(0, 1, 0)
      camera.lookAt(0, cy, 0)
      if (camera.isOrthographicCamera) {
        const span = Math.max(designLayout.W, designLayout.H) * 0.62
        const aspect = size.width / Math.max(1, size.height)
        camera.left = -span * aspect
        camera.right = span * aspect
        camera.top = span
        camera.bottom = -span
        camera.zoom = 1
        camera.near = 0.1
        camera.far = 100
      }
      camera.updateProjectionMatrix()
      const controls = controlsRef.current
      if (controls) {
        controls.target.set(0, cy, 0)
        controls.enableRotate = false
        controls.update()
      }
      return () => {
        const c = controlsRef.current
        if (c) c.enableRotate = true
      }
    }

    const pos = typologyId === 'window' ? [3.8, 3.1, 7.4] : position
    const tgt = typologyId === 'window' && designLayout ? [0, designLayout.H * 0.48, 0] : target
    camera.position.set(pos[0], pos[1], pos[2])
    camera.updateProjectionMatrix()
    const controls = controlsRef.current
    if (controls) {
      controls.target.set(tgt[0], tgt[1], tgt[2])
      controls.enableRotate = true
      controls.update()
    }
  }, [typologyId, designLayout, camera, controlsRef, ortho, size.width, size.height, displayMode])

  return null
}

export default function GothicArchitectureView() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_GOTHIC }))
  const params = useDeferredValue(settings)
  const controlsRef = useRef(null)
  const lodCacheRef = useRef(createLodGeometryCache({ maxEntries: 12 }))
  const [activeLod, setActiveLod] = useState('high')
  const [lodMetrics, setLodMetrics] = useState(null)
  const [fps, setFps] = useState(0)

  const isWindow = settings.typology === 'window'
  const displayModes = displayModesForTypology(settings.typology)
  const displayMode = coerceDisplayMode(settings.typology, settings.displayMode)
  // Ortho only for 2D Design. Skeleton stays perspective so it matches solid centerlines in 3D.
  const orthoView = isWindow && displayMode === 'design'

  useEffect(() => {
    if (settings.displayMode !== displayMode) {
      setSettings((s) => ({ ...s, displayMode }))
    }
  }, [displayMode, settings.displayMode])

  // Canonical architecture at design detail — topology / openings independent of LOD.
  const designParams = useMemo(
    () => ({
      typology: params.typology,
      bayCount: params.bayCount,
      lancetCount: params.lancetCount ?? params.bayCount,
      overallHeight: params.overallHeight,
      overallWidth: params.overallWidth,
      architecturalScale: params.architecturalScale ?? 1,
      verticalProportion: params.verticalProportion,
      structuralComplexity: params.structuralComplexity,
      traceryComplexity: params.traceryComplexity,
      moldingLayers: params.moldingLayers,
      detailResolution: params.detailResolution,
      structuralDensity: params.structuralComplexity,
      ornamentDensity: params.traceryComplexity,
      symmetry: params.symmetry,
      variationSeed: params.variationSeed,
      traceryFamily: params.traceryFamily,
      windowAspect: params.windowAspect,
      upperTraceryHeight: params.upperTraceryHeight,
      curvature: params.curvature,
      subdivisionComplexity: params.subdivisionComplexity ?? params.cuspingComplexity,
      cuspingComplexity: params.cuspingComplexity ?? params.subdivisionComplexity,
      profileThickness: params.profileThickness,
      architecturalDepth: params.architecturalDepth,
      moldingComplexity: params.moldingComplexity ?? params.moldingLayers,
      moldingProfile: params.moldingProfile,
      moldingDepth: params.moldingDepth,
      bevelIntensity: params.bevelIntensity,
    }),
    [params],
  )

  // Window: design graph only (cheap). Portal/façade: full specimen as topology source.
  const canonical = useMemo(() => {
    if (designParams.typology === 'window') return buildWindowDesignOnly(designParams)
    return generateArchitecture(designParams)
  }, [designParams])

  useEffect(
    () => () => {
      canonical.dispose?.()
      lodCacheRef.current.clear()
    },
    [canonical],
  )

  const archScale = params.architecturalScale ?? 1
  const renderParams = useMemo(
    () => resolveGothicRenderParams(designParams, activeLod),
    [designParams, activeLod],
  )

  const specimen = useMemo(() => {
    if (params.typology === 'window' && canonical.meta?.design2d) {
      const designId = [
        params.traceryFamily,
        params.variationSeed,
        params.windowAspect,
        params.lancetCount,
        params.overallWidth,
        archScale,
      ].join(':')
      const key = makeLodCacheKey({
        kind: 'gothic-window',
        designId,
        lod: activeLod,
        scale: archScale,
        extras: `${renderParams.detailResolution.toFixed(3)}:${renderParams.moldingComplexity}`,
      })
      const hit = lodCacheRef.current.get(key)
      if (hit) return hit
      const solidParams = {
        profileThickness: (params.profileThickness ?? 0.055) * archScale,
        architecturalDepth: (params.architecturalDepth ?? 0.14) * archScale,
        moldingComplexity: renderParams.moldingComplexity,
        detailResolution: renderParams.detailResolution,
        moldingProfile: params.moldingProfile,
        moldingDepth: params.moldingDepth,
        bevelIntensity: params.bevelIntensity,
        lodLevel: activeLod,
      }
      const built = buildWindowFromDesign(canonical.meta.design2d, solidParams)
      lodCacheRef.current.set(key, built, () => built.dispose())
      return built
    }
    // Portal / façade: same composition params; LOD only changes detailResolution / mold layers
    const key = makeLodCacheKey({
      kind: `gothic-${params.typology}`,
      designId: `${params.variationSeed}:${params.overallWidth}:${params.overallHeight}`,
      lod: activeLod,
      scale: archScale,
      extras: `${renderParams.detailResolution.toFixed(3)}`,
    })
    const hit = lodCacheRef.current.get(key)
    if (hit) return hit
    const built = generateArchitecture({ ...designParams, ...renderParams })
    lodCacheRef.current.set(key, built, () => built.dispose())
    return built
  }, [params, canonical, renderParams, activeLod, archScale, designParams])

  const onLodChange = useCallback((level, ev) => {
    setActiveLod(level)
    setLodMetrics(ev)
  }, [])
  const onLodMetrics = useCallback((ev) => setLodMetrics(ev), [])

  const chooseTypology = (id) => {
    setSettings(() => defaultForTypology(id))
    lodCacheRef.current.clear()
  }

  const counts = countFeatures(specimen.features)
  const meshCount = specimen.meshes.length
  const triangles = countMeshTriangles(specimen.meshes)
  const geomBytes = estimateGeometryBytes(specimen.meshes)
  const active = typologyById(settings.typology)
  const design = specimen.meta?.design2d
  const designLayout = design?.layout
  const curveCount = design?.curves?.length ?? 0
  const skeletonCount = specimen.meta?.skeleton?.length ?? 0
  const studioLight = !orthoView

  const stone = {
    color: params.stoneColor ?? '#c4bfb4',
    roughness: params.stoneRoughness ?? 0.78,
    variation: params.surfaceVariation ?? 0.25,
  }

  return (
    <section className="gothic-lab" aria-labelledby="gothic-lab-title">
      <Canvas className="viewport" gl={{ antialias: true }} shadows>
        {orthoView ? (
          <OrthographicCamera makeDefault position={[0, 2.85, 10]} near={0.1} far={100} />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={isWindow ? [3.8, 3.1, 7.4] : active.camera.position}
            fov={36}
          />
        )}
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#f0ebe3', '#101010', studioLight ? 0.42 : 0.55]} />
        <ambientLight intensity={studioLight ? 0.16 : 0.14} />
        <directionalLight
          position={[6, 10, 5]}
          intensity={studioLight ? 1.4 : 1.1}
          color="#f5f0e6"
          castShadow={studioLight && displayMode === 'solid'}
        />
        <directionalLight position={[-5, 3, 4]} intensity={studioLight ? 0.4 : 0.28} color="#ddd6c8" />
        {studioLight ? (
          <directionalLight position={[1, 4, -5]} intensity={0.28} color="#c8c2b4" />
        ) : null}
        <GothicScene
          specimen={specimen}
          displayMode={displayMode}
          designLayers={settings.designLayers}
          stone={stone}
        />
        {!orthoView ? (
          <ScaleReference
            width={designLayout?.W ?? params.overallWidth ?? 3}
            height={designLayout?.H ?? params.overallHeight ?? 5.7}
            showScaleReference={!!params.showScaleReference}
            showDimensions={!!params.showDimensions}
            showHumanReference={!!params.showHumanReference}
          />
        ) : null}
        {!orthoView ? <gridHelper args={[20, 20, '#2a2a2a', '#1a1a1a']} /> : null}
        <CameraRig
          typologyId={settings.typology}
          designLayout={designLayout}
          controlsRef={controlsRef}
          ortho={orthoView}
          displayMode={displayMode}
        />
        <FitCamera
          token={params.fitToObjectToken ?? 0}
          envelope={{
            width: designLayout?.W ?? params.overallWidth ?? 3,
            height: designLayout?.H ?? params.overallHeight ?? 5.7,
          }}
          controlsRef={controlsRef}
        />
        <LodController
          bounds={specimen.bounds ?? designLayout}
          lodMode={params.lodMode ?? 'auto'}
          enableAutoLod={params.enableAutoLod !== false}
          lodBias={params.lodBias ?? 0}
          onLodChange={onLodChange}
          onMetrics={onLodMetrics}
        />
        <LodDebug
          bounds={specimen.bounds ?? designLayout}
          level={activeLod}
          projectedFrac={lodMetrics?.projectedFrac ?? 0}
          thresholds={lodMetrics?.thresholds}
          visible={!!params.showLodDebug}
        />
        <FpsProbe onFps={setFps} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={
            isWindow && designLayout
              ? [0, designLayout.H * (orthoView ? 0.5 : 0.48), 0]
              : active.camera.target
          }
          enableDamping
          dampingFactor={0.08}
          enableRotate={!orthoView}
          minDistance={2}
          maxDistance={40}
        />
      </Canvas>

      <h2 id="gothic-lab-title" className="voxel-lab-title">
        Gothic Architecture
      </h2>

      <aside className="shader-status gothic-status" aria-label="Gothic architecture status">
        <nav className="growth-studies gothic-typologies" aria-label="Architectural typology">
          {ACTIVE_TYPOLOGIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === settings.typology ? 'is-active' : ''}
              onClick={() => chooseTypology(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <nav className="growth-studies gothic-display" aria-label="Display mode">
          {displayModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={mode.id === displayMode ? 'is-active' : ''}
              onClick={() => setSettings((s) => ({ ...s, displayMode: mode.id }))}
            >
              {mode.label}
            </button>
          ))}
        </nav>

        <p className="growth-pipeline">
          {isWindow ? (
            <>
              Family <span>→</span> Graph <span>→</span> Profiles <span>→</span> Stone
            </>
          ) : (
            <>
              Typology <span>→</span> Layout <span>→</span> Structure <span>→</span> Ornament
            </>
          )}
        </p>

        <Row label="Typology" value={active.label} />
        <Row label="Mode" value={displayModes.find((m) => m.id === displayMode)?.label ?? displayMode} />
        {isWindow ? (
          <>
            <Row
              label="Family"
              value={
                (params.traceryFamily ?? design?.layout?.family ?? 'geometric').replace(/^\w/, (c) =>
                  c.toUpperCase(),
                )
              }
            />
            <Row label="Curves" value={String(curveCount)} />
            <Row label="Skeleton" value={String(skeletonCount)} />
            <Row label="Meshes" value={meshCount.toLocaleString('en-US')} />
            <Row label="Triangles" value={Math.round(triangles).toLocaleString('en-US')} />
            <Row label="Lancets" value={String(Math.round(params.lancetCount ?? 2))} />
            <Row label="Seed" value={String(Math.round(params.variationSeed ?? 7))} />
            <Row
              label="Extent"
              value={
                designLayout
                  ? `${formatMeters(designLayout.W, 1)} × ${formatMeters(designLayout.H, 1)}`
                  : '—'
              }
            />
            <Row
              label="Scale"
              value={`${(params.architecturalScale ?? 1).toFixed(2)}× · 1 wu = 1 m`}
            />
            <Row label="LOD" value={`${LOD_LABELS[activeLod] ?? activeLod}${params.lodMode === 'auto' && params.enableAutoLod !== false ? ' · auto' : ''}`} />
            <Row label="Proj. size" value={lodMetrics ? `${(lodMetrics.projectedFrac * 100).toFixed(0)}% vh` : '—'} />
            <Row label="Cam dist" value={lodMetrics ? formatMeters(lodMetrics.cameraDistance, 1) : '—'} />
            <Row label="Geom mem" value={`~${(geomBytes / 1024).toFixed(0)} KB`} />
            <Row label="FPS" value={fps ? fps.toFixed(0) : '—'} />
          </>
        ) : (
          <>
            <Row
              label="Family"
              value={(params.traceryFamily ?? 'geometric').replace(/^\w/, (c) => c.toUpperCase())}
            />
            <Row label="Meshes" value={meshCount.toLocaleString('en-US')} />
            <Row label="Triangles" value={Math.round(triangles).toLocaleString('en-US')} />
            <Row label="Skeleton" value={String(skeletonCount)} />
            <Row label="Bays / lights" value={String(Math.round(params.bayCount))} />
            <Row
              label="Extent"
              value={`${formatMeters((params.overallWidth ?? 4.2) * (params.architecturalScale ?? 1), 1)} × ${formatMeters((params.overallHeight ?? 5.2) * (params.architecturalScale ?? 1), 1)}`}
            />
            <Row
              label="Scale"
              value={`${(params.architecturalScale ?? 1).toFixed(2)}× · 1 wu = 1 m`}
            />
            <Row label="LOD" value={LOD_LABELS[activeLod] ?? activeLod} />
            <Row label="FPS" value={fps ? fps.toFixed(0) : '—'} />
          </>
        )}

        <div className="gothic-feature-legend" aria-label="Legend">
          {displayMode === 'design'
            ? DESIGN_LAYERS.map((t) => (
                <div key={t.id} className="gothic-feature-row">
                  <span className="gothic-swatch" style={{ background: t.color }} />
                  <span>{t.label}</span>
                  <span>{settings.designLayers?.[t.id] === false ? 'off' : 'on'}</span>
                </div>
              ))
            : displayMode === 'skeleton'
              ? [
                  { id: 'frame', label: 'Frame', color: '#f0ebe3' },
                  { id: 'mullion', label: 'Mullions', color: '#5eb0ff' },
                  { id: 'secondary', label: 'Secondary', color: '#7dcea0' },
                  { id: 'tertiary', label: 'Tertiary', color: '#e8c37a' },
                ].map((t) => (
                  <div key={t.id} className="gothic-feature-row">
                    <span className="gothic-swatch" style={{ background: t.color }} />
                    <span>{t.label}</span>
                    <span>—</span>
                  </div>
                ))
              : FEATURE_TYPES.filter((t) => counts[t.id]).map((t) => (
                  <div key={t.id} className="gothic-feature-row">
                    <span className="gothic-swatch" style={{ background: t.color }} />
                    <span>{t.label}</span>
                    <span>{counts[t.id]}</span>
                  </div>
                ))}
        </div>

        <p className="shader-brief">{active.note}</p>
        <p className="shader-brief">
          {isWindow ? (
            <>
              Family grammar → <code>buildWindowDesign2d</code> → <code>buildWindowSolid3d</code>. Same graph in
              every display mode. Feature metadata retained for future growth.
            </>
          ) : (
            <>
              <code>generateArchitecture(params)</code> in <code>app/src/gothic/grammar.js</code>. Planned: Vault,
              Arcade, Buttress.
            </>
          )}
        </p>
      </aside>

      <GothicArchitecturePanel
        settings={settings}
        onChange={setSettings}
        onTypology={chooseTypology}
        activeLod={activeLod}
      />
    </section>
  )
}
