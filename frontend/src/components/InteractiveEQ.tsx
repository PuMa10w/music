import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../stores/useStore';

// 20-band frequencies (ISO standard)
const BANDS = [
  25, 40, 63, 100, 160, 250, 400, 630,
  1000, 1600, 2500, 4000, 6300, 10000, 16000, 20000,
  31.5, 50, 80, 125, 200
];

const PRESETS: Record<string, number[]> = {
  'Flat': Array(20).fill(0),
  'Rock': [3, 2, 1, 0, -1, 2, 3, 4, 5, 4, 3, 4, 5, 6, 6, 5, 2, 1, 0, 0],
  'Pop': [2, 3, 4, 3, 1, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4],
  'Jazz': [4, 3, 2, 1, 0, 0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 2, 3, 4, 5],
  'Vocal Boost': [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6, 5, 4, 0, 0, 1, 2],
  'Bass Boost': [6, 5, 4, 3, 2, 1, 0, 0, 0, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2],
  'Treble Boost': [0, 0, 0, 0, 1, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 1, 3, 4, 5, 6],
};

export default function InteractiveEQ() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const eqGains = useStore(s => s.eqGains);
  const setEqGains = useStore(s => s.setEqGains);
  const resetEq = useStore(s => s.resetEq);
  const files = useStore(s => s.files);
  
  const [dragging, setDragging] = useState<number | null>(null);
  const [hovering, setHovering] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setAudioLoaded] = useState(false);
  
  // Web Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainNodeRef = useRef<GainNode | null>(null);

  const currentGains = eqGains.length === 20 ? eqGains : [...eqGains, ...Array(20 - eqGains.length).fill(0)].slice(0, 20);

  // Initialize AudioContext and filters
  const initAudio = useCallback(async () => {
    if (audioContextRef.current) return;
    
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    // Create filters for each band
    const filters: BiquadFilterNode[] = BANDS.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.0; // Bandwidth
      filter.gain.value = currentGains[i];
      return filter;
    });

    // Connect filters in series
    if (filters.length > 0) {
      filters[0].connect(ctx.destination);
      for (let i = 1; i < filters.length; i++) {
        filters[i-1].connect(filters[i]);
      }
    }

    filtersRef.current = filters;
    gainNodeRef.current = ctx.createGain();
    gainNodeRef.current.gain.value = 1.0;
    
    setAudioLoaded(true);
  }, [currentGains]);

  // Load audio from first file
  const loadAudio = useCallback(async () => {
    if (!files.length || !audioContextRef.current) return;
    
    try {
      const file = files[0];
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
      
      // Stop previous source if any
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      
      // Connect source -> filters -> destination
      if (filtersRef.current.length > 0) {
        source.connect(filtersRef.current[0]);
        filtersRef.current[filtersRef.current.length - 1].connect(audioContextRef.current.destination);
      } else {
        source.connect(audioContextRef.current.destination);
      }
      
      sourceRef.current = source;
      setAudioLoaded(true);
    } catch (e) {
      console.error('Failed to load audio:', e);
    }
  }, [files]);

  // Update filter gains when eqGains change
  useEffect(() => {
    if (filtersRef.current.length === 0) return;
    
    filtersRef.current.forEach((filter, i) => {
      if (filter) {
        filter.gain.setValueAtTime(currentGains[i], audioContextRef.current?.currentTime || 0);
      }
    });
  }, [currentGains]);

  // Play/Pause toggle
  const togglePlay = useCallback(async () => {
    if (!audioContextRef.current) {
      await initAudio();
      await loadAudio();
    }
    
    if (!audioContextRef.current) return;
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      if (sourceRef.current) {
        sourceRef.current.stop();
      }
      setIsPlaying(false);
    } else {
      if (sourceRef.current) {
        sourceRef.current.start(0);
      }
      setIsPlaying(true);
    }
  }, [isPlaying, initAudio, loadAudio]);

  // Canvas drawing (same as before)
  const gainToY = (gain: number, height: number) => {
    const minGain = -12;
    const maxGain = 12;
    return height * (1 - (gain - minGain) / (maxGain - minGain));
  };

  const yToGain = (y: number, height: number) => {
    const minGain = -12;
    const maxGain = 12;
    return maxGain - (y / height) * (maxGain - minGain);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = canvas;
    const padding = { top: 20, bottom: 30, left: 40, right: 20 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    
    // Clear
    ctx.clearRect(0, 0, width, height);
    
    // Background
    ctx.fillStyle = 'rgba(15, 15, 26, 0.8)';
    ctx.fillRect(0, 0, width, height);
    
    // Grid lines (horizontal - dB)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let db = -12; db <= 12; db += 3) {
      const y = padding.top + gainToY(db, graphHeight);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      
      // dB labels
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px Manrope, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${db > 0 ? '+' : ''}${db}dB`, padding.left - 5, y + 4);
    }
    
    // Grid lines (vertical - frequency bands)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < BANDS.length; i++) {
      const x = padding.left + (i / (BANDS.length - 1)) * graphWidth;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }
    
    // Zero line
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 2;
    const zeroY = padding.top + gainToY(0, graphHeight);
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();
    
    // Draw curve
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    const points = BANDS.map((_, i) => ({
      x: padding.left + (i / (BANDS.length - 1)) * graphWidth,
      y: padding.top + gainToY(currentGains[i], graphHeight)
    }));
    
    // Bezier curve for smooth line
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (cpx - prev.x) * 0.5, prev.y, cpx, (prev.y + curr.y) / 2);
      ctx.quadraticCurveTo(curr.x - (curr.x - cpx) * 0.5, curr.y, curr.x, curr.y);
    }
    ctx.stroke();
    
    // Fill under curve
    ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
    ctx.lineTo(points[0].x, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
    ctx.fill();
    
    // Draw points
    points.forEach((point, i) => {
      const isHovered = hovering === i;
      const isDragged = dragging === i;
      const radius = isHovered || isDragged ? 8 : 6;
      
      // Glow
      if (isHovered || isDragged) {
        ctx.shadowColor = '#8b5cf6';
        ctx.shadowBlur = 15;
      }
      
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isDragged ? '#ec4899' : (isHovered ? '#a78bfa' : '#8b5cf6');
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      
      // Band label
      ctx.fillStyle = hovering === i ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)';
      ctx.font = '9px Manrope, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${BANDS[i]}Hz`, point.x, height - padding.bottom + 15);
      
      // Gain value on hover
      if (isHovered || isDragged) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px Manrope, sans-serif';
        const gainText = `${currentGains[i] > 0 ? '+' : ''}${currentGains[i].toFixed(1)}dB`;
        ctx.fillText(gainText, point.x, point.y - 15);
      }
    });
  }, [currentGains, dragging, hovering]);

  // Handle mouse events for dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // y not used in this handler
    
    const padding = { left: 40, right: 20 };
    const graphWidth = canvas.width - padding.left - padding.right;
    
    let closestIdx = 0;
    let closestDist = Infinity;
    
    BANDS.forEach((_, i) => {
      const pointX = padding.left + (i / (BANDS.length - 1)) * graphWidth;
      const dist = Math.abs(x - pointX);
      if (dist < closestDist && dist < 20) {
        closestDist = dist;
        closestIdx = i;
      }
    });
    
    if (closestDist < 20) {
      setDragging(closestIdx);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const padding = { left: 40, right: 20, top: 20, bottom: 30 };
    const graphWidth = canvas.width - padding.left - padding.right;
    const graphHeight = canvas.height - padding.top - padding.bottom;
    
    let foundHover: number | null = null;
    BANDS.forEach((_, i) => {
      const pointX = padding.left + (i / (BANDS.length - 1)) * graphWidth;
      if (Math.abs(x - pointX) < 15) {
        foundHover = i;
      }
    });
    setHovering(foundHover);
    
    // Drag
    if (dragging !== null) {
      const newGain = yToGain(y - padding.top, graphHeight);
      const clampedGain = Math.max(-12, Math.min(12, Math.round(newGain * 2) / 2)); // snap to 0.5
      
      const newGains = [...currentGains];
      newGains[dragging] = clampedGain;
      setEqGains(newGains);
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  // Initialize canvas and draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas size
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = 300;
    }
    
    draw();
  }, [draw]);

  // Redraw on gains change
  useEffect(() => {
    draw();
  }, [currentGains, draw]);

  const applyPreset = (name: string) => {
    if (PRESETS[name]) {
      setEqGains([...PRESETS[name]]);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center text-xl">
            🎛️
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Interactive EQ</h3>
            <p className="text-sm text-gray-400">Real-time preview with Web Audio API</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={togglePlay}
            disabled={!files.length}
            className={`px-4 py-2 rounded-xl font-semibold transition-all ${
              isPlaying 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-105'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isPlaying ? '⏹️ Stop' : '▶️ Play EQ'}
          </button>
          <button 
            onClick={resetEq}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Reset
          </button>
        </div>
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

      {/* Canvas */}
      <div className="relative rounded-xl overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height: '300px' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        {hovering !== null && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {BANDS[hovering]}Hz: {currentGains[hovering] > 0 ? '+' : ''}{currentGains[hovering].toFixed(1)}dB
          </div>
        )}
      </div>

      {!files.length && (
        <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm">
          ⚠️ Upload an audio file first to use real-time EQ preview
        </div>
      )}

      <div className="mt-4 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ How to use</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>Upload audio</strong> first, then click "Play EQ" to start real-time preview</li>
          <li><strong>Drag points</strong> up/down to adjust gain (-12 to +12 dB)</li>
          <li><strong>Hover</strong> over points to see frequency and gain</li>
          <li><strong>Click presets</strong> to apply ready-made EQ curves</li>
          <li>Changes are applied in real-time to the audio output!</li>
        </ul>
      </div>
    </div>
  );
}
