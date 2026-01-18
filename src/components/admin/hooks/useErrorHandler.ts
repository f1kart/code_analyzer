import { useCallback } from 'react';
import { useAdminModalStore } from '../state/adminModalStore';

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorMetadata {
  timestamp: string;
  context: ErrorContext;
  stack?: string;
  userAgent?: string;
  url?: string;
}

export class AppError extends Error {
  public readonly metadata: ErrorMetadata;
  public readonly originalError?: Error;

  constructor(
    message: string,
    context: ErrorContext,
    originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    this.originalError = originalError;
    
    this.metadata = {
      timestamp: new Date().toISOString(),
      context,
      stack: this.stack,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    };

    // Maintain prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const useErrorHandler = () => {
  const { showToast } = useAdminModalStore();

  const handleError = useCallback(
    (
      error: Error | AppError | string,
      context: ErrorContext,
      showToastMessage = true
    ) => {
      let appError: AppError;

      if (typeof error === 'string') {
        appError = new AppError(error, context);
      } else if (error instanceof AppError) {
        appError = error;
      } else {
        appError = new AppError(error.message, context, error);
      }

      // Log error with full context
      console.error('Application Error:', {
        message: appError.message,
        metadata: appError.metadata,
        originalError: appError.originalError,
      });

      // Send to external monitoring service
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'exception', {
          description: appError.message,
          fatal: false,
          custom_parameter_1: context.operation,
          custom_parameter_2: context.component || 'unknown',
        });
      }

      // Show user-friendly toast message
      if (showToastMessage) {
        const userMessage = getUserFriendlyMessage(appError, context);
        showToast('error', userMessage);
      }

      return appError;
    },
    [showToast]
  );

  const handleAsyncError = useCallback(
    async (
      asyncOperation: () => Promise<any>,
      context: ErrorContext,
      showLoadingToast = false
    ) => {
      try {
        if (showLoadingToast) {
          showToast('info', `Starting ${context.operation}...`);
        }
        
        const result = await asyncOperation();
        
        if (showLoadingToast) {
          showToast('success', `${context.operation} completed successfully`);
        }
        
        return result;
      } catch (error) {
        handleError(error as Error, context);
        throw error;
      }
    },
    [handleError, showToast]
  );

  const createErrorBoundaryHandler = useCallback(
    (component: string) => (error: Error, errorInfo: ErrorInfo) => {
      handleError(error, {
        operation: 'render',
        component,
        additionalData: {
          componentStack: errorInfo.componentStack,
        },
      });
    },
    [handleError]
  );

  return {
    handleError,
    handleAsyncError,
    createErrorBoundaryHandler,
  };
};

// Helper function to generate user-friendly error messages
function getUserFriendlyMessage(error: AppError, context: ErrorContext): string {
  const { operation, component } = context;

  // Network-related errors
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Permission-related errors
  if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    return 'You don\'t have permission to perform this action.';
  }

  // Validation errors
  if (error.message.includes('validation') || error.message.includes('invalid')) {
    return 'Please check your input and try again.';
  }

  // Not found errors
  if (error.message.includes('not found') || error.message.includes('404')) {
    return 'The requested resource was not found.';
  }

  // Server errors
  if (error.message.includes('500') || error.message.includes('server error')) {
    return 'Server error occurred. Please try again later.';
  }

  // Component-specific messages
  switch (component) {
    case 'ProvidersTab':
      return operation === 'create' 
        ? 'Failed to create provider. Please check your settings.'
        : 'Failed to load providers. Please refresh the page.';
    
    case 'WorkflowsTab':
      return operation === 'create'
        ? 'Failed to create workflow. Please check your workflow definition.'
        : 'Failed to load workflows. Please refresh the page.';
    
    case 'OperationsTab':
      return 'Failed to load system information. Please try again later.';
    
    default:
      return `An error occurred in ${component || 'the application'}. Please try again.`;
  }
}

// Error context factory functions
export const createErrorContext = (
  operation: string,
  component?: string,
  additionalData?: Record<string, any>
): ErrorContext => ({
  operation,
  component,
  userId: typeof window !== 'undefined' 
    ? (window as any).user?.id 
    : undefined,
  additionalData,
});

// Common error contexts
export const ErrorContexts = {
  PROVIDER_CREATE: createErrorContext('create', 'ProvidersTab'),
  PROVIDER_DELETE: createErrorContext('delete', 'ProvidersTab'),
  PROVIDER_LOAD: createErrorContext('load', 'ProvidersTab'),
  
  WORKFLOW_CREATE: createErrorContext('create', 'WorkflowsTab'),
  WORKFLOW_UPDATE: createErrorContext('update', 'WorkflowsTab'),
  WORKFLOW_DELETE: createErrorContext('delete', 'WorkflowsTab'),
  WORKFLOW_LOAD: createErrorContext('load', 'WorkflowsTab'),
  
  AGENT_MAP_SET: createErrorContext('set', 'WorkflowsTab'),
  AGENT_MAP_LOAD: createErrorContext('load', 'WorkflowsTab'),
  
  STATS_LOAD: createErrorContext('load', 'OperationsTab'),
  ALERTS_LOAD: createErrorContext('load', 'OperationsTab'),
  
  MODAL_OPEN: createErrorContext('open', 'AdminModal'),
  MODAL_CLOSE: createErrorContext('close', 'AdminModal'),
} as const;

// Standalone error handler for use outside React components (e.g., in QueryClient config)
export const handleError = (
  error: Error | AppError | string,
  context: ErrorContext,
  _showToastMessage = false
): AppError => {
  let appError: AppError;

  if (typeof error === 'string') {
    appError = new AppError(error, context);
  } else if (error instanceof AppError) {
    appError = error;
  } else {
    appError = new AppError(error.message, context, error);
  }

  // Log error with full context
  console.error('Application Error:', {
    message: appError.message,
    metadata: appError.metadata,
    originalError: appError.originalError,
  });

  // Send to external monitoring service
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'exception', {
      description: appError.message,
      fatal: false,
      custom_parameter_1: context.operation,
      custom_parameter_2: context.component || 'unknown',
    });
  }

  return appError;
};
