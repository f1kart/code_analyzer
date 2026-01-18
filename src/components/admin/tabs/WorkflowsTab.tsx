import React, { useCallback, useState } from 'react';

import * as adminSvc from '../../../services/adminService';
import { isDesktopApp } from '../../../utils/env';
import { AppSettings } from '../../../utils/sessionManager';
import { ToastType } from '../adminModalShared';
import {
  useAgentMapsQuery,
  useCreateWorkflowMutation,
  useDeleteWorkflowMutation,
  useSetAgentMapMutation,
  useUpdateWorkflowMutation,
  useWorkflowsQuery,
} from '../hooks/adminQueries';

interface WorkflowsTabProps {
  localSettings: AppSettings;
  showToast: (type: ToastType, message: string, duration?: number) => void;
  providers: adminSvc.ModelProvider[] | null;
}

const WorkflowsTab: React.FC<WorkflowsTabProps> = ({ localSettings, showToast, providers }) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [workflowForm, setWorkflowForm] = useState<{
    name: string;
    definition: string;
    isSubmitting: boolean;
  }>({ name: '', definition: '', isSubmitting: false });

  const {
    data: workflows,
    isLoading: isLoadingWorkflows,
    refetch: refetchWorkflows,
  } = useWorkflowsQuery();

  const {
    data: agentMaps = [],
    refetch: refetchAgentMaps,
  } = useAgentMapsQuery(selectedWorkflowId);

  const createWorkflow = useCreateWorkflowMutation();
  const updateWorkflow = useUpdateWorkflowMutation();
  const deleteWorkflow = useDeleteWorkflowMutation();
  const setAgentMap = useSetAgentMapMutation();

  const isDesktop = isDesktopApp();

  const handleCreateWorkflow = useCallback(async () => {
    const trimmedName = workflowForm.name.trim();
    if (!trimmedName) {
      showToast('warning', 'Workflow name is required.');
      return;
    }

    try {
      const parsedDefinition = JSON.parse(workflowForm.definition);
      setWorkflowForm((prev) => ({ ...prev, isSubmitting: true }));
      const created = await createWorkflow.mutateAsync({
        name: trimmedName,
        definition: parsedDefinition,
      });
      showToast('success', `Workflow '${created.name}' created.`);
      setWorkflowForm({ name: '', definition: '', isSubmitting: false });
    } catch (error) {
      console.error('Failed to create workflow:', error);
      showToast('error', `Invalid workflow definition: ${(error as Error).message}`);
      setWorkflowForm((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [createWorkflow, showToast, workflowForm.definition, workflowForm.name]);

  const handleSelectWorkflow = useCallback(
    async (workflow: adminSvc.Workflow) => {
      setSelectedWorkflowId(workflow.id);
      setWorkflowForm({
        name: workflow.name,
        definition: JSON.stringify(workflow.definition, null, 2),
        isSubmitting: false,
      });

      try {
        await refetchAgentMaps();
      } catch (error) {
        console.error('Failed to load agent mappings:', error);
        showToast('error', `Failed to load agent mappings: ${(error as Error).message}`);
      }
    },
    [refetchAgentMaps, showToast],
  );

  const handleDeleteWorkflow = useCallback(
    async (workflowId: number) => {
      try {
        await deleteWorkflow.mutateAsync(workflowId);
        if (selectedWorkflowId === workflowId) {
          setSelectedWorkflowId(null);
          setWorkflowForm({ name: '', definition: '', isSubmitting: false });
        }
        showToast('success', 'Workflow deleted.');
      } catch (error) {
        console.error('Failed to delete workflow:', error);
        showToast('error', `Failed to delete workflow: ${(error as Error).message}`);
      }
    },
    [deleteWorkflow, selectedWorkflowId, showToast],
  );

  const handleUpdateWorkflow = useCallback(async () => {
    if (selectedWorkflowId === null) {
      showToast('warning', 'Select a workflow before saving.');
      return;
    }

    try {
      const parsedDefinition = JSON.parse(workflowForm.definition);
      const updated = await updateWorkflow.mutateAsync({
        id: selectedWorkflowId,
        input: {
          name: workflowForm.name.trim(),
          definition: parsedDefinition,
        },
      });
      showToast('success', `Workflow '${updated.name}' updated.`);
    } catch (error) {
      console.error('Failed to update workflow:', error);
      showToast('error', `Invalid workflow definition: ${(error as Error).message}`);
    }
  }, [selectedWorkflowId, showToast, updateWorkflow, workflowForm.definition, workflowForm.name]);

  const handleSetAgentMap = useCallback(
    async (agentRole: string, type: 'primary' | 'collaborator', modelId: string) => {
      if (!selectedWorkflowId) {
        showToast('warning', 'Select a workflow before editing agent mappings.');
        return;
      }
      if (!modelId) {
        showToast('warning', 'Select a model for the mapping.');
        return;
      }

      const numericModelId = Number(modelId);
      if (!Number.isFinite(numericModelId) || numericModelId <= 0) {
        showToast('warning', 'Invalid model selection.');
        return;
      }

      const existing = agentMaps.find((map: adminSvc.AgentModelMap) => map.agentRole === agentRole);
      const payload: adminSvc.SetAgentMapInput = {
        workflowId: selectedWorkflowId,
        agentRole,
        primaryModelId:
          type === 'primary' ? numericModelId : existing?.primaryModelId ?? numericModelId,
        collaboratorModelId:
          type === 'collaborator'
            ? numericModelId
            : existing?.collaboratorModelId ?? numericModelId,
      };

      try {
        await setAgentMap.mutateAsync(payload);
        showToast('success', `Agent map for ${agentRole} updated.`);
      } catch (error) {
        console.error('Failed to update agent map:', error);
        showToast('error', `Failed to update agent map: ${(error as Error).message}`);
      }
    },
    [agentMaps, selectedWorkflowId, setAgentMap, showToast],
  );

  return (
    <div className="space-y-4">
      {!isDesktop && (
        <p className="text-xs text-brand-blue">
          Workflow persistence requires the desktop application with database access. Changes made
          here are not persisted in the web preview.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="bg-panel border border-border rounded-md p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Create Workflow</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">
                Define a name and JSON payload for the workflow pipeline.
              </span>
              <button
                type="button"
                className="text-xs text-text-secondary hover:text-text-primary"
                onClick={() => refetchWorkflows().catch((error: unknown) => console.error(error))}
                title="Refresh workflows"
              >
                Refresh
              </button>
            </div>
            <input
              className="w-full bg-interactive border border-border rounded p-2 text-sm"
              placeholder="Workflow name"
              value={workflowForm.name}
              onChange={(event) =>
                setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
            <textarea
              className="w-full bg-interactive border border-border rounded p-2 text-sm font-mono"
              rows={6}
              placeholder="Workflow JSON definition"
              value={workflowForm.definition}
              onChange={(event) =>
                setWorkflowForm((prev) => ({ ...prev, definition: event.target.value }))
              }
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCreateWorkflow}
                disabled={workflowForm.isSubmitting}
                className="px-3 py-1.5 text-sm bg-brand-blue hover:bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {workflowForm.isSubmitting ? 'Creating…' : 'Add Workflow'}
              </button>
              <button
                type="button"
                className="ml-2 px-3 py-1.5 text-sm bg-interactive hover:bg-panel-light text-text-primary rounded"
                onClick={() => setWorkflowForm({ name: '', definition: '', isSubmitting: false })}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-md p-4 space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Existing Workflows</h3>
            {isLoadingWorkflows ? (
              <p className="text-xs text-text-secondary">Loading workflows…</p>
            ) : workflows && workflows.length > 0 ? (
              <ul className="space-y-2">
                {workflows?.map((workflow: adminSvc.Workflow) => (
                  <li
                    key={workflow.id}
                    className={`flex items-center justify-between bg-panel-light p-2 rounded text-sm ${
                      selectedWorkflowId === workflow.id ? 'ring-1 ring-brand-blue' : ''
                    }`}
                  >
                    <button
                      type="button"
                      className="text-left flex-1 text-text-primary"
                      onClick={() => handleSelectWorkflow(workflow)}
                    >
                      {workflow.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteWorkflow(workflow.id)}
                      className="text-lg leading-none text-text-secondary hover:text-brand-red ml-2"
                      title="Delete workflow"
                    >
                      &times;
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-secondary">No workflows registered yet.</p>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-panel border border-border rounded-md p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Workflow Definition</h3>
            <input
              className="w-full bg-interactive border border-border rounded p-2 text-sm"
              placeholder="Workflow name"
              value={workflowForm.name}
              onChange={(event) =>
                setWorkflowForm((prev) => ({ ...prev, name: event.target.value }))
              }
              disabled={selectedWorkflowId === null}
            />
            <textarea
              className="w-full bg-interactive border border-border rounded p-2 text-sm font-mono"
              rows={12}
              title="Workflow JSON definition"
              value={workflowForm.definition}
              onChange={(event) =>
                setWorkflowForm((prev) => ({ ...prev, definition: event.target.value }))
              }
              disabled={selectedWorkflowId === null}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleUpdateWorkflow}
                className="px-3 py-1.5 text-sm bg-brand-blue hover:bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={selectedWorkflowId === null}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedWorkflowId(null);
                  setWorkflowForm({ name: '', definition: '', isSubmitting: false });
                  refetchWorkflows().catch((error: unknown) => console.error(error));
                }}
                className="ml-2 px-3 py-1.5 text-sm bg-interactive hover:bg-panel-light text-text-primary rounded"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-md p-4 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Agent Model Mapping</h3>
            {selectedWorkflowId === null ? (
              <p className="text-xs text-text-secondary">
                Select a workflow to configure agent mappings.
              </p>
            ) : (
              <div className="space-y-2">
                {localSettings.aiTeamConfiguration.map((agent) => {
                  const mapping = agentMaps.find((map: adminSvc.AgentModelMap) => map.agentRole === agent.role);
                  return (
                    <div
                      key={agent.role}
                      className="grid grid-cols-3 items-center gap-2 text-sm bg-panel-light p-2 rounded"
                    >
                      <div className="text-text-primary">{agent.role}</div>
                      <select
                        className="bg-interactive border border-border rounded p-2"
                        title={`Primary provider for ${agent.role}`}
                        aria-label={`Primary provider for ${agent.role}`}
                        value={mapping?.primaryModelId ?? ''}
                        onChange={(event) =>
                          handleSetAgentMap(agent.role, 'primary', event.target.value)
                        }
                      >
                        <option value="">Primary model</option>
                        {(providers || []).map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name} [{provider.provider}]
                          </option>
                        ))}
                      </select>
                      <select
                        className="bg-interactive border border-border rounded p-2"
                        title={`Collaborator provider for ${agent.role}`}
                        aria-label={`Collaborator provider for ${agent.role}`}
                        value={mapping?.collaboratorModelId ?? ''}
                        onChange={(event) =>
                          handleSetAgentMap(agent.role, 'collaborator', event.target.value)
                        }
                      >
                        <option value="">Collaborator model</option>
                        {(providers || []).map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.name} [{provider.provider}]
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowsTab;
