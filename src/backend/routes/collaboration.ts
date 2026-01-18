import { Router } from 'express';
import { body, param } from 'express-validator';
import { randomUUID } from 'crypto';
import type { PrismaClient, Prisma } from '@prisma/client';
import { getPrisma } from '../prisma.js';
import logger from '../logger.js';
import { asyncHandler, ensureValidRequest } from './utils.js';
import { NotFoundError, ConflictError } from '../errors.js';

type SessionWithRelations = Prisma.CollaborationSessionGetPayload<{
  include: {
    participants: true;
    project: { select: { externalId: true; name: true } };
  };
}>;

type SessionParticipant = SessionWithRelations['participants'][number];

const resolveSessionById = async (sessionId: string): Promise<SessionWithRelations> => {
  const prisma = getPrisma();
  const session = await prisma.collaborationSession.findUnique({
    where: { sessionId },
    include: {
      participants: true,
      project: { select: { externalId: true, name: true } },
    },
  });

  if (!session) {
    throw new NotFoundError(`Collaboration session ${sessionId} not found.`);
  }

  return session;
};

export const registerCollaborationRoutes = (router: Router): void => {
  const prisma = getPrisma() as PrismaClient;
  const collabRouter = Router({ mergeParams: true });

  collabRouter.post(
    '/sessions',
    [
      body('projectId').isString().trim().isLength({ min: 1 }).withMessage('projectId is required'),
      body('ownerId').isString().trim().isLength({ min: 1 }).withMessage('ownerId is required'),
      body('ownerName').isString().trim().isLength({ min: 1 }).withMessage('ownerName is required'),
      body('ownerEmail').optional().isEmail().withMessage('ownerEmail must be a valid email'),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { projectId, ownerId, ownerName, ownerEmail } = req.body as {
        projectId: string;
        ownerId: string;
        ownerName: string;
        ownerEmail?: string;
      };

      const project = await prisma.project.findUnique({ where: { externalId: projectId } });
      if (!project) {
        throw new NotFoundError(`Project ${projectId} not found.`);
      }

      const session = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const createdSession = await tx.collaborationSession.create({
          data: {
            sessionId: randomUUID(),
            projectId: project.id,
            ownerId,
            status: 'active',
            participants: {
              create: {
                userId: ownerId,
                name: ownerName,
                email: ownerEmail?.trim() ?? null,
                role: 'owner',
              },
            },
          },
          include: { participants: true },
        });

        return createdSession;
      });

      logger.info({ sessionId: session.sessionId, projectId }, '[Collaboration] Session created');

      res.status(201).json({
        sessionId: session.sessionId,
        projectId,
        ownerId: session.ownerId,
        status: session.status,
        participants: session.participants.map((participant) => ({
          userId: participant.userId,
          name: participant.name,
          email: participant.email,
          role: participant.role,
          joinedAt: participant.joinedAt,
        })),
        createdAt: session.createdAt,
      });
    })
  );

  collabRouter.post(
    '/sessions/:sessionId/join',
    [
      param('sessionId').isString().trim().isLength({ min: 1 }),
      body('userId').isString().trim().isLength({ min: 1 }).withMessage('userId is required'),
      body('name').isString().trim().isLength({ min: 1 }).withMessage('name is required'),
      body('email').optional().isEmail(),
      body('role').optional().isString().trim().isLength({ min: 1 }),
    ],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { sessionId } = req.params;
      const { userId, name, email, role } = req.body as {
        userId: string;
        name: string;
        email?: string;
        role?: string;
      };

      const session = await resolveSessionById(sessionId);

      if (session.status !== 'active') {
        throw new ConflictError(`Session ${sessionId} is not active.`);
      }

      const existing = session.participants.find((participant: SessionParticipant) => participant.userId === userId);
      if (existing) {
        res.json({
          sessionId: session.sessionId,
          projectId: session.project.externalId,
          userId: existing.userId,
          name: existing.name,
          role: existing.role,
          joinedAt: existing.joinedAt,
        });
        return;
      }

      const participant = await prisma.collaborationParticipant.create({
        data: {
          sessionId: session.id,
          userId,
          name,
          email: email?.trim() ?? null,
          role: role?.trim() ?? 'editor',
        },
      });

      logger.info({ sessionId, userId }, '[Collaboration] Participant joined');

      res.status(201).json({
        sessionId: session.sessionId,
        projectId: session.project.externalId,
        userId: participant.userId,
        name: participant.name,
        role: participant.role,
        joinedAt: participant.joinedAt,
      });
    })
  );

  collabRouter.post(
    '/sessions/:sessionId/heartbeat',
    [param('sessionId').isString().trim().isLength({ min: 1 }), body('userId').isString().trim().isLength({ min: 1 })],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { sessionId } = req.params;
      const { userId } = req.body as { userId: string };

      const session = await resolveSessionById(sessionId);
      const participant = session.participants.find((item: SessionParticipant) => item.userId === userId);

      if (!participant) {
        throw new NotFoundError(`User ${userId} is not part of session ${sessionId}.`);
      }

      await prisma.collaborationParticipant.update({
        where: { id: participant.id },
        data: { lastSeenAt: new Date() },
      });

      res.json({ status: 'ok' });
    })
  );

  collabRouter.post(
    '/sessions/:sessionId/leave',
    [param('sessionId').isString().trim().isLength({ min: 1 }), body('userId').isString().trim().isLength({ min: 1 })],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { sessionId } = req.params;
      const { userId } = req.body as { userId: string };

      const session = await resolveSessionById(sessionId);
      const participant = session.participants.find((item: SessionParticipant) => item.userId === userId);

      if (!participant) {
        throw new NotFoundError(`User ${userId} is not part of session ${sessionId}.`);
      }

      await prisma.collaborationParticipant.delete({ where: { id: participant.id } });
      logger.info({ sessionId, userId }, '[Collaboration] Participant left');

      res.json({ status: 'left' });
    })
  );

  collabRouter.delete(
    '/sessions/:sessionId',
    [param('sessionId').isString().trim().isLength({ min: 1 })],
    asyncHandler(async (req, res) => {
      ensureValidRequest(req);
      const { sessionId } = req.params;

      const session = await resolveSessionById(sessionId);

      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.collaborationParticipant.deleteMany({ where: { sessionId: session.id } });
        await tx.collaborationSession.delete({ where: { id: session.id } });
      });

      logger.info({ sessionId }, '[Collaboration] Session terminated');
      res.status(204).send();
    })
  );

  router.use('/collaboration', collabRouter);
};

export default registerCollaborationRoutes;
