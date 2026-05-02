import { useState } from 'react'
import { TimedLyricSegment } from '../api/api'

interface Props {
  lyrics: string
  setLyrics: (lyrics: string) => void
  timedLyrics?: TimedLyricSegment[]
  onUseTimedLyrics?: (segments: TimedLyricSegment[]) => void
  className?: string
}

export default function LyricsInput({ lyrics, setLyrics, timedLyrics, onUseTimedLyrics }: Props) {
  const [activeSegment, setActiveSegment] = useState<number | null>(null)

  const handleUseTimedLyrics = () => {
    if (!timedLyrics || !onUseTimedLyrics) return
    onUseTimedLyrics(timedLyrics)
    setLyrics(timedLyrics.map(seg => seg.text).join('\n'))
  }

  return (
    <div className="studio-panel mt-4">
      <h4 className="text-lg mb-4">Текст песни для караоке</h4>

      {timedLyrics && timedLyrics.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-300">Найдены тайминги</span>
            <button onClick={handleUseTimedLyrics} className="mini-action">Использовать</button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1 text-sm">
            {timedLyrics.map((seg, idx) => (
              <div
                key={idx}
                className={`p-1 rounded cursor-pointer transition-colors ${activeSegment === idx ? 'bg-cyan-500/20' : 'hover:bg-white/5'}`}
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
        placeholder="Введите текст песни, каждая строка будет отдельной фразой..."
        className="studio-textarea"
      />
      <p className="text-xs text-gray-400 mt-2">Локальный рендер караоке активируется после добавления файла и текста.</p>
    </div>
  )
}
