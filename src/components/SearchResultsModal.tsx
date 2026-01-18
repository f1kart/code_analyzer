import React from 'react';

export interface ProjectSearchResult {
  fileIdentifier: string;
  lineNumber: number;
  snippet: string;
  reasoning: string;
}

interface SearchResultsModalProps {
  results: ProjectSearchResult[];
  onClose: () => void;
}

export const SearchResultsModal: React.FC<SearchResultsModalProps> = ({ results, onClose }) => {
  return (
    <div
      className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-gray-100">Project Search Results</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>
        </div>
        <div className="flex-grow p-6 overflow-y-auto space-y-4">
          {results.length > 0 ? (
            results.map((result, index) => (
              <div key={index} className="bg-gray-900/50 p-3 rounded-md">
                <p className="font-mono text-sm text-brand-purple">
                  {result.fileIdentifier}:{result.lineNumber}
                </p>
                <pre className="mt-1 text-xs text-gray-400 bg-gray-800 p-2 rounded overflow-x-auto">
                  <code>{result.snippet}</code>
                </pre>
                {result.reasoning && (
                  <p className="mt-2 text-xs text-gray-500 italic">{result.reasoning}</p>
                )}
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500">No results found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
