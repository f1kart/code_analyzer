import type { Request, Response } from 'express';
import { Router } from 'express';
import { 
  generalRateLimit,
  adminRateLimit,
  validateApiKey,
  validateAdminAccess,
  sanitizeInput
} from '../middleware/security';
import { validate } from '../middleware/validation';
import { CreateProviderSchema, UpdateProviderSchema, CreateWorkflowSchema, UpdateWorkflowSchema, ProviderIdSchema, WorkflowIdSchema, AgentMapIdSchema, CreateAgentMapSchema } from '../validation/schemas';
import { logAdminAction } from '../../utils/logger';
import { PrismaClient } from '@prisma/client';
import { TracingUtils } from '../observability/tracing';

const prisma = new PrismaClient();

// Admin service interface
interface AdminService {
  listProviders(): Promise<any[]>;
  createProvider(data: any): Promise<any>;
  updateProvider(id: number, data: any): Promise<any>;
  deleteProvider(id: number): Promise<void>;
  listWorkflows(): Promise<any[]>;
  createWorkflow(data: any): Promise<any>;
  updateWorkflow(id: number, data: any): Promise<any>;
  deleteWorkflow(id: number): Promise<void>;
  listAgentMaps(workflowId: number): Promise<any[]>;
  setAgentMap(data: any): Promise<any>;
  deleteAgentMap(id: number): Promise<void>;
  getStats(): Promise<any>;
  getAlerts(): Promise<any[]>;
  updateSettings(settings: any): Promise<any>;
  getSettings(): Promise<any>;
}

