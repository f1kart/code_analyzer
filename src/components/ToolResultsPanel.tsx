/**
 * Unified Tool Results Panel
 * Shows tool execution results in main editor area with:
 * - Simple explanations
 * - Affected files list
 * - Before/After preview
 * - Accept/Reject/Modify options
 * - No auto-save - user always decides
 * 
 * KEN RULES: PRODUCTION-READY, USER-FRIENDLY, NO MOCKUPS
 */

import React, { useState } from 'react';

export interface ToolResult {
  toolName: string;
  toolIcon: string;
  simpleExplanation: string; // "Explain Like I'm 5"
  technicalDetails?: string;
  filesAffected: Array<{
    path: string;
    changeType: 'created' | 'modified' | 'deleted';
    lineCount?: number;
    before?: string;
    after?: string;
  }>;
  summary: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    issuesFound?: number;
    issuesFixed?: number;
  };
  timestamp: Date;
  canModify: boolean;
  canReject: boolean;
}

interface ToolResultsPanelProps {
  result: ToolResult;
  onAccept: () => void;
  onReject: () => void;
  onModify?: (modifiedFiles: Array<{ path: string; content: string }>) => void;
  onClose: () => void;
  onFileClick?: (filePath: string, line?: number) => void;
}

export const ToolResultsPanel: React.FC<ToolResultsPanelProps> = ({
  result,
  onAccept,
  onReject,
  onModify,
  onClose,
  onFileClick
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(
    result.filesAffected[0]?.path || null
  );
  const [showDiff, setShowDiff] = useState(true);
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedContent, setModifiedContent] = useState<Record<string, string>>({});

  const selectedFileData = result.filesAffected.find(f => f.path === selectedFile);

  const handleAccept = () => {
    if (isModifying && Object.keys(modifiedContent).length > 0) {
      // Apply modified changes
      const modifiedFiles = Object.entries(modifiedContent).map(([path, content]) => ({
        path,
        content
      }));
      onModify?.(modifiedFiles);
    } else {
      // Apply original changes
      onAccept();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{result.toolIcon}</span>
          <div>
            <h3 className="text-xl font-bold">{result.toolName}</h3>
            <p className="text-sm text-indigo-100">
              {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition"
          title="Close results"
        >
          ✕
        </button>
      </div>

      {/* Simple Explanation */}
      <div className="bg-blue-50 border-b-2 border-blue-200 px-6 py-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <h4 className="font-bold text-blue-900 mb-2">What Just Happened? (Simple Explanation)</h4>
            <p className="text-blue-800 text-base leading-relaxed">
              {result.simpleExplanation}
            </p>
            {result.technicalDetails && (
              <details className="mt-3">
                <summary className="text-sm text-blue-700 cursor-pointer hover:text-blue-900 font-medium">
                  🔧 Technical Details
                </summary>
                <p className="text-sm text-blue-600 mt-2 pl-4 border-l-2 border-blue-300">
                  {result.technicalDetails}
                </p>
              </details>
            )}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white border-b-2 border-gray-200 px-6 py-3">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📁</span>
            <span className="font-medium text-gray-700">
              {result.summary.filesChanged} file{result.summary.filesChanged !== 1 ? 's' : ''} affected
            </span>
          </div>
          {result.summary.linesAdded > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-green-600">+{result.summary.linesAdded}</span>
              <span className="text-gray-600">lines added</span>
            </div>
          )}
          {result.summary.linesRemoved > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-red-600">-{result.summary.linesRemoved}</span>
              <span className="text-gray-600">lines removed</span>
            </div>
          )}
          {result.summary.issuesFound !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-orange-600">⚠️ {result.summary.issuesFound}</span>
              <span className="text-gray-600">issues found</span>
            </div>
          )}
          {result.summary.issuesFixed !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-green-600">✅ {result.summary.issuesFixed}</span>
              <span className="text-gray-600">issues fixed</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content: File List + Preview */}
      <div className="flex-1 flex overflow-hidden">
        {/* File List Sidebar */}
        <div className="w-80 bg-white border-r-2 border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h5 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span>📂</span>
              Files Affected
            </h5>
            <div className="space-y-2">
              {result.filesAffected.map((file) => (
                <button
                  key={file.path}
                  onClick={() => {
                    setSelectedFile(file.path);
                    setIsModifying(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                    selectedFile === file.path
                      ? 'bg-indigo-100 border-2 border-indigo-400'
                      : 'bg-gray-50 border-2 border-gray-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span>
                      {file.changeType === 'created' ? '✨' : 
                       file.changeType === 'modified' ? '📝' : '🗑️'}
                    </span>
                    <span className="text-sm font-mono text-gray-900 flex-1 truncate">
                      {file.path}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="capitalize">{file.changeType}</span>
                    {file.lineCount && (
                      <span>• {file.lineCount} lines</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* File Preview/Editor */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedFileData ? (
            <>
              {/* File Header */}
              <div className="bg-gray-100 border-b-2 border-gray-200 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {selectedFileData.changeType === 'created' ? '✨' : 
                     selectedFileData.changeType === 'modified' ? '📝' : '🗑️'}
                  </span>
                  <div>
                    <h6 className="font-bold text-gray-900">{selectedFile}</h6>
                    <p className="text-xs text-gray-600 capitalize">
                      {selectedFileData.changeType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedFileData.before && selectedFileData.after && (
                    <button
                      onClick={() => setShowDiff(!showDiff)}
                      className="px-3 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded text-sm font-medium transition"
                    >
                      {showDiff ? '📄 Show After' : '🔄 Show Diff'}
                    </button>
                  )}
                  {onFileClick && (
                    <button
                      onClick={() => onFileClick(selectedFile!)}
                      className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm font-medium transition"
                      title="Open in main editor"
                    >
                      📝 Open in Editor
                    </button>
                  )}
                </div>
              </div>

              {/* Content Preview */}
              <div className="flex-1 overflow-auto p-4">
                {isModifying ? (
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-sm text-orange-700 bg-orange-50 px-3 py-2 rounded">
                      <span>✏️</span>
                      <span>Edit mode: Make your changes below, then click Accept to apply them.</span>
                    </div>
                    <textarea
                      value={modifiedContent[selectedFile!] || selectedFileData.after || ''}
                      onChange={(e) => setModifiedContent({
                        ...modifiedContent,
                        [selectedFile!]: e.target.value
                      })}
                      className="w-full h-[500px] font-mono text-sm border-2 border-indigo-300 rounded p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      spellCheck={false}
                      title="Edit file content"
                      placeholder="Enter your code here..."
                      aria-label="Code editor"
                    />
                  </div>
                ) : showDiff && selectedFileData.before && selectedFileData.after ? (
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div>
                      <div className="bg-red-100 border-b-2 border-red-300 px-3 py-1 text-sm font-bold text-red-900">
                        Before
                      </div>
                      <pre className="p-3 bg-red-50 text-sm overflow-auto h-[500px] border-2 border-red-200 rounded-b">
                        <code>{selectedFileData.before}</code>
                      </pre>
                    </div>
                    <div>
                      <div className="bg-green-100 border-b-2 border-green-300 px-3 py-1 text-sm font-bold text-green-900">
                        After
                      </div>
                      <pre className="p-3 bg-green-50 text-sm overflow-auto h-[500px] border-2 border-green-200 rounded-b">
                        <code>{selectedFileData.after}</code>
                      </pre>
                    </div>
                  </div>
                ) : (
                  <pre className="p-3 bg-gray-50 text-sm overflow-auto h-[500px] border-2 border-gray-200 rounded font-mono">
                    <code>{selectedFileData.after || selectedFileData.before || '(Empty file)'}</code>
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <span className="text-6xl block mb-3">📁</span>
                <p>Select a file to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-gray-100 border-t-2 border-gray-300 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="text-sm font-bold text-gray-900">
              {isModifying ? 'Review your changes carefully!' : 'No changes have been saved yet!'}
            </p>
            <p className="text-xs text-gray-600">
              {isModifying 
                ? 'Click Accept to apply your modified changes, or Cancel to discard edits.'
                : 'Click Accept to apply these changes, or Reject to cancel.'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {result.canReject && (
            <button
              onClick={() => {
                if (confirm('❌ Reject all changes?\n\nThis will discard everything and nothing will be saved.')) {
                  onReject();
                }
              }}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold transition flex items-center gap-2"
            >
              <span>❌</span>
              <span>Reject</span>
            </button>
          )}
          
          {result.canModify && onModify && !isModifying && (
            <button
              onClick={() => setIsModifying(true)}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-bold transition flex items-center gap-2"
            >
              <span>✏️</span>
              <span>Modify</span>
            </button>
          )}
          
          {isModifying && (
            <button
              onClick={() => {
                setIsModifying(false);
                setModifiedContent({});
              }}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-bold transition flex items-center gap-2"
            >
              <span>🔙</span>
              <span>Cancel Edit</span>
            </button>
          )}
          
          <button
            onClick={handleAccept}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition flex items-center gap-2"
          >
            <span>✅</span>
            <span>{isModifying ? 'Accept Modified' : 'Accept'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
