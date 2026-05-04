import { useState } from 'react';
import { useStore } from '../stores/useStore';

const platforms = [
  { name: 'Spotify', lufs: -14.0, icon: '🎵' },
  { name: 'YouTube', lufs: -13.0, icon: '📺' },
  { name: 'Apple Music', lufs: -16.0, icon: '🍎' },
  { name: 'CD/Audio', lufs: -10.0, icon: '💿' },
  { name: 'Radio', lufs: -18.0, icon: '📻' },
];

export default function NormalizeAudio() {
  const currentJobId = useStore(s => s.currentJobId);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState(platforms[0]);

  const handleNormalize = async (lufs: number, name: string) => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch(`http://localhost:8000/api/master/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stem: 'instrumental', lufs }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ ${name}: нормализовано до ${lufs} LUFS!`);
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xl">
          📊
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Audio Normalization</h3>
          <p className="text-sm text-gray-400">Оптимизация громкости под платформы</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        {platforms.map(platform => (
          <button
            key={platform.name}
            onClick={() => {
              setSelectedPlatform(platform);
              handleNormalize(platform.lufs, platform.name);
            }}
            disabled={loading || !currentJobId}
            className={`p-4 rounded-xl transition-all duration-300 border ${
              selectedPlatform.name === platform.name
                ? 'bg-green-500/20 border-green-500/50 text-white'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">{platform.icon}</div>
            <div className="text-sm font-semibold">{platform.name}</div>
            <div className="text-xs text-gray-400 mt-1">{platform.lufs} LUFS</div>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Нормализация...
        </div>
      )}
      {message && (
        <p className={`text-sm text-center ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
