import { useState } from 'react';

type ToastType = 'success' | 'error'
type ToastItem = { id: number; msg: string; type: ToastType }

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  
  const addToast = (msg: string, type: ToastType) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  return { toasts, addToast };
}
