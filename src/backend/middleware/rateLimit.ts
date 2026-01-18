import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { errorLogger } from '../../utils/errorLogger';

// Rate limiting configurations
const RATE_LIMIT_CONFIGS = {
  // General API rate limiting
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: {
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Admin endpoints - stricter rate limiting
  admin: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // 300 requests per window
    message: {
      error: 'Admin rate limit exceeded',
      message: 'Too many admin requests. Please try again later.',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Critical admin operations - very strict
  critical: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // 50 requests per hour
    message: {
      error: 'Critical operation rate limit exceeded',
      message: 'Too many critical operations. Please wait before trying again.',
      code: 'CRITICAL_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 login attempts per window
    message: {
      error: 'Authentication rate limit exceeded',
      message: 'Too many login attempts. Please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // File upload operations
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 uploads per hour
    message: {
      error: 'Upload rate limit exceeded',
      message: 'Too many file uploads. Please try again later.',
      code: 'UPLOAD_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
};

// Create rate limiters
export const generalRateLimit = rateLimit(RATE_LIMIT_CONFIGS.general);
export const adminRateLimit = rateLimit(RATE_LIMIT_CONFIGS.admin);
export const criticalRateLimit = rateLimit(RATE_LIMIT_CONFIGS.critical);
export const authRateLimit = rateLimit(RATE_LIMIT_CONFIGS.auth);
export const uploadRateLimit = rateLimit(RATE_LIMIT_CONFIGS.upload);

// Dynamic rate limiting based on user role
export const createDynamicRateLimit = (baseConfig: typeof RATE_LIMIT_CONFIGS.admin, multiplier: number) => {
  return rateLimit({
    ...baseConfig,
    max: Math.floor(baseConfig.max * multiplier),
    windowMs: baseConfig.windowMs,
  });
};

// Role-based rate limiters
export const userRateLimit = createDynamicRateLimit(RATE_LIMIT_CONFIGS.admin, 1); // Normal users
export const adminRateLimitEnhanced = createDynamicRateLimit(RATE_LIMIT_CONFIGS.admin, 2); // Admin users
export const superAdminRateLimit = createDynamicRateLimit(RATE_LIMIT_CONFIGS.admin, 5); // Super admins

// Custom rate limiting with user identification
export const createUserBasedRateLimit = (options: {
  windowMs: number;
  max: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    keyGenerator: options.keyGenerator || ((req: Request) => {
      // Use user ID if available, otherwise IP
      return (req as any).userId || req.ip || 'unknown';
    }),
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const endpoint = req.path;
      
      // Log rate limit violation
      errorLogger.logAuthenticationError('Rate limit exceeded', {
        userId,
        endpoint,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        requestId: (req as any).requestId,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded. Please try again later.',
        },
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });
};

// Smart rate limiting that adapts based on system load
export const createAdaptiveRateLimit = (baseConfig: typeof RATE_LIMIT_CONFIGS.admin) => {
  return rateLimit({
    ...baseConfig,
    max: (_req: Request) => {
      // Adjust rate limit based on system load
      const systemLoad = process.env.SYSTEM_LOAD || 'normal';
      
      switch (systemLoad) {
        case 'high':
          return Math.floor(baseConfig.max * 0.5); // 50% of normal limit
        case 'medium':
          return Math.floor(baseConfig.max * 0.75); // 75% of normal limit
        default:
          return baseConfig.max;
      }
    },
    keyGenerator: (req: Request) => {
      // Include endpoint in key for per-endpoint limiting
      const userId = (req as any).userId || req.ip || 'unknown';
      return `${userId}:${req.path}`;
    },
  });
};

// Rate limiting middleware with enhanced logging
export const rateLimitWithLogging = (limiter: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add custom headers for rate limiting info
    res.on('finish', () => {
      if (res.statusCode === 429) {
        const userId = (req as any).userId;
        const endpoint = req.path;
        
        errorLogger.logAuthenticationError('Rate limit hit', {
          userId,
          endpoint,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          requestId: (req as any).requestId,
        });
      }
    });

    return limiter(req, res, next);
  };
};

// Rate limiting for specific operations
export const createOperationRateLimit = (operation: string, config: Partial<typeof RATE_LIMIT_CONFIGS.admin>) => {
  return createUserBasedRateLimit({
    windowMs: config.windowMs || 15 * 60 * 1000,
    max: config.max || 100,
    keyGenerator: (_req: Request) => {
      const userId = (_req as any).userId || _req.ip || 'unknown';
      return `${userId}:${operation}`;
    },
  });
};

// Predefined operation rate limiters
export const createProviderRateLimit = createOperationRateLimit('create-provider', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 provider creations per hour
});

export const deleteProviderRateLimit = createOperationRateLimit('delete-provider', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 provider deletions per hour
});

export const createWorkflowRateLimit = createOperationRateLimit('create-workflow', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 workflow creations per hour
});

export const executeWorkflowRateLimit = createOperationRateLimit('execute-workflow', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 workflow executions per 15 minutes
});

