import { NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';

let dbInitialized = false;

async function ensureDb() {
  if (!dbInitialized) {
    await initDb();
    dbInitialized = true;
  }
}

export async function GET() {
  try {
    await ensureDb();
    
    const [totalResult, positionResult, etfResult, hkUsResult] = await Promise.all([
      query<{ count: number }>('SELECT COUNT(*) as count FROM watchlist'),
      query<{ count: number }>('SELECT COUNT(*) as count FROM watchlist WHERE cost > 0'),
      query<{ count: number }>('SELECT COUNT(*) as count FROM watchlist WHERE type = "etf"'),
      query<{ count: number }>('SELECT COUNT(*) as count FROM watchlist WHERE market IN ("hk", "us")')
    ]);

    return NextResponse.json({
      success: true,
      data: {
        total: totalResult[0]?.count || 0,
        withPosition: positionResult[0]?.count || 0,
        etfs: etfResult[0]?.count || 0,
        hkUs: hkUsResult[0]?.count || 0
      }
    });
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
