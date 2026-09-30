import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { fbm3, rand } from './noise3.js'

const { clamp, lerp, smoothstep } = THREE.MathUtils
const UP = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const Z_AXIS = new THREE.Vector3(0, 0, 1)
const INACTIVE = 1.2
const DEG = Math.PI / 180

export const DEFAULT_SPECIMEN = {
  seed: 7,
  verticality: 0.62,
  order: 0.62,
  deformation: 0.36,
  erosion: 0.34,
  branching: 0.6,
  voidScale: 0.55,
  layerSeparation: 0,
  surfaceDetail: 0.45,
}

/** Only these parameters rebuild the mesh. Layer Separation and Surface Detail are uniforms. */
export const SPECIMEN_GEOMETRY_KEYS = [
  'seed',
  'verticality',
  'order',
  'deformation',
  'erosion',
  'branching',
  'voidScale',
]

function V(x, y, z) {
  return new THREE.Vector3(x, y, z)
}

function spow(x, p) {
  return Math.sign(x) * Math.abs(x) ** p
}

function fract(x) {
  return x - Math.floor(x)
}

function newPart(layer, erode) {
  return {
    pos: [],
    out: [],
    thick: [],
    uv: [],
    growth: [],
    relief: [],
    index: [],
    layer: layer ?? V(0, 0, 0),
    erode: erode ?? 1,
  }
}

function pushVertex(part, x, y, z, ox, oy, oz, thick, u, v, g, r) {
  part.pos.push(x, y, z)
  const len = Math.hypot(ox, oy, oz) || 1
  part.out.push(ox / len, oy / len, oz / len)
  part.thick.push(thick)
  part.uv.push(u, v)
  part.growth.push(g)
  part.relief.push(r)
}

function gridIndices(part, rows, cols) {
  const ring = cols + 1
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const a = i * ring + j
      const b = (i + 1) * ring + j
      const c = (i + 1) * ring + j + 1
      const d = i * ring + j + 1
      part.index.push(a, b, d, b, c, d)
    }
  }
}

/**
 * Sweeps a superellipse cross-section along a Catmull-Rom path.
 * exponent 2 is round (organic stem); higher values approach a rectangular
 * architectural rib or slab. Ends close with rounded caps so parts can overlap.
 */
function sweep(ctx, opts) {
  const {
    points,
    closed = false,
    w0,
    w1 = w0,
    d0,
    d1 = d0,
    exponent = 2,
    radial = 16,
    hint = UP,
    frame = 'transport',
    capStart = !closed,
    capEnd = !closed,
    growth = () => INACTIVE,
    relief = 0.7,
    layer,
    erode = 1,
    density = 64,
  } = opts

  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  const length = curve.getLength()
  if (!(length > 1e-4)) return curve

  const part = newPart(layer, erode)
  const segs = Math.max(10, Math.ceil(length * density))
  const e = 2 / exponent
  const perimeter = Math.PI * 2 * Math.sqrt((Math.max(w0, w1) ** 2 + Math.max(d0, d1) ** 2) / 2)
  const capA = Math.max(w0, d0) * 1.05
  const capB = Math.max(w1, d1) * 1.05

  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const side = new THREE.Vector3()
  const up = new THREE.Vector3()
  const next = new THREE.Vector3()

  curve.getTangentAt(0, T)
  side.crossVectors(T, hint)
  if (side.lengthSq() < 1e-6) side.crossVectors(T, Math.abs(T.x) < 0.9 ? X_AXIS : Z_AXIS)
  side.normalize()

  for (let i = 0; i <= segs; i += 1) {
    const u = i / segs
    const t = closed ? u : lerp(u, 0.5 - 0.5 * Math.cos(Math.PI * u), 0.45)
    curve.getPointAt(t, P)
    curve.getTangentAt(t, T)

    if (frame === 'hint') {
      next.crossVectors(T, hint)
      if (next.lengthSq() > 1e-6) side.copy(next).normalize()
    } else {
      side.addScaledVector(T, -side.dot(T))
      if (side.lengthSq() < 1e-8) side.crossVectors(T, Math.abs(T.x) < 0.9 ? X_AXIS : Z_AXIS)
      side.normalize()
    }
    up.crossVectors(side, T).normalize()

    const L = t * length
    let cs = 1
    if (capStart && L < capA) cs = Math.min(cs, Math.sqrt(Math.max(0, 1 - (1 - L / capA) ** 2)))
    if (capEnd && length - L < capB) {
      cs = Math.min(cs, Math.sqrt(Math.max(0, 1 - (1 - (length - L) / capB) ** 2)))
    }
    const w = Math.max(lerp(w0, w1, t) * cs, 1e-5)
    const d = Math.max(lerp(d0, d1, t) * cs, 1e-5)
    const g = growth(t)
    const r = typeof relief === 'function' ? relief(t) : relief

    for (let j = 0; j <= radial; j += 1) {
      const a = (j / radial) * Math.PI * 2
      const ca = Math.cos(a)
      const sa = Math.sin(a)
      const ex = spow(ca, e) * w
      const ey = spow(sa, e) * d
      const nx = spow(ca, 2 - e) / w
      const ny = spow(sa, 2 - e) / d
      pushVertex(
        part,
        P.x + side.x * ex + up.x * ey,
        P.y + side.y * ex + up.y * ey,
        P.z + side.z * ex + up.z * ey,
        side.x * nx + up.x * ny,
        side.y * nx + up.y * ny,
        side.z * nx + up.z * ny,
        Math.min(w, d),
        L,
        (j / radial) * perimeter,
        g,
        r,
      )
    }
  }

  gridIndices(part, segs, radial)
  ctx.parts.push(part)
  return curve
}

