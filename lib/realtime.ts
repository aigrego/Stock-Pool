import { StockQuote } from './realtime-sources';

// 简单的实时行情获取（使用多源轮询）
export async function fetchRealtimeQuotes(codes: string[]): Promise<(StockQuote & { changePct: number; avgVolume?: number })[]> {
  if (codes.length === 0) return [];
  
  // 按市场分组
  const shCodes = codes.filter(c => c.match(/^\d{6}$/) && (c.startsWith('6') || c.startsWith('5') || c.startsWith('9')));
  const szCodes = codes.filter(c => c.match(/^\d{6}$/) && (c.startsWith('0') || c.startsWith('3') || c.startsWith('1') || c.startsWith('2')));
  const hkCodes = codes.filter(c => c.match(/^\d{4,5}$/));
  const usCodes = codes.filter(c => c.match(/^[A-Z]+$/));
  
  const quotes: (StockQuote & { changePct: number; avgVolume?: number })[] = [];
  
  try {
    // 尝试新浪数据源
    const sinaCodes = [
      ...shCodes.map(c => `sh${c}`),
      ...szCodes.map(c => `sz${c}`),
      ...hkCodes.map(c => `rt_hk${c}`),
      ...usCodes.map(c => `gb_${c.toLowerCase()}`)
    ];
    
    if (sinaCodes.length > 0) {
      const url = `https://hq.sinajs.cn/list=${sinaCodes.join(',')}`;
      const response = await fetch(url, {
        headers: {
          'Referer': 'https://finance.sina.com.cn',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.ok) {
        const text = await response.text();
        const lines = text.split(';');
        
        for (const line of lines) {
          const match = line.match(/var\s+hq_str_(\w+)="([^"]*)";/);
          if (!match || !match[2]) continue;
          
          const sinaCode = match[1];
          const parts = match[2].split(',');
          
          let code = sinaCode.replace(/^(sh|sz|rt_hk|gb_)/, '');
          if (sinaCode.startsWith('gb_')) code = code.toUpperCase();
          
          if (parts.length >= 3) {
            const name = parts[0];
            const current = parseFloat(parts[parts.length - 3]) || 0;
            const close = parseFloat(parts[2]) || current;
            const open = parseFloat(parts[1]) || close;
            const high = parseFloat(parts[4]) || current;
            const low = parseFloat(parts[5]) || current;
            const volume = parseInt(parts[8]) || 0;
            const amount = parseFloat(parts[9]) || 0;
            
            const changePct = close > 0 ? ((current - close) / close) * 100 : 0;
            
            quotes.push({
              code,
              name,
              current,
              open,
              close,
              high,
              low,
              volume,
              amount,
              bid1: parseFloat(parts[11]) || current,
              ask1: parseFloat(parts[21]) || current,
              changePct,
              timestamp: Date.now()
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to fetch realtime quotes:', error);
  }
  
  return quotes;
}
