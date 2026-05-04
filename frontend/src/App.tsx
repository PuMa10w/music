import { useState, useEffect, lazy, Suspense } from 'react'
import ErrorBoundary from './components/ErrorBoundary'
import UploadZone from './components/UploadZone'
import UrlInput from './components/UrlInput'
import LyricsInput from './components/LyricsInput'
import FileList from './components/FileList'
import { useStore } from './stores/useStore'
import { AnimatePresence, motion } from 'framer-motion'
import { uploadFile, startSeparation, pollJobStatus, getDownloadUrl, analyzeTrack, masterTrack, replaceVideoAudio, analyzeHarmonic, mixStems, createKaraoke } from './api/api'
import { useToast } from './hooks/useToast'
import { useWebSocket, ProgressData } from './hooks/useWebSocket'
import { useProcessingHistory } from './hooks/useProcessingHistory'
import Toast from './components/Toast'
import SystemStatus from './components/SystemStatus'
import FirefliesBackground from './components/FirefliesBackground'

const Waveform = lazy(() => import('./components/Waveform'))
const VideoPreview = lazy(() => import('./components/VideoPreview'))
const Spectrogram = lazy(() => import('./components/Spectrogram'))
const EQ = lazy(() => import('./components/EQ'))

function App() {
  const files = useStore(s => s.files)
  const currentMode = useStore(s => s.currentMode)
  const setMode = useStore(s => s.setMode)
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<{ jobId: string, files: string[] }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number, total: number } | null>(null)
  const [bpmKey, setBpmKey] = useState<{ bpm: number, key: string } | null>(null)
  const [harmonicData, setHarmonicData] = useState<{ key: string, mode: string, tempo: number } | null>(null)
  const [lyrics, setLyrics] = useState<string>('')
  const [masterLufs, setMasterLufs] = useState<number>(-14.0)
  const [vocalLevel, setVocalLevel] = useState<number>(1.0)
  const { toasts, addToast } = useToast()
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const { progress: wsProgress, connected: wsConnected } = useWebSocket(currentJobId)
  const { history, addToHistory, clearHistory } = useProcessingHistory()

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (!processing && files.length > 0) handleProcess()
      }
      if (e.key === 'Escape') {
        if (error) setError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [processing, files.length, error])

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
          setCurrentJobId(res.jobId)
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
            addToHistory({
              jobId: res.jobId,
              filename: file.name,
              timestamp: Date.now(),
              files: data.files || [],
              mode: currentMode
            })
          }
        }
      }
      setResults(overallResults.length > 0 ? overallResults : null)
      if (overallResults.length > 0) {
        addToast(`✨ Обработано файлов: ${overallResults.length}`, 'success')
      }
    } catch (e: any) {
      setError(e.message || 'Processing failed')
      addToast(`❌ Ошибка: ${e.message}`, 'error')
    } finally {
      setProcessing(false)
      setBatchProgress(null)
      setCurrentJobId(null)
    }
  }

  const handleAnalyze = async (jobId: string) => {
    try {
      setBpmKey(null)
      const data = await analyzeTrack(jobId)
      if (data.bpm && data.key) {
        setBpmKey({ bpm: data.bpm, key: data.key })
        addToast(`🎵 BPM: ${data.bpm}, Key: ${data.key}`, 'success')
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
        addToast(`🎶 Harmonic: ${data.data.key} ${data.data.mode}`, 'success')
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
        addToast('🎛️ Mastering done! ' + data.file, 'success')
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

  const modeConfig = {
    '2stem': { emoji: '🎵', label: '2 Stem', desc: 'Vocals + Instrumental' },
    '4stem': { emoji: '🎹', label: '4 Stem', desc: 'Vocals + Drums + Bass + Other' },
    '6stem': { emoji: '🎚️', label: '6 Stem', desc: 'Full separation' },
  }

  return (
    <ErrorBoundary>
      <Toast toasts={toasts} addToast={addToast} />
      <motion.div 
        className="min-h-screen aurora-bg p-4 sm:p-6 lg:p-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <FirefliesBackground />
        
        {/* HEADER */}
        <motion.header 
          className="max-w-6xl mx-auto mb-8"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="glass-premium rounded-2xl p-6 sm:p-8 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="header-title gradient-text">
                  🎵 Voice Remover Ultra
                </h1>
                <p className="header-subtitle mt-2">
                  Next-gen AI-powered stem separation studio
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="badge">v2.0</span>
                  <span className="badge badge-pink">AI Enhanced</span>
                  <span className="badge badge-blue">Real-time</span>
                </div>
              </div>
              
              <SystemStatus />
            </div>
          </div>
        </motion.header>

        <main className="max-w-6xl mx-auto px-0 sm:px-4 space-y-6">
          
          {/* UPLOAD SECTION */}
          <motion.div
            className="glass-premium rounded-2xl p-6 sm:p-8"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
                📤
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Upload & Process</h2>
                <p className="text-sm text-gray-400">Drop files or enter URL</p>
              </div>
            </div>
            
            <UploadZone />
            <div className="my-6 border-t border-white/5"></div>
            <UrlInput />
            <FileList />
          </motion.div>

          {/* SETTINGS SECTION */}
          {files.length > 0 && (
            <motion.div
              className="glass-premium rounded-2xl p-6 sm:p-8"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl">
                  ⚙️
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Settings</h2>
                  <p className="text-sm text-gray-400">Configure separation mode</p>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-300 mb-3 block">
                  Separation Mode
                </label>
                <div className="mode-selector">
                  {Object.entries(modeConfig).map(([mode, config]) => (
                    <button
                      key={mode}
                      onClick={() => setMode(mode as any)}
                      className={`mode-btn ${currentMode === mode ? 'active' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{config.emoji}</span>
                        <span className="font-semibold">{config.label}</span>
                      </span>
                      <span className="text-xs opacity-60 mt-1 block">{config.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress Bars */}
              <AnimatePresence>
                {batchProgress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-black/20 rounded-xl p-4">
                      <div className="flex justify-between text-sm text-gray-300 mb-2">
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⚙️</span>
                          Processing batch...
                        </span>
                        <span className="font-mono">{batchProgress.current} / {batchProgress.total}</span>
                      </div>
                      <div className="progress-premium">
                        <motion.div 
                          className="bar"
                          initial={{ width: 0 }}
                          animate={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {wsProgress && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 overflow-hidden"
                  >
                    <div className="bg-black/20 rounded-xl p-4">
                      <div className="flex justify-between text-sm text-gray-300 mb-2">
                        <span>{wsProgress.action} - {wsProgress.message}</span>
                        <span className="font-mono">{wsProgress.percent || 0}%</span>
                      </div>
                      <div className="progress-premium">
                        <motion.div 
                          className="bar"
                          initial={{ width: 0 }}
                          animate={{ width: `${wsProgress.percent || 0}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Process Button */}
              <motion.button
                onClick={handleProcess}
                disabled={processing}
                className="btn-premium w-full sm:w-auto"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {processing ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span>
                    PROCESSING...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>🚀</span>
                    START PROCESSING
                  </span>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ERROR DISPLAY */}
          <AnimatePresence>
            {error && (
              <motion.div
                className="glass-premium rounded-2xl p-6 border-red-500/50 bg-red-500/10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="font-bold text-red-300">Error</h3>
                    <p className="text-red-200 text-sm mt-1">{error}</p>
                  </div>
                  <button 
                    onClick={() => setError(null)}
                    className="ml-auto text-red-300 hover:text-white transition"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* RESULTS SECTION */}
          <AnimatePresence>
            {results && (
              <motion.div
                className="glass-premium rounded-2xl p-6 sm:p-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xl">
                    ✅
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Results</h2>
                    <p className="text-sm text-gray-400">Download your separated tracks</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {results.map((jobResult, jobIdx) => (
                    <motion.div 
                      key={jobIdx}
                      className="bg-black/20 rounded-xl p-5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: jobIdx * 0.1 }}
                    >
                      <h4 className="text-lg text-gray-300 mb-3 flex items-center gap-2">
                        <span className="text-purple-400">🎵</span>
                        Job {jobIdx + 1}
                      </h4>
                      
                      <div className="flex flex-wrap gap-3 mb-4">
                        {jobResult.files.map((file: string) => (
                          <motion.a
                            key={file}
                            href={getDownloadUrl(jobResult.jobId, file)}
                            download
                            className="btn-premium !py-2 !px-4 !text-sm inline-flex items-center gap-2"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <span>⬇️</span>
                            {file}
                          </motion.a>
                        ))}
                      </div>

                      {/* ZIP Download */}
                      <div className="mb-4">
                        <button
                          onClick={() => window.open(`/api/download-zip/${jobResult.jobId}`, '_blank')}
                          className="btn-premium !py-2 !px-4 !text-sm !bg-green-600 hover:!bg-green-700"
                        >
                          📦 Download All (ZIP)
                        </button>
                      </div>

                      {/* Analysis Buttons */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <button
                          onClick={() => handleAnalyze(jobResult.jobId)}
                          className="btn-premium !py-2 !px-4 !text-sm !bg-blue-600 hover:!bg-blue-700"
                        >
                          🎵 Analyze (BPM/Key)
                        </button>
                        
                        <button
                          onClick={() => handleHarmonicAnalysis(jobResult.jobId)}
                          className="btn-premium !py-2 !px-4 !text-sm !bg-indigo-600 hover:!bg-indigo-700"
                        >
                          🎶 Harmonic Analysis
                        </button>

                        <button
                          onClick={() => handleMaster(jobResult.jobId, 'instrumental')}
                          className="btn-premium !py-2 !px-4 !text-sm !bg-purple-600 hover:!bg-purple-700"
                        >
                          🎛️ Master
                        </button>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {masteringPresets.map(preset => (
                          <button
                            key={preset.name}
                            onClick={() => {
                              setMasterLufs(preset.lufs)
                              handleMaster(jobResult.jobId, 'instrumental')
                            }}
                            className={`!py-2 !px-3 !text-xs rounded-lg transition ${
                              masterLufs === preset.lufs 
                                ? 'bg-pink-600 text-white' 
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                          >
                            {preset.name} ({preset.lufs} LUFS)
                          </button>
                        ))}
                      </div>

                      {/* Analysis Results */}
                      <AnimatePresence>
                        {bpmKey && (
                          <motion.div 
                            className="bg-white/5 rounded-xl p-4 mb-4"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <div className="flex gap-6 text-sm">
                              <div>
                                <span className="text-gray-400">BPM:</span>
                                <span className="ml-2 font-bold text-white">{bpmKey.bpm}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Key:</span>
                                <span className="ml-2 font-bold text-white">{bpmKey.key}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {harmonicData && (
                          <motion.div 
                            className="bg-white/5 rounded-xl p-4 mb-4"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                          >
                            <div className="flex gap-6 text-sm flex-wrap">
                              <div>
                                <span className="text-gray-400">Key:</span>
                                <span className="ml-2 font-bold text-white">
                                  {harmonicData.key} {harmonicData.mode === 'major' ? '♭' : '♮'}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Tempo:</span>
                                <span className="ml-2 font-bold text-white">
                                  {Math.round(harmonicData.tempo)} BPM
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-400">Mode:</span>
                                <span className="ml-2 font-bold text-white">{harmonicData.mode}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Vocal Level Control */}
                      <div className="bg-black/20 rounded-xl p-4">
                        <label className="text-sm text-gray-300 mb-2 flex items-center gap-2">
                          <span>🎤</span>
                          Vocal Removal Level: <span className="text-purple-400 font-bold">{vocalLevel}</span>
                        </label>
                        <input 
                          type="range" 
                          min="0" 
                          max="1" 
                          step="0.1" 
                          value={vocalLevel} 
                          onChange={(e) => setVocalLevel(parseFloat(e.target.value))}
                          className="w-full"
                        />
                        <button
                          onClick={async () => {
                            if (!jobResult) return;
                            const res = await mixStems(jobResult.jobId, vocalLevel);
                            if (res.success) addToast(`🎤 Mixed: ${res.file}`, 'success');
                          }}
                          className="btn-premium !py-2 !px-4 !text-sm mt-3"
                        >
                          🎤 Mix Stems
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HISTORY SECTION */}
          {history.length > 0 && (
            <motion.div
              className="glass-premium rounded-2xl p-6 sm:p-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xl">
                    📊
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Processing History</h2>
                    <p className="text-sm text-gray-400">{history.length} items</p>
                  </div>
                </div>
                <button 
                  onClick={clearHistory} 
                  className="btn-premium !py-2 !px-4 !text-sm !bg-red-600 hover:!bg-red-700"
                >
                  🗑️ Clear
                </button>
              </div>

              <div className="space-y-3">
                {history.map((item: any, index: number) => (
                  <motion.div 
                    key={index}
                    className="file-item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex-1">
                      <div className="font-bold text-white">{item.filename}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(item.timestamp).toLocaleString()} • {item.mode}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {item.files.map((file: string) => (
                        <a 
                          key={file}
                          href={getDownloadUrl(item.jobId, file)}
                          download
                          className="!py-1 !px-3 !text-xs btn-premium"
                        >
                          {file}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* PREVIEW SECTION */}
          {files.length > 0 && (
            <motion.div
              className="glass-premium rounded-2xl p-6 sm:p-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xl">
                  👁️
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Preview</h2>
                  <p className="text-sm text-gray-400">Waveform & Spectrogram</p>
                </div>
              </div>

              <Suspense fallback={<div className="text-center p-8 text-gray-400">Loading preview...</div>}>
                {files[0] && (
                  <div className="space-y-6">
                    <Waveform audioUrl={URL.createObjectURL(files[0])} height={150} />
                    <Spectrogram audioUrl={URL.createObjectURL(files[0])} />
                  </div>
                )}
              </Suspense>
            </motion.div>
          )}

          {/* EQ SECTION */}
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Suspense fallback={null}>
                <EQ />
              </Suspense>
            </motion.div>
          )}
        </main>

        {/* FOOTER */}
        <motion.footer 
          className="max-w-6xl mx-auto mt-12 mb-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="glass-premium rounded-xl p-4">
            <p className="text-sm text-gray-400">
              Built with 💜 using React, Framer Motion & Tailwind CSS
            </p>
          </div>
        </motion.footer>
      </motion.div>
    </ErrorBoundary>
  )
}

export default App
