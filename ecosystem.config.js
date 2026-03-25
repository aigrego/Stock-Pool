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
        STOCK_API_URL: 'https://pool.aigrego.com/api'
      },
      log_file: './data-collector/logs/collector.log',
      out_file: './data-collector/logs/collector-out.log',
      error_file: './data-collector/logs/collector-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