function veinField(ctx, x, y, z) {
  const b = ctx.form.branching
  const f = lerp(2.4, 4.8, b)
  const o = ctx.vo
  // Narrow iso-lines of the noise field; secondary veins only near primaries,
  // so the pattern reads as a branching network rather than patches.
  const d1 = Math.abs(fbm3(x * f + o.x, y * f * 0.62 + o.y, z * f + o.z, 3) - 0.5)
  const d2 = Math.abs(fbm3(x * f * 2.3 + o.z, y * f * 1.6 + o.x, z * f * 2.3 + o.y, 2) - 0.5)
  const primary = 1 - smoothstep(d1, 0.009, 0.034)
  const secondary = (1 - smoothstep(d2, 0.006, 0.024)) * (1 - smoothstep(d1, 0.03, 0.11)) * b
  return Math.max(primary, secondary * 0.85)
}

/**
 * Rounded-box mass. A uniform sphere grid is radially projected onto
 * |x|^n + |y|^n + |z|^n = 1, which keeps vertex spacing even on the flat faces
 * (unlike the classic superellipsoid parameterization).
 */
function mass(ctx, opts) {
  const {
    center,
    rx,
    ry,
    rz,
    box = 3,
    strata = 0,
    courses = 7,
    asym = 0.25,
    veins = null,
    relief = 0.5,
    layer,
    erode = 1,
    key = 0,
  } = opts

  const part = newPart(layer, erode)
  const segU = 128
  const segV = 88
  const avgR = (rx + rz) / 2
  const o = V(rand(ctx.form.seed, key + 1) * 30, rand(ctx.form.seed, key + 2) * 30, rand(ctx.form.seed, key + 3) * 30)
  const courseOffset = rand(ctx.form.seed, key + 4)

  for (let iv = 0; iv <= segV; iv += 1) {
    const phi = -Math.PI / 2 + (Math.PI * iv) / segV
    const cp = Math.cos(phi)
    const sp = Math.sin(phi)
    for (let iu = 0; iu <= segU; iu += 1) {
      const th = -Math.PI + (Math.PI * 2 * iu) / segU
      const dx = cp * Math.cos(th)
      const dy = sp
      const dz = cp * Math.sin(th)
      const norm = (Math.abs(dx) ** box + Math.abs(dy) ** box + Math.abs(dz) ** box) ** (1 / box)
      const qx = dx / norm
      const qy = dy / norm
      const qz = dz / norm

      const ox = spow(qx, box - 1) / rx
      const oy = spow(qy, box - 1) / ry
      const oz = spow(qz, box - 1) / rz
      const olen = Math.hypot(ox, oy, oz) || 1

      let px = center.x + qx * rx
      let py = center.y + qy * ry
      let pz = center.z + qz * rz

      const n = fbm3(qx * 1.1 + o.x, qy * 1.1 + o.y, qz * 1.1 + o.z, 3) - 0.5
      let disp = n * asym * avgR

      if (strata > 0) {
        const f = fract(py * courses + courseOffset)
        const dist = Math.min(f, 1 - f)
        disp -= strata * Math.exp(-(dist * dist) / 0.004)
      }

      // Worn arrises: erosion concentrates where two faces of the block meet.
      const ax = Math.abs(qx)
      const ay = Math.abs(qy)
      const az = Math.abs(qz)
      const hi = Math.max(ax, ay, az)
      const mid = ax + ay + az - hi - Math.min(ax, ay, az)
      const edge = smoothstep(mid / hi, 0.72, 0.98)
      const chip = smoothstep(fbm3(px * 5.5 + o.z, py * 5.5 + o.x, pz * 5.5 + o.y, 3), 0.42, 0.7)
      disp -= edge * chip * ctx.form.erosion * 0.05

      let g = INACTIVE
      if (veins) {
        const pot = veinField(ctx, px, py, pz)
        if (pot > 0.02) {
          disp -= pot * veins.channel
          const h = clamp((py - ctx.y0) / ctx.H, 0, 1)
          g = clamp(veins.g0 + h * veins.span + (1 - pot) * 0.1, 0.02, 0.98)
        }
      }

      px += (ox / olen) * disp
      py += (oy / olen) * disp
      pz += (oz / olen) * disp

      pushVertex(
        part,
        px,
        py,
        pz,
        ox,
        oy,
        oz,
        Math.min(rx, ry, rz),
        (th + Math.PI) * avgR,
        (phi + Math.PI / 2) * ry,
        g,
        clamp(relief + n * 0.5, 0, 1),
      )
    }
  }

  gridIndices(part, segV, segU)
  ctx.parts.push(part)
}

