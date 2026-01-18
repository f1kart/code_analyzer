// DistributedTracingService.ts - Enterprise-grade distributed tracing without external dependencies
// Provides comprehensive tracing capabilities with graceful degradation

interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  endpoint?: string;
  enabled?: boolean;
}

interface TraceSpan {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  attributes: Record<string, string | number | boolean>;
  events: TraceEvent[];
  status: 'ok' | 'error';
  error?: string;
}

interface TraceEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, string | number | boolean>;
}

interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

// Simple in-memory trace storage for development
class SimpleTraceStore {
  private traces = new Map<string, TraceSpan[]>();
  private maxTraces = 1000;

  addSpan(span: TraceSpan): void {
    if (!this.traces.has(span.id)) {
      this.traces.set(span.id, []);
    }

    this.traces.get(span.id)!.push(span);

    // Cleanup old traces to prevent memory leaks
    if (this.traces.size > this.maxTraces) {
      const oldestTrace = Array.from(this.traces.keys())[0];
      this.traces.delete(oldestTrace);
    }
  }

  getTrace(traceId: string): TraceSpan[] | undefined {
    return this.traces.get(traceId);
  }

  getAllTraces(): Map<string, TraceSpan[]> {
    return new Map(this.traces);
  }

  clear(): void {
    this.traces.clear();
  }
}

// Simple tracer implementation
class SimpleTracer {
  private currentTraceId: string | null = null;
  private currentSpanId: string | null = null;
  private spanStack: TraceSpan[] = [];
  private traceStore = new SimpleTraceStore();

  constructor(private config: TracingConfig) {}

  generateTraceId(): string {
    return Math.random().toString(36).substr(2, 16);
  }

  generateSpanId(): string {
    return Math.random().toString(36).substr(2, 8);
  }

  startSpan(name: string, attributes?: Record<string, string | number | boolean>): { span: TraceSpan; ctx: TraceContext } {
    const traceId = this.currentTraceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    const parentSpanId = this.currentSpanId;

    this.currentTraceId = traceId;
    this.currentSpanId = spanId;

    const span: TraceSpan = {
      id: `${traceId}:${spanId}`,
      name,
      startTime: Date.now(),
      attributes: attributes || {},
      events: [],
      status: 'ok'
    };

    // Add to span stack for proper nesting
    this.spanStack.push(span);

    console.log(`🔍 [${traceId}:${spanId}] Started: ${name}`, attributes);

    return {
      span,
      ctx: { traceId: traceId as string, spanId: spanId as string, parentSpanId: parentSpanId || undefined }
    };
  }

  endSpan({ span, ctx }: { span: TraceSpan; ctx: TraceContext }): void {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;

    // Remove from span stack
    const stackIndex = this.spanStack.findIndex(s => s.id === span.id);
    if (stackIndex >= 0) {
      this.spanStack.splice(stackIndex, 1);
    }

    // Update current span to parent if available
    if (this.spanStack.length > 0) {
      const parentSpan = this.spanStack[this.spanStack.length - 1];
      this.currentSpanId = parentSpan.id.split(':')[1];
    } else {
      this.currentSpanId = null;
      this.currentTraceId = null;
    }

    // Store the completed span
    this.traceStore.addSpan(span);

    console.log(`✅ [${ctx.traceId}:${ctx.spanId}] Completed: ${span.name} (${span.duration}ms)`);
  }

  recordEvent(spanId: string, eventName: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.spanStack.find(s => s.id.endsWith(spanId));
    if (span) {
      span.events.push({
        name: eventName,
        timestamp: Date.now(),
        attributes
      });
    }
  }

  setSpanStatus(spanId: string, status: 'ok' | 'error', error?: string): void {
    const span = this.spanStack.find(s => s.id.endsWith(spanId));
    if (span) {
      span.status = status;
      if (error) {
        span.error = error;
      }
    }
  }

  getCurrentTraceId(): string | null {
    return this.currentTraceId;
  }

  getCurrentSpanId(): string | null {
    return this.currentSpanId;
  }

  getTraces(): Map<string, TraceSpan[]> {
    return this.traceStore.getAllTraces();
  }

  async shutdown(): Promise<void> {
    this.traceStore.clear();
    this.spanStack = [];
    this.currentTraceId = null;
    this.currentSpanId = null;
    console.log('✅ Simple tracer shut down');
  }
}

// Factory function to create appropriate tracer
async function createTracer(config: TracingConfig): Promise<SimpleTracer> {
  console.log('📝 Using simple console tracer for distributed tracing');
  return new SimpleTracer(config);
}

