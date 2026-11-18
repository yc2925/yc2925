/**
 * World ground surface (REF-033): rubble, scree and pale dust, entirely from
 * world-space noise in the shader — no textures. The architecture's shaders
 * are untouched; this only replaces the terrain's solid material.
 *
 *  - slope (1 − n·up) and rock patches select dark, bumped rock
 *  - flat ground collects pale dust (patchy fBm, more where flatter)
 *  - pebbles: thresholds of high-frequency noise, darker with a lit rim
 *  - bump: the same noise height perturbs the normal (screen-space derivatives)
 *  - detail fades with view distance (no shimmer), and the whole ground
 *    dissolves radially into the horizon colour (fade start → end).
 * Colours: palette greys #363331 #525050 #7a7772 #928e8a #a8a4a0 #b7b2ad, dust #d6d3cf.
 */

import * as THREE from 'three'

const NOISE = /* glsl */ `
  float gh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float gn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(gh(i), gh(i + vec3(1,0,0)), f.x), mix(gh(i + vec3(0,1,0)), gh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(gh(i + vec3(0,0,1)), gh(i + vec3(1,0,1)), f.x), mix(gh(i + vec3(0,1,1)), gh(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float gfbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * gn(p); p *= 2.03; a *= 0.5; } return s / 0.9375; }
  vec3 gBump(vec3 pos, vec3 n, float h) {
    vec3 sx = dFdx(pos); vec3 sy = dFdy(pos);
    vec3 r1 = cross(sy, n); vec3 r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    return normalize(abs(det) * n - grad);
  }
`

/** Ground surface sample: colour (sRGB-ish, linearised by the caller) + bump height. */
const SURFACE = /* glsl */ `
  uniform float uRubble;   // rock outcrops + pebbles
  uniform float uDust;     // pale dust on flats
  uniform float uRelief;   // bump strength
  uniform float uScale;    // detail size (m)
  uniform float uDark;     // 0 pale stone palette · 1 dark palette (black, greys, minimal white)
  varying vec3 vGroundP;
  varying vec3 vGroundN;
  void groundSurface(out vec3 col, out float h, float detail) {
    vec3 P = vGroundP;
    float s = max(0.2, uScale);
    float slope = 1.0 - clamp(vGroundN.y, 0.0, 1.0);
    float macro = gfbm(vec3(P.xz * 0.018, 3.1));
    float rockN = gfbm(P * (0.9 / s));
    float crust = gfbm(P * (0.28 / s) + 11.0);
    // Rock: steep ground and noise outcrops (more with rubble).
    float rockMask = clamp(slope * 3.2 + (gfbm(vec3(P.xz * 0.045, 7.0)) - 0.62 + 0.35 * uRubble) * 2.4, 0.0, 1.0) * uRubble;
    // Pebbles: high-frequency thresholds, faded out with distance.
    // Two octaves of small stones: soft-edged, sparse, different sizes.
    float pv = gn(vec3(P.xz * (6.0 / s), 1.7));
    float pv2 = gn(vec3(P.xz * (13.0 / s), 4.2));
    float peb = max(smoothstep(0.8, 0.9, pv), 0.7 * smoothstep(0.82, 0.92, pv2)) * uRubble * detail;
    // Dust: patchy fBm on flat ground.
    float dustMask = smoothstep(0.42, 0.58, gfbm(vec3(P.xz * 0.03, 5.0)) * 0.7 + (1.0 - slope) * 0.45 - (1.0 - uDust) * 0.75) * (1.0 - rockMask * 0.85) * uDust;
    // Pale: #7a7772 → #928e8a earth, #363331 → #7a7772 rock, #b7b2ad → #d6d3cf dust.
    // Dark: #1b1b1c → #2e2e2f earth, #080808 → #3d3d3e rock, #5e5e60 → #8c8c8e dust (dust also thinned).
    vec3 earth = mix(mix(vec3(0.478, 0.467, 0.447), vec3(0.106, 0.106, 0.11), uDark), mix(vec3(0.573, 0.557, 0.541), vec3(0.18, 0.18, 0.184), uDark), macro);
    earth *= 0.74 + 0.38 * crust;                 // crusts and hollows
    earth *= 0.9 + 0.2 * gn(P * (3.0 / s)) * detail; // fine grit
    vec3 rock = mix(mix(vec3(0.212, 0.2, 0.192), vec3(0.031, 0.031, 0.031), uDark), mix(vec3(0.478, 0.467, 0.447), vec3(0.239, 0.239, 0.243), uDark), rockN);
    vec3 dust = mix(mix(vec3(0.718, 0.698, 0.678), vec3(0.369, 0.369, 0.376), uDark), mix(vec3(0.839, 0.827, 0.812), vec3(0.549, 0.549, 0.557), uDark), gn(P * (1.3 / s)) * detail + 0.5 * (1.0 - detail));
    dustMask *= 1.0 - 0.45 * uDark;
    col = mix(earth, rock, rockMask);
    col = mix(col, col * (0.55 + 0.35 * pv2), peb * (1.0 - dustMask * 0.6)); // pebbles: darker stones of the same ground
    col = mix(col, dust, dustMask);
    h = (rockN * 1.2 * rockMask + crust * 0.6 + peb * 0.35) * (1.0 - dustMask * 0.7);
    h *= uRelief * s * 0.35 * (0.25 + 0.75 * detail);
  }
`

