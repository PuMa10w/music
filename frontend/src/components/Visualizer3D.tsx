import { useState, useEffect, useRef } from 'react';

type VizMode = 'bars' | 'mesh' | 'particles' | 'sphere' | 'storm';

interface Visualizer3DProps {
  audioUrl?: string;
  isPlaying?: boolean;
}

export default function Visualizer3D({ audioUrl: _audioUrl, isPlaying = false }: Visualizer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<VizMode>('bars');
  const [bars, setBars] = useState<number[]>(Array(64).fill(30));
  const animationRef = useRef<number>(0);

  // Simulate audio data when playing
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      setBars(Array(64).fill(30));
      return;
    }

    const animate = () => {
      setBars(prev => prev.map(() => 20 + Math.random() * 80));
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // Draw based on mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = 'rgba(15, 15, 26, 0.9)';
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.35;

      if (mode === 'bars') {
        // Frequency Bars (circular)
        const angleStep = (Math.PI * 2) / bars.length;
        bars.forEach((barHeight, i) => {
          const angle = i * angleStep;
          const x1 = centerX + Math.cos(angle) * radius;
          const y1 = centerY + Math.sin(angle) * radius;
          const x2 = centerX + Math.cos(angle) * (radius + barHeight * 0.8);
          const y2 = centerY + Math.sin(angle) * (radius + barHeight * 0.8);

          // Gradient color based on height
          const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
          gradient.addColorStop(0, `rgba(139, 92, 246, ${barHeight / 100})`);
          gradient.addColorStop(1, `rgba(236, 72, 153, ${barHeight / 100})`);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 3;
          ctx.stroke();

          // Glow
          ctx.shadowColor = '#8b5cf6';
          ctx.shadowBlur = barHeight * 0.3;
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
      } else if (mode === 'mesh') {
        // Waveform Mesh (connected points)
        ctx.beginPath();
        bars.forEach((barHeight, i) => {
          const angle = (i / bars.length) * Math.PI * 2;
          const r = radius + barHeight * 0.5;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();

        // Fill mesh
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.5);
        gradient.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(236, 72, 153, 0.1)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Mesh lines
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner mesh
        ctx.beginPath();
        bars.forEach((barHeight, i) => {
          if (i % 4 === 0) {
            const angle = (i / bars.length) * Math.PI * 2;
            const r = radius * 0.5 + barHeight * 0.3;
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            ctx.lineTo(x, y);
          }
        });
        ctx.strokeStyle = 'rgba(236, 72, 153, 0.5)';
        ctx.stroke();
      } else if (mode === 'particles') {
        // Orbital Particles
        const time = Date.now() * 0.001;

        bars.forEach((barHeight, i) => {
          const angle = (i / bars.length) * Math.PI * 2 + time * 0.5;
          const particleRadius = 2 + (barHeight / 100) * 4;
          const r = radius + barHeight * 0.6;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;

          // Particle glow
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, particleRadius * 3);
          gradient.addColorStop(0, `rgba(139, 92, 246, ${barHeight / 100})`);
          gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, particleRadius * 3, 0, Math.PI * 2);
          ctx.fill();

          // Particle core
          ctx.beginPath();
          ctx.arc(x, y, particleRadius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(236, 72, 153, ${0.5 + barHeight / 200})`;
          ctx.fill();
        });

        // Center orb
        const pulse = isPlaying ? 1 + Math.sin(time * 3) * 0.2 : 1;
        const orbGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 30 * pulse);
        orbGradient.addColorStop(0, 'rgba(139, 92, 246, 0.9)');
        orbGradient.addColorStop(0.5, 'rgba(236, 72, 153, 0.5)');
        orbGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = orbGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 30 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (mode === 'sphere') {
        // Frequency Sphere (3D-like wireframe sphere reacting to frequencies)
        const time = Date.now() * 0.001;
        const slices = 16;
        const stacks = 12;

        for (let stack = 0; stack < stacks; stack++) {
          const phi = (stack / stacks) * Math.PI;
          const stackRadius = Math.sin(phi) * radius;
          const y = Math.cos(phi) * radius;

          for (let slice = 0; slice < slices; slice++) {
            const theta = (slice / slices) * Math.PI * 2;
            const freqIndex = (stack * slices + slice) % bars.length;
            const barH = bars[freqIndex] / 100;
            
            // Sphere deformation based on frequency
            const deformation = 1 + barH * 0.5;
            const x = Math.cos(theta) * stackRadius * deformation;
            const z = Math.sin(theta) * stackRadius * deformation;
            
            // Project to 2D (simple orthographic)
            const screenX = centerX + x;
            const screenY = centerY + y + (z * 0.3); // fake perspective
            
            const pointSize = 2 + barH * 4;
            
            // Color gradient from violet to pink based on frequency
            const hue = 260 + (barH * 60); 
            ctx.fillStyle = `hsla(${hue}, 80%, 65%, ${0.5 + barH * 0.5})`;
            
            ctx.beginPath();
            ctx.arc(screenX, screenY, pointSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw connections (wireframe)
            if (slice > 0 && stack > 0) {
              ctx.strokeStyle = `rgba(139, 92, 246, ${barH * 0.3})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
        
        // Rotating glow ring
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(time * 0.5);
        const ringGradient = ctx.createRadialGradient(0, 0, radius * 0.8, 0, 0, radius * 1.2);
        ringGradient.addColorStop(0, 'rgba(139, 92, 246, 0)');
        ringGradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.2)');
        ringGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = ringGradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
      } else if (mode === 'storm') {
        // Particle Storm (chaotic particles with frequency-driven behavior)
        const time = Date.now() * 0.001;
        const particleCount = 150;

        for (let i = 0; i < particleCount; i++) {
          const speed = 0.5 + (i / particleCount) * 2;
          const baseAngle = (i / particleCount) * Math.PI * 6 + time * speed;
          const freqIndex = i % bars.length;
          const barH = bars[freqIndex] / 100;
          
          // Particle burst outward based on frequency
          const burstRadius = radius * (0.5 + barH * 1.5);
          const x = centerX + Math.cos(baseAngle) * burstRadius;
          const y = centerY + Math.sin(baseAngle) * burstRadius * 0.6; // elliptical
          
          // Tail effect
          const tailLength = 5 + barH * 15;
          const tailX = x - Math.cos(baseAngle) * tailLength;
          const tailY = y - Math.sin(baseAngle) * tailLength;
          
          const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
          gradient.addColorStop(0, `rgba(139, 92, 246, 0)`);
          gradient.addColorStop(1, `rgba(236, 72, 153, ${barH})`);
          
          ctx.beginPath();
          ctx.moveTo(tailX, tailY);
          ctx.lineTo(x, y);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 1 + barH * 2;
          ctx.stroke();
          
          // Particle head
          ctx.beginPath();
          ctx.arc(x, y, 1 + barH * 3, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + barH * 0.5})`;
          ctx.fill();
        }
        
        // Storm center flash
        if (isPlaying) {
          const flashIntensity = bars.reduce((a, b) => a + b, 0) / bars.length / 100;
          const flashGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 0.5);
          flashGradient.addColorStop(0, `rgba(236, 72, 153, ${flashIntensity * 0.5})`);
          flashGradient.addColorStop(1, 'rgba(236, 72, 153, 0)');
          ctx.fillStyle = flashGradient;
          ctx.beginPath();
          ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      requestAnimationFrame(draw);
    };

    draw();
    return () => {
      // Cleanup handled by requestAnimationFrame
    };
  }, [bars, mode]);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const modeConfig = {
    bars: { icon: '📊', label: 'Frequency Bars', desc: 'Circular frequency bars' },
    mesh: { icon: '🕸️', label: 'Waveform Mesh', desc: 'Connected waveform mesh' },
    particles: { icon: '✨', label: 'Orbital Particles', desc: 'Particles in orbit' },
    sphere: { icon: '🔮', label: 'Frequency Sphere', desc: '3D frequency sphere' },
    storm: { icon: '⛈️', label: 'Particle Storm', desc: 'Chaotic frequency storm' },
  };

  return (
    <div className="w-full h-64 relative rounded-xl overflow-hidden bg-black/20">
      {/* Mode Selector */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {(Object.keys(modeConfig) as VizMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              mode === m
                ? 'bg-violet-500/80 text-white shadow-lg shadow-violet-500/50'
                : 'bg-black/50 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="mr-1">{modeConfig[m].icon}</span>
            <span className="hidden sm:inline">{modeConfig[m].label}</span>
          </button>
        ))}
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />

      {/* Mode Description */}
      <div className="absolute bottom-4 left-4 right-4 text-center">
        <p className="text-xs text-gray-400 bg-black/50 inline-block px-3 py-1 rounded-full">
          {modeConfig[mode].icon} {modeConfig[mode].desc}
        </p>
      </div>

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
    </div>
  );
}
