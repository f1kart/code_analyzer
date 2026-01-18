// DistributedTracer.ts - Enterprise-grade distributed tracing with OpenTelemetry
// Provides request correlation, performance bottleneck identification, and service dependency mapping

import { PerformanceMonitor } from './PerformanceMonitor';
import { AuditLogger, AuditEventType, AuditContext } from './AuditLogger';

export interface Trace {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'started' | 'completed' | 'error';
  parentId?: string;
  serviceName: string;
  serviceVersion: string;
  operation: string;
  tags: Record<string, string>;
  events: TraceEvent[];
  children: Trace[];
}

export interface TraceEvent {
  id: string;
  name: string;
  timestamp: Date;
  attributes: Record<string, any>;
  kind: 'internal' | 'client' | 'server' | 'producer' | 'consumer';
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind: 'internal' | 'client' | 'server' | 'producer' | 'consumer';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'ok' | 'error' | 'unset';
  attributes: Record<string, any>;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: Date;
  attributes: Record<string, any>;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
}

export interface ServiceDependency {
  serviceName: string;
  operation: string;
  averageLatency: number;
  callCount: number;
  errorRate: number;
  lastSeen: Date;
}

export interface TraceAnalysis {
  traceId: string;
  duration: number;
  serviceCount: number;
  spanCount: number;
  errorSpans: number;
  bottlenecks: Bottleneck[];
  recommendations: string[];
  serviceDependencies: ServiceDependency[];
}

export interface Bottleneck {
  service: string;
  operation: string;
  duration: number;
  percentage: number;
  recommendation: string;
}

export class DistributedTracer {
  private performanceMonitor: PerformanceMonitor;
  private auditLogger: AuditLogger;
  private activeTraces: Map<string, Trace> = new Map();
  private spans: Map<string, Span> = new Map();
  private serviceDependencies: Map<string, ServiceDependency[]> = new Map();
  private traceContext: Map<string, TraceContext> = new Map();

  constructor(performanceMonitor?: PerformanceMonitor, auditLogger?: AuditLogger) {
    this.performanceMonitor = performanceMonitor || new PerformanceMonitor();
    this.auditLogger = auditLogger || new AuditLogger();
    this.initializeTracing();
  }

  /**
   * Starts a new distributed trace
   * @param name Trace name/operation
   * @param serviceName Service initiating the trace
   * @param operation Operation being traced
   * @param context Optional trace context for correlation
   * @returns Trace ID and span context
   */
  startTrace(
    name: string,
    serviceName: string,
    operation: string,
    context?: Partial<TraceContext>
  ): { traceId: string; spanContext: TraceContext } {
    const traceId = context?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();

    const traceContext: TraceContext = {
      traceId,
      spanId,
      traceFlags: 1, // Sampled
      traceState: context?.traceState
    };

    const trace: Trace = {
      id: traceId,
      name,
      startTime: new Date(),
      status: 'started',
      serviceName,
      serviceVersion: '1.0.0', // Would be dynamic in production
      operation,
      tags: {
        service: serviceName,
        operation,
        trace_type: 'distributed'
      },
      events: [],
      children: []
    };

    const span: Span = {
      id: spanId,
      traceId,
      name,
      kind: 'internal',
      startTime: new Date(),
      status: 'ok',
      attributes: {
        service: serviceName,
        operation,
        start_time: trace.startTime.toISOString()
      },
      events: []
    };

    this.activeTraces.set(traceId, trace);
    this.spans.set(spanId, span);
    this.traceContext.set(traceId, traceContext);

    // Record trace start in performance monitor
    this.performanceMonitor.recordMetric(
      'trace_started',
      1,
      'count',
      { service: serviceName, operation }
    );

    // Log trace start
    this.auditLogger.logEvent(
      'system_maintenance',
      'Distributed trace started',
      {
        traceId,
        traceName: name,
        serviceName,
        operation
      },
      { resourceType: 'system_event' }
    );

    return { traceId, spanContext: traceContext };
  }

