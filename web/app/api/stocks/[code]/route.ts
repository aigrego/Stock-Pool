import { NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// GET /api/stocks/[code] - 获取单个股票
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureDb();
    const { code } = await params;
    
    const stocks = await query(
      `SELECT * FROM watchlist WHERE code = ?`,
      [code]
    );

    if (stocks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      );
    }

    const stock = stocks[0];
    return NextResponse.json({
      success: true,
      data: {
        ...stock,
        alerts: JSON.parse(stock.alerts_json || '{}')
      }
    });
  } catch (error) {
    console.error('GET /api/stocks/[code] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stock' },
      { status: 500 }
    );
  }
}

// PUT /api/stocks/[code] - 更新股票
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureDb();
    const { code } = await params;
    const body = await request.json();
    const { name, market, type, cost, alerts } = body;

    await query(
      `UPDATE watchlist 
       SET name = ?, market = ?, type = ?, cost = ?, alerts_json = ?
       WHERE code = ?`,
      [name, market, type, cost, JSON.stringify(alerts), code]
    );

    return NextResponse.json({
      success: true,
      message: 'Stock updated successfully'
    });
  } catch (error) {
    console.error('PUT /api/stocks/[code] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update stock' },
      { status: 500 }
    );
  }
}

// DELETE /api/stocks/[code] - 删除股票
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    await ensureDb();
    const { code } = await params;

    await query(`DELETE FROM watchlist WHERE code = ?`, [code]);

    return NextResponse.json({
      success: true,
      message: 'Stock deleted successfully'
    });
  } catch (error) {
    console.error('DELETE /api/stocks/[code] error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete stock' },
      { status: 500 }
    );
  }
}
