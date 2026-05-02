import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import ErrorBoundary from './components/ErrorBoundary'
import UploadZone from './components/UploadZone'
import UrlInput from './components/UrlInput'
import FileList from './components/FileList'
import Toast from './components/Toast'
import SystemStatus from './components/SystemStatus'
import FirefliesBackground from './components/FirefliesBackground'
import { useStore } from './stores/useStore'
import { useToast } from './hooks/useToast'
import { useWebSocket } from './hooks/useWebSocket'
import { useProcessingHistory } from './hooks/useProcessingHistory'
import {
  uploadFile,
  startSeparation,
  pollJobStatus,
  getDownloadUrl,
  getZipUrl,
  convertFile,
  analyzeTrack,
  masterTrack,
  denoiseTrack,
  analyzeHarmonic,
  mixStems,
} from './api/api'

const Waveform = lazy(() => import('./components/Waveform'))
const VideoPreview = lazy(() => import('./components/VideoPreview'))
const Spectrogram = lazy(() => import('./components/Spectrogram'))
const EQ = lazy(() => import('./components/EQ'))

type StudioTab = 'studio' | 'results' | 'tools' | 'history'
type ResultRecord = { jobId: string; files: string[]; title?: string }

const tabs: Array<{ id: StudioTab; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'results', label: 'Results' },
  { id: 'tools', label: 'Tools' },
  { id: 'history', label: 'History' },
]

