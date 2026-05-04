import { useState } from 'react';
import { useStore } from '../stores/useStore';
import { motion } from 'framer-motion';

type StemType = 'vocals' | 'drums' | 'bass' | 'other' | 'instrumental';

interface EffectParams {
  reverb: number;    // 0-100 (room size)
  delay: number;      // 0-500ms
  chorus: number;     // 0-100 (depth)
  stem: StemType;
}

export default function AudioEffectsRack() {
  const currentJobId = useStore(s => s.currentJobId);
  const [params, setParams] = useState<EffectParams>({
    reverb: 0,
    delay: 0,
    chorus: 0,
    stem: 'vocals'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const applyEffects = async () => {
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
        body: JSON.stringify(params),
      });
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Эффекты применены к ${params.stem}!`);
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateParam = (key: keyof EffectParams, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const presets = [
    { name: '🎙️ Вокал (Студия)', reverb: 20, delay: 50, chorus: 30, stem: 'vocals' as StemType },
    { name: '🥁 Барабаны (Hall)', reverb: 40, delay: 100, chorus: 10, stem: 'drums' as StemType },
    { name: '🎸 Бас (Fat)', reverb: 10, delay: 0, chorus: 60, stem: 'bass' as StemType },
    { name: '🎹 Инструментал (Epic)', reverb: 60, delay: 200, chorus: 40, stem: 'instrumental' as StemType },
  ];

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-pink-500/5 pointer-events-none" />
      
      <h3 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
        <span>🎛️</span> Voice Effects Rack
      </h3>

      {/* Stem Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Стем для обработки</label>
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
          {(['vocals', 'drums', 'bass', 'other', 'instrumental'] as StemType[]).map(stem => (
            <button
              key={stem}
              onClick={() => updateParam('stem', stem)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                params.stem === stem
                  ? 'bg-violet-500/80 text-white shadow-lg shadow-violet-500/50'
                  : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {stem === 'vocals' && '🎤'}
              {stem === 'drums' && '🥁'}
              {stem === 'bass' && '🎸'}
              {stem === 'other' && '🎹'}
              {stem === 'instrumental' && '🎵'}
              <span className="ml-1 capitalize">{stem}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Effect Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {/* Reverb */}
        <div className="bg-white/5 rounded-xl p-4">
          <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
            <span>🏛️ Reverb</span>
            <span className="text-violet-400">{params.reverb}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={params.reverb}
            onChange={(e) => updateParam('reverb', Number(e.target.value))}
            className="w-full accent-violet-500"
          />
          <p className="text-xs text-gray-500 mt-2">Room size & decay</p>
        </div>

        {/* Delay */}
        <div className="bg-white/5 rounded-xl p-4">
          <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
            <span>⏳ Delay</span>
            <span className="text-pink-400">{params.delay}ms</span>
          </label>
          <input
            type="range"
            min="0"
            max="500"
            value={params.delay}
            onChange={(e) => updateParam('delay', Number(e.target.value))}
            className="w-full accent-pink-500"
          />
          <p className="text-xs text-gray-500 mt-2">Echo feedback time</p>
        </div>

        {/* Chorus */}
        <div className="bg-white/5 rounded-xl p-4">
          <label className="flex justify-between text-sm font-medium text-gray-300 mb-3">
            <span>🎶 Chorus</span>
            <span className="text-indigo-400">{params.chorus}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={params.chorus}
            onChange={(e) => updateParam('chorus', Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <p className="text-xs text-gray-500 mt-2">Depth & richness</p>
        </div>
      </div>

      {/* Presets */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-3">Пресеты</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {presets.map(preset => (
            <button
              key={preset.name}
              onClick={() => setParams(preset)}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-left"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Apply Button */}
      <motion.button
        onClick={applyEffects}
        disabled={loading || !currentJobId}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="btn-premium w-full mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? '⏳ Применение...' : `🎛️ Применить эффекты к ${params.stem}`}
      </motion.button>

      {message && (
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
}
