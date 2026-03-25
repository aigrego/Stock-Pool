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
│   │   │   └── realtime/route.ts    # 实时股价 (新浪API轮询)
│   │   ├── page.tsx        # 主页面 (Dashboard + Table)
│   │   ├── layout.tsx      # 根布局
│   │   └── globals.css     # 暗黑主题设计系统
│   ├── components/ui/      # shadcn/ui 组件
│   ├── lib/db.ts           # TiDB 数据库连接
│   ├── hooks/useRealtimeData.ts  # 实时数据轮询 Hook
│   └── README.md           # Web 版详细文档
├── server.py              # 原版 Python API 服务器 (已弃用)
├── static/index.html      # 原版 Web UI (已弃用)
├── client.py              # Python 客户端库
├── control.sh             # 服务管理脚本
├── import_tool.py         # 同花顺导入工具
└── stockpool.db           # SQLite 数据库 (原版)
```

## 🚀 快速开始

### Next.js + TiDB 新版 (推荐)

```bash
cd web
npm install
cp .env.local.example .env.local
# 配置 TiDB 连接信息
npm run dev
# 访问 http://localhost:3000
```

## 🖥️ Web 界面功能

- 📊 **仪表盘** - 4 卡片统计布局
- 📈 **实时股价** - 5秒轮询新浪财经数据
- 💰 **持仓盈亏** - 实时计算成本vs现价盈亏
- 🔍 **搜索筛选** - 实时搜索 + 类型/市场筛选  
- ➕ **添加股票** - 弹窗表单，含预警配置
- ✏️ **编辑股票** - 点击编辑，数据回填
- 🗑️ **删除股票** - 确认删除
- 🔔 **浏览器通知** - 桌面提醒支持
- 🌙 **暗黑主题** - 专业金融仪表盘设计
- 📱 **响应式** - 移动端优化

### 技术栈

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- TiDB Serverless (MySQL)
- 新浪财经 API (实时数据)
- Serverless 轮询架构

## 📡 API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/stocks` | 获取所有股票 |
| POST | `/api/stocks` | 创建股票 |
| PUT | `/api/stocks/{code}` | 更新股票 |
| DELETE | `/api/stocks/{code}` | 删除股票 |
| GET | `/api/stats` | 获取统计数据 |
| GET | `/api/realtime` | 获取实时股价 |

## 🛠️ 部署

### Vercel (推荐)

```bash
cd web
vercel --prod
```

配置环境变量:
```
DB_HOST=your-tidb-serverless-host.tidbcloud.com
DB_PORT=4000
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=stockpool
TIDB_SSL=true
```

详见: [web/README.md](web/README.md)

---

## 原版 Python 服务器 (已弃用)

如需使用原版的 Python HTTP 服务器 + SQLite:

```bash
./control.sh start
# 访问 http://100.111.204.29:8080
```

API 文档见原 README 历史版本。

## 🔄 同花顺自选股同步

```bash
# 从CSV导入
python3 import_tool.py csv ~/Downloads/自选股20240325.csv

# 交互式添加
python3 import_tool.py add
```

详见: [THS_SYNC_GUIDE.md](THS_SYNC_GUIDE.md)

## 🔒 安全说明

- 服务绑定 `0.0.0.0:8080`，但仅 Tailscale 网络内可访问
- 数据库文件权限: 600 (仅所有者可读写)

## 📝 版本历史

- **v2.0** (2026-03-25) - Next.js + TiDB + 新浪财经实时数据 (轮询架构)
- **v1.0** (2026-03-25) - Python HTTP Server + SQLite 原版
