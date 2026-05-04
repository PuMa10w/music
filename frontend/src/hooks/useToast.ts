import { useState } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; msg: string; type: string }>>([]);
  
  const addToast = (msg: string, type: 'success' | 'error') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  return { toasts, addToast };
}
