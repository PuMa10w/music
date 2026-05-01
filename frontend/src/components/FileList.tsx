import { useStore } from '../stores/useStore'
import { motion } from 'framer-motion'

export default function FileList() {
  const files = useStore(s => s.files)
  const setFiles = useStore(s => s.setFiles)

  if (files.length === 0) return null

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
            className="flex items-center justify-between bg-black/30 p-3 rounded-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: idx * 0.1 }}
          >
            <span className="truncate">{file.name}</span>
            <span className="text-gray-500 text-sm">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
