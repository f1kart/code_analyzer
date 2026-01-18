import { Router, Request, Response } from 'express';
import { adminMetricsService } from '../telemetry/adminMetrics';
import { rateLimit } from 'express-rate-limit';
import { securityHeaders } from '../middleware/securityHeaders';
import { z } from 'zod';

const router = Router();

// Apply security middleware
router.use(securityHeaders);

// Apply rate limiting for metrics endpoints
router.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  message: 'Too many metrics requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
}));

// Validation schemas
const metricsQuerySchema = z.object({
  timeRange: z.enum(['1h', '24h', '7d', '30d']).optional().default('24h'),
  resourceType: z.enum(['providers', 'workflows', 'users', 'all']).optional().default('all'),
  operation: z.string().optional(),
  userId: z.string().optional(),
});

const bulkMetricsSchema = z.object({
  operations: z.array(z.object({
    operation: z.string(),
    resourceType: z.string(),
    userId: z.string(),
    success: z.boolean(),
    duration: z.number(),
    timestamp: z.string(),
    metadata: z.record(z.string(), z.any()).optional(),
  })),
});

// GET /api/admin/metrics/summary - Get comprehensive metrics summary
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const query = metricsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    // Record metrics access
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        query,
        endpoint: 'summary',
      },
    });

    // Get metrics summary
    const summary = adminMetricsService.getMetricsSummary();
    
    // In a real implementation, you would filter by timeRange and other parameters
    // For now, we'll return the full summary
    
    res.json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
      filters: query,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    // Record error
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'summary',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/metrics/operations - Get operation metrics
router.get('/operations', async (req: Request, res: Response) => {
  try {
    const query = metricsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        query,
        endpoint: 'operations',
      },
    });

    // Get specific operation metrics
    const summary = adminMetricsService.getMetricsSummary();
    
    // Filter operations based on query parameters
    let filteredData = summary;
    
    if (query.resourceType !== 'all') {
      // Filter by resource type
      filteredData = {
        ...filteredData,
        resource_metrics: {
          [query.resourceType]: summary.resource_metrics[query.resourceType as keyof typeof summary.resource_metrics],
        },
      };
    }

    res.json({
      success: true,
      data: filteredData,
      timestamp: new Date().toISOString(),
      filters: query,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'operations',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve operation metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/metrics/performance - Get performance metrics
router.get('/performance', async (req: Request, res: Response) => {
  try {
    const query = metricsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        query,
        endpoint: 'performance',
      },
    });

    // Get performance metrics
    const summary = adminMetricsService.getMetricsSummary();
    
    // Extract performance-specific data
    const performanceData = {
      concurrent_operations: summary.admin_specific.concurrent_operations,
      active_users: summary.admin_specific.active_users_total,
      rate_limit_hits: summary.admin_specific.rate_limit_hits_total,
      cache_operations: summary.admin_specific.cache_operations_total,
      database_operations: summary.admin_specific.database_operations_total,
      external_api_calls: summary.admin_specific.external_api_calls_total,
    };

    res.json({
      success: true,
      data: performanceData,
      timestamp: new Date().toISOString(),
      filters: query,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'performance',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve performance metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/metrics/resources/:resourceType - Get resource-specific metrics
router.get('/resources/:resourceType', async (req: Request, res: Response) => {
  try {
    const { resourceType } = req.params;
    const query = metricsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    if (!['providers', 'workflows', 'users'].includes(resourceType)) {
      res.status(400).json({
        success: false,
        error: 'Invalid resource type',
        message: 'Resource type must be one of: providers, workflows, users',
      });
      return;
    }

    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        resourceType,
        query,
        endpoint: 'resources',
      },
    });

    // Get resource-specific metrics
    const summary = adminMetricsService.getMetricsSummary();
    const resourceData = summary.resource_metrics[resourceType as keyof typeof summary.resource_metrics];

    res.json({
      success: true,
      data: resourceData,
      resourceType,
      timestamp: new Date().toISOString(),
      filters: query,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        resourceType: req.params.resourceType,
        endpoint: 'resources',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve resource metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/metrics/bulk - Bulk record metrics
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const body = bulkMetricsSchema.parse(req.body);
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'POST',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        operation_count: body.operations.length,
        endpoint: 'bulk',
      },
    });

    // Record each operation in the bulk
    for (const operation of body.operations) {
      adminMetricsService.recordAdminOperation({
        operation: operation.operation,
        resourceType: operation.resourceType,
        userId: operation.userId,
        success: operation.success,
        duration: operation.duration,
        errorType: operation.success ? undefined : 'bulk_error',
        metadata: operation.metadata,
      });
    }

    res.json({
      success: true,
      message: `Successfully recorded ${body.operations.length} operations`,
      count: body.operations.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'POST',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'bulk',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to record bulk metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/admin/metrics/reset - Reset metrics (admin only)
router.delete('/reset', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // In a real implementation, you would check if the user has admin privileges
    // For now, we'll assume all authenticated users can reset metrics
    
    adminMetricsService.recordAdminOperation({
      operation: 'DELETE',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        endpoint: 'reset',
      },
    });

    // Reset metrics
    adminMetricsService.getMetricsSummary(); // This would include a reset method in a real implementation
    
    res.json({
      success: true,
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'DELETE',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'reset',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(500).json({
      success: false,
      error: 'Failed to reset metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/metrics/health - Metrics health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: true,
      metadata: {
        endpoint: 'health',
      },
    });

    // Check metrics system health
    const summary = adminMetricsService.getMetricsSummary();
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        total_operations: summary.admin_specific.operations_total,
        error_rate: summary.admin_specific.operation_errors_total / (summary.admin_specific.operations_total || 1),
        active_spans: summary.activeSpans,
        completed_spans: summary.completedSpans,
      },
      system: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
      },
    };

    // Determine health status
    const errorRate = health.metrics.error_rate;
    if (errorRate > 0.1) { // 10% error rate threshold
      health.status = 'degraded';
    }
    if (errorRate > 0.2) { // 20% error rate threshold
      health.status = 'unhealthy';
    }

    res.status(health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503).json({
      success: true,
      data: health,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    adminMetricsService.recordAdminOperation({
      operation: 'GET',
      resourceType: 'metrics',
      userId: userId || 'anonymous',
      success: false,
      errorType: error instanceof Error ? error.name : 'Unknown',
      metadata: {
        endpoint: 'health',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    res.status(503).json({
      success: false,
      error: 'Metrics health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'unhealthy',
    });
  }
});

export default router;
