/**
 * World Outliner + context parameter panel (Step 47, feedback round 1).
 * Every control carries a tooltip (title) saying what it changes; only the
 * controls relevant to the active stage are shown.
 */

import { useState } from 'react'
import { FOCUS_GROUPS, PHASE_COLORS, PHASES, RULE_COLORS, STONE_KIND_COLORS, focusKeyFor, focusSets } from '../compose/DebugLayer.jsx'
import { PROTO } from '../lithic/protos.js'
import { SKELETON_PARAM_SPECS, ROLE_RULES } from '../skeleton/params.js'
import { LITHIC_PARAM_SPECS } from '../lithic/params.js'
import { ENVIRONMENT_SPECS, PRESENTATION_SPECS, SCAN_SPECS, TERRAIN_PARAM_SPECS, TERRAIN_SURFACE_SPECS } from '../compose/worldParams.js'
import { terrainFromNoiseLayer } from '../compose/terrain.js'
import { liftToPointedArch } from '../curves/archLift.js'

export function Outliner({ structures, ui, setUi, dispatch }) {
  return (
    <div className="world-outliner">
      <div className="world-outliner-head">World outliner</div>
      <ul>
        <li className="world-outliner-row is-root">World · {structures.length} curve{structures.length === 1 ? '' : 's'}</li>
        {structures.map((s) => {
          const selected = s.curveId === ui.selectedCurveId
          const st = s.skeleton.stats
          const linked = [s.curve.links?.start, s.curve.links?.end].filter(Boolean).length
          return (
            <li key={s.structureId} className={selected ? 'is-selected' : undefined}>
              <div className="world-outliner-row">
                <button type="button" className="world-outliner-name" title="Select this curve" onClick={() => setUi((u) => ({ ...u, selectedCurveId: s.curveId, selectedPoint: null }))}>
                  {s.curve.name}
                  <span className="world-outliner-role">{ROLE_RULES[s.curve.curveRole]?.label ?? 'Rib'}</span>
                </button>
                <button type="button" className="world-icon-btn" title={s.curve.visibility ? 'Hide curve and structure' : 'Show curve and structure'} onClick={() => dispatch({ type: 'setCurveField', curveId: s.curveId, field: 'visibility', value: !s.curve.visibility })}>
                  {s.curve.visibility ? 'VIS' : 'HID'}
                </button>
                <button type="button" className="world-icon-btn" title={s.curve.locked ? 'Unlock (allow edits)' : 'Lock (freeze geometry and parameters)'} onClick={() => dispatch({ type: 'setCurveField', curveId: s.curveId, field: 'locked', value: !s.curve.locked })}>
                  {s.curve.locked ? 'LCK' : 'EDT'}
                </button>
                <button
                  type="button"
                  className="world-icon-btn"
                  title="Delete curve and its structure (connected curves keep their end positions)"
                  onClick={() => {
                    dispatch({ type: 'deleteCurve', curveId: s.curveId })
                    setUi((u) => (u.selectedCurveId === s.curveId ? { ...u, selectedCurveId: null, selectedPoint: null } : u))
                  }}
                >
                  DEL
                </button>
              </div>
              <div className="world-outliner-child">
                <span>Gothic skeleton</span>
                <span className={st.members ? 'is-ok' : 'is-warn'}>{st.members ? `${st.style ?? '—'} · ${st.motifs ?? 0} motifs` : 'needs 2 pts'}</span>
              </div>
              <div className="world-outliner-child">
                <span>Lithic formation</span>
                <span>{s.lithic.stones.length.toLocaleString()} stones</span>
              </div>
              {linked ? (
                <div className="world-outliner-child">
                  <span>Connections</span>
                  <span>{linked} linked end{linked > 1 ? 's' : ''}</span>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ParamRows({ specs, values, overrides, tier, onChange, onReset, role }) {
  return specs
    .filter((spec) => tier === 'advanced' || spec.tier === 'essential')
    .filter((spec) => !role || !spec.roles || spec.roles.includes(role))
    .map((spec) => {
      const value = values[spec.key]
      const overridden = overrides && Object.prototype.hasOwnProperty.call(overrides, spec.key)
      if (spec.options) {
        return (
          <label key={spec.key} className="world-param" title={spec.help}>
            <span className="world-param-label">{spec.label}</span>
            <select value={value} onChange={(e) => onChange(spec.key, e.target.value)}>
              {spec.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )
      }
      return (
        <label key={spec.key} className={`world-param${overridden ? ' is-override' : ''}`} title={spec.help}>
          <span className="world-param-label">
            <span>
              {spec.label}
              {overridden && onReset ? (
                <button
                  type="button"
                  className="world-param-reset"
                  title="Remove this curve's override (use the world default)"
                  onClick={(e) => {
                    e.preventDefault()
                    onReset(spec.key)
                  }}
                >
                  ↺
                </button>
              ) : null}
            </span>
            <span className="world-param-value">
              {Number(value).toFixed(spec.step >= 1 ? 0 : spec.step >= 0.05 ? 2 : 3)}
              {spec.unit ? ` ${spec.unit}` : ''}
            </span>
          </span>
          <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value} onChange={(e) => onChange(spec.key, Number(e.target.value))} />
        </label>
      )
    })
}

function NumberField({ label, value, onChange, help, min }) {
  return (
    <label className="world-num" title={help}>
      <span>{label}</span>
      <input type="number" step={0.5} min={min} value={Number(value.toFixed(2))} onChange={(e) => Number.isFinite(Number(e.target.value)) && onChange(Number(e.target.value))} />
    </label>
  )
}


/** Debug panel: layer toggles, legend and the rule log of the selected curve (click a rule to focus it). */
function DebugPanel({ debug, setDebug, structure, structures }) {
  const toggle = (key) => setDebug((d) => ({ ...d, [key]: !d[key] }))
  // Focus a legend group (or the group a rule-log row belongs to); click again to clear.
  const focus = (key) => setDebug((d) => ({ ...d, focus: d.focus === key ? null : key }))
  const fs = focusSets(debug.focus)
  const visible = structures.filter((s) => s.curve.visibility && s.skeleton?.trace)
  const trace = structure?.skeleton?.trace
  const maxRes = structure?.skeleton?.stats?.maxResidual ?? 0
  return (
    <Section title="Debug · curve → skeleton">
      <div className="dbg-toggles">
        {[
          ['construction', 'Construction'],
          ['members', 'Member types'],
          ['labels', 'Labels'],
        ].map(([k, label]) => (
          <label key={k}>
            <input type="checkbox" checked={!!debug[k]} onChange={() => toggle(k)} /> {label}
          </label>
        ))}
      </div>
      <p className="world-panel-scope">Click an item to highlight its construction and members; everything else dims. Click again to clear.</p>
      <div className="dbg-legend">
        {Object.entries(FOCUS_GROUPS).map(([key, g]) => (
          <button key={key} type="button" className={debug.focus === key ? 'is-active' : undefined} style={{ '--c': g.color }} onClick={() => focus(key)} title="Highlight: this group's construction lines and members stay bright, everything else dims. Click again to clear.">
            <span className="dbg-swatch" /> {g.label}
          </button>
        ))}
      </div>
      {trace ? (
        <>
          <p className="world-panel-scope">
            <strong>{structure.curve.name}</strong> · {trace.steps.length} rules fired · {trace.geom.length} construction primitives · max tangency error {maxRes.toExponential(1)}
          </p>
          <ol className="dbg-log">
            {trace.steps.map((st) => (
              <li key={st.n}>
                <button type="button" className={fs?.rules.has(st.rule) ? 'is-active' : undefined} style={{ '--c': RULE_COLORS[st.rule] ?? '#777' }} onClick={() => focus(focusKeyFor(st.rule))}>
                  <span className="dbg-n">{st.n}</span>
                  <span className="dbg-rule">{st.rule}</span>
                  <span className="dbg-text">{st.text}</span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="world-panel-scope">Select a curve to read its full rule log. Overview of every structure:</p>
          <ul className="dbg-overview">
            {visible.map((s) => {
              const at = s.skeleton.trace.steps.find((st) => st.rule === 'archTest')
              return (
                <li key={s.structureId}>
                  <strong>{s.curve.name}</strong> {s.skeleton.role} → {s.skeleton.archFrame ? 'arch · ' : ''}{s.skeleton.stats.style ?? '—'} · {s.skeleton.stats.motifs ?? 0} motifs · {s.skeleton.trace.steps.length} rules
                  {at?.data?.ratio != null ? ` · rise/half-span ${at.data.ratio.toFixed(2)}` : ''}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </Section>
  )
}

const protoName = (i) => Object.entries(PROTO).find(([, v]) => i >= v.start && i < v.start + v.count)?.[0] ?? '?'
const ms = (v) => (v < 10 ? v.toFixed(1) : v.toFixed(0))

/** Debug panel, skeleton → stone: colour modes, per-phase table, conflicts, timelapse and stone inspector. */
function StoneDebugPanel({ debug, setDebug, structure, structures }) {
  const set = (patch) => setDebug((d) => ({ ...d, ...patch }))
  const list = structure ? [structure] : structures.filter((s) => s.curve.visibility && s.lithic?.trace)
  // Per-phase totals over the selected structure (or all visible ones).
  const phases = {}
  let total = { slots: 0, placed: 0, rejected: 0, skipped: 0, ms: 0 }
  const pairs = {}
  const kinds = {}
  for (const s of list) {
    for (const [name, v] of Object.entries(s.lithic.trace?.phases ?? {})) {
      const t = (phases[name] ??= { slots: 0, placed: 0, rejected: 0, skipped: 0, ms: 0 })
      for (const k of Object.keys(t)) t[k] += v[k]
    }
    for (const t of s.lithic.trace?.slots ?? []) if (t.outcome === 'rejected') pairs[`${t.kind} ← ${t.blockerKind ?? '?'}`] = (pairs[`${t.kind} ← ${t.blockerKind ?? '?'}`] ?? 0) + 1
    for (const st of s.lithic.stones) kinds[st.kind] = (kinds[st.kind] ?? 0) + 1
  }
  for (const v of Object.values(phases)) for (const k of Object.keys(total)) total[k] += v[k]
  const skelMs = list.reduce((a, s) => a + (s.skeleton.buildMs ?? 0), 0)
  const stoneMs = list.reduce((a, s) => a + (s.lithic.buildMs ?? 0), 0)
  const topPairs = Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 6)
  const insp = debug.inspect ? structures.find((s) => s.curveId === debug.inspect.curveId) : null
  const st = insp?.lithic.stones[debug.inspect.index]
  const member = st ? insp.skeleton.members.find((m) => st.piece === m.piece || st.piece.startsWith(`${m.piece}/`)) : null
  const legend = debug.stoneColor === 'phase' ? PHASES.map((p) => [p, PHASE_COLORS[p], phases[p]?.placed ?? 0]) : Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, STONE_KIND_COLORS[k] ?? '#bbb', n])
  return (
    <Section title="Debug · skeleton → stone">
      <div className="dbg-toggles">
        <label>
          Colour stones
          <select value={debug.stoneColor} onChange={(e) => set({ stoneColor: e.target.value })}>
            <option value="off">Palette</option>
            <option value="kind">By kind</option>
            <option value="phase">By phase</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={!!debug.conflicts} onChange={() => set({ conflicts: !debug.conflicts })} /> Conflicts
        </label>
      </div>
      {debug.stoneColor !== 'off' ? (
        <div className="dbg-legend">
          {legend.map(([name, color, n]) => (
            <span key={name} className="dbg-chip" style={{ '--c': color }}>
              <span className="dbg-swatch" /> {name} <em>{n}</em>
            </span>
          ))}
        </div>
      ) : null}
      <p className="world-panel-scope">
        {structure ? <strong>{structure.curve.name}</strong> : `${list.length} structures`} · skeleton {ms(skelMs)} ms · stones {ms(stoneMs)} ms (0 ms = served from cache)
      </p>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>phase</th>
            <th title="placement attempts">slots</th>
            <th>placed</th>
            <th title="rejected by the overlap test">rej.</th>
            <th title="skipped by stone density">skip</th>
            <th>ms</th>
          </tr>
        </thead>
        <tbody>
          {PHASES.filter((p) => phases[p]).map((p) => (
            <tr key={p}>
              <td style={{ color: PHASE_COLORS[p] }}>{p}</td>
              <td>{phases[p].slots}</td>
              <td>{phases[p].placed}</td>
              <td className={phases[p].rejected ? 'is-warn' : undefined}>{phases[p].rejected}</td>
              <td>{phases[p].skipped}</td>
              <td>{ms(phases[p].ms)}</td>
            </tr>
          ))}
          <tr className="dbg-total">
            <td>total</td>
            <td>{total.slots}</td>
            <td>{total.placed}</td>
            <td>{total.rejected}</td>
            <td>{total.skipped}</td>
            <td>{ms(total.ms)}</td>
          </tr>
        </tbody>
      </table>
      {topPairs.length ? (
        <>
          <p className="world-panel-scope">Overlap conflicts (rejected kind ← blocking kind):</p>
          <ul className="dbg-overview">
            {topPairs.map(([k, n]) => (
              <li key={k}>
                {k} <strong>×{n}</strong>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="world-panel-scope">No overlap conflicts.</p>
      )}
      <div className="dbg-timelapse">
        <button type="button" onClick={() => set(debug.playing ? { playing: false } : { playing: true, build: debug.build == null || debug.build >= 1 ? 0 : debug.build })}>
          {debug.playing ? 'Pause' : 'Play build'}
        </button>
        <input type="range" min={0} max={1} step={0.005} value={debug.build ?? 1} onChange={(e) => set({ build: Number(e.target.value), playing: false })} aria-label="Build timelapse" title="Placement order: carved pieces → tracery → structure → footings → plinths → gravel" />
        <span>{Math.round((debug.build ?? 1) * 100)}%</span>
      </div>
      {st ? (
        <dl className="world-stats dbg-inspect">
          <dt>Stone</dt>
          <dd>
            #{debug.inspect.index + 1} of {insp.lithic.stones.length} · {st.kind} · phase {st.phase}
          </dd>
          <dt>From</dt>
          <dd>
            {insp.curve.name} · member {member ? `${member.kind} (${member.id})` : '—'} · piece {st.piece}
          </dd>
          <dt>Shape</dt>
          <dd>
            {protoName(st.proto)} #{st.proto} · {st.s.map((v) => v.toFixed(2)).join(' × ')} m
          </dd>
          <dt>Colour</dt>
          <dd>
            <span className="dbg-swatch" style={{ display: 'inline-block', background: `rgb(${st.color.map((v) => Math.round(v * 255)).join(',')})` }} /> palette #{st.paletteIndex}
          </dd>
          <dt>Position</dt>
          <dd>{st.p.map((v) => v.toFixed(2)).join(', ')} m</dd>
        </dl>
      ) : (
        <p className="world-panel-scope">Click a stone in the 3D view to inspect it.</p>
      )}
    </Section>
  )
}

function Section({ title, children }) {
  return (
    <section className="world-section">
      <div className="world-section-head">{title}</div>
      {children}
    </section>
  )
}

export function ParamPanel({ stage, project, structure, ui, setUi, dispatch, onFit, labNoise, debug = null, setDebug = null, structures = [] }) {
  const [tier, setTier] = useState('essential')
  const [rise, setRise] = useState(1.1)
  const curve = structure?.curve
  const world = project.world

  const groupFor = { curves: null, skeleton: 'skeleton', lithic: 'lithic', world: 'terrain' }[stage]
  const specsFor = { skeleton: SKELETON_PARAM_SPECS, lithic: LITHIC_PARAM_SPECS, terrain: TERRAIN_PARAM_SPECS }
  const perCurve = groupFor === 'skeleton' || groupFor === 'lithic'
  const values = perCurve && curve ? structure.params[groupFor] : groupFor ? world[groupFor] : null
  const overrides = perCurve && curve ? (groupFor === 'skeleton' ? curve.architecturalParameters : curve.lithicParameters) : null

  const onChange = (key, value) => {
    if (perCurve && curve) dispatch({ type: 'setCurveParam', curveId: curve.curveId, group: groupFor, key, value }, { coalesce: `p-${curve.curveId}-${groupFor}-${key}` })
    else dispatch({ type: 'setWorldParam', group: groupFor, key, value }, { coalesce: `w-${groupFor}-${key}` })
  }
  const onReset = (key) => dispatch({ type: 'clearCurveParam', curveId: curve.curveId, group: groupFor, key })
  const setPresentation = (key, value) => dispatch({ type: 'setWorldParam', group: 'presentation', key, value }, { coalesce: `w-pres-${key}` })

  const point = curve && ui.selectedPoint != null ? structure.resolved[ui.selectedPoint] : null
  const movePoint = (patch) => dispatch({ type: 'movePoint', curveId: curve.curveId, index: ui.selectedPoint, point: { ...point, ...patch } }, { coalesce: `num-${curve.curveId}-${ui.selectedPoint}` })

  const title = { curves: 'Curve', skeleton: 'Gothic skeleton', lithic: 'Lithic formation', world: 'World & terrain', pointcloud: 'Point cloud' }[stage]
  return (
    <aside className="world-panel">
      <div className="world-panel-head">
        <span>{title}</span>
        <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="Control tier" title="Essential shows the main controls; Advanced shows all of them">
          <option value="essential">Essential</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {debug?.on ? <DebugPanel debug={debug} setDebug={setDebug} structure={structure} structures={structures} /> : null}
      {debug?.on ? <StoneDebugPanel debug={debug} setDebug={setDebug} structure={structure} structures={structures} /> : null}

      {stage === 'pointcloud' ? (
        <>
          <p className="world-panel-scope">Photogrammetry survey of the built world (REF-031). Stations report measured data only: target stone, camera position and range.</p>
          <ParamRows specs={SCAN_SPECS} values={world.presentation} tier={tier} onChange={setPresentation} />
        </>
      ) : stage === 'curves' ? (
        curve ? (
          <>
            <label className="world-param" title="Display name in the outliner">
              <span className="world-param-label">Name</span>
              <input type="text" value={curve.name} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'name', value: e.target.value }, { coalesce: `name-${curve.curveId}` })} />
            </label>
            <label className="world-param" title={Object.values(ROLE_RULES).map((r) => `${r.label}: ${r.help}`).join('\n')}>
              <span className="world-param-label">Structural role</span>
              <select value={curve.curveRole} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'curveRole', value: e.target.value })}>
                {Object.entries(ROLE_RULES).map(([id, r]) => (
                  <option key={id} value={id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="world-param" title="Smooth spline passes through every point; polyline joins them with straight segments">
              <span className="world-param-label">Curve type</span>
              <select value={curve.curveType} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'curveType', value: e.target.value })}>
                <option value="catmullRom">Smooth spline</option>
                <option value="polyline">Polyline</option>
              </select>
            </label>

            <Section title={point ? `Point ${ui.selectedPoint + 1} of ${structure.resolved.length}` : 'Point'}>
              {point ? (
                <div className="world-num-row">
                  <NumberField label="X" value={point.x} help="East–west position (m)" onChange={(x) => movePoint({ x })} />
                  <NumberField label="Y" value={-point.z} help="North–south position (m, up on the drawing board)" onChange={(y) => movePoint({ z: -y })} />
                  <NumberField label="Z ↑" value={point.y} min={0} help="Height above ground (m). Also: Shift-drag in Top view, or drag in Front view" onChange={(z) => movePoint({ y: Math.max(0, z) })} />
                </div>
              ) : (
                <p className="world-panel-scope">Select a point in Edit mode to set its height.</p>
              )}
              {point ? (
                <div className="world-panel-actions">
                  <button
                    type="button"
                    title="Delete this control point (Delete key)"
                    onClick={() => {
                      dispatch({ type: 'deletePoint', curveId: curve.curveId, index: ui.selectedPoint })
                      setUi((u) => ({ ...u, selectedPoint: null }))
                    }}
                  >
                    Delete point
                  </button>
                </div>
              ) : null}
            </Section>

            <Section title="Shape">
              <label className="world-param" title="Rise of the pointed arch as a fraction of the span between the curve's two ends">
                <span className="world-param-label">
                  Arch rise <span className="world-param-value">{rise.toFixed(2)}</span>
                </span>
                <input type="range" min={0.4} max={1.6} step={0.01} value={rise} onChange={(e) => setRise(Number(e.target.value))} />
              </label>
              <div className="world-panel-actions">
                <button
                  type="button"
                  title="Set the heights of the inner points to a two-centred Gothic pointed arch between the curve's ends (undoable)"
                  onClick={() => dispatch({ type: 'setCurvePoints', curveId: curve.curveId, points: liftToPointedArch(structure.resolved, rise) })}
                >
                  Lift to pointed arch
                </button>
                <button type="button" title="Put every point back on the ground (height 0)" onClick={() => dispatch({ type: 'setCurvePoints', curveId: curve.curveId, points: structure.resolved.map((p) => ({ ...p, y: 0 })) })}>
                  Flatten
                </button>
              </div>
            </Section>
            <label className="world-param" title="Seed: chooses between symmetric grammar alternatives (tracery style in Auto, foil orientation, grotesque variant) and stone placement — same drawing, different variation">
              <span className="world-param-label">
                Random seed<span className="world-param-value">{curve.randomSeed}</span>
              </span>
              <input type="range" min={0} max={9999} step={1} value={curve.randomSeed} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'randomSeed', value: Number(e.target.value) }, { coalesce: `seed-${curve.curveId}` })} />
            </label>
          </>
        ) : (
          <p className="world-panel-scope">Draw a curve, or select one to set its role, points and shape.</p>
        )
      ) : (
        <>
          <p className="world-panel-scope">
            {perCurve ? (
              curve ? (
                <>
                  Editing <strong>{curve.name}</strong> — changes override the world default for this curve only
                </>
              ) : (
                'No curve selected — editing world defaults for all curves'
              )
            ) : (
              'World settings (shared by all structures)'
            )}
          </p>
          {groupFor === 'skeleton' && curve ? <p className="world-panel-scope">Showing the grammar controls for a <strong>{ROLE_RULES[curve.curveRole]?.label ?? 'Rib'}</strong>.</p> : null}
          <ParamRows specs={specsFor[groupFor]} values={values} overrides={overrides} tier={tier} onChange={onChange} onReset={curve ? onReset : null} role={groupFor === 'skeleton' ? curve?.curveRole : null} />
          {groupFor === 'terrain' && labNoise ? (
            <div className="world-panel-actions">
              <button
                type="button"
                title="Copy the active layer of LAB → Noise 2D / Noise 3D (type, shaping, octaves, persistence, lacunarity, seed; frequency becomes terrain scale) into the terrain (undoable)"
                onClick={() => {
                  const next = terrainFromNoiseLayer(labNoise.layers[labNoise.activeLayer] ?? labNoise.layers[0], world.terrain)
                  for (const [key, value] of Object.entries(next)) if (value !== world.terrain[key]) dispatch({ type: 'setWorldParam', group: 'terrain', key, value }, { coalesce: 'w-terrain-import' })
                }}
              >
                Use Noise 2D / 3D layer {(labNoise.activeLayer ?? 0) + 1}
              </button>
            </div>
          ) : null}
          {perCurve && curve ? (
            <label className="world-param" title="Seed: chooses between symmetric grammar alternatives and stone placement">
              <span className="world-param-label">
                Random seed<span className="world-param-value">{curve.randomSeed}</span>
              </span>
              <input type="range" min={0} max={9999} step={1} value={curve.randomSeed} onChange={(e) => dispatch({ type: 'setCurveField', curveId: curve.curveId, field: 'randomSeed', value: Number(e.target.value) }, { coalesce: `seed-${curve.curveId}` })} />
            </label>
          ) : null}
        </>
      )}

      {stage === 'world' ? (
        <Section title="Environment & ground surface">
          <ParamRows specs={ENVIRONMENT_SPECS} values={world.presentation} tier={tier} onChange={setPresentation} />
          <ParamRows specs={TERRAIN_SURFACE_SPECS} values={world.terrain} tier={tier} onChange={(key, value) => dispatch({ type: 'setWorldParam', group: 'terrain', key, value }, { coalesce: `w-terrain-${key}` })} />
        </Section>
      ) : null}

      <Section title="Presentation">
        <ParamRows specs={PRESENTATION_SPECS} values={world.presentation} tier="advanced" onChange={setPresentation} />
      </Section>

      {structure ? (
        <>
          <div className="world-panel-actions">
            <button type="button" title="Frame the selected structure in the 3D view (the camera never moves on its own)" onClick={() => onFit(structure)}>
              Fit to structure
            </button>
          </div>
          <dl className="world-stats">
            <dt>Curve</dt>
            <dd>{structure.skeleton.stats.length ? `${structure.skeleton.stats.length.toFixed(1)} m · ${structure.resolved.length} pts` : '—'}</dd>
            <dt>Skeleton</dt>
            <dd>
              {structure.skeleton.stats.style ?? '—'} · {structure.skeleton.stats.members ?? 0} members · {structure.skeleton.stats.motifs ?? 0} motifs · {structure.skeleton.stats.ornaments ?? 0} carved sites · max tangency error {(structure.skeleton.stats.maxResidual ?? 0).toExponential(0)} · {(structure.skeleton.buildMs ?? 0).toFixed(1)} ms
            </dd>
            <dt>Stones</dt>
            <dd>
              {structure.lithic.stones.length.toLocaleString()} · {structure.lithic.stats.carved ?? 0} carved · {structure.lithic.stats.rejected ?? 0} overlap-rejected · {(structure.lithic.buildMs ?? 0).toFixed(0)} ms
            </dd>
          </dl>
        </>
      ) : null}
    </aside>
  )
}
