import * as THREE from 'three'
import { NOISE_GLSL, VERTEX_GLSL } from './common.glsl.js'

function makeMaterial(fragment) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX_GLSL,
    fragmentShader: fragment,
    uniforms: {
      uBaseColor: { value: new THREE.Color('#c8c2b6') },
      uColorB: { value: new THREE.Color('#d8c9a6') },
      uLightColor: { value: new THREE.Color('#f2d9a8') },
      uLightDir: { value: new THREE.Vector3(0.6, 0.5, 0.4).normalize() },
      uAnchor: { value: new THREE.Vector3(0, -0.4, 0.2) },
      uRoughness: { value: 0.6 },
      uMetalness: { value: 0.04 },
      uReliefContrast: { value: 0.7 },
      uDepthIntensity: { value: 0.68 },
      uShadowEmphasis: { value: 0.7 },
      uGrainScale: { value: 9.5 },
      uGrainStrength: { value: 0.22 },
      uColorVariation: { value: 0.07 },
      uWeathering: { value: 0.28 },
      uEdgeIntensity: { value: 0.7 },
      uCavityIntensity: { value: 0.82 },
      uCurvatureScale: { value: 1.4 },
      uContrast: { value: 0.65 },
      uProgress: { value: 0.42 },
      uEdgeWidth: { value: 0.08 },
      uGradientScale: { value: 0.45 },
      uGradientOffset: { value: 0.5 },
      uAxis: { value: 1 },
      uAnchorMode: { value: 0 },
      uLightIntensity: { value: 1.15 },
      uRimIntensity: { value: 1.35 },
      uRimWidth: { value: 2.4 },
      uFalloff: { value: 1.6 },
    },
    side: THREE.DoubleSide,
  })
}

const RELIEF_FRAG = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying float vRelief;

uniform vec3 uLightDir;
uniform float uReliefContrast;
uniform float uDepthIntensity;
uniform float uShadowEmphasis;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 l = normalize(uLightDir);
  float ndotl = clamp(dot(n, l), 0.0, 1.0);
  float wrap = mix(ndotl, ndotl * 0.65 + 0.35, 0.2);
  float reliefLit = pow(wrap, mix(0.45, 2.8, uReliefContrast));
  float cavity = pow(1.0 - ndotl, mix(0.8, 3.2, uShadowEmphasis));
  float depth = mix(1.0, 0.35 + vRelief * 1.4, uDepthIntensity);
  vec3 warm = vec3(0.86, 0.8, 0.7);
  vec3 cool = vec3(0.12, 0.11, 0.1);
  vec3 color = mix(cool, warm, reliefLit * depth);
  color *= 1.0 - cavity * (0.35 + uShadowEmphasis * 0.5);
  gl_FragColor = vec4(color, 1.0);
}
`

const STONE_FRAG = /* glsl */ `
${NOISE_GLSL}

varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vRelief;

uniform vec3 uBaseColor;
uniform vec3 uLightDir;
uniform float uGrainScale;
uniform float uGrainStrength;
uniform float uRoughness;
uniform float uColorVariation;
uniform float uWeathering;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 l = normalize(uLightDir);
  float ndotl = clamp(dot(n, l) * 0.65 + 0.35, 0.0, 1.0);
  float grain = fbm3(vWorldPos * uGrainScale);
  float vein = abs(fbm3(vWorldPos * uGrainScale * 0.28 + 17.0) - 0.5) * 2.0;
  vec3 mineral = vec3(
    fbm3(vWorldPos * 2.4 + 3.1) - 0.5,
    fbm3(vWorldPos * 2.4 + 9.7) - 0.5,
    fbm3(vWorldPos * 2.4 + 14.2) - 0.5
  ) * uColorVariation;
  vec3 color = uBaseColor + mineral;
  color *= 1.0 - grain * uGrainStrength;
  color = mix(color, color * 0.55, vein * uGrainStrength * 0.65);
  float cavityWeather = (1.0 - vRelief) * (1.0 - n.y * 0.35);
  color = mix(color, color * vec3(0.42, 0.4, 0.36), uWeathering * cavityWeather);
  float spec = pow(clamp(dot(reflect(-l, n), normalize(cameraPosition - vWorldPos)), 0.0, 1.0), mix(12.0, 2.0, uRoughness));
  color = color * ndotl + spec * (1.0 - uRoughness) * 0.18;
  gl_FragColor = vec4(color, 1.0);
}
`

const CURVATURE_FRAG = /* glsl */ `
// Screen-space curvature approximation:
// dFdx/dFdy of the world-space normal measure how quickly orientation
// changes across neighboring fragments. High change ≈ ridge or cavity.
// Convex (bending toward the camera) is treated as edge/ridge;
// concave as cavity. Not true mesh curvature (no 1-ring Laplacian).

