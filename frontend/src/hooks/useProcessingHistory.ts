import { useState, useEffect } from 'react';

export interface HistoryItem {
  jobId: string;
  filename: string;
  timestamp: number;
  files: string[];
  mode: string;
}

const STORAGE_KEY = 'voice-remover-history';

export function useProcessingHistory() {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const addToHistory = (item: HistoryItem) => {
    setHistory(prev => [item, ...prev].slice(0, 50)); // Keep last 50 items
  };

  const clearHistory = () => {
    setHistory([]);
  };

  return { history, addToHistory, clearHistory };
}