export function createGroundMaterial({ fade = [520, 1500] } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, metalness: 0 })
  m.userData.uniforms = {
    uBg: { value: new THREE.Color() },
    uRubble: { value: 0.6 },
    uDust: { value: 0.35 },
    uRelief: { value: 0.6 },
    uScale: { value: 1.5 },
    uDark: { value: 0 },
  }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, m.userData.uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGroundP;\nvarying vec3 vGroundN;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vGroundP = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vGroundN = normalize(mat3(modelMatrix) * objectNormal);`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform vec3 uBg;\n${NOISE}\n${SURFACE}`)
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float gDetail = 1.0 - smoothstep(60.0, 420.0, length(vViewPosition));
        vec3 gCol; float gH;
        groundSurface(gCol, gH, gDetail);
        diffuseColor.rgb *= pow(gCol, vec3(2.2));`,
      )
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n        normal = gBump(-vViewPosition, normal, gH);')
      .replace(
        '#include <colorspace_fragment>',
        `#include <colorspace_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uBg, smoothstep(${fade[0].toFixed(1)}, ${fade[1].toFixed(1)}, length(vGroundP.xz)));`,
      )
  }
  m.customProgramCacheKey = () => 'yc2925-ground-rubble-v1'
  return m
}

/** Push surface params + horizon colour (raw sRGB, mixed after colorspace) into the material. */
export function updateGroundMaterial(m, terrain, horizon) {
  const u = m.userData.uniforms
  u.uRubble.value = terrain.rubble ?? 0.6
  u.uDust.value = terrain.dust ?? 0.35
  u.uRelief.value = terrain.relief ?? 0.6
  u.uScale.value = terrain.surfaceScale ?? 1.5
  u.uDark.value = terrain.groundPalette === 'dark' ? 1 : 0
  u.uBg.value.setStyle(horizon, THREE.LinearSRGBColorSpace)
}

// --------------------------------------------------------------- environment (REF-032 ↔ REF-033)

const lerpHex = (a, b, t) => {
  const ca = new THREE.Color().setStyle(a, THREE.LinearSRGBColorSpace)
  const cb = new THREE.Color().setStyle(b, THREE.LinearSRGBColorSpace)
  return '#' + ca.lerp(cb, Math.min(1, Math.max(0, t))).getHexString(THREE.LinearSRGBColorSpace)
}
const mix = (a, b, t) => a + (b - a) * t

/**
 * World environment from one sky-tone value: 0 = dark studio gradient
 * (REF-033), 1 = white overcast fog (REF-032). Colours are display (sRGB) hex.
 */
export function worldEnvironment(skyTone = 0.85) {
  const t = Math.min(1, Math.max(0, skyTone))
  return {
    horizon: lerpHex('#3b3c3e', '#d4d6d7', t),
    zenith: lerpHex('#040405', '#c3c6c9', t),
    hemiSky: lerpHex('#c9ccd0', '#eef0f2', t),
    hemiGround: lerpHex('#232323', '#b4b2ae', t),
    hemi: mix(0.45, 1.55, t),
    ambient: mix(0.06, 0.22, t),
    key: mix(2.6, 0.75, t),
    keyPos: [mix(25, 90, t), mix(220, 160, t), mix(35, 70, t)],
    fill: mix(0.18, 0.4, t),
  }
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const skyFragment = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  varying vec3 vDir;
  void main() {
    float t = smoothstep(-0.02, 0.6, vDir.y);
    // Raw display values: matches the fog and the ground fade exactly at the horizon.
    gl_FragColor = vec4(mix(uHorizon, uZenith, t), 1.0);
  }
`

export function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    uniforms: { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
}
