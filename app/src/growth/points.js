import * as THREE from 'three'

export const SHAPE = { SQUARE: 0, CIRCLE: 1, TARGET: 2 }

export const pointVertex = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aShape;
  uniform float uPixelRatio;
  uniform float uDim;
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vColor = aColor * uDim;
    vShape = aShape;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
  }
`

export const pointFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vShape;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (vShape > 1.5) {
      float m = max(abs(c.x), abs(c.y));
      if (m > 0.13 && m < 0.33) discard;
    } else if (vShape > 0.5) {
      if (length(c) > 0.5) discard;
    }
    gl_FragColor = vec4(vColor, 1.0);
  }
`

export function pointGeometry(positions, colors, sizes, shapes) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  g.setAttribute('aShape', new THREE.BufferAttribute(shapes, 1))
  return g
}
