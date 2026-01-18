import { Request, Response, NextFunction } from 'express';

// Log levels
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// Log entry interface
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  version: string;
  environment: string;
  correlationId?: string;
  userId?: string;
  requestId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  metadata?: Record<string, any>;
  tags?: string[];
  spanId?: string;
  traceId?: string;
}

// Logger configuration
interface LoggerConfig {
  service: string;
  version: string;
  environment: string;
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableStructured: boolean;
  correlationIdHeader?: string;
  excludedPaths?: string[];
  sensitiveFields?: string[];
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  service: process.env.SERVICE_NAME || 'gemini-ide-backend',
  version: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  level: (process.env.LOG_LEVEL as LogLevel) || LogLevel.INFO,
  enableConsole: process.env.LOG_CONSOLE !== 'false',
  enableFile: process.env.LOG_FILE === 'true',
  enableStructured: process.env.LOG_STRUCTURED !== 'false',
  correlationIdHeader: 'x-correlation-id',
  excludedPaths: ['/health', '/health/ready', '/health/live', '/metrics'],
  sensitiveFields: ['password', 'token', 'secret', 'key', 'auth', 'credential'],
};

// Structured Logger class
export class StructuredLogger {
  public config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Generate correlation ID
  public generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sanitize sensitive data
  private sanitizeData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const sanitized = { ...data };
    
    for (const field of this.config.sensitiveFields || []) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const key in sanitized) {
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  // Create log entry
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.service,
      version: this.config.version,
      environment: this.config.environment,
      metadata: metadata ? this.sanitizeData(metadata) : undefined,
      tags: [],
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      };
    }

    return entry;
  }

  // Check if log level should be logged
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const targetLevelIndex = levels.indexOf(level);
    return targetLevelIndex >= currentLevelIndex;
  }

  // Output log entry
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) return;

    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Console output
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // File output (in production, you'd write to a file)
    if (this.config.enableFile) {
      this.outputToFile(entry);
    }

    // Structured output (for log aggregation systems)
    if (this.config.enableStructured) {
      this.outputStructured(entry);
    }
  }

  // Console output
  private outputToConsole(entry: LogEntry): void {
    const colorMap = {
      [LogLevel.DEBUG]: '\x1b[36m', // Cyan
      [LogLevel.INFO]: '\x1b[32m',  // Green
      [LogLevel.WARN]: '\x1b[33m',  // Yellow
      [LogLevel.ERROR]: '\x1b[31m', // Red
      [LogLevel.FATAL]: '\x1b[35m', // Magenta
    };

    const reset = '\x1b[0m';
    const color = colorMap[entry.level];
    const prefix = `${color}[${entry.level.toUpperCase()}]${reset} ${entry.timestamp}`;

    console.log(`${prefix} ${entry.message}`, {
      service: entry.service,
      correlationId: entry.correlationId,
      userId: entry.userId,
      ...entry.metadata,
      ...(entry.error && { error: entry.error }),
    });
  }

  // File output (placeholder for actual file logging)
  private outputToFile(entry: LogEntry): void {
    // In production, you would write to a log file
    // For now, we'll just use console
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL) {
      console.error(`FILE_LOG: ${JSON.stringify(entry)}`);
    }
  }

  // Structured output (for ELK, Splunk, etc.)
  private outputStructured(entry: LogEntry): void {
    // In production, you would send to a log aggregation service
    // For now, we'll output JSON to console
    console.log(`STRUCTURED_LOG: ${JSON.stringify(entry)}`);
  }

  // Logging methods
  public debug(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
    this.output(entry);
  }

  public info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.output(entry);
  }

  public warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.output(entry);
  }

  public error(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata, error);
    this.output(entry);
  }

  public fatal(message: string, error?: Error, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.FATAL, message, metadata, error);
    this.output(entry);
  }

  // Request logging
  public logRequest(req: Request, res: Response, duration: number): void {
    if (this.shouldSkipPath(req.path)) return;

    const entry = this.createLogEntry(LogLevel.INFO, 'HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    entry.method = req.method;
    entry.url = req.url;
    entry.statusCode = res.statusCode;
    entry.duration = duration;
    entry.correlationId = (req as any).correlationId;
    entry.userId = (req as any).userId;
    entry.requestId = (req as any).requestId;
    entry.sessionId = (req as any).sessionId;
    entry.ip = req.ip;
    entry.userAgent = req.headers['user-agent'];

    this.output(entry);
  }

  // Database operation logging
  public logDatabase(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, 'Database Operation', {
      operation,
      table,
      duration: `${duration}ms`,
      success,
      ...metadata,
    });

    entry.tags = ['database', operation];
    this.output(entry);
  }

  // External API call logging
  public logExternalApi(
    service: string,
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    const entry = this.createLogEntry(level, 'External API Call', {
      service,
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ...metadata,
    });

    entry.tags = ['external-api', service, method];
    this.output(entry);
  }

  // Security event logging
  public logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, any>
  ): void {
    const levelMap = {
      low: LogLevel.INFO,
      medium: LogLevel.WARN,
      high: LogLevel.ERROR,
      critical: LogLevel.FATAL,
    };

    const entry = this.createLogEntry(levelMap[severity], `Security Event: ${event}`, {
      severity,
      ...metadata,
    });

    entry.tags = ['security', event, severity];
    this.output(entry);
  }

  // Performance logging
  public logPerformance(
    operation: string,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = duration > 5000 ? LogLevel.WARN : LogLevel.DEBUG;
    const entry = this.createLogEntry(level, 'Performance Metric', {
      operation,
      duration: `${duration}ms`,
      ...metadata,
    });

    entry.tags = ['performance', operation];
    this.output(entry);
  }

  // Business event logging
  public logBusiness(
    event: string,
    userId: string,
    metadata?: Record<string, any>
  ): void {
    const entry = this.createLogEntry(LogLevel.INFO, `Business Event: ${event}`, {
      event,
      userId,
      ...metadata,
    });

    entry.userId = userId;
    entry.tags = ['business', event];
    this.output(entry);
  }

  // Check if path should be skipped
  private shouldSkipPath(path: string): boolean {
    return this.config.excludedPaths?.some(excluded => 
      path.startsWith(excluded) || path.includes(excluded)
    ) || false;
  }

  // Get recent logs
  public getRecentLogs(count: number = 100): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  // Get logs by level
  public getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logBuffer.filter(entry => entry.level === level);
  }

  // Get logs by tag
  public getLogsByTag(tag: string): LogEntry[] {
    return this.logBuffer.filter(entry => entry.tags?.includes(tag));
  }

  // Clear log buffer
  public clearLogs(): void {
    this.logBuffer = [];
  }

  // Get log statistics
  public getStatistics(): Record<string, any> {
    const stats = {
      total: this.logBuffer.length,
      byLevel: {} as Record<LogLevel, number>,
      byTag: {} as Record<string, number>,
      recentErrors: this.logBuffer
        .filter(entry => entry.level === LogLevel.ERROR || entry.level === LogLevel.FATAL)
        .slice(-10),
    };

    // Count by level
    for (const level of Object.values(LogLevel)) {
      stats.byLevel[level] = this.logBuffer.filter(entry => entry.level === level).length;
    }

    // Count by tag
    for (const entry of this.logBuffer) {
      if (entry.tags) {
        for (const tag of entry.tags) {
          stats.byTag[tag] = (stats.byTag[tag] || 0) + 1;
        }
      }
    }

    return stats;
  }
}

