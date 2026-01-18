import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import type { PipelineDefinition } from '../types.ts';
import {
  createTestConfig,
  createTestLogger,
  createTestTracer,
  createStateSnapshot,
} from './testUtils.ts';

const pipelineRegistryState = vi.hoisted(() => ({
  definitions: [] as PipelineDefinition[],
}));

const schedulerState = vi.hoisted(
  () =>
    new Map<
      string,
      {
        handler: () => Promise<void>;
        stop: ReturnType<typeof vi.fn>;
      }
    >()
);

type LockResult = { key: string; token: string };

const acquireLockMock = vi.hoisted(() =>
  vi.fn(async (_redis: Redis, _key: string, _ttl: number): Promise<LockResult | null> => ({
    key: 'lock',
    token: 'token',
  }))
);

const releaseLockMock = vi.hoisted(() =>
  vi.fn(async (_redis: Redis, _lock: LockResult | null): Promise<void> => undefined)
);

type PipelineMetricPayload = {
  pipeline: string;
  windowsProcessed: number;
  recordsProcessed: number;
  telemetryEvents: number;
  durationMs: number;
};

const recordPipelineMetricsMock = vi.hoisted(() =>
  vi.fn((payload: PipelineMetricPayload) => {
    void payload;
  })
);

const createPipelineRegistryMock = vi.hoisted(() => vi.fn(() => pipelineRegistryState.definitions));

interface SchedulerOptionsMock {
  expression?: string;
  runOnInit?: boolean;
  timezone?: string;
}

const createCronSchedulerMock = vi.hoisted(
  () =>
    vi.fn(
      (label: string, handler: () => Promise<void>, logger: Logger, options?: SchedulerOptionsMock) => {
        void logger;
        void options;
        const stop = vi.fn().mockResolvedValue(undefined);
        schedulerState.set(label, { handler, stop });
        return { stop };
      }
    )
);

vi.mock('../pipelineRegistry.ts', () => ({
  createPipelineRegistry: createPipelineRegistryMock,
}));

vi.mock('../scheduler.ts', () => ({
  createCronScheduler: (
    label: string,
    handler: () => Promise<void>,
    logger: Logger,
    options?: SchedulerOptionsMock
  ) => createCronSchedulerMock(label, handler, logger, options),
}));

vi.mock('../lockManager.ts', () => ({
  acquireLock: (redis: Redis, key: string, ttl: number) => acquireLockMock(redis, key, ttl),
  releaseLock: (redis: Redis, lock: LockResult | null) => releaseLockMock(redis, lock),
}));

vi.mock('../observability.ts', () => ({
  recordPipelineMetrics: (payload: PipelineMetricPayload) => recordPipelineMetricsMock(payload),
}));

const buildPrismaMock = (): PrismaClient => {
  let state = createStateSnapshot('placeholder', new Date());

  const analyticsIngestionState = {
    findUnique: vi.fn(async ({ where }: { where: { pipeline: string } }) => {
      return state.pipeline === where.pipeline ? state : null;
    }),
    create: vi.fn(
      async ({ data }: { data: { pipeline: string; lastProcessedAt: Date; metadata?: unknown | null } }) => {
        state = {
          id: 1,
          pipeline: data.pipeline,
          lastProcessedAt: data.lastProcessedAt,
          metadata: data.metadata ?? null,
          updatedAt: data.lastProcessedAt,
        };
        return state;
      }
    ),
    update: vi.fn(
      async ({
        where,
        data,
      }: {
        where: { pipeline: string };
        data: { lastProcessedAt?: Date; metadata?: unknown | null };
      }) => {
        if (state.pipeline !== where.pipeline) {
          throw new Error('Unexpected pipeline');
        }
        state = {
          ...state,
          lastProcessedAt: data.lastProcessedAt ?? state.lastProcessedAt,
          metadata: data.metadata ?? state.metadata,
          updatedAt: data.lastProcessedAt ?? state.updatedAt,
        };
        return state;
      }
    ),
  };

  return {
    analyticsIngestionState,
  } as unknown as PrismaClient;
};

let createIngestionOrchestrator: typeof import('../orchestrator.ts').createIngestionOrchestrator;

