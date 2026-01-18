import { tracingService } from './tracing';
import { Request, Response, NextFunction } from 'express';

// Admin-specific metrics configuration
interface AdminMetricsConfig {
  operation: string;
  resourceType: string;
  userId?: string;
  success?: boolean;
  duration?: number;
  errorType?: string;
  metadata?: Record<string, any>;
}

// Enhanced admin metrics service
export class AdminMetricsService {
  public metrics = tracingService;

  // Admin operation counters
  private adminOperationsTotal = this.metrics.createCustomCounter(
    'admin_operations_total',
    'Total number of admin operations'
  );

  private adminOperationDuration = this.metrics.createCustomHistogram(
    'admin_operation_duration_seconds',
    'Duration of admin operations in seconds',
    'seconds'
  );

  private adminOperationErrors = this.metrics.createCustomCounter(
    'admin_operation_errors_total',
    'Total number of admin operation errors'
  );

  private adminActiveUsers = this.metrics.createCustomCounter(
    'admin_active_users_total',
    'Total number of active admin users'
  );

  private adminResourceOperations = this.metrics.createCustomCounter(
    'admin_resource_operations_total',
    'Total number of admin resource operations'
  );

  private adminBulkOperations = this.metrics.createCustomCounter(
    'admin_bulk_operations_total',
    'Total number of admin bulk operations'
  );

  private adminValidationErrors = this.metrics.createCustomCounter(
    'admin_validation_errors_total',
    'Total number of admin validation errors'
  );

  private adminAuthorizationErrors = this.metrics.createCustomCounter(
    'admin_authorization_errors_total',
    'Total number of admin authorization errors'
  );

  private adminRateLimitHits = this.metrics.createCustomCounter(
    'admin_rate_limit_hits_total',
    'Total number of admin rate limit hits'
  );

  private adminConcurrentOperations = this.metrics.createCustomCounter(
    'admin_concurrent_operations',
    'Number of concurrent admin operations'
  );

  private adminCacheOperations = this.metrics.createCustomCounter(
    'admin_cache_operations_total',
    'Total number of admin cache operations'
  );

  private adminDatabaseOperations = this.metrics.createCustomCounter(
    'admin_database_operations_total',
    'Total number of admin database operations'
  );

  private adminExternalApiCalls = this.metrics.createCustomCounter(
    'admin_external_api_calls_total',
    'Total number of admin external API calls'
  );

  private adminFileOperations = this.metrics.createCustomCounter(
    'admin_file_operations_total',
    'Total number of admin file operations'
  );

  private adminSessionOperations = this.metrics.createCustomCounter(
    'admin_session_operations_total',
    'Total number of admin session operations'
  );

  private adminConfigurationChanges = this.metrics.createCustomCounter(
    'admin_configuration_changes_total',
    'Total number of admin configuration changes'
  );

  // Resource-specific metrics
  private providerMetrics = {
    created: this.metrics.createCustomCounter(
      'admin_providers_created_total',
      'Total number of providers created'
    ),
    updated: this.metrics.createCustomCounter(
      'admin_providers_updated_total',
      'Total number of providers updated'
    ),
    deleted: this.metrics.createCustomCounter(
      'admin_providers_deleted_total',
      'Total number of providers deleted'
    ),
    tested: this.metrics.createCustomCounter(
      'admin_providers_tested_total',
      'Total number of providers tested'
    ),
    errors: this.metrics.createCustomCounter(
      'admin_providers_errors_total',
      'Total number of provider operation errors'
    ),
  };

  private workflowMetrics = {
    created: this.metrics.createCustomCounter(
      'admin_workflows_created_total',
      'Total number of workflows created'
    ),
    updated: this.metrics.createCustomCounter(
      'admin_workflows_updated_total',
      'Total number of workflows updated'
    ),
    deleted: this.metrics.createCustomCounter(
      'admin_workflows_deleted_total',
      'Total number of workflows deleted'
    ),
    executed: this.metrics.createCustomCounter(
      'admin_workflows_executed_total',
      'Total number of workflows executed'
    ),
    errors: this.metrics.createCustomCounter(
      'admin_workflows_errors_total',
      'Total number of workflow operation errors'
    ),
  };

