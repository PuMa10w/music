import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function FadeInOut() {
  const currentJobId = useStore(s => s.currentJobId);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleApplyFade = async () => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/apply-effects/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fade_in: fadeIn,
          fade_out: fadeOut
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Фейды применены: вход ${fadeIn}с, выход ${fadeOut}с`);
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
          🌗️
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Fade In/Out</h3>
          <p className="text-sm text-gray-400">Плавное появление и затухание</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Fade In (секунды)</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={fadeIn}
            onChange={(e) => setFadeIn(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">{fadeIn}с</span>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Fade Out (секунды)</label>
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={fadeOut}
            onChange={(e) => setFadeOut(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-gray-400">{fadeOut}с</span>
        </div>
      </div>

      <button
        onClick={handleApplyFade}
        disabled={loading || !currentJobId}
        className="btn-premium w-full disabled:opacity-50"
      >
        {loading ? '⏳ Применение...' : '🌗️ Применить фейды'}
      </button>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
