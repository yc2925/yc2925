/**
 * "Lift to pointed arch" — sets control-point heights along a curve to a
 * two-centred Gothic arch (same construction as the 13B pointed-arch
 * primitive / REF-008): span S = chord between the curve ends (plan),
 * half-span a, rise h = riseRatio·S, centres at ±c on the springing line
 * with c = (h² − a²)/(2a), radius R = a + c. Each point keeps its plan
 * position; only its height changes. Ends keep their own heights.
 * Curves with fewer than 5 points are first densified to 9 points evenly
 * along the chord, so a two-point curve can become an arch.
 */

export function liftToPointedArch(points, riseRatio = 1.0) {
  if (points.length < 2) return points
  if (points.length < 5) {
    const A0 = points[0]
    const B0 = points[points.length - 1]
    const dense = [A0]
    for (let i = 1; i < 8; i += 1) {
      const u = i / 8
      dense.push({ x: A0.x + (B0.x - A0.x) * u, y: A0.y + (B0.y - A0.y) * u, z: A0.z + (B0.z - A0.z) * u })
    }
    dense.push(B0)
    points = dense
  }
  const A = points[0]
  const B = points[points.length - 1]
  const dx = B.x - A.x
  const dz = B.z - A.z
  const span = Math.hypot(dx, dz)
  if (span < 0.5) return points
  const a = span / 2
  const h = Math.max(0.2, riseRatio) * span
  const c = (h * h - a * a) / (2 * a)
  const R = a + c
  const base = (u) => A.y + (B.y - A.y) * u
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p
    const u = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.z - A.z) * dz) / (span * span)))
    const x = Math.abs((u - 0.5) * span) // distance from the apex axis
    const y = Math.sqrt(Math.max(0, R * R - (x + c) * (x + c)))
    return { ...p, y: base(u) + y }
  })
}
