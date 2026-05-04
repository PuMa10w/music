import { motion } from 'framer-motion';

type TabType = 'upload' | 'preview' | '3d' | 'karaoke' | 'history';

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  hasResults: boolean;
  historyCount: number;
}

const tabs = [
  { id: 'upload' as TabType, icon: '📤', label: 'Upload' },
  { id: 'preview' as TabType, icon: '👁️', label: 'Preview', needResults: true },
  { id: '3d' as TabType, icon: '🎧', label: '3D' },
  { id: 'karaoke' as TabType, icon: '🎤', label: 'Karaoke' },
  { id: 'history' as TabType, icon: '📊', label: 'History' },
];

export default function MobileNav({ activeTab, onTabChange, hasResults, historyCount }: MobileNavProps) {
  return (
    <motion.div
      className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 safe-area-inset-bottom"
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
    >
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          // Skip tabs that need results if no results
          if (tab.needResults && !hasResults && tab.id !== activeTab) return null;
          
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-gradient-to-r from-violet-500 to-pink-500"
                  layoutId="activeTabIndicator"
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              
              <span className="text-xl relative">
                {tab.icon}
                {/* History badge */}
                {tab.id === 'history' && historyCount > 0 && (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-pink-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold">
                    {historyCount > 9 ? '9+' : historyCount}
                  </span>
                )}
              </span>
              
              <span className={`text-[10px] font-medium ${
                isActive ? 'opacity-100' : 'opacity-60'
              }`}>
                {tab.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
