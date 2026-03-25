/**
 * 数据收集器主服务 (简化版)
 * 定时刷新股票池，前端通过 HTTP 轮询获取实时数据
 */

import { getStocks, Stock } from './api-client';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 分钟刷新一次股票池

class DataCollector {
  private stocks: Stock[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  async init(): Promise<void> {
    console.log('[DataCollector] 初始化...');
    
    // 首次加载股票池
    await this.refreshStocks();
    
    console.log(`[DataCollector] 股票池加载完成: ${this.stocks.length} 只股票`);
  }

  // 刷新股票池
  async refreshStocks(): Promise<void> {
    try {
      this.stocks = await getStocks();
      console.log(`[DataCollector] 股票池已刷新: ${this.stocks.length} 只`);
    } catch (error) {
      console.error('[DataCollector] 刷新股票池失败:', error);
    }
  }

  // 启动定时刷新
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[DataCollector] 启动定时刷新 (间隔: ${REFRESH_INTERVAL}ms)`);
    
    // 定时刷新股票池
    this.timer = setInterval(() => {
      this.refreshStocks();
    }, REFRESH_INTERVAL);
  }

  // 停止服务
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('[DataCollector] 已停止');
  }
}

// 主函数
async function main() {
  const collector = new DataCollector();
  
  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[DataCollector] 收到 SIGINT，正在关闭...');
    collector.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n[DataCollector] 收到 SIGTERM，正在关闭...');
    collector.stop();
    process.exit(0);
  });

  try {
    await collector.init();
    collector.start();
  } catch (error) {
    console.error('[DataCollector] 启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { DataCollector };
