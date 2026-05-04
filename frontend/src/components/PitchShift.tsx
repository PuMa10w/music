import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function PitchShift() {
  const currentJobId = useStore(s => s.currentJobId);
  const [semitones, setSemitones] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handlePitchShift = async (direction: 'up' | 'down') => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    
    const newPitch = direction === 'up' ? semitones + 1 : semitones - 1;
    setSemitones(newPitch);
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/apply-effects/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pitch_shift: newPitch 
        }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Тональность изменена на ${newPitch > 0 ? '+' : ''}${newPitch} полутонов`);
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const presetPitches = [
    { label: '🎵 -12 (Октава вниз)', value: -12 },
    { label: '🎵 -7 (Квинта вниз)', value: -7 },
    { label: '🎵 -5 (Кварта вниз)', value: -5 },
    { label: '🎵 0 (Оригинал)', value: 0 },
    { label: '🎵 +5 (Кварта вверх)', value: 5 },
    { label: '🎵 +7 (Квинта вверх)', value: 7 },
    { label: '🎵 +12 (Октава вверх)', value: 12 },
  ];

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-xl">
          🎼
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Pitch Shift</h3>
          <p className="text-sm text-gray-400">Изменение тональности без изменения темпа</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => handlePitchShift('down')}
          disabled={loading || !currentJobId}
          className="btn-premium !py-2 !px-4 text-sm disabled:opacity-50"
        >
          🔽 -1
        </button>
        
        <div className="flex-1 text-center">
          <span className="text-3xl font-bold text-white">{semitones > 0 ? '+' : ''}{semitones}</span>
          <span className="text-sm text-gray-400 ml-2">полутонов</span>
        </div>
        
        <button
          onClick={() => handlePitchShift('up')}
          disabled={loading || !currentJobId}
          className="btn-premium !py-2 !px-4 text-sm disabled:opacity-50"
        >
          🔼 +1
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {presetPitches.map(preset => (
          <button
            key={preset.value}
            onClick={async () => {
              setSemitones(preset.value);
              setLoading(true);
              try {
                const response = await fetch(`http://localhost:8000/api/apply-effects/${currentJobId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pitch_shift: preset.value }),
                });
                const data = await response.json();
                if (data.success) {
                  setMessage(`✅ ${preset.label}`);
                }
              } catch (e: any) {
                setMessage(`❌ Ошибка: ${e.message}`);
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading || !currentJobId}
            className={`p-2 rounded-lg text-xs transition-all ${
              semitones === preset.value
                ? 'bg-yellow-500/20 border-yellow-500/50 text-white'
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
