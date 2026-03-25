/**
 * 股票管理系统 API 客户端
 * 用于获取股票池和更新数据
 */

export interface Stock {
  id: number;
  code: string;
  name: string;
  market: string;
  type: string;
  cost: number;
  alertsJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockStats {
  total: number;
  sh: number;
  sz: number;
  hk: number;
  us: number;
  bj: number;
  fx: number;
  individual: number;
  etf: number;
  gold: number;
}

const BASE_URL = process.env.STOCK_API_URL || 'http://localhost:3000/api';

// 获取所有股票
export async function getStocks(): Promise<Stock[]> {
  const response = await fetch(`${BASE_URL}/stocks`);
  if (!response.ok) throw new Error(`获取股票失败: ${response.status}`);
  const data = await response.json() as { success?: boolean; data?: Stock[] };
  if (data.success && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

// 获取统计数据
export async function getStats(): Promise<StockStats> {
  const response = await fetch(`${BASE_URL}/stats`);
  if (!response.ok) throw new Error(`获取统计失败: ${response.status}`);
  const data = await response.json() as { success?: boolean; data?: StockStats };
  if (data.success && data.data) {
    return data.data;
  }
  return { total: 0, sh: 0, sz: 0, hk: 0, us: 0, bj: 0, fx: 0, individual: 0, etf: 0, gold: 0 };
}

// 更新股票成本价（通过 API）
export async function updateStock(code: string, data: Partial<Stock>): Promise<void> {
  const response = await fetch(`${BASE_URL}/stocks/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`更新股票失败: ${response.status}`);
}

// 添加股票
export async function addStock(stock: Omit<Stock, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
  const response = await fetch(`${BASE_URL}/stocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stock)
  });
  if (!response.ok) throw new Error(`添加股票失败: ${response.status}`);
}

// 删除股票
export async function deleteStock(code: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/stocks/${code}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error(`删除股票失败: ${response.status}`);
}
