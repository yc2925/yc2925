/**
 * Debug layer — curve → skeleton (Class 11 visual debugging).
 *
 * Reads only the skeleton's debug trace (skeleton.trace, recorded by the
 * grammar) — it never changes the generators. Draws, on top of every view:
 *  - construction geometry: full circles of every arc, centres, springing /
 *    transom lines, tangency lines, foil lobe circles and cusps, by rule;
 *  - member types: every skeleton member's centre line coloured by kind;
 *  - labels: key construction points and a one-line summary per structure.
 * Focus (legend item or rule-log row): every construction rule AND member
 * kind of that group stays bright; all other construction and members dim.
 * Only the group's point labels stay visible.
 *
 * Skeleton → stone (reads lithic.trace, recorded by buildStones):
 *  - conflicts: every slot rejected by the overlap test (red cross) with a
 *    line to the stone that blocked it, and slots skipped by density (grey);
 *  - inspected stone: its oriented box outlined.
 * Stone colour modes and the build timelapse are applied on the stones
 * themselves (WorldViewport → StoneBatch).
 */

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'

export const RULE_COLORS = {
  arch: '#ffd166',
  subdivide: '#ff9f1c',
  oculus: '#4dd0e1',
  tangency: '#ff4fd8',
  foil: '#ff6b9a',
  cusp: '#ffffff',
  headFoil: '#9be564',
  gable: '#c39bff',
  gableFoil: '#c39bff',
  band: '#8fb3ff',
  yTracery: '#9be564',
  intersecting: '#ffa94d',
  // Step 48 typologies
  typology: '#ffffff',
  cusped: '#ff6b9a',
  panel: '#9be564',
  label: '#c39bff',
  flamboyant: '#ff9f1c',
  plate: '#4dd0e1',
  curvilinear: '#ffd166',
  storeys: '#8fb3ff',
  rose: '#4dd0e1',
  wheel: '#4dd0e1',
  vesica: '#c39bff',
  triangle: '#ffa94d',
  vault: '#ffd166',
  chapterHouse: '#ffd166',
  canopy: '#c39bff',
  cloister: '#9be564',
  apse: '#ffd166',
  arcade: '#9be564',
  reticulated: '#ff9f1c',
  parapet: '#ffa94d',
  spire: '#c39bff',
  stair: '#8fb3ff',
}

export const MEMBER_COLORS = {
  main: '#f2f2f2',
  archivolt: '#8fb3ff',
  subarch: '#ffd166',
  mullion: '#9be564',
  oculus: '#4dd0e1',
  foil: '#ff6b9a',
  gable: '#c39bff',
  rail: '#ffa94d',
  shaft: '#9be564',
  springer: '#ffd166',
  pier: '#ff8c42',
}

/** Stone kinds: carved pieces warm, structural cool, tracery pale, ground green/grey. */
export const STONE_KIND_COLORS = {
  keystone: '#ffd166',
  boss: '#ff9f1c',
  capital: '#ffb4a2',
  base: '#e5989b',
  pinnacle: '#c39bff',
  crocket: '#ff6b9a',
  finial: '#f72585',
  grotesque: '#ff4fd8',
  voussoir: '#8fb3ff',
  drum: '#4dd0e1',
  footing: '#9be564',
  plinth: '#57cc99',
  subarch: '#ffe8a3',
  mullion: '#b5e48c',
  oculus: '#90e0ef',
  foil: '#ffafcc',
  rail: '#ffc078',
  gable: '#cdb4db',
}

/** Placement phases, in build order. */
export const PHASE_COLORS = {
  carved: '#ff9f1c',
  tracery: '#ffd166',
  structural: '#8fb3ff',
  footing: '#9be564',
  plinth: '#57cc99',
}
export const PHASES = Object.keys(PHASE_COLORS)

/**
 * Legend groups: what each legend item highlights — the construction rules it
 * names plus the skeleton members those rules build.
 */
