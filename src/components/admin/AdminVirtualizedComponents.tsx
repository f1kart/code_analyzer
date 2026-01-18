import React, { useMemo, useState, useCallback } from 'react';
import { VirtualizedList, VirtualizedItem } from './VirtualizedList';
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
  ServerIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { AdminModalErrorBoundary } from '../common/ErrorBoundary';
import { LoadingSkeletonFallback } from '../common/FallbackUI';

// Mock useAdminQueries hook - replace with actual implementation
const useAdminQueries = () => ({
  providers: {
    data: [],
    isLoading: false,
    error: null
  },
  workflows: {
    data: [],
    isLoading: false,
    error: null
  }
});

// Provider interface
export interface AdminProvider extends VirtualizedItem {
  id: number;
  name: string;
  provider: string;
  modelId: string;
  baseUrl?: string;
  apiKeyRef: string;
  status: 'active' | 'inactive' | 'error';
  lastUsed?: string;
  requestCount?: number;
  errorRate?: number;
  createdAt: string;
  updatedAt: string;
}

// Workflow interface
export interface AdminWorkflow extends VirtualizedItem {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'draft';
  definition: {
    steps: Array<{
      type: string;
      name: string;
      config: any;
    }>;
  };
  executionCount: number;
  avgExecutionTime: number;
  successRate: number;
  lastExecuted?: string;
  createdAt: string;
  updatedAt: string;
}

