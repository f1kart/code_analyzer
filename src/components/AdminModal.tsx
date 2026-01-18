import React, { useCallback, useEffect, useReducer, useState } from 'react';

import * as adminSvc from '../services/adminService';
import { AppSettings, LogVerbosity, ModelConfig } from '../utils/sessionManager';
import { DEFAULT_MODEL_ID, TABS, ToastType, SettingsAction, settingsReducer } from './admin/adminModalShared';
import { useAdminModalStore } from './admin/state/adminModalStore';
import TeamTab from './admin/tabs/TeamTab';
import AgentBehaviorTab from './admin/tabs/AgentBehaviorTab';
import ProvidersTab from './admin/tabs/ProvidersTab';
import WorkflowsTab from './admin/tabs/WorkflowsTab';
import ToolsTab from './admin/tabs/ToolsTab';
import DesktopTab from './admin/tabs/DesktopTab';
import EnterpriseToolsTab from './admin/tabs/EnterpriseToolsTab';
import OperationsTab from './admin/tabs/OperationsTab';
import { AdminErrorBoundary } from './admin/ErrorBoundary';
import { useErrorHandler } from './admin/hooks/useErrorHandler';
import { AdminDataProvider } from './admin/AdminDataContext';
import { LazyTabRenderer, preloadCommonTabs } from './admin/LazyTabs';
import { WorkflowDataProvider } from './admin/WorkflowDataContext';
import ConfirmDialog from './admin/ConfirmDialog';
import ToastStack from './admin/ToastStack';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
}

