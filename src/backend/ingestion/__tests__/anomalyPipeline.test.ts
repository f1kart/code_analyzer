import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { PipelineContext } from '../types.ts';
import { ANALYTICS_PIPELINES } from '../constants.ts';
import { createAnomalyPipeline } from '../pipelines/anomalyPipeline.ts';
import {
  createNoopSpan,
  createTestTracer,
  createTestLogger,
  createStateSnapshot,
  createTestConfig,
} from './testUtils.ts';

const prismaMock = vi.hoisted(() => ({
  agentPerformanceMetric: {
    findMany: vi.fn(),
  },
  qualityScoreObservation: {
    findMany: vi.fn(),
  },
}));

describe('anomaly detection pipeline', () => {
  const redisMock = { set: vi.fn(), get: vi.fn() } as unknown as Redis;
  const tracer = createTestTracer();
  const logger = createTestLogger();
  const config = createTestConfig({
    analytics: {
      anomalies: {
        minSamples: 1,
        stdDeviations: 2,
        criticalSuccessRate: 0.6,
        warningLatencyFactor: 1.5,
      },
    },
  });
  const pipelineFactory = () => createAnomalyPipeline(config);
  const baseContext: Omit<PipelineContext, 'span' | 'window'> = {
    prisma: prismaMock as unknown as PrismaClient,
    redis: redisMock,
    config,
    logger,
    tracer,
    shared: {
      set: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      has: vi.fn(),
      entries: vi.fn(() => []),
    },
  };

  beforeEach(() => {
    prismaMock.agentPerformanceMetric.findMany.mockReset();
    prismaMock.qualityScoreObservation.findMany.mockReset();
    vi.unmock('../../services/analyticsService.ts');
  });

  it('returns zero records when no metrics are available', async () => {
    const pipeline = pipelineFactory();
    prismaMock.agentPerformanceMetric.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    prismaMock.qualityScoreObservation.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: new Date('2025-11-04T00:00:00Z'),
        end: new Date('2025-11-04T01:00:00Z'),
        state: createStateSnapshot(ANALYTICS_PIPELINES.anomalies, new Date('2025-11-04T00:00:00Z')),
      },
    });

    expect(result.recordsProcessed).toBe(0);
    expect(result.telemetryEventsScanned).toBe(0);
    expect(result.warnings).toContain('No metrics recorded during ingestion window; anomaly detection skipped.');
  });

  it('detects anomalies and persists alert metadata when thresholds are breached', async () => {
    vi.resetModules();
    const recordAnalyticsAnomaly = vi.fn();

    vi.doMock('../../services/analyticsService.ts', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../../services/analyticsService.ts')>();
      return {
        ...mod,
        recordAnalyticsAnomaly,
      };
    });

    const { createAnomalyPipeline: dynamicFactory } = await import('../pipelines/anomalyPipeline.ts');
    const pipeline = dynamicFactory(config);

    const currentWindowStart = new Date('2025-11-04T00:00:00Z');
    const currentWindowEnd = new Date('2025-11-04T01:00:00Z');
    const baselineWindowStart = new Date('2025-11-03T00:00:00Z');

    prismaMock.agentPerformanceMetric.findMany
      .mockResolvedValueOnce([
        {
          agentStage: 'stage-1',
          successRate: 0.5,
          fallbackRate: 0.3,
          humanHandOffRate: 0.2,
          avgLatencyMs: 2500,
          tasksProcessed: 10,
          windowStart: currentWindowStart,
          windowEnd: currentWindowEnd,
        },
      ])
      .mockResolvedValueOnce([
        {
          agentStage: 'stage-1',
          successRate: 0.9,
          fallbackRate: 0.1,
          humanHandOffRate: 0.05,
          avgLatencyMs: 1200,
          tasksProcessed: 20,
          windowStart: baselineWindowStart,
          windowEnd: currentWindowStart,
        },
      ]);

    prismaMock.qualityScoreObservation.findMany
      .mockResolvedValueOnce([
        {
          agentStage: 'stage-1',
          score: 45,
          occurredAt: currentWindowEnd,
        },
      ])
      .mockResolvedValueOnce([
        {
          agentStage: 'stage-1',
          score: 75,
          occurredAt: baselineWindowStart,
        },
      ]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: currentWindowStart,
        end: currentWindowEnd,
        state: createStateSnapshot(ANALYTICS_PIPELINES.anomalies, currentWindowStart),
      },
    });

    expect(recordAnalyticsAnomaly).toHaveBeenCalledTimes(1);
    expect(recordAnalyticsAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'stage-1',
        severity: 'critical',
        description: expect.stringContaining('Anomaly detected for stage stage-1'),
      })
    );
    expect(result.recordsProcessed).toBe(1);
    expect(result.telemetryEventsScanned).toBe(2);
  });
});