  private userMetrics = {
    created: this.metrics.createCustomCounter(
      'admin_users_created_total',
      'Total number of users created'
    ),
    updated: this.metrics.createCustomCounter(
      'admin_users_updated_total',
      'Total number of users updated'
    ),
    deleted: this.metrics.createCustomCounter(
      'admin_users_deleted_total',
      'Total number of users deleted'
    ),
    loginAttempts: this.metrics.createCustomCounter(
      'admin_user_login_attempts_total',
      'Total number of user login attempts'
    ),
    loginFailures: this.metrics.createCustomCounter(
      'admin_user_login_failures_total',
      'Total number of user login failures'
    ),
  };

  // Record admin operation
  recordAdminOperation(config: AdminMetricsConfig): void {
    const labels = {
      operation: config.operation,
      resource_type: config.resourceType,
      user_id: config.userId || 'anonymous',
      success: config.success?.toString() || 'unknown',
      error_type: config.errorType || 'none',
    };

    // Increment total operations
    this.adminOperationsTotal.add(1, labels);

    // Record duration if provided
    if (config.duration !== undefined) {
      this.adminOperationDuration.record(config.duration, labels);
    }

    // Record errors if operation failed
    if (!config.success) {
      this.adminOperationErrors.add(1, labels);
    }

    // Record resource-specific operations
    this.adminResourceOperations.add(1, labels);

    // Add span event for detailed tracking
    this.metrics.addSpanEvent('admin.operation.completed', {
      ...labels,
      timestamp: Date.now(),
      ...config.metadata,
    });
  }

