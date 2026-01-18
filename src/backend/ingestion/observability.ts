import { metrics } from '@opentelemetry/api';

export interface PipelineMetricPayload {
  pipeline: string;
  windowsProcessed: number;
  recordsProcessed: number;
  durationMs: number;
  telemetryEvents: number;
}

const meter = metrics.getMeter('gemini-ide-backend');

const invocationCounter = meter.createCounter('analytics_ingestion_invocations', {
  description: 'Count of analytics ingestion pipeline invocations',
});

const windowCounter = meter.createCounter('analytics_ingestion_windows_processed', {
  description: 'Number of ingestion windows processed per pipeline run',
});

const recordsCounter = meter.createCounter('analytics_ingestion_records_processed', {
  description: 'Number of analytics records persisted per pipeline run',
});

const telemetryCounter = meter.createCounter('analytics_ingestion_telemetry_events', {
  description: 'Total telemetry events scanned during ingestion runs',
});

const durationHistogram = meter.createHistogram('analytics_ingestion_duration_ms', {
  description: 'Pipeline invocation duration in milliseconds',
  unit: 'ms',
});

export const recordPipelineMetrics = ({
  pipeline,
  windowsProcessed,
  recordsProcessed,
  durationMs,
  telemetryEvents,
}: PipelineMetricPayload): void => {
  const attributes = { pipeline } as const;

  invocationCounter.add(1, attributes);

  if (windowsProcessed > 0) {
    windowCounter.add(windowsProcessed, attributes);
  }

  if (recordsProcessed > 0) {
    recordsCounter.add(recordsProcessed, attributes);
  }

  if (telemetryEvents > 0) {
    telemetryCounter.add(telemetryEvents, attributes);
  }

  if (durationMs >= 0) {
    durationHistogram.record(durationMs, attributes);
  }
};
