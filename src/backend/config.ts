import dotenv from 'dotenv';

type RuntimeEnv = Record<string, string | undefined>;

const hasProcessEnv = typeof process !== 'undefined' && typeof process.env !== 'undefined';

if (hasProcessEnv && !process.env.BACKEND_CONFIG_LOADED) {
  dotenv.config();
  process.env.BACKEND_CONFIG_LOADED = 'true';
}

const runtimeEnv: RuntimeEnv = hasProcessEnv ? (process.env as RuntimeEnv) : {};

// #region Type Definitions
export interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  keyPrefix: string;
  tls: boolean;
  connectionName: string;
}

export interface MetricsConfig {
  enabled: boolean;
  serviceName: string;
  exporterUrl: string;
  headers: Record<string, string>;
  intervalMs: number;
}

export interface TracingConfig {
  enabled: boolean;
  exporterUrl: string;
  headers: Record<string, string>;
  samplerRatio: number;
}

export interface AlertingConfig {
  slackWebhook: string | null;
  emailFrom: string | null;
  emailSmtpUrl: string | null;
  emailRecipients: string[];
  minSeverity: 'info' | 'warning' | 'error' | 'critical';
}

export interface AnalyticsIngestionConfig {
  intervalMs: number;
  windowMinutes: number;
}

export interface AnalyticsQualityWeightsConfig {
  successRate: number;
  failureRate: number;
  latency: number;
  fallbackRate: number;
  humanHandOffRate: number;
  retryRate: number;
}

export interface AnalyticsQualityScoreConfig {
  baseIntercept: number;
  latencyBaselineMs: number;
  confidentTaskCount: number;
  weights: AnalyticsQualityWeightsConfig;
}

export interface AnalyticsAnomaliesConfig {
  stdDeviations: number;
  minSamples: number;
  criticalSuccessRate: number;
  warningLatencyFactor: number;
}

export interface AnalyticsConfig {
  ingestion: AnalyticsIngestionConfig;
  qualityScore: AnalyticsQualityScoreConfig;
  anomalies: AnalyticsAnomaliesConfig;
}

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface DatabaseConfig {
  url: string;
}

export interface AppConfig {
  env: string;
  port: number;
  host: string;
  apiPrefix: string;
  apiKey: string | null;
  corsOrigins: string[];
  rateLimit: RateLimitConfig;
  redis: RedisConfig;
  database: DatabaseConfig;
  metrics: MetricsConfig;
  tracing: TracingConfig;
  telemetryRetentionDays: number;
  sessionTtlSeconds: number;
  alerting: AlertingConfig;
  analytics: AnalyticsConfig;
}
// #endregion

// #region Helper Functions
/**
 * Parses a string value into a number, returning a fallback if parsing fails.
 * @param value The value to parse.
 * @param fallback The fallback value.
 * @returns A number.
 */
const requiredNumber = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Parses a string value into a boolean.
 * @param value The value to parse.
 * @param fallback The fallback value.
 * @returns A boolean.
 */
const boolFromEnv = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  const normalized = String(value).toLowerCase().trim();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

/**
 * Parses a comma-separated string of key-value pairs into a record.
 * @param value The string to parse.
 * @returns A record of headers.
 */
const parseHeaders = (value: string | undefined): Record<string, string> => {
  if (!value) return {};
  return value
    .split(',')
    .map((header) => header.trim())
    .filter(Boolean)
    .reduce((acc, header) => {
      const [key, ...rest] = header.split('=');
      if (key && rest.length > 0) {
        acc[key.trim()] = rest.join('=').trim();
      }
      return acc;
    }, {} as Record<string, string>);
};

/**
 * Parses a comma-separated string into an array of strings.
 * @param value The string to parse.
 * @returns An array of strings.
 */
