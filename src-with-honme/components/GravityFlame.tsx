import React, { useEffect, useRef } from 'react'

/**
 * A droplet flame whose shape follows a gravity value (0 = orbit, 1 = Earth).
 * At 1g, buoyancy stretches the flame into a bright, sooty teardrop.
 * At 0g, there is no buoyancy, so the flame closes into a dim blue sphere.
 * Self-contained canvas renderer: no data file needed.
 */
interface Props {
  gravity: number // 0..1
}

interface Soot {
  x: number
  y: number
  vy: number
  life: number
  max: number
  r: number
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const GravityFlame: React.FC<Props> = ({ gravity }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gRef = useRef(gravity)
  const shownG = useRef(gravity)

  useEffect(() => {
    gRef.current = gravity
  }, [gravity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let frame = 0
    let w = 0
    let h = 0
    const soot: Soot[] = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()

    // Polar outline of the flame sheet around the droplet.
    const outline = (cx: number, cy: number, R: number, g: number, t: number, scale: number) => {
      ctx.beginPath()
      const steps = 96
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2
        // a = 0 points up
        const up = Math.cos(a)
        const plume = Math.max(0, up) ** 2.4
        const flicker =
          g * (Math.sin(t * 7.3 + a * 3) * 0.035 + Math.sin(t * 11.1 - a * 5) * 0.02) +
          Math.sin(t * 1.4 + a * 2) * 0.012
        const stretch = 1 + g * 2.6 * plume
        const squeeze = 1 - g * 0.32 * Math.max(0, -up) // flatter bottom at 1g
        const pinch = 1 - g * 0.55 * plume * Math.abs(Math.sin(a)) // narrow tip
        const r = R * scale * stretch * squeeze * (1 + flicker)
        const x = cx + Math.sin(a) * r * pinch * (1 - g * 0.3)
        const y = cy - Math.cos(a) * r + g * R * 0.35
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
    }

    const draw = (now: number) => {
      const t = reduceMotion ? 0 : now / 1000
      shownG.current += (gRef.current - shownG.current) * 0.08
      const g = shownG.current

      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2 + g * h * 0.09
      const R = Math.min(w, h) * lerp(0.2, 0.14, g)

      // ambient chamber glow
      const amb = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.7)
      amb.addColorStop(0, `rgba(${Math.round(lerp(70, 255, g))}, ${Math.round(lerp(110, 140, g))}, ${Math.round(lerp(255, 60, g))}, ${lerp(0.16, 0.2, g)})`)
      amb.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = amb
      ctx.fillRect(0, 0, w, h)

      ctx.globalCompositeOperation = 'lighter'

      // outer flame layers
      const layers = [
        { s: 1.25, a: 0.1 },
        { s: 1.1, a: 0.16 },
        { s: 1.0, a: 0.28 },
        { s: 0.9, a: 0.22 },
      ]
      for (const L of layers) {
        outline(cx, cy, R, g, t, L.s)
        const grad = ctx.createRadialGradient(cx, cy - g * R * 1.2, R * 0.2, cx, cy - g * R * 1.2, R * L.s * (1 + g * 2.2))
        // 0g: blue/violet sheet; 1g: yellow core with orange tip
        grad.addColorStop(0, `rgba(${Math.round(lerp(60, 255, g))}, ${Math.round(lerp(90, 235, g))}, ${Math.round(lerp(255, 170, g))}, ${L.a * lerp(0.15, 1, g)})`)
        grad.addColorStop(0.55, `rgba(${Math.round(lerp(90, 255, g))}, ${Math.round(lerp(130, 150, g))}, ${Math.round(lerp(255, 50, g))}, ${L.a})`)
        grad.addColorStop(0.85, `rgba(${Math.round(lerp(130, 255, g))}, ${Math.round(lerp(110, 90, g))}, ${Math.round(lerp(255, 30, g))}, ${L.a * 0.9})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = grad
        ctx.fill()
      }

      // thin luminous flame sheet (the zero-g "shell")
      outline(cx, cy, R, g, t, 1.0)
      ctx.lineWidth = lerp(2.2, 0.6, g)
      ctx.strokeStyle = `rgba(150, 185, 255, ${lerp(0.55, 0.05, g)})`
      ctx.shadowColor = 'rgba(120, 160, 255, 0.9)'
      ctx.shadowBlur = lerp(18, 0, g)
      ctx.stroke()
      ctx.shadowBlur = 0

      // soot rising (only with buoyancy)
      if (!reduceMotion && Math.random() < g * 0.9) {
        soot.push({
          x: cx + (Math.random() - 0.5) * R * 0.6,
          y: cy - R * 2.2,
          vy: -(0.5 + Math.random() * 0.9) * (h / 400),
          life: 0,
          max: 60 + Math.random() * 60,
          r: 0.8 + Math.random() * 1.6,
        })
      }
      ctx.globalCompositeOperation = 'source-over'
      for (let i = soot.length - 1; i >= 0; i--) {
        const p = soot[i]
        p.life++
        p.y += p.vy * (0.3 + g)
        p.x += Math.sin((p.life + i) * 0.08) * 0.3
        const k = 1 - p.life / p.max
        if (k <= 0) {
          soot.splice(i, 1)
          continue
        }
        ctx.fillStyle = `rgba(255, 150, 70, ${k * 0.5 * g})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // fuel droplet
      const dR = R * 0.22
      const drop = ctx.createRadialGradient(cx - dR * 0.35, cy - dR * 0.4, dR * 0.1, cx, cy, dR)
      drop.addColorStop(0, 'rgba(230, 240, 255, 0.95)')
      drop.addColorStop(0.45, 'rgba(110, 125, 160, 0.95)')
      drop.addColorStop(1, 'rgba(25, 30, 48, 1)')
      ctx.fillStyle = drop
      ctx.beginPath()
      ctx.arc(cx, cy, dR, 0, Math.PI * 2)
      ctx.fill()

      // support fibers (as in the FLEX hardware)
      ctx.strokeStyle = 'rgba(200, 210, 230, 0.25)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.5, cy + dR * 0.2)
      ctx.lineTo(cx - dR, cy + dR * 0.1)
      ctx.moveTo(cx + dR, cy + dR * 0.1)
      ctx.lineTo(cx + w * 0.5, cy + dR * 0.2)
      ctx.stroke()

      if (!reduceMotion) frame = requestAnimationFrame(draw)
    }

    frame = requestAnimationFrame(draw)
    // with reduced motion, still redraw when the slider changes
    let poll = 0
    if (reduceMotion) {
      poll = window.setInterval(() => requestAnimationFrame(draw), 60)
    }

    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(poll)
      observer.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className="gf-canvas" role="img" aria-label="Droplet flame changing shape with gravity" />
}

export default GravityFlame
