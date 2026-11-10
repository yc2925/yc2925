/**
 * 2D/3D overlay of the semantic bar-network graph (Step 13D.3 / 13D.9).
 * Color-codes member classes; optional hierarchy-level coloring; junction IDs / width labels.
 */

import { useMemo } from 'react'
import { Line, Text } from '@react-three/drei'
import { NETWORK_MEMBER_COLORS } from '../tracery/barNetworkTypes.js'

/** Hierarchy inspection colors (Network Graph only — never final stone). */
export const HIERARCHY_COLORS = Object.freeze({
  0: '#c4b49a', // LEVEL 0 — parent
  1: '#6ea8d8', // LEVEL 1 — secondary arches
  2: '#7ec8a0', // LEVEL 2 — tertiary arches
  foil: '#d4a0c8', // FOIL — trefoil/quatrefoil
})

function memberColor(type) {
  return NETWORK_MEMBER_COLORS[type] ?? '#888888'
}

function hierarchyColorForMember(m) {
  const meta = m.metadata ?? {}
  if (meta.hierarchyLevel === 'foil' || meta.hierarchy === 'foil' || m.type === 'FOIL_BAR') {
    return HIERARCHY_COLORS.foil
  }
  if (meta.role === 'bay-head-ring' || m.memberClass === 'FOIL_BAR') {
    return HIERARCHY_COLORS.foil
  }
  const level = meta.hierarchyLevel
  if (level === 2 || level === '2') return HIERARCHY_COLORS[2]
  if (level === 1 || level === '1') return HIERARCHY_COLORS[1]
  return HIERARCHY_COLORS[0]
}

function samplesToPositions(samples, z = 0.02) {
  const out = []
  for (const p of samples) out.push(p.x, p.y, z)
  return out
}

export default function NetworkGraphOverlay({
  network,
  visible = true,
  showIds = false,
  showWidths = true,
  hierarchyColoring = false,
  z = 0.04,
}) {
  const elements = useMemo(() => {
    if (!network?.members) return { lines: [], nodes: [], labels: [] }
    const lines = []
    const nodes = []
    const labels = []

    for (const m of Object.values(network.members)) {
      const samples = network.memberSamples?.[m.id]
      if (!samples?.length) continue
      const color = hierarchyColoring ? hierarchyColorForMember(m) : memberColor(m.type)
      lines.push({
        id: m.id,
        positions: samplesToPositions(samples, z),
        color,
        width: Math.max(1, (m.width ?? 0.05) * 40),
        memberWidth: m.width,
        type: m.type,
      })
      if (showWidths && samples.length) {
        const mid = samples[Math.floor(samples.length / 2)]
        const levelTag =
          hierarchyColoring && m.metadata?.hierarchyLevel != null
            ? `\nL${m.metadata.hierarchyLevel}`
            : ''
        labels.push({
          id: `${m.id}-w`,
          position: [mid.x, mid.y, z + 0.02],
          text: `${m.type.replace(/_/g, ' ')}\n${(m.width ?? 0).toFixed(3)} m${levelTag}`,
          color,
        })
      }
    }

    for (const n of Object.values(network.nodes)) {
      nodes.push({
        id: n.id,
        position: [n.position.x, n.position.y, z + 0.01],
        type: n.type,
      })
      if (showIds) {
        const parent = n.parentConstructionId ? `\n← ${n.parentConstructionId}` : ''
        labels.push({
          id: `${n.id}-id`,
          position: [n.position.x, n.position.y + 0.04, z + 0.03],
          text: `${n.id.replace(/^node-/, '')}${parent}`,
          color: '#d8d0c4',
        })
      }
    }

    // Optional cell parent-child labels when hierarchy inspection is on
    if (hierarchyColoring && network.cells) {
      for (const cell of Object.values(network.cells)) {
        if (!cell.fieldArch?.points) continue
        const apex = cell.fieldArch.points.APEX
        if (!apex) continue
        labels.push({
          id: `cell-${cell.id}`,
          position: [apex.x, apex.y + 0.08, z + 0.05],
          text: `${cell.id}\nL${cell.hierarchyLevel}${cell.parentId ? ` ← ${cell.parentId}` : ''}`,
          color: HIERARCHY_COLORS[cell.hierarchyLevel] ?? HIERARCHY_COLORS[0],
        })
      }
    }

    return { lines, nodes, labels }
  }, [network, showIds, showWidths, hierarchyColoring, z])

  if (!visible || !network) return null

  return (
    <group name="bar-network-graph">
      {elements.lines.map((ln) => (
        <Line
          key={ln.id}
          points={(() => {
            const pts = []
            for (let i = 0; i < ln.positions.length; i += 3) {
              pts.push([ln.positions[i], ln.positions[i + 1], ln.positions[i + 2]])
            }
            return pts
          })()}
          color={ln.color}
          lineWidth={Math.min(4, Math.max(1.2, ln.width * 0.08))}
          transparent
          opacity={0.95}
        />
      ))}
      {elements.nodes.map((n) => (
        <mesh key={n.id} position={n.position}>
          <sphereGeometry args={[0.025, 10, 10]} />
          <meshBasicMaterial color="#e8e0d4" />
        </mesh>
      ))}
      {elements.labels.map((lb) => (
        <Text
          key={lb.id}
          position={lb.position}
          fontSize={0.045}
          color={lb.color}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#111"
        >
          {lb.text}
        </Text>
      ))}
    </group>
  )
}
