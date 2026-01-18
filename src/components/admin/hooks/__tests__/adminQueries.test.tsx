import { describe, it, expect, beforeEach, jest } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as adminSvc from '../../../../services/adminService';
import {
  useProvidersQuery,
  useCreateProviderMutation,
  useDeleteProviderMutation,
  useWorkflowsQuery,
  useCreateWorkflowMutation,
  useUpdateWorkflowMutation,
  useDeleteWorkflowMutation,
  useAgentMapsQuery,
  useSetAgentMapMutation,
} from '../adminQueries';
import { mockProviders, mockWorkflows, mockAgentMaps } from '../../../test/utils/test-utils';

// Mock admin service
jest.mock('../../../../services/adminService');
const mockAdminSvc = adminSvc as jest.Mocked<typeof adminSvc>;

describe('Admin Queries - Providers', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    jest.clearAllMocks();
  });

  describe('useProvidersQuery', () => {
    it('should fetch providers successfully', async () => {
      mockAdminSvc.listProviders.mockResolvedValue(mockProviders);

      const { result } = renderHook(() => useProvidersQuery(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.data).toBeUndefined();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.data).toEqual(mockProviders);
      });

      expect(mockAdminSvc.listProviders).toHaveBeenCalledTimes(1);
    });

    it('should handle fetch error', async () => {
      const error = new Error('Failed to fetch');
      mockAdminSvc.listProviders.mockRejectedValue(error);

      const { result } = renderHook(() => useProvidersQuery(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toEqual(error);
      });
    });
  });

  describe('useCreateProviderMutation', () => {
    it('should create provider and update cache', async () => {
      const newProvider = mockProviders[0];
      mockAdminSvc.createProvider.mockResolvedValue(newProvider);

      const { result } = renderHook(() => useCreateProviderMutation(), { wrapper });

      expect(result.current.isPending).toBe(false);
      expect(result.current.mutate).toBeDefined();

      result.current.mutate({
        name: 'Test Provider',
        provider: 'openai',
        modelId: 'gpt-4',
      });

      expect(result.current.isPending).toBe(true);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.createProvider).toHaveBeenCalledWith({
        name: 'Test Provider',
        provider: 'openai',
        modelId: 'gpt-4',
      });

      // Verify cache update
      const cachedData = queryClient.getQueryData(['admin', 'providers']);
      expect(cachedData).toEqual([newProvider]);
    });
  });

  describe('useDeleteProviderMutation', () => {
    it('should delete provider and update cache', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['admin', 'providers'], mockProviders);
      
      mockAdminSvc.deleteProvider.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteProviderMutation(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.deleteProvider).toHaveBeenCalledWith(1);

      // Verify cache update
      const cachedData = queryClient.getQueryData(['admin', 'providers']);
      expect(cachedData).toEqual([mockProviders[1]]);
    });
  });
});

describe('Admin Queries - Workflows', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    jest.clearAllMocks();
  });

  describe('useWorkflowsQuery', () => {
    it('should fetch workflows successfully', async () => {
      mockAdminSvc.listWorkflows.mockResolvedValue(mockWorkflows);

      const { result } = renderHook(() => useWorkflowsQuery(), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockWorkflows);
      });

      expect(mockAdminSvc.listWorkflows).toHaveBeenCalledTimes(1);
    });
  });

  describe('useCreateWorkflowMutation', () => {
    it('should create workflow and update cache', async () => {
      const newWorkflow = mockWorkflows[0];
      mockAdminSvc.createWorkflow.mockResolvedValue(newWorkflow);

      const { result } = renderHook(() => useCreateWorkflowMutation(), { wrapper });

      result.current.mutate({
        name: 'Test Workflow',
        definition: { steps: ['test'] },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.createWorkflow).toHaveBeenCalledWith({
        name: 'Test Workflow',
        definition: { steps: ['test'] },
      });

      const cachedData = queryClient.getQueryData(['admin', 'workflows']);
      expect(cachedData).toEqual([newWorkflow]);
    });
  });

  describe('useUpdateWorkflowMutation', () => {
    it('should update workflow and update cache', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['admin', 'workflows'], mockWorkflows);
      
      const updatedWorkflow = { ...mockWorkflows[0], name: 'Updated Workflow' };
      mockAdminSvc.updateWorkflow.mockResolvedValue(updatedWorkflow);

      const { result } = renderHook(() => useUpdateWorkflowMutation(), { wrapper });

      result.current.mutate({
        id: 1,
        input: { name: 'Updated Workflow' },
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.updateWorkflow).toHaveBeenCalledWith(1, {
        name: 'Updated Workflow',
      });

      const cachedData = queryClient.getQueryData(['admin', 'workflows']);
      expect(cachedData).toEqual([updatedWorkflow, mockWorkflows[1]]);
    });
  });

  describe('useDeleteWorkflowMutation', () => {
    it('should delete workflow and update cache', async () => {
      // Pre-populate cache
      queryClient.setQueryData(['admin', 'workflows'], mockWorkflows);
      queryClient.setQueryData(['admin', 'agentMaps', 1], mockAgentMaps);
      
      mockAdminSvc.deleteWorkflow.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteWorkflowMutation(), { wrapper });

      result.current.mutate(1);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.deleteWorkflow).toHaveBeenCalledWith(1);

      // Verify workflow cache update
      const cachedWorkflows = queryClient.getQueryData(['admin', 'workflows']);
      expect(cachedWorkflows).toEqual([mockWorkflows[1]]);

      // Verify agent maps cache removal
      const cachedAgentMaps = queryClient.getQueryData(['admin', 'agentMaps', 1]);
      expect(cachedAgentMaps).toBeUndefined();
    });
  });
});

describe('Admin Queries - Agent Maps', () => {
  let queryClient: QueryClient;
  let wrapper: React.FC<{ children: React.ReactNode }>;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    jest.clearAllMocks();
  });

  describe('useAgentMapsQuery', () => {
    it('should fetch agent maps when workflowId is provided', async () => {
      mockAdminSvc.listAgentMaps.mockResolvedValue(mockAgentMaps);

      const { result } = renderHook(() => useAgentMapsQuery(1), { wrapper });

      expect(result.current.isFetching).toBe(true);

      await waitFor(() => {
        expect(result.current.data).toEqual(mockAgentMaps);
        expect(result.current.isFetching).toBe(false);
      });

      expect(mockAdminSvc.listAgentMaps).toHaveBeenCalledWith(1);
    });

    it('should not fetch when workflowId is null', () => {
      const { result } = renderHook(() => useAgentMapsQuery(null), { wrapper });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockAdminSvc.listAgentMaps).not.toHaveBeenCalled();
    });
  });

  describe('useSetAgentMapMutation', () => {
    it('should set agent map and update cache', async () => {
      const newAgentMap = mockAgentMaps[0];
      mockAdminSvc.setAgentMap.mockResolvedValue(newAgentMap);

      // Pre-populate cache
      queryClient.setQueryData(['admin', 'agentMaps', 1], []);

      const { result } = renderHook(() => useSetAgentMapMutation(), { wrapper });

      result.current.mutate({
        workflowId: 1,
        agentRole: 'reviewer',
        primaryModelId: 1,
        collaboratorModelId: 2,
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockAdminSvc.setAgentMap).toHaveBeenCalledWith({
        workflowId: 1,
        agentRole: 'reviewer',
        primaryModelId: 1,
        collaboratorModelId: 2,
      });

      const cachedData = queryClient.getQueryData(['admin', 'agentMaps', 1]);
      expect(cachedData).toEqual([newAgentMap]);
    });
  });
});
