import { create } from 'zustand'

interface AppState {
  files: File[]
  currentMode: '2stem' | '4stem' | '6stem'
  currentPreset: string
  selectedModel: string
  eqGains: number[] // 10 bands
  
  setFiles: (files: File[]) => void
  renameFile: (index: number, newName: string) => void
  setMode: (mode: '2stem' | '4stem' | '6stem') => void
  setPreset: (preset: string) => void
  setModel: (model: string) => void
  setEqGains: (gains: number[]) => void
  resetEq: () => void
}

const defaultGains = Array(10).fill(0)

export const useStore = create<AppState>((set) => ({
  files: [],
  currentMode: '2stem',
  currentPreset: 'default',
  selectedModel: 'modern_ensemble',
  eqGains: [...defaultGains],
  
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
}))
