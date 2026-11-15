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
          className="text-white font-bold tracking-[-0.035em] leading-none mb-3 sm:mb-5 text-[clamp(3rem,2.2rem+5vw,7.6rem)] animate-stagger-1"
          style={{
            fontFamily: '"Unbounded", sans-serif',
            textShadow: 'none',
          }}
        >
          How fire burns <span
            style={{
              background: 'linear-gradient(100deg, #ffd48a 0%, #ff8a3d 34%, #c98bd6 62%, #8fa9ff 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >without gravity</span>
        </h1>

        {/* Subtitle with fluid clamp */}
        <p
          className="text-white/65 text-[clamp(0.78rem,0.72rem+0.28vw,0.96rem)] font-light tracking-[0.025em] max-w-2xl mx-auto leading-[1.8] animate-stagger-2"
          style={{
            marginTop: '1rem',
            fontFamily: '"Unbounded", sans-serif',
            textShadow: '0 0 20px rgba(255, 255, 255, 0.3)',
          }}
        >
          Three decades of combustion experiments on the International Space Station,
          <span className="text-white/85"> compiled, measured, and explained.</span>{' '}
          Every figure comes from a NASA table or document and links directly to its source,
          providing an evidence-based guide on how to protect a crew from fire.
        </p>
        <div className="mt-8 flex w-full max-w-md flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center animate-stagger-3">
          <a
            href="/chat"
            className="group inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-orange-200/70 px-5 py-3 text-xs font-semibold tracking-[0.02em] transition-all duration-300 hover:border-white hover:text-white hover:shadow-[0_0_24px_rgba(255,138,61,0.35)]"
            style={{
              background: 'linear-gradient(100deg, #ffd48a 0%, #ff8a3d 34%, #c98bd6 62%, #8fa9ff 100%)',
              color: 'rgba(255, 255, 255, 0.65)',
            }}
          >
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 8.5h10M7 12h6m-1.5 7.5L7 16H5.5A2.5 2.5 0 0 1 3 13.5v-7A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v7a2.5 2.5 0 0 1-2.5 2.5H13z" />
            </svg>
            AI Chatbot
          </a>
          <a
            href="/simulation"
            className="group inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/8 px-5 py-3 text-xs font-semibold tracking-[0.02em] backdrop-blur-md transition-all duration-300 hover:border-white/70 hover:bg-white/15 hover:text-white hover:shadow-[0_0_24px_rgba(255,255,255,0.18)]"
            style={{ color: 'rgba(255, 255, 255, 0.65)' }}
          >
            <svg className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5zM8 7h8M8 11h3m2 0h3M8 15h8" />
            </svg>
            Open Simulator
          </a>
        </div>
      </div>
    </div>
  )
}

export default Home
