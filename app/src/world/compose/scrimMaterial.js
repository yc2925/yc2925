/**
 * X-ray wire-mesh / scrim material (Step 47, feedback round 1). Reference: REF-026.
 *
 * - Additive blending, no depth write: overlapping layers stack brighter,
 *   inner structure is visible through outer surfaces.
 * - Fresnel edge glow: silhouettes bright, faces facing the camera faint.
 * - Fine mesh lines: from uv (tubes / terrain: metres along × around) or from
 *   barycentrics (stones: every facet outlined, so stones read separately).
 * - Monochrome white / pale grey only.
 * Works with InstancedMesh (instanceMatrix) and plain meshes; honours scene fog
 * (fades the additive glow, so X-ray depth reads in the World view).
 */

import * as THREE from 'three'

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  attribute vec3 bary;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vBary;
  varying vec2 vUv;
  varying vec2 vWorldXZ;
  void main() {
    vec4 local = vec4(position, 1.0);
    vec3 n = normal;
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 world = modelMatrix * local;
    vWorldXZ = world.xz;
    vN = normalize(mat3(modelMatrix) * n);
    vView = cameraPosition - world.xyz;
    vBary = bary;
    vUv = uv;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uGain;      // X-ray exposure (additive: >1 burns overlaps to white)
  uniform float uEdge;
  uniform float uLine;
  uniform float uMode;      // 0 = barycentric facets, 1 = uv mesh
  uniform vec2 uDensity;    // mesh lines per metre (uv mode)
  uniform vec2 uFade;       // radial fade-out (start, end) in metres from the origin
  varying vec2 vWorldXZ;
  varying vec3 vN;
  varying vec3 vView;
  varying vec3 vBary;
  varying vec2 vUv;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vView)));
    float fresnel = pow(1.0 - facing, 2.2);
    float line;
    if (uMode < 0.5) {
      vec3 w = fwidth(vBary) * 0.9;
      vec3 e = smoothstep(vec3(0.0), w, vBary);
      line = 1.0 - min(min(e.x, e.y), e.z);
    } else {
      vec2 g = vUv * uDensity;
      vec2 w = fwidth(g) * 1.2;
      vec2 d = abs(fract(g - 0.5) - 0.5);
      vec2 l = 1.0 - smoothstep(vec2(0.0), w, d);
      // When mesh cells shrink below a pixel, blend to their average coverage (a soft glow) instead of vanishing.
      line = mix(max(l.x, l.y), 0.4, smoothstep(0.3, 0.9, length(w)));
    }
    float a = (uOpacity * (0.16 + fresnel * uEdge) + line * uLine) * uGain;
    a *= 1.0 - smoothstep(uFade.x, uFade.y, length(vWorldXZ));
    #ifdef USE_FOG
      // Additive scrim: fog fades the glow out (toward the black background).
      #ifdef FOG_EXP2
        float fogF = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      #else
        float fogF = smoothstep(fogNear, fogFar, vFogDepth);
      #endif
      a *= 1.0 - fogF;
    #endif
    gl_FragColor = vec4(uColor * a, a);
  }
`

export function createScrimMaterial({ mode = 'uv', density = [2.2, 2.2], opacity = 0.35, edge = 1.6, line = 0.45, color = '#f2f4f5', fade = [1e9, 2e9] } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uGain: { value: 1 },
      uEdge: { value: edge },
      uLine: { value: line },
      uMode: { value: mode === 'bary' ? 0 : 1 },
      uDensity: { value: new THREE.Vector2(density[0], density[1]) },
      uFade: { value: new THREE.Vector2(fade[0], fade[1]) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}
