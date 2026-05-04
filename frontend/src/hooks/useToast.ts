import { useState } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  msg: string;
  type: ToastType;
  progress?: number; // 0-100
  showUndo?: boolean;
  onUndo?: () => void;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  const addToast = (msg: string, type: ToastType = 'info', options?: {
    progress?: number;
    showUndo?: boolean;
    onUndo?: () => void;
  }) => {
    const id = Date.now();
    setToasts(prev => [...prev, { 
      id, 
      msg, 
      type,
      progress: options?.progress,
      showUndo: options?.showUndo,
      onUndo: options?.onUndo
    }]);
    
    // Auto-remove after 3s (unless it has progress bar)
    if (!options?.progress) {
      setTimeout(() => removeToast(id), 3000);
    }
  };
  
  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  
  return { toasts, addToast, removeToast };
}
