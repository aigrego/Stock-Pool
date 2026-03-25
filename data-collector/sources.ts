/**
 * 数据源配置
 * 支持多个数据源，按优先级自动故障转移
 */

export interface DataSource {
  name: string;
  priority: number;
  fetch: (codes: string[]) => Promise<StockQuote[]>;
}

export interface StockQuote {
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

// 转换股票代码为各数据源格式
export function toSinaCode(code: string, market: string): string {
  if (market === 'hk') return `rt_hk${code}`;
  if (market === 'us') return `gb_${code.toLowerCase()}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  if (market === 'bj') return `bj${code}`;
  return code;
}

export function toTencentCode(code: string, market: string): string {
  if (market === 'hk') return `hk${code}`;
  if (market === 'us') return `us${code}`;
  if (market === 'sh') return `sh${code}`;
  if (market === 'sz') return `sz${code}`;
  if (market === 'bj') return `bj${code}`;
  return code;
}

export function toEastMoneyCode(code: string, market: string): string {
  // 东方财富格式：市场代码.股票代码
  if (market === 'sh') return `1.${code}`;
  if (market === 'sz') return `0.${code}`;
  if (market === 'hk') return `116.${code}`;
  if (market === 'us') return `105.${code}`;
  return code;
}

// 新浪财经数据源
export async function fetchFromSina(codes: string[]): Promise<StockQuote[]> {
  const url = `https://hq.sinajs.cn/list=${codes.join(',')}`;
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://finance.sina.com.cn',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const text = await response.text();
  const quotes: StockQuote[] = [];
  
  const lines = text.split(';');
  for (const line of lines) {
    const match = line.match(/var hq_str_(\w+)="([^"]+)"/);
    if (!match) continue;
    
    const [_, codeKey, dataStr] = match;
    if (!dataStr) continue;
    
    const parts = dataStr.split(',');
    if (parts.length < 5) continue;
    
    // 解析格式根据市场类型不同
    let quote: StockQuote;
    
    if (codeKey.startsWith('rt_hk')) {
      // 港股格式
      quote = {
        code: codeKey.replace('rt_hk', ''),
        name: parts[1],
        current: parseFloat(parts[6]) || 0,
        open: parseFloat(parts[2]) || 0,
        close: parseFloat(parts[3]) || 0,
        high: parseFloat(parts[4]) || 0,
        low: parseFloat(parts[5]) || 0,
        volume: parseInt(parts[12]) || 0,
        amount: 0,
        bid1: parseFloat(parts[9]) || 0,
        ask1: parseFloat(parts[10]) || 0,
        timestamp: Date.now()
      };
    } else if (codeKey.startsWith('gb_')) {
      // 美股格式
      quote = {
        code: codeKey.replace('gb_', '').toUpperCase(),
        name: parts[0],
        current: parseFloat(parts[1]) || 0,
        open: parseFloat(parts[5]) || 0,
        close: parseFloat(parts[26]) || 0,
        high: parseFloat(parts[6]) || 0,
        low: parseFloat(parts[7]) || 0,
        volume: parseInt(parts[10]) || 0,
        amount: 0,
        bid1: parseFloat(parts[21]) || 0,
        ask1: parseFloat(parts[11]) || 0,
        timestamp: Date.now()
      };
    } else {
      // A股格式
      quote = {
        code: codeKey.replace(/^(sh|sz|bj)/, ''),
        name: parts[0],
        current: parseFloat(parts[3]) || 0,
        open: parseFloat(parts[1]) || 0,
        close: parseFloat(parts[2]) || 0,
        high: parseFloat(parts[4]) || 0,
        low: parseFloat(parts[5]) || 0,
        volume: parseInt(parts[8]) || 0,
        amount: parseFloat(parts[9]) || 0,
        bid1: parseFloat(parts[11]) || 0,
        ask1: parseFloat(parts[21]) || 0,
        timestamp: Date.now()
      };
    }
    
    quotes.push(quote);
  }
  
