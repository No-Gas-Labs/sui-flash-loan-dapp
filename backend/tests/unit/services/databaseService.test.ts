import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as databaseService from '../../../src/services/databaseService';

// Mock pg Pool
const mockPool = {
  connect: jest.fn(),
  query: jest.fn(),
  end: jest.fn(),
  on: jest.fn(),
};

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPool),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('DatabaseService', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
    jest.clearAllMocks();
    mockPool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(async () => {
    try {
      await databaseService.disconnectDatabase();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('connectDatabase', () => {
    test('should connect to database successfully', async () => {
      await databaseService.connectDatabase();
      
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalled();
      expect(mockClient.release).toHaveBeenCalled();
    });

    test('should throw error if DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      
      await expect(databaseService.connectDatabase()).rejects.toThrow(
        'DATABASE_URL environment variable is not set'
      );
    });

    test('should initialize database schema', async () => {
      await databaseService.connectDatabase();
      
      // Should have called queries for table creation
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('insertAuditLog', () => {
    test('should insert audit log successfully', async () => {
      await databaseService.connectDatabase();
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await databaseService.insertAuditLog({
        requestId: 'req-123',
        action: 'test_action',
        poolId: 'pool-456',
        borrower: '0x123abc',
        amount: 1000,
        status: 'success',
        ip: '127.0.0.1',
        userAgent: 'test-agent',
      });

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('updatePoolState', () => {
    test('should update pool state successfully', async () => {
      await databaseService.connectDatabase();
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await databaseService.updatePoolState('pool-123', {
        balance: 100000,
        feeRate: 5,
        isPaused: false,
        totalLoansIssued: 10,
        totalFeesCollected: 50,
      });

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('insertTransaction', () => {
    test('should insert transaction successfully', async () => {
      await databaseService.connectDatabase();
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await databaseService.insertTransaction({
        txHash: '0xabc123',
        poolId: 'pool-456',
        borrower: '0x123abc',
        amount: 1000,
        feeAmount: 5,
        status: 'success',
        gasUsed: 50000,
      });

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('getTransactionsByBorrower', () => {
    test('should retrieve transactions by borrower', async () => {
      await databaseService.connectDatabase();
      
      const mockTransactions = [
        { tx_hash: '0xabc', amount: 1000, status: 'success' },
        { tx_hash: '0xdef', amount: 2000, status: 'success' },
      ];
      
      mockPool.query.mockResolvedValue({ rows: mockTransactions, rowCount: 2 });

      const result = await databaseService.getTransactionsByBorrower('0x123abc', 10);

      expect(result).toEqual(mockTransactions);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('checkDatabaseHealth', () => {
    test('should return true when database is healthy', async () => {
      await databaseService.connectDatabase();
      mockPool.query.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 });
      
      const isHealthy = await databaseService.checkDatabaseHealth();
      
      expect(isHealthy).toBe(true);
    });

    test('should return false when database is unhealthy', async () => {
      await databaseService.connectDatabase();
      mockPool.query.mockRejectedValue(new Error('Connection failed'));
      
      const isHealthy = await databaseService.checkDatabaseHealth();
      
      expect(isHealthy).toBe(false);
    });
  });
});
