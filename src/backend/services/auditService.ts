import { PrismaClient } from '@prisma/client';
import { Request } from 'express';
import { errorLogger } from '../../utils/errorLogger';

// Audit action types
export enum AuditAction {
  // Provider actions
  PROVIDER_CREATE = 'provider.create',
  PROVIDER_UPDATE = 'provider.update',
  PROVIDER_DELETE = 'provider.delete',
  PROVIDER_VIEW = 'provider.view',
  
  // Workflow actions
  WORKFLOW_CREATE = 'workflow.create',
  WORKFLOW_UPDATE = 'workflow.update',
  WORKFLOW_DELETE = 'workflow.delete',
  WORKFLOW_EXECUTE = 'workflow.execute',
  WORKFLOW_VIEW = 'workflow.view',
  
  // Agent mapping actions
  AGENT_MAP_CREATE = 'agent_map.create',
  AGENT_MAP_UPDATE = 'agent_map.update',
  AGENT_MAP_DELETE = 'agent_map.delete',
  AGENT_MAP_VIEW = 'agent_map.view',
  
  // User actions
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_CREATE = 'user.create',
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  
  // Settings actions
  SETTINGS_UPDATE = 'settings.update',
  SETTINGS_VIEW = 'settings.view',
  
  // System actions
  SYSTEM_BACKUP = 'system.backup',
  SYSTEM_RESTORE = 'system.restore',
  SYSTEM_MAINTENANCE = 'system.maintenance',
  
  // Security actions
  SECURITY_BREACH = 'security.breach',
  SECURITY_LOGIN_FAILED = 'security.login_failed',
  SECURITY_RATE_LIMIT = 'security.rate_limit',
  SECURITY_UNAUTHORIZED = 'security.unauthorized',
}

// Audit severity levels
export enum AuditSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

// Audit entry interface
export interface AuditEntry {
  id?: string;
  action: AuditAction;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
  timestamp: Date;
  success: boolean;
  errorMessage?: string;
}

// Audit service class
export class AuditService {
  private prisma: PrismaClient;
  private static instance: AuditService;

