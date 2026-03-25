/**
 * 数据收集器主服务
 * 定时抓取行情数据并推送到股票管理系统
 */

import { fetchWithFailover, StockQuote } from './sources';
import { getStocks, Stock } from './api-client';
import { pusher } from './pusher';

const FETCH_INTERVAL = parseInt(process.env.FETCH_INTERVAL || '5') * 1000; // 默认 5 秒

class DataCollector {
  private stocks: Stock[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  async init(): Promise<void> {
    console.log('[DataCollector] 初始化...');
    
    // 连接 WebSocket
    pusher.connect();
    
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

  // 按市场分组抓取
  async fetchAllQuotes(): Promise<void> {
    if (this.stocks.length === 0) {
      console.warn('[DataCollector] 股票池为空，跳过抓取');
      return;
    }

    // 按市场分组
    const marketGroups: Record<string, Stock[]> = {};
    for (const stock of this.stocks) {
      if (!marketGroups[stock.market]) {
        marketGroups[stock.market] = [];
      }
      marketGroups[stock.market].push(stock);
    }

    const allQuotes: StockQuote[] = [];
    const results: { market: string; count: number; source: string }[] = [];

    // 分别抓取每个市场
    for (const [market, stocks] of Object.entries(marketGroups)) {
      try {
        const codes = stocks.map(s => s.code);
        
        // 分批处理（每批最多 50 只）
        const batchSize = 50;
        for (let i = 0; i < codes.length; i += batchSize) {
          const batch = codes.slice(i, i + batchSize);
          const { quotes, source } = await fetchWithFailover(batch, market);
          
          allQuotes.push(...quotes);
          results.push({ market, count: quotes.length, source });
        }
      } catch (error) {
        console.error(`[DataCollector] 抓取 ${market} 市场失败:`, error);
      }
    }

    // 推送数据
    if (allQuotes.length > 0) {
      pusher.pushQuotes(allQuotes);
      
      // 统计日志
      console.log('[DataCollector] 抓取完成:');
      results.forEach(r => {
        console.log(`  - ${r.market}: ${r.count} 只 (来源: ${r.source})`);
      });
    }
  }

  // 启动定时抓取
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[DataCollector] 启动定时抓取 (间隔: ${FETCH_INTERVAL}ms)`);
    
    // 立即执行一次
    this.fetchAllQuotes();
    
    // 定时执行
    this.timer = setInterval(() => {
      this.fetchAllQuotes();
    }, FETCH_INTERVAL);
    
    // 每 5 分钟刷新一次股票池
    setInterval(() => {
      this.refreshStocks();
    }, 5 * 60 * 1000);
  }

  // 停止服务
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    pusher.disconnect();
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
