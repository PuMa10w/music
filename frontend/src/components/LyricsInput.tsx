import { useState } from 'react'

interface Props {
  lyrics: string
  setLyrics: (lyrics: string) => void
}

export default function LyricsInput({ lyrics, setLyrics }: Props) {
  return (
    <div className="mt-6 backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
      <h4 className="text-lg mb-4">Текст песни (для караоке)</h4>
      <textarea
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
        placeholder="Введите текст песни, каждая строка — новый куплет..."
        className="w-full h-32 bg-black/30 border border-white/20 rounded-lg p-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
      />
      <p className="text-xs text-gray-400 mt-2">Каждая строка будет отображаться отдельно</p>
    </div>
  )
}
