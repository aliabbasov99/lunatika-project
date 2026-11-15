import React, { useEffect, useRef } from 'react'
import { createFlame2D } from '../nasa-simulation/render/flame2d.js'
import { simulate } from '../nasa-simulation/model/flame.js'

export const FlamePorthole: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let disposed = false
    let flame: { start: () => void; stop: () => void } | null = null

    fetch(`${import.meta.env.BASE_URL}data/dashboard.json`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (disposed || !data?.flex) return
        const heroSim = simulate(data.flex, { fuel: 'Heptane', o2: 0.21, P: 1, co2: 0, he: 0, d0: 3 })
        flame = createFlame2D(canvas, {
          getSim: () => heroSim,
          onHud: () => undefined,
          scale: 1.5,
          bg: '#020309',
          frac: 0.45,
        })
        flame.start()
      })
      .catch(() => undefined)

    return () => {
      disposed = true
      flame?.stop()
    }
  }, [])

  return (
    <figure className="home-porthole-wrap">
      <div className="home-flame-labels">
        <div className="home-flame-eyebrow">NASA PSI · DATA CATALOG</div>
      </div>
      <div className="home-porthole">
        <canvas ref={canvasRef} aria-label="Heptane droplet burning in microgravity" />
      </div>
      <figcaption className="home-porthole-caption">
        3 mm <b>heptane</b> droplet · 21% O₂ · 1 atm<br />
        <span>prediction based on FLEX experiments</span>
      </figcaption>
    </figure>
  )
}
