import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import { createQualityPipeline } from '../pipelines/qualityPipeline.ts';
import { ANALYTICS_PIPELINES } from '../constants.ts';
import type { PipelineContext } from '../types.ts';
import {
  createNoopSpan,
  createTestTracer,
  createTestLogger,
  createStateSnapshot,
  createTestConfig,
} from './testUtils.ts';

const prismaMock = vi.hoisted(() => ({
  telemetryEvent: {
    findMany: vi.fn(),
  },
  qualityScoreObservation: {
    upsert: vi.fn(),
  },
}));

vi.mock('../../prisma.js', () => ({
  getPrisma: () => prismaMock as unknown as PrismaClient,
}));

const analyticsServiceMock = vi.hoisted(() => ({
  recordQualityScore: vi.fn(),
}));

vi.mock('../../services/analyticsService.ts', () => analyticsServiceMock);

const buildBaseContext = (config: ReturnType<typeof createTestConfig>): Omit<PipelineContext, 'span' | 'window'> => ({
  prisma: prismaMock as unknown as PrismaClient,
  redis: { set: vi.fn(), get: vi.fn() } as unknown as Redis,
  config,
  logger: createTestLogger(),
  tracer: createTestTracer(),
  shared: {
    set: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    has: vi.fn(),
    entries: vi.fn(() => []),
  },
});

describe('quality pipeline', () => {
  const config = createTestConfig();
  const pipeline = createQualityPipeline(config);
  beforeEach(() => {
    prismaMock.telemetryEvent.findMany.mockReset();
    prismaMock.qualityScoreObservation.upsert.mockReset();
    analyticsServiceMock.recordQualityScore.mockReset();
  });

  it('returns zero records when no telemetry events exist', async () => {
    const baseContext = buildBaseContext(config);
    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: new Date('2025-11-04T00:00:00Z'),
        end: new Date('2025-11-04T01:00:00Z'),
        state: createStateSnapshot(ANALYTICS_PIPELINES.quality, new Date('2025-11-04T00:00:00Z')),
      },
    });

    expect(result.recordsProcessed).toBe(0);
    expect(result.warnings).toContain('No telemetry events detected in window');
    expect(result.telemetryEventsScanned).toBe(0);
  });

  it('aggregates success and failure telemetry into quality score observations', async () => {
    const baseContext = buildBaseContext(config);

    const baseTime = new Date('2025-11-04T00:00:00Z');
    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([
      {
        eventType: 'agent.task.completed',
        payload: {
          agentStage: 'stage1',
          status: 'success',
          latencyMs: 1500,
          fallback: false,
          humanHandOff: false,
          retryAttempt: false,
          drivers: { coverage: 0.9 },
        },
      },
      {
        eventType: 'agent.task.failed',
        payload: {
          agentStage: 'stage1',
          status: 'failure',
          latencyMs: 2500,
          fallback: true,
          humanHandOff: true,
          retryAttempt: true,
          drivers: { coverage: 0.1 },
        },
      },
    ]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: baseTime,
        end: new Date(baseTime.getTime() + 60 * 60 * 1000),
        state: createStateSnapshot(ANALYTICS_PIPELINES.quality, baseTime),
      },
    });

    expect(analyticsServiceMock.recordQualityScore).toHaveBeenCalledTimes(1);
    expect(result.recordsProcessed).toBe(1);
    expect(result.telemetryEventsScanned).toBe(2);
  });
});