varying vec3 vWorldNormal;
varying vec3 vViewDir;

uniform float uEdgeIntensity;
uniform float uCavityIntensity;
uniform float uCurvatureScale;
uniform float uContrast;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(vViewDir);
  vec3 dx = dFdx(n);
  vec3 dy = dFdy(n);
  float curve = (length(dx) + length(dy)) * uCurvatureScale * 8.0;
  float facing = dot(n, v);
  float convex = clamp(curve * facing, 0.0, 1.0);
  float concave = clamp(curve * (1.0 - facing), 0.0, 1.0);
  vec3 base = vec3(0.22);
  vec3 ridges = vec3(0.92, 0.9, 0.84) * convex * uEdgeIntensity;
  vec3 cavities = vec3(0.04, 0.035, 0.03) * concave * uCavityIntensity;
  vec3 color = mix(base, ridges + (base - cavities), uContrast);
  gl_FragColor = vec4(color, 1.0);
}
`

const GROWTH_FRAG = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying float vGrowth;
varying float vLocalZ;

uniform vec3 uBaseColor;
uniform vec3 uColorB;
uniform vec3 uLightDir;
uniform float uProgress;
uniform float uEdgeWidth;
uniform float uContrast;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 l = normalize(uLightDir);
  float ndotl = clamp(dot(n, l) * 0.55 + 0.45, 0.0, 1.0);
  float edge = max(uEdgeWidth, 0.004);
  float isFacade = 1.0 - step(-0.06, vLocalZ);
  float revealed = (1.0 - isFacade) * (1.0 - smoothstep(uProgress, uProgress + edge, vGrowth));
  float front = (1.0 - isFacade) * (1.0 - abs(vGrowth - uProgress) / edge);
  front = pow(clamp(front, 0.0, 1.0), 1.4);
  vec3 dormant = uColorB;
  vec3 grown = uBaseColor * ndotl;
  vec3 color = mix(dormant, grown, revealed);
  color += front * uContrast * vec3(1.0, 0.92, 0.55);
  gl_FragColor = vec4(color, 1.0);
}
`

const POSITION_FRAG = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

uniform vec3 uBaseColor;
uniform vec3 uColorB;
uniform vec3 uLightDir;
uniform vec3 uAnchor;
uniform float uGradientScale;
uniform float uGradientOffset;
uniform float uContrast;
uniform float uAxis;
uniform float uAnchorMode;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 l = normalize(uLightDir);
  float ndotl = clamp(dot(n, l) * 0.5 + 0.5, 0.0, 1.0);
  float axisValue = uAxis < 0.5 ? vWorldPos.x : (uAxis < 1.5 ? vWorldPos.y : vWorldPos.z);
  float t = mix(axisValue, length(vWorldPos - uAnchor), uAnchorMode);
  t = t * uGradientScale + uGradientOffset;
  t = clamp(t, 0.0, 1.0);
  t = mix(t, smoothstep(0.0, 1.0, t), uContrast);
  vec3 color = mix(uBaseColor, uColorB, t) * ndotl;
  gl_FragColor = vec4(color, 1.0);
}
`

const ILLUMINATION_FRAG = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vViewDir;
varying vec3 vWorldPos;

uniform vec3 uBaseColor;
uniform vec3 uLightColor;
uniform vec3 uLightDir;
uniform float uLightIntensity;
uniform float uRimIntensity;
uniform float uRimWidth;
uniform float uFalloff;

void main() {
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(vViewDir);
  vec3 l = normalize(uLightDir);
  float ndotl = pow(clamp(dot(n, l), 0.0, 1.0), max(uFalloff, 0.2));
  float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), uRimWidth) * uRimIntensity;
  float dist = 1.0 / (1.0 + length(vWorldPos) * 0.15);
  vec3 color = uBaseColor * ndotl * uLightIntensity * uLightColor * dist;
  color += rim * uLightColor;
  color += rim * rim * uLightColor * 0.35;
  gl_FragColor = vec4(color, 1.0);
}
`

