# Introduction to Shaders

## What is a shader?

A **shader** is a small program that runs on the GPU. It determines how geometry is transformed and how pixels are colored.

Unlike normal JavaScript code, a shader executes many times in parallel:

- once for every vertex
- once for every visible pixel fragment
- or, with compute shaders, once for every item in a data grid

This parallel execution makes shaders useful for terrain, water, clouds, atmospheric effects, procedural textures, vegetation, particles, and large simulations.

Shaders are commonly written in **GLSL** for WebGL or **WGSL** for WebGPU.

---

## The graphics pipeline

A simplified real-time rendering pipeline looks like this:

1. JavaScript sends geometry, textures, and parameters to the GPU.
2. The **vertex shader** positions each vertex.
3. The GPU converts triangles into pixel-sized fragments.
4. The **fragment shader** calculates the color of each fragment.
5. The final image is written to the screen.

For most Three.js and WebGL projects, the vertex and fragment shaders are the two essential shader types.

---

## Main shader types

### Vertex shader

Runs once per vertex.

It is commonly used to:

- transform vertices into camera space
- displace terrain
- animate ocean waves
- move grass or vegetation
- deform procedural geometry

Every vertex shader must calculate `gl_Position`, the final clip-space position of a vertex.

### Fragment shader

Runs for each visible fragment produced by rasterized geometry. A fragment usually becomes a pixel, although depth testing or transparency may prevent it from appearing.

It is commonly used to:

- calculate surface color
- sample textures
- create procedural patterns
- apply lighting
- visualize height, slope, moisture, or erosion
- render water depth and foam

### Compute shader

Runs general-purpose calculations on the GPU without directly drawing geometry.

Compute shaders are useful for:

- erosion and fluid simulation
- cellular automata
- particle systems
- vegetation growth
- generating large noise fields

WebGL does not support true compute shaders. WebGPU does. Similar calculations can be approximated in WebGL by rendering data into textures and feeding the result back into another shader.

### Geometry and tessellation shaders

These stages can create or subdivide geometry on the GPU. They exist in some desktop graphics APIs, but are not available in standard WebGL and are not normally used in Three.js web projects.

### Ray-tracing shaders

Ray-generation, intersection, closest-hit, and miss shaders are used in hardware ray-tracing pipelines. They are more advanced and are separate from the normal WebGL rasterization workflow.

---

## Essential shader data

### Attributes

Attributes are values stored per vertex, such as:

- position
- normal
- texture coordinates
- vertex color

An attribute can be different for every vertex.

### Uniforms

Uniforms are values supplied by JavaScript that remain constant during one draw call.

Examples include:

- elapsed time
- ocean level
- wave height
- terrain scale
- light direction
- a texture or heightmap

Uniforms are the main way UI controls communicate with shaders.

### Varyings

Varyings pass interpolated data from the vertex shader to the fragment shader.

For example, a vertex shader can pass terrain height to the fragment shader. The GPU interpolates that value across each triangle, allowing the fragment shader to color low and high areas differently.

### Textures

A texture is not limited to storing color. It can store simulation data such as:

- terrain height
- water depth
- velocity
- soil moisture
- vegetation density
- temperature

This is an important idea in procedural world building: **a texture can act as a data grid**.

---

## Coordinate spaces

Shader calculations happen in several coordinate systems:

- **Model space:** coordinates relative to the object
- **World space:** coordinates in the scene
- **View space:** coordinates relative to the camera
- **Clip space:** the projected coordinates required by the GPU
- **Screen or UV space:** normalized coordinates used for textures and screen effects

Many shader bugs come from combining values that are in different spaces. Always know which coordinate space a position, direction, or normal uses.

---

## A minimal GLSL example

Vertex shader:

```glsl
uniform float uTime;
varying float vHeight;

void main() {
  vec3 displaced = position;
  displaced.z += sin(position.x * 3.0 + uTime) * 0.1;
  vHeight = displaced.z;

  gl_Position = projectionMatrix
    * modelViewMatrix
    * vec4(displaced, 1.0);
}
```

Fragment shader:

```glsl
varying float vHeight;

void main() {
  float value = smoothstep(-0.1, 0.1, vHeight);
  vec3 lowColor = vec3(0.05, 0.02, 0.02);
  vec3 highColor = vec3(0.65, 0.05, 0.04);
  vec3 color = mix(lowColor, highColor, value);

  gl_FragColor = vec4(color, 1.0);
}
```

The vertex shader creates waves. The fragment shader colors the displaced surface according to height.

---

## Shaders in Three.js

Three.js includes built-in materials such as `MeshStandardMaterial`. These materials already contain shaders for lighting, shadows, and textures.

Use `ShaderMaterial` when you need custom GLSL:

```js
const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
  },
  vertexShader,
  fragmentShader,
})
```

A uniform can then be updated during animation:

```js
material.uniforms.uTime.value = elapsedTime
```

Custom shaders give you more control, but you become responsible for features such as lighting, transparency, and tone mapping.

---

## Uses in procedural world building

Shaders can support a procedural world at several levels:

- **Terrain:** vertex displacement from noise or heightmaps
- **Biome visualization:** color based on elevation, slope, moisture, or temperature
- **Water:** animated waves, depth color, reflections, and foam
- **Atmosphere:** sky gradients, fog, clouds, and sunlight
- **Vegetation:** wind deformation and density-based coloring
- **Simulation display:** visualize erosion, flow, sediment, and ecological data
- **Particles:** update and draw rain, snow, dust, or spores

Shaders are excellent for visualization and parallel calculations. They do not automatically replace the CPU simulation. Decide which system owns the authoritative data and how information moves between CPU and GPU.

---

## Important limitations

- Shader executions are designed to be independent and parallel.
- A shader cannot freely access arbitrary neighboring data unless it is provided through a texture or buffer.
- Values are usually recalculated every frame; shaders do not automatically remember previous results.
- Reading GPU data back into JavaScript is relatively slow.
- Excessive texture samples, loops, transparency, and overdraw can reduce performance.
- GPU floating-point results may vary slightly between devices.

Time-based animation should use elapsed time or frame delta rather than assuming a fixed frame rate.

---

## Recommended learning order

1. Understand vectors and the `x`, `y`, `z`, and `w` components.
2. Learn `mix`, `clamp`, `step`, `smoothstep`, `sin`, and `dot`.
3. Learn attributes, uniforms, varyings, and textures.
4. Understand model, world, view, and clip space.
5. Displace a plane in a vertex shader.
6. Color terrain by height in a fragment shader.
7. Add noise, lighting, and animated water.
8. Learn render targets and data textures.
9. Explore WebGPU compute shaders for large simulations.

The essential mental model is:

> The CPU organizes the scene and supplies data. The GPU runs the same small shader program across many vertices, fragments, or data elements at once.
