import { Pool, PoolClient } from 'pg';
import { logger } from '@/utils/logger';

let pool: Pool;

/**
 * Connect to PostgreSQL database
 */
export async function connectDatabase(): Promise<void> {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    logger.info('Database connected successfully');
    
    // Initialize schema
    await initializeSchema();
    
  } catch (error) {
    logger.error('Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Initialize database schema
 */
async function initializeSchema(): Promise<void> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Audit logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        request_id VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        pool_id VARCHAR(255),
        borrower VARCHAR(255),
        amount BIGINT,
        tx_hash VARCHAR(255),
        status VARCHAR(50) NOT NULL,
        gas_used BIGINT,
        error TEXT,
        ip VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Pool state table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pool_state (
        pool_id VARCHAR(255) PRIMARY KEY,
        balance BIGINT NOT NULL,
        fee_rate INTEGER NOT NULL,
        is_paused BOOLEAN DEFAULT FALSE,
        total_loans_issued BIGINT DEFAULT 0,
        total_fees_collected BIGINT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        tx_hash VARCHAR(255) UNIQUE NOT NULL,
        pool_id VARCHAR(255) NOT NULL,
        borrower VARCHAR(255) NOT NULL,
        amount BIGINT NOT NULL,
        fee_amount BIGINT NOT NULL,
        status VARCHAR(50) NOT NULL,
        gas_used BIGINT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_borrower ON audit_logs(borrower);
      CREATE INDEX IF NOT EXISTS idx_transactions_borrower ON transactions(borrower);
      CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
    `);

    await client.query('COMMIT');
    logger.info('Database schema initialized');
    
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Failed to initialize schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Get database pool
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}

/**
 * Execute query
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: result.rowCount });
    return result;
  } catch (error) {
    logger.error('Query error:', { text, error });
    throw error;
  }
}

/**
 * Get client from pool
 */
export async function getClient(): Promise<PoolClient> {
  return await pool.connect();
}

/**
 * Insert audit log
 */
export async function insertAuditLog(data: {
  requestId: string;
  action: string;
  poolId?: string;
  borrower?: string;
  amount?: number;
  txHash?: string;
  status: string;
  gasUsed?: number;
  error?: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  await query(
    `INSERT INTO audit_logs 
     (request_id, action, pool_id, borrower, amount, tx_hash, status, gas_used, error, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      data.requestId,
      data.action,
      data.poolId,
      data.borrower,
      data.amount,
      data.txHash,
      data.status,
      data.gasUsed,
      data.error,
      data.ip,
      data.userAgent
    ]
  );
}

/**
 * Update pool state
 */
export async function updatePoolState(poolId: string, state: {
  balance: number;
  feeRate: number;
  isPaused: boolean;
  totalLoansIssued: number;
  totalFeesCollected: number;
}): Promise<void> {
  await query(
    `INSERT INTO pool_state (pool_id, balance, fee_rate, is_paused, total_loans_issued, total_fees_collected, last_updated)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (pool_id) 
     DO UPDATE SET 
       balance = $2,
       fee_rate = $3,
       is_paused = $4,
       total_loans_issued = $5,
       total_fees_collected = $6,
       last_updated = CURRENT_TIMESTAMP`,
    [poolId, state.balance, state.feeRate, state.isPaused, state.totalLoansIssued, state.totalFeesCollected]
  );
}

/**
 * Insert transaction
 */
export async function insertTransaction(data: {
  txHash: string;
  poolId: string;
  borrower: string;
  amount: number;
  feeAmount: number;
  status: string;
  gasUsed?: number;
}): Promise<void> {
  await query(
    `INSERT INTO transactions (tx_hash, pool_id, borrower, amount, fee_amount, status, gas_used)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [data.txHash, data.poolId, data.borrower, data.amount, data.feeAmount, data.status, data.gasUsed]
  );
}

/**
 * Get transactions by borrower
 */
export async function getTransactionsByBorrower(borrower: string, limit: number = 50): Promise<any[]> {
  const result = await query(
    `SELECT * FROM transactions WHERE borrower = $1 ORDER BY timestamp DESC LIMIT $2`,
    [borrower, limit]
  );
  return result.rows;
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Disconnect database
 */
export async function disconnectDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
  }
}