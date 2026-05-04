import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function TempoChange() {
  const currentJobId = useStore(s => s.currentJobId);
  const [tempo, setTempo] = useState(100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleTempoChange = async (newTempo: number) => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    
    setTempo(newTempo);
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/apply-effects/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tempo: newTempo 
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Темп изменён на ${newTempo}%`);
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const presetTempos = [
    { label: '🐢 50%', value: 50 },
    { label: '🚶 75%', value: 75 },
    { label: '🏃 100%', value: 100 },
    { label: '🏃 125%', value: 125 },
    { label: '🚀 150%', value: 150 },
  ];

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl">
          🎶
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Tempo Change</h3>
          <p className="text-sm text-gray-400">Изменение скорости без изменения тона</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => handleTempoChange(Math.max(50, tempo - 5))}
          disabled={loading || !currentJobId}
          className="btn-premium !py-2 !px-4 text-sm disabled:opacity-50"
        >
          🔽 -5%
        </button>
        
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-white">{tempo}%</span>
          <span className="text-sm text-gray-400 ml-2">от оригинала</span>
        </div>
        
        <button
          onClick={() => handleTempoChange(Math.min(200, tempo + 5))}
          disabled={loading || !currentJobId}
          className="btn-premium !py-2 !px-4 text-sm disabled:opacity-50"
        >
          🔼 +5%
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-6">
        {presetTempos.map(preset => (
          <button
            key={preset.value}
            onClick={() => handleTempoChange(preset.value)}
            disabled={loading || !currentJobId}
            className={`p-2 rounded-lg text-xs transition-all ${
              tempo === preset.value
                ? 'bg-blue-500/20 border-blue-500/50 text-white'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
            } border disabled:opacity-50`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Обработка...
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
