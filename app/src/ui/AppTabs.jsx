const TABS = [
  { id: 'particles', label: 'Particles' },
  { id: 'noise2d', label: 'Noise 2D' },
  { id: 'noise3d', label: 'Noise 3D' },
  { id: 'simulation', label: 'Simulation' },
  { id: 'voxelLab', label: 'Voxel Lab' },
]

export default function AppTabs({ tab, onTabChange }) {
  return (
    <nav className="app-tabs" aria-label="Views">
      {TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === tab ? 'is-active' : undefined}
          onClick={() => onTabChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
