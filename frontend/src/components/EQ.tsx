import { useStore } from '../stores/useStore'

// 20-band frequencies (ISO standard for graphic equalizers)
const BANDS = [
  '25Hz', '40Hz', '63Hz', '100Hz', '160Hz', '250Hz', '400Hz', '630Hz', 
  '1kHz', '1.6kHz', '2.5kHz', '4kHz', '6.3kHz', '10kHz', '16kHz', '20kHz',
  '31.5Hz', '50Hz', '80Hz', '125Hz', '200Hz'
]

const PRESETS: Record<string, number[]> = {
  'Flat': Array(20).fill(0),
  'Rock': [3, 2, 1, 0, -1, 2, 3, 4, 5, 4, 3, 4, 5, 6, 6, 5, 2, 1, 0, 0],
  'Pop': [2, 3, 4, 3, 1, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4],
  'Jazz': [4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 3, 4, 5],
  'Vocal Boost': [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6, 5, 4, 0, 0, 1, 2],
  'Bass Boost': [6, 5, 4, 3, 2, 1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2],
  'Treble Boost': [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 3, 4, 5, 6],
}

export default function EQ() {
  const eqGains = useStore(s => s.eqGains)
  const setEqGains = useStore(s => s.setEqGains)
  const resetEq = useStore(s => s.resetEq)

  // Ensure eqGains has 20 elements
  const currentGains = eqGains.length === 20 ? eqGains : [...eqGains, ...Array(20 - eqGains.length).fill(0)].slice(0, 20)

  const handleChange = (index: number, value: string) => {
    const newGains = [...currentGains]
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
        <h3 className="text-xl font-semibold">20-Band Equalizer</h3>
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

      {/* Sliders - 20 bands */}
      <div className="flex justify-between gap-1 sm:gap-2 overflow-x-auto pb-4">
        {BANDS.map((band, idx) => (
          <div key={band} className="flex flex-col items-center gap-2 min-w-[30px]">
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={currentGains[idx]}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="h-32 w-8 appearance-none bg-transparent cursor-pointer"
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
            />
            <span className="text-xs text-gray-400">
              {currentGains[idx] > 0 ? '+' : ''}{currentGains[idx]}
            </span>
            <span className="text-xs text-gray-500 rotate-45 origin-center w-12 text-center">
              {band}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
