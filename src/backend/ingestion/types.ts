import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Tracer, Span } from '@opentelemetry/api';
import type { Logger } from 'pino';
import config from '../config.js';

export type AppConfig = typeof config;

export interface AnalyticsIngestionStateSnapshot {
  id: number;
  pipeline: string;
  lastProcessedAt: Date;
  metadata: unknown;
  updatedAt: Date;
}

export interface PipelineWindow {
  start: Date;
  end: Date;
  state: AnalyticsIngestionStateSnapshot;
}

export interface PipelineSharedState {
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
  entries(): [string, unknown][];
}

export interface PipelineContext {
  prisma: PrismaClient;
  redis: Redis;
  config: AppConfig;
  logger: Logger;
  tracer: Tracer;
  span: Span;
  window: PipelineWindow;
  shared: PipelineSharedState;
}

export interface PipelineResult {
  pipeline: string;
  recordsProcessed: number;
  durationMs: number;
  warnings?: string[];
  metadata?: Record<string, unknown>;
  nextCursor?: Date;
  telemetryEventsScanned?: number;
}

export interface PipelineDefinition {
  name: string;
  description: string;
  intervalMs: number;
  run(context: PipelineContext): Promise<PipelineResult>;
}

export interface SchedulerHandle {
  stop(): Promise<void>;
}

export interface IngestionOrchestrator {
  start(): Promise<void>;
  stop(): Promise<void>;
}
