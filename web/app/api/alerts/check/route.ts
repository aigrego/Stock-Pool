import { NextResponse } from 'next/server';
import { prisma, initDb } from '@/lib/db';
import { checkStockAlerts } from '@/lib/alerts';
import { pushAlertsToFeishu } from '@/lib/feishu';

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
    
    // 解析 alertsJson
    const parsedStocks = stocks.map(s => ({
      ...s,
      alerts: JSON.parse(s.alertsJson || '{}')
    }));
    
    // 检查预警
    const triggeredAlerts = await checkStockAlerts(parsedStocks);
    
    // 保存到数据库（去重逻辑在 checkStockAlerts 中处理）
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
    let feishuResult = null;
    if (!noFeishu && triggeredAlerts.length > 0) {
      feishuResult = await pushAlertsToFeishu(triggeredAlerts);
    }
    
    return NextResponse.json({
      success: true,
      data: {
        alertsFound: triggeredAlerts.length,
        alerts: triggeredAlerts,
        feishuPushed: !noFeishu && feishuResult?.success,
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
