import * as THREE from 'three'

/**
 * Restrained limestone PBR material for Gothic Architecture.
 * Surface variation is a subtle world-space tone/roughness shift — no geometry noise.
 */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

/**
 * @param {{ stoneColor?, stoneRoughness?, surfaceVariation?, wireframe? }} opts
 */
export function createStoneMaterial(opts = {}) {
  const color = opts.stoneColor ?? '#c4bfb4'
  const roughness = clamp(opts.stoneRoughness ?? 0.78, 0.2, 1)
  const variation = clamp(opts.surfaceVariation ?? 0.25, 0, 1)
  const wireframe = !!opts.wireframe

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
    wireframe,
    flatShading: false,
  })

  if (variation > 0.02 && !wireframe) {
    const strength = variation
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uStoneVar = { value: strength }
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vStoneWorld;`,
        )
        .replace(
          '#include <worldpos_vertex>',
          `#include <worldpos_vertex>
vStoneWorld = worldPosition.xyz;`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uStoneVar;
varying vec3 vStoneWorld;
float stoneHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
{
  float g = stoneHash(floor(vStoneWorld * 3.5));
  float g2 = stoneHash(floor(vStoneWorld * 1.2 + 2.0));
  float grain = mix(g, g2, 0.45);
  roughnessFactor = clamp(roughnessFactor + (grain - 0.5) * uStoneVar * 0.22, 0.05, 1.0);
}`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
{
  float g = stoneHash(floor(vStoneWorld * 2.8));
  diffuseColor.rgb *= 1.0 - uStoneVar * (g - 0.5) * 0.12;
}`,
        )
    }
    mat.customProgramCacheKey = () => `gothic-stone-${strength.toFixed(3)}`
  }

  return mat
}
