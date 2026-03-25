#!/usr/bin/env python3
"""
Shared Stock Pool API Server
部署在 kimiclaw (100.111.204.29) 上，供 Tailnet 内所有 Agent 访问
"""

import json
import sqlite3
import os
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DB_PATH = Path(__file__).parent / "stockpool.db"
STATIC_DIR = Path(__file__).parent / "static"

def init_db():
    """初始化 SQLite 数据库"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 股票池表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            market TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'individual',
            cost REAL DEFAULT 0,
            alerts_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # 操作日志表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            code TEXT,
            details TEXT,
            agent_id TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    print(f"✅ Database initialized at {DB_PATH}")

def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def seed_initial_data():
    """初始化默认股票池数据"""
    default_watchlist = [
        {
            "code": "600722",
            "name": "金牛化工",
            "market": "sh",
            "type": "individual",
            "cost": 15.171,
            "alerts": {
                "cost_pct_above": 15.0,
                "cost_pct_below": -12.0,
                "change_pct_above": 4.0,
                "change_pct_below": -4.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True,
                "trailing_stop": True
            }
        },
        {
            "code": "159681",
            "name": "创50ETF",
            "market": "sz",
            "type": "etf",
            "cost": 1.50,
            "alerts": {
                "cost_pct_above": 12.0,
                "cost_pct_below": -12.0,
                "change_pct_above": 2.0,
                "change_pct_below": -2.0,
                "volume_surge": 1.8
            }
        },
        {
            "code": "2423",
            "name": "贝壳-W",
            "market": "hk",
            "type": "individual",
            "cost": 49.089,
            "alerts": {
                "cost_pct_above": 15.0,
                "cost_pct_below": -12.0,
                "change_pct_above": 4.0,
                "change_pct_below": -4.0,
                "volume_surge": 2.0
            }
        },
        {
            "code": "XAU",
            "name": "伦敦金(人民币/克)",
            "market": "fx",
            "type": "gold",
            "cost": 4650.0,
            "alerts": {
                "cost_pct_above": 10.0,
                "cost_pct_below": -8.0,
                "change_pct_above": 2.5,
                "change_pct_below": -2.5
            }
        },
        {
            "code": "601096",
            "name": "宏盛华源",
            "market": "sh",
            "type": "individual",
            "cost": 5.83,
            "alerts": {
                "cost_pct_above": 15.0,
                "cost_pct_below": -8.0,
                "change_pct_above": 5.0,
                "change_pct_below": -5.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True
            }
        },
        {
            "code": "601319",
            "name": "中国人保",
            "market": "sh",
            "type": "individual",
            "cost": 7.94,
            "alerts": {
                "cost_pct_above": 12.0,
                "cost_pct_below": -8.0,
                "change_pct_above": 4.0,
                "change_pct_below": -4.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True
            }
        },
        {
            "code": "600152",
            "name": "维科技术",
            "market": "sh",
            "type": "individual",
            "cost": 9.38,
            "alerts": {
                "cost_pct_above": 15.0,
                "cost_pct_below": -10.0,
                "change_pct_above": 5.0,
                "change_pct_below": -5.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True
            }
        },
        {
            "code": "603717",
            "name": "天域生物",
            "market": "sh",
            "type": "individual",
            "cost": 6.73,
            "alerts": {
                "cost_pct_above": 15.0,
                "cost_pct_below": -10.0,
                "change_pct_above": 5.0,
                "change_pct_below": -5.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True
            }
        },
        {
            "code": "002210",
            "name": "飞马国际",
            "market": "sz",
            "type": "individual",
            "cost": 2.74,
            "alerts": {
                "cost_pct_above": 20.0,
                "cost_pct_below": -12.0,
                "change_pct_above": 6.0,
                "change_pct_below": -6.0,
                "volume_surge": 2.0,
                "ma_monitor": True,
                "rsi_monitor": True,
                "gap_monitor": True
            }
        }
    ]
    
    conn = get_db()
    cursor = conn.cursor()
    
    for stock in default_watchlist:
        cursor.execute('''
            INSERT OR REPLACE INTO watchlist (code, name, market, type, cost, alerts_json)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            stock['code'],
            stock['name'],
            stock['market'],
            stock['type'],
            stock['cost'],
            json.dumps(stock['alerts'], ensure_ascii=False)
        ))
    
    conn.commit()
    conn.close()
    print(f"✅ Seeded {len(default_watchlist)} stocks")

class StockPoolHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器"""
    
    def log_message(self, format, *args):
        """自定义日志，显示 Agent 来源"""
        client = self.client_address[0]
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {client} - {format % args}")
    
    def send_json_response(self, data, status=200):
        """发送 JSON 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
    
    def send_html_response(self, content, status=200):
        """发送 HTML 响应"""
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))
    
    def do_OPTIONS(self):
        """处理 CORS 预检请求"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """处理 GET 请求"""
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)
        
        # Web UI - 根路径
        if path == '/' or path == '/index.html':
            self.serve_static('index.html')
            return
        
        # 静态文件
        if path.startswith('/static/'):
            self.serve_static(path[8:])  # Remove '/static/'
            return
        
        # API 端点
        if path == '/api/watchlist':
            stock_type = params.get('type', [None])[0]
            self.handle_get_watchlist(stock_type)
            return
        
        if path.startswith('/api/watchlist/'):
            code = path.split('/')[-1]
            self.handle_get_stock(code)
            return
        
        if path == '/health':
            self.send_json_response({
                "status": "ok",
                "service": "shared-stockpool",
                "version": "1.1.0",
                "timestamp": datetime.now().isoformat()
            })
            return
        
        self.send_json_response({"error": "Not found"}, 404)
    
    def do_POST(self):
        """处理 POST 请求 - 创建股票"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/api/watchlist':
            self.handle_create_stock()
            return
        
        self.send_json_response({"error": "Not found"}, 404)
    
    def do_PUT(self):
        """处理 PUT 请求 - 更新股票"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path == '/api/watchlist':
            self.handle_update_stock()
            return
        
        self.send_json_response({"error": "Not found"}, 404)
    
    def do_DELETE(self):
        """处理 DELETE 请求 - 删除股票"""
        parsed = urlparse(self.path)
        path = parsed.path
        
        if path.startswith('/api/watchlist/'):
            code = path.split('/')[-1]
            self.handle_delete_stock(code)
            return
        
        self.send_json_response({"error": "Not found"}, 404)
    
    def serve_static(self, filename):
        """提供静态文件"""
        file_path = STATIC_DIR / filename
        
        if not file_path.exists():
            self.send_json_response({"error": "File not found"}, 404)
            return
        
        # 确定内容类型
        content_type = 'text/html'
        if filename.endswith('.css'):
            content_type = 'text/css'
        elif filename.endswith('.js'):
            content_type = 'application/javascript'
        elif filename.endswith('.json'):
            content_type = 'application/json'
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-Type', content_type + '; charset=utf-8')
            self.end_headers()
            self.wfile.write(content)
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)
    
    def read_body(self):
        """读取请求体"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            return self.rfile.read(content_length).decode('utf-8')
        return None
    
    def handle_get_watchlist(self, stock_type=None):
        """获取股票池列表"""
        conn = get_db()
        cursor = conn.cursor()
        
        if stock_type:
            cursor.execute(
                'SELECT * FROM watchlist WHERE type = ? ORDER BY code',
                (stock_type,)
            )
        else:
            cursor.execute('SELECT * FROM watchlist ORDER BY code')
        
        rows = cursor.fetchall()
        conn.close()
        
        stocks = []
        for row in rows:
            stocks.append({
                "code": row['code'],
                "name": row['name'],
                "market": row['market'],
                "type": row['type'],
                "cost": row['cost'],
                "alerts": json.loads(row['alerts_json']),
                "updated_at": row['updated_at']
            })
        
        self.send_json_response({
            "count": len(stocks),
            "data": stocks
        })
    
    def handle_get_stock(self, code):
        """获取单只股票"""
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM watchlist WHERE code = ?', (code,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            self.send_json_response({
                "code": row['code'],
                "name": row['name'],
                "market": row['market'],
                "type": row['type'],
                "cost": row['cost'],
                "alerts": json.loads(row['alerts_json']),
                "updated_at": row['updated_at']
            })
        else:
            self.send_json_response({"error": f"Stock {code} not found"}, 404)
    
    def handle_create_stock(self):
        """创建新股票"""
        try:
            body = self.read_body()
            if not body:
                self.send_json_response({"error": "Empty request body"}, 400)
                return
            
            stock = json.loads(body)
            
            # 验证必填字段
            required = ['code', 'name', 'market', 'type']
            for field in required:
                if field not in stock:
                    self.send_json_response({"error": f"Missing required field: {field}"}, 400)
                    return
            
            conn = get_db()
            cursor = conn.cursor()
            
            try:
                cursor.execute('''
                    INSERT INTO watchlist (code, name, market, type, cost, alerts_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    stock['code'],
                    stock['name'],
                    stock['market'],
                    stock['type'],
                    stock.get('cost', 0),
                    json.dumps(stock.get('alerts', {}), ensure_ascii=False)
                ))
                
                conn.commit()
                self.send_json_response({"success": True, "message": "Created"}, 201)
                
            except sqlite3.IntegrityError:
                self.send_json_response({"error": "Stock code already exists"}, 409)
            finally:
                conn.close()
                
        except json.JSONDecodeError:
            self.send_json_response({"error": "Invalid JSON"}, 400)
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)
    
    def handle_update_stock(self):
        """更新股票"""
        try:
            body = self.read_body()
            if not body:
                self.send_json_response({"error": "Empty request body"}, 400)
                return
            
            stock = json.loads(body)
            
            if 'code' not in stock:
                self.send_json_response({"error": "Missing stock code"}, 400)
                return
            
            conn = get_db()
            cursor = conn.cursor()
            
            # 检查是否存在
            cursor.execute('SELECT id FROM watchlist WHERE code = ?', (stock['code'],))
            if not cursor.fetchone():
                conn.close()
                self.send_json_response({"error": "Stock not found"}, 404)
                return
            
            # 更新字段
            updates = []
            params = []
            
            if 'name' in stock:
                updates.append('name = ?')
                params.append(stock['name'])
            
            if 'market' in stock:
                updates.append('market = ?')
                params.append(stock['market'])
            
            if 'type' in stock:
                updates.append('type = ?')
                params.append(stock['type'])
            
            if 'cost' in stock:
                updates.append('cost = ?')
                params.append(stock['cost'])
            
            if 'alerts' in stock:
                updates.append('alerts_json = ?')
                params.append(json.dumps(stock['alerts'], ensure_ascii=False))
            
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(stock['code'])
            
            query = f"UPDATE watchlist SET {', '.join(updates)} WHERE code = ?"
            cursor.execute(query, params)
            conn.commit()
            conn.close()
            
            self.send_json_response({"success": True, "message": "Updated"})
            
        except json.JSONDecodeError:
            self.send_json_response({"error": "Invalid JSON"}, 400)
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)
    
    def handle_delete_stock(self, code):
        """删除股票"""
        try:
            conn = get_db()
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM watchlist WHERE code = ?', (code,))
            
            if cursor.rowcount == 0:
                conn.close()
                self.send_json_response({"error": "Stock not found"}, 404)
                return
            
            conn.commit()
            conn.close()
            
            self.send_json_response({"success": True, "message": "Deleted"})
            
        except Exception as e:
            self.send_json_response({"error": str(e)}, 500)

def run_server(host='0.0.0.0', port=8080):
    """启动 HTTP 服务器"""
    init_db()
    
    # 如果没有数据，初始化默认数据
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM watchlist')
    count = cursor.fetchone()[0]
    conn.close()
    
    if count == 0:
        seed_initial_data()
    else:
        print(f"📊 Database has {count} stocks")
    
    # 确保静态目录存在
    STATIC_DIR.mkdir(exist_ok=True)
    
    server = HTTPServer((host, port), StockPoolHandler)
    print(f"🚀 Stock Pool API Server running on http://{host}:{port}")
    print(f"🌐 Tailscale access: http://100.111.204.29:{port}")
    print(f"📋 API: http://100.111.204.29:{port}/api/watchlist")
    print(f"🖥️  Web UI: http://100.111.204.29:{port}/")
    print()
    print("API 端点:")
    print("  GET    /api/watchlist       获取所有股票")
    print("  GET    /api/watchlist/{code} 获取单只股票")
    print("  POST   /api/watchlist       创建股票")
    print("  PUT    /api/watchlist       更新股票")
    print("  DELETE /api/watchlist/{code} 删除股票")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
        server.shutdown()

if __name__ == '__main__':
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == 'init':
        # 仅初始化数据库
        init_db()
        seed_initial_data()
    else:
        # 启动服务器
        run_server()
