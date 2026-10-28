/**
 * Step 12B — Per-frame LOD evaluation from camera + object bounds.
 * Does not rebuild geometry; only reports the selected level via onLodChange.
 */

import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { evaluateLod } from './screenSpace.js'
import { DEFAULT_LOD_BIAS } from './config.js'

/**
 * @param {{
 *   bounds: object,
 *   lodMode?: string,
 *   enableAutoLod?: boolean,
 *   lodBias?: number,
 *   onLodChange?: (level: string, evalResult: object) => void,
 *   onMetrics?: (evalResult: object) => void,
 *   intervalFrames?: number,
 * }} props
 */
export default function LodController({
  bounds,
  lodMode = 'auto',
  enableAutoLod = true,
  lodBias = DEFAULT_LOD_BIAS,
  onLodChange,
  onMetrics,
  intervalFrames = 4,
}) {
  const { camera, size } = useThree()
  const stateRef = useRef({ level: 'high' })
  const frameRef = useRef(0)
  const onLodChangeRef = useRef(onLodChange)
  const onMetricsRef = useRef(onMetrics)
  onLodChangeRef.current = onLodChange
  onMetricsRef.current = onMetrics

  const mode = enableAutoLod === false || lodMode !== 'auto' ? (lodMode === 'auto' ? 'high' : lodMode) : 'auto'

  useEffect(() => {
    const ev = evaluateLod(camera, bounds, stateRef.current, {
      mode,
      bias: lodBias,
      viewportHeightPx: size.height,
    })
    const prev = stateRef.current.level
    stateRef.current.level = ev.level
    if (ev.level !== prev) onLodChangeRef.current?.(ev.level, ev)
    onMetricsRef.current?.(ev)
  }, [mode, lodBias, bounds, camera, size.height])

  useFrame(() => {
    frameRef.current += 1
    if (frameRef.current % Math.max(1, intervalFrames) !== 0) return
    const ev = evaluateLod(camera, bounds, stateRef.current, {
      mode,
      bias: lodBias,
      viewportHeightPx: size.height,
    })
    const prev = stateRef.current.level
    stateRef.current.level = ev.level
    if (ev.level !== prev) onLodChangeRef.current?.(ev.level, ev)
    if (frameRef.current % (intervalFrames * 5) === 0) onMetricsRef.current?.(ev)
  })

  return null
}
