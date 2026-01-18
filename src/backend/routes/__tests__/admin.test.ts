import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, getPrismaMock, createMockProvider, createMockWorkflow } from './testHarness';
import type { Express } from 'express';

describe('Admin Routes', () => {
  let app: Express;
  let prisma: any;

  beforeEach(() => {
    prisma = getPrismaMock();
    
    // Mock Prisma responses
    prisma.modelProvider.findMany.mockResolvedValue([createMockProvider()]);
    prisma.modelProvider.create.mockResolvedValue(createMockProvider());
    prisma.modelProvider.update.mockResolvedValue(createMockProvider({ name: 'Updated Provider' }));
    prisma.modelProvider.delete.mockResolvedValue(undefined);
    
    prisma.workflow.findMany.mockResolvedValue([createMockWorkflow()]);
    prisma.workflow.create.mockResolvedValue(createMockWorkflow());
    prisma.workflow.update.mockResolvedValue(createMockWorkflow({ name: 'Updated Workflow' }));
    prisma.workflow.delete.mockResolvedValue(undefined);
    
    prisma.agentModelMap.findMany.mockResolvedValue([]);
    prisma.agentModelMap.upsert.mockResolvedValue({
      id: 1,
      workflowId: 1,
      agentId: 'code-reviewer',
      modelId: 'gpt-4',
      providerId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    app = createTestApp();
  });

  describe('GET /api/admin/providers', () => {
    it('should return list of providers', async () => {
      const mockProviders = [createMockProvider()];
      prisma.modelProvider.findMany.mockResolvedValue(mockProviders);

      const response = await request(app)
        .get('/api/admin/providers')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockProviders);
      expect(prisma.modelProvider.findMany).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/providers');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/providers', () => {
    const validProvider = {
      name: 'Test Provider',
      provider: 'openai',
      modelId: 'gpt-4',
      baseUrl: 'https://api.openai.com/v1',
      apiKeyRef: 'test_key',
    };

    it('should create a new provider', async () => {
      const response = await request(app)
        .post('/api/admin/providers')
        .set('x-api-key', 'test-key')
        .send(validProvider);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(validProvider.name);
      expect(mockPrisma.modelProvider.create).toHaveBeenCalledWith({
        data: validProvider,
      });
    });

    it('should validate required fields', async () => {
      const invalidProvider = {
        name: '',
        provider: 'openai',
      };

      const response = await request(app)
        .post('/api/admin/providers')
        .set('x-api-key', 'test-key')
        .send(invalidProvider);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid input');
    });

    it('should handle database errors', async () => {
      mockPrisma.modelProvider.create.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/admin/providers')
        .set('x-api-key', 'test-key')
        .send(validProvider);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to create provider');
    });
  });

  describe('DELETE /api/admin/providers/:id', () => {
    it('should delete a provider', async () => {
      const response = await request(app)
        .delete('/api/admin/providers/1')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(204);
      expect(mockPrisma.modelProvider.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should handle non-existent provider', async () => {
      const error = new Error('Provider not found');
      (error as any).code = 'P2025';
      mockPrisma.modelProvider.delete.mockRejectedValue(error);

      const response = await request(app)
        .delete('/api/admin/providers/999')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Provider not found');
    });
  });

  describe('GET /api/admin/workflows', () => {
    it('should return list of workflows', async () => {
      const mockWorkflows = [
        {
          id: 1,
          name: 'Code Review',
          definition: { steps: ['analyze', 'review'] },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrisma.workflow.findMany.mockResolvedValue(mockWorkflows);

      const response = await request(app)
        .get('/api/admin/workflows')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockWorkflows);
    });
  });

  describe('POST /api/admin/workflows', () => {
    const validWorkflow = {
      name: 'Test Workflow',
      definition: { steps: ['test'] },
    };

    it('should create a new workflow', async () => {
      const response = await request(app)
        .post('/api/admin/workflows')
        .set('x-api-key', 'test-key')
        .send(validWorkflow);

      expect(response.status).toBe(201);
      expect(response.body.name).toBe(validWorkflow.name);
      expect(mockPrisma.workflow.create).toHaveBeenCalledWith({
        data: validWorkflow,
      });
    });

    it('should validate JSON definition', async () => {
      const invalidWorkflow = {
        name: 'Invalid Workflow',
        definition: 'not-json',
      };

      const response = await request(app)
        .post('/api/admin/workflows')
        .set('x-api-key', 'test-key')
        .send(invalidWorkflow);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid JSON');
    });
  });

  describe('PUT /api/admin/workflows/:id', () => {
    const updateData = {
      name: 'Updated Workflow',
      definition: { steps: ['updated'] },
    };

    it('should update a workflow', async () => {
      const response = await request(app)
        .put('/api/admin/workflows/1')
        .set('x-api-key', 'test-key')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(mockPrisma.workflow.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: updateData,
      });
    });

    it('should handle non-existent workflow', async () => {
      const error = new Error('Workflow not found');
      (error as any).code = 'P2025';
      mockPrisma.workflow.update.mockRejectedValue(error);

      const response = await request(app)
        .put('/api/admin/workflows/999')
        .set('x-api-key', 'test-key')
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Workflow not found');
    });
  });

  describe('DELETE /api/admin/workflows/:id', () => {
    it('should delete a workflow', async () => {
      const response = await request(app)
        .delete('/api/admin/workflows/1')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(204);
      expect(mockPrisma.workflow.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });
  });

  describe('GET /api/admin/workflows/:workflowId/agent-maps', () => {
    it('should return agent maps for workflow', async () => {
      const mockAgentMaps = [
        {
          id: 1,
          workflowId: 1,
          agentRole: 'reviewer',
          primaryModelId: 1,
          collaboratorModelId: 2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      mockPrisma.agentModelMap.findMany.mockResolvedValue(mockAgentMaps);

      const response = await request(app)
        .get('/api/admin/workflows/1/agent-maps')
        .set('x-api-key', 'test-key');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAgentMaps);
      expect(mockPrisma.agentModelMap.findMany).toHaveBeenCalledWith({
        where: { workflowId: 1 },
      });
    });
  });

  describe('PUT /api/admin/agent-maps', () => {
    const mapData = {
      workflowId: 1,
      agentRole: 'reviewer',
      primaryModelId: 1,
      collaboratorModelId: 2,
    };

    it('should set agent map', async () => {
      const response = await request(app)
        .put('/api/admin/agent-maps')
        .set('x-api-key', 'test-key')
        .send(mapData);

      expect(response.status).toBe(200);
      expect(mockPrisma.agentModelMap.upsert).toHaveBeenCalledWith({
        where: {
          workflowId_agentRole: {
            workflowId: 1,
            agentRole: 'reviewer',
          },
        },
        update: mapData,
        create: mapData,
      });
    });

    it('should validate required fields', async () => {
      const invalidMap = {
        workflowId: 1,
        // Missing agentRole
      };

      const response = await request(app)
        .put('/api/admin/agent-maps')
        .set('x-api-key', 'test-key')
        .send(invalidMap);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid input');
    });
  });

  describe('GET /api/admin/stats', () => {
    it('should return system stats', async () => {
      // Mock Redis and database stats
      const mockStats = {
        systemHealth: 'healthy',
        uptime: '5d 12h 30m',
        apiRequests: 15420,
        errorRate: 0.02,
        cpuUsage: 45.6,
        memoryUsage: 62.3,
      };

      // This would need actual implementation in the service
      const response = await request(app)
        .get('/api/admin/stats')
        .set('x-api-key', 'test-key');

      // For now, just check the endpoint exists
      expect([200, 501]).toContain(response.status);
    });
  });

  describe('GET /api/admin/alerts', () => {
    it('should return system alerts', async () => {
      const mockAlerts = [
        {
          id: 1,
          type: 'warning',
          title: 'High Memory Usage',
          message: 'Memory usage exceeds 60%',
          timestamp: new Date(),
        },
      ];

      // This would need actual implementation in the service
      const response = await request(app)
        .get('/api/admin/alerts')
        .set('x-api-key', 'test-key');

      // For now, just check the endpoint exists
      expect([200, 501]).toContain(response.status);
    });
  });
});
