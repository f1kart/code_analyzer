import { getPrisma } from '../prisma.js';

const prisma = getPrisma();

export interface QualityScoreInput {
  agentStage: string;
  score: number;
  drivers: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}

export const recordQualityScore = async (input: QualityScoreInput) => {
  const occurredAt = input.occurredAt ?? new Date();

  return prisma.qualityScoreObservation.upsert({
    where: {
      agentStage_occurredAt: {
        agentStage: input.agentStage,
        occurredAt,
      },
    },
    update: {
      score: input.score,
      drivers: input.drivers,
      metadata: input.metadata ?? null,
    },
    create: {
      agentStage: input.agentStage,
      score: input.score,
      drivers: input.drivers,
      metadata: input.metadata ?? null,
      occurredAt,
    },
  });
};

export const getQualityScoreTrend = async (params: { agentStage?: string; from?: Date; to?: Date }) => {
  const where = {
    ...(params.agentStage ? { agentStage: params.agentStage } : {}),
    ...(params.from || params.to
      ? {
          occurredAt: {
            ...(params.from ? { gte: params.from } : {}),
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  return prisma.qualityScoreObservation.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: 500,
  });
};

export interface AgentPerformanceInput {
  agentStage: string;
  windowStart: Date;
  windowEnd: Date;
  tasksProcessed: number;
  avgLatencyMs: number;
  successRate: number;
  fallbackRate: number;
  humanHandOffRate: number;
  metadata?: Record<string, unknown>;
}

export const recordAgentPerformance = async (input: AgentPerformanceInput) => {
  return prisma.agentPerformanceMetric.upsert({
    where: {
      agentStage_windowStart_windowEnd: {
        agentStage: input.agentStage,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      },
    },
    update: {
      tasksProcessed: input.tasksProcessed,
      avgLatencyMs: input.avgLatencyMs,
      successRate: input.successRate,
      fallbackRate: input.fallbackRate,
      humanHandOffRate: input.humanHandOffRate,
      metadata: input.metadata ?? null,
    },
    create: {
      agentStage: input.agentStage,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      tasksProcessed: input.tasksProcessed,
      avgLatencyMs: input.avgLatencyMs,
      successRate: input.successRate,
      fallbackRate: input.fallbackRate,
      humanHandOffRate: input.humanHandOffRate,
      metadata: input.metadata ?? null,
    },
  });
};

export const getAgentPerformanceMetrics = async (params: { agentStage?: string; from?: Date; to?: Date }) => {
  const where = {
    ...(params.agentStage ? { agentStage: params.agentStage } : {}),
    ...(params.from || params.to
      ? {
          windowStart: {
            ...(params.from ? { gte: params.from } : {}),
          },
          windowEnd: {
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  return prisma.agentPerformanceMetric.findMany({
    where,
    orderBy: { windowStart: 'desc' },
    take: 200,
  });
};

export interface UserEngagementInput {
  windowStart: Date;
  windowEnd: Date;
  activeUsers: number;
  collaborationSessions: number;
  avgSessionDurationSec: number;
  featureUsage: Record<string, number>;
  retentionCohorts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export const recordUserEngagement = async (input: UserEngagementInput) => {
  return prisma.userEngagementMetric.upsert({
    where: {
      windowStart_windowEnd: {
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      },
    },
    update: {
      activeUsers: input.activeUsers,
      collaborationSessions: input.collaborationSessions,
      avgSessionDurationSec: input.avgSessionDurationSec,
      featureUsage: input.featureUsage,
      retentionCohorts: input.retentionCohorts ?? null,
      metadata: input.metadata ?? null,
    },
    create: {
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      activeUsers: input.activeUsers,
      collaborationSessions: input.collaborationSessions,
      avgSessionDurationSec: input.avgSessionDurationSec,
      featureUsage: input.featureUsage,
      retentionCohorts: input.retentionCohorts ?? null,
      metadata: input.metadata ?? null,
    },
  });
};

export const getUserEngagementMetrics = async (params: { from?: Date; to?: Date }) => {
  const where =
    params.from || params.to
      ? {
          windowStart: {
            ...(params.from ? { gte: params.from } : {}),
          },
          windowEnd: {
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {};

  return prisma.userEngagementMetric.findMany({
    where,
    orderBy: { windowStart: 'desc' },
    take: 200,
  });
};

export interface RepositoryAnalyticsInput {
  repository: string;
  branch?: string;
  windowStart: Date;
  windowEnd: Date;
  commitVelocity: number;
  refactorHotspots: Record<string, unknown>;
  coverageDrift: number;
  metadata?: Record<string, unknown>;
}

export const recordRepositoryAnalytics = async (input: RepositoryAnalyticsInput) => {
  return prisma.repositoryAnalyticsMetric.upsert({
    where: {
      repository_branch_windowStart_windowEnd: {
        repository: input.repository,
        branch: input.branch ?? null,
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      },
    },
    update: {
      commitVelocity: input.commitVelocity,
      refactorHotspots: input.refactorHotspots,
      coverageDrift: input.coverageDrift,
      metadata: input.metadata ?? null,
    },
    create: {
      repository: input.repository,
      branch: input.branch ?? null,
      windowStart: input.windowStart,
      windowEnd: input.windowEnd,
      commitVelocity: input.commitVelocity,
      refactorHotspots: input.refactorHotspots,
      coverageDrift: input.coverageDrift,
      metadata: input.metadata ?? null,
    },
  });
};

export const getRepositoryAnalytics = async (params: { repository?: string; branch?: string; from?: Date; to?: Date }) => {
  const where = {
    ...(params.repository ? { repository: params.repository } : {}),
    ...(params.branch ? { branch: params.branch } : {}),
    ...(params.from || params.to
      ? {
          windowStart: {
            ...(params.from ? { gte: params.from } : {}),
          },
          windowEnd: {
            ...(params.to ? { lte: params.to } : {}),
          },
        }
      : {}),
  };

  return prisma.repositoryAnalyticsMetric.findMany({
    where,
    orderBy: { windowStart: 'desc' },
    take: 200,
  });
};

export interface AnalyticsAnomalyInput {
  source: string;
  severity: string;
  description: string;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}

export const recordAnalyticsAnomaly = async (input: AnalyticsAnomalyInput) => {
  const occurredAt = input.occurredAt ?? new Date();

  return prisma.analyticsAnomalyEvent.upsert({
    where: {
      source_severity_occurredAt: {
        source: input.source,
        severity: input.severity,
        occurredAt,
      },
    },
    update: {
      description: input.description,
      metadata: input.metadata ?? null,
      resolved: false,
    },
    create: {
      source: input.source,
      severity: input.severity,
      description: input.description,
      occurredAt,
      metadata: input.metadata ?? null,
    },
  });
};

export const listAnalyticsAnomalies = async (params: { source?: string; severity?: string; resolved?: boolean }) => {
  const where = {
    ...(params.source ? { source: params.source } : {}),
    ...(params.severity ? { severity: params.severity } : {}),
    ...(params.resolved !== undefined ? { resolved: params.resolved } : {}),
  };

  return prisma.analyticsAnomalyEvent.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: 200,
  });
};

export const resolveAnalyticsAnomaly = async (id: number) => {
  return prisma.analyticsAnomalyEvent.update({
    where: { id },
    data: { resolved: true },
  });
};
