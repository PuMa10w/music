import { useEffect, useRef } from 'react'

interface Props {
  audioUrl: string
  width?: number
  height?: number
}

export default function Spectrogram({ audioUrl, width = 800, height = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!audioUrl || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 2048
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    // Load audio
    fetch(audioUrl)
      .then(res => res.arrayBuffer())
      .then(buffer => audioContext.decodeAudioData(buffer))
      .then(audioBuffer => {
        const source = audioContext.createBufferSource()
        source.buffer = audioBuffer
        source.connect(analyser)
        analyser.connect(audioContext.destination)
        source.start()

        const draw = () => {
          if (!ctx) return
          analyser.getByteFrequencyData(dataArray)

          ctx.fillStyle = 'rgb(0, 0, 0)'
          ctx.fillRect(0, 0, width, height)

          const barWidth = (width / bufferLength) * 2.5
          let barHeight
          let x = 0

          for(let i = 0; i < bufferLength; i++) {
            barHeight = dataArray[i] / 2
            
            // Color gradient from purple to pink
            const gradient = ctx.createLinearGradient(0, 0, 0, height)
            gradient.addColorStop(0, 'rgb(139, 92, 246)') // purple
            gradient.addColorStop(1, 'rgb(236, 72, 153)') // pink
            
            ctx.fillStyle = gradient
            ctx.fillRect(x, height - barHeight, barWidth, barHeight)

            x += barWidth + 1
          }

          requestAnimationFrame(draw)
        }

        draw()
      })

    return () => {
      audioContext.close()
    }
  }, [audioUrl, width, height])

  return (
    <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
      <h3 className="text-xl mb-4">Спектрограмма</h3>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        className="w-full rounded-lg bg-black"
      />
    </div>
  )
}
