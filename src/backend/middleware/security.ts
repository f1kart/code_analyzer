import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ErrorResponseSchema } from '../validation/schemas';

// Security configuration
export const SECURITY_CONFIG = {
  // Rate limiting
  rateLimit: {
    // General API rate limit
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per windowMs
    message: {
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
  },
  
  // Admin-specific rate limit (more restrictive)
  adminRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 admin requests per windowMs
    message: {
      error: 'Too Many Requests',
      message: 'Admin rate limit exceeded. Please try again later.',
      code: 'ADMIN_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Auth rate limit (very restrictive)
  authRateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 auth requests per windowMs
    message: {
      error: 'Too Many Requests',
      message: 'Authentication rate limit exceeded. Please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // CORS configuration
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:5174',
        'https://yourdomain.com',
        'https://app.yourdomain.com',
      ];
      
      if (process.env.NODE_ENV === 'development') {
        // Allow all origins in development
        return callback(null, true);
      }
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
    ],
    exposedHeaders: ['X-Total-Count', 'X-Request-ID'],
  },

  // Helmet configuration
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", 'https://api.anthropic.com', 'https://generativelanguage.googleapis.com'],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },
};

// Rate limiters
export const generalRateLimit = rateLimit(SECURITY_CONFIG.rateLimit);
export const adminRateLimit = rateLimit(SECURITY_CONFIG.adminRateLimit);
export const authRateLimit = rateLimit(SECURITY_CONFIG.authRateLimit);

// CORS middleware
export const corsMiddleware = cors(SECURITY_CONFIG.cors);

// Helmet middleware
export const helmetMiddleware = helmet(SECURITY_CONFIG.helmet);

// Request ID middleware
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  req.requestId = req.headers['x-request-id'] as string || 
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  next();
};

// Input sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      return obj
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .replace(/javascript:/gi, '') // Remove potential JS protocols
        .slice(0, 10000); // Limit length
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

// API key validation middleware
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string || 
                 req.headers['authorization']?.replace('Bearer ', '') as string;

  if (!apiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API key is required',
      code: 'MISSING_API_KEY',
      timestamp: new Date().toISOString(),
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  // Validate API key format
  if (!/^[a-zA-Z0-9\-_]{20,}$/.test(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key format',
      code: 'INVALID_API_KEY',
      timestamp: new Date().toISOString(),
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  // In production, validate against database or secure store
  if (process.env.NODE_ENV === 'production') {
    const validApiKeys = (process.env.VALID_API_KEYS || '').split(',');
    if (!validApiKeys.includes(apiKey)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
        code: 'INVALID_API_KEY',
        timestamp: new Date().toISOString(),
      } satisfies z.infer<typeof ErrorResponseSchema>);
    }
  }

  // Attach API key to request for downstream use
  req.apiKey = apiKey;
  next();
};

// Admin access validation middleware
export const validateAdminAccess = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.apiKey;
  
  // Check if API key has admin privileges
  const adminApiKeys = (process.env.ADMIN_API_KEYS || '').split(',');
  
  if (!adminApiKeys.includes(apiKey || '')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
      code: 'INSUFFICIENT_PERMISSIONS',
      timestamp: new Date().toISOString(),
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log request start
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Request ID: ${req.requestId}`);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any): Response {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - Request ID: ${req.requestId}`);
    
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Error handling middleware
export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error in request ${req.requestId}:`, err);

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      code: 'VALIDATION_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  // Handle rate limit errors
  if (err.message.includes('Rate limit')) {
    return res.status(429).json({
      error: 'Too Many Requests',
      message: err.message,
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  // Handle CORS errors
  if (err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'CORS policy violation',
      code: 'CORS_ERROR',
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    } satisfies z.infer<typeof ErrorResponseSchema>);
  }

  // Handle all other errors
  const statusCode = (err as any).statusCode || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: 'Internal Server Error',
    message,
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  } satisfies z.infer<typeof ErrorResponseSchema>);
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  } satisfies z.infer<typeof ErrorResponseSchema>);
};

// Extend Express Request interface using module augmentation
declare module 'express' {
  interface Request {
    requestId: string;
    apiKey?: string;
    validated?: {
      body?: any;
      query?: any;
      params?: any;
    };
  }
}

export default {
  generalRateLimit,
  adminRateLimit,
  authRateLimit,
  corsMiddleware,
  helmetMiddleware,
  requestId,
  securityHeaders,
  sanitizeInput,
  validateApiKey,
  validateAdminAccess,
  requestLogger,
  errorHandler,
  notFoundHandler,
};
