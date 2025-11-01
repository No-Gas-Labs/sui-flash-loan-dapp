import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { apiLogger } from '@/utils/logger';

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = uuidv4();
  const startTime = Date.now();

  // Attach request ID to request
  req.headers['x-request-id'] = requestId;

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    apiLogger.logRequest(req, res, duration);
  });

  next();
}