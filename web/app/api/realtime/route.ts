import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// 新浪财经 API 数据接口
interface SinaStockData {
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
  date: string;
  time: string;
}

// 转换股票代码为新浪格式
function toSinaCode(code: string, market: string): string {
  if (market === 'hk') return `hk${code}`;
  if (market === 'us') return `gb_${code.toLowerCase()}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  if (market === 'bj') return `bj${code}`;
  return code;
}

// 从新浪获取实时数据
async function fetchSinaData(codes: string[], markets: string[]): Promise<Record<string, SinaStockData>> {
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

    if (!response.ok) {
      throw new Error(`Sina API error: ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const text = new TextDecoder('gb2312').decode(buffer);
    
    const result: Record<string, SinaStockData> = {};
    const lines = text.split('\n');

    for (const line of lines) {
      if (!line.includes('=')) continue;
      
      const [keyPart, valuePart] = line.split('=');
      const codeKey = keyPart.split('_').pop()?.replace(/^(sh|sz|hk|bj|gb_)/, '');
      const dataStr = valuePart?.trim().replace(/[";]/g, '');
      
      if (!codeKey || !dataStr) continue;

      const parts = dataStr.split(',');
      if (parts.length < 33) continue;

      const code = codeKey.toUpperCase();
      result[code] = {
        name: parts[0],
        open: parseFloat(parts[1]),
        close: parseFloat(parts[2]),
        current: parseFloat(parts[3]),
        high: parseFloat(parts[4]),
        low: parseFloat(parts[5]),
        volume: parseInt(parts[8]),
        amount: parseFloat(parts[9]),
        bid1: parseFloat(parts[11]),
        ask1: parseFloat(parts[21]),
        date: parts[30],
        time: parts[31]
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to fetch Sina data:', error);
    return {};
  }
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

    // 批量获取新浪数据
    const codes = stocks.map(s => s.code);
    const markets = stocks.map(s => s.market);
    const realtimeData = await fetchSinaData(codes, markets);

    // 合并持仓数据并计算盈亏
    const enrichedData: Record<string, any> = {};
    
    for (const stock of stocks) {
      const sinaData = realtimeData[stock.code];
      
      if (sinaData) {
        const changePct = sinaData.close > 0 
          ? ((sinaData.current - sinaData.close) / sinaData.close * 100)
          : 0;
        
        const pnlPct = stock.cost > 0 && sinaData.current > 0
          ? ((sinaData.current - stock.cost) / stock.cost * 100)
          : 0;
        
        const pnlAmount = stock.cost > 0 
          ? (sinaData.current - stock.cost)
          : 0;

        enrichedData[stock.code] = {
          ...sinaData,
          code: stock.code,
          changePct: Math.round(changePct * 100) / 100,
          pnlPct: Math.round(pnlPct * 100) / 100,
          pnlAmount: Math.round(pnlAmount * 100) / 100,
          cost: stock.cost
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: enrichedData,
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

// 配置缓存策略 - 5秒刷新
export const revalidate = 0;
export const dynamic = 'force-dynamic';
