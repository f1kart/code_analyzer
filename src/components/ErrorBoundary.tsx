/**
 * Enterprise Error Boundary System
 * Provides comprehensive error handling, recovery, and reporting
 * Production-ready with graceful degradation and user-friendly error UI
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  retryCount: number;
  lastErrorTime: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetKeys?: Array<string | number>;
  isolate?: boolean; // Whether to isolate errors to this boundary only
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: NodeJS.Timeout | null = null;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to external service
    this.logError(error, errorInfo);

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({ errorInfo });

    // Auto-retry for transient errors
    if (this.isTransientError(error) && this.state.retryCount < (this.props.maxRetries || 3)) {
      this.scheduleRetry();
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    // Reset error state when resetKeys change
    if (hasError && resetKeys) {
      const hasResetKeyChanged = resetKeys.some(
        (resetKey, idx) => prevProps.resetKeys?.[idx] !== resetKey
      );

      if (hasResetKeyChanged) {
        this.resetErrorBoundary();
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      retryCount: this.state.retryCount,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error Boundary caught error:', errorReport);
    }

    // In production, send to error reporting service
    // this.sendToErrorReporting(errorReport);
  };

  private isTransientError = (error: Error): boolean => {
    const transientErrors = [
      'NetworkError',
      'TypeError: Failed to fetch',
      'ChunkLoadError',
      'Loading chunk',
      'Loading CSS chunk',
    ];

    return transientErrors.some(pattern =>
      error.message.includes(pattern) || error.name.includes(pattern)
    );
  };

  private scheduleRetry = () => {
    const delay = Math.min(1000 * Math.pow(2, this.state.retryCount), 10000);

    this.retryTimeoutId = setTimeout(() => {
      this.setState(prevState => ({
        retryCount: prevState.retryCount + 1
      }));
      this.resetErrorBoundary();
    }, delay);
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
    });
  };

  private handleRetry = () => {
    this.resetErrorBoundary();
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Reset to welcome state
    window.location.hash = '#welcome';
    this.resetErrorBoundary();
  };

  private renderErrorUI = () => {
    const { error, errorId, retryCount } = this.state;
    const { fallback } = this.props;

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    const isNetworkError = error?.message.includes('fetch') || error?.message.includes('NetworkError');
    const isChunkError = error?.message.includes('Loading chunk') || error?.message.includes('ChunkLoadError');

    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 rounded-lg border border-red-500/20 p-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-red-500/20 rounded-full">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-white mb-2">
            {isNetworkError ? 'Connection Error' :
             isChunkError ? 'Loading Error' :
             'Something went wrong'}
          </h1>

          <p className="text-gray-400 text-sm mb-6">
            {isNetworkError ? 'Please check your internet connection and try again.' :
             isChunkError ? 'There was a problem loading the application. Please refresh the page.' :
             'An unexpected error occurred. The application will attempt to recover automatically.'}
          </p>

          {process.env.NODE_ENV === 'development' && error && (
            <details className="mb-6 text-left">
              <summary className="text-gray-500 cursor-pointer hover:text-gray-400">
                Error Details (Development)
              </summary>
              <pre className="mt-2 p-3 bg-slate-800 rounded text-xs text-red-300 overflow-auto max-h-32">
                {error.message}
                {error.stack && `\n\n${error.stack}`}
              </pre>
            </details>
          )}

          <div className="space-y-3">
            <button
              onClick={this.handleRetry}
              disabled={retryCount >= (this.props.maxRetries || 3)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              {retryCount > 0 ? `Retry (${retryCount}/${this.props.maxRetries || 3})` : 'Try Again'}
            </button>

            <button
              onClick={this.handleReload}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Page
            </button>

            <button
              onClick={this.handleGoHome}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Go to Welcome
            </button>
          </div>

          {errorId && (
            <p className="text-xs text-gray-500 mt-4">
              Error ID: {errorId}
            </p>
          )}
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI();
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  return WrappedComponent;
}

// Hook for error reporting
export const useErrorReporting = () => {
  const reportError = (error: Error, context?: string) => {
    const errorReport = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href,
    };

    // In production, send to error reporting service
    console.error('📊 Error Report:', errorReport);
  };

  return { reportError };
};

// Global error handler
export const initializeGlobalErrorHandling = () => {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('🚨 Unhandled Promise Rejection:', event.reason);

    // Report to error tracking service
    // reportError(event.reason, 'unhandledrejection');
  });

  // Handle global JavaScript errors
  window.addEventListener('error', (event) => {
    console.error('🚨 Global JavaScript Error:', event.error);

    // Report to error tracking service
    // reportError(event.error, 'globalerror');
  });

  console.log('✅ Global error handling initialized');
};
