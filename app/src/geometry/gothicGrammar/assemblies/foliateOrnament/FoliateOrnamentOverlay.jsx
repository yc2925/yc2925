/**
 * Step 14A.1.1 — Ornament growth skeleton construction preview + motif debug.
 * Restrained Gothic Grammar palette — not plant greens, not final stone.
 */

import { useMemo } from 'react'
import { Line, Html, Sphere } from '@react-three/drei'
import { BRANCH_ROLES } from './types.js'

const COLORS = Object.freeze({
  primary: '#d8c4a0',
  secondary: '#8fb0c8',
  mirror: '#c9a0c0',
  initiation: '#f0e6d0',
  invalid: '#c45c5c',
  normal: '#6a9a7a',
  direction: '#e0b060',
  motifBounds: '#7a8a9a',
  symmetry: '#d0c070',
  projection: '#90c0a8',
})

function branchColor(role) {
  if (role === BRANCH_ROLES.SECONDARY) return COLORS.secondary
  if (role === BRANCH_ROLES.MIRROR) return COLORS.mirror
  if (role === BRANCH_ROLES.INITIATION) return COLORS.initiation
  return COLORS.primary
}

function nodeMap(nodes) {
  return new Map((nodes ?? []).map((n) => [n.id, n]))
}

function boundsWire(bounds) {
  if (!bounds?.min || !bounds?.max) return null
  const [x0, y0, z0] = bounds.min
  const [x1, y1, z1] = bounds.max
  const z = (z0 + z1) * 0.5
  return [
    [x0, y0, z],
    [x1, y0, z],
    [x1, y1, z],
    [x0, y1, z],
    [x0, y0, z],
  ]
}

