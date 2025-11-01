import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../src/index';

describe('Flash Loan Integration Tests', () => {
  beforeAll(async () => {
    // Wait for services to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup
  });

  describe('Health Checks', () => {
    test('GET /health should return 200', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
    });

    test('GET /health/detailed should return system status', async () => {
      const response = await request(app).get('/health/detailed');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('Flash Loan Workflow', () => {
    const testPoolId = '0xtest_pool_id';
    const testBorrower = '0xtest_borrower_address';
    const testAmount = 1000000;

    test('should estimate gas cost for flash loan', async () => {
      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: testPoolId,
          amount: testAmount,
          borrowerAddress: testBorrower,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('gasEstimate');
      expect(response.body.data).toHaveProperty('feeAmount');
    });

    test('should validate input parameters', async () => {
      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          poolId: testPoolId,
          amount: -1000, // Invalid amount
          borrowerAddress: testBorrower,
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits', async () => {
      const requests = [];
      
      // Send multiple requests quickly
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/v1/flash-loan/estimate')
            .send({
              poolId: '0xtest_pool',
              amount: 1000000,
              borrowerAddress: '0xtest_borrower',
            })
        );
      }

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.filter(r => r.status === 429);
      
      // Should have at least some rate-limited responses
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/api/v1/flash-loan/estimate')
        .send({
          // Missing required fields
        });

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/v1/unknown-route');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('NOT_FOUND');
    });
  });
});
