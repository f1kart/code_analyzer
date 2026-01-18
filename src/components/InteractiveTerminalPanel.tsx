import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayIcon,
  StopIcon,
  PlusIcon,
  XMarkIcon,
  CommandLineIcon,
  BugAntIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import {
  aiTerminal,
  TerminalSession,
  TerminalOutput,
  AIDebugSession,
} from '../services/aiTerminal';

interface InteractiveTerminalPanelProps {
  className?: string;
  projectPath?: string;
}

export const InteractiveTerminalPanel: React.FC<InteractiveTerminalPanelProps> = ({
  className = '',
  projectPath = '',
}) => {
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<TerminalSession | null>(null);
  const [debugSessions, setDebugSessions] = useState<AIDebugSession[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [selectedDebugSession, setSelectedDebugSession] = useState<AIDebugSession | null>(null);
  const [autoScroll, _setAutoScroll] = useState(true);
  const [aiAvailable, setAiAvailable] = useState<boolean>(true);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleNewOutput = useCallback(
    (sessionId: string, _output: TerminalOutput) => {
      if (sessionId === activeSession?.id) {
        // Trigger re-render by updating sessions
        setSessions(aiTerminal.getSessions());
      }
    },
    [activeSession?.id],
  );

  useEffect(() => {
    const unsubscribeSessions = aiTerminal.onSessionsChanged(setSessions);
    const unsubscribeOutput = aiTerminal.onOutput(handleNewOutput);

    // Load initial data
    setSessions(aiTerminal.getSessions());
    setActiveSession(aiTerminal.getActiveSession());
    setDebugSessions(aiTerminal.getDebugSessions());
    setCommandHistory(aiTerminal.getCommandHistory());

    return () => {
      unsubscribeSessions();
      unsubscribeOutput();
    };
  }, [handleNewOutput]);

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [activeSession?.history, autoScroll]);

  // Focus input whenever an active session becomes available
  useEffect(() => {
    if (activeSession) {
      inputRef.current?.focus();
    }
  }, [activeSession]);

  const createNewSession = async () => {
    try {
      const session = await aiTerminal.createSession({
        name: `Terminal ${sessions.length + 1}`,
        cwd: projectPath || '',
      });
      await aiTerminal.activateSession(session.id);
      // Ensure we have the latest active session reference
      const latest = aiTerminal.getActiveSession() || session;
      setActiveSession(latest);
      // Focus input so user can type immediately
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  };

  const switchSession = async (sessionId: string) => {
    try {
      await aiTerminal.activateSession(sessionId);
      const session = aiTerminal.getSession(sessionId);
      setActiveSession(session);
      // Focus input on session switch
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      console.error('Failed to switch terminal session:', error);
    }
  };

  const closeSession = async (sessionId: string) => {
    try {
      await aiTerminal.closeSession(sessionId);
      setSessions(aiTerminal.getSessions());
      setActiveSession(aiTerminal.getActiveSession());
    } catch (error) {
      console.error('Failed to close terminal session:', error);
    }
  };

  const executeCommand = async () => {
    if (!currentCommand.trim() || !activeSession || isExecuting) return;

    setIsExecuting(true);
    try {
      const command = await aiTerminal.executeCommand(currentCommand, activeSession.id);

      // Update command history
      const newHistory = [...commandHistory, currentCommand];
      setCommandHistory(newHistory);
      setHistoryIndex(-1);
      setCurrentCommand('');

      // Update sessions to reflect new command
      setSessions(aiTerminal.getSessions());

      // Check for new debug sessions
      setDebugSessions(aiTerminal.getDebugSessions());

      // Auto-open debug panel if error occurred
      if (command.exitCode !== 0 && command.error) {
        setShowDebugPanel(true);
        const newDebugSession = aiTerminal
          .getDebugSessions()
          .find(
            (ds) => ds.terminalId === activeSession.id && ds.context.command === command.command,
          );
        if (newDebugSession) {
          setSelectedDebugSession(newDebugSession);
        }
      }
    } catch (error) {
      console.error('Failed to execute command:', error);
    } finally {
      setIsExecuting(false);
    }
  };

  const interruptCommand = async () => {
    if (!activeSession) return;

    try {
      await aiTerminal.interruptCommand(activeSession.id);
      setIsExecuting(false);
    } catch (error) {
      console.error('Failed to interrupt command:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    }
  };

  const formatOutput = (output: TerminalOutput) => {
    const className =
      output.type === 'stderr'
        ? 'text-red-400'
        : output.type === 'system'
          ? 'text-blue-400'
          : 'text-gray-300';

    return (
      <div key={output.timestamp} className={`font-mono text-sm ${className} whitespace-pre-wrap`}>
        {output.content}
      </div>
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const applySuggestion = async (suggestionId: string, debugSessionId: string) => {
    try {
      const success = await aiTerminal.applySuggestion(suggestionId, debugSessionId);
      if (success) {
        // Refresh debug sessions
        setDebugSessions(aiTerminal.getDebugSessions());
        setSessions(aiTerminal.getSessions());
      }
    } catch (error) {
      console.error('Failed to apply suggestion:', error);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <CommandLineIcon className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-semibold">AI Terminal</h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowDebugPanel(!showDebugPanel)}
            className={`p-2 rounded-lg transition-colors ${
              showDebugPanel ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
            }`}
            title="Toggle Debug Panel"
          >
            <BugAntIcon className="w-4 h-4" />
          </button>
          <button
            onClick={createNewSession}
            className="p-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            title="New Terminal Session"
          >
            <PlusIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      {!aiAvailable && (
        <div className="px-4 py-2 bg-yellow-900/40 text-yellow-300 text-xs border-b border-yellow-700">
          AI analysis is disabled (no Gemini key detected). Commands still run; debugging
          suggestions will use safe defaults.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Terminal Area */}
        <div className="flex-1 flex flex-col">
          {/* Session Tabs */}
          <div className="flex items-center space-x-1 p-2 bg-gray-800 border-b border-gray-700 overflow-x-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`flex items-center space-x-2 px-3 py-1 rounded-t-lg cursor-pointer transition-colors ${
                  session.isActive
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                onClick={() => switchSession(session.id)}
              >
                <span className="text-sm font-medium truncate max-w-32">{session.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeSession(session.id);
                  }}
                  className="p-0.5 hover:bg-gray-600 rounded"
                  title="Close session"
                >
                  <XMarkIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Terminal Output */}
          <div ref={terminalRef} className="flex-1 p-4 overflow-y-auto bg-black font-mono text-sm">
            {activeSession ? (
              <>
                {activeSession.history.map((cmd) => (
                  <div key={cmd.id} className="mb-4">
                    {/* Command Header */}
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-green-400">$</span>
                      <span className="text-white">{cmd.command}</span>
                      <span className="text-gray-500 text-xs">
                        {formatTimestamp(cmd.timestamp)}
                      </span>
                      {cmd.exitCode !== 0 && (
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                      )}
                      {cmd.aiAnalysis && (
                        <div className="flex items-center space-x-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              cmd.aiAnalysis.riskLevel === 'safe'
                                ? 'bg-green-400'
                                : cmd.aiAnalysis.riskLevel === 'low'
                                  ? 'bg-yellow-400'
                                  : cmd.aiAnalysis.riskLevel === 'medium'
                                    ? 'bg-orange-400'
                                    : 'bg-red-400'
                            }`}
                          />
                          <span className="text-xs text-gray-400">{cmd.aiAnalysis.category}</span>
                        </div>
                      )}
                    </div>

                    {/* Command Output */}
                    <div className="ml-4">
                      {cmd.output.map((output, index) => (
                        <div key={index}>{formatOutput(output)}</div>
                      ))}
                      {cmd.error && (
                        <div className="text-red-400 font-mono text-sm">Error: {cmd.error}</div>
                      )}
                    </div>

                    {/* AI Analysis */}
                    {cmd.aiAnalysis && (
                      <div className="ml-4 mt-2 p-2 bg-gray-800 rounded border-l-2 border-blue-400">
                        <div className="text-blue-400 text-xs font-semibold mb-1">AI Analysis</div>
                        <div className="text-gray-300 text-xs">{cmd.aiAnalysis.explanation}</div>
                        {cmd.aiAnalysis.suggestions.length > 0 && (
                          <div className="mt-1">
                            <div className="text-yellow-400 text-xs font-semibold">
                              Suggestions:
                            </div>
                            {cmd.aiAnalysis.suggestions.map((suggestion, idx) => (
                              <div key={idx} className="text-gray-300 text-xs">
                                • {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            ) : (
              <div className="text-gray-500 text-center mt-8">
                No active terminal session. Create a new session to get started.
              </div>
            )}
          </div>

          {/* Command Input */}
          {activeSession && (
            <div className="p-4 bg-gray-800 border-t border-gray-700">
              <div className="flex items-center space-x-2">
                <span className="text-green-400 font-mono">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentCommand}
                  onChange={(e) => setCurrentCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter command..."
                  className="flex-1 bg-transparent border-none outline-none text-white font-mono"
                  disabled={isExecuting}
                />
                <div className="flex items-center space-x-1">
                  {isExecuting ? (
                    <button
                      onClick={interruptCommand}
                      className="p-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      title="Interrupt Command"
                    >
                      <StopIcon className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={executeCommand}
                      disabled={!currentCommand.trim()}
                      className="p-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg transition-colors"
                      title="Execute Command"
                    >
                      <PlayIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Debug Panel */}
        {showDebugPanel && (
          <div className="w-96 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <BugAntIcon className="w-5 h-5 text-red-400" />
                  <span>AI Debugger</span>
                </h3>
                <button
                  onClick={() => setShowDebugPanel(false)}
                  className="p-1 hover:bg-gray-700 rounded"
                  title="Close debug panel"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {debugSessions.length === 0 ? (
                <div className="text-gray-500 text-center">No debug sessions active</div>
              ) : (
                debugSessions.map((debugSession) => (
                  <div
                    key={debugSession.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDebugSession?.id === debugSession.id
                        ? 'border-blue-400 bg-blue-900/20'
                        : 'border-gray-600 hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedDebugSession(debugSession)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">Debug Session</span>
                      <span className="text-xs text-gray-400">
                        {formatTimestamp(debugSession.createdAt)}
                      </span>
                    </div>

                    <div className="text-xs text-gray-300 mb-2">
                      Command:{' '}
                      <code className="bg-gray-700 px-1 rounded">
                        {debugSession.context.command}
                      </code>
                    </div>

                    <div className="flex items-center space-x-2 mb-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          debugSession.analysis.impact === 'critical'
                            ? 'bg-red-400'
                            : debugSession.analysis.impact === 'major'
                              ? 'bg-orange-400'
                              : debugSession.analysis.impact === 'minor'
                                ? 'bg-yellow-400'
                                : 'bg-blue-400'
                        }`}
                      />
                      <span className="text-xs text-gray-400">
                        {debugSession.analysis.errorType} • {debugSession.analysis.impact}
                      </span>
                    </div>

                    <div className="text-xs text-gray-300">
                      {debugSession.analysis.explanation.substring(0, 100)}...
                    </div>
                  </div>
                ))
              )}

              {/* Debug Session Details */}
              {selectedDebugSession && (
                <div className="border-t border-gray-700 pt-4">
                  <h4 className="font-semibold mb-3">Debug Analysis</h4>

                  <div className="space-y-3">
                    <div>
                      <div className="text-sm font-medium text-gray-300 mb-1">Root Cause</div>
                      <div className="text-sm text-gray-400">
                        {selectedDebugSession.analysis.rootCause}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm font-medium text-gray-300 mb-1">Explanation</div>
                      <div className="text-sm text-gray-400">
                        {selectedDebugSession.analysis.explanation}
                      </div>
                    </div>

                    {selectedDebugSession.suggestions.length > 0 && (
                      <div>
                        <div className="text-sm font-medium text-gray-300 mb-2">Suggestions</div>
                        <div className="space-y-2">
                          {selectedDebugSession.suggestions.map((suggestion) => (
                            <div key={suggestion.id} className="p-2 bg-gray-700 rounded">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium">{suggestion.title}</span>
                                <div className="flex items-center space-x-1">
                                  <span
                                    className={`text-xs px-1 py-0.5 rounded ${
                                      suggestion.priority === 'high'
                                        ? 'bg-red-600'
                                        : suggestion.priority === 'medium'
                                          ? 'bg-yellow-600'
                                          : 'bg-blue-600'
                                    }`}
                                  >
                                    {suggestion.priority}
                                  </span>
                                  {suggestion.automated && (
                                    <button
                                      onClick={() =>
                                        applySuggestion(suggestion.id, selectedDebugSession.id)
                                      }
                                      className="p-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                                      title="Apply Suggestion"
                                    >
                                      <ArrowPathIcon className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs text-gray-300 mb-2">
                                {suggestion.description}
                              </div>
                              {suggestion.commands.length > 0 && (
                                <div className="space-y-1">
                                  {suggestion.commands.map((cmd, idx) => (
                                    <div key={idx} className="flex items-center space-x-2">
                                      <code className="text-xs bg-gray-800 px-2 py-1 rounded flex-1">
                                        {cmd}
                                      </code>
                                      <button
                                        onClick={() => copyToClipboard(cmd)}
                                        className="p-1 hover:bg-gray-600 rounded"
                                        title="Copy Command"
                                      >
                                        <DocumentDuplicateIcon className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InteractiveTerminalPanel;
