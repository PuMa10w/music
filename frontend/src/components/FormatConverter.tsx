import { useState } from 'react';
import { useStore } from '../stores/useStore';

const formats = [
  { name: 'MP3', ext: 'mp3', icon: '🎵', bitrate: '192k' },
  { name: 'OGG Vorbis', ext: 'ogg', icon: '🎶', bitrate: '192k' },
  { name: 'FLAC', ext: 'flac', icon: '💿', lossless: true },
  { name: 'AAC', ext: 'aac', icon: '🎧', bitrate: '192k' },
  { name: 'WAV', ext: 'wav', icon: '🎤', lossless: true },
];

export default function FormatConverter() {
  const currentJobId = useStore(s => s.currentJobId);
  const [selectedFormat, setSelectedFormat] = useState(formats[0]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleConvert = async () => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/convert/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          format: selectedFormat.ext,
          bitrate: selectedFormat.bitrate || '192k'
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Конвертировано в ${selectedFormat.name}!`);
        // Auto download
        window.open(`http://localhost:8000/outputs/${currentJobId}/${data.file}`, '_blank');
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-xl">
          🔄
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Format Converter</h3>
          <p className="text-sm text-gray-400">Конвертация в MP3, OGG, FLAC, AAC</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {formats.map(format => (
          <button
            key={format.name}
            onClick={() => setSelectedFormat(format)}
            disabled={loading || !currentJobId}
            className={`p-4 rounded-xl transition-all duration-300 border ${
              selectedFormat.name === format.name
                ? 'bg-teal-500/20 border-teal-500/50 text-white'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">{format.icon}</div>
            <div className="text-sm font-semibold">{format.name}</div>
            <div className="text-xs text-gray-400 mt-1">
              {format.lossless ? 'Lossless' : format.bitrate}
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleConvert}
        disabled={loading || !currentJobId}
        className="btn-premium w-full disabled:opacity-50"
      >
        {loading ? '⏳ Конвертация...' : `🔄 Конвертировать в ${selectedFormat.name}`}
      </button>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
