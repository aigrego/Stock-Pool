module.exports = {
  apps: [{
    name: 'stock-collector',
    script: './dist/collector.js',
    cwd: '/root/workspaces/feishu-groups/shared-stockpool/data-collector',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      FETCH_INTERVAL: '5',
      STOCK_API_URL: 'http://localhost:3000/api',
      WS_TARGET_URL: 'http://localhost:3000'
    },
    log_file: './logs/collector.log',
    out_file: './logs/collector-out.log',
    error_file: './logs/collector-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
