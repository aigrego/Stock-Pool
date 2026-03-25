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
│   Next.js       │ 
│   Web UI + API  │ ───► TiDB Serverless
│                 │      (MySQL)
└─────────────────┘
```

## 📁 项目结构

```
shared-stockpool/
├── web/                   # 🆕 Next.js + TiDB 新版 (推荐)
│   ├── app/              
│   │   ├── api/
│   │   │   ├── stocks/route.ts      # 股票 CRUD API
│   │   │   ├── stocks/[code]/route.ts  # 单个股票操作
│   │   │   ├── stats/route.ts       # 统计数据
│   │   │   ├── realtime/route.ts    # 实时股价 (多源轮询)
│   │   │   └── alerts/              # 预警系统
│   │   │       ├── check/route.ts   # 预警检查
│   │   │       └── history/route.ts # 预警历史
│   │   ├── page.tsx        # 主页面
│   │   ├── layout.tsx      # 根布局
│   │   └── globals.css     # 暗黑主题
│   ├── components/ui/      # shadcn/ui 组件
│   ├── lib/
│   │   ├── db.ts           # TiDB 数据库连接
│   │   ├── alerts.ts       # 预警规则引擎
│   │   └── feishu.ts       # 飞书推送服务
│   ├── hooks/useRealtimeData.ts
│   └── README.md
├── server.py              # 原版 Python API (已弃用)
├── client.py              # Python 客户端库
└── stockpool.db           # SQLite (原版)
```

## 🚀 快速开始

### Next.js + TiDB 新版

```bash
cd web
npm install
cp .env.local.example .env.local
# 配置 TiDB + 飞书 Webhook
npm run dev
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

### 支持的预警规则

| 规则 | 说明 | 严重级别 |
|------|------|----------|
| `cost_pct_above` | 成本盈利超过设定比例 | 提示 |
| `cost_pct_below` | 成本亏损超过设定比例 | 警告/严重 |
| `change_pct_above` | 日内涨幅超过设定比例 | 提示 |
| `change_pct_below` | 日内跌幅超过设定比例 | 警告 |
| `volume_surge` | 成交量放大超过设定倍数 | 提示 |
| `ma_monitor` | 均线金叉死叉（预留） | - |
| `rsi_monitor` | RSI超买超卖（预留） | - |
| `gap_monitor` | 跳空缺口（预留） | - |

### 技术栈

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- TiDB Serverless (MySQL)
- 多数据源实时行情（新浪/腾讯/东财）
- Vercel Cron（定时任务）
- 飞书机器人 Webhook

## 📡 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/stocks` | 获取所有股票 |
| POST | `/api/stocks` | 创建股票 |
| PUT | `/api/stocks/{code}` | 更新股票 |
| DELETE | `/api/stocks/{code}` | 删除股票 |
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

```bash
# 数据库 (必需)
DB_HOST=xxx.tidbcloud.com
DB_PORT=4000
DB_USER=xxx
DB_PASSWORD=xxx
DB_NAME=stockpool
TIDB_SSL=true

# 飞书推送 (可选)
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/xxx
FEISHU_USER_ID=ou_xxx
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

每5分钟自动检查一次（仅工作日交易时段生效）

---

## 📝 版本历史

- **v3.0** (2026-03-25) - Stage 3: 预警规则引擎 + 飞书推送
- **v2.0** (2026-03-25) - Stage 2: Next.js + TiDB + 多源实时数据
- **v1.0** (2026-03-25) - Stage 1: Python HTTP Server + SQLite
