import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

interface Visualizer3DProps {
  audioUrl?: string
  isPlaying?: boolean
}

export default function Visualizer3D({ audioUrl, isPlaying = false }: Visualizer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [bars, setBars] = useState<number[]>(Array(64).fill(0))

  useEffect(() => {
    if (!isPlaying) return

    const interval = setInterval(() => {
      setBars(prev => prev.map(() => Math.random() * 100))
      setRotation(prev => ({
        x: prev.x + 0.5,
        y: prev.y + 0.9
      }))
    }, 100)

    return () => clearInterval(interval)
  }, [isPlaying])

  return (
    <div className="w-full h-64 relative perspective-1000">
      <motion.div
        className="w-full h-full preserve-3d"
        animate={{
          rotateX: rotation.x,
          rotateY: rotation.y,
        }}
        transition={{ type: 'spring', stiffness: 50 }}
      >
        {/* 3D Bar Circle */}
        <div className="absolute inset-0 flex items-center justify-center">
          {bars.map((height, i) => (
            <motion.div
              key={i}
              className="absolute bottom-1/2 origin-bottom"
              style={{
                height: `${height}%`,
                width: '4px',
                background: `linear-gradient(to top, #8b5cf6, #ec4899)`,
                transform: `rotate(${i * (360 / bars.length)}deg) translateY(-100px)`,
                borderRadius: '2px',
                boxShadow: '0 0 10px rgba(139, 92, 246, 0.7)',
              }}
              animate={{
                height: `${height}%`,
                opacity: [0.7, 1, 0.7],
              }}
              transition={{
                duration: 0.3,
                repeat: Infinity,
                repeatType: 'reverse',
              }}
            />
          ))}
        </div>

        {/* Center Sphere */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #8b5cf6, #4c1d95)',
            boxShadow: '0 0 30px rgba(139, 92, 246, 0.8), inset 0 0 20px rgba(236, 72, 153, 0.5)',
          }}
          animate={{
            scale: isPlaying ? [1, 1.2, 1] : 1,
            boxShadow: isPlaying 
              ? ['0 0 30px rgba(139, 92, 246, 0.8)', '0 0 50px rgba(236, 72, 153, 0.9)', '0 0 30px rgba(139, 92, 246, 0.8)']
              : '0 0 30px rgba(139, 92, 246, 0.8)',
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        />
      </motion.div>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
    </div>
  )
}
