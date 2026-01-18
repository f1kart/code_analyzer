import { vi } from 'vitest';
import type { Logger } from 'pino';
import type { Tracer, Span } from '@opentelemetry/api';
import type { AppConfig, AnalyticsIngestionStateSnapshot } from '../types.ts';
import config from '../../config.js';

export const createNoopSpan = (): Span =>
  ({
    addEvent: vi.fn(),
    setAttributes: vi.fn(),
    recordException: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  }) as unknown as Span;

export const createTestTracer = (span: Span = createNoopSpan()): Tracer => {
  return {
    startSpan: vi.fn(() => span),
  } as unknown as Tracer;
};

export const createTestLogger = (): Logger =>
  ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }) as unknown as Logger;

export const createStateSnapshot = (
  pipeline: string,
  lastProcessedAt: Date,
  overrides?: Partial<AnalyticsIngestionStateSnapshot>
): AnalyticsIngestionStateSnapshot => ({
  id: 1,
  pipeline,
  lastProcessedAt,
  metadata: null,
  updatedAt: lastProcessedAt,
  ...overrides,
});

type TestConfigOverrides = Omit<Partial<AppConfig>, 'analytics'> & {
  analytics?: Partial<AppConfig['analytics']> & {
    ingestion?: Partial<AppConfig['analytics']['ingestion']>;
    qualityScore?: Partial<AppConfig['analytics']['qualityScore']>;
    anomalies?: Partial<AppConfig['analytics']['anomalies']>;
  };
};

export const createTestConfig = (overrides?: TestConfigOverrides): AppConfig => {
  const base = JSON.parse(JSON.stringify(config)) as AppConfig;
  const mergedAnalytics = {
    ...base.analytics,
    ...(overrides?.analytics ?? {}),
    ingestion: {
      ...base.analytics.ingestion,
      ...(overrides?.analytics?.ingestion ?? {}),
    },
    qualityScore: {
      ...base.analytics.qualityScore,
      ...(overrides?.analytics?.qualityScore ?? {}),
    },
    anomalies: {
      ...base.analytics.anomalies,
      ...(overrides?.analytics?.anomalies ?? {}),
    },
  };

  return {
    ...base,
    ...overrides,
    analytics: mergedAnalytics,
  } satisfies AppConfig;
};
