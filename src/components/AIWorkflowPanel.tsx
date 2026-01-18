import React, { useState, useEffect, useCallback } from 'react';
import {
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  CogIcon,
  UserGroupIcon,
  ArrowPathIcon,
  TrashIcon,
  EyeIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { aiWorkflowEngine, WorkflowSession, AIAgent } from '../services/aiWorkflowEngine';
import { useNotifications } from './NotificationSystem';

interface AIWorkflowPanelProps {
  className?: string;
  selectedCode?: string;
  filePath?: string;
  projectPath?: string;
}

export const AIWorkflowPanel: React.FC<AIWorkflowPanelProps> = ({
  className = '',
  selectedCode,
  filePath,
  projectPath,
}) => {
  const [sessions, setSessions] = useState<WorkflowSession[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [activeSession, setActiveSession] = useState<WorkflowSession | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [userGoal, setUserGoal] = useState('');
  const [workflowType, setWorkflowType] = useState<'debate' | 'sequential'>('debate');
  const [selectedAgents, _setSelectedAgents] = useState<string[]>([]);

  const { addNotification } = useNotifications();

  // Load sessions and agents
  useEffect(() => {
    loadData();
  }, []);

  const loadData = useCallback(() => {
    setSessions(aiWorkflowEngine.getAllSessions());
    setAgents(aiWorkflowEngine.getAllAgents());
  }, []);

  // Run AI Workflow
  const runWorkflow = useCallback(async () => {
    if (!selectedCode && !filePath) {
      addNotification('warning', 'No Code Selected', {
        message: 'Please select code or open a file to analyze',
        duration: 3000,
      });
      return;
    }

    if (!userGoal.trim()) {
      addNotification('warning', 'Goal Required', {
        message: 'Please specify what you want to achieve',
        duration: 3000,
      });
      return;
    }

    setIsRunning(true);

    try {
      const context = {
        projectPath,
        selectedCode,
        filePath,
        userGoal: userGoal.trim(),
        additionalContext: `File: ${filePath || 'Unknown'}`,
      };

      let session: WorkflowSession;

      if (workflowType === 'debate') {
        session = await aiWorkflowEngine.runDebateWorkflow(
          context,
          selectedAgents[0] || 'primary-coder',
          selectedAgents[1] || 'critic-reviewer',
          5,
        );
      } else {
        const agentSequence =
          selectedAgents.length > 0
            ? selectedAgents
            : [
                'planner-architect',
                'primary-coder',
                'critic-reviewer',
                'security-auditor',
                'integrator-finalizer',
              ];

        session = await aiWorkflowEngine.runSequentialWorkflow(context, agentSequence);
      }

      setActiveSession(session);
      loadData();

      addNotification('success', 'Workflow Completed', {
        message: `${workflowType === 'debate' ? 'Debate' : 'Sequential'} workflow finished successfully`,
        duration: 5000,
      });
    } catch (error) {
      console.error('Workflow execution failed:', error);
      addNotification('error', 'Workflow Failed', {
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        duration: 5000,
      });
    } finally {
      setIsRunning(false);
    }
  }, [
    selectedCode,
    filePath,
    projectPath,
    userGoal,
    workflowType,
    selectedAgents,
    addNotification,
    loadData,
  ]);

  const toggleSessionExpansion = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  const deleteSession = useCallback(
    (sessionId: string) => {
      aiWorkflowEngine.deleteSession(sessionId);
      loadData();
      if (activeSession?.id === sessionId) {
        setActiveSession(null);
      }
      addNotification('info', 'Session Deleted', {
        message: 'Workflow session has been removed',
        duration: 3000,
      });
    },
    [activeSession, loadData, addNotification],
  );

  const getStatusIcon = (status: WorkflowSession['status']) => {
    switch (status) {
      case 'running':
        return <ArrowPathIcon className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />;
    }
  };

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
          <UserGroupIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Workflows</h2>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Settings"
        >
          <CogIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Workflow Configuration */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Goal
            </label>
            <textarea
              value={userGoal}
              onChange={(e) => setUserGoal(e.target.value)}
              placeholder="Describe what you want to achieve (e.g., 'Refactor this code for better performance')"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 text-sm"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workflow Type
              </label>
              <select
                value={workflowType}
                onChange={(e) => setWorkflowType(e.target.value as 'debate' | 'sequential')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800 dark:text-gray-100 text-sm"
                title="Select workflow type"
                aria-label="Workflow type selection"
              >
                <option value="debate">Agent Debate Room</option>
                <option value="sequential">Sequential Team</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Context
              </label>
              <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded border">
                {selectedCode ? `${selectedCode.length} chars selected` : filePath || 'No file'}
              </div>
            </div>
          </div>

          <button
            onClick={runWorkflow}
            disabled={isRunning || !userGoal.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRunning ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Running Workflow...
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                Start {workflowType === 'debate' ? 'Debate' : 'Sequential'} Workflow
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Recent Sessions ({sessions.length})
          </h3>

          {sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No workflow sessions yet</p>
              <p className="text-sm">Start your first AI workflow above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="p-3 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSessionExpansion(session.id)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                        >
                          {expandedSessions.has(session.id) ? (
                            <ChevronDownIcon className="w-4 h-4" />
                          ) : (
                            <ChevronRightIcon className="w-4 h-4" />
                          )}
                        </button>
                        {getStatusIcon(session.status)}
                        <div>
                          <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                            {session.title}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {session.type === 'debate' ? 'Debate Room' : 'Sequential Team'} •
                            {new Date(session.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setActiveSession(session)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                          title="Delete Session"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {session.result && (
                      <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                        Confidence: {session.result.confidence.toFixed(1)}% • Steps:{' '}
                        {session.steps.length} • Duration:{' '}
                        {formatDuration(session.updatedAt - session.createdAt)}
                      </div>
                    )}
                  </div>

                  {expandedSessions.has(session.id) && (
                    <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="space-y-2">
                        <div className="text-sm">
                          <span className="font-medium">Goal:</span> {session.context.userGoal}
                        </div>

                        <div className="text-sm">
                          <span className="font-medium">Steps:</span>
                          <div className="mt-1 space-y-1">
                            {session.steps.map((step, index) => (
                              <div key={step.id} className="flex items-center gap-2 text-xs">
                                <span className="w-4 text-center">{index + 1}.</span>
                                {getStatusIcon(step.status)}
                                <span className="flex-1">
                                  {agents.find((a) => a.id === step.agentId)?.name || step.agentId}
                                </span>
                                {step.duration && (
                                  <span className="text-gray-500">
                                    {formatDuration(step.duration)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {session.result?.recommendations &&
                          session.result.recommendations.length > 0 && (
                            <div className="text-sm">
                              <span className="font-medium">Key Recommendations:</span>
                              <ul className="mt-1 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                                {session.result.recommendations.slice(0, 3).map((rec, i) => (
                                  <li key={i}>{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Session Details Modal */}
      {activeSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {activeSession.title}
              </h2>
              <button
                onClick={() => setActiveSession(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Close session details"
              >
                <XCircleIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {/* Session Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Type:</span>{' '}
                    {activeSession.type === 'debate' ? 'Agent Debate Room' : 'Sequential Team'}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> {activeSession.status}
                  </div>
                  <div>
                    <span className="font-medium">Created:</span>{' '}
                    {new Date(activeSession.createdAt).toLocaleString()}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span>{' '}
                    {formatDuration(activeSession.updatedAt - activeSession.createdAt)}
                  </div>
                </div>

                {/* Goal */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Goal</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
                    {activeSession.context.userGoal}
                  </p>
                </div>

                {/* Steps */}
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                    Workflow Steps ({activeSession.steps.length})
                  </h3>
                  <div className="space-y-3">
                    {activeSession.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full flex items-center justify-center text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {agents.find((a) => a.id === step.agentId)?.name || step.agentId}
                            </span>
                            {getStatusIcon(step.status)}
                          </div>
                          {step.duration && (
                            <span className="text-xs text-gray-500">
                              {formatDuration(step.duration)}
                            </span>
                          )}
                        </div>

                        {step.output && (
                          <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">Output:</div>
                            <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                              {step.output.length > 500
                                ? step.output.substring(0, 500) + '...'
                                : step.output}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Final Result */}
                {activeSession.result && (
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                      Final Result
                    </h3>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="font-medium">Confidence:</span>{' '}
                        {activeSession.result.confidence.toFixed(1)}%
                      </div>

                      {activeSession.result.finalOutput && (
                        <div>
                          <div className="text-sm font-medium mb-1">Generated Code:</div>
                          <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-3 rounded overflow-x-auto whitespace-pre-wrap border">
                            {activeSession.result.finalOutput}
                          </pre>
                        </div>
                      )}

                      {activeSession.result.recommendations.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-1">Recommendations:</div>
                          <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside space-y-1">
                            {activeSession.result.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
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

export default AIWorkflowPanel;