interface GeneralSettingsTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  localSettings,
  dispatch,
  showToast,
}) => {
  const [newModelId, setNewModelId] = useState('');
  const handleAddModel = useCallback(() => {
    const trimmed = newModelId.trim();
    if (!trimmed) {
      showToast('warning', 'Please provide a model identifier.');
      return;
    }
    if (localSettings.availableModels.some((model) => model.id === trimmed)) {
      showToast('warning', 'This model is already configured.');
      return;
    }

    const isLocal = /local|ollama/i.test(trimmed);
    const friendlyName = trimmed
      .split(/[\/]/)
      .pop()
      ?.split(/[:_\-]/)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');

    const newModel: ModelConfig = {
      id: trimmed,
      name: friendlyName || trimmed,
      isLocal,
    };

    dispatch({ type: 'ADD_MODEL', payload: { model: newModel } });
    setNewModelId('');
    showToast('success', `Model '${newModel.name}' added.`);
  }, [dispatch, localSettings.availableModels, newModelId, showToast]);

  const handleRemoveModel = useCallback(
    (modelId: string) => {
      if (modelId === DEFAULT_MODEL_ID) {
        showToast('warning', 'Default model cannot be removed.');
        return;
      }

      const updatedTeamConfig = localSettings.aiTeamConfiguration.map((agent) =>
        agent.modelId === modelId ? { ...agent, modelId: '' } : agent,
      );

      dispatch({ type: 'REMOVE_MODEL', payload: { modelId } });
      dispatch({ type: 'REORDER_AGENTS', payload: updatedTeamConfig });
      showToast('success', `Model '${modelId}' removed.`);
    },
    [dispatch, localSettings.aiTeamConfiguration, showToast],
  );

  return (
    <AdminErrorBoundary>
    <div className="space-y-6">
      <div>
        <label
          htmlFor="admin-modal-ai-persona"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          AI Persona
        </label>
        <textarea
          id="admin-modal-ai-persona"
          rows={4}
          className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
          value={localSettings.aiPersona}
          onChange={(event) => dispatch({ type: 'UPDATE_AI_PERSONA', payload: event.target.value })}
          placeholder="Define the assistant's core persona..."
        />
        <p className="text-xs text-gray-400 mt-1">
          Describe the tone, expertise, and overall guidance philosophy for the AI assistant.
        </p>
      </div>

      <div>
        <label
          htmlFor="admin-modal-custom-rules"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Custom Rules
        </label>
        <textarea
          id="admin-modal-custom-rules"
          rows={4}
          className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
          value={localSettings.customRules}
          onChange={(event) =>
            dispatch({ type: 'UPDATE_CUSTOM_RULES', payload: event.target.value })
          }
          placeholder="Add coding standards, security guidelines, or checklists..."
        />
        <p className="text-xs text-gray-400 mt-1">
          Provide explicit guardrails, coding style preferences, or mandatory review items.
        </p>
      </div>

      <div>
        <label
          htmlFor="admin-modal-log-verbosity"
          className="block text-sm font-medium text-gray-300 mb-1"
        >
          Log Verbosity
        </label>
        <select
          id="admin-modal-log-verbosity"
          className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
          value={localSettings.logVerbosity}
          onChange={(event) =>
            dispatch({
              type: 'SET_LOG_VERBOSITY',
              payload: event.target.value as LogVerbosity,
            })
          }
        >
          <option value="normal">Normal</option>
          <option value="debug">Debug</option>
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Normal reduces console noise. Debug enables detailed pipeline and persistence logs.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Available Models</label>
        <div className="space-y-2 p-3 bg-gray-900/50 rounded-md">
          {localSettings.availableModels.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between text-sm bg-gray-800/70 p-2 rounded"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-200">{model.name}</span>
                {model.isLocal && (
                  <span className="text-xs text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded-full">
                    Local
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveModel(model.id)}
                disabled={model.id === DEFAULT_MODEL_ID}
                className="text-lg leading-none text-gray-400 hover:text-red-400 disabled:opacity-40"
                title={
                  model.id === DEFAULT_MODEL_ID ? 'Cannot remove default model' : 'Remove model'
                }
              >
                &times;
              </button>
            </div>
          ))}
          {localSettings.availableModels.length === 0 && (
            <p className="text-xs text-gray-500">No models configured yet.</p>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <input
            type="text"
            value={newModelId}
            onChange={(event) => setNewModelId(event.target.value)}
            placeholder="Model ID (e.g., ollama/llama3)"
            className="flex-1 bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
            aria-label="New model identifier"
          />
          <button
            type="button"
            onClick={handleAddModel}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Add Model
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Identifiers containing 'ollama' or 'local' are automatically flagged as local models.
        </p>
      </div>
      </div>
    </AdminErrorBoundary>
  );
};

interface TabButtonProps {
  tabId: string;
  current: string;
  onClick: (tabId: string) => void;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ tabId, current, onClick, children }) => (
  <button
    type="button"
    onClick={() => onClick(tabId)}
    className={`w-full text-left p-2 rounded text-sm ${
      current === tabId ? 'bg-blue-100 text-blue-800' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, dispatch] = useReducer(settingsReducer, settings);
  const { createErrorBoundaryHandler } = useErrorHandler();
  const {
    activeTab,
    setActiveTab,
    selectedAgent,
    setSelectedAgent,
    toasts,
    showToast,
    removeToast,
    confirmDialog,
    showConfirmDialog,
    resetUiState,
  } = useAdminModalStore();

  // Preload common tabs when modal opens
  React.useEffect(() => {
    if (isOpen) {
      preloadCommonTabs();
    }
  }, [isOpen]);
  const [providers, setProviders] = useState<adminSvc.ModelProvider[] | null>(null);

  // Data loading ---------------------------------------------------------
  const loadAdminData = useCallback(async () => {
    try {
      const providerItems = await adminSvc.listProviders();
      setProviders(providerItems);
    } catch (error) {
      console.error('Failed to load providers:', error);
      setProviders([]);
      showToast('error', `Failed to load providers: ${(error as Error).message}`);
    }
  }, [showToast]);

  useEffect(() => {
    dispatch({ type: 'SET_SETTINGS', payload: settings });
  }, [settings]);

  useEffect(() => {
    if (!isOpen) return;
    resetUiState();
    loadAdminData().catch((error) => console.error(error));
  }, [isOpen, loadAdminData, resetUiState]);

  if (!isOpen) {
    return null;
  }

  const handleSaveAndClose = () => {
    onSave(localSettings);
    onClose();
  };

  const renderTabContent = () => {
    const handleError = createErrorBoundaryHandler('AdminModal');

    switch (activeTab) {
      case TABS.GENERAL:
        return (
          <AdminErrorBoundary onError={handleError}>
            <GeneralSettingsTab
              localSettings={localSettings}
              dispatch={dispatch}
              showToast={showToast}
            />
          </AdminErrorBoundary>
        );

      case TABS.PROVIDERS:
        return (
          <AdminErrorBoundary onError={handleError}>
            <AdminDataProvider isModalOpen={isOpen} showToast={showToast}>
              <LazyTabRenderer
                activeTab={activeTab}
                localSettings={localSettings}
                dispatch={dispatch}
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                showToast={showToast}
                providers={providers || []}
                isOpen={isOpen}
                onSave={onSave}
              />
            </AdminDataProvider>
          </AdminErrorBoundary>
        );

      case TABS.WORKFLOWS:
        return (
          <AdminErrorBoundary onError={handleError}>
            <WorkflowDataProvider isModalOpen={isOpen} showToast={showToast}>
              <LazyTabRenderer
                activeTab={activeTab}
                localSettings={localSettings}
                dispatch={dispatch}
                selectedAgent={selectedAgent}
                setSelectedAgent={setSelectedAgent}
                showToast={showToast}
                providers={providers || []}
                isOpen={isOpen}
                onSave={onSave}
              />
            </WorkflowDataProvider>
          </AdminErrorBoundary>
        );

      default:
        return (
          <AdminErrorBoundary onError={handleError}>
            <LazyTabRenderer
              activeTab={activeTab}
              localSettings={localSettings}
              dispatch={dispatch}
              selectedAgent={selectedAgent}
              setSelectedAgent={setSelectedAgent}
              showToast={showToast}
              providers={providers || []}
              isOpen={isOpen}
              onSave={onSave}
            />
          </AdminErrorBoundary>
        );
    }
  };

  return (
    <AdminErrorBoundary
      onError={(error, errorInfo) => {
        console.error('AdminModal critical error:', error, errorInfo);
        // Show fallback UI for entire modal
      }}
    >
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        onClick={onClose}
      >
      <div
        className="bg-panel border border-border rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Admin Settings</h2>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <aside className="w-1/3 max-w-[240px] border-r border-gray-200 p-4 space-y-2 overflow-y-auto">
            <TabButton tabId={TABS.GENERAL} current={activeTab} onClick={setActiveTab}>
              General AI
            </TabButton>
            <TabButton tabId={TABS.TEAM} current={activeTab} onClick={setActiveTab}>
              AI Team
            </TabButton>
            <TabButton tabId={TABS.AGENT_BEHAVIOR} current={activeTab} onClick={setActiveTab}>
              Agent Behavior
            </TabButton>
            <TabButton tabId={TABS.PROVIDERS} current={activeTab} onClick={setActiveTab}>
              Providers
            </TabButton>
            <TabButton tabId={TABS.WORKFLOWS} current={activeTab} onClick={setActiveTab}>
              Workflows
            </TabButton>
            <TabButton tabId={TABS.ENTERPRISE_TOOLS} current={activeTab} onClick={setActiveTab}>
              Enterprise Tools
            </TabButton>
            <TabButton tabId={TABS.OPERATIONS} current={activeTab} onClick={setActiveTab}>
              Operations
            </TabButton>
          </aside>

          <main className="flex-1 overflow-y-auto p-6">{renderTabContent()}</main>
        </div>

        <footer className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium bg-gray-100 hover:bg-gray-200 rounded-md text-gray-900"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 rounded-md text-white"
            onClick={() =>
              showConfirmDialog({
                title: 'Save Admin Settings',
                message: 'Apply the changes and close the modal?',
                onConfirm: () => handleSaveAndClose(),
              })
            }
          >
            Save &amp; Close
          </button>
        </footer>

        <ToastStack toasts={toasts} onRemoveToast={removeToast} />
        <ConfirmDialog
          dialog={confirmDialog}
          onConfirm={confirmDialog?.onConfirm ?? (() => {})}
          onCancel={confirmDialog?.onCancel ?? (() => {})}
        />
      </div>
      </div>
    </AdminErrorBoundary>
  );
};

export { AdminModal };

export default AdminModal;
