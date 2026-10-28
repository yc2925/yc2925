/**
 * Lightweight FPS estimate for LOD HUD (not a benchmark suite).
 */

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

export default function FpsProbe({ onFps, intervalSec = 0.5 }) {
  const acc = useRef({ frames: 0, t: 0, fps: 0 })
  const onFpsRef = useRef(onFps)
  onFpsRef.current = onFps

  useFrame((_, dt) => {
    const a = acc.current
    a.frames += 1
    a.t += dt
    if (a.t >= intervalSec) {
      a.fps = a.frames / a.t
      a.frames = 0
      a.t = 0
      onFpsRef.current?.(a.fps)
    }
  })

  return null
}
