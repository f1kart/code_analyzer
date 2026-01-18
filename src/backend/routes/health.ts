import { Router, Request, Response } from 'express';
import { adminMetricsService } from '../telemetry/adminMetrics';
import { tracingService } from '../telemetry/tracing';
import { securityHeaders } from '../middleware/securityHeaders';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Apply security middleware
router.use(securityHeaders);

// Apply rate limiting for health endpoints
router.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many health check requests',
  standardHeaders: true,
  legacyHeaders: false,
}));

// Health check response interface
interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    cpu: HealthCheck;
    disk: HealthCheck;
    metrics: HealthCheck;
    tracing: HealthCheck;
  };
  summary: {
    total_checks: number;
    passed_checks: number;
    failed_checks: number;
  };
}

interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  message?: string;
  details?: any;
  duration_ms?: number;
  timestamp: string;
}

// GET /health - Basic health check
router.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Basic health check without detailed dependencies
    const health: Omit<HealthResponse, 'checks' | 'summary'> = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Record health check access
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: true,
      duration: (Date.now() - startTime) / 1000,
      metadata: {
        endpoint: 'health',
        user_agent: req.headers['user-agent'],
        ip: req.ip,
      },
    });

    res.json(health);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: false,
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'health',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /health/ready - Readiness probe (checks if service is ready to handle traffic)
router.get('/health/ready', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const checks = await runReadinessChecks();
    const summary = calculateSummary(checks);
    const overallStatus = determineOverallStatus(summary);

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    // Record readiness check access
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: overallStatus !== 'unhealthy',
      duration: (Date.now() - startTime) / 1000,
      metadata: {
        endpoint: 'ready',
        overall_status: overallStatus,
        failed_checks: summary.failed_checks,
      },
    });

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthResponse);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: false,
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'ready',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Readiness check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /health/live - Liveness probe (checks if service is still running)
router.get('/health/live', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Basic liveness check - just verify the process is running
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    // Check if process has been running for at least 10 seconds
    const isLive = uptime > 10;
    
    const health = {
      status: isLive ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime,
      memory: {
        rss: memoryUsage.rss,
        heap_used: memoryUsage.heapUsed,
        heap_total: memoryUsage.heapTotal,
        external: memoryUsage.external,
      },
      pid: process.pid,
    };

    // Record liveness check access
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: isLive,
      duration: (Date.now() - startTime) / 1000,
      metadata: {
        endpoint: 'live',
        uptime,
        is_live: isLive,
      },
    });

    res.status(isLive ? 200 : 503).json(health);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: false,
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'live',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Liveness check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /health/detailed - Comprehensive health check with all dependencies
router.get('/health/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const checks = await runDetailedHealthChecks();
    const summary = calculateSummary(checks);
    const overallStatus = determineOverallStatus(summary);

    const healthResponse: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    // Record detailed health check access
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: overallStatus !== 'unhealthy',
      duration: (Date.now() - startTime) / 1000,
      metadata: {
        endpoint: 'detailed',
        overall_status: overallStatus,
        failed_checks: summary.failed_checks,
        total_checks: summary.total_checks,
      },
    });

    // Set appropriate status code
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    res.status(statusCode).json(healthResponse);
  } catch (error) {
    const duration = (Date.now() - startTime) / 1000;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'health',
      userId: 'system',
      success: false,
      duration,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'detailed',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Detailed health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper functions for health checks

async function runReadinessChecks(): Promise<HealthResponse['checks']> {
  const checks: HealthResponse['checks'] = {
    database: await checkDatabase(),
    memory: checkMemory(),
    cpu: checkCPU(),
    disk: await checkDisk(),
    metrics: checkMetrics(),
    tracing: checkTracing(),
  };
  return checks;
}

async function runDetailedHealthChecks(): Promise<HealthResponse['checks']> {
  const checks: HealthResponse['checks'] = {
    database: await checkDatabase(true),
    memory: checkMemory(true),
    cpu: checkCPU(true),
    disk: await checkDisk(true),
    metrics: checkMetrics(true),
    tracing: checkTracing(true),
  };
  return checks;
}

async function checkDatabase(detailed: boolean = false): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // In a real implementation, you would check database connectivity
    // For now, we'll simulate a database check
    await new Promise(resolve => setTimeout(resolve, detailed ? 100 : 50));
    
    // Simulate occasional database issues
    const random = Math.random();
    if (random < 0.05) { // 5% chance of failure
      throw new Error('Database connection failed');
    } else if (random < 0.15) { // 10% chance of warning
      return {
        status: 'warn',
        message: 'Database connection slow',
        details: {
          connection_time: Date.now() - startTime,
          pool_size: 10,
          active_connections: 8,
        },
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      status: 'pass',
      message: 'Database connection healthy',
      details: detailed ? {
        connection_time: Date.now() - startTime,
        pool_size: 10,
        active_connections: 3,
        max_connections: 20,
      } : undefined,
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

function checkMemory(detailed: boolean = false): HealthCheck {
  const startTime = Date.now();
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message = 'Memory usage normal';

  if (memoryUsagePercent > 90) {
    status = 'fail';
    message = 'Memory usage critical';
  } else if (memoryUsagePercent > 75) {
    status = 'warn';
    message = 'Memory usage high';
  }

  return {
    status,
    message,
    details: detailed ? {
      rss: memoryUsage.rss,
      heap_used: usedMemory,
      heap_total: totalMemory,
      external: memoryUsage.external,
      usage_percent: memoryUsagePercent,
    } : {
      usage_percent: memoryUsagePercent,
    },
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

function checkCPU(detailed: boolean = false): HealthCheck {
  const startTime = Date.now();
  const cpuUsage = process.cpuUsage();
  
  // Simulate CPU check (in a real implementation, you'd use system CPU metrics)
  const cpuLoad = Math.random() * 100; // Simulated CPU load
  
  let status: 'pass' | 'warn' | 'fail' = 'pass';
  let message = 'CPU usage normal';

  if (cpuLoad > 90) {
    status = 'fail';
    message = 'CPU usage critical';
  } else if (cpuLoad > 75) {
    status = 'warn';
    message = 'CPU usage high';
  }

  return {
    status,
    message,
    details: detailed ? {
      user_cpu_time: cpuUsage.user,
      system_cpu_time: cpuUsage.system,
      simulated_load: cpuLoad,
    } : {
      cpu_load_percent: cpuLoad,
    },
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

async function checkDisk(detailed: boolean = false): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Simulate disk check (in a real implementation, you'd check actual disk usage)
    await new Promise(resolve => setTimeout(resolve, detailed ? 50 : 25));
    
    // Simulate disk usage
    const diskUsage = Math.random() * 100; // Simulated disk usage
    
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    let message = 'Disk usage normal';

    if (diskUsage > 95) {
      status = 'fail';
      message = 'Disk usage critical';
    } else if (diskUsage > 80) {
      status = 'warn';
      message = 'Disk usage high';
    }

    return {
      status,
      message,
      details: detailed ? {
        total_space: 1000000000, // 1GB simulated
        used_space: 1000000000 * (diskUsage / 100),
        free_space: 1000000000 * ((100 - diskUsage) / 100),
        usage_percent: diskUsage,
      } : {
        disk_usage_percent: diskUsage,
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Disk check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

function checkMetrics(detailed: boolean = false): HealthCheck {
  const startTime = Date.now();
  
  try {
    // Check if metrics service is working
    const metricsData = adminMetricsService.getMetricsSummary();
    const activeSpans = tracingService.getMetrics().activeSpans;
    
    const isHealthy = metricsData && typeof metricsData.counters === 'object';
    
    return {
      status: isHealthy ? 'pass' : 'fail',
      message: isHealthy ? 'Metrics service healthy' : 'Metrics service unhealthy',
      details: detailed ? {
        counters_count: metricsData.counters?.size || 0,
        histograms_count: metricsData.histograms?.size || 0,
        active_spans: activeSpans,
        completed_spans: metricsData.completedSpans || 0,
      } : {
        active_spans: activeSpans,
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Metrics service check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

function checkTracing(detailed: boolean = false): HealthCheck {
  const startTime = Date.now();
  
  try {
    // Check if tracing service is working
    const metricsData = tracingService.getMetrics();
    
    const isHealthy = metricsData && typeof metricsData.counters === 'object';
    
    return {
      status: isHealthy ? 'pass' : 'fail',
      message: isHealthy ? 'Tracing service healthy' : 'Tracing service unhealthy',
      details: detailed ? {
        counters_count: metricsData.counters?.size || 0,
        histograms_count: metricsData.histograms?.size || 0,
        active_spans: metricsData.activeSpans,
        completed_spans: metricsData.completedSpans,
      } : {
        active_spans: metricsData.activeSpans,
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Tracing service check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      duration_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };
  }
}

function calculateSummary(checks: HealthResponse['checks']): HealthResponse['summary'] {
  const totalChecks = Object.keys(checks).length;
  const passedChecks = Object.values(checks).filter(check => check.status === 'pass').length;
  const failedChecks = Object.values(checks).filter(check => check.status === 'fail').length;

  return {
    total_checks: totalChecks,
    passed_checks: passedChecks,
    failed_checks: failedChecks,
  };
}

function determineOverallStatus(summary: HealthResponse['summary']): 'healthy' | 'degraded' | 'unhealthy' {
  if (summary.failed_checks > 0) {
    return 'unhealthy';
  } else if (summary.passed_checks < summary.total_checks) {
    return 'degraded';
  }
  return 'healthy';
}

export default router;