function archGeom(a, apexY, lancet) {
  const rise = a * lancet
  const ys = apexY - rise
  const c = (rise * rise - a * a) / (2 * a)
  const R = a + c
  const thetaApex = Math.atan2(rise, -c)
  return { ys, c, R, thetaApex, rise }
}

/** Pointed (lancet > 1) or round (lancet = 1) arch from left foot to right foot. */
function archPoints(a, yFoot, apexY, lancet, z) {
  const { ys, c, R, thetaApex } = archGeom(a, apexY, lancet)
  const pts = []
  const legSteps = 4
  for (let i = 0; i < legSteps; i += 1) pts.push(V(-a, lerp(yFoot, ys, i / legSteps), z))
  const arcSteps = 10
  for (let i = 0; i <= arcSteps; i += 1) {
    const th = lerp(Math.PI, thetaApex, i / arcSteps)
    pts.push(V(c + R * Math.cos(th), ys + R * Math.sin(th), z))
  }
  for (let i = arcSteps - 1; i >= 0; i -= 1) {
    const th = lerp(Math.PI, thetaApex, i / arcSteps)
    pts.push(V(-(c + R * Math.cos(th)), ys + R * Math.sin(th), z))
  }
  for (let i = legSteps - 1; i >= 0; i -= 1) pts.push(V(a, lerp(yFoot, ys, i / legSteps), z))
  return pts
}

function makeContext(form) {
  const seed = form.seed
  const rk = (k) => rand(seed, k)
  const H = lerp(2.55, 3.5, form.verticality)
  const y0 = -H / 2
  const off = (k) => V(rk(k) * 40, rk(k + 1) * 40, rk(k + 2) * 40)
  return {
    form,
    rk,
    H,
    rx: 0.66,
    rz: 0.5,
    y0,
    yb: y0 + 0.27 * H,
    ym: y0 + 0.64 * H,
    top: y0 + H,
    gap: 0.16,
    parts: [],
    o1: off(900),
    o2: off(903),
    o3: off(906),
    o4: off(909),
    oE1: off(912),
    oE2: off(915),
    vo: off(918),
    bend: new THREE.Vector2(rk(921) * 2 - 1, rk(922) * 2 - 1),
    twist: (rk(923) - 0.5) * 1.4,
  }
}

function veinsFor(ctx) {
  return { channel: 0.01 + ctx.form.erosion * 0.012, g0: 0.03, span: 0.6 }
}

