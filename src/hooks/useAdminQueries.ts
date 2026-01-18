import { useQuery, useMutation, useQueryClient, UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { 
  createAdminQueryOptions, 
  createAdminMutationOptions, 
  ADMIN_QUERY_KEYS, 
  prefetchAdminData,
  handleApiError 
} from './useAdminQueryConfig';
import { errorLogger } from '../utils/errorLogger';

// Mock API functions - replace with actual API calls
const adminApi = {
  // Provider operations
  getProviders: async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      { id: 1, name: 'OpenAI', provider: 'openai', modelId: 'gpt-4' },
      { id: 2, name: 'Anthropic', provider: 'anthropic', modelId: 'claude-3' },
    ];
  },
  
  createProvider: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id: Date.now(), ...data };
  },
  
  updateProvider: async (id: number, data: any) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id, ...data };
  },
  
  deleteProvider: async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  },

  // Workflow operations
  getWorkflows: async () => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return [
      { id: 1, name: 'Code Review', definition: { steps: [] } },
      { id: 2, name: 'Test Generation', definition: { steps: [] } },
    ];
  },
  
  createWorkflow: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id: Date.now(), ...data };
  },
  
  updateWorkflow: async (id: number, data: any) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id, ...data };
  },
  
  deleteWorkflow: async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return { success: true };
  },

  // Agent mapping operations
  getAgentMaps: async (workflowId?: number) => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return [
      { id: 1, workflowId: workflowId || 1, agentId: 'reviewer', modelId: 'gpt-4' },
    ];
  },
  
  setAgentMap: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return { id: Date.now(), ...data };
  },

  // Stats and monitoring
  getStats: async () => {
    await new Promise(resolve => setTimeout(resolve, 50));
    return {
      totalProviders: 2,
      totalWorkflows: 2,
      uptime: 12345,
      memory: { used: '45%', total: '512MB' },
    };
  },

  getAlerts: async () => {
    await new Promise(resolve => setTimeout(resolve, 80));
    return [
      { id: 1, type: 'warning', message: 'High memory usage', timestamp: new Date() },
    ];
  },

  getSettings: async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    return {
      theme: 'dark',
      autoRefresh: true,
      refreshInterval: 30,
    };
  },

  updateSettings: async (data: any) => {
    await new Promise(resolve => setTimeout(resolve, 150));
    return { ...data };
  },
};

// Provider queries
export const useProviders = (options?: {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
}): UseQueryResult<any[], any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.providers,
      queryFn: adminApi.getProviders,
      enabled: options?.enabled !== false,
      staleTime: options?.staleTime || 30 * 1000, // 30 seconds default
      refetchInterval: options?.refetchInterval,
      onSuccess: (data) => {
        errorLogger.logNetworkError('Providers loaded successfully', {
          count: data.length,
          operation: 'get_providers',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load providers', {
          error: handleApiError(error),
          operation: 'get_providers',
        });
      },
    }),
    [options?.enabled, options?.staleTime, options?.refetchInterval]
  );

  return useQuery(queryOptions);
};

export const useProvider = (id: string | number, enabled = true): UseQueryResult<any, any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.provider(id),
      queryFn: async () => {
        const providers = await adminApi.getProviders();
        return providers.find(p => p.id === id);
      },
      enabled: enabled && !!id,
      staleTime: 60 * 1000, // 1 minute for individual provider
    }),
    [id, enabled]
  );

  return useQuery(queryOptions);
};

