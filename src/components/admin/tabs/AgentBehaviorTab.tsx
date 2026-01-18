import React from 'react';

import { AppSettings } from '../../../utils/sessionManager';
import { SettingsAction } from '../adminModalShared';

interface AgentBehaviorTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
  selectedAgent: string | null;
  setSelectedAgent: React.Dispatch<React.SetStateAction<string | null>>;
}

const AgentBehaviorTab: React.FC<AgentBehaviorTabProps> = ({
  localSettings,
  dispatch,
  selectedAgent,
  setSelectedAgent,
}) => {
  const toggleAgent = (role: string) => {
    setSelectedAgent((prev) => (prev === role ? null : role));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Tailor the instructions and default models for each persona. Click a persona to edit its
        behavior.
      </p>

      {localSettings.aiTeamConfiguration.map((agent) => (
        <div
          key={agent.role}
          className="border border-transparent rounded-md bg-gray-900/60 focus-within:border-brand-blue"
        >
          <button
            type="button"
            onClick={() => toggleAgent(agent.role)}
            className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-200"
          >
            <span>{agent.role}</span>
            <div className="flex items-center gap-2 text-xs">
              {(agent.systemPrompt || agent.modelId) && (
                <span className="text-purple-300 bg-purple-900/50 px-2 py-0.5 rounded-full">
                  Customized
                </span>
              )}
              <span
                className={`transform transition-transform ${
                  selectedAgent === agent.role ? 'rotate-90' : 'rotate-0'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </span>
            </div>
          </button>

          {selectedAgent === agent.role && (
            <div className="p-4 border-t border-gray-800 space-y-4 animate-fade-in">
              <div>
                <label
                  htmlFor={`agent-system-prompt-${agent.role}`}
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  System Prompt
                </label>
                <textarea
                  id={`agent-system-prompt-${agent.role}`}
                  rows={6}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
                  value={agent.systemPrompt}
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_AGENT_CONFIG',
                      payload: {
                        role: agent.role,
                        config: { systemPrompt: event.target.value },
                      },
                    })
                  }
                  placeholder={`Provide specialized instructions for the ${agent.role} persona.`}
                />
              </div>

              <div>
                <label
                  htmlFor={`agent-model-${agent.role}`}
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Preferred Model
                </label>
                <select
                  id={`agent-model-${agent.role}`}
                  title={`Preferred model for ${agent.role}`}
                  aria-label={`Preferred model for ${agent.role}`}
                  value={agent.modelId}
                  onChange={(event) =>
                    dispatch({
                      type: 'UPDATE_AGENT_CONFIG',
                      payload: {
                        role: agent.role,
                        config: { modelId: event.target.value },
                      },
                    })
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-md text-sm p-2"
                >
                  <option value="">Use team default model</option>
                  {localSettings.availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default AgentBehaviorTab;