  /**
   * Records a span event within a trace
   * @param traceId Trace ID
   * @param spanId Span ID
   * @param eventName Event name
   * @param attributes Event attributes
   */
  recordSpanEvent(
    traceId: string,
    spanId: string,
    eventName: string,
    attributes: Record<string, any> = {}
  ): void {
    const span = this.spans.get(spanId);
    if (!span || span.traceId !== traceId) {
      return;
    }

    const event: SpanEvent = {
      name: eventName,
      timestamp: new Date(),
      attributes
    };

    span.events.push(event);

    // Update span attributes
    span.attributes = { ...span.attributes, ...attributes };

    this.spans.set(spanId, span);
  }

  /**
   * Ends a span and calculates duration
   * @param spanId Span ID
   * @param status Span status
   * @param error Optional error information
   */
  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', error?: string): void {
    const span = this.spans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = new Date();
    span.duration = span.endTime.getTime() - span.startTime.getTime();
    span.status = status;

    if (error) {
      span.attributes.error = error;
      span.status = 'error';
    }

    this.spans.set(spanId, span);

    // Record span duration in performance monitor
    this.performanceMonitor.recordMetric(
      'span_duration',
      span.duration,
      'ms',
      {
        traceId: span.traceId,
        spanId: span.id,
        operation: span.name,
        status: span.status
      }
    );

