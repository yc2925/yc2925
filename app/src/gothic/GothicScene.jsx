import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DESIGN_LAYER_COLORS, sampleCurve } from './typologies/windowDesign2d.js'
import { createStoneMaterial } from './stoneMaterial.js'

/** Orthographic 2D Design — flat curve network with optional layer toggles. */
function Design2D({ design, layers }) {
  const { lines, nodes } = useMemo(() => {
    if (!design?.curves) return { lines: [], nodes: [] }
    const show = layers ?? { frame: true, mullion: true, secondary: true, junction: true }

    const linesOut = design.curves
      .filter((c) => show[c.layer] !== false)
      .map((curve) => {
        const span = curve.kind === 'arc' ? Math.abs(curve.a1 - curve.a0) : 0
        const pts = sampleCurve(curve, span > Math.PI ? 48 : 28)
        const positions = new Float32Array(pts.length * 3)
        pts.forEach(([x, y], i) => {
          positions[i * 3] = x
          positions[i * 3 + 1] = y
          positions[i * 3 + 2] = 0
        })
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        const color = curve.color ?? DESIGN_LAYER_COLORS[curve.layer] ?? '#e8e8e8'
        const material = new THREE.LineBasicMaterial({ color, depthTest: true })
        return { id: curve.id, object: new THREE.Line(geometry, material) }
      })

    const nodesOut =
      show.junction === false
        ? []
        : (design.junctions ?? []).map((j) => ({
            id: j.id,
            position: [j.x, j.y, 0.01],
            color: j.color ?? DESIGN_LAYER_COLORS.junction,
          }))

    return { lines: linesOut, nodes: nodesOut }
  }, [design, layers])

  useEffect(
    () => () => {
      for (const { object } of lines) {
        object.geometry.dispose()
        object.material.dispose()
      }
    },
    [lines],
  )

  return (
    <group>
      {lines.map(({ id, object }) => (
        <primitive key={id} object={object} />
      ))}
      {nodes.map((n) => (
        <mesh key={n.id} position={n.position}>
          <sphereGeometry args={[0.032, 10, 8]} />
          <meshBasicMaterial color={n.color} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * SKELETON — exact centerlines used to sweep the 3D solids.
 * Perspective-friendly; solids hidden. Same composition as SOLID.
 */
function Skeleton3D({ skeleton }) {
  const lines = useMemo(() => {
    if (!skeleton?.length) return []
    return skeleton.map((edge) => {
      const pts = edge.points
      const positions = new Float32Array(pts.length * 3)
      pts.forEach((p, i) => {
        positions[i * 3] = p.x
        positions[i * 3 + 1] = p.y
        positions[i * 3 + 2] = p.z
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      const material = new THREE.LineBasicMaterial({
        color: edge.color ?? '#e8e8e8',
        depthTest: true,
      })
      return { id: edge.id, object: new THREE.Line(geometry, material) }
    })
  }, [skeleton])

  useEffect(
    () => () => {
      for (const { object } of lines) {
        object.geometry.dispose()
        object.material.dispose()
      }
    },
    [lines],
  )

  return (
    <group>
      {lines.map(({ id, object }) => (
        <primitive key={id} object={object} />
      ))}
    </group>
  )
}

/** Renders a specimen from generateArchitecture(). */
export default function GothicScene({ specimen, displayMode, designLayers, stone }) {
  const wire = displayMode === 'wireframe'
  const designMode = displayMode === 'design'
  const skeletonMode = displayMode === 'skeleton'
  const design = specimen.meta?.design2d
  const skeleton = specimen.meta?.skeleton

  const stoneMat = useMemo(
    () =>
      createStoneMaterial({
        stoneColor: stone?.color ?? '#c4bfb4',
        stoneRoughness: stone?.roughness ?? 0.78,
        surfaceVariation: stone?.variation ?? 0.25,
        wireframe: wire,
      }),
    [stone?.color, stone?.roughness, stone?.variation, wire],
  )

  useEffect(
    () => () => {
      stoneMat.dispose()
    },
    [stoneMat],
  )

  // 2D Design — orthographic flat graph (window only).
  if (designMode && design) {
    return <Design2D design={design} layers={designLayers} />
  }

  // Skeleton — exact solid centerlines; hide stone.
  if (skeletonMode) {
    if (skeleton?.length) {
      return <Skeleton3D skeleton={skeleton} />
    }
    // Fallback: flat design graph if skeleton not built (should not happen for window).
    if (design) {
      return (
        <Design2D
          design={design}
          layers={{ frame: true, mullion: true, secondary: true, junction: false }}
        />
      )
    }
    return null
  }

  return (
    <group>
      {specimen.meshes.map((part) => (
        <mesh key={part.id} geometry={part.geometry} material={stoneMat} castShadow receiveShadow />
      ))}
    </group>
  )
}
