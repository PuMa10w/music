import { useState } from 'react'
import UploadZone from './components/UploadZone'
import FileList from './components/FileList'
import Waveform from './components/Waveform'
import VideoPreview from './components/VideoPreview'
import EQ from './components/EQ'
import { useStore } from './stores/useStore'
import { uploadFile, startSeparation, pollJobStatus, getDownloadUrl } from './api/api'

function App() {
  const files = useStore(s => s.files)
  const currentMode = useStore(s => s.currentMode)
  const setMode = useStore(s => s.setMode)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<{ jobId: string, files: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null)

  // Определяем тип первого файла для превью
  const firstFile = files.length > 0 ? files[0] : null
  const isVideo = firstFile?.type.startsWith('video/') || false
  
  // Создаем URL для локального превью
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  
  useEffect(() => {
    if (!firstFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(firstFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [firstFile])

  const handleProcess = async () => {
    if (!files.length) return
    setProcessing(true)
    setError(null)
    setResults(null)
    setBatchProgress({ current: 0, total: files.length })

    const overallResults: { jobId: string, files: string[] }[] = []

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setBatchProgress({ current: i + 1, total: files.length })
        
        const res = await uploadFile(file)
        if (res.jobId) {
          const sepRes = await startSeparation(res.jobId, {
            model: 'modern_ensemble',
            mode: currentMode,
            preset: 'default'
          })
          
          const data = await pollJobStatus(res.jobId, (status) => {
            console.log(`File ${i+1}/${files.length} status:`, status)
          })

          if (data.status === 'completed') {
            overallResults.push({ jobId: res.jobId, files: data.files || [] })
          }
        }
      }
      setResults(overallResults.length > 0 ? overallResults : null)
    } catch (e: any) {
      setError(e.message || 'Processing failed')
    } finally {
      setProcessing(false)
      setBatchProgress(null)
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

            {batchProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-gray-300 mb-1">
                  <span>Обработка пачки...</span>
                  <span>{batchProgress.current} / {batchProgress.total}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              onClick={handleProcess}
              disabled={processing}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50"
            >
              {processing ? 'ОБРАБОТКА...' : 'ЗАПУСТИТЬ ВСЕ'}
            </button>
          </div>
        )}

        {error && (
          <div className="backdrop-blur-lg bg-red-500/20 border border-red-500/50 rounded-2xl p-4 text-red-200">
            Ошибка: {error}
          </div>
        )}

        {results && (
          <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
            <h3 className="text-xl mb-4">Результаты</h3>
            <div className="flex flex-wrap gap-4">
              {results.files.map((file: string) => (
                <a
                  key={file}
                  href={getDownloadUrl(results.jobId, file)}
                  download
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {file}
                </a>
              ))}
            </div>
          </div>
        )}

        {files.length > 0 && <EQ />}

        {/* Превью: Видео или Аудио волна */}
        {files.length > 0 && firstFile && (
          isVideo ? 
            <VideoPreview file={firstFile} /> : 
            previewUrl ? <Waveform audioUrl={previewUrl} height={150} /> : null
        )}
      </main>
    </div>
  )
}

export default App
