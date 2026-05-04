import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortcutsModalProps {
  show: boolean;
  onClose: () => void;
}

export default function ShortcutsModal({ show, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const shortcuts = [
    { action: 'Process file', keys: ['Ctrl', 'Enter'] },
    { action: 'Play/Pause (Karaoke)', keys: ['Space'] },
    { action: 'Close error/modal', keys: ['Esc'] },
    { action: 'Switch to Upload', keys: ['1'] },
    { action: 'Switch to Preview', keys: ['2'] },
    { action: 'Switch to 3D Viz', keys: ['3'] },
    { action: 'Switch to Karaoke', keys: ['4'] },
    { action: 'Switch to History', keys: ['5'] },
    { action: 'Switch to Compare', keys: ['6'] },
    { action: 'Show this help', keys: ['?'] },
    { action: 'Install PWA', keys: ['I'] },
  ];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="glass-premium rounded-2xl p-8 max-w-md w-full mx-4 border border-white/10"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Keyboard Shortcuts</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
                ✕
              </button>
            </div>
            <div className="space-y-3 text-sm">
              {shortcuts.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-gray-300">{item.action}</span>
                  <div className="flex gap-1">
                    {item.keys.map((key) => (
                      <kbd key={key} className="bg-white/10 px-2 py-1 rounded text-xs font-mono">
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
