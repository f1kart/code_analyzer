import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import http from 'http';
import crypto from 'crypto';
import compression from 'compression';
import expressPinoLogger from 'pino-http';
import config from './config';
import logger from './logger';
import { redis, disconnectRedis } from './redis';
import { ensurePrismaConnection } from './prisma';
import { createApiRouter } from './routes';
import { createCollaborationGateway } from './ws/collaborationGateway';
import { initializeObservability, shutdownObservability } from './observability/instrumentation';
import { initializeTracing, createTracingMiddleware } from './observability/tracing';
import { mapErrorToResponse } from './errors';
import {
  corsMiddleware,
  helmetMiddleware,
  requestId,
  securityHeaders,
  sanitizeInput,
  errorHandler,
  notFoundHandler,
} from './middleware/security';

const REQUEST_ID_HEADER = 'x-request-id';

declare module 'http' {
  interface IncomingHttpHeaders {
    [REQUEST_ID_HEADER]?: string | string[];
  }
}

const bootstrap = async () => {
  await initializeObservability();
  
  // Initialize OpenTelemetry tracing
  const _tracingSDK = initializeTracing();
  
  await ensurePrismaConnection();
  await redis.connect();

  const app = express();

  // Apply security middleware
  app.use(requestId);
  app.use(securityHeaders);
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(sanitizeInput);

  // Apply tracing middleware
  app.use(createTracingMiddleware());

  app.use(
    expressPinoLogger({
      logger,
      genReqId: (req) => {
        const header = req.headers[REQUEST_ID_HEADER];
        if (typeof header === 'string') {
          return header;
        }
        if (Array.isArray(header) && header.length > 0) {
          return header[0];
        }
        return crypto.randomUUID();
      },
    }),
  );
  app.use(config.apiPrefix, createApiRouter());

  // Error handling middleware (must be last)
  app.use(notFoundHandler);
  app.use(errorHandler);

// ... (other imports)

// ... (app setup)

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error({ err, url: req.originalUrl, requestId: req.requestId }, 'Unhandled backend error');
    const { status, body } = mapErrorToResponse(err);
    res.status(status).json(body);
  });

  const server = http.createServer(app);
  const io = createCollaborationGateway({ server, redis });

  server.listen(config.port, config.host, () => {
    logger.info({ port: config.port, host: config.host }, 'Backend server started');
  });

  let shuttingDown = false;
  const gracefulShutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'Graceful shutdown initiated');
    try {
      await new Promise<void>((resolve) => {
        io.close(() => {
          logger.info('Collaboration gateway closed');
          resolve();
        });
      });
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          logger.info('HTTP server closed');
          resolve();
        });
      });
      await disconnectRedis();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error({ error }, 'Error during graceful shutdown');
    } finally {
      await shutdownObservability();
      process.exit(0);
    }
  };

  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.on(signal as NodeJS.Signals, gracefulShutdown);
  });
};

bootstrap().catch((error) => {
  logger.error({ error }, 'Backend bootstrap failed');
  shutdownObservability().finally(() => {
    process.exit(1);
  });
});