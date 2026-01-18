import React, { Suspense, lazy } from 'react';
import { LoadingSkeletonFallback } from '../common/FallbackUI';
import { AdminModalErrorBoundary } from '../common/ErrorBoundary';

// Lazy load admin modal components
const AdminModal = lazy(() => import('./AdminModal').then(module => ({
  default: module.AdminModal
})));

const ProvidersTab = lazy(() => import('./tabs/ProvidersTab').then(module => ({
  default: module.ProvidersTab
})));

const WorkflowsTab = lazy(() => import('./tabs/WorkflowsTab').then(module => ({
  default: module.WorkflowsTab
})));

const OperationsTab = lazy(() => import('./tabs/OperationsTab').then(module => ({
  default: module.OperationsTab
})));

const SettingsTab = lazy(() => import('./tabs/SettingsTab').then(module => ({
  default: module.SettingsTab
})));

// Loading fallback components
const AdminModalLoadingFallback: React.FC = () => (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <LoadingSkeletonFallback type="card" count={3} />
        </div>
      </div>
    </div>
  </div>
);

const TabLoadingFallback: React.FC<{ tabName: string }> = ({ tabName }) => (
  <div className="p-6">
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 text-gray-500">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span>Loading {tabName}...</span>
        </div>
      </div>
    </div>
  </div>
);

// Lazy Admin Modal wrapper
export const LazyAdminModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}> = ({ isOpen, onClose, initialTab }) => {
  if (!isOpen) return null;

  return (
    <AdminModalErrorBoundary>
      <Suspense fallback={<AdminModalLoadingFallback />}>
        <AdminModal isOpen={isOpen} onClose={onClose} initialTab={initialTab} />
      </Suspense>
    </AdminModalErrorBoundary>
  );
};

// Lazy tab components
export const LazyProvidersTab: React.FC<any> = (props) => (
  <AdminModalErrorBoundary context="ProvidersTab">
    <Suspense fallback={<TabLoadingFallback tabName="Providers" />}>
      <ProvidersTab {...props} />
    </Suspense>
  </AdminModalErrorBoundary>
);

export const LazyWorkflowsTab: React.FC<any> = (props) => (
  <AdminModalErrorBoundary context="WorkflowsTab">
    <Suspense fallback={<TabLoadingFallback tabName="Workflows" />}>
      <WorkflowsTab {...props} />
    </Suspense>
  </AdminModalErrorBoundary>
);

export const LazyOperationsTab: React.FC<any> = (props) => (
  <AdminModalErrorBoundary context="OperationsTab">
    <Suspense fallback={<TabLoadingFallback tabName="Operations" />}>
      <OperationsTab {...props} />
    </Suspense>
  </AdminModalErrorBoundary>
);

export const LazySettingsTab: React.FC<any> = (props) => (
  <AdminModalErrorBoundary context="SettingsTab">
    <Suspense fallback={<TabLoadingFallback tabName="Settings" />}>
      <SettingsTab {...props} />
    </Suspense>
  </AdminModalErrorBoundary>
);

// Preloading utilities
export const preloadAdminModal = () => {
  // Preload the admin modal component
  import('./AdminModal');
};

export const preloadProvidersTab = () => {
  import('./tabs/ProvidersTab');
};

export const preloadWorkflowsTab = () => {
  import('./tabs/WorkflowsTab');
};

export const preloadOperationsTab = () => {
  import('./tabs/OperationsTab');
};

export const preloadSettingsTab = () => {
  import('./tabs/SettingsTab');
};

// Preload all admin components
export const preloadAllAdminComponents = () => {
  preloadAdminModal();
  preloadProvidersTab();
  preloadWorkflowsTab();
  preloadOperationsTab();
  preloadSettingsTab();
};

// Hook for smart preloading based on user behavior
export const useSmartAdminPreloading = () => {
  const preloadTimeoutRef = React.useRef<NodeJS.Timeout>();

  const schedulePreload = React.useCallback((component: 'modal' | 'providers' | 'workflows' | 'operations' | 'settings', delay = 2000) => {
    // Clear any existing timeout
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }

    // Schedule new preload
    preloadTimeoutRef.current = setTimeout(() => {
      switch (component) {
        case 'modal':
          preloadAdminModal();
          break;
        case 'providers':
          preloadProvidersTab();
          break;
        case 'workflows':
          preloadWorkflowsTab();
          break;
        case 'operations':
          preloadOperationsTab();
          break;
        case 'settings':
          preloadSettingsTab();
          break;
      }
    }, delay);
  }, []);

  const cancelScheduledPreload = React.useCallback(() => {
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = undefined;
    }
  }, []);

  // Preload on hover (with delay)
  const onAdminButtonHover = React.useCallback(() => {
    schedulePreload('modal', 1000); // Preload modal after 1 second of hover
  }, [schedulePreload]);

  const onAdminButtonLeave = React.useCallback(() => {
    cancelScheduledPreload();
  }, [cancelScheduledPreload]);

  // Preload tab on tab hover
  const onTabHover = React.useCallback((tabName: string) => {
    schedulePreload(tabName as any, 500); // Preload tab after 0.5 seconds of hover
  }, [schedulePreload]);

  const onTabLeave = React.useCallback(() => {
    cancelScheduledPreload();
  }, [cancelScheduledPreload]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  return {
    onAdminButtonHover,
    onAdminButtonLeave,
    onTabHover,
    onTabLeave,
    preloadAll: preloadAllAdminComponents,
  };
};

// Bundle analysis utilities
export const useBundleAnalysis = () => {
  const [bundleInfo, setBundleInfo] = React.useState({
    adminModalLoaded: false,
    providersTabLoaded: false,
    workflowsTabLoaded: false,
    operationsTabLoaded: false,
    settingsTabLoaded: false,
    totalLoadTime: 0,
  });

  const trackComponentLoad = React.useCallback((component: string, loadTime: number) => {
    setBundleInfo(prev => ({
      ...prev,
      [`${component}Loaded`]: true,
      totalLoadTime: prev.totalLoadTime + loadTime,
    }));
  }, []);

  const getLoadMetrics = React.useCallback(() => {
    const loadedComponents = Object.entries(bundleInfo)
      .filter(([key, value]) => key.endsWith('Loaded') && value)
      .length;
    
    const totalComponents = 5; // Total admin components
    
    return {
      loadedComponents,
      totalComponents,
      loadPercentage: (loadedComponents / totalComponents) * 100,
      totalLoadTime: bundleInfo.totalLoadTime,
      averageLoadTime: bundleInfo.totalLoadTime / Math.max(loadedComponents, 1),
    };
  }, [bundleInfo]);

  return {
    bundleInfo,
    trackComponentLoad,
    getLoadMetrics,
  };
};
