/**
 * Step 12B — LOD debug overlay: bounds + projected-size thresholds (visual only).
 */

import { useMemo } from 'react'
import * as THREE from 'three'
import { envelopeFromBounds } from './screenSpace.js'
import { LOD_LABELS } from './config.js'

function BoundsWire({ min, max, color = '#c8a84a' }) {
  const geom = useMemo(() => {
    const box = new THREE.BoxGeometry(
      Math.max(0.05, max.x - min.x),
      Math.max(0.05, max.y - min.y),
      Math.max(0.05, max.z - min.z),
    )
    return box
  }, [min.x, min.y, min.z, max.x, max.y, max.z])
  const cx = (min.x + max.x) * 0.5
  const cy = (min.y + max.y) * 0.5
  const cz = (min.z + max.z) * 0.5
  return (
    <mesh position={[cx, cy, cz]} geometry={geom}>
      <meshBasicMaterial color={color} wireframe transparent opacity={0.55} depthTest={false} />
    </mesh>
  )
}

const LOD_COLORS = { high: '#6ecf8e', medium: '#c8a84a', low: '#a31318' }

/**
 * @param {{
 *   bounds: object,
 *   level?: string,
 *   projectedFrac?: number,
 *   thresholds?: { highMin: number, mediumMin: number },
 *   visible?: boolean,
 * }} props
 */
export default function LodDebug({
  bounds,
  level = 'high',
  projectedFrac = 0,
  thresholds = { highMin: 0.42, mediumMin: 0.18 },
  visible = false,
}) {
  if (!visible) return null
  const { min, max } = envelopeFromBounds(bounds)
  const color = LOD_COLORS[level] ?? '#c8a84a'

  return (
    <group name="LodDebug" userData={{ lodDebug: true, exportOmit: true }}>
      <BoundsWire min={min} max={max} color={color} />
      {/* Threshold markers as small ticks at object center — informational */}
      <mesh position={[(min.x + max.x) * 0.5, max.y + 0.15, (min.z + max.z) * 0.5]}>
        <boxGeometry args={[0.2, 0.04, 0.04]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      <group userData={{
        lodLevel: level,
        lodLabel: LOD_LABELS[level],
        projectedFrac,
        highMin: thresholds.highMin,
        mediumMin: thresholds.mediumMin,
      }} />
    </group>
  )
}
