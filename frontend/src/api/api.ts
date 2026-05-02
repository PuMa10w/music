const isLocalFrontend = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)

export const API_BASE = (
  (import.meta as any).env?.VITE_API_BASE
  || (isLocalFrontend ? '/api' : 'http://127.0.0.1:8000/api')
).replace(/\/$/, '')

export interface TimedLyricSegment {
  start: number
  end: number
  text: string
}

export interface TranscriptionResult {
  success: boolean
  lyricsFile: string
  path: string
  data: TimedLyricSegment[]
  message: string
}

export async function uploadFile(file: File): Promise<{ jobId: string }> {
  const formData = new FormData()
  formData.append('audio', file)
  formData.append('file', file)
  
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error || 'Upload failed')
  }
  return res.json()
}

export async function startSeparation(jobId: string, params: {
  model: string
  mode: string
  preset: string
  vocalStrength?: number
}) {
  let endpoint = `${API_BASE}/separate/${jobId}`
  // Выбираем эндпоинт в зависимости от режима
  if (params.mode === '4stem') endpoint = `${API_BASE}/stems/${jobId}`
  if (params.mode === '6stem') endpoint = `${API_BASE}/stems6/${jobId}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Separation failed')
  return data
}

export async function checkStatus(jobId: string): Promise<{ status: string, result?: any, error?: string }> {
  const res = await fetch(`${API_BASE}/status/${jobId}`)
  return res.json()
}

export function getDownloadUrl(jobId: string, filename: string): string {
  return `${API_BASE}/download/${jobId}/${filename}`
}

export function getZipUrl(jobId: string): string {
  return `${API_BASE}/download-zip/${jobId}`
}

export async function convertFile(jobId: string, filename: string, format: string) {
  const res = await fetch(`${API_BASE}/convert/${jobId}/${encodeURIComponent(filename)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Conversion failed')
  return data as { success: boolean, file: string, url: string }
}

// Поллинг: опрашиваем сервер, пока не будет готово
export async function pollJobStatus(
  jobId: string, 
  onProgress: (status: string) => void,
  interval = 2000
): Promise<any> {
  return new Promise((resolve, reject) => {
    let timer: number | undefined
    const tick = async () => {
      try {
        const data = await checkStatus(jobId)
        onProgress(data.status)
        if (data.status === 'completed') {
          if (timer) clearInterval(timer)
          resolve(data)
        } else if (data.status === 'error') {
          if (timer) clearInterval(timer)
          reject(new Error(data.error || 'Processing failed'))
        }
      } catch (e) {
        if (timer) clearInterval(timer)
        reject(e)
      }
    }
    tick()
    timer = window.setInterval(tick, interval)
  })
}

export async function analyzeTrack(jobId: string) {
  const res = await fetch(`${API_BASE}/analyze/${jobId}`, { method: 'POST' })
  return res.json()
}

export async function masterTrack(jobId: string, stem: string = 'instrumental', targetLufs: number = -14.0) {
  const res = await fetch(`${API_BASE}/master/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stem, target_lufs: targetLufs })
  })
  return res.json()
}

export async function denoiseTrack(jobId: string, stem: string = 'vocals') {
  const res = await fetch(`${API_BASE}/denoise/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stem })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Denoise failed')
  return data as { success: boolean, file: string, url: string }
}

export async function downloadExternal(url: string) {
  const res = await fetch(`${API_BASE}/download-external`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || 'Download failed')
  return data
}

export async function replaceVideoAudio(jobId: string, videoFile: string, audioStem: string = 'instrumental') {
  const res = await fetch(`${API_BASE}/replace-audio/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoFile, audioStem })
  })
  return res.json()
}

export async function createKaraoke(jobId: string, videoFile: string, lyricsFile: string) {
  const res = await fetch(`${API_BASE}/karaoke/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoFile, lyricsFile })
  })
  return res.json()
}

export async function transcribeTrack(jobId: string): Promise<TranscriptionResult> {
  const res = await fetch(`${API_BASE}/transcribe/${jobId}`, {
    method: 'POST'
  })
  return res.json()
}

export interface HarmonicAnalysisResult {
  success: boolean
  data: {
    key: string
    mode: string
    tempo: number
    time_signature: string
  }
  message: string
}

export async function analyzeHarmonic(jobId: string): Promise<HarmonicAnalysisResult> {
  const res = await fetch(`${API_BASE}/analyze-harmonic/${jobId}`, {
    method: 'POST'
  })
  return res.json()
}

export interface MixResult {
  success: boolean;
  file?: string;
  vocalLevel?: number;
  path?: string;
  error?: string;
}

export async function mixStems(jobId: string, vocalLevel: number = 1.0, instrumentalFile?: string, vocalsFile?: string): Promise<MixResult> {
  const res = await fetch(`${API_BASE}/mix/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vocalLevel, instrumentalFile, vocalsFile })
  })
  return res.json()
}
