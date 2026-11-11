/**
 * Step 14A.1.2 — Parametric motif construction drafting overlay.
 * Restrained architectural line weights — not decorative rainbow.
 */

import { useMemo } from 'react'
import { Line, Html, Sphere } from '@react-three/drei'
import { CURVE_ROLES } from './types.js'

const COLORS = Object.freeze({
  spine: '#d8d2c4',
  volute: '#b8b0a0',
  secondary: '#8a8580',
  tertiary: '#6a6662',
  mirror: '#a8a098',
  construction: '#6a7078',
  rib: '#9a9590',
  invalid: '#b05050',
  axis: '#c0b060',
  host: '#708090',
  control: '#d0c8b0',
  anchor: '#e8c040',
  root: '#f0e8d0',
})

function roleStyle(role) {
  if (role === CURVE_ROLES.PRIMARY_SPINE) return { color: COLORS.spine, width: 3.2 }
  if (role === CURVE_ROLES.PRIMARY_VOLUTE) return { color: COLORS.volute, width: 2.4 }
  if (role === CURVE_ROLES.SECONDARY_CURL) return { color: COLORS.secondary, width: 1.6 }
  if (role === CURVE_ROLES.TERTIARY) return { color: COLORS.tertiary, width: 1.2 }
  if (role === CURVE_ROLES.MIRROR) return { color: COLORS.mirror, width: 2.0 }
  if (role === CURVE_ROLES.CONSTRUCTION) return { color: COLORS.construction, width: 1.0, dashed: true }
  if (role === CURVE_ROLES.RIB_MARK) return { color: COLORS.rib, width: 1.1 }
  return { color: COLORS.volute, width: 1.5 }
}

