import { useEffect, useRef } from 'react'

export default function Confetti() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let animationFrameId
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }

    window.addEventListener('resize', handleResize)

    const colors = [
      '#10B981', '#34D399', '#059669', '#F59E0B', '#FBBF24',
      '#3B82F6', '#60A5FA', '#EC4899', '#F472B6', '#8B5CF6'
    ]

    const particleCount = 150
    const particles = []

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height - height,
        r: Math.random() * 8 + 4,
        d: Math.random() * particleCount,
        color: colors[Math.floor(Math.random() * colors.length)],
        tilt: Math.floor(Math.random() * 10) - 10,
        tiltAngleIncremental: Math.random() * 0.07 + 0.05,
        tiltAngle: Math.random() * Math.PI,
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
      })
    }

    let startTime = Date.now()

    function render() {
      ctx.clearRect(0, 0, width, height)

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i]

        p.tiltAngle += p.tiltAngleIncremental
        p.y += (Math.cos(p.d) + 1 + p.r / 2) * 0.8
        p.x += Math.sin(p.tiltAngle) * 1.5
        p.tilt = Math.sin(p.tiltAngle) * 15

        if (p.y > height) {
          // If within 5 seconds, wrap back to top for continuous celebration
          if (Date.now() - startTime < 6000) {
            p.x = Math.random() * width
            p.y = -20
            p.tilt = Math.floor(Math.random() * 10) - 10
          }
        }

        ctx.beginPath()
        ctx.lineWidth = p.r
        ctx.strokeStyle = p.color
        ctx.moveTo(p.x + p.tilt + p.r / 2, p.y)
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 2)
        ctx.stroke()
      }

      if (Date.now() - startTime < 7000) {
        animationFrameId = requestAnimationFrame(render)
      } else {
        ctx.clearRect(0, 0, width, height)
      }
    }

    render()

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50 w-full h-full"
    />
  )
}
