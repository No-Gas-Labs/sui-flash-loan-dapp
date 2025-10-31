import { SuiClient, getFullnodeUrl } from '@mysten/sui.js';
import { TransactionBlock } from '@mysten/sui.js';
import { logger, auditLogger } from '@/utils/logger';
import { 
  FlashLoanError, 
  NetworkError, 
  TransactionResult, 
  RpcConfig,
  RetryConfig,
  GasEstimate 
} from '@/types';

// RPC Configuration with failover endpoints
const RPC_CONFIG: RpcConfig = {
  endpoints: [
    process.env.SUI_RPC_URL || getFullnodeUrl('testnet'),
    process.env.SUI_RPC_BACKUP_1 || 'https://sui-testnet.nodeinfra.com',
    process.env.SUI_RPC_BACKUP_2 || 'https://testnet.sui.rpcpool.com',
  ].filter(Boolean),
  currentEndpointIndex: 0,
  timeout: parseInt(process.env.RPC_TIMEOUT || '30000'),
  maxRetries: parseInt(process.env.RPC_MAX_RETRIES || '3')
};

// Retry configuration
const RETRY_CONFIG: RetryConfig = {
  maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || '3'),
  baseDelay: parseInt(process.env.RETRY_BASE_DELAY || '1000'),
  maxDelay: parseInt(process.env.RETRY_MAX_DELAY || '10000'),
  backoffFactor: parseFloat(process.env.RETRY_BACKOFF_FACTOR || '2'),
  jitter: process.env.RETRY_JITTER !== 'false'
};

let suiClient: SuiClient;
let currentRpcIndex = 0;

/**
 * Initialize Sui client with failover support
 */
export async function initializeSuiClient(): Promise<void> {
  try {
    await switchToNextRpcEndpoint();
    logger.info(`Sui client initialized with primary endpoint: ${RPC_CONFIG.endpoints[currentRpcIndex]}`);
  } catch (error) {
    logger.error('Failed to initialize Sui client:', error);
    throw new NetworkError('Failed to initialize Sui client', error);
  }
}

/**
 * Switch to next available RPC endpoint
 */
async function switchToNextRpcEndpoint(): Promise<void> {
  const maxRetries = RPC_CONFIG.endpoints.length;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const endpoint = RPC_CONFIG.endpoints[currentRpcIndex];
      logger.info(`Attempting to connect to RPC endpoint: ${endpoint}`);
      
      const testClient = new SuiClient({ url: endpoint });
      
      // Test connection with a simple getLatestSuiSystemState call
      await testClient.getLatestSuiSystemState();
      
      // If successful, use this client
      suiClient = testClient;
      RPC_CONFIG.currentEndpointIndex = currentRpcIndex;
      
      logger.info(`Successfully connected to RPC endpoint: ${endpoint}`);
      return;
      
    } catch (error) {
      logger.warn(`RPC endpoint ${RPC_CONFIG.endpoints[currentRpcIndex]} failed:`, error);
      
      // Move to next endpoint
      currentRpcIndex = (currentRpcIndex + 1) % RPC_CONFIG.endpoints.length;
      attempts++;
      
      if (attempts >= maxRetries) {
        throw new NetworkError('All RPC endpoints failed', { endpoints: RPC_CONFIG.endpoints });
      }
      
      // Wait before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Execute operation with automatic retry and failover
 */
export async function executeWithFailover<T>(
  operation: (client: SuiClient) => Promise<T>,
  options: Partial<RetryConfig> = {}
): Promise<T> {
  const config = { ...RETRY_CONFIG, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation(suiClient);
    } catch (error: any) {
      lastError = error;
      
      // Check if this is a network error that warrants failover
      const isNetworkError = 
        error.code === 'NETWORK_ERROR' ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('timeout') ||
        error.message?.includes('fetch failed');

      if (isNetworkError && attempt < RPC_CONFIG.endpoints.length) {
        logger.warn(`Network error detected, switching RPC endpoint:`, error);
        await switchToNextRpcEndpoint();
        continue;
      }

      // Don't retry on validation errors or final attempt
      if (error.code === 'VALIDATION_ERROR' || attempt >= config.maxAttempts) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        config.baseDelay * Math.pow(config.backoffFactor, attempt - 1),
        config.maxDelay
      );
      
      const jitter = config.jitter ? Math.random() * 1000 : 0;
      const totalDelay = delay + jitter;

      logger.warn(`Attempt ${attempt} failed, retrying in ${totalDelay}ms:`, error);
      
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }

  throw lastError!;
}

/**
 * Get current Sui client instance
 */
export function getSuiClient(): SuiClient {
  if (!suiClient) {
    throw new NetworkError('Sui client not initialized');
  }
  return suiClient;
}

/**
 * Get current RPC endpoint information
 */
export function getRpcStatus(): {
  currentEndpoint: string;
  allEndpoints: string[];
  currentIndex: number;
} {
  return {
    currentEndpoint: RPC_CONFIG.endpoints[currentRpcIndex],
    allEndpoints: RPC_CONFIG.endpoints,
    currentIndex: currentRpcIndex
  };
}

/**
 * Estimate gas cost for a transaction
 */
