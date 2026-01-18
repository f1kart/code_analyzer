// InlineCommentSystem.tsx - Advanced inline code review comment system
// Displays AI-powered review comments directly inline with code for seamless review experience

import React, { useState, useEffect, useMemo } from 'react';
import { ReviewComment, CodeReviewResult } from '../services/CodeReviewEngine';

export interface InlineCommentProps {
  comment: ReviewComment;
  onFix?: (comment: ReviewComment) => void;
  onDismiss?: (commentId: string) => void;
  onResolve?: (commentId: string) => void;
  className?: string;
}

export interface InlineCommentSystemProps {
  reviewResult: CodeReviewResult;
  code: string;
  onCommentFix?: (comment: ReviewComment, fixedCode: string) => void;
  onCommentDismiss?: (commentId: string) => void;
  onCommentResolve?: (commentId: string) => void;
  className?: string;
}

interface CommentPosition {
  lineNumber: number;
  x: number;
  y: number;
  height: number;
}

export const InlineComment: React.FC<InlineCommentProps> = ({
  comment,
  onFix,
  onDismiss,
  onResolve,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

  const getSeverityColor = (severity: ReviewComment['severity']) => {
    const colors: Record<string, string> = {
      'low': 'text-blue-600 bg-blue-50 border-blue-200',
      'medium': 'text-yellow-600 bg-yellow-50 border-yellow-200',
      'high': 'text-orange-600 bg-orange-50 border-orange-200',
      'critical': 'text-red-600 bg-red-50 border-red-200',
      'info': 'text-gray-600 bg-gray-50 border-gray-200'
    };
    return colors[severity] || colors.medium;
  };

  const getTypeIcon = (type: ReviewComment['type']) => {
    const icons = {
      'info': 'ℹ️',
      'warning': '⚠️',
      'error': '❌',
      'suggestion': '💡',
      'praise': '✅'
    };
    return icons[type] || '💬';
  };

  return (
    <div
      className={`inline-comment ${getSeverityColor(comment.severity)} ${className}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="comment-header flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="comment-icon">{getTypeIcon(comment.type)}</span>
          <span className="comment-category capitalize">{comment.category}</span>
          <span className={`severity-badge ${comment.severity}`}>
            {comment.severity}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {comment.confidence > 0.8 && (
            <span className="confidence-indicator" title={`Confidence: ${Math.round(comment.confidence * 100)}%`}>
              🎯
            </span>
          )}

          <button
            className="expand-button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      <div className="comment-content">
        <p className="comment-message">{comment.message}</p>

        {isExpanded && (
          <div className="comment-details">
            {comment.suggestion && (
              <div className="suggestion-section">
                <h4 className="section-title">💡 Suggestion</h4>
                <pre className="suggestion-code">{comment.suggestion}</pre>
              </div>
            )}

            {comment.codeExample && (
              <div className="example-section">
                <h4 className="section-title">📝 Example</h4>
                <pre className="example-code">{comment.codeExample}</pre>
              </div>
            )}

            {comment.relatedRules && comment.relatedRules.length > 0 && (
              <div className="rules-section">
                <h4 className="section-title">📋 Related Rules</h4>
                <ul className="rules-list">
                  {comment.relatedRules.map((rule, index) => (
                    <li key={index} className="rule-item">{rule}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="comment-meta">
              <span className="line-number">Line {comment.lineNumber}</span>
              {comment.autoFixable && (
                <span className="auto-fixable">🔧 Auto-fixable</span>
              )}
            </div>
          </div>
        )}
      </div>

      {showActions && (
        <div className="comment-actions">
          {comment.autoFixable && onFix && (
            <button
              className="action-button fix-button"
              onClick={() => onFix(comment)}
              title="Apply one-click fix"
            >
              🔧 Fix
            </button>
          )}

          {onResolve && (
            <button
              className="action-button resolve-button"
              onClick={() => onResolve(comment.id)}
              title="Mark as resolved"
            >
              ✅ Resolve
            </button>
          )}

          {onDismiss && (
            <button
              className="action-button dismiss-button"
              onClick={() => onDismiss(comment.id)}
              title="Dismiss comment"
            >
              ❌ Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const InlineCommentSystem: React.FC<InlineCommentSystemProps> = ({
  reviewResult,
  code,
  onCommentFix,
  onCommentDismiss,
  onCommentResolve,
  className = ''
}) => {
  const [commentPositions, setCommentPositions] = useState<CommentPosition[]>([]);
  const [visibleComments, setVisibleComments] = useState<Set<string>>(new Set());
  const [codeLines, setCodeLines] = useState<string[]>([]);

  // Split code into lines for positioning
  useEffect(() => {
    setCodeLines(code.split('\n'));
  }, [code]);

  // Calculate comment positions based on line numbers
  useEffect(() => {
    const positions: CommentPosition[] = [];

    reviewResult.reviewComments.forEach(comment => {
      if (comment.lineNumber <= codeLines.length) {
        // Calculate approximate position (in production would use actual DOM measurements)
        const lineHeight = 24; // Approximate line height in pixels
        const charWidth = 8; // Approximate character width

        positions.push({
          lineNumber: comment.lineNumber,
          x: Math.min(comment.columnStart * charWidth, window.innerWidth - 300),
          y: (comment.lineNumber - 1) * lineHeight,
          height: lineHeight
        });
      }
    });

    setCommentPositions(positions);
  }, [reviewResult.reviewComments, codeLines]);

  // Group comments by line number for better display
  const commentsByLine = useMemo(() => {
    const grouped: Record<number, ReviewComment[]> = {};

    reviewResult.reviewComments.forEach(comment => {
      if (!grouped[comment.lineNumber]) {
        grouped[comment.lineNumber] = [];
      }
      grouped[comment.lineNumber].push(comment);
    });

    return grouped;
  }, [reviewResult.reviewComments]);

  const handleFix = async (comment: ReviewComment) => {
    if (onCommentFix) {
      try {
        // Generate fix using the bug detection service
        const fixedCode = await generateFixForComment(comment, code);
        onCommentFix(comment, fixedCode);
      } catch (error) {
        console.error('Failed to generate fix:', error);
      }
    }
  };

  const handleDismiss = (commentId: string) => {
    setVisibleComments(prev => {
      const newSet = new Set(prev);
      newSet.delete(commentId);
      return newSet;
    });

    if (onCommentDismiss) {
      onCommentDismiss(commentId);
    }
  };

  const handleResolve = (commentId: string) => {
    setVisibleComments(prev => {
      const newSet = new Set(prev);
      newSet.delete(commentId);
      return newSet;
    });

    if (onCommentResolve) {
      onCommentResolve(commentId);
    }
  };

  return (
    <div className={`inline-comment-system ${className}`}>
      <div className="code-with-comments">
        {/* Code display with line numbers */}
        <div className="code-container">
          {codeLines.map((line, index) => (
            <div key={index} className="code-line" data-line-number={index + 1}>
              <span className="line-number">{index + 1}</span>
              <pre className="line-content">{line}</pre>

              {/* Comments for this line */}
              {commentsByLine[index + 1] && (
                <div className="line-comments">
                  {commentsByLine[index + 1]
                    .filter(comment => visibleComments.has(comment.id))
                    .map(comment => (
                      <InlineComment
                        key={comment.id}
                        comment={comment}
                        onFix={handleFix}
                        onDismiss={handleDismiss}
                        onResolve={handleResolve}
                      />
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floating comment panel for better visibility */}
        {Object.keys(commentsByLine).length > 0 && (
          <div className="comment-panel">
            <div className="panel-header">
              <h3>💬 Code Review Comments</h3>
              <div className="comment-stats">
                <span className="stat-item">
                  <span className="stat-count">{reviewResult.reviewComments.length}</span>
                  Total
                </span>
                <span className="stat-item critical">
                  <span className="stat-count">
                    {reviewResult.reviewComments.filter(c => c.severity === 'critical').length}
                  </span>
                  Critical
                </span>
                <span className="stat-item high">
                  <span className="stat-count">
                    {reviewResult.reviewComments.filter(c => c.severity === 'high').length}
                  </span>
                  High
                </span>
              </div>
            </div>

            <div className="comment-list">
              {reviewResult.reviewComments.map(comment => (
                <div
                  key={comment.id}
                  className={`comment-item ${visibleComments.has(comment.id) ? 'visible' : 'hidden'}`}
                >
                  <div className="comment-preview">
                    <span className="comment-type">{getTypeIcon(comment.type)}</span>
                    <span className="comment-text truncate">{comment.message}</span>
                    <span className="comment-line">L{comment.lineNumber}</span>
                  </div>

                  <button
                    className="show-comment-button"
                    onClick={() => {
                      setVisibleComments(prev => {
                        const newSet = new Set(prev);
                        if (newSet.has(comment.id)) {
                          newSet.delete(comment.id);
                        } else {
                          newSet.add(comment.id);
                        }
                        return newSet;
                      });
                    }}
                  >
                    {visibleComments.has(comment.id) ? '👁️ Hide' : '👁️ Show'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .inline-comment-system {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          overflow: hidden;
        }

        .code-with-comments {
          display: flex;
          width: 100%;
          height: 100%;
        }

        .code-container {
          flex: 1;
          overflow-y: auto;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.5;
          background: #1e1e1e;
          color: #d4d4d4;
        }

        .code-line {
          position: relative;
          padding: 0 16px;
          border-left: 3px solid transparent;
          min-height: 24px;
          display: flex;
          align-items: center;
        }

        .code-line:hover {
          background: #2d2d30;
        }

        .line-number {
          width: 50px;
          text-align: right;
          color: #858585;
          margin-right: 16px;
          font-size: 12px;
          user-select: none;
        }

        .line-content {
          flex: 1;
          margin: 0;
          white-space: pre;
          overflow: visible;
        }

        .line-comments {
          position: absolute;
          left: 100%;
          top: 0;
          margin-left: 8px;
          z-index: 1000;
        }

        .comment-panel {
          width: 320px;
          background: #2d3748;
          border-left: 1px solid #e1e4e8;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .panel-header {
          padding: 16px;
          border-bottom: 1px solid #e1e4e8;
          background: #f6f8fa;
        }

        .panel-header h3 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
        }

        .comment-stats {
          display: flex;
          gap: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          font-size: 11px;
          color: #586069;
        }

        .stat-count {
          font-size: 16px;
          font-weight: 600;
          color: #24292e;
        }

        .stat-item.critical .stat-count {
          color: #cb2431;
        }

        .stat-item.high .stat-count {
          color: #f39c12;
        }

        .comment-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .comment-item {
          padding: 8px;
          border: 1px solid #e1e4e8;
          border-radius: 6px;
          margin-bottom: 8px;
          cursor: pointer;
        }

        .comment-item.hidden {
          opacity: 0.6;
        }

        .comment-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
        }

        .comment-type {
          font-size: 14px;
        }

        .comment-text {
          flex: 1;
        }

        .comment-line {
          color: #586069;
          font-weight: 500;
        }

        .show-comment-button {
          margin-top: 4px;
          font-size: 11px;
          padding: 2px 6px;
          background: #f6f8fa;
          border: 1px solid #d1d9e0;
          border-radius: 3px;
        }

        .inline-comment {
          position: absolute;
          min-width: 280px;
          max-width: 400px;
          background: #2d3748;
          border: 1px solid;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          font-size: 13px;
        }

        .comment-header {
          padding: 8px 12px;
          border-bottom: 1px solid;
          font-weight: 600;
          font-size: 12px;
        }

        .comment-content {
          padding: 12px;
        }

        .comment-message {
          margin: 0 0 12px 0;
          line-height: 1.4;
        }

        .comment-details {
          margin-top: 12px;
        }

        .section-title {
          font-size: 11px;
          font-weight: 600;
          margin: 0 0 6px 0;
          color: #586069;
        }

        .suggestion-code,
        .example-code {
          background: #f6f8fa;
          padding: 8px;
          border-radius: 3px;
          font-size: 11px;
          overflow-x: auto;
          margin: 0;
        }

        .rules-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .rule-item {
          padding: 2px 0;
          font-size: 11px;
          color: #586069;
        }

        .comment-meta {
          margin-top: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: #586069;
        }

        .comment-actions {
          padding: 8px 12px;
          border-top: 1px solid;
          display: flex;
          gap: 6px;
        }

        .action-button {
          flex: 1;
          padding: 4px 8px;
          font-size: 11px;
          border: 1px solid;
          border-radius: 3px;
          cursor: pointer;
          background: #2d3748;
        }

        .fix-button {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .resolve-button {
          background: #0366d6;
          color: white;
          border-color: #0366d6;
        }

        .dismiss-button {
          background: #d73a49;
          color: white;
          border-color: #d73a49;
        }

        .severity-badge {
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .confidence-indicator {
          font-size: 12px;
        }
      `}</style>
    </div>
  );
};

// Helper function to generate fixes for comments
async function generateFixForComment(comment: ReviewComment, code: string): Promise<string> {
  // In production, this would use the BugDetectionService to generate actual fixes
  // For now, return a placeholder
  return `// Fixed: ${comment.message}\n${code}`;
}

// Helper function to get type icon
function getTypeIcon(type: ReviewComment['type']): string {
  const icons = {
    'info': 'ℹ️',
    'warning': '⚠️',
    'error': '❌',
    'suggestion': '💡',
    'praise': '✅'
  };
  return icons[type] || '💬';
}
