import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import OrnamentSystemPanel from '../ui/OrnamentSystemPanel.jsx'
import OrnamentScene from '../ornament/OrnamentScene.jsx'
import { DEFAULT_ORNAMENT, ORNAMENT_DISPLAY_MODES } from '../ornament/settings.js'
import { buildOrnamentArchitecture } from '../ornament/source.js'
import { generateGrowthConditions } from '../ornament/conditions.js'
import { createParticleSimulation } from '../ornament/particles.js'
import { completeParticleTrails } from '../ornament/branching.js'
import { composeOrnamentNetwork } from '../ornament/composition.js'
import { createGrowthPlayback } from '../ornament/growthPlayback.js'
import { presetById } from '../gothic/typologies/presets.js'

function Row({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

const MODE_NOTES = {
  architecture: 'Gothic window stone from the shared generator.',
  anchors: 'Growth anchors sampled on frame, mullions, tracery, and junctions.',
  suitability: 'Curve segments + anchors coloured by suitability. Threshold filters the field.',
  direction: 'Travel directions (normalized). Curve tangents stored separately for path choice.',
  trails: 'Time-based particle paths guided by architecture. Output is curves, not vegetation.',
  branching:
    'Composed ornamental growth: bilateral / rhythmic organization of trails and L-system branches.',
  geometry:
    'Sculptural profiles swept along the composed network — foliate relief, not thin botanical wires.',
}

function branchParamsFrom(settings) {
  return {
    branchGenerations: settings.branchGenerations ?? 1,
    branchDensity: settings.branchDensity ?? 0.4,
    branchAngle: settings.branchAngle ?? 34,
    lengthDecay: settings.lengthDecay ?? 0.48,
    architecturalAttraction: settings.architecturalAttraction ?? 0.55,
    curlInfluence: settings.curlInfluence ?? 0.42,
    symmetryBias: settings.symmetryBias ?? 0.55,
    growthSeed: settings.growthSeed ?? 11,
    trailSpacing: settings.trailSpacing ?? 0.14,
    growthEnvelope: settings.growthEnvelope ?? 0.32,
    maxArchDistance: settings.maxArchDistance ?? 0,
    branchGrowthSpeed: settings.branchGrowthSpeed ?? 1,
    branchDelay: settings.branchDelay ?? 0.35,
    simulationDuration: settings.simulationDuration ?? 12,
    stretchTimeline: settings.stretchTimeline !== false,
    compositionMode: settings.compositionMode ?? 'bilateral',
    symmetryStrength: settings.symmetryStrength ?? 1,
    growthRegion: settings.growthRegion ?? 'upper-tracery',
    motifType: settings.motifType ?? 'scroll',
    motifSpacing: settings.motifSpacing ?? 0.55,
    motifScale: settings.motifScale ?? 0.55,
    repetitionCount: settings.repetitionCount ?? 4,
    masterPathCount: settings.masterPathCount ?? settings.particleCount ?? 3,
    particleCount: settings.particleCount ?? 3,
  }
}

function SuitabilityLegend() {
  return (
    <div className="ornament-suitability-legend" aria-label="Suitability legend">
      <span className="ornament-legend-label">0.0</span>
      <div className="ornament-legend-bar" />
      <span className="ornament-legend-label">1.0</span>
    </div>
  )
}

function simParamsFrom(settings) {
  return {
    growthMode: settings.growthMode ?? 'hybrid',
    particleCount: settings.particleCount ?? 7,
    spawnThreshold: settings.spawnThreshold ?? 0.55,
    growthSpeed: settings.growthSpeed ?? 1,
    simulationDuration: settings.simulationDuration ?? 12,
    growthSeed: settings.growthSeed ?? 11,
    architecturalFollowing: settings.architecturalFollowing ?? 0.9,
    upwardBias: settings.upwardBias ?? 0.35,
    gravity: settings.gravity ?? 0.25,
    curlStrength: settings.curlStrength ?? 0.2,
    organicDeviation: settings.organicDeviation ?? 0.15,
    junctionAttraction: settings.junctionAttraction ?? 0.55,
    explorationBias: settings.explorationBias ?? 0.45,
    architecturalProximity: settings.architecturalProximity ?? 0.82,
    growthEnvelope: settings.growthEnvelope ?? 0.28,
    maximumPathLength: settings.maximumPathLength ?? 0,
    trailSpacing: settings.trailSpacing ?? 0.14,
    maxArchDistance: settings.maxArchDistance ?? 0,
  }
}

function formatTermReasons(byReason) {
  if (!byReason || !Object.keys(byReason).length) return '—'
  return Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v}`)
    .join(' · ')
}

export default function OrnamentSystemView() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_ORNAMENT }))
  const params = useDeferredValue(settings)
  const controlsRef = useRef(null)
  const simRef = useRef(null)
  const branchPlaybackRef = useRef(null)
  const [simStats, setSimStats] = useState(null)
  const [branchStats, setBranchStats] = useState(null)
  const [simEpoch, setSimEpoch] = useState(0)
  const [playbackEpoch, setPlaybackEpoch] = useState(0)

  const archKey = useMemo(
    () =>
      JSON.stringify({
        archSource: params.archSource,
        traceryFamily: params.traceryFamily,
        activePreset: params.activePreset,
        variationSeed: params.variationSeed,
        windowAspect: params.windowAspect,
        lancetCount: params.lancetCount,
        upperTraceryHeight: params.upperTraceryHeight,
        curvature: params.curvature,
        subdivisionComplexity: params.subdivisionComplexity,
        symmetry: params.symmetry,
        profileThickness: params.profileThickness,
        architecturalDepth: params.architecturalDepth,
        moldingComplexity: params.moldingComplexity,
        moldingProfile: params.moldingProfile,
        moldingDepth: params.moldingDepth,
        bevelIntensity: params.bevelIntensity,
        detailResolution: params.detailResolution,
      }),
    [params],
  )

  const architecture = useMemo(() => buildOrnamentArchitecture(params), [archKey])

  useEffect(() => () => architecture.dispose(), [architecture])

  const growth = useMemo(
    () =>
      generateGrowthConditions(architecture.arch, {
        anchorCount: params.anchorCount,
        minAnchorSpacing: params.minAnchorSpacing,
        growthSeed: params.growthSeed,
        frameAttraction: params.frameAttraction,
        mullionAttraction: params.mullionAttraction,
        traceryAttraction: params.traceryAttraction,
        junctionAttraction: params.junctionAttraction,
        heightPreference: params.heightPreference,
        architecturalFollowing: params.architecturalFollowing,
        upwardBias: params.upwardBias,
        junctionPull: params.junctionPull,
        outwardBias: params.outwardBias,
      }),
    [
      architecture,
      params.anchorCount,
      params.minAnchorSpacing,
      params.growthSeed,
      params.frameAttraction,
      params.mullionAttraction,
      params.traceryAttraction,
      params.junctionAttraction,
      params.heightPreference,
      params.architecturalFollowing,
      params.upwardBias,
      params.junctionPull,
      params.outwardBias,
    ],
  )

  // Rebuild simulation when architecture, anchors, or sim config changes.
  const simKey = useMemo(
    () =>
      JSON.stringify({
        archKey,
        growthSeed: params.growthSeed,
        ...simParamsFrom(params),
        anchorN: growth.anchors.length,
      }),
    [archKey, params, growth.anchors.length],
  )

  useEffect(() => {
    const sim = createParticleSimulation({
      arch: architecture.arch,
      anchors: growth.anchors,
      params: simParamsFrom(settings),
    })
    simRef.current = sim
    setSimStats(sim.getStats())
    setSimEpoch((e) => e + 1)
    return () => {
      simRef.current = null
    }
    // settings snapshot at rebuild — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey, architecture, growth])

  const onSimStats = useCallback((s) => setSimStats(s), [])
  const onBranchStats = useCallback((s) => setBranchStats(s), [])

  const displayMode = settings.displayMode
  const trails = displayMode === 'trails'
  const branching = displayMode === 'branching'
  const geometry = displayMode === 'geometry'
  const networkMode = branching || geometry

  // Geometry key: regenerates target curves (not every playback scrub).
  const branchGeomKey = useMemo(
    () =>
      JSON.stringify({
        simKey,
        branchGenerations: params.branchGenerations,
        branchDensity: params.branchDensity,
        branchAngle: params.branchAngle,
        lengthDecay: params.lengthDecay,
        architecturalAttraction: params.architecturalAttraction,
        curlInfluence: params.curlInfluence,
        symmetryBias: params.symmetryBias,
        growthSeed: params.growthSeed,
        compositionMode: params.compositionMode,
        symmetryStrength: params.symmetryStrength,
        growthRegion: params.growthRegion,
        motifType: params.motifType,
        motifSpacing: params.motifSpacing,
        motifScale: params.motifScale,
        repetitionCount: params.repetitionCount,
        masterPathCount: params.masterPathCount ?? params.particleCount,
      }),
    [simKey, params],
  )

  const branchTimingKey = useMemo(
    () =>
      JSON.stringify({
        branchGrowthSpeed: params.branchGrowthSpeed ?? 1,
        branchDelay: params.branchDelay ?? 0.35,
        simulationDuration: params.simulationDuration ?? 12,
        stretchTimeline: params.stretchTimeline !== false,
      }),
    [
      params.branchGrowthSpeed,
      params.branchDelay,
      params.simulationDuration,
      params.stretchTimeline,
    ],
  )

  // Completed primary trails for branching / geometry (independent of interactive trails sim).
  const completedTrails = useMemo(() => {
    if (!networkMode) return []
    const sim = createParticleSimulation({
      arch: architecture.arch,
      anchors: growth.anchors,
      params: simParamsFrom(params),
    })
    return completeParticleTrails(sim)
  }, [networkMode, branchGeomKey, architecture, growth, params])

  const branchNetwork = useMemo(() => {
    if (!networkMode) return null
    return composeOrnamentNetwork({
      trails: completedTrails,
      arch: architecture.arch,
      curveSamples: growth.curveSamples,
      params: branchParamsFrom(params),
    })
  }, [networkMode, completedTrails, branchGeomKey, architecture, growth, params])

  const geomParams = useMemo(
    () => ({
      ornamentThickness: params.ornamentThickness ?? 0.032,
      taperStrength: params.taperStrength ?? 0.72,
      branchThicknessDecay: params.branchThicknessDecay ?? 0.68,
      radialResolution: params.radialResolution ?? 12,
      curveResolution: params.curveResolution ?? 0.55,
      profileType: params.profileType ?? 'leaf',
      profileWidth: params.profileWidth ?? 1.4,
      profileDepth: params.profileDepth ?? 0.58,
      flutingStrength: params.flutingStrength ?? 0.48,
      profileTransition: params.profileTransition ?? 0.58,
      reliefDepth: params.reliefDepth ?? 0.016,
      reliefProjection: params.reliefProjection ?? params.reliefDepth ?? 0.018,
      sculptureMode: params.sculptureMode ?? 'surface',
      tipCurl: params.tipCurl ?? 0.55,
      attachmentStrength: params.attachmentStrength ?? 0.88,
      surfaceConformity: params.surfaceConformity ?? 0.72,
      rootEmbedding: params.rootEmbedding ?? 0.014,
      sculpturalEmergence: params.sculpturalEmergence ?? 0.52,
      transitionLength: params.transitionLength ?? 0.55,
      arch: architecture.arch,
      specimen: architecture.specimen,
    }),
    [
      params.ornamentThickness,
      params.taperStrength,
      params.branchThicknessDecay,
      params.radialResolution,
      params.curveResolution,
      params.profileType,
      params.profileWidth,
      params.profileDepth,
      params.flutingStrength,
      params.profileTransition,
      params.reliefDepth,
      params.reliefProjection,
      params.sculptureMode,
      params.tipCurl,
      params.attachmentStrength,
      params.surfaceConformity,
      params.rootEmbedding,
      params.sculpturalEmergence,
      params.transitionLength,
      architecture.arch,
      architecture.specimen,
    ],
  )

  const debugFlags = useMemo(
    () => ({
      showAttachmentPoints: !!params.showAttachmentPoints,
      showSurfaceNormals: !!params.showSurfaceNormals,
      showAttachmentFrames: !!params.showAttachmentFrames,
      showReliefTransitions: !!params.showReliefTransitions,
    }),
    [
      params.showAttachmentPoints,
      params.showSurfaceNormals,
      params.showAttachmentFrames,
      params.showReliefTransitions,
    ],
  )

  // Shared playback clock — rebuild when geometry changes; reschedule on timing-only changes.
  useEffect(() => {
    if (!networkMode || !branchNetwork) {
      branchPlaybackRef.current = null
      setBranchStats(null)
      return undefined
    }
    const playback = createGrowthPlayback(branchNetwork, branchParamsFrom(settings))
    branchPlaybackRef.current = playback
    setBranchStats(playback.getStats())
    setPlaybackEpoch((e) => e + 1)
    return () => {
      branchPlaybackRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networkMode, branchNetwork, branchGeomKey])

  useEffect(() => {
    const playback = branchPlaybackRef.current
    if (!playback || !networkMode) return
    playback.reschedule(branchParamsFrom(settings))
    setBranchStats(playback.getStats())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchTimingKey, networkMode])

  const onSimStartPause = () => {
    if (networkMode) {
      const playback = branchPlaybackRef.current
      if (!playback) return
      playback.toggle()
      setBranchStats(playback.getStats())
      return
    }
    const sim = simRef.current
    if (!sim || sim.state.finished) return
    sim.toggle()
    setSimStats(sim.getStats())
  }

  const onSimReset = () => {
    if (networkMode) {
      const playback = branchPlaybackRef.current
      if (!playback) return
      playback.reset()
      setBranchStats(playback.getStats())
      setPlaybackEpoch((e) => e + 1)
      return
    }
    const sim = createParticleSimulation({
      arch: architecture.arch,
      anchors: growth.anchors,
      params: simParamsFrom(settings),
    })
    simRef.current = sim
    setSimStats(sim.getStats())
    setSimEpoch((e) => e + 1)
  }

  const onSimRegenerate = () => {
    const nextSeed = settings.growthSeed >= 99 ? 1 : settings.growthSeed + 1
    const keepMode =
      settings.displayMode === 'branching' || settings.displayMode === 'geometry'
        ? settings.displayMode
        : 'trails'
    const nextSettings = {
      ...settings,
      growthSeed: nextSeed,
      displayMode: keepMode,
    }
    setSettings(nextSettings)
  }

  const onTimelineScrub = (t) => {
    const playback = branchPlaybackRef.current
    if (!playback) return
    playback.pause()
    playback.setTime(t)
    setBranchStats(playback.getStats())
  }

  const preset = presetById(settings.activePreset ?? 'geo-twin-trefoil')
  const layout = architecture.arch?.layout
  const targetY = layout ? layout.H * 0.48 : 2.8
  const stats = growth.stats
  const bStats = branchStats

  const stone = {
    color: params.stoneColor ?? '#c4bfb4',
    roughness: params.stoneRoughness ?? 0.78,
    variation: params.surfaceVariation ?? 0.25,
  }

  return (
    <section className="gothic-lab ornament-lab" aria-labelledby="ornament-lab-title">
      <Canvas
        className="viewport"
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
        shadows
        resize={{ debounce: 0 }}
      >
        <PerspectiveCamera makeDefault position={[3.6, 3.0, 7.2]} fov={36} />
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#f0ebe3', '#101010', 0.42]} />
        <ambientLight intensity={0.16} />
        <directionalLight
          position={[6, 10, 5]}
          intensity={geometry ? 1.55 : 1.35}
          color="#f5f0e6"
          castShadow={displayMode === 'architecture'}
        />
        <directionalLight position={[-5, 3, 4]} intensity={geometry ? 0.48 : 0.38} color="#ddd6c8" />
        <OrnamentScene
          key={`scene-${simEpoch}-${playbackEpoch}`}
          specimen={architecture.specimen}
          anchors={growth.anchors}
          curveSamples={growth.curveSamples}
          displayMode={displayMode}
          showArchitecture={
            geometry
              ? settings.showOrnamentArchitecture !== false
              : branching
                ? settings.showBranchArchitecture !== false
                : settings.showArchitecture !== false
          }
          diagnosticDensity={settings.diagnosticDensity}
          suitabilityThreshold={settings.suitabilityThreshold ?? 0}
          stone={stone}
          simRef={simRef}
          showParticleHeads={settings.showParticleHeads !== false}
          distinguishGrowthSegments={settings.distinguishGrowthSegments !== false}
          showPrimarySecondary={settings.showPrimarySecondary !== false}
          showGrowthEnvelope={!!settings.showGrowthEnvelope}
          showOccupancy={!!settings.showOccupancy}
          trailOpacity={settings.trailOpacity ?? 0.85}
          trailThickness={settings.trailThickness ?? 1.5}
          onSimStats={onSimStats}
          branchPlaybackRef={branchPlaybackRef}
          showBranchPrimary={settings.showBranchPrimary !== false}
          showBranchSecondary={settings.showBranchSecondary !== false}
          showGrowingTips={settings.showGrowingTips !== false}
          showGrowthOrigins={!!settings.showGrowthOrigins}
          showMasterPaths={settings.showMasterPaths !== false}
          showMirroredPaths={settings.showMirroredPaths !== false}
          showMotifOrigins={!!settings.showMotifOrigins}
          showSymmetryAxis={!!settings.showSymmetryAxis}
          onBranchStats={onBranchStats}
          geomParams={geomParams}
          ornamentMaterialMode={settings.ornamentMaterialMode ?? 'stone'}
          showCurveSkeleton={!!settings.showCurveSkeleton}
          branchNetwork={branchNetwork}
          viewIsolation={settings.viewIsolation ?? 'combined'}
          debugFlags={debugFlags}
        />
        <gridHelper args={[20, 20, '#2a2a2a', '#1a1a1a']} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, targetY, 0]}
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={40}
        />
      </Canvas>

      <h2 id="ornament-lab-title" className="voxel-lab-title">
        Ornament System
      </h2>

      <aside className="shader-status gothic-status" aria-label="Ornament system status">
        <nav className="growth-studies gothic-display" aria-label="Display mode">
          {ORNAMENT_DISPLAY_MODES.map((mode) => (
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
          {geometry ? (
            <>
              Attach <span>→</span> Embed <span>→</span> Relief <span>→</span> Sculpture
            </>
          ) : branching ? (
            <>
              Trails <span>→</span> Compose <span>→</span> L-system <span>→</span> Mirror
            </>
          ) : trails ? (
            <>
              Anchors <span>→</span> Particles <span>→</span> Trails <span>→</span> Paths
            </>
          ) : (
            <>
              Architecture <span>→</span> Features <span>→</span> Anchors <span>→</span> Field
            </>
          )}
        </p>

        <Row label="Source" value="Tracery Window" />
        <Row label="Preset" value={preset.label} />
        <Row
          label="Family"
          value={(stats.family ?? settings.traceryFamily ?? '—').replace(/^\w/, (c) => c.toUpperCase())}
        />
        <Row label="Mode" value={ORNAMENT_DISPLAY_MODES.find((m) => m.id === displayMode)?.label} />

        {networkMode && bStats ? (
          <>
            <Row
              label="Sim time"
              value={`${(bStats.time ?? 0).toFixed(2)} / ${(bStats.duration ?? 12).toFixed(1)}s`}
            />
            <Row
              label="State"
              value={bStats.finished ? 'finished' : bStats.running ? 'running' : 'paused'}
            />
            {geometry ? (
              <>
                <Row label="Ornament meshes" value={String(bStats.ornamentMeshes ?? 0)} />
                <Row label="Ornament triangles" value={String(bStats.ornamentTriangles ?? 0)} />
                <Row
                  label="Primary / secondary"
                  value={`${bStats.primaryMeshCount ?? 0} / ${bStats.secondaryMeshCount ?? 0}`}
                />
                <Row
                  label="Visible growth"
                  value={`${(bStats.visibleGrowthPercent ?? 0).toFixed(1)}%`}
                />
                <Row
                  label="Visible tris"
                  value={String(bStats.visibleOrnamentTriangles ?? 0)}
                />
                <Row
                  label="Profile"
                  value={(bStats.profileType ?? settings.profileType ?? '—').toString()}
                />
                <Row
                  label="Sculpture"
                  value={(bStats.sculptureMode ?? settings.sculptureMode ?? '—').toString()}
                />
                <Row
                  label="Attachments"
                  value={`${bStats.validAttachments ?? 0} ok / ${bStats.invalidAttachments ?? 0} miss`}
                />
              </>
            ) : (
              <>
                <Row label="Primary tips" value={String(bStats.activePrimaryTips ?? 0)} />
                <Row label="Secondary tips" value={String(bStats.activeSecondaryTips ?? 0)} />
              </>
            )}
            <Row label="Waiting" value={String(bStats.waitingBranches ?? 0)} />
            <Row label="Growing" value={String(bStats.growingBranches ?? 0)} />
            <Row label="Completed" value={String(bStats.completedBranches ?? 0)} />
            <Row label="Branches" value={String(bStats.branchCount ?? 0)} />
            <Row
              label="By gen"
              value={`0:${bStats.byGeneration?.[0] ?? 0} · 1:${bStats.byGeneration?.[1] ?? 0} · 2:${bStats.byGeneration?.[2] ?? 0} · 3:${bStats.byGeneration?.[3] ?? 0}`}
            />
            <Row
              label="Timeline"
              value={
                bStats.stretchTimeline !== false
                  ? `stretch ×${(bStats.stretch ?? 1).toFixed(2)}`
                  : `natural ${(bStats.naturalEnd ?? 0).toFixed(1)}s`
              }
            />
            <Row
              label="Composition"
              value={(bStats.compositionMode ?? settings.compositionMode ?? '—').toString()}
            />
            <Row
              label="Master / mirror"
              value={`${bStats.masterCount ?? '—'} / ${bStats.mirrorCount ?? '—'}`}
            />
            <Row
              label="Region"
              value={(bStats.growthRegion ?? settings.growthRegion ?? '—').toString()}
            />
            <Row label="Growth seed" value={String(Math.round(settings.growthSeed))} />
          </>
        ) : trails && simStats ? (
          <>
            <Row label="Growth mode" value={simStats.growthMode} />
            <Row label="Sim time" value={`${simStats.time.toFixed(2)} / ${simStats.duration.toFixed(1)}s`} />
            <Row label="Active" value={String(simStats.activeParticles)} />
            <Row label="Terminated" value={String(simStats.terminatedParticles)} />
            <Row label="Trails" value={String(simStats.totalTrailCount)} />
            <Row label="Trail length" value={simStats.totalTrailLength.toFixed(2)} />
            <Row label="Avg trail" value={simStats.averageTrailLength.toFixed(2)} />
            <Row
              label="Primary / sec"
              value={`${(simStats.avgPrimaryLength ?? 0).toFixed(2)} / ${(simStats.avgSecondaryLength ?? 0).toFixed(2)}`}
            />
            <Row
              label="Path budget"
              value={`P ${(simStats.primaryBudget ?? 0).toFixed(1)} · S ${(simStats.secondaryBudget ?? 0).toFixed(1)}`}
            />
            <Row
              label="Segments"
              value={`c ${simStats.constrainedPoints ?? 0} · f ${simStats.freePoints ?? 0}`}
            />
            <Row label="Accepted segs" value={String(simStats.acceptedSegments ?? 0)} />
            <Row label="Rejected growth" value={String(simStats.rejectedGrowth ?? 0)} />
            <Row label="Occupancy ends" value={String(simStats.occupancyTerminations ?? 0)} />
            <Row
              label="Avg arch dist"
              value={(simStats.averageArchDistance ?? 0).toFixed(3)}
            />
            <Row label="Ended by" value={formatTermReasons(simStats.terminationByReason)} />
            <Row label="Growth seed" value={String(simStats.growthSeed)} />
            <Row
              label="State"
              value={simStats.finished ? 'finished' : simStats.running ? 'running' : 'paused'}
            />
          </>
        ) : (
          <>
            <Row label="Features" value={String(stats.featureCount)} />
            <Row label="Junctions" value={String(stats.junctionCount)} />
            <Row label="Candidates" value={String(stats.candidateCount)} />
            <Row label="Anchors" value={String(stats.activeAnchorCount)} />
            <Row
              label="Suitability"
              value={`${stats.minSuitability?.toFixed(2) ?? '—'}–${stats.maxSuitability?.toFixed(2) ?? '—'} · avg ${stats.averageSuitability.toFixed(3)}`}
            />
            <Row label="Arch seed" value={String(Math.round(settings.variationSeed ?? 3))} />
            <Row label="Growth seed" value={String(stats.growthSeed)} />
            {displayMode === 'suitability' ? (
              <Row
                label="Above threshold"
                value={String(
                  growth.anchors.filter((a) => a.suitability >= (settings.suitabilityThreshold ?? 0))
                    .length,
                )}
              />
            ) : null}
            {displayMode === 'suitability' ? <SuitabilityLegend /> : null}
          </>
        )}

        <p className="shader-brief">{MODE_NOTES[displayMode]}</p>
        <p className="shader-brief">
          {geometry
            ? 'Sculptural profiles along the composed network. Meshes cached; growth via draw ranges.'
            : 'Reuses buildWindow. Branching shows curves; Ornament Geometry sweeps sculptural solids.'}
        </p>
      </aside>

      <OrnamentSystemPanel
        settings={settings}
        onChange={setSettings}
        simRunning={networkMode ? !!branchStats?.running : !!simStats?.running}
        simFinished={networkMode ? !!branchStats?.finished : !!simStats?.finished}
        onSimStartPause={onSimStartPause}
        onSimReset={onSimReset}
        onSimRegenerate={onSimRegenerate}
        timelineTime={branchStats?.time ?? 0}
        timelineDuration={branchStats?.duration ?? settings.simulationDuration ?? 12}
        onTimelineScrub={networkMode ? onTimelineScrub : undefined}
      />
    </section>
  )
}