  constructor() {
    this.prisma = new PrismaClient();
  }

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  // Log an audit entry
  async logAudit(entry: AuditEntry): Promise<void> {
    try {
      // Create audit record in database
      const auditRecord = await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          severity: entry.severity,
          userId: entry.userId,
          sessionId: entry.sessionId,
          requestId: entry.requestId,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          oldValue: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
          newValue: entry.newValue ? JSON.stringify(entry.newValue) : null,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
          timestamp: entry.timestamp,
          success: entry.success,
          errorMessage: entry.errorMessage,
        },
      });

      // Log to structured logger for real-time monitoring
      errorLogger.logSystemError('Audit entry created', {
        auditId: auditRecord.id,
        action: entry.action,
        severity: entry.severity,
        userId: entry.userId,
        success: entry.success,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      });

      // Trigger real-time alerts for critical actions
      if (entry.severity === AuditSeverity.CRITICAL) {
        await this.triggerCriticalAlert(entry);
      }

    } catch (error) {
      errorLogger.logSystemError('Failed to log audit entry', {
        error,
        entry,
      });
      // Don't throw - audit logging failures shouldn't break the main flow
    }
  }

  // Create audit entry from request
  createAuditFromRequest(
    req: Request,
    action: AuditAction,
    resourceType?: string,
    resourceId?: string,
    oldValue?: any,
    newValue?: any,
    success = true,
    errorMessage?: string
  ): AuditEntry {
    return {
      action,
      severity: this.getSeverityForAction(action),
      userId: (req as any).userId,
      sessionId: (req as any).sessionId,
      requestId: (req as any).requestId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      resourceType,
      resourceId,
      oldValue,
      newValue,
      timestamp: new Date(),
      success,
      errorMessage,
    };
  }

  // Get severity level for action
  private getSeverityForAction(action: AuditAction): AuditSeverity {
    const criticalActions = [
      AuditAction.PROVIDER_DELETE,
      AuditAction.WORKFLOW_DELETE,
      AuditAction.USER_DELETE,
      AuditAction.SYSTEM_RESTORE,
      AuditAction.SECURITY_BREACH,
    ];

    const highActions = [
      AuditAction.PROVIDER_CREATE,
      AuditAction.PROVIDER_UPDATE,
      AuditAction.WORKFLOW_CREATE,
      AuditAction.WORKFLOW_UPDATE,
      AuditAction.WORKFLOW_EXECUTE,
      AuditAction.USER_CREATE,
      AuditAction.USER_UPDATE,
      AuditAction.SETTINGS_UPDATE,
      AuditAction.SYSTEM_BACKUP,
      AuditAction.SECURITY_UNAUTHORIZED,
    ];

    const mediumActions = [
      AuditAction.AGENT_MAP_CREATE,
      AuditAction.AGENT_MAP_UPDATE,
      AuditAction.AGENT_MAP_DELETE,
      AuditAction.SECURITY_RATE_LIMIT,
    ];

    if (criticalActions.includes(action)) {
      return AuditSeverity.CRITICAL;
    } else if (highActions.includes(action)) {
      return AuditSeverity.HIGH;
    } else if (mediumActions.includes(action)) {
      return AuditSeverity.MEDIUM;
    } else {
      return AuditSeverity.LOW;
    }
  }

  // Trigger critical alerts
  private async triggerCriticalAlert(entry: AuditEntry): Promise<void> {
    try {
      // Send alert to monitoring system
      const alertData = {
        type: 'critical_audit',
        action: entry.action,
        userId: entry.userId,
        ipAddress: entry.ipAddress,
        timestamp: entry.timestamp,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
      };

      // In production, this would send to:
      // - Slack/Teams webhook
      // - Email notification
      // - PagerDuty
      // - Custom monitoring system
      
      console.error('CRITICAL AUDIT ALERT:', JSON.stringify(alertData, null, 2));
      
      // Store alert for dashboard
      await this.prisma.alert.create({
        data: {
          type: 'critical_audit',
          message: `Critical action: ${entry.action}`,
          severity: 'critical',
          data: JSON.stringify(alertData),
          timestamp: new Date(),
          acknowledged: false,
        },
      });

    } catch (error) {
      errorLogger.logSystemError('Failed to trigger critical alert', {
        error,
        entry,
      });
    }
  }

  // Query audit logs
  async getAuditLogs(filters: {
    userId?: string;
    action?: AuditAction;
    severity?: AuditSeverity;
    resourceType?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: AuditEntry[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const where: any = {};

      if (filters.userId) where.userId = filters.userId;
      if (filters.action) where.action = filters.action;
      if (filters.severity) where.severity = filters.severity;
      if (filters.resourceType) where.resourceType = filters.resourceType;
      if (filters.resourceId) where.resourceId = filters.resourceId;
      
      if (filters.startDate || filters.endDate) {
        where.timestamp = {};
        if (filters.startDate) where.timestamp.gte = filters.startDate;
        if (filters.endDate) where.timestamp.lte = filters.endDate;
      }

      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
        }),
        this.prisma.auditLog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        logs: logs.map(log => ({
          id: log.id,
          action: log.action as AuditAction,
          severity: log.severity as AuditSeverity,
          userId: log.userId,
          sessionId: log.sessionId,
          requestId: log.requestId,
          ipAddress: log.ipAddress,
          userAgent: log.userAgent,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          oldValue: log.oldValue ? JSON.parse(log.oldValue) : undefined,
          newValue: log.newValue ? JSON.parse(log.newValue) : undefined,
          metadata: log.metadata ? JSON.parse(log.metadata) : undefined,
          timestamp: log.timestamp,
          success: log.success,
          errorMessage: log.errorMessage,
        })),
        total,
        page,
        totalPages,
      };

    } catch (error) {
      errorLogger.logSystemError('Failed to query audit logs', {
        error,
        filters,
      });
      throw error;
    }
  }

  // Get audit statistics
  async getAuditStats(timeRange: {
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalActions: number;
    actionsByType: Record<AuditAction, number>;
    actionsBySeverity: Record<AuditSeverity, number>;
    actionsByUser: Record<string, number>;
    failureRate: number;
    criticalActions: number;
  }> {
    try {
      const where = {
        timestamp: {
          gte: timeRange.startDate,
          lte: timeRange.endDate,
        },
      };

      const [
        totalActions,
        actionsByType,
        actionsBySeverity,
        actionsByUser,
        failedActions,
        criticalActions,
      ] = await Promise.all([
        this.prisma.auditLog.count({ where }),
        
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: true,
        }),
        
        this.prisma.auditLog.groupBy({
          by: ['severity'],
          where,
          _count: true,
        }),
        
        this.prisma.auditLog.groupBy({
          by: ['userId'],
          where,
          _count: true,
        }),
        
        this.prisma.auditLog.count({
          where: { ...where, success: false },
        }),
        
        this.prisma.auditLog.count({
          where: { ...where, severity: AuditSeverity.CRITICAL },
        }),
      ]);

      return {
        totalActions,
        actionsByType: actionsByType.reduce((acc, item) => {
          acc[item.action as AuditAction] = item._count;
          return acc;
        }, {} as Record<AuditAction, number>),
        actionsBySeverity: actionsBySeverity.reduce((acc, item) => {
          acc[item.severity as AuditSeverity] = item._count;
          return acc;
        }, {} as Record<AuditSeverity, number>),
        actionsByUser: actionsByUser.reduce((acc, item) => {
          if (item.userId) {
            acc[item.userId] = item._count;
          }
          return acc;
        }, {} as Record<string, number>),
        failureRate: totalActions > 0 ? (failedActions / totalActions) * 100 : 0,
        criticalActions,
      };

    } catch (error) {
      errorLogger.logSystemError('Failed to get audit statistics', {
        error,
        timeRange,
      });
      throw error;
    }
  }

  // Export audit logs
  async exportAuditLogs(filters: {
    startDate: Date;
    endDate: Date;
    format: 'json' | 'csv';
  }): Promise<string | Buffer> {
    try {
      const logs = await this.getAuditLogs({
        ...filters,
        page: 1,
        limit: 10000, // Large limit for export
      });

      if (filters.format === 'json') {
        return JSON.stringify(logs.logs, null, 2);
      } else if (filters.format === 'csv') {
        // Convert to CSV
        const headers = [
          'ID', 'Action', 'Severity', 'User ID', 'Timestamp', 'IP Address',
          'Resource Type', 'Resource ID', 'Success', 'Error Message'
        ];
        
        const rows = logs.logs.map(log => [
          log.id,
          log.action,
          log.severity,
          log.userId || '',
          log.timestamp.toISOString(),
          log.ipAddress || '',
          log.resourceType || '',
          log.resourceId || '',
          log.success,
          log.errorMessage || '',
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
      }

      throw new Error('Unsupported export format');

    } catch (error) {
      errorLogger.logSystemError('Failed to export audit logs', {
        error,
        filters,
      });
      throw error;
    }
  }

  // Cleanup old audit logs
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      errorLogger.logSystemError('Audit log cleanup completed', {
        deletedCount: result.count,
        retentionDays,
        cutoffDate,
      });

      return result.count;

    } catch (error) {
      errorLogger.logSystemError('Failed to cleanup audit logs', {
        error,
        retentionDays,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const auditService = AuditService.getInstance();

// Middleware for automatic audit logging
export const auditMiddleware = (action: AuditAction, resourceType?: string) => {
  return (req: Request, res: any, next: any) => {
    const startTime = Date.now();
    const originalSend = res.send;

    let auditEntry: AuditEntry;

    res.send = function(body: any) {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode < 400;
      
      // Create audit entry
      auditEntry = auditService.createAuditFromRequest(
        req,
        action,
        resourceType,
        req.params.id,
        undefined, // oldValue
        success ? body : undefined, // newValue
        success,
        success ? undefined : body?.error?.message
      );

      // Add response time to metadata
      auditEntry.metadata = {
        ...auditEntry.metadata,
        responseTime,
        statusCode: res.statusCode,
      };

      // Log audit entry asynchronously
      auditService.logAudit(auditEntry).catch(error => {
        console.error('Failed to log audit entry:', error);
      });

      return originalSend.call(this, body);
    };

    next();
  };
};
