import { NextResponse } from 'next/server';
import { prisma, initDb } from '@/lib/db';
import { checkStockAlerts } from '@/lib/alerts';
import { pushAlertsToFeishu } from '@/lib/feishu';
import { fetchRealtimeQuotes } from '@/lib/realtime';

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

// GET /api/alerts/check - 检查预警
export async function GET(request: Request) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    const noFeishu = searchParams.get('nofeishu') === 'true';
    
    // 获取所有股票
    const stocks = await prisma.watchlist.findMany();
    
    // 获取实时行情
    const codes = stocks.map(s => s.code);
    const realtimeQuotes = await fetchRealtimeQuotes(codes);
    
    const triggeredAlerts: any[] = [];
    
    // 检查每只股票的预警
    for (const stock of stocks) {
      const quote = realtimeQuotes.find(q => q.code === stock.code);
      if (!quote) continue;
      
      const alerts = JSON.parse(stock.alertsJson || '{}');
      if (Object.keys(alerts).length === 0) continue;
      
      const stockConfig = {
        code: stock.code,
        name: stock.name,
        cost: stock.cost,
        alerts
      };
      
      const stockAlerts = checkStockAlerts(stockConfig, {
        current: quote.current,
        changePct: quote.changePct,
        volume: quote.volume,
        avgVolume: quote.avgVolume
      });
      
      triggeredAlerts.push(...stockAlerts);
    }
    
    // 保存到数据库
    for (const alert of triggeredAlerts) {
      await prisma.alertHistory.create({
        data: {
          code: alert.code,
          alertType: alert.type,
          severity: alert.severity,
          message: alert.message,
          currentValue: alert.currentValue,
          thresholdValue: alert.thresholdValue
        }
      });
    }
    
    // 推送飞书
    let feishuSent = false;
    if (!noFeishu && triggeredAlerts.length > 0) {
      const feishuResult = await pushAlertsToFeishu(triggeredAlerts);
      feishuSent = feishuResult.sent;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        alertsFound: triggeredAlerts.length,
        alerts: triggeredAlerts,
        feishuSent,
        force
      }
    });
    
  } catch (error) {
    console.error('Alert check error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check alerts' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
