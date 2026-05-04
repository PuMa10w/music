import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function NoiseReduction() {
  const currentJobId = useStore(s => s.currentJobId);
  const [level, setLevel] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleReduceNoise = async (stem: string) => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`http://localhost:8000/api/reduce-noise/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stem, level }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Шумоподавление завершено для ${stem}!`);
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
          🔇
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Noise Reduction</h3>
          <p className="text-sm text-gray-400">Подавление шума (ATF Denoiser)</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Уровень шумоподавления: {level.toFixed(2)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Меньше (оригинал)</span>
          <span>Больше (сильнее)</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        {['vocals', 'drums', 'bass', 'other', 'instrumental'].map((stem) => (
          <button
            key={stem}
            onClick={() => handleReduceNoise(stem)}
            disabled={loading || !currentJobId}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed capitalize"
          >
            {loading ? '⏳...' : `🔇 ${stem}`}
          </button>
        ))}
      </div>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ О технологии</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>ATF Denoiser (afftdn)</strong> — адаптивный временной фильтр</li>
          <li>Работает на основе БПФ (FFT) анализа шума</li>
          <li>Эффективно убирает стационарный шум (гул, шипение)</li>
          <li>Слишком высокий уровень может повлиять на качество</li>
        </ul>
      </div>
    </div>
  );
}
