import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

// React Query configuration with enterprise-grade retry and error handling
export const createReactQueryClient = (): QueryClient => {
  // Create query cache with error handling
  const queryCache = new QueryCache({
    onError: (error: any, query) => {
      console.error('Query cache error:', { error, queryKey: query.queryKey });
    },
  });

  // Create mutation cache with error handling
  const mutationCache = new MutationCache({
    onError: (error: any, variables, context, _mutation) => {
      console.error('Mutation cache error:', { error, variables, context });
    },
  });

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        // Retry configuration
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          
          // Don't retry on authentication errors
          if (error?.status === 401 || error?.status === 403) {
            return false;
          }
          
          // Retry network errors up to 3 times
          if (failureCount < 3 && isNetworkError(error)) {
            return true;
          }
          
          // Retry server errors (5xx) up to 2 times
          if (failureCount < 2 && error?.status >= 500) {
            return true;
          }
          
          return false;
        },
        retryDelay: (attemptIndex) => {
          // Exponential backoff with jitter
          const baseDelay = Math.min(1000 * 2 ** attemptIndex, 30000);
          const jitter = Math.random() * 0.1 * baseDelay;
          return baseDelay + jitter;
        },
        
        // Stale time and cache time
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
        
        // Refetch configuration
        refetchOnWindowFocus: false, // Don't refetch on window focus for admin operations
        refetchOnReconnect: true, // Refetch on reconnect
        refetchInterval: false, // Don't auto-refetch
      },
      
      // Global mutation configuration
      mutations: {
        retry: (failureCount, error: any) => {
          // Don't retry mutations on validation errors
          if (error?.status >= 400 && error?.status < 500) {
            return false;
          }
          
          // Retry network errors once
          if (failureCount < 1 && isNetworkError(error)) {
            return true;
          }
          
          return false;
        },
        retryDelay: () => 1000, // 1 second delay for mutations
      },
    },
  });
};

// Helper function to detect network errors
function isNetworkError(error: any): boolean {
  return (
    error instanceof TypeError ||
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.code === 'NETWORK_ERROR' ||
    error?.code === 'ECONNREFUSED' ||
    error?.code === 'ENOTFOUND' ||
    navigator?.onLine === false
  );
}

// Prefetching utilities
export const prefetchAdminData = async (queryClient: QueryClient) => {
  try {
    // Prefetch providers
    await queryClient.prefetchQuery({
      queryKey: ['admin', 'providers'],
      queryFn: async () => {
        const response = await fetch('/api/admin/providers', {
          headers: { 'x-api-key': process.env.REACT_APP_API_KEY || '' },
        });
        if (!response.ok) throw new Error('Failed to prefetch providers');
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes for prefetched data
    });

    // Prefetch workflows
    await queryClient.prefetchQuery({
      queryKey: ['admin', 'workflows'],
      queryFn: async () => {
        const response = await fetch('/api/admin/workflows', {
          headers: { 'x-api-key': process.env.REACT_APP_API_KEY || '' },
        });
        if (!response.ok) throw new Error('Failed to prefetch workflows');
        return response.json();
      },
      staleTime: 2 * 60 * 1000,
    });

    // Prefetch stats
    await queryClient.prefetchQuery({
      queryKey: ['admin', 'stats'],
      queryFn: async () => {
        const response = await fetch('/api/admin/stats', {
          headers: { 'x-api-key': process.env.REACT_APP_API_KEY || '' },
        });
        if (!response.ok) throw new Error('Failed to prefetch stats');
        return response.json();
      },
      staleTime: 1 * 60 * 1000, // 1 minute for stats
    });

  } catch (error) {
    console.warn('Failed to prefetch admin data:', error);
    // Don't throw - prefetching failures shouldn't block the app
  }
};

// Query invalidation utilities
export const invalidateAdminQueries = (queryClient: QueryClient, scope?: string) => {
  switch (scope) {
    case 'providers':
      queryClient.invalidateQueries({ queryKey: ['admin', 'providers'] });
      break;
    case 'workflows':
      queryClient.invalidateQueries({ queryKey: ['admin', 'workflows'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'agentMaps'] });
      break;
    case 'operations':
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'alerts'] });
      break;
    default:
      // Invalidate all admin queries
      queryClient.invalidateQueries({ queryKey: ['admin'] });
  }
};

// Cache management utilities
export const clearAdminCache = (queryClient: QueryClient) => {
  queryClient.removeQueries({ queryKey: ['admin'] });
  queryClient.clear();
};

// Query health check
export const getQueryHealth = (queryClient: QueryClient) => {
  const cache = queryClient.getQueryCache();
  const queries = cache.getAll();
  
  const health = {
    totalQueries: queries.length,
    activeQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
    staleQueries: queries.filter(q => q.isStale()).length,
    errorQueries: queries.filter(q => q.state.status === 'error').length,
    pausedQueries: queries.filter(q => q.state.fetchStatus === 'paused').length,
  };
  
  return health;
};

// Default export for easy usage
export const defaultQueryClient = createReactQueryClient();
