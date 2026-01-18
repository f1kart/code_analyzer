import React from 'react';
import { SummaryDisplay } from './SummaryDisplay';
import { CopyButton } from './CopyButton';

export interface ScanResult {
  identifier: string;
  summary: string;
}

interface FolderScanResultsDisplayProps {
  results: ScanResult[];
}

export const FolderScanResultsDisplay: React.FC<FolderScanResultsDisplayProps> = ({ results }) => {
  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Placeholder Scan Results</h2>
      {results.length > 0 ? (
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {results.map((result) => (
            <div key={result.identifier} className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700">
                <h3
                  className="font-semibold font-mono text-sm text-gray-300 truncate"
                  title={result.identifier}
                >
                  {result.identifier}
                </h3>
                <CopyButton textToCopy={result.summary} />
              </div>
              <div className="p-4">
                <SummaryDisplay summary={result.summary} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg p-8">
          <h3 className="text-lg font-semibold text-gray-400">Scan Complete</h3>
          <p className="mt-2 text-sm text-gray-500">
            No placeholders or to-do's were found in the selected files.
          </p>
        </div>
      )}
    </div>
  );
};
