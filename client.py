#!/usr/bin/env python3
"""
Shared Stock Pool Client
供 Tailnet 内其他 Agent 使用的客户端库
"""

import json
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass
from functools import lru_cache

# 默认服务器地址 (kimiclaw 的 Tailscale IP)
DEFAULT_SERVER = "http://100.111.204.29:8080"

@dataclass
class StockConfig:
    """股票配置数据类"""
    code: str
    name: str
    market: str
    type: str
    cost: float
    alerts: Dict
    updated_at: str
    
    @property
    def is_position(self) -> bool:
        """是否为持仓股票 (成本 > 0)"""
        return self.cost > 0
    
    @property
    def alert_summary(self) -> str:
        """预警配置摘要"""
        alerts = self.alerts
        parts = []
        if 'cost_pct_above' in alerts:
            parts.append(f"止盈+{alerts['cost_pct_above']:.0f}%")
        if 'cost_pct_below' in alerts:
            parts.append(f"止损{alerts['cost_pct_below']:.0f}%")
        return ", ".join(parts) if parts else "无成本预警"


class StockPoolClient:
    """股票池客户端"""
    
    def __init__(self, server_url: str = DEFAULT_SERVER):
        self.server_url = server_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'StockPoolClient/1.0',
            'Accept': 'application/json'
        })
    
    def health_check(self) -> bool:
        """检查服务器健康状态"""
        try:
            resp = self.session.get(f"{self.server_url}/health", timeout=5)
            return resp.status_code == 200
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            return False
    
    def get_all(self, stock_type: Optional[str] = None) -> List[StockConfig]:
        """
        获取所有股票配置
        
        Args:
            stock_type: 筛选类型 (individual/etf/gold)，None 表示全部
        
        Returns:
            List[StockConfig]: 股票配置列表
        """
        url = f"{self.server_url}/api/watchlist"
        params = {}
        if stock_type:
            params['type'] = stock_type
        
        resp = self.session.get(url, params=params, timeout=10)
        resp.raise_for_status()
        
        data = resp.json()
        return [StockConfig(**item) for item in data['data']]
    
    def get(self, code: str) -> Optional[StockConfig]:
        """
        获取单只股票配置
        
        Args:
            code: 股票代码
        
        Returns:
            StockConfig or None: 股票配置，不存在时返回 None
        """
        url = f"{self.server_url}/api/watchlist/{code}"
        
        try:
            resp = self.session.get(url, timeout=10)
            if resp.status_code == 404:
                return None
            resp.raise_for_status()
            return StockConfig(**resp.json())
        except requests.exceptions.RequestException as e:
            print(f"❌ Failed to get stock {code}: {e}")
            return None
    
    def get_positions(self) -> List[StockConfig]:
        """获取所有持仓股票 (cost > 0)"""
        all_stocks = self.get_all()
        return [s for s in all_stocks if s.is_position]
    
    def get_watchlist(self) -> List[StockConfig]:
        """获取所有观察股票 (用于监控回调等)"""
        all_stocks = self.get_all()
        return all_stocks  # 所有都在观察列表中
    
    def get_by_market(self, market: str) -> List[StockConfig]:
        """按市场筛选 (sh/sz/hk/fx)"""
        all_stocks = self.get_all()
        return [s for s in all_stocks if s.market == market]


# 便捷函数 (供快速使用)
_client = None

def get_client() -> StockPoolClient:
    """获取默认客户端实例"""
    global _client
    if _client is None:
        _client = StockPoolClient()
    return _client

def get_watchlist() -> List[StockConfig]:
    """快捷获取股票池"""
    return get_client().get_all()

def get_stock(code: str) -> Optional[StockConfig]:
    """快捷获取单只股票"""
    return get_client().get(code)


# CLI 模式
if __name__ == '__main__':
    import sys
    
    client = StockPoolClient()
    
    if len(sys.argv) < 2:
        print("Usage: python client.py [command] [args]")
        print("")
        print("Commands:")
        print("  health           检查服务器健康状态")
        print("  list             列出所有股票")
        print("  list --type=etf  按类型筛选")
        print("  get CODE         获取单只股票 (如: get 600722)")
        print("  positions        列出持仓股票")
        print("")
        print("Examples:")
        print("  python client.py list")
        print("  python client.py get 600722")
        sys.exit(0)
    
    cmd = sys.argv[1]
    
    if cmd == 'health':
        if client.health_check():
            print("✅ Server is healthy")
        else:
            print("❌ Server is unavailable")
    
    elif cmd == 'list':
        stock_type = None
        if len(sys.argv) > 2 and sys.argv[2].startswith('--type='):
            stock_type = sys.argv[2].split('=')[1]
        
        stocks = client.get_all(stock_type)
        print(f"📊 Stock Pool ({len(stocks)} stocks):")
        print("-" * 60)
        for s in stocks:
            pos_marker = "📌" if s.is_position else "👀"
            print(f"{pos_marker} {s.code} | {s.name} | {s.type} | 成本:¥{s.cost:.2f}")
    
    elif cmd == 'get':
        if len(sys.argv) < 3:
            print("❌ Please provide stock code")
            sys.exit(1)
        
        code = sys.argv[2]
        stock = client.get(code)
        
        if stock:
            print(f"📊 {stock.name} ({stock.code})")
            print(f"   市场: {stock.market}")
            print(f"   类型: {stock.type}")
            print(f"   成本: ¥{stock.cost:.2f}")
            print(f"   预警: {stock.alert_summary}")
            print(f"   详细: {json.dumps(stock.alerts, ensure_ascii=False, indent=2)}")
        else:
            print(f"❌ Stock {code} not found")
    
    elif cmd == 'positions':
        positions = client.get_positions()
        print(f"📌 Positions ({len(positions)} stocks):")
        print("-" * 60)
        for s in positions:
            print(f"  {s.code} | {s.name} | ¥{s.cost:.2f} | {s.alert_summary}")
    
    else:
        print(f"❌ Unknown command: {cmd}")
