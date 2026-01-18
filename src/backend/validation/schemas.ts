import { z } from 'zod';

// Base validation schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search term must be less than 200 characters').optional(),
  sortBy: z.string().max(50, 'Sort field must be less than 50 characters').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

// Enhanced Provider validation schemas
export const CreateProviderSchema = z.object({
  name: z.string()
    .min(1, 'Provider name is required')
    .max(100, 'Provider name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Provider name can only contain letters, numbers, spaces, hyphens, and underscores')
    .transform(val => val.trim()),
  provider: z.string()
    .min(1, 'Provider type is required')
    .max(50, 'Provider type must be less than 50 characters')
    .regex(/^[a-z0-9\-_]+$/, 'Provider type can only contain lowercase letters, numbers, hyphens, and underscores'),
  baseUrl: z.string()
    .url('Base URL must be a valid URL')
    .or(z.string().max(0))
    .optional()
    .refine((val) => !val || val.startsWith('http'), 'Base URL must start with http:// or https://')
    .transform(val => val?.trim()),
  apiKeyRef: z.string()
    .min(0)
    .max(100, 'API key reference must be less than 100 characters')
    .regex(/^[A-Z_][A-Z0-9_]*$/, 'API key reference must be in UPPER_SNAKE_CASE')
    .optional()
    .transform(val => val?.trim()),
  modelId: z.string()
    .min(1, 'Model ID is required')
    .max(200, 'Model ID must be less than 200 characters')
    .regex(/^[a-zA-Z0-9\-_:.]+$/, 'Model ID contains invalid characters'),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform(val => val?.trim()),
  tags: z.array(z.string().max(50, 'Tag must be less than 50 characters'))
    .max(10, 'Maximum 10 tags allowed')
    .optional(),
  isActive: z.boolean().default(true),
  rateLimit: z.object({
    requestsPerMinute: z.number().int().min(1).max(10000).default(60),
    requestsPerHour: z.number().int().min(1).max(100000).default(1000),
    requestsPerDay: z.number().int().min(1).max(1000000).default(10000),
  }).optional(),
});

export const UpdateProviderSchema = CreateProviderSchema.partial().extend({
  id: z.coerce.number().int().positive('Provider ID must be a positive integer'),
});

export const ProviderIdSchema = z.object({
  id: z.coerce.number().int().positive('Provider ID must be a positive integer'),
});

// Enhanced Workflow validation schemas
export const CreateWorkflowSchema = z.object({
  name: z.string()
    .min(1, 'Workflow name is required')
    .max(100, 'Workflow name must be less than 100 characters')
    .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Workflow name can only contain letters, numbers, spaces, hyphens, and underscores')
    .transform(val => val.trim()),
  description: z.string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform(val => val?.trim()),
  definition: z.object({
    steps: z.array(z.object({
      id: z.string().min(1, 'Step ID is required'),
      type: z.enum(['ai_action', 'condition', 'input', 'output', 'delay', 'notification']),
      name: z.string().min(1, 'Step name is required').max(100),
      config: z.record(z.any()),
      timeout: z.number().int().min(1).max(3600).optional(), // Max 1 hour
      retryPolicy: z.object({
        maxAttempts: z.number().int().min(0).max(10).default(3),
        backoffMs: z.number().int().min(100).max(60000).default(1000),
      }).optional(),
    })).min(1, 'Workflow must have at least one step'),
    variables: z.record(z.any()).optional(),
    triggers: z.array(z.object({
      type: z.enum(['manual', 'schedule', 'webhook', 'event']),
      config: z.record(z.any()),
    })).optional(),
  }).refine((def) => def.steps.length > 0, 'Workflow definition cannot be empty'),
  tags: z.array(z.string().max(50, 'Tag must be less than 50 characters'))
    .max(10, 'Maximum 10 tags allowed')
    .optional(),
  isActive: z.boolean().default(true),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format (x.y.z)').optional(),
});

export const UpdateWorkflowSchema = CreateWorkflowSchema.partial().extend({
  id: z.coerce.number().int().positive('Workflow ID must be a positive integer'),
});

export const WorkflowIdSchema = z.object({
  id: z.coerce.number().int().positive('Workflow ID must be a positive integer'),
});

// Agent Model Map validation schemas
export const CreateAgentMapSchema = z.object({
  workflowId: z.coerce.number().int().positive('Workflow ID must be a positive integer'),
  agentId: z.string()
    .min(1, 'Agent ID is required')
    .max(100, 'Agent ID must be less than 100 characters')
    .regex(/^[a-z0-9\-_]+$/, 'Agent ID can only contain lowercase letters, numbers, hyphens, and underscores'),
  modelId: z.string()
    .min(1, 'Model ID is required')
    .max(200, 'Model ID must be less than 200 characters'),
  providerId: z.coerce.number().int().positive('Provider ID must be a positive integer'),
  config: z.object({
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().int().min(1).max(32000).optional(),
    systemPrompt: z.string().max(2000, 'System prompt must be less than 2000 characters').optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    timeout: z.number().int().min(1).max(300).default(60),
  }).optional(),
});

