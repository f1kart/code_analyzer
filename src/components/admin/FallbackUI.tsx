import React from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon, WifiIcon, ServerStackIcon } from '@heroicons/react/24/outline';
import './AdminComponents.css';

export interface FallbackUIProps {
  type: 'network' | 'server' | 'loading' | 'empty' | 'permission';
  title?: string;
  message?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  className?: string;
}

export const FallbackUI: React.FC<FallbackUIProps> = ({
  type,
  title,
  message,
  onRetry,
  onRefresh,
  className = '',
}) => {
  const getIcon = () => {
    switch (type) {
      case 'network':
        return <WifiIcon className="w-8 h-8 text-brand-yellow" />;
      case 'server':
        return <ServerStackIcon className="w-8 h-8 text-brand-red" />;
      case 'loading':
        return <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />;
      case 'permission':
        return <ExclamationTriangleIcon className="w-8 h-8 text-orange-500" />;
      case 'empty':
        return <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <span className="text-gray-400 text-lg">—</span>
        </div>;
      default:
        return <ExclamationTriangleIcon className="w-8 h-8 text-brand-red" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case 'network':
        return 'Network Error';
      case 'server':
        return 'Service Unavailable';
      case 'loading':
        return 'Loading...';
      case 'permission':
        return 'Access Denied';
      case 'empty':
        return 'No Data';
      default:
        return 'Error';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'network':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      case 'server':
        return 'The server is temporarily unavailable. Please try again in a few moments.';
      case 'loading':
        return 'Please wait while we load your data...';
      case 'permission':
        return 'You don\'t have permission to access this resource. Please contact your administrator.';
      case 'empty':
        return 'No data available at this time.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  };

  const getActions = () => {
    if (type === 'loading') return null;

    return (
      <div className="flex gap-2 mt-4">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 text-sm bg-brand-blue hover:bg-blue-600 text-white rounded-md transition-colors flex items-center gap-2"
          >
            <ArrowPathIcon className="w-4 h-4" />
            Retry
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm bg-interactive hover:bg-panel-light text-text-primary rounded-md transition-colors"
          >
            Refresh
          </button>
        )}
      </div>
    );
  };

  return (
    <div className={`fallback-container ${className}`}>
      <div className="fallback-icon">
        {getIcon()}
      </div>
      <h3 className="fallback-title">
        {title || getDefaultTitle()}
      </h3>
      <p className="fallback-message">
        {message || getDefaultMessage()}
      </p>
      {getActions()}
    </div>
  );
};

// Specific fallback components for different contexts
export const ProvidersFallback: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <FallbackUI
    type="server"
    title="Providers Unavailable"
    message="Unable to load model providers. This may be due to a network issue or server maintenance."
    onRetry={onRetry}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

export const WorkflowsFallback: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <FallbackUI
    type="server"
    title="Workflows Unavailable"
    message="Unable to load workflows. Please check your connection and try again."
    onRetry={onRetry}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

export const OperationsFallback: React.FC<{
  onRetry?: () => void;
}> = ({ onRetry }) => (
  <FallbackUI
    type="server"
    title="System Status Unavailable"
    message="Unable to load system health information. The monitoring service may be temporarily down."
    onRetry={onRetry}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

export const NetworkErrorFallback: React.FC<{
  onRetry?: () => void;
  onRefresh?: () => void;
}> = ({ onRetry, onRefresh }) => (
  <FallbackUI
    type="network"
    onRetry={onRetry}
    onRefresh={onRefresh}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

export const PermissionErrorFallback: React.FC<{
  onRefresh?: () => void;
}> = ({ onRefresh }) => (
  <FallbackUI
    type="permission"
    title="Access Restricted"
    message="You don't have sufficient permissions to access admin features. Please contact your system administrator."
    onRefresh={onRefresh}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

export const EmptyStateFallback: React.FC<{
  resource: string;
  onCreate?: () => void;
}> = ({ resource, onCreate }) => (
  <FallbackUI
    type="empty"
    title={`No ${resource} Found`}
    message={`There are no ${resource.toLowerCase()} configured yet. ${onCreate ? 'Create your first item to get started.' : ''}`}
    onRetry={onCreate}
    className="h-64 bg-panel border border-border rounded-lg"
  />
);

// Loading skeleton components
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
}> = ({ rows = 5, columns = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 p-2 border border-border rounded">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <div
            key={colIndex}
            className="h-4 bg-gray-200 rounded animate-pulse"
            style={{ flex: 1 }}
          />
        ))}
      </div>
    ))}
  </div>
);

export const CardSkeleton: React.FC<{
  count?: number;
}> = ({ count = 3 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, index) => (
      <div key={index} className="bg-panel border border-border rounded-lg p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
      </div>
    ))}
  </div>
);

export const ListSkeleton: React.FC<{
  items?: number;
}> = ({ items = 4 }) => (
  <div className="space-y-2">
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex items-center gap-3 p-3 bg-panel border border-border rounded">
        <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
        </div>
      </div>
    ))}
  </div>
);
