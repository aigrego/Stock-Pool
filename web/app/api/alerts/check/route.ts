import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { 
  checkStockAlerts, 
  getStocksWithAlerts, 
  isTradingTime,
  AlertCheckResult 
} from '@/lib/alerts';
import { pushAlertsToFeishu, initAlertHistoryTable } from '@/lib/feishu';

// 转换股票代码为新浪财经格式
function toSinaCode(code: string, market: string): string {
  if (market === 'hk') return `rt_hk${code}`;
  if (market === 'us') return `gb_${code.toLowerCase()}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  return code;
}

// 批量获取实时数据
async function fetchRealtimeData(
  codes: string[],
  markets: string[]
): Promise<Record<string, { current: number; changePct: number; volume: number; name: string }>> {
  if (codes.length === 0) return {};

  const sinaCodes = codes.map((code, i) => toSinaCode(code, markets[i]));
  const url = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`Sina error: ${response.status}`);

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder('gb2312').decode(buffer);
    
    const result: Record<string, any> = {};
    
    for (const line of text.split('\n')) {
      if (!line.includes('=')) continue;
      
      const [keyPart, valuePart] = line.split('=');
      const codeKey = keyPart.split('_').pop()?.replace(/^(sh|sz|hk|bj|rt_hk|gb_)/, '');
      const dataStr = valuePart?.trim().replace(/[";]/g, '');
      
      if (!codeKey || !dataStr) continue;
      const parts = dataStr.split(',');
      if (parts.length < 33) continue;

      const code = codeKey.toUpperCase();
      const current = parseFloat(parts[3]);
      const close = parseFloat(parts[2]);
      
      result[code] = {
        name: parts[0],
        current,
        changePct: close > 0 ? Math.round((current - close) / close * 10000) / 100 : 0,
        volume: parseInt(parts[8])
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch realtime data:', error);
    return {};
  }
}

// GET /api/alerts/check - 手动触发预警检查
export async function GET(request: Request) {
  try {
    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const skipTradingCheck = searchParams.get('force') === 'true';
    const skipFeishu = searchParams.get('nofeishu') === 'true';
    
    // 检查是否在交易时间（除非强制检查）
    if (!skipTradingCheck && !isTradingTime()) {
      return NextResponse.json({
        success: true,
        message: 'Not in trading hours, skipping alert check',
        isTradingTime: false,
        alerts: []
      });
    }
    
    // 初始化表
    await initAlertHistoryTable();
    
    // 获取带预警配置的股票
    const stocks = await getStocksWithAlerts();
    
    if (stocks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No stocks with alert configuration',
        alerts: []
      });
    }
    
    // 获取实时数据
    const codes = stocks.map(s => s.code);
    const markets = await query<{ code: string; market: string }>('SELECT code, market FROM watchlist WHERE code IN (?)', [codes]);
    const marketMap = Object.fromEntries(markets.map(m => [m.code, m.market]));
    
    const realtimeData = await fetchRealtimeData(
      codes,
      codes.map(c => marketMap[c] || 'sh')
    );
    
    // 检查预警
    const allAlerts: AlertCheckResult[] = [];
    
    for (const stock of stocks) {
      const data = realtimeData[stock.code];
      if (!data) continue;
      
      const alerts = checkStockAlerts(stock, {
        current: data.current,
        changePct: data.changePct,
        volume: data.volume
      });
      
      allAlerts.push(...alerts);
    }
    
    // 推送到飞书
    let feishuResult = { sent: false, count: 0 };
    if (!skipFeishu && allAlerts.length > 0) {
      feishuResult = await pushAlertsToFeishu(allAlerts, {
        skipDuplicate: true,
        duplicateMinutes: 30
      });
    }
    
    return NextResponse.json({
      success: true,
      isTradingTime: true,
      stocksChecked: stocks.length,
      alertsFound: allAlerts.length,
      alerts: allAlerts,
      feishu: feishuResult
    });
    
  } catch (error) {
    console.error('Alert check error:', error);
    return NextResponse.json(
      { success: false, error: 'Alert check failed', details: (error as Error).message },
      { status: 500 }
    );
  }
}

// 配置 - 支持 Vercel Cron
export const dynamic = 'force-dynamic';
