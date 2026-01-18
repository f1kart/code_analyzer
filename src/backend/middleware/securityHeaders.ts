import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';
import { errorLogger } from '../../utils/errorLogger';

// Content Security Policy configuration
const CSP_CONFIG = {
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-eval'", // Required for React development
      "'unsafe-inline'", // Required for some inline scripts
      "https://cdn.jsdelivr.net",
      "https://unpkg.com",
      "https://cdnjs.cloudflare.com",
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'", // Required for CSS-in-JS
      "https://fonts.googleapis.com",
      "https://cdn.jsdelivr.net",
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:",
      "blob:",
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com",
      "data:",
    ],
    connectSrc: [
      "'self'",
      "ws:",
      "wss:",
      "https://api.openai.com",
      "https://api.anthropic.com",
      "https://api.github.com",
    ],
    mediaSrc: ["'self'"],
    objectSrc: ["'none'"],
    childSrc: ["'self'"],
    frameSrc: ["'self'"],
    workerSrc: ["'self'", "blob:"],
    manifestSrc: ["'self'"],
    upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
  },
  reportOnly: process.env.NODE_ENV === 'development',
};

// Security headers configuration
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    ...CSP_CONFIG.directives,
    reportOnly: process.env.NODE_ENV === 'development',
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
  crossOriginOpenerPolicy: false, // Disable for compatibility
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // Additional security headers
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

// Custom security headers middleware
export const customSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('Server');
  res.removeHeader('X-Powered-By');
  
  // Add custom security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  // Cache control for sensitive endpoints
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  
  // CORS headers for API endpoints
  if (req.path.startsWith('/api/')) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin || '')) {
      res.setHeader('Access-Control-Allow-Origin', origin || '');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  next();
};

// Rate limiting headers
export const rateLimitHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Add rate limiting information headers
  res.setHeader('X-RateLimit-Limit', '1000');
  res.setHeader('X-RateLimit-Remaining', '999');
  res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 15 * 60 * 1000).toISOString());
  
  next();
};

// Request validation middleware
export const requestValidation = (req: Request, res: Response, next: NextFunction) => {
  // Validate request size
  const contentLength = parseInt(req.headers['content-length'] || '0');
  const maxRequestSize = 10 * 1024 * 1024; // 10MB
  
  if (contentLength > maxRequestSize) {
    errorLogger.logValidationError('Request too large', {
      contentLength,
      maxRequestSize,
      endpoint: req.path,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    
    return res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request entity too large',
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.headers['content-type']) {
    errorLogger.logValidationError('Missing content type', {
      method: req.method,
      endpoint: req.path,
      ip: req.ip,
      requestId: (req as any).requestId,
    });
    
    return res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_CONTENT_TYPE',
        message: 'Content-Type header is required',
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  next();
};

// IP-based security middleware
export const ipSecurity = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = req.ip || req.connection.remoteAddress;
  const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];
  const blockedIPs = process.env.BLOCKED_IPS?.split(',') || [];
  
  // Block IPs from blacklist
  if (blockedIPs.includes(clientIP || '')) {
    errorLogger.logAuthenticationError('Blocked IP attempted access', {
      ip: clientIP,
      endpoint: req.path,
      userAgent: req.get('User-Agent'),
      requestId: (req as any).requestId,
    });
    
    return res.status(403).json({
      success: false,
      error: {
        code: 'IP_BLOCKED',
        message: 'Access denied from this IP address',
      },
      meta: {
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
      },
    });
  }
  
  // Allow only specific IPs in production
  if (process.env.NODE_ENV === 'production' && allowedIPs.length > 0) {
    if (!allowedIPs.includes(clientIP || '')) {
      errorLogger.logAuthenticationError('Unauthorized IP attempted access', {
        ip: clientIP,
        endpoint: req.path,
        userAgent: req.get('User-Agent'),
        requestId: (req as any).requestId,
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address',
        },
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  next();
};

// User agent validation
export const userAgentValidation = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent');
  
  // Block common bot user agents for admin endpoints
  if (req.path.startsWith('/api/admin')) {
    const blockedAgents = [
      'bot',
      'crawler',
      'spider',
      'scraper',
      'curl',
      'wget',
      'python-requests',
      'postman',
    ];
    
    if (userAgent && blockedAgents.some(agent => userAgent.toLowerCase().includes(agent))) {
      errorLogger.logAuthenticationError('Blocked user agent attempted admin access', {
        userAgent,
        endpoint: req.path,
        ip: req.ip,
        requestId: (req as any).requestId,
      });
      
      return res.status(403).json({
        success: false,
        error: {
          code: 'USER_AGENT_BLOCKED',
          message: 'Access denied for this user agent',
        },
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  }
  
  next();
};

// Request ID validation
export const requestIdValidation = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] as string;
  
  if (!requestId) {
    // Generate a request ID if not provided
    (req as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', (req as any).requestId);
  } else {
    // Validate request ID format
    const requestIdPattern = /^[a-zA-Z0-9\-_]{10,50}$/;
    if (!requestIdPattern.test(requestId)) {
      errorLogger.logValidationError('Invalid request ID format', {
        requestId,
        endpoint: req.path,
        ip: req.ip,
      });
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST_ID',
          message: 'Invalid request ID format',
        },
        meta: {
          requestId: (req as any).requestId,
          timestamp: new Date().toISOString(),
        },
      });
    }
    
    (req as any).requestId = requestId;
  }
  
  next();
};

// Security middleware composition
export const securityMiddleware = [
  securityHeaders,
  customSecurityHeaders,
  rateLimitHeaders,
  requestValidation,
  requestIdValidation,
];

// Admin-specific security middleware
export const adminSecurityMiddleware = [
  ...securityMiddleware,
  ipSecurity,
  userAgentValidation,
];

// CORS preflight handler
export const corsPreflight = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    const origin = req.headers.origin;
    
    if (allowedOrigins.includes(origin || '')) {
      res.setHeader('Access-Control-Allow-Origin', origin || '');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    return res.status(200).end();
  }
  
  next();
};

// Security audit middleware
export const securityAudit = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Log security-relevant requests
  if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth')) {
    const auditData = {
      method: req.method,
      endpoint: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: (req as any).requestId,
      userId: (req as any).userId,
      timestamp: new Date().toISOString(),
    };
    
    console.log('Security Audit:', JSON.stringify(auditData, null, 2));
  }
  
  // Log response time for security monitoring
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    if (req.path.startsWith('/api/admin') && res.statusCode >= 400) {
      errorLogger.logAuthenticationError('Admin endpoint error', {
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        responseTime,
        ip: req.ip,
        requestId: (req as any).requestId,
      });
    }
  });
  
  next();
};
