import { useState, useCallback } from 'react'
import { downloadExternal } from '../api/api'

interface Props {
  onDownloadComplete: (jobId: string, filename: string) => void
}

// URL validation patterns
const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[\w-]+/i
const SOUNDCLOUD_REGEX = /^(https?:\/\/)?(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i
const GENERAL_URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/i

type ValidationStatus = 'empty' | 'valid' | 'invalid'

function validateUrl(url: string): ValidationStatus {
  if (!url.trim()) return 'empty'
  
  // Check if it's a valid URL format first
  if (!GENERAL_URL_REGEX.test(url)) return 'invalid'
  
  // Check if it's a supported platform
  if (YOUTUBE_REGEX.test(url) || SOUNDCLOUD_REGEX.test(url)) {
    return 'valid'
  }
  
  // Generic valid URL but not a supported platform
  return 'invalid'
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValid && !loading) {
      handleDownload()
    }
  }

  return (
    <div className="glass-premium mt-6 backdrop-blur-2xl bg-white/[0.03] rounded-3xl p-6 border border-white/10 shadow-2xl">
      <h4 className="text-lg mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent font-semibold">
        Скачать из интернета
      </h4>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Вставьте ссылку YouTube, SoundCloud..."
            className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none transition-all duration-300 ${
              isInvalid
                ? 'border-red-500/70 focus:border-red-500'
                : isValid
                ? 'border-green-500/50 focus:border-green-400'
                : 'border-white/20 focus:border-purple-500'
            }`}
          />
          
          {/* Validation indicator */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validationStatus === 'valid' && (
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
            {validationStatus === 'invalid' && url.trim() && (
              <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
        </div>
        
        <button
          onClick={handleDownload}
          disabled={!isValid || loading}
          className={`w-full sm:w-auto px-6 py-3 rounded-xl font-semibold transition-all duration-300 ${
            isValid && !loading
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white shadow-lg shadow-purple-500/20'
              : 'bg-white/5 text-gray-500 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              СКАЧИВАНИЕ...
            </span>
          ) : (
            'СКАЧАТЬ'
          )}
        </button>
      </div>
      
      {/* Validation message */}
      {isInvalid && url.trim() && (
        <p className="text-red-400/80 text-sm mt-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Поддерживаются только ссылки YouTube и SoundCloud
        </p>
      )}
      {isValid && (
        <p className="text-green-400/80 text-sm mt-2 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ссылка корректна, можно скачивать
        </p>
      )}
      
      {error && (
        <p className="text-red-400 text-sm mt-2">Ошибка: {error}</p>
      )}
    </div>
  )
}
