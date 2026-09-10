import { useState } from 'react'
import ParticlesView from './views/ParticlesView.jsx'
import Noise2DView from './views/Noise2DView.jsx'
import Noise3DView from './views/Noise3DView.jsx'
import SimulationView from './views/SimulationView.jsx'
import AppTabs from './ui/AppTabs.jsx'
import ParticlesPanel from './ui/ParticlesPanel.jsx'
import NoisePanel from './ui/NoisePanel.jsx'
import { DEFAULT_PARTICLES } from './particleSettings.js'
import { DEFAULT_NOISE } from './noise/settings.js'
import './App.css'

function App() {
  const [tab, setTab] = useState('particles')
  const [particles, setParticles] = useState(DEFAULT_PARTICLES)
  const [noise, setNoise] = useState(DEFAULT_NOISE)
  const isNoiseTab = tab === 'noise2d' || tab === 'noise3d'

  return (
    <div className="app">
      {tab === 'particles' ? <ParticlesView particles={particles} /> : null}
      {tab === 'noise2d' ? <Noise2DView noise={noise} /> : null}
      {tab === 'noise3d' ? <Noise3DView noise={noise} /> : null}
      {tab === 'simulation' ? (
        <SimulationView noise={noise} onNoiseChange={setNoise} />
      ) : null}

      <header className="app-header">
        <p className="app-kicker">yc2925</p>
        <h1>Procedural World Building</h1>
        <AppTabs tab={tab} onTabChange={setTab} />
      </header>

      {isNoiseTab ? (
        <NoisePanel noise={noise} onNoiseChange={setNoise} />
      ) : tab === 'particles' ? (
        <ParticlesPanel particles={particles} onParticlesChange={setParticles} />
      ) : null}
    </div>
  )
}

export default App
