import { useRef, useEffect } from 'react'

interface Props {
  file: File
}

export default function VideoPreview({ file }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    if (videoRef.current) {
      videoRef.current.src = url
    }
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10 mt-6">
      <h3 className="text-xl mb-4">Видео-превью</h3>
      <video 
        ref={videoRef} 
        controls 
        className="w-full rounded-lg"
      />
    </div>
  )
}
