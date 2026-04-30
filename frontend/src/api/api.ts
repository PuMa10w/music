const API_BASE = '/api'

export async function uploadFile(file: File): Promise<{ jobId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  })
  if (!res.ok) throw new Error('Upload failed')
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
  return res.json()
}

export async function checkStatus(jobId: string): Promise<{ status: string, result?: any }> {
  const res = await fetch(`${API_BASE}/status/${jobId}`)
  return res.json()
}

export function getDownloadUrl(jobId: string, filename: string): string {
  return `${API_BASE}/download/${jobId}/${filename}`
}

// Поллинг: опрашиваем сервер, пока не будет готово
export async function pollJobStatus(
  jobId: string, 
  onProgress: (status: string) => void,
  interval = 2000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setInterval(async () => {
      try {
        const data = await checkStatus(jobId)
        onProgress(data.status)
        if (data.status === 'completed') {
          clearInterval(timer)
          resolve(data)
        } else if (data.status === 'error') {
          clearInterval(timer)
          reject(new Error(data.error || 'Processing failed'))
        }
      } catch (e) {
        clearInterval(timer)
        reject(e)
      }
    }, interval)
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
