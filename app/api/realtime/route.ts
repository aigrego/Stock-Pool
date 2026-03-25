import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 新浪财经 API 数据接口
interface StockData {
  name: string;
  open: number;
  close: number;
  current: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  changePct: number;
  source: string;
}

// 转换股票代码为各平台格式
function toSinaCode(code: string, market: string): string {
  if (market === 'hk') return `rt_hk${code}`;
  if (market === 'us') return `gb_${code.toLowerCase()}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  if (market === 'bj') return `bj${code}`;
  return code;
}

function toTencentCode(code: string, market: string): string {
  if (market === 'hk') return `hk${code}`;
  if (market === 'us') return `us${code}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  return code;
}

function toEastMoneyCode(code: string, market: string): string {
  // 东方财富格式：市场.代码
  const marketMap: Record<string, string> = {
    'sh': '1', 'sz': '0', 'bj': '0', 'hk': '116', 'us': '105'
  };
  return `${marketMap[market] || '1'}.${code}`;
}

// 数据源 1: 新浪财经
async function fetchFromSina(codes: string[], markets: string[]): Promise<Record<string, StockData>> {
  const sinaCodes = codes.map((code, i) => toSinaCode(code, markets[i]));
  const url = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}`;

  const response = await fetch(url, {
    headers: {
      'Referer': 'https://finance.sina.com.cn',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) throw new Error(`Sina error: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const text = new TextDecoder('gb2312').decode(buffer);
  
  const result: Record<string, StockData> = {};
  
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
      open: parseFloat(parts[1]),
      close,
      current,
      high: parseFloat(parts[4]),
      low: parseFloat(parts[5]),
      volume: parseInt(parts[8]),
      amount: parseFloat(parts[9]),
      changePct: close > 0 ? Math.round((current - close) / close * 10000) / 100 : 0,
      source: 'sina'
    };
  }

  return result;
}

// 数据源 2: 腾讯财经
async function fetchFromTencent(codes: string[], markets: string[]): Promise<Record<string, StockData>> {
  const tencentCodes = codes.map((code, i) => toTencentCode(code, markets[i]));
  const url = `https://qt.gtimg.cn/q=${tencentCodes.join(',')}`;

  const response = await fetch(url, {
    headers: {
      'Referer': 'https://stock.qq.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) throw new Error(`Tencent error: ${response.status}`);

  const buffer = await response.arrayBuffer();
  const text = new TextDecoder('gb2312').decode(buffer);
  
  const result: Record<string, StockData> = {};
  
  for (const line of text.split(';')) {
    if (!line.includes('=')) continue;
    
    const [keyPart, valuePart] = line.split('=');
    const codeKey = keyPart.split('_').pop()?.replace(/^(sh|sz|hk|us)/, '');
    const dataStr = valuePart?.trim().replace(/["]/g, '');
    
    if (!codeKey || !dataStr) continue;
    const parts = dataStr.split('~');
    if (parts.length < 45) continue;

    const code = codeKey.toUpperCase();
    // 腾讯格式: name~code~close~open~current...changePct
    const current = parseFloat(parts[3]);
    const close = parseFloat(parts[2]);
    
    result[code] = {
      name: parts[1] || parts[0],
      open: parseFloat(parts[5]),
      close,
      current,
      high: parseFloat(parts[33]),
      low: parseFloat(parts[34]),
      volume: parseInt(parts[36]),
      amount: parseFloat(parts[37]),
      changePct: parseFloat(parts[32]) || (close > 0 ? Math.round((current - close) / close * 10000) / 100 : 0),
      source: 'tencent'
    };
  }

  return result;
}

// 数据源 3: 东方财富
async function fetchFromEastMoney(codes: string[], markets: string[]): Promise<Record<string, StockData>> {
  const emCodes = codes.map((code, i) => toEastMoneyCode(code, markets[i]));
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3,f4,f5,f6,f17,f18,f15,f16&secids=${emCodes.join(',')}`;

  const response = await fetch(url, {
    headers: {
      'Referer': 'https://quote.eastmoney.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) throw new Error(`EastMoney error: ${response.status}`);

  const json = await response.json();
  
  if (!json.data?.diff) throw new Error('EastMoney invalid response');

  const result: Record<string, StockData> = {};
  
  for (const item of json.data.diff) {
    const code = item.f12;  // 股票代码
    const market = item.f13; // 市场
    const current = item.f2;  // 当前价
    const close = item.f18;   // 昨收
    
    if (!code || current === '-') continue;
    
    result[code] = {
      name: item.f14,
      open: item.f17,
      close,
      current,
      high: item.f15,
      low: item.f16,
      volume: item.f5,
      amount: item.f6,
      changePct: item.f3,
      source: 'eastmoney'
    };
  }

  return result;
}

// 主数据获取函数 - 带失败重试和多源切换
async function fetchRealtimeData(codes: string[], markets: string[]): Promise<Record<string, StockData>> {
  const sources = [
    { name: 'sina', fetch: fetchFromSina },
    { name: 'tencent', fetch: fetchFromTencent },
    { name: 'eastmoney', fetch: fetchFromEastMoney }
  ];

  let lastError: Error | null = null;

  for (const source of sources) {
    try {
      console.log(`Trying data source: ${source.name}`);
      const data = await source.fetch(codes, markets);
      
      // 检查是否有有效数据返回
      const validCodes = Object.keys(data).length;
      if (validCodes > 0) {
        console.log(`✅ Data source ${source.name} returned ${validCodes} stocks`);
        return data;
      }
      
      console.warn(`⚠️ Data source ${source.name} returned empty`);
    } catch (error) {
      console.warn(`❌ Data source ${source.name} failed:`, error);
      lastError = error as Error;
    }
  }

  throw lastError || new Error('All data sources failed');
}

// GET /api/realtime - 获取实时股价
export async function GET() {
  try {
    // 获取所有股票代码
    const stocks = await query<{ code: string; market: string; cost: number }>(
      'SELECT code, market, cost FROM watchlist'
    );

    if (stocks.length === 0) {
      return NextResponse.json({ success: true, data: {} });
    }

    // 批量获取实时数据
    const codes = stocks.map(s => s.code);
    const markets = stocks.map(s => s.market);
    
    let realtimeData: Record<string, StockData>;
    
    try {
      realtimeData = await fetchRealtimeData(codes, markets);
    } catch (error) {
      console.error('All data sources failed:', error);
      return NextResponse.json(
        { success: false, error: 'All data sources failed', details: (error as Error).message },
        { status: 503 }
      );
    }

    // 合并持仓数据并计算盈亏
    const enrichedData: Record<string, any> = {};
    
    for (const stock of stocks) {
      const sourceData = realtimeData[stock.code];
      
      if (sourceData) {
        const pnlPct = stock.cost > 0 && sourceData.current > 0
          ? Math.round((sourceData.current - stock.cost) / stock.cost * 10000) / 100
          : 0;
        
        const pnlAmount = stock.cost > 0 
          ? Math.round((sourceData.current - stock.cost) * 100) / 100
          : 0;

        enrichedData[stock.code] = {
          ...sourceData,
          code: stock.code,
          pnlPct,
          pnlAmount,
          cost: stock.cost
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: enrichedData,
      meta: {
        source: Object.values(realtimeData)[0]?.source || 'unknown',
        count: Object.keys(enrichedData).length,
        total: stocks.length
      },
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('GET /api/realtime error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch realtime data' },
      { status: 500 }
    );
  }
}

// 配置 - 禁用缓存
export const revalidate = 0;
export const dynamic = 'force-dynamic';
