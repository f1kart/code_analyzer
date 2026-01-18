import type { PipelineDefinition, PipelineResult, AppConfig } from '../types.ts';
import { ANALYTICS_PIPELINES, TELEMETRY_EVENT_TYPES } from '../constants.ts';
import { recordAgentPerformance } from '../../services/analyticsService.ts';

interface AgentPerformanceTelemetryPayload {
  agentStage?: string;
  stageId?: string;
  stageName?: string;
  stage?: string;
  status?: 'success' | 'failure' | 'in-progress';
  latencyMs?: number | string;
  fallback?: boolean;
  humanHandOff?: boolean;
  retries?: number | string;
  metadata?: Record<string, unknown> | null;
}

interface StageAccumulator {
  tasksProcessed: number;
  successes: number;
  failures: number;
  latencyTotal: number;
  latencySamples: number;
  latencyMax: number;
  latencyMin: number;
  fallbackCount: number;
  humanHandOffCount: number;
  retryCount: number;
  metadataSamples: Record<string, unknown>[];
}

const PERFORMANCE_EVENT_TYPES = [
  'agent.task.completed',
  'agent.task.failed',
  'agent.stage.completed',
  'agent.stage.failed',
  TELEMETRY_EVENT_TYPES.agentPerformance,
];

const METADATA_SAMPLE_CAP = 25;

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const deriveStageKey = (
  payload: AgentPerformanceTelemetryPayload | null,
  fallbackStage?: string
): string | null => {
  const stage =
    payload?.agentStage ??
    payload?.stageId ??
    payload?.stageName ??
    payload?.stage ??
    fallbackStage;

  if (typeof stage !== 'string') {
    return null;
  }

  const normalized = stage.trim();
  return normalized.length > 0 ? normalized : null;
};

const initializeAccumulator = (): StageAccumulator => ({
  tasksProcessed: 0,
  successes: 0,
  failures: 0,
  latencyTotal: 0,
  latencySamples: 0,
  latencyMax: 0,
  latencyMin: Number.POSITIVE_INFINITY,
  fallbackCount: 0,
  humanHandOffCount: 0,
  retryCount: 0,
  metadataSamples: [],
});

const computeResult = (stage: string, accumulator: StageAccumulator, appConfig: AppConfig) => {
  if (accumulator.tasksProcessed === 0) {
    return null;
  }

  const successRate = accumulator.successes / accumulator.tasksProcessed;
  const fallbackRate = accumulator.fallbackCount / accumulator.tasksProcessed;
  const humanHandOffRate = accumulator.humanHandOffCount / accumulator.tasksProcessed;
  const latencyBaseline = Math.max(appConfig.analytics.qualityScore.latencyBaselineMs, 1);
  const avgLatencyMs =
    accumulator.latencySamples > 0 ? accumulator.latencyTotal / accumulator.latencySamples : latencyBaseline;

  const metadata: Record<string, unknown> = {
    latencySamples: accumulator.latencySamples,
    latencyMax: accumulator.latencySamples > 0 ? accumulator.latencyMax : null,
    latencyMin: accumulator.latencySamples > 0 ? accumulator.latencyMin : null,
    retries: accumulator.retryCount,
  };

  if (accumulator.metadataSamples.length > 0) {
    metadata.samples = accumulator.metadataSamples;
  }

  return {
    stage,
    tasksProcessed: accumulator.tasksProcessed,
    avgLatencyMs,
    successRate: Number(successRate.toFixed(4)),
    fallbackRate: Number(fallbackRate.toFixed(4)),
    humanHandOffRate: Number(humanHandOffRate.toFixed(4)),
    metadata,
  };
};