export const UpdateAgentMapSchema = CreateAgentMapSchema.partial().extend({
  id: z.coerce.number().int().positive('Agent Map ID must be a positive integer'),
});

export const AgentMapIdSchema = z.object({
  id: z.coerce.number().int().positive('Agent Map ID must be a positive integer'),
});

// Bulk operation schemas
export const BulkOperationSchema = z.object({
  operation: z.enum(['delete', 'activate', 'deactivate', 'update']),
  itemIds: z.array(z.coerce.number().int().positive()).min(1, 'At least one item ID is required').max(100, 'Maximum 100 items per bulk operation'),
  updateData: z.record(z.any()).optional(),
});

// Settings validation schemas
export const UpdateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'auto']).optional(),
  autoRefresh: z.boolean().optional(),
  refreshInterval: z.number().int().min(5).max(300).optional(), // 5 seconds to 5 minutes
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    slack: z.boolean().optional(),
  }).optional(),
  security: z.object({
    sessionTimeout: z.number().int().min(300).max(86400).optional(), // 5 minutes to 24 hours
    maxLoginAttempts: z.number().int().min(1).max(10).optional(),
    passwordMinLength: z.number().int().min(8).max(128).optional(),
  }).optional(),
  performance: z.object({
    cacheEnabled: z.boolean().optional(),
    cacheTTL: z.number().int().min(60).max(3600).optional(), // 1 minute to 1 hour
    maxConcurrentRequests: z.number().int().min(1).max(1000).optional(),
  }).optional(),
});

// Search and filter schemas
export const SearchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(200),
  type: z.enum(['providers', 'workflows', 'agent-maps', 'all']).default('all'),
  filters: z.object({
    status: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
  sort: z.object({
    field: z.string().max(50),
    order: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
});

// Export/Import schemas
export const ExportSchema = z.object({
  format: z.enum(['json', 'yaml', 'csv']).default('json'),
  include: z.object({
    providers: z.boolean().default(true),
    workflows: z.boolean().default(true),
    agentMaps: z.boolean().default(true),
    settings: z.boolean().default(false),
  }),
  filters: z.object({
    status: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    dateRange: z.object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    }).optional(),
  }).optional(),
});

export const ImportSchema = z.object({
  format: z.enum(['json', 'yaml', 'csv']),
  data: z.any(),
  options: z.object({
    overwrite: z.boolean().default(false),
    validateOnly: z.boolean().default(false),
    skipErrors: z.boolean().default(false),
  }),
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  version: z.string(),
  checks: z.record(z.object({
    status: z.enum(['pass', 'warn', 'fail']),
    message: z.string().optional(),
    duration: z.number().optional(),
    metadata: z.record(z.any()).optional(),
  })),
});

// API response schemas
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
  meta: z.object({
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }).optional(),
    requestId: z.string(),
    timestamp: z.string().datetime(),
  }),
});
export const CreateAgentMapSchema = z.object({
  workflowId: z.coerce.number().int().positive('Workflow ID must be a positive integer'),
  agentId: z.string()
    .min(1, 'Agent ID is required')
    .max(100, 'Agent ID must be less than 100 characters'),
  modelId: z.string()
    .min(1, 'Model ID is required')
    .max(200, 'Model ID must be less than 200 characters'),
  providerId: z.coerce.number().int().positive('Provider ID must be a positive integer'),
});

export const AgentMapIdSchema = z.object({
  id: z.coerce.number().int().positive('Agent Map ID must be a positive integer'),
});

// Settings validation schemas
export const UpdateSettingsSchema = z.object({
  aiPersona: z.string()
    .min(1, 'AI persona is required')
    .max(5000, 'AI persona must be less than 5000 characters')
    .optional(),
  customRules: z.string()
    .max(10000, 'Custom rules must be less than 10000 characters')
    .optional(),
  explorerStyle: z.enum(['list', 'tree', 'grid'])
    .optional(),
  availableModels: z.array(z.object({
    id: z.string().min(1, 'Model ID is required'),
    name: z.string().min(1, 'Model name is required'),
    isLocal: z.boolean(),
  })).optional(),
  desktopSettings: z.object({
    fileSystem: z.boolean(),
    database: z.boolean(),
  }).optional(),
  aiTools: z.object({
    webSearch: z.boolean(),
    projectSearch: z.boolean(),
    editFile: z.boolean(),
    createFile: z.boolean(),
    runTerminalCommand: z.boolean(),
    visualSnapshot: z.boolean(),
    autoRunTools: z.boolean(),
    analyzeDependencies: z.boolean(),
    projectWideRefactor: z.boolean(),
    generateDocs: z.boolean(),
  }).optional(),
  logVerbosity: z.enum(['silent', 'normal', 'verbose', 'debug'])
    .optional(),
});

