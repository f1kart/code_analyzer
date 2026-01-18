import type { Request, Response } from 'express';
import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { parseISO, isValid } from 'date-fns';
import { getPrisma } from '../prisma.js';
import logger from '../logger.js';
import { asyncHandler, ensureValidRequest } from './utils.js';
import { NotFoundError } from '../errors.js';
import { sendTelemetryAlert } from '../alerting/alertService.ts';

const parseDate = (value?: string | null): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : undefined;
};

export const registerTelemetryRoutes = (router: Router): void => {
  const prisma = getPrisma();
  const telemetryRouter = Router({ mergeParams: true });

  telemetryRouter.get(
    '/',
    [
      query('projectId').optional().isString().trim().isLength({ min: 1 }),
      query('severity').optional().isString().trim().isLength({ min: 1 }),
      query('from').optional().isISO8601().withMessage('from must be an ISO 8601 date'),
      query('to').optional().isISO8601().withMessage('to must be an ISO 8601 date'),
      query('page').optional().isInt({ min: 1 }),
      query('pageSize').optional().isInt({ min: 1, max: 200 }),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);

      const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
      const severity = typeof req.query.severity === 'string' ? req.query.severity : undefined;
      const fromDate = parseDate(typeof req.query.from === 'string' ? req.query.from : undefined);
      const toDate = parseDate(typeof req.query.to === 'string' ? req.query.to : undefined);
      const page = Number(req.query.page ?? '1');
      const pageSize = Number(req.query.pageSize ?? '50');
      const skip = (page - 1) * pageSize;

      const where = {
        ...(projectId ? { project: { externalId: projectId } } : {}),
        ...(severity ? { severity } : {}),
        ...(fromDate || toDate
          ? {
              occurredAt: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      };

      const events = await prisma.telemetryEvent.findMany({
        where,
        include: { project: { select: { externalId: true, name: true } } },
        orderBy: { occurredAt: 'desc' },
        skip,
        take: pageSize,
      });

      const total = await prisma.telemetryEvent.count({ where });

      const data = events.map(({ id, project, eventType, severity, payload, correlationId, occurredAt }: (typeof events)[number]) => ({
        id,
        projectId: project?.externalId ?? null,
        projectName: project?.name ?? null,
        eventType,
        severity,
        payload,
        correlationId,
        occurredAt,
      }));

      res.json({
        data,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize) || 1,
        },
      });
    }),
  );

  telemetryRouter.get(
    '/:eventId',
    [param('eventId').isInt({ min: 1 }).withMessage('eventId must be a positive integer')],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const eventId = Number(req.params.eventId);

      const event = await prisma.telemetryEvent.findUnique({
        where: { id: eventId },
        include: { project: { select: { externalId: true, name: true } } },
      });

      if (!event) {
        throw new NotFoundError(`Telemetry event ${eventId} not found.`);
      }

      res.json({
        id: event.id,
        projectId: event.project?.externalId ?? null,
        projectName: event.project?.name ?? null,
        eventType: event.eventType,
        severity: event.severity,
        payload: event.payload,
        correlationId: event.correlationId,
        occurredAt: event.occurredAt,
        createdAt: event.createdAt,
      });
    }),
  );

  telemetryRouter.post(
    '/',
    [
      body('eventType').isString().trim().isLength({ min: 1 }).withMessage('eventType is required'),
      body('severity').optional().isString().trim().isLength({ min: 1 }),
      body('payload').isObject().withMessage('payload must be an object'),
      body('projectId').optional().isString().trim().isLength({ min: 1 }),
      body('correlationId').optional().isString().trim(),
      body('occurredAt').optional().isISO8601().withMessage('occurredAt must be ISO8601'),
    ],
    asyncHandler(async (req: Request, res: Response) => {
      ensureValidRequest(req);
      const { eventType, severity, payload, projectId, correlationId, occurredAt } = req.body as {
        eventType: string;
        severity?: string;
        payload: Record<string, unknown>;
        projectId?: string;
        correlationId?: string;
        occurredAt?: string;
      };

      let projectRecordId: number | undefined;
      let projectRecord: { id: number; name: string | null } | undefined;
      if (projectId) {
        const project = await prisma.project.findUnique({ where: { externalId: projectId } });
        if (!project) {
          throw new NotFoundError(`Project ${projectId} not found.`);
        }
        projectRecordId = project.id;
        projectRecord = { id: project.id, name: project.metadata?.name ?? project.name ?? null };
      }

      const created = await prisma.telemetryEvent.create({
        data: {
          eventType,
          severity: severity ?? 'info',
          payload,
          correlationId: correlationId?.trim() ?? null,
          occurredAt: occurredAt ? parseISO(occurredAt) : new Date(),
          projectId: projectRecordId,
        },
      });

      logger.info({ eventId: created.id, eventType }, '[Telemetry] Event recorded');

      try {
        await sendTelemetryAlert({
          eventType: created.eventType,
          severity: created.severity,
          occurredAt: created.occurredAt,
          projectId: projectId ?? null,
          projectName: projectRecord?.name ?? null,
          correlationId: created.correlationId,
          payload,
        });
      } catch (alertError) {
        logger.error({ alertError }, '[Telemetry] Failed to dispatch alert notification');
      }

      res.status(201).json({
        id: created.id,
        eventType: created.eventType,
        severity: created.severity,
        occurredAt: created.occurredAt,
        correlationId: created.correlationId,
      });
    }),
  );

  router.use('/telemetry', telemetryRouter);
};

export default registerTelemetryRoutes;
