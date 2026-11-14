import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import { ChatView } from './components/chat/ChatView'

const App = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full bg-zinc-950">
        <Navbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <Routes>
            <Route index element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatView />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
