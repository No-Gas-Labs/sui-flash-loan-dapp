export interface AuditLogRow {
  id: number;
  request_id: string;
  action: string;
  pool_id?: string;
  borrower?: string;
  amount?: string;
  tx_hash?: string;
  status: string;
  gas_used?: string;
  error?: string;
  ip: string;
  user_agent: string;
  timestamp: Date;
  created_at: Date;
}

export interface PoolStateRow {
  pool_id: string;
  balance: string;
  fee_rate: number;
  is_paused: boolean;
  total_loans_issued: string;
  total_fees_collected: string;
  last_updated: Date;
}

export interface TransactionRow {
  id: number;
  tx_hash: string;
  pool_id: string;
  borrower: string;
  amount: string;
  fee_amount: string;
  status: string;
  gas_used?: string;
  timestamp: Date;
  created_at: Date;
}