import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { pointFragment, pointVertex } from './points.js'

export default function PointMaterial({ dim = 1 }) {
  const pixelRatio = useThree((state) => state.viewport.dpr)
  const params = useMemo(
    () => ({
      vertexShader: pointVertex,
      fragmentShader: pointFragment,
      uniforms: { uPixelRatio: { value: 1 }, uDim: { value: 1 } },
    }),
    [],
  )
  return (
    <shaderMaterial
      args={[params]}
      depthWrite={false}
      uniforms-uPixelRatio-value={pixelRatio}
      uniforms-uDim-value={dim}
    />
  )
}
