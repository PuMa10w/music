import { useState, useEffect, useRef } from 'react';
import { useStore } from '../stores/useStore';

interface Stem {
  name: string;
  file: string;
  url: string;
}

type PanValues = Record<string, number>; // -1 (left) to 1 (right)
type MuteState = Record<string, boolean>;
type SoloState = Record<string, boolean>;

export default function StemMixer() {
  const currentJobId = useStore(s => s.currentJobId);
  const [stems, setStems] = useState<Stem[]>([]);
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [panValues, setPanValues] = useState<PanValues>({});
  const [muteState, setMuteState] = useState<MuteState>({});
  const [soloState, setSoloState] = useState<SoloState>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    if (!currentJobId) return;
    
    fetch(`http://localhost:8000/api/status/${currentJobId}`)
      .then(res => res.json())
      .then(data => {
        if (data.files && data.files.length > 0) {
          const stemList: Stem[] = data.files
            .filter((f: string) => f.endsWith('.wav') && !f.includes('effected'))
            .map((file: string) => ({
              name: file.replace('.wav', '').replace(/_/g, ' '),
              file,
              url: `http://localhost:8000/outputs/${currentJobId}/${file}`
            }));
          
          setStems(stemList);
          
          // Initialize volumes, pan, mute, solo
          const initVolumes: Record<string, number> = {};
          const initPan: PanValues = {};
          const initMute: MuteState = {};
          const initSolo: SoloState = {};
          
          stemList.forEach(stem => {
            initVolumes[stem.name] = 100;
            initPan[stem.name] = 0; // center
            initMute[stem.name] = false;
            initSolo[stem.name] = false;
          });
          
          setVolumes(initVolumes);
          setPanValues(initPan);
          setMuteState(initMute);
          setSoloState(initSolo);
        }
      })
      .catch(err => console.error('Failed to load stems:', err));
  }, [currentJobId]);

  const handleVolumeChange = (stemName: string, value: number) => {
    setVolumes(prev => ({ ...prev, [stemName]: value }));
    updateAudioElement(stemName);
  };

  const handlePanChange = (stemName: string, value: number) => {
    setPanValues(prev => ({ ...prev, [stemName]: value }));
    updateAudioElement(stemName);
  };

  const toggleMute = (stemName: string) => {
    setMuteState(prev => {
      const newState = { ...prev, [stemName]: !prev[stemName] };
      // Update audio
      setTimeout(() => updateAudioElement(stemName), 0);
      return newState;
    });
  };

  const toggleSolo = (stemName: string) => {
    setSoloState(prev => {
      const isCurrentlySolo = prev[stemName];
      
      if (isCurrentlySolo) {
        // Unsolo all
        const newState: SoloState = {};
        stems.forEach(s => { newState[s.name] = false; });
        // Update all audio
        setTimeout(() => stems.forEach(s => updateAudioElement(s.name)), 0);
        return newState;
      } else {
        // Solo this stem, mute others
        const newState: SoloState = {};
        stems.forEach(s => {
          newState[s.name] = s.name === stemName;
        });
        // Update all audio
        setTimeout(() => stems.forEach(s => updateAudioElement(s.name)), 0);
        return newState;
      }
    });
  };

  const updateAudioElement = (stemName: string) => {
    const audio = audioRefs.current[stemName];
    if (!audio) return;

    const volume = volumes[stemName] / 100;
    const pan = panValues[stemName] || 0;
    const isMuted = muteState[stemName];
    const isSolo = soloState[stemName];
    const hasAnySolo = Object.values(soloState).some(v => v);

    // Calculate final volume
    let finalVolume = volume;
    if (isMuted) finalVolume = 0;
    if (hasAnySolo && !isSolo) finalVolume = 0;

    audio.volume = finalVolume;

    // Pan (simple left/right balance using stereo channels)
    if (audio instanceof HTMLAudioElement) {
      // Note: HTML5 Audio doesn't have pan directly, we can use stereo panning if supported
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioCtx.createMediaElementSource(audio);
        const panner = audioCtx.createStereoPanner();
        panner.pan.value = pan;
        source.connect(panner);
        panner.connect(audioCtx.destination);
      } catch (e) {
        // Fallback: ignore pan if not supported
      }
    }
  };

  const handlePlayAll = () => {
    stems.forEach(stem => {
      const audio = audioRefs.current[stem.name];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    });
  };

  const handleStopAll = () => {
    stems.forEach(stem => {
      const audio = audioRefs.current[stem.name];
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
  };

  const handleDownloadMix = async () => {
    if (!currentJobId || stems.length === 0) return;
    
    try {
      const response = await fetch(`http://localhost:8000/api/mix-stems/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ volumes, pan: panValues })
      });
      
      const data = await response.json();
      if (data.success) {
        window.open(`http://localhost:8000/outputs/${currentJobId}/${data.file}`, '_blank');
      }
    } catch (err) {
      console.error('Mix failed:', err);
    }
  };

  if (stems.length === 0) {
    return null;
  }

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xl">
          🎛️
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Stem Mixer</h3>
          <p className="text-sm text-gray-400">Pan, Mute, Solo controls</p>
        </div>
      </div>

      <div className="space-y-6 mb-6">
        {stems.map(stem => {
          const isMuted = muteState[stem.name];
          const isSolo = soloState[stem.name];
          const hasAnySolo = Object.values(soloState).some(v => v);
          const isEffectivelyMuted = isMuted || (hasAnySolo && !isSolo);
          
          return (
            <div key={stem.name} className={`p-4 rounded-xl transition-all ${isEffectivelyMuted ? 'bg-white/5 opacity-60' : 'bg-white/5'}`}>
              {/* Stem Header */}
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white capitalize">{stem.name}</span>
                  {isMuted && <span className="text-xs bg-red-500/30 text-red-300 px-2 py-1 rounded">MUTED</span>}
                  {isSolo && <span className="text-xs bg-yellow-500/30 text-yellow-300 px-2 py-1 rounded">SOLO</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleMute(stem.name)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isMuted 
                        ? 'bg-red-500/30 text-red-300' 
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {isMuted ? '🔇' : '🔊'}
                  </button>
                  <button
                    onClick={() => toggleSolo(stem.name)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSolo 
                        ? 'bg-yellow-500/30 text-yellow-300' 
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    S
                  </button>
                </div>
              </div>

              {/* Volume */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Volume</span>
                  <span>{volumes[stem.name] || 100}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volumes[stem.name] || 100}
                  onChange={(e) => handleVolumeChange(stem.name, Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Pan (Left/Right) */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>◀ Left</span>
                  <span>{panValues[stem.name] === 0 ? 'Center' : (panValues[stem.name] > 0 ? 'Right' : 'Left')}</span>
                  <span>Right ▶</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={panValues[stem.name] || 0}
                  onChange={(e) => handlePanChange(stem.name, Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              {/* Hidden Audio Element */}
              <audio
                ref={(el) => { audioRefs.current[stem.name] = el; }}
                src={stem.url}
                preload="none"
                className="hidden"
                onEnded={() => {}}
              />
            </div>
          );
        })}
      </div>

      {/* Global Controls */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={handlePlayAll}
          className="btn-premium !py-2 !px-4 text-sm"
        >
          ▶️ Play All
        </button>
        <button
          onClick={handleStopAll}
          className="btn-premium !py-2 !px-4 text-sm bg-red-500/20 hover:bg-red-500/30"
        >
          ⏹ Stop All
        </button>
        <button
          onClick={handleDownloadMix}
          className="btn-premium !py-2 !px-4 text-sm bg-gradient-to-r from-green-500 to-teal-500"
        >
          💾 Download Mix
        </button>
      </div>

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ Controls Guide</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>Volume</strong> — громкость стема (0-100%)</li>
          <li><strong>Pan</strong> — панорамирование (Left ↔ Right)</li>
          <li><strong>Mute (🔇)</strong> — отключить стем</li>
          <li><strong>Solo (S)</strong> — слышать только этот стем</li>
          <li>Для скачивания микса используется FFmpeg с учётом панорамирования</li>
        </ul>
      </div>
    </div>
  );
}
