import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import * as otelResources from '@opentelemetry/resources';
import config from '../config.js';
import logger from '../logger.js';

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

let sdk: NodeSDK | null = null;

export const initializeObservability = async (): Promise<NodeSDK | null> => {
  if (sdk) {
    return sdk;
  }

  const { metrics, tracing } = config;

  if (!metrics.enabled && !tracing.enabled) {
    logger.info('[Observability] Metrics and tracing disabled; skipping initialization');
    return null;
  }

  const ResourceCtor = (otelResources as any).Resource as (new (...args: unknown[]) => otelResources.Resource) | undefined;

  if (!ResourceCtor) {
    logger.warn('[Observability] Resource constructor unavailable; skipping SDK setup');
    return null;
  }

  const resource = new ResourceCtor({
    [SemanticResourceAttributes.SERVICE_NAME]: metrics.serviceName,
    [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'gemini-ide',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '0.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.env,
  });

  const metricReaders: PeriodicExportingMetricReader[] = [];
  if (metrics.enabled) {
    const metricExporter = new OTLPMetricExporter({
      url: metrics.exporterUrl,
      headers: metrics.headers,
    });
    metricReaders.push(
      new PeriodicExportingMetricReader({
        // Cast to any to bridge potential version mismatches between SDK and exporter packages
        exporter: metricExporter as any,
        exportIntervalMillis: metrics.intervalMs,
      } as any)
    );
  }

  const traceExporter = tracing.enabled
    ? new OTLPTraceExporter({ url: tracing.exporterUrl, headers: tracing.headers })
    : undefined;

  sdk = new NodeSDK({
    resource,
    // Cast to any to avoid tight coupling to a specific SpanExporter type from a particular SDK version
    traceExporter: traceExporter as any,
    ...(metricReaders[0] ? { metricReader: metricReaders[0] } : {}),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  try {
    await sdk.start();
    logger.info('[Observability] OpenTelemetry SDK started');
  } catch (error) {
    logger.error({ error }, '[Observability] Failed to start OpenTelemetry SDK');
  }

  return sdk;
};

export const shutdownObservability = async (): Promise<void> => {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    logger.info('[Observability] OpenTelemetry SDK shut down');
  } catch (error) {
    logger.error({ error }, '[Observability] Failed to shut down OpenTelemetry SDK');
  } finally {
    sdk = null;
  }
};

export default initializeObservability;
