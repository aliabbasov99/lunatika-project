import { useEffect } from 'react'
import { HashRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import { Chat } from './pages/Chat'
import { Simulation } from './pages/Simulation'
import { Home } from './pages/Home'
import { MissionExplorer } from './pages/MissionExplorer'
import { Data } from './pages/Data'
import { HowItWorks } from './pages/HowItWorks'

function CursorGlow() {
  useEffect(() => {
    const root = document.documentElement
    const updatePosition = (event: MouseEvent) => {
      root.style.setProperty('--cursor-x', `${event.clientX}px`)
      root.style.setProperty('--cursor-y', `${event.clientY}px`)
    }
    window.addEventListener('mousemove', updatePosition, { passive: true })
    return () => window.removeEventListener('mousemove', updatePosition)
  }, [])

  return <div className="global-cursor-glow" aria-hidden="true" />
}

function AppLayout() {
  const location = useLocation()
  const isSimulation = location.pathname === '/simulation'
  const isHome = location.pathname === '/'
  const isMissionExplorer = location.pathname.startsWith('/mission-explorer') || location.pathname === '/applications'
  const isData = location.pathname === '/data'
  const isHowItWorks = location.pathname === '/how-it-works'

  return (
    <div className="flex flex-col h-full bg-[#02050e]">
      <CursorGlow />
      <Navbar />
        <main className={`relative flex-1 w-full min-h-0 ${isHome || isMissionExplorer || isData || isHowItWorks ? 'overflow-y-auto overflow-x-hidden' : `overflow-x-hidden ${isSimulation ? 'overflow-y-auto' : 'overflow-hidden'}`} `}>
        <div key={location.pathname} className="w-full h-full page-transition-enter">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="/mission-explorer/*" element={<MissionExplorer />} />
            <Route path="/applications" element={<MissionExplorer applicationView />} />
            <Route path="/data" element={<Data />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

const App = () => {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  )
}

export default App
