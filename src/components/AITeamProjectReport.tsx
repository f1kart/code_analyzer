import React from 'react';
import { AITeamProjectResult } from '../services/geminiService';
import { AppFile } from '../utils/sessionManager';
import { SummaryDisplay } from './SummaryDisplay';

interface AITeamProjectReportProps {
  result: AITeamProjectResult;
  originalFiles: AppFile[];
  onSaveFile: (code: string, identifier: string) => void;
}

export const AITeamProjectReport: React.FC<AITeamProjectReportProps> = ({
  result,
  originalFiles,
  onSaveFile,
}) => {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100">AI Team Project Scan Report</h2>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-200">Overall Summary</h3>
        <SummaryDisplay summary={result.overallSummary} />
      </div>
      <div className="flex-grow overflow-y-auto space-y-4 pr-2">
        {result.files.map((fileResult) => (
          <div
            key={fileResult.identifier}
            className="bg-gray-800 border border-gray-700 rounded-lg"
          >
            <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
              <h4 className="font-mono text-sm text-brand-purple">{fileResult.identifier}</h4>
              <button
                onClick={() => onSaveFile(fileResult.refactoredCode, fileResult.identifier)}
                className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded-md"
              >
                Save Changes
              </button>
            </div>
            <div className="p-4">
              <SummaryDisplay summary={fileResult.summary} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
