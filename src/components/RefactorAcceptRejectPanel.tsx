import React, { useState } from 'react';
import { RefactorResult, AITeamRefactorResult } from '../services/geminiService';

interface RefactorAcceptRejectPanelProps {
  refactorResult: RefactorResult | null;
  aiTeamRefactorResult: AITeamRefactorResult | null;
  originalCode: string;
  refactoredCode: string;
  onAccept: (code: string) => void;
  onReject: () => void;
  onModify: (code: string) => void;
  isVisible: boolean;
}

export const RefactorAcceptRejectPanel: React.FC<RefactorAcceptRejectPanelProps> = ({
  refactorResult,
  aiTeamRefactorResult,
  originalCode,
  refactoredCode,
  onAccept,
  onReject,
  onModify,
  isVisible,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(refactoredCode);
  const [showDiff, setShowDiff] = useState(true);

  if (!isVisible || (!refactorResult && !aiTeamRefactorResult)) {
    return null;
  }

  const handleAccept = () => {
    onAccept(isEditing ? editedCode : refactoredCode);
    setIsEditing(false);
  };

  const handleReject = () => {
    onReject();
    setIsEditing(false);
    setEditedCode(refactoredCode);
  };

  const handleModify = () => {
    if (isEditing) {
      onModify(editedCode);
      setIsEditing(false);
    } else {
      setIsEditing(true);
      setEditedCode(refactoredCode);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedCode(refactoredCode);
  };

  const result = aiTeamRefactorResult || refactorResult;
  const summary = result?.summary || 'Refactoring completed';

  return (
    <div className="bg-panel border-t border-border p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-brand-green rounded-full animate-pulse"></div>
          <h3 className="text-sm font-semibold text-text-primary">
            {aiTeamRefactorResult ? 'AI Team Refactoring Complete' : 'Refactoring Complete'}
          </h3>
        </div>
        <button
          onClick={() => setShowDiff(!showDiff)}
          className="text-xs text-text-secondary hover:text-text-primary transition-colors"
          title={showDiff ? 'Hide diff view' : 'Show diff view'}
        >
          {showDiff ? 'Hide Diff' : 'Show Diff'}
        </button>
      </div>

      {/* Summary */}
      <div className="bg-panel-light rounded-md p-3">
        <h4 className="text-xs font-medium text-text-secondary mb-2">Summary</h4>
        <p className="text-sm text-text-primary whitespace-pre-wrap">{summary}</p>
      </div>

      {/* AI Team Details */}
      {aiTeamRefactorResult && (
        <div className="bg-panel-light rounded-md p-3">
          <h4 className="text-xs font-medium text-text-secondary mb-2">AI Team Analysis</h4>
          <div className="space-y-2">
            {aiTeamRefactorResult.steps?.map(
              (response: { role: string; content: string }, index: number) => (
                <div key={index} className="text-xs">
                  <span className="font-medium text-brand-blue">{response.role}:</span>
                  <span className="text-text-primary ml-2">{response.content}</span>
                </div>
              ),
            )}
          </div>
        </div>
      )}

      {/* Code Diff View */}
      {showDiff && (
        <div className="bg-panel-light rounded-md p-3">
          <h4 className="text-xs font-medium text-text-secondary mb-2">Changes Preview</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <h5 className="text-text-secondary mb-1">Original</h5>
              <pre className="bg-surface-elevated p-2 rounded text-text-on-surface overflow-auto max-h-40 border border-border/60 shadow-inner">
                <code>
                  {originalCode.slice(0, 500)}
                  {originalCode.length > 500 ? '...' : ''}
                </code>
              </pre>
            </div>
            <div>
              <h5 className="text-text-secondary mb-1">Refactored</h5>
              <pre className="bg-surface-elevated p-2 rounded text-text-on-surface overflow-auto max-h-40 border border-border/60 shadow-inner">
                <code>
                  {(isEditing ? editedCode : refactoredCode).slice(0, 500)}
                  {(isEditing ? editedCode : refactoredCode).length > 500 ? '...' : ''}
                </code>
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Edit Mode */}
      {isEditing && (
        <div className="bg-panel-light rounded-md p-3">
          <h4 className="text-xs font-medium text-text-secondary mb-2">Edit Refactored Code</h4>
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            className="w-full h-32 bg-gray-900 border border-gray-600 rounded text-sm p-2 text-gray-300 font-mono"
            placeholder="Edit the refactored code..."
            title="Edit refactored code"
            aria-label="Edit refactored code"
          />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAccept}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-green hover:bg-green-600 text-white rounded-md text-sm font-medium transition-colors"
            title="Accept and apply changes"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>Accept</span>
          </button>

          <button
            onClick={handleModify}
            className="flex items-center space-x-2 px-4 py-2 bg-brand-blue hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors"
            title={isEditing ? 'Save modifications' : 'Modify before accepting'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span>{isEditing ? 'Save' : 'Modify'}</span>
          </button>

          {isEditing && (
            <button
              onClick={handleCancelEdit}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-md text-sm transition-colors"
              title="Cancel editing"
            >
              Cancel
            </button>
          )}
        </div>

        <button
          onClick={handleReject}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm font-medium transition-colors"
          title="Reject changes and keep original"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
          <span>Reject</span>
        </button>
      </div>

      {/* Statistics */}
      <div className="flex items-center justify-between text-xs text-text-secondary pt-2 border-t border-border">
        <div className="flex items-center space-x-4">
          <span>Original: {originalCode.length} chars</span>
          <span>Refactored: {(isEditing ? editedCode : refactoredCode).length} chars</span>
          <span
            className={`${(isEditing ? editedCode : refactoredCode).length > originalCode.length ? 'text-red-400' : 'text-green-400'}`}
          >
            {(isEditing ? editedCode : refactoredCode).length > originalCode.length ? '+' : ''}
            {(isEditing ? editedCode : refactoredCode).length - originalCode.length} chars
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-brand-green rounded-full"></div>
          <span>Ready for review</span>
        </div>
      </div>
    </div>
  );
};

export default RefactorAcceptRejectPanel;