export default function FoliateOrnamentOverlay({
  skeleton = null,
  showGrowthNodes = false,
  showBranchIds = false,
  showSurfaceNormals = false,
  showGrowthDirections = false,
  showInvalidSegments = true,
  showMotifDebug = false,
  inspectMotifIndex = 0,
  showLabel = true,
}) {
  const elements = useMemo(() => {
    if (!skeleton?.nodes?.length) {
      return {
        lines: [],
        nodes: [],
        normals: [],
        dirs: [],
        invalid: [],
        labels: [],
        bounds: [],
        axes: [],
        projections: [],
      }
    }

    const motifs = skeleton.motifs ?? []
    const focus =
      showMotifDebug && motifs.length
        ? motifs[Math.max(0, Math.min(motifs.length - 1, inspectMotifIndex | 0))]
        : null
    const focusId = focus?.id ?? null

    const map = nodeMap(skeleton.nodes)
    const lines = []
    const nodes = []
    const normals = []
    const dirs = []
    const invalid = []
    const labels = []
    const bounds = []
    const axes = []
    const projections = []

    for (const b of skeleton.branches ?? []) {
      if (focusId && b.motifId && b.motifId !== focusId) continue
      const pts = []
      for (const id of b.nodeIds ?? []) {
        const n = map.get(id)
        if (!n || n.accepted === false || !n.valid) continue
        pts.push(n.position)
      }
      if (pts.length >= 2) {
        lines.push({
          id: b.id,
          points: pts,
          color: branchColor(b.role),
          width: b.role === BRANCH_ROLES.PRIMARY || b.role === BRANCH_ROLES.MIRROR ? 3.5 : 2.2,
          role: b.role,
        })
      }
      if (showBranchIds && pts.length) {
        const mid = pts[Math.floor(pts.length / 2)]
        labels.push({
          id: `lbl-${b.id}`,
          position: mid,
          text: b.id.slice(0, 16),
          color: branchColor(b.role),
        })
      }
    }

    for (const n of skeleton.nodes) {
      if (focusId && n.motifId && n.motifId !== focusId) continue
      if (!n.valid || n.accepted === false) continue

      if (showGrowthNodes || n.role === BRANCH_ROLES.INITIATION) {
        nodes.push({
          id: n.id,
          position: n.position,
          color: branchColor(n.role),
          scale: n.role === BRANCH_ROLES.INITIATION ? 0.05 : 0.02,
        })
      }
      if (showSurfaceNormals || (showMotifDebug && focusId)) {
        normals.push({
          id: `n-${n.id}`,
          points: [
            n.position,
            [
              n.position[0] + n.surfaceNormal[0] * 0.1,
              n.position[1] + n.surfaceNormal[1] * 0.1,
              n.position[2] + n.surfaceNormal[2] * 0.1,
            ],
          ],
        })
      }
      if (showGrowthDirections && n.role !== BRANCH_ROLES.INITIATION) {
        dirs.push({
          id: `d-${n.id}`,
          points: [
            n.position,
            [
              n.position[0] + n.growthDirection[0] * 0.09,
              n.position[1] + n.growthDirection[1] * 0.09,
              n.position[2] + n.growthDirection[2] * 0.09,
            ],
          ],
        })
      }
      if (showMotifDebug && n.surfaceAttachment && focusId) {
        projections.push({
          id: `p-${n.id}`,
          points: [
            n.position,
            [
              n.position[0] - n.surfaceNormal[0] * 0.04,
              n.position[1] - n.surfaceNormal[1] * 0.04,
              n.position[2] - n.surfaceNormal[2] * 0.04,
            ],
          ],
        })
      }
    }

    if (showInvalidSegments) {
      for (const seg of skeleton.rejectedSegments ?? []) {
        if (focusId && seg.motifId && seg.motifId !== focusId) continue
        if (!seg.from || !seg.to) continue
        invalid.push({
          id: seg.id,
          points: [seg.from, seg.to],
          reason: seg.reason,
        })
      }
    }

    if (showMotifDebug) {
      const list = focus ? [focus] : motifs
      for (const m of list) {
        const wire = boundsWire(m.bounds)
        if (wire) {
          bounds.push({ id: `bnd-${m.id}`, points: wire })
        }
        if (m.localSymmetryOrigin && m.localSymmetryAxis) {
          const o = m.localSymmetryOrigin
          const a = m.localSymmetryAxis
          axes.push({
            id: `sym-${m.id}`,
            points: [
              [o[0] - a[0] * 0.35, o[1] - a[1] * 0.35, o[2] - a[2] * 0.35],
              [o[0] + a[0] * 0.55, o[1] + a[1] * 0.55, o[2] + a[2] * 0.55],
            ],
          })
        }
        if (m.origin) {
          nodes.push({
            id: `motif-anchor-${m.id}`,
            position: m.origin,
            color: COLORS.symmetry,
            scale: 0.06,
          })
          labels.push({
            id: `motif-lbl-${m.id}`,
            position: [m.origin[0], m.origin[1] + 0.12, m.origin[2]],
            text: `${m.kind}`,
            color: COLORS.symmetry,
          })
        }
      }
    }

    return { lines, nodes, normals, dirs, invalid, labels, bounds, axes, projections }
  }, [
    skeleton,
    showGrowthNodes,
    showBranchIds,
    showSurfaceNormals,
    showGrowthDirections,
    showInvalidSegments,
    showMotifDebug,
    inspectMotifIndex,
  ])

  if (!skeleton) return null

  const empty = skeleton.diagnostics?.emptyReason
  const bannerPos = skeleton.nodes?.[0]?.position ?? [0, 1.6, 0.2]
  const motifCount = skeleton.motifs?.length ?? 0

  return (
    <group name="foliate-ornament-skeleton">
      {showLabel ? (
        <Html position={[bannerPos[0], bannerPos[1] + 0.35, bannerPos[2]]} center style={{ pointerEvents: 'none' }}>
          <div className="grammar-warning-banner" style={{ opacity: 0.92, maxWidth: 300 }}>
            {empty
              ? empty
              : showMotifDebug
                ? `MOTIF DEBUG · ${motifCount} motifs · inspect #${inspectMotifIndex}`
                : 'ORNAMENT GROWTH SKELETON — CONSTRUCTION PREVIEW'}
          </div>
        </Html>
      ) : null}

      {elements.bounds.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.motifBounds}
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.03}
          transparent
          opacity={0.65}
        />
      ))}
      {elements.axes.map((ln) => (
        <Line key={ln.id} points={ln.points} color={COLORS.symmetry} lineWidth={1.6} transparent opacity={0.85} />
      ))}
      {elements.projections.map((ln) => (
        <Line key={ln.id} points={ln.points} color={COLORS.projection} lineWidth={1} transparent opacity={0.55} />
      ))}

      {elements.lines.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={ln.color}
          lineWidth={ln.width}
          transparent
          opacity={0.96}
          depthTest={false}
          renderOrder={2}
        />
      ))}

      {elements.invalid.map((ln) => (
        <Line
          key={ln.id}
          points={ln.points}
          color={COLORS.invalid}
          lineWidth={1.2}
          dashed
          dashSize={0.04}
          gapSize={0.03}
          transparent
          opacity={0.75}
        />
      ))}

      {elements.normals.map((ln) => (
        <Line key={ln.id} points={ln.points} color={COLORS.normal} lineWidth={1} transparent opacity={0.7} />
      ))}
      {elements.dirs.map((ln) => (
        <Line key={ln.id} points={ln.points} color={COLORS.direction} lineWidth={1} transparent opacity={0.7} />
      ))}

      {elements.nodes.map((n) => (
        <Sphere key={n.id} args={[n.scale, 10, 10]} position={n.position}>
          <meshBasicMaterial color={n.color} transparent opacity={0.95} depthTest={false} />
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
