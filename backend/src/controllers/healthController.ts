import { Request, Response, Router } from 'express';
import { checkSuiHealth, getRpcStatus } from '@/services/suiService';
import { checkRedisHealth } from '@/services/redisService';
import { checkDatabaseHealth } from '@/services/databaseService';

const router = Router();

/**
 * Basic health check
 */
async function health(req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  });
}

/**
 * Detailed health check
 */
async function detailedHealth(req: Request, res: Response): Promise<void> {
  const [suiHealthy, redisHealthy, dbHealthy] = await Promise.all([
    checkSuiHealth(),
    checkRedisHealth(),
    checkDatabaseHealth(),
  ]);

  const rpcStatus = getRpcStatus();
  const memoryUsage = process.memoryUsage();

  const isHealthy = suiHealthy && redisHealthy && dbHealthy;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    dependencies: {
      sui: suiHealthy ? 'connected' : 'disconnected',
      redis: redisHealthy ? 'connected' : 'disconnected',
      database: dbHealthy ? 'connected' : 'disconnected',
    },
    rpc: {
      currentEndpoint: rpcStatus.currentEndpoint,
      allEndpoints: rpcStatus.allEndpoints,
      currentIndex: rpcStatus.currentIndex,
    },
    system: {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      cpu: process.cpuUsage(),
    },
  });
}

export const healthRoutes = {
  health,
  detailedHealth,
};

export default router;