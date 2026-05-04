import { useStore, Theme } from '../stores/useStore';

const themes: { id: Theme; label: string; icon: string }[] = [
  { id: 'dark', label: 'Dark', icon: '🌙' },
  { id: 'light', label: 'Light', icon: '☀️' },
  { id: 'system', label: 'System', icon: '💻' },
];

export default function ThemeSwitcher() {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => handleThemeChange(t.id)}
          title={t.label}
          className={`
            px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300
            flex items-center gap-2
            ${theme === t.id 
              ? 'bg-violet-500/30 text-white shadow-lg shadow-violet-500/20' 
              : 'text-gray-400 hover:text-white hover:bg-white/10'
            }
          `}
        >
          <span className="text-base">{t.icon}</span>
          <span className="hidden sm:inline">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
