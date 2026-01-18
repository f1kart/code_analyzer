import React, { useState, useEffect } from 'react';
import { runCodeReview, generateReviewPipeline, PipelineReviewResult } from '../services/CodeReviewPipelineService';

interface PipelineIntegrationProps {
  projectPath: string;
  onReviewComplete?: (result: PipelineReviewResult) => void;
  onReviewStart?: () => void;
  className?: string;
}

interface PipelineStatus {
  isRunning: boolean;
  progress: number;
  currentStep: string;
  result?: PipelineReviewResult;
  error?: string;
}

export const PipelineIntegration: React.FC<PipelineIntegrationProps> = ({
  projectPath,
  onReviewComplete,
  onReviewStart,
  className = ''
}) => {
  const [status, setStatus] = useState<PipelineStatus>({
    isRunning: false,
    progress: 0,
    currentStep: 'Ready',
  });

  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    failOnCritical: true,
    failOnError: false,
    failOnWarning: false,
    minConfidenceThreshold: 0.7,
    enableAIAgents: true,
    parallelAnalysis: true,
  });

  /**
   * Trigger pipeline code review
   */
  const triggerReview = async () => {
    setStatus({
      isRunning: true,
      progress: 0,
      currentStep: 'Initializing review...',
    });

    onReviewStart?.();

    try {
      // Simulate progress updates
      const progressSteps = [
        'Discovering files to analyze...',
        'Analyzing code patterns...',
        'Running AI agent analysis...',
        'Checking security vulnerabilities...',
        'Validating test coverage...',
        'Generating review report...',
        'Finalizing results...',
      ];

      for (let i = 0; i < progressSteps.length; i++) {
        setStatus(prev => ({
          ...prev,
          progress: ((i + 1) / progressSteps.length) * 100,
          currentStep: progressSteps[i],
        }));

        // Simulate step duration
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      }

      // Run actual review
      const result = await runCodeReview(projectPath);

      setStatus(prev => ({
        ...prev,
        isRunning: false,
        progress: 100,
        currentStep: 'Review completed',
        result,
      }));

      onReviewComplete?.(result);

    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isRunning: false,
        error: error instanceof Error ? error.message : 'Review failed',
      }));
    }
  };

  /**
   * Generate CI/CD pipeline configuration
   */
  const generatePipelineConfig = () => {
    const pipelineConfig = generateReviewPipeline({
      platform: 'github',
      projectType: 'nodejs',
      failOnCritical: config.failOnCritical,
      failOnError: config.failOnError,
    });

    // Copy to clipboard
    navigator.clipboard.writeText(pipelineConfig);
    alert('Pipeline configuration copied to clipboard!');
  };

  const getStatusColor = () => {
    if (status.error) return 'text-red-600';
    if (status.isRunning) return 'text-blue-600';
    if (status.result?.summary.passed) return 'text-green-600';
    if (status.result && !status.result.summary.passed) return 'text-red-600';
    return 'text-gray-600';
  };

  const getStatusIcon = () => {
    if (status.error) return '❌';
    if (status.isRunning) return '🔄';
    if (status.result?.summary.passed) return '✅';
    if (status.result && !status.result.summary.passed) return '⚠️';
    return '⏸️';
  };

  return (
    <div className={`pipeline-integration ${className}`}>
      <div className="pipeline-header">
        <h3>🚀 CI/CD Pipeline Integration</h3>
        <button
          className="config-toggle"
          onClick={() => setShowConfig(!showConfig)}
        >
          {showConfig ? 'Hide Config' : 'Show Config'}
        </button>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="config-panel">
          <h4>Review Configuration</h4>

          <div className="config-options">
            <label className="config-option">
              <input
                type="checkbox"
                checked={config.failOnCritical}
                onChange={(e) => setConfig(prev => ({ ...prev, failOnCritical: e.target.checked }))}
              />
              <span>Fail on Critical Issues</span>
            </label>

            <label className="config-option">
              <input
                type="checkbox"
                checked={config.failOnError}
                onChange={(e) => setConfig(prev => ({ ...prev, failOnError: e.target.checked }))}
              />
              <span>Fail on Error Issues</span>
            </label>

            <label className="config-option">
              <input
                type="checkbox"
                checked={config.failOnWarning}
                onChange={(e) => setConfig(prev => ({ ...prev, failOnWarning: e.target.checked }))}
              />
              <span>Fail on Warning Issues</span>
            </label>

            <label className="config-option">
              <input
                type="checkbox"
                checked={config.enableAIAgents}
                onChange={(e) => setConfig(prev => ({ ...prev, enableAIAgents: e.target.checked }))}
              />
              <span>Enable AI Agent Analysis</span>
            </label>

            <label className="config-option">
              <input
                type="checkbox"
                checked={config.parallelAnalysis}
                onChange={(e) => setConfig(prev => ({ ...prev, parallelAnalysis: e.target.checked }))}
              />
              <span>Parallel Analysis</span>
            </label>
          </div>

          <div className="config-actions">
            <button
              className="generate-pipeline-btn"
              onClick={generatePipelineConfig}
            >
              📋 Generate Pipeline Config
            </button>
          </div>
        </div>
      )}

      {/* Review Status */}
      <div className="review-status">
        <div className="status-header">
          <span className={`status-icon ${getStatusColor()}`}>
            {getStatusIcon()}
          </span>
          <span className="status-text">{status.currentStep}</span>
        </div>

        {status.isRunning && (
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Results Summary */}
      {status.result && (
        <div className="results-summary">
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Files</span>
              <span className="stat-value">{status.result.totalFiles}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Issues</span>
              <span className="stat-value">{status.result.totalIssues}</span>
            </div>
            <div className="stat critical">
              <span className="stat-label">Critical</span>
              <span className="stat-value">{status.result.criticalIssues}</span>
            </div>
            <div className="stat error">
              <span className="stat-label">Errors</span>
              <span className="stat-value">{status.result.errorIssues}</span>
            </div>
          </div>

          <div className="summary-message">
            <p className={status.result.summary.passed ? 'success' : 'failure'}>
              {status.result.summary.message}
            </p>
          </div>

          {status.result.summary.recommendations.length > 0 && (
            <div className="recommendations">
              <h5>Recommendations:</h5>
              <ul>
                {status.result.summary.recommendations.map((rec: string, index: number) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-buttons">
        <button
          className="trigger-review-btn"
          onClick={triggerReview}
          disabled={status.isRunning}
        >
          {status.isRunning ? '⏳ Running Review...' : '🚀 Run Code Review'}
        </button>

        {status.result && (
          <button
            className="view-report-btn"
            onClick={() => {
              if (status.result?.reportPath) {
                // Open report in new tab
                window.open(status.result.reportPath, '_blank');
              }
            }}
          >
            📊 View Full Report
          </button>
        )}
      </div>

      <style>{`
        .pipeline-integration {
          background: #2d3748;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .pipeline-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .pipeline-header h3 {
          margin: 0;
          color: #212529;
        }

        .config-toggle {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 12px;
          cursor: pointer;
        }

        .config-panel {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .config-panel h4 {
          margin: 0 0 12px 0;
          color: #495057;
        }

        .config-options {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .config-option {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .config-option input[type="checkbox"] {
          margin: 0;
        }

        .config-actions {
          border-top: 1px solid #dee2e6;
          padding-top: 12px;
        }

        .generate-pipeline-btn {
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          font-size: 12px;
          cursor: pointer;
        }

        .review-status {
          margin-bottom: 20px;
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .status-icon {
          font-size: 16px;
        }

        .status-text {
          font-weight: 500;
        }

        .progress-bar {
          width: 100%;
          height: 4px;
          background: #e9ecef;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #007bff;
          transition: width 0.3s ease;
        }

        .results-summary {
          background: #f8f9fa;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 20px;
        }

        .summary-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 16px;
          margin-bottom: 16px;
        }

        .stat {
          text-align: center;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 24px;
          font-weight: bold;
          color: #212529;
        }

        .stat.critical .stat-value {
          color: #dc3545;
        }

        .stat.error .stat-value {
          color: #fd7e14;
        }

        .summary-message {
          margin-bottom: 12px;
        }

        .summary-message p {
          margin: 0;
          font-weight: 500;
        }

        .summary-message p.success {
          color: #155724;
        }

        .summary-message p.failure {
          color: #721c24;
        }

        .recommendations h5 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #495057;
        }

        .recommendations ul {
          margin: 0;
          padding-left: 20px;
        }

        .recommendations li {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
        }

        .trigger-review-btn,
        .view-report-btn {
          padding: 10px 16px;
          border-radius: 4px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }

        .trigger-review-btn {
          background: #28a745;
          color: white;
        }

        .trigger-review-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
        }

        .view-report-btn {
          background: #6c757d;
          color: white;
        }

        .view-report-btn:hover:not(:disabled) {
          background: #5a6268;
        }
      `}</style>
    </div>
  );
};
