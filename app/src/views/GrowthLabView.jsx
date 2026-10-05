import { useDeferredValue, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import GrowthLabPanel from '../ui/GrowthLabPanel.jsx'
import GrowthScene from '../growth/GrowthScene.jsx'
import { createFacade } from '../growth/facade.js'
import {
  buildSampler,
  evaluateSuitability,
  measureArchitecture,
  sampleCandidates,
  selectAnchors,
  timed,
} from '../growth/distribution.js'
import { createSurface } from '../growth/surface.js'
import { createPathContext, growPaths, primaryAnchors, projectionStudy } from '../growth/paths.js'
import { createFieldCache, updateCurl } from '../growth/field.js'
import { createEmitters } from '../growth/particles.js'
import {
  ANCHOR_STYLE,
  DEFAULT_DISTRIBUTION,
  DEFAULT_FIELD,
  DEFAULT_PATHS,
  DISTRIBUTION_MODES,
  GROWTH_STUDIES,
  MODE_NOTES,
  FIELD_NOTE,
  PATH_NOTE,
} from '../growth/settings.js'

function createLab() {
  const facade = createFacade()
  const surface = createSurface(facade)
  const pathContext = createPathContext(facade, surface)
  // The field grid costs a few hundred ms, so it is built on first use and kept.
  let fieldCache = null
  const getFieldCache = () => {
    fieldCache ??= createFieldCache(facade, surface, pathContext.segments)
    return fieldCache
  }
  return { facade, sampler: buildSampler(facade), pathContext, surface, getFieldCache }
}

function Row({ label, value }) {
  return (
    <div className="telemetry-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export default function GrowthLabView() {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_DISTRIBUTION, ...DEFAULT_PATHS, ...DEFAULT_FIELD }))
  const [{ facade, sampler, pathContext, surface, getFieldCache }] = useState(createLab)
  const params = useDeferredValue(settings)
  const isPaths = settings.study === 'paths'
  const isField = settings.study === 'field'

  const sampled = useMemo(
    () =>
      timed(() => {
        const candidates = sampleCandidates(facade, sampler, params.candidateCount, params.seed)
        return { candidates, measures: measureArchitecture(facade, candidates) }
      }),
    [facade, sampler, params.candidateCount, params.seed],
  )
  const { candidates, measures } = sampled.value

  const evaluated = useMemo(
    () =>
      timed(() =>
        evaluateSuitability(candidates, measures, {
          mode: params.mode,
          seed: params.seed,
          noiseScale: params.noiseScale,
          heightBias: params.heightBias,
          featureAttraction: params.featureAttraction,
          orientationBias: params.orientationBias,
        }),
      ),
    [
      candidates,
      measures,
      params.mode,
      params.seed,
      params.noiseScale,
      params.heightBias,
      params.featureAttraction,
      params.orientationBias,
    ],
  )
  const suitability = evaluated.value

  const selected = useMemo(
    () =>
      timed(() =>
        selectAnchors(candidates, measures, suitability, {
          mode: params.mode,
          seed: params.seed,
          density: params.density,
          noiseThreshold: params.noiseThreshold,
        }),
      ),
    [candidates, measures, suitability, params.mode, params.seed, params.density, params.noiseThreshold],
  )
  const selection = selected.value

  const pathsActive = params.study !== 'distribution'
  const fieldActive = params.study === 'field'
  const grown = useMemo(() => {
    if (!pathsActive) return null
    return timed(() => {
      const primaries = primaryAnchors(candidates, selection, suitability)
      const { paths, used } = growPaths(pathContext, candidates, primaries, {
        seed: params.seed,
        pathCount: params.pathCount,
        pathLength: params.pathLength,
        verticalGrowth: params.verticalGrowth,
        pathFeature: params.pathFeature,
        organicDrift: params.organicDrift,
        curvature: params.curvature,
        branchProbability: params.branchProbability,
      })
      return { primaries, paths, used }
    })
  }, [
    pathsActive,
    pathContext,
    candidates,
    selection,
    suitability,
    params.seed,
    params.pathCount,
    params.pathLength,
    params.verticalGrowth,
    params.pathFeature,
    params.organicDrift,
    params.curvature,
    params.branchProbability,
  ])
  const projection = useMemo(
    () => (params.study === 'paths' ? projectionStudy(surface) : null),
    [params.study, surface],
  )

  const field = useMemo(() => {
    if (!fieldActive) return null
    return timed(() => ({
      cache: updateCurl(getFieldCache(), params.fieldScale, params.seed),
      emitters: createEmitters(candidates, selection.classes),
    }))
  }, [fieldActive, getFieldCache, params.fieldScale, params.seed, candidates, selection])

  const result = { candidates, suitability, selection }
  const meanSuitability = useMemo(() => {
    let sum = 0
    for (let i = 0; i < suitability.length; i += 1) sum += suitability[i]
    return suitability.length ? sum / suitability.length : 0
  }, [suitability])
  const computeMs = sampled.ms + evaluated.ms + selected.ms
  const modeLabel = DISTRIBUTION_MODES.find((item) => item.id === settings.mode)?.label

  const pathStats = useMemo(() => {
    if (!grown) return null
    const { paths } = grown.value
    const primary = paths.filter((p) => p.kind === 'primary')
    return {
      primary: primary.length,
      secondary: paths.length - primary.length,
      length: paths.reduce((sum, p) => sum + p.length, 0),
      samples: paths.reduce((sum, p) => sum + p.points.length, 0),
    }
  }, [grown])

  return (
    <section className="growth-lab" aria-labelledby="growth-lab-title">
      <Canvas className="viewport" camera={{ position: [4.6, 4.2, 12.4], fov: 38 }} gl={{ antialias: true }}>
        <color attach="background" args={['#070707']} />
        <hemisphereLight args={['#e8e8e8', '#141414', 0.5]} />
        <ambientLight intensity={0.12} />
        <directionalLight position={[5, 9, 7]} intensity={1.2} color="#e8e8e8" />
        <directionalLight position={[-6, 3, 4]} intensity={0.25} color="#e8e8e8" />
        <GrowthScene
          facade={facade}
          result={result}
          display={settings}
          pathResult={grown?.value ?? null}
          projection={projection}
          field={field?.value ?? null}
        />
        <gridHelper args={[14, 14, '#2a2a2a', '#1a1a1a']} />
        <OrbitControls
          makeDefault
          target={[0, 3.3, 0]}
          enableDamping
          dampingFactor={0.08}
          minDistance={3}
          maxDistance={30}
        />
      </Canvas>

      <h2 id="growth-lab-title" className="voxel-lab-title">
        Growth Lab
      </h2>

      <aside className="shader-status growth-status" aria-label="Growth lab status">
        <nav className="growth-studies" aria-label="Growth studies">
          {GROWTH_STUDIES.map((study) => (
            <button
              key={study.id}
              type="button"
              className={study.id === settings.study ? 'is-active' : ''}
              disabled={!study.ready}
              title={study.ready ? study.label : 'Not implemented yet'}
              onClick={() => setSettings((current) => ({ ...current, study: study.id }))}
            >
              <span>{study.index}</span>
              {study.ready ? study.label : '—'}
            </button>
          ))}
        </nav>

        {isField ? (
          <>
            <p className="growth-pipeline">
              Anchors <span>→</span> Field <span>→</span> Trails <span>→</span> Potential paths
            </p>
            <Row
              label="Emitters P / S"
              value={field ? `${field.value.emitters.primaryCount} / ${field.value.emitters.count - field.value.emitters.primaryCount}` : '—'}
            />
            <Row label="Particles" value={settings.particleCount.toLocaleString('en-US')} />
            <Row
              label="Trail vertices"
              value={(settings.particleCount * settings.trailLength).toLocaleString('en-US')}
            />
            <Row
              label="Field grid"
              value={field ? `${field.value.cache.nx}×${field.value.cache.ny}×${field.value.cache.nz}` : '—'}
            />
            <Row label="Field update" value={field ? `${Math.round(field.ms)} ms` : '—'} />
            <Row label="State" value={settings.paused ? 'Paused' : 'Running'} />
            <div className="growth-legend">
              <div className="growth-key">
                <i className="growth-mark growth-mark-primary" aria-hidden="true" />
                <span>Emitter</span>
                <span>Primary ×3, secondary ×1</span>
              </div>
              <div className="growth-key">
                <i className="growth-line growth-line-primary" aria-hidden="true" />
                <span>Spline</span>
                <span>Designed path (02)</span>
              </div>
              <div className="growth-key">
                <i className="growth-line growth-line-trail" aria-hidden="true" />
                <span>Trail</span>
                <span>Emergent path (03)</span>
              </div>
            </div>
            <p className="shader-brief">{FIELD_NOTE}</p>
          </>
        ) : isPaths ? (
          <>
            <p className="growth-pipeline">
              Architecture <span>→</span> Distribution <span>→</span> Anchors <span>→</span> Paths
            </p>
            <Row label="Primary anchors" value={grown ? grown.value.primaries.length : '—'} />
            <Row label="Paths / branches" value={pathStats ? `${pathStats.primary} / ${pathStats.secondary}` : '—'} />
            <Row label="Total length" value={pathStats ? pathStats.length.toFixed(1) : '—'} />
            <Row label="Spline samples" value={pathStats ? pathStats.samples.toLocaleString('en-US') : '—'} />
            <Row label="Projection" value="2D plane → −Z → surface" />
            <Row label="Compute" value={grown ? `${Math.round(grown.ms)} ms` : '—'} />
            <div className="growth-legend">
              <div className="growth-key">
                <i className="growth-mark growth-mark-primary" aria-hidden="true" />
                <span>Anchor</span>
                <span>Primary, path start</span>
              </div>
              <div className="growth-key">
                <i className="growth-line growth-line-primary" aria-hidden="true" />
                <span>Primary</span>
                <span>Main stem, tapering</span>
              </div>
              <div className="growth-key">
                <i className="growth-line growth-line-secondary" aria-hidden="true" />
                <span>Secondary</span>
                <span>Branch, 0–2 per path</span>
              </div>
            </div>
            <p className="shader-brief">{PATH_NOTE}</p>
          </>
        ) : (
          <>
            <p className="growth-pipeline">
              Sample <span>→</span> Evaluate <span>→</span> Select <span>→</span> Classify
            </p>
            <Row label="Mode" value={modeLabel} />
            <Row label="Candidates" value={candidates.count.toLocaleString('en-US')} />
            <Row label="Mean suitability" value={meanSuitability.toFixed(2)} />
            <Row label="Accepted" value={selection.accepted.toLocaleString('en-US')} />
            <Row
              label="Primary / Sec / Term"
              value={`${selection.counts.primary} / ${selection.counts.secondary} / ${selection.counts.terminal}`}
            />
            <Row label="Compute" value={`${Math.round(computeMs)} ms`} />
            <div className="growth-legend">
              <div className="growth-ramp" aria-hidden="true" />
              <div className="growth-ramp-labels">
                <span>Suitability 0</span>
                <span>1</span>
              </div>
              {Object.entries(ANCHOR_STYLE).map(([id, style]) => (
                <div key={id} className="growth-key">
                  <i className={`growth-mark growth-mark-${id}`} aria-hidden="true" />
                  <span>{style.label}</span>
                  <span>{style.note}</span>
                </div>
              ))}
            </div>
            <p className="shader-brief">{MODE_NOTES[settings.mode]}</p>
          </>
        )}
      </aside>

      <GrowthLabPanel settings={settings} onChange={setSettings} />
    </section>
  )
}
