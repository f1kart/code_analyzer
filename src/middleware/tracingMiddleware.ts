import { initializeTracing, getTracingService, withTracing, getTraceContext } from '../services/DistributedTracingService';

export interface TracingMiddlewareConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpEndpoint?: string;
  enabled?: boolean;
}

/**
 * Middleware for instrumenting HTTP requests with distributed tracing
 */
export function tracingMiddleware(config: TracingMiddlewareConfig) {
  // Initialize tracing service
  initializeTracing({
    serviceName: config.serviceName,
    serviceVersion: config.serviceVersion,
    environment: config.environment,
    endpoint: config.otlpEndpoint,
    enabled: config.enabled,
  });

  return {
    /**
     * Wraps an API operation with tracing
     */
    traceOperation: async <T>(
      operationName: string,
      operation: () => Promise<T>,
      attributes?: Record<string, string | number | boolean>
    ): Promise<T> => {
      return withTracing(operationName, operation, {
        'middleware.type': 'api_tracing',
        ...attributes,
      });
    },

    /**
     * Instruments an Express.js route handler
     */
    instrumentRoute: (routeName: string) => {
      return async (req: any, res: any, next: any) => {
        const { span, ctx } = getTracingService()?.startSpan(`http.${req.method.toLowerCase()}.${routeName}`, {
          'http.method': req.method,
          'http.url': req.url,
          'http.user_agent': req.get('User-Agent') || '',
          'middleware.type': 'express_route',
        }) || { span: null, ctx: null };

        // Add trace context to response headers for distributed tracing
        if (span) {
          const traceHeaders = getTracingService()?.injectTracingContext() || {};
          Object.keys(traceHeaders).forEach(key => {
            res.setHeader(key, traceHeaders[key]);
          });
        }

        // Override res.end to capture response status
        const originalEnd = res.end;
        res.end = function(chunk?: any, encoding?: any) {
          if (span) {
            span.attributes['http.status_code'] = res.statusCode;
            if (res.statusCode >= 400) {
              span.status = 'error';
            } else {
              span.status = 'ok';
            }
          }
          return originalEnd.call(this, chunk, encoding);
        };

        // Run the next middleware
        return next();
      };
    },

    /**
     * Instruments database operations
     */
    traceDatabaseCall: async <T>(
      operationName: string,
      operation: () => Promise<T>,
      attributes?: Record<string, string | number | boolean>
    ): Promise<T> => {
      return getTracingService()?.traceDatabaseOperation(operationName, operation, {
        'middleware.type': 'database_tracing',
        ...attributes,
      }) || operation();
    },

    /**
     * Instruments AI processing operations
     */
    traceAICall: async <T>(
      operationName: string,
      operation: () => Promise<T>,
      attributes?: Record<string, string | number | boolean>
    ): Promise<T> => {
      return getTracingService()?.traceAIProcessing(operationName, operation, {
        'middleware.type': 'ai_tracing',
        ...attributes,
      }) || operation();
    },

    /**
     * Instruments file operations
     */
    traceFileOperation: async <T>(
      operationName: string,
      operation: () => Promise<T>,
      attributes?: Record<string, string | number | boolean>
    ): Promise<T> => {
      return getTracingService()?.traceFileOperation(operationName, operation, {
        'middleware.type': 'file_tracing',
        ...attributes,
      }) || operation();
    },

    /**
     * Gets current trace context for logging
     */
    getTraceContext: () => {
      return getTraceContext();
    },

    /**
     * Shutdown tracing service
     */
    shutdown: async () => {
      await getTracingService()?.shutdown();
    },
  };
}

/**
 * Decorator for instrumenting class methods
 */
export function TraceMethod(operationName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const methodName = operationName || `${target.constructor.name}.${propertyKey}`;
      const tracing = getTracingService();

      if (tracing) {
        return tracing.traceAPICall(methodName, () => originalMethod.apply(this, args), {
          'method.name': propertyKey,
          'class.name': target.constructor.name,
        });
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Higher-order component for React component tracing
 */
export function withTracingHOC<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const tracing = getTracingService();

    React.useEffect(() => {
      if (tracing) {
        const spanContext = tracing.startSpan(`component.${componentName || Component.displayName || Component.name}`, {
          'component.name': Component.displayName || Component.name,
          'middleware.type': 'react_component',
        });

        return () => {
          if (spanContext) {
            tracing.endSpan(spanContext);
          }
        };
      }
    }, [tracing]);

    return React.createElement(Component, props);
  };

  WrappedComponent.displayName = `withTracing(${componentName || Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Export React for the HOC
import React from 'react';
