import { UseQueryOptions, UseMutationOptions, QueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';

// Error types for better error handling
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: any;
  requestId?: string;
}

// Retry configuration for different types of requests
export const RETRY_CONFIGS = {
  // High reliability for critical admin operations
  admin: {
    retry: (failureCount: number, error: ApiError) => {
      // Don't retry on client errors (4xx)
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      // Retry up to 3 times for server errors
      return failureCount < 3;
    },
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff, max 30s
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes (garbage collection time)
  },
  
  // More aggressive retry for background data
  background: {
    retry: (failureCount: number, error: ApiError) => {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      return failureCount < 5; // More retries for background data
    },
    retryDelay: (attemptIndex: number) => Math.min(2000 * 2 ** attemptIndex, 60000), // Slower backoff, max 60s
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  },
  
  // Real-time data with minimal caching
  realtime: {
    retry: (failureCount: number, error: ApiError) => {
      if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
        return false;
      }
      return failureCount < 2; // Fewer retries for real-time data
    },
    retryDelay: (attemptIndex: number) => 1000 * attemptIndex, // Linear backoff
    staleTime: 0, // Always fresh
    gcTime: 60 * 1000, // 1 minute
  },
};

// Default query configuration for admin operations
export const createAdminQueryOptions = <TData = unknown, TError = ApiError>(
  options?: Partial<UseQueryOptions<TData, TError>>
): UseQueryOptions<TData, TError> => ({
  ...RETRY_CONFIGS.admin,
  ...options,
  select: options?.select,
  onSuccess: (data) => {
    console.log('Query successful:', { timestamp: new Date().toISOString(), data });
    options?.onSuccess?.(data);
  },
  onError: (error: TError) => {
    console.error('Query failed:', {
      error,
      timestamp: new Date().toISOString(),
      queryKey: options?.queryKey,
    });
    options?.onError?.(error);
  },
});

// Default mutation configuration for admin operations
export const createAdminMutationOptions = <TData = unknown, TError = ApiError, TVariables = void>(
  options?: Partial<UseMutationOptions<TData, TError, TVariables>>
): UseMutationOptions<TData, TError, TVariables> => ({
  retry: (failureCount: number, error: TError) => {
    const apiError = error as ApiError;
    // Don't retry on validation errors or client errors
    if (apiError.statusCode && apiError.statusCode >= 400 && apiError.statusCode < 500) {
      return false;
    }
    // Retry mutations up to 2 times for server errors
    return failureCount < 2;
  },
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000), // Max 10s
  onMutate: async (variables) => {
    // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
    const queryClient = new QueryClient();
    await queryClient.cancelQueries({ queryKey: options?.mutationKey });
    
    // Snapshot the previous value
    const previousData = queryClient.getQueryData(options?.mutationKey);
    
    // Call the original onMutate if provided
    const originalResult = options?.onMutate?.(variables);
    
    return { previousData, ...originalResult };
  },
  onError: (error: TError, variables: TVariables, context) => {
    console.error('Mutation failed:', {
      error,
      variables,
      context,
      timestamp: new Date().toISOString(),
    });
    
    // Call the original onError if provided
    options?.onError?.(error, variables, context);
  },
  onSettled: (data, error, variables, context) => {
    // Always refetch after error or success
    const queryClient = new QueryClient();
    if (options?.mutationKey) {
      queryClient.invalidateQueries({ queryKey: options.mutationKey });
    }
    
    // Call the original onSettled if provided
    options?.onSettled?.(data, error, variables, context);
  },
  ...options,
});

// Error handling utilities
export const handleApiError = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    return {
      message: error.response?.data?.message || error.message || 'Network error occurred',
      code: error.code,
      statusCode: error.response?.status,
      details: error.response?.data,
      requestId: error.response?.headers['x-request-id'],
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
  };
};

// Query key factories for consistent cache keys
export const ADMIN_QUERY_KEYS = {
  providers: ['admin', 'providers'] as const,
  provider: (id: string | number) => ['admin', 'providers', id] as const,
  workflows: ['admin', 'workflows'] as const,
  workflow: (id: string | number) => ['admin', 'workflows', id] as const,
  agentMaps: (workflowId?: string | number) => 
    workflowId ? ['admin', 'agent-maps', workflowId] as const : ['admin', 'agent-maps'] as const,
  stats: ['admin', 'stats'] as const,
  alerts: ['admin', 'alerts'] as const,
  settings: ['admin', 'settings'] as const,
} as const;

// Prefetching utilities
export const prefetchAdminData = async (queryClient: QueryClient) => {
  // Prefetch commonly accessed data
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ADMIN_QUERY_KEYS.providers,
      queryFn: () => Promise.resolve([]), // Replace with actual query function
      ...RETRY_CONFIGS.background,
    }),
    queryClient.prefetchQuery({
      queryKey: ADMIN_QUERY_KEYS.workflows,
      queryFn: () => Promise.resolve([]), // Replace with actual query function
      ...RETRY_CONFIGS.background,
    }),
    queryClient.prefetchQuery({
      queryKey: ADMIN_QUERY_KEYS.stats,
      queryFn: () => Promise.resolve({}), // Replace with actual query function
      ...RETRY_CONFIGS.realtime,
    }),
  ]);
};

// Query client configuration
export const createAdminQueryClient = (): QueryClient => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...RETRY_CONFIGS.admin,
        refetchOnWindowFocus: false, // Don't refetch on window focus for admin
        refetchOnReconnect: true, // Do refetch on reconnect
        retryOnMount: true, // Retry on component mount
      },
      mutations: {
        retry: false, // Default to no retry for mutations (handled individually)
      },
    },
  });
};

// Devtools integration (only in development)
export const setupReactQueryDevtools = () => {
  if (process.env.NODE_ENV === 'development') {
    import('@tanstack/react-query-devtools').then(({ ReactQueryDevtools }) => {
      // ReactQueryDevtools will be available in the component tree
      console.log('React Query Devtools enabled');
    });
  }
};
