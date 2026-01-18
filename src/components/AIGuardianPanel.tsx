import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheckIcon,
  ShieldExclamationIcon,
  PlayIcon,
  StopIcon,
  ExclamationTriangleIcon,
  BugAntIcon,
  LockClosedIcon,
  BoltIcon,
  WrenchScrewdriverIcon,
  PaintBrushIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  EyeIcon,
  CogIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { aiGuardian, GuardianIssue, GuardianReport } from '../services/aiGuardian';
import { useNotifications } from './NotificationSystem';

interface AIGuardianPanelProps {
  className?: string;
  projectPath?: string;
}

export const AIGuardianPanel: React.FC<AIGuardianPanelProps> = ({
  className = '',
  projectPath,
}) => {
  const [isActive, setIsActive] = useState(false);
  const [currentReport, setCurrentReport] = useState<GuardianReport | null>(null);
  const [issues, setIssues] = useState<GuardianIssue[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<GuardianIssue | null>(null);
  const [filterType, setFilterType] = useState<GuardianIssue['type'] | 'all'>('all');
  const [filterSeverity, setFilterSeverity] = useState<GuardianIssue['severity'] | 'all'>('all');
  const [showResolved, setShowResolved] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState(aiGuardian.getConfig());

  const { addNotification } = useNotifications();

  // Monitor Guardian state
  useEffect(() => {
    const updateState = () => {
      setIsActive(aiGuardian.isRunning());
      setCurrentReport(aiGuardian.getCurrentReport());
      setIssues(aiGuardian.getIssues());
    };

    updateState();
    const interval = setInterval(updateState, 1000);

    // Listen for new issues
    const unsubscribe = aiGuardian.onIssuesDetected((criticalIssues) => {
      if (criticalIssues.length > 0) {
        addNotification('warning', 'AI Guardian Alert', {
          message: `Found ${criticalIssues.length} critical issue(s) in your code`,
          duration: 5000,
        });
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [addNotification]);

  const startGuardian = useCallback(() => {
    if (!projectPath) {
      addNotification('warning', 'No Project', {
        message: 'Please open a project to start AI Guardian monitoring',
        duration: 3000,
      });
      return;
    }

    aiGuardian.start(projectPath);
    addNotification('success', 'AI Guardian Started', {
      message: 'Background monitoring is now active',
      duration: 3000,
    });
  }, [projectPath, addNotification]);

  const stopGuardian = useCallback(() => {
    aiGuardian.stop();
    addNotification('info', 'AI Guardian Stopped', {
      message: 'Background monitoring has been disabled',
      duration: 3000,
    });
  }, [addNotification]);

  const resolveIssue = useCallback(
    (issueId: string) => {
      if (aiGuardian.resolveIssue(issueId)) {
        setIssues((prev) =>
          prev.map((issue) =>
            issue.id === issueId ? { ...issue, resolved: true, resolvedAt: Date.now() } : issue,
          ),
        );
        addNotification('success', 'Issue Resolved', {
          message: 'Issue has been marked as resolved',
          duration: 2000,
        });
      }
    },
    [addNotification],
  );

  const applyAutoFix = useCallback(
    async (issueId: string) => {
      try {
        const success = await aiGuardian.applyAutoFix(issueId);
        if (success) {
          addNotification('success', 'Auto-fix Applied', {
            message: 'The issue has been automatically fixed',
            duration: 3000,
          });
        } else {
          addNotification('error', 'Auto-fix Failed', {
            message: 'Unable to apply automatic fix',
            duration: 3000,
          });
        }
      } catch (error) {
        addNotification('error', 'Auto-fix Error', {
          message: error instanceof Error ? error.message : 'Unknown error',
          duration: 3000,
        });
      }
    },
    [addNotification],
  );

  const updateConfig = useCallback(
    (newConfig: Partial<typeof config>) => {
      const updatedConfig = { ...config, ...newConfig };
      setConfig(updatedConfig);
      aiGuardian.updateConfig(updatedConfig);
    },
    [config],
  );

  const getTypeIcon = (type: GuardianIssue['type']) => {
    switch (type) {
      case 'bug':
        return <BugAntIcon className="w-4 h-4 text-red-500" />;
      case 'security':
        return <LockClosedIcon className="w-4 h-4 text-orange-500" />;
      case 'performance':
        return <BoltIcon className="w-4 h-4 text-yellow-500" />;
      case 'maintainability':
        return <WrenchScrewdriverIcon className="w-4 h-4 text-blue-500" />;
      case 'style':
        return <PaintBrushIcon className="w-4 h-4 text-purple-500" />;
      default:
        return <ExclamationTriangleIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: GuardianIssue['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredIssues = issues.filter((issue) => {
    if (!showResolved && issue.resolved) return false;
    if (filterType !== 'all' && issue.type !== filterType) return false;
    if (filterSeverity !== 'all' && issue.severity !== filterSeverity) return false;
    return true;
  });

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
  };

  return (
    <div className={`h-full flex flex-col bg-white dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {isActive ? (
            <ShieldCheckIcon className="w-5 h-5 text-green-600" />
          ) : (
            <ShieldExclamationIcon className="w-5 h-5 text-gray-400" />
          )}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Guardian</h2>
          {isActive && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Active
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Settings"
          >
            <CogIcon className="w-4 h-4" />
          </button>

          {isActive ? (
            <button
              onClick={stopGuardian}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <StopIcon className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={startGuardian}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <PlayIcon className="w-4 h-4" />
              Start
            </button>
          )}
        </div>
      </div>

      {/* Status Bar */}
      {currentReport && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 dark:text-gray-400">Status</div>
              <div className="flex items-center gap-1 font-medium">
                {currentReport.status === 'scanning' && (
                  <>
                    <ArrowPathIcon className="w-4 h-4 animate-spin text-blue-500" />
                    Scanning
                  </>
                )}
                {currentReport.status === 'completed' && (
                  <>
                    <CheckCircleIcon className="w-4 h-4 text-green-500" />
                    Complete
                  </>
                )}
                {currentReport.status === 'failed' && (
                  <>
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                    Failed
                  </>
                )}
              </div>
            </div>

            <div>
              <div className="text-gray-500 dark:text-gray-400">Files</div>
              <div className="font-medium">
                {currentReport.scannedFiles} / {currentReport.totalFiles}
              </div>
            </div>

            <div>
              <div className="text-gray-500 dark:text-gray-400">Issues</div>
              <div className="font-medium">{currentReport.issues.length}</div>
            </div>

            <div>
              <div className="text-gray-500 dark:text-gray-400">Duration</div>
              <div className="font-medium">
                {currentReport.scanCompleted
                  ? formatDuration(currentReport.scanCompleted - currentReport.scanStarted)
                  : formatDuration(Date.now() - currentReport.scanStarted)}
              </div>
            </div>
          </div>

          {/* Summary */}
          {currentReport.summary && (
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Critical: {currentReport.summary.critical}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                High: {currentReport.summary.high}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Medium: {currentReport.summary.medium}
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                Low: {currentReport.summary.low}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-gray-700 dark:text-gray-300">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              title="Filter by issue type"
              aria-label="Issue type filter"
            >
              <option value="all">All</option>
              <option value="bug">Bugs</option>
              <option value="security">Security</option>
              <option value="performance">Performance</option>
              <option value="maintainability">Maintainability</option>
              <option value="style">Style</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-gray-700 dark:text-gray-300">Severity:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100"
              title="Filter by issue severity"
              aria-label="Issue severity filter"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-700 dark:text-gray-300">Show resolved</span>
          </label>
        </div>
      </div>

      {/* Issues List */}
      <div className="flex-1 overflow-y-auto">
        {filteredIssues.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <ShieldCheckIcon className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg font-medium mb-2">
              {issues.length === 0 ? 'No Issues Found' : 'No Issues Match Filters'}
            </p>
            <p className="text-sm text-center">
              {!isActive
                ? 'Start AI Guardian to begin monitoring your code'
                : issues.length === 0
                  ? 'Your code looks clean! AI Guardian is monitoring for issues.'
                  : 'Try adjusting your filters to see more issues.'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredIssues.map((issue) => (
              <div
                key={issue.id}
                className={`border rounded-lg p-4 transition-all ${
                  issue.resolved
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 opacity-75'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(issue.type)}
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(issue.severity)}`}
                      >
                        {issue.severity.toUpperCase()}
                      </span>
                      {issue.resolved && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          RESOLVED
                        </span>
                      )}
                    </div>

                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {issue.title}
                    </h3>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {issue.description}
                    </p>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {issue.filePath}
                      {issue.lineNumber && ` (Line ${issue.lineNumber})`}
                    </div>

                    {issue.suggestion && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-sm">
                        <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
                          Suggestion:
                        </div>
                        <div className="text-blue-700 dark:text-blue-300">{issue.suggestion}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {issue.autoFixAvailable && !issue.resolved && (
                      <button
                        onClick={() => applyAutoFix(issue.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded text-xs hover:bg-purple-700 transition-colors"
                        title="Apply Auto-fix"
                      >
                        <SparklesIcon className="w-3 h-3" />
                        Fix
                      </button>
                    )}

                    {!issue.resolved && (
                      <button
                        onClick={() => resolveIssue(issue.id)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                        title="Mark as Resolved"
                      >
                        <CheckCircleIcon className="w-3 h-3" />
                        Resolve
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedIssue(issue)}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                      title="View Details"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Guardian Settings
              </h2>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close settings"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scan Interval (seconds)
                </label>
                <input
                  type="number"
                  value={config.scanIntervalMs / 1000}
                  onChange={(e) =>
                    updateConfig({ scanIntervalMs: parseInt(e.target.value) * 1000 })
                  }
                  min="10"
                  max="300"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                  title="Scan interval in seconds"
                  aria-label="Scan interval in seconds"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Max Files Per Scan
                </label>
                <input
                  type="number"
                  value={config.maxFilesPerScan}
                  onChange={(e) => updateConfig({ maxFilesPerScan: parseInt(e.target.value) })}
                  min="10"
                  max="200"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                  title="Maximum files per scan"
                  aria-label="Maximum files per scan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Severity Threshold
                </label>
                <select
                  value={config.severityThreshold}
                  onChange={(e) => updateConfig({ severityThreshold: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
                  title="Severity threshold"
                  aria-label="Severity threshold"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config.enableAutoFix}
                  onChange={(e) => updateConfig({ enableAutoFix: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable Auto-fix (Experimental)
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Issue Details Modal */}
      {selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Issue Details
              </h2>
              <button
                onClick={() => setSelectedIssue(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close issue details"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedIssue.type)}
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium border ${getSeverityColor(selectedIssue.severity)}`}
                  >
                    {selectedIssue.severity.toUpperCase()}
                  </span>
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  {selectedIssue.title}
                </h3>

                <p className="text-gray-600 dark:text-gray-400">{selectedIssue.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">File:</span> {selectedIssue.filePath}
                  </div>
                  <div>
                    <span className="font-medium">Line:</span> {selectedIssue.lineNumber || 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Type:</span> {selectedIssue.type}
                  </div>
                  <div>
                    <span className="font-medium">Detected:</span>{' '}
                    {new Date(selectedIssue.detectedAt).toLocaleString()}
                  </div>
                </div>

                {selectedIssue.codeSnippet && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Code Snippet:
                    </h4>
                    <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-sm overflow-x-auto">
                      {selectedIssue.codeSnippet}
                    </pre>
                  </div>
                )}

                {selectedIssue.suggestion && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Suggestion:
                    </h4>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-sm text-blue-800 dark:text-blue-200">
                      {selectedIssue.suggestion}
                    </div>
                  </div>
                )}

                {selectedIssue.autoFix && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Auto-fix:</h4>
                    <pre className="bg-green-50 dark:bg-green-900/20 p-3 rounded text-sm overflow-x-auto text-green-800 dark:text-green-200">
                      {selectedIssue.autoFix}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIGuardianPanel;
