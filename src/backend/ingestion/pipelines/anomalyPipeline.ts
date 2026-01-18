import type { PipelineDefinition, PipelineResult } from '../types.ts';
import { ANALYTICS_PIPELINES } from '../constants.ts';
import { recordAnalyticsAnomaly } from '../../services/analyticsService.ts';

interface StageBaselineAggregation {
  tasks: number;
  successRates: number[];
  fallbackRates: number[];
  humanHandOffRates: number[];
  avgLatencies: number[];
  qualityScores: number[];
}

interface StageCurrentSnapshot {
  successRate: number;
  fallbackRate: number;
  humanHandOffRate: number;
  avgLatencyMs: number;
  tasksProcessed: number;
  qualityScore?: number;
}

interface BaselineStats {
  successMean: number;
  successStd: number;
  fallbackMean: number;
  humanHandOffMean: number;
  latencyMean: number;
  qualityMean?: number;
  samples: number;
  tasks: number;
}

const HOURS_IN_BASELINE = 24;

const calculateMean = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const calculateStdDev = (values: number[], mean?: number): number => {
  if (values.length < 2) {
    return 0;
  }
  const reference = mean ?? calculateMean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - reference) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
};

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

const DEFAULT_STDDEV_FLOOR = 0.01;

export const createAnomalyPipeline = (
  appConfig: PipelineDefinition['run'] extends (context: infer T) => Promise<PipelineResult>
    ? T extends { config: infer C }
      ? C
      : never
    : never
): PipelineDefinition => ({
  name: ANALYTICS_PIPELINES.anomalies,
  description: 'Detects anomalies across agent performance and quality metrics and records alert metadata.',
  intervalMs: appConfig.analytics.ingestion.intervalMs,
  run: async (context) => {
    const span = context.tracer.startSpan('analytics.pipeline.anomaly');
    const startedAt = Date.now();

    try {
      const baselineLookbackMinutes = appConfig.analytics.ingestion.windowMinutes * HOURS_IN_BASELINE;
      const baselineWindowStart = new Date(
        context.window.start.getTime() - baselineLookbackMinutes * 60_000
      );

      const [currentPerformance, baselinePerformance, currentQuality, baselineQuality] = await Promise.all([
        context.prisma.agentPerformanceMetric.findMany({
          where: {
            windowStart: { gte: context.window.start },
            windowEnd: { lte: context.window.end },
          },
        }),
        context.prisma.agentPerformanceMetric.findMany({
          where: {
            windowEnd: { lt: context.window.start, gte: baselineWindowStart },
          },
        }),
        context.prisma.qualityScoreObservation.findMany({
          where: {
            occurredAt: {
              gte: context.window.start,
              lt: context.window.end,
            },
          },
        }),
        context.prisma.qualityScoreObservation.findMany({
          where: {
            occurredAt: {
              lt: context.window.start,
              gte: baselineWindowStart,
            },
          },
        }),
      ]);

      if (currentPerformance.length === 0 && currentQuality.length === 0) {
        span.addEvent('No metrics available for anomaly detection');
        return {
          pipeline: ANALYTICS_PIPELINES.anomalies,
          recordsProcessed: 0,
          durationMs: Date.now() - startedAt,
          warnings: ['No metrics recorded during ingestion window; anomaly detection skipped.'],
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
          telemetryEventsScanned: currentPerformance.length + currentQuality.length,
          nextCursor: context.window.end,
        } satisfies PipelineResult;
      }

      const currentByStage = new Map<string, StageCurrentSnapshot>();

      for (const metric of currentPerformance) {
        const stage = metric.agentStage.trim();
        if (!stage) {
          continue;
        }

        const snapshot =
          currentByStage.get(stage) ?? {
            successRate: 0,
            fallbackRate: 0,
            humanHandOffRate: 0,
            avgLatencyMs: 0,
            tasksProcessed: 0,
          };

        const totalTasks = snapshot.tasksProcessed + metric.tasksProcessed;
        const weightCurrent = metric.tasksProcessed;

        if (totalTasks > 0) {
          snapshot.successRate =
            (snapshot.successRate * snapshot.tasksProcessed + metric.successRate * weightCurrent) /
            totalTasks;
          snapshot.fallbackRate =
            (snapshot.fallbackRate * snapshot.tasksProcessed + metric.fallbackRate * weightCurrent) /
            totalTasks;
          snapshot.humanHandOffRate =
            (snapshot.humanHandOffRate * snapshot.tasksProcessed + metric.humanHandOffRate * weightCurrent) /
            totalTasks;
          snapshot.avgLatencyMs =
            (snapshot.avgLatencyMs * snapshot.tasksProcessed + metric.avgLatencyMs * weightCurrent) /
            totalTasks;
        }

        snapshot.tasksProcessed = totalTasks;
        currentByStage.set(stage, snapshot);
      }

      const qualityCurrentByStage = new Map<string, { total: number; count: number }>();
      for (const observation of currentQuality) {
        const stage = observation.agentStage.trim();
        if (!stage) {
          continue;
        }
        const entry = qualityCurrentByStage.get(stage) ?? { total: 0, count: 0 };
        entry.total += observation.score;
        entry.count += 1;
        qualityCurrentByStage.set(stage, entry);
      }

      for (const [stage, entry] of qualityCurrentByStage.entries()) {
        const snapshot = currentByStage.get(stage) ?? {
          successRate: 0,
          fallbackRate: 0,
          humanHandOffRate: 0,
          avgLatencyMs: 0,
          tasksProcessed: 0,
        };
        snapshot.qualityScore = entry.count > 0 ? entry.total / entry.count : undefined;
        currentByStage.set(stage, snapshot);
      }

      const baselineByStage = new Map<string, StageBaselineAggregation>();

      for (const metric of baselinePerformance) {
        const stage = metric.agentStage.trim();
        if (!stage) {
          continue;
        }
        const aggregation =
          baselineByStage.get(stage) ?? {
            tasks: 0,
            successRates: [],
            fallbackRates: [],
            humanHandOffRates: [],
            avgLatencies: [],
            qualityScores: [],
          };

        aggregation.tasks += metric.tasksProcessed;
        aggregation.successRates.push(clamp(metric.successRate, 0, 1));
        aggregation.fallbackRates.push(clamp(metric.fallbackRate, 0, 1));
        aggregation.humanHandOffRates.push(clamp(metric.humanHandOffRate, 0, 1));
        aggregation.avgLatencies.push(Math.max(metric.avgLatencyMs, 0));
        baselineByStage.set(stage, aggregation);
      }

      for (const observation of baselineQuality) {
        const stage = observation.agentStage.trim();
        if (!stage) {
          continue;
        }
        const aggregation =
          baselineByStage.get(stage) ?? {
            tasks: 0,
            successRates: [],
            fallbackRates: [],
            humanHandOffRates: [],
            avgLatencies: [],
            qualityScores: [],
          };
        aggregation.qualityScores.push(clamp(observation.score, 0, 100));
        baselineByStage.set(stage, aggregation);
      }

      const baselineStats = new Map<string, BaselineStats>();
      for (const [stage, aggregation] of baselineByStage.entries()) {
        const samples = Math.max(
          aggregation.successRates.length,
          aggregation.fallbackRates.length,
          aggregation.humanHandOffRates.length,
          aggregation.avgLatencies.length,
          aggregation.qualityScores.length,
          0
        );

        if (samples === 0) {
          continue;
        }

        const successMean = calculateMean(aggregation.successRates);
        const successStd = Math.max(
          calculateStdDev(aggregation.successRates, successMean),
          DEFAULT_STDDEV_FLOOR
        );
        const fallbackMean = calculateMean(aggregation.fallbackRates);
        const humanHandOffMean = calculateMean(aggregation.humanHandOffRates);
        const latencyMean = calculateMean(aggregation.avgLatencies);
        const qualityMean = aggregation.qualityScores.length
          ? calculateMean(aggregation.qualityScores)
          : undefined;

        baselineStats.set(stage, {
          successMean,
          successStd,
          fallbackMean,
          humanHandOffMean,
          latencyMean,
          qualityMean,
          samples,
          tasks: aggregation.tasks,
        });
      }

      const config = context.config.analytics.anomalies;
      const warnings: string[] = [];
      let anomaliesRecorded = 0;

      for (const [stage, snapshot] of currentByStage.entries()) {
        if (snapshot.tasksProcessed < config.minSamples) {
          warnings.push(
            `Stage ${stage} processed ${snapshot.tasksProcessed} tasks (< ${config.minSamples}); anomaly detection skipped.`
          );
          continue;
        }

        const baseline = baselineStats.get(stage);
        if (!baseline) {
          warnings.push(`No baseline metrics available for stage ${stage}; skipping anomaly checks.`);
          continue;
        }

        if (baseline.tasks < config.minSamples) {
          warnings.push(
            `Baseline metrics for stage ${stage} have insufficient samples (${baseline.tasks}); skipping.`
          );
          continue;
        }

        const triggers: string[] = [];
        let severity: 'info' | 'warning' | 'error' | 'critical' = 'warning';

        const successDelta = baseline.successMean - snapshot.successRate;
        const successThreshold = baseline.successStd * config.stdDeviations;
        if (successDelta > successThreshold && successDelta > 0) {
          triggers.push(
            `Success rate dropped by ${(successDelta * 100).toFixed(2)} pts (baseline ${(baseline.successMean * 100).toFixed(2)}%, current ${(snapshot.successRate * 100).toFixed(2)}%).`
          );
        }

        if (snapshot.successRate <= config.criticalSuccessRate) {
          triggers.push(
            `Success rate ${ (snapshot.successRate * 100).toFixed(2)}% fell below critical threshold ${ (config.criticalSuccessRate * 100).toFixed(2)}%.`
          );
          severity = 'critical';
        }

        if (baseline.latencyMean > 0) {
          const latencyRatio = snapshot.avgLatencyMs / baseline.latencyMean;
          if (latencyRatio >= config.warningLatencyFactor) {
            triggers.push(
              `Latency regression ${(latencyRatio * 100 - 100).toFixed(2)}% over baseline (baseline ${baseline.latencyMean.toFixed(0)}ms, current ${snapshot.avgLatencyMs.toFixed(0)}ms).`
            );
            if (severity !== 'critical') {
              severity = 'error';
            }
          }
        }

        if (baseline.qualityMean !== undefined && snapshot.qualityScore !== undefined) {
          const qualityDelta = baseline.qualityMean - snapshot.qualityScore;
          const qualityThreshold = config.stdDeviations * 5; // quality scores use 0-100 scale
          if (qualityDelta > qualityThreshold && qualityDelta > 0) {
            triggers.push(
              `Quality score dropped ${qualityDelta.toFixed(2)} pts (baseline ${baseline.qualityMean.toFixed(2)}, current ${snapshot.qualityScore.toFixed(2)}).`
            );
          }
        }

        if (!triggers.length) {
          continue;
        }

        await recordAnalyticsAnomaly({
          source: stage,
          severity,
          description: `Anomaly detected for stage ${stage}: ${triggers.join(' ')}`,
          occurredAt: context.window.end,
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
            baselineStart: baselineWindowStart.toISOString(),
            baselineSamples: baseline.samples,
            baselineTasks: baseline.tasks,
            currentTasks: snapshot.tasksProcessed,
            successRate: snapshot.successRate,
            fallbackRate: snapshot.fallbackRate,
            humanHandOffRate: snapshot.humanHandOffRate,
            avgLatencyMs: snapshot.avgLatencyMs,
            qualityScore: snapshot.qualityScore ?? null,
            triggers,
          },
        });

        anomaliesRecorded += 1;
      }

      const durationMs = Date.now() - startedAt;
      span.setAttributes({
        'analytics.pipeline.records': anomaliesRecorded,
        'analytics.pipeline.durationMs': durationMs,
        'analytics.pipeline.analyzedStages': currentByStage.size,
      });

      return {
        pipeline: ANALYTICS_PIPELINES.anomalies,
        recordsProcessed: anomaliesRecorded,
        durationMs,
        warnings,
        metadata: {
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          baselineStart: baselineWindowStart.toISOString(),
          analyzedStages: Array.from(currentByStage.keys()),
        },
        telemetryEventsScanned: currentPerformance.length + currentQuality.length,
        nextCursor: context.window.end,
      } satisfies PipelineResult;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'Anomaly detection pipeline failure' });
      throw error;
    } finally {
      span.end();
    }
  },
});
