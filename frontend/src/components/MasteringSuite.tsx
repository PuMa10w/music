import { useState } from 'react';
import { useStore } from '../stores/useStore';

type MasteringPreset = {
  name: string;
  icon: string;
  lufs: number;
  truePeak: number;
  stereoWidth: number;
  dither: boolean;
  description: string;
};

const presets: MasteringPreset[] = [
  {
    name: 'Spotify Premium',
    icon: '🎵',
    lufs: -14.0,
    truePeak: -1.0,
    stereoWidth: 100,
    dither: true,
    description: 'Оптимизировано для Spotify (Loudness -14 LUFS)'
  },
  {
    name: 'Apple Music',
    icon: '🍎',
    lufs: -16.0,
    truePeak: -1.0,
    stereoWidth: 100,
    dither: true,
    description: 'Apple Music standard (-16 LUFS)'
  },
  {
    name: 'YouTube Master',
    icon: '📺',
    lufs: -13.0,
    truePeak: -1.5,
    stereoWidth: 100,
    dither: true,
    description: 'YouTube optimized (-13 LUFS)'
  },
  {
    name: 'Club/Festival',
    icon: '🎧',
    lufs: -8.0,
    truePeak: -0.5,
    stereoWidth: 120,
    dither: false,
    description: 'High energy for clubs (-8 LUFS)'
  },
  {
    name: 'Broadcast TV',
    icon: '📡',
    lufs: -23.0,
    truePeak: -2.0,
    stereoWidth: 90,
    dither: true,
    description: 'TV broadcast standard (-23 LUFS)'
  },
  {
    name: 'CD/Vinyl',
    icon: '💿',
    lufs: -10.0,
    truePeak: -0.3,
    stereoWidth: 100,
    dither: true,
    description: 'CD/Vinyl standard (-10 LUFS)'
  },
  {
    name: 'Podcast/Speech',
    icon: '🎙',
    lufs: -19.0,
    truePeak: -1.0,
    stereoWidth: 80,
    dither: true,
    description: 'Speech optimized (-19 LUFS)'
  },
  {
    name: 'Cinema/Soundtrack',
    icon: '🎬',
    lufs: -24.0,
    truePeak: -2.0,
    stereoWidth: 150,
    dither: true,
    description: 'Cinematic wide stereo (-24 LUFS)'
  }
];

export default function MasteringSuite() {
  const currentJobId = useStore(s => s.currentJobId);
  const [selectedPreset, setSelectedPreset] = useState<MasteringPreset>(presets[0]);
  const [customLufs, setCustomLufs] = useState(-14.0);
  const [customTruePeak, setCustomTruePeak] = useState(-1.0);
  const [stereoWidth, setStereoWidth] = useState(100);
  const [dither, setDither] = useState(true);
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleMaster = async (preset: MasteringPreset) => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }

    setSelectedPreset(preset);
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`http://localhost:8000/api/master/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lufs: preset.lufs,
          true_peak: preset.truePeak,
          stereo_width: preset.stereoWidth,
          dither: preset.dither,
          stem: 'instrumental'
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Мастеринг завершён: ${preset.name}!`);
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomMaster = async () => {
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
        body: JSON.stringify({
          lufs: customLufs,
          true_peak: customTruePeak,
          stereo_width: stereoWidth,
          dither: dither,
          stem: 'instrumental'
        }),
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Кастомный мастеринг завершён!`);
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-xl">
          🎚️
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Mastering Suite</h3>
          <p className="text-sm text-gray-400">Профессиональный мастеринг на современных моделях</p>
        </div>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {presets.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handleMaster(preset)}
            disabled={loading || !currentJobId}
            className={`p-4 rounded-xl transition-all duration-300 border text-left
              ${selectedPreset.name === preset.name && !useCustom
                ? 'bg-amber-500/20 border-amber-500/50 text-white scale-105'
                : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="text-2xl mb-2">{preset.icon}</div>
            <div className="text-sm font-semibold">{preset.name}</div>
            <div className="text-xs text-gray-400 mt-1">{preset.lufs} LUFS</div>
            <div className="text-xs text-gray-500 mt-1">{preset.description}</div>
          </button>
        ))}
      </div>

      {/* Custom Settings */}
      <div className="glass-premium rounded-xl p-4 border border-white/5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-white">Кастомные настройки</h4>
          <button
            onClick={() => setUseCustom(!useCustom)}
            className={`px-3 py-1 rounded-lg text-xs transition-all
              ${useCustom 
                ? 'bg-amber-500/30 text-amber-300' 
                : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
          >
            {useCustom ? '✓ Активно' : 'Настроить'}
          </button>
        </div>

        {useCustom && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">LUFS Target</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-30"
                  max="-5"
                  step="0.5"
                  value={customLufs}
                  onChange={(e) => setCustomLufs(Number(e.target.value))}
                  className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-300 w-16 text-right">{customLufs} LUFS</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">True Peak (dBTP)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-3"
                  max="0"
                  step="0.1"
                  value={customTruePeak}
                  onChange={(e) => setCustomTruePeak(Number(e.target.value))}
                  className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-300 w-16 text-right">{customTruePeak} dBTP</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Stereo Width (%)</label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="50"
                  max="200"
                  value={stereoWidth}
                  onChange={(e) => setStereoWidth(Number(e.target.value))}
                  className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-sm text-gray-300 w-16 text-right">{stereoWidth}%</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dither"
                checked={dither}
                onChange={(e) => setDither(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="dither" className="text-sm text-gray-300">Dithering (for bit-depth reduction)</label>
            </div>

            <button
              onClick={handleCustomMaster}
              disabled={loading || !currentJobId}
              className="btn-premium w-full disabled:opacity-50"
            >
              {loading ? '⏳ Обработка...' : '🎚️ Применить кастомный мастеринг'}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-300">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Мастеринг в процессе...
        </div>
      )}

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ О современных моделях мастеринга</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>ITU-R BS.1770-4</strong> — современный стандарт измерения громкости</li>
          <li><strong>True Peak Limiting</strong> — предотвращает клиппинг при конвертации</li>
          <li><strong>Stereo Enhancement</strong> — расширение стереобазы (MS-обработка)</li>
          <li><strong>Dithering</strong> — добавление шума квантования при снижении битности</li>
          <li><strong>FFmpeg afilters</strong> — loudnorm, acompressor, stereotools</li>
        </ul>
      </div>
    </div>
  );
}
