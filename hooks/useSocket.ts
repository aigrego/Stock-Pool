'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeStock {
  code: string;
  name: string;
  current: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  bid1: number;
  ask1: number;
  timestamp: number;
}

interface UseSocketOptions {
  onQuotes?: (quotes: RealtimeStock[]) => void;
  onQuote?: (quote: RealtimeStock) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 初始化 Socket.io 连接
    const socket = io({
      path: '/api/socket',
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] 已连接到服务器');
      setIsConnected(true);
      
      // 注册为前端客户端
      socket.emit('register', { type: 'client' });
      
      options.onConnect?.();
    });

    socket.on('disconnect', () => {
      console.log('[Socket] 连接断开');
      setIsConnected(false);
      options.onDisconnect?.();
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] 连接错误:', error);
    });

    socket.on('quotes', (data) => {
      setLastUpdate(new Date(data.timestamp));
      options.onQuotes?.(data.data);
    });

    socket.on('quote', (data) => {
      options.onQuote?.(data);
    });

    // 清理
    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    isConnected,
    lastUpdate,
    socket: socketRef.current
  };
}
