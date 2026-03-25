import { NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';
import { Stock } from '@/types/stock';

// 确保数据库初始化
let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// GET /api/stocks - 获取所有股票
export async function GET() {
  try {
    await ensureDb();
    const stocks = await query<Stock>(`
      SELECT id, code, name, market, type, cost, alerts_json, created_at, updated_at 
      FROM watchlist 
      ORDER BY created_at DESC
    `);
    
    // 解析 alerts_json
    const parsedStocks = stocks.map(stock => ({
      ...stock,
      alerts: JSON.parse(stock.alerts_json as unknown as string || '{}')
    }));

    return NextResponse.json({ 
      success: true, 
      data: parsedStocks,
      count: parsedStocks.length 
    });
  } catch (error) {
    console.error('GET /api/stocks error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stocks' },
      { status: 500 }
    );
  }
}

// POST /api/stocks - 创建股票
export async function POST(request: Request) {
  try {
    await ensureDb();
    const body = await request.json();
    const { code, name, market, type, cost, alerts } = body;

    if (!code || !name || !market) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO watchlist (code, name, market, type, cost, alerts_json) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, market, type || 'individual', cost || 0, JSON.stringify(alerts || {})]
    );

    return NextResponse.json({ 
      success: true, 
      message: 'Stock created successfully' 
    });
  } catch (error: any) {
    console.error('POST /api/stocks error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, error: 'Stock code already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to create stock' },
      { status: 500 }
    );
  }
}
