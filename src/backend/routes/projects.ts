import { Router } from 'express';
import { body, param, query } from 'express-validator';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import logger from '../logger';
import { asyncHandler, ensureValidRequest, protectRoute } from './utils';
import { NotFoundError } from '../errors';
import { validationMessages } from './constants';

const parsePagination = (pageValue: unknown, pageSizeValue: unknown) => {
  const page = Math.max(1, Number(Array.isArray(pageValue) ? pageValue[0] : pageValue ?? '1'));
  const pageSize = Math.min(100, Math.max(1, Number(Array.isArray(pageSizeValue) ? pageSizeValue[0] : pageSizeValue ?? '20')));
  return { page, pageSize };
};

const resolveProjectByExternalId = async (externalId: string) => {
  const project = await prisma.project.findUnique({
    where: { externalId },
    include: {
      states: { select: { id: true } },
      sessions: { select: { id: true, status: true } },
      alerts: { select: { id: true, enabled: true } },
    },
  });

  if (!project) {
    throw new NotFoundError(`Project with id ${externalId} not found.`);
  }

  return project;
};

export const registerProjectRoutes = (router: Router): void => {
  const projectsRouter = Router({ mergeParams: true });

  projectsRouter.get(
    '/',
    [
      query('page').optional().isInt({ min: 1 }).withMessage(validationMessages.page),
      query('pageSize').optional().isInt({ min: 1, max: 100 }).withMessage(validationMessages.pageSize),
      query('search').optional().isString().trim().isLength({ min: 1 }).withMessage(validationMessages.search),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);

      const { page, pageSize } = parsePagination(req.query.page, req.query.pageSize);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
      const skip = (page - 1) * pageSize;

      const where: Prisma.ProjectWhereInput | undefined = search
        ? {
            OR: [
              {
                name: {
                  contains: search,
                  // Case-insensitive search on the project name
                  mode: 'insensitive',
                },
              },
              {
                // JSON path search against metadata.description
                metadata: {
                  path: ['description'],
                  string_contains: search,
                },
              },
            ],
          }
        : undefined;

      const [items, total] = await Promise.all([
        prisma.project.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take: pageSize,
          include: {
            states: { select: { id: true }, take: 1, orderBy: { createdAt: 'desc' } },
            sessions: { select: { sessionId: true, status: true }, where: { status: 'active' } },
          },
        }),
        prisma.project.count({ where }),
      ]);

      res.json({
        data: items.map((item) => ({
          id: item.externalId,
          name: item.name,
          rootPath: item.rootPath,
          metadata: item.metadata,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          activeSessions: item.sessions.length,
          latestStateId: item.states[0]?.id ?? null,
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      });
    })
  );

  projectsRouter.post(
    '/',
    [
      protectRoute,
      body('name').isString().trim().isLength({ min: 1 }).withMessage(validationMessages.name),
      body('rootPath').optional().isString().trim(),
      body('metadata').optional().isObject().withMessage(validationMessages.metadata),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);

      const { name, rootPath, metadata } = req.body as {
        name: string;
        rootPath?: string;
        metadata?: Prisma.InputJsonValue;
      };

      const project = await prisma.project.create({
        data: {
          name,
          rootPath: rootPath?.trim() ?? null,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      logger.info({ projectId: project.externalId }, '[Projects] Created project');

      res.status(201).json({
        id: project.externalId,
        name: project.name,
        rootPath: project.rootPath,
        metadata: project.metadata,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      });
    })
  );

  projectsRouter.get(
    '/:projectId',
    [param('projectId').isString().trim().isLength({ min: 1 }).withMessage(validationMessages.projectId)],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId } = req.params;
      const project = await resolveProjectByExternalId(projectId);

      res.json({
        id: project.externalId,
        name: project.name,
        rootPath: project.rootPath,
        metadata: project.metadata,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        activeSessions: project.sessions.filter((session) => session.status === 'active').length,
        alertSubscriptions: project.alerts.filter((alert) => alert.enabled).length,
      });
    })
  );

  projectsRouter.put(
    '/:projectId',
    [
      protectRoute,
      param('projectId').isString().trim().isLength({ min: 1 }).withMessage(validationMessages.projectId),
      body('name').optional().isString().trim().isLength({ min: 1 }).withMessage(validationMessages.name),
      body('rootPath').optional().isString().trim(),
      body('metadata').optional().isObject().withMessage(validationMessages.metadata),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId } = req.params;
      const { name, rootPath, metadata } = req.body as {
        name?: string;
        rootPath?: string;
        metadata?: Prisma.InputJsonValue;
      };

      await resolveProjectByExternalId(projectId);

      const updated = await prisma.project.update({
        where: { externalId: projectId },
        data: {
          name: name?.trim(),
          rootPath: rootPath?.trim(),
          metadata,
        },
      });

      res.json({
        id: updated.externalId,
        name: updated.name,
        rootPath: updated.rootPath,
        metadata: updated.metadata,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    })
  );

  projectsRouter.delete(
    '/:projectId',
    [protectRoute, param('projectId').isString().trim().isLength({ min: 1 }).withMessage(validationMessages.projectId)],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId } = req.params;

      await resolveProjectByExternalId(projectId);
      await prisma.project.delete({ where: { externalId: projectId } });

      logger.info({ projectId }, '[Projects] Deleted project');
      res.status(204).send();
    })
  );

  projectsRouter.get(
    '/:projectId/states',
    [
      param('projectId').isString().trim().isLength({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage(validationMessages.limit),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId } = req.params;
      const limit = Number(req.query.limit ?? '20');

      await resolveProjectByExternalId(projectId);

      const states = await prisma.projectState.findMany({
        where: { project: { externalId: projectId } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      res.json({
        data: states.map((state) => ({
          id: state.id,
          projectId,
          userId: state.userId,
          version: state.version,
          snapshot: state.snapshot,
          createdAt: state.createdAt,
        })),
      });
    })
  );

  projectsRouter.post(
    '/:projectId/states',
    [
      protectRoute,
      param('projectId').isString().trim().isLength({ min: 1 }),
      body('userId').isString().trim().isLength({ min: 1 }).withMessage(validationMessages.userId),
      body('snapshot').isObject().withMessage(validationMessages.snapshot),
      body('version').optional().isInt({ min: 1 }).withMessage(validationMessages.version),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId } = req.params;
      const { userId, snapshot, version } = req.body as {
        userId: string;
        snapshot: Prisma.InputJsonValue;
        version?: number;
      };

      const project = await resolveProjectByExternalId(projectId);

      const created = await prisma.projectState.create({
        data: {
          projectId: project.id,
          userId,
          snapshot,
          version: version ?? 1,
        },
      });

      res.status(201).json({
        id: created.id,
        projectId,
        userId: created.userId,
        version: created.version,
        snapshot: created.snapshot,
        createdAt: created.createdAt,
      });
    })
  );

  router.use('/projects', projectsRouter);
};

export default registerProjectRoutes;