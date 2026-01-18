import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AdminModal Error Boundary caught an error:', error, errorInfo);
    
    // Log to external service in production
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: error.toString(),
        fatal: false,
      });
    }

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-8 h-96 bg-panel border border-border rounded-lg">
          <ExclamationTriangleIcon className="w-12 h-12 text-brand-red mb-4" />
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-text-secondary text-center mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred while loading this component.'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2 text-sm bg-brand-blue hover:bg-blue-600 text-white rounded-md transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-interactive hover:bg-panel-light text-text-primary rounded-md transition-colors"
            >
              Reload Page
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 text-xs text-text-secondary bg-panel-light p-2 rounded max-w-full overflow-auto">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error.stack}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Tab-specific error boundary with contextual fallbacks
export const TabErrorBoundary: React.FC<{
  children: ReactNode;
  tabName: string;
  onRetry?: () => void;
}> = ({ children, tabName, onRetry }) => {
  return (
    <AdminErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center p-8 h-64 bg-panel border border-border rounded-lg">
          <ExclamationTriangleIcon className="w-8 h-8 text-brand-red mb-2" />
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            {tabName} Tab Error
          </h3>
          <p className="text-xs text-text-secondary text-center mb-3">
            Failed to load {tabName.toLowerCase()} tab. Please try again.
          </p>
          <button
            onClick={onRetry}
            className="px-3 py-1 text-xs bg-brand-blue hover:bg-blue-600 text-white rounded transition-colors"
          >
            Retry
          </button>
        </div>
      }
      onError={(error) => {
        console.error(`Error in ${tabName} tab:`, error);
      }}
    >
      {children}
    </AdminErrorBoundary>
  );
};

// Async error boundary for promise rejections
export class AsyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Async operation error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-yellow-800">
                Operation Failed
              </h4>
              <p className="text-xs text-yellow-700 mt-1">
                {this.state.error?.message || 'An async operation failed to complete.'}
              </p>
              <button
                onClick={this.handleRetry}
                className="mt-2 text-xs text-yellow-600 underline hover:text-yellow-800"
              >
                Retry Operation
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