export const useCreateProvider = (): UseMutationResult<any, any, any> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationKey: ADMIN_QUERY_KEYS.providers,
      mutationFn: adminApi.createProvider,
      onSuccess: (data) => {
        // Invalidate and refetch providers list
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.providers });
        
        errorLogger.logNetworkError('Provider created successfully', {
          providerId: data.id,
          providerName: data.name,
          operation: 'create_provider',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to create provider', {
          error: handleApiError(error),
          operation: 'create_provider',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

export const useUpdateProvider = (): UseMutationResult<any, any, { id: number; data: any }> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationFn: ({ id, data }) => adminApi.updateProvider(id, data),
      onSuccess: (data, variables) => {
        // Update individual provider cache
        queryClient.setQueryData(ADMIN_QUERY_KEYS.provider(variables.id), data);
        
        // Invalidate providers list
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.providers });
        
        errorLogger.logNetworkError('Provider updated successfully', {
          providerId: variables.id,
          operation: 'update_provider',
        });
      },
      onError: (error, variables) => {
        errorLogger.logNetworkError('Failed to update provider', {
          error: handleApiError(error),
          providerId: variables.id,
          operation: 'update_provider',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

export const useDeleteProvider = (): UseMutationResult<any, any, number> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationFn: adminApi.deleteProvider,
      onSuccess: (_, providerId) => {
        // Remove from individual provider cache
        queryClient.removeQueries({ queryKey: ADMIN_QUERY_KEYS.provider(providerId) });
        
        // Invalidate providers list
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.providers });
        
        errorLogger.logNetworkError('Provider deleted successfully', {
          providerId,
          operation: 'delete_provider',
        });
      },
      onError: (error, providerId) => {
        errorLogger.logNetworkError('Failed to delete provider', {
          error: handleApiError(error),
          providerId,
          operation: 'delete_provider',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

// Workflow queries
export const useWorkflows = (options?: {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number;
}): UseQueryResult<any[], any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.workflows,
      queryFn: adminApi.getWorkflows,
      enabled: options?.enabled !== false,
      staleTime: options?.staleTime || 45 * 1000, // 45 seconds default
      refetchInterval: options?.refetchInterval,
      onSuccess: (data) => {
        errorLogger.logNetworkError('Workflows loaded successfully', {
          count: data.length,
          operation: 'get_workflows',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load workflows', {
          error: handleApiError(error),
          operation: 'get_workflows',
        });
      },
    }),
    [options?.enabled, options?.staleTime, options?.refetchInterval]
  );

  return useQuery(queryOptions);
};

export const useWorkflow = (id: string | number, enabled = true): UseQueryResult<any, any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.workflow(id),
      queryFn: async () => {
        const workflows = await adminApi.getWorkflows();
        return workflows.find(w => w.id === id);
      },
      enabled: enabled && !!id,
      staleTime: 90 * 1000, // 1.5 minutes for individual workflow
    }),
    [id, enabled]
  );

  return useQuery(queryOptions);
};

export const useCreateWorkflow = (): UseMutationResult<any, any, any> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationKey: ADMIN_QUERY_KEYS.workflows,
      mutationFn: adminApi.createWorkflow,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.workflows });
        
        errorLogger.logNetworkError('Workflow created successfully', {
          workflowId: data.id,
          workflowName: data.name,
          operation: 'create_workflow',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to create workflow', {
          error: handleApiError(error),
          operation: 'create_workflow',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

// Agent mapping queries
export const useAgentMaps = (workflowId?: string | number): UseQueryResult<any[], any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.agentMaps(workflowId),
      queryFn: () => adminApi.getAgentMaps(workflowId),
      enabled: true,
      staleTime: 60 * 1000, // 1 minute
      onSuccess: (data) => {
        errorLogger.logNetworkError('Agent maps loaded successfully', {
          count: data.length,
          workflowId,
          operation: 'get_agent_maps',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load agent maps', {
          error: handleApiError(error),
          workflowId,
          operation: 'get_agent_maps',
        });
      },
    }),
    [workflowId]
  );

  return useQuery(queryOptions);
};

export const useSetAgentMap = (): UseMutationResult<any, any, any> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationKey: ADMIN_QUERY_KEYS.agentMaps(),
      mutationFn: adminApi.setAgentMap,
      onSuccess: (data) => {
        // Invalidate agent maps for the specific workflow
        queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEYS.agentMaps(data.workflowId) });
        
        errorLogger.logNetworkError('Agent map set successfully', {
          workflowId: data.workflowId,
          agentId: data.agentId,
          operation: 'set_agent_map',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to set agent map', {
          error: handleApiError(error),
          operation: 'set_agent_map',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

// Stats and monitoring queries
export const useStats = (refetchInterval = 30000): UseQueryResult<any, any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.stats,
      queryFn: adminApi.getStats,
      refetchInterval, // Real-time stats
      staleTime: 0, // Always fresh
      onSuccess: (data) => {
        errorLogger.logNetworkError('Stats loaded successfully', {
          uptime: data.uptime,
          operation: 'get_stats',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load stats', {
          error: handleApiError(error),
          operation: 'get_stats',
        });
      },
    }),
    [refetchInterval]
  );

  return useQuery(queryOptions);
};

