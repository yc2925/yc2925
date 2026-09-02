import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Scene from './Scene.jsx'
import SidePanel from './SidePanel.jsx'
import { DEFAULT_PARTICLES } from './particleSettings.js'
import './App.css'

function App() {
  const [particles, setParticles] = useState(DEFAULT_PARTICLES)

  return (
    <div className="app">
      <Canvas
        className="viewport"
        camera={{ position: [3, 2.4, 4], fov: 50 }}
        gl={{ antialias: true }}
      >
        <Scene particles={particles} />
      </Canvas>

      <header className="app-header">
        <p className="app-kicker">yc2925</p>
        <h1>Procedural World Building</h1>
      </header>

      <SidePanel particles={particles} onParticlesChange={setParticles} />
    </div>
  )
}

export default App
