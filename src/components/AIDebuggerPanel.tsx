import React, { useState, useEffect } from 'react';
import {
  PlayIcon,
  PauseIcon,
  StopIcon,
  ForwardIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  BugAntIcon,
  EyeIcon,
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { aiDebugger, DebugSession } from '../services/aiDebugger';

interface AIDebuggerPanelProps {
  className?: string;
}

export const AIDebuggerPanel: React.FC<AIDebuggerPanelProps> = ({ className = '' }) => {
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [activeSession, setActiveSession] = useState<DebugSession | null>(null);
  const [selectedTab, setSelectedTab] = useState<'variables' | 'watch' | 'callstack' | 'analysis'>(
    'variables',
  );
  const [newWatchExpression, setNewWatchExpression] = useState('');
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionFile, setNewSessionFile] = useState('');

  useEffect(() => {
    const unsubscribeSession = aiDebugger.onSessionChanged((session) => {
      setSessions(aiDebugger.getSessions());
      if (session.id === activeSession?.id) {
        setActiveSession(session);
      }
    });

    const unsubscribeBreakpoint = aiDebugger.onBreakpointChanged(() => {
      setSessions(aiDebugger.getSessions());
    });

    // Load initial data
    setSessions(aiDebugger.getSessions());
    setActiveSession(aiDebugger.getActiveSession());

    return () => {
      unsubscribeSession();
      unsubscribeBreakpoint();
    };
  }, [activeSession?.id]);

  const handleCreateSession = async () => {
    if (!newSessionName.trim() || !newSessionFile.trim()) return;

    try {
      const session = await aiDebugger.createDebugSession({
        name: newSessionName,
        filePath: newSessionFile,
        language: getLanguageFromFile(newSessionFile),
      });

      setActiveSession(session);
      setShowCreateSession(false);
      setNewSessionName('');
      setNewSessionFile('');
    } catch (error) {
      console.error('Failed to create debug session:', error);
    }
  };

  const handleStartDebugging = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.startDebugging(activeSession.id);
    } catch (error) {
      console.error('Failed to start debugging:', error);
    }
  };

  const handlePauseDebugging = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.pauseDebugging(activeSession.id);
    } catch (error) {
      console.error('Failed to pause debugging:', error);
    }
  };

  const handleStopDebugging = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.stopDebugging(activeSession.id);
    } catch (error) {
      console.error('Failed to stop debugging:', error);
    }
  };

  const handleStepOver = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.stepOver(activeSession.id);
    } catch (error) {
      console.error('Failed to step over:', error);
    }
  };

  const handleStepInto = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.stepInto(activeSession.id);
    } catch (error) {
      console.error('Failed to step into:', error);
    }
  };

  const handleStepOut = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.stepOut(activeSession.id);
    } catch (error) {
      console.error('Failed to step out:', error);
    }
  };

  const handleContinue = async () => {
    if (!activeSession) return;

    try {
      await aiDebugger.continue(activeSession.id);
    } catch (error) {
      console.error('Failed to continue:', error);
    }
  };

  const handleAddWatch = async () => {
    if (!activeSession || !newWatchExpression.trim()) return;

    try {
      await aiDebugger.addWatchExpression(activeSession.id, newWatchExpression);
      setNewWatchExpression('');
    } catch (error) {
      console.error('Failed to add watch expression:', error);
    }
  };

  const handleRemoveWatch = async (watchId: string) => {
    if (!activeSession) return;

    try {
      await aiDebugger.removeWatchExpression(activeSession.id, watchId);
    } catch (error) {
      console.error('Failed to remove watch expression:', error);
    }
  };

  const _handleToggleBreakpoint = async (breakpointId: string) => {
    if (!activeSession) return;

    try {
      await aiDebugger.toggleBreakpoint(activeSession.id, breakpointId);
    } catch (error) {
      console.error('Failed to toggle breakpoint:', error);
    }
  };

  const getLanguageFromFile = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
        return 'javascript';
      case 'ts':
      case 'tsx':
        return 'typescript';
      case 'py':
        return 'python';
      case 'java':
        return 'java';
      case 'cpp':
      case 'cc':
      case 'cxx':
        return 'cpp';
      case 'c':
        return 'c';
      case 'cs':
        return 'csharp';
      case 'go':
        return 'go';
      case 'rs':
        return 'rust';
      default:
        return 'unknown';
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <BugAntIcon className="w-6 h-6 text-red-600" />
          <h2 className="text-xl font-semibold text-gray-900">AI Debugger</h2>
        </div>
        <button
          onClick={() => setShowCreateSession(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Session</span>
        </button>
      </div>

      {/* Session Selection */}
      {sessions.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <select
            value={activeSession?.id || ''}
            onChange={(e) => {
              const session = sessions.find((s) => s.id === e.target.value);
              setActiveSession(session || null);
            }}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            title="Select debug session"
            aria-label="Debug session selection"
          >
            <option value="">Select Debug Session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.name} - {session.filePath}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Debug Controls */}
      {activeSession && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            {!activeSession.isRunning ? (
              <button
                onClick={handleStartDebugging}
                className="flex items-center space-x-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <PlayIcon className="w-4 h-4" />
                <span>Start</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handlePauseDebugging}
                  className="flex items-center space-x-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  <PauseIcon className="w-4 h-4" />
                  <span>Pause</span>
                </button>
                <button
                  onClick={handleStopDebugging}
                  className="flex items-center space-x-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop</span>
                </button>
              </>
            )}

            {activeSession.isRunning && (
              <>
                <div className="w-px h-6 bg-gray-300" />
                <button
                  onClick={handleStepOver}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Step Over"
                >
                  <ForwardIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStepInto}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Step Into"
                >
                  <ArrowDownIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleStepOut}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Step Out"
                >
                  <ArrowUpIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={handleContinue}
                  className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Continue"
                >
                  <PlayIcon className="w-4 h-4" />
                </button>
              </>
            )}
          </div>

          {activeSession.isRunning && (
            <div className="mt-2 text-sm text-gray-600">
              Current Line:{' '}
              <span className="font-mono font-medium">{activeSession.currentLine}</span>
              {activeSession.isPaused && (
                <span className="ml-4 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                  Paused
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content Tabs */}
      {activeSession && (
        <>
          <div className="flex border-b border-gray-200">
            {[
              { id: 'variables', label: 'Variables', icon: EyeIcon },
              { id: 'watch', label: 'Watch', icon: ClockIcon },
              { id: 'callstack', label: 'Call Stack', icon: CpuChipIcon },
              { id: 'analysis', label: 'AI Analysis', icon: BugAntIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  selectedTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {selectedTab === 'variables' && (
              <div className="p-4 space-y-3">
                {activeSession.variables.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No variables available</div>
                ) : (
                  activeSession.variables.map((variable, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{variable.name}</span>
                        <span className="text-xs text-gray-500 px-2 py-1 bg-gray-200 rounded">
                          {variable.type}
                        </span>
                      </div>
                      <div className="font-mono text-sm text-gray-700 bg-white p-2 rounded border">
                        {formatValue(variable.value)}
                      </div>
                      {variable.aiInsight && (
                        <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          💡 {variable.aiInsight}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'watch' && (
              <div className="p-4">
                <div className="flex space-x-2 mb-4">
                  <input
                    type="text"
                    value={newWatchExpression}
                    onChange={(e) => setNewWatchExpression(e.target.value)}
                    placeholder="Enter expression to watch..."
                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWatch()}
                  />
                  <button
                    onClick={handleAddWatch}
                    disabled={!newWatchExpression.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                  >
                    Add
                  </button>
                </div>

                <div className="space-y-3">
                  {activeSession.watchExpressions.map((watch) => (
                    <div key={watch.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-medium">{watch.expression}</span>
                        <button
                          onClick={() => handleRemoveWatch(watch.id)}
                          className="p-1 text-gray-400 hover:text-red-600 rounded"
                          title="Remove watch expression"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {watch.isValid ? (
                        <div className="font-mono text-sm text-gray-700 bg-white p-2 rounded border">
                          {formatValue(watch.value)}
                        </div>
                      ) : (
                        <div className="text-sm text-red-600 bg-red-50 p-2 rounded border border-red-200">
                          Error: {watch.error}
                        </div>
                      )}
                      {watch.aiExplanation && (
                        <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded">
                          💡 {watch.aiExplanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTab === 'callstack' && (
              <div className="p-4 space-y-3">
                {activeSession.callStack.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No call stack available</div>
                ) : (
                  activeSession.callStack.map((frame, _index) => (
                    <div key={frame.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{frame.name}</span>
                        <span className="text-xs text-gray-500">
                          Line {frame.line}:{frame.column}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">{frame.filePath}</div>
                      <div className="text-xs text-gray-500 mt-1">Scope: {frame.scope}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {selectedTab === 'analysis' && (
              <div className="p-4">
                {activeSession.aiAnalysis ? (
                  <div className="space-y-6">
                    {/* Current State */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h3 className="font-semibold text-blue-900 mb-2">Execution State</h3>
                      <p className="text-blue-800">
                        {activeSession.aiAnalysis.currentState.description}
                      </p>
                      <div className="mt-2 text-sm text-blue-700">
                        Phase:{' '}
                        <span className="font-medium">
                          {activeSession.aiAnalysis.currentState.phase}
                        </span>
                      </div>
                    </div>

                    {/* Issues */}
                    {activeSession.aiAnalysis.issueDetection.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Detected Issues</h3>
                        <div className="space-y-3">
                          {activeSession.aiAnalysis.issueDetection.map((issue) => (
                            <div key={issue.id} className="border border-gray-200 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium">{issue.type}</span>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(issue.severity)}`}
                                >
                                  {issue.severity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                              <div className="text-xs text-gray-600">
                                Root Cause: {issue.rootCause}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Suggestions */}
                    {activeSession.aiAnalysis.suggestions.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">AI Suggestions</h3>
                        <div className="space-y-3">
                          {activeSession.aiAnalysis.suggestions.map((suggestion) => (
                            <div
                              key={suggestion.id}
                              className="bg-green-50 border border-green-200 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-green-900">
                                  {suggestion.title}
                                </span>
                                <span
                                  className={`text-xs px-2 py-1 rounded-full ${
                                    suggestion.priority === 'high'
                                      ? 'bg-red-100 text-red-800'
                                      : suggestion.priority === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {suggestion.priority}
                                </span>
                              </div>
                              <p className="text-sm text-green-800 mb-2">
                                {suggestion.description}
                              </p>
                              <div className="text-xs text-green-700">
                                Expected: {suggestion.expectedOutcome}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Next Steps */}
                    {activeSession.aiAnalysis.nextSteps.length > 0 && (
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Recommended Next Steps</h3>
                        <div className="space-y-2">
                          {activeSession.aiAnalysis.nextSteps.map((step) => (
                            <div
                              key={step.id}
                              className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                            >
                              <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5" />
                              <div>
                                <div className="font-medium text-gray-900">{step.description}</div>
                                <div className="text-sm text-gray-600 mt-1">{step.reasoning}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    Start debugging to see AI analysis
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create Session Modal */}
      {showCreateSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Create Debug Session</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Session Name</label>
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="My Debug Session"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File Path</label>
                <input
                  type="text"
                  value={newSessionFile}
                  onChange={(e) => setNewSessionFile(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/path/to/file.js"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowCreateSession(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSessionName.trim() || !newSessionFile.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No Sessions State */}
      {sessions.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BugAntIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Debug Sessions</h3>
            <p className="text-gray-500 mb-4">
              Create a debug session to start debugging with AI assistance
            </p>
            <button
              onClick={() => setShowCreateSession(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Create Debug Session
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIDebuggerPanel;
