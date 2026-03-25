import { NextResponse } from 'next/server';

// GET /api/health - 健康检查
export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 20) + '...',
      nodeEnv: process.env.NODE_ENV,
    }
  };
  
  return NextResponse.json(health);
}

export const dynamic = 'force-dynamic';
