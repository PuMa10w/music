import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface LyricLine {
  start: number
  end: number
  text: string
}

interface KaraokeViewerProps {
  lyrics: LyricLine[]
  currentTime: number
  isPlaying: boolean
}

export default function KaraokeViewer({ lyrics, currentTime, isPlaying }: KaraokeViewerProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isPlaying) return
    
    const index = lyrics.findIndex(line => 
      currentTime >= line.start && currentTime <= line.end
    )
    
    if (index !== currentLineIndex) {
      setCurrentLineIndex(index)
      // Auto-scroll
      if (containerRef.current && index >= 0) {
        const lineElement = containerRef.current.children[index] as HTMLElement
        if (lineElement) {
          lineElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
        }
      }
    }
  }, [currentTime, lyrics, isPlaying, currentLineIndex])

  return (
    <div className="glass-premium rounded-2xl p-6 h-96 flex flex-col">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span>🎤</span> Karaoke Mode
      </h3>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-purple-500/50"
      >
        <AnimatePresence>
          {lyrics.map((line, index) => (
            <motion.div
              key={index}
              className={`p-3 rounded-lg transition-all duration-300 ${
                index === currentLineIndex
                  ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 text-white scale-105 shadow-lg'
                  : index < currentLineIndex
                  ? 'text-gray-400 bg-white/5'
                  : 'text-gray-600 bg-transparent'
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <p className={`text-lg ${
                index === currentLineIndex ? 'font-bold text-2xl' : 'font-normal'
              }`}>
                {line.text}
              </p>
              {/* Progress bar for current line */}
              {index === currentLineIndex && (
                <motion.div 
                  className="h-1 bg-gradient-to-r from-cyan-400 to-blue-500 mt-2 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ 
                    width: '100%',
                    transition: { 
                      duration: line.end - line.start,
                      ease: 'linear'
                    }
                  }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30 pointer-events-none rounded-2xl" />
    </div>
  )
}