  // Record user activity
  recordUserActivity(userId: string, action: string, metadata?: Record<string, any>): void {
    this.adminActiveUsers.add(1, {
      user_id: userId,
      action,
    });

    this.metrics.addSpanEvent('admin.user.activity', {
      user_id: userId,
      action,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  // Record bulk operation
  recordBulkOperation(
    operation: string,
    resourceType: string,
    itemCount: number,
    userId: string,
    success: boolean,
    duration?: number
  ): void {
    const labels = {
      operation,
      resource_type: resourceType,
      user_id: userId,
      success: success.toString(),
    };

    this.adminBulkOperations.add(1, labels);

    if (duration !== undefined) {
      this.adminOperationDuration.record(duration, {
        ...labels,
        item_count: itemCount.toString(),
      });
    }

    this.metrics.addSpanEvent('admin.bulk.operation', {
      operation,
      resource_type: resourceType,
      item_count: itemCount,
      user_id: userId,
      success,
      duration,
      timestamp: Date.now(),
    });
  }

  // Record validation error
  recordValidationError(
    field: string,
    errorType: string,
    resourceType: string,
    userId?: string
  ): void {
    this.adminValidationErrors.add(1, {
      field,
      error_type: errorType,
      resource_type: resourceType,
      user_id: userId || 'anonymous',
    });

    this.metrics.addSpanEvent('admin.validation.error', {
      field,
      error_type: errorType,
      resource_type: resourceType,
      user_id: userId || 'anonymous',
      timestamp: Date.now(),
    });
  }

  // Record authorization error
  recordAuthorizationError(
    operation: string,
    resourceType: string,
    userId: string,
    reason: string
  ): void {
    this.adminAuthorizationErrors.add(1, {
      operation,
      resource_type: resourceType,
      user_id: userId,
      reason,
    });

    this.metrics.addSpanEvent('admin.authorization.error', {
      operation,
      resource_type: resourceType,
      user_id: userId,
      reason,
      timestamp: Date.now(),
    });
  }

  // Record rate limit hit
  recordRateLimitHit(
    userId: string,
    operation: string,
    limit: number,
    windowMs: number
  ): void {
    this.adminRateLimitHits.add(1, {
      user_id: userId,
      operation,
      limit: limit.toString(),
      window_ms: windowMs.toString(),
    });

    this.metrics.addSpanEvent('admin.rate.limit.hit', {
      user_id: userId,
      operation,
      limit,
      window_ms: windowMs,
      timestamp: Date.now(),
    });
  }

  // Record concurrent operation start/end
  incrementConcurrentOperations(operation: string): void {
    this.adminConcurrentOperations.add(1, { operation });
  }

  decrementConcurrentOperations(operation: string): void {
    this.adminConcurrentOperations.add(-1, { operation });
  }

  // Record cache operation
  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    key: string,
    resourceType?: string
  ): void {
    this.adminCacheOperations.add(1, {
      operation,
      key,
      resource_type: resourceType || 'unknown',
    });
  }

  // Record database operation
  recordDatabaseOperation(
    operation: string,
    table: string,
    duration: number,
    success: boolean
  ): void {
    this.adminDatabaseOperations.add(1, {
      operation,
      table,
      success: success.toString(),
    });

    this.metrics.createCustomHistogram('admin_db_operation_duration', 'Database operation duration').record(duration, {
      operation,
      table,
      success: success.toString(),
    });
  }

  // Record external API call
  recordExternalApiCall(
    service: string,
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number
  ): void {
    this.adminExternalApiCalls.add(1, {
      service,
      endpoint,
      method,
      status_code: statusCode.toString(),
    });

    this.metrics.createCustomHistogram('admin_external_api_duration', 'External API call duration').record(duration, {
      service,
      endpoint,
      method,
      status_code: statusCode.toString(),
    });
  }

  // Record file operation
  recordFileOperation(
    operation: 'read' | 'write' | 'delete' | 'upload',
    fileType: string,
    fileSize?: number,
    success: boolean = true
  ): void {
    this.adminFileOperations.add(1, {
      operation,
      file_type: fileType,
      success: success.toString(),
    });

    if (fileSize !== undefined) {
      this.metrics.createCustomHistogram('admin_file_operation_size', 'File operation size').record(fileSize, {
        operation,
        file_type: fileType,
        success: success.toString(),
      });
    }
  }

  // Record session operation
  recordSessionOperation(
    operation: 'create' | 'validate' | 'refresh' | 'invalidate',
    userId: string,
    success: boolean,
    duration?: number
  ): void {
    this.adminSessionOperations.add(1, {
      operation,
      user_id: userId,
      success: success.toString(),
    });

    if (duration !== undefined) {
      this.metrics.createCustomHistogram('admin_session_operation_duration', 'Session operation duration').record(duration, {
        operation,
        user_id: userId,
        success: success.toString(),
      });
    }
  }

  // Record configuration change
  recordConfigurationChange(
    configType: string,
    key: string,
    oldValue?: string,
    newValue?: string,
    userId?: string
  ): void {
    this.adminConfigurationChanges.add(1, {
      config_type: configType,
      key,
      user_id: userId || 'system',
    });

    this.metrics.addSpanEvent('admin.configuration.changed', {
      config_type: configType,
      key,
      old_value: oldValue,
      new_value: newValue,
      user_id: userId || 'system',
      timestamp: Date.now(),
    });
  }

  // Provider-specific metrics
  recordProviderOperation(
    operation: 'created' | 'updated' | 'deleted' | 'tested',
    providerId: string,
    providerType: string,
    userId: string,
    success: boolean = true,
    duration?: number
  ): void {
    const metric = this.providerMetrics[operation];
    metric.add(1, {
      provider_type: providerType,
      user_id: userId,
      success: success.toString(),
    });

    if (!success) {
      this.providerMetrics.errors.add(1, {
        provider_type: providerType,
        user_id: userId,
        operation,
      });
    }

    if (duration !== undefined) {
      this.metrics.createCustomHistogram('admin_provider_operation_duration', 'Provider operation duration').record(duration, {
        operation,
        provider_type: providerType,
        user_id: userId,
        success: success.toString(),
      });
    }

    this.metrics.addSpanEvent('admin.provider.operation', {
      operation,
      provider_id: providerId,
      provider_type: providerType,
      user_id: userId,
      success,
      duration,
      timestamp: Date.now(),
    });
  }

  // Workflow-specific metrics
  recordWorkflowOperation(
    operation: 'created' | 'updated' | 'deleted' | 'executed',
    workflowId: string,
    workflowType: string,
    userId: string,
    success: boolean = true,
    duration?: number
  ): void {
    const metric = this.workflowMetrics[operation];
    metric.add(1, {
      workflow_type: workflowType,
      user_id: userId,
      success: success.toString(),
    });

    if (!success) {
      this.workflowMetrics.errors.add(1, {
        workflow_type: workflowType,
        user_id: userId,
        operation,
      });
    }

    if (duration !== undefined) {
      this.metrics.createCustomHistogram('admin_workflow_operation_duration', 'Workflow operation duration').record(duration, {
        operation,
        workflow_type: workflowType,
        user_id: userId,
        success: success.toString(),
      });
    }

    this.metrics.addSpanEvent('admin.workflow.operation', {
      operation,
      workflow_id: workflowId,
      workflow_type: workflowType,
      user_id: userId,
      success,
      duration,
      timestamp: Date.now(),
    });
  }

  // User management metrics
  recordUserOperation(
    operation: 'created' | 'updated' | 'deleted' | 'login_attempt' | 'login_failure',
    userId: string,
    adminUserId: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): void {
    if (operation === 'login_attempt') {
      this.userMetrics.loginAttempts.add(1, { user_id: userId });
    } else if (operation === 'login_failure') {
      this.userMetrics.loginFailures.add(1, { user_id: userId });
    } else {
      const metric = this.userMetrics[operation];
      metric.add(1, {
        admin_user_id: adminUserId,
        success: success.toString(),
      });
    }

    this.metrics.addSpanEvent('admin.user.operation', {
      operation,
      user_id: userId,
      admin_user_id: adminUserId,
      success,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  // Get comprehensive metrics summary
  getMetricsSummary(): any {
    return {
      ...this.metrics.getMetrics(),
      admin_specific: {
        operations_total: this.adminOperationsTotal,
        operation_errors_total: this.adminOperationErrors,
        active_users_total: this.adminActiveUsers,
        bulk_operations_total: this.adminBulkOperations,
        validation_errors_total: this.adminValidationErrors,
        authorization_errors_total: this.adminAuthorizationErrors,
        rate_limit_hits_total: this.adminRateLimitHits,
        concurrent_operations: this.adminConcurrentOperations,
      },
      resource_metrics: {
        providers: {
          created: this.providerMetrics.created,
          updated: this.providerMetrics.updated,
          deleted: this.providerMetrics.deleted,
          tested: this.providerMetrics.tested,
          errors: this.providerMetrics.errors,
        },
        workflows: {
          created: this.workflowMetrics.created,
          updated: this.workflowMetrics.updated,
          deleted: this.workflowMetrics.deleted,
          executed: this.workflowMetrics.executed,
          errors: this.workflowMetrics.errors,
        },
        users: {
          created: this.userMetrics.created,
          updated: this.userMetrics.updated,
          deleted: this.userMetrics.deleted,
          login_attempts: this.userMetrics.loginAttempts,
          login_failures: this.userMetrics.loginFailures,
        },
      },
    };
  }
}

// Export singleton instance
export const adminMetricsService = new AdminMetricsService();

// Express middleware for automatic admin metrics collection
export const adminMetricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const userId = (req as any).userId || 'anonymous';

  // Increment concurrent operations
  adminMetricsService.incrementConcurrentOperations(req.method);

  // Intercept response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    // Record admin operation if it's an admin route
    if (req.path.startsWith('/admin')) {
      adminMetricsService.recordAdminOperation({
        operation: req.method,
        resourceType: req.path.split('/')[2] || 'unknown',
        userId,
        success,
        duration: duration / 1000, // Convert to seconds
        errorType: !success ? `http_${res.statusCode}` : undefined,
        metadata: {
          path: req.path,
          status_code: res.statusCode,
          user_agent: req.headers['user-agent'],
          ip: req.ip,
        },
      });
    }

    // Decrement concurrent operations
    adminMetricsService.decrementConcurrentOperations(req.method);

    // Call original end
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Utility function to track admin operations with automatic timing
export function trackAdminOperation<T>(
  operation: string,
  resourceType: string,
  userId: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return adminMetricsService.metrics.createSpan(`admin.${operation}`, async (_span) => {
    const startTime = Date.now();
    let _success = true;
    let error: Error | undefined;

    try {
      // Increment concurrent operations
      adminMetricsService.incrementConcurrentOperations(operation);

      // Add span attributes
      adminMetricsService.metrics.setSpanAttributes({
        admin_operation: operation,
        admin_resource_type: resourceType,
        admin_user_id: userId,
        ...metadata,
      });

      // Execute the operation
      const result = await fn();

      // Record success
      adminMetricsService.recordAdminOperation({
        operation,
        resourceType,
        userId,
        success: true,
        duration: (Date.now() - startTime) / 1000,
        metadata,
      });

      return result;
    } catch (err) {
      _success = false;
      error = err instanceof Error ? err : new Error(String(err));

      // Record failure
      adminMetricsService.recordAdminOperation({
        operation,
        resourceType,
        userId,
        success: false,
        duration: (Date.now() - startTime) / 1000,
        errorType: error.name,
        metadata: {
          ...metadata,
          error_message: error.message,
        },
      });

      throw error;
    } finally {
      // Decrement concurrent operations
      adminMetricsService.decrementConcurrentOperations(operation);
    }
  });
}

// Export convenience functions
export const {
  recordAdminOperation,
  recordUserActivity,
  recordBulkOperation,
  recordValidationError,
  recordAuthorizationError,
  recordRateLimitHit,
  recordProviderOperation,
  recordWorkflowOperation,
  recordUserOperation,
  getMetricsSummary,
} = adminMetricsService;
