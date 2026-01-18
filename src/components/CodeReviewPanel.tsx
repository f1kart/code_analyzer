// CodeReviewPanel.tsx - Main code review panel with autonomous generate-review-iterate cycles
// Orchestrates the complete AI-powered code review workflow with seamless agent integration

import React, { useState, useEffect, useCallback } from 'react';
import { CodeReviewEngine, CodeReviewResult, ReviewComment } from '../services/CodeReviewEngine';
import { InlineCommentSystem } from './InlineCommentSystem';
import { OneClickFixSystem, FixResult } from './OneClickFixSystem';
import { AIAgentIntegrator } from '../services/AIAgentIntegrator';

export interface CodeReviewPanelProps {
  filePath: string;
  code: string;
  onCodeChange?: (newCode: string) => void;
  className?: string;
  autoReview?: boolean;
  reviewInterval?: number; // Auto-review interval in milliseconds
}

export interface ReviewCycle {
  id: string;
  timestamp: Date;
  reviewResult: CodeReviewResult;
  fixesApplied: FixResult[];
  agentResponses: any[];
  status: 'analyzing' | 'reviewing' | 'fixing' | 'complete' | 'error';
}

export const CodeReviewPanel: React.FC<CodeReviewPanelProps> = ({
  filePath,
  code,
  onCodeChange,
  className = '',
  autoReview = true,
  reviewInterval = 30000 // 30 seconds default
}) => {
  const [reviewResult, setReviewResult] = useState<CodeReviewResult | null>(null);
  const [reviewCycles, setReviewCycles] = useState<ReviewCycle[]>([]);
  const [currentCycle, setCurrentCycle] = useState<ReviewCycle | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'review' | 'fixes' | 'agents' | 'history'>('review');

  const reviewEngine = new CodeReviewEngine();
  const agentIntegrator = new AIAgentIntegrator();

  /**
   * Start autonomous review cycle
   */
  const startReviewCycle = useCallback(async () => {
    if (isReviewing || !code.trim()) return;

    setIsReviewing(true);

    const cycleId = `cycle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCycle: ReviewCycle = {
      id: cycleId,
      timestamp: new Date(),
      reviewResult: {} as CodeReviewResult,
      fixesApplied: [],
      agentResponses: [],
      status: 'analyzing'
    };

    setCurrentCycle(newCycle);
    setReviewCycles(prev => [newCycle, ...prev.slice(0, 9)]); // Keep last 10 cycles

    try {
      // Step 1: Generate code review
      newCycle.status = 'reviewing';
      setCurrentCycle({ ...newCycle });

      const result = await reviewEngine.reviewCode(filePath, code, {
        includeBugs: true,
        includeRefactoring: true,
        includeTests: true,
        includeQualityMetrics: true,
        includeAIAgentContext: true,
        severityThreshold: 'medium',
        agentIntegrations: ['claude', 'cursor', 'gemini']
      });

      newCycle.reviewResult = result;
      setReviewResult(result);
      setCurrentCycle({ ...newCycle });

      // Step 2: Apply automatic fixes for critical issues
      newCycle.status = 'fixing';
      setCurrentCycle({ ...newCycle });

      const criticalComments = result.reviewComments.filter(
        comment => comment.severity === 'critical' && comment.autoFixable
      );

      const fixes: FixResult[] = [];
      for (const comment of criticalComments) {
        try {
          const fixResult = await reviewEngine.generateFix(filePath, code, {
            id: comment.id,
            type: 'logic',
            category: 'logic',
            severity: comment.severity === 'info' ? 'low' : comment.severity,
            title: comment.message,
            description: comment.suggestion || '',
            lineNumber: comment.lineNumber,
            suggestedFix: comment.suggestion || '',
            confidence: comment.confidence,
            impact: 'Automatic fix applied'
          });

          if (fixResult.fixedCode !== code) {
            fixes.push({
              success: true,
              originalCode: code,
              fixedCode: fixResult.fixedCode,
              explanation: fixResult.explanation,
              warnings: [],
              rollbackData: JSON.stringify({ originalCode: code, timestamp: Date.now() })
            });

            // Update code with fix
            if (onCodeChange) {
              onCodeChange(fixResult.fixedCode);
            }
          }
        } catch (error) {
          console.error('Failed to apply automatic fix:', error);
        }
      }

      newCycle.fixesApplied = fixes;
      setCurrentCycle({ ...newCycle });

      // Step 3: Get AI agent feedback
      if (result.aiAgentContext) {
        const agentResponses = await getAgentFeedback(result);
        newCycle.agentResponses = agentResponses;
        setCurrentCycle({ ...newCycle });
      }

      newCycle.status = 'complete';
      setCurrentCycle({ ...newCycle });

    } catch (error) {
      console.error('Review cycle failed:', error);
      newCycle.status = 'error';
      setCurrentCycle({ ...newCycle });
    } finally {
      setIsReviewing(false);
    }
  }, [filePath, code, isReviewing, reviewEngine, onCodeChange]);

  /**
   * Get feedback from AI agents
   */
  const getAgentFeedback = async (reviewResult: CodeReviewResult) => {
    const responses = [];

    for (const agent of ['claude', 'cursor', 'gemini'] as const) {
      try {
        const context = agentIntegrator.exportForAgent(reviewResult, agent);
        const response = await agentIntegrator.requestFromAgent(agent, context);

        responses.push({
          agent,
          response,
          timestamp: new Date()
        });
      } catch (error) {
        console.error(`Failed to get feedback from ${agent}:`, error);
        responses.push({
          agent,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date()
        });
      }
    }

    return responses;
  };

  /**
   * Manual review trigger
   */
  const triggerReview = useCallback(() => {
    startReviewCycle();
  }, [startReviewCycle]);

  /**
   * Handle code changes and trigger re-review
   */
  useEffect(() => {
    if (autoReview && code.trim()) {
      const timeoutId = setTimeout(() => {
        startReviewCycle();
      }, reviewInterval);

      return () => clearTimeout(timeoutId);
    }
  }, [code, autoReview, reviewInterval, startReviewCycle]);

  /**
   * Handle fix application
   */
  const handleFixApplied = useCallback((result: FixResult) => {
    if (result.success && onCodeChange) {
      onCodeChange(result.fixedCode);
    }
  }, [onCodeChange]);

  /**
   * Handle inline comment fix (adapter for InlineCommentSystem)
   */
  const handleInlineCommentFix = useCallback((comment: ReviewComment, fixedCode: string) => {
    if (onCodeChange) {
      onCodeChange(fixedCode);
    }
  }, [onCodeChange]);

  /**
   * Handle comment dismissal
   */
  const handleCommentDismiss = useCallback((commentId: string) => {
    if (reviewResult) {
      const updatedComments = reviewResult.reviewComments.filter(c => c.id !== commentId);
      setReviewResult({
        ...reviewResult,
        reviewComments: updatedComments
      });
    }
  }, [reviewResult]);

  /**
   * Handle comment resolution
   */
  const handleCommentResolve = useCallback((commentId: string) => {
    if (reviewResult) {
      const updatedComments = reviewResult.reviewComments.filter(c => c.id !== commentId);
      setReviewResult({
        ...reviewResult,
        reviewComments: updatedComments
      });
    }
  }, [reviewResult]);

  // Initial review on mount
  useEffect(() => {
    if (code.trim()) {
      startReviewCycle();
    }
  }, []); // Only run on mount

  return (
    <div className={`code-review-panel ${className}`}>
      {/* Header with controls */}
      <div className="panel-header">
        <div className="header-info">
          <h2>🤖 AI Code Review</h2>
          <div className="review-status">
            {currentCycle ? (
              <span className={`status-badge ${currentCycle.status}`}>
                {currentCycle.status === 'analyzing' && '🔍 Analyzing...'}
                {currentCycle.status === 'reviewing' && '📋 Reviewing...'}
                {currentCycle.status === 'fixing' && '🔧 Fixing...'}
                {currentCycle.status === 'complete' && '✅ Complete'}
                {currentCycle.status === 'error' && '❌ Error'}
              </span>
            ) : (
              <span className="status-badge idle">⏸️ Idle</span>
            )}

            {reviewResult && (
              <span className="issues-count">
                {reviewResult.reviewComments.length} issues
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <button
            className="review-button"
            onClick={triggerReview}
            disabled={isReviewing}
          >
            {isReviewing ? '⏳ Reviewing...' : '🔄 Review Now'}
          </button>

          <div className="view-tabs">
            {(['review', 'fixes', 'agents', 'history'] as const).map(tab => (
              <button
                key={tab}
                className={`tab-button ${selectedTab === tab ? 'active' : ''}`}
                onClick={() => setSelectedTab(tab)}
              >
                {tab === 'review' && '📋 Review'}
                {tab === 'fixes' && '🔧 Fixes'}
                {tab === 'agents' && '🤖 Agents'}
                {tab === 'history' && '📚 History'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="panel-content">
        {selectedTab === 'review' && reviewResult && (
          <div className="review-tab">
            <InlineCommentSystem
              reviewResult={reviewResult}
              code={code}
              onCommentFix={handleInlineCommentFix}
              onCommentDismiss={handleCommentDismiss}
              onCommentResolve={handleCommentResolve}
            />
          </div>
        )}

        {selectedTab === 'fixes' && reviewResult && (
          <div className="fixes-tab">
            <OneClickFixSystem
              reviewResult={reviewResult}
              currentCode={code}
              onFixApplied={handleFixApplied}
            />
          </div>
        )}

        {selectedTab === 'agents' && reviewResult && (
          <div className="agents-tab">
            <AIAgentFeedbackPanel
              reviewResult={reviewResult}
              agentResponses={currentCycle?.agentResponses || []}
            />
          </div>
        )}

        {selectedTab === 'history' && (
          <div className="history-tab">
            <ReviewHistoryPanel
              reviewCycles={reviewCycles}
              onCycleSelect={(cycle) => setCurrentCycle(cycle)}
            />
          </div>
        )}
      </div>

      <style>{`
        .code-review-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .header-info h2 {
          margin: 0 0 8px 0;
          font-size: 18px;
          color: #212529;
        }

        .review-status {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .status-badge {
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.analyzing {
          background: #fff3cd;
          color: #856404;
        }

        .status-badge.reviewing {
          background: #cce7ff;
          color: #0066cc;
        }

        .status-badge.fixing {
          background: #d1ecf1;
          color: #0c5460;
        }

        .status-badge.complete {
          background: #d4edda;
          color: #155724;
        }

        .status-badge.error {
          background: #f8d7da;
          color: #721c24;
        }

        .status-badge.idle {
          background: #e2e3e5;
          color: #383d41;
        }

        .issues-count {
          font-size: 14px;
          color: #6c757d;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .review-button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .review-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .review-button:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .view-tabs {
          display: flex;
          background: white;
          border-radius: 6px;
          padding: 4px;
        }

        .tab-button {
          padding: 8px 12px;
          background: transparent;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          color: #6c757d;
          transition: all 0.2s;
        }

        .tab-button:hover {
          background: #f8f9fa;
          color: #495057;
        }

        .tab-button.active {
          background: #007bff;
          color: white;
        }

        .panel-content {
          flex: 1;
          overflow: hidden;
        }

        .review-tab,
        .fixes-tab,
        .agents-tab,
        .history-tab {
          height: 100%;
          padding: 16px;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
};

// AI Agent Feedback Panel Component
interface AIAgentFeedbackPanelProps {
  reviewResult: CodeReviewResult;
  agentResponses: any[];
}

const AIAgentFeedbackPanel: React.FC<AIAgentFeedbackPanelProps> = ({
  reviewResult,
  agentResponses
}) => {
  return (
    <div className="agent-feedback-panel">
      <h3>🤖 AI Agent Feedback</h3>

      {reviewResult.aiAgentContext && (
        <div className="agent-context">
          <h4>💬 Suggested Prompts</h4>
          <div className="prompts-list">
            {reviewResult.aiAgentContext.suggestedPrompts.map((prompt, index) => (
              <div key={index} className="prompt-item">
                <pre>{prompt}</pre>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="agent-responses">
        <h4>🔄 Agent Responses</h4>

        {agentResponses.length === 0 ? (
          <p className="no-responses">No agent responses yet. Run a review to get AI feedback.</p>
        ) : (
          <div className="responses-list">
            {agentResponses.map((response, index) => (
              <div key={index} className="response-item">
                <div className="response-header">
                  <span className="agent-name">{response.agent}</span>
                  <span className="response-time">
                    {response.timestamp?.toLocaleTimeString()}
                  </span>
                </div>

                {response.error ? (
                  <div className="response-error">
                    ❌ {response.error}
                  </div>
                ) : (
                  <div className="response-content">
                    {response.response?.generatedCode && (
                      <div className="generated-code">
                        <h5>📝 Generated Code</h5>
                        <pre>{response.response.generatedCode}</pre>
                      </div>
                    )}

                    {response.response?.explanation && (
                      <div className="response-explanation">
                        <h5>💡 Explanation</h5>
                        <p>{response.response.explanation}</p>
                      </div>
                    )}

                    {response.response?.suggestions && response.response.suggestions.length > 0 && (
                      <div className="response-suggestions">
                        <h5>🎯 Suggestions</h5>
                        <ul>
                          {response.response.suggestions.map((suggestion: string, i: number) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .agent-feedback-panel h3 {
          margin: 0 0 16px 0;
          color: #212529;
        }

        .agent-context {
          margin-bottom: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .agent-context h4 {
          margin: 0 0 12px 0;
          color: #495057;
        }

        .prompts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .prompt-item pre {
          background: white;
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
          margin: 0;
          font-size: 12px;
        }

        .agent-responses h4 {
          margin: 0 0 12px 0;
          color: #495057;
        }

        .no-responses {
          text-align: center;
          color: #6c757d;
          font-style: italic;
          padding: 24px;
        }

        .responses-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .response-item {
          border: 1px solid #e9ecef;
          border-radius: 8px;
          overflow: hidden;
        }

        .response-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .agent-name {
          font-weight: 600;
          color: #007bff;
          text-transform: capitalize;
        }

        .response-time {
          font-size: 12px;
          color: #6c757d;
        }

        .response-error {
          padding: 16px;
          color: #721c24;
          background: #f8d7da;
        }

        .response-content {
          padding: 16px;
        }

        .generated-code,
        .response-explanation,
        .response-suggestions {
          margin-bottom: 16px;
        }

        .generated-code h5,
        .response-explanation h5,
        .response-suggestions h5 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #495057;
        }

        .generated-code pre {
          background: #f8f9fa;
          padding: 12px;
          border-radius: 4px;
          border: 1px solid #e9ecef;
          margin: 0;
          font-size: 12px;
          overflow-x: auto;
        }

        .response-explanation p {
          margin: 0;
          line-height: 1.5;
          color: #212529;
        }

        .response-suggestions ul {
          margin: 0;
          padding-left: 20px;
        }

        .response-suggestions li {
          margin-bottom: 4px;
          line-height: 1.4;
          color: #212529;
        }
      `}</style>
    </div>
  );
};

// Review History Panel Component
interface ReviewHistoryPanelProps {
  reviewCycles: ReviewCycle[];
  onCycleSelect: (cycle: ReviewCycle) => void;
}

const ReviewHistoryPanel: React.FC<ReviewHistoryPanelProps> = ({
  reviewCycles,
  onCycleSelect
}) => {
  return (
    <div className="review-history-panel">
      <h3>📚 Review History</h3>

      {reviewCycles.length === 0 ? (
        <p className="no-history">No review history available.</p>
      ) : (
        <div className="history-list">
          {reviewCycles.map(cycle => (
            <div
              key={cycle.id}
              className={`history-item ${cycle.status}`}
              onClick={() => onCycleSelect(cycle)}
            >
              <div className="history-header">
                <span className="cycle-time">
                  {cycle.timestamp.toLocaleTimeString()}
                </span>
                <span className={`cycle-status ${cycle.status}`}>
                  {cycle.status}
                </span>
              </div>

              <div className="history-stats">
                <span className="stat">
                  {cycle.reviewResult.reviewComments?.length || 0} issues
                </span>
                <span className="stat">
                  {cycle.fixesApplied.length} fixes
                </span>
                <span className="stat">
                  {cycle.agentResponses.length} agents
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .review-history-panel h3 {
          margin: 0 0 16px 0;
          color: #212529;
        }

        .no-history {
          text-align: center;
          color: #6c757d;
          font-style: italic;
          padding: 24px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .history-item {
          padding: 12px;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .history-item:hover {
          background: #f8f9fa;
          border-color: #007bff;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .cycle-time {
          font-size: 12px;
          color: #6c757d;
        }

        .cycle-status {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .cycle-status.analyzing {
          background: #fff3cd;
          color: #856404;
        }

        .cycle-status.reviewing {
          background: #cce7ff;
          color: #0066cc;
        }

        .cycle-status.fixing {
          background: #d1ecf1;
          color: #0c5460;
        }

        .cycle-status.complete {
          background: #d4edda;
          color: #155724;
        }

        .cycle-status.error {
          background: #f8d7da;
          color: #721c24;
        }

        .history-stats {
          display: flex;
          gap: 12px;
        }

        .stat {
          font-size: 11px;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
};