// Mock admin service (replace with actual implementation)
const adminService: AdminService = {
  async listProviders() {
    return await prisma.modelProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async createProvider(data: any) {
    return await prisma.modelProvider.create({
      data: {
        name: data.name,
        provider: data.provider,
        baseUrl: data.baseUrl,
        apiKeyRef: data.apiKeyRef,
        modelId: data.modelId,
      },
    });
  },

  async updateProvider(id: number, data: any) {
    return await prisma.modelProvider.update({
      where: { id },
      data,
    });
  },

  async deleteProvider(id: number) {
    await prisma.modelProvider.delete({
      where: { id },
    });
  },

  async listWorkflows() {
    return await prisma.workflow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  },

  async createWorkflow(data: any) {
    return await prisma.workflow.create({
      data: {
        name: data.name,
        definition: data.definition,
      },
    });
  },

  async updateWorkflow(id: number, data: any) {
    return await prisma.workflow.update({
      where: { id },
      data,
    });
  },

  async deleteWorkflow(id: number) {
    await prisma.workflow.delete({
      where: { id },
    });
  },

  async listAgentMaps(workflowId: number) {
    return await prisma.agentModelMap.findMany({
      where: { workflowId },
      include: { provider: true },
    });
  },

  async setAgentMap(data: any) {
    return await prisma.agentModelMap.upsert({
      where: { 
        workflowId_agentId: {
          workflowId: data.workflowId,
          agentId: data.agentId,
        }
      },
      update: {
        modelId: data.modelId,
        providerId: data.providerId,
      },
      create: data,
    });
  },

  async deleteAgentMap(id: number) {
    await prisma.agentModelMap.delete({
      where: { id },
    });
  },

  async getStats() {
    const [providers, workflows, agentMaps] = await Promise.all([
      prisma.modelProvider.count(),
      prisma.workflow.count(),
      prisma.agentModelMap.count(),
    ]);

    return {
      totalProviders: providers,
      totalWorkflows: workflows,
      totalAgentMaps: agentMaps,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  },

  async getAlerts() {
    // Mock alerts - replace with actual alert system
    return [
      {
        id: 1,
        type: 'warning',
        message: 'High memory usage detected',
        timestamp: new Date(),
        resolved: false,
      },
    ];
  },

  async updateSettings(settings: any) {
    // Mock settings update - replace with actual implementation
    console.log('Updating settings:', settings);
    return settings;
  },

  async getSettings() {
    // Mock settings - replace with actual implementation
    return {
      aiPersona: 'You are an expert AI programming assistant.',
      customRules: '',
      explorerStyle: 'list',
    };
  },
};

export const registerAdminRoutes = (router: Router): void => {
  // Apply admin-specific middleware to all admin routes
  router.use('/admin', generalRateLimit, adminRateLimit, validateApiKey, validateAdminAccess, sanitizeInput);

  // Provider routes
  router.get('/admin/providers', async (req: Request, res: Response) => {
    try {
      const providers = await TracingUtils.createAdminSpan(
        'list_providers',
        'provider',
        (span) => {
          span.setAttributes({
            'admin.request_id': req.requestId,
            'admin.api_key': req.apiKey ? 'present' : 'missing',
          });
          return adminService.listProviders();
        },
        req.apiKey
      );
      
      logAdminAction('list_providers', req.apiKey, { count: providers.length });
      
      res.json({
        success: true,
        data: providers,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to list providers:', error);
      TracingUtils.setError(error as Error, 'Failed to list providers');
      res.status(500).json({
        success: false,
        error: 'Failed to list providers',
        message: (error as Error).message,
      });
    }
  });

  router.post('/admin/providers', 
    validate(CreateProviderSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const provider = await TracingUtils.createAdminSpan(
          'create_provider',
          'provider',
          (span) => {
            span.setAttributes({
              'admin.request_id': req.requestId,
              'admin.api_key': req.apiKey ? 'present' : 'missing',
              'admin.provider_name': req.validated?.body?.name,
              'admin.provider_type': req.validated?.body?.provider,
            });
            return adminService.createProvider(req.validated?.body || {});
          },
          req.apiKey
        );
        
        logAdminAction('create_provider', req.apiKey, { 
          providerId: provider.id,
          providerName: provider.name 
        });
        
        res.status(201).json({
          success: true,
          data: provider,
          message: 'Provider created successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to create provider:', error);
        TracingUtils.setError(error as Error, 'Failed to create provider');
        res.status(500).json({
          success: false,
          error: 'Failed to create provider',
          message: (error as Error).message,
        });
      }
    }
  );

  router.put('/admin/providers/:id',
    validate(ProviderIdSchema, 'params'),
    validate(UpdateProviderSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.validated.params || {};
        if (!req.validated.params || !req.validated.body) {
          throw new Error('Invalid request parameters');
        }
        const provider = await adminService.updateProvider(id, req.validated.body);
        
        logAdminAction('update_provider', req.apiKey, { 
          providerId: id,
          providerName: provider.name 
        });
        
        res.json({
          success: true,
          data: provider,
          message: 'Provider updated successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to update provider:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update provider',
          message: (error as Error).message,
        });
      }
    }
  );

  router.delete('/admin/providers/:id',
    validate(ProviderIdSchema, 'params'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.validated.params || {};
        if (!req.validated.params) {
          throw new Error('Invalid request parameters');
        }
        await adminService.deleteProvider(id);
        
        logAdminAction('delete_provider', req.apiKey, { providerId: id });
        
        res.json({
          success: true,
          message: 'Provider deleted successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to delete provider:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete provider',
          message: (error as Error).message,
        });
      }
    }
  );

  // Workflow routes
  router.get('/admin/workflows', async (req: Request, res: Response) => {
    try {
      const workflows = await adminService.listWorkflows();
      
      logAdminAction('list_workflows', req.apiKey, { count: workflows.length });
      
      res.json({
        success: true,
        data: workflows,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to list workflows:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list workflows',
        message: (error as Error).message,
      });
    }
  });

  router.post('/admin/workflows',
    validate(CreateWorkflowSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const workflow = await adminService.createWorkflow(req.validated.body || {});
        
        logAdminAction('create_workflow', req.apiKey, { 
          workflowId: workflow.id,
          workflowName: workflow.name 
        });
        
        res.status(201).json({
          success: true,
          data: workflow,
          message: 'Workflow created successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to create workflow:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create workflow',
          message: (error as Error).message,
        });
      }
    }
  );

  router.put('/admin/workflows/:id',
    validate(WorkflowIdSchema, 'params'),
    validate(UpdateWorkflowSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.validated.params || {};
        const workflow = await adminService.updateWorkflow(id, req.validated.body);
        
        logAdminAction('update_workflow', req.apiKey, { 
          workflowId: id,
          workflowName: workflow.name 
        });
        
        res.json({
          success: true,
          data: workflow,
          message: 'Workflow updated successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to update workflow:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update workflow',
          message: (error as Error).message,
        });
      }
    }
  );

  router.delete('/admin/workflows/:id',
    validate(WorkflowIdSchema, 'params'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.validated?.params || {};
        if (!req.validated?.params) {
          throw new Error('Invalid request parameters');
        }
        await adminService.deleteWorkflow(id);
        
        logAdminAction('delete_workflow', req.apiKey, { workflowId: id });
        
        res.json({
          success: true,
          message: 'Workflow deleted successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to delete workflow:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete workflow',
          message: (error as Error).message,
        });
      }
    }
  );

  // Agent Map routes
  router.get('/admin/agent-maps/:workflowId',
    validate(WorkflowIdSchema, 'params'),
    async (req: Request, res: Response) => {
      try {
        const { workflowId } = req.validated?.params || {};
        if (!req.validated?.params) {
          throw new Error('Invalid request parameters');
        }
        const agentMaps = await adminService.listAgentMaps(workflowId);
        
        logAdminAction('list_agent_maps', req.apiKey, { 
          workflowId,
          count: agentMaps.length 
        });
        
        res.json({
          success: true,
          data: agentMaps,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to list agent maps:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to list agent maps',
          message: (error as Error).message,
        });
      }
    }
  );

  router.post('/admin/agent-maps',
    validate(CreateAgentMapSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const agentMap = await adminService.setAgentMap(req.validated?.body || {});
        
        logAdminAction('set_agent_map', req.apiKey, { 
          agentMapId: agentMap.id,
          workflowId: agentMap.workflowId 
        });
        
        res.status(201).json({
          success: true,
          data: agentMap,
          message: 'Agent map set successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to set agent map:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to set agent map',
          message: (error as Error).message,
        });
      }
    }
  );

  router.delete('/admin/agent-maps/:id',
    validate(AgentMapIdSchema, 'params'),
    async (req: Request, res: Response) => {
      try {
        const { id } = req.validated?.params || {};
        if (!req.validated?.params) {
          throw new Error('Invalid request parameters');
        }
        await adminService.deleteAgentMap(id);
        
        logAdminAction('delete_agent_map', req.apiKey, { agentMapId: id });
        
        res.json({
          success: true,
          message: 'Agent map deleted successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to delete agent map:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete agent map',
          message: (error as Error).message,
        });
      }
    }
  );

  // Stats and monitoring routes
  router.get('/admin/stats', async (req: Request, res: Response) => {
    try {
      const stats = await adminService.getStats();
      
      res.json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to get stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        message: (error as Error).message,
      });
    }
  });

  router.get('/admin/alerts', async (req: Request, res: Response) => {
    try {
      const alerts = await adminService.getAlerts();
      
      res.json({
        success: true,
        data: alerts,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to get alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts',
        message: (error as Error).message,
      });
    }
  });

  // Settings routes
  router.get('/admin/settings', async (req: Request, res: Response) => {
    try {
      const settings = await adminService.getSettings();
      
      res.json({
        success: true,
        data: settings,
        meta: {
          timestamp: new Date().toISOString(),
          requestId: req.requestId,
        },
      });
    } catch (error) {
      console.error('Failed to get settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get settings',
        message: (error as Error).message,
      });
    }
  });

  router.put('/admin/settings',
    validate(UpdateSettingsSchema, 'body'),
    async (req: Request, res: Response) => {
      try {
        const settings = await adminService.updateSettings(req.validated?.body);
        
        logAdminAction('update_settings', req.apiKey, { 
          updatedFields: Object.keys(req.validated?.body) 
        });
        
        res.json({
          success: true,
          data: settings,
          message: 'Settings updated successfully',
          meta: {
            timestamp: new Date().toISOString(),
            requestId: req.requestId,
          },
        });
      } catch (error) {
        console.error('Failed to update settings:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to update settings',
          message: (error as Error).message,
        });
      }
    }
  );

  // Health check for admin service
  router.get('/admin/health', async (req: Request, res: Response) => {
    try {
      const stats = await adminService.getStats();
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        uptime: process.uptime(),
        checks: {
          database: {
            status: 'pass',
            duration: 0,
          },
          memory: {
            status: stats.memory.heapUsed < 500 * 1024 * 1024 ? 'pass' : 'warn',
            message: `Memory usage: ${Math.round(stats.memory.heapUsed / 1024 / 1024)}MB`,
            duration: 0,
          },
        },
      };
      
      res.json(health);
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      });
    }
  });
};

export default registerAdminRoutes;
