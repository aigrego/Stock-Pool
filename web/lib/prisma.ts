import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 初始化数据库（创建表）
export async function initDb() {
  try {
    // Prisma 会自动根据 schema 创建表
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

// 保持向后兼容的 query 函数
export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const result = await prisma.$queryRawUnsafe<T>(sql, ...(params || []));
  return Array.isArray(result) ? result : [result];
}
