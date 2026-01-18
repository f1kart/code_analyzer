import React from 'react';
import { RootCauseAnalysisResult } from '../services/geminiService';
import { SummaryDisplay } from './SummaryDisplay';
import { DiffViewer } from './DiffViewer';
import { BugIcon } from './icons/BugIcon';

interface RootCauseAnalysisDisplayProps {
  result: RootCauseAnalysisResult;
  onApplyFix: (fileIdentifier: string, newCode: string) => void;
}

export const RootCauseAnalysisDisplay: React.FC<RootCauseAnalysisDisplayProps> = ({
  result,
  onApplyFix,
}) => {
  const [editedFix, setEditedFix] = React.useState(result.fix.refactoredCode);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex justify-between items-center flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">
          <BugIcon className="w-6 h-6 text-brand-red" />
          AI Debugging Report
        </h2>
        <button
          onClick={() => onApplyFix(result.culprit.fileIdentifier, editedFix)}
          className="px-4 py-2 text-sm font-medium text-white bg-brand-green hover:bg-green-600 rounded-md"
        >
          Apply Fix
        </button>
      </div>

      <div className="flex-grow flex flex-col gap-4 min-h-0">
        {/* Explanation */}
        <div className="bg-panel-light border border-border rounded-lg p-4">
          <h3 className="font-semibold text-text-primary mb-2">Explanation</h3>
          <SummaryDisplay summary={result.explanation} />
        </div>

        {/* Culprit */}
        <div className="bg-panel-light border border-border rounded-lg">
          <div className="px-4 py-2 border-b border-border">
            <h3 className="font-semibold text-text-primary">Culprit Code</h3>
            <p className="text-xs text-text-secondary font-mono">
              {result.culprit.fileIdentifier} (Line: {result.culprit.lineNumber})
            </p>
          </div>
          <pre className="p-4 overflow-x-auto text-sm bg-red-900/20">
            <code>{result.culprit.codeSnippet}</code>
          </pre>
        </div>

        {/* Fix */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="font-semibold text-text-primary mb-2">Proposed Fix</h3>
          <DiffViewer
            originalCode={result.fix.originalCode}
            refactoredCode={editedFix}
            onRefactoredCodeChange={setEditedFix}
            language={result.culprit.language}
          />
        </div>
      </div>
    </div>
  );
};
