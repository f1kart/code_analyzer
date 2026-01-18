import React from 'react';

// Individual Loading Indicator Component
interface LoadingIndicatorProps {
  isLoading: boolean;
  action: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'pulse' | 'dots' | 'bar';
  className?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  isLoading,
  action,
  size = 'md',
  variant = 'spinner',
  className = '',
}) => {
  if (!isLoading) return null;

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const renderSpinner = () => (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-spin rounded-full border-2 border-brand-blue border-t-transparent"></div>
    </div>
  );

  const renderPulse = () => (
    <div className={`${sizeClasses[size]} ${className}`}>
      <div className="animate-pulse bg-brand-blue rounded-full"></div>
    </div>
  );

  const renderDots = () => (
    <div className={`flex space-x-1 ${className}`}>
      <div
        className={`${size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'} bg-brand-blue rounded-full animate-bounce animation-delay-0`}
      ></div>
      <div
        className={`${size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'} bg-brand-blue rounded-full animate-bounce animation-delay-150`}
      ></div>
      <div
        className={`${size === 'sm' ? 'w-1 h-1' : size === 'md' ? 'w-2 h-2' : 'w-3 h-3'} bg-brand-blue rounded-full animate-bounce animation-delay-300`}
      ></div>
    </div>
  );

  const renderBar = () => (
    <div className={`w-full bg-gray-700 rounded-full h-2 ${className}`}>
      <div className="bg-brand-blue h-2 rounded-full animate-pulse w-3/5"></div>
    </div>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      case 'bar':
        return renderBar();
      default:
        return renderSpinner();
    }
  };

  return (
    <div className="flex items-center space-x-2" title={`Loading: ${action}`}>
      {renderVariant()}
      <span className="text-xs text-text-secondary">{action}...</span>
    </div>
  );
};

// Granular Loading Indicators for specific AI actions
interface AIActionLoadingProps {
  loadingStates: { [key: string]: boolean };
}

export const AIActionLoadingIndicators: React.FC<AIActionLoadingProps> = ({ loadingStates }) => {
  const actionLabels = {
    simpleRefactor: 'Quick Refactor',
    aiTeamRefactor: 'AI Team Refactor',
    aiTeamProjectRefactor: 'Project Scan',
    analyze: 'Code Analysis',
    findSimilarCode: 'Finding Similar Code',
    projectSearch: 'Project Search',
    analyzeDependencies: 'Dependency Analysis',
    generateTests: 'Generating Tests',
    generateDocs: 'Generating Documentation',
    debugError: 'Debug Analysis',
    chat: 'AI Chat',
    explainCode: 'Code Explanation',
    summarizePlaceholders: 'Placeholder Analysis',
  };

  const activeLoadings = Object.entries(loadingStates)
    .filter(([_, isLoading]) => isLoading)
    .map(([action]) => action);

  if (activeLoadings.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {activeLoadings.map((action) => (
        <div
          key={action}
          className="bg-panel border border-border rounded-lg p-3 shadow-lg backdrop-blur-sm"
        >
          <LoadingIndicator
            isLoading={true}
            action={actionLabels[action as keyof typeof actionLabels] || action}
            size="sm"
            variant="dots"
          />
        </div>
      ))}
    </div>
  );
};

// Top Bar Loading Indicator
interface TopBarLoaderProps {
  isLoading: boolean;
  progress?: number;
}

export const TopBarLoader: React.FC<TopBarLoaderProps> = ({ isLoading, progress }) => {
  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-gradient-to-r from-brand-blue to-brand-green transition-all duration-300 ease-out"
          style={{
            width: progress !== undefined ? `${progress}%` : '100%',
          }}
        />
      </div>
    </div>
  );
};

// Inline Loading Spinner for buttons
interface InlineLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  size?: 'sm' | 'md';
}

export const InlineLoading: React.FC<InlineLoadingProps> = ({
  isLoading,
  children,
  loadingText,
  size = 'sm',
}) => {
  if (!isLoading) return <>{children}</>;

  const spinnerSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <div className="flex items-center space-x-2">
      <div
        className={`${spinnerSize} animate-spin rounded-full border-2 border-current border-t-transparent opacity-75`}
      />
      <span>{loadingText || 'Loading...'}</span>
    </div>
  );
};

// Loading Overlay for panels
interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  children,
}) => {
  return (
    <div className="relative">
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center">
            <LoadingIndicator isLoading={true} action={message} size="lg" variant="spinner" />
          </div>
        </div>
      )}
    </div>
  );
};

// Skeleton Loading for content
interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', lines = 1 }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className={`bg-gray-700 rounded h-4 ${index > 0 ? 'mt-2' : ''} ${index === lines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  );
};

export default {
  LoadingIndicator,
  AIActionLoadingIndicators,
  TopBarLoader,
  InlineLoading,
  LoadingOverlay,
  Skeleton,
};
