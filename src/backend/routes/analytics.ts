import type { Request, Response } from 'express';
import { Router } from 'express';
import { body, query } from 'express-validator';
import { asyncHandler, ensureValidRequest } from './utils.js';
import {
  recordQualityScore,
  getQualityScoreTrend,
  recordAgentPerformance,
  getAgentPerformanceMetrics,
  recordUserEngagement,
  getUserEngagementMetrics,
  recordRepositoryAnalytics,
  getRepositoryAnalytics,
  recordAnalyticsAnomaly,
  listAnalyticsAnomalies,
  resolveAnalyticsAnomaly,
} from '../services/analyticsService.ts';

export const registerAnalyticsRoutes = (router: Router): void => {
  const analyticsRouter = Router({ mergeParams: true });

  analyticsRouter.post(
    '/quality-scores',
    [
      body('agentStage').isString().trim().isLength({ min: 1 }),
      body('score').isFloat({ min: 0, max: 100 }),
      body('drivers').isObject(),
      body('metadata').optional().isObject(),
      body('occurredAt').optional().isISO8601(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const result = await recordQualityScore({
        agentStage: req.body.agentStage,
        score: Number(req.body.score),
        drivers: req.body.drivers,
        metadata: req.body.metadata,
        occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
      });
      res.status(201).json(result);
    })
  );

  analyticsRouter.get(
    '/quality-scores/trend',
    [
      query('agentStage').optional().isString().trim(),
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const trend = await getQualityScoreTrend({
        agentStage: typeof req.query.agentStage === 'string' ? req.query.agentStage : undefined,
        from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
      });
      res.json({ data: trend });
    })
  );

  analyticsRouter.post(
    '/agent-performance',
    [
      body('agentStage').isString().trim().isLength({ min: 1 }),
      body('windowStart').isISO8601(),
      body('windowEnd').isISO8601(),
      body('tasksProcessed').isInt({ min: 0 }),
      body('avgLatencyMs').isInt({ min: 0 }),
      body('successRate').isFloat({ min: 0, max: 1 }),
      body('fallbackRate').isFloat({ min: 0, max: 1 }),
      body('humanHandOffRate').isFloat({ min: 0, max: 1 }),
      body('metadata').optional().isObject(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const result = await recordAgentPerformance({
        agentStage: req.body.agentStage,
        windowStart: new Date(req.body.windowStart),
        windowEnd: new Date(req.body.windowEnd),
        tasksProcessed: Number(req.body.tasksProcessed),
        avgLatencyMs: Number(req.body.avgLatencyMs),
        successRate: Number(req.body.successRate),
        fallbackRate: Number(req.body.fallbackRate),
        humanHandOffRate: Number(req.body.humanHandOffRate),
        metadata: req.body.metadata,
      });
      res.status(201).json(result);
    })
  );

  analyticsRouter.get(
    '/agent-performance',
    [
      query('agentStage').optional().isString().trim(),
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const metrics = await getAgentPerformanceMetrics({
        agentStage: typeof req.query.agentStage === 'string' ? req.query.agentStage : undefined,
        from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
      });
      res.json({ data: metrics });
    })
  );

  analyticsRouter.post(
    '/user-engagement',
    [
      body('windowStart').isISO8601(),
      body('windowEnd').isISO8601(),
      body('activeUsers').isInt({ min: 0 }),
      body('collaborationSessions').isInt({ min: 0 }),
      body('avgSessionDurationSec').isInt({ min: 0 }),
      body('featureUsage').isObject(),
      body('retentionCohorts').optional().isObject(),
      body('metadata').optional().isObject(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const result = await recordUserEngagement({
        windowStart: new Date(req.body.windowStart),
        windowEnd: new Date(req.body.windowEnd),
        activeUsers: Number(req.body.activeUsers),
        collaborationSessions: Number(req.body.collaborationSessions),
        avgSessionDurationSec: Number(req.body.avgSessionDurationSec),
        featureUsage: req.body.featureUsage,
        retentionCohorts: req.body.retentionCohorts,
        metadata: req.body.metadata,
      });
      res.status(201).json(result);
    })
  );

  analyticsRouter.get(
    '/user-engagement',
    [
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const metrics = await getUserEngagementMetrics({
        from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
      });
      res.json({ data: metrics });
    })
  );

  analyticsRouter.post(
    '/repository-metrics',
    [
      body('repository').isString().trim().isLength({ min: 1 }),
      body('branch').optional().isString().trim(),
      body('windowStart').isISO8601(),
      body('windowEnd').isISO8601(),
      body('commitVelocity').isInt({ min: 0 }),
      body('refactorHotspots').isObject(),
      body('coverageDrift').isFloat(),
      body('metadata').optional().isObject(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const result = await recordRepositoryAnalytics({
        repository: req.body.repository,
        branch: req.body.branch,
        windowStart: new Date(req.body.windowStart),
        windowEnd: new Date(req.body.windowEnd),
        commitVelocity: Number(req.body.commitVelocity),
        refactorHotspots: req.body.refactorHotspots,
        coverageDrift: Number(req.body.coverageDrift),
        metadata: req.body.metadata,
      });
      res.status(201).json(result);
    })
  );

  analyticsRouter.get(
    '/repository-metrics',
    [
      query('repository').optional().isString().trim(),
      query('branch').optional().isString().trim(),
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const metrics = await getRepositoryAnalytics({
        repository: typeof req.query.repository === 'string' ? req.query.repository : undefined,
        branch: typeof req.query.branch === 'string' ? req.query.branch : undefined,
        from: typeof req.query.from === 'string' ? new Date(req.query.from) : undefined,
        to: typeof req.query.to === 'string' ? new Date(req.query.to) : undefined,
      });
      res.json({ data: metrics });
    })
  );

  analyticsRouter.post(
    '/anomalies',
    [
      body('source').isString().trim().isLength({ min: 1 }),
      body('severity').isString().trim().isLength({ min: 1 }),
      body('description').isString().trim().isLength({ min: 1 }),
      body('occurredAt').optional().isISO8601(),
      body('metadata').optional().isObject(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const result = await recordAnalyticsAnomaly({
        source: req.body.source,
        severity: req.body.severity,
        description: req.body.description,
        occurredAt: req.body.occurredAt ? new Date(req.body.occurredAt) : undefined,
        metadata: req.body.metadata,
      });
      res.status(201).json(result);
    })
  );

  analyticsRouter.get(
    '/anomalies',
    [
      query('source').optional().isString().trim(),
      query('severity').optional().isString().trim(),
      query('resolved').optional().isBoolean(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const anomalies = await listAnalyticsAnomalies({
        source: typeof req.query.source === 'string' ? req.query.source : undefined,
        severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
        resolved: typeof req.query.resolved === 'string' ? req.query.resolved === 'true' : undefined,
      });
      res.json({ data: anomalies });
    })
  );

  analyticsRouter.post(
    '/anomalies/:id/resolve',
    [],
    asyncHandler(async (req: Request, res: Response) => {
      const anomalyId = Number(req.params.id);
      if (Number.isNaN(anomalyId) || anomalyId < 1) {
        res.status(400).json({ error: 'Invalid anomaly id' });
        return;
      }
      const result = await resolveAnalyticsAnomaly(anomalyId);
      res.json(result);
    })
  );

  router.use('/analytics', analyticsRouter);
};

export default registerAnalyticsRoutes;
