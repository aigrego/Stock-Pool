'use client';

import { useEffect, useState, useCallback } from 'react';

export interface RealtimeStock {
  code: string;
  name: string;
  open: number;
  close: number;
  current: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePct: number;
  pnlPct: number;
  pnlAmount: number;
  cost: number;
  source?: string;
  market?: string;
  updatedAt?: string;
}

interface RealtimeMeta {
  source: string;
  count: number;
  total: number;
}

interface UseRealtimeOptions {
  interval?: number;  // 轮询间隔，默认 5000ms
  enabled?: boolean;  // 是否启用，默认 true
}

export function useRealtimeData(options: UseRealtimeOptions = {}) {
  const { interval = 5000, enabled = true } = options;
  
  const [data, setData] = useState<Record<string, RealtimeStock>>({});
  const [meta, setMeta] = useState<RealtimeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/realtime');
      if (!response.ok) throw new Error('Failed to fetch');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setMeta(result.meta || null);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (e) {
      setError('获取实时数据失败');
      console.error('Realtime fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 立即执行一次
    fetchData();

    // 定时轮询
    const timer = setInterval(fetchData, interval);

    return () => clearInterval(timer);
  }, [fetchData, interval, enabled]);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return {
    data,
    meta,
    loading,
    error,
    lastUpdated,
    refresh,
    connected: !error
  };
}
