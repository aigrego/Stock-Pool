'use client';

import { useEffect, useState, useCallback } from 'react';

export interface RealtimeStock {
  code: string;
  name: string;
  market: string;
  type: string;
  cost: number;
  current: number;
  open: number;
  close: number;
  high: number;
  low: number;
  change_pct: number;
  volume: number;
  amount: number;
  pnl_pct: number;
  pnl_amount: number;
  updated_at: string;
}

interface WebSocketMessage {
  type: string;
  data?: Record<string, RealtimeStock>;
  timestamp?: string;
}

export function useRealtimeData(wsUrl: string = 'ws://100.111.204.29:8765') {
  const [data, setData] = useState<Record<string, RealtimeStock>>({});
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('✅ WebSocket connected');
          setConnected(true);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            
            if (message.type === 'market_data' && message.data) {
              setData(prev => ({
                ...prev,
                ...message.data
              }));
            }
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket disconnected, reconnecting...');
          setConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = (e) => {
          console.error('WebSocket error:', e);
          setError('Connection error');
        };

      } catch (e) {
        setError('Failed to connect');
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [wsUrl]);

  const getStock = useCallback((code: string): RealtimeStock | undefined => {
    return data[code];
  }, [data]);

  return { data, connected, error, getStock };
}
