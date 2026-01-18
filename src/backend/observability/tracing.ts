import { trace, Span, SpanStatusCode, SpanKind, context, propagation, Context } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import config from '../config';

// Tracing configuration
export const TRACING_CONFIG = {
  serviceName: 'gemini-code-ide-backend',
  serviceVersion: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.OTEL_ENABLED === 'true' || process.env.NODE_ENV === 'production',
  samplingProbability: parseFloat(process.env.OTEL_SAMPLING_PROBABILITY || '0.1'),
  exporterEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
};

// Create tracer instance
export const tracer = trace.getTracer(TRACING_CONFIG.serviceName, TRACING_CONFIG.serviceVersion);

// Resource attributes
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: TRACING_CONFIG.serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: TRACING_CONFIG.serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: TRACING_CONFIG.environment,
  [SemanticResourceAttributes.PROCESS_PID]: process.pid,
  [SemanticResourceAttributes.PROCESS_EXECUTABLE_NAME]: process.argv0,
  [SemanticResourceAttributes.PROCESS_COMMAND_ARGS]: JSON.stringify(process.argv),
});

// Initialize OpenTelemetry tracing
export const initializeTracing = (): NodeSDK | null => {
  if (!TRACING_CONFIG.enabled) {
    console.log('🔍 Tracing disabled');
    return null;
  }

  try {
    // Create trace exporter
    const exporter = new OTLPTraceExporter({
      url: TRACING_CONFIG.exporterEndpoint,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Create span processor
    const spanProcessor = new SimpleSpanProcessor(exporter);

    // Initialize SDK
    const sdk = new NodeSDK({
      resource,
      traceExporter: exporter,
      spanProcessor,
      instrumentations: [getNodeAutoInstrumentations()],
      sampler: {
        type: 'traceidratio',
        probability: TRACING_CONFIG.samplingProbability,
      },
    });

    // Start the SDK
    sdk.start();
    console.log('🔍 OpenTelemetry tracing initialized');
    console.log(`📊 Service: ${TRACING_CONFIG.serviceName} v${TRACING_CONFIG.serviceVersion}`);
    console.log(`🎯 Sampling: ${(TRACING_CONFIG.samplingProbability * 100).toFixed(1)}%`);

    return sdk;
  } catch (error) {
    console.error('❌ Failed to initialize OpenTelemetry tracing:', error);
    return null;
  }
};

// Tracing utilities
export class TracingUtils {
  // Create a span with automatic context management
  static createSpan<T>(
    name: string,
    fn: (span: Span) => T,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, any>;
      parentContext?: Context;
    }
  ): T {
    const spanOptions: any = {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes || {},
    };

    if (options?.parentContext) {
      return context.with(options.parentContext, () => {
        const span = tracer.startSpan(name, spanOptions);
        try {
          return fn(span);
        } finally {
          span.end();
        }
      });
    }

    const span = tracer.startSpan(name, spanOptions);
    try {
      return fn(span);
    } finally {
      span.end.end();
    }
  }

  // Create a span for HTTP requests
  static createHttpSpan<T>(
    method: string,
    url: string,
    fn: (span: Span) => T,
    statusCode?: number,
    error?: Error
  ): T {
    return this.createSpan(
      `http.${method.toLowerCase()}`,
      (span) => {
        span.setAttributes({
          [SemanticResourceAttributes.HTTP_METHOD]: method,
          [SemanticResourceAttributes.HTTP_URL]: url,
          [SemanticResourceAttributes.HTTP_TARGET]: new URL(url).pathname,
          [SemanticResourceAttributes.HTTP_SCHEME]: new URL(url).protocol.slice(0, -1),
          [SemanticResourceAttributes.HTTP_HOST]: new URL(url).host,
        });

        if (statusCode) {
          span.setAttributes({
            [SemanticResourceAttributes.HTTP_STATUS_CODE]: statusCode,
          });

          if (statusCode >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${statusCode}`,
            });
          } else {
            span.setStatus({
              code: SpanStatusCode.OK,
            });
          }
        }

        if (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        }

        return fn(span);
      },
      {
        kind: SpanKind.SERVER,
      }
    );
  }

  // Create a span for database operations
  static createDatabaseSpan<T>(
    operation: string,
    table: string,
    fn: (span: Span) => T,
    error?: Error
  ): T {
    return this.createSpan(
      `database.${operation}`,
      (span) => {
        span.setAttributes({
          'db.system': 'postgresql',
          'db.operation': operation,
          'db.sql.table': table,
          'db.name': config.database.url?.split('/').pop(),
        });

        if (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        }

        return fn(span);
      },
      {
        kind: SpanKind.CLIENT,
      }
    );
  }

  // Create a span for admin operations
  static createAdminSpan<T>(
    operation: string,
    resourceType: string,
    fn: (span: Span) => T,
    userId?: string,
    error?: Error
  ): T {
    return this.createSpan(
      `admin.${operation}`,
      (span) => {
        span.setAttributes({
          'admin.operation': operation,
          'admin.resource_type': resourceType,
          'admin.user_id': userId || 'anonymous',
        });

        if (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        }

        return fn(span);
      },
      {
        kind: SpanKind.INTERNAL,
      }
    );
  }

  // Add custom attributes to current span
  static setAttributes(attributes: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  // Add event to current span
  static addEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  // Set error status on current span
  static setError(error: Error, message?: string): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: message || error.message,
      });
    }
  }

  // Extract context from headers
  static extractContext(headers: Record<string, string>): Context {
    return propagation.extract(context.active(), headers);
  }

  // Inject context into headers
  static injectContext(headers: Record<string, string>): void {
    propagation.inject(context.active(), headers);
  }
}

// Middleware factory for Express
export const createTracingMiddleware = () => {
  return (req: any, res: any, next: any) => {
    // Extract context from incoming headers
    const parentContext = TracingUtils.extractContext(req.headers);

    // Create span for the request
    TracingUtils.createHttpSpan(
      req.method,
      `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      (span) => {
        // Store span and context on request for later use
        req.span = span;
        req.traceContext = context.active();

        // Set additional attributes
        span.setAttributes({
          'http.request_id': req.requestId,
          'http.user_agent': req.get('User-Agent'),
          'http.remote_addr': req.ip || req.connection.remoteAddress,
          'http.x_forwarded_for': req.get('X-Forwarded-For'),
        });

        // Override res.end to capture status code
        const originalEnd = res.end;
        res.end = function(chunk?: any, encoding?: any, cb?: any) {
          span.setAttributes({
            [SemanticResourceAttributes.HTTP_STATUS_CODE]: res.statusCode,
          });

          if (res.statusCode >= 400) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: `HTTP ${res.statusCode}`,
            });
          } else {
            span.setStatus({
              code: SpanStatusCode.OK,
            });
          }

          return originalEnd.call(this, chunk, encoding, cb);
        };

        next();
      },
      res.statusCode,
      undefined,
      parentContext
    );
  };
};

// Health check for tracing
export const checkTracingHealth = () => {
  return {
    enabled: TRACING_CONFIG.enabled,
    serviceName: TRACING_CONFIG.serviceName,
    environment: TRACING_CONFIG.environment,
    samplingProbability: TRACING_CONFIG.samplingProbability,
    exporterEndpoint: TRACING_CONFIG.exporterEndpoint,
  };
};

export default {
  tracer,
  TracingUtils,
  createTracingMiddleware,
  checkTracingHealth,
  initializeTracing,
};
