import React from 'react';

import { AppSettings } from '../../../utils/sessionManager';
import { SettingsAction } from '../adminModalShared';

interface DesktopTabProps {
  localSettings: AppSettings;
  dispatch: React.Dispatch<SettingsAction>;
}

const DesktopTab: React.FC<DesktopTabProps> = ({ localSettings, dispatch }) => (
  <div className="space-y-4">
    <p className="text-xs text-gray-600">
      Enable native integrations for the Electron desktop application. These options are ignored in
      the web preview.
    </p>
    <label className="flex items-start gap-2 bg-gray-50 p-3 rounded">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded"
        checked={localSettings.desktopSettings.fileSystem}
        onChange={(event) =>
          dispatch({
            type: 'UPDATE_DESKTOP_SETTING',
            payload: { key: 'fileSystem', value: event.target.checked },
          })
        }
      />
      <span>
        <span className="text-sm font-medium text-gray-800">Local file system access</span>
        <span className="block text-xs text-gray-600">
          Allow the IDE to read and write files directly on your machine.
        </span>
      </span>
    </label>
    <label className="flex items-start gap-2 bg-gray-50 p-3 rounded">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded"
        checked={localSettings.desktopSettings.database}
        onChange={(event) =>
          dispatch({
            type: 'UPDATE_DESKTOP_SETTING',
            payload: { key: 'database', value: event.target.checked },
          })
        }
      />
      <span>
        <span className="text-sm font-medium text-gray-800">Local database logging</span>
        <span className="block text-xs text-gray-600">
          Persist AI activity and workflow data to a local SQLite database for compliance audits.
        </span>
      </span>
    </label>
  </div>
);

export default DesktopTab;
