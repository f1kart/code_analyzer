import React, { Suspense, lazy } from 'react';
import { TABS, ToastType } from './adminModalShared';

// Lazy load tab components for code splitting
const TeamTab = lazy(() => 
  import('./tabs/TeamTab').then(module => ({
    default: module.TeamTab
  }))
);

const AgentBehaviorTab = lazy(() => 
  import('./tabs/AgentBehaviorTab').then(module => ({
    default: module.AgentBehaviorTab
  }))
);

const ProvidersTab = lazy(() => 
  import('./tabs/ProvidersTab').then(module => ({
    default: module.default
  }))
);

const WorkflowsTab = lazy(() => 
  import('./tabs/WorkflowsTab').then(module => ({
    default: module.default
  }))
);

const ToolsTab = lazy(() => 
  import('./tabs/ToolsTab').then(module => ({
    default: module.ToolsTab
  }))
);

const DesktopTab = lazy(() => 
  import('./tabs/DesktopTab').then(module => ({
    default: module.DesktopTab
  }))
);

const EnterpriseToolsTab = lazy(() => 
  import('./tabs/EnterpriseToolsTab').then(module => ({
    default: module.EnterpriseToolsTab
  }))
);

const OperationsTab = lazy(() => 
  import('./tabs/OperationsTab').then(module => ({
    default: module.OperationsTab
  }))
);

// Loading fallback component
const TabLoadingFallback: React.FC<{ tabName: string }> = ({ tabName }) => (
  <div className="flex flex-col items-center justify-center p-8 h-64">
    <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin mb-4" />
    <p className="text-sm text-text-secondary">Loading {tabName}...</p>
  </div>
);

// Error boundary for lazy loaded components
const LazyTabErrorBoundary: React.FC<{
  children: React.ReactNode;
  tabName: string;
  onRetry?: () => void;
}> = ({ children, tabName, onRetry: _onRetry }) => (
  <Suspense 
    fallback={<TabLoadingFallback tabName={tabName} />}
  >
    {children}
  </Suspense>
);

// Lazy tab renderer interface
interface LazyTabRendererProps {
  activeTab: string;
  localSettings: AppSettings;
  dispatch: React.Dispatch<any>;
  selectedAgent: any;
  setSelectedAgent: (agent: any) => void;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  providers?: any[];
  isOpen: boolean;
  onSave: (settings: AppSettings) => void;
}

// Main lazy tab renderer component
export const LazyTabRenderer: React.FC<LazyTabRendererProps> = ({
  activeTab,
  localSettings,
  dispatch,
  selectedAgent,
  setSelectedAgent,
  showToast,
  providers,
  isOpen: _isOpen,
  onSave: _onSave,
}) => {
  const renderTab = () => {
    switch (activeTab) {
      case TABS.GENERAL:
        return (
          <LazyTabErrorBoundary tabName="General Settings">
            <TeamTab localSettings={localSettings} dispatch={dispatch} />
          </LazyTabErrorBoundary>
        );

      case TABS.TEAM:
        return (
          <LazyTabErrorBoundary tabName="Team Settings">
            <TeamTab localSettings={localSettings} dispatch={dispatch} />
          </LazyTabErrorBoundary>
        );

      case TABS.AGENT_BEHAVIOR:
        return (
          <LazyTabErrorBoundary tabName="Agent Behavior">
            <AgentBehaviorTab
              localSettings={localSettings}
              dispatch={dispatch}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
            />
          </LazyTabErrorBoundary>
        );

      case TABS.PROVIDERS:
        return (
          <LazyTabErrorBoundary tabName="Model Providers">
            <ProvidersTab showToast={showToast} />
          </LazyTabErrorBoundary>
        );

      case TABS.WORKFLOWS:
        return (
          <LazyTabErrorBoundary tabName="Workflows">
            <WorkflowsTab 
              localSettings={localSettings} 
              showToast={showToast} 
              providers={providers || []} 
            />
          </LazyTabErrorBoundary>
        );

      case TABS.TOOLS:
        return (
          <LazyTabErrorBoundary tabName="Tools">
            <ToolsTab localSettings={localSettings} dispatch={dispatch} />
          </LazyTabErrorBoundary>
        );

      case TABS.DESKTOP:
        return (
          <LazyTabErrorBoundary tabName="Desktop Settings">
            <DesktopTab localSettings={localSettings} dispatch={dispatch} />
          </LazyTabErrorBoundary>
        );

      case TABS.ENTERPRISE_TOOLS:
        return (
          <LazyTabErrorBoundary tabName="Enterprise Tools">
            <EnterpriseToolsTab />
          </LazyTabErrorBoundary>
        );

      case TABS.OPERATIONS:
        return (
          <LazyTabErrorBoundary tabName="Operations">
            <OperationsTab />
          </LazyTabErrorBoundary>
        );

      default:
        return (
          <div className="p-4 text-center text-text-secondary">
            Unknown tab selected
          </div>
        );
    }
  };

  return renderTab();
};

// Preload tab components for better UX
export const preloadTab = (tabId: string) => {
  switch (tabId) {
    case TABS.GENERAL:
    case TABS.TEAM:
      import('./tabs/TeamTab');
      break;
    case TABS.AGENT_BEHAVIOR:
      import('./tabs/AgentBehaviorTab');
      break;
    case TABS.PROVIDERS:
      import('./tabs/ProvidersTab');
      break;
    case TABS.WORKFLOWS:
      import('./tabs/WorkflowsTab');
      break;
    case TABS.TOOLS:
      import('./tabs/ToolsTab');
      break;
    case TABS.DESKTOP:
      import('./tabs/DesktopTab');
      break;
    case TABS.ENTERPRISE_TOOLS:
      import('./tabs/EnterpriseToolsTab');
      break;
    case TABS.OPERATIONS:
      import('./tabs/OperationsTab');
      break;
    default:
      break;
  }
};

// Preload commonly used tabs
export const preloadCommonTabs = () => {
  // Preload the most commonly accessed tabs
  preloadTab(TABS.PROVIDERS);
  preloadTab(TABS.WORKFLOWS);
  preloadTab(TABS.GENERAL);
};

export default LazyTabRenderer;