function App() {
  const files = useStore(s => s.files)
  const currentMode = useStore(s => s.currentMode)
  const setMode = useStore(s => s.setMode)
  const selectedModel = useStore(s => s.selectedModel)
  const setModel = useStore(s => s.setModel)
  const { toasts, addToast } = useToast()
  const { history, addToHistory, clearHistory } = useProcessingHistory()

  const [activeTab, setActiveTab] = useState<StudioTab>('studio')
  const [processing, setProcessing] = useState(false)
  const [results, setResults] = useState<ResultRecord[]>([])
  const [error, setError] = useState<string | null>(null)
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null)
  const [analysisByJob, setAnalysisByJob] = useState<Record<string, string[]>>({})
  const [vocalLevel, setVocalLevel] = useState(1)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [modelOptions, setModelOptions] = useState<Array<{ id: string; name: string; family?: string; badge?: string; compact?: string }>>([
    { id: 'modern_ensemble', name: 'Modern AI Ensemble', family: 'Hybrid', badge: 'Recommended' },
  ])

  const firstFile = files[0] || null
  const isVideo = firstFile?.type.startsWith('video/') || false
  const { progress: wsProgress, connected: wsConnected } = useWebSocket(currentJobId)
  const activeModel = modelOptions.find(m => m.id === selectedModel) || modelOptions[0]

  const resultCount = useMemo(() => results.reduce((sum, job) => sum + job.files.length, 0), [results])

  useEffect(() => {
    if (!firstFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(firstFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [firstFile])

  useEffect(() => {
    fetch('/api/models')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data || typeof data !== 'object') return
        const models = Object.entries(data).map(([id, value]: [string, any]) => ({
          id,
          name: value?.name || id,
          family: value?.family,
          badge: value?.badge,
          compact: value?.compact,
        }))
        setModelOptions(models)
        if (!models.some(model => model.id === selectedModel)) setModel(models[0]?.id || 'modern_ensemble')
      })
      .catch(() => undefined)
  }, [selectedModel, setModel])

  const mergeResultFile = (jobId: string, file: string) => {
    setResults(prev => prev.map(job => (
      job.jobId === jobId && !job.files.includes(file)
        ? { ...job, files: [...job.files, file] }
        : job
    )))
  }

  const handleSeparateExistingJob = async (jobId: string) => {
    setProcessing(true)
    setError(null)
    setCurrentJobId(jobId)
    try {
      await startSeparation(jobId, { model: selectedModel, mode: currentMode, preset: 'default' })
      const status = await pollJobStatus(jobId, () => undefined, 700)
      const outputFiles = status.files || []
      setResults(prev => prev.map(job => job.jobId === jobId ? { ...job, files: outputFiles } : job))
      addToast('Разделение завершено', 'success')
      setActiveTab('results')
    } catch (e: any) {
      setError(e.message || 'Processing failed')
    } finally {
      setProcessing(false)
      setCurrentJobId(null)
    }
  }

  const handleProcess = async () => {
    if (!files.length) return
    setProcessing(true)
    setError(null)
    setResults([])
    setBatchProgress({ current: 0, total: files.length })

    const completed: ResultRecord[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setBatchProgress({ current: i + 1, total: files.length })
        const upload = await uploadFile(file)
        setCurrentJobId(upload.jobId)
        await startSeparation(upload.jobId, { model: selectedModel, mode: currentMode, preset: 'default' })
        const status = await pollJobStatus(upload.jobId, () => undefined, 700)
        const outputFiles = status.files || []
        completed.push({ jobId: upload.jobId, files: outputFiles, title: file.name })
        addToHistory({ jobId: upload.jobId, filename: file.name, timestamp: Date.now(), files: outputFiles, mode: currentMode })
      }
      setResults(completed)
      setActiveTab('results')
      addToast('Файлы обработаны локально', 'success')
    } catch (e: any) {
      setError(e.message || 'Processing failed')
    } finally {
      setProcessing(false)
      setBatchProgress(null)
      setCurrentJobId(null)
    }
  }

  const handleUrlDownloadComplete = (jobId: string, filename: string) => {
    setResults(prev => [{ jobId, files: [filename], title: 'Downloaded link' }, ...prev])
    setActiveTab('results')
    addToast(`Скачано: ${filename}`, 'success')
  }

  const handleConvert = async (jobId: string, filename: string, format: string) => {
    try {
      const data = await convertFile(jobId, filename, format)
      mergeResultFile(jobId, data.file)
      addToast(`Конвертировано: ${data.file}`, 'success')
    } catch (e: any) {
      setError(e.message || 'Conversion failed')
    }
  }

  const handleAnalyze = async (jobId: string) => {
    const basic = await analyzeTrack(jobId)
    const harmonic = await analyzeHarmonic(jobId)
    const lines = [
      `BPM: ${basic.bpm || harmonic.data?.tempo || 120}`,
      `Key: ${basic.key || harmonic.data?.key || 'C'}`,
      `Mode: ${harmonic.data?.mode || 'major'}`,
      `Duration: ${Math.round(basic.duration || 0)}s`,
    ]
    setAnalysisByJob(prev => ({ ...prev, [jobId]: lines }))
  }

  const handleMaster = async (jobId: string) => {
    const data = await masterTrack(jobId, 'instrumental', -14)
    if (data.success) {
      mergeResultFile(jobId, data.file)
      addToast(`Mastered: ${data.file}`, 'success')
    } else {
      setError(data.error || 'Mastering failed')
    }
  }

  const handleDenoise = async (jobId: string) => {
    const data = await denoiseTrack(jobId, 'vocals')
    mergeResultFile(jobId, data.file)
    addToast(`Denoised: ${data.file}`, 'success')
  }

  const handleMix = async (jobId: string) => {
    const data = await mixStems(jobId, vocalLevel)
    if (data.success && data.file) {
      mergeResultFile(jobId, data.file)
      addToast(`Mixed: ${data.file}`, 'success')
    } else {
      setError(data.error || 'Mix failed')
    }
  }

  const progressPercent = batchProgress ? Math.round((batchProgress.current / batchProgress.total) * 100) : (wsProgress?.percent || 0)

  return (
    <ErrorBoundary>
      <Toast toasts={toasts} />
      <motion.div className="studio-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
        <FirefliesBackground />
        <div className="studio-shell">
          <header className="topbar">
            <div>
              <p className="eyebrow">100% local studio</p>
              <h1>Voice Remover Ultra</h1>
            </div>
            <nav className="tabbar" aria-label="Studio navigation">
              {tabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? 'active' : ''}>
                  {tab.label}
                </button>
              ))}
            </nav>
          </header>

          <section className="hero-console">
            <div className="hero-copy">
              <span className="status-badge">Local ffmpeg engine</span>
              <h2>Разделение вокала, конвертация и скачивание в одном рабочем экране</h2>
              <p>Файлы обрабатываются на этом компьютере: загрузка, stems, denoise, master, mix, ZIP и экспорт в популярные форматы.</p>
            </div>
            <div className="model-card">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Selected model</p>
                  <h3>{activeModel?.name}</h3>
                </div>
                <span className="status-badge">{activeModel?.badge || 'Local'}</span>
              </div>
              <p>{activeModel?.compact || 'Local compatible processing profile'}</p>
              <div className="studio-meter" aria-hidden="true">
                {[46, 72, 58, 94, 67, 82, 52, 76, 62, 88, 54, 70].map((height, idx) => (
                  <span key={idx} style={{ height: `${height}%` }} />
                ))}
              </div>
            </div>
          </section>

          {error && <div className="error-banner">Ошибка: {error}</div>}

          <main className="studio-layout">
            <section className="workspace">
              {activeTab === 'studio' && (
                <>
                  <div className="studio-panel">
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Input</p>
                        <h3>Файлы и ссылки</h3>
                      </div>
                      <span>{files.length} selected</span>
                    </div>
                    <UploadZone />
                    <UrlInput onDownloadComplete={handleUrlDownloadComplete} />
                    <FileList />
                  </div>

                  <Suspense fallback={<div className="studio-panel">Loading preview...</div>}>
                    {files.length > 0 && <EQ />}
                    {files.length > 0 && firstFile && (
                      <div className="studio-panel">
                        <div className="section-head">
                          <div>
                            <p className="eyebrow">Preview</p>
                            <h3>{isVideo ? 'Video' : 'Waveform'}</h3>
                          </div>
                        </div>
                        {isVideo ? <VideoPreview file={firstFile} /> : previewUrl ? <Waveform audioUrl={previewUrl} height={150} /> : null}
                        {!isVideo && previewUrl && <Spectrogram audioUrl={previewUrl} />}
                      </div>
                    )}
                  </Suspense>
                </>
              )}

              {activeTab === 'results' && (
                <div className="studio-panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Output</p>
                      <h3>Результаты ({resultCount})</h3>
                    </div>
                  </div>
                  {results.length === 0 && <p className="empty-state">Пока нет результатов. Добавьте файл или ссылку и запустите обработку.</p>}
                  <div className="result-stack">
                    {results.map((job, index) => {
                      const hasVocals = job.files.includes('vocals.wav')
                      const hasInstrumental = job.files.includes('instrumental.wav')
                      const hasStems = hasVocals && hasInstrumental
                      return (
                      <article key={job.jobId} className="result-job">
                        <div className="section-head">
                          <div>
                            <p className="eyebrow">{job.title || `Job ${index + 1}`}</p>
                            <h3>{job.jobId.slice(0, 8)}</h3>
                          </div>
                          {!hasStems && (
                            <button onClick={() => handleSeparateExistingJob(job.jobId)} className="secondary-action" disabled={processing}>
                              Separate
                            </button>
                          )}
                        </div>

                        <div className="download-grid">
                          {job.files.map(file => (
                            <div key={file} className="download-card">
                              <strong>{file}</strong>
                              <a href={getDownloadUrl(job.jobId, file)} download className="primary-action">Download</a>
                              <div className="format-row">
                                {['mp3', 'flac', 'ogg', 'm4a', 'wav', 'opus'].map(format => (
                                  <button key={format} onClick={() => handleConvert(job.jobId, file, format)}>{format}</button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="tool-row">
                          <button onClick={() => handleAnalyze(job.jobId)} className="secondary-action">BPM / Key</button>
                          {hasVocals && <button onClick={() => handleDenoise(job.jobId)} className="secondary-action">Denoise vocals</button>}
                          {hasInstrumental && <button onClick={() => handleMaster(job.jobId)} className="secondary-action">Master instrumental</button>}
                          {hasStems && <button onClick={() => handleMix(job.jobId)} className="secondary-action">Mix stems</button>}
                          <a href={getZipUrl(job.jobId)} download={`${job.jobId}.zip`} className="secondary-action">Download ZIP</a>
                        </div>

                        {analysisByJob[job.jobId] && (
                          <div className="analysis-grid">
                            {analysisByJob[job.jobId].map(line => <span key={line}>{line}</span>)}
                          </div>
                        )}
                      </article>
                      )
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'tools' && (
                <div className="tools-grid">
                  {[
                    ['Vocal remover', '2-stem separation with vocals and instrumental files.'],
                    ['Stem studio', '4 and 6-stem output profiles for drums, bass, vocals and extras.'],
                    ['Universal converter', 'WAV, MP3, FLAC, OGG, M4A, OPUS and video containers.'],
                    ['Link downloader', 'Paste a link; local yt-dlp handles supported services.'],
                    ['Master / denoise / mix', 'Post-processing tools run from every result card.'],
                    ['ZIP export', 'One-click archive with all generated files.'],
                  ].map(([title, text]) => (
                    <div key={title} className="tool-card">
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="studio-panel">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Archive</p>
                      <h3>История</h3>
                    </div>
                    {history.length > 0 && <button onClick={clearHistory} className="ghost-action">Очистить</button>}
                  </div>
                  {history.length === 0 && <p className="empty-state">История появится после первой обработки.</p>}
                  <div className="history-list">
                    {history.map((item: any, index: number) => (
                      <div key={`${item.jobId}-${index}`} className="history-row">
                        <div>
                          <strong>{item.filename}</strong>
                          <span>{new Date(item.timestamp).toLocaleString()} | {item.mode}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.files.map((file: string) => (
                            <a key={file} href={getDownloadUrl(item.jobId, file)} download className="mini-action">{file}</a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <aside className="control-rail">
              <div className="studio-panel sticky-panel">
                <div className="section-head">
                  <div>
                    <p className="eyebrow">Controls</p>
                    <h3>Processing</h3>
                  </div>
                </div>

                <div className="segmented">
                  {(['2stem', '4stem', '6stem'] as const).map(mode => (
                    <button key={mode} onClick={() => setMode(mode)} className={currentMode === mode ? 'active' : ''}>{mode}</button>
                  ))}
                </div>

                <label className="field-label">Local model</label>
                <select value={selectedModel} onChange={(e) => setModel(e.target.value)} className="studio-input">
                  {modelOptions.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>

                <label className="field-label">Vocal level: {vocalLevel.toFixed(1)}</label>
                <input type="range" min="0" max="1" step="0.1" value={vocalLevel} onChange={(e) => setVocalLevel(parseFloat(e.target.value))} className="studio-range" />

                {(batchProgress || wsProgress) && (
                  <div className="progress-card">
                    <div className="section-head">
                      <span>{batchProgress ? `${batchProgress.current}/${batchProgress.total}` : (wsConnected ? 'Live' : 'Polling')}</span>
                      <strong>{progressPercent}%</strong>
                    </div>
                    <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
                  </div>
                )}

                <button onClick={handleProcess} disabled={processing || files.length === 0} className="primary-action launch-button">
                  {processing ? 'Processing...' : files.length ? 'Start local processing' : 'Add a file'}
                </button>
              </div>
            </aside>
          </main>
        </div>
        <SystemStatus />
      </motion.div>
    </ErrorBoundary>
  )
}

export default App
