/**
 * WebSocket 推送客户端
 * 推送实时行情到股票管理系统的 Socket.io 服务端
 */

import { io, Socket } from 'socket.io-client';
import { StockQuote } from './sources';

const WS_URL = process.env.WS_TARGET_URL || 'http://localhost:3000';

class WebSocketPusher {
  private socket: Socket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(): void {
    this.socket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      console.log('[WebSocket] 已连接到股票管理系统');
      
      // 注册为数据收集器
      this.socket?.emit('register', { type: 'collector' });
    });

    this.socket.on('disconnect', () => {
      console.log('[WebSocket] 连接断开');
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] 连接错误:', error.message);
    });
  }

  // 推送实时行情数据
  pushQuotes(quotes: StockQuote[]): void {
    if (!this.socket?.connected) {
      console.warn('[WebSocket] 未连接，跳过推送');
      return;
    }

    this.socket.emit('quotes', {
      timestamp: Date.now(),
      data: quotes
    });
    
    console.log(`[WebSocket] 推送 ${quotes.length} 条行情数据`);
  }

  // 推送单只股票更新
  pushQuote(quote: StockQuote): void {
    if (!this.socket?.connected) return;
    
    this.socket.emit('quote', quote);
  }

  // 断开连接
  disconnect(): void {
    this.socket?.disconnect();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
  }
}

export const pusher = new WebSocketPusher();
