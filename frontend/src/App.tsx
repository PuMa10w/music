import { useState } from 'react'

function App() {
  const [files, setFiles] = useState<File[]>([])

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-8">
      <header className="max-w-6xl mx-auto backdrop-blur-lg bg-white/10 rounded-2xl p-6 shadow-xl border border-white/20 mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
          Voice Remover Ultra
        </h1>
        <p className="text-gray-300 mt-2">Next-gen stem separation studio</p>
      </header>

      <main className="max-w-6xl mx-auto">
        <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-8 border border-white/10">
          <input 
            type="file" 
            multiple 
            accept="audio/*,video/*"
            onChange={handleUpload}
            className="block w-full text-gray-300 mb-4"
          />
          {files.length > 0 && (
            <div className="text-gray-300">
              Загружено файлов: {files.length}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
