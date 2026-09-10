import { useEffect, useMemo, useRef } from 'react'
import { fillHeightmap } from '../noise/sample.js'

export default function Noise2DView({ noise, compact = false }) {
  const canvasRef = useRef(null)
  const heights = useMemo(() => fillHeightmap(noise), [noise])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const size = Math.round(noise.resolution)
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    const image = ctx.createImageData(size, size)
    const pixels = image.data

    for (let i = 0; i < size * size; i += 1) {
      const shade = Math.round(((heights[i] + 1) * 0.5) * 255)
      const p = i * 4
      pixels[p] = shade
      pixels[p + 1] = shade
      pixels[p + 2] = shade
      pixels[p + 3] = 255
    }

    ctx.putImageData(image, 0, 0)
  }, [heights, noise.resolution])

  return (
    <div className={compact ? 'noise-2d is-compact' : 'noise-2d'}>
      <canvas ref={canvasRef} className="noise-2d-canvas" />
    </div>
  )
}