export async function estimateGasCost(
  transactionBlock: TransactionBlock,
  senderAddress: string
): Promise<GasEstimate> {
  try {
    const client = getSuiClient();
    
    // Build transaction for dry run
    const builtTx = await transactionBlock.build({ client });
    
    // Execute dry run
    const dryRunResult = await executeWithFailover(
      (client) => client.dryRunTransactionBlock({
        transactionBlock: builtTx,
      })
    );

    if (dryRunResult.effects.status.status !== 'success') {
      return {
        gasEstimate: 0,
        isValid: false,
        breakdown: {
          computationCost: 0,
          storageCost: 0,
          storageRebate: 0
        },
        error: 'Transaction would fail during execution'
      };
    }

    // Extract gas usage from simulation
    const gasUsed = dryRunResult.effects.gasUsed;
    const computationCost = Number(gasUsed.computationCost);
    const storageCost = Number(gasUsed.storageCost);
    const storageRebate = Number(gasUsed.storageRebate);
    
    const totalGas = computationCost + storageCost - storageRebate;
    
    // Add 20% buffer for safety
    const gasWithBuffer = Math.ceil(totalGas * 1.2);
    
    // Check if gas is within acceptable limits
    const maxGasBudget = parseInt(process.env.MAX_GAS_BUDGET || '1000000');
    const isValid = gasWithBuffer <= maxGasBudget;
    
    return {
      gasEstimate: gasWithBuffer,
      isValid,
      breakdown: {
        computationCost,
        storageCost,
        storageRebate
      },
      error: isValid ? undefined : `Gas cost ${gasWithBuffer} exceeds maximum allowed ${maxGasBudget}`
    };
    
  } catch (error: any) {
    logger.error('Gas estimation failed:', error);
    return {
      gasEstimate: 0,
      isValid: false,
      breakdown: {
        computationCost: 0,
        storageCost: 0,
        storageRebate: 0
      },
      error: `Gas estimation failed: ${error.message}`
    };
  }
}

/**
 * Execute transaction with retry and error handling
 */
export async function executeTransaction(
  transactionBlock: TransactionBlock,
  senderAddress: string,
  options: {
    gasBudget?: number;
    maxAttempts?: number;
  } = {}
): Promise<TransactionResult> {
  const gasBudget = options.gasBudget || parseInt(process.env.DEFAULT_GAS_BUDGET || '500000');
  
  try {
    // Set gas budget
    transactionBlock.setGasBudget(gasBudget);
    
    // Get sender and sign transaction (this would be done client-side in production)
    const client = getSuiClient();
    
    const result = await executeWithFailover(
      (client) => client.signAndExecuteTransactionBlock({
        transactionBlock,
        options: {
          showEffects: true,
          showEvents: true,
          showObjectChanges: true,
        },
        // In production, this would be signed by the client
        // signer: getSigner(),
      }),
      { maxAttempts: options.maxAttempts }
    );

    const status = result.effects?.status?.status === 'success' ? 'success' : 'failed';
    const gasUsed = result.effects?.gasUsed || { computationCost: '0', storageCost: '0', storageRebate: '0' };

    // Log transaction execution
    auditLogger.logPerformance({
      operation: 'execute_transaction',
      duration: 0, // Would be measured externally
      success: status === 'success',
      details: {
        txHash: result.digest,
        gasUsed,
        status
      }
    });

    return {
      digest: result.digest,
      status,
      effects: result.effects,
      events: result.events || [],
      gasUsed,
      error: status === 'failed' ? 'Transaction execution failed' : undefined
    };
    
  } catch (error: any) {
    logger.error('Transaction execution failed:', error);
    
    return {
      digest: '',
      status: 'failed',
      effects: null,
      events: [],
      gasUsed: { computationCost: '0', storageCost: '0', storageRebate: '0' },
      error: error.message
    };
  }
}

/**
 * Get object information
 */
export async function getObject(objectId: string) {
  return executeWithFailover(
    (client) => client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showOwner: true,
        showPreviousTransaction: true,
      }
    })
  );
}

/**
 * Get multiple objects
 */
export async function getMultiObject(objectIds: string[]) {
  return executeWithFailover(
    (client) => client.multiGetObjects({
      ids: objectIds,
      options: {
        showContent: true,
        showOwner: true,
      }
    })
  );
}

/**
 * Get events by transaction digest
 */
export async function getTransactionEvents(txDigest: string) {
  return executeWithFailover(
    (client) => client.getTransactionBlock({
      digest: txDigest,
      options: {
        showEvents: true,
        showEffects: true,
      }
    })
  );
}

/**
 * Health check for Sui RPC connection
 */
export async function checkSuiHealth(): Promise<boolean> {
  try {
    const client = getSuiClient();
    await client.getLatestSuiSystemState();
    return true;
  } catch (error) {
    logger.error('Sui health check failed:', error);
    return false;
  }
}

/**
 * Get current Sui system state
 */
export async function getSystemState() {
  return executeWithFailover(
    (client) => client.getLatestSuiSystemState()
  );
}

// Export constants
export const DEFAULT_GAS_BUDGET = parseInt(process.env.DEFAULT_GAS_BUDGET || '500000');
export const MAX_GAS_BUDGET = parseInt(process.env.MAX_GAS_BUDGET || '1000000');