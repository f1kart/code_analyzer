import type { PipelineDefinition, PipelineResult } from '../types.ts';
import { ANALYTICS_PIPELINES, TELEMETRY_EVENT_TYPES } from '../constants.ts';
import { recordRepositoryAnalytics } from '../../services/analyticsService.ts';

interface RepositoryTelemetryPayload {
  repository?: string | null;
  branch?: string | null;
  commitVelocity?: number | string | null;
  commits?: number | string | null;
  commitsPerDay?: number | string | null;
  refactorHotspots?: Record<string, unknown> | null;
  coverageDrift?: number | string | null;
  coverage?: number | string | null;
  previousCoverage?: number | string | null;
  metadata?: Record<string, unknown> | null;
}

const REPOSITORY_EVENT_TYPES = [
  'repository.analytics.snapshot',
  'repository.commit.activity',
  'repository.coverage.snapshot',
  TELEMETRY_EVENT_TYPES.repository,
];

const MAX_HOTSPOT_ENTRIES = 100;
const METADATA_SAMPLE_CAP = 50;

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

const normalizeHotspots = (hotspots?: Record<string, unknown> | null): Record<string, unknown> | undefined => {
  if (!hotspots) {
    return undefined;
  }

  const entries = Object.entries(hotspots)
    .map(([path, data]) => [path.trim(), data] as const)
    .filter(([path]) => path.length > 0)
    .slice(0, MAX_HOTSPOT_ENTRIES);

  if (!entries.length) {
    return undefined;
  }

  return entries.reduce<Record<string, unknown>>((acc, [path, data]) => {
    acc[path] = data;
    return acc;
  }, {});
};

export const createRepositoryPipeline = (
  appConfig: PipelineDefinition['run'] extends (context: infer T) => Promise<PipelineResult>
    ? T extends { config: infer C }
      ? C
      : never
    : never
): PipelineDefinition => ({
  name: ANALYTICS_PIPELINES.repository,
  description: 'Aggregates repository-level analytics including commit velocity and refactor hotspots.',
  intervalMs: appConfig.analytics.ingestion.intervalMs,
  run: async (context) => {
    const span = context.tracer.startSpan('analytics.pipeline.repository');
    const startedAt = Date.now();

    try {
      const events = await context.prisma.telemetryEvent.findMany({
        where: {
          eventType: { in: REPOSITORY_EVENT_TYPES },
          occurredAt: {
            gte: context.window.start,
            lt: context.window.end,
          },
        },
        orderBy: { occurredAt: 'asc' },
      });

      if (events.length === 0) {
        span.addEvent('No repository telemetry in window');
        return {
          pipeline: ANALYTICS_PIPELINES.repository,
          recordsProcessed: 0,
          durationMs: Date.now() - startedAt,
          warnings: ['No repository telemetry events detected in window'],
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
          telemetryEventsScanned: 0,
          nextCursor: context.window.end,
        } satisfies PipelineResult;
      }

      const metricsByRepo = new Map<
        string,
        {
          branch?: string | null;
          commitVelocity: number;
          velocitySamples: number;
          refactorHotspots?: Record<string, unknown>;
          coverageDrift: number;
          coverageSamples: number;
          metadataSamples: Record<string, unknown>[];
        }
      >();

      for (const event of events) {
        const payload = (event.payload ?? null) as RepositoryTelemetryPayload | null;
        const repository = typeof payload?.repository === 'string' ? payload.repository.trim() : '';
        if (!repository) {
          continue;
        }

        const branch = typeof payload?.branch === 'string' ? payload.branch.trim() : null;

        const metrics =
          metricsByRepo.get(repository) ?? {
            branch,
            commitVelocity: 0,
            velocitySamples: 0,
            refactorHotspots: undefined,
            coverageDrift: 0,
            coverageSamples: 0,
            metadataSamples: [],
          };

        if (!metrics.branch && branch) {
          metrics.branch = branch;
        }

        const velocity =
          toNumber(payload?.commitVelocity) ??
          toNumber(payload?.commitsPerDay) ??
          toNumber(payload?.commits);
        if (typeof velocity === 'number') {
          metrics.commitVelocity += velocity;
          metrics.velocitySamples += 1;
        }

        const hotspots = normalizeHotspots(payload?.refactorHotspots);
        if (hotspots) {
          metrics.refactorHotspots = {
            ...(metrics.refactorHotspots ?? {}),
            ...hotspots,
          };
        }

        const coverage = toNumber(payload?.coverage);
        const previousCoverage = toNumber(payload?.previousCoverage);
        const explicitDrift = toNumber(payload?.coverageDrift);
        if (typeof explicitDrift === 'number') {
          metrics.coverageDrift += explicitDrift;
          metrics.coverageSamples += 1;
        } else if (typeof coverage === 'number' && typeof previousCoverage === 'number') {
          metrics.coverageDrift += coverage - previousCoverage;
          metrics.coverageSamples += 1;
        }

        if (payload?.metadata && metrics.metadataSamples.length < METADATA_SAMPLE_CAP) {
          metrics.metadataSamples.push(payload.metadata);
        }

        metricsByRepo.set(repository, metrics);
      }

      let recordsProcessed = 0;
      const warnings: string[] = [];

      for (const [repository, metrics] of metricsByRepo.entries()) {
        const commitVelocity =
          metrics.velocitySamples > 0 ? metrics.commitVelocity / metrics.velocitySamples : metrics.commitVelocity;

        const coverageDrift =
          metrics.coverageSamples > 0 ? metrics.coverageDrift / metrics.coverageSamples : metrics.coverageDrift;

        if (!Number.isFinite(commitVelocity) || commitVelocity < 0) {
          warnings.push(`Repository ${repository} produced invalid velocity. Skipping.`);
          continue;
        }

        await recordRepositoryAnalytics({
          repository,
          branch: metrics.branch ?? undefined,
          windowStart: context.window.start,
          windowEnd: context.window.end,
          commitVelocity: Math.round(commitVelocity),
          refactorHotspots: metrics.refactorHotspots ?? {},
          coverageDrift: Number(coverageDrift.toFixed(3)),
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
            samples: metrics.metadataSamples.length ? metrics.metadataSamples : undefined,
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
        pipeline: ANALYTICS_PIPELINES.repository,
        recordsProcessed,
        durationMs,
        warnings,
        metadata: {
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          repositories: Array.from(metricsByRepo.keys()),
        },
        telemetryEventsScanned: events.length,
        nextCursor: context.window.end,
      } satisfies PipelineResult;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'Repository analytics pipeline failure' });
      throw error;
    } finally {
      span.end();
    }
  },
});
