import mysql from 'mysql2/promise';

// 数据库配置 - 本地开发用 SQLite 或本地 MySQL，部署时通过环境变量配置 TiDB
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'stockpool',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  // TiDB Serverless 需要 SSL
  ...(process.env.TIDB_SSL === 'true' && {
    ssl: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: true
    }
  })
};

// 连接池
let pool: mysql.Pool | null = null;

export async function getPool(): Promise<mysql.Pool> {
  if (!pool) {
    pool = mysql.createPool({
      ...dbConfig,
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

    console.log('Database initialized successfully');
  } finally {
    connection.release();
  }
}
