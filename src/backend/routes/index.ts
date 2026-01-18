import { Router, Request, Response } from 'express';
import { registerAdminRoutes } from './admin';
import { healthCheck, readinessCheck, livenessCheck } from '../health';

export const createApiRouter = (): Router => {
  const router = Router({ mergeParams: true });

  // Health check endpoints
  router.get('/health', async (req: Request, res: Response) => healthCheck(req, res));
  router.get('/health/ready', async (req: Request, res: Response) => readinessCheck(req, res));
  router.get('/health/live', async (req: Request, res: Response) => livenessCheck(req, res));

  registerAdminRoutes(router);

  return router;
};

export default createApiRouter;