// LOWER MASS: sill + two piers leaving an open passage between them.
function buildBase(ctx) {
  const { form, rk, rx, rz, y0, yb, H } = ctx
  const o = form.order
  const box = lerp(3, 6, o)

  mass(ctx, {
    center: V(0, y0 + 0.04, 0.01),
    rx: rx * 1.08,
    ry: 0.05,
    rz: rz * 1.06,
    box: lerp(2.6, 5, o),
    asym: 0.16,
    relief: 0.35,
    layer: V(0, -1, 0),
    key: 10,
  })

  const g = lerp(0.1, 0.25, form.voidScale)
  ctx.gap = g
  for (const s of [-1, 1]) {
    const k = s < 0 ? 20 : 30
    const hw = ((rx - g) / 2) * 1.06
    const hh = ((yb - y0 - 0.06) / 2) * lerp(0.94, 1.06, rk(k))
    const cx = s * (g + hw * 0.98)
    const pierDepth = rz * lerp(0.86, 0.96, rk(k + 2))

    // Engaged shafts at the pier corners (colonnettes), rising past the pier.
    for (const [fx, fz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      if (fz < 0 && rk(k + 5 + fx) < 0.5) continue
      const x = cx + fx * hw * 0.97
      const z = fz * pierDepth * 0.97
      const top = yb + lerp(0.02, 0.08, rk(k + 7 + fx + fz)) * H
      sweep(ctx, {
        points: [V(x, y0 + 0.07, z), V(x, lerp(y0, top, 0.5), z), V(x, top, z)],
        w0: 0.028,
        d0: 0.028,
        w1: 0.022,
        d1: 0.022,
        exponent: lerp(2, 3.2, o),
        radial: 14,
        hint: Z_AXIS,
        growth: (t) => lerp(0.05, 0.16, t),
        relief: 0.8,
        layer: V(s * 0.75, -0.2, fz * 0.4),
        erode: 0.7,
      })
    }

    mass(ctx, {
      center: V(cx, y0 + 0.07 + hh, (rk(k + 1) - 0.5) * 0.06),
      rx: hw,
      ry: hh,
      rz: pierDepth,
      box,
      strata: lerp(0.006, 0.018, o),
      courses: 7,
      asym: lerp(0.14, 0.05, o),
      veins: veinsFor(ctx),
      relief: 0.5,
      layer: V(s * 0.6, -0.35, 0),
      key: k,
    })
  }
}

// CAVITY / ARCH: stepped archivolts in front, one arch behind, open through the base.
function buildPortal(ctx) {
  const { form, rz, y0, yb, H } = ctx
  const o = form.order
  const a = ctx.gap + 0.01
  const lancet = lerp(1.15, 1.8, o)
  const apexY = yb + 0.07 * H
  const orders = 1 + Math.round(o * 2)
  const exponent = lerp(2.4, 5.5, o)

  for (let i = 0; i < orders; i += 1) {
    const step = orders - 1 - i
    const ai = a + 0.065 * step
    const ay = apexY + 0.065 * step * lancet * 0.8
    sweep(ctx, {
      points: archPoints(ai, y0 + 0.08, ay, lancet, rz * 0.95 - i * 0.1),
      frame: 'hint',
      hint: Z_AXIS,
      w0: 0.034,
      d0: 0.05,
      exponent,
      growth: (t) => 0.08 + (1 - Math.abs(2 * t - 1)) * 0.18 + i * 0.025,
      relief: 0.82 - i * 0.1,
      layer: V(0, 0, 0.9 - i * 0.25),
      erode: 0.8,
    })
  }

  sweep(ctx, {
    points: archPoints(a, y0 + 0.08, apexY, lancet, -rz * 0.9),
    frame: 'hint',
    hint: Z_AXIS,
    w0: 0.03,
    d0: 0.045,
    exponent,
    growth: (t) => 0.1 + (1 - Math.abs(2 * t - 1)) * 0.2,
    relief: 0.55,
    layer: V(0, 0, -0.8),
    erode: 0.8,
  })
}

// CENTRAL MASS: nested inside the rib cage, smaller as Void Scale grows.
function buildCentral(ctx) {
  const { form, rk, rx, rz, yb, H } = ctx
  const v = form.voidScale
  mass(ctx, {
    center: V(lerp(-0.06, 0.06, rk(40)), yb + 0.18 * H, -0.05),
    rx: rx * lerp(0.56, 0.36, v),
    ry: 0.15 * H,
    rz: rz * lerp(0.62, 0.42, v),
    box: lerp(2.6, 5, form.order),
    strata: 0.014 * form.order,
    courses: 8,
    asym: 0.12,
    veins: veinsFor(ctx),
    relief: 0.45,
    layer: V(0, 0.1, -0.4),
    key: 40,
  })
}

// UPPER MASS: where the ribs converge before bursting into the crown.
function buildUpper(ctx) {
  const { form, rk, rx, rz, ym, H } = ctx
  mass(ctx, {
    center: V(lerp(-0.08, 0.08, rk(60)), ym + 0.005 * H, lerp(-0.06, 0.04, rk(61))),
    rx: rx * 0.52,
    ry: 0.075 * H,
    rz: rz * 0.56,
    box: lerp(2.4, 4.5, form.order),
    strata: 0.012 * form.order,
    courses: 9,
    asym: 0.14,
    veins: veinsFor(ctx),
    relief: 0.55,
    layer: V(0, 0.55, 0),
    key: 60,
  })
}

/**
 * Recursive bifurcation. Cross-sections round off and curvature increases
 * with depth, so rigid ribs become stems; terminals curl like crockets.
 */
function branch(ctx, opts) {
  const { start, dir, length, w, d, depth, g0, id, outward, nRoot } = opts
  const { form, rk } = ctx
  const b = form.branching
  const o = form.order
  const e = form.erosion
  const maxDepth = Math.round(b * 3)
  const terminal = depth >= maxDepth
  const k = 2000 + id * 13

  const axis = V(0, 0, 0).crossVectors(dir, UP)
  if (axis.lengthSq() < 1e-4) axis.crossVectors(outward, UP)
  axis.normalize()

  const curlSign = rk(k) < 0.5 ? -1 : 1
  const bendTotal = terminal ? curlSign * lerp(0.1, 1.7, b) : (rk(k + 1) - 0.5) * 0.7
  let len = length
  if (terminal && rk(k + 2) < e * 0.4) len *= 0.55

  const steps = 12
  let weightSum = 0
  const weights = []
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps
    const wgt = terminal ? t * t : 1
    weights.push(wgt)
    weightSum += wgt
  }

  const jitterAmt = (1 - o) * 0.08 + depth * 0.02
  const pts = [start.clone()]
  const p = start.clone()
  const dd = dir.clone().normalize()
  const jitterAxis = V(0, 0, 0)
  for (let s = 1; s <= steps; s += 1) {
    dd.applyAxisAngle(axis, (bendTotal * weights[s - 1]) / weightSum)
    jitterAxis.set(rk(k + 20 + s) - 0.5, rk(k + 40 + s) - 0.5, rk(k + 60 + s) - 0.5)
    if (jitterAxis.lengthSq() > 1e-6) dd.applyAxisAngle(jitterAxis.normalize(), (rk(k + 80 + s) - 0.5) * jitterAmt)
    dd.normalize()
    p.addScaledVector(dd, len / steps)
    pts.push(p.clone())
  }

  const wEnd = terminal ? w * 0.3 : w * 0.72
  const dEnd = terminal ? d * 0.3 : d * 0.72
  const g1 = Math.min(0.97, g0 + len * 0.55)
  const curve = sweep(ctx, {
    points: pts,
    w0: w,
    w1: wEnd,
    d0: d,
    d1: dEnd,
    exponent: lerp(nRoot, 2.1, (depth + 1) / (maxDepth + 1)),
    radial: depth < 2 ? 14 : 10,
    hint: outward,
    growth: (t) => lerp(g0, g1, t),
    relief: 0.85 + depth * 0.03,
    layer: V(0, 0.7, 0).addScaledVector(outward, 0.25 + depth * 0.12),
    erode: 0.6,
    density: 70,
  })

  if (terminal) return

  const end = curve.getPointAt(1)
  const endDir = curve.getTangentAt(1)
  const n = depth === 0 && rk(k + 3) < (b - 0.55) * 1.6 ? 3 : 2
  const spread = lerp(0.28, 0.52, b)
  const splitAxis = V(0, 0, 0).crossVectors(endDir, outward)
  if (splitAxis.lengthSq() < 1e-4) splitAxis.crossVectors(endDir, X_AXIS)
  splitAxis.normalize().applyAxisAngle(endDir, (rk(k + 4) - 0.5) * 1.2)

  for (let c = 0; c < n; c += 1) {
    const f = n === 2 ? (c === 0 ? -1 : 1) : c - 1
    const cd = endDir
      .clone()
      .applyAxisAngle(splitAxis, f * spread * lerp(0.8, 1.15, rk(k + 5 + c)))
      .addScaledVector(UP, 0.12)
      .normalize()
    branch(ctx, {
      start: end.clone().addScaledVector(endDir, -wEnd * 0.6),
      dir: cd,
      length: len * lerp(0.64, 0.78, rk(k + 8 + c)),
      w: wEnd,
      d: dEnd,
      depth: depth + 1,
      g0: g1 - 0.01,
      id: id * 4 + c + 1,
      outward,
      nRoot,
    })
  }
}

