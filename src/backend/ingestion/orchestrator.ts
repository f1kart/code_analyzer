import { Prisma, type PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Logger } from 'pino';
import { trace, type Tracer } from '@opentelemetry/api';
import config from '../config.js';
import type {
  AppConfig,
  IngestionOrchestrator,
  PipelineContext,
  PipelineDefinition,
  PipelineResult,
  PipelineWindow,
  SchedulerHandle,
} from './types.ts';
import { createPipelineRegistry } from './pipelineRegistry.ts';
import { createSharedState } from './sharedState.ts';
import { acquireLock, releaseLock } from './lockManager.ts';
import { createCronScheduler } from './scheduler.ts';
import { recordPipelineMetrics } from './observability.ts';

interface OrchestratorDependencies {
  prisma: PrismaClient;
  redis: Redis;
  logger: Logger;
  tracer?: Tracer;
  appConfig?: AppConfig;
}

const MAX_WINDOWS_PER_TICK = 12;
const LOCK_GRACE_FACTOR = 2;
const LOCK_MIN_TTL_MS = 60_000;
const CRON_FALLBACK = '*/30 * * * * *';

const deriveCronExpression = (intervalMs: number): string => {
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return CRON_FALLBACK;
  }

  const seconds = Math.round(intervalMs / 1000);
  if (seconds < 60) {
    const sec = Math.max(seconds, 1);
    return `*/${sec} * * * * *`;
  }

  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    if (minutes < 60) {
      const mins = Math.max(minutes, 1);
      return `0 */${mins} * * * *`;
    }

    if (minutes % 60 === 0) {
      const hours = minutes / 60;
      if (hours < 24) {
        const hrs = Math.max(hours, 1);
        return `0 0 */${hrs} * * *`;
      }

      if (hours % 24 === 0) {
        const days = hours / 24;
        const dys = Math.max(days, 1);
        return `0 0 0 */${dys} * *`;
      }
    }
  }

  return CRON_FALLBACK;
};

const computeWindowDurationMs = (appConfig: AppConfig): number => {
  return Math.max(1, appConfig.analytics.ingestion.windowMinutes) * 60_000;
};

interface AnalyticsIngestionStateRecord {
  id: number;
  pipeline: string;
  lastProcessedAt: Date;
  metadata: Prisma.JsonValue | null;
  updatedAt: Date;
}

interface AnalyticsIngestionStateDelegate {
  findUnique(args: { where: { pipeline: string } }): Promise<AnalyticsIngestionStateRecord | null>;
  create(args: { data: { pipeline: string; lastProcessedAt: Date; metadata?: Prisma.JsonValue | null } }): Promise<AnalyticsIngestionStateRecord>;
  update(args: {
    where: { pipeline: string };
    data: { lastProcessedAt?: Date; metadata?: Prisma.JsonValue | null };
  }): Promise<AnalyticsIngestionStateRecord>;
}

class AnalyticsIngestionOrchestrator implements IngestionOrchestrator {
  private readonly prisma: PrismaClient;
  private readonly redis: Redis;
  private readonly logger: Logger;
  private readonly config: AppConfig;
  private readonly tracer: Tracer;
  private readonly pipelines: PipelineDefinition[];
  private readonly sharedState = createSharedState();
  private readonly schedulerHandles = new Map<string, SchedulerHandle>();
  private readonly inFlightPipelines = new Set<string>();
  private started = false;

  private get ingestionState(): AnalyticsIngestionStateDelegate {
    const client = this.prisma as unknown as { analyticsIngestionState?: AnalyticsIngestionStateDelegate };
    if (!client.analyticsIngestionState) {
      throw new Error('Prisma client does not expose analyticsIngestionState delegate');
    }
    return client.analyticsIngestionState;
  }

  constructor(dependencies: OrchestratorDependencies) {
    this.prisma = dependencies.prisma;
    this.redis = dependencies.redis;
    this.logger = dependencies.logger;
    this.config = dependencies.appConfig ?? config;
    this.tracer = dependencies.tracer ?? trace.getTracer('analytics-ingestion');
    this.pipelines = createPipelineRegistry(this.config);
  }

