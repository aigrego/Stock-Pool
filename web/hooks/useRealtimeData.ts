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
  bid1: number;
  ask1: number;
  changePct: number;
  pnlPct: number;
  pnlAmount: number;
  cost: number;
  date: string;
  time: string;
}

interface UseRealtimeOptions {
  interval?: number;  // 轮询间隔，默认 5000ms
  enabled?: boolean;  // 是否启用，默认 true
}

export function useRealtimeData(options: UseRealtimeOptions = {}) {
  const { interval = 5000, enabled = true } = options;
  
  const [data, setData] = useState<Record<string, RealtimeStock>>({});
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
    loading,
    error,
    lastUpdated,
    refresh,
    connected: !error  // 模拟连接状态
  };
}
