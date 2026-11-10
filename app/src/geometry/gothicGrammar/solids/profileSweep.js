/**
 * Planar path profile sweep for decorative moldings (Step 13D / 13D.1).
 *
 * Paths lie in XY. Local frame at each sample:
 *   T — unit tangent in XY
 *   N — unit in-plane normal (left of T when looking +Z) × outwardSign
 *   B — world +Z (depth)
 *
 * Cusps: dual frames for hard crease, but adjacent cusp-in/cusp-out rings
 * are NOT connected (zero path length) — that was producing twisted fans.
 * Moderate corners use a bounded miter along the angle bisector.
 */

import { createMeshData } from './meshValidation.js'
import { toHardEdgeMesh } from './hardEdgeNormals.js'
import { buildProfile } from './profileLibrary.js'
import { openRing } from './regionExtrusion.js'

const EPS = 1e-10
const MAX_MITER = 2.5

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function makeFrame(origin, T, outwardSign, sharp, kind, miterScale = 1) {
  const Nx = -T.y * outwardSign
  const Ny = T.x * outwardSign
  return {
    origin: { x: origin.x, y: origin.y, z: 0 },
    T: { x: T.x, y: T.y, z: 0 },
    N: { x: Nx, y: Ny, z: 0 },
    B: { x: 0, y: 0, z: 1 },
    sharp,
    kind,
    miterScale,
  }
}

/**
 * Build sweep frames along a 2D polyline.
 * @param {{x,y}[]} path
 * @param {{ closed?: boolean, outwardSign?: number, cornerAngleDeg?: number, maxMiter?: number }} opts
 */
export function buildSweepFrames(path, opts = {}) {
  const closed = opts.closed !== false
  const outwardSign = opts.outwardSign ?? 1
  // Only treat near-cusp corners as discontinuous (quatrefoil tips ~ acute).
  const cornerCos = Math.cos(((opts.cornerAngleDeg ?? 55) * Math.PI) / 180)
  const maxMiter = opts.maxMiter ?? MAX_MITER
  const ring = openRing(path)
  if (ring.length < 2) throw new Error('sweep path needs ≥2 points')

  const n = ring.length
  const frames = []

  for (let i = 0; i < n; i += 1) {
    const prev = ring[(i - 1 + n) % n]
    const curr = ring[i]
    const next = ring[(i + 1) % n]

    let tin
    let tout
    if (!closed && i === 0) {
      tin = { x: next.x - curr.x, y: next.y - curr.y }
      tout = tin
    } else if (!closed && i === n - 1) {
      tin = { x: curr.x - prev.x, y: curr.y - prev.y }
      tout = tin
    } else {
      tin = { x: curr.x - prev.x, y: curr.y - prev.y }
      tout = { x: next.x - curr.x, y: next.y - curr.y }
    }

    const lin = Math.hypot(tin.x, tin.y) || EPS
    const lout = Math.hypot(tout.x, tout.y) || EPS
    tin = { x: tin.x / lin, y: tin.y / lin }
    tout = { x: tout.x / lout, y: tout.y / lout }

    const cos = Math.max(-1, Math.min(1, tin.x * tout.x + tin.y * tout.y))
    const isCusp = cos < cornerCos && closed

    if (isCusp) {
      // Explicit corner: two frames, not connected in the strip (hard crease).
      frames.push(makeFrame(curr, tin, outwardSign, true, 'cusp-in', 1))
      frames.push(makeFrame(curr, tout, outwardSign, true, 'cusp-out', 1))
    } else {
      let tx = tin.x + tout.x
      let ty = tin.y + tout.y
      const tl = Math.hypot(tx, ty)
      if (tl < EPS) {
        tx = tout.x
        ty = tout.y
      } else {
        tx /= tl
        ty /= tl
      }
      // Bounded miter: scale profile along bisector normal so edges meet.
      const half = Math.acos(cos) * 0.5
      const miter = Math.min(maxMiter, 1 / Math.max(Math.cos(half), 0.2))
      frames.push(makeFrame(curr, { x: tx, y: ty }, outwardSign, false, 'smooth', miter))
    }
  }

  return frames
}

