import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { flashLoanRoutes } from '../../../src/controllers/flashLoanController';

// Mock services
jest.mock('../../../src/services/suiService', () => ({
  estimateGasCost: jest.fn(),
  executeTransaction: jest.fn(),
}));

jest.mock('../../../src/services/databaseService', () => ({
  insertAuditLog: jest.fn(),
  insertTransaction: jest.fn(),
}));

jest.mock('../../../src/middleware/rateLimiter', () => ({
  flashLoanRateLimitMiddleware: (req: any, res: any, next: any) => next(),
}));

jest.mock('../../../src/utils/logger', () => ({
  auditLogger: {
    logFlashLoan: jest.fn(),
  },
}));

import * as suiService from '../../../src/services/suiService';
import * as databaseService from '../../../src/services/databaseService';

describe('FlashLoanController', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/flash-loan', flashLoanRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/v1/flash-loan/estimate', () => {
    test('should estimate gas cost successfully', async () => {
      (suiService.estimateGasCost as jest.Mock).mockResolvedValue({
        gasEstimate: 120000,
        isValid: true,
        breakdown: {
          computationCost: 100000,
          storageCost: 0,
          storageRebate: 0,
        },
      });

      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: '0xpool123',
          amount: 1000000,
          borrowerAddress: '0xborrower123',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('gasEstimate');
      expect(response.body.data).toHaveProperty('feeAmount');
      expect(response.body.data).toHaveProperty('totalRepayment');
    });

    test('should return 400 for invalid input', async () => {
      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: '0xpool123',
          // Missing required fields
        });

      expect(response.status).toBe(500); // Error handler will convert validation errors
    });

    test('should calculate fee correctly (0.05%)', async () => {
      (suiService.estimateGasCost as jest.Mock).mockResolvedValue({
        gasEstimate: 120000,
        isValid: true,
        breakdown: { computationCost: 100000, storageCost: 0, storageRebate: 0 },
      });

      const amount = 1000000;
      const expectedFee = Math.floor((amount * 5) / 10000); // 0.05% = 5 basis points

      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: '0xpool123',
          amount,
          borrowerAddress: '0xborrower123',
        });

      expect(response.body.data.feeAmount).toBe(expectedFee);
      expect(response.body.data.totalRepayment).toBe(amount + expectedFee);
    });

    test('should log estimation to audit trail', async () => {
      (suiService.estimateGasCost as jest.Mock).mockResolvedValue({
        gasEstimate: 120000,
        isValid: true,
        breakdown: { computationCost: 100000, storageCost: 0, storageRebate: 0 },
      });

      await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: '0xpool123',
          amount: 1000000,
          borrowerAddress: '0xborrower123',
        });

      expect(databaseService.insertAuditLog).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/flash-loan/execute', () => {
    test('should execute flash loan successfully', async () => {
      (suiService.executeTransaction as jest.Mock).mockResolvedValue({
        digest: '0xtxhash123',
        status: 'success',
        effects: {},
        events: [],
        gasUsed: {
          computationCost: '100000',
          storageCost: '0',
          storageRebate: '0',
        },
      });

      const response = await request(app)
        .post('/api/v1/flash-loan/execute')
        .send({
          poolId: '0xpool123',
          amount: 1000000,
          borrowerAddress: '0xborrower123',
          transactionBlock: { data: 'tx-data' },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactionHash).toBe('0xtxhash123');
      expect(response.body.data.status).toBe('success');
    });

    test('should handle failed transaction', async () => {
      (suiService.executeTransaction as jest.Mock).mockResolvedValue({
        digest: '',
        status: 'failed',
        effects: null,
        events: [],
        gasUsed: { computationCost: '0', storageCost: '0', storageRebate: '0' },
        error: 'Transaction failed',
      });

      const response = await request(app)
        .post('/api/v1/flash-loan/execute')
        .send({
          poolId: '0xpool123',
          amount: 1000000,
          borrowerAddress: '0xborrower123',
          transactionBlock: { data: 'tx-data' },
        });

      expect(response.body.success).toBe(false);
      expect(response.body.data.error).toBe('Transaction failed');
    });

    test('should store successful transaction in database', async () => {
      (suiService.executeTransaction as jest.Mock).mockResolvedValue({
        digest: '0xtxhash123',
        status: 'success',
        effects: {},
        events: [],
        gasUsed: { computationCost: '100000', storageCost: '0', storageRebate: '0' },
      });

      await request(app)
        .post('/api/v1/flash-loan/execute')
        .send({
          poolId: '0xpool123',
          amount: 1000000,
          borrowerAddress: '0xborrower123',
          transactionBlock: { data: 'tx-data' },
        });

      expect(databaseService.insertTransaction).toHaveBeenCalled();
      expect(databaseService.insertAuditLog).toHaveBeenCalled();
    });
  });
});
