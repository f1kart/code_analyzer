import React from 'react';
import { 
  ExclamationTriangleIcon,
  WifiIcon,
  ServerIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface FallbackUIProps {
  type: 'network' | 'server' | 'timeout' | 'unknown';
  title?: string;
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  showRetry?: boolean;
  className?: string;
}

export const FallbackUI: React.FC<FallbackUIProps> = ({
  type,
  title,
  message,
  onRetry,
  onDismiss,
  showRetry = true,
  className = '',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <WifiIcon className="h-8 w-8 text-orange-500" />;
      case 'server':
        return <ServerIcon className="h-8 w-8 text-red-500" />;
      case 'timeout':
        return <ClockIcon className="h-8 w-8 text-yellow-500" />;
      default:
        return <ExclamationTriangleIcon className="h-8 w-8 text-gray-500" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'network':
        return 'Network Connection Lost';
      case 'server':
        return 'Service Unavailable';
      case 'timeout':
        return 'Request Timeout';
      default:
        return 'Something Went Wrong';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'network':
        return 'Please check your internet connection and try again.';
      case 'server':
        return 'Our servers are experiencing issues. Please try again in a few moments.';
      case 'timeout':
        return 'The request took too long to complete. Please try again.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const getActionButtons = () => {
    const buttons = [];

    if (showRetry && onRetry) {
      buttons.push(
        <button
          key="retry"
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Try Again
        </button>
      );
    }

    if (onDismiss) {
      buttons.push(
        <button
          key="dismiss"
          onClick={onDismiss}
          className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          Dismiss
        </button>
      );
    }

    return buttons;
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <div className="flex-shrink-0 mb-4">
        {getIcon()}
      </div>
      
      <div className="max-w-md">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {title || getDefaultTitle()}
        </h3>
        
        <p className="text-sm text-gray-600 mb-6">
          {message || getDefaultMessage()}
        </p>

        <div className="flex justify-center space-x-3">
          {getActionButtons()}
        </div>
      </div>
    </div>
  );
};

// Specialized fallback components
export const NetworkErrorFallback: React.FC<{
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ onRetry, onDismiss, className }) => (
  <FallbackUI
    type="network"
    onRetry={onRetry}
    onDismiss={onDismiss}
    className={className}
  />
);

export const ServerErrorFallback: React.FC<{
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ onRetry, onDismiss, className }) => (
  <FallbackUI
    type="server"
    onRetry={onRetry}
    onDismiss={onDismiss}
    className={className}
  />
);

export const TimeoutErrorFallback: React.FC<{
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}> = ({ onRetry, onDismiss, className }) => (
  <FallbackUI
    type="timeout"
    onRetry={onRetry}
    onDismiss={onDismiss}
    className={className}
  />
);

// Admin-specific fallback components
export const AdminProviderListFallback: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
    <div className="text-center">
      <ServerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Unable to Load Providers
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        We couldn't fetch the AI providers list. Please check your connection and try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Reload Providers
        </button>
      )}
    </div>
  </div>
);

export const AdminWorkflowListFallback: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
    <div className="text-center">
      <ExclamationTriangleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Unable to Load Workflows
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        We couldn't fetch the workflows list. Please check your connection and try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <ArrowPathIcon className="h-4 w-4 mr-2" />
          Reload Workflows
        </button>
      )}
    </div>
  </div>
);

export const AdminModalFallback: React.FC<{
  onRetry?: () => void;
  onClose?: () => void;
}> = ({ onRetry, onClose }) => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Admin Panel Unavailable
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            The admin panel is currently experiencing technical difficulties. 
            Please try again later or contact support if the issue persists.
          </p>
          
          <div className="flex space-x-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700"
              >
                Try Again
              </button>
            )}
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm font-medium hover:bg-gray-300"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Loading skeleton fallback
export const LoadingSkeletonFallback: React.FC<{
  type?: 'list' | 'card' | 'table';
  count?: number;
}> = ({ type = 'list', count = 3 }) => {
  const getSkeletonItem = () => {
    switch (type) {
      case 'card':
        return (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        );
      case 'table':
        return (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/5"></div>
            </div>
          </div>
        );
      default:
        return (
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index}>{getSkeletonItem()}</div>
      ))}
    </div>
  );
};
