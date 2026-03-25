# 📊 Shared Stock Pool - Tailscale 共享股票池

在 Tailnet 网络内共享股票池配置，提供 Web 管理界面和 REST API。

> 🆕 **新版 Web 界面**: `web/` 目录包含基于 Next.js + TiDB 的全新版本（阶段 1 已完成）

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
│   Web UI        │ 浏览器访问
│   + REST API    │
└─────────────────┘
```

## 📁 项目结构

```
shared-stockpool/
├── server.py              # HTTP API 服务器 (Python stdlib)
├── static/index.html      # 原版 Web UI (已弃用)
├── web/                   # 🆕 Next.js + TiDB 新版 (推荐)
│   ├── app/              # Next.js App Router
│   ├── components/ui/    # shadcn/ui 组件
│   ├── lib/db.ts         # TiDB 数据库连接
│   └── README.md         # Web 版详细文档
├── client.py              # Python 客户端库
├── control.sh             # 服务管理脚本
├── import_tool.py         # 同花顺导入工具
└── stockpool.db           # SQLite 数据库 (原版)
```

## 🚀 快速开始

### 原版 Python 服务器 (稳定)

```bash
./control.sh start
# 访问 http://100.111.204.29:8080
```

### 🆕 新版 Next.js + TiDB (推荐)

```bash
cd web
npm install
cp .env.local.example .env.local
# 配置 TiDB 连接信息
npm run dev
# 访问 http://localhost:3000
```

详见: [web/README.md](web/README.md)

## 🖥️ Web 界面功能 (新版)

- 📊 **仪表盘** - 4 卡片统计布局
- 🔍 **搜索筛选** - 实时搜索 + 类型/市场筛选  
- ➕ **添加股票** - 弹窗表单，含预警配置
- ✏️ **编辑股票** - 点击编辑，数据回填
- 🗑️ **删除股票** - 确认删除
- 🌙 **暗黑主题** - 专业金融仪表盘设计
- 📱 **响应式** - 移动端优化

### 技术栈

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- TiDB Serverless (MySQL)
- Recharts (图表预留)

## 🛠️ 部署

### Vercel (推荐)

```bash
cd web
vercel --prod
```

配置环境变量: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `TIDB_SSL`

详见: [web/README.md](web/README.md)

---

## 原版 API 文档

> 以下文档适用于 Python 服务器 (`server.py`)

### REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/watchlist` | 获取所有股票 |
| POST | `/api/watchlist` | 创建股票 |
| PUT | `/api/watchlist` | 更新股票 |
| DELETE | `/api/watchlist/{code}` | 删除股票 |

### 请求示例

```bash
# 获取股票列表
curl http://100.111.204.29:8080/api/watchlist

# 创建股票
curl -X POST http://100.111.204.29:8080/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{"code":"600519","name":"贵州茅台","market":"sh","type":"individual","cost":1500}'
```

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

- **v2.0** (2026-03-25) - Next.js + TiDB 新版 Web 界面
- **v1.0** (2026-03-25) - Python HTTP Server + SQLite 原版