export function createBaselineMaterial() {
  return new THREE.MeshStandardMaterial({
    color: '#c8c2b6',
    roughness: 0.62,
    metalness: 0.04,
    side: THREE.DoubleSide,
  })
}

export function createStrategyMaterial(strategy) {
  if (strategy === 'baseline') return createBaselineMaterial()
  if (strategy === 'relief') return makeMaterial(RELIEF_FRAG)
  if (strategy === 'stone') return makeMaterial(STONE_FRAG)
  if (strategy === 'curvature') return makeMaterial(CURVATURE_FRAG)
  if (strategy === 'growth') return makeMaterial(GROWTH_FRAG)
  if (strategy === 'position') return makeMaterial(POSITION_FRAG)
  if (strategy === 'illumination') return makeMaterial(ILLUMINATION_FRAG)
  return createBaselineMaterial()
}

export function syncMaterial(material, settings, strategy) {
  if (strategy === 'baseline') {
    material.color.set(settings.baseline.baseColor)
    material.roughness = settings.baseline.roughness
    material.metalness = settings.baseline.metalness
    return
  }

  const uniforms = material.uniforms
  if (!uniforms) return
  const setColor = (key, hex) => uniforms[key]?.value.set(hex)
  const setNum = (key, value) => {
    if (uniforms[key]) uniforms[key].value = value
  }
  const setVec3 = (key, x, y, z) => uniforms[key]?.value.set(x, y, z).normalize()

  if (strategy === 'relief') {
    const p = settings.relief
    setNum('uReliefContrast', p.reliefContrast)
    setNum('uDepthIntensity', p.depthIntensity)
    setNum('uShadowEmphasis', p.shadowEmphasis)
    setVec3('uLightDir', p.lightX, p.lightY, p.lightZ)
  }

  if (strategy === 'stone') {
    const p = settings.stone
    setColor('uBaseColor', p.baseColor)
    setNum('uGrainScale', p.grainScale)
    setNum('uGrainStrength', p.grainStrength)
    setNum('uRoughness', p.roughness)
    setNum('uColorVariation', p.colorVariation)
    setNum('uWeathering', p.weathering)
    setVec3('uLightDir', 0.55, 0.7, 0.4)
  }

  if (strategy === 'curvature') {
    const p = settings.curvature
    setNum('uEdgeIntensity', p.edgeIntensity)
    setNum('uCavityIntensity', p.cavityIntensity)
    setNum('uCurvatureScale', p.curvatureScale)
    setNum('uContrast', p.contrast)
  }

  if (strategy === 'growth') {
    const p = settings.growth
    setColor('uBaseColor', p.growthColor)
    setColor('uColorB', p.dormantColor)
    setNum('uProgress', p.progress)
    setNum('uEdgeWidth', p.edgeWidth)
    setNum('uContrast', p.contrast)
    setVec3('uLightDir', 0.45, 0.8, 0.5)
  }

  if (strategy === 'position') {
    const p = settings.position
    setColor('uBaseColor', p.colorA)
    setColor('uColorB', p.colorB)
    setNum('uGradientScale', p.gradientScale)
    setNum('uGradientOffset', p.gradientOffset)
    setNum('uContrast', p.gradientContrast)
    setNum('uAxis', p.axis === 'x' ? 0 : p.axis === 'z' ? 2 : 1)
    setNum('uAnchorMode', p.anchorMode ? 1 : 0)
    uniforms.uAnchor?.value.set(p.anchorX, p.anchorY, p.anchorZ)
    setVec3('uLightDir', 0.4, 0.75, 0.5)
  }

  if (strategy === 'illumination') {
    const p = settings.illumination
    setColor('uBaseColor', p.surfaceColor)
    setColor('uLightColor', p.lightColor)
    setVec3('uLightDir', p.lightX, p.lightY, p.lightZ)
    setNum('uLightIntensity', p.lightIntensity)
    setNum('uRimIntensity', p.rimIntensity)
    setNum('uRimWidth', p.rimWidth)
    setNum('uFalloff', p.falloff)
  }
}
