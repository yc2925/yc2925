import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { sweepPaths } from './paths.js'
import { PATH_COLORS } from './settings.js'
import { SHAPE, pointGeometry } from './points.js'
import PointMaterial from './PointMaterial.jsx'

function useDisposable(geometry) {
  useEffect(() => () => geometry?.dispose(), [geometry])
  return geometry
}

const USED = new THREE.Color('#ff2020')
const UNUSED = new THREE.Color('#a31318')

function AnchorLayer({ candidates, primaries, used, visible }) {
  const geometry = useDisposable(
    useMemo(() => {
      const usedSet = new Set(used)
      const order = [...primaries.filter((i) => !usedSet.has(i)), ...used]
      const n = order.length
      const positions = new Float32Array(n * 3)
      const colors = new Float32Array(n * 3)
      const sizes = new Float32Array(n)
      const shapes = new Float32Array(n).fill(SHAPE.TARGET)
      order.forEach((index, k) => {
        const color = usedSet.has(index) ? USED : UNUSED
        positions.set(candidates.positions.subarray(index * 3, index * 3 + 3), k * 3)
        colors[k * 3] = color.r
        colors[k * 3 + 1] = color.g
        colors[k * 3 + 2] = color.b
        sizes[k] = usedSet.has(index) ? 13 : 8
      })
      return pointGeometry(positions, colors, sizes, shapes)
    }, [candidates, primaries, used]),
  )
  return (
    <points geometry={geometry} visible={visible} renderOrder={4}>
      <PointMaterial />
    </points>
  )
}

export function PathTubes({ paths, offset, visible }) {
  const geometry = useDisposable(
    useMemo(() => sweepPaths(paths, { profile: 'round', offset, colors: PATH_COLORS }), [paths, offset]),
  )
  return (
    <mesh geometry={geometry} visible={visible}>
      <meshStandardMaterial vertexColors roughness={0.55} metalness={0} />
    </mesh>
  )
}

function Relief({ paths, width, visible }) {
  const geometry = useDisposable(
    useMemo(() => sweepPaths(paths, { profile: 'relief', width }), [paths, width]),
  )
  return (
    <mesh geometry={geometry} visible={visible}>
      <meshStandardMaterial color="#6e6e6a" roughness={0.88} metalness={0} />
    </mesh>
  )
}

function SourceCurve({ projection, visible }) {
  const { curve, frame, rays } = useMemo(() => {
    const line = new THREE.BufferGeometry().setFromPoints(projection.source)
    const box = new THREE.BufferGeometry().setFromPoints([...projection.frame, projection.frame[0]])
    const rayGeometry = new THREE.BufferGeometry().setFromPoints(projection.rays.flat())
    return { curve: line, frame: box, rays: rayGeometry }
  }, [projection])
  useDisposable(curve)
  useDisposable(frame)
  useDisposable(rays)
  return (
    <group visible={visible}>
      <line geometry={frame}>
        <lineBasicMaterial color="#3f3f3f" />
      </line>
      <line geometry={curve}>
        <lineBasicMaterial color="#e8e8e8" />
      </line>
      <lineSegments geometry={rays}>
        <lineBasicMaterial color="#5c5c5c" transparent opacity={0.55} />
      </lineSegments>
    </group>
  )
}

export default function PathsScene({ candidates, primaries, used, paths, projection, display }) {
  return (
    <group>
      <AnchorLayer candidates={candidates} primaries={primaries} used={used} visible={display.showAnchors} />
      <PathTubes paths={paths} offset={display.surfaceOffset} visible={display.showPaths} />
      <Relief paths={paths} width={display.reliefWidth} visible={display.showRelief} />
      {projection ? (
        <>
          <SourceCurve projection={projection} visible={display.showSourceCurve} />
          <PathTubes
            paths={projection.projected}
            offset={display.surfaceOffset}
            visible={display.showSourceCurve}
          />
          <Relief
            paths={projection.projected}
            width={display.reliefWidth}
            visible={display.showSourceCurve && display.showRelief}
          />
        </>
      ) : null}
    </group>
  )
}
