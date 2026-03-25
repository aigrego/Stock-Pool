#!/usr/bin/env python3
"""
同花顺自选股导入工具 - 直接写入数据库版本
"""

import json
import sqlite3
import sys
from pathlib import Path
from typing import List, Dict

# 数据库路径
DB_PATH = Path(__file__).parent / "stockpool.db"

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def detect_market_and_type(code: str) -> tuple:
    """识别市场和类型"""
    code = str(code).strip()
    
    if code.isdigit():
        # ETF 代码
        if code.startswith(('510', '511', '512', '515', '518', '560', '561', '563', '588', '159')):
            market = 'sh' if code.startswith('5') else 'sz'
            return (market, 'etf')
        
        # 上海
        if code.startswith('6') or code.startswith('5'):
            return ('sh', 'individual')
        
        # 深圳
        if code.startswith('0') or code.startswith('3'):
            return ('sz', 'individual')
        
        # 北交所
        if code.startswith('8') or code.startswith('4'):
            return ('bj', 'individual')
        
        # 港股 (5位)
        if len(code) == 5:
            return ('hk', 'individual')
    
    # 美股
    if code.isalpha() or any(c.isalpha() for c in code):
        return ('us', 'individual')
    
    return ('sh', 'individual')

def create_default_alerts(stock_type: str) -> Dict:
    """创建默认预警配置"""
    base_alerts = {
        "cost_pct_above": 15.0,
        "cost_pct_below": -12.0,
        "volume_surge": 2.0,
        "ma_monitor": True,
        "rsi_monitor": True,
        "gap_monitor": True
    }
    
    # 根据类型调整
    if stock_type == 'etf':
        base_alerts.update({
            "cost_pct_above": 12.0,
            "cost_pct_below": -12.0,
            "change_pct_above": 2.0,
            "change_pct_below": -2.0
        })
    elif stock_type == 'gold':
        base_alerts.update({
            "cost_pct_above": 10.0,
            "cost_pct_below": -8.0,
            "change_pct_above": 2.5,
            "change_pct_below": -2.5
        })
    else:  # individual
        base_alerts.update({
            "change_pct_above": 4.0,
            "change_pct_below": -4.0
        })
    
    return base_alerts

def import_stock(code: str, name: str, cost: float = 0) -> bool:
    """导入单只股票到数据库"""
    market, stock_type = detect_market_and_type(code)
    alerts = create_default_alerts(stock_type)
    
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO watchlist (code, name, market, type, cost, alerts_json)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (code, name, market, stock_type, cost, json.dumps(alerts, ensure_ascii=False)))
        
        conn.commit()
        conn.close()
        
        action = "更新" if cursor.rowcount > 0 else "新增"
        print(f"  ✅ {action}: {code} | {name} | {market} | {stock_type}")
        return True
        
    except Exception as e:
        print(f"  ❌ 导入失败 {code}: {e}")
        return False

def import_from_csv(file_path: str, cost: float = 0) -> int:
    """从CSV文件导入"""
    import csv
    
    path = Path(file_path)
    if not path.exists():
        print(f"❌ 文件不存在: {file_path}")
        return 0
    
    count = 0
    encodings = ['utf-8-sig', 'gbk', 'gb2312', 'utf-8']
    
    for encoding in encodings:
        try:
            with open(path, 'r', encoding=encoding) as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    # 尝试不同的列名
                    code = None
                    name = None
                    
                    for key in row.keys():
                        key_upper = key.upper()
                        if 'CODE' in key_upper or '代码' in key or 'COD' in key_upper:
                            code = row[key].strip() if row[key] else None
                        if 'NAME' in key_upper or '名称' in key or 'NM' in key_upper:
                            name = row[key].strip() if row[key] else None
                    
                    if code and name:
                        if import_stock(code, name, cost):
                            count += 1
            
            if count > 0:
                print(f"\n✅ 成功导入 {count} 只股票 (编码: {encoding})")
                return count
                
        except Exception as e:
            print(f"⚠️ {encoding} 编码解析失败: {e}")
            continue
    
    return count

