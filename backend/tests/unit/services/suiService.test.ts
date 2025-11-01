import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SuiClient } from '@mysten/sui.js';
import * as suiService from '../../../src/services/suiService';

// Mock SuiClient
jest.mock('@mysten/sui.js', () => ({
  SuiClient: jest.fn(),
  getFullnodeUrl: jest.fn(() => 'https://fullnode.testnet.sui.io:443'),
  TransactionBlock: jest.fn(() => ({
    build: jest.fn(),
    setGasBudget: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  auditLogger: {
    logPerformance: jest.fn(),
  },
}));

describe('SuiService', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      getLatestSuiSystemState: jest.fn().mockResolvedValue({ epoch: '100' }),
      dryRunTransactionBlock: jest.fn(),
      signAndExecuteTransactionBlock: jest.fn(),
      getObject: jest.fn(),
      multiGetObjects: jest.fn(),
      getTransactionBlock: jest.fn(),
    };

    (SuiClient as jest.Mock).mockImplementation(() => mockClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeSuiClient', () => {
    test('should initialize Sui client successfully', async () => {
      await suiService.initializeSuiClient();
      expect(SuiClient).toHaveBeenCalled();
      expect(mockClient.getLatestSuiSystemState).toHaveBeenCalled();
    });

    test('should throw NetworkError if all endpoints fail', async () => {
      mockClient.getLatestSuiSystemState.mockRejectedValue(new Error('Connection failed'));
      
      await expect(suiService.initializeSuiClient()).rejects.toThrow();
    });
  });

  describe('estimateGasCost', () => {
    const mockTransactionBlock: any = {
      build: jest.fn().mockResolvedValue('built-tx'),
    };

    test('should estimate gas cost successfully', async () => {
      await suiService.initializeSuiClient();
      
      mockClient.dryRunTransactionBlock.mockResolvedValue({
        effects: {
          status: { status: 'success' },
          gasUsed: {
            computationCost: '100000',
            storageCost: '50000',
            storageRebate: '10000',
          },
        },
      });

      const result = await suiService.estimateGasCost(
        mockTransactionBlock,
        '0x123abc'
      );

      expect(result.isValid).toBe(true);
      expect(result.gasEstimate).toBeGreaterThan(0);
      expect(result.breakdown).toBeDefined();
    });

    test('should return invalid estimate if transaction would fail', async () => {
      await suiService.initializeSuiClient();
      
      mockClient.dryRunTransactionBlock.mockResolvedValue({
        effects: {
          status: { status: 'failure' },
          gasUsed: {
            computationCost: '0',
            storageCost: '0',
            storageRebate: '0',
          },
        },
      });

      const result = await suiService.estimateGasCost(
        mockTransactionBlock,
        '0x123abc'
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should add 20% safety buffer to gas estimate', async () => {
      await suiService.initializeSuiClient();
      
      const baseGas = 100000;
      mockClient.dryRunTransactionBlock.mockResolvedValue({
        effects: {
          status: { status: 'success' },
          gasUsed: {
            computationCost: String(baseGas),
            storageCost: '0',
            storageRebate: '0',
          },
        },
      });

      const result = await suiService.estimateGasCost(
        mockTransactionBlock,
        '0x123abc'
      );

      expect(result.gasEstimate).toBe(Math.ceil(baseGas * 1.2));
    });
  });

  describe('executeWithFailover', () => {
    test('should execute operation successfully on first attempt', async () => {
      await suiService.initializeSuiClient();
      
      const operation = jest.fn().mockResolvedValue({ data: 'success' });
      const result = await suiService.executeWithFailover(operation);

      expect(result).toEqual({ data: 'success' });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    test('should retry on network error', async () => {
      await suiService.initializeSuiClient();
      
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce({ data: 'success' });

      const result = await suiService.executeWithFailover(operation, { maxAttempts: 2 });

      expect(result).toEqual({ data: 'success' });
      expect(operation).toHaveBeenCalledTimes(2);
    });

    test('should throw error after max attempts', async () => {
      await suiService.initializeSuiClient();
      
      const operation = jest.fn().mockRejectedValue(new Error('Persistent error'));

      await expect(
        suiService.executeWithFailover(operation, { maxAttempts: 3 })
      ).rejects.toThrow('Persistent error');

      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('checkSuiHealth', () => {
    test('should return true when Sui is healthy', async () => {
      await suiService.initializeSuiClient();
      
      const isHealthy = await suiService.checkSuiHealth();
      expect(isHealthy).toBe(true);
    });

    test('should return false when Sui is unhealthy', async () => {
      await suiService.initializeSuiClient();
      mockClient.getLatestSuiSystemState.mockRejectedValue(new Error('Connection failed'));
      
      const isHealthy = await suiService.checkSuiHealth();
      expect(isHealthy).toBe(false);
    });
  });

  describe('getRpcStatus', () => {
    test('should return current RPC endpoint information', async () => {
      await suiService.initializeSuiClient();
      
      const status = suiService.getRpcStatus();
      
      expect(status).toHaveProperty('currentEndpoint');
      expect(status).toHaveProperty('allEndpoints');
      expect(status).toHaveProperty('currentIndex');
      expect(Array.isArray(status.allEndpoints)).toBe(true);
    });
  });
});
