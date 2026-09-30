export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}

float valueNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i);
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  return mix(mix(nx00, nx10, u.y), mix(nx01, nx11, u.y), u.z);
}

float fbm3(vec3 p) {
  float sum = 0.0;
  float amp = 0.5;
  float freq = 1.0;
  for (int i = 0; i < 5; i++) {
    sum += amp * valueNoise3(p * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
`

/**
 * Micro detail belongs to the shader, not the mesh: grain, pitting and
 * fine tool/stratification lines perturb the normal only. Sampled in object
 * space (before layer separation) so it stays attached to each part.
 */
export const DETAIL_GLSL = /* glsl */ `
uniform float uSurfaceDetail;
uniform mat4 modelMatrix;
varying vec3 vObjPos;

float microHeight(vec3 p) {
  float grain = valueNoise3(p * 46.0) * 0.5 + valueNoise3(p * 113.0) * 0.28;
  float pits = smoothstep(0.64, 0.86, valueNoise3(p * 21.0 + 7.1));
  float warp = valueNoise3(p * 5.0 + 3.7) - 0.5;
  float lines = 0.5 + 0.5 * sin((p.y + warp * 0.07) * 170.0);
  return grain - pits * 0.85 + lines * 0.14;
}

vec3 detailNormal(vec3 n, float strength) {
  float s = uSurfaceDetail * strength;
  if (s < 0.001) return n;
  const float e = 0.0035;
  vec3 p = vObjPos;
  float h = microHeight(p);
  vec3 g = vec3(
    microHeight(p + vec3(e, 0.0, 0.0)) - h,
    microHeight(p + vec3(0.0, e, 0.0)) - h,
    microHeight(p + vec3(0.0, 0.0, e)) - h
  ) / e;
  g = mat3(modelMatrix) * g;
  g -= n * dot(g, n);
  return normalize(n - g * s * 0.0042);
}

float detailOcclusion() {
  float pits = smoothstep(0.64, 0.86, valueNoise3(vObjPos * 21.0 + 7.1));
  return 1.0 - pits * 0.32 * uSurfaceDetail;
}
`

export const VERTEX_GLSL = /* glsl */ `
attribute float aGrowth;
attribute float aRelief;
attribute vec3 aLayer;

uniform float uLayerSeparation;

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec2 vUv;
varying float vGrowth;
varying float vRelief;
varying float vViewZ;
varying float vLocalZ;
varying vec3 vObjPos;

void main() {
  vec3 p = position + aLayer * uLayerSeparation;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vViewDir = normalize(cameraPosition - world.xyz);
  vUv = uv;
  vGrowth = aGrowth;
  vRelief = aRelief;
  vLocalZ = position.z;
  vObjPos = position;
  vec4 mv = viewMatrix * world;
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`
