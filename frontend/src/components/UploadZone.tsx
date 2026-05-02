import { useCallback, useState } from 'react'
import { useStore } from '../stores/useStore'

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const setFiles = useStore(s => s.setFiles)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setFiles(Array.from(e.dataTransfer.files))
  }, [setFiles])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files))
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`premium-dropzone ${isDragging ? 'is-dragging' : ''}`}
    >
      <input
        type="file"
        multiple
        accept="audio/*,video/*"
        onChange={handleChange}
        className="hidden"
        id="fileInput"
      />
      <label htmlFor="fileInput" className="cursor-pointer block">
        <div className="drop-icon">+</div>
        <div className="text-2xl mb-3 font-bold">Локальные файлы</div>
        <p className="text-gray-300 text-sm sm:text-base">Перетащите аудио или видео сюда, либо нажмите для выбора</p>
        <p className="text-gray-500 text-sm mt-2">MP3, WAV, FLAC, M4A, OGG, MP4, WEBM и другие популярные форматы</p>
      </label>
    </div>
  )
}
