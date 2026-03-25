import { query } from '@/lib/db';

export interface AlertRule {
  cost_pct_above?: number;      // 成本涨幅预警 (%)
  cost_pct_below?: number;      // 成本跌幅预警 (%)
  change_pct_above?: number;    // 日内涨幅预警 (%)
  change_pct_below?: number;    // 日内跌幅预警 (%)
  volume_surge?: number;        // 成交量异动倍数
  ma_monitor?: boolean;         // 均线金叉死叉监控
  rsi_monitor?: boolean;        // RSI超买超卖监控
  gap_monitor?: boolean;        // 跳空缺口监控
  trailing_stop?: boolean;      // 动态止盈
}

export interface StockAlertConfig {
  code: string;
  name: string;
  cost: number;
  alerts: AlertRule;
}

export interface AlertCheckResult {
  code: string;
  name: string;
  type: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  currentValue: number;
  thresholdValue: number;
}

// 检查成本百分比预警
function checkCostAlerts(
  stock: StockAlertConfig,
  currentPrice: number
): AlertCheckResult[] {
  const alerts: AlertCheckResult[] = [];
  const costPct = stock.cost > 0 ? ((currentPrice - stock.cost) / stock.cost) * 100 : 0;
  
  // 成本上涨预警
  if (stock.alerts.cost_pct_above && costPct >= stock.alerts.cost_pct_above) {
    alerts.push({
      code: stock.code,
      name: stock.name,
      type: 'cost_profit',
      severity: 'info',
      title: '成本盈利预警',
      message: `${stock.name}(${stock.code}) 当前盈利 ${costPct.toFixed(2)}%，超过设定阈值 ${stock.alerts.cost_pct_above}%`,
      currentValue: costPct,
      thresholdValue: stock.alerts.cost_pct_above
    });
  }
  
  // 成本下跌预警
  if (stock.alerts.cost_pct_below && costPct <= stock.alerts.cost_pct_below) {
    alerts.push({
      code: stock.code,
      name: stock.name,
      type: 'cost_loss',
      severity: costPct <= -15 ? 'critical' : 'warning',
      title: '成本亏损预警',
      message: `${stock.name}(${stock.code}) 当前亏损 ${costPct.toFixed(2)}%，超过设定阈值 ${stock.alerts.cost_pct_below}%`,
      currentValue: costPct,
      thresholdValue: stock.alerts.cost_pct_below
    });
  }
  
  return alerts;
}

// 检查日内涨跌预警
function checkChangeAlerts(
  stock: StockAlertConfig,
  changePct: number
): AlertCheckResult[] {
  const alerts: AlertCheckResult[] = [];
  
  // 日内大涨预警
  if (stock.alerts.change_pct_above && changePct >= stock.alerts.change_pct_above) {
    alerts.push({
      code: stock.code,
      name: stock.name,
      type: 'intraday_rise',
      severity: 'info',
      title: '日内大涨预警',
      message: `${stock.name}(${stock.code}) 日内涨幅 ${changePct.toFixed(2)}%，超过设定阈值 ${stock.alerts.change_pct_above}%`,
      currentValue: changePct,
      thresholdValue: stock.alerts.change_pct_above
    });
  }
  
  // 日内大跌预警
  if (stock.alerts.change_pct_below && changePct <= stock.alerts.change_pct_below) {
    alerts.push({
      code: stock.code,
      name: stock.name,
      type: 'intraday_fall',
      severity: 'warning',
      title: '日内大跌预警',
      message: `${stock.name}(${stock.code}) 日内跌幅 ${changePct.toFixed(2)}%，超过设定阈值 ${stock.alerts.change_pct_below}%`,
      currentValue: changePct,
      thresholdValue: stock.alerts.change_pct_below
    });
  }
  
  return alerts;
}

// 检查成交量异动
function checkVolumeAlert(
  stock: StockAlertConfig,
  volume: number,
  avgVolume: number
): AlertCheckResult[] {
  const alerts: AlertCheckResult[] = [];
  
  if (!stock.alerts.volume_surge || avgVolume <= 0) return alerts;
  
  const surgeRatio = volume / avgVolume;
  
  if (surgeRatio >= stock.alerts.volume_surge) {
    alerts.push({
      code: stock.code,
      name: stock.name,
      type: 'volume_surge',
      severity: 'info',
      title: '成交量异动预警',
      message: `${stock.name}(${stock.code}) 成交量放大 ${surgeRatio.toFixed(2)} 倍，超过设定阈值 ${stock.alerts.volume_surge} 倍`,
      currentValue: surgeRatio,
      thresholdValue: stock.alerts.volume_surge
    });
  }
  
  return alerts;
}

// 检查个股的所有预警规则
export function checkStockAlerts(
  stock: StockAlertConfig,
  realtimeData: {
    current: number;
    changePct: number;
    volume: number;
    avgVolume?: number;
  }
): AlertCheckResult[] {
  const alerts: AlertCheckResult[] = [];
  
  // 成本预警
  alerts.push(...checkCostAlerts(stock, realtimeData.current));
  
  // 日内涨跌预警
  alerts.push(...checkChangeAlerts(stock, realtimeData.changePct));
  
  // 成交量预警
  if (realtimeData.avgVolume) {
    alerts.push(...checkVolumeAlert(stock, realtimeData.volume, realtimeData.avgVolume));
  }
  
  return alerts;
}

// 从数据库获取所有带预警配置的股票
export async function getStocksWithAlerts(): Promise<StockAlertConfig[]> {
  const stocks = await query<{
    code: string;
    name: string;
    cost: number;
    alerts_json: string;
  }>(`
    SELECT code, name, cost, alerts_json 
    FROM watchlist 
    WHERE alerts_json IS NOT NULL 
    AND alerts_json != '{}'
  `);
  
  return stocks.map(s => ({
    code: s.code,
    name: s.name,
    cost: s.cost,
    alerts: JSON.parse(s.alerts_json)
  }));
}

// 检查是否是交易时间（A股）
export function isTradingTime(): boolean {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;
  
  // 周一到周五
  if (now.getDay() === 0 || now.getDay() === 6) {
    return false;
  }
  
  // 9:30 - 11:30, 13:00 - 15:00
  const morningStart = 9 * 60 + 30;
  const morningEnd = 11 * 60 + 30;
  const afternoonStart = 13 * 60;
  const afternoonEnd = 15 * 60;
  
  return (time >= morningStart && time <= morningEnd) ||
         (time >= afternoonStart && time <= afternoonEnd);
}
