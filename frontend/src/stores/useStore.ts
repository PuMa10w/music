import { create } from 'zustand'

interface AppState {
  files: File[]
  currentMode: '2stem' | '4stem' | '6stem'
  currentPreset: string
  selectedModel: string
  
  setFiles: (files: File[]) => void
  setMode: (mode: '2stem' | '4stem' | '6stem') => void
  setPreset: (preset: string) => void
  setModel: (model: string) => void
}

export const useStore = create<AppState>((set) => ({
  files: [],
  currentMode: '2stem',
  currentPreset: 'default',
  selectedModel: 'modern_ensemble',
  
  setFiles: (files) => set({ files }),
  setMode: (mode) => set({ currentMode: mode }),
  setPreset: (preset) => set({ currentPreset: preset }),
  setModel: (model) => set({ selectedModel: model }),
}))
