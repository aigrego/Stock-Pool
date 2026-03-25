export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface MAData {
  date: string;
  ma5?: number;
  ma10?: number;
  ma20?: number;
  ma60?: number;
}

export interface MACDData {
  date: string;
  dif: number;
  dea: number;
  macd: number;
}

export interface RSIData {
  date: string;
  rsi6: number;
  rsi12: number;
  rsi24: number;
}

export interface BollingerData {
  date: string;
  upper: number;
  middle: number;
  lower: number;
}

export interface VolumeData {
  date: string;
  volume: number;
  ma5?: number;
}

// 计算移动平均线 MA
export function calculateMA(data: KLineData[], period: number): (number | undefined)[] {
  const result: (number | undefined)[] = [];
  
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(undefined);
      continue;
    }
    
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push(parseFloat((sum / period).toFixed(3)));
  }
  
  return result;
}

// 计算多条均线
export function calculateMAs(data: KLineData[]): MAData[] {
  const ma5 = calculateMA(data, 5);
  const ma10 = calculateMA(data, 10);
  const ma20 = calculateMA(data, 20);
  const ma60 = calculateMA(data, 60);
  
  return data.map((item, i) => ({
    date: item.date,
    ma5: ma5[i],
    ma10: ma10[i],
    ma20: ma20[i],
    ma60: ma60[i]
  }));
}

// 计算 MACD
// DIF = EMA(12) - EMA(26)
// DEA = EMA(9) of DIF
// MACD = 2 * (DIF - DEA)
export function calculateMACD(data: KLineData[]): MACDData[] {
  if (data.length < 26) return [];
  
  const closes = data.map(d => d.close);
  
  // 计算 EMA
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  
  // DIF
  const dif = ema12.map((ema, i) => 
    ema !== undefined && ema26[i] !== undefined 
      ? parseFloat((ema - ema26[i]!).toFixed(4)) 
      : undefined
  );
  
  // DEA (DIF 的 9 日 EMA)
  const validDif = dif.filter((v): v is number => v !== undefined);
  const deaValues = calculateEMA(validDif, 9);
  
  // 补齐前面的 undefined
  const dea: (number | undefined)[] = Array(dif.filter(v => v === undefined).length).fill(undefined);
  dea.push(...deaValues);
  
  // MACD
  const result: MACDData[] = [];
  for (let i = 0; i < data.length; i++) {
    if (dif[i] !== undefined && dea[i] !== undefined) {
      const macd = parseFloat((2 * (dif[i]! - dea[i]!)).toFixed(4));
      result.push({
        date: data[i].date,
        dif: dif[i]!,
        dea: dea[i]!,
        macd
      });
    }
  }
  
  return result;
}

// 计算 EMA
function calculateEMA(data: number[], period: number): number[] {
  const multiplier = 2 / (period + 1);
  const result: number[] = [];
  
  // 第一个 EMA 用 SMA
  let sum = 0;
  for (let i = 0; i < Math.min(period, data.length); i++) {
    sum += data[i];
  }
  result.push(sum / Math.min(period, data.length));
  
  // 后续用 EMA 公式
  for (let i = 1; i < data.length; i++) {
    const ema = (data[i] - result[i - 1]) * multiplier + result[i - 1];
    result.push(parseFloat(ema.toFixed(4)));
  }
  
  return result;
}

// 计算 RSI
export function calculateRSI(data: KLineData[], period: number = 14): RSIData[] {
  if (data.length < period + 1) return [];
  
  const result: RSIData[] = [];
  let gains = 0;
  let losses = 0;
  
  // 计算初始平均涨跌
  for (let i = 1; i <= period; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // 第一个 RSI
  let rs = avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  
  result.push({
    date: data[period].date,
    rsi6: rsi,
    rsi12: rsi,
    rsi24: rsi
  });
  
  // 后续 RSI 用平滑公式
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    
    result.push({
      date: data[i].date,
      rsi6: parseFloat(rsi.toFixed(2)),
      rsi12: parseFloat(rsi.toFixed(2)),
      rsi24: parseFloat(rsi.toFixed(2))
    });
  }
  
  return result;
}

// 计算布林带
export function calculateBollinger(data: KLineData[], period: number = 20, multiplier: number = 2): BollingerData[] {
  if (data.length < period) return [];
  
  const result: BollingerData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    // 计算中轨 (MA20)
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const middle = sum / period;
    
    // 计算标准差
    let variance = 0;
    for (let j = 0; j < period; j++) {
      variance += Math.pow(data[i - j].close - middle, 2);
    }
    const stdDev = Math.sqrt(variance / period);
    
    result.push({
      date: data[i].date,
      upper: parseFloat((middle + multiplier * stdDev).toFixed(3)),
      middle: parseFloat(middle.toFixed(3)),
      lower: parseFloat((middle - multiplier * stdDev).toFixed(3))
    });
  }
  
  return result;
}

// 计算成交量均线
export function calculateVolumeMA(data: KLineData[], period: number = 5): VolumeData[] {
  const result: VolumeData[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const item: VolumeData = {
      date: data[i].date,
      volume: data[i].volume
    };
    
    if (i >= period - 1) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].volume;
      }
      item.ma5 = Math.round(sum / period);
    }
    
    result.push(item);
  }
  
  return result;
}

// 识别K线形态
export function detectPatterns(data: KLineData[]): { date: string; pattern: string; significance: 'high' | 'medium' | 'low' }[] {
  const patterns: { date: string; pattern: string; significance: 'high' | 'medium' | 'low' }[] = [];
  
  for (let i = 2; i < data.length; i++) {
    const current = data[i];
    const prev = data[i - 1];
    const prev2 = data[i - 2];
    
    // 锤子线
    const bodySize = Math.abs(current.close - current.open);
    const lowerShadow = Math.min(current.open, current.close) - current.low;
    const upperShadow = current.high - Math.max(current.open, current.close);
    
    if (lowerShadow > bodySize * 2 && upperShadow < bodySize) {
      patterns.push({
        date: current.date,
        pattern: '锤子线',
        significance: 'medium'
      });
    }
    
    // 十字星
    if (bodySize <= (current.high - current.low) * 0.1) {
      patterns.push({
        date: current.date,
        pattern: '十字星',
        significance: 'low'
      });
    }
    
    // 吞没形态
    const prevBodySize = Math.abs(prev.close - prev.open);
    if (bodySize > prevBodySize * 1.5) {
      if (current.close > current.open && prev.close < prev.open) {
        patterns.push({
          date: current.date,
          pattern: '看涨吞没',
          significance: 'high'
        });
      } else if (current.close < current.open && prev.close > prev.open) {
        patterns.push({
          date: current.date,
          pattern: '看跌吞没',
          significance: 'high'
        });
      }
    }
    
    // 三连阳/三连阴
    if (current.close > current.open && 
        prev.close > prev.open && 
        prev2.close > prev2.open) {
      patterns.push({
        date: current.date,
        pattern: '三连阳',
        significance: 'medium'
      });
    } else if (current.close < current.open && 
               prev.close < prev.open && 
               prev2.close < prev2.open) {
      patterns.push({
        date: current.date,
        pattern: '三连阴',
        significance: 'medium'
      });
    }
  }
  
  return patterns;
}

// 获取完整技术指标
export function calculateAllIndicators(data: KLineData[]) {
  return {
    kline: data,
    ma: calculateMAs(data),
    macd: calculateMACD(data),
    rsi: calculateRSI(data),
    bollinger: calculateBollinger(data),
    volume: calculateVolumeMA(data),
    patterns: detectPatterns(data)
  };
}
