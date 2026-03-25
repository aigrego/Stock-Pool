import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/alerts/history - 获取预警历史
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const limit = parseInt(searchParams.get('limit') || '50');
    const hours = parseInt(searchParams.get('hours') || '24');
    
    let sql = `
      SELECT 
        h.*,
        w.name as stock_name,
        w.market
      FROM alert_history h
      LEFT JOIN watchlist w ON h.code = w.code
      WHERE h.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;
    
    const params: any[] = [hours];
    
    if (code) {
      sql += ' AND h.code = ?';
      params.push(code);
    }
    
    sql += ' ORDER BY h.created_at DESC LIMIT ?';
    params.push(limit);
    
    const history = await query(sql, params);
    
    return NextResponse.json({
      success: true,
      data: history,
      count: history.length
    });
    
  } catch (error) {
    console.error('Alert history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch alert history' },
      { status: 500 }
    );
  }
}

// DELETE /api/alerts/history - 清理旧预警历史
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    
    await query(
      'DELETE FROM alert_history WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    
    return NextResponse.json({
      success: true,
      message: `Alert history older than ${days} days cleaned`
    });
    
  } catch (error) {
    console.error('Clean alert history error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to clean alert history' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
