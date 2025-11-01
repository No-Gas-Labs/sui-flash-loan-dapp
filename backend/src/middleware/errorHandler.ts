import { Request, Response, NextFunction } from 'express';
import { FlashLoanError } from '@/types';
import { apiLogger } from '@/utils/logger';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error | FlashLoanError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  apiLogger.logError(error, req);

  // Handle FlashLoanError
  if (error instanceof FlashLoanError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
      requestId: req.headers['x-request-id'] || 'unknown',
    });
    return;
  }

  // Handle generic errors
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown',
  });
}