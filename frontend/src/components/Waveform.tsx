import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'

interface Props {
  audioUrl: string
  height?: number
}

export default function Waveform({ audioUrl, height = 100 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    wavesurferRef.current = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#8b5cf6',
      progressColor: '#ec4899',
      cursorColor: '#fff',
      height,
      normalize: true,
    })

    wavesurferRef.current.load(audioUrl)

    return () => {
      wavesurferRef.current?.destroy()
    }
  }, [audioUrl, height])

  return (
    <div className="backdrop-blur-lg bg-white/5 rounded-xl p-4 border border-white/10">
      <div ref={containerRef} />
    </div>
  )
}
