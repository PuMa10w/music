import { useState, useEffect } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import UploadZone from './components/UploadZone'
import UrlInput from './components/UrlInput'
import LyricsInput from './components/LyricsInput'
import FileList from './components/FileList'
import Waveform from './components/Waveform'
import VideoPreview from './components/VideoPreview'
import Spectrogram from './components/Spectrogram'
import EQ from './components/EQ'
import { useStore } from './stores/useStore'
import { AnimatePresence, motion } from 'framer-motion'
import { uploadFile, startSeparation, pollJobStatus, getDownloadUrl, analyzeTrack, masterTrack, replaceVideoAudio, analyzeHarmonic } from './api/api'
import { useToast } from './hooks/useToast'
import Toast from './components/Toast'
import SystemStatus from './components/SystemStatus'

function App() {
  const files = useStore(s => s.files)
  const currentMode = useStore(s => s.currentMode)
  const setMode = useStore(s => s.setMode)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<{ jobId: string, files: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null)
  const [bpmKey, setBpmKey] = useState<{ bpm: number, key: string } | null>(null)
  const [harmonicData, setHarmonicData] = useState<{ key: string, mode: string, tempo: number } | null>(null)
  const [lyrics, setLyrics] = useState<string>('')
  const [masterLufs, setMasterLufs] = useState<number>(-14.0)
  const { toasts, addToast } = useToast()

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Enter: Start processing
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (!processing && files.length > 0) handleProcess()
      }
      // Escape: Cancel rename or clear errors
      if (e.key === 'Escape') {
        if (renamingIndex !== null) {
          setRenamingIndex(null)
        }
        if (error) setError(null)
      }
      // Ctrl + U: Focus URL input
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault()
        const urlInput = document.querySelector('input[placeholder*="YouTube"]') as HTMLInputElement
        urlInput?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [processing, files.length, renamingIndex, error])

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

  const handleAnalyze = async (jobId: string) => {
    try {
      setBpmKey(null)
      const data = await analyzeTrack(jobId)
      if (data.bpm && data.key) {
        setBpmKey({ bpm: data.bpm, key: data.key })
      }
    } catch (e: any) {
      setError(e.message || 'Analysis failed')
    }
  }

  const handleHarmonicAnalysis = async (jobId: string) => {
    try {
      setHarmonicData(null)
      const data = await analyzeHarmonic(jobId)
      if (data.success && data.data) {
        setHarmonicData({
          key: data.data.key,
          mode: data.data.mode,
          tempo: data.data.tempo
        })
      }
    } catch (e: any) {
      setError(e.message || 'Harmonic analysis failed')
    }
  }

  const handleMaster = async (jobId: string, stem: string = 'instrumental') => {
    try {
      setError(null)
      const data = await masterTrack(jobId, stem, masterLufs)
      if (data.success) {
        addToast('Mastering done! Check ' + data.file, 'success')
      }
    } catch (e: any) {
      setError(e.message || 'Mastering failed')
    }
  }

  const masteringPresets = [
    { name: 'Spotify', lufs: -14.0 },
    { name: 'YouTube', lufs: -13.0 },
    { name: 'CD', lufs: -10.0 },
  ]

  const handleUrlDownloadComplete = (jobId: string, filename: string) => {
    // Create a mock file object and add to store
    const mockFile = new File([], filename, { type: 'audio/wav' })
    // Here you would normally add this to the 'files' state
    // For simplicity, we just log or alert
    console.log('Downloaded:', filename, 'JobId:', jobId)
    addToast(`Скачано: ${filename}. JobId: ${jobId}`, 'success')
  }

  return (
    <ErrorBoundary>
      <Toast toasts={toasts} addToast={addToast} />
      <motion.div 
        className="min-h-screen bg-gradient-to-br from-gray-900 to-black p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <header className="max-w-6xl mx-auto glass-premium rounded-2xl p-6 shadow-xl mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Voice Remover Ultra
          </h1>
          <p className="text-gray-300 mt-2">Next-gen stem separation studio</p>
        </header>

        <main className="max-w-6xl mx-auto space-y-6">
          <div className="glass-premium rounded-2xl p-8">
            <UploadZone />
            <UrlInput onDownloadComplete={handleUrlDownloadComplete} />
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
              {results.map((jobResult, jobIdx) => (
                <div key={jobIdx} className="mb-6 last:mb-0">
                  <h4 className="text-lg text-gray-300 mb-2">Job {jobIdx + 1}</h4>
                  <div className="flex flex-wrap gap-4">
                    {jobResult.files.map((file: string) => (
                      <div key={file} className="flex flex-col gap-2">
                        <a
                          href={getDownloadUrl(jobResult.jobId, file)}
                          download
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition flex items-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {file}
                        </a>
                        {file.includes('vocals') && (
                          <button
                            onClick={async () => {
                              const res = await fetch(`/api/denoise/${jobResult.jobId}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ stem: 'vocals', strength: 0.5 })
                              })
                              const data = await res.json()
                              if (data.success) addToast('Denoise done! Check ' + data.file, 'success')
                            }}
                            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded-lg transition"
                          >
                            Denoise
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAnalyze(jobResult.jobId)}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                    >
                      Анализировать (BPM/Key)
                    </button>
                    <button
                      onClick={() => handleHarmonicAnalysis(jobResult.jobId)}
                      className="mt-4 ml-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition text-sm"
                    >
                      🎵 Harmonic Analysis
                    </button>
                    <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => handleMaster(jobResult.jobId, 'instrumental')}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition text-sm"
                    >
                      🎛️ Master
                    </button>
                    
                    <div className="flex gap-1">
                      {masteringPresets.map(preset => (
                        <button
                          key={preset.name}
                          onClick={() => {
                            setMasterLufs(preset.lufs)
                            handleMaster(jobResult.jobId, 'instrumental')
                          }}
                          className={`px-3 py-1 text-xs rounded transition ${
                            masterLufs === preset.lufs ? 'bg-pink-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                          }`}
                        >
                          {preset.name} ({preset.lufs} LUFS)
                        </button>
                      ))}
                    </div>
                    </div>
                    {bpmKey && (
                      <div className="mt-2 text-gray-300">
                        BPM: <span className="font-bold text-white">{bpmKey.bpm}</span> | 
                        Key: <span className="font-bold text-white">{bpmKey.key}</span>
                      </div>
                    )}
                    {harmonicData && (
                      <div className="mt-2 text-gray-300">
                        Key: <span className="font-bold text-white">{harmonicData.key} {harmonicData.mode === 'major' ? '♭' : '♮'}</span> | 
                        Tempo: <span className="font-bold text-white">{Math.round(harmonicData.tempo)} BPM</span> | 
                        Mode: <span className="font-bold text-white">{harmonicData.mode}</span>
                      </div>
                    )}
                    
                    {/* Karaoke Mode */}
                    {isVideo && (
                      <div className="mt-4">
                        <LyricsInput lyrics={lyrics} setLyrics={setLyrics} />
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={async () => {
                              if (!lyrics.trim()) {
                                setError('Введите текст песни')
                                return
                              }
                              try {
                                // First save lyrics to a temp file (simplified - in real app, send via API)
                                const res = await createKaraoke(
                                  jobResult.jobId, 
                                  jobResult.files.find(f => f.includes('vocals') || f.includes('instrumental')) || jobResult.files[0], 
                                  'lyrics.txt'
                                )
                                if (res.success) addToast('Karaoke video created: ' + res.file, 'success')
                              } catch (e: any) {
                                setError(e.message || 'Karaoke failed')
                              }
                            }}
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg transition text-sm"
                          >
                            🎤 Karaoke
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                const audioFile = jobResult.files.find(f => f.includes('instrumental')) || jobResult.files[0]
                                const videoFile = jobResult.files.find(f => f.includes('.mp4') || f.includes('video')) || 'input_video.mp4'
                                const res = await replaceVideoAudio(jobResult.jobId, videoFile, audioFile)
                                if (res.success) addToast('Audio replaced! Check ' + res.file, 'success')
                              } catch (e: any) {
                                setError(e.message || 'Replace audio failed')
                              }
                            }}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                          >
                            🎬 Replace Audio
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {files.length > 0 && <EQ />}

          {/* Превью: Видео или Аудио волна */}
          {files.length > 0 && firstFile && (
            isVideo ? 
              <VideoPreview file={firstFile} /> : 
              previewUrl ? <Waveform audioUrl={previewUrl} height={150} /> : null
          )}

          {/* Спектрограмма для превью */}
          {!isVideo && previewUrl && <Spectrogram audioUrl={previewUrl} />}
          
          <SystemStatus />
        </main>
    </motion.div>
  </ErrorBoundary>
  )
}

export default App