export const createAgentPerformancePipeline = (
  appConfig: PipelineDefinition['run'] extends (context: infer T) => Promise<PipelineResult>
    ? T extends { config: infer C }
      ? C
      : never
    : never
): PipelineDefinition => ({
  name: ANALYTICS_PIPELINES.agentPerformance,
  description: 'Aggregates agent throughput, latency, and retry behaviour into AgentPerformanceMetric records.',
  intervalMs: appConfig.analytics.ingestion.intervalMs,
  run: async (context) => {
    const span = context.tracer.startSpan('analytics.pipeline.agent-performance');
    const startedAt = Date.now();

    try {
      const events = await context.prisma.telemetryEvent.findMany({
        where: {
          eventType: { in: PERFORMANCE_EVENT_TYPES },
          occurredAt: {
            gte: context.window.start,
            lt: context.window.end,
          },
        },
        orderBy: { occurredAt: 'asc' },
      });

      const byStage = new Map<string, StageAccumulator>();

      for (const event of events) {
        const payload = (event.payload ?? null) as AgentPerformanceTelemetryPayload | null;
        const stage = deriveStageKey(payload, (event.payload as Record<string, unknown> | null)?.['stage'] as string | undefined);

        if (!stage) {
          continue;
        }

        const accumulator = byStage.get(stage) ?? initializeAccumulator();

        const status =
          payload?.status ??
          (event.eventType.includes('failed')
            ? 'failure'
            : event.eventType.includes('completed')
            ? 'success'
            : undefined);

        if (status === 'success') {
          accumulator.successes += 1;
          accumulator.tasksProcessed += 1;
        } else if (status === 'failure') {
          accumulator.failures += 1;
          accumulator.tasksProcessed += 1;
        }

        const latency = toNumber(
          payload?.latencyMs ?? (payload?.metadata as Record<string, unknown> | undefined)?.['latencyMs']
        );

        if (typeof latency === 'number') {
          accumulator.latencyTotal += latency;
          accumulator.latencySamples += 1;
          accumulator.latencyMax = Math.max(accumulator.latencyMax, latency);
          accumulator.latencyMin = Math.min(accumulator.latencyMin, latency);
        }

        if (payload?.fallback) {
          accumulator.fallbackCount += 1;
        }

        if (payload?.humanHandOff) {
          accumulator.humanHandOffCount += 1;
        }

        const retries = toNumber(payload?.retries);
        if (typeof retries === 'number' && retries > 0) {
          accumulator.retryCount += retries;
        }

        if (payload?.metadata && accumulator.metadataSamples.length < METADATA_SAMPLE_CAP) {
          accumulator.metadataSamples.push(payload.metadata);
        }

        byStage.set(stage, accumulator);
      }

      const warnings: string[] = [];
      let recordsProcessed = 0;

      for (const [stage, accumulator] of byStage.entries()) {
        const computed = computeResult(stage, accumulator, appConfig);
        if (!computed) {
          warnings.push(`Stage ${stage} had no completed tasks in window.`);
          continue;
        }

        await recordAgentPerformance({
          agentStage: computed.stage,
          windowStart: context.window.start,
          windowEnd: context.window.end,
          tasksProcessed: computed.tasksProcessed,
          avgLatencyMs: Math.round(computed.avgLatencyMs),
          successRate: computed.successRate,
          fallbackRate: computed.fallbackRate,
          humanHandOffRate: computed.humanHandOffRate,
          metadata: {
            ...computed.metadata,
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
        });

        recordsProcessed += 1;
      }

      const durationMs = Date.now() - startedAt;
      span.setAttributes({
        'analytics.pipeline.records': recordsProcessed,
        'analytics.pipeline.durationMs': durationMs,
        'analytics.pipeline.telemetryEvents': events.length,
      });

      return {
        pipeline: ANALYTICS_PIPELINES.agentPerformance,
        recordsProcessed,
        durationMs,
        warnings,
        metadata: {
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          stages: Array.from(byStage.keys()),
        },
        telemetryEventsScanned: events.length,
        nextCursor: context.window.end,
      } satisfies PipelineResult;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'Agent performance pipeline failure' });
      throw error;
    } finally {
      span.end();
    }
  },
});
