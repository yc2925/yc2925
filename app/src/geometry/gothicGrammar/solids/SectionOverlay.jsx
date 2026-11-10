/**
 * Stone / void SECTION display for Step 13D.3.
 * Solid = gray, openings = dark cutouts. No decorative overlays.
 */

import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { REGION_TYPES } from '../tracery/regionRoles.js'

export default function SectionOverlay({ solidVoid, visible = true }) {
  const geo = useMemo(() => {
    if (!solidVoid?.regions?.[REGION_TYPES.OUTER_BOUNDARY]) return null
    const outer = solidVoid.regions[REGION_TYPES.OUTER_BOUNDARY].samples
    if (!outer?.length) return null

    const shape = new THREE.Shape()
    shape.moveTo(outer[0].x, outer[0].y)
    for (let i = 1; i < outer.length; i += 1) shape.lineTo(outer[i].x, outer[i].y)
    shape.closePath()

    const holeKeys = solidVoid.holes ?? []
    for (const key of holeKeys) {
      const samples = solidVoid.regions[key]?.samples
      if (!samples?.length) continue
      const hole = new THREE.Path()
      hole.moveTo(samples[0].x, samples[0].y)
      for (let i = 1; i < samples.length; i += 1) hole.lineTo(samples[i].x, samples[i].y)
      hole.closePath()
      shape.holes.push(hole)
    }

    const g = new THREE.ShapeGeometry(shape, 8)
    g.translate(0, 0, 0.001)
    return g
  }, [solidVoid])

  useEffect(() => {
    if (!geo) return undefined
    return () => geo.dispose()
  }, [geo])

  if (!visible || !geo) return null

  return (
    <group name="stone-void-section">
      {/* Dark void plate behind */}
      <mesh position={[0, 1.2, -0.002]} rotation={[0, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshBasicMaterial color="#12100e" />
      </mesh>
      <mesh geometry={geo}>
        <meshBasicMaterial color="#9a9288" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
