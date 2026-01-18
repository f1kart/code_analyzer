import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { PipelineContext } from '../types.ts';
import { createUserEngagementPipeline } from '../pipelines/userEngagementPipeline.ts';
import { ANALYTICS_PIPELINES } from '../constants.ts';
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
}));

describe('user engagement pipeline', () => {
  const redisMock = { set: vi.fn(), get: vi.fn() } as unknown as Redis;
  const tracer = createTestTracer();
  const logger = createTestLogger();
  const config = createTestConfig();
  const pipelineFactory = () => createUserEngagementPipeline(config);
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
    prismaMock.telemetryEvent.findMany.mockReset();
    vi.unmock('../../services/analyticsService.ts');
  });

  it('returns zero records when no telemetry events exist', async () => {
    const pipeline = pipelineFactory();
    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: new Date('2025-11-04T00:00:00Z'),
        end: new Date('2025-11-04T01:00:00Z'),
        state: createStateSnapshot(ANALYTICS_PIPELINES.userEngagement, new Date('2025-11-04T00:00:00Z')),
      },
    });

    expect(result.recordsProcessed).toBe(0);
    expect(result.telemetryEventsScanned).toBe(0);
    expect(result.warnings).toContain('No engagement telemetry events detected in window');
  });

  it('aggregates telemetry events into engagement metrics and persists them', async () => {
    vi.resetModules();
    const recordUserEngagement = vi.fn();

    vi.doMock('../../services/analyticsService.ts', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../../services/analyticsService.ts')>();
      return {
        ...mod,
        recordUserEngagement,
      };
    });

    const { createUserEngagementPipeline: dynamicFactory } = await import('../pipelines/userEngagementPipeline.ts');
    const pipeline = dynamicFactory(config);

    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([
      {
        eventType: 'session.started',
        payload: {
          userId: 'user1',
          sessionId: 'session1',
          durationSec: 1800,
          metadata: { durationSec: 1800 },
        },
      },
      {
        eventType: 'feature.used',
        payload: {
          userId: 'user2',
          feature: 'codegen',
          featureUsage: { codegen: 3 },
          metadata: { feature: 'codegen' },
        },
      },
    ]);

    const windowStart = new Date('2025-11-04T00:00:00Z');
    const windowEnd = new Date('2025-11-04T01:00:00Z');

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: windowStart,
        end: windowEnd,
        state: createStateSnapshot(ANALYTICS_PIPELINES.userEngagement, windowStart),
      },
    });

    expect(recordUserEngagement).toHaveBeenCalledTimes(1);
    expect(recordUserEngagement).toHaveBeenCalledWith(
      expect.objectContaining({
        windowStart,
        windowEnd,
        activeUsers: expect.any(Number),
        collaborationSessions: expect.any(Number),
        featureUsage: expect.any(Object),
      })
    );
    expect(result.recordsProcessed).toBe(1);
    expect(result.telemetryEventsScanned).toBe(2);
  });
});