const RIB_ANGLES = [18, 62, 118, 162, 222, 318]
const RIB_PROFILE = [0.97, 1.06, 1.1, 1.05, 0.86, 0.6]

// RIB CAGE: vertical ribs bulge, then converge on the upper mass and branch.
function buildCage(ctx) {
  const { form, rk, rx, rz, yb, ym, H } = ctx
  const o = form.order
  const e = form.erosion
  const count = rk(50) < 0.5 ? 6 : 5
  const jitter = lerp(26, 5, o) * DEG
  const exponent = lerp(2.3, 5.6, o)
  const ribs = []

  for (let i = 0; i < count; i += 1) {
    const k = 100 + i * 20
    const ang = RIB_ANGLES[i] * DEG + (rk(k) - 0.5) * jitter * 2
    const outward = V(Math.cos(ang), 0, Math.sin(ang))
    const tangent = V(-Math.sin(ang), 0, Math.cos(ang))
    const yTop = ym + (rk(k + 1) - 0.5) * 0.08 * H

    const pts = RIB_PROFILE.map((f, j) => {
      const t = j / (RIB_PROFILE.length - 1)
      const y = lerp(yb - 0.04, yTop, t)
      const lean = (rk(k + 2) - 0.5) * (1 - o) * 0.14 * t
      const wob = (rk(k + 3 + j) - 0.5) * (1 - o) * 0.04
      return V(Math.cos(ang) * rx * (f + wob), y, Math.sin(ang) * rz * (f + wob)).addScaledVector(tangent, lean)
    })

    const w = lerp(0.042, 0.05, rk(k + 10))
    const d = lerp(0.06, 0.085, o)
    const g0 = 0.13 + rk(k + 11) * 0.05
    const g1 = g0 + 0.28
    const ribOpts = {
      w0: w,
      w1: w * 0.82,
      d0: d,
      d1: d * 0.82,
      exponent,
      radial: 18,
      hint: outward,
      relief: 0.78,
      layer: outward.clone().multiplyScalar(0.85),
      erode: 0.7,
    }

    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    ribs.push({ curve, ang })
    if (rk(k + 12) < e * 0.55) {
      const a = lerp(0.3, 0.45, rk(k + 13))
      const bb = a + lerp(0.06, 0.12, rk(k + 14))
      const lower = Array.from({ length: 9 }, (_, j) => curve.getPointAt((a * j) / 8))
      const upper = Array.from({ length: 9 }, (_, j) => curve.getPointAt(lerp(bb, 1, j / 8)))
      sweep(ctx, { ...ribOpts, points: lower, w1: w * lerp(1, 0.82, a), d1: d * lerp(1, 0.82, a), growth: (t) => lerp(g0, g1, t * a) })
      sweep(ctx, { ...ribOpts, points: upper, w0: w * lerp(1, 0.82, bb), d0: d * lerp(1, 0.82, bb), growth: (t) => lerp(g0, g1, lerp(bb, 1, t)) })
    } else {
      sweep(ctx, { ...ribOpts, points: pts, growth: (t) => lerp(g0, g1, t) })
    }

    const end = curve.getPointAt(1)
    const endDir = curve.getTangentAt(1)
    const dir = V(0, 0, 0)
      .addScaledVector(outward, 0.28)
      .add(UP)
      .addScaledVector(tangent, (rk(k + 15) - 0.5) * 0.5)
      .normalize()
    branch(ctx, {
      start: end.clone().addScaledVector(endDir, -w * 0.8),
      dir,
      length: (lerp(0.3, 0.44, rk(k + 16)) * H) / 2.6,
      w: w * 0.8,
      d: d * 0.8,
      depth: 0,
      g0: g1,
      id: i + 1,
      outward,
      nRoot: exponent,
    })
  }

  buildLattice(ctx, ribs)
}

