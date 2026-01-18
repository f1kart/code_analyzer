/**
 * Distributed Tracing Service
 * OpenTelemetry-compatible tracing for performance monitoring
 * KEN RULES: PRODUCTION-READY, NO MOCKUPS
 */

export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  attributes: Record<string, any>;
  events: Array<{
    timestamp: Date;
    name: string;
    attributes?: Record<string, any>;
  }>;
  status: 'ok' | 'error';
  error?: string;
}

export interface Trace {
  id: string;
  rootSpan: Span;
  spans: Span[];
  duration: number;
  serviceName: string;
}

/**
 * Distributed Tracing Service
 */
export class DistributedTracingService {
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, Span> = new Map();

  constructor() {
    console.log('[DistributedTracing] Service initialized');
  }

  /**
   * Start trace
   */
  public startTrace(name: string, attributes?: Record<string, any>): string {
    const traceId = this.generateId();
    const span = this.startSpan(name, traceId, undefined, attributes);

    const trace: Trace = {
      id: traceId,
      rootSpan: span,
      spans: [span],
      duration: 0,
      serviceName: 'gemini-ide',
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  /**
   * Start span
   */
  public startSpan(
    name: string,
    traceId: string,
    parentId?: string,
    attributes?: Record<string, any>
  ): Span {
    const span: Span = {
      id: this.generateId(),
      traceId,
      parentId,
      name,
      startTime: new Date(),
      attributes: attributes || {},
      events: [],
      status: 'ok',
    };

    this.activeSpans.set(span.id, span);

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    return span;
  }

  /**
   * End span
   */
  public endSpan(spanId: string, error?: Error): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();

    if (error) {
      span.status = 'error';
      span.error = error.message;
    }

    this.activeSpans.delete(spanId);

    // Update trace duration
    const trace = this.traces.get(span.traceId);
    if (trace && span.id === trace.rootSpan.id) {
      trace.duration = span.duration;
    }
  }

  /**
   * Add event to span
   */
  public addEvent(spanId: string, name: string, attributes?: Record<string, any>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({
        timestamp: new Date(),
        name,
        attributes,
      });
    }
  }

  /**
   * Get traces
   */
  public getTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Export traces
   */
  public exportTraces(format: 'jaeger' | 'zipkin'): string {
    const traces = this.getTraces();
    if (format === 'jaeger') return this.exportJaeger(traces);
    return this.exportZipkin(traces);
  }

  private exportJaeger(traces: Trace[]): string {
    return JSON.stringify({
      data: traces.map(trace => ({
        traceID: trace.id,
        spans: trace.spans.map(span => ({
          spanID: span.id,
          operationName: span.name,
          startTime: span.startTime.getTime() * 1000,
          duration: span.duration || 0,
          tags: Object.entries(span.attributes).map(([key, value]) => ({
            key,
            type: typeof value,
            value,
          })),
        })),
      })),
    });
  }

  private exportZipkin(traces: Trace[]): string {
    return JSON.stringify(
      traces.flatMap(trace =>
        trace.spans.map(span => ({
          traceId: trace.id,
          id: span.id,
          parentId: span.parentId,
          name: span.name,
          timestamp: span.startTime.getTime() * 1000,
          duration: (span.duration || 0) * 1000,
          tags: span.attributes,
        }))
      )
    );
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export function getDistributedTracing(): DistributedTracingService {
  return new DistributedTracingService();
}