beforeAll(async () => {
  ({ createIngestionOrchestrator } = await import('../orchestrator.ts'));
});

describe('AnalyticsIngestionOrchestrator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-11-04T01:00:00Z'));
    schedulerState.clear();
    acquireLockMock.mockClear();
    releaseLockMock.mockClear();
    recordPipelineMetricsMock.mockClear();
    createCronSchedulerMock.mockClear();
    createPipelineRegistryMock.mockClear();
    pipelineRegistryState.definitions = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('executes scheduled pipelines, updates state, and records metrics', async () => {
    const prisma = buildPrismaMock();
    const redis = {} as unknown as Redis;
    const logger = createTestLogger();
    const tracer = createTestTracer();
    const pipelineRunMock = vi.fn(async (context) => {
      return {
        pipeline: context.window.state.pipeline,
        recordsProcessed: 2,
        durationMs: 42,
        metadata: { processed: true },
        telemetryEventsScanned: 5,
        nextCursor: context.window.end,
      };
    });

    pipelineRegistryState.definitions = [
      {
        name: 'analytics-quality',
        description: 'test pipeline',
        intervalMs: 60_000,
        run: pipelineRunMock,
      },
    ];

    const orchestrator = createIngestionOrchestrator({
      prisma,
      redis,
      logger,
      tracer,
      appConfig: createTestConfig(),
    });

    await orchestrator.start();

    const scheduled = schedulerState.get('analytics-quality');
    expect(scheduled).toBeDefined();
    await scheduled!.handler();

    expect(createCronSchedulerMock).toHaveBeenCalledWith(
      'analytics-quality',
      expect.any(Function),
      logger,
      expect.objectContaining({ runOnInit: true })
    );
    expect(acquireLockMock).toHaveBeenCalledWith(redis, 'analytics:ingestion:analytics-quality', expect.any(Number));
    expect(pipelineRunMock).toHaveBeenCalledTimes(1);
    expect(recordPipelineMetricsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pipeline: 'analytics-quality',
        windowsProcessed: 1,
        recordsProcessed: 2,
        telemetryEvents: 5,
      })
    );

    const ingestionDelegate = (prisma as unknown as { analyticsIngestionState: { update: ReturnType<typeof vi.fn> } })
      .analyticsIngestionState;
    expect(ingestionDelegate.update).toHaveBeenCalledWith({
      where: { pipeline: 'analytics-quality' },
      data: {
        lastProcessedAt: expect.any(Date),
        metadata: { processed: true },
      },
    });

    expect(releaseLockMock).toHaveBeenCalledTimes(1);

    await orchestrator.stop();
    expect(scheduled!.stop).toHaveBeenCalledTimes(1);
  });

  it('skips execution when lock is not acquired', async () => {
    const prisma = buildPrismaMock();
    const redis = {} as unknown as Redis;
    const logger = createTestLogger();
    const tracer = createTestTracer();

    const pipelineRunMock = vi.fn(async (context) => ({
      pipeline: context.window.state.pipeline,
      recordsProcessed: 1,
      durationMs: 10,
      telemetryEventsScanned: 3,
      nextCursor: context.window.end,
    }));

    pipelineRegistryState.definitions = [
      {
        name: 'analytics-quality',
        description: 'test pipeline',
        intervalMs: 60_000,
        run: pipelineRunMock,
      },
    ];

    acquireLockMock.mockResolvedValueOnce(null);
    acquireLockMock.mockResolvedValueOnce({ key: 'lock', token: 'token' });

    const orchestrator = createIngestionOrchestrator({
      prisma,
      redis,
      logger,
      tracer,
      appConfig: createTestConfig(),
    });

    await orchestrator.start();
    const scheduled = schedulerState.get('analytics-quality');
    expect(scheduled).toBeDefined();

    await scheduled!.handler();
    expect(pipelineRunMock).not.toHaveBeenCalled();
    expect(recordPipelineMetricsMock).not.toHaveBeenCalled();

    await scheduled!.handler();
    expect(pipelineRunMock).toHaveBeenCalledTimes(1);

    await orchestrator.stop();
  });
});
