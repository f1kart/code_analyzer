import { Router, Request, Response } from 'express';
import { 
  logger, 
  securityLogger, 
  performanceLogger, 
  auditLogger,
  structuredLoggingMiddleware,
  errorLoggingMiddleware,
  LogLevel 
} from '../telemetry/structuredLogger';
import { securityHeaders } from '../middleware/securityHeaders';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

// Apply security middleware
router.use(securityHeaders);

// Apply rate limiting for logging endpoints
router.use(rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute
  message: 'Too many logging requests',
  standardHeaders: true,
  legacyHeaders: false,
}));

// Apply structured logging middleware to capture request logs
router.use(structuredLoggingMiddleware(logger));

// Validation schemas
const logsQuerySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated tags
  correlationId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),   // ISO date string
});

const logEntrySchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  message: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
  tags: z.array(z.string()).optional(),
  correlationId: z.string().optional(),
  userId: z.string().optional(),
});

const bulkLogsSchema = z.object({
  logs: z.array(logEntrySchema),
});

// GET /api/admin/logs - Get logs with filtering and pagination
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const query = logsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    // Get recent logs
    let logs = logger.getRecentLogs(query.limit + query.offset);
    
    // Apply filters
    if (query.level) {
      logs = logs.filter(log => log.level === query.level);
    }
    
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        log.service.toLowerCase().includes(searchTerm) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(searchTerm)) ||
        (log.userId && log.userId.toLowerCase().includes(searchTerm))
      );
    }
    
    if (query.tags) {
      const searchTags = query.tags.split(',').map(tag => tag.trim());
      logs = logs.filter(log => 
        searchTags.some(tag => log.tags?.includes(tag))
      );
    }
    
    if (query.correlationId) {
      logs = logs.filter(log => log.correlationId === query.correlationId);
    }
    
    if (query.userId) {
      logs = logs.filter(log => log.userId === query.userId);
    }
    
    if (query.startDate) {
      const startDate = new Date(query.startDate);
      logs = logs.filter(log => new Date(log.timestamp) >= startDate);
    }
    
    if (query.endDate) {
      const endDate = new Date(query.endDate);
      logs = logs.filter(log => new Date(log.timestamp) <= endDate);
    }
    
    // Apply pagination
    const paginatedLogs = logs.slice(query.offset, query.offset + query.limit);
    
    // Log the access
    logger.info('Logs accessed', {
      userId,
      query,
      resultCount: paginatedLogs.length,
      totalAvailable: logs.length,
    });

    res.json({
      success: true,
      data: paginatedLogs,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: logs.length,
        hasMore: query.offset + query.limit < logs.length,
      },
      filters: query,
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to retrieve logs', error instanceof Error ? error : new Error(String(error)), {
      userId,
      query: req.query,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/logs/statistics - Get logging statistics
router.get('/logs/statistics', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // Get statistics from all loggers
    const mainStats = logger.getStatistics();
    const securityStats = securityLogger.getStatistics();
    const performanceStats = performanceLogger.getStatistics();
    const auditStats = auditLogger.getStatistics();
    
    // Combine statistics
    const combinedStats = {
      main: mainStats,
      security: securityStats,
      performance: performanceStats,
      audit: auditStats,
      total: {
        total: mainStats.total + securityStats.total + performanceStats.total + auditStats.total,
        byLevel: {
          debug: (mainStats.byLevel.debug || 0) + (securityStats.byLevel.debug || 0) + (performanceStats.byLevel.debug || 0) + (auditStats.byLevel.debug || 0),
          info: (mainStats.byLevel.info || 0) + (securityStats.byLevel.info || 0) + (performanceStats.byLevel.info || 0) + (auditStats.byLevel.info || 0),
          warn: (mainStats.byLevel.warn || 0) + (securityStats.byLevel.warn || 0) + (performanceStats.byLevel.warn || 0) + (auditStats.byLevel.warn || 0),
          error: (mainStats.byLevel.error || 0) + (securityStats.byLevel.error || 0) + (performanceStats.byLevel.error || 0) + (auditStats.byLevel.error || 0),
          fatal: (mainStats.byLevel.fatal || 0) + (securityStats.byLevel.fatal || 0) + (performanceStats.byLevel.fatal || 0) + (auditStats.byLevel.fatal || 0),
        },
        recentErrors: [
          ...mainStats.recentErrors,
          ...securityStats.recentErrors,
          ...performanceStats.recentErrors,
          ...auditStats.recentErrors,
        ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 20),
      },
    };

    // Log the access
    logger.info('Statistics accessed', { userId });

    res.json({
      success: true,
      data: combinedStats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to retrieve statistics', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/logs/level/:level - Get logs by level
router.get('/logs/level/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const query = logsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    // Validate level
    if (!Object.values(LogLevel).includes(level as LogLevel)) {
      res.status(400).json({
        success: false,
        error: 'Invalid log level',
        message: `Level must be one of: ${Object.values(LogLevel).join(', ')}`,
      });
      return;
    }

    // Get logs by level
    const logs = logger.getLogsByLevel(level as LogLevel);
    
    // Apply additional filters
    let filteredLogs = logs;
    
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(searchTerm))
      );
    }
    
    if (query.tags) {
      const searchTags = query.tags.split(',').map(tag => tag.trim());
      filteredLogs = filteredLogs.filter(log => 
        searchTags.some(tag => log.tags?.includes(tag))
      );
    }
    
    // Apply pagination
    const paginatedLogs = filteredLogs.slice(query.offset, query.offset + query.limit);

    // Log the access
    logger.info('Logs accessed by level', {
      userId,
      level,
      resultCount: paginatedLogs.length,
      totalAvailable: filteredLogs.length,
    });

    res.json({
      success: true,
      data: paginatedLogs,
      level,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: filteredLogs.length,
        hasMore: query.offset + query.limit < filteredLogs.length,
      },
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to retrieve logs by level', error instanceof Error ? error : new Error(String(error)), {
      userId,
      level: req.params.level,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs by level',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/logs/tag/:tag - Get logs by tag
router.get('/logs/tag/:tag', async (req: Request, res: Response) => {
  try {
    const { tag } = req.params;
    const query = logsQuerySchema.parse(req.query);
    const userId = (req as any).userId;
    
    // Get logs by tag
    const logs = logger.getLogsByTag(tag);
    
    // Apply additional filters
    let filteredLogs = logs;
    
    if (query.level) {
      filteredLogs = filteredLogs.filter(log => log.level === query.level);
    }
    
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchTerm) ||
        (log.correlationId && log.correlationId.toLowerCase().includes(searchTerm))
      );
    }
    
    // Apply pagination
    const paginatedLogs = filteredLogs.slice(query.offset, query.offset + query.limit);

    // Log the access
    logger.info('Logs accessed by tag', {
      userId,
      tag,
      resultCount: paginatedLogs.length,
      totalAvailable: filteredLogs.length,
    });

    res.json({
      success: true,
      data: paginatedLogs,
      tag,
      pagination: {
        limit: query.limit,
        offset: query.offset,
        total: filteredLogs.length,
        hasMore: query.offset + query.limit < filteredLogs.length,
      },
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to retrieve logs by tag', error instanceof Error ? error : new Error(String(error)), {
      userId,
      tag: req.params.tag,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve logs by tag',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/logs - Create a new log entry
router.post('/logs', async (req: Request, res: Response) => {
  try {
    const body = logEntrySchema.parse(req.body);
    const userId = (req as any).userId || body.userId;
    
    // Create log entry
    switch (body.level) {
      case LogLevel.DEBUG:
        logger.debug(body.message, {
          ...body.metadata,
          userId,
          correlationId: body.correlationId,
          tags: body.tags,
        });
        break;
      case LogLevel.INFO:
        logger.info(body.message, {
          ...body.metadata,
          userId,
          correlationId: body.correlationId,
          tags: body.tags,
        });
        break;
      case LogLevel.WARN:
        logger.warn(body.message, {
          ...body.metadata,
          userId,
          correlationId: body.correlationId,
          tags: body.tags,
        });
        break;
      case LogLevel.ERROR:
        logger.error(body.message, undefined, {
          ...body.metadata,
          userId,
          correlationId: body.correlationId,
          tags: body.tags,
        });
        break;
      case LogLevel.FATAL:
        logger.fatal(body.message, undefined, {
          ...body.metadata,
          userId,
          correlationId: body.correlationId,
          tags: body.tags,
        });
        break;
    }

    // Log the creation
    logger.info('Log entry created', {
      userId,
      logLevel: body.level,
      logMessage: body.message,
      tags: body.tags,
    });

    res.json({
      success: true,
      message: 'Log entry created successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to create log entry', error instanceof Error ? error : new Error(String(error)), {
      userId,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create log entry',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/admin/logs/bulk - Create multiple log entries
router.post('/logs/bulk', async (req: Request, res: Response) => {
  try {
    const body = bulkLogsSchema.parse(req.body);
    const userId = (req as any).userId;
    
    // Create log entries
    for (const logEntry of body.logs) {
      const entryUserId = logEntry.userId || userId;
      
      switch (logEntry.level) {
        case LogLevel.DEBUG:
          logger.debug(logEntry.message, {
            ...logEntry.metadata,
            userId: entryUserId,
            correlationId: logEntry.correlationId,
            tags: logEntry.tags,
          });
          break;
        case LogLevel.INFO:
          logger.info(logEntry.message, {
            ...logEntry.metadata,
            userId: entryUserId,
            correlationId: logEntry.correlationId,
            tags: logEntry.tags,
          });
          break;
        case LogLevel.WARN:
          logger.warn(logEntry.message, {
            ...logEntry.metadata,
            userId: entryUserId,
            correlationId: logEntry.correlationId,
            tags: logEntry.tags,
          });
          break;
        case LogLevel.ERROR:
          logger.error(logEntry.message, undefined, {
            ...logEntry.metadata,
            userId: entryUserId,
            correlationId: logEntry.correlationId,
            tags: logEntry.tags,
          });
          break;
        case LogLevel.FATAL:
          logger.fatal(logEntry.message, undefined, {
            ...logEntry.metadata,
            userId: entryUserId,
            correlationId: logEntry.correlationId,
            tags: logEntry.tags,
          });
          break;
      }
    }

    // Log the bulk creation
    logger.info('Bulk log entries created', {
      userId,
      count: body.logs.length,
      levels: body.logs.map(log => log.level),
    });

    res.json({
      success: true,
      message: `Successfully created ${body.logs.length} log entries`,
      count: body.logs.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to create bulk log entries', error instanceof Error ? error : new Error(String(error)), {
      userId,
      body: req.body,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to create bulk log entries',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/admin/logs - Clear log buffer (admin only)
router.delete('/logs', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    
    // In a real implementation, you would check if the user has admin privileges
    // For now, we'll assume all authenticated users can clear logs
    
    // Clear all log buffers
    logger.clearLogs();
    securityLogger.clearLogs();
    performanceLogger.clearLogs();
    auditLogger.clearLogs();

    // Log the clearing
    logger.info('Log buffers cleared', { userId });

    res.json({
      success: true,
      message: 'Log buffers cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to clear log buffers', error instanceof Error ? error : new Error(String(error)), {
      userId,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to clear log buffers',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/admin/logs/export - Export logs in various formats
router.get('/logs/export', async (req: Request, res: Response) => {
  try {
    const query = logsQuerySchema.parse(req.query);
    const format = req.query.format as string || 'json';
    const userId = (req as any).userId;
    
    // Get logs
    let logs = logger.getRecentLogs(query.limit || 1000);
    
    // Apply filters
    if (query.level) {
      logs = logs.filter(log => log.level === query.level);
    }
    
    if (query.search) {
      const searchTerm = query.search.toLowerCase();
      logs = logs.filter(log => 
        log.message.toLowerCase().includes(searchTerm)
      );
    }
    
    // Log the export
    logger.info('Logs exported', {
      userId,
      format,
      count: logs.length,
      query,
    });

    // Export in different formats
    switch (format.toLowerCase()) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="logs.json"');
        res.json(logs);
        break;
        
      case 'csv': {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="logs.csv"');
        
        // CSV header
        const csvHeader = 'Timestamp,Level,Message,Service,User,Correlation ID,Tags\n';
        const csvRows = logs.map(log => 
          `"${log.timestamp}","${log.level}","${log.message}","${log.service}","${log.userId || ''}","${log.correlationId || ''}","${(log.tags || []).join(';')}"`
        ).join('\n');
        
        res.send(csvHeader + csvRows);
        break;
      }
        
      case 'txt': {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', 'attachment; filename="logs.txt"');
        
        const textLogs = logs.map(log => 
          `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message} (${log.service})`
        ).join('\n');
        
        res.send(textLogs);
        break;
      }
        
      default:
        res.status(400).json({
          success: false,
          error: 'Invalid export format',
          message: 'Format must be one of: json, csv, txt',
        });
    }
  } catch (error) {
    const userId = (req as any).userId;
    
    logger.error('Failed to export logs', error instanceof Error ? error : new Error(String(error)), {
      userId,
      format: req.query.format,
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export logs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Apply error logging middleware
router.use(errorLoggingMiddleware(logger));

export default router;
