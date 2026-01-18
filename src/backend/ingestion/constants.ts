export const ANALYTICS_PIPELINES = {
  quality: 'analytics-quality',
  agentPerformance: 'analytics-agent-performance',
  userEngagement: 'analytics-user-engagement',
  repository: 'analytics-repository',
  anomalies: 'analytics-anomalies',
} as const;

export type AnalyticsPipelineName = (typeof ANALYTICS_PIPELINES)[keyof typeof ANALYTICS_PIPELINES];

export const TELEMETRY_EVENT_TYPES = {
  quality: 'analytics.quality-observation',
  agentPerformance: 'analytics.agent-performance',
  userEngagement: 'analytics.user-engagement',
  repository: 'analytics.repository-metric',
  anomalies: 'analytics.anomaly',
} as const;
