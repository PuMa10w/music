import { create } from 'zustand'

export type Theme = 'dark' | 'light' | 'system'

interface AppState {
  files: File[]
  currentMode: '2stem' | '4stem' | '6stem'
  currentPreset: string
  selectedModel: string
  eqGains: number[] // 20 bands
  theme: Theme
  currentJobId: string | null
  
  setFiles: (files: File[]) => void
  renameFile: (index: number, newName: string) => void
  setMode: (mode: '2stem' | '4stem' | '6stem') => void
  setPreset: (preset: string) => void
  setModel: (model: string) => void
  setEqGains: (gains: number[]) => void
  resetEq: () => void
  setTheme: (theme: Theme) => void
  setCurrentJobId: (id: string | null) => void
}

const defaultGains = Array(20).fill(0)

// Initialize theme from localStorage or default to 'dark'
const getInitialTheme = (): Theme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vru-theme')
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved
  }
  return 'dark'
}

export const useStore = create<AppState>((set) => ({
  files: [],
  currentMode: '2stem',
  currentPreset: 'default',
  selectedModel: 'modern_ensemble',
  eqGains: [...defaultGains],
  theme: getInitialTheme(),
  currentJobId: null,
  
  setFiles: (files) => set({ files }),
  renameFile: (index, newName) => set((state) => {
    const newFiles = [...state.files]
    if (index >= 0 && index < newFiles.length) {
      const file = newFiles[index]
      const renamedFile = new File([file], newName, { type: file.type })
      newFiles[index] = renamedFile
    }
    return { files: newFiles }
  }),
  setMode: (mode) => set({ currentMode: mode }),
  setPreset: (preset) => set({ currentPreset: preset }),
  setModel: (model) => set({ selectedModel: model }),
  setEqGains: (gains) => set({ eqGains: gains }),
  resetEq: () => set({ eqGains: [...defaultGains] }),
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('vru-theme', theme)
      applyTheme(theme)
    }
    set({ theme })
  },
  setCurrentJobId: (id) => set({ currentJobId: id }),
}))

// Helper to apply theme to document
export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  const root = window.document.documentElement
  
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    root.classList.toggle('dark', systemTheme === 'dark')
    root.classList.toggle('light', systemTheme === 'light')
  } else {
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
  }
}
