import { useState } from 'react'
import UploadZone from './components/UploadZone'
import FileList from './components/FileList'
import Waveform from './components/Waveform'
import { useStore } from './stores/useStore'
import { uploadFile, startSeparation } from './api/api'

function App() {
  const files = useStore(s => s.files)
  const currentMode = useStore(s => s.currentMode)
  const setMode = useStore(s => s.setMode)
  const [processing, setProcessing] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const handleProcess = async () => {
    if (!files.length) return
    setProcessing(true)
    try {
      // Upload first file for demo
      const res = await uploadFile(files[0])
      if (res.jobId) {
        // Start separation
        const result = await startSeparation(res.jobId, {
          model: 'modern_ensemble',
          mode: currentMode,
          preset: 'default'
        })
        console.log('Separation result:', result)
        // TODO: poll for completion and set audioUrl
      }
    } catch (e) {
      console.error(e)
    } finally {
      setProcessing(false)
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

      <main className="max-w-6xl mx-auto space-y-6">
        <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-8 border border-white/10">
          <UploadZone />
          <FileList />
        </div>

        {files.length > 0 && (
          <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl mb-4">Настройки</h3>
            <div className="flex gap-4 mb-6">
              {['2stem', '4stem', '6stem'].map(mode => (
                <button
                  key={mode}
                  onClick={() => setMode(mode as any)}
                  className={`px-4 py-2 rounded-lg transition ${
                    currentMode === mode
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {processing ? 'ОБРАБОТКА...' : 'ЗАПУСТИТЬ'}
            </button>
          </div>
        )}

        {audioUrl && (
          <Waveform audioUrl={audioUrl} height={150} />
        )}
      </main>
    </div>
  )
}

export default App
