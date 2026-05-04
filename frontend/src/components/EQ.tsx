import { useStore } from '../stores/useStore'

const BANDS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz']

const PRESETS: Record<string, number[]> = {
  'Flat': Array(10).fill(0),
  'Rock': [3, 2, 1, 0, -1, 2, 3, 4, 5, 6],
  'Pop': [2, 3, 4, 3, 1, 0, 1, 2, 3, 4],
  'Jazz': [4, 3, 2, 1, 0, 0, 1, 2, 3, 2],
  'Vocal Boost': [0, 0, 1, 2, 3, 4, 5, 6, 5, 4],
}

export default function EQ() {
  const eqGains = useStore(s => s.eqGains)
  const setEqGains = useStore(s => s.setEqGains)
  const resetEq = useStore(s => s.resetEq)

  const handleChange = (index: number, value: string) => {
    const newGains = [...eqGains]
    newGains[index] = parseFloat(value)
    setEqGains(newGains)
  }

  const applyPreset = (name: string) => {
    if (PRESETS[name]) {
      setEqGains([...PRESETS[name]])
    }
  }

  return (
    <div className="backdrop-blur-lg bg-white/5 rounded-2xl p-6 border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-semibold">10-Band Equalizer</h3>
        <button 
          onClick={resetEq}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          Сбросить
        </button>
      </div>

      {/* Presets */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.keys(PRESETS).map(preset => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className="px-3 py-1 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Sliders */}
      <div className="flex justify-between gap-2">
        {BANDS.map((band, idx) => (
          <div key={band} className="flex flex-col items-center gap-2">
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eqGains[idx]}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="h-24 w-8 appearance-none bg-transparent cursor-pointer"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
            />
            <span className="text-xs text-gray-400">{eqGains[idx] > 0 ? '+' : ''}{eqGains[idx]}</span>
            <span className="text-xs text-gray-500">{band}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
