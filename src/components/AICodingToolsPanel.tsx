import React, { useState, useCallback } from 'react';
import {
  WrenchScrewdriverIcon,
  CodeBracketIcon,
  ClipboardDocumentIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  CodeAnalysis,
  RefactoringSuggestion,
  TestSuite,
} from '../services/aiCodingTools';
import { useNotifications } from './NotificationSystem';
import { DiffPreviewModal } from './DiffPreviewModal';
import { useAICodingTools, ToolType } from '../hooks/useAICodingTools';
import {
  TOOL_CATEGORIES,
  ALL_TOOLS,
  TRANSLATION_TARGETS,
  OPTIMIZATION_TYPES,
  EXPLANATION_LEVELS,
  DOC_TYPES,
} from './constants';

interface AICodingToolsPanelProps {
  className?: string;
  selectedCode?: string;
  language?: string;
  filePath?: string;
  projectPath?: string;
}

export const AICodingToolsPanel: React.FC<AICodingToolsPanelProps> = ({
  className = '',
  selectedCode = '',
  language = 'javascript',
  filePath,
  projectPath = '',
}) => {
  const {
    activeTool,
    isLoading,
    results,
    localError,
    runTool,
    translationTarget,
    setTranslationTarget,
    optimizationType,
    setOptimizationType,
    explanationLevel,
    setExplanationLevel,
    docType,
    setDocType,
  } = useAICodingTools(selectedCode, language, filePath, projectPath);

  const { addNotification } = useNotifications();
  const [aiAvailable, setAiAvailable] = useState<boolean>(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState<string>('');
  const [diffProposed, setDiffProposed] = useState<string>('');
  const [diffPath, setDiffPath] = useState<string>('');

  // Check AI availability (non-blocking banner similar to Terminal)
  React.useEffect(() => {
    const api: any = (window as any).electronAPI;
    (async () => {
      try {
        const res = await api?.gemini?.isAvailable?.();
        setAiAvailable(!!res?.available);
      } catch {
        setAiAvailable(false);
      }
    })();
  }, []);

  // Save helpers
  const applyToFile = useCallback(
    async (targetPath: string, content: string) => {
      try {
        const api: any = (window as any).electronAPI;
        const res = await api?.saveFileContent?.(targetPath, content);
        if (res?.success === false) throw new Error(res?.error || 'Save failed');
        addNotification('success', 'Changes Applied', {
          message: `Saved to ${targetPath}`,
          duration: 2500,
        });
        try {
          window.dispatchEvent(
            new CustomEvent('ide:file-updated', { detail: { path: targetPath } })
          );
        } catch {
          /* noop */
        }
      } catch (e) {
        addNotification('error', 'Save Failed', {
          message: e instanceof Error ? e.message : 'Unable to save file',
          duration: 3000,
        });
      }
    },
    [addNotification]
  );

  const promptTargetPath = (defaultName: string): string | null => {
    const name = window.prompt('Target file path (absolute or within project):', defaultName);
    if (!name || !name.trim()) return null;
    return name.trim();
  };

  const openDiffPreview = useCallback(
    async (proposed: string) => {
      try {
        const api: any = (window as any).electronAPI;
        let original = '';
        if (filePath) {
          try {
            const res = await api?.readFile?.(filePath);
            original = res?.success ? res.content || '' : '';
          } catch {
            original = '';
          }
        }
        if (!original && selectedCode?.trim()) {
          original = selectedCode;
        }
        setDiffOriginal(original || '');
        setDiffProposed(proposed || '');
        setDiffPath(filePath || '');
        setDiffOpen(true);
      } catch (e) {
        addNotification('error', 'Diff Preview Failed', {
          message: e instanceof Error ? e.message : 'Unable to show diff',
          duration: 3000,
        });
      }
    },
    [filePath, selectedCode, addNotification]
  );

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addNotification('success', 'Copied', {
        message: 'Content copied to clipboard',
        duration: 1500,
      });
    } catch (error) {
      addNotification('error', 'Copy Failed', {
        message: 'Failed to copy to clipboard',
        duration: 2000,
      });
    }
  };

  const renderAnalysisResults = (analysis: CodeAnalysis) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded">
          <div className="text-sm text-blue-600 dark:text-blue-400">Maintainability</div>
          <div className="text-xl font-bold">{analysis.maintainabilityIndex}/100</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded">
          <div className="text-sm text-green-600 dark:text-green-400">Lines of Code</div>
          <div className="text-xl font-bold">{analysis.linesOfCode}</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded">
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Cyclomatic</div>
          <div className="text-xl font-bold">{analysis.cyclomaticComplexity}</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded">
          <div className="text-sm text-purple-600 dark:text-purple-400">Cognitive</div>
          <div className="text-xl font-bold">{analysis.cognitiveComplexity}</div>
        </div>
      </div>

      {analysis.technicalDebt.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Technical Debt</h4>
          <ul className="space-y-1">
            {analysis.technicalDebt.map((debt, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <ExclamationTriangleIcon className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                {debt}
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.suggestions.length > 0 && (
        <div>
          <h4 className="font-medium mb-2">Suggestions</h4>
          <ul className="space-y-1">
            {analysis.suggestions.map((suggestion, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <LightBulbIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderRefactoringResults = (suggestions: RefactoringSuggestion[]) => (
    <div className="space-y-4">
      {suggestions.map((suggestion) => (
        <div
          key={suggestion.id}
          className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium">{suggestion.title}</h4>
            <span
              className={`px-2 py-1 rounded text-xs ${ 
                suggestion.impact === 'high'
                  ? 'bg-red-100 text-red-800'
                  : suggestion.impact === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {suggestion.impact} impact
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{suggestion.description}</p>

          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="text-sm font-medium mb-1">Original</div>
              <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
                {suggestion.originalCode}
              </pre>
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Refactored</div>
              <pre className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-xs overflow-x-auto">
                {suggestion.refactoredCode}
              </pre>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-500">
              Confidence: {Math.round(suggestion.confidence * 100)}%
            </div>
            <button
              onClick={() => copyToClipboard(suggestion.refactoredCode)}
              className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
            >
              Copy Code
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTestResults = (testSuite: TestSuite) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Test Suite ({testSuite.framework})</h4>
        <button
          onClick={() => copyToClipboard(testSuite.testCases.map((t) => t.code).join('\n\n'))}
          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
        >
          Copy All Tests
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 text-sm">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-center">
          <div className="font-medium">{testSuite.coverage.lines}%</div>
          <div className="text-xs">Lines</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-center">
          <div className="font-medium">{testSuite.coverage.functions}%</div>
          <div className="text-xs">Functions</div>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-center">
          <div className="font-medium">{testSuite.coverage.branches}%</div>
          <div className="text-xs">Branches</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-center">
          <div className="font-medium">{testSuite.coverage.statements}%</div>
          <div className="text-xs">Statements</div>
        </div>
      </div>

      <div className="space-y-3">
        {testSuite.testCases.map((testCase) => (
          <div
            key={testCase.id}
            className="border border-gray-200 dark:border-gray-700 rounded p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <h5 className="font-medium">{testCase.name}</h5>
              <span
                className={`px-2 py-1 rounded text-xs ${ 
                  testCase.type === 'unit'
                    ? 'bg-blue-100 text-blue-800'
                    : testCase.type === 'integration'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {testCase.type}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{testCase.description}</p>
            <pre className="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">
              {testCase.code}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`h-full flex flex-col bg-gray-950 ${className}`}>
      {/* BRAND NEW: Minimal Top Bar */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">AI Tools</h2>
            <p className="text-xs text-white/80 mt-0.5">{filePath ? filePath.split(/[\\/]/).pop() : selectedCode ? `${selectedCode.length} chars selected` : 'Select code to begin'}</p>
          </div>
          {!aiAvailable && <span className="text-xs bg-yellow-400 text-black px-2 py-1 rounded-full font-bold">⚠ Offline Mode</span>}
        </div>
      </div>

      {localError && (
        <div className="bg-red-500/90 backdrop-blur text-white px-6 py-3 text-sm font-medium border-b border-red-600">
          {localError}
        </div>
      )}

      {/* BRAND NEW: Card-Based Dashboard Layout */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {Object.entries(TOOL_CATEGORIES).map(([catKey, category]) => (
          <div key={catKey}>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">{category.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              {category.tools.map((tool: any) => (
                <button
                  key={tool.id}
                  onClick={() => runTool(tool.id as ToolType)}
                  disabled={isLoading}
                  className={`group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 ${ 
                    activeTool === tool.id
                      ? `bg-gradient-to-br ${category.color} shadow-2xl scale-105`
                      : 'bg-gray-800/50 hover:bg-gray-800 hover:scale-102 border border-gray-700/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className="relative z-10">
                    <div className={`text-lg mb-2 ${ 
                      activeTool === tool.id ? 'scale-110' : 'group-hover:scale-110'
                    } transition-transform duration-300`}>{tool.emoji}</div>
                    <div className={`text-sm font-bold mb-1 ${ 
                      activeTool === tool.id ? 'text-white' : 'text-gray-200'
                    }`}>{tool.name}</div>
                    <div className={`text-xs ${ 
                      activeTool === tool.id ? 'text-white/80' : 'text-gray-500'
                    }`}>{tool.desc}</div>
                  </div>
                  {activeTool === tool.id && (
                    <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* BRAND NEW: Floating Options Panel */}
      {activeTool && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-t border-gray-700/50 px-6 py-4 backdrop-blur-xl">
          {activeTool === 'translate' && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-white">Translate to:</label>
              <select
                value={translationTarget}
                onChange={(e) => setTranslationTarget(e.target.value)}
                className="px-4 py-2 text-sm border border-violet-500/50 rounded-lg bg-gray-900/80 text-white font-medium hover:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                title="Target language"
              >
                {TRANSLATION_TARGETS.map((target) => (
                  <option key={target.value} value={target.value}>
                    {target.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTool === 'optimize' && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-white">Optimize for:</label>
              <select
                value={optimizationType}
                onChange={(e) => setOptimizationType(e.target.value as any)}
                className="px-4 py-2 text-sm border border-violet-500/50 rounded-lg bg-gray-900/80 text-white font-medium hover:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                title="Optimization type"
              >
                {OPTIMIZATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTool === 'explain' && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-white">Complexity:</label>
              <select
                value={explanationLevel}
                onChange={(e) => setExplanationLevel(e.target.value as any)}
                className="px-4 py-2 text-sm border border-violet-500/50 rounded-lg bg-gray-900/80 text-white font-medium hover:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                title="Explanation level"
              >
                {EXPLANATION_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeTool === 'document' && (
            <div className="flex items-center gap-4">
              <label className="text-sm font-semibold text-white">Doc type:</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
                className="px-4 py-2 text-sm border border-violet-500/50 rounded-lg bg-gray-900/80 text-white font-medium hover:border-violet-500 focus:ring-2 focus:ring-violet-500 transition-all"
                title="Documentation type"
              >
                {DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* BRAND NEW: Modern Results Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-gray-900 to-gray-950">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Processing...</p>
          </div>
        ) : results && activeTool ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {ALL_TOOLS.find((t) => t.id === activeTool)?.name} Results
              </h3>
              <button
                onClick={() =>
                  copyToClipboard(
                    typeof results === 'string' ? results : JSON.stringify(results, null, 2)
                  )
                }
                className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </button>
            </div>

            {activeTool === 'analyze' && renderAnalysisResults(results)}
            {activeTool === 'refactor' && (
              <>
                {renderRefactoringResults(results)}
                {/* Apply actions per suggestion */}
                <div className="mt-4 space-y-2">
                  {Array.isArray(results) &&
                    results.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            // Open diff preview first
                            await openDiffPreview(String(s.refactoredCode || ''));
                          }}
                          className="px-3 py-1 bg-brand-blue text-white rounded text-sm hover:bg-blue-600"
                          title="Apply refactored code to file"
                        >
                          Apply This Suggestion
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
            {activeTool === 'test' && renderTestResults(results)}
            {(activeTool === 'format' || activeTool === 'translate') && (
              <>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">
                  {results}
                </pre>
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      await openDiffPreview(String(results || ''));
                    }}
                    className="px-3 py-1 bg-brand-blue text-white rounded text-sm hover:bg-blue-600"
                    title="Apply formatted/translated code to file"
                  >
                    Apply to File
                  </button>
                </div>
              </>
            )}
            {activeTool === 'complete' && Array.isArray(results) && (
              <div className="space-y-2">
                {results.map((completion, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <code className="text-sm">{completion}</code>
                    <button
                      onClick={() => copyToClipboard(completion)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(activeTool === 'document' ||
              activeTool === 'explain' ||
              activeTool === 'review' ||
              activeTool === 'optimize') && (
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : results ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">
                {ALL_TOOLS.find((t) => t.id === activeTool)?.name} Results
              </h3>
              <button
                onClick={() =>
                  copyToClipboard(
                    typeof results === 'string' ? results : JSON.stringify(results, null, 2)
                  )
                }
                className="flex items-center gap-1 px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                <ClipboardDocumentIcon className="w-4 h-4" />
                Copy
              </button>
            </div>

            {activeTool === 'analyze' && renderAnalysisResults(results)}
            {activeTool === 'refactor' && (
              <>
                {renderRefactoringResults(results)}
                {/* Apply actions per suggestion */}
                <div className="mt-4 space-y-2">
                  {Array.isArray(results) &&
                    results.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            // Open diff preview first
                            await openDiffPreview(String(s.refactoredCode || ''));
                          }}
                          className="px-3 py-1 bg-brand-blue text-white rounded text-sm hover:bg-blue-600"
                          title="Apply refactored code to file"
                        >
                          Apply This Suggestion
                        </button>
                      </div>
                    ))}
                </div>
              </>
            )}
            {activeTool === 'test' && renderTestResults(results)}
            {(activeTool === 'format' || activeTool === 'translate') && (
              <>
                <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded overflow-x-auto">
                  {results}
                </pre>
                <div className="mt-3">
                  <button
                    onClick={async () => {
                      await openDiffPreview(String(results || ''));
                    }}
                    className="px-3 py-1 bg-brand-blue text-white rounded text-sm hover:bg-blue-600"
                    title="Apply formatted/translated code to file"
                  >
                    Apply to File
                  </button>
                </div>
              </>
            )}
            {activeTool === 'complete' && Array.isArray(results) && (
              <div className="space-y-2">
                {results.map((completion, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <code className="text-sm">{completion}</code>
                    <button
                      onClick={() => copyToClipboard(completion)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            )}
            {(activeTool === 'document' ||
              activeTool === 'explain' ||
              activeTool === 'review' ||
              activeTool === 'optimize') && (
              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
              </div>
            )}
          </div>
        ) : !selectedCode.trim() ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <CodeBracketIcon className="w-6 h-6 mb-1 opacity-50" />
            <p className="text-lg font-medium mb-2">Select Code to Analyze</p>
            <p className="text-sm text-center max-w-md">
              Highlight some code in your editor to use AI-powered analysis, refactoring, testing,
              documentation, and other coding tools.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <WrenchScrewdriverIcon className="w-6 h-6 mb-1 opacity-50" />
            <p className="text-lg font-medium mb-2">Choose a Tool</p>
            <p className="text-sm text-center max-w-md">
              Select one of the AI coding tools above to analyze your selected code.
            </p>
          </div>
        )}
      </div>

      {/* Diff Preview Modal */}
      <DiffPreviewModal
        isOpen={diffOpen}
        filePath={diffPath || filePath || ''}
        original={diffOriginal}
        proposed={diffProposed}
        onClose={() => setDiffOpen(false)}
        onReplace={async () => {
          try {
            const target = (diffPath || filePath || '').trim() || promptTargetPath('refactor.ts');
            if (!target) return;
            await applyToFile(target, diffProposed);
            setDiffOpen(false);
          } catch {
            /* notifications handled */
          }
        }}
        onAppend={async () => {
          try {
            const target = (diffPath || filePath || '').trim() || promptTargetPath('refactor.ts');
            if (!target) return;
            const combined = (diffOriginal ? diffOriginal + '\n\n' : '') + diffProposed;
            await applyToFile(target, combined);
            setDiffOpen(false);
          } catch {
            /* notifications handled */
          }
        }}
        onSaveAsNew={async () => {
          try {
            const baseName = (filePath?.split(/[\\/]/).pop() || 'refactor').replace(/\s+/g, '-');
            const target = promptTargetPath(`${baseName}.new.ts`);
            if (!target) return;
            await applyToFile(target, diffProposed);
            try {
              window.dispatchEvent(
                new CustomEvent('ide:file-open-request', { detail: { path: target } }),
              );
            } catch {
              /* noop */
            }
            setDiffOpen(false);
          } catch {
            /* notifications handled */
          }
        }}
      />
    </div>
  );
};

export default AICodingToolsPanel;