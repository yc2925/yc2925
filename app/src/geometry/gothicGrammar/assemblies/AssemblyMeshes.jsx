/**
 * Render a multi-object Gothic facade assembly (Steps 13E.1 / 13E.2).
 * Window modules reuse StoneMeshes; supports use hierarchy-tinted MeshData.
 */

import { useEffect, useMemo, useRef } from 'react'
import StoneMeshes, { meshDataToBufferGeometry } from '../solids/StoneMeshes.jsx'

const SUPPORT_COLOR = '#a8a094'
// Distinct hierarchy tints so shaft / setback / base edits read in screenshots.
const HIERARCHY_COLORS = {
  PRIMARY: '#9a9184',
  SECONDARY: '#d2c6b4', // engaged shafts + setback stages (lighter)
  TERTIARY: '#7f7468', // bases / capitals / tables (darker)
}

function SupportPartMesh({ meshData, color = SUPPORT_COLOR, visible = true }) {
  const geo = useMemo(() => meshDataToBufferGeometry(meshData), [meshData])
  useEffect(() => () => geo.dispose(), [geo])
  if (!visible || !meshData) return null
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color={color}
        roughness={0.82}
        metalness={0.05}
        flatShading
      />
    </mesh>
  )
}

/**
 * @param {{ facade: object, displayMode?: string, showSupports?: boolean, inspectLayer?: string, showGraphLabels?: boolean }} props
 */
export default function AssemblyMeshes({
  facade,
  displayMode = 'solid',
  showSupports = true,
  inspectLayer = 'combined',
  showGraphLabels = false,
}) {
  if (!facade?.ok && !facade?.windowModules?.length) return null

  const graphMode = inspectLayer === 'assembly-graph'
  const wantSupports = showSupports && facade.parameters?.showStructuralSupports !== false

  return (
    <group name="gothic-facade-assembly">
      {(facade.windowModules ?? []).map((mod) => {
        const [x, y, z] = mod.transform?.position ?? [0, 0, 0]
        return (
          <group key={mod.id} name={mod.id} position={[x, y, z]}>
            <StoneMeshes
              assembly={mod.assembly}
              displayMode={displayMode}
              showStructural
              showMoldings={false}
              showNormals={false}
              inspectLayer={graphMode ? 'combined' : inspectLayer}
            />
            {showGraphLabels || graphMode ? (
              <HtmlBayLabel
                text={mod.id.replace(/^.*bay-/, 'BAY-').replace(/-window$/, '')}
                y={(mod.height ?? 2) + 0.15}
              />
            ) : null}
          </group>
        )
      })}

      {wantSupports
        ? (facade.supports ?? []).flatMap((pier) =>
            (pier?.parts ?? []).map((part) => {
              // Include bounding fingerprint so parameter edits always remount buffers
              // (avoids stale BufferGeometry when part.id is stable across rebuilds).
              const fp = `${part.boundingMin?.join(',')}|${part.boundingMax?.join(',')}`
              return (
                <SupportPartMesh
                  key={`${facade.id}:${part.id}:${fp}`}
                  meshData={part.mesh}
                  color={HIERARCHY_COLORS[part.hierarchy] ?? SUPPORT_COLOR}
                  visible
                />
              )
            }),
          )
        : null}

      {facade.baseCourse?.parts?.map((part) => (
        <SupportPartMesh
          key={`${facade.id}:${part.id}`}
          meshData={part.mesh}
          color="#9a9288"
        />
      ))}

      {graphMode ? (
        <group name="assembly-graph-markers">
          {(facade.bays ?? []).map((bay) => (
            <mesh key={`g-${bay.id}`} position={[bay.localOrigin[0], bay.bayHeight * 0.5, 0.4]}>
              <sphereGeometry args={[0.08, 10, 10]} />
              <meshBasicMaterial color="#6ea8d8" />
            </mesh>
          ))}
          {(facade.supports ?? []).map((pier) => (
            <mesh
              key={`gp-${pier.id}`}
              position={[pier.x, (pier.pierHeight ?? 3) * 0.5, 0.35]}
            >
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color="#c4b49a" />
            </mesh>
          ))}
        </group>
      ) : null}
    </group>
  )
}

function HtmlBayLabel({ text, y = 0 }) {
  const ref = useRef()
  return <group ref={ref} name={text} position={[0, y, 0]} />
}

export { SUPPORT_COLOR, HIERARCHY_COLORS }
