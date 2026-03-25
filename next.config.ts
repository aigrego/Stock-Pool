import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel 部署配置
  output: 'standalone',
  
  // 图片优化配置
  images: {
    unoptimized: true,
  },
  
  // 环境变量验证（可选，用于构建时检查）
  env: {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_NAME: process.env.DB_NAME,
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || 'http://100.111.204.29:3001',
  },
};

export default nextConfig;
