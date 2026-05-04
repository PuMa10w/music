import { useEffect, useRef, useState } from 'react';

export default function SpectrumAnalyzer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const [currentJobId] = useState<string | null>(null);
  const [isPlaying] = useState(false);

  useEffect(() => {
    if (!currentJobId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;

    // Setup audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Create analyser
    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 2048;
    analyserRef.current.smoothingTimeConstant = 0.8;

    // Connect audio element
    const audioElements = document.querySelectorAll('audio');
    let targetAudio: HTMLAudioElement | null = null;
    
    audioElements.forEach(audio => {
      if (!audio.paused) {
        targetAudio = audio;
      }
    });

    if (!targetAudio && audioElements.length > 0) {
      targetAudio = audioElements[0];
    }

    if (targetAudio && analyserRef.current) {
      if (!sourceRef.current) {
        sourceRef.current = ctx.createMediaElementSource(targetAudio);
      }
      sourceRef.current.disconnect();
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(ctx.destination);
    }

    // Draw spectrum
    const bufferLength = analyserRef.current?.frequencyBinCount || 1024;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current || !canvasCtx || !canvas) return;

      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] * 1.5;

        // Create gradient based on frequency
        const hue = (i / bufferLength) * 300 + 180; // Purple to pink to blue
        canvasCtx.fillStyle = `hsl(${hue}, 80%, 60%)`;
        
        canvasCtx.fillRect(
          x, 
          canvas.height - barHeight, 
          barWidth, 
          barHeight
        );

        x += barWidth + 1;
      }
    };

    if (isPlaying) {
      draw();
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
    };
  }, [currentJobId, isPlaying]);

  return (
    <div className="glass-premium rounded-2xl p-4 mt-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-lg">
          📊
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Spectrum Analyzer</h3>
          <p className="text-xs text-gray-400">Real-time frequency analysis</p>
        </div>
      </div>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={200} 
        className="w-full h-48 rounded-lg bg-black/50"
      />
    </div>
  );
}
