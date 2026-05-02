import { useState } from 'react'
import { downloadExternal } from '../api/api'

interface Props {
  onDownloadComplete: (jobId: string, filename: string) => void
}

const GENERAL_URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i

type ValidationStatus = 'empty' | 'valid' | 'invalid'

function validateUrl(url: string): ValidationStatus {
  if (!url.trim()) return 'empty'
  return GENERAL_URL_REGEX.test(url) ? 'valid' : 'invalid'
}

export default function UrlInput({ onDownloadComplete }: Props) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validationStatus = validateUrl(url)
  const isValid = validationStatus === 'valid'
  const isInvalid = validationStatus === 'invalid'

  const handleDownload = async () => {
    if (!isValid) return

    setLoading(true)
    setError(null)
    try {
      const res = await downloadExternal(url)
      onDownloadComplete(res.jobId, res.filename || 'input.wav')
      setUrl('')
    } catch (e: any) {
      setError(e.message || 'Не удалось скачать ссылку')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="link-console">
      <div>
        <h4>Скачать по ссылке</h4>
        <p>YouTube, SoundCloud, Vimeo, TikTok и другие источники через локальный yt-dlp.</p>
      </div>

      <div className="link-row">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isValid && !loading) handleDownload()
          }}
          placeholder="Вставьте ссылку на видео или трек"
          className={isInvalid ? 'invalid' : isValid ? 'valid' : ''}
        />

        <button
          onClick={handleDownload}
          disabled={!isValid || loading}
          className="primary-action"
        >
          {loading ? 'Скачиваю...' : 'Скачать'}
        </button>
      </div>

      {isInvalid && url.trim() && (
        <p className="form-hint error">Вставьте полную ссылку, начинающуюся с http:// или https://</p>
      )}
      {isValid && !error && (
        <p className="form-hint success">Ссылка принята. Скачивание пойдет локально, без внешнего API.</p>
      )}
      {error && <p className="form-hint error">Ошибка: {error}</p>}
    </div>
  )
}
