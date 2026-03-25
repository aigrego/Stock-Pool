# 数据收集器 (Data Collector)

股票数据收集服务，定时从多个数据源抓取实时行情，通过 WebSocket 推送到股票管理系统。

## 功能

- 📡 **多数据源支持**: 新浪财经、腾讯财经、东方财富
- 🔄 **自动故障转移**: 主源失败时自动切换到备用源
- ⚡ **实时推送**: WebSocket 推送到股票管理系统
- 📝 **自动刷新股票池**: 每 5 分钟同步一次股票列表

## 安装

```bash
cd data-collector
npm install
```

## 配置

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATA_SOURCES` | 数据源优先级 | `sina,tencent,eastmoney` |
| `FETCH_INTERVAL` | 抓取间隔（秒） | `5` |
| `STOCK_API_URL` | 股票管理系统 API | `http://localhost:3000/api` |
| `WS_TARGET_URL` | WebSocket 目标地址 | `http://localhost:3000` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 启动

### 开发模式

```bash
npm run dev
```

### 生产模式

```bash
npm run build
node dist/collector.js
```

## 部署 (kimiclaw)

```bash
# 使用 pm2 守护进程
pm2 start dist/collector.js --name stock-collector

# 保存配置
pm2 save
pm2 startup
```

## 架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   kimiclaw      │ ────────────────── │   Vercel        │
│  (数据收集器)    │   推送实时行情      │   Next.js       │
│                 │                    │   Socket.io     │
└─────────────────┘                    └─────────────────┘
       │                                        │
       │ 抓取                                    │ 广播
       ▼                                        ▼
  [新浪/腾讯/东财]                         ┌─────────────────┐
                                          │   浏览器        │
                                          │   实时显示      │
                                          └─────────────────┘
```
