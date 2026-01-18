import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  context?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to monitoring service
    console.error(`[ErrorBoundary${this.props.context ? `:${this.props.context}` : ''}] ${this.state.errorId}:`, {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      context: this.props.context,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send to error reporting service (in production)
    if (process.env.NODE_ENV === 'production') {
      // Integration with error reporting service like Sentry, LogRocket, etc.
      this.reportError(error, errorInfo);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // Placeholder for error reporting service integration
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    
    // For now, log to console with structured format
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', JSON.stringify(errorReport, null, 2));
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-[200px] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Something went wrong
                </h3>
                <p className="text-sm text-gray-500">
                  {this.props.context ? `${this.props.context} encountered an error` : 'An unexpected error occurred'}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-600 mb-1">Error ID:</p>
                <code className="text-xs font-mono text-gray-800">{this.state.errorId}</code>
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="bg-gray-50 rounded p-3">
                  <summary className="text-xs font-medium text-gray-700 cursor-pointer">
                    Error Details (Development)
                  </summary>
                  <div className="mt-2 text-xs font-mono text-red-600 whitespace-pre-wrap">
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <>
                        {'\n\n'}
                        Stack Trace:
                        {'\n'}
                        {this.state.error.stack}
                      </>
                    )}
                  </div>
                </details>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={this.handleRetry}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={this.handleReload}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300 transition-colors"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Specialized error boundaries for specific contexts
export const AdminModalErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ErrorBoundary context="AdminModal">
    {children}
  </ErrorBoundary>
);

export const AdminTabErrorBoundary: React.FC<{ children: ReactNode; tabName?: string }> = ({ 
  children, 
  tabName 
}) => (
  <ErrorBoundary context={`AdminTab${tabName ? `:${tabName}` : ''}`}>
    {children}
  </ErrorBoundary>
);

export const QueryErrorBoundary: React.FC<{ children: ReactNode; queryKey?: string }> = ({ 
  children, 
  queryKey 
}) => (
  <ErrorBoundary context={`Query${queryKey ? `:${queryKey}` : ''}`}>
    {children}
  </ErrorBoundary>
);

// Hook for using error boundaries in functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo, context?: string) => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.error(`[useErrorHandler${context ? `:${context}` : ''}] ${errorId}:`, {
      error: error.message,
      stack: error.stack,
      errorInfo,
      context,
    });

    // In production, send to error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Integration with error reporting service
      console.error('Error Report:', JSON.stringify({
        errorId,
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
      }, null, 2));
    }
  };
};
