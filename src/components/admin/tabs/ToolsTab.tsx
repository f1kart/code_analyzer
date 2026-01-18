import React from 'react';

import { AppSettings, AIToolSettings } from '../../../utils/sessionManager';
import { SettingsAction } from '../adminModalShared';

interface ToolsTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
}

const ToolsTab: React.FC<ToolsTabProps> = ({ localSettings, dispatch }) => {
  const toggleTool = (tool: keyof AIToolSettings) => {
    dispatch({
      type: 'UPDATE_TOOL_SETTING',
      payload: { tool, enabled: !localSettings.aiTools[tool] },
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600">
        Control which capabilities the AI assistant can invoke automatically during conversations.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {Object.keys(localSettings.aiTools).map((toolKey) => (
          <label key={toolKey} className="flex items-start gap-2 bg-gray-50 p-2 rounded">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded"
              checked={localSettings.aiTools[toolKey as keyof AIToolSettings]}
              onChange={() => toggleTool(toolKey as keyof AIToolSettings)}
            />
            <span className="text-sm text-gray-800 capitalize">
              {toolKey.replace(/([A-Z])/g, ' $1')}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default ToolsTab;
