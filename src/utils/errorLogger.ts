import { logger } from './logger';

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Error categories
export enum ErrorCategory {
  NETWORK = 'network',
  DATABASE = 'database',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  USER_INTERFACE = 'user_interface',
  UNKNOWN = 'unknown',
}

// Structured error interface
export interface StructuredError {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  code?: string;
  stack?: string;
  context?: Record<string, any>;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  url?: string;
  component?: string;
  operation?: string;
  metadata?: Record<string, any>;
}

// Error context builder
export class ErrorContextBuilder {
  private context: Partial<StructuredError> = {};

  static create(): ErrorContextBuilder {
    return new ErrorContextBuilder();
  }

  severity(severity: ErrorSeverity): ErrorContextBuilder {
    this.context.severity = severity;
    return this;
  }

  category(category: ErrorCategory): ErrorContextBuilder {
    this.context.category = category;
    return this;
  }

  message(message: string): ErrorContextBuilder {
    this.context.message = message;
    return this;
  }

  code(code: string): ErrorContextBuilder {
    this.context.code = code;
    return this;
  }

  stack(stack: string): ErrorContextBuilder {
    this.context.stack = stack;
    return this;
  }

  contextData(context: Record<string, any>): ErrorContextBuilder {
    this.context.context = { ...this.context.context, ...context };
    return this;
  }

  correlationId(correlationId: string): ErrorContextBuilder {
    this.context.correlationId = correlationId;
    return this;
  }

  requestId(requestId: string): ErrorContextBuilder {
    this.context.requestId = requestId;
    return this;
  }

  userId(userId: string): ErrorContextBuilder {
    this.context.userId = userId;
    return this;
  }

  sessionId(sessionId: string): ErrorContextBuilder {
    this.context.sessionId = sessionId;
    return this;
  }

  component(component: string): ErrorContextBuilder {
    this.context.component = component;
    return this;
  }

  operation(operation: string): ErrorContextBuilder {
    this.context.operation = operation;
    return this;
  }

  metadata(metadata: Record<string, any>): ErrorContextBuilder {
    this.context.metadata = { ...this.context.metadata, ...metadata };
    return this;
  }

  build(): StructuredError {
    const errorId = this.generateErrorId();
    const timestamp = new Date().toISOString();
    
    // Auto-detect browser context
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : undefined;
    const url = typeof window !== 'undefined' ? window.location.href : undefined;

    return {
      id: errorId,
      timestamp,
      severity: this.context.severity || ErrorSeverity.MEDIUM,
      category: this.context.category || ErrorCategory.UNKNOWN,
      message: this.context.message || 'Unknown error occurred',
      code: this.context.code,
      stack: this.context.stack,
      context: this.context.context,
      correlationId: this.context.correlationId,
      requestId: this.context.requestId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      userAgent,
      url,
      component: this.context.component,
      operation: this.context.operation,
      metadata: this.context.metadata,
    };
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Main error logger class
export class StructuredErrorLogger {
  private static instance: StructuredErrorLogger;
  private errorQueue: StructuredError[] = [];
  private maxQueueSize = 1000;
  private flushInterval = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.setupPeriodicFlush();
  }

  static getInstance(): StructuredErrorLogger {
    if (!StructuredErrorLogger.instance) {
      StructuredErrorLogger.instance = new StructuredErrorLogger();
    }
    return StructuredErrorLogger.instance;
  }

  // Log error with structured data
  logError(error: StructuredError): void {
    // Add to queue
    this.errorQueue.push(error);

    // Trim queue if it exceeds max size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize);
    }

    // Log immediately for critical errors
    if (error.severity === ErrorSeverity.CRITICAL) {
      this.flushErrors();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Structured Error:', JSON.stringify(error, null, 2));
    }
  }