function toCylinder(ctx, p) {
  const x = p.x / ctx.rx
  const z = p.z / ctx.rz
  return { ang: Math.atan2(z, x), r: Math.hypot(x, z), y: p.y }
}

// SECONDARY LATTICE: thin diagonal ribs between neighbouring primaries.
// Crossing pairs (at higher order) create the intersections Curvature reads
// and a connected network for the Growth field to travel along.
function buildLattice(ctx, ribs) {
  const { form, rk, rx, rz } = ctx
  const o = form.order
  const crossing = o > 0.4
  for (let i = 0; i < ribs.length; i += 1) {
    const A = ribs[i]
    const B = ribs[(i + 1) % ribs.length]
    let gap = B.ang - A.ang
    while (gap < 0) gap += Math.PI * 2
    if (gap > 100 * DEG) continue

    const pairs = crossing ? [[A, B], [B, A]] : [[A, B]]
    pairs.forEach(([P, Q], pi) => {
      const k = 700 + i * 10 + pi * 5
      const tStart = lerp(0.1, 0.2, rk(k))
      const tEnd = lerp(0.55, 0.7, rk(k + 1))
      const c0 = toCylinder(ctx, P.curve.getPointAt(tStart))
      const c1 = toCylinder(ctx, Q.curve.getPointAt(tEnd))
      let da = c1.ang - c0.ang
      while (da > Math.PI) da -= Math.PI * 2
      while (da < -Math.PI) da += Math.PI * 2
      const pts = Array.from({ length: 9 }, (_, j) => {
        const s = j / 8
        const ang = c0.ang + da * s
        const r = lerp(c0.r, c1.r, s) * (1 + Math.sin(Math.PI * s) * 0.05)
        return V(Math.cos(ang) * rx * r, lerp(c0.y, c1.y, s), Math.sin(ang) * rz * r)
      })
      const mid = c0.ang + da / 2
      const outward = V(Math.cos(mid), 0, Math.sin(mid))
      sweep(ctx, {
        points: pts,
        w0: 0.02,
        d0: lerp(0.024, 0.034, o),
        exponent: lerp(2.2, 4.5, o),
        radial: 12,
        hint: outward,
        growth: (t) => lerp(0.2, 0.42, t),
        relief: 0.72,
        layer: outward.clone().multiplyScalar(0.6),
        erode: 0.8,
      })
    })
  }
}

// HORIZONTAL PLATES: partial rings (ledges / floors) with gaps between arcs.
function buildPlates(ctx) {
  const { form, rk, rx, rz, yb, ym, H } = ctx
  const o = form.order
  const v = form.voidScale
  const e = form.erosion
  const levels = [yb + 0.015 * H, yb + 0.2 * H, ym - 0.05 * H]
  const radii = [1.04, 1.12, 0.8]
  const count = o < 0.3 ? 2 : 3

  for (let l = 0; l < count; l += 1) {
    const y = levels[l]
    const arcs = 2 + (rk(300 + l) < 0.5 ? 1 : 0)
    const span = lerp(115, 55, v) * (1 - e * 0.35) * DEG
    let a = rk(310 + l) * Math.PI * 2
    for (let s = 0; s < arcs; s += 1) {
      const k = 320 + l * 20 + s * 4
      const a0 = a
      const a1 = a + span * lerp(0.75, 1.2, rk(k))
      const rf = radii[l] + (rk(k + 1) - 0.5) * 0.06
      const pts = Array.from({ length: 11 }, (_, j) => {
        const t = j / 10
        const ang = lerp(a0, a1, t)
        const wob = 1 + (rk(k + 2 + j) - 0.5) * (1 - o) * 0.06
        const droop = -Math.sin(t * Math.PI) * (1 - o) * 0.03
        return V(Math.cos(ang) * rx * rf * wob, y + droop, Math.sin(ang) * rz * rf * wob)
      })
      const mid = (a0 + a1) / 2
      sweep(ctx, {
        points: pts,
        frame: 'hint',
        hint: UP,
        w0: lerp(0.1, 0.14, o),
        d0: lerp(0.022, 0.034, o),
        exponent: lerp(2.6, 6, o),
        radial: 16,
        relief: 0.86,
        layer: V(Math.cos(mid) * 0.45, (l - 1) * 0.9, Math.sin(mid) * 0.45),
        erode: 0.9,
      })
      a = a1 + lerp(0.5, 1.4, rk(k + 3)) * (0.6 + v)
    }
  }
}

