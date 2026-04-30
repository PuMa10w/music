import { useState } from 'react'
import { downloadExternal } from '../api/api'

interface Props {
  onDownloadComplete: (jobId: string, filename: string) => void
}

export default function UrlInput({ onDownloadComplete }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    try {
      const res = await downloadExternal(url)
      if (res.success) {
        onDownloadComplete(res.jobId, res.filename)
        setUrl('')
      } else {
        setError(res.error || 'Download failed')
      }
    } catch (e: any) {
      setError(e.message || 'Download error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-6 backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
      <h4 className="text-lg mb-4">Скачать из интернета</h4>
      <div className="flex gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Вставьте ссылку YouTube, SoundCloud..."
          className="flex-1 bg-black/30 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleDownload}
          disabled={loading}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50"
        >
          {loading ? 'СКАЧИВАНИЕ...' : 'СКАЧАТЬ'}
        </button>
      </div>
      {error && (
        <p className="text-red-400 text-sm mt-2">Ошибка: {error}</p>
      )}
    </div>
  )
}
