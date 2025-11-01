// Jest setup file
import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.SUI_NETWORK = 'testnet';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.MAX_GAS_BUDGET = '1000000';
process.env.DEFAULT_GAS_BUDGET = '500000';
process.env.RETRY_MAX_ATTEMPTS = '3';
process.env.RETRY_BASE_DELAY = '1000';
process.env.RPC_TIMEOUT = '30000';
process.env.RPC_MAX_RETRIES = '3';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
