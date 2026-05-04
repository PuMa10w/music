import { useEffect, useRef, useState, useCallback } from 'react';

export interface ProgressData {
  action: string;
  step?: string;
  percent?: number;
  message?: string;
  status?: string;
  data?: any;
}

export function useWebSocket(jobId: string | null) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!jobId) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/${jobId}`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      console.log('[WebSocket] Connected for job:', jobId);
      setConnected(true);
    };
    
    ws.current.onmessage = (event) => {
      try {
        const data: ProgressData = JSON.parse(event.data);
        console.log('[WebSocket] Progress:', data);
        setProgress(data);
      } catch (e) {
        console.error('[WebSocket] Parse error:', e);
      }
    };
    
    ws.current.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setConnected(false);
      // Try to reconnect after 3 seconds
      reconnectTimeout.current = setTimeout(connect, 3000);
    };
    
    ws.current.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
  }, [jobId]);

  useEffect(() => {
    if (!jobId) return;
    
    connect();
    
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [jobId, connect]);

  return { progress, connected, ws: ws.current };
}
