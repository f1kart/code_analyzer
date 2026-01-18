type LogLevel = 'info' | 'warn' | 'error' | 'debug';

type LogPayload = Record<string, unknown> & {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
};

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  payload: LogPayload;
  environment: string;
  version: string;
}

class StructuredLogger {
  private static instance: StructuredLogger;
  private correlationId: string;
  private sessionId: string;
  private environment: string;
  private version: string;

  private constructor() {
    this.correlationId = this.generateCorrelationId();
    this.sessionId = this.generateSessionId();
    this.environment = process.env.NODE_ENV || 'development';
    this.version = process.env.REACT_APP_VERSION || '1.0.0';
  }

  static getInstance(): StructuredLogger {
    if (!StructuredLogger.instance) {
      StructuredLogger.instance = new StructuredLogger();
    }
    return StructuredLogger.instance;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createLogEntry(level: LogLevel, message: string, payload: LogPayload = {}): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      payload: {
        ...payload,
        correlationId: payload.correlationId || this.correlationId,
        sessionId: payload.sessionId || this.sessionId,
      },
      environment: this.environment,
      version: this.version,
    };
  }

  private emitLog(entry: LogEntry): void {
    const logMessage = `[${entry.level.toUpperCase()}] ${entry.message}`;
    
    // In production, send to external logging service
    if (this.environment === 'production') {
      this.sendToExternalService(entry);
    }

    // Console output with structured data
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage, entry.payload);
        break;
      case 'info':
        console.info(logMessage, entry.payload);
        break;
      case 'warn':
        console.warn(logMessage, entry.payload);
        break;
      case 'error':
        console.error(logMessage, entry.payload);
        break;
      default:
        console.log(logMessage, entry.payload);
    }
  }

  private sendToExternalService(entry: LogEntry): void {
    // Send to logging service (e.g., LogRocket, Sentry, custom endpoint)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'log_event', {
        event_category: 'application_log',
        event_label: entry.level,
        custom_parameter_1: entry.message,
        custom_parameter_2: entry.payload.correlationId,
      });
    }

    // Could also send to your own logging endpoint
    // fetch('/api/logs', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(entry),
    // }).catch(() => {
    //   // Silently fail to avoid infinite loops
    // });
  }

  debug(message: string, payload?: LogPayload): void {
    const entry = this.createLogEntry('debug', message, payload);
    this.emitLog(entry);
  }

  info(message: string, payload?: LogPayload): void {
    const entry = this.createLogEntry('info', message, payload);
    this.emitLog(entry);
  }

  warn(message: string, payload?: LogPayload): void {
    const entry = this.createLogEntry('warn', message, payload);
    this.emitLog(entry);
  }

  error(message: string, payload?: LogPayload): void {
    const entry = this.createLogEntry('error', message, payload);
    this.emitLog(entry);
  }

  // Performance logging
  performance(operation: string, duration: number, payload?: LogPayload): void {
    this.info(`Performance: ${operation}`, {
      ...payload,
      operation,
      duration,
      performanceMetric: true,
    });
  }

  // Admin action logging
  adminAction(action: string, userId?: string, payload?: LogPayload): void {
    this.info(`Admin Action: ${action}`, {
      ...payload,
      action,
      userId,
      adminAction: true,
    });
  }

  // Security event logging
  security(event: string, severity: 'low' | 'medium' | 'high', payload?: LogPayload): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    const entry = this.createLogEntry(level, `Security: ${event}`, {
      ...payload,
      securityEvent: true,
      severity,
    });
    this.emitLog(entry);
  }

  // Get current correlation ID for tracing
  getCorrelationId(): string {
    return this.correlationId;
  }

  // Generate new correlation ID (useful for new user sessions)
  resetCorrelationId(): string {
    this.correlationId = this.generateCorrelationId();
    return this.correlationId;
  }
}

// Export singleton instance
const logger = StructuredLogger.getInstance();

// Export convenience functions that maintain backward compatibility
export const logInfo = (event: string, payload?: LogPayload) => logger.info(event, payload);

export const logWarn = (event: string, payload?: LogPayload) => logger.warn(event, payload);

export const logError = (event: string, payload?: LogPayload) => logger.error(event, payload);

export const logDebug = (event: string, payload?: LogPayload) => logger.debug(event, payload);

export const logPerformance = (operation: string, duration: number, payload?: LogPayload) => 
  logger.performance(operation, duration, payload);

export const logAdminAction = (action: string, userId?: string, payload?: LogPayload) => 
  logger.adminAction(action, userId, payload);

export const logSecurity = (event: string, severity: 'low' | 'medium' | 'high', payload?: LogPayload) => 
  logger.security(event, severity, payload);

export const getCorrelationId = () => logger.getCorrelationId();

export const resetCorrelationId = () => logger.resetCorrelationId();

export default logger;