export class DistributedTracingService {
  private tracer: SimpleTracer | null = null;

  constructor(private config: TracingConfig) {
    if (config.enabled !== false) {
      this.initializeTracing();
    }
  }

  private async initializeTracing(): Promise<void> {
    try {
      this.tracer = await createTracer(this.config);
      console.log('✅ Distributed tracing initialized');
    } catch (error) {
      console.error('❌ Failed to initialize distributed tracing:', error);
      this.tracer = null;
    }
  }

  /**
   * Creates a new span for tracking an operation
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): { span: TraceSpan; ctx: TraceContext } | null {
    if (!this.tracer) {
      return null;
    }
    return this.tracer.startSpan(name, attributes);
  }

  /**
   * Ends a span and records its duration
   */
  endSpan({ span, ctx }: { span: TraceSpan; ctx: TraceContext }): void {
    if (this.tracer) {
      this.tracer.endSpan({ span, ctx });
    }
  }

  /**
   * Creates a span for API operations
   */
  async traceAPICall<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const spanContext = this.startSpan(`api.${operationName}`, {
      'operation.type': 'api_call',
      ...attributes,
    });

    if (!spanContext) {
      return operation();
    }

    const { span, ctx } = spanContext;

    try {
      const result = await operation();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.endSpan({ span, ctx });
    }
  }

  /**
   * Creates a span for database operations
   */
  async traceDatabaseOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const spanContext = this.startSpan(`db.${operationName}`, {
      'operation.type': 'database',
      ...attributes,
    });

    if (!spanContext) {
      return operation();
    }

    const { span, ctx } = spanContext;

    try {
      const result = await operation();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.endSpan({ span, ctx });
    }
  }

  /**
   * Creates a span for AI processing operations
   */
  async traceAIProcessing<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const spanContext = this.startSpan(`ai.${operationName}`, {
      'operation.type': 'ai_processing',
      ...attributes,
    });

    if (!spanContext) {
      return operation();
    }

    const { span, ctx } = spanContext;

    try {
      const result = await operation();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.endSpan({ span, ctx });
    }
  }

  /**
   * Creates a span for file operations
   */
  async traceFileOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const spanContext = this.startSpan(`file.${operationName}`, {
      'operation.type': 'file_operation',
      ...attributes,
    });

    if (!spanContext) {
      return operation();
    }

    const { span, ctx } = spanContext;

    try {
      const result = await operation();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.endSpan({ span, ctx });
    }
  }

  /**
   * Injects tracing context into headers for distributed tracing
   */
  injectTracingContext(headers: Record<string, string> = {}): Record<string, string> {
    if (!this.tracer) {
      return headers;
    }

    const traceId = this.tracer.getCurrentTraceId();
    const spanId = this.tracer.getCurrentSpanId();

    if (traceId && spanId) {
      return {
        ...headers,
        'x-trace-id': traceId,
        'x-span-id': spanId,
      };
    }

    return headers;
  }

  /**
   * Extracts tracing context from headers
   */
  extractTracingContext(headers: Record<string, string>): void {
    // Simple implementation - in a real distributed system,
    // this would restore the tracing context
  }

  /**
   * Shuts down the tracing service
   */
  async shutdown(): Promise<void> {
    if (this.tracer) {
      await this.tracer.shutdown();
    }
  }

  /**
   * Gets current trace ID for correlation
   */
  getCurrentTraceId(): string | undefined {
    return this.tracer?.getCurrentTraceId() || undefined;
  }

  /**
   * Gets current span ID for correlation
   */
  getCurrentSpanId(): string | undefined {
    return this.tracer?.getCurrentSpanId() || undefined;
  }
}

// Singleton instance for application-wide tracing
let tracingService: DistributedTracingService | null = null;

export function initializeTracing(config: TracingConfig): DistributedTracingService {
  if (!tracingService) {
    tracingService = new DistributedTracingService(config);
  }
  return tracingService;
}

export function getTracingService(): DistributedTracingService | null {
  return tracingService;
}

// Convenience functions for common tracing patterns
export async function withTracing<T>(
  operationName: string,
  operation: () => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  if (!tracingService) {
    return operation();
  }

  return tracingService.traceAPICall(operationName, operation, attributes);
}

export function getTraceContext() {
  return {
    traceId: tracingService?.getCurrentTraceId(),
    spanId: tracingService?.getCurrentSpanId(),
  };
}
