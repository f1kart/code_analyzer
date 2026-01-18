import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { PipelineContext } from '../types.ts';
import { createRepositoryPipeline } from '../pipelines/repositoryPipeline.ts';
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

describe('repository analytics pipeline', () => {
  const redisMock = { set: vi.fn(), get: vi.fn() } as unknown as Redis;
  const tracer = createTestTracer();
  const logger = createTestLogger();
  const config = createTestConfig();
  const pipelineFactory = () => createRepositoryPipeline(config);
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

  it('returns zero records when telemetry events are absent', async () => {
    const pipeline = pipelineFactory();
    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([]);

    const result = await pipeline.run({
      ...baseContext,
      span: createNoopSpan(),
      window: {
        start: new Date('2025-11-04T00:00:00Z'),
        end: new Date('2025-11-04T01:00:00Z'),
        state: createStateSnapshot(ANALYTICS_PIPELINES.repository, new Date('2025-11-04T00:00:00Z')),
      },
    });

    expect(result.recordsProcessed).toBe(0);
    expect(result.telemetryEventsScanned).toBe(0);
    expect(result.warnings).toContain('No repository telemetry events detected in window');
  });

  it('aggregates repository telemetry and persists analytics metrics', async () => {
    vi.resetModules();
    const recordRepositoryAnalytics = vi.fn();

    vi.doMock('../../services/analyticsService.ts', async (importOriginal) => {
      const mod = await importOriginal<typeof import('../../services/analyticsService.ts')>();
      return {
        ...mod,
        recordRepositoryAnalytics,
      };
    });

    const { createRepositoryPipeline: dynamicFactory } = await import('../pipelines/repositoryPipeline.ts');
    const pipeline = dynamicFactory(config);

    prismaMock.telemetryEvent.findMany.mockResolvedValueOnce([
      {
        eventType: 'repository.commit.activity',
        payload: {
          repository: 'repo-a',
          branch: 'main',
          commits: 12,
          metadata: { coverage: 0.82 },
        },
      },
      {
        eventType: 'repository.coverage.snapshot',
        payload: {
          repository: 'repo-a',
          branch: 'main',
          coverage: 0.8,
          previousCoverage: 0.85,
          metadata: { drift: -0.05 },
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
        state: createStateSnapshot(ANALYTICS_PIPELINES.repository, windowStart),
      },
    });

    expect(recordRepositoryAnalytics).toHaveBeenCalledTimes(1);
    expect(recordRepositoryAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        repository: 'repo-a',
        branch: 'main',
        commitVelocity: expect.any(Number),
        coverageDrift: expect.any(Number),
      })
    );
    expect(result.recordsProcessed).toBe(1);
    expect(result.telemetryEventsScanned).toBe(2);
  });
});
