# 📊 Shared Stock Pool - Tailscale 共享股票池

在 Tailnet 网络内共享股票池配置，提供 Web 管理界面和 REST API。

> 🆕 **新版 Web 界面**: `web/` 目录包含基于 Next.js + TiDB 的全新版本（推荐）

## 🏗️ 架构

```
┌─────────────────┐     Tailnet      ┌─────────────────┐
│   kimiclaw      │ ◄─────────────────│   livebook      │
│  100.111.204.29 │   HTTP/Web       │  100.91.86.110  │
│   (Server)      │                  │   (Client)      │
└─────────────────┘                  └─────────────────┘
        │
        ▼
┌─────────────────┐
│   Next.js 14    │ 
│   + Prisma ORM  │ ───► TiDB Serverless
│   + Recharts    │      (MySQL)
└─────────────────┘
```

## 📁 项目结构

```
shared-stockpool/
├── web/                   # 🆕 Next.js + Prisma + TiDB 新版
│   ├── app/              
│   │   ├── api/
│   │   │   ├── stocks/route.ts         # 股票 CRUD API
│   │   │   ├── stocks/[code]/route.ts  # 单个股票操作
│   │   │   ├── stocks/[code]/kline/route.ts  # K线数据
│   │   │   ├── stats/route.ts          # 统计数据
│   │   │   ├── realtime/route.ts       # 实时股价 (多源轮询)
│   │   │   └── alerts/                 # 预警系统
│   │   │       ├── check/route.ts
│   │   │       └── history/route.ts
│   │   ├── page.tsx        # 主页面
│   │   ├── layout.tsx      # 根布局
│   │   └── globals.css     # 暗黑主题
│   ├── components/
│   │   ├── ui/             # shadcn/ui 组件
│   │   ├── stock-chart.tsx # K线图表组件
│   │   └── stock-detail-modal.tsx
│   ├── lib/
│   │   ├── prisma.ts       # Prisma Client 封装
│   │   ├── db.ts           # 数据库导出
│   │   ├── alerts.ts       # 预警规则引擎
│   │   ├── feishu.ts       # 飞书推送服务
│   │   └── technical.ts    # 技术指标计算
│   ├── prisma/
│   │   └── schema.prisma   # Prisma Schema
│   ├── hooks/useRealtimeData.ts
│   └── README.md
├── server.py              # 原版 Python API (已弃用)
├── client.py              # Python 客户端库
└── stockpool.db           # SQLite (原版)
```

## 🚀 快速开始

### Next.js + Prisma + TiDB 新版

```bash
cd web

# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.local.example .env.local
# 编辑 .env.local，填入 TiDB 连接信息

# 3. 生成 Prisma Client
npx prisma generate

# 4. 推送到数据库（自动创建表）
npx prisma db push

# 5. 启动开发服务器
npm run dev
```

### Prisma 常用命令

```bash
# 生成 Client（schema 变更后执行）
npx prisma generate

# 推送 schema 到数据库（创建/更新表）
npx prisma db push

# 查看数据库（可选）
npx prisma studio
```

## 🖥️ Web 界面功能

### Stage 1: 基础管理
- 📊 **仪表盘** - 4 卡片统计布局
- 🔍 **搜索筛选** - 实时搜索 + 类型/市场筛选  
- ➕ **添加股票** - 弹窗表单，含预警配置
- ✏️ **编辑股票** - 点击编辑，数据回填
- 🗑️ **删除股票** - 确认删除

### Stage 2: 实时数据
- 📈 **实时股价** - 5秒轮询多源数据
- 🔄 **多数据源** - 新浪财经、腾讯、东方财富（故障自动切换）
- 💰 **持仓盈亏** - 实时计算成本vs现价盈亏
- 🔔 **浏览器通知** - 桌面提醒支持

### Stage 3: 预警系统
- ⚠️ **预警规则引擎** - 成本/日内涨跌/成交量监控
- 📨 **飞书推送** - 自动发送卡片消息
- 🕐 **定时检查** - Vercel Cron 每5分钟自动检查
- 📜 **预警历史** - 24小时内预警记录查询
- 🚫 **防重复** - 30分钟内相同预警不重复发送

### Stage 4: 技术分析
- 📉 **K线图** - 点击股票查看日K线走势
- 📊 **技术指标**:
  - MA (5/10/20/60日均线)
  - MACD (DIF/DEA/MACD)
  - RSI (6/12/24相对强弱指标)
  - 布林带 (上轨/中轨/下轨)
- 🔍 **形态识别** - 锤子线、十字星、吞没形态、三连阳/三连阴
- 📈 **图表切换** - K线/MACD/RSI 三种视图

## 📡 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/stocks` | 获取所有股票 |
| POST | `/api/stocks` | 创建股票 |
| PUT | `/api/stocks/{code}` | 更新股票 |
| DELETE | `/api/stocks/{code}` | 删除股票 |
| GET | `/api/stocks/{code}/kline` | 获取K线数据 |
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/realtime` | 获取实时股价 |
| GET | `/api/alerts/check` | 手动触发预警检查 |
| GET | `/api/alerts/history` | 获取预警历史 |

## 🛠️ 部署

### Vercel

```bash
cd web
vercel --prod
```

### 环境变量

支持两种配置方式（优先使用 `DATABASE_URL`）：

```bash
# 方式1: DATABASE_URL (推荐)
DATABASE_URL=mysql://user:password@host:port/stockpool?ssl=true

# 方式2: 分开配置（当 DATABASE_URL 不存在时使用）
DB_HOST=xxx.tidbcloud.com
DB_PORT=4000
DB_USER=xxx
DB_PASSWORD=xxx
DB_NAME=stockpool
TIDB_SSL=true

# 飞书推送 (可选)
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
```

### Vercel Cron 配置

已配置在 `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/alerts/check",
      "schedule": "*/5 * * * 1-5"
    }
  ]
}
```

---

## 📝 版本历史

- **v4.0** (2026-03-25) - Stage 4: K线图 + 技术指标 (MA/MACD/RSI/布林带) + 形态识别
- **v3.0** (2026-03-25) - Stage 3: 预警规则引擎 + 飞书推送
- **v2.0** (2026-03-25) - Stage 2: Next.js + TiDB + 多源实时数据
- **v1.0** (2026-03-25) - Stage 1: Python HTTP Server + SQLite
