import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '@/services/redisService';
import { logger, auditLogger } from '@/utils/logger';
import { RateLimitExceededError } from '@/types';

/**
 * Global rate limiter - applies to all requests
 */
export const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_REQUESTS || '100'),
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:global:',
  }),
  handler: (req: Request, res: Response) => {
    auditLogger.logSecurityEvent({
      event: 'RATE_LIMIT_EXCEEDED',
      severity: 'medium',
      details: {
        ip: req.ip,
        path: req.path,
        limit: 'global'
      },
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP, please try again later',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Flash loan endpoint rate limiter
 */
export const flashLoanRateLimiter = rateLimit({
  windowMs: 60000,
  max: 10,
  message: 'Too many flash loan requests',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: getRedisClient(),
    prefix: 'rl:flashloan:',
  }),
  handler: (req: Request, res: Response) => {
    auditLogger.logSecurityEvent({
      event: 'RATE_LIMIT_EXCEEDED',
      severity: 'high',
      details: {
        ip: req.ip,
        path: req.path,
        limit: 'flash_loan'
      },
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    });

    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many flash loan requests, please try again later',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Wallet address-based rate limiter
 */
export const walletRateLimiter = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const walletAddress = req.body.borrowerAddress || req.body.walletAddress;
    
    if (!walletAddress) {
      return next();
    }

    const redisClient = getRedisClient();
    const key = `rl:wallet:${walletAddress}`;
    
    const count = await redisClient.incr(key);
    
    if (count === 1) {
      await redisClient.expire(key, 60);
    }
    
    const maxRequests = 5;
    
    if (count > maxRequests) {
      auditLogger.logSecurityEvent({
        event: 'RATE_LIMIT_EXCEEDED',
        severity: 'high',
        details: {
          walletAddress,
          count,
          maxRequests,
          limit: 'wallet'
        },
        ip: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown'
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests from wallet ${walletAddress}. Maximum ${maxRequests} requests per minute.`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  } catch (error) {
    logger.error('Wallet rate limiter error:', error);
    next();
  }
};

/**
 * Combined rate limiting middleware
 */
export const rateLimitMiddleware = [globalRateLimiter];

/**
 * Flash loan specific rate limiting
 */
export const flashLoanRateLimitMiddleware = [
  globalRateLimiter,
  flashLoanRateLimiter,
  walletRateLimiter
];