// Express middleware for request logging
export const structuredLoggingMiddleware = (logger: StructuredLogger) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Extract correlation ID from headers or generate new one
    const correlationId = req.headers[logger.config.correlationIdHeader || 'x-correlation-id'] as string ||
                         logger.generateCorrelationId();
    
    // Add correlation ID to request
    (req as any).correlationId = correlationId;

    // Log request start
    logger.debug('Request started', {
      method: req.method,
      url: req.url,
      correlationId,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    // Intercept response
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const duration = Date.now() - startTime;
      
      // Log request completion
      logger.logRequest(req, res, duration);
      
      // Call original end
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

// Error logging middleware
export const errorLoggingMiddleware = (logger: StructuredLogger) => {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    logger.error('Request error', error, {
      method: req.method,
      url: req.url,
      correlationId: (req as any).correlationId,
      userId: (req as any).userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    next(error);
  };
};

// Create default logger instance
export const logger = new StructuredLogger();

// Create specialized loggers
export const securityLogger = new StructuredLogger({
  ...DEFAULT_CONFIG,
  service: `${DEFAULT_CONFIG.service}-security`,
});

export const performanceLogger = new StructuredLogger({
  ...DEFAULT_CONFIG,
  service: `${DEFAULT_CONFIG.service}-performance`,
});

export const auditLogger = new StructuredLogger({
  ...DEFAULT_CONFIG,
  service: `${DEFAULT_CONFIG.service}-audit`,
});

// Export convenience functions
export const {
  debug,
  info,
  warn,
  error,
  fatal,
  logRequest,
  logDatabase,
  logExternalApi,
  logSecurity,
  logPerformance,
  logBusiness,
  getRecentLogs,
  getStatistics,
} = logger;