export const useAlerts = (refetchInterval = 60000): UseQueryResult<any[], any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.alerts,
      queryFn: adminApi.getAlerts,
      refetchInterval, // Check for new alerts every minute
      staleTime: 0, // Always fresh
      onSuccess: (data) => {
        errorLogger.logNetworkError('Alerts loaded successfully', {
          count: data.length,
          operation: 'get_alerts',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load alerts', {
          error: handleApiError(error),
          operation: 'get_alerts',
        });
      },
    }),
    [refetchInterval]
  );

  return useQuery(queryOptions);
};

export const useSettings = (): UseQueryResult<any, any> => {
  const queryOptions = useMemo(() => 
    createAdminQueryOptions({
      queryKey: ADMIN_QUERY_KEYS.settings,
      queryFn: adminApi.getSettings,
      staleTime: 5 * 60 * 1000, // 5 minutes for settings
      onSuccess: (data) => {
        errorLogger.logNetworkError('Settings loaded successfully', {
          operation: 'get_settings',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to load settings', {
          error: handleApiError(error),
          operation: 'get_settings',
        });
      },
    }),
    []
  );

  return useQuery(queryOptions);
};

export const useUpdateSettings = (): UseMutationResult<any, any, any> => {
  const queryClient = useQueryClient();

  const mutationOptions = useMemo(() => 
    createAdminMutationOptions({
      mutationKey: ADMIN_QUERY_KEYS.settings,
      mutationFn: adminApi.updateSettings,
      onSuccess: (data) => {
        // Update settings cache
        queryClient.setQueryData(ADMIN_QUERY_KEYS.settings, data);
        
        errorLogger.logNetworkError('Settings updated successfully', {
          operation: 'update_settings',
        });
      },
      onError: (error) => {
        errorLogger.logNetworkError('Failed to update settings', {
          error: handleApiError(error),
          operation: 'update_settings',
        });
      },
    }),
    [queryClient]
  );

  return useMutation(mutationOptions);
};

// Prefetching hook
export const usePrefetchAdminData = () => {
  const queryClient = useQueryClient();

  const prefetchData = useCallback(() => {
    prefetchAdminData(queryClient);
  }, [queryClient]);

  return { prefetchData };
};

// Optimistic updates hook
export const useOptimisticUpdates = () => {
  const queryClient = useQueryClient();

  const optimisticUpdateProvider = useCallback((providerId: number, updates: any) => {
    // Cancel any outgoing refetches
    queryClient.cancelQueries({ queryKey: ADMIN_QUERY_KEYS.providers });
    
    // Snapshot the previous value
    const previousProviders = queryClient.getQueryData(ADMIN_QUERY_KEYS.providers);
    
    // Optimistically update
    queryClient.setQueryData(ADMIN_QUERY_KEYS.providers, (old: any[] = []) => 
      old.map(provider => 
        provider.id === providerId ? { ...provider, ...updates } : provider
      )
    );

    // Return a context object with the snapshotted value
    return { previousProviders };
  }, [queryClient]);

  const rollbackProviderUpdate = useCallback((context: { previousProviders?: any[] }) => {
    if (context.previousProviders) {
      queryClient.setQueryData(ADMIN_QUERY_KEYS.providers, context.previousProviders);
    }
  }, [queryClient]);

  return {
    optimisticUpdateProvider,
    rollbackProviderUpdate,
  };
};

// Combined hooks for complex operations
export const useAdminData = () => {
  const providers = useProviders();
  const workflows = useWorkflows();
  const stats = useStats();
  const alerts = useAlerts();
  const settings = useSettings();

  const isLoading = providers.isLoading || workflows.isLoading || stats.isLoading;
  const hasError = providers.isError || workflows.isError || stats.isError;

  return {
    providers,
    workflows,
    stats,
    alerts,
    settings,
    isLoading,
    hasError,
    refetchAll: () => {
      providers.refetch();
      workflows.refetch();
      stats.refetch();
      alerts.refetch();
      settings.refetch();
    },
  };
};
