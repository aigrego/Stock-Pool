// 数据库配置 - 使用 Prisma ORM
// 支持 DATABASE_URL 格式: mysql://user:password@host:port/database?ssl=true

import { prisma, initDb as initPrismaDb, query as prismaQuery } from './prisma';

export { prisma };
export const initDb = initPrismaDb;
export const query = prismaQuery;
