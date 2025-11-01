import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

let redisClient: RedisClientType;

/**
 * Connect to Redis
 */
export async function connectRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting');
    });

    await redisClient.connect();
    
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

/**
 * Get Redis client instance
 */
export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
}

/**
 * Set value with expiration
 */
export async function setWithExpiry(
  key: string,
  value: string,
  expirySeconds: number
): Promise<void> {
  await redisClient.setEx(key, expirySeconds, value);
}

/**
 * Get value
 */
export async function get(key: string): Promise<string | null> {
  return await redisClient.get(key);
}

/**
 * Delete key
 */
export async function del(key: string): Promise<void> {
  await redisClient.del(key);
}

/**
 * Increment counter
 */
export async function incr(key: string): Promise<number> {
  return await redisClient.incr(key);
}

/**
 * Set expiry on existing key
 */
export async function expire(key: string, seconds: number): Promise<void> {
  await redisClient.expire(key, seconds);
}

/**
 * Check Redis health
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return false;
  }
}

/**
 * Disconnect Redis
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}