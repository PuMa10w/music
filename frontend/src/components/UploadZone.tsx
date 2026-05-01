import { useCallback, useState } from 'react'
import { useStore } from '../stores/useStore'

export default function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const setFiles = useStore(s => s.setFiles)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    setFiles(files)
  }, [setFiles])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`glass-premium border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
        isDragging ? 'border-purple-500 bg-purple-500/10' : 'border-gray-600 hover:border-gray-400'
      }`}
    >
      <input 
        type="file" 
        multiple 
        accept="audio/*,video/*"
        onChange={handleChange}
        className="hidden"
        id="fileInput"
      />
      <label htmlFor="fileInput" className="cursor-pointer">
        <div className="text-2xl mb-4">🎵</div>
        <p className="text-gray-300">Перетащите файлы сюда или нажмите для выбора</p>
        <p className="text-gray-500 text-sm mt-2">Поддерживаются аудио и видео форматы</p>
      </label>
    </div>
  )
}
