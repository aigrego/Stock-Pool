#!/usr/bin/env python3
"""
Stock Pool Real-time Data Server
WebSocket + HTTP 混合服务器，提供实时股价推送
"""

import json
import sqlite3
import asyncio
import websockets
import requests
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Set
import threading
import time

DB_PATH = Path(__file__).parent / "stockpool.db"

# 活跃 WebSocket 连接
connected_clients: Set[websockets.WebSocketServerProtocol] = set()

# 缓存的股票数据
stock_cache: Dict[str, dict] = {}

# 新浪 API 映射
SINA_MARKET_MAP = {
    'sh': 'sh',
    'sz': 'sz', 
    'hk': 'hk',
    'us': 'gb_',
    'bj': 'bj'
}

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def get_all_stocks() -> List[dict]:
    """获取所有股票"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM watchlist')
    rows = cursor.fetchall()
    conn.close()
    
    stocks = []
    for row in rows:
        stock = dict(row)
        stock['alerts'] = json.loads(stock.pop('alerts_json', '{}'))
        stocks.append(stock)
    return stocks

def fetch_sina_realtime(codes: List[str]) -> Dict[str, dict]:
    """从新浪财经获取实时数据"""
    if not codes:
        return {}
    
    # 构建新浪 API URL
    sina_codes = []
    for code in codes:
        # 根据代码判断市场
        if code.startswith('6'):
            sina_codes.append(f"sh{code}")
        elif code.startswith('0') or code.startswith('3'):
            sina_codes.append(f"sz{code}")
        elif code.startswith('15') or code.startswith('51') or code.startswith('56'):
            sina_codes.append(f"sz{code}")
        elif code.isalpha():
            sina_codes.append(f"gb_{code.lower()}")
        else:
            sina_codes.append(f"hk{code}")
    
    url = f"https://hq.sinajs.cn/list={','.join(sina_codes)}"
    headers = {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'gb2312'
        
        result = {}
        lines = response.text.strip().split('\n')
        
        for line in lines:
            if not line or '=' not in line:
                continue
                
            parts = line.split('=')
            if len(parts) != 2:
                continue
                
            code_key = parts[0].split('_')[-1]
            data_str = parts[1].strip().strip('";')
            
            if not data_str:
                continue
            
            data_parts = data_str.split(',')
            
            # 解析数据（A股格式）
            if len(data_parts) >= 33:
                code = code_key.replace('sh', '').replace('sz', '').replace('gb_', '').upper()
                
                result[code] = {
                    'code': code,
                    'name': data_parts[0],
                    'open': float(data_parts[1]),
                    'close': float(data_parts[2]),
                    'current': float(data_parts[3]),
                    'high': float(data_parts[4]),
                    'low': float(data_parts[5]),
                    'volume': int(data_parts[8]),
                    'amount': float(data_parts[9]),
                    'bid1': float(data_parts[11]),
                    'ask1': float(data_parts[21]),
                    'date': data_parts[30],
                    'time': data_parts[31],
                    'updated_at': datetime.now().isoformat()
                }
                
                # 计算涨跌幅
                if result[code]['close'] > 0:
                    result[code]['change_pct'] = round(
                        (result[code]['current'] - result[code]['close']) / result[code]['close'] * 100, 2
                    )
                else:
                    result[code]['change_pct'] = 0
        
        return result
        
    except Exception as e:
        print(f"❌ Error fetching Sina data: {e}")
        return {}

def calculate_position_pnl(stock: dict, realtime: dict) -> dict:
    """计算持仓盈亏"""
    cost = stock.get('cost', 0)
    current = realtime.get('current', 0)
    
    if cost > 0 and current > 0:
        pnl_pct = round((current - cost) / cost * 100, 2)
        pnl_amount = round(current - cost, 3)
    else:
        pnl_pct = 0
        pnl_amount = 0
    
    return {
        'cost': cost,
        'current': current,
        'pnl_pct': pnl_pct,
        'pnl_amount': pnl_amount
    }

async def broadcast_to_clients(message: dict):
    """广播消息给所有连接的客户端"""
    if not connected_clients:
        return
    
    message_str = json.dumps(message)
    disconnected = set()
    
    for client in connected_clients:
        try:
            await client.send(message_str)
        except websockets.exceptions.ConnectionClosed:
            disconnected.add(client)
        except Exception as e:
            print(f"❌ Error sending to client: {e}")
            disconnected.add(client)
    
    # 清理断开的连接
    connected_clients -= disconnected

async def data_updater():
    """定时更新数据并推送给客户端"""
    while True:
        try:
            stocks = get_all_stocks()
            codes = [s['code'] for s in stocks]
            
            if codes:
                realtime_data = fetch_sina_realtime(codes)
                
                # 合并数据并计算盈亏
                enriched_data = {}
                for stock in stocks:
                    code = stock['code']
                    realtime = realtime_data.get(code, {})
                    
                    if realtime:
                        pnl = calculate_position_pnl(stock, realtime)
                        enriched_data[code] = {
                            **stock,
                            **realtime,
                            **pnl
                        }
                    else:
                        enriched_data[code] = stock
                
                stock_cache.update(enriched_data)
                
                # 广播给所有客户端
                await broadcast_to_clients({
                    'type': 'market_data',
                    'data': enriched_data,
                    'timestamp': datetime.now().isoformat()
                })
                
                print(f"📊 Updated {len(enriched_data)} stocks at {datetime.now().strftime('%H:%M:%S')}")
            
        except Exception as e:
            print(f"❌ Error in data updater: {e}")
        
        # A股交易时段每 5 秒更新，其他时段每 30 秒
        await asyncio.sleep(5)

async def handle_websocket(websocket, path):
    """处理 WebSocket 连接"""
    print(f"🔌 Client connected: {websocket.remote_address}")
    connected_clients.add(websocket)
    
    # 发送当前缓存数据
    if stock_cache:
        await websocket.send(json.dumps({
            'type': 'market_data',
            'data': stock_cache,
            'timestamp': datetime.now().isoformat()
        }))
    
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                action = data.get('action')
                
                if action == 'subscribe':
                    codes = data.get('codes', [])
                    await websocket.send(json.dumps({
                        'type': 'subscribed',
                        'codes': codes
                    }))
                    
                elif action == 'ping':
                    await websocket.send(json.dumps({'type': 'pong'}))
                    
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON'
                }))
                
    except websockets.exceptions.ConnectionClosed:
        print(f"🔌 Client disconnected: {websocket.remote_address}")
    finally:
        connected_clients.discard(websocket)

async def start_websocket_server():
    """启动 WebSocket 服务器"""
    async with websockets.serve(handle_websocket, "0.0.0.0", 8765):
        print("🚀 WebSocket Server started on ws://0.0.0.0:8765")
        await asyncio.Future()  # 永久运行

async def main():
    """主函数"""
    print("🚀 Starting Stock Pool Real-time Server...")
    
    # 启动数据更新器和 WebSocket 服务器
    await asyncio.gather(
        data_updater(),
        start_websocket_server()
    )

if __name__ == "__main__":
    asyncio.run(main())
