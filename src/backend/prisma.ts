import { PrismaClient } from '@prisma/client';
import logger from './logger';
import config from './config';

class PrismaService {
  private static instance: PrismaClient;

  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log:
          config.env === 'production'
            ? ['warn', 'error']
            : ['query', 'info', 'warn', 'error'],
        errorFormat: 'pretty',
      });
    }
    return PrismaService.instance;
  }

  public static async connect(): Promise<void> {
    const client = this.getInstance();
    try {
      await client.$connect();
      await client.$queryRaw`SELECT 1`;
      logger.info('[Prisma] Database connection established');
    } catch (error) {
      logger.error({ error }, '[Prisma] Failed to connect to database');
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
      // @ts-ignore
      PrismaService.instance = null;
    }
  }
}

// Export a shared Prisma client instance for simple imports
export const prisma = PrismaService.getInstance();

// Backwards-compatible helper for older code paths that expect a getPrisma() function
export function getPrisma(): PrismaClient {
  return PrismaService.getInstance();
}

export const ensurePrismaConnection = PrismaService.connect;
export const disconnectPrisma = PrismaService.disconnect;
