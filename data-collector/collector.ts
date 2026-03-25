/**
 * 数据收集器主服务 (简化版)
 * 定时刷新股票池，前端通过 HTTP 轮询获取实时数据
 */

import { getStocks, Stock, addStock, updateStock } from './api-client';
import * as fs from 'fs';
import * as path from 'path';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 分钟刷新一次股票池
const SYNC_INTERVAL = 60 * 60 * 1000;   // 1 小时同步一次持仓

// stock-monitor-skill WATCHLIST 路径
const WATCHLIST_PATH = '/root/workspaces/feishu-groups/template/skills/stock-monitor-skill/scripts/monitor.py';

class DataCollector {
  private stocks: Stock[] = [];
  private timer: NodeJS.Timeout | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  async init(): Promise<void> {
    console.log('[DataCollector] 初始化...');
    
    // 首次加载股票池
    await this.refreshStocks();
    
    // 首次同步持仓
    await this.syncHoldings();
    
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

  // 读取 stock-monitor-skill 持仓 (从 Python 文件解析)
  private readWatchlist(): Array<{
    code: string;
    name: string;
    market: string;
    hold_cost: number;
  }> {
    try {
      if (!fs.existsSync(WATCHLIST_PATH)) {
        console.log('[DataCollector] monitor.py 不存在');
        return [];
      }

      const content = fs.readFileSync(WATCHLIST_PATH, 'utf-8');

      // 提取 WATCHLIST = [...] 部分 (从 WATCHLIST = [ 到第一个独立的 ])
      const match = content.match(/WATCHLIST\s*=\s*(\[[\s\S]*?^\])/m);
      if (!match) {
        console.log('[DataCollector] 未找到 WATCHLIST');
        return [];
      }

      // 将 Python 字典转换为 JSON (简单替换)
      let jsonStr = match[1]
        .replace(/'/g, '"')           // 单引号转双引号
        .replace(/,\s*([}\]])/g, '$1') // 移除尾随逗号
        .replace(/True/g, 'true')
        .replace(/False/g, 'false')
        .replace(/None/g, 'null')
        .replace(/#.*$/gm, '');        // 移除注释

      const watchlist = JSON.parse(jsonStr);

      return watchlist.map((item: any) => ({
        code: item.code,
        name: item.name,
        market: item.market,
        hold_cost: item.cost
      }));
    } catch (error) {
      console.error('[DataCollector] 读取 watchlist 失败:', error);
      return [];
    }
  }

  // 同步持仓到 stock-pool
  async syncHoldings(): Promise<void> {
    try {
      const holdings = this.readWatchlist();
      if (holdings.length === 0) {
        console.log('[DataCollector] 没有持仓需要同步');
        return;
      }

      console.log(`[DataCollector] 开始同步 ${holdings.length} 只持仓...`);

      for (const holding of holdings) {
        // 提取纯代码
        const code = holding.code;
        const market = holding.market.toLowerCase();
        const type = code.match(/^(159|510|511|512|513|515|516|518|560|561|562|563|564|565|566|567|568|569|588)/) ? 'etf' : 
                     market === 'fx' ? 'gold' : 'individual';

        // 获取现有股票列表
        const existingStocks = await getStocks();
        const existing = existingStocks.find(s => s.code === code);

        if (existing) {
          // 更新现有股票
          await updateStock(code, {
            name: holding.name,
            cost: holding.hold_cost
          });
          console.log(`[DataCollector] 更新持仓: ${code} ${holding.name} 成本¥${holding.hold_cost}`);
        } else {
          // 添加新股票
          await addStock({
            code,
            name: holding.name,
            market,
            type,
            cost: holding.hold_cost,
            alertsJson: JSON.stringify({
              priceUp: 5,
              priceDown: -5,
              changeUp: 3,
              changeDown: -3
            })
          });
          console.log(`[DataCollector] 新增持仓: ${code} ${holding.name} 成本¥${holding.hold_cost}`);
        }
      }

      console.log(`[DataCollector] 持仓同步完成`);
      
      // 刷新本地股票池
      await this.refreshStocks();
    } catch (error) {
      console.error('[DataCollector] 同步持仓失败:', error);
    }
  }

  // 启动定时刷新
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`[DataCollector] 启动定时刷新 (间隔: ${REFRESH_INTERVAL}ms)`);
    console.log(`[DataCollector] 持仓同步间隔: ${SYNC_INTERVAL}ms`);
    
    // 定时刷新股票池
    this.timer = setInterval(() => {
      this.refreshStocks();
    }, REFRESH_INTERVAL);

    // 定时同步持仓
    this.syncTimer = setInterval(() => {
      this.syncHoldings();
    }, SYNC_INTERVAL);
  }

  // 停止服务
  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
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
