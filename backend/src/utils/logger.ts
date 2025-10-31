import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Create the logger
export const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Create a stream object for Morgan HTTP logging
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Audit logging function for flash loan operations
export const auditLogger = {
  logFlashLoan: (data: {
    requestId: string;
    poolId: string;
    borrower: string;
    amount: number;
    feeAmount: number;
    txHash?: string;
    status: string;
    gasUsed?: number;
    error?: string;
    ip: string;
    userAgent: string;
  }) => {
    logger.info('Flash loan operation', {
      type: 'FLASH_LOAN',
      ...data,
      timestamp: new Date().toISOString(),
    });
  },

  logPoolOperation: (data: {
    poolId: string;
    operation: 'created' | 'paused' | 'resumed' | 'updated';
    triggeredBy: string;
    previousState?: any;
    newState?: any;
    txHash?: string;
    ip: string;
    userAgent: string;
  }) => {
    logger.info('Pool operation', {
      type: 'POOL_OPERATION',
      ...data,
      timestamp: new Date().toISOString(),
    });
  },

  logSecurityEvent: (data: {
    event: 'RATE_LIMIT_EXCEEDED' | 'UNAUTHORIZED_ACCESS' | 'SUSPICIOUS_ACTIVITY';
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
    ip: string;
    userAgent: string;
  }) => {
    logger.warn('Security event detected', {
      type: 'SECURITY',
      ...data,
      timestamp: new Date().toISOString(),
    });
  },

  logSystemEvent: (data: {
    event: string;
    component: string;
    severity: 'info' | 'warning' | 'error';
    details?: any;
  }) => {
    logger.info('System event', {
      type: 'SYSTEM',
      ...data,
      timestamp: new Date().toISOString(),
    });
  },

  logPerformance: (data: {
    operation: string;
    duration: number;
    success: boolean;
    details?: any;
  }) => {
    logger.info('Performance metric', {
      type: 'PERFORMANCE',
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
};

// Create structured logger for API responses
export const apiLogger = {
  logRequest: (req: any, res: any, duration: number) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString(),
    };

    if (res.statusCode >= 400) {
      logger.warn('API Request', logData);
    } else {
      logger.info('API Request', logData);
    }
  },

  logError: (error: any, req: any) => {
    logger.error('API Error', {
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
      },
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
      },
      timestamp: new Date().toISOString(),
    });
  }
};

export default logger;