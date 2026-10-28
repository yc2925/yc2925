import { useDeferredValue, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import AgentSystemPanel from '../ui/AgentSystemPanel.jsx'
import AgentScene from '../agents/AgentScene.jsx'
import { DEFAULT_AGENTS, AGENT_STATE_COLORS } from '../agents/settings.js'
import { buildOrnamentArchitecture } from '../ornament/source.js'
import { generateGrowthConditions } from '../ornament/conditions.js'
import { createAgentSimulation } from '../agents/simulation.js'
import { compareSnapshots } from '../agents/compareMetrics.js'
import {
  buildConstructionFromSim,
  constructionFingerprint,
  disposeConstruction,
} from '../agents/ornamentConstruction.js'
import { presetById } from '../gothic/typologies/presets.js'
import ScaleReference from '../scale/ScaleReference.jsx'
import FitCamera from '../scale/FitCamera.jsx'
import { resolveAgentVizParams, LOD_LABELS } from '../lod/index.js'
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

function StateLegend() {
  return (
    <div className="agent-state-legend" aria-label="Agent state legend">
      {Object.entries(AGENT_STATE_COLORS).map(([id, color]) => (
        <span key={id} className="agent-legend-item">
          <i style={{ background: color }} />
          {id}
        </span>
      ))}
    </div>
  )
}

function FieldLegend() {
  return (
    <div className="agent-state-legend" aria-label="Field intensity legend">
      <span className="agent-legend-item">
        <i style={{ background: '#2e2e2e' }} />
        low
      </span>
      <span className="agent-legend-item">
        <i style={{ background: '#a31318' }} />
        mid
      </span>
      <span className="agent-legend-item">
        <i style={{ background: '#ff2020' }} />
        high
      </span>
    </div>
  )
}

function baseSimParams(params, stigmergyOn) {
  return {
    ...params,
    enableAgentSimulation: params.enableAgentSimulation !== false,
    enableStigmergy: stigmergyOn,
    showFullTrailHistory: !!params.showFullTrailHistory,
  }
}

export default function AgentSimulationView() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_AGENTS }))
  const params = useDeferredValue(settings)
  const controlsRef = useRef(null)
  const simRef = useRef(null)
  const simOffRef = useRef(null)
  const simOnRef = useRef(null)
  const constructionRef = useRef(null)
  const constructionFpRef = useRef('')
  const [stats, setStats] = useState(null)
  const [statsOff, setStatsOff] = useState(null)
  const [statsOn, setStatsOn] = useState(null)
  const [compareSnap, setCompareSnap] = useState(null)
  const [constructionStats, setConstructionStats] = useState(null)
  const [simEpoch, setSimEpoch] = useState(0)
  const [running, setRunning] = useState(false)
  const [activeLod, setActiveLod] = useState('high')
  const [lodMetrics, setLodMetrics] = useState(null)
  const [fps, setFps] = useState(0)

  const comparison = !!params.comparisonMode
  const vizLod = useMemo(() => resolveAgentVizParams(activeLod), [activeLod])
  const onLodChange = useCallback((level, ev) => {
    setActiveLod(level)
    setLodMetrics(ev)
  }, [])
  const onLodMetrics = useCallback((ev) => setLodMetrics(ev), [])

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

  useEffect(
    () => () => {
      architecture.dispose?.()
    },
    [architecture],
  )

  const growth = useMemo(
    () =>
      generateGrowthConditions(architecture.arch, {
        ...params,
        growthSeed: params.growthSeed ?? 11,
        anchorCount: params.anchorCount ?? 100,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [architecture, params.growthSeed, params.anchorCount, params.spawnThreshold],
  )

  const simKey = useMemo(
    () =>
      JSON.stringify({
        agentCount: params.agentCount,
        agentSeed: params.agentSeed,
        energyBudget: params.energyBudget,
        sensingRadius: params.sensingRadius,
        movementSpeed: params.movementSpeed,
        bilateralSymmetry: params.bilateralSymmetry,
        spawnThreshold: params.spawnThreshold,
        enableAgentSimulation: params.enableAgentSimulation,
        comparisonMode: params.comparisonMode,
        archKey,
      }),
    [params, archKey],
  )

  useEffect(() => {
    if (comparison) {
      const off = createAgentSimulation({
        arch: architecture.arch,
        anchors: growth.anchors,
        params: baseSimParams(params, false),
      })
      const on = createAgentSimulation({
        arch: architecture.arch,
        anchors: growth.anchors,
        params: baseSimParams(params, true),
      })
      simOffRef.current = off
      simOnRef.current = on
      simRef.current = on
      setStatsOff(off.getStats())
      setStatsOn(on.getStats())
      setStats(on.getStats())
      setCompareSnap({
        off: off.getCompareSnapshot(),
        on: on.getCompareSnapshot(),
      })
    } else {
      const sim = createAgentSimulation({
        arch: architecture.arch,
        anchors: growth.anchors,
        params: baseSimParams(params, params.enableStigmergy !== false),
      })
      simRef.current = sim
      simOffRef.current = null
      simOnRef.current = null
      setStats(sim.getStats())
      setStatsOff(null)
      setStatsOn(null)
      setCompareSnap(null)
    }
    disposeConstruction(constructionRef.current)
    constructionRef.current = null
    constructionFpRef.current = ''
    setConstructionStats(null)
    setRunning(false)
    setSimEpoch((e) => e + 1)
    return () => {
      disposeConstruction(constructionRef.current)
      constructionRef.current = null
      simRef.current = null
      simOffRef.current = null
      simOnRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simKey, growth, comparison])

  const constructionParamKey = useMemo(
    () =>
      JSON.stringify({
        enable: params.enableOrnamentConstruction,
        pathAcceptanceThreshold: params.pathAcceptanceThreshold,
        ornamentDensity: params.ornamentDensity,
        branchComplexity: params.branchComplexity,
        primaryThickness: params.primaryThickness,
        secondaryThickness: params.secondaryThickness,
        constructionReliefDepth: params.constructionReliefDepth,
        constructionEmergence: params.constructionEmergence,
        foliateDetail: params.foliateDetail,
        bilateralSymmetry: params.bilateralSymmetry,
        enableStigmergy: params.enableStigmergy,
      }),
    [params],
  )

  const applyRevealOnly = useCallback((sim) => {
    const pack = constructionRef.current
    if (!pack?.stats) return
    const t = sim?.state?.time ?? 0
    const branches = pack.network?.branches ?? []
    if (!branches.length) return
    let sum = 0
    for (const b of branches) {
      const birth = b.birthTime ?? 0
      const dur = Math.max(0.2, b.growthDuration ?? 0.8)
      sum += Math.max(0, Math.min(1, (t - birth) / dur))
    }
    const growthCompletion = sum / branches.length
    setConstructionStats((prev) =>
      prev ? { ...prev, growthCompletion } : { growthCompletion },
    )
  }, [])

  const rebuildConstruction = useCallback(
    (force = false) => {
      if (comparison || !params.enableOrnamentConstruction) {
        disposeConstruction(constructionRef.current)
        constructionRef.current = null
        constructionFpRef.current = ''
        setConstructionStats(null)
        return
      }
      const sim = simRef.current
      if (!sim) return
      const fp = constructionFingerprint(sim)
      if (!force && fp === constructionFpRef.current && constructionRef.current) {
        applyRevealOnly(sim)
        return
      }
      disposeConstruction(constructionRef.current)
      const pack = buildConstructionFromSim(sim, architecture.arch, {
        ...params,
        specimen: architecture.specimen,
        reliefDepth: params.constructionReliefDepth,
        sculpturalEmergence: params.constructionEmergence,
      })
      constructionRef.current = pack
      constructionFpRef.current = fp
      setConstructionStats(pack.stats)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [comparison, params, architecture, constructionParamKey, applyRevealOnly],
  )

  useEffect(() => {
    rebuildConstruction(true)
  }, [constructionParamKey, simEpoch, rebuildConstruction])

  useEffect(() => {
    const patch = {
      simulationSpeed: params.simulationSpeed,
      enableAgentSimulation: params.enableAgentSimulation !== false,
      showAgentTrails: params.showAgentTrails,
      trailMaxPoints: params.trailMaxPoints,
      showFullTrailHistory: !!params.showFullTrailHistory,
      attractionStrength: params.attractionStrength,
      inhibitionStrength: params.inhibitionStrength,
      depositionRate: params.depositionRate,
      depositionRadius: params.depositionRadius,
      signalDecay: params.signalDecay,
      signalDiffusion: params.signalDiffusion,
      explorationBias: params.explorationBias,
    }
    if (comparison) {
      simOffRef.current?.setParams({ ...patch, enableStigmergy: false })
      simOnRef.current?.setParams({ ...patch, enableStigmergy: true })
    } else {
      simRef.current?.setParams({
        ...patch,
        enableStigmergy: params.enableStigmergy !== false,
      })
    }
  }, [
    comparison,
    params.simulationSpeed,
    params.enableAgentSimulation,
    params.showAgentTrails,
    params.trailMaxPoints,
    params.showFullTrailHistory,
    params.enableStigmergy,
    params.attractionStrength,
    params.inhibitionStrength,
    params.depositionRate,
    params.depositionRadius,
    params.signalDecay,
    params.signalDiffusion,
    params.explorationBias,
  ])

  const syncCompareSnap = () => {
    if (!comparison || !simOffRef.current || !simOnRef.current) return
    setCompareSnap({
      off: simOffRef.current.getCompareSnapshot(),
      on: simOnRef.current.getCompareSnapshot(),
    })
  }

  const onStartPause = () => {
    if (comparison) {
      const off = simOffRef.current
      const on = simOnRef.current
      if (!off || !on) return
      off.toggle()
      on.state.running = off.state.running
      setRunning(off.state.running)
      setStatsOff(off.getStats())
      setStatsOn(on.getStats())
      syncCompareSnap()
      return
    }
    const sim = simRef.current
    if (!sim) return
    sim.toggle()
    setRunning(sim.state.running)
    setStats(sim.getStats())
  }

  const onReset = () => {
    if (comparison) {
      simOffRef.current?.reset()
      simOnRef.current?.reset()
      setRunning(false)
      setStatsOff(simOffRef.current?.getStats() ?? null)
      setStatsOn(simOnRef.current?.getStats() ?? null)
      syncCompareSnap()
      setSimEpoch((e) => e + 1)
      return
    }
    const sim = simRef.current
    if (!sim) return
    sim.reset()
    setRunning(false)
    setStats(sim.getStats())
    disposeConstruction(constructionRef.current)
    constructionRef.current = null
    constructionFpRef.current = ''
    setConstructionStats(null)
    setSimEpoch((e) => e + 1)
  }

  const onStep = () => {
    if (comparison) {
      simOffRef.current?.stepOnce()
      simOnRef.current?.stepOnce()
      setStatsOff(simOffRef.current?.getStats() ?? null)
      setStatsOn(simOnRef.current?.getStats() ?? null)
      syncCompareSnap()
      return
    }
    const sim = simRef.current
    if (!sim) return
    sim.stepOnce()
    setStats(sim.getStats())
  }

  const onRegenerate = () => {
    setSettings((s) => ({
      ...s,
      agentSeed: (s.agentSeed ?? 42) + 1,
    }))
  }

  const lastConstructStepRef = useRef(-999)

  const onStats = useCallback(
    (s) => {
      setStats(s)
      setRunning(!!s.running)
      if (params.enableOrnamentConstruction && !comparison) {
        const sim = simRef.current
        if (!sim) return
        const step = sim.state.stepCount ?? 0
        // Rebuild meshes at most every ~15 fixed steps — not every trail sample
        if (step - lastConstructStepRef.current >= 15) {
          const fp = constructionFingerprint(sim)
          if (fp !== constructionFpRef.current) {
            lastConstructStepRef.current = step
            rebuildConstruction(false)
            return
          }
        }
        applyRevealOnly(sim)
      }
    },
    [params.enableOrnamentConstruction, comparison, rebuildConstruction, applyRevealOnly],
  )

  const onStatsOff = useCallback((s) => {
    setStatsOff(s)
    setRunning(!!s.running)
  }, [])

  const onStatsOn = useCallback((s) => {
    setStatsOn(s)
    if (simOffRef.current && simOnRef.current) {
      setCompareSnap({
        off: simOffRef.current.getCompareSnapshot(),
        on: simOnRef.current.getCompareSnapshot(),
      })
    }
  }, [])

  const stone = useMemo(
    () => ({
      color: params.stoneColor,
      roughness: params.stoneRoughness,
      variation: params.surfaceVariation,
    }),
    [params.stoneColor, params.stoneRoughness, params.surfaceVariation],
  )

  const targetY = architecture.arch?.bounds?.y1
    ? architecture.arch.bounds.y1 * 0.45
    : 2.2
  const preset = presetById(params.activePreset)
  const delta =
    compareSnap?.off && compareSnap?.on
      ? compareSnapshots(compareSnap.off, compareSnap.on)
      : null
  const fieldMode = settings.fieldDisplayMode ?? 'agents'
  const showFieldLegend = fieldMode !== 'agents' || comparison

  return (
    <section className="gothic-lab ornament-lab agent-lab" aria-labelledby="agent-lab-title">
      <Canvas
        className="viewport"
        style={{ width: '100%', height: '100%' }}
        gl={{ antialias: true }}
        shadows
        resize={{ debounce: 0 }}
      >
        <PerspectiveCamera
          makeDefault
          position={comparison ? [0, 3.2, 9.5] : [3.6, 3.0, 7.2]}
          fov={comparison ? 40 : 36}
        />
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#f0ebe3', '#101010', 0.42]} />
        <ambientLight intensity={0.2} />
        <directionalLight position={[6, 10, 5]} intensity={1.55} color="#f5f0e6" />
        <directionalLight position={[-5, 3, 4]} intensity={0.45} color="#ddd6c8" />
        <AgentScene
          key={`agents-${simEpoch}-${comparison ? 'cmp' : 'solo'}`}
          specimen={architecture.specimen}
          stone={stone}
          showArchitecture={settings.showArchitecture !== false}
          simRef={simRef}
          showTrails={settings.showAgentTrails !== false}
          showDirections={settings.showDirectionIndicators !== false}
          fieldDisplayMode={fieldMode}
          onStats={onStats}
          fullTrailHistory={!!settings.showFullTrailHistory}
          comparisonMode={comparison}
          simOffRef={simOffRef}
          simOnRef={simOnRef}
          onStatsOff={onStatsOff}
          onStatsOn={onStatsOn}
          compareFieldMode={settings.compareFieldMode ?? 'combined'}
          constructionRef={constructionRef}
          constructionDisplayMode={
            settings.enableOrnamentConstruction
              ? settings.constructionDisplayMode ?? 'agents+ornament'
              : 'agents'
          }
          arch={architecture.arch}
          vizLod={vizLod}
        />
        <ScaleReference
          width={
            (architecture.arch?.bounds?.x1 ?? 1.5) - (architecture.arch?.bounds?.x0 ?? -1.5)
          }
          height={architecture.arch?.bounds?.y1 ?? params.overallHeight ?? 5.7}
          showScaleReference={!!params.showScaleReference}
          showDimensions={!!params.showDimensions}
          showHumanReference={!!params.showHumanReference}
        />
        <gridHelper args={[24, 24, '#2a2a2a', '#1a1a1a']} />
        <FitCamera
          token={params.fitToObjectToken ?? 0}
          envelope={{
            width:
              (architecture.arch?.bounds?.x1 ?? 1.5) - (architecture.arch?.bounds?.x0 ?? -1.5),
            height: architecture.arch?.bounds?.y1 ?? params.overallHeight ?? 5.7,
          }}
          controlsRef={controlsRef}
        />
        <LodController
          bounds={architecture.arch?.bounds}
          lodMode={params.lodMode ?? 'auto'}
          enableAutoLod={params.enableAutoLod !== false}
          lodBias={params.lodBias ?? 0}
          onLodChange={onLodChange}
          onMetrics={onLodMetrics}
        />
        <LodDebug
          bounds={architecture.arch?.bounds}
          level={activeLod}
          projectedFrac={lodMetrics?.projectedFrac ?? 0}
          thresholds={lodMetrics?.thresholds}
          visible={!!params.showLodDebug}
        />
        <FpsProbe onFps={setFps} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          target={[0, targetY, 0]}
          enableDamping
          dampingFactor={0.08}
          minDistance={2}
          maxDistance={48}
        />
      </Canvas>

      {comparison ? (
        <div className="agent-compare-labels" aria-hidden>
          <span>OFF · independent</span>
          <span>ON · stigmergy</span>
        </div>
      ) : null}

      <h2 id="agent-lab-title" className="voxel-lab-title">
        Agent Simulation
      </h2>

      <aside className="shader-status gothic-status" aria-label="Agent simulation status">
        <p className="growth-pipeline">
          {comparison ? (
            <>
              Off <span>↔</span> On <span>→</span> Measure
            </>
          ) : (
            <>
              Deposit <span>→</span> Diffuse <span>→</span> Perceive <span>→</span> Decide
            </>
          )}
        </p>
        <p className="growth-note">
          {comparison
            ? 'Identical seed, architecture, and spawn — left without stigmergy, right with field coupling.'
            : 'Graph-local stigmergy on Gothic curves. State colours always on.'}
        </p>
        <Row label="Source" value="Tracery Window" />
        <Row label="Preset" value={preset?.label ?? params.activePreset ?? '—'} />
        <Row label="State" value={running ? 'running' : 'paused'} />
        <Row
          label="Sim time"
          value={`${((comparison ? statsOn?.time : stats?.time) ?? 0).toFixed(2)}s · step ${
            (comparison ? statsOn?.stepCount : stats?.stepCount) ?? 0
          }`}
        />
        <Row label="Seed" value={String(settings.agentSeed ?? 42)} />

        {!comparison ? (
          <>
            <Row label="Agents" value={String(stats?.agentCount ?? 0)} />
            <Row label="LOD" value={LOD_LABELS[activeLod] ?? activeLod} />
            <Row
              label="Proj. size"
              value={lodMetrics ? `${(lodMetrics.projectedFrac * 100).toFixed(0)}% vh` : '—'}
            />
            <Row label="FPS" value={fps ? fps.toFixed(0) : '—'} />
            <Row label="Exploring" value={String(stats?.exploring ?? 0)} />
            <Row label="Depositing" value={String(stats?.depositing ?? 0)} />
            <Row label="Building" value={String(stats?.building ?? 0)} />
            <Row label="Blocked" value={String(stats?.blocked ?? 0)} />
            <Row label="Completed" value={String(stats?.completed ?? 0)} />
            <Row label="Total deposits" value={String(stats?.totalDeposits ?? 0)} />
            <Row label="Redirected" value={String(stats?.agentsRedirected ?? 0)} />
            <Row
              label="Avg / peak attr."
              value={`${(stats?.averageAttraction ?? 0).toFixed(3)} / ${(stats?.peakAttraction ?? 0).toFixed(3)}`}
            />
            <Row
              label="Avg / peak inhib."
              value={`${(stats?.averageInhibition ?? 0).toFixed(3)} / ${(stats?.peakInhibition ?? 0).toFixed(3)}`}
            />
            <Row
              label="Occupied / peak"
              value={`${(stats?.occupiedPercent ?? 0).toFixed(1)}% / ${(stats?.peakOccupiedPercent ?? 0).toFixed(1)}%`}
            />
            {settings.enableOrnamentConstruction ? (
              <>
                <Row
                  label="Candidate paths"
                  value={String(constructionStats?.candidatePaths ?? 0)}
                />
                <Row
                  label="Accepted / rejected"
                  value={`${constructionStats?.acceptedPaths ?? 0} / ${constructionStats?.rejectedPaths ?? 0}`}
                />
                <Row
                  label="Regions hit"
                  value={String(constructionStats?.regionsHit ?? 0)}
                />
                <Row
                  label="Reject: length / overlap / curve"
                  value={`${constructionStats?.rejectionByCategory?.insufficient_length ?? 0} / ${constructionStats?.rejectionByCategory?.redundant_overlap ?? 0} / ${constructionStats?.rejectionByCategory?.excessive_curvature ?? 0}`}
                />
                <Row
                  label="Reject: field / region / other"
                  value={`${constructionStats?.rejectionByCategory?.field_inhibition ?? 0} / ${constructionStats?.rejectionByCategory?.regional_saturation ?? 0} / ${(constructionStats?.rejectionByCategory?.invalid_geometry ?? 0) + (constructionStats?.rejectionByCategory?.below_threshold ?? 0)}`}
                />
                <Row
                  label="Primary / secondary / tertiary"
                  value={`${constructionStats?.primaryStems ?? 0} / ${constructionStats?.secondaryBranches ?? 0} / ${constructionStats?.tertiaryFlourishes ?? 0}`}
                />
                <Row
                  label="Ornament meshes"
                  value={String(constructionStats?.ornamentMeshes ?? 0)}
                />
                <Row
                  label="Ornament tris"
                  value={String(constructionStats?.ornamentTriangles ?? 0)}
                />
                <Row
                  label="Growth complete"
                  value={`${((constructionStats?.growthCompletion ?? 0) * 100).toFixed(0)}%`}
                />
              </>
            ) : null}
          </>
        ) : (
          <>
            <Row
              label="Coverage OFF / ON"
              value={`${compareSnap?.off?.uniqueCoverage ?? 0} / ${compareSnap?.on?.uniqueCoverage ?? 0}`}
            />
            <Row
              label="Repeated OFF / ON"
              value={`${compareSnap?.off?.repeatedOccupancy ?? 0} / ${compareSnap?.on?.repeatedOccupancy ?? 0}`}
            />
            <Row
              label="Mean sep. OFF / ON"
              value={`${(compareSnap?.off?.meanSeparation ?? 0).toFixed(2)} / ${(compareSnap?.on?.meanSeparation ?? 0).toFixed(2)}`}
            />
            <Row
              label="Completed OFF / ON"
              value={`${compareSnap?.off?.completed ?? 0} / ${compareSnap?.on?.completed ?? 0}`}
            />
            <Row
              label="Redirected OFF / ON"
              value={`${compareSnap?.off?.redirected ?? 0} / ${compareSnap?.on?.redirected ?? 0}`}
            />
            <Row
              label="Deposits OFF / ON"
              value={`${compareSnap?.off?.totalDeposits ?? 0} / ${compareSnap?.on?.totalDeposits ?? 0}`}
            />
            <Row
              label="Building OFF / ON"
              value={`${statsOff?.building ?? 0} / ${statsOn?.building ?? 0}`}
            />
            <Row
              label="Exploring OFF / ON"
              value={`${statsOff?.exploring ?? 0} / ${statsOn?.exploring ?? 0}`}
            />
            {delta ? (
              <Row
                label="Δ coverage / sep."
                value={`${delta.uniqueCoverage >= 0 ? '+' : ''}${delta.uniqueCoverage} / ${delta.meanSeparation >= 0 ? '+' : ''}${delta.meanSeparation.toFixed(2)}`}
              />
            ) : null}
          </>
        )}

        <StateLegend />
        {showFieldLegend ? <FieldLegend /> : null}
      </aside>

      <AgentSystemPanel
        settings={settings}
        onChange={setSettings}
        running={running}
        onStartPause={onStartPause}
        onReset={onReset}
        onStep={onStep}
        onRegenerate={onRegenerate}
        activeLod={activeLod}
      />
    </section>
  )
}
