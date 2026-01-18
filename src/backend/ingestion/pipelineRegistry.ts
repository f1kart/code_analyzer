import type { PipelineDefinition, AppConfig } from './types.ts';
import { createQualityPipeline } from './pipelines/qualityPipeline.ts';
import { createAgentPerformancePipeline } from './pipelines/agentPerformancePipeline.ts';
import { createUserEngagementPipeline } from './pipelines/userEngagementPipeline.ts';
import { createRepositoryPipeline } from './pipelines/repositoryPipeline.ts';
import { createAnomalyPipeline } from './pipelines/anomalyPipeline.ts';

export const createPipelineRegistry = (config: AppConfig): PipelineDefinition[] => [
  createQualityPipeline(config),
  createAgentPerformancePipeline(config),
  createUserEngagementPipeline(config),
  createRepositoryPipeline(config),
  createAnomalyPipeline(config),
];
