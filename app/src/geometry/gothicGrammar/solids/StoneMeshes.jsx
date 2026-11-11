/**
 * Three.js mesh presentation for Step 13D / 13D.1 stone assemblies.
 * Uses precomputed hard-edge normals when present (planar front/back).
 */

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { MESH_GROUPS } from './stoneAssembly.js'
import NetworkGraphOverlay from './NetworkGraphOverlay.jsx'
import SectionOverlay from './SectionOverlay.jsx'

const STONE_COLOR = '#b9b0a4'
const MOLDING_COLOR = '#9e958a'
const DIAGNOSTIC_COLOR = '#c4bbb0'

function meshDataToBufferGeometry(meshData) {
  const geo = new THREE.BufferGeometry()
  const pos = meshData.positions
  const idx = meshData.indices
  const positions = new Float32Array(pos.length)
  for (let i = 0; i < pos.length; i += 1) positions[i] = pos[i]
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(idx), 1))

  if (meshData.normals?.length === pos.length) {
    const normals = new Float32Array(meshData.normals.length)
    for (let i = 0; i < meshData.normals.length; i += 1) normals[i] = meshData.normals[i]
    geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  } else {
    geo.computeVertexNormals()
  }
  return geo
}

function DisposableMesh({
  meshData,
  color,
  opacity = 1,
  displayMode = 'solid',
  visible = true,
  flatShading = false,
  diagnostic = false,
}) {
  const geo = useMemo(() => meshDataToBufferGeometry(meshData), [meshData])
  const matRef = useRef(null)

  useEffect(() => () => {
    geo.dispose()
  }, [geo])

  useEffect(() => {
    const mat = matRef.current
    if (!mat) return
    mat.wireframe = displayMode === 'wireframe' || displayMode === 'wireframe-debug'
    mat.needsUpdate = true
  }, [displayMode])

  const showEdges = displayMode === 'solid+edges'
  const edges = useMemo(() => {
    if (!showEdges) return null
    return new THREE.EdgesGeometry(geo, 20)
  }, [geo, showEdges])

  useEffect(() => {
    if (!edges) return undefined
    return () => edges.dispose()
  }, [edges])

  if (!visible) return null

  const wire = displayMode === 'wireframe' || displayMode === 'wireframe-debug'

  return (
    <group>
      <mesh geometry={geo} castShadow={false} receiveShadow={false}>
        <meshStandardMaterial
          ref={matRef}
          color={diagnostic ? DIAGNOSTIC_COLOR : color}
          roughness={diagnostic ? 0.92 : 0.82}
          metalness={0.0}
          flatShading={flatShading || Boolean(meshData.normals)}
          transparent={opacity < 1}
          opacity={opacity}
          side={THREE.FrontSide}
          wireframe={wire}
        />
      </mesh>
      {showEdges && edges ? (
        <lineSegments geometry={edges}>
          <lineBasicMaterial color="#2a2622" transparent opacity={0.55} />
        </lineSegments>
      ) : null}
    </group>
  )
}

function NormalHelper({ meshData, visible, length = 0.06 }) {
  const lines = useMemo(() => {
    if (!visible || !meshData) return null
    const geo = meshDataToBufferGeometry(meshData)
    const pos = geo.attributes.position
    const nor = geo.attributes.normal
    if (!nor) {
      geo.dispose()
      return null
    }
    const pts = []
    const step = Math.max(1, Math.floor(pos.count / 500))
    for (let i = 0; i < pos.count; i += step) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      pts.push(x, y, z, x + nor.getX(i) * length, y + nor.getY(i) * length, z + nor.getZ(i) * length)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    geo.dispose()
    return g
  }, [meshData, visible, length])

  useEffect(() => {
    if (!lines) return undefined
    return () => lines.dispose()
  }, [lines])

  if (!visible || !lines) return null
  return (
    <lineSegments geometry={lines}>
      <lineBasicMaterial color="#5a8fbf" transparent opacity={0.7} />
    </lineSegments>
  )
}

