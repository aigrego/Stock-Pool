#!/usr/bin/env python3
"""
同花顺自选股同步工具
支持从同花顺导出的文件导入到共享股票池
"""

import json
import csv
import re
import requests
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict

# 共享股票池 API
STOCKPOOL_API = "http://100.111.204.29:8080"

@dataclass
class StockInfo:
    """股票信息"""
    code: str
    name: str
    market: str  # sh/sz/hk/us
    type: str    # individual/etf/index
    
    def to_watchlist_format(self, cost: float = 0, alerts: Dict = None) -> Dict:
        """转换为股票池格式"""
        default_alerts = {
            "cost_pct_above": 15.0,
            "cost_pct_below": -12.0,
            "change_pct_above": 4.0 if self.type == "individual" else 2.0,
            "change_pct_below": -4.0 if self.type == "individual" else -2.0,
            "volume_surge": 2.0,
            "ma_monitor": True,
            "rsi_monitor": True,
            "gap_monitor": True
        }
        if alerts:
            default_alerts.update(alerts)
        
        return {
            "code": self.code,
            "name": self.name,
            "market": self.market,
            "type": self.type,
            "cost": cost,
            "alerts": default_alerts
        }


class THSSyncTool:
    """同花顺同步工具"""
    
    def __init__(self, api_url: str = STOCKPOOL_API):
        self.api_url = api_url.rstrip('/')
        self.session = requests.Session()
    
    def detect_market(self, code: str) -> tuple:
        """
        根据股票代码识别市场
        返回: (market, type)
        """
        code = str(code).strip()
        
        # 纯数字代码
        if code.isdigit():
            # 6开头 = 上海
            if code.startswith('6') or code.startswith('5'):
                # 500/510/511/512/515/518/560/588 开头可能是 ETF/LOF
                if code.startswith(('510', '511', '512', '515', '518', '560', '588')):
                    return ('sh', 'etf')
                return ('sh', 'individual')
            
            # 0/3开头 = 深圳
            if code.startswith('0') or code.startswith('3'):
                # 159 开头是 ETF
                if code.startswith('159'):
                    return ('sz', 'etf')
                return ('sz', 'individual')
            
            # 8/4开头 = 北交所/新三板
            if code.startswith('8') or code.startswith('4'):
                return ('bj', 'individual')
            
            # 港股 (5位数字)
            if len(code) == 5:
                return ('hk', 'individual')
        
        # 字母代码 = 美股
        if code.isalpha() or (len(code) <= 5 and any(c.isalpha() for c in code)):
            return ('us', 'individual')
        
        return ('sh', 'individual')  # 默认
    
    def parse_ths_csv(self, file_path: str) -> List[StockInfo]:
        """
        解析同花顺导出的 CSV/Excel 文件
        
        同花顺导出格式通常包含:
        - 股票代码
        - 股票名称
        - 最新价
        - 涨跌幅
        - ...
        """
        stocks = []
        path = Path(file_path)
        
        if not path.exists():
            print(f"❌ 文件不存在: {file_path}")
            return stocks
        
        # 尝试不同的编码
        encodings = ['utf-8-sig', 'gbk', 'gb2312', 'utf-8']
        
        for encoding in encodings:
            try:
                with open(path, 'r', encoding=encoding) as f:
                    # 尝试检测是否是CSV
                    content = f.read()
                    
                    # 检查是否是JSON格式 (同花顺某些版本导出JSON)
                    if content.strip().startswith('{'):
                        return self._parse_ths_json(content)
                    
                    # CSV格式
                    f.seek(0)
                    reader = csv.DictReader(f)
                    
                    for row in reader:
                        # 同花顺CSV常见列名
                        code = self._extract_field(row, ['代码', '股票代码', 'code', 'Code', 'CODE'])
                        name = self._extract_field(row, ['名称', '股票名称', 'name', 'Name', 'NAME'])
                        
                        if code and name:
                            market, stock_type = self.detect_market(code)
                            stocks.append(StockInfo(
                                code=code,
                                name=name,
                                market=market,
                                type=stock_type
                            ))
                    
                    if stocks:
                        print(f"✅ 成功解析 {len(stocks)} 只股票 (编码: {encoding})")
                        return stocks
                        
            except UnicodeDecodeError:
                continue
            except Exception as e:
                print(f"⚠️ 使用 {encoding} 解析失败: {e}")
                continue
        
        return stocks
    
    def _parse_ths_json(self, content: str) -> List[StockInfo]:
        """解析同花顺JSON格式"""
        stocks = []
        try:
            data = json.loads(content)
            # 同花顺JSON格式可能是数组或对象
            if isinstance(data, list):
                for item in data:
                    code = item.get('code') or item.get('股票代码')
                    name = item.get('name') or item.get('股票名称')
                    if code and name:
                        market, stock_type = self.detect_market(code)
                        stocks.append(StockInfo(code, name, market, stock_type))
            elif isinstance(data, dict):
                # 可能是 keyed by code
                for code, info in data.items():
                    name = info.get('name') if isinstance(info, dict) else str(info)
                    if name:
                        market, stock_type = self.detect_market(code)
                        stocks.append(StockInfo(code, name, market, stock_type))
        except Exception as e:
            print(f"❌ JSON解析失败: {e}")
        
        return stocks
    
    def _extract_field(self, row: Dict, possible_keys: List[str]) -> Optional[str]:
        """从行数据中提取字段"""
        for key in possible_keys:
            if key in row and row[key]:
                return str(row[key]).strip()
        return None
    
    def parse_ths_selfstock_json(self, file_path: str) -> List[StockInfo]:
        """
        解析同花顺本地自选股文件 SelfStockInfo.json
        路径通常在: 同花顺安装目录/username/SelfStockInfo.json
        """
        path = Path(file_path)
        if not path.exists():
            print(f"❌ 文件不存在: {file_path}")
            return []
        
        stocks = []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # 同花顺自选股JSON结构
            # 不同版本格式可能不同
            if isinstance(data, list):
                for item in data:
                    code = item.get('code') or item.get('stockCode')
                    name = item.get('name') or item.get('stockName')
                    market_code = item.get('market') or item.get('marketCode')
                    
                    if code and name:
                        market = self._map_market_code(market_code)
                        stock_type = 'etf' if self._is_etf_code(code) else 'individual'
                        stocks.append(StockInfo(code, name, market, stock_type))
            
            elif isinstance(data, dict):
                # 可能是按分组存储的
                for group_name, group_stocks in data.items():
                    if isinstance(group_stocks, list):
                        for item in group_stocks:
                            code = item.get('code') or item.get('stockCode')
                            name = item.get('name') or item.get('stockName')
                            if code and name:
                                market = self._map_market_code(item.get('market'))
                                stock_type = 'etf' if self._is_etf_code(code) else 'individual'
                                stocks.append(StockInfo(code, name, market, stock_type))
            
            print(f"✅ 从同花顺本地文件解析 {len(stocks)} 只股票")
            
        except Exception as e:
            print(f"❌ 解析失败: {e}")
        
        return stocks
    
    def _map_market_code(self, market_code) -> str:
        """映射市场代码"""
        if not market_code:
            return 'sh'
        
        market_map = {
            'SH': 'sh', 'sh': 'sh', '1': 'sh',  # 上海
            'SZ': 'sz', 'sz': 'sz', '0': 'sz',  # 深圳
            'HK': 'hk', 'hk': 'hk', 'HKEX': 'hk',  # 港股
            'US': 'us', 'us': 'us', 'NAS': 'us', 'NYSE': 'us',  # 美股
            'BJ': 'bj', 'bj': 'bj',  # 北交所
        }
        
        return market_map.get(str(market_code).upper(), 'sh')
    
    def _is_etf_code(self, code: str) -> bool:
        """判断是否是ETF代码"""
        etf_prefixes = ('510', '511', '512', '513', '515', '518', '560', '561', '563', '588', '159')
        return str(code).startswith(etf_prefixes)
    
    def import_to_stockpool(self, stocks: List[StockInfo], default_cost: float = 0, 
                           group_name: str = "同花顺导入") -> bool:
        """
        导入股票到共享股票池
        
        注意: 当前API只支持读取，写入需要直接操作数据库
        """
        if not stocks:
            print("❌ 没有股票需要导入")
            return False
        
        print(f"\n📥 准备导入 {len(stocks)} 只股票到共享股票池")
        print(f"   分组: {group_name}")
        print(f"   默认成本: ¥{default_cost}")
        print()
        
        # 由于API是只读的，这里生成SQL语句供手动执行
        # 或者提供JSON供后续批量导入
        
        watchlist_data = []
        for stock in stocks:
            watchlist_item = stock.to_watchlist_format(cost=default_cost)
            watchlist_data.append(watchlist_item)
            print(f"  + {stock.code} | {stock.name} | {stock.market} | {stock.type}")
        
        # 保存为导入文件
        output_file = Path(f"ths_import_{group_name}.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(watchlist_data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ 导入文件已生成: {output_file.absolute()}")
        print(f"   共 {len(watchlist_data)} 只股票")
        print()
        print("💡 下一步操作:")
        print(f"   1. 查看生成的JSON文件确认数据")
        print(f"   2. 手动添加到 /root/workspaces/feishu-groups/shared-stockpool/stockpool.db")
        print(f"   或使用 SQLite 工具执行批量插入")
        
        return True
    
    def sync_from_ths_watchlist(self, codes: List[str], names: List[str] = None) -> List[StockInfo]:
        """
        从股票代码列表同步 (手动输入模式)
        
        例如: 用户从同花顺APP复制股票代码列表
        """
        stocks = []
        
        for i, code in enumerate(codes):
            code = str(code).strip()
            if not code:
                continue
            
            # 清理代码 (去除市场前缀)
            code = re.sub(r'^(SH|SZ|BJ|HK)\s*', '', code, flags=re.IGNORECASE)
            
            # 获取名称
            name = names[i] if names and i < len(names) else code
            
            market, stock_type = self.detect_market(code)
            stocks.append(StockInfo(code, name, market, stock_type))
        
        return stocks


