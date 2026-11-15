import { useEffect, useRef, useState } from 'react'
import '../nasa-simulation/styles/tokens.css'
import '../nasa-simulation/styles/base.css'
import '../nasa-simulation/styles/layout.css'
import '../nasa-simulation/styles/components.css'
import '../nasa-simulation/styles/views.css'
import '../nasa-simulation/styles/lab3d.css'
import '../nasa-simulation/styles/react-shell.css'
import { conditions, gravity, scenario, initScenario } from '../nasa-simulation/state.js'
import { createControls } from '../nasa-simulation/ui/controls.js'
import { mountSimulator } from '../nasa-simulation/views/simulator.js'
import { mountFlame3D } from '../nasa-simulation/views/flame3dView.js'
import { StarfieldBackground } from '../components/StarfieldBackground'

type SimulationView = { enter: () => void | Promise<void>; leave: () => void }

export function Simulation() {
  const [activeTab, setActiveTab] = useState<'2d' | '3d'>('2d')
  const [ready, setReady] = useState(false)
  const twoDRef = useRef<HTMLDivElement>(null)
  const threeDRef = useRef<HTMLDivElement>(null)
  const viewsRef = useRef<{ twoD: SimulationView | null; threeD: SimulationView | null }>({ twoD: null, threeD: null })

  useEffect(() => {
    let disposed = false
    async function boot() {
      const response = await fetch('/data/dashboard.json')
      if (!response.ok || disposed) return
      const data = await response.json()
      if (disposed || !twoDRef.current || !threeDRef.current) return

      initScenario(data.flex)
      const controls = createControls(conditions)
      const shared = { controls, scenario, gravity }
      viewsRef.current.twoD = mountSimulator(twoDRef.current, data, shared)
      viewsRef.current.threeD = mountFlame3D(threeDRef.current, data, shared)
      setReady(true)
    }

    void boot()
    return () => {
      disposed = true
      viewsRef.current.twoD?.leave()
      viewsRef.current.threeD?.leave()
      viewsRef.current = { twoD: null, threeD: null }
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    const views = viewsRef.current
    const view = activeTab === '2d' ? views.twoD : views.threeD
    const root = activeTab === '2d' ? twoDRef.current : threeDRef.current
    const otherRoot = activeTab === '2d' ? threeDRef.current : twoDRef.current
    const other = activeTab === '2d' ? views.threeD : views.twoD
    other?.leave()
    otherRoot?.setAttribute('hidden', '')
    root?.removeAttribute('hidden')
    void view?.enter()
  }, [activeTab, ready])

  return (
    <main className="nasa-simulation-shell">
      <StarfieldBackground />
      <div className="simulation-wrap">
        <header className="simulation-header">
          <div>
            <div className="simulation-eyebrow">NASA PSI · DATA CATALOG</div>
            <h1>What does a fuel droplet do under these conditions?</h1>
            <p className="lede">Evidence-based 2D prediction and an interactive 3D FLEX combustion laboratory.</p>
          </div>
          <span className="simulation-badge">FLEX / NASA PSI</span>
        </header>

        <nav className="simulation-tabs" aria-label="Simulation views">
          <button type="button" aria-selected={activeTab === '2d'} onClick={() => setActiveTab('2d')}>
            2D prediction
          </button>
          <button type="button" aria-selected={activeTab === '3d'} onClick={() => setActiveTab('3d')}>
            3D laboratory
          </button>
        </nav>

        <div className="simulation-views">
          <div ref={twoDRef} />
          <div ref={threeDRef} hidden />
        </div>
      </div>
    </main>
  )
}
