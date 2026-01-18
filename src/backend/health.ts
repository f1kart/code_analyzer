import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { redis } from './redis';
import { checkTracingHealth } from './observability/tracing';
import { checkMetricsHealth } from './observability/metrics';
import config from './config';

const prisma = new PrismaClient();

// Health check response interface
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    tracing: ServiceHealth;
    metrics: ServiceHealth;
  };
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: NodeJS.CpuUsage;
    platform: string;
    nodeVersion: string;
  };
}

interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  error?: string;
  details?: any;
}

// Check database health
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        url: config.database.url?.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@'),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

// Check Redis health
async function checkRedisHealth(): Promise<ServiceHealth> {
  const startTime = Date.now();
  
  try {
    await redis.ping();
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        connected: redis.status === 'ready',
        host: config.redis.host,
        port: config.redis.port,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: (error as Error).message,
    };
  }
}

// Check tracing health
function checkTracingServiceHealth(): ServiceHealth {
  try {
    const tracingHealth = checkTracingHealth();
    
    return {
      status: tracingHealth.enabled ? 'healthy' : 'degraded',
      details: tracingHealth,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }
}

// Check metrics health
function checkMetricsServiceHealth(): ServiceHealth {
  try {
    const metricsHealth = checkMetricsHealth();
    
    return {
      status: metricsHealth.enabled ? 'healthy' : 'degraded',
      details: metricsHealth,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: (error as Error).message,
    };
  }
}

// Get system information
function getSystemInfo() {
  return {
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    platform: process.platform,
    nodeVersion: process.version,
  };
}

// Basic health check endpoint
export const healthCheck = async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    // Check all services
    const [database, redis, tracing, metrics] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
      Promise.resolve(checkTracingServiceHealth()),
      Promise.resolve(checkMetricsServiceHealth()),
    ]);

    // Determine overall health status
    const services = { database, redis, tracing, metrics };
    const unhealthyServices = Object.values(services).filter(s => s.status === 'unhealthy');
    const degradedServices = Object.values(services).filter(s => s.status === 'degraded');

    let overallStatus: 'healthy' | 'unhealthy' | 'degraded';
    if (unhealthyServices.length > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const healthCheckResponse: HealthCheckResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services,
      system: getSystemInfo(),
    };

    const responseTime = Date.now() - startTime;
    
    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      ...healthCheckResponse,
      meta: {
        responseTime,
        requestId: req.requestId,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: (error as Error).message,
      requestId: req.requestId,
    });
  }
};

// Readiness check endpoint (more comprehensive)
export const readinessCheck = async (req: Request, res: Response) => {
  try {
    const checks = {
      database: await checkDatabaseHealth(),
      redis: await checkRedisHealth(),
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
    
    if (allHealthy) {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks,
        requestId: req.requestId,
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        checks,
        requestId: req.requestId,
      });
    }
  } catch (error) {
    console.error('Readiness check failed:', error);
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      message: (error as Error).message,
      requestId: req.requestId,
    });
  }
};

// Liveness check endpoint (basic process check)
export const livenessCheck = async (req: Request, res: Response) => {
  try {
    // Basic process liveness check
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Check if process has been running for at least 5 seconds
    if (uptime < 5) {
      return res.status(503).json({
        status: 'starting',
        timestamp: new Date().toISOString(),
        uptime,
        message: 'Application is still starting',
        requestId: req.requestId,
      });
    }

    // Check for excessive memory usage (>1GB)
    const memoryLimit = 1024 * 1024 * 1024; // 1GB
    if (memoryUsage.heapUsed > memoryLimit) {
      return res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime,
        memoryUsage,
        message: 'Memory usage too high',
        requestId: req.requestId,
      });
    }

    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime,
      memoryUsage,
      requestId: req.requestId,
    });
  } catch (error) {
    console.error('Liveness check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
      message: (error as Error).message,
      requestId: req.requestId,
    });
  }
};

// Detailed health check with metrics
export const detailedHealthCheck = async (req: Request, res: Response) => {
  try {
    // Get basic health
    await healthCheck(req, res);
    
    // Add additional metrics if requested
    if (req.query.includeMetrics === 'true') {
      const metrics = {
        process: {
          pid: process.pid,
          ppid: process.ppid,
          title: process.title,
          execPath: process.execPath,
          execArgv: process.execArgv,
          argv: process.argv,
        },
        memory: {
          rss: process.memoryUsage().rss,
          heapTotal: process.memoryUsage().heapTotal,
          heapUsed: process.memoryUsage().heapUsed,
          external: process.memoryUsage().external,
          arrayBuffers: process.memoryUsage().arrayBuffers,
        },
        cpu: {
          user: process.cpuUsage().user,
          system: process.cpuUsage().system,
        },
        uptime: {
          total: process.uptime(),
          hrtime: process.hrtime(),
        },
      };

      // Add metrics to response if it hasn't been sent yet
      if (!res.headersSent) {
        res.json({
          ...res.locals.healthData,
          metrics,
        });
      }
    }
  } catch (error) {
    console.error('Detailed health check failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed',
        message: (error as Error).message,
        requestId: req.requestId,
      });
    }
  }
};

export default {
  healthCheck,
  readinessCheck,
  livenessCheck,
  detailedHealthCheck,
};
