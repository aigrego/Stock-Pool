import { NextResponse } from 'next/server';
import { prisma, initDb } from '@/lib/db';

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
  { params }: { params: { code: string } }
) {
  try {
    await ensureDb();
    const code = params.code;
    
    const stock = await prisma.watchlist.findUnique({
      where: { code }
    });
    
    if (!stock) {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: {
        ...stock,
        alerts: JSON.parse(stock.alertsJson || '{}')
      }
    });
    
  } catch (error) {
    console.error('Get stock error:', error);
    return NextResponse.json(
      { success: false, error: 'Database error' },
      { status: 500 }
    );
  }
}

// PUT /api/stocks/[code] - 更新股票
export async function PUT(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    await ensureDb();
    const code = params.code;
    const body = await request.json();
    
    const { name, market, type, cost, alerts } = body;
    
    const stock = await prisma.watchlist.update({
      where: { code },
      data: {
        ...(name && { name }),
        ...(market && { market }),
        ...(type && { type }),
        ...(cost !== undefined && { cost }),
        ...(alerts && { alertsJson: JSON.stringify(alerts) })
      }
    });
    
    // 记录日志
    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        code,
        details: `Updated stock: ${stock.name}`,
        agentId: 'web-ui'
      }
    });
    
    return NextResponse.json({
      success: true,
      data: {
        ...stock,
        alerts: JSON.parse(stock.alertsJson || '{}')
      }
    });
    
  } catch (error: any) {
    console.error('Update stock error:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to update stock' },
      { status: 500 }
    );
  }
}

// DELETE /api/stocks/[code] - 删除股票
export async function DELETE(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    await ensureDb();
    const code = params.code;
    
    const stock = await prisma.watchlist.delete({
      where: { code }
    });
    
    // 记录日志
    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        code,
        details: `Deleted stock: ${stock.name}`,
        agentId: 'web-ui'
      }
    });
    
    return NextResponse.json({
      success: true,
      message: 'Stock deleted successfully'
    });
    
  } catch (error: any) {
    console.error('Delete stock error:', error);
    if (error.code === 'P2025') {
      return NextResponse.json(
        { success: false, error: 'Stock not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Failed to delete stock' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
