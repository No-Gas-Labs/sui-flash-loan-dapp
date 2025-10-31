import { TransactionBlock } from '@mysten/sui.js';

// Core types
export interface FlashLoanRequest {
  poolId: string;
  amount: number;
  borrowerAddress: string;
}

export interface FlashLoanResult {
  transactionHash: string;
  status: 'success' | 'failed';
  receipt?: LoanReceipt;
  feeAmount: number;
  gasUsed: number;
  error?: string;
}

export interface LoanReceipt {
  loanId: string;
  poolId: string;
  borrower: string;
  amountBorrowed: number;
  feeAmount: number;
  timestamp: number;
  isRepaid: boolean;
}

export interface PoolInfo {
  poolId: string;
  owner: string;
  balance: number;
  feeRate: number;
  isPaused: boolean;
  totalLoansIssued: number;
  totalFeesCollected: number;
  poolVersion: number;
  createdAt: number;
  maxLoanAmount: number;
  activeLoansCount: number;
}

export interface GasEstimate {
  gasEstimate: number;
  isValid: boolean;
  breakdown: {
    computationCost: number;
    storageCost: number;
    storageRebate: number;
  };
  error?: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Database types
export interface AuditLog {
  id: string;
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
  timestamp: Date;
}

export interface PoolState {
  poolId: string;
  balance: number;
  feeRate: number;
  isPaused: boolean;
  totalLoansIssued: number;
  totalFeesCollected: number;
  lastUpdated: Date;
}

// Configuration types
export interface RpcConfig {
  endpoints: string[];
  currentEndpointIndex: number;
  timeout: number;
  maxRetries: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

// Event types
export interface FlashLoanEvent {
  type: 'initiated' | 'repaid' | 'failed';
  poolId: string;
  loanId: string;
  borrower: string;
  amount: number;
  feeAmount: number;
  timestamp: number;
  txHash?: string;
  error?: string;
}

export interface PoolEvent {
  type: 'created' | 'paused' | 'resumed' | 'upgraded';
  poolId: string;
  triggeredBy: string;
  timestamp: number;
  data?: any;
}

// Validation schemas
export interface FlashLoanValidationSchema {
  poolId: string;
  amount: number;
  borrowerAddress: string;
}

export interface PoolUpdateSchema {
  feeRate?: number;
  maxLoanAmount?: number;
}

// Error types
export class FlashLoanError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: any;

  constructor(code: string, message: string, statusCode: number = 500, details?: any) {
    super(message);
    this.name = 'FlashLoanError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class ValidationError extends FlashLoanError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
  }
}

export class NetworkError extends FlashLoanError {
  constructor(message: string, details?: any) {
    super('NETWORK_ERROR', message, 503, details);
  }
}

export class InsufficientLiquidityError extends FlashLoanError {
  constructor(poolId: string, requested: number, available: number) {
    super(
      'INSUFFICIENT_LIQUIDITY',
      `Pool ${poolId} has insufficient liquidity. Requested: ${requested}, Available: ${available}`,
      400,
      { poolId, requested, available }
    );
  }
}

export class RateLimitExceededError extends FlashLoanError {
  constructor(limit: number, windowMs: number) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Maximum ${limit} requests per ${windowMs}ms`,
      429,
      { limit, windowMs }
    );
  }
}

// Transaction types
export interface TransactionRequest {
  transactionBlock: TransactionBlock;
  sender: string;
  gasBudget?: number;
}

export interface TransactionResult {
  digest: string;
  status: 'success' | 'failed';
  effects: any;
  events: any[];
  gasUsed: any;
  error?: string;
}

// Monitoring types
export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  dependencies: {
    redis: 'connected' | 'disconnected';
    database: 'connected' | 'disconnected';
    sui: 'connected' | 'disconnected';
  };
  metrics: {
    requestsPerMinute: number;
    errorRate: number;
    responseTime: number;
  };
}

export interface Metrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  requestsPerMinute: number;
  errorRate: number;
  activeConnections: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
}

// Utility types
export type Address = string;
export type PoolId = string;
export type LoanId = string;
export type TransactionHash = string;

export type OperationResult<T = void> = {
  success: boolean;
  data?: T;
  error?: FlashLoanError;
};

export type AsyncFunction<T = void> = () => Promise<T>;
export type WithRetryOptions = {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  jitter?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
};

// Export all types
export * from './sui';
export * from './database';