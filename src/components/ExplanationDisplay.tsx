import React from 'react';
import { SummaryDisplay } from './SummaryDisplay';
import { CopyButton } from './CopyButton';

interface ExplanationDisplayProps {
  explanation: string;
  fileName: string | null;
}

export const ExplanationDisplay: React.FC<ExplanationDisplayProps> = ({
  explanation,
  fileName,
}) => {
  return (
    <div className="flex-grow flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="text-xl font-semibold text-gray-300">Code Explanation</h3>
          {fileName && <p className="text-xs text-gray-500 font-mono">{fileName}</p>}
        </div>
        <CopyButton textToCopy={explanation} />
      </div>
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex-grow overflow-y-auto">
        <SummaryDisplay summary={explanation} />
      </div>
    </div>
  );
};