// Rate limiting middleware factory
export const createRateLimitMiddleware = (type: keyof typeof RATE_LIMIT_CONFIGS, options?: {
  userId?: string;
  role?: string;
  customMultiplier?: number;
}) => {
  const config = RATE_LIMIT_CONFIGS[type];
  
  if (!config) {
    throw new Error(`Unknown rate limit type: ${type}`);
  }

  let multiplier = 1;
  
  // Apply role-based multiplier
  if (options?.role) {
    switch (options.role) {
      case 'admin':
        multiplier = 2;
        break;
      case 'super_admin':
        multiplier = 5;
        break;
      default:
        multiplier = 1;
    }
  }

  // Apply custom multiplier
  if (options?.customMultiplier) {
    multiplier *= options.customMultiplier;
  }

  return createDynamicRateLimit(config, multiplier);
};

// Rate limiting statistics and monitoring
export class RateLimitMonitor {
  private static instance: RateLimitMonitor;
  private violations: Map<string, number> = new Map();
  private endpoints: Map<string, number> = new Map();

  static getInstance(): RateLimitMonitor {
    if (!RateLimitMonitor.instance) {
      RateLimitMonitor.instance = new RateLimitMonitor();
    }
    return RateLimitMonitor.instance;
  }

  recordViolation(userId: string, endpoint: string): void {
    // Track user violations
    const userViolations = this.violations.get(userId) || 0;
    this.violations.set(userId, userViolations + 1);

    // Track endpoint violations
    const endpointViolations = this.endpoints.get(endpoint) || 0;
    this.endpoints.set(endpoint, endpointViolations + 1);

    // Log violation
    errorLogger.logAuthenticationError('Rate limit violation recorded', {
      userId,
      endpoint,
      totalUserViolations: userViolations + 1,
      totalEndpointViolations: endpointViolations + 1,
    });
  }

  getStats(): {
    totalViolations: number;
    userViolations: Record<string, number>;
    endpointViolations: Record<string, number>;
  } {
    const totalViolations = Array.from(this.violations.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalViolations,
      userViolations: Object.fromEntries(this.violations),
      endpointViolations: Object.fromEntries(this.endpoints),
    };
  }

  clearStats(): void {
    this.violations.clear();
    this.endpoints.clear();
  }
}

// Export rate limit monitor instance
export const rateLimitMonitor = RateLimitMonitor.getInstance();

// Rate limiting middleware with monitoring
export const rateLimitWithMonitoring = (limiter: any, _operationName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body) {
      if (res.statusCode === 429) {
        const userId = (req as any).userId || req.ip;
        const endpoint = req.path;
        rateLimitMonitor.recordViolation(userId, endpoint);
      }
      return originalSend.call(this, body);
    };

    return limiter(req, res, next);
  };
};