export default function ParametricMotifOverlay({
  result = null,
  showHostBoundary = false,
  showLocalAxes = false,
  showConstructionCurves = false,
  showControlPoints = false,
  showBranchHierarchy = false,
  showInvalidGeometry = true,
  showClearanceZones = false,
  showAnchorLinkDebug = false,
  showLabel = true,
}) {
  const elements = useMemo(() => {
    if (!result?.motifs?.length) {
      return {
        lines: [],
        invalid: [],
        hosts: [],
        axes: [],
        controls: [],
        labels: [],
        clearance: [],
        anchors: [],
        roots: [],
        links: [],
      }
    }

    const lines = []
    const invalid = []
    const hosts = []
    const axes = []
    const controls = []
    const labels = []
    const clearance = []
    const anchors = []
    const roots = []
    const links = []
    const showAxes = showLocalAxes || showAnchorLinkDebug
    const showBound = showHostBoundary || showAnchorLinkDebug

    for (const motif of result.motifs) {
      for (const c of motif.curves ?? []) {
        if (!c.points || c.points.length < 2) continue
        if (!c.valid) {
          if (showInvalidGeometry || showAnchorLinkDebug) {
            invalid.push({ id: c.id, points: c.points })
          }
          continue
        }
        if (c.role === CURVE_ROLES.CONSTRUCTION && !showConstructionCurves) continue
        const style = roleStyle(c.role)
        lines.push({
          id: c.id,
          points: c.points,
          color: style.color,
          width: style.width,
          dashed: style.dashed,
        })
        if ((showBranchHierarchy || showAnchorLinkDebug) && c.points.length) {
          const mid = c.points[Math.floor(c.points.length / 2)]
          labels.push({
            id: `h-${c.id}`,
            position: mid,
            text: `${c.role.replace('_', ' ')} · L${c.hierarchy ?? 0}`,
            color: style.color,
          })
        }
        if (showControlPoints) {
          for (let i = 0; i < (c.controlPoints ?? []).length; i += 1) {
            controls.push({
              id: `cp-${c.id}-${i}`,
              position: c.controlPoints[i],
            })
          }
        }
      }

      const host = motif.host
      if (host && showBound && host.boundaryWorld?.length) {
        hosts.push({ id: `bnd-${host.id}`, points: host.boundaryWorld })
      }
      if (host && showAxes) {
        const o = host.origin
        const s = Math.min(host.width, host.height) * 0.35
        axes.push({
          id: `u-${host.id}`,
          points: [o, [
            o[0] + host.axisU[0] * s,
            o[1] + host.axisU[1] * s,
            o[2] + host.axisU[2] * s,
          ]],
          color: '#c07070',
        })
        axes.push({
          id: `v-${host.id}`,
          points: [o, [
            o[0] + host.axisV[0] * s,
            o[1] + host.axisV[1] * s,
            o[2] + host.axisV[2] * s,
          ]],
          color: COLORS.axis,
        })
        axes.push({
          id: `n-${host.id}`,
          points: [o, [
            o[0] + host.normal[0] * s * 0.5,
            o[1] + host.normal[1] * s * 0.5,
            o[2] + host.normal[2] * s * 0.5,
          ]],
          color: '#70a070',
        })
      }
      if (host && showClearanceZones) {
        for (const vd of host.voids ?? []) {
          const segs = []
          for (let i = 0; i <= 16; i += 1) {
            const a = (i / 16) * Math.PI * 2
            const u = vd.u + Math.cos(a) * vd.radius
            const v = vd.v + Math.sin(a) * vd.radius
            segs.push([
              host.origin[0] + host.axisU[0] * u + host.axisV[0] * v + host.normal[0] * 0.03,
              host.origin[1] + host.axisU[1] * u + host.axisV[1] * v + host.normal[1] * 0.03,
              host.origin[2] + host.axisU[2] * u + host.axisV[2] * v + host.normal[2] * 0.03,
            ])
          }
          clearance.push({ id: `void-${host.id}-${vd.u}`, points: segs })
        }
      }

      if (showAnchorLinkDebug && host) {
        const anchorPos = host.anchorWorldPosition ?? host.origin
        const rootPos =
          motif.rootWorld ??
          (motif.curves?.find((c) => c.role === CURVE_ROLES.PRIMARY_SPINE)?.points?.[0] ?? host.origin)
        anchors.push({ id: `anc-${motif.id}`, position: anchorPos })
        roots.push({ id: `root-${motif.id}`, position: rootPos })
        links.push({ id: `link-${motif.id}`, points: [anchorPos, rootPos] })
        const dist = motif.diagnostics?.rootAnchorDistance
        labels.push({
          id: `link-lbl-${motif.id}`,
          position: [
            (anchorPos[0] + rootPos[0]) * 0.5,
            (anchorPos[1] + rootPos[1]) * 0.5 + 0.08,
            (anchorPos[2] + rootPos[2]) * 0.5,
          ],
          text: `${motif.sourceAnchorId ?? '—'} · Δ=${Number.isFinite(dist) ? dist.toExponential(1) : '—'}`,
          color: COLORS.anchor,
        })
      }
    }

    return { lines, invalid, hosts, axes, controls, labels, clearance, anchors, roots, links }
  }, [
    result,
    showHostBoundary,
    showLocalAxes,
    showConstructionCurves,
    showControlPoints,
    showBranchHierarchy,
    showInvalidGeometry,
    showClearanceZones,
    showAnchorLinkDebug,
  ])

  if (!result) return null
  const empty = result.diagnostics?.emptyReason
  const host = result.hosts?.[0]
  const bannerPos = host?.origin ?? [0, 1.8, 0.25]

  return (
    <group name="parametric-gothic-motif">
      {showLabel ? (
        <Html position={[bannerPos[0], bannerPos[1] + 0.4, bannerPos[2]]} center style={{ pointerEvents: 'none' }}>
          <div className="grammar-warning-banner" style={{ opacity: 0.92, maxWidth: 320 }}>
            {empty
              ? empty
              : 'PARAMETRIC GOTHIC MOTIF — CONSTRUCTION PREVIEW'}
          </div>
        </Html>
      ) : null}

      {elements.hosts.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.host}
          lineWidth={1.2}
          dashed
          dashSize={0.05}
          gapSize={0.03}
          transparent
          opacity={0.75}
          depthTest={false}
        />
      ))}
      {elements.clearance.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.invalid}
          lineWidth={1}
          dashed
          dashSize={0.03}
          gapSize={0.02}
          transparent
          opacity={0.55}
          depthTest={false}
        />
      ))}
      {elements.axes.map((ln) => (
        <Line key={ln.id} points={ln.points} color={ln.color} lineWidth={1.5} transparent opacity={0.85} depthTest={false} />
      ))}
      {elements.lines.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={ln.color}
          lineWidth={ln.width}
          dashed={ln.dashed}
          dashSize={0.04}
          gapSize={0.03}
          transparent
          opacity={0.96}
          depthTest={false}
          renderOrder={3}
        />
      ))}
      {elements.invalid.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.invalid}
          lineWidth={1.3}
          dashed
          dashSize={0.04}
          gapSize={0.03}
          transparent
          opacity={0.8}
          depthTest={false}
        />
      ))}
      {elements.links.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.anchor}
          lineWidth={1.4}
          dashed
          dashSize={0.03}
          gapSize={0.02}
          transparent
          opacity={0.9}
          depthTest={false}
        />
      ))}
      {elements.anchors.map((a) => (
        <Sphere key={a.id} args={[0.028, 10, 10]} position={a.position}>
          <meshBasicMaterial color={COLORS.anchor} transparent opacity={0.95} depthTest={false} />
        </Sphere>
      ))}
      {elements.roots.map((r) => (
        <Sphere key={r.id} args={[0.018, 10, 10]} position={r.position}>
          <meshBasicMaterial color={COLORS.root} transparent opacity={0.95} depthTest={false} />
        </Sphere>
      ))}
      {elements.controls.map((c) => (
        <Sphere key={c.id} args={[0.018, 8, 8]} position={c.position}>
          <meshBasicMaterial color={COLORS.control} transparent opacity={0.9} depthTest={false} />
        </Sphere>
      ))}
      {elements.labels.map((l) => (
        <Html key={l.id} position={l.position} center style={{ pointerEvents: 'none' }}>
          <span style={{ color: l.color, fontSize: 9, opacity: 0.85, whiteSpace: 'nowrap' }}>{l.text}</span>
        </Html>
      ))}
    </group>
  )
}
