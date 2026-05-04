import { AnimatePresence, motion } from 'framer-motion';

interface ToastItem {
  id: number;
  msg: string;
  type: 'success' | 'error' | 'info' | 'warning';
  progress?: number; // 0-100 for progress bar
  showUndo?: boolean;
  onUndo?: () => void;
}

interface ToastProps {
  toasts: ToastItem[];
  addToast?: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function Toast({ toasts }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`p-4 rounded-xl text-white shadow-2xl backdrop-blur-xl ${
              t.type === 'success' ? 'bg-green-600/90 border border-green-400/30' :
              t.type === 'error' ? 'bg-red-600/90 border border-red-400/30' :
              t.type === 'warning' ? 'bg-yellow-600/90 border border-yellow-400/30' :
              'bg-violet-600/90 border border-violet-400/30'
            }`}
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <span className="text-xl mt-0.5">
                {t.type === 'success' && '✅'}
                {t.type === 'error' && '❌'}
                {t.type === 'warning' && '⚠️'}
                {t.type === 'info' && 'ℹ️'}
              </span>
              
              {/* Message */}
              <div className="flex-1">
                <p className="text-sm font-medium">{t.msg}</p>
                
                {/* Progress Bar */}
                {t.progress !== undefined && (
                  <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-white/80 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${t.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                )}
              </div>
              
              {/* Undo Button */}
              {t.showUndo && (
                <button
                  onClick={t.onUndo}
                  className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition"
                >
                  Undo
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
