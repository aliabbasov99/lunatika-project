import React, { useState } from 'react'
import { StarfieldBackground } from '../components/StarfieldBackground'

export const Home: React.FC = () => {
  const [mousePos, setMousePos] = useState<{ x: number; y: number; active: boolean }>({
    x: -9999,
    y: -9999,
    active: false,
  })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    setMousePos({ x: e.clientX, y: e.clientY, active: true })
  }

  const handleMouseLeave = () => {
    setMousePos((prev) => ({ ...prev, active: false }))
  }

  return (
    <div 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full bg-black overflow-hidden flex flex-col justify-center items-center select-none"
    >
      {/* Enhanced Multi-layer Starfield Canvas */}
      <StarfieldBackground />

      {/* Soft white cursor spotlight in the background (mousenun olduğu yer xəfif ağ işıq) */}
      <div 
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-300 ease-out"
        style={{
          opacity: mousePos.active ? 1 : 0,
          background: `radial-gradient(circle 380px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.015) 50%, transparent 80%)`,
        }}
      />

      {/* Secondary sharper subtle inner white glow around cursor */}
      <div 
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-200 ease-out"
        style={{
          opacity: mousePos.active ? 1 : 0,
          background: `radial-gradient(circle 130px at ${mousePos.x}px ${mousePos.y}px, rgba(255, 255, 255, 0.03), transparent 70%)`,
        }}
      />

      {/* Top Spacer for the glass navbar */}
      

      {/* Main Center Content */}
      <div className="relative z-10 flex flex-col items-center justify-center px-4 text-center my-auto">
        {/* Main "Horizon" Heading with fluid clamp */}
        <h1 
          className="text-white font-normal tracking-[-0.035em] leading-none mb-3 sm:mb-5 text-[clamp(3rem,2.2rem+5vw,7.6rem)] animate-stagger-1"
          style={{
            fontFamily: '"Unbounded", sans-serif',
            textShadow: '0 0 35px rgba(255, 255, 255, 0.8), 0 0 70px rgba(255, 255, 255, 0.45), 0 0 110px rgba(255, 255, 255, 0.25)',
          }}
        >
          Horizon
        </h1>

        {/* Subtitle with fluid clamp */}
        <p 
          className="text-white/90 text-[clamp(0.95rem,0.85rem+0.5vw,1.35rem)] font-light tracking-wide max-w-xl mx-auto leading-[1.38] animate-stagger-2"
          style={{
            fontFamily: '"Unbounded", sans-serif',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        >
          The greatest mysteries are often the<br />
          ones right in front of us.
        </p>
      </div>

      {/* Bottom Circle Plus Indicator */}
      <div className="relative z-10 flex flex-col items-center justify-center pb-8 animate-stagger-3 mt-auto">
        <a
          href="/chat"
          title="Open AI Chatbot"
          className="group w-10 h-10 sm:w-11 sm:h-11 rounded-full border border-white/30 hover:border-white/70 bg-white/5 hover:bg-white/15 backdrop-blur-md flex items-center justify-center text-white/75 hover:text-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105"
        >
          <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[1.5] transition-transform duration-300 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
          </svg>
        </a>
      </div>
    </div>
  )
}

export default Home