def main():
    """命令行入口"""
    import sys
    
    tool = THSSyncTool()
    
    if len(sys.argv) < 2:
        print("同花顺自选股同步工具")
        print()
        print("用法:")
        print(f"  python3 {sys.argv[0]} csv <文件路径> [默认成本]")
        print(f"  python3 {sys.argv[0]} json <SelfStockInfo.json路径>")
        print(f"  python3 {sys.argv[0]} codes <代码1,代码2,代码3> [名称1,名称2,名称3]")
        print()
        print("示例:")
        print(f"  python3 {sys.argv[0]} csv ~/Downloads/自选股20240325.csv")
        print(f"  python3 {sys.argv[0]} json 'D:/同花顺软件/同花顺/username/SelfStockInfo.json'")
        print(f"  python3 {sys.argv[0]} codes 600519,000001,600036 贵州茅台,平安银行,招商银行")
        print()
        print("提示:")
        print("  1. 同花顺电脑版导出: 自选股 → 右键 → 数据导出 → 导出所有数据")
        print("  2. Windows 本地文件路径: 同花顺安装目录/username/SelfStockInfo.json")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == 'csv' and len(sys.argv) >= 3:
        file_path = sys.argv[2]
        default_cost = float(sys.argv[3]) if len(sys.argv) > 3 else 0
        
        stocks = tool.parse_ths_csv(file_path)
        if stocks:
            tool.import_to_stockpool(stocks, default_cost)
    
    elif cmd == 'json' and len(sys.argv) >= 3:
        file_path = sys.argv[2]
        
        stocks = tool.parse_ths_selfstock_json(file_path)
        if stocks:
            tool.import_to_stockpool(stocks)
    
    elif cmd == 'codes' and len(sys.argv) >= 3:
        codes = sys.argv[2].split(',')
        names = sys.argv[3].split(',') if len(sys.argv) > 3 else None
        
        stocks = tool.sync_from_ths_watchlist(codes, names)
        if stocks:
            tool.import_to_stockpool(stocks)
    
    else:
        print(f"❌ 未知命令或参数不足: {cmd}")
        print("使用 --help 查看用法")


if __name__ == '__main__':
    main()
