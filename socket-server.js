/**
 * 独立的 Socket.io 服务端
 * 在 kimiclaw 上运行，接收数据收集器推送，广播给前端
 */

const { Server } = require('socket.io');
const http = require('http');

const PORT = process.env.SOCKET_PORT || 3001;

const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: '*', // 允许所有来源（生产环境应限制）
    methods: ['GET', 'POST']
  }
});

// 存储客户端连接
const clients = new Map();
const collectors = new Set();

io.on('connection', (socket) => {
  console.log(`[Socket.io] 客户端连接: ${socket.id}`);
  
  clients.set(socket.id, {
    id: socket.id,
    type: 'unknown',
    connectedAt: Date.now()
  });

  // 注册客户端类型
  socket.on('register', (data) => {
    const client = clients.get(socket.id);
    if (client) {
      client.type = data.type || 'client';
      
      if (data.type === 'collector') {
        collectors.add(socket.id);
        console.log(`[Socket.io] 数据收集器已注册: ${socket.id}`);
      } else {
        console.log(`[Socket.io] 前端客户端已注册: ${socket.id}`);
      }
    }
  });

  // 接收实时行情数据（来自数据收集器）
  socket.on('quotes', (data) => {
    const client = clients.get(socket.id);
    
    // 只允许数据收集器推送
    if (client?.type !== 'collector') {
      console.warn(`[Socket.io] 非收集器尝试推送数据: ${socket.id}`);
      return;
    }

    // 广播给所有前端客户端
    io.emit('quotes', data);
    
    console.log(`[Socket.io] 广播 ${data.data?.length || 0} 条行情数据`);
  });

  // 接收单条行情更新
  socket.on('quote', (data) => {
    const client = clients.get(socket.id);
    if (client?.type === 'collector') {
      io.emit('quote', data);
    }
  });

  // 断开连接
  socket.on('disconnect', () => {
    const client = clients.get(socket.id);
    
    if (client?.type === 'collector') {
      collectors.delete(socket.id);
    }
    
    clients.delete(socket.id);
    console.log(`[Socket.io] 客户端断开: ${socket.id}`);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Socket.io] 服务端运行在端口 ${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n[Socket.io] 收到 SIGINT，正在关闭...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n[Socket.io] 收到 SIGTERM，正在关闭...');
  server.close(() => {
    process.exit(0);
  });
});
