import type { PipelineDefinition, PipelineResult, AppConfig } from '../types.ts';
import { ANALYTICS_PIPELINES, TELEMETRY_EVENT_TYPES } from '../constants.ts';
import { recordQualityScore } from '../../services/analyticsService.ts';

interface QualityTelemetryPayload {
  agentStage?: string;
  status?: 'success' | 'failure';
  latencyMs?: number;
  fallback?: boolean;
  humanHandOff?: boolean;
  retryAttempt?: boolean;
  drivers?: Record<string, number>;
  metadata?: Record<string, unknown>;
}

interface StageAccumulator {
  total: number;
  successes: number;
  failures: number;
  latencyTotal: number;
  latencySamples: number;
  fallbackCount: number;
  humanHandOffCount: number;
  retryCount: number;
  drivers: Record<string, number>;
}

const QUALITY_EVENT_TYPES = ['agent.task.completed', 'agent.task.failed', TELEMETRY_EVENT_TYPES.quality];

const initializeAccumulator = (): StageAccumulator => ({
  total: 0,
  successes: 0,
  failures: 0,
  latencyTotal: 0,
  latencySamples: 0,
  fallbackCount: 0,
  humanHandOffCount: 0,
  retryCount: 0,
  drivers: {},
});

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

const normalizeDrivers = (source?: Record<string, number> | null): Record<string, number> => {
  if (!source) {
    return {};
  }
  return Object.entries(source).reduce<Record<string, number>>((acc, [key, value]) => {
    const numeric = toNumber(value);
    if (typeof numeric === 'number') {
      acc[key] = numeric;
    }
    return acc;
  }, {});
};

const computeQualityScore = (
  successRate: number,
  avgLatencyMs: number,
  fallbackRate: number,
  humanHandOffRate: number,
  retryRate: number,
  config: AppConfig
): number => {
  const qualityConfig = config.analytics.qualityScore;
  const baselineLatency = Math.max(qualityConfig.latencyBaselineMs, 1);
  const latencyDelta = (avgLatencyMs - baselineLatency) / baselineLatency;
  const failureRate = 1 - successRate;

  const rawScore =
    qualityConfig.baseIntercept +
    qualityConfig.weights.successRate * successRate +
    qualityConfig.weights.failureRate * failureRate +
    qualityConfig.weights.latency * -latencyDelta +
    qualityConfig.weights.fallbackRate * -fallbackRate +
    qualityConfig.weights.humanHandOffRate * -humanHandOffRate +
    qualityConfig.weights.retryRate * -retryRate;

  const scaled = Math.max(0, Math.min(100, rawScore * 20 + 50));
  return Number.isFinite(scaled) ? Number(scaled.toFixed(2)) : 0;
};

export const createQualityPipeline = (appConfig: PipelineDefinition['run'] extends (context: infer T) => Promise<PipelineResult>
  ? T extends { config: infer C }
    ? C
    : never
  : never): PipelineDefinition => ({
  name: ANALYTICS_PIPELINES.quality,
  description: 'Aggregates agent quality scores from telemetry events and persists derived metrics.',
  intervalMs: appConfig.analytics.ingestion.intervalMs,
  run: async (context) => {
    const span = context.tracer.startSpan('analytics.pipeline.quality');
    const startTime = Date.now();

    try {
      const events = await context.prisma.telemetryEvent.findMany({
        where: {
          eventType: { in: QUALITY_EVENT_TYPES },
          occurredAt: {
            gte: context.window.start,
            lt: context.window.end,
          },
        },
      });

      if (events.length === 0) {
        span.addEvent('No quality telemetry in window');
        return {
          pipeline: ANALYTICS_PIPELINES.quality,
          recordsProcessed: 0,
          durationMs: Date.now() - startTime,
          warnings: ['No telemetry events detected in window'],
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
          telemetryEventsScanned: 0,
          nextCursor: context.window.end,
        } satisfies PipelineResult;
      }

      const byStage = new Map<string, StageAccumulator>();

      for (const event of events) {
        const payload = event.payload as QualityTelemetryPayload | null;
        if (!payload?.agentStage) {
          continue;
        }

        const stageKey = payload.agentStage.trim();
        if (!stageKey) {
          continue;
        }

        const accumulator = byStage.get(stageKey) ?? initializeAccumulator();
        accumulator.total += 1;

        if (payload.status === 'success' || event.eventType === 'agent.task.completed') {
          accumulator.successes += 1;
        }

        if (payload.status === 'failure' || event.eventType === 'agent.task.failed') {
          accumulator.failures += 1;
        }

        const latency = toNumber(payload.latencyMs);
        if (typeof latency === 'number') {
          accumulator.latencyTotal += latency;
          accumulator.latencySamples += 1;
        }

        if (payload.fallback) {
          accumulator.fallbackCount += 1;
        }

        if (payload.humanHandOff) {
          accumulator.humanHandOffCount += 1;
        }

        if (payload.retryAttempt) {
          accumulator.retryCount += 1;
        }

        const drivers = normalizeDrivers(payload.drivers);
        for (const [key, value] of Object.entries(drivers)) {
          accumulator.drivers[key] = (accumulator.drivers[key] ?? 0) + value;
        }

        byStage.set(stageKey, accumulator);
      }

      let recordsProcessed = 0;
      const warnings: string[] = [];
      for (const [stage, values] of byStage.entries()) {
        if (values.total === 0) {
          warnings.push(`Stage ${stage} had zero total events; skipping`);
          continue;
        }

        if (values.successes + values.failures < appConfig.analytics.qualityScore.confidentTaskCount) {
          warnings.push(`Stage ${stage} has insufficient samples (${values.total}); quality score may be noisy.`);
        }

        const successRate = values.successes / values.total;
        const avgLatency = values.latencySamples > 0 ? values.latencyTotal / values.latencySamples : appConfig.analytics.qualityScore.latencyBaselineMs;
        const fallbackRate = values.fallbackCount / values.total;
        const humanHandOffRate = values.humanHandOffCount / values.total;
        const retryRate = values.retryCount / values.total;
        const score = computeQualityScore(successRate, avgLatency, fallbackRate, humanHandOffRate, retryRate, appConfig);

        await recordQualityScore({
          agentStage: stage,
          score,
          drivers: {
            successRate,
            failureRate: 1 - successRate,
            fallbackRate,
            humanHandOffRate,
            retryRate,
            avgLatencyMs: avgLatency,
            samples: values.total,
            ...values.drivers,
          },
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
          occurredAt: context.window.end,
        });

        recordsProcessed += 1;
      }

      const durationMs = Date.now() - startTime;
      span.setAttributes({
        'analytics.pipeline.records': recordsProcessed,
        'analytics.pipeline.durationMs': durationMs,
      });

      return {
        pipeline: ANALYTICS_PIPELINES.quality,
        recordsProcessed,
        durationMs,
        warnings,
        metadata: {
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          telemetryEvents: events.length,
        },
        telemetryEventsScanned: events.length,
        nextCursor: context.window.end,
      } satisfies PipelineResult;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'Quality pipeline failed' });
      throw error;
    } finally {
      span.end();
    }
  },
});
