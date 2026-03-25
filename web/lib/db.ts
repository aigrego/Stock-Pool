import mysql from 'mysql2/promise';

// 解析 DATABASE_URL (如果存在)
// 格式: mysql://user:password@host:port/database?ssl=true
function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const sslParam = parsed.searchParams.get('ssl');
    
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '3306'),
      user: decodeURIComponent(parsed.username || 'root'),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname?.replace('/', '') || 'stockpool',
      ssl: sslParam === 'true' || parsed.protocol === 'mysqls:' ? {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
      } : undefined
    };
  } catch (error) {
    console.error('Failed to parse DATABASE_URL:', error);
    throw new Error('Invalid DATABASE_URL format. Expected: mysql://user:pass@host:port/db?ssl=true');
  }
}

// 获取数据库配置
function getDbConfig() {
  // 优先使用 DATABASE_URL
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL for database connection');
    return parseDatabaseUrl(process.env.DATABASE_URL);
  }
  
  // 回退到分开的配置
  console.log('Using separate DB_* environment variables');
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stockpool',
    ssl: process.env.DB_SSL === 'true' || process.env.TIDB_SSL === 'true' ? {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    } : undefined
  };
}

// 连接池
let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    const config = getDbConfig();
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return pool;
}

export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const pool = await getPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// 初始化数据库表
export async function initDb() {
  const pool = await getPool();
  const connection = await pool.getConnection();
  
  try {
    // 股票池表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS watchlist (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        market VARCHAR(10) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'individual',
        cost DECIMAL(10, 4) DEFAULT 0,
        alerts_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 操作日志表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        code VARCHAR(20),
        details TEXT,
        agent_id VARCHAR(100),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 预警历史表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        current_value DECIMAL(10, 4),
        threshold_value DECIMAL(10, 4),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_code_type_time (code, alert_type, created_at)
      )
    `);

    console.log('Database initialized successfully');
  } finally {
    connection.release();
  }
}
