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
    <div className="file-list">
      <div className="section-head">
        <div>
          <p className="eyebrow">Очередь</p>
          <h3>Загруженные файлы ({files.length})</h3>
        </div>
        <button onClick={() => setFiles([])} className="ghost-action">Очистить</button>
      </div>

      <div className="space-y-2">
        {files.map((file, idx) => (
          <motion.div
            key={`${file.name}-${idx}`}
            className="file-row group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: idx * 0.04 }}
          >
            {renamingIndex === idx ? (
              <div className="flex items-center gap-2 flex-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                  className="flex-1 studio-input"
                  autoFocus
                />
                <button onClick={confirmRename} className="mini-action">OK</button>
                <button onClick={() => setRenamingIndex(null)} className="mini-action">X</button>
              </div>
            ) : (
              <>
                <span className="truncate flex-1">{file.name}</span>
                <button onClick={() => startRename(idx)} className="mini-action">Rename</button>
              </>
            )}
            <span className="text-gray-400 text-sm ml-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