// Virtualized Provider List
export const VirtualizedProviderList: React.FC<{
  height?: number;
  onEdit?: (provider: AdminProvider) => void;
  onDelete?: (provider: AdminProvider) => void;
  onView?: (provider: AdminProvider) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: number[]) => void;
}> = ({ 
  height = 400,
  onEdit,
  onDelete,
  onView,
  selectable = false,
  onSelectionChange
}) => {
  const { providers, isLoading, error } = useAdminQueries();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Transform provider data for virtualization
  const providerItems = useMemo(() => {
    return providers.data?.map(provider => ({
      ...provider,
      status: 'active', // Default status
      requestCount: Math.floor(Math.random() * 1000),
      errorRate: Math.random() * 5,
      lastUsed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    })) || [];
  }, [providers.data]);

  const handleSelection = useCallback((providerId: number, selected: boolean) => {
    const newSelectedIds = selected 
      ? [...selectedIds, providerId]
      : selectedIds.filter(id => id !== providerId);
    
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  }, [selectedIds, onSelectionChange]);

  const handleSelectAll = useCallback((selected: boolean) => {
    const newSelectedIds = selected ? providerItems.map(p => p.id) : [];
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  }, [providerItems, onSelectionChange]);

  const toggleExpanded = useCallback((providerId: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(providerId)) {
        newSet.delete(providerId);
      } else {
        newSet.add(providerId);
      }
      return newSet;
    });
  }, []);

  const renderProviderItem = useCallback((provider: AdminProvider, _index: number) => {
    const isExpanded = expandedIds.has(provider.id);
    const isSelected = selectedIds.includes(provider.id);
    
    return (
      <div className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleSelection(provider.id, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  title={`Select provider ${provider.name}`}
                  aria-label={`Select provider ${provider.name}`}
                />
              )}
              
              <button
                onClick={() => toggleExpanded(provider.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                )}
              </button>

              <div className="flex items-center space-x-2">
                <ServerIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{provider.name}</h4>
                  <p className="text-xs text-gray-500">{provider.provider} • {provider.modelId}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                provider.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : provider.status === 'error'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {provider.status}
              </span>

              <div className="flex items-center space-x-1">
                {onView && (
                  <button
                    onClick={() => onView(provider)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="View details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => onEdit(provider)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit provider"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(provider)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete provider"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pl-8 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Base URL:</span>
                <span className="font-mono">{provider.baseUrl || 'Default'}</span>
              </div>
              <div className="flex justify-between">
                <span>API Key Reference:</span>
                <span className="font-mono">{provider.apiKeyRef}</span>
              </div>
              <div className="flex justify-between">
                <span>Request Count:</span>
                <span>{provider.requestCount?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Error Rate:</span>
                <span className={provider.errorRate && provider.errorRate > 2 ? 'text-red-600' : 'text-green-600'}>
                  {provider.errorRate?.toFixed(2) || 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Used:</span>
                <span>{provider.lastUsed ? new Date(provider.lastUsed).toLocaleString() : 'Never'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [expandedIds, selectedIds, selectable, onView, onEdit, onDelete, handleSelection, toggleExpanded]);

  if (isLoading) {
    return <LoadingSkeletonFallback type="list" count={5} />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load providers</p>
      </div>
    );
  }

  return (
    <AdminModalErrorBoundary>
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {selectable && providerItems.length > 0 && (
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.length === providerItems.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">
                Select all ({selectedIds.length} of {providerItems.length} selected)
              </span>
            </label>
          </div>
        )}
        
        <VirtualizedList
          items={providerItems}
          height={height}
          itemHeight={isExpanded ? 120 : 60}
          renderItem={renderProviderItem}
          emptyState={
            <div className="p-8 text-center text-gray-500">
              <ServerIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No providers configured</p>
            </div>
          }
        />
      </div>
    </AdminModalErrorBoundary>
  );
};

// Virtualized Workflow List
export const VirtualizedWorkflowList: React.FC<{
  height?: number;
  onEdit?: (workflow: AdminWorkflow) => void;
  onDelete?: (workflow: AdminWorkflow) => void;
  onView?: (workflow: AdminWorkflow) => void;
  selectable?: boolean;
  onSelectionChange?: (selectedIds: number[]) => void;
}> = ({ 
  height = 400,
  onEdit,
  onDelete,
  onView,
  selectable = false,
  onSelectionChange
}) => {
  const { workflows, isLoading, error } = useAdminQueries();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Transform workflow data for virtualization
  const workflowItems = useMemo(() => {
    return workflows.data?.map(workflow => ({
      ...workflow,
      status: 'active' as const,
      executionCount: Math.floor(Math.random() * 100),
      avgExecutionTime: Math.floor(Math.random() * 3000) + 500,
      successRate: 95 + Math.random() * 5,
      lastExecuted: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    })) || [];
  }, [workflows.data]);

  const handleSelection = useCallback((workflowId: number, selected: boolean) => {
    const newSelectedIds = selected 
      ? [...selectedIds, workflowId]
      : selectedIds.filter(id => id !== workflowId);
    
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  }, [selectedIds, onSelectionChange]);

  const handleSelectAll = useCallback((selected: boolean) => {
    const newSelectedIds = selected ? workflowItems.map(w => w.id) : [];
    setSelectedIds(newSelectedIds);
    onSelectionChange?.(newSelectedIds);
  }, [workflowItems, onSelectionChange]);

  const toggleExpanded = useCallback((workflowId: number) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(workflowId)) {
        newSet.delete(workflowId);
      } else {
        newSet.add(workflowId);
      }
      return newSet;
    });
  }, []);

  const renderWorkflowItem = useCallback((workflow: AdminWorkflow, _index: number) => {
    const isExpanded = expandedIds.has(workflow.id);
    const isSelected = selectedIds.includes(workflow.id);
    
    return (
      <div className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {selectable && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleSelection(workflow.id, e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  title={`Select workflow ${workflow.name}`}
                  aria-label={`Select workflow ${workflow.name}`}
                />
              )}
              
              <button
                onClick={() => toggleExpanded(workflow.id)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                )}
              </button>

              <div className="flex items-center space-x-2">
                <DocumentTextIcon className="h-5 w-5 text-gray-400" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{workflow.name}</h4>
                  <p className="text-xs text-gray-500">{workflow.definition.steps.length} steps</p>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                workflow.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : workflow.status === 'draft'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {workflow.status}
              </span>

              <div className="flex items-center space-x-1">
                {onView && (
                  <button
                    onClick={() => onView(workflow)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="View details"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                )}
                {onEdit && (
                  <button
                    onClick={() => onEdit(workflow)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                    title="Edit workflow"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(workflow)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete workflow"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pl-8 space-y-2 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Execution Count:</span>
                <span>{workflow.executionCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Average Execution Time:</span>
                <span>{(workflow.avgExecutionTime / 1000).toFixed(2)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Success Rate:</span>
                <span className={workflow.successRate < 95 ? 'text-red-600' : 'text-green-600'}>
                  {workflow.successRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Executed:</span>
                <span>{workflow.lastExecuted ? new Date(workflow.lastExecuted).toLocaleString() : 'Never'}</span>
              </div>
              <div className="mt-2">
                <span className="font-medium">Steps:</span>
                <ul className="mt-1 space-y-1">
                  {workflow.definition.steps.map((step, idx) => (
                    <li key={idx} className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span>{step.name} ({step.type})</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [expandedIds, selectedIds, selectable, onView, onEdit, onDelete, handleSelection, toggleExpanded]);

  if (isLoading) {
    return <LoadingSkeletonFallback type="list" count={5} />;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600">
        <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2" />
        <p>Failed to load workflows</p>
      </div>
    );
  }

  return (
    <AdminModalErrorBoundary>
      <div className="bg-white rounded-lg shadow border border-gray-200">
        {selectable && workflowItems.length > 0 && (
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={selectedIds.length === workflowItems.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">
                Select all ({selectedIds.length} of {workflowItems.length} selected)
              </span>
            </label>
          </div>
        )}
        
        <VirtualizedList
          items={workflowItems}
          height={height}
          itemHeight={isExpanded ? 180 : 60}
          renderItem={renderWorkflowItem}
          emptyState={
            <div className="p-8 text-center text-gray-500">
              <DocumentTextIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No workflows configured</p>
            </div>
          }
        />
      </div>
    </AdminModalErrorBoundary>
  );
};

// Performance metrics for virtualized lists
export const useVirtualizationMetrics = () => {
  const [metrics, setMetrics] = useState({
    renderCount: 0,
    averageRenderTime: 0,
    totalItems: 0,
    visibleItems: 0,
    scrollEvents: 0,
  });

  const trackRender = useCallback((renderTime: number) => {
    setMetrics(prev => ({
      ...prev,
      renderCount: prev.renderCount + 1,
      averageRenderTime: (prev.averageRenderTime * prev.renderCount + renderTime) / (prev.renderCount + 1),
    }));
  }, []);

  const trackScroll = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      scrollEvents: prev.scrollEvents + 1,
    }));
  }, []);

  const updateItemCounts = useCallback((total: number, visible: number) => {
    setMetrics(prev => ({
      ...prev,
      totalItems: total,
      visibleItems: visible,
    }));
  }, []);

  return {
    metrics,
    trackRender,
    trackScroll,
    updateItemCounts,
  };
};
