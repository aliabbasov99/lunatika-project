import { useEffect, useRef } from 'react'

export function MicrogravityOrb() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let disposed = false
    let frame = 0
    let cleanup = () => {}

    void import('three').then((THREE) => {
      if (disposed || !canvasRef.current) return

      const canvas = canvasRef.current
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0x000000, 0)

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100)
      camera.position.set(0, 0, 4.5)

      const group = new THREE.Group()
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 48),
        new THREE.MeshStandardMaterial({ color: 0x2a3142, roughness: 0.1, metalness: 0.35 }),
      )
      drop.scale.setScalar(0.32)
      group.add(drop)
      scene.add(group)
      scene.add(new THREE.AmbientLight(0x9aa9cc, 1.8))
      const key = new THREE.PointLight(0xffa867, 35, 20)
      key.position.set(-2, 2, 3)
      scene.add(key)
      const rim = new THREE.PointLight(0x718dff, 24, 20)
      rim.position.set(2, -1, -2)
      scene.add(rim)

      const resize = () => {
        const rect = canvas.getBoundingClientRect()
        const width = Math.max(1, rect.width)
        const height = Math.max(1, rect.height)
        renderer.setSize(width, height, false)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(canvas)
      resize()

      const animate = () => {
        if (disposed) return
        group.rotation.y += 0.003
        group.rotation.x = Math.sin(performance.now() * 0.00035) * 0.08
        renderer.render(scene, camera)
        frame = requestAnimationFrame(animate)
      }
      animate()

      cleanup = () => {
        observer.disconnect()
        cancelAnimationFrame(frame)
        scene.traverse((object: any) => {
          object.geometry?.dispose?.()
          if (Array.isArray(object.material)) object.material.forEach((material: any) => material.dispose())
          else object.material?.dispose?.()
        })
        renderer.dispose()
      }
    }).catch((error) => console.error('Unable to initialize microgravity preview', error))

    return () => {
      disposed = true
      cleanup()
    }
  }, [])

  return <canvas ref={canvasRef} className="microgravity-orb" aria-label="Animated microgravity orb" role="img" />
}
