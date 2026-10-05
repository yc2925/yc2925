import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ANCHOR } from './distribution.js'
import { ANCHOR_STYLE } from './settings.js'
import { SHAPE, pointGeometry } from './points.js'
import PointMaterial from './PointMaterial.jsx'
import PathsScene from './PathsScene.jsx'
import FieldScene from './FieldScene.jsx'

function useDisposable(geometry) {
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

function Architecture({ facade }) {
  const { surface, edges } = useMemo(() => {
    const merged = mergeGeometries(facade.parts.map((part) => part.geometry), false)
    return { surface: merged, edges: new THREE.EdgesGeometry(merged, 40) }
  }, [facade])
  useDisposable(surface)
  useDisposable(edges)
  return (
    <group>
      <mesh geometry={surface}>
        <meshStandardMaterial
          color="#62625f"
          roughness={0.92}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#2a2a2a" />
      </lineSegments>
    </group>
  )
}

function CandidateLayer({ candidates, visible }) {
  const geometry = useDisposable(
    useMemo(() => {
      const n = candidates.count
      const colors = new Float32Array(n * 3).fill(0.36)
      return pointGeometry(candidates.positions, colors, new Float32Array(n).fill(2), new Float32Array(n))
    }, [candidates]),
  )
  return (
    <points geometry={geometry} visible={visible} renderOrder={1}>
      <PointMaterial />
    </points>
  )
}

function SuitabilityLayer({ candidates, suitability, visible, dim }) {
  const geometry = useDisposable(
    useMemo(() => {
      const n = candidates.count
      const colors = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      for (let i = 0; i < n; i += 1) {
        const s = suitability[i]
        const v = 0.06 + 0.8 * s ** 1.6
        colors[i * 3] = v
        colors[i * 3 + 1] = v
        colors[i * 3 + 2] = v
        sizes[i] = 1.6 + 2.6 * s
      }
      return pointGeometry(candidates.positions, colors, sizes, new Float32Array(n))
    }, [candidates, suitability]),
  )
  return (
    <points geometry={geometry} visible={visible} renderOrder={2}>
      <PointMaterial dim={dim} />
    </points>
  )
}

const ANCHOR_DRAW = {
  [ANCHOR.PRIMARY]: { color: new THREE.Color(ANCHOR_STYLE.primary.color), size: 13, shape: SHAPE.TARGET },
  [ANCHOR.SECONDARY]: { color: new THREE.Color(ANCHOR_STYLE.secondary.color), size: 6, shape: SHAPE.SQUARE },
  [ANCHOR.TERMINAL]: { color: new THREE.Color(ANCHOR_STYLE.terminal.color), size: 4, shape: SHAPE.CIRCLE },
}

function AcceptedLayer({ candidates, classes, visible }) {
  const geometry = useDisposable(
    useMemo(() => {
      const order = []
      // Terminal first so primaries draw on top.
      for (const kind of [ANCHOR.TERMINAL, ANCHOR.SECONDARY, ANCHOR.PRIMARY]) {
        for (let i = 0; i < candidates.count; i += 1) if (classes[i] === kind) order.push(i)
      }
      const n = order.length
      const positions = new Float32Array(n * 3)
      const colors = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      const shapes = new Float32Array(n)
      order.forEach((index, k) => {
        const draw = ANCHOR_DRAW[classes[index]]
        positions.set(candidates.positions.subarray(index * 3, index * 3 + 3), k * 3)
        colors[k * 3] = draw.color.r
        colors[k * 3 + 1] = draw.color.g
        colors[k * 3 + 2] = draw.color.b
        sizes[k] = draw.size
        shapes[k] = draw.shape
      })
      return pointGeometry(positions, colors, sizes, shapes)
    }, [candidates, classes]),
  )
  return (
    <points geometry={geometry} visible={visible} renderOrder={3}>
      <PointMaterial />
    </points>
  )
}

export default function GrowthScene({ facade, result, display, pathResult, projection, field }) {
  const distribution = display.study === 'distribution'
  const isField = display.study === 'field'
  return (
    <group>
      <Architecture facade={facade} />
      <CandidateLayer candidates={result.candidates} visible={distribution && display.showCandidates} />
      <SuitabilityLayer
        candidates={result.candidates}
        suitability={result.suitability}
        visible={distribution && display.showSuitability}
        dim={display.showAccepted ? 0.45 : 1}
      />
      <AcceptedLayer
        candidates={result.candidates}
        classes={result.selection.classes}
        visible={distribution && display.showAccepted}
      />
      {isField && field ? (
        <FieldScene
          cache={field.cache}
          emitters={field.emitters}
          paths={pathResult?.paths ?? null}
          display={display}
        />
      ) : null}
      {display.study === 'paths' && pathResult ? (
        <PathsScene
          candidates={result.candidates}
          primaries={pathResult.primaries}
          used={pathResult.used}
          paths={pathResult.paths}
          projection={projection}
          display={display}
        />
      ) : null}
    </group>
  )
}