// Health check validation schemas
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number(),
  checks: z.record(z.object({
    status: z.enum(['pass', 'warn', 'fail']),
    message: z.string().optional(),
    duration: z.number().optional(),
  })),
});

// Admin action validation schemas
export const AdminActionSchema = z.object({
  action: z.enum(['create', 'update', 'delete', 'view']),
  resource: z.enum(['provider', 'workflow', 'agent_map', 'settings']),
  resourceId: z.coerce.number().int().positive().optional(),
  details: z.record(z.any()).optional(),
});

// Bulk operation schemas
export const BulkOperationSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']),
  resource: z.enum(['provider', 'workflow']),
  items: z.array(z.any())
    .min(1, 'At least one item is required')
    .max(50, 'Cannot process more than 50 items at once'),
});

// Search validation schemas
export const SearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query is required')
    .max(200, 'Search query must be less than 200 characters'),
  type: z.enum(['provider', 'workflow', 'all']).default('all'),
  filters: z.record(z.any()).optional(),
  ...PaginationSchema.shape,
});

// Export/Import validation schemas
export const ExportConfigSchema = z.object({
  format: z.enum(['json', 'yaml', 'csv']).default('json'),
  include: z.array(z.enum(['providers', 'workflows', 'settings'])).default(['providers', 'workflows']),
  compress: z.boolean().default(false),
});

export const ImportConfigSchema = z.object({
  format: z.enum(['json', 'yaml', 'csv']),
  data: z.any()
    .refine((data) => data !== null && data !== undefined, 'Import data is required'),
  overwrite: z.boolean().default(false),
  validate: z.boolean().default(true),
});

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.string().optional(),
  details: z.record(z.any()).optional(),
  timestamp: z.string().datetime(),
  requestId: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Success response schema
export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  data: z.any(),
  message: z.string().optional(),
  meta: z.object({
    timestamp: z.string().datetime(),
    requestId: z.string().optional(),
    pagination: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }).optional(),
  }).optional(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;

// Validation middleware factory
export const validate = <T extends z.ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: any, res: any, next: any) => {
    try {
      const data = req[source];
      const result = schema.parse(data);
      
      // Attach validated data to request
      req.validated = req.validated || {};
      req.validated[source] = result;
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));
        
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid input data',
          code: 'VALIDATION_ERROR',
          details: {
            errors: validationErrors,
          },
          timestamp: new Date().toISOString(),
        } satisfies ErrorResponse);
      }
      
      next(error);
    }
  };
};

// Type guards for runtime validation
export const isValidProviderCreate = (data: unknown): data is z.infer<typeof CreateProviderSchema> => {
  try {
    CreateProviderSchema.parse(data);
    return true;
  } catch {
    return false;
  }
};

export const isValidWorkflowCreate = (data: unknown): data is z.infer<typeof CreateWorkflowSchema> => {
  try {
    CreateWorkflowSchema.parse(data);
    return true;
  } catch {
    return false;
  }
};

// Sanitization utilities
export const sanitizeString = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove potential JS protocols
    .slice(0, 10000); // Limit length
};

export const sanitizeUrl = (input: string): string => {
  try {
    const url = new URL(input);
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Invalid protocol');
    }
    return input;
  } catch {
    throw new Error('Invalid URL format');
  }
};

// Security validation utilities
export const isValidApiKey = (apiKey: string): boolean => {
  // Basic API key validation - adjust based on your requirements
  return /^[a-zA-Z0-9\-_]{20,}$/.test(apiKey);
};

export const isValidModelId = (modelId: string): boolean => {
  // Model ID validation - adjust based on supported models
  return /^[a-zA-Z0-9\-_:.]{1,200}$/.test(modelId);
};

export default {
  // Schemas
  PaginationSchema,
  CreateProviderSchema,
  UpdateProviderSchema,
  ProviderIdSchema,
  CreateWorkflowSchema,
  UpdateWorkflowSchema,
  WorkflowIdSchema,
  CreateAgentMapSchema,
  AgentMapIdSchema,
  UpdateSettingsSchema,
  HealthCheckResponseSchema,
  AdminActionSchema,
  BulkOperationSchema,
  SearchSchema,
  ExportConfigSchema,
  ImportConfigSchema,
  ErrorResponseSchema,
  SuccessResponseSchema,
  
  // Middleware
  validate,
  
  // Type guards
  isValidProviderCreate,
  isValidWorkflowCreate,
  
  // Sanitization
  sanitizeString,
  sanitizeUrl,
  isValidApiKey,
  isValidModelId,
};