function transformPoint(frame, s, t, zOffset) {
  const ms = s * (frame.miterScale ?? 1)
  return {
    x: frame.origin.x + frame.N.x * ms,
    y: frame.origin.y + frame.N.y * ms,
    z: zOffset + t,
  }
}

/**
 * Sweep a profile along a path. Returns open tube strip (not claimed watertight).
 */
export function sweepProfile(input) {
  const {
    path,
    profile: profileIn,
    profileParams,
    closed = true,
    outwardSign = 1,
    zOffset = 0,
  } = input ?? {}

  if (!path?.length) throw new Error('sweepProfile: missing path')
  const profile = profileIn ?? buildProfile(profileParams ?? {})
  const pts = profile.points
  if (pts.length < 2) throw new Error('profile needs ≥2 points')

  const frames = buildSweepFrames(path, { closed, outwardSign })
  if (frames.length < 2) throw new Error('insufficient sweep frames')

  const positions = []
  const indices = []
  const m = pts.length

  for (const fr of frames) {
    for (const q of pts) {
      const p = transformPoint(fr, q.s, q.t, zOffset)
      positions.push(p.x, p.y, p.z)
    }
  }

  const ringCount = frames.length
  const segs = closed ? ringCount : ringCount - 1
  for (let i = 0; i < segs; i += 1) {
    const i0 = i
    const i1 = (i + 1) % ringCount
    const f0 = frames[i0]
    const f1 = frames[i1]
    // Do not bridge cusp-in → cusp-out at the same origin (zero-length twist).
    if (
      f0.sharp &&
      f1.sharp &&
      f0.kind === 'cusp-in' &&
      f1.kind === 'cusp-out' &&
      dist(f0.origin, f1.origin) < 1e-12
    ) {
      continue
    }
    // Also skip if path distance is essentially zero (numerical duplicate).
    if (dist(f0.origin, f1.origin) < 1e-12 && f0.sharp && f1.sharp) continue

    for (let j = 0; j < m - 1; j += 1) {
      const a = i0 * m + j
      const b = i0 * m + j + 1
      const c = i1 * m + j + 1
      const d = i1 * m + j
      indices.push(a, d, c)
      indices.push(a, c, b)
    }
  }

  if (!closed) {
    for (let j = 0; j < m - 2; j += 1) {
      indices.push(0, j + 1, j + 2)
    }
    const base = (ringCount - 1) * m
    for (let j = 0; j < m - 2; j += 1) {
      indices.push(base, base + j + 2, base + j + 1)
    }
  }

  // Do not weld — cusp seams and thin profiles must keep distinct verts.
  const raw = createMeshData(positions, indices, {
    kind: 'decorative_sweep',
    profileType: profile.type,
    closed,
    frameCount: frames.length,
    cuspFrameCount: frames.filter((f) => f.sharp).length,
  })
  const mesh = toHardEdgeMesh(raw)

  return {
    mesh,
    frames,
    profile,
    meta: {
      kind: 'decorative_sweep',
      closed,
      pathPointCount: openRing(path).length,
      frameCount: frames.length,
      profileType: profile.type,
      watertightClaim: false,
      cuspSeamsOpen: true,
    },
  }
}

export function sweepContinuityReport(frames, maxJump = 0.5) {
  const warnings = []
  for (let i = 1; i < frames.length; i += 1) {
    const a = frames[i - 1].origin
    const b = frames[i].origin
    const d = dist(a, b)
    if (d > maxJump && !frames[i].sharp && !frames[i - 1].sharp) {
      warnings.push(`large frame jump ${d.toFixed(3)}m at index ${i}`)
    }
  }
  return { ok: warnings.length === 0, warnings }
}
