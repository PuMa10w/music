import { useState } from 'react'
import { useStore } from '../stores/useStore'
import { motion } from 'framer-motion'

export default function FileList() {
  const files = useStore(s => s.files)
  const setFiles = useStore(s => s.setFiles)
  const renameFile = useStore(s => s.renameFile)
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null)
  const [newName, setNewName] = useState('')

  if (files.length === 0) return null

  const startRename = (idx: number) => {
    setRenamingIndex(idx)
    setNewName(files[idx].name)
  }

  const confirmRename = () => {
    if (renamingIndex !== null && newName.trim()) {
      renameFile(renamingIndex, newName.trim())
      setRenamingIndex(null)
    }
  }

  return (
    <div className="glass-premium mt-6 backdrop-blur-lg bg-white/5 rounded-xl p-4 border border-white/10">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Загруженные файлы ({files.length})</h3>
        <button 
          onClick={() => setFiles([])}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Очистить всё
        </button>
      </div>
      <div className="space-y-2">
        {files.map((file, idx) => (
          <motion.div 
            key={idx} 
            className="flex items-center justify-between bg-black/30 p-3 rounded-lg group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
          >
            {renamingIndex === idx ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                  className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-sm"
                  autoFocus
                />
                <button onClick={confirmRename} className="text-green-400 hover:text-green-300 text-xs">✓</button>
                <button onClick={() => setRenamingIndex(null)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
              </div>
            ) : (
              <>
                <span className="truncate flex-1">{file.name}</span>
                <button 
                  onClick={() => startRename(idx)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-gray-400 hover:text-white"
                >
                  ✏️
                </button>
              </>
            )}
            <span className="text-gray-500 text-sm ml-2">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
