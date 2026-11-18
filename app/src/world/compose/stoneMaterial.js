/**
 * Limestone / sandstone surface (Step 47, round 2): a MeshStandardMaterial
 * whose diffuse colour (the palette colour per instance) is modulated by
 * procedural world-space value-noise fBm — fine grain, pitting and faint
 * horizontal bedding — so dressed blocks read as quarried stone, not brick.
 * Pure shader math; no textures.
 */

import * as THREE from 'three'

const NOISE = /* glsl */ `
  varying vec3 vStoneP;
  float sh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float sn(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(sh(i), sh(i + vec3(1,0,0)), f.x), mix(sh(i + vec3(0,1,0)), sh(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(sh(i + vec3(0,0,1)), sh(i + vec3(1,0,1)), f.x), mix(sh(i + vec3(0,1,1)), sh(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * sn(p); p *= 2.07; a *= 0.5; } return s; }
`

export function createStoneMaterial() {
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.93, metalness: 0 })
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneP;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 stoneP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          stoneP = instanceMatrix * stoneP;
        #endif
        vStoneP = (modelMatrix * stoneP).xyz;`,
      )
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${NOISE}`).replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float grain = fbm(vStoneP * 2.3);
      float pits = smoothstep(0.72, 0.9, sn(vStoneP * 11.0));
      float bedding = 0.5 + 0.5 * sin(vStoneP.y * 9.0 + fbm(vStoneP * 0.8) * 6.0);
      diffuseColor.rgb *= 0.86 + 0.24 * grain - 0.1 * pits - 0.04 * bedding;`,
    )
  }
  mat.customProgramCacheKey = () => 'yc2925-stone-v1'
  return mat
}
