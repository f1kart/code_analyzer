/**
 * RateLimitStatusBar - Visual Rate Limit Status Display
 * 
 * ENTERPRISE FEATURES:
 * - Real-time quota visualization
 * - Queue status display
 * - Estimated wait time
 * - Color-coded status indicators
 * - Expandable metrics panel
 * - Accessibility compliant
 * 
 * @module RateLimitStatusBar
 */

import React, { useState } from 'react';
import { useRateLimitStatus } from '../hooks/useGeminiRateLimiter';

export interface RateLimitStatusBarProps {
  /**
   * Show detailed metrics panel
   */
  showDetails?: boolean;

  /**
   * Position of the status bar
   */
  position?: 'top' | 'bottom';

  /**
   * Compact mode (smaller display)
   */
  compact?: boolean;
}

export const RateLimitStatusBar: React.FC<RateLimitStatusBarProps> = ({
  showDetails = false,
  position = 'bottom',
  compact = false,
}) => {
  const { statusColor, statusMessage, queueStatus, metrics, estimatedWaitTime } =
    useRateLimitStatus();
  const [isExpanded, setIsExpanded] = useState(showDetails);

  const getColorClass = () => {
    switch (statusColor) {
      case 'red':
        return 'bg-red-500 text-white';
      case 'orange':
        return 'bg-orange-500 text-white';
      case 'yellow':
        return 'bg-yellow-500 text-black';
      case 'green':
      default:
        return 'bg-green-500 text-white';
    }
  };

  const formatWaitTime = (ms: number): string => {
    if (ms === 0) return 'Now';
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatSuccessRate = (rate: number): string => {
    return `${rate.toFixed(1)}%`;
  };

  return (
    <div
      className={`rate-limit-status-bar ${position === 'top' ? 'border-b' : 'border-t'} border-gray-700 bg-gray-800`}
      role="status"
      aria-live="polite"
      aria-label="API Rate Limit Status"
    >
      {/* Main Status Bar */}
      <div
        className={`flex items-center justify-between px-4 ${compact ? 'py-1' : 'py-2'} cursor-pointer hover:bg-gray-750 transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Click to expand rate limit details"
      >
        {/* Left: Status Indicator */}
        <div className="flex items-center gap-3">
          <div
            className={`${getColorClass()} px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2`}
            title={`${metrics.requestsThisMinute}/10 requests used this minute`}
          >
            <span className="animate-pulse">●</span>
            {statusMessage}
          </div>

          {queueStatus && (
            <div
              className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-semibold"
              title="Requests waiting in queue"
            >
              {queueStatus}
            </div>
          )}
        </div>

        {/* Right: Quick Stats */}
        {!compact && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <div title="Requests this minute">
              <span className="font-semibold text-white">
                {metrics.requestsThisMinute}
              </span>
              /10 RPM
            </div>
            <div title="Requests today">
              <span className="font-semibold text-white">
                {metrics.requestsToday}
              </span>
              /1500 daily
            </div>
            {estimatedWaitTime > 0 && (
              <div
                className="text-orange-400 font-semibold"
                title="Estimated wait time for next request"
              >
                ⏱️ {formatWaitTime(estimatedWaitTime)}
              </div>
            )}
            <button
              className="text-gray-400 hover:text-white transition-colors"
              title={isExpanded ? 'Collapse details' : 'Expand details'}
              aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          </div>
        )}
      </div>

      {/* Expanded Details Panel */}
      {isExpanded && (
        <div className="border-t border-gray-700 bg-gray-850 px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {/* Total Requests */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Total Requests</div>
              <div className="text-white text-lg font-semibold">
                {metrics.totalRequests}
              </div>
            </div>

            {/* Success Rate */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Success Rate</div>
              <div
                className={`text-lg font-semibold ${
                  metrics.successRate >= 95
                    ? 'text-green-400'
                    : metrics.successRate >= 80
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {formatSuccessRate(metrics.successRate)}
              </div>
            </div>

            {/* Total Retries */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Retries</div>
              <div className="text-orange-400 text-lg font-semibold">
                {metrics.totalRetries}
              </div>
            </div>

            {/* Total Errors */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Errors</div>
              <div className="text-red-400 text-lg font-semibold">
                {metrics.totalErrors}
              </div>
            </div>

            {/* Average Wait Time */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Avg Wait Time</div>
              <div className="text-blue-400 text-lg font-semibold">
                {formatWaitTime(metrics.averageWaitTime)}
              </div>
            </div>

            {/* Queue Length */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Queue Length</div>
              <div className="text-purple-400 text-lg font-semibold">
                {metrics.queueLength}
              </div>
            </div>

            {/* Requests This Minute */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">This Minute</div>
              <div className="text-white text-lg font-semibold">
                {metrics.requestsThisMinute}/10
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.requestsThisMinute >= 9
                      ? 'bg-red-500'
                      : metrics.requestsThisMinute >= 7
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${(metrics.requestsThisMinute / 10) * 100}%` }}
                />
              </div>
            </div>

            {/* Requests Today */}
            <div className="metric-card">
              <div className="text-gray-400 text-xs mb-1">Today</div>
              <div className="text-white text-lg font-semibold">
                {metrics.requestsToday}/1500
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className={`h-2 rounded-full transition-all ${
                    metrics.requestsToday >= 1400
                      ? 'bg-red-500'
                      : metrics.requestsToday >= 1000
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                  style={{ width: `${(metrics.requestsToday / 1500) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-400">
            <p>
              <strong className="text-white">Free Tier Limits:</strong> 10
              requests/minute, 1500 requests/day. Requests are automatically
              queued when limits are reached.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
