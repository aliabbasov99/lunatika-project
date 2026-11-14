import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import { Chat } from './pages/Chat'
import { Simulation } from './pages/Simulation'
import { Home } from './pages/Home'

function AppLayout() {
  const location = useLocation()
  const isHome = location.pathname === '/'
  const isSimulation = location.pathname === '/simulation'

  return (
    <div className={`flex flex-col h-full ${isHome ? 'bg-black' : 'bg-zinc-950'}`}>
      <Navbar />
      <main className={`relative flex-1 w-full min-h-0 overflow-x-hidden ${isSimulation ? 'overflow-y-auto' : 'overflow-hidden'}`}>
        <div key={location.pathname} className="w-full h-full page-transition-enter">
          <Routes location={location}>
            <Route path="/" element={<Home />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/simulation" element={<Simulation />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  )
}

const App = () => {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

export default App