def import_from_list(stock_list: List[Dict], cost: float = 0) -> int:
    """从列表导入"""
    count = 0
    
    for item in stock_list:
        code = item.get('code')
        name = item.get('name')
        item_cost = item.get('cost', cost)
        
        if code and name:
            if import_stock(code, name, item_cost):
                count += 1
    
    return count

def batch_import_interactive():
    """交互式批量导入"""
    print("📥 同花顺自选股批量导入")
    print("=" * 50)
    print()
    print("请输入股票代码和名称，格式: 代码,名称,成本(可选)")
    print("每行一只，输入空行结束")
    print("示例: 600519,贵州茅台,1500")
    print()
    
    stocks = []
    while True:
        line = input("> ").strip()
        if not line:
            break
        
        parts = line.split(',')
        if len(parts) >= 2:
            code = parts[0].strip()
            name = parts[1].strip()
            cost = float(parts[2]) if len(parts) > 2 else 0
            
            stocks.append({'code': code, 'name': name, 'cost': cost})
    
    if stocks:
        print(f"\n准备导入 {len(stocks)} 只股票...")
        count = import_from_list(stocks)
        print(f"\n✅ 成功导入 {count}/{len(stocks)} 只股票")
    else:
        print("❌ 没有输入任何股票")

def show_current_watchlist():
    """显示当前股票池"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM watchlist ORDER BY code')
    rows = cursor.fetchall()
    conn.close()
    
    if not rows:
        print("📭 股票池为空")
        return
    
    print(f"\n📊 当前股票池 ({len(rows)} 只股票):")
    print("-" * 70)
    print(f"{'代码':<10} {'名称':<12} {'市场':<6} {'类型':<10} {'成本':<10}")
    print("-" * 70)
    
    for row in rows:
        cost_str = f"¥{row['cost']:.2f}" if row['cost'] > 0 else "-"
        print(f"{row['code']:<10} {row['name']:<12} {row['market']:<6} {row['type']:<10} {cost_str:<10}")
    
    print("-" * 70)

def delete_stock(code: str) -> bool:
    """删除股票"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM watchlist WHERE code = ?', (code,))
        conn.commit()
        deleted = cursor.rowcount > 0
        conn.close()
        
        if deleted:
            print(f"✅ 已删除: {code}")
        else:
            print(f"⚠️ 未找到: {code}")
        
        return deleted
        
    except Exception as e:
        print(f"❌ 删除失败: {e}")
        return False

def main():
    """主入口"""
    if len(sys.argv) < 2:
        print("同花顺自选股导入工具")
        print()
        print("用法:")
        print(f"  python3 {sys.argv[0]} csv <文件路径> [默认成本]  - 从CSV导入")
        print(f"  python3 {sys.argv[0]} list                                      - 查看当前股票池")
        print(f"  python3 {sys.argv[0]} add                                       - 交互式添加")
        print(f"  python3 {sys.argv[0]} del <代码>                               - 删除股票")
        print()
        print("示例:")
        print(f"  python3 {sys.argv[0]} csv ~/Downloads/自选股.csv")
        print(f"  python3 {sys.argv[0]} csv ~/Downloads/自选股.csv 50.0")
        print()
        print("💡 提示:")
        print("   同花顺导出: 自选股 → 右键 → 数据导出 → 导出为CSV")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == 'csv' and len(sys.argv) >= 3:
        file_path = sys.argv[2]
        cost = float(sys.argv[3]) if len(sys.argv) > 3 else 0
        import_from_csv(file_path, cost)
    
    elif cmd == 'list':
        show_current_watchlist()
    
    elif cmd == 'add':
        batch_import_interactive()
    
    elif cmd == 'del' and len(sys.argv) >= 3:
        delete_stock(sys.argv[2])
    
    else:
        print(f"❌ 未知命令: {cmd}")

if __name__ == '__main__':
    main()
