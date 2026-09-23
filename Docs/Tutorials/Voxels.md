# Voxels in Procedural World Building

A **voxel** is a three-dimensional unit of space. It is similar to a pixel, but instead of representing one point in a flat image, a voxel represents a small volume inside a 3D grid.

Each voxel can store information such as:

- whether the space is solid or empty
- material type, such as soil, rock, or water
- color and density
- temperature, moisture, or vegetation

In procedural world building, algorithms fill or modify voxel grids using noise, simulation rules, and environmental data. For example, 3D noise can generate mountains and caves, while erosion or growth systems can change individual cells over time.

Voxel data is commonly converted into visible geometry using cube faces or surface-extraction methods such as **Marching Cubes**. This makes voxels useful for editable terrain, destructible environments, caves, fluid simulations, and evolving procedural landscapes.

The main trade-off is memory and performance: increasing grid resolution produces finer detail but requires substantially more cells to store and process.
