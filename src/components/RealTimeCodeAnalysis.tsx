import React, { useState, useEffect, useCallback, useRef } from 'react';
import { analyzeCode, CodeAnalysisResult } from '../services/IntelligentCodeAnalysisService';
import { getAnalyticsService } from '../services/UsageAnalyticsService';

interface RealTimeAnalysisProps {
  filePath: string;
  content: string;
  language: string;
  onIssueDetected?: (issue: CodeAnalysisResult) => void;
  onCodeImproved?: (improvements: string[]) => void;
  debounceMs?: number;
  className?: string;
}

interface AnalysisState {
  issues: CodeAnalysisResult[];
  isAnalyzing: boolean;
  lastAnalysis: number;
  error?: string;
}

export const RealTimeCodeAnalysis: React.FC<RealTimeAnalysisProps> = ({
  filePath,
  content,
  language,
  onIssueDetected,
  onCodeImproved,
  debounceMs = 500,
  className = ''
}) => {
  const [analysis, setAnalysis] = useState<AnalysisState>({
    issues: [],
    isAnalyzing: false,
    lastAnalysis: 0,
  });

  const [showPanel, setShowPanel] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<CodeAnalysisResult | null>(null);

  const analysisTimeoutRef = useRef<NodeJS.Timeout>();
  const analyticsService = getAnalyticsService();

  /**
   * Debounced analysis trigger
   */
  const triggerAnalysis = useCallback(async () => {
    if (!content.trim()) {
      setAnalysis(prev => ({ ...prev, issues: [], isAnalyzing: false }));
      return;
    }

    setAnalysis(prev => ({ ...prev, isAnalyzing: true, error: undefined }));

    try {
      const context = {
        filePath,
        language,
        projectType: 'typescript', // Would detect from project
        dependencies: [], // Would extract from package.json
        recentChanges: [], // Would track git changes
        existingIssues: analysis.issues,
        codePatterns: [], // Would learn from codebase
        conventions: {}, // Would learn from codebase
      };

      const issues = await analyzeCode(filePath, content, context);

      setAnalysis(prev => ({
        ...prev,
        issues,
        isAnalyzing: false,
        lastAnalysis: Date.now(),
      }));

      // Track analysis event
      analyticsService?.trackFeatureUsage('real_time_analysis', {
        filePath,
        issuesFound: issues.length,
        language,
      });

      // Notify parent of issues
      issues.forEach(issue => {
        onIssueDetected?.(issue);
      });

      // Check for improvements
      if (issues.length === 0 && content.length > 100) {
        const improvements = generateImprovementSuggestions(content, language);
        onCodeImproved?.(improvements);
      }

    } catch (error) {
      console.error('Real-time analysis error:', error);
      setAnalysis(prev => ({
        ...prev,
        isAnalyzing: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      }));
    }
  }, [filePath, content, language, analysis.issues, onIssueDetected, onCodeImproved, analyticsService]);

  /**
   * Debounced analysis effect
   */
  useEffect(() => {
    if (analysisTimeoutRef.current) {
      clearTimeout(analysisTimeoutRef.current);
    }

    analysisTimeoutRef.current = setTimeout(triggerAnalysis, debounceMs);

    return () => {
      if (analysisTimeoutRef.current) {
        clearTimeout(analysisTimeoutRef.current);
      }
    };
  }, [content, triggerAnalysis, debounceMs]);

  /**
   * Generate improvement suggestions for good code
   */
  const generateImprovementSuggestions = (code: string, lang: string): string[] => {
    const suggestions: string[] = [];

    if (lang === 'typescript' || lang === 'javascript') {
      // Check for potential improvements
      if (code.includes('function') && !code.includes('async')) {
        suggestions.push('Consider using async/await for better error handling');
      }

      if (code.includes('class') && !code.includes('private')) {
        suggestions.push('Consider using private fields for better encapsulation');
      }

      if (code.length > 1000 && !code.includes('/*')) {
        suggestions.push('Consider adding JSDoc comments for complex functions');
      }
    }

    return suggestions;
  };

  /**
   * Get severity color
   */
  const getSeverityColor = (severity: CodeAnalysisResult['severity']) => {
    const colors = {
      info: 'text-blue-600 bg-blue-50 border-blue-200',
      warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      error: 'text-red-600 bg-red-50 border-red-200',
      critical: 'text-red-800 bg-red-100 border-red-300',
    };
    return colors[severity] || colors.info;
  };

  /**
   * Get type icon
   */
  const getTypeIcon = (type: CodeAnalysisResult['type']) => {
    const icons = {
      syntax: '🔧',
      logic: '🧠',
      performance: '⚡',
      security: '🔒',
      style: '🎨',
      best_practice: '✨',
      test: '🧪',
      documentation: '📚',
    };
    return icons[type] || '💬';
  };

  return (
    <div className={`real-time-analysis ${className}`}>
      {/* Analysis Status Bar */}
      <div className="analysis-status-bar">
        <div className="flex items-center gap-2">
          <div className={`analysis-indicator ${analysis.isAnalyzing ? 'analyzing' : 'idle'}`}>
            {analysis.isAnalyzing ? '🔍' : '✅'}
          </div>

          <span className="analysis-status-text">
            {analysis.isAnalyzing
              ? 'Analyzing code...'
              : `${analysis.issues.length} issues found`}
          </span>

          {analysis.error && (
            <span className="error-indicator" title={analysis.error}>
              ❌
            </span>
          )}
        </div>

        <button
          className="toggle-panel-button"
          onClick={() => setShowPanel(!showPanel)}
          title={showPanel ? 'Hide analysis panel' : 'Show analysis panel'}
        >
          {showPanel ? '▼' : '▶'}
        </button>
      </div>

      {/* Analysis Panel */}
      {showPanel && (
        <div className="analysis-panel">
          <div className="panel-header">
            <h3>🧠 Real-Time Code Analysis</h3>
            <div className="panel-stats">
              <span className="stat">
                <span className="stat-count">{analysis.issues.length}</span>
                Issues
              </span>
              <span className="stat critical">
                <span className="stat-count">
                  {analysis.issues.filter(i => i.severity === 'critical').length}
                </span>
                Critical
              </span>
              <span className="stat warning">
                <span className="stat-count">
                  {analysis.issues.filter(i => i.severity === 'warning').length}
                </span>
                Warnings
              </span>
            </div>
          </div>

          <div className="issues-list">
            {analysis.issues.length === 0 ? (
              <div className="no-issues">
                <div className="success-icon">🎉</div>
                <p>No issues detected!</p>
                <p className="text-sm text-gray-600">
                  Your code looks good. Consider adding tests and documentation for production readiness.
                </p>
              </div>
            ) : (
              analysis.issues.map((issue, index) => (
                <div
                  key={`${issue.lineNumber}-${issue.type}-${index}`}
                  className={`issue-item ${getSeverityColor(issue.severity)}`}
                  onClick={() => setSelectedIssue(issue)}
                >
                  <div className="issue-header">
                    <div className="issue-info">
                      <span className="issue-type">
                        {getTypeIcon(issue.type)}
                      </span>
                      <span className="issue-category">{issue.category}</span>
                      <span className="issue-line">L{issue.lineNumber}</span>
                    </div>

                    <div className="issue-actions">
                      {issue.autoFixable && (
                        <button
                          className="fix-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Trigger fix logic
                          }}
                          title="Auto-fix this issue"
                        >
                          🔧
                        </button>
                      )}

                      <button
                        className="resolve-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Mark as resolved
                        }}
                        title="Mark as resolved"
                      >
                        ✅
                      </button>
                    </div>
                  </div>

                  <div className="issue-content">
                    <p className="issue-message">{issue.message}</p>

                    {issue.suggestion && (
                      <div className="issue-suggestion">
                        <h4>💡 Suggestion</h4>
                        <p>{issue.suggestion}</p>
                      </div>
                    )}

                    {issue.codeExample && (
                      <div className="issue-example">
                        <h4>📝 Example</h4>
                        <pre>{issue.codeExample}</pre>
                      </div>
                    )}

                    <div className="issue-meta">
                      <span className={`confidence ${issue.confidence > 0.8 ? 'high' : issue.confidence > 0.6 ? 'medium' : 'low'}`}>
                        Confidence: {Math.round(issue.confidence * 100)}%
                      </span>
                      <span className="issue-tags">
                        {issue.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Issue Details */}
          {selectedIssue && (
            <div className="selected-issue-details">
              <div className="details-header">
                <h4>Detailed Analysis</h4>
                <button
                  className="close-details"
                  onClick={() => setSelectedIssue(null)}
                >
                  ✕
                </button>
              </div>

              <div className="details-content">
                <div className="issue-overview">
                  <h5>{selectedIssue.category}</h5>
                  <p>{selectedIssue.message}</p>
                </div>

                {selectedIssue.relatedRules && selectedIssue.relatedRules.length > 0 && (
                  <div className="related-rules">
                    <h6>📋 Related Rules</h6>
                    <ul>
                      {selectedIssue.relatedRules.map((rule, index) => (
                        <li key={index}>{rule}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="issue-actions-detailed">
                  {selectedIssue.autoFixable && (
                    <button className="primary-action">
                      🔧 Apply Fix
                    </button>
                  )}

                  <button className="secondary-action">
                    📋 Create Task
                  </button>

                  <button className="secondary-action">
                    👥 Ask Team
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        .real-time-analysis {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .analysis-status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
          font-size: 12px;
        }

        .analysis-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        .analysis-indicator.analyzing {
          background: #fff3cd;
          animation: pulse 1.5s infinite;
        }

        .analysis-indicator.idle {
          background: #d4edda;
        }

        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }

        .error-indicator {
          color: #dc3545;
          font-size: 14px;
        }

        .toggle-panel-button {
          background: none;
          border: 1px solid #ced4da;
          border-radius: 4px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 10px;
        }

        .analysis-panel {
          position: absolute;
          top: 100%;
          right: 0;
          left: 0;
          background: #2d3748;
          border: 1px solid #e9ecef;
          border-top: none;
          max-height: 400px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          z-index: 1000;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 14px;
          color: #212529;
        }

        .panel-stats {
          display: flex;
          gap: 12px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-size: 10px;
          color: #6c757d;
        }

        .stat-count {
          font-size: 14px;
          font-weight: 600;
          color: #212529;
        }

        .stat.critical .stat-count {
          color: #dc3545;
        }

        .stat.warning .stat-count {
          color: #ffc107;
        }

        .issues-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .no-issues {
          text-align: center;
          padding: 32px 16px;
          color: #6c757d;
        }

        .success-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .issue-item {
          padding: 12px;
          border: 1px solid;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .issue-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .issue-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .issue-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .issue-type {
          font-size: 14px;
        }

        .issue-category {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          color: #6c757d;
        }

        .issue-line {
          font-size: 11px;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .issue-actions {
          display: flex;
          gap: 4px;
        }

        .fix-button,
        .resolve-button {
          background: none;
          border: 1px solid #ced4da;
          border-radius: 3px;
          padding: 2px 6px;
          cursor: pointer;
          font-size: 10px;
        }

        .fix-button {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .resolve-button {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .issue-content {
          font-size: 12px;
        }

        .issue-message {
          margin: 0 0 8px 0;
          line-height: 1.4;
        }

        .issue-suggestion,
        .issue-example {
          margin-bottom: 8px;
        }

        .issue-suggestion h4,
        .issue-example h4 {
          margin: 0 0 4px 0;
          font-size: 11px;
          color: #495057;
        }

        .issue-suggestion p {
          margin: 0;
          font-style: italic;
          color: #6c757d;
        }

        .issue-example pre {
          background: #f8f9fa;
          padding: 6px;
          border-radius: 3px;
          margin: 0;
          font-size: 10px;
          overflow-x: auto;
        }

        .issue-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          font-size: 10px;
        }

        .confidence {
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 500;
        }

        .confidence.high {
          background: #d4edda;
          color: #155724;
        }

        .confidence.medium {
          background: #fff3cd;
          color: #856404;
        }

        .confidence.low {
          background: #f8d7da;
          color: #721c24;
        }

        .tag {
          background: #e9ecef;
          color: #495057;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 9px;
        }

        .selected-issue-details {
          border-top: 1px solid #e9ecef;
          padding: 16px;
          background: #f8f9fa;
        }

        .details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .details-header h4 {
          margin: 0;
          font-size: 14px;
          color: #212529;
        }

        .close-details {
          background: none;
          border: none;
          font-size: 16px;
          cursor: pointer;
          color: #6c757d;
        }

        .issue-overview h5 {
          margin: 0 0 8px 0;
          color: #495057;
        }

        .issue-overview p {
          margin: 0;
          line-height: 1.4;
        }

        .related-rules {
          margin: 16px 0;
        }

        .related-rules h6 {
          margin: 0 0 8px 0;
          font-size: 12px;
          color: #495057;
        }

        .related-rules ul {
          margin: 0;
          padding-left: 20px;
        }

        .related-rules li {
          font-size: 11px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .issue-actions-detailed {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        .primary-action,
        .secondary-action {
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 11px;
          cursor: pointer;
          border: 1px solid;
        }

        .primary-action {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .secondary-action {
          background: #2d3748;
          color: #495057;
          border-color: #ced4da;
        }
      `}</style>
    </div>
  );
};
