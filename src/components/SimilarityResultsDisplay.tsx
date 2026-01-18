import React from 'react';
import { SimilarityResult } from '../services/geminiService';
import { SummaryDisplay } from './SummaryDisplay';
import { LayersIcon } from './icons/LayersIcon';

interface SimilarityResultsDisplayProps {
  results: SimilarityResult;
}

export const SimilarityResultsDisplay: React.FC<SimilarityResultsDisplayProps> = ({ results }) => {
  const { groups } = results;

  return (
    <div className="h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4 text-gray-100">Code Similarity Analysis Results</h2>
      {groups.length > 0 ? (
        <div className="flex-grow overflow-y-auto space-y-4 pr-2">
          {groups.map((group, index) => (
            <div key={index} className="bg-gray-800 border border-gray-700 rounded-lg">
              <div className="px-4 py-3 border-b border-gray-700">
                <h3 className="font-semibold text-gray-200 mb-2">
                  Group {index + 1}: Similar Files Found
                </h3>
                <ul className="space-y-1">
                  {group.fileIdentifiers.map((id) => (
                    <li
                      key={id}
                      className="font-mono text-sm text-brand-purple bg-gray-900 px-2 py-1 rounded-md"
                    >
                      {id}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-300 mb-1">Reasoning for Similarity</h4>
                  <SummaryDisplay summary={group.reasoning} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-300 mb-1">Key Differences</h4>
                  <SummaryDisplay summary={group.keyDifferences} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center bg-gray-800 border-2 border-dashed border-gray-700 rounded-lg p-8">
          <LayersIcon className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-400">Analysis Complete</h3>
          <p className="mt-2 text-sm text-gray-500">
            No semantically similar or duplicate files were found.
          </p>
        </div>
      )}
    </div>
  );
};
