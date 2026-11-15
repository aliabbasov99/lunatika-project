import React, { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  radius: number
  baseAlpha: number
  alpha: number
  twinkleSpeed: number
  twinklePhase: number
  color: string
  hasDiffraction: boolean
  spikeLength: number
}

interface ShootingStar {
  x: number
  y: number
  length: number
  speed: number
  angle: number
  opacity: number
  life: number
  maxLife: number
  width: number
}

interface NebulaCloud {
  x: number
  y: number
  radius: number
  color: string
  alpha: number
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      if (!canvas) return
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
      initScene()
    }

    window.addEventListener('resize', handleResize)

    // Star palettes (pure brilliant white, ethereal ice cyan, soft diamond blue, gentle champagne warm)
    const starColors = [
      '255, 255, 255',   // pure diamond white (65%)
      '240, 248, 255',   // crisp alice blue
      '225, 245, 255',   // celestial ice cyan
      '255, 248, 235',   // subtle starlight champagne
      '215, 235, 255',   // Sirius blue
    ]

    let stars: Star[] = []
    let nebulas: NebulaCloud[] = []

    const initScene = () => {
      stars = []
      nebulas = [
        { x: width * 0.25, y: height * 0.35, radius: Math.max(width, height) * 0.40, color: '16, 45, 95', alpha: 0.08 },
        { x: width * 0.75, y: height * 0.45, radius: Math.max(width, height) * 0.45, color: '12, 36, 80', alpha: 0.07 },
        { x: width * 0.50, y: height * 0.80, radius: Math.max(width, height) * 0.50, color: '10, 28, 65', alpha: 0.07 },
        { x: width * 0.85, y: height * 0.18, radius: Math.max(width, height) * 0.35, color: '20, 60, 120', alpha: 0.06 },
      ]

      const starCount = Math.floor((width * height) / 1600) // Rich density

      for (let i = 0; i < starCount; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const rand = Math.random()
        const color = starColors[Math.floor(Math.random() * starColors.length)]

        let radius = 0.5
        let baseAlpha = 0.3
        let hasDiffraction = false
        let spikeLength = 0

        if (rand < 0.72) {
          // Ultra-fine pinpoint stellar dust
          radius = Math.random() * 0.55 + 0.35
          baseAlpha = Math.random() * 0.20 + 0.12
        } else if (rand < 0.95) {
          // Crisp medium stars
          radius = Math.random() * 0.85 + 0.85
          baseAlpha = Math.random() * 0.25 + 0.20
        } else {
          // Brilliant prominent gems with soft cross diffraction spikes
          radius = Math.random() * 1.3 + 1.4
          baseAlpha = Math.random() * 0.30 + 0.35
          hasDiffraction = false
          spikeLength = radius * (Math.random() * 4 + 3.5)
        }

        stars.push({
          x,
          y,
          radius,
          baseAlpha,
          alpha: baseAlpha,
          twinkleSpeed: 0.01 + Math.random() * 0.03,
          twinklePhase: Math.random() * Math.PI * 2,
          color,
          hasDiffraction,
          spikeLength,
        })
      }
    }

    initScene()

    let shootingStars: ShootingStar[] = []
    let nextShootingStarTime = Date.now() + 2500

    const render = () => {
      ctx.clearRect(0, 0, width, height)

      // 1. Draw subtle deep cosmic nebula dust
      for (let i = 0; i < nebulas.length; i++) {
        const n = nebulas[i]
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.radius)
        grad.addColorStop(0, `rgba(${n.color}, ${n.alpha})`)
        grad.addColorStop(0.5, `rgba(${n.color}, ${n.alpha * 0.4})`)
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2)
        ctx.fill()
      }

      // 2. Render all stars with realistic glow & diffraction
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i]
        s.twinklePhase += s.twinkleSpeed
        const twinkle = Math.sin(s.twinklePhase) * 0.38
        s.alpha = Math.max(0.12, Math.min(1, s.baseAlpha + twinkle))

        // Outer soft glow for brighter stars
        if (s.radius > 1.1) {
          ctx.beginPath()
          ctx.arc(s.x, s.y, s.radius * 3.2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${s.color}, ${s.alpha * 0.03})`
          ctx.fill()
        }

        // Diffraction spikes for telescope-quality star gems
        if (s.hasDiffraction && s.alpha > 0.5) {
          ctx.strokeStyle = `rgba(${s.color}, ${s.alpha * 0.06})`
          ctx.lineWidth = 0.75
          ctx.beginPath()
          // horizontal flare
          ctx.moveTo(s.x - s.spikeLength, s.y)
          ctx.lineTo(s.x + s.spikeLength, s.y)
          // vertical flare
          ctx.moveTo(s.x, s.y - s.spikeLength)
          ctx.lineTo(s.x, s.y + s.spikeLength)
          ctx.stroke()
        }

        // Star core
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${s.color}, ${s.alpha})`
        ctx.fill()
      }

      // 3. Graceful shooting stars
      const now = Date.now()
      if (now > nextShootingStarTime && shootingStars.length < 2) {
        shootingStars.push({
          x: Math.random() * width * 0.85 + width * 0.08,
          y: Math.random() * (height * 0.45),
          length: Math.random() * 110 + 60,
          speed: Math.random() * 10 + 14,
          angle: Math.PI / 4 + (Math.random() - 0.5) * 0.2,
          opacity: 1,
          life: 0,
          maxLife: 32,
          width: Math.random() * 0.6 + 1.2,
        })
        nextShootingStarTime = now + Math.random() * 6000 + 3500
      }

      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]
        s.life++
        s.x += Math.cos(s.angle) * s.speed
        s.y += Math.sin(s.angle) * s.speed
        s.opacity = Math.max(0, 1 - s.life / s.maxLife)

        const tailX = s.x - Math.cos(s.angle) * s.length
        const tailY = s.y - Math.sin(s.angle) * s.length

        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y)
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)')
        grad.addColorStop(0.7, `rgba(200, 230, 255, ${s.opacity * 0.4})`)
        grad.addColorStop(1, `rgba(255, 255, 255, ${s.opacity * 0.20})`)

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(s.x, s.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = s.width
        ctx.stroke()

        if (s.life >= s.maxLife) {
          shootingStars.splice(i, 1)
        }
      }

      animationFrameId = requestAnimationFrame(render)
    }

    render()

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <canvas 
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        background: 'radial-gradient(ellipse at 50% 20%, #07152b 0%, #040d1c 50%, #02050e 100%)',
      }}
    />
  )
}
