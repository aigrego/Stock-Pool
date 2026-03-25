# 📊 Shared Stock Pool - Tailscale 共享股票池

在 Tailnet 网络内共享股票池配置，提供 Web 管理界面和 REST API。

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

## 🚀 快速开始

### 1. 启动服务器 (在 kimiclaw 上)

```bash
cd /root/workspaces/feishu-groups/shared-stockpool
./control.sh start
```

### 2. 访问方式

| 方式 | 地址 | 说明 |
|------|------|------|
| **Web 界面** | http://100.111.204.29:8080 | 浏览器管理股票池 |
| **API** | http://100.111.204.29:8080/api/watchlist | REST API |
| **健康检查** | http://100.111.204.29:8080/health | 服务状态 |

## 🖥️ Web 界面功能

- 📊 **仪表盘** - 显示股票池统计
- ➕ **添加股票** - 表单方式添加新股票
- ✏️ **编辑股票** - 修改股票配置
- 🗑️ **删除股票** - 移除股票
- 🔍 **搜索筛选** - 按代码、名称、市场、类型筛选
- 📱 **响应式设计** - 支持手机/平板/电脑

## 📡 REST API 文档

### 端点列表

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/` | Web 管理界面 |
| GET | `/health` | 健康检查 |
| GET | `/api/watchlist` | 获取所有股票 |
| GET | `/api/watchlist?type=etf` | 按类型筛选 |
| GET | `/api/watchlist/{code}` | 获取单只股票 |
| POST | `/api/watchlist` | 创建股票 |
| PUT | `/api/watchlist` | 更新股票 |
| DELETE | `/api/watchlist/{code}` | 删除股票 |

### 请求示例

**获取股票列表:**
```bash
curl http://100.111.204.29:8080/api/watchlist
```

**创建股票:**
```bash
curl -X POST http://100.111.204.29:8080/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{
    "code": "600519",
    "name": "贵州茅台",
    "market": "sh",
    "type": "individual",
    "cost": 1500,
    "alerts": {
      "cost_pct_above": 15,
      "cost_pct_below": -12
    }
  }'
```

**更新股票:**
```bash
curl -X PUT http://100.111.204.29:8080/api/watchlist \
  -H "Content-Type: application/json" \
  -d '{
    "code": "600519",
    "cost": 1600
  }'
```

**删除股票:**
```bash
curl -X DELETE http://100.111.204.29:8080/api/watchlist/600519
```

### 响应格式

```json
{
  "code": "600519",
  "name": "贵州茅台",
  "market": "sh",
  "type": "individual",
  "cost": 1500,
  "alerts": {
    "cost_pct_above": 15.0,
    "cost_pct_below": -12.0,
    "change_pct_above": 4.0,
    "change_pct_below": -4.0,
    "volume_surge": 2.0,
    "ma_monitor": true,
    "rsi_monitor": true,
    "gap_monitor": true
  },
  "updated_at": "2024-03-25 08:00:00"
}
```

## 🛠️ 管理命令

```bash
# 查看状态
./control.sh status

# 启动服务
./control.sh start

# 停止服务
./control.sh stop

# 重启服务
./control.sh restart

# 查看日志
./control.sh log
```

## 🔄 同花顺自选股同步

支持与同花顺自选股列表同步：

```bash
# 从CSV导入（同花顺导出）
python3 import_tool.py csv ~/Downloads/自选股20240325.csv

# 交互式添加
python3 import_tool.py add

# 查看当前股票池
python3 import_tool.py list
```

详见: [THS_SYNC_GUIDE.md](THS_SYNC_GUIDE.md)

## 📁 文件结构

```
shared-stockpool/
├── server.py              # HTTP API 服务器 + Web UI
├── static/
│   └── index.html         # Web 管理界面
├── client.py              # Python 客户端库
├── control.sh             # 服务管理脚本
├── import_tool.py         # 同花顺导入工具
├── ths_sync.py            # 同花顺同步工具
├── stockpool.db           # SQLite 数据库
├── server.log             # 运行日志
├── README.md              # 本文档
└── THS_SYNC_GUIDE.md      # 同花顺同步指南
```

## 🔒 安全说明

- 服务绑定 `0.0.0.0:8080`，但仅 Tailscale 网络内可访问
- 数据库文件权限: 600 (仅所有者可读写)
- 建议定期检查 `server.log` 查看访问记录

## 📝 扩展计划

- [x] Web 管理界面
- [x] 完整的 CRUD API
- [x] 同花顺自选股同步
- [ ] API 认证（如需公网访问）
- [ ] 版本历史记录
- [ ] 多节点数据同步
