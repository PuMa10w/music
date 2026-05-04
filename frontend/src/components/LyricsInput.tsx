import { useState } from 'react'
import { TimedLyricSegment } from '../api/api'

interface Props {
  lyrics: string
  setLyrics: (lyrics: string) => void
  timedLyrics?: TimedLyricSegment[]
  onUseTimedLyrics?: (segments: TimedLyricSegment[]) => void
}

export default function LyricsInput({ lyrics, setLyrics, timedLyrics, onUseTimedLyrics }: Props) {
  const [activeSegment, setActiveSegment] = useState<number | null>(null)

  const handleUseTimedLyrics = () => {
    if (timedLyrics && onUseTimedLyrics) {
      onUseTimedLyrics(timedLyrics)
      // Convert timed lyrics to plain text for the textarea
      const plainText = timedLyrics.map(seg => seg.text).join('\n')
      setLyrics(plainText)
    }
  }

  return (
    <div className="mt-6 backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
      <h4 className="text-lg mb-4">Текст песни (для караоке)</h4>
      
      {timedLyrics && timedLyrics.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Обнаружены тайминги от Whisper</span>
            <button
              onClick={handleUseTimedLyrics}
              className="px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Использовать тайминги
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
            {timedLyrics.map((seg, idx) => (
              <div 
                key={idx}
                className={`p-1 rounded cursor-pointer transition-colors ${
                  activeSegment === idx ? 'bg-purple-600/30' : 'hover:bg-white/5'
                }`}
                onClick={() => setActiveSegment(idx)}
              >
                <span className="text-gray-400 mr-2">[{seg.start.toFixed(1)}s]</span>
                <span className="text-white">{seg.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Введите текст песни, каждая строка — новый куплет..."
        className="w-full h-32 bg-black/30 border border-white/20 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
      />
      <p className="text-xs text-gray-400 mt-2">
        {timedLyrics ? 'Тайминги загружены. Нажмите "Использовать тайминги" чтобы применить.' : 'Каждая строка будет отображаться отдельно'}
      </p>
    </div>
  )
}