// BACK SCREEN: lancet frame with a bifurcating (Y) tracery mullion.
function buildScreen(ctx) {
  const { form, rx, rz, yb, ym, H } = ctx
  const o = form.order
  if (o < 0.18) return
  const z = -rz * 1.12
  const a = rx * 0.74
  const lancet = lerp(1.15, 1.8, o)
  const apex = ym + 0.1 * H
  const foot = yb + 0.03 * H

  const outline = archPoints(a, foot, apex, lancet, z)
  outline.push(V(a * 0.5, foot, z), V(0, foot, z), V(-a * 0.5, foot, z))
  sweep(ctx, {
    points: outline,
    closed: true,
    frame: 'hint',
    hint: Z_AXIS,
    w0: 0.026,
    d0: 0.02,
    exponent: 4.5,
    radial: 12,
    relief: 0.3,
    layer: V(0, 0, -1),
    erode: 0.7,
  })

  const { ys, c, R, thetaApex } = archGeom(a, apex, lancet)
  const splitY = lerp(foot, apex, 0.55)
  const mullion = { frame: 'hint', hint: Z_AXIS, w0: 0.018, d0: 0.018, exponent: 3, radial: 10, relief: 0.35, layer: V(0, 0, -1), erode: 0.6 }
  sweep(ctx, {
    ...mullion,
    points: [V(0, foot, z), V(0, lerp(foot, splitY, 0.5), z), V(0, splitY, z)],
    growth: (t) => lerp(0.18, 0.34, t),
  })
  const th = lerp(Math.PI, thetaApex, 0.55)
  const target = V(c + R * Math.cos(th), ys + R * Math.sin(th), z)
  for (const s of [-1, 1]) {
    sweep(ctx, {
      ...mullion,
      points: [
        V(0, splitY - 0.02, z),
        V(s * Math.abs(target.x) * 0.35, splitY + 0.1, z),
        V(s * Math.abs(target.x) * 0.72, lerp(splitY + 0.1, target.y, 0.7), z),
        V(s * Math.abs(target.x), target.y, z),
      ],
      growth: (t) => lerp(0.34, 0.52, t),
    })
  }
}

// FRAGMENTED CROWN: small suspended plate shards among the branches.
function buildShards(ctx) {
  const { form, rk, rx, rz, ym, top, H } = ctx
  const n = 3 + Math.round(form.erosion * 3)
  for (let s = 0; s < n; s += 1) {
    const k = 500 + s * 6
    const y = lerp(ym + 0.1 * H, top - 0.06 * H, rk(k))
    const rf = lerp(0.35, 0.75, rk(k + 1))
    const a0 = rk(k + 2) * Math.PI * 2
    const span = lerp(0.35, 0.8, rk(k + 3))
    const tilt = lerp(-0.12, 0.12, rk(k + 4))
    const pts = Array.from({ length: 6 }, (_, j) => {
      const t = j / 5
      const ang = a0 + span * t
      return V(Math.cos(ang) * rx * rf, y + (t - 0.5) * tilt, Math.sin(ang) * rz * rf)
    })
    const mid = a0 + span / 2
    sweep(ctx, {
      points: pts,
      frame: 'hint',
      hint: UP,
      w0: 0.045,
      d0: 0.012,
      exponent: lerp(2.4, 5, form.order),
      radial: 12,
      relief: 0.8,
      layer: V(Math.cos(mid) * 0.4, 1, Math.sin(mid) * 0.4),
      erode: 1,
    })
  }
}

/**
 * One continuous world-space field shared by every part, so parts that touch
 * stay touching. Erosion bites along each surface's outward direction;
 * deformation increases with height (architecture at the base, organic crown).
 */
