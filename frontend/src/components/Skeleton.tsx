import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  count?: number;
}

export default function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array(count).fill(0).map((_, i) => (
        <motion.div
          key={i}
          className="bg-gradient-to-r from-white/5 via-white/10 to-white/5 bg-[length:200%_100%] rounded-lg"
          style={{ 
            backgroundSize: '200% 100%',
            backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 100%)'
          }}
          animate={{
            backgroundPosition: ['0% 0%', '100% 0%', '0% 0%']
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear'
          }}
        />
      ))}
    </div>
  );
}

// Predefined skeletons for common layouts
export function SkeletonCard() {
  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-32 w-full mb-4" />
      <div className="flex gap-2">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 flex-1" />
      </div>
    </div>
  );
}

export function SkeletonWaveform() {
  return (
    <div className="w-full h-32 rounded-xl bg-white/5 animate-pulse" />
  );
}

export function SkeletonTabs() {
  return (
    <div className="flex gap-2 mb-6">
      {[1,2,3,4,5,6].map(i => (
        <Skeleton key={i} className="h-12 w-24 rounded-xl" />
      ))}
    </div>
  );
}
