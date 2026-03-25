# 股票池管理 | Stock Pool Manager

基于 Next.js + TiDB 的智能股票池管理系统，支持实时监控、图表分析和预警通知。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS + shadcn/ui
- **数据库**: TiDB Serverless (MySQL)
- **图表**: Recharts
- **部署**: Vercel

## 功能特性

### 阶段 1 (已完成) ✅
- [x] 暗黑主题金融仪表盘 UI
- [x] 股票池 CRUD 操作
- [x] 按代码/名称搜索
- [x] 按类型/市场筛选
- [x] TiDB MySQL 数据库支持
- [x] 响应式设计

### 阶段 2 (计划中)
- [ ] WebSocket 实时股价推送
- [ ] K 线图表展示
- [ ] 持仓盈亏计算
- [ ] 浏览器桌面通知

### 阶段 3 (计划中)
- [ ] 预警规则引擎
- [ ] 飞书/微信推送
- [ ] 多用户支持
- [ ] 数据导入导出

## 本地开发

### 1. 克隆项目

```bash
git clone git@github.com:aigrego/Stock-Pool.git
cd Stock-Pool/my-app
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置数据库

复制环境变量文件并配置 TiDB：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
DB_HOST=your-tidb-serverless-host.tidbcloud.com
DB_PORT=4000
DB_USER=your-username
DB_PASSWORD=your-password
DB_NAME=stockpool
TIDB_SSL=true
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## Vercel 部署

### 1. 准备 TiDB 数据库

在 [TiDB Cloud](https://tidbcloud.com) 创建 Serverless 集群：
- 选择 **Serverless Tier** (免费 5GB)
- 创建数据库 `stockpool`
- 获取连接信息

### 2. 部署到 Vercel

```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录并部署
vercel login
vercel
```

### 3. 配置环境变量

在 Vercel Dashboard → Project Settings → Environment Variables 添加：

| 变量名 | 值 |
|--------|-----|
| `DB_HOST` | your-tidb-host.tidbcloud.com |
| `DB_PORT` | 4000 |
| `DB_USER` | your-username |
| `DB_PASSWORD` | your-password |
| `DB_NAME` | stockpool |
| `TIDB_SSL` | true |

### 4. 重新部署

```bash
vercel --prod
```

## 数据库 Schema

```sql
CREATE TABLE IF NOT EXISTS watchlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  market VARCHAR(10) NOT NULL,  -- sh, sz, hk, us, bj, fx
  type VARCHAR(20) NOT NULL DEFAULT 'individual',  -- individual, etf, gold
  cost DECIMAL(10, 4) DEFAULT 0,
  alerts_json TEXT NOT NULL,  -- JSON string
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(50) NOT NULL,
  code VARCHAR(20),
  details TEXT,
  agent_id VARCHAR(100),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stocks` | 获取所有股票 |
| POST | `/api/stocks` | 创建股票 |
| GET | `/api/stocks/[code]` | 获取单个股票 |
| PUT | `/api/stocks/[code]` | 更新股票 |
| DELETE | `/api/stocks/[code]` | 删除股票 |
| GET | `/api/stats` | 获取统计数据 |

## 设计系统

基于 UI/UX Pro Max skill 生成的金融仪表盘设计系统：

- **配色**: 暗黑模式，蓝色主色调
- **字体**: Inter (UI) + JetBrains Mono (数据)
- **组件**: shadcn/ui 为基础

## 相关项目

- [stock-monitor-skill](https://github.com/THIRTYFANG/stock-monitor-skill) - 后端监控服务

## License

MIT