function processPart(ctx, part) {
  const { form, y0, H, o1, o2, o3, o4, oE1, oE2, bend, twist } = ctx
  const erosion = form.erosion * part.erode
  const def = form.deformation
  const count = part.pos.length / 3

  for (let i = 0; i < count; i += 1) {
    let x = part.pos[i * 3]
    let y = part.pos[i * 3 + 1]
    let z = part.pos[i * 3 + 2]
    const ox = part.out[i * 3]
    const oy = part.out[i * 3 + 1]
    const oz = part.out[i * 3 + 2]
    const thick = part.thick[i]

    if (erosion > 0) {
      const pit = smoothstep(fbm3(x * 2.6 + oE1.x, y * 2.6 + oE1.y, z * 2.6 + oE1.z, 3), 0.56, 0.74)
      const broad = 1 - smoothstep(fbm3(x * 1.15 + oE2.x, y * 1.15 + oE2.y, z * 1.15 + oE2.z, 2), 0.3, 0.48)
      const depth = erosion * (pit * 0.55 + broad * 0.45) * Math.min(thick * 0.4, 0.045)
      x -= ox * depth
      y -= oy * depth
      z -= oz * depth
      part.relief[i] = clamp(part.relief[i] - depth * 4, 0, 1)
    }

    if (def > 0) {
      const h = clamp((y - y0) / H, 0, 1)
      const bias = 0.3 + 0.7 * h
      x += bend.x * h * h * def * 0.3
      z += bend.y * h * h * def * 0.22
      const ang = twist * def * (h - 0.35)
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      const rx = x * ca - z * sa
      const rz = x * sa + z * ca
      x = rx
      z = rz

      const k = 0.62
      const wx = fbm3(x * k + o1.x, y * k * 0.8 + o1.y, z * k + o1.z, 3) - 0.5
      const wy = fbm3(x * k + o2.x, y * k * 0.8 + o2.y, z * k + o2.z, 3) - 0.5
      const wz = fbm3(x * k + o3.x, y * k * 0.8 + o3.y, z * k + o3.z, 3) - 0.5
      const amp = def * 0.5 * bias
      x += wx * amp * 1.2
      y += wy * amp * 0.6
      z += wz * amp

      const m = fbm3(x * 1.9 + o4.x, y * 1.9 + o4.y, z * 1.9 + o4.z, 2) - 0.5
      const mAmp = def * Math.min(thick * 1.1, 0.045) * 2
      x += ox * m * mAmp
      y += oy * m * mAmp
      z += oz * m * mAmp
    }

    part.pos[i * 3] = x
    part.pos[i * 3 + 1] = y
    part.pos[i * 3 + 2] = z
  }
}

function smoothCoincidentNormals(geometry) {
  const pos = geometry.attributes.position
  const nrm = geometry.attributes.normal
  const groups = new Map()
  for (let i = 0; i < pos.count; i += 1) {
    const key = `${Math.round(pos.getX(i) * 2e4)},${Math.round(pos.getY(i) * 2e4)},${Math.round(pos.getZ(i) * 2e4)}`
    const list = groups.get(key)
    if (list) list.push(i)
    else groups.set(key, [i])
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue
    let x = 0
    let y = 0
    let z = 0
    for (const i of list) {
      x += nrm.getX(i)
      y += nrm.getY(i)
      z += nrm.getZ(i)
    }
    const len = Math.hypot(x, y, z) || 1
    for (const i of list) nrm.setXYZ(i, x / len, y / len, z / len)
  }
  nrm.needsUpdate = true
}

function toGeometry(part) {
  const geometry = new THREE.BufferGeometry()
  const count = part.pos.length / 3
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2))
  geometry.setAttribute('aGrowth', new THREE.Float32BufferAttribute(part.growth, 1))
  geometry.setAttribute('aRelief', new THREE.Float32BufferAttribute(part.relief, 1))
  const layer = new Float32Array(count * 3)
  for (let i = 0; i < count; i += 1) {
    layer[i * 3] = part.layer.x
    layer[i * 3 + 1] = part.layer.y
    layer[i * 3 + 2] = part.layer.z
  }
  geometry.setAttribute('aLayer', new THREE.BufferAttribute(layer, 3))
  geometry.setIndex(part.index)
  geometry.computeVertexNormals()

  const nrm = geometry.attributes.normal
  let agreement = 0
  for (let i = 0; i < count; i += 1) {
    agreement += nrm.getX(i) * part.out[i * 3] + nrm.getY(i) * part.out[i * 3 + 1] + nrm.getZ(i) * part.out[i * 3 + 2]
  }
  if (agreement < 0) {
    const index = geometry.index
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1)
      index.setX(i + 1, index.getX(i + 2))
      index.setX(i + 2, b)
    }
    index.needsUpdate = true
    geometry.computeVertexNormals()
  }

  smoothCoincidentNormals(geometry)
  return geometry
}

export function createArchitecturalSpecimen(form = DEFAULT_SPECIMEN) {
  const started = performance.now()
  const ctx = makeContext({ ...DEFAULT_SPECIMEN, ...form })

  buildBase(ctx)
  buildPortal(ctx)
  buildCentral(ctx)
  buildCage(ctx)
  buildPlates(ctx)
  buildUpper(ctx)
  buildScreen(ctx)
  buildShards(ctx)

  const pieces = ctx.parts.map((part) => {
    processPart(ctx, part)
    return toGeometry(part)
  })
  const merged = mergeGeometries(pieces, false)
  for (const piece of pieces) piece.dispose()

  merged.computeBoundingBox()
  const center = new THREE.Vector3()
  merged.boundingBox.getCenter(center)
  merged.translate(-center.x, -center.y, -center.z)
  merged.computeBoundingBox()
  merged.computeBoundingSphere()
  merged.userData.buildMs = performance.now() - started
  merged.userData.parts = ctx.parts.length
  return merged
}
