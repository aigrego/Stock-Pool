# 📊 同花顺自选股同步指南

将同花顺的自选股列表同步到共享股票池，实现手机/电脑操作 → Agent 自动监控的闭环。

## 🎯 同步流程

```
┌─────────────────┐     导出CSV      ┌──────────────────┐
│   同花顺 APP    │ ────────────────► │   共享股票池     │
│   或电脑版      │                   │   (SQLite+API)   │
└─────────────────┘                   └────────┬─────────┘
                                               │
                                               ▼ 读取配置
                                      ┌──────────────────┐
                                      │   各 Agent       │
                                      │   (监控/预警)    │
                                      └──────────────────┘
```

## 📥 同步方式

### 方式1: CSV 文件导入（推荐）

**步骤1: 在同花顺导出**

**电脑版:**
1. 打开同花顺 → 自选股
2. 右键点击自选股列表
3. 选择 "数据导出" → "导出所有数据"
4. 保存为 CSV 文件

**手机版:**
1. 同花顺 APP → 自选股
2. 右上角 "..." → "分享"
3. 复制股票列表（手动整理为CSV格式）

**步骤2: 导入到共享股票池**

```bash
cd /root/workspaces/feishu-groups/shared-stockpool

# 基础导入
python3 import_tool.py csv ~/Downloads/自选股20240325.csv

# 导入并设置默认成本
python3 import_tool.py csv ~/Downloads/自选股20240325.csv 100.0
```

### 方式2: 交互式添加

适合手动输入少量股票：

```bash
python3 import_tool.py add

# 然后输入格式: 代码,名称,成本(可选)
> 600519,贵州茅台,1500
> 000001,平安银行,10.5
> 300750,宁德时代
> 
# 空行结束
```

### 方式3: 代码列表直接导入

从同花顺复制的代码列表：

```bash
python3 ths_sync.py codes 600519,000001,300750,600036 贵州茅台,平安银行,宁德时代,招商银行
```

## 📋 工具命令参考

### import_tool.py

```bash
# 查看当前股票池
python3 import_tool.py list

# 从CSV导入
python3 import_tool.py csv <文件路径> [默认成本]

# 交互式添加
python3 import_tool.py add

# 删除股票
python3 import_tool.py del <代码>
```

### ths_sync.py

```bash
# 解析同花顺本地JSON文件 (Windows)
python3 ths_sync.py json "C:/同花顺/user/SelfStockInfo.json"

# 解析CSV
python3 ths_sync.py csv ~/Downloads/ths_export.csv

# 代码列表
python3 ths_sync.py codes 600519,000001 贵州茅台,平安银行
```

## 🔄 自动同步方案（进阶）

### 方案A: 定时任务同步

如果同花顺数据存储在可被访问的位置，可以设置 cron：

```bash
# 每小时检查一次自选股文件变化
0 * * * * cd /root/workspaces/feishu-groups/shared-stockpool && python3 import_tool.py csv /shared/ths_export.csv
```

### 方案B: Webhook 同步（需要开发）

如果同花顺支持 webhook 或你有自定义脚本：

```python
# 伪代码
@app.route('/sync/ths', methods=['POST'])
def sync_from_ths():
    stock_list = request.json.get('stocks')
    import_to_stockpool(stock_list)
    return {"status": "ok"}
```

## 📊 支持的格式

### CSV 格式示例

```csv
代码,名称,最新价,涨跌幅
600519,贵州茅台,1500.00,+1.23
000001,平安银行,10.50,-0.50
300750,宁德时代,180.00,+2.10
510300,沪深300ETF,4.50,+0.30
```

**支持的列名:**
- 代码: `代码`, `股票代码`, `code`, `Code`
- 名称: `名称`, `股票名称`, `name`, `Name`

### 代码识别规则

| 代码特征 | 市场 | 类型 |
|---------|------|------|
| 6开头 | 上海(sh) | 个股 |
| 0/3开头 | 深圳(sz) | 个股 |
| 510/511/512/515/518/560/561/563/588开头 | 上海(sh) | ETF |
| 159开头 | 深圳(sz) | ETF |
| 8/4开头 | 北交所(bj) | 个股 |
| 5位数字 | 港股(hk) | 个股 |
| 字母 | 美股(us) | 个股 |

## ⚙️ 导入后的配置

导入的股票会自动添加默认预警规则：

```json
{
  "cost_pct_above": 15.0,    // 盈利15%提醒
  "cost_pct_below": -12.0,   // 亏损12%止损
  "change_pct_above": 4.0,   // 个股日内±4%
  "change_pct_below": -4.0,
  "volume_surge": 2.0,       // 放量2倍
  "ma_monitor": true,        // 均线监控
  "rsi_monitor": true,       // RSI监控
  "gap_monitor": true        // 跳空监控
}
```

如需修改成本或预警规则，需直接编辑数据库或使用 API 更新。

## 🔍 验证同步结果

```bash
# 查看API返回的最新数据
curl http://100.111.204.29:8080/api/watchlist | python3 -m json.tool

# 查看数据库
python3 import_tool.py list
```

## 💡 最佳实践

1. **定期同步**: 建议每天收盘后导出一次
2. **分组管理**: 同花顺支持自选股分组，可以导出不同分组到不同CSV
3. **成本记录**: 导入时设置成本，便于预警计算
4. **备份**: 定期备份 `stockpool.db` 文件

## ❓ 常见问题

**Q: 同花顺导出的文件编码是什么？**
A: 通常是 GBK 或 UTF-8-SIG，工具会自动尝试多种编码。

**Q: 可以增量同步吗？**
A: 可以，工具使用 `INSERT OR REPLACE`，不会重复添加。

**Q: 手机同花顺怎么导出？**
A: 手机版限制较多，建议:
1. 使用手机同花顺的"分享"功能复制列表
2. 整理成CSV格式
3. 或使用云端同步后在电脑端导出

**Q: 同步后为什么API还是旧数据？**
A: API 是实时的，但如果有缓存可以重启服务：
```bash
./control.sh restart
```