export const FOCUS_GROUPS = {
  arch: { label: 'arch circles · centres · springing · archivolts', color: RULE_COLORS.arch, rules: ['arch'], members: ['main', 'archivolt'] },
  subdivide: { label: 'lancets · lancet centres', color: RULE_COLORS.subdivide, rules: ['subdivide'], members: ['subarch', 'mullion'] },
  oculus: { label: 'oculi · centres · tangency lines', color: RULE_COLORS.oculus, rules: ['oculus', 'tangency'], members: ['oculus'] },
  tangency: { label: 'tangency lines only', color: RULE_COLORS.tangency, rules: ['tangency'], members: [] },
  foil: { label: 'foils · lobe circles · cusps', color: RULE_COLORS.foil, rules: ['foil', 'cusp'], members: ['foil'] },
  headFoil: { label: 'lancet-head roundel · transom', color: RULE_COLORS.headFoil, rules: ['headFoil'], members: [] },
  gable: { label: 'gable · gable foil', color: RULE_COLORS.gable, rules: ['gable', 'gableFoil'], members: ['gable'] },
  band: { label: 'band circles · rails · posts', color: RULE_COLORS.band, rules: ['band'], members: ['rail', 'oculus', 'mullion'] },
  yTracery: { label: 'Y fork · branches · branch centres', color: RULE_COLORS.yTracery, rules: ['yTracery'], members: ['subarch', 'mullion'] },
  intersecting: { label: 'intersecting arcs · mullion feet', color: RULE_COLORS.intersecting, rules: ['intersecting'], members: ['subarch', 'mullion'] },
}

/** Group key for a rule-log rule (falls back to the rule itself). */
export function focusKeyFor(rule) {
  if (FOCUS_GROUPS[rule]) return rule
  if (rule === 'gableFoil') return 'gable'
  if (rule === 'cusp') return 'foil'
  return rule
}

/** { rules, members } sets of a focus key, or null when nothing is focused. */
export function focusSets(focus) {
  if (!focus) return null
  const g = FOCUS_GROUPS[focus]
  return g ? { rules: new Set(g.rules), members: new Set(g.members) } : { rules: new Set([focus]), members: new Set() }
}

const DIM = 0.12
const tmp = new THREE.Color()
const noRaycast = () => null

function pushSeg(pos, col, a, b, c, k) {
  pos.push(a.x, a.y, a.z, b.x, b.y, b.z)
  col.push(c.r * k, c.g * k, c.b * k, c.r * k, c.g * k, c.b * k)
}

function useLines(build, deps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const geometry = useMemo(build, deps)
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function makeGeometry(pos, col) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  return g
}

function ConstructionLines({ trace, focus, scale }) {
  const geometry = useLines(() => {
    const fs = focusSets(focus)
    const pos = []
    const col = []
    for (const g of trace.geom) {
      tmp.set(RULE_COLORS[g.rule] ?? '#cccccc')
      const k = !fs || fs.rules.has(g.rule) ? 1 : DIM
      if (g.kind === 'point') {
        // Small cross, sized to the structure.
        const p = g.points[0]
        const s = scale * 0.012
        pushSeg(pos, col, { x: p.x - s, y: p.y, z: p.z }, { x: p.x + s, y: p.y, z: p.z }, tmp, k)
        pushSeg(pos, col, { x: p.x, y: p.y - s, z: p.z }, { x: p.x, y: p.y + s, z: p.z }, tmp, k)
        pushSeg(pos, col, { x: p.x, y: p.y, z: p.z - s }, { x: p.x, y: p.y, z: p.z + s }, tmp, k)
      } else {
        const kk = g.kind === 'circle' ? k * 0.7 : k
        for (let i = 1; i < g.points.length; i += 1) pushSeg(pos, col, g.points[i - 1], g.points[i], tmp, kk)
      }
    }
    return makeGeometry(pos, col)
  }, [trace, focus, scale])
  return (
    <lineSegments geometry={geometry} renderOrder={30} raycast={noRaycast} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
  )
}

function MemberLines({ skeleton, focus }) {
  const geometry = useLines(() => {
    const fs = focusSets(focus)
    const pos = []
    const col = []
    for (const m of skeleton.members) {
      tmp.set(MEMBER_COLORS[m.kind] ?? '#bbbbbb')
      const k = !fs || fs.members.has(m.kind) ? 1 : DIM
      for (let i = 1; i < m.points.length; i += 1) pushSeg(pos, col, m.points[i - 1], m.points[i], tmp, k)
    }
    return makeGeometry(pos, col)
  }, [skeleton, focus])
  return (
    <lineSegments geometry={geometry} renderOrder={29} raycast={noRaycast} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
  )
}