/**
 * Render STRUCTURAL_STONE + DECORATIVE_MOLDINGS (+ 13D.3 network / section).
 * inspectLayer: combined | structural | moldings | network-graph | section | normals | wireframe-debug
 */
export default function StoneMeshes({
  assembly,
  displayMode = 'solid',
  showStructural = true,
  showMoldings = true,
  showNormals = false,
  inspectLayer = 'combined',
  showNetworkIds = false,
  showNetworkWidths = true,
  hierarchyColoring = false,
  graphUnavailable = false,
  graphFallbackNote = null,
}) {
  if (!assembly?.ok && !assembly?.structural && !assembly?.solidVoid) {
    return (
      <group name={MESH_GROUPS.STRUCTURAL_STONE}>
        <Html center style={{ pointerEvents: 'none' }}>
          <div className="grammar-invalid-banner">Stone geometry unavailable</div>
        </Html>
      </group>
    )
  }

  const structural = assembly.structural
  const decorative = assembly.decorative ?? []
  const network = assembly.solidVoid?.skeleton ?? assembly.solidVoid?.network
  const solidVoid = assembly.solidVoid

  const layer = inspectLayer ?? 'combined'
  const forceWire = layer === 'wireframe-debug'
  const mode = forceWire ? 'wireframe-debug' : displayMode
  const networkMode = layer === 'network-graph'
  const sectionMode = layer === 'section'
  const wantStructural =
    showStructural &&
    !networkMode &&
    !sectionMode &&
    (layer === 'combined' ||
      layer === 'structural' ||
      layer === 'normals' ||
      layer === 'wireframe-debug')
  const wantMoldings =
    showMoldings &&
    !networkMode &&
    !sectionMode &&
    (layer === 'combined' || layer === 'moldings' || layer === 'wireframe-debug')
  const wantNormals = showNormals || layer === 'normals'
  const diagnostic = layer === 'structural' || layer === 'moldings' || layer === 'normals'
  const showGraphMissing =
    networkMode && (graphUnavailable || (!network && !graphFallbackNote))

  return (
    <group name={MESH_GROUPS.STRUCTURAL_STONE}>
      {structural ? (
        <group name="structural">
          <DisposableMesh
            meshData={structural}
            color={STONE_COLOR}
            displayMode={mode}
            visible={wantStructural}
            diagnostic={diagnostic}
          />
          <NormalHelper meshData={structural} visible={wantNormals && wantStructural} />
        </group>
      ) : null}
      <group name={MESH_GROUPS.DECORATIVE_MOLDINGS}>
        {decorative.map((mesh, i) => (
          <DisposableMesh
            key={`mold-${i}`}
            meshData={mesh}
            color={MOLDING_COLOR}
            displayMode={mode}
            visible={wantMoldings}
            opacity={0.98}
            diagnostic={diagnostic}
          />
        ))}
      </group>
      <NetworkGraphOverlay
        network={network}
        visible={networkMode && Boolean(network)}
        showIds={showNetworkIds}
        showWidths={showNetworkWidths}
        hierarchyColoring={hierarchyColoring === true}
      />
      <SectionOverlay solidVoid={solidVoid} visible={sectionMode && Boolean(solidVoid)} />
      {showGraphMissing ? (
        <Html center style={{ pointerEvents: 'none' }}>
          <div className="grammar-warning-banner">
            Graph unavailable for this preset
          </div>
        </Html>
      ) : null}
      {networkMode && graphFallbackNote ? (
        <Html position={[0, -0.55, 0.08]} center style={{ pointerEvents: 'none' }}>
          <div className="grammar-warning-banner">{graphFallbackNote}</div>
        </Html>
      ) : null}
    </group>
  )
}

export { meshDataToBufferGeometry, STONE_COLOR, MOLDING_COLOR }
