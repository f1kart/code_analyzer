import type { PipelineDefinition, PipelineResult } from '../types.ts';
import { ANALYTICS_PIPELINES, TELEMETRY_EVENT_TYPES } from '../constants.ts';
import { recordUserEngagement } from '../../services/analyticsService.ts';

interface UserEngagementTelemetryPayload {
  userId?: string | null;
  sessionId?: string | null;
  collaborationSessionId?: string | null;
  durationSec?: number | string | null;
  feature?: string | null;
  featureUsage?: Record<string, number> | null;
  retentionCohort?: string | null;
  activeUsers?: number | string | null;
  collaborationSessions?: number | string | null;
  avgSessionDurationSec?: number | string | null;
  metadata?: Record<string, unknown> | null;
}

const USER_ENGAGEMENT_EVENT_TYPES = [
  'session.started',
  'session.ended',
  'collaboration.session.started',
  'collaboration.session.ended',
  'feature.used',
  TELEMETRY_EVENT_TYPES.userEngagement,
];

const FEATURE_USAGE_CAP = 100;
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

export const createUserEngagementPipeline = (
  appConfig: PipelineDefinition['run'] extends (context: infer T) => Promise<PipelineResult>
    ? T extends { config: infer C }
      ? C
      : never
    : never
): PipelineDefinition => ({
  name: ANALYTICS_PIPELINES.userEngagement,
  description: 'Aggregates user engagement telemetry into UserEngagementMetric records.',
  intervalMs: appConfig.analytics.ingestion.intervalMs,
  run: async (context) => {
    const span = context.tracer.startSpan('analytics.pipeline.user-engagement');
    const startedAt = Date.now();

    try {
      const events = await context.prisma.telemetryEvent.findMany({
        where: {
          eventType: { in: USER_ENGAGEMENT_EVENT_TYPES },
          occurredAt: {
            gte: context.window.start,
            lt: context.window.end,
          },
        },
        orderBy: { occurredAt: 'asc' },
      });

      if (events.length === 0) {
        span.addEvent('No engagement telemetry in window');
        return {
          pipeline: ANALYTICS_PIPELINES.userEngagement,
          recordsProcessed: 0,
          durationMs: Date.now() - startedAt,
          warnings: ['No engagement telemetry events detected in window'],
          metadata: {
            windowStart: context.window.start.toISOString(),
            windowEnd: context.window.end.toISOString(),
          },
          telemetryEventsScanned: 0,
          nextCursor: context.window.end,
        } satisfies PipelineResult;
      }

      const uniqueUsers = new Set<string>();
      const collaborationSessions = new Set<string>();
      let inferredActiveUsers = 0;
      let inferredCollabSessions = 0;
      let inferredAvgSessionDuration = 0;
      let avgSessionContributors = 0;
      let sessionDurationTotal = 0;
      let sessionCount = 0;
      const featureUsage = new Map<string, number>();
      const retention = new Map<string, number>();
      const metadataSamples: Record<string, unknown>[] = [];

      for (const event of events) {
        const payload = (event.payload ?? null) as UserEngagementTelemetryPayload | null;
        if (payload?.metadata && metadataSamples.length < METADATA_SAMPLE_CAP) {
          metadataSamples.push(payload.metadata);
        }

        const explicitActive = toNumber(payload?.activeUsers);
        if (typeof explicitActive === 'number') {
          inferredActiveUsers = Math.max(inferredActiveUsers, explicitActive);
        }

        const explicitCollab = toNumber(payload?.collaborationSessions);
        if (typeof explicitCollab === 'number') {
          inferredCollabSessions = Math.max(inferredCollabSessions, explicitCollab);
        }

        const explicitAvgDuration = toNumber(payload?.avgSessionDurationSec);
        if (typeof explicitAvgDuration === 'number') {
          inferredAvgSessionDuration = Math.max(inferredAvgSessionDuration, explicitAvgDuration);
        }

        const userId = typeof payload?.userId === 'string' ? payload.userId.trim() : '';
        if (userId) {
          uniqueUsers.add(userId);
        }

        const collabId =
          typeof payload?.collaborationSessionId === 'string' ? payload.collaborationSessionId.trim() : '';
        if (collabId) {
          collaborationSessions.add(collabId);
        }

        const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : '';
        if (sessionId) {
          sessionCount += 1;
          const duration = toNumber(payload?.durationSec);
          if (typeof duration === 'number') {
            sessionDurationTotal += duration;
            avgSessionContributors += 1;
          }
        }

        if (payload?.featureUsage) {
          for (const [feature, count] of Object.entries(payload.featureUsage)) {
            const normalized = feature.trim();
            if (!normalized) {
              continue;
            }
            const numeric = toNumber(count) ?? 0;
            if (numeric <= 0) {
              continue;
            }
            featureUsage.set(normalized, (featureUsage.get(normalized) ?? 0) + numeric);
          }
        }

        const feature = typeof payload?.feature === 'string' ? payload.feature.trim() : '';
        if (feature) {
          featureUsage.set(feature, (featureUsage.get(feature) ?? 0) + 1);
        }

        const cohort = typeof payload?.retentionCohort === 'string' ? payload.retentionCohort.trim() : '';
        if (cohort) {
          retention.set(cohort, (retention.get(cohort) ?? 0) + 1);
        }
      }

      const activeUsers = inferredActiveUsers || uniqueUsers.size;
      const collabSessions = inferredCollabSessions || collaborationSessions.size;
      const avgSessionDurationSec = inferredAvgSessionDuration || (avgSessionContributors > 0
        ? sessionDurationTotal / avgSessionContributors
        : 0);

      const featureUsageObject: Record<string, number> = {};
      for (const [feature, count] of featureUsage) {
        if (Object.keys(featureUsageObject).length >= FEATURE_USAGE_CAP) {
          break;
        }
        featureUsageObject[feature] = Number(count.toFixed(2));
      }

      const retentionCohorts = retention.size
        ? Array.from(retention.entries()).reduce<Record<string, number>>((acc, [cohort, count]) => {
            acc[cohort] = count;
            return acc;
          }, {})
        : undefined;

      await recordUserEngagement({
        windowStart: context.window.start,
        windowEnd: context.window.end,
        activeUsers,
        collaborationSessions: collabSessions,
        avgSessionDurationSec: Number(avgSessionDurationSec.toFixed(2)),
        featureUsage: featureUsageObject,
        retentionCohorts,
        metadata: {
          sessionCount,
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          metadataSamples: metadataSamples.length ? metadataSamples : undefined,
        },
      });

      const durationMs = Date.now() - startedAt;
      span.setAttributes({
        'analytics.pipeline.records': 1,
        'analytics.pipeline.durationMs': durationMs,
        'analytics.pipeline.telemetryEvents': events.length,
        'analytics.pipeline.activeUsers': activeUsers,
      });

      return {
        pipeline: ANALYTICS_PIPELINES.userEngagement,
        recordsProcessed: 1,
        durationMs,
        warnings: [],
        metadata: {
          windowStart: context.window.start.toISOString(),
          windowEnd: context.window.end.toISOString(),
          activeUsers,
          collaborationSessions: collabSessions,
        },
        telemetryEventsScanned: events.length,
        nextCursor: context.window.end,
      } satisfies PipelineResult;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: 2, message: 'User engagement pipeline failure' });
      throw error;
    } finally {
      span.end();
    }
  },
});
