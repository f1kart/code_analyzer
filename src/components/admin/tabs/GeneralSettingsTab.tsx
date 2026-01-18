import React, { useCallback, useState } from 'react';
import type { AppSettings, ModelConfig, LogVerbosity } from '../../../utils/sessionManager';
import { DEFAULT_MODEL_ID } from '../../admin/adminModalShared';
import type { SettingsAction, ToastType } from '../../admin/adminModalShared';

export interface GeneralSettingsTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
  showToast: (type: ToastType, message: string, duration?: number) => void;
}

const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({ localSettings, dispatch, showToast }) => {
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
    <div className="space-y-6">
      <div>
        <label htmlFor="admin-modal-ai-persona" className="block text-sm font-medium text-gray-300 mb-1">
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
        <label htmlFor="admin-modal-custom-rules" className="block text-sm font-medium text-gray-300 mb-1">
          Custom Rules
        </label>
        <textarea
          id="admin-modal-custom-rules"
          rows={4}
          className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
          value={localSettings.customRules}
          onChange={(event) => dispatch({ type: 'UPDATE_CUSTOM_RULES', payload: event.target.value })}
          placeholder="Add coding standards, security guidelines, or checklists..."
        />
        <p className="text-xs text-gray-400 mt-1">
          Provide explicit guardrails, coding style preferences, or mandatory review items.
        </p>
      </div>

      <div>
        <label htmlFor="admin-modal-log-verbosity" className="block text-sm font-medium text-gray-300 mb-1">
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
            <div key={model.id} className="flex items-center justify-between text-sm bg-gray-800/70 p-2 rounded">
              <div className="flex items-center gap-2">
                <span className="text-gray-200">{model.name}</span>
                {model.isLocal && (
                  <span className="text-xs text-purple-300 bg-purple-900/50 px-1.5 py-0.5 rounded-full">Local</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveModel(model.id)}
                disabled={model.id === DEFAULT_MODEL_ID}
                className="text-lg leading-none text-gray-400 hover:text-red-400 disabled:opacity-40"
                title={model.id === DEFAULT_MODEL_ID ? 'Cannot remove default model' : 'Remove model'}
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
          Identifiers containing “ollama” or “local” are automatically flagged as local models.
        </p>
      </div>
    </div>
  );
};

export default GeneralSettingsTab;
