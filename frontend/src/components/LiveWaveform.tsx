import { useEffect, useRef, useState } from 'react';

export default function LiveWaveform() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number>(0);
  const [currentAudioUrl] = useState<string | null>(null);
  const [isPlaying] = useState(false);

  useEffect(() => {
    if (!currentAudioUrl) return;

    const audio = new Audio(currentAudioUrl);
    audio.crossOrigin = 'anonymous';

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const ctx = audioContextRef.current;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    analyserRef.current = ctx.createAnalyser();
    analyserRef.current.fftSize = 2048;

    if (!sourceRef.current) {
      sourceRef.current = ctx.createMediaElementSource(audio);
    }
    sourceRef.current.connect(analyserRef.current);
    analyserRef.current.connect(ctx.destination);

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current;
    const canvasCtx = canvas?.getContext('2d');

    const draw = () => {
      if (!analyserRef.current || !canvasCtx || !canvas) return;

      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2;

        // Gradient effect
        const gradient = canvasCtx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#8b5cf6'); // Violet
        gradient.addColorStop(0.5, '#ec4899'); // Pink
        gradient.addColorStop(1, '#3b82f6'); // Blue
        
        canvasCtx.fillStyle = gradient;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    if (isPlaying) {
      audio.play();
      draw();
    }

    return () => {
      cancelAnimationFrame(animationRef.current);
      audio.pause();
    };
  }, [currentAudioUrl, isPlaying]);

  return (
    <div className="glass-premium rounded-2xl p-4 mt-6">
      <h3 className="text-lg font-semibold mb-4 text-white">Live Waveform</h3>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={200} 
        className="w-full h-48 rounded-lg bg-black/50"
      />
    </div>
  );
}
