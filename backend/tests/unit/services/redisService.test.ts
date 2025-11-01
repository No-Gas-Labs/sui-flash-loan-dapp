import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as redisService from '../../../src/services/redisService';

// Mock Redis client
const mockRedisClient = {
  connect: jest.fn(),
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn(() => mockRedisClient),
}));

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('RedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.connect.mockResolvedValue(undefined);
    mockRedisClient.ping.mockResolvedValue('PONG');
  });

  afterEach(async () => {
    try {
      await redisService.disconnectRedis();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('connectRedis', () => {
    test('should connect to Redis successfully', async () => {
      await redisService.connectRedis();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    test('should throw error if connection fails', async () => {
      mockRedisClient.connect.mockRejectedValue(new Error('Connection failed'));
      
      await expect(redisService.connectRedis()).rejects.toThrow('Connection failed');
    });
  });

  describe('setWithExpiry', () => {
    test('should set value with expiration', async () => {
      await redisService.connectRedis();
      mockRedisClient.setEx.mockResolvedValue('OK');

      await redisService.setWithExpiry('test-key', 'test-value', 300);

      expect(mockRedisClient.setEx).toHaveBeenCalledWith('test-key', 300, 'test-value');
    });
  });

  describe('get', () => {
    test('should get value by key', async () => {
      await redisService.connectRedis();
      mockRedisClient.get.mockResolvedValue('test-value');

      const result = await redisService.get('test-key');

      expect(result).toBe('test-value');
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    test('should return null for non-existent key', async () => {
      await redisService.connectRedis();
      mockRedisClient.get.mockResolvedValue(null);

      const result = await redisService.get('non-existent-key');

      expect(result).toBeNull();
    });
  });

  describe('incr', () => {
    test('should increment counter', async () => {
      await redisService.connectRedis();
      mockRedisClient.incr.mockResolvedValue(1);

      const result = await redisService.incr('counter-key');

      expect(result).toBe(1);
      expect(mockRedisClient.incr).toHaveBeenCalledWith('counter-key');
    });

    test('should return incremented value', async () => {
      await redisService.connectRedis();
      mockRedisClient.incr.mockResolvedValue(5);

      const result = await redisService.incr('counter-key');

      expect(result).toBe(5);
    });
  });

  describe('checkRedisHealth', () => {
    test('should return true when Redis is healthy', async () => {
      await redisService.connectRedis();
      
      const isHealthy = await redisService.checkRedisHealth();
      
      expect(isHealthy).toBe(true);
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    test('should return false when Redis is unhealthy', async () => {
      await redisService.connectRedis();
      mockRedisClient.ping.mockRejectedValue(new Error('Connection lost'));
      
      const isHealthy = await redisService.checkRedisHealth();
      
      expect(isHealthy).toBe(false);
    });
  });
});