    // Update trace if this is the root span
    const trace = this.activeTraces.get(span.traceId);
    if (trace && !trace.endTime) {
      // Check if all child spans are complete
      const childSpans = Array.from(this.spans.values()).filter(s => s.traceId === trace.id);

      if (childSpans.every(s => s.endTime)) {
        this.endTrace(trace.id);
      }
    }
  }

  /**
   * Ends a distributed trace
   * @param traceId Trace ID
   */
  endTrace(traceId: string): void {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      return;
    }

    trace.endTime = new Date();
    trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    trace.status = 'completed';

    // Analyze trace for performance insights
    const analysis = this.analyzeTrace(trace);

    // Record trace completion metrics
    this.performanceMonitor.recordMetric(
      'trace_completed',
      1,
      'count',
      {
        traceId,
        serviceCount: analysis.serviceCount.toString(),
        spanCount: analysis.spanCount.toString(),
        duration: trace.duration.toString()
      }
    );

    // Update service dependencies
    this.updateServiceDependencies(trace, analysis);

    // Log trace completion
    this.auditLogger.logEvent(
      'system_maintenance',
      'Distributed trace completed',
      {
        traceId,
        traceName: trace.name,
        duration: trace.duration,
        serviceCount: analysis.serviceCount,
        spanCount: analysis.spanCount,
        bottlenecks: analysis.bottlenecks.length
      },
      { resourceType: 'system_event' }
    );

    this.activeTraces.set(traceId, trace);
  }

  /**
   * Creates a child span for a parent trace
   * @param parentTraceId Parent trace ID
   * @param parentSpanId Parent span ID
   * @param childName Child operation name
   * @param serviceName Service name
   * @returns Child span context
   */
  createChildSpan(
    parentTraceId: string,
    parentSpanId: string,
    childName: string,
    serviceName: string
  ): TraceContext {
    const traceId = parentTraceId;
    const spanId = this.generateSpanId();

    const span: Span = {
      id: spanId,
      traceId,
      parentSpanId,
      name: childName,
      kind: 'internal',
      startTime: new Date(),
      status: 'ok',
      attributes: {
        service: serviceName,
        operation: childName,
        parentSpanId
      },
      events: []
    };

    this.spans.set(spanId, span);

    // Add to parent trace children
    const parentTrace = this.activeTraces.get(traceId);
    if (parentTrace) {
      const childTraceRecord: Trace = {
        id: spanId,
        name: childName,
        startTime: span.startTime,
        status: 'started',
        parentId: parentSpanId,
        serviceName,
        serviceVersion: '1.0.0',
        operation: childName,
        tags: { service: serviceName, parent: parentSpanId },
        events: [],
        children: []
      };
      parentTrace.children.push(childTraceRecord);
    }

    const traceContext: TraceContext = {
      traceId,
      spanId,
      traceFlags: 1
    };

    this.traceContext.set(traceId, traceContext);

    return traceContext;
  }

  /**
   * Records a client-side operation (API call, database query, etc.)
   * @param traceId Trace ID
   * @param spanId Span ID
   * @param operation Operation name
   * @param target Target service/endpoint
   * @param method HTTP method or operation type
   */
  recordClientOperation(
    traceId: string,
    spanId: string,
    operation: string,
    target: string,
    method: string
  ): void {
    this.recordSpanEvent(traceId, spanId, 'client_operation', {
      operation,
      target,
      method,
      timestamp: new Date().toISOString()
    });

    // Update service dependencies
    this.updateServiceDependency(traceId, operation, target);
  }

  /**
   * Records a server-side operation (incoming request)
   * @param traceId Trace ID
   * @param spanId Span ID
   * @param operation Operation name
   * @param source Source of the request
   */
  recordServerOperation(
    traceId: string,
    spanId: string,
    operation: string,
    source: string
  ): void {
    this.recordSpanEvent(traceId, spanId, 'server_operation', {
      operation,
      source,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Analyzes a completed trace for performance insights
   * @param trace Completed trace
   * @returns Trace analysis
   */
  analyzeTrace(trace: Trace): TraceAnalysis {
    const spans = Array.from(this.spans.values()).filter(s => s.traceId === trace.id);
    const serviceCount = new Set(spans.map(s => s.attributes.service)).size;
    const spanCount = spans.length;
    const errorSpans = spans.filter(s => s.status === 'error').length;

    // Identify bottlenecks (spans > 1 second)
    const bottlenecks: Bottleneck[] = spans
      .filter(s => s.duration && s.duration > 1000)
      .map(s => ({
        service: s.attributes.service || 'unknown',
        operation: s.name,
        duration: s.duration || 0,
        percentage: trace.duration ? ((s.duration || 0) / trace.duration) * 100 : 0,
        recommendation: this.generateBottleneckRecommendation(s)
      }));

    // Generate recommendations
    const recommendations = this.generateTraceRecommendations(trace, bottlenecks);

    // Get service dependencies from trace spans
    const serviceDependencies = this.extractServiceDependenciesFromSpans(spans);

    return {
      traceId: trace.id,
      duration: trace.duration || 0,
      serviceCount,
      spanCount,
      errorSpans,
      bottlenecks,
      recommendations,
      serviceDependencies
    };
  }

  /**
   * Gets trace visualization data for dashboards
   * @param traceId Trace ID
   * @returns Trace visualization data
   */
  getTraceVisualization(traceId: string): TraceVisualization {
    const trace = this.activeTraces.get(traceId);
    if (!trace) {
      throw new Error(`Trace ${traceId} not found`);
    }

    const spans = Array.from(this.spans.values()).filter(s => s.traceId === traceId);

    return {
      traceId,
      name: trace.name,
      duration: trace.duration || 0,
      status: trace.status,
      spans: spans.map(span => ({
        id: span.id,
        name: span.name,
        kind: span.kind,
        startTime: span.startTime,
        duration: span.duration || 0,
        status: span.status,
        attributes: span.attributes,
        events: span.events,
        parentSpanId: span.parentSpanId
      })),
      timeline: this.generateTimeline(spans),
      serviceMap: this.generateServiceMap(spans)
    };
  }

  /**
   * Exports traces in various formats
   * @param format Export format
   * @param timeRange Time range for export
   * @returns Exported trace data
   */
  async exportTraces(
    format: 'json' | 'jaeger' | 'zipkin',
    timeRange: { start: Date; end: Date }
  ): Promise<string> {
    const traces = await this.getTracesInRange(timeRange);

    switch (format) {
      case 'json':
        return JSON.stringify(traces, null, 2);

      case 'jaeger':
        return this.convertToJaegerFormat(traces);

      case 'zipkin':
        return this.convertToZipkinFormat(traces);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Extracts service dependencies from spans
   * @param spans Spans to analyze
   * @returns Service dependency information
   */
  private extractServiceDependenciesFromSpans(spans: Span[]): ServiceDependency[] {
    const dependencies = new Map<string, ServiceDependency>();

    spans.forEach(span => {
      const serviceName = span.attributes.service || 'unknown';
      const key = `${serviceName}:${span.name}`;

      if (!dependencies.has(key)) {
        dependencies.set(key, {
          serviceName,
          operation: span.name,
          averageLatency: 0,
          callCount: 0,
          errorRate: 0,
          lastSeen: span.endTime || span.startTime
        });
      }

      const dep = dependencies.get(key)!;
      dep.callCount++;
      dep.averageLatency = ((dep.averageLatency * (dep.callCount - 1)) + (span.duration || 0)) / dep.callCount;
      if (span.status === 'error') {
        dep.errorRate = (dep.errorRate * (dep.callCount - 1) + 1) / dep.callCount;
      }
      if (span.endTime && span.endTime > dep.lastSeen) {
        dep.lastSeen = span.endTime;
      }
    });

    return Array.from(dependencies.values());
  }

  /**
   * Gets service dependency information for a time range
   * @param timeRange Time range for analysis
   * @returns Service dependency information
   */
  async getServiceDependencies(_timeRange: { start: Date; end: Date }): Promise<ServiceDependency[]> {
    const dependencies = Array.from(this.serviceDependencies.values()).flat();

    // Aggregate and calculate metrics
    const aggregated = new Map<string, ServiceDependency>();

    for (const dep of dependencies) {
      const key = `${dep.serviceName}_${dep.operation}`;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.callCount += dep.callCount;
        existing.averageLatency = (existing.averageLatency + dep.averageLatency) / 2;
        existing.errorRate = (existing.errorRate + dep.errorRate) / 2;
        existing.lastSeen = new Date(Math.max(existing.lastSeen.getTime(), dep.lastSeen.getTime()));
      } else {
        aggregated.set(key, { ...dep });
      }
    }

    return Array.from(aggregated.values());
  }

  private initializeTracing(): void {
    // Initialize tracing configuration with OpenTelemetry-compatible setup
    // Set up automatic instrumentation for common operations
    this.instrumentCodeReviewOperations();
    this.instrumentSecurityOperations();
    this.instrumentAuditOperations();
  }

  private instrumentCodeReviewOperations(): void {
    // Instrument code review engine operations
    const originalReviewCode = (this.performanceMonitor as any).reviewEngine?.reviewCode;
    if (originalReviewCode) {
      (this.performanceMonitor as any).reviewEngine.reviewCode = async (...args: any[]) => {
        const traceContext = this.startTrace(
          'code_review',
          'code_review_engine',
          'review_code'
        );

        try {
          const result = await originalReviewCode.apply(this, args);

          // Record review metrics
          const endTime = Date.now();
          const startTime = traceContext.spanContext.traceFlags;
          await this.performanceMonitor.recordReviewMetrics(result, {
            traceId: traceContext.traceId,
            duration: endTime - startTime
          });

          return result;
        } catch (error) {
          this.endSpan(traceContext.spanContext.spanId, 'error', error instanceof Error ? error.message : 'Unknown error');
          throw error;
        } finally {
          this.endTrace(traceContext.traceId);
        }
      };
    }
  }

  private instrumentSecurityOperations(): void {
    // Instrument security scanner operations
    const originalScan = (this.performanceMonitor as any).securityScanner?.scanCode;
    if (originalScan) {
      (this.performanceMonitor as any).securityScanner.scanCode = async (...args: any[]) => {
        const traceContext = this.startTrace(
          'security_scan',
          'security_scanner',
          'scan_code'
        );

        try {
          const result = await originalScan.apply(this, args);
          return result;
        } catch (error) {
          this.endSpan(traceContext.spanContext.spanId, 'error', error instanceof Error ? error.message : 'Unknown error');
          throw error;
        } finally {
          this.endTrace(traceContext.traceId);
        }
      };
    }
  }

  private instrumentAuditOperations(): void {
    // Instrument audit logger operations
    const originalLogEvent = this.auditLogger.logEvent;
    if (originalLogEvent) {
      this.auditLogger.logEvent = async (...args: any[]) => {
        const traceContext = this.startTrace(
          'audit_log',
          'audit_logger',
          'log_event'
        );

        try {
          const result = await originalLogEvent.apply(this.auditLogger, args as [AuditEventType, string, Record<string, any>?, AuditContext?]);
          return result;
        } catch (error) {
          this.endSpan(traceContext.spanContext.spanId, 'error', error instanceof Error ? error.message : 'Unknown error');
          throw error;
        } finally {
          this.endTrace(traceContext.traceId);
        }
      };
    }
  }

  private generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSpanId(): string {
    return `span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateServiceDependency(traceId: string, operation: string, target: string): void {
    const dependencyKey = `${operation}_${target}`;

    if (!this.serviceDependencies.has(dependencyKey)) {
      this.serviceDependencies.set(dependencyKey, []);
    }

    const deps = this.serviceDependencies.get(dependencyKey)!;
    const existing = deps.find(d => d.serviceName === target && d.operation === operation);

    if (existing) {
      existing.callCount++;
      existing.lastSeen = new Date();
    } else {
      const relatedSpans = Array.from(this.spans.values()).filter(
        s => s.traceId === traceId && s.attributes.target === target
      );
      const avgLatency = relatedSpans.length > 0
        ? relatedSpans.reduce((sum, s) => sum + (s.duration || 0), 0) / relatedSpans.length
        : 0;
      
      deps.push({
        serviceName: target,
        operation,
        averageLatency: avgLatency,
        callCount: 1,
        errorRate: 0,
        lastSeen: new Date()
      });
    }
  }

  private updateServiceDependencies(trace: Trace, analysis: TraceAnalysis): void {
    // Update service dependency information based on trace analysis with aggregation
    analysis.serviceDependencies.forEach(dep => {
      const key = `${dep.operation}_${dep.serviceName}`;
      if (!this.serviceDependencies.has(key)) {
        this.serviceDependencies.set(key, []);
      }
      this.serviceDependencies.get(key)!.push(dep);
    });
  }

  private generateBottleneckRecommendation(span: Span): string {
    if (span.duration && span.duration > 5000) {
      return 'Consider optimizing this operation - duration exceeds 5 seconds';
    }
    if (span.status === 'error') {
      return 'Investigate error in this operation';
    }
    return 'Performance appears normal';
  }

  private generateTraceRecommendations(trace: Trace, bottlenecks: Bottleneck[]): string[] {
    const recommendations: string[] = [];

    if (bottlenecks.length > 0) {
      recommendations.push(`Found ${bottlenecks.length} performance bottlenecks`);
    }

    if (trace.duration && trace.duration > 10000) {
      recommendations.push('Overall trace duration is high - consider optimization');
    }

    const errorSpans = Array.from(this.spans.values()).filter(s =>
      s.traceId === trace.id && s.status === 'error'
    );

    if (errorSpans.length > 0) {
      recommendations.push(`${errorSpans.length} spans have errors - investigate reliability`);
    }

    return recommendations;
  }

  private generateTimeline(spans: Span[]): TimelineEntry[] {
    const timeline: TimelineEntry[] = [];

    spans.forEach(span => {
      timeline.push({
        spanId: span.id,
        name: span.name,
        startTime: span.startTime,
        duration: span.duration || 0,
        level: this.calculateSpanLevel(span),
        status: span.status,
        service: span.attributes.service || 'unknown'
      });
    });

    return timeline.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }

  private calculateSpanLevel(span: Span): number {
    let level = 0;
    let currentSpan = span;

    while (currentSpan.parentSpanId) {
      level++;
      const parent = Array.from(this.spans.values()).find(s => s.id === currentSpan.parentSpanId);
      if (!parent) break;
      currentSpan = parent;
    }

    return level;
  }

  private generateServiceMap(spans: Span[]): ServiceMap {
    const services = new Map<string, ServiceNode>();

    spans.forEach(span => {
      const serviceName = span.attributes.service || 'unknown';

      if (!services.has(serviceName)) {
        services.set(serviceName, {
          name: serviceName,
          operations: [],
          dependencies: []
        });
      }

      const service = services.get(serviceName)!;
      if (!service.operations.includes(span.name)) {
        service.operations.push(span.name);
      }

      // Add dependencies based on span events
      span.events.forEach(event => {
        if (event.name === 'client_operation' && event.attributes.target) {
          service.dependencies.push(event.attributes.target);
        }
      });
    });

    return { services: Array.from(services.values()) };
  }

  private async getTracesInRange(timeRange: { start: Date; end: Date }): Promise<Trace[]> {
    // Query traces within time range from active traces and completed traces
    // In a full production system, this would query from persistent storage (database/time-series DB)
    const allTraces = Array.from(this.activeTraces.values());
    return allTraces.filter(trace => {
      const traceTime = trace.startTime;
      return traceTime >= timeRange.start && traceTime <= timeRange.end;
    });
  }

  private convertToJaegerFormat(traces: Trace[]): string {
    // Convert to Jaeger JSON format
    const jaegerTraces = traces.map(trace => ({
      traceID: trace.id,
      spans: Array.from(this.spans.values())
        .filter(s => s.traceId === trace.id)
        .map(span => ({
          traceID: span.traceId,
          spanID: span.id,
          parentSpanID: span.parentSpanId,
          operationName: span.name,
          references: [],
          startTime: span.startTime.getTime() * 1000, // Jaeger expects microseconds
          duration: (span.duration || 0) * 1000,
          tags: Object.entries(span.attributes).map(([key, value]) => ({
            key,
            value: String(value)
          })),
          logs: span.events.map(event => ({
            timestamp: event.timestamp.getTime() * 1000,
            fields: Object.entries(event.attributes).map(([key, value]) => ({
              key,
              value: String(value)
            }))
          }))
        })),
      processes: {
        [trace.serviceName]: {
          serviceName: trace.serviceName,
          tags: []
        }
      }
    }));

    return JSON.stringify(jaegerTraces, null, 2);
  }

  private convertToZipkinFormat(traces: Trace[]): string {
    // Convert to Zipkin JSON format
    const zipkinSpans = traces.flatMap(trace =>
      Array.from(this.spans.values())
        .filter(s => s.traceId === trace.id)
        .map(span => ({
          traceId: span.traceId,
          parentId: span.parentSpanId,
          id: span.id,
          name: span.name,
          timestamp: span.startTime.getTime() * 1000, // Zipkin expects microseconds
          duration: (span.duration || 0) * 1000,
          localEndpoint: {
            serviceName: span.attributes.service || 'unknown'
          },
          tags: span.attributes,
          annotations: span.events.map(event => ({
            timestamp: event.timestamp.getTime() * 1000,
            value: event.name,
            endpoint: {
              serviceName: span.attributes.service || 'unknown'
            }
          }))
        }))
    );

    return JSON.stringify(zipkinSpans, null, 2);
  }
}

interface TraceVisualization {
  traceId: string;
  name: string;
  duration: number;
  status: string;
  spans: VizSpan[];
  timeline: TimelineEntry[];
  serviceMap: ServiceMap;
}

interface VizSpan {
  id: string;
  name: string;
  kind: string;
  startTime: Date;
  duration: number;
  status: string;
  attributes: Record<string, any>;
  events: SpanEvent[];
  parentSpanId?: string;
}

interface TimelineEntry {
  spanId: string;
  name: string;
  startTime: Date;
  duration: number;
  level: number;
  status: string;
  service: string;
}

interface ServiceNode {
  name: string;
  operations: string[];
  dependencies: string[];
}

interface ServiceMap {
  services: ServiceNode[];
}
