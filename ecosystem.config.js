module.exports = {
  apps: [
    {
      name: 'stock-collector',
      script: './data-collector/dist/collector.js',
      cwd: '/root/workspaces/feishu-groups/shared-stockpool',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        FETCH_INTERVAL: '5',
        STOCK_API_URL: 'https://pool.aigrego.com/api',
        WS_TARGET_URL: 'http://100.111.204.29:3001'
      },
      log_file: './data-collector/logs/collector.log',
      out_file: './data-collector/logs/collector-out.log',
      error_file: './data-collector/logs/collector-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    },
    {
      name: 'stock-socket',
      script: './socket-server.js',
      cwd: '/root/workspaces/feishu-groups/shared-stockpool',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: '3001'
      },
      log_file: './data-collector/logs/socket.log',
      out_file: './data-collector/logs/socket-out.log',
      error_file: './data-collector/logs/socket-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
