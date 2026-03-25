import { NextResponse } from 'next/server';
import { prisma, initDb } from '@/lib/db';

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
    
    const stocks = await prisma.watchlist.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    // 解析 alertsJson
    const parsedStocks = stocks.map(stock => ({
      ...stock,
      alerts: JSON.parse(stock.alertsJson || '{}')
    }));
    
    return NextResponse.json({ success: true, data: parsedStocks });
    
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
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
    
    const stock = await prisma.watchlist.create({
      data: {
        code,
        name,
        market,
        type: type || 'individual',
        cost: cost || 0,
        alertsJson: JSON.stringify(alerts || {})
      }
    });
    
    // 记录日志
    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        code,
        details: `Created stock: ${name} (${code})`,
        agentId: 'web-ui'
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      data: { ...stock, alerts: JSON.parse(stock.alertsJson) }
    });
    
  } catch (error: any) {
    console.error('Create stock error:', error);
    if (error.code === 'P2002') {
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

export const dynamic = 'force-dynamic';