  return quotes;
}

// 腾讯财经数据源
export async function fetchFromTencent(codes: string[]): Promise<StockQuote[]> {
  const url = `https://qt.gtimg.cn/q=${codes.join(',')}`;
  const response = await fetch(url);
  const text = await response.text();
  
  const quotes: StockQuote[] = [];
  const lines = text.split(';');
  
  for (const line of lines) {
    const match = line.match(/v_(\w+)="([^"]+)"/);
    if (!match) continue;
    
    const [_, codeKey, dataStr] = match;
    if (!dataStr) continue;
    
    const parts = dataStr.split('~');
    if (parts.length < 10) continue;
    
    const quote: StockQuote = {
      code: parts[2],
      name: parts[1],
      current: parseFloat(parts[3]) || 0,
      open: parseFloat(parts[5]) || 0,
      close: parseFloat(parts[4]) || 0,
      high: parseFloat(parts[33]) || 0,
      low: parseFloat(parts[34]) || 0,
      volume: parseInt(parts[36]) || 0,
      amount: parseFloat(parts[37]) || 0,
      bid1: parseFloat(parts[9]) || 0,
      ask1: parseFloat(parts[19]) || 0,
      timestamp: Date.now()
    };
    
    quotes.push(quote);
  }
  
  return quotes;
}

// 东方财富数据源
export async function fetchFromEastMoney(codes: string[]): Promise<StockQuote[]> {
  const fields = 'f43,f44,f45,f46,f47,f48,f50,f51,f52,f57,f58,f60,f169,f170';
  const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&invt=2&fields=${fields}&secids=${codes.join(',')}`;
  
  const response = await fetch(url, {
    headers: {
      'Referer': 'https://quote.eastmoney.com',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const data = await response.json() as { data?: { diff?: any[] } };
  const quotes: StockQuote[] = [];
  
  if (data.data?.diff) {
    for (const item of data.data.diff) {
      const quote: StockQuote = {
        code: item.f57,
        name: item.f58,
        current: item.f43 || 0,
        open: item.f46 || 0,
        close: item.f60 || 0,
        high: item.f44 || 0,
        low: item.f45 || 0,
        volume: item.f47 || 0,
        amount: item.f48 || 0,
        bid1: item.f50 || 0,
        ask1: item.f51 || 0,
        timestamp: Date.now()
      };
      quotes.push(quote);
    }
  }
  
  return quotes;
}

// 获取所有配置的数据源
export function getDataSources(): DataSource[] {
  const sources = process.env.DATA_SOURCES?.split(',') || ['sina', 'tencent', 'eastmoney'];
  
  const sourceMap: Record<string, DataSource> = {
    sina: { name: 'sina', priority: 1, fetch: fetchFromSina },
    tencent: { name: 'tencent', priority: 2, fetch: fetchFromTencent },
    eastmoney: { name: 'eastmoney', priority: 3, fetch: fetchFromEastMoney }
  };
  
  return sources
    .map(s => sourceMap[s.trim()])
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority);
}

// 多源抓取，自动故障转移
export async function fetchWithFailover(
  codes: string[],
  market: string
): Promise<{ quotes: StockQuote[]; source: string }> {
  const sources = getDataSources();
  
  for (const source of sources) {
    try {
      let formattedCodes: string[];
      
      if (source.name === 'sina') {
        formattedCodes = codes.map(c => toSinaCode(c, market));
      } else if (source.name === 'tencent') {
        formattedCodes = codes.map(c => toTencentCode(c, market));
      } else {
        formattedCodes = codes.map(c => toEastMoneyCode(c, market));
      }
      
      const quotes = await source.fetch(formattedCodes);
      
      if (quotes.length > 0) {
        return { quotes, source: source.name };
      }
    } catch (error) {
      console.warn(`[${source.name}] 抓取失败:`, error);
      continue;
    }
  }
  
  throw new Error('所有数据源均失败');
}