const parseCsv = (value: string | undefined): string[] => {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

/**
 * Normalizes a severity level string to a known set of values.
 * @param value The severity string.
 * @param fallback The fallback severity.
 * @returns A normalized severity level.
 */
const normalizeSeverity = (
  value: string | undefined,
  fallback: AlertingConfig['minSeverity'] = 'warning'
): AlertingConfig['minSeverity'] => {
  const allowed: AlertingConfig['minSeverity'][] = ['info', 'warning', 'error', 'critical'];
  const normalized = String(value ?? '').toLowerCase() as AlertingConfig['minSeverity'];
  return allowed.includes(normalized) ? normalized : fallback;
};
// #endregion

// #region Configuration Object
export const config: AppConfig = {
  env: runtimeEnv.NODE_ENV || 'production',
  port: requiredNumber(runtimeEnv.BACKEND_PORT ?? runtimeEnv.PORT, 4000),
  host: runtimeEnv.BACKEND_HOST || '0.0.0.0',
  apiPrefix: '/api',
  apiKey: runtimeEnv.BACKEND_API_KEY || null,
  corsOrigins: (runtimeEnv.BACKEND_CORS_ORIGINS || '*')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: requiredNumber(runtimeEnv.BACKEND_RATE_LIMIT_WINDOW_MS, 60_000),
    max: requiredNumber(runtimeEnv.BACKEND_RATE_LIMIT_MAX, 600),
  },
  redis: {
    url: runtimeEnv.REDIS_URL || undefined,
    host: runtimeEnv.REDIS_HOST || '127.0.0.1',
    port: requiredNumber(runtimeEnv.REDIS_PORT, 6379),
    password: runtimeEnv.REDIS_PASSWORD || undefined,
    keyPrefix: runtimeEnv.REDIS_PREFIX || 'gemini-ide:',
    tls: boolFromEnv(runtimeEnv.REDIS_TLS, false),
    connectionName: runtimeEnv.REDIS_CONNECTION_NAME || 'gemini-ide-backend',
  },
  database: {
    url: runtimeEnv.DATABASE_URL || 'postgresql://localhost:5432/gemini_ide',
  },
  metrics: {
    enabled: boolFromEnv(runtimeEnv.BACKEND_METRICS_ENABLED, true),
    serviceName: runtimeEnv.OTEL_SERVICE_NAME || 'gemini-ide-backend',
    exporterUrl: runtimeEnv.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT || 'http://localhost:4318/v1/metrics',
    headers: parseHeaders(runtimeEnv.OTEL_EXPORTER_OTLP_HEADERS),
    intervalMs: requiredNumber(runtimeEnv.OTEL_METRICS_INTERVAL_MS, 60_000),
  },
  tracing: {
    enabled: boolFromEnv(runtimeEnv.BACKEND_TRACING_ENABLED, true),
    exporterUrl: runtimeEnv.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: parseHeaders(runtimeEnv.OTEL_EXPORTER_OTLP_HEADERS),
    samplerRatio: Number(runtimeEnv.OTEL_TRACES_SAMPLER_RATIO ?? '1'),
  },
  telemetryRetentionDays: requiredNumber(runtimeEnv.TELEMETRY_RETENTION_DAYS, 30),
  sessionTtlSeconds: requiredNumber(runtimeEnv.COLLAB_SESSION_TTL_SECONDS, 3600),
  alerting: {
    slackWebhook: runtimeEnv.SLACK_WEBHOOK_URL || null,
    emailFrom: runtimeEnv.ALERT_EMAIL_FROM || null,
    emailSmtpUrl: runtimeEnv.ALERT_EMAIL_SMTP_URL || null,
    emailRecipients: parseCsv(runtimeEnv.ALERT_EMAIL_RECIPIENTS),
    minSeverity: normalizeSeverity(runtimeEnv.ALERT_MIN_SEVERITY, 'warning'),
  },
  analytics: {
    ingestion: {
      intervalMs: requiredNumber(runtimeEnv.ANALYTICS_INGEST_INTERVAL_MS, 300_000),
      windowMinutes: requiredNumber(runtimeEnv.ANALYTICS_WINDOW_MINUTES, 60),
    },
    qualityScore: {
      baseIntercept: Number(runtimeEnv.ANALYTICS_QUALITY_BASE ?? '-0.25'),
      latencyBaselineMs: requiredNumber(runtimeEnv.ANALYTICS_QUALITY_LATENCY_BASELINE_MS, 1_500),
      confidentTaskCount: requiredNumber(runtimeEnv.ANALYTICS_QUALITY_CONFIDENT_TASKS, 20),
      weights: {
        successRate: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_SUCCESS ?? '3.2'),
        failureRate: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_FAILURE ?? '-2.6'),
        latency: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_LATENCY ?? '-0.9'),
        fallbackRate: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_FALLBACK ?? '-1.2'),
        humanHandOffRate: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_HANDOFF ?? '-1.6'),
        retryRate: Number(runtimeEnv.ANALYTICS_QUALITY_WEIGHT_RETRY ?? '-0.8'),
      },
    },
    anomalies: {
      stdDeviations: Number(runtimeEnv.ANALYTICS_ANOMALY_STD_DEVIATIONS ?? '2.5'),
      minSamples: requiredNumber(runtimeEnv.ANALYTICS_ANOMALY_MIN_SAMPLES, 5),
      criticalSuccessRate: Number(runtimeEnv.ANALYTICS_ANOMALY_CRITICAL_SUCCESS ?? '0.6'),
      warningLatencyFactor: Number(runtimeEnv.ANALYTICS_ANOMALY_LATENCY_FACTOR ?? '1.5'),
    },
  },
};

export default config;
// #endregion