function Labels({ s, focus }) {
  const { trace, bounds } = s.skeleton
  const fs = focusSets(focus)
  const pts = trace.geom.filter((g) => g.kind === 'point' && g.label && (!fs || fs.rules.has(g.rule))).slice(0, 14)
  const top = bounds ? [(bounds.min.x + bounds.max.x) / 2, bounds.max.y, (bounds.min.z + bounds.max.z) / 2] : null
  const archStep = trace.steps.find((st) => st.rule === 'archTest')
  return (
    <>
      {top ? (
        <Html position={top} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div className="dbg-head">
            {s.curve.name} · {s.skeleton.role} → {s.skeleton.archFrame ? 'arch · ' : ''}{s.skeleton.stats.style ?? '—'} · {s.skeleton.stats.motifs ?? 0} motifs
            {archStep?.data?.ratio != null ? ` · rise/half-span ${archStep.data.ratio.toFixed(2)}` : ''}
          </div>
        </Html>
      ) : null}
      {pts.map((g, i) => (
        <Html key={i} position={[g.points[0].x, g.points[0].y, g.points[0].z]} zIndexRange={[6, 0]} style={{ pointerEvents: 'none' }}>
          <div className="dbg-tag" style={{ '--c': RULE_COLORS[g.rule] ?? '#ccc' }}>
            {g.label}
          </div>
        </Html>
      ))}
    </>
  )
}

const RED = new THREE.Color('#ff2a2a')
const GREY = new THREE.Color('#8a8a8a')

function ConflictMarks({ lithic, scale }) {
  const geometry = useLines(() => {
    const pos = []
    const col = []
    const s = Math.max(0.12, scale * 0.004)
    for (const t of lithic.trace?.slots ?? []) {
      const p = { x: t.p[0], y: t.p[1], z: t.p[2] }
      const c = t.outcome === 'rejected' ? RED : GREY
      const k = t.outcome === 'rejected' ? 1 : 0.6
      const r = t.outcome === 'rejected' ? s * 1.6 : s
      pushSeg(pos, col, { x: p.x - r, y: p.y - r, z: p.z }, { x: p.x + r, y: p.y + r, z: p.z }, c, k)
      pushSeg(pos, col, { x: p.x - r, y: p.y + r, z: p.z }, { x: p.x + r, y: p.y - r, z: p.z }, c, k)
      if (t.outcome === 'rejected' && t.blockedBy >= 0 && lithic.stones[t.blockedBy]) {
        const b = lithic.stones[t.blockedBy].p
        pushSeg(pos, col, p, { x: b[0], y: b[1], z: b[2] }, RED, 0.55)
      }
    }
    return makeGeometry(pos, col)
  }, [lithic, scale])
  return (
    <lineSegments geometry={geometry} renderOrder={31} raycast={noRaycast} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.95} depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
  )
}

/** Outline of one stone's oriented box (unit box scaled by s, rotated by q). */
function InspectBox({ stone }) {
  const geometry = useLines(() => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...stone.p), new THREE.Quaternion(...stone.q), new THREE.Vector3(...stone.s.map((v) => v * 1.08)))
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1))
    g.applyMatrix4(m)
    return g
  }, [stone])
  return (
    <lineSegments geometry={geometry} renderOrder={32} raycast={noRaycast} frustumCulled={false}>
      <lineBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} toneMapped={false} fog={false} />
    </lineSegments>
  )
}

/** Debug overlay for the visible structures (only the selected one when a curve is selected). */
export default function DebugLayer({ structures, selectedCurveId, debug }) {
  const shown = structures.filter((s) => s.curve.visibility && s.skeleton?.trace && (!selectedCurveId || s.curveId === selectedCurveId))
  return shown.map((s) => {
    const b = s.skeleton.bounds
    const scale = b ? Math.max(4, Math.hypot(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z)) : 20
    return (
      <group key={s.structureId}>
        {debug.construction ? <ConstructionLines trace={s.skeleton.trace} focus={debug.focus} scale={scale} /> : null}
        {debug.members ? <MemberLines skeleton={s.skeleton} focus={debug.focus} /> : null}
        {debug.labels ? <Labels s={s} focus={debug.focus} /> : null}
        {debug.conflicts && s.lithic?.trace ? <ConflictMarks lithic={s.lithic} scale={scale} /> : null}
        {debug.inspect && debug.inspect.curveId === s.curveId && s.lithic.stones[debug.inspect.index] ? <InspectBox stone={s.lithic.stones[debug.inspect.index]} /> : null}
      </group>
    )
  })
}