  async start(): Promise<void> {
    if (this.started) {
      this.logger.warn('[AnalyticsIngestion] Orchestrator already started');
      return;
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    for (const pipeline of this.pipelines) {
      const cron = deriveCronExpression(pipeline.intervalMs);
      const handle = createCronScheduler(
        pipeline.name,
        async () => {
          await this.executePipeline(pipeline);
        },
        this.logger,
        {
          expression: cron,
          runOnInit: true,
          timezone,
        }
      );

      this.schedulerHandles.set(pipeline.name, handle);
      this.logger.info(
        { pipeline: pipeline.name, cronExpression: cron, intervalMs: pipeline.intervalMs },
        '[AnalyticsIngestion] Scheduled pipeline'
      );
    }

    this.started = true;
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    const stopPromises = Array.from(this.schedulerHandles.values()).map((handle) => handle.stop().catch((error) => {
      this.logger.error({ error }, '[AnalyticsIngestion] Failed to stop scheduler handle');
    }));

    await Promise.all(stopPromises);
    this.schedulerHandles.clear();
    this.started = false;
  }

  private async executePipeline(pipeline: PipelineDefinition): Promise<void> {
    if (this.inFlightPipelines.has(pipeline.name)) {
      this.logger.warn({ pipeline: pipeline.name }, '[AnalyticsIngestion] Skipping run; pipeline already in-flight');
      return;
    }

    this.inFlightPipelines.add(pipeline.name);

    const lockTtl = Math.max(pipeline.intervalMs * LOCK_GRACE_FACTOR, LOCK_MIN_TTL_MS);
    const lockKey = `analytics:ingestion:${pipeline.name}`;
    const lock = await acquireLock(this.redis, lockKey, lockTtl);

    if (!lock) {
      this.logger.debug({ pipeline: pipeline.name }, '[AnalyticsIngestion] Lock contention - another worker running');
      this.inFlightPipelines.delete(pipeline.name);
      return;
    }

    const windowDurationMs = computeWindowDurationMs(this.config);

    try {
      let state = await this.ensurePipelineState(pipeline.name, windowDurationMs);
      let windowStart = new Date(state.lastProcessedAt ?? Date.now() - windowDurationMs);
      let windowsProcessed = 0;
      let recordsProcessedTotal = 0;
      let telemetryEventsTotal = 0;
      const invocationStartedAt = Date.now();

      while (windowsProcessed < MAX_WINDOWS_PER_TICK) {
        const now = new Date();
        if (windowStart >= now) {
          break;
        }

        const windowEndTs = Math.min(windowStart.getTime() + windowDurationMs, now.getTime());
        if (windowEndTs <= windowStart.getTime()) {
          break;
        }

        const windowEnd = new Date(windowEndTs);
        const parentSpan = this.tracer.startSpan('analytics.ingestion.window', {
          attributes: {
            'analytics.pipeline': pipeline.name,
            'analytics.window.start': windowStart.toISOString(),
            'analytics.window.end': windowEnd.toISOString(),
          },
        });

        const context: PipelineContext = {
          prisma: this.prisma,
          redis: this.redis,
          config: this.config,
          logger: this.logger,
          tracer: this.tracer,
          span: parentSpan,
          window: {
            start: windowStart,
            end: windowEnd,
            state,
          } satisfies PipelineWindow,
          shared: this.sharedState,
        };

        let result: PipelineResult | undefined;
        try {
          result = await pipeline.run(context);
        } catch (error) {
          parentSpan.recordException(error as Error);
          parentSpan.setStatus({ code: 2, message: 'Pipeline execution failed' });
          this.logger.error({ error, pipeline: pipeline.name }, '[AnalyticsIngestion] Pipeline run failed');
          throw error;
        } finally {
          parentSpan.end();
        }

        const nextCursor = result?.nextCursor ?? windowEnd;
        if (!(nextCursor instanceof Date) || Number.isNaN(nextCursor.getTime())) {
          this.logger.error({ pipeline: pipeline.name }, '[AnalyticsIngestion] Invalid next cursor; aborting catch-up loop');
          break;
        }

        if (result?.warnings?.length) {
          for (const warning of result.warnings) {
            this.logger.warn({ pipeline: pipeline.name, warning }, '[AnalyticsIngestion] Pipeline warning');
          }
        }

        const metadataValue = (result?.metadata ?? null) as Prisma.JsonValue;

        await this.ingestionState.update({
          where: { pipeline: pipeline.name },
          data: {
            lastProcessedAt: nextCursor,
            metadata: metadataValue,
          },
        });

        state = {
          ...state,
          lastProcessedAt: nextCursor,
          metadata: metadataValue,
        } satisfies AnalyticsIngestionStateRecord;

        windowStart = new Date(nextCursor);
        windowsProcessed += 1;
        recordsProcessedTotal += result?.recordsProcessed ?? 0;
        telemetryEventsTotal += result?.telemetryEventsScanned ?? 0;

        if (nextCursor >= now || windowsProcessed >= MAX_WINDOWS_PER_TICK) {
          break;
        }
      }

      const invocationDurationMs = Date.now() - invocationStartedAt;

      recordPipelineMetrics({
        pipeline: pipeline.name,
        windowsProcessed,
        recordsProcessed: recordsProcessedTotal,
        durationMs: invocationDurationMs,
        telemetryEvents: telemetryEventsTotal,
      });

      this.logger.info(
        {
          pipeline: pipeline.name,
          windowsProcessed,
          recordsProcessed: recordsProcessedTotal,
          telemetryEvents: telemetryEventsTotal,
          durationMs: invocationDurationMs,
        },
        '[AnalyticsIngestion] Pipeline invocation complete'
      );
    } catch (error) {
      this.logger.error({ error, pipeline: pipeline.name }, '[AnalyticsIngestion] Pipeline execution encountered error');
      throw error;
    } finally {
      await releaseLock(this.redis, lock);
      this.inFlightPipelines.delete(pipeline.name);
    }
  }

  private async ensurePipelineState(pipelineName: string, windowDurationMs: number): Promise<AnalyticsIngestionStateRecord> {
    const existing = await this.ingestionState.findUnique({ where: { pipeline: pipelineName } });
    if (existing) {
      return existing;
    }

    const defaultStart = new Date(Date.now() - windowDurationMs);

    return this.ingestionState.create({
      data: {
        pipeline: pipelineName,
        lastProcessedAt: defaultStart,
        metadata: null,
      },
    });
  }
}

export const createIngestionOrchestrator = (dependencies: OrchestratorDependencies): IngestionOrchestrator => {
  return new AnalyticsIngestionOrchestrator(dependencies);
};

export default createIngestionOrchestrator;
