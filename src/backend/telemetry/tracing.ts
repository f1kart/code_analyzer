import { Request, Response, NextFunction } from 'express';

// Simplified tracing configuration (without external dependencies)
const _TRACING_CONFIG = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'gemini-ide-backend',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

// Simple span interface for internal tracing
interface SimpleSpan {
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, any>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, any> }>;
  status: { code: number; message?: string };
}

// Simple tracer implementation
class SimpleTracer {
  private activeSpans: Map<string, SimpleSpan> = new Map();
  private completedSpans: SimpleSpan[] = [];

  startSpan(name: string, attributes?: Record<string, any>): SimpleSpan {
    const spanId = `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const span: SimpleSpan = {
      name,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: { code: 0 }, // OK
    };
    
    this.activeSpans.set(spanId, span);
    return span;
  }

  endSpan(span: SimpleSpan, status?: { code: number; message?: string }): void {
    span.endTime = Date.now();
    if (status) {
      span.status = status;
    }
    
    // Move from active to completed
    for (const [spanId, activeSpan] of this.activeSpans.entries()) {
      if (activeSpan === span) {
        this.activeSpans.delete(spanId);
        this.completedSpans.push(span);
        break;
      }
    }
  }

  addEvent(span: SimpleSpan, name: string, attributes?: Record<string, any>): void {
    span.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  getActiveSpans(): SimpleSpan[] {
    return Array.from(this.activeSpans.values());
  }

  getCompletedSpans(): SimpleSpan[] {
    return this.completedSpans;
  }

  clearCompletedSpans(): void {
    this.completedSpans = [];
  }
}

// Simple metrics implementation
class SimpleMetrics {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();

  incrementCounter(name: string, value: number = 1, attributes?: Record<string, any>): void {
    const key = attributes ? `${name}:${JSON.stringify(attributes)}` : name;
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  recordHistogram(name: string, value: number, attributes?: Record<string, any>): void {
    const key = attributes ? `${name}:${JSON.stringify(attributes)}` : name;
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    this.histograms.get(key)!.push(value);
  }

  getCounters(): Map<string, number> {
    return this.counters;
  }

  getHistograms(): Map<string, number[]> {
    return this.histograms;
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }
}

// Tracing service class
export class TracingService {
  private tracer = new SimpleTracer();
  private metrics = new SimpleMetrics();

  // Custom metrics
  private createCounter(name: string, description: string) {
    return {
      name,
      description,
      add: (value: number, attributes?: Record<string, any>) => {
        this.metrics.incrementCounter(name, value, attributes);
      },
    };
  }

  private createHistogram(name: string, description: string, unit: string = 'ms') {
    return {
      name,
      description,
      unit,
      record: (value: number, attributes?: Record<string, any>) => {
        this.metrics.recordHistogram(name, value, attributes);
      },
    };
  }

  // Predefined metrics
  public httpRequestsTotal = this.createCounter('http_requests_total', 'Total number of HTTP requests');
  public httpRequestDuration = this.createHistogram('http_request_duration', 'HTTP request duration');
  public activeConnections = this.createCounter('active_connections', 'Number of active connections');
  public databaseConnections = this.createCounter('database_connections', 'Number of database connections');
  public cacheHits = this.createCounter('cache_hits_total', 'Total number of cache hits');
  public cacheMisses = this.createCounter('cache_misses_total', 'Total number of cache misses');
  public adminOperations = this.createCounter('admin_operations_total', 'Total number of admin operations');
  public workflowExecutions = this.createCounter('workflow_executions_total', 'Total number of workflow executions');
  public aiRequests = this.createCounter('ai_requests_total', 'Total number of AI requests');
  public aiRequestDuration = this.createHistogram('ai_request_duration', 'AI request duration');
  public errors = this.createCounter('errors_total', 'Total number of errors');

  // Create a span for manual instrumentation
  public createSpan(name: string, fn: (span: SimpleSpan) => Promise<any> | any): Promise<any> {
    const span = this.tracer.startSpan(name);
    
    try {
      const result = fn(span);
      
      if (result instanceof Promise) {
        return result
          .then((value) => {
            this.tracer.endSpan(span, { code: 0 }); // OK
            return value;
          })
          .catch((error) => {
            this.tracer.endSpan(span, { 
              code: 1, // ERROR
              message: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
          });
      } else {
        this.tracer.endSpan(span, { code: 0 }); // OK
        return result;
      }
    } catch (error) {
      this.tracer.endSpan(span, { 
        code: 1, // ERROR
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Add attributes to current span
  public setSpanAttributes(attributes: Record<string, any>): void {
    const activeSpans = this.tracer.getActiveSpans();
    if (activeSpans.length > 0) {
      const currentSpan = activeSpans[activeSpans.length - 1];
      Object.assign(currentSpan.attributes, attributes);
    }
  }

  // Add events to current span
  public addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const activeSpans = this.tracer.getActiveSpans();
    if (activeSpans.length > 0) {
      const currentSpan = activeSpans[activeSpans.length - 1];
      this.tracer.addEvent(currentSpan, name, attributes);
    }
  }

  // Create custom metrics
  public createCustomCounter(name: string, description: string, _labels?: Record<string, string>) {
    return this.createCounter(name, description);
  }

  public createCustomHistogram(name: string, description: string, unit?: string, _labels?: Record<string, string>) {
    return this.createHistogram(name, description, unit);
  }

  // Get metrics data
  public getMetrics() {
    return {
      counters: this.metrics.getCounters(),
      histograms: this.metrics.getHistograms(),
      activeSpans: this.tracer.getActiveSpans().length,
      completedSpans: this.tracer.getCompletedSpans().length,
    };
  }

  // Reset metrics
  public resetMetrics(): void {
    this.metrics.reset();
    this.tracer.clearCompletedSpans();
  }
}

// Export singleton instance
export const tracingService = new TracingService();

// Express middleware for automatic tracing
export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Create a simple span for the HTTP request
  const span = tracingService.tracer.startSpan(`${req.method} ${req.path}`, {
    'http.method': req.method,
    'http.url': req.url,
    'http.target': req.path,
    'http.host': req.headers.host,
    'http.scheme': req.protocol,
    'user_agent': req.headers['user-agent'],
    'client_ip': req.ip,
    'request.id': (req as any).requestId,
    'user.id': (req as any).userId,
  });

  // Increment active connections
  tracingService.activeConnections.add(1);

  // Intercept response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    // Record response metrics
    tracingService.httpRequestsTotal.add(1, {
      method: req.method,
      route: req.path,
      status_code: res.statusCode.toString(),
    });
    
    tracingService.httpRequestDuration.record(duration, {
      method: req.method,
      route: req.path,
      status_code: res.statusCode.toString(),
    });
    
    // Decrement active connections
    tracingService.activeConnections.add(-1);
    
    // Set span attributes
    tracingService.tracer.addEvent(span, 'http.response.end', {
      'http.status_code': res.statusCode,
      'http.response.duration_ms': duration,
    });

    // End span with appropriate status
    if (res.statusCode >= 400) {
      tracingService.tracer.endSpan(span, {
        code: 1, // ERROR
        message: `HTTP ${res.statusCode}`,
      });
      
      // Increment error counter
      tracingService.errors.add(1, {
        type: 'http_error',
        status_code: res.statusCode.toString(),
        route: req.path,
      });
    } else {
      tracingService.tracer.endSpan(span, { code: 0 }); // OK
    }
    
    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  // Add request event
  tracingService.tracer.addEvent(span, 'http.request.start', {
    'http.method': req.method,
    'http.path': req.path,
  });

  next();
};

// Database operation tracing
export const traceDatabaseOperation = <T>(
  operation: string,
  table: string,
  fn: () => Promise<T>
): Promise<T> => {
  return tracingService.createSpan(`database.${operation}`, (span) => {
    tracingService.tracer.addEvent(span, 'database.operation.start', {
      'db.operation': operation,
      'db.table': table,
      'db.system': 'postgresql',
    });

    tracingService.databaseConnections.add(1);

    return fn().finally(() => {
      tracingService.databaseConnections.add(-1);
      tracingService.tracer.addEvent(span, 'database.operation.end');
    });
  });
};

// AI service operation tracing
export const traceAIOperation = <T>(
  provider: string,
  model: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  return tracingService.createSpan(`ai.${operation}`, (span) => {
    tracingService.tracer.addEvent(span, 'ai.operation.start', {
      'ai.provider': provider,
      'ai.model': model,
      'ai.operation': operation,
    });

    const startTime = Date.now();
    
    tracingService.aiRequests.add(1, {
      provider,
      model,
      operation,
    });

    return fn().finally(() => {
      const duration = Date.now() - startTime;
      tracingService.aiRequestDuration.record(duration, {
        provider,
        model,
        operation,
      });
      tracingService.tracer.addEvent(span, 'ai.operation.end', {
        'ai.duration_ms': duration,
      });
    });
  });
};

// Admin operation tracing
export const traceAdminOperation = <T>(
  operation: string,
  resourceType: string,
  resourceId?: string,
  fn: () => Promise<T>
): Promise<T> => {
  return tracingService.createSpan(`admin.${operation}`, (span) => {
    tracingService.tracer.addEvent(span, 'admin.operation.start', {
      'admin.operation': operation,
      'admin.resource_type': resourceType,
      'admin.resource_id': resourceId,
      'user.id': (global as any).userId,
    });

    tracingService.adminOperations.add(1, {
      operation,
      resource_type: resourceType,
    });

    return fn().finally(() => {
      tracingService.tracer.addEvent(span, 'admin.operation.end');
    });
  });
};

// Workflow execution tracing
export const traceWorkflowExecution = <T>(
  workflowId: string,
  workflowName: string,
  fn: () => Promise<T>
): Promise<T> => {
  return tracingService.createSpan('workflow.execute', (span) => {
    tracingService.tracer.addEvent(span, 'workflow.execution.start', {
      'workflow.id': workflowId,
      'workflow.name': workflowName,
    });

    tracingService.workflowExecutions.add(1, {
      workflow_id: workflowId,
    });

    return fn().finally(() => {
      tracingService.tracer.addEvent(span, 'workflow.execution.end');
    });
  });
};

// Error tracing
export const traceError = (error: Error, context?: Record<string, any>): void => {
  const activeSpans = tracingService.tracer.getActiveSpans();
  if (activeSpans.length > 0) {
    const currentSpan = activeSpans[activeSpans.length - 1];
    tracingService.tracer.addEvent(currentSpan, 'error', {
      'error.name': error.name,
      'error.message': error.message,
      'error.stack': error.stack,
      ...context,
    });
    
    tracingService.tracer.endSpan(currentSpan, {
      code: 1, // ERROR
      message: error.message,
    });
  }

  tracingService.errors.add(1, {
    type: error.name,
    message: error.message,
  });
};

// Performance monitoring
export class PerformanceMonitor {
  private static timers: Map<string, number> = new Map();

  static startTimer(name: string): void {
    this.timers.set(name, Date.now());
  }

  static endTimer(name: string, attributes?: Record<string, any>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      throw new Error(`Timer '${name}' not found`);
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    tracingService.createCustomHistogram('custom_timer_duration', 'Custom timer duration').record(duration, attributes);
    
    return duration;
  }

  static recordFunctionPerformance<T>(
    name: string,
    fn: () => T,
    attributes?: Record<string, any>
  ): T {
    this.startTimer(name);
    try {
      const result = fn();
      this.endTimer(name, attributes);
      return result;
    } catch (error) {
      this.endTimer(name, { ...attributes, error: true });
      throw error;
    }
  }

  static async recordAsyncFunctionPerformance<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name);
    try {
      const result = await fn();
      this.endTimer(name, attributes);
      return result;
    } catch (error) {
      this.endTimer(name, { ...attributes, error: true });
      throw error;
    }
  }
}

// Export convenience functions
export const {
  createSpan,
  setSpanAttributes,
  addSpanEvent,
  createCustomCounter,
  createCustomHistogram,
} = tracingService;
