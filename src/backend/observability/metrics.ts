import { metrics, Meter } from '@opentelemetry/api';

// Metrics configuration
export const METRICS_CONFIG = {
  serviceName: 'gemini-code-ide-backend',
  serviceVersion: process.env.npm_package_version || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  enabled: process.env.OTEL_METRICS_ENABLED === 'true' || process.env.NODE_ENV === 'production',
};

// Create meter instance
export const meter = metrics.getMeter(
  METRICS_CONFIG.serviceName,
  METRICS_CONFIG.serviceVersion
);

// Simple metrics registry
export class MetricsRegistry {
  private static instance: MetricsRegistry;
  private meter: Meter;
  private metrics: Map<string, any> = new Map();

  private constructor() {
    this.meter = meter;
    this.initializeMetrics();
  }

  static getInstance(): MetricsRegistry {
    if (!MetricsRegistry.instance) {
      MetricsRegistry.instance = new MetricsRegistry();
    }
    return MetricsRegistry.instance;
  }

  private initializeMetrics() {
    // HTTP request metrics
    this.metrics.set('http_requests_total', 
      this.meter.createCounter('http_requests_total', {
        description: 'Total number of HTTP requests',
      })
    );

    this.metrics.set('http_request_duration_seconds',
      this.meter.createHistogram('http_request_duration_seconds', {
        description: 'HTTP request duration in seconds',
      })
    );

    // Admin operation metrics
    this.metrics.set('admin_operations_total',
      this.meter.createCounter('admin_operations_total', {
        description: 'Total number of admin operations',
      })
    );
  }

  // Record HTTP request metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number) {
    const attributes = {
      method,
      route,
      status_code: statusCode,
    };

    this.metrics.get('http_requests_total')?.add(1, attributes);
    this.metrics.get('http_request_duration_seconds')?.record(duration, attributes);
  }

  // Record admin operation metrics
  recordAdminOperation(operation: string, resourceType: string, duration: number, success: boolean = true) {
    const attributes = {
      operation,
      resource_type: resourceType,
      success: success.toString(),
    };

    this.metrics.get('admin_operations_total')?.add(1, attributes);
  }
}

// Metrics utilities
export class MetricsUtils {
  private static registry = MetricsRegistry.getInstance();

  // Create a timed operation wrapper
  static async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>,
    _attributes?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let result: T;

    try {
      result = await operation();
      return result;
    } catch (error) {
      success = false;
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000; // Convert to seconds
      this.registry.recordAdminOperation(operationName, 'unknown', duration, success);
    }
  }
}

// Initialize metrics
export const initializeMetrics = () => {
  if (!METRICS_CONFIG.enabled) {
    console.log('📊 Metrics disabled');
    return null;
  }

  try {
    // Initialize registry
    const registry = MetricsRegistry.getInstance();

    console.log('📊 OpenTelemetry metrics initialized');
    console.log(`🎯 Service: ${METRICS_CONFIG.serviceName}`);

    return registry;
  } catch (error) {
    console.error('❌ Failed to initialize metrics:', error);
    return null;
  }
};

// Health check for metrics
export const checkMetricsHealth = () => {
  return {
    enabled: METRICS_CONFIG.enabled,
    serviceName: METRICS_CONFIG.serviceName,
    environment: METRICS_CONFIG.environment,
  };
};

export default {
  meter,
  MetricsRegistry,
  MetricsUtils,
  initializeMetrics,
  checkMetricsHealth,
};
