/**
 * Step 12A — Fit camera when fitToObjectToken increments (manual action only).
 */

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { fitCameraToEnvelope } from './ScaleReference.jsx'

export default function FitCamera({ token = 0, envelope, controlsRef }) {
  const { camera } = useThree()

  useEffect(() => {
    if (!token || !envelope) return
    fitCameraToEnvelope(camera, controlsRef?.current, envelope)
  }, [token, envelope, camera, controlsRef])

  return null
}