  // Convenience methods for common error types
  logNetworkError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.MEDIUM)
      .category(ErrorCategory.NETWORK)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logDatabaseError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.HIGH)
      .category(ErrorCategory.DATABASE)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logValidationError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.LOW)
      .category(ErrorCategory.VALIDATION)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logAuthenticationError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.HIGH)
      .category(ErrorCategory.AUTHENTICATION)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logAuthorizationError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.HIGH)
      .category(ErrorCategory.AUTHORIZATION)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logSystemError(message: string, context?: Record<string, any>): void {
    const error = ErrorContextBuilder.create()
      .severity(ErrorSeverity.CRITICAL)
      .category(ErrorCategory.SYSTEM)
      .message(message)
      .contextData(context || {})
      .build();

    this.logError(error);
  }

  logUIError(error: Error, component?: string, context?: Record<string, any>): void {
    const structuredError = ErrorContextBuilder.create()
      .severity(ErrorSeverity.MEDIUM)
      .category(ErrorCategory.USER_INTERFACE)
      .message(error.message)
      .stack(error.stack)
      .component(component)
      .contextData(context || {})
      .build();

    this.logError(structuredError);
  }

  // Log from any error object
  logFromError(error: Error, category: ErrorCategory = ErrorCategory.UNKNOWN, context?: Record<string, any>): void {
    const severity = this.determineSeverity(error, category);
    
    const structuredError = ErrorContextBuilder.create()
      .severity(severity)
      .category(category)
      .message(error.message)
      .stack(error.stack)
      .code(error.name)
      .contextData(context || {})
      .build();

    this.logError(structuredError);
  }

  // Get error statistics
  getErrorStats(): {
    total: number;
    bySeverity: Record<ErrorSeverity, number>;
    byCategory: Record<ErrorCategory, number>;
    recentErrors: StructuredError[];
  } {
    const bySeverity = Object.values(ErrorSeverity).reduce((acc, severity) => {
      acc[severity] = 0;
      return acc;
    }, {} as Record<ErrorSeverity, number>);

    const byCategory = Object.values(ErrorCategory).reduce((acc, category) => {
      acc[category] = 0;
      return acc;
    }, {} as Record<ErrorCategory, number>);

    this.errorQueue.forEach(error => {
      bySeverity[error.severity]++;
      byCategory[error.category]++;
    });

    return {
      total: this.errorQueue.length,
      bySeverity,
      byCategory,
      recentErrors: this.errorQueue.slice(-10), // Last 10 errors
    };
  }

  // Clear error queue
  clearErrors(): void {
    this.errorQueue = [];
  }

  // Flush errors to external service
  private flushErrors(): void {
    if (this.errorQueue.length === 0) return;

    const errorsToFlush = [...this.errorQueue];
    this.errorQueue = [];

    // Send to external service (placeholder)
    this.sendToExternalService(errorsToFlush);
  }

  // Send errors to external monitoring service
  private sendToExternalService(errors: StructuredError[]): void {
    // In production, this would send to services like:
    // - Sentry
    // - Datadog
    // - LogRocket
    // - Custom error tracking API
    
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking API
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ errors }),
      }).catch(err => {
        console.error('Failed to send errors to external service:', err);
        // Re-queue failed errors
        this.errorQueue.unshift(...errors);
      });
    } else {
      // In development, just log to console
      logger.error('Error batch:', { 
        count: errors.length, 
        errors: errors.map(e => ({ id: e.id, message: e.message, severity: e.severity }))
      });
    }
  }

  // Setup periodic flush
  private setupPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushErrors();
    }, this.flushInterval);
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flushErrors(); // Flush remaining errors
  }

  // Determine error severity based on type and category
  private determineSeverity(error: Error, category: ErrorCategory): ErrorSeverity {
    // Critical system errors
    if (category === ErrorCategory.SYSTEM) {
      return ErrorSeverity.CRITICAL;
    }

    // High severity for auth and database errors
    if (category === ErrorCategory.AUTHENTICATION || 
        category === ErrorCategory.AUTHORIZATION || 
        category === ErrorCategory.DATABASE) {
      return ErrorSeverity.HIGH;
    }

    // Medium for network and business logic errors
    if (category === ErrorCategory.NETWORK || 
        category === ErrorCategory.BUSINESS_LOGIC) {
      return ErrorSeverity.MEDIUM;
    }

    // Low for validation and UI errors
    return ErrorSeverity.LOW;
  }
}

// Global error logger instance
export const errorLogger = StructuredErrorLogger.getInstance();

// Convenience functions for quick error logging
export const logNetworkError = (message: string, context?: Record<string, any>) => 
  errorLogger.logNetworkError(message, context);

export const logDatabaseError = (message: string, context?: Record<string, any>) => 
  errorLogger.logDatabaseError(message, context);

export const logValidationError = (message: string, context?: Record<string, any>) => 
  errorLogger.logValidationError(message, context);

export const logAuthenticationError = (message: string, context?: Record<string, any>) => 
  errorLogger.logAuthenticationError(message, context);

export const logAuthorizationError = (message: string, context?: Record<string, any>) => 
  errorLogger.logAuthorizationError(message, context);

export const logSystemError = (message: string, context?: Record<string, any>) => 
  errorLogger.logSystemError(message, context);

export const logUIError = (error: Error, component?: string, context?: Record<string, any>) => 
  errorLogger.logUIError(error, component, context);

export const logError = (error: Error, category?: ErrorCategory, context?: Record<string, any>) => 
  errorLogger.logFromError(error, category, context);

// React error boundary integration
export const createErrorBoundaryHandler = (componentName: string) => {
  return (error: Error, errorInfo: React.ErrorInfo) => {
    logUIError(error, componentName, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });
  };
};

// Global error handlers for unhandled errors
if (typeof window !== 'undefined') {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(new Error(event.reason), ErrorCategory.SYSTEM, {
      type: 'unhandled_promise_rejection',
      reason: event.reason,
    });
  });

  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    logError(event.error || new Error(event.message), ErrorCategory.SYSTEM, {
      type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
}
