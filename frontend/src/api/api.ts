const API_BASE = '/api'

export async function uploadFile(file: File): Promise<{ jobId: string }> {
  const formData = new FormData()
  formData.append('file', file)
  
  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData
  })
  return res.json()
}

export async function startSeparation(jobId: string, params: {
  model: string
  mode: string
  preset: string
  vocalStrength?: number
}) {
  const res = await fetch(`${API_BASE}/separate/${jobId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  return res.json()
}

// Добавим позже: 4stem, 6stem, пресеты, шумоподавление...
