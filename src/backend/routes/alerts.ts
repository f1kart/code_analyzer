import type { Request, Response } from 'express';
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '../prisma.js';
import logger from '../logger.js';
import { asyncHandler, ensureValidRequest } from './utils.js';
import { NotFoundError } from '../errors.js';

const parseBoolean = (value?: string | string[]): boolean | undefined => {
  if (value === undefined) return undefined;
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === undefined) return undefined;
  const truthy = ['1', 'true', 'yes', 'on'];
  const falsy = ['0', 'false', 'no', 'off'];
  if (truthy.includes(normalized.toLowerCase())) return true;
  if (falsy.includes(normalized.toLowerCase())) return false;
  return undefined;
};

const mapAlertResponse = (alert: {
  id: number;
  project?: { externalId: string | null; name: string | null } | null;
  channel: string;
  target: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: alert.id,
  projectId: alert.project?.externalId ?? null,
  projectName: alert.project?.name ?? null,
  channel: alert.channel,
  target: alert.target,
  enabled: alert.enabled,
  createdAt: alert.createdAt,
  updatedAt: alert.updatedAt,
});

const resolveProjectId = async (prisma: PrismaClient, externalId?: string): Promise<number | null> => {
  if (!externalId) return null;
  const project = await prisma.project.findUnique({ where: { externalId } });
  if (!project) {
    throw new NotFoundError(`Project ${externalId} not found.`);
  }
  return project.id;
};

const resolveAlertById = async (prisma: PrismaClient, alertId: number) => {
  const alert = await prisma.alertSubscription.findUnique({
    where: { id: alertId },
    include: { project: { select: { externalId: true, name: true } } },
  });

  if (!alert) {
    throw new NotFoundError(`Alert subscription ${alertId} not found.`);
  }

  return alert;
};

export const registerAlertRoutes = (router: Router): void => {
  const prisma = getPrisma() as PrismaClient;
  const alertsRouter = Router({ mergeParams: true });

  alertsRouter.get(
    '/',
    [
      query('projectId').optional().isString().trim().isLength({ min: 1 }),
      query('channel').optional().isString().trim().isLength({ min: 1 }),
      query('enabled').optional().isString().trim().isLength({ min: 1 }),
      query('page').optional().isInt({ min: 1 }),
      query('pageSize').optional().isInt({ min: 1, max: 200 }),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);

      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const channel = typeof req.query.channel === 'string' ? req.query.channel : undefined;
      const enabled = parseBoolean(req.query.enabled as string | undefined);
      const page = Number(req.query.page ?? '1');
      const pageSize = Number(req.query.pageSize ?? '50');
      const skip = (page - 1) * pageSize;

      const where = {
        ...(projectId ? { project: { externalId: projectId } } : {}),
        ...(channel ? { channel } : {}),
        ...(enabled !== undefined ? { enabled } : {}),
      };

      const [alerts, total] = await Promise.all([
        prisma.alertSubscription.findMany({
          where,
          include: { project: { select: { externalId: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: pageSize,
        }),
        prisma.alertSubscription.count({ where }),
      ]);

      res.json({
        data: alerts.map(mapAlertResponse),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      });
    }),
  );

  alertsRouter.post(
    '/',
    [
      body('channel').isString().trim().isLength({ min: 1 }).withMessage('channel is required'),
      body('target').isString().trim().isLength({ min: 1 }).withMessage('target is required'),
      body('projectId').optional().isString().trim().isLength({ min: 1 }),
      body('enabled').optional().isBoolean(),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const { channel, target, projectId, enabled } = req.body as {
        channel: string;
        target: string;
        projectId?: string;
        enabled?: boolean;
      };

      const projectRecordId = await resolveProjectId(prisma, projectId);

      const created = await prisma.alertSubscription.create({
        data: {
          channel,
          target,
          enabled: enabled ?? true,
          projectId: projectRecordId,
        },
        include: { project: { select: { externalId: true, name: true } } },
      });

      logger.info({ alertId: created.id, channel }, '[Alerts] Subscription created');
      res.status(201).json(mapAlertResponse(created));
    }),
  );

  alertsRouter.put(
    '/:alertId',
    [
      param('alertId').isInt({ min: 1 }).withMessage('alertId must be a positive integer'),
      body('channel').optional().isString().trim().isLength({ min: 1 }),
      body('target').optional().isString().trim().isLength({ min: 1 }),
      body('enabled').optional().isBoolean(),
      body('projectId').optional().isString().trim().isLength({ min: 1 }),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const alertId = Number(req.params.alertId);
      const { channel, target, enabled, projectId } = req.body as {
        channel?: string;
        target?: string;
        enabled?: boolean;
        projectId?: string;
      };

      const existing = await resolveAlertById(prisma, alertId);
      const projectRecordId = projectId !== undefined ? await resolveProjectId(prisma, projectId) : existing.projectId ?? null;

      const updated = await prisma.alertSubscription.update({
        where: { id: alertId },
        data: {
          channel: channel ?? existing.channel,
          target: target ?? existing.target,
          enabled: enabled ?? existing.enabled,
          projectId: projectRecordId,
        },
        include: { project: { select: { externalId: true, name: true } } },
      });

      logger.info({ alertId: updated.id }, '[Alerts] Subscription updated');
      res.json(mapAlertResponse(updated));
    }),
  );

  alertsRouter.delete(
    '/:alertId',
    [param('alertId').isInt({ min: 1 }).withMessage('alertId must be a positive integer')],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const alertId = Number(req.params.alertId);

      await resolveAlertById(prisma, alertId);
      await prisma.alertSubscription.delete({ where: { id: alertId } });

      logger.info({ alertId }, '[Alerts] Subscription deleted');
      res.status(204).send();
    }),
  );

  router.use('/alerts', alertsRouter);
};

export default registerAlertRoutes;
