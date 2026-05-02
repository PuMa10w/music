import { useStore } from '../stores/useStore'

const BANDS = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz']

const PRESETS: Record<string, number[]> = {
  Flat: Array(10).fill(0),
  Rock: [3, 2, 1, 0, -1, 2, 3, 4, 5, 6],
  Pop: [2, 3, 4, 3, 1, 0, 1, 2, 3, 4],
  Jazz: [4, 3, 2, 1, 0, 0, 1, 2, 3, 2],
  'Vocal Boost': [0, 0, 1, 2, 3, 4, 5, 6, 5, 4],
}

export default function EQ() {
  const eqGains = useStore(s => s.eqGains)
  const setEqGains = useStore(s => s.setEqGains)
  const resetEq = useStore(s => s.resetEq)

  const handleChange = (index: number, value: string) => {
    const next = [...eqGains]
    next[index] = parseFloat(value)
    setEqGains(next)
  }

  return (
    <div className="studio-panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">Preview</p>
          <h3>10-band EQ</h3>
        </div>
        <button onClick={resetEq} className="ghost-action">Reset</button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {Object.keys(PRESETS).map(preset => (
          <button key={preset} onClick={() => setEqGains([...PRESETS[preset]])} className="mini-action">
            {preset}
          </button>
        ))}
      </div>

      <div className="eq-grid">
        {BANDS.map((band, idx) => (
          <div key={band} className="eq-band">
            <input
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={eqGains[idx]}
              onChange={(e) => handleChange(idx, e.target.value)}
              aria-label={band}
            />
            <span>{eqGains[idx] > 0 ? '+' : ''}{eqGains[idx]}</span>
            <small>{band}